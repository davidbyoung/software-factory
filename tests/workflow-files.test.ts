// The two workflow files `factory sync` writes into a repository, read as
// YAML: each calls one of the factory's own workflows at one version, and
// holds only what the repository's settings decide.
import { describe, expect, it } from "vitest";
import { format } from "prettier";
import { parse } from "yaml";
import { SESSION_MINUTES } from "../src/config.mts";
import {
  FACTORY_EVENTS,
  factoryWorkflow,
  HELD_EVENT,
  reviewWorkflow,
  type WorkflowOptions,
} from "../src/workflow-files.mts";

const options = (over: Partial<WorkflowOptions> = {}): WorkflowOptions => ({
  version: "0.3.0",
  branch: "main",
  parts: [],
  pollMinutes: null,
  ref: (key) => `#${key}`,
  minutes: { ...SESSION_MINUTES },
  overrideLabel: "verdict-override",
  secrets: [],
  ...over,
});
const factory = (over: Partial<WorkflowOptions> = {}) =>
  parse(factoryWorkflow(options(over)));
const review = (over: Partial<WorkflowOptions> = {}) =>
  parse(reviewWorkflow(options(over)));

describe("factory.yml", () => {
  it("calls the factory's run.yml at the version the lock names, from one job", () => {
    const file = factory();
    expect(file.name).toBe("Factory");
    expect(Object.keys(file.jobs)).toEqual(["factory"]);
    expect(file.jobs.factory.uses).toBe(
      "davidbyoung/software-factory/.github/workflows/run.yml@v0.3.0",
    );
  });

  it("calls the copy in the same commit in the factory's own repository", () => {
    expect(factory({ version: null }).jobs.factory.uses).toBe(
      "./.github/workflows/run.yml",
    );
  });

  it("starts on exactly the events a code host's policy for it lists", () => {
    expect(Object.keys(factory().on)).toEqual(FACTORY_EVENTS);
    expect(FACTORY_EVENTS).toContain(HELD_EVENT);
  });

  it("starts on everything that is judged from the default branch's copy", () => {
    const { on } = factory();
    expect(on.pull_request_target.types).toEqual([
      "opened",
      "reopened",
      "synchronize",
      "ready_for_review",
      "converted_to_draft",
      "closed",
      "labeled",
      "unlabeled",
    ]);
    expect(on.pull_request_review.types).toEqual(["submitted"]);
    expect(on.workflow_run).toEqual({
      workflows: ["Factory review"],
      types: ["completed"],
    });
    expect(Object.keys(on.workflow_dispatch.inputs)).toEqual([
      "job",
      "ticket",
      "pr",
      "review",
    ]);
  });

  it("names the default branch in the push trigger, quoted where YAML needs it", () => {
    expect(factory({ branch: "trunk" }).on.push.branches).toEqual(["trunk"]);
    expect(factory({ branch: "release: next" }).on.push.branches).toEqual([
      "release: next",
    ]);
  });

  it("has the three schedules, and the poller's last only when the settings ask for it", () => {
    const crons = (over: Partial<WorkflowOptions>) =>
      factory(over).on.schedule.map((s: { cron: string }) => s.cron);
    const fixed = ["0 1,13,19 * * *", "0 7 * * *", "0 9 * * *"];
    expect(crons({})).toEqual(fixed);
    expect(crons({ pollMinutes: 5 })).toEqual([...fixed, "*/5 * * * *"]);
    expect(crons({ pollMinutes: 60 })).toEqual([...fixed, "0 * * * *"]);
  });

  it("names a build's run by the ticket as its system writes it, and no other run", () => {
    expect(factory()["run-name"]).toBe(
      "${{ inputs.ticket && format('Build #{0}', inputs.ticket) || '' }}",
    );
    expect(factory({ ref: (key) => `it's ${key}` })["run-name"]).toBe(
      "${{ inputs.ticket && format('Build it''s {0}', inputs.ticket) || '' }}",
    );
  });

  it("grants what the factory's jobs post with, and no more", () => {
    expect(factory().permissions).toEqual({
      actions: "read",
      contents: "read",
      issues: "write",
      "pull-requests": "write",
      statuses: "write",
    });
  });

  it("passes the parts that are on, a run by hand's inputs, and each token by name", () => {
    const job = factory({ parts: ["review", "board"] }).jobs.factory;
    expect(job.with).toEqual({
      parts: "review board",
      job: "${{ inputs.job }}",
      ticket: "${{ inputs.ticket }}",
      pr: "${{ inputs.pr }}",
      review: "${{ inputs.review }}",
    });
    expect(job.secrets).toEqual({
      "build-token":
        "${{ secrets.FACTORY_BUILD_TOKEN || secrets.FACTORY_BOARD_TOKEN }}",
      "board-token": "${{ secrets.FACTORY_BOARD_TOKEN }}",
      "automerge-token": "${{ secrets.FACTORY_AUTOMERGE_TOKEN }}",
      "signing-key": "${{ secrets.FACTORY_SIGNING_KEY }}",
      "claude-token": "${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}",
      "claude-api-key": "${{ secrets.ANTHROPIC_API_KEY }}",
    });
    expect(factory().jobs.factory.with.parts).toBe("");
  });

  it("passes a session's minutes, and its job's limit ten over, only where the settings change them", () => {
    const job = factory({
      minutes: { ...SESSION_MINUTES, build: 90, dependencies: 20 },
    }).jobs.factory;
    expect(job.with["build-minutes"]).toBe(90);
    expect(job.with["build-limit"]).toBe(100);
    expect(job.with["dependencies-minutes"]).toBe(20);
    expect(job.with["dependencies-limit"]).toBe(30);
    expect(job.with).not.toHaveProperty("review-minutes");
    expect(job.with).not.toHaveProperty("conflicts-limit");
  });

  it("passes the override label's name only when the settings rename it", () => {
    expect(factory().jobs.factory.with).not.toHaveProperty("override-label");
    expect(
      factory({ overrideLabel: "ship it" }).jobs.factory.with["override-label"],
    ).toBe("ship it");
  });

  it("passes the secrets .npmrc and the ticket system read as one JSON object, by name", () => {
    expect(factory().jobs.factory.secrets).not.toHaveProperty("extra");
    expect(
      factory({ secrets: ["NPM_TOKEN", "FACTORY_JIRA_TOKEN"] }).jobs.factory
        .secrets.extra,
    ).toBe(
      `\${{ format('{{"NPM_TOKEN":{0},"FACTORY_JIRA_TOKEN":{1}}}', toJSON(secrets.NPM_TOKEN), toJSON(secrets.FACTORY_JIRA_TOKEN)) }}`,
    );
  });

  it("lets the workflow's own token read packages when .npmrc signs in with it", () => {
    expect(factory().permissions).not.toHaveProperty("packages");
    expect(factory({ secrets: ["GITHUB_TOKEN"] }).permissions.packages).toBe(
      "read",
    );
  });
});

