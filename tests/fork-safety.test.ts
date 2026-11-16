// This repository is public, so anyone can open a pull request from a
// fork. No workflow may run a fork's code while it holds a secret or a
// write token. Two shapes do that:
//
// - A job on `pull_request_target` or `workflow_run`, which run with the
//   repository's secrets, that checks out the pull request's own commit.
//   The factory's board sync and review verdict use these triggers safely:
//   they check out main and never the pull request.
// - A job on `pull_request` that reads a secret other than GITHUB_TOKEN, or
//   asks for write access, without an `if:` that keeps forks out: one that
//   requires the pull request's head to be this repository, or the actor to
//   be Dependabot, which a fork's author can never be.
//   GitHub gives a fork's run no secrets, but the job would then run with
//   whatever it can reach on this repository's own branches.
//
// Both the workflows this repository runs and the ones it ships are read.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

type Step = { uses?: string; with?: Record<string, unknown> };
type Job = {
  if?: string;
  permissions?: Record<string, string> | string;
  steps?: Step[];
};
type Workflow = {
  on?: Record<string, unknown> | string[] | string;
  true?: Workflow["on"];
  permissions?: Record<string, string> | string;
  jobs: Record<string, Job>;
};

const DEPENDABOT = "github.actor == 'dependabot[bot]'";
const SAME_REPO =
  "github.event.pull_request.head.repo.full_name == github.repository";

function triggers(w: Workflow): string[] {
  const on = w.on ?? w.true;
  if (typeof on === "string") return [on];
  if (Array.isArray(on)) return on;
  return Object.keys(on ?? {});
}

const writes = (p: Job["permissions"]) =>
  p === "write-all" ||
  (typeof p === "object" && Object.values(p).some((v) => v === "write"));

/** Each job of the workflow that could run a fork's code with a secret or a
 * write token, by its name and why. */
export function forkHazards(text: string): string[] {
  const w = load(text) as Workflow;
  const on = triggers(w);
  const found: string[] = [];
  for (const [name, job] of Object.entries(w.jobs ?? {})) {
    const raw = JSON.stringify(job);
    if (on.includes("pull_request_target") || on.includes("workflow_run")) {
      const checksOutHead = (job.steps ?? []).some(
        (s) =>
          s.uses?.startsWith("actions/checkout") &&
          /pull_request\.head|workflow_run\.head/.test(
            JSON.stringify(s.with ?? {}),
          ),
      );
      if (checksOutHead)
        found.push(`${name}: checks out the pull request's code with secrets`);
    }
    if (on.includes("pull_request")) {
      const secret = (raw.match(/secrets\.[A-Za-z_]+/g) ?? []).some(
        (s) => s !== "secrets.GITHUB_TOKEN",
      );
      const write = writes(job.permissions ?? w.permissions);
      const condition = (job.if ?? "").replace(/\s+/g, " ");
      const guarded =
        condition.includes(SAME_REPO) || condition.includes(DEPENDABOT);
      if ((secret || write) && !guarded)
        found.push(
          `${name}: gives a fork's pull request a secret or write access`,
        );
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

  it("finds a pull_request job that reads a secret with no fork guard", () => {
    expect(
      forkHazards(
        yaml([
          "on: pull_request",
          "jobs:",
          "  review:",
          "    steps:",
          "      - run: echo ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}",
        ]),
      ),
    ).toEqual(["review: gives a fork's pull request a secret or write access"]);
  });

  it("finds a pull_request job that asks for write access with no fork guard", () => {
    expect(
      forkHazards(
        yaml([
          "on: pull_request",
          "permissions: { pull-requests: write }",
          "jobs:",
          "  label:",
          "    steps:",
          "      - run: true",
        ]),
      ),
    ).toEqual(["label: gives a fork's pull request a secret or write access"]);
  });

  it("lets through a pull_request job only Dependabot runs", () => {
    expect(
      forkHazards(
        yaml([
          "on: pull_request",
          "permissions: { contents: write }",
          "jobs:",
          "  enable:",
          `    if: ${DEPENDABOT}`,
          "    steps:",
          "      - run: echo ${{ secrets.FACTORY_AUTOMERGE_TOKEN }}",
        ]),
      ),
    ).toEqual([]);
  });

  it("lets through a guarded pull_request job, and one with only GITHUB_TOKEN and read access", () => {
    expect(
      forkHazards(
        yaml([
          "on: pull_request",
          "permissions: { contents: read }",
          "jobs:",
          "  review:",
          `    if: ${SAME_REPO}`,
          "    permissions: { pull-requests: write }",
          "    steps:",
          "      - run: echo ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}",
          "  check:",
          "    steps:",
          "      - run: echo ${{ secrets.GITHUB_TOKEN }}",
        ]),
      ),
    ).toEqual([]);
  });
});

describe("this repository's workflows", () => {
  const ROOT = new URL("..", import.meta.url).pathname;
  const files = [".github/workflows", "workflows"].flatMap((dir) =>
    readdirSync(join(ROOT, dir))
      .filter((f) => f.endsWith(".yml"))
      .map((f) => `${dir}/${f}`),
  );

  it("read the workflows it runs and the ones it ships", () => {
    expect(files).toContain(".github/workflows/release.yml");
    expect(files).toContain("workflows/factory-claude-review.yml");
  });

  it("give no fork's pull request a secret or a write token", () => {
    const found = files.flatMap((f) =>
      forkHazards(readFileSync(join(ROOT, f), "utf8")).map((h) => `${f}: ${h}`),
    );
    expect(found).toEqual([]);
  });
});
