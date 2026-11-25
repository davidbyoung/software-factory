// This repository is public, so anyone can open a pull request from a
// fork. A job that starts on `pull_request_target` or `workflow_run` runs
// with the repository's secrets and a write token even for a fork's pull
// request, so it must never check out the pull request's own code: the
// factory's verdict, merge policy, board sync, review, and Dependabot's
// auto-merge start on these events, and check out the default branch or
// nothing.
//
// The factory's own workflows are called, not started: run.yml by the
// factory.yml `factory sync` writes into a repository, review.yml by its
// factory-review.yml, and session.yml by run.yml. So a job is judged by the
// events its caller starts on and its own `if` does not rule out.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";
import { SESSION_MINUTES } from "../src/config.mts";
import {
  FACTORY_FILE,
  factoryWorkflow,
  REVIEW_FILE,
  reviewWorkflow,
  type WorkflowOptions,
} from "../src/workflow-files.mts";

type Step = { uses?: string; run?: string; with?: Record<string, unknown> };
type Job = { if?: string; uses?: string; steps?: Step[] };
type Workflow = {
  on?: Record<string, unknown> | string[] | string;
  true?: Workflow["on"];
  jobs: Record<string, Job>;
};

/** The events that hand a fork's pull request the repository's secrets. */
const WITH_SECRETS = ["pull_request_target", "workflow_run"];
/** What in a checkout's inputs names the pull request's own code, rather
 * than the base branch. */
const HEAD =
  /pull_request\.head|workflow_run\.head|github\.head_ref|refs\/pull\//;
/** A shell step that fetches or checks out the pull request. */
const SHELL_CHECKOUT = /gh pr checkout|refs\/pull\/|github\.head_ref/;
/** The one `ref` a checkout may name: the default branch. */
const DEFAULT_BRANCH = "${{ github.event.repository.default_branch }}";
/** Where a job's `uses` finds a workflow of the same repository. */
const LOCAL = "./";

function triggers(w: Workflow): string[] {
  const on = w.on ?? w.true;
  if (typeof on === "string") return [on];
  if (Array.isArray(on)) return on;
  return Object.keys(on ?? {});
}

/** The events the workflow starts on: its own, and for one that is called,
 * those its caller's job starts on. */
function eventsOf(w: Workflow, calledOn: string[]): string[] {
  const own = triggers(w);
  return [
    ...own.filter((event) => event !== "workflow_call"),
    ...(own.includes("workflow_call") ? calledOn : []),
  ];
}

/** The parts of an expression between each `operator` that is outside
 * parentheses and quotes. */
function parts(text: string, operator: "||" | "&&"): string[] {
  const found: string[] = [];
  let depth = 0;
  let quoted = false;
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "'") quoted = !quoted;
    else if (quoted) continue;
    else if (text[i] === "(") depth++;
    else if (text[i] === ")") depth--;
    else if (depth === 0 && text.startsWith(operator, i)) {
      found.push(text.slice(from, i));
      from = i + operator.length;
    }
  }
  found.push(text.slice(from));
  return found.map((part) => part.trim());
}

/** What an expression requires, each of which must hold. */
const conjuncts = (text: string) => parts(text, "&&");

/** Whether the whole expression is inside one pair of parentheses. */
function wrapped(text: string): boolean {
  if (!text.startsWith("(")) return false;
  let depth = 0;
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "'") quoted = !quoted;
    else if (quoted) continue;
    else if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return i === text.length - 1;
  }
  return false;
}

/** The events a job's `if` names as the only ones it starts on, or null
 * when it rules none out. It errs toward null: only `github.event_name ==`
 * rules an event out, and only where every way the condition can hold
 * names one. */
