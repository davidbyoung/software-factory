// The two workflow files `kodor sync` writes into a repository, read as
// YAML: each calls one of kodor's own workflows at one version, and
// holds only what the repository's settings decide.
import { describe, expect, it } from "vitest";
import { format } from "prettier";
import { parse } from "yaml";
import { SESSION_MINUTES } from "../src/config.mts";
import {
  KODOR_EVENTS,
  factoryWorkflow,
  HELD_EVENT,
  POLLER_FILE,
  pollerWorkflow,
  reviewWorkflow,
  type WorkflowOptions,
} from "../src/workflow-files.mts";

const options = (over: Partial<WorkflowOptions> = {}): WorkflowOptions => ({
  version: "0.3.0",
  branch: "main",
  parts: [],
  pollMinutes: null,
  ref: (key) => (key.includes("/") ? key : `#${key}`),
  minutes: { ...SESSION_MINUTES },
  overrideLabel: "verdict-override",
  policyLabel: "policy-override",
  secrets: [],
  ...over,
});
const factory = (over: Partial<WorkflowOptions> = {}) =>
  parse(factoryWorkflow(options(over)));
const review = (over: Partial<WorkflowOptions> = {}) =>
  parse(reviewWorkflow(options(over)));

describe("kodor.yml", () => {
  it("calls kodor's run.yml at the version the lock names, from one job", () => {
    const file = factory();
    expect(file.name).toBe("kodor");
    expect(Object.keys(file.jobs)).toEqual(["kodor"]);
    expect(file.jobs.kodor.uses).toBe(
      "kodor-ai/kodor/.github/workflows/run.yml@v0.3.0",
    );
  });

  it("calls the copy in the same commit in kodor's own repository", () => {
    expect(factory({ version: null }).jobs.kodor.uses).toBe(
      "./.github/workflows/run.yml",
    );
  });

  it("starts on exactly the events a code host's policy for it lists", () => {
    expect(Object.keys(factory().on)).toEqual(KODOR_EVENTS);
    expect(KODOR_EVENTS).toContain(HELD_EVENT);
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
    expect(Object.keys(on.workflow_dispatch.inputs)).toEqual([
      "job",
      "ticket",
      "pr",
      "review",
    ]);
  });

  it("starts on a pull request's edit, for a change of its base, with a part that runs on one", () => {
    for (const part of ["review", "auto-merge", "approval-policies"] as const)
      expect(
        factory({ parts: [part] }).on.pull_request_target.types,
        part,
      ).toContain("edited");
    expect(
      factory({ parts: ["board", "poller", "dependabot"] }).on
        .pull_request_target.types,
    ).not.toContain("edited");
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

  it("names a build's run by the ticket as its system writes it, an answer's by its pull request, a pull request's by its commit, and no other run", () => {
    expect(factory()["run-name"]).toBe(
      "${{ inputs.ticket && format(contains(inputs.ticket, '/') && 'Build {0}' || 'Build #{0}', inputs.ticket) || inputs.job == 'answer' && format('Answer #{0}', inputs.pr) || github.event_name == 'pull_request_target' && format('#{0} at {1}', github.event.pull_request.number, github.event.pull_request.head.sha) || '' }}",
    );
    expect(factory({ ref: (key) => `it's ${key}` })["run-name"]).toBe(
      "${{ inputs.ticket && format('Build it''s {0}', inputs.ticket) || inputs.job == 'answer' && format('Answer #{0}', inputs.pr) || github.event_name == 'pull_request_target' && format('#{0} at {1}', github.event.pull_request.number, github.event.pull_request.head.sha) || '' }}",
    );
  });

  it("grants what kodor's jobs post with, and no more", () => {
    expect(factory().permissions).toEqual({
      actions: "read",
      checks: "read",
      contents: "read",
      issues: "write",
      packages: "read",
      "pull-requests": "write",
      statuses: "write",
    });
  });

  it("passes the parts that are on, a run by hand's inputs, and each token by name", () => {
    const job = factory({ parts: ["review", "board"] }).jobs.kodor;
    expect(job.with).toEqual({
      parts: "review board",
      job: "${{ inputs.job }}",
      ticket: "${{ inputs.ticket }}",
      pr: "${{ inputs.pr }}",
      review: "${{ inputs.review }}",
    });
    expect(job.secrets).toEqual({
      "build-token":
        "${{ secrets.KODOR_BUILD_TOKEN || secrets.KODOR_BOARD_TOKEN }}",
      "board-token": "${{ secrets.KODOR_BOARD_TOKEN }}",
      "automerge-token": "${{ secrets.KODOR_AUTOMERGE_TOKEN }}",
      "app-key": "${{ secrets.KODOR_APP_PRIVATE_KEY }}",
      "signing-key": "${{ secrets.KODOR_SIGNING_KEY }}",
      "claude-token": "${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}",
      "claude-api-key": "${{ secrets.ANTHROPIC_API_KEY }}",
    });
    expect(factory().jobs.kodor.with.parts).toBe("");
  });

  it("passes a session's minutes, and its job's limit ten over, only where the settings change them", () => {
    const job = factory({
      minutes: { ...SESSION_MINUTES, build: 90, dependencies: 20 },
    }).jobs.kodor;
    expect(job.with["build-minutes"]).toBe(90);
    expect(job.with["build-limit"]).toBe(100);
    expect(job.with["dependencies-minutes"]).toBe(20);
    expect(job.with["dependencies-limit"]).toBe(30);
    expect(job.with).not.toHaveProperty("review-minutes");
    expect(job.with).not.toHaveProperty("conflicts-limit");
  });

  it("passes the override label's name only when the settings rename it", () => {
    expect(factory().jobs.kodor.with).not.toHaveProperty("override-label");
    expect(
      factory({ overrideLabel: "ship it" }).jobs.kodor.with["override-label"],
    ).toBe("ship it");
  });

  it("passes the policy label's name only when the settings rename it", () => {
    expect(factory().jobs.kodor.with).not.toHaveProperty("policy-label");
    expect(
      factory({ policyLabel: "accepted" }).jobs.kodor.with["policy-label"],
    ).toBe("accepted");
  });

  it("passes the secrets .npmrc and the ticket system read as one JSON object, by name", () => {
    expect(factory().jobs.kodor.secrets).not.toHaveProperty("extra");
    expect(
      factory({ secrets: ["NPM_TOKEN", "KODOR_JIRA_TOKEN"] }).jobs.kodor.secrets
        .extra,
    ).toBe(
      `\${{ format('{{"NPM_TOKEN":{0},"KODOR_JIRA_TOKEN":{1}}}', toJSON(secrets.NPM_TOKEN), toJSON(secrets.KODOR_JIRA_TOKEN)) }}`,
    );
  });
});

describe("kodor-review.yml", () => {
  it("calls kodor's review.yml on a pull request, from a job of another name", () => {
    const file = review({ parts: ["review", "dependabot"] });
    expect(file.name).toBe("kodor review");
    expect(file.on).toEqual({
      pull_request: {
        types: ["opened", "reopened", "synchronize", "ready_for_review"],
      },
    });
    expect(Object.keys(file.jobs)).toEqual(["review"]);
    expect(file.jobs.review.uses).toBe(
      "kodor-ai/kodor/.github/workflows/review.yml@v0.3.0",
    );
    expect(review({ version: null }).jobs.review.uses).toBe(
      "./.github/workflows/review.yml",
    );
  });

  // GitHub runs this file from the pull request's copy.
  it("may only read the code and Actions, and passes nothing to the job it calls, whatever the settings turn on", () => {
    const text = reviewWorkflow(
      options({
        parts: ["review", "board", "auto-merge", "poller", "dependabot"],
        secrets: ["NPM_TOKEN", "GITHUB_TOKEN", "KODOR_JIRA_TOKEN"],
      }),
    );
    const file = parse(text);
    expect(file.permissions).toEqual({ actions: "read", contents: "read" });
    expect(Object.keys(file.jobs.review)).toEqual(["uses"]);
    expect(text).not.toMatch(/secrets\.|secrets:/);
  });
});

describe("both files", () => {
  // A repository's own formatter must leave them alone, or its check and
  // kodor's would each undo the other.
  it.each([
    ["kodor.yml", factoryWorkflow],
    ["kodor-review.yml", reviewWorkflow],
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

describe("kodor-poller.yml", () => {
  const text = pollerWorkflow({
    owner: "acme",
    version: "0.4.0",
    pollMinutes: 30,
  });

  it("is the file an organization's setup writes, word for word", () => {
    expect(POLLER_FILE).toBe(".github/workflows/kodor-poller.yml");
    expect(text).toBe(
      [
        "# .github/workflows/kodor-poller.yml, written by kodor init --org.",
        "# The one poller for acme's board. The cron line is yours to change, with",
        "# builds.poll-minutes in kodor-preset.yaml: kodor preset check fails",
        "# when the two differ.",
        "name: kodor poller",
        "on:",
        "  schedule:",
        '    - cron: "*/30 * * * *" # the poller',
        '    - cron: "0 1 * * *" # updates',
        "  workflow_dispatch:",
        "permissions:",
        "  contents: read",
        "jobs:",
        "  poller:",
        "    uses: kodor-ai/kodor/.github/workflows/poller.yml@v0.4.0",
        "    secrets:",
        "      app-key: ${{ secrets.KODOR_APP_PRIVATE_KEY }}",
        "",
      ].join("\n"),
    );
  });

  it("calls kodor's poller.yml from one job, with the app's key as its one secret", () => {
    const file = parse(text);
    expect(Object.keys(file.jobs)).toEqual(["poller"]);
    expect(file.jobs.poller.secrets).toEqual({
      "app-key": "${{ secrets.KODOR_APP_PRIVATE_KEY }}",
    });
    expect(file.permissions).toEqual({ contents: "read" });
  });

  it.each([
    [5, "*/5 * * * *"],
    [60, "0 * * * *"],
  ])(
    "polls every %s minutes on %s, before the updates' schedule",
    (pollMinutes, cron) => {
      const file = parse(
        pollerWorkflow({ owner: "acme", version: "0.4.0", pollMinutes }),
      );
      expect(file.on.schedule).toEqual([{ cron }, { cron: "0 1 * * *" }]);
    },
  );

  it("is written as Prettier would leave it", async () => {
    expect(await format(text, { parser: "yaml" })).toBe(text);
  });
});