describe("factory-review.yml", () => {
  it("calls the factory's review.yml on a pull request, from a job of another name", () => {
    const file = review({ parts: ["review", "dependabot"] });
    expect(file.name).toBe("Factory review");
    expect(file.on).toEqual({
      pull_request: {
        types: ["opened", "reopened", "synchronize", "ready_for_review"],
      },
    });
    expect(Object.keys(file.jobs)).toEqual(["review"]);
    expect(file.jobs.review.uses).toBe(
      "davidbyoung/software-factory/.github/workflows/review.yml@v0.3.0",
    );
    expect(file.jobs.review.with).toEqual({ parts: "review dependabot" });
    expect(review({ version: null }).jobs.review.uses).toBe(
      "./.github/workflows/review.yml",
    );
  });

  it("grants reading the code and commenting, and passes the tokens its jobs read", () => {
    const file = review({ secrets: ["NPM_TOKEN"] });
    expect(file.permissions).toEqual({
      contents: "read",
      issues: "read",
      "pull-requests": "write",
    });
    expect(Object.keys(file.jobs.review.secrets)).toEqual([
      "build-token",
      "automerge-token",
      "claude-token",
      "claude-api-key",
      "extra",
    ]);
  });
});

describe("both files", () => {
  // A repository's own formatter must leave them alone, or its check and
  // the factory's would each undo the other.
  it.each([
    ["factory.yml", factoryWorkflow],
    ["factory-review.yml", reviewWorkflow],
  ])("%s is written as Prettier would leave it", async (_, write) => {
    const text = write(
      options({
        parts: ["review", "board", "poller"],
        pollMinutes: 5,
        minutes: { ...SESSION_MINUTES, build: 90 },
        overrideLabel: "ship it",
        secrets: ["NPM_TOKEN", "GITHUB_TOKEN"],
      }),
    );
    expect(await format(text, { parser: "yaml" })).toBe(text);
  });
});