export function eventsNamed(condition: string): string[] | null {
  let text = condition.trim();
  const expression = /^\$\{\{([\s\S]*)\}\}$/.exec(text);
  if (expression) text = expression[1]!.trim();
  while (wrapped(text)) text = text.slice(1, -1).trim();
  const any = parts(text, "||");
  if (any.length > 1) {
    const each = any.map(eventsNamed);
    return each.includes(null) ? null : [...new Set(each.flat() as string[])];
  }
  const all = parts(text, "&&");
  if (all.length > 1)
    return all
      .map(eventsNamed)
      .reduce<string[] | null>(
        (named, events) =>
          events === null
            ? named
            : (named?.filter((event) => events.includes(event)) ?? events),
        null,
      );
  const event = /^github\.event_name == '(\w+)'$/.exec(text);
  return event ? [event[1]!] : null;
}

/** Which of the workflow's events the job can start on. */
function startsOn(job: Job, events: string[]): string[] {
  const named = job.if === undefined ? null : eventsNamed(String(job.if));
  return named === null
    ? events
    : events.filter((event) => named.includes(event));
}

/** The workflow's jobs a fork's pull request can start with the
 * repository's secrets. */
export function jobsWithSecrets(text: string, calledOn: string[] = []) {
  const w = load(text) as Workflow;
  const events = eventsOf(w, calledOn);
  return Object.entries(w.jobs ?? {}).filter(([, job]) =>
    startsOn(job, events).some((event) => WITH_SECRETS.includes(event)),
  );
}

/** Why a step would put a fork's code in the job, or null. */
function hazardOf(s: Step): string | null {
  const checkout = s.uses?.startsWith("actions/checkout");
  if (
    (checkout && HEAD.test(JSON.stringify(s.with ?? {}))) ||
    SHELL_CHECKOUT.test(s.run ?? "")
  )
    return "checks out the pull request's code with secrets";
  const ref = s.with?.ref;
  if (checkout && ref !== undefined && ref !== DEFAULT_BRANCH)
    return "checks out a ref that is not the default branch with secrets";
  return null;
}

/** Each job of the workflow that would run a fork's code with the
 * repository's secrets, by its name and why. `calledOn` is the events the
 * job that calls the workflow starts on. */
export function forkHazards(text: string, calledOn: string[] = []): string[] {
  return jobsWithSecrets(text, calledOn).flatMap(([name, job]) => {
    const why = (job.steps ?? []).map(hazardOf).find((h) => h !== null);
    return why ? [`${name}: ${why}`] : [];
  });
}

/** Each workflow of the same repository that one of this workflow's jobs
 * calls, by its path, with the events that job starts on. */
export function calls(text: string, calledOn: string[] = []) {
  const w = load(text) as Workflow;
  const events = eventsOf(w, calledOn);
  return Object.values(w.jobs ?? {})
    .filter((job) => job.uses?.startsWith(LOCAL))
    .map((job): [string, string[]] => [
      job.uses!.slice(LOCAL.length),
      startsOn(job, events),
    ]);
}

/** Every hazard in the workflows of `started`, by path, and in each
 * workflow they call, read with `open`. */
