// This repository is public, so anyone can open a pull request from a
// fork. A job on `pull_request_target` or `workflow_run` runs with the
// repository's secrets and a write token even for a fork's pull request,
// so it must never check out the pull request's own code: the factory's
// board sync and review verdict use these triggers, and check out main.
//
// Both the workflows this repository runs and the ones it ships are read.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

type Step = { uses?: string; run?: string; with?: Record<string, unknown> };
type Job = { steps?: Step[] };
type Workflow = {
  on?: Record<string, unknown> | string[] | string;
  true?: Workflow["on"];
  jobs: Record<string, Job>;
};

/** What in a checkout's inputs names the pull request's own code, rather
 * than the base branch. */
const HEAD =
  /pull_request\.head|workflow_run\.head|github\.head_ref|refs\/pull\//;
/** A shell step that fetches or checks out the pull request. */
const SHELL_CHECKOUT = /gh pr checkout|refs\/pull\/|github\.head_ref/;

function triggers(w: Workflow): string[] {
  const on = w.on ?? w.true;
  if (typeof on === "string") return [on];
  if (Array.isArray(on)) return on;
  return Object.keys(on ?? {});
}

/** Each job of the workflow that would run a fork's code with the
 * repository's secrets, by its name and why. */
export function forkHazards(text: string): string[] {
  const w = load(text) as Workflow;
  const on = triggers(w);
  const found: string[] = [];
  for (const [name, job] of Object.entries(w.jobs ?? {})) {
    if (on.includes("pull_request_target") || on.includes("workflow_run")) {
      const checksOutHead = (job.steps ?? []).some(
        (s) =>
          (s.uses?.startsWith("actions/checkout") &&
            HEAD.test(JSON.stringify(s.with ?? {}))) ||
          SHELL_CHECKOUT.test(s.run ?? ""),
      );
      if (checksOutHead)
        found.push(`${name}: checks out the pull request's code with secrets`);
    }
  }
  return found;
}

const yaml = (lines: string[]) => lines.join("\n");

describe("forkHazards", () => {
  it("finds a pull_request_target job that checks out the pull request's commit", () => {
    expect(
      forkHazards(
        yaml([
          "on: [pull_request_target]",
          "jobs:",
          "  build:",
          "    steps:",
          "      - uses: actions/checkout@v7",
          "        with:",
          "          ref: ${{ github.event.pull_request.head.sha }}",
        ]),
      ),
    ).toEqual(["build: checks out the pull request's code with secrets"]);
  });

  it("lets through a pull_request_target job that checks out main", () => {
    expect(
      forkHazards(
        yaml([
          "on: [pull_request_target]",
          "permissions: { statuses: write }",
          "jobs:",
          "  verdict:",
          "    steps:",
          "      - uses: actions/checkout@v7",
        ]),
      ),
    ).toEqual([]);
  });

  it.each([
    ["the head ref", "ref: ${{ github.head_ref }}"],
    [
      "the pull request's merge ref",
      "ref: refs/pull/${{ github.event.pull_request.number }}/merge",
    ],
    [
      "the head repository",
      "repository: ${{ github.event.pull_request.head.repo.full_name }}",
    ],
  ])("finds a pull_request_target checkout of %s", (_, line) => {
    expect(
      forkHazards(
        yaml([
          "on: [pull_request_target]",
          "jobs:",
          "  build:",
          "    steps:",
          "      - uses: actions/checkout@v7",
          "        with:",
          `          ${line}`,
        ]),
      ),
    ).toHaveLength(1);
  });

  it("finds a workflow_run job that checks out the run's head", () => {
    expect(
      forkHazards(
        yaml([
          "on:",
          "  workflow_run:",
          "    workflows: [CI]",
          "jobs:",
          "  after:",
          "    steps:",
          "      - uses: actions/checkout@v7",
          "        with:",
          "          ref: ${{ github.event.workflow_run.head_sha }}",
        ]),
      ),
    ).toHaveLength(1);
  });

  it("finds a pull_request_target job that checks the pull request out from the shell", () => {
    expect(
      forkHazards(
        yaml([
          "on: [pull_request_target]",
          "jobs:",
          "  build:",
          "    steps:",
          "      - uses: actions/checkout@v7",
          "      - run: gh pr checkout ${{ github.event.pull_request.number }}",
        ]),
      ),
    ).toHaveLength(1);
  });

  it("reads triggers written as a map", () => {
    expect(
      forkHazards(
        yaml([
          "on:",
          "  pull_request_target:",
          "    types: [opened]",
          "jobs:",
          "  build:",
          "    steps:",
          "      - uses: actions/checkout@v7",
          "        with:",
          "          ref: ${{ github.event.pull_request.head.sha }}",
        ]),
      ),
    ).toHaveLength(1);
  });
});

describe("this repository's workflows", () => {
  const ROOT = new URL("..", import.meta.url).pathname;
  const files = [".github/workflows", "workflows"].flatMap((dir) =>
    readdirSync(join(ROOT, dir))
      .filter((f) => f.endsWith(".yml"))
      .map((f) => `${dir}/${f}`),
  );

  it("finds the workflows to scan in both folders", () => {
    expect(files).toContain(".github/workflows/release.yml");
    expect(files).toContain("workflows/factory-claude-review.yml");
  });

  it("never check out a pull request's code with secrets", () => {
    const found = files.flatMap((f) =>
      forkHazards(readFileSync(join(ROOT, f), "utf8")).map((h) => `${f}: ${h}`),
    );
    expect(found).toEqual([]);
  });
});

// A pull_request job gets no secrets on a fork's pull request, unless a
// private repository turns on sending them; then only a job's own guard
// keeps a fork's code from the secrets. The two shipped pull_request
// workflows that use secrets each keep theirs.
describe("the shipped pull_request workflows' fork guards", () => {
  const jobsOf = (file: string) =>
    (
      load(
        readFileSync(
          join(import.meta.dirname, "..", "workflows", file),
          "utf8",
        ),
      ) as { jobs: Record<string, { if?: string }> }
    ).jobs;

  it("runs the Claude review only on a pull request from this repository", () => {
    expect(Object.keys(jobsOf("factory-claude-review.yml"))).not.toEqual([]);
    for (const job of Object.values(jobsOf("factory-claude-review.yml")))
      expect(job.if).toContain(
        "github.event.pull_request.head.repo.full_name == github.repository",
      );
  });

  it("enables auto-merge only on Dependabot's own pull requests", () => {
    expect(Object.keys(jobsOf("factory-deps-auto-merge.yml"))).not.toEqual([]);
    for (const job of Object.values(jobsOf("factory-deps-auto-merge.yml")))
      expect(job.if).toContain("github.actor == 'dependabot[bot]'");
  });
});