export function hazardsIn(
  started: Map<string, string>,
  open: (path: string) => string,
): string[] {
  const found = new Set<string>();
  const seen = new Set<string>();
  const queue = [...started].map(([path, text]): [string, string, string[]] => [
    path,
    text,
    [],
  ]);
  for (let next = queue.shift(); next; next = queue.shift()) {
    const [path, text, calledOn] = next;
    const key = `${path} ${calledOn.join(" ")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const hazard of forkHazards(text, calledOn))
      found.add(`${path}: ${hazard}`);
    for (const [file, events] of calls(text, calledOn))
      queue.push([file, open(file), events]);
  }
  return [...found];
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

  // The review reads the pull request's head this way, on `pull_request`.
  it("finds a pull_request_target checkout of a ref an earlier step worked out", () => {
    expect(
      forkHazards(
        yaml([
          "on: [pull_request_target]",
          "jobs:",
          "  review:",
          "    steps:",
          "      - uses: actions/checkout@v7",
          "        with:",
          "          ref: ${{ steps.head.outputs.sha }}",
        ]),
      ),
    ).toEqual([
      "review: checks out a ref that is not the default branch with secrets",
    ]);
  });

  it("lets through a checkout that names the default branch, and one that sets only other inputs", () => {
    expect(
      forkHazards(
        yaml([
          "on: [pull_request_target]",
          "jobs:",
          "  session:",
          "    steps:",
          "      - uses: actions/checkout@v7",
          "        with:",
          "          ref: ${{ github.event.repository.default_branch }}",
          "          fetch-depth: 0",
          "      - uses: actions/checkout@v7",
          "        with:",
          "          token: ${{ secrets.build-token }}",
        ]),
      ),
    ).toEqual([]);
  });

  const called = (condition: string[]) =>
    yaml([
      "on:",
      "  workflow_call:",
      "jobs:",
      "  review:",
      ...condition,
      "    steps:",
      "      - uses: actions/checkout@v7",
      "        with:",
      "          ref: ${{ github.event.pull_request.head.sha }}",
    ]);

  it("judges a called workflow by the events its caller starts on", () => {
    expect(forkHazards(called([]), ["pull_request"])).toEqual([]);
    expect(forkHazards(called([]), ["pull_request_target"])).toHaveLength(1);
    expect(forkHazards(called([]))).toEqual([]);
  });

  it("lets through a job whose if names only events that carry no fork's secrets", () => {
    const events = ["pull_request_target", "push", "workflow_dispatch"];
    expect(
      forkHazards(called(["    if: github.event_name == 'push'"]), events),
    ).toEqual([]);
    expect(
      forkHazards(
        called(["    if: github.event_name == 'pull_request_target'"]),
        events,
      ),
    ).toHaveLength(1);
  });

  it("finds a job whose if rules no event out", () => {
    expect(
      forkHazards(
        called(["    if: github.event.pull_request.draft == false"]),
        ["pull_request_target"],
      ),
    ).toHaveLength(1);
  });
});

describe("eventsNamed", () => {
  it("is the one event a condition requires", () => {
    expect(eventsNamed("github.event_name == 'push'")).toEqual(["push"]);
    expect(
      eventsNamed("github.event_name == 'push' && github.ref_name == 'main'"),
    ).toEqual(["push"]);
    expect(eventsNamed("${{ github.event_name == 'push' }}")).toEqual(["push"]);
  });

  it("reads an operator or a parenthesis inside quotes as text", () => {
    expect(
      eventsNamed("github.event_name == 'push' && inputs.job != 'a || b)'"),
    ).toEqual(["push"]);
  });

  it("is only the events every part of a conjunction allows", () => {
    expect(
      eventsNamed(
        "(github.event_name == 'push' || github.event_name == 'schedule') && (github.event_name == 'schedule' || github.event_name == 'workflow_run')",
      ),
    ).toEqual(["schedule"]);
  });

  it("is each event of a condition's alternatives, inside parentheses too", () => {
    expect(
      eventsNamed(
        "contains(format(' {0} ', inputs.parts), ' board ') && ((github.event_name == 'pull_request_target' && github.event.action == 'closed') || (github.event_name == 'schedule' && github.event.schedule == '0 7 * * *') || (github.event_name == 'workflow_dispatch' && inputs.job == 'board'))",
      ),
    ).toEqual(["pull_request_target", "schedule", "workflow_dispatch"]);
  });

  it.each([
    ["names no event", "github.actor == 'dependabot[bot]'"],
    [
      "has an alternative that names none",
      "github.event_name == 'push' || inputs.job == 'board'",
    ],
    ["only says which event it is not", "github.event_name != 'push'"],
    [
      "names one inside a negation",
      "!(github.event_name == 'pull_request_target')",
    ],
  ])("rules no event out when the condition %s", (_, condition) => {
    expect(eventsNamed(condition)).toBeNull();
  });
});

describe("hazardsIn", () => {
  const head = [
    "    steps:",
    "      - uses: actions/checkout@v7",
    "        with:",
    "          ref: ${{ github.event.pull_request.head.sha }}",
  ];
  const caller = yaml([
    "on: [pull_request_target, push]",
    "jobs:",
    "  factory:",
    "    uses: ./.github/workflows/run.yml",
  ]);
  /** A called workflow whose job `session` calls a third, on `event`. */
  const run = (event: string) =>
    yaml([
      "on:",
      "  workflow_call:",
      "jobs:",
      "  session:",
      `    if: github.event_name == '${event}'`,
      "    uses: ./.github/workflows/session.yml",
    ]);
  const session = yaml(["on:", "  workflow_call:", "jobs:", "  run:", ...head]);
  const files = (event: string) => (path: string) =>
    ({
      ".github/workflows/run.yml": run(event),
      ".github/workflows/session.yml": session,
    })[path]!;

  it("follows each call, and finds a job two calls away that a fork's pull request starts", () => {
    expect(
      hazardsIn(
        new Map([["factory.yml", caller]]),
        files("pull_request_target"),
      ),
    ).toEqual([
      ".github/workflows/session.yml: run: checks out the pull request's code with secrets",
    ]);
  });

  it("lets through the same job when the job that calls it starts only on a push", () => {
    expect(
      hazardsIn(new Map([["factory.yml", caller]]), files("push")),
    ).toEqual([]);
  });
});

describe("this repository's workflows", () => {
  const ROOT = new URL("..", import.meta.url).pathname;
  const DIR = ".github/workflows";
  const open = (path: string) => readFileSync(join(ROOT, path), "utf8");
  // The two files as `factory sync` writes them into the factory's own
  // repository, where they call the copies in the same commit.
  const OPTIONS: WorkflowOptions = {
    version: null,
    branch: "main",
    parts: ["review", "board", "auto-merge", "poller", "dependabot"],
    pollMinutes: 5,
    ref: (key) => `#${key}`,
    minutes: { ...SESSION_MINUTES },
    overrideLabel: "verdict-override",
    secrets: [],
  };
  const written = new Map([
    [`${FACTORY_FILE}, as sync writes it`, factoryWorkflow(OPTIONS)],
    [`${REVIEW_FILE}, as sync writes it`, reviewWorkflow(OPTIONS)],
  ]);
  const files = readdirSync(join(ROOT, DIR))
    .filter((f) => f.endsWith(".yml"))
    .map((f) => `${DIR}/${f}`);
  const factoryEvents = triggers(load(factoryWorkflow(OPTIONS)) as Workflow);

  it("finds the workflows to scan, and the factory's own behind the two files sync writes", () => {
    expect(files).toContain(`${DIR}/release.yml`);
    expect(calls(factoryWorkflow(OPTIONS))).toEqual([
      [`${DIR}/run.yml`, factoryEvents],
    ]);
    expect(calls(reviewWorkflow(OPTIONS))).toEqual([
      [`${DIR}/review.yml`, ["pull_request"]],
    ]);
    expect(
      calls(open(`${DIR}/run.yml`), factoryEvents).map(([file]) => file),
    ).toEqual(Array(5).fill(`${DIR}/session.yml`));
  });

  it("starts only the verdict, what tells the other repositories, the merge policy, the board sync, the review, and Dependabot's auto-merge on an event that has the secrets", () => {
    expect(factoryEvents).toContain("pull_request_target");
    expect(factoryEvents).not.toContain("workflow_run");
    expect(
      jobsWithSecrets(open(`${DIR}/run.yml`), factoryEvents).map(
        ([name]) => name,
      ),
    ).toEqual([
      "verdict",
      "across",
      "merge-policy",
      "board",
      "review",
      "dependabot",
    ]);
  });

  it("starts one session, the review, with them, and only for a pull request from the repository itself, and nothing of review.yml", () => {
    const sessions = jobsWithSecrets(
      open(`${DIR}/run.yml`),
      factoryEvents,
    ).filter(([, job]) => job.uses);
    expect(sessions.map(([name]) => name)).toEqual(["review"]);
    expect(conjuncts(sessions[0]![1].if!)).toContain(
      "github.event.pull_request.head.repo.full_name == github.repository",
    );
    expect(
      jobsWithSecrets(open(`${DIR}/review.yml`), ["pull_request"]),
    ).toEqual([]);
  });

  it("never check out a pull request's code with secrets", () => {
    expect(
      hazardsIn(
        new Map([
          ...files.map((f): [string, string] => [f, open(f)]),
          ...written,
        ]),
        open,
      ),
    ).toEqual([]);
  });
});
