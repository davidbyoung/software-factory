// The factory's own workflows, which a repository's two short files call:
// run.yml, review.yml, and session.yml, read as YAML, and the scripts of
// their steps run for real.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { START } from "../src/follow-ups.mts";
import { manifestOf } from "../src/code-host/github-app.mts";
import { SESSION_MINUTES } from "../src/config.mts";
import { answerName, REVIEW_JOBS } from "../src/runner/github-actions.mts";
import {
  FACTORY_FILE,
  factoryWorkflow,
  POLLER_FILE,
  pollerWorkflow,
  REVIEW_FILE,
  reviewWorkflow,
  type WorkflowOptions,
} from "../src/workflow-files.mts";

type Step = {
  id?: string;
  name: string;
  uses?: string;
  if?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
  "working-directory"?: string;
  "continue-on-error"?: boolean;
};
type Job = {
  name: string;
  if?: string;
  needs?: string | string[];
  uses?: string;
  env?: Record<string, string>;
  outputs?: Record<string, string>;
  "cache-mode"?: string;
  "timeout-minutes"?: number | string;
  concurrency?: { group: string; "cancel-in-progress": boolean };
  permissions?: Record<string, string>;
  with?: Record<string, unknown>;
  secrets?: Record<string, string>;
  steps?: Step[];
};
type Workflow = {
  name: string;
  on: {
    workflow_call: {
      inputs?: Record<string, { type: string; default?: unknown }>;
      secrets?: Record<string, { required: boolean }>;
    } | null;
  };
  permissions: Record<string, string>;
  jobs: Record<string, Job>;
};

const read = (name: string) =>
  parse(readFileSync(`.github/workflows/${name}`, "utf8"), {
    merge: true,
  }) as Workflow;
const run = read("run.yml");
const review = read("review.yml");
const session = read("session.yml");
const step = (job: Job, name: string) =>
  job.steps!.find((s) => s.name === name)!;
const names = (job: Job) => job.steps!.map((s) => s.name);
const prepareJob = session.jobs.prepare!;
const sessionJob = session.jobs.session!;
const publishJob = session.jobs.publish!;

/** The two files as `factory sync` writes them, read as YAML. */
const options = (over: Partial<WorkflowOptions> = {}): WorkflowOptions => ({
  version: "0.3.0",
  branch: "main",
  parts: ["review", "board", "auto-merge", "poller", "dependabot"],
  pollMinutes: 5,
  ref: (key) => `#${key}`,
  minutes: { ...SESSION_MINUTES },
  overrideLabel: "verdict-override",
  policyLabel: "policy-override",
  secrets: [],
  ...over,
});
const factoryYml = (over: Partial<WorkflowOptions> = {}) =>
  parse(factoryWorkflow(options(over)));
const factoryReviewYml = (over: Partial<WorkflowOptions> = {}) =>
  parse(reviewWorkflow(options(over)));

/** A step's script, run in `dir` with `bin` first on the PATH. */
function runScript(
  script: string,
  dir: string,
  env: Record<string, string> = {},
) {
  const r = spawnSync("bash", ["-eo", "pipefail", "-c", script], {
    cwd: dir,
    env: {
      PATH: `${join(dir, "bin")}:${process.env.PATH}`,
      HOME: dir,
      RUNNER_TEMP: dir,
      GITHUB_OUTPUT: join(dir, "output"),
      GITHUB_ENV: join(dir, "env"),
      ...env,
    },
    encoding: "utf8",
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** A folder with a `bin` whose commands each append their arguments to
 * `calls`, and print what `says` gives them. */
function sandbox(commands: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "factory-workflow-"));
  mkdirSync(join(dir, "bin"));
  for (const [name, body] of Object.entries(commands))
    writeFileSync(
      join(dir, "bin", name),
      `#!/bin/bash\necho "${name} $*" >> "${dir}/calls"\n${body}\n`,
      { mode: 0o755 },
    );
  const calls = () =>
    existsSync(join(dir, "calls"))
      ? readFileSync(join(dir, "calls"), "utf8").trim().split("\n")
      : [];
  return { dir, calls };
}

describe("what the three files are called with", () => {
  it("takes every secret by name, none of them required, since another owner's file cannot hand them over whole", () => {
    const taking = (names: string[]) =>
      Object.fromEntries(names.map((name) => [name, { required: false }]));
    expect(run.on.workflow_call!.secrets).toEqual(
      taking([
        "build-token",
        "board-token",
        "automerge-token",
        "app-key",
        "signing-key",
        "claude-token",
        "claude-api-key",
        "extra",
      ]),
    );
    expect(session.on.workflow_call!.secrets).toEqual(
      taking([
        "build-token",
        "app-key",
        "claude-token",
        "claude-api-key",
        "extra",
      ]),
    );
  });

  it("takes nothing in review.yml, which GitHub runs from the pull request's copy", () => {
    expect(review.on).toEqual({ workflow_call: null });
  });

  it("defaults each session's minutes to the settings' default, and its job's limit to ten over", () => {
    const inputs = run.on.workflow_call!.inputs!;
    for (const [kind, minutes] of Object.entries(SESSION_MINUTES)) {
      expect(inputs[`${kind}-minutes`]!.default).toBe(minutes);
      expect(inputs[`${kind}-limit`]!.default).toBe(minutes + 10);
    }
  });

  it("gives the workflow's own token only reading the code unless a job asks for more", () => {
    expect(run.permissions).toEqual({ contents: "read" });
    expect(session.permissions).toEqual({ contents: "read" });
  });
});

const truthy = (v: unknown) => v !== "" && v !== false && v != null;
/** A value as `==` compares it: text whatever its case. */
const same = (v: unknown) => (typeof v === "string" ? v.toLowerCase() : v);

describe("the conditions of every job and step", () => {
  it.each(["run.yml", "session.yml", "poller.yml"])(
    "%s reads no secret in an `if`, where GitHub refuses one",
    (name) => {
      const conditions = Object.values(read(name).jobs).flatMap((job) => [
        job.if,
        ...(job.steps ?? []).map((s) => s.if),
      ]);

      expect(conditions.filter((c) => c !== undefined).length).toBeGreaterThan(
        0,
      );
      expect(conditions.filter((c) => c?.includes("secrets."))).toEqual([]);
    },
  );

  // A workflow that names a context where GitHub gives it none is refused
  // whole, and so is every workflow that calls it. GitHub gives a job's own
  // values no `runner`, no `steps`, and no `env`.
  it.each(readdirSync(".github/workflows").filter((f) => f.endsWith(".yml")))(
    "%s reads only what GitHub gives in a job's own values",
    (name) => {
      const found = Object.entries(read(name).jobs).flatMap(([id, job]) =>
        Object.entries(job)
          .filter(([key]) => !["steps", "outputs", "environment"].includes(key))
          .flatMap(
            ([key, value]) =>
              JSON.stringify(value)
                .match(/\$\{\{[^}]*\b(?:runner|steps|env)\.[^}]*\}\}/g)
                ?.map((text) => `${id}.${key}: ${text}`) ?? [],
          ),
      );

      expect(found).toEqual([]);
    },
  );
});

/** What a GitHub Actions expression comes to, evaluated as GitHub does for
 * what the workflows use: `==`, `!=`, `&&`, `||`, `!`, parentheses, text in
 * single quotes, `true` and `false`, a path into the contexts, and `contains`, `format`, and
 * `fromJSON`. A path that leads nowhere is empty text, and `&&` and `||`
 * give the operand that decided them. */
function valueOf(expression: string, context: Record<string, unknown>) {
  const tokens =
    expression.match(/'(?:[^']|'')*'|&&|\|\||==|!=|[!(),]|[A-Za-z_][\w.-]*/g) ??
    [];
  let at = 0;
  const next = () => tokens[at++]!;
  const primary = (): unknown => {
    const token = next();
    if (token === "(") {
      const inside = or();
      next();
      return inside;
    }
    if (token === "!") return !truthy(primary());
    if (token.startsWith("'")) return token.slice(1, -1).replaceAll("''", "'");
    if (token === "true" || token === "false") return token === "true";
    if (tokens[at] === "(") {
      next();
      const args: unknown[] = [];
      while (tokens[at] !== ")") {
        args.push(or());
        if (tokens[at] === ",") next();
      }
      next();
      if (token === "fromJSON") return JSON.parse(String(args[0]));
      if (token === "format")
        return String(args[0]).replace(/\{(\d+)\}/g, (_, i) =>
          String(args[Number(i) + 1] ?? ""),
        );
      if (token === "contains")
        return Array.isArray(args[0])
          ? args[0].includes(args[1])
          : String(args[0]).includes(String(args[1]));
      // Read as in a job where every step so far has passed.
      if (token === "success" || token === "always") return true;
      if (token === "failure" || token === "cancelled") return false;
      throw new Error(`no function ${token}`);
    }
    return (
      token
        .split(".")
        .reduce<unknown>(
          (value, key) => (value as Record<string, unknown> | undefined)?.[key],
          context,
        ) ?? ""
    );
  };
  const comparison = (): unknown => {
    const left = primary();
    if (tokens[at] === "==" || tokens[at] === "!=") {
      const equal = next() === "==";
      return (same(left) === same(primary())) === equal;
    }
    return left;
  };
  const and = (): unknown => {
    let value = comparison();
    while (tokens[at] === "&&") {
      next();
      const right = comparison();
      value = truthy(value) ? right : value;
    }
    return value;
  };
  const or = (): unknown => {
    let value = and();
    while (tokens[at] === "||") {
      next();
      const right = and();
      value = truthy(value) ? value : right;
    }
    return value;
  };
  return or();
}

/** Whether an `if` with that expression holds. */
const evaluate = (expression: string, context: Record<string, unknown>) =>
  truthy(valueOf(expression, context));

/** The steps of run.yml that read another of a ticket's repositories, with a
 * token the factory makes from the app's key as it runs. */
const ACROSS = [
  "Post the verdict",
  "Tell the other repositories",
  "Read the repository",
];
/** How often a part of a workflow names the app's key other than to
 * compare it with empty text, wherever in it: an `env`, a `with`, an `if`,
 * or a script. */
const keyUses = (part: unknown) =>
  JSON.stringify(part).match(/secrets\.app-key(?! [!=]= '')/g)?.length ?? 0;

/** The expression a value written as `${{ ... }}` holds. */
const inside = (value: unknown) =>
  /^\$\{\{([\s\S]*)\}\}$/.exec(String(value))![1]!;

describe("which job an event starts", () => {
  const EVERY_PART = "review board auto-merge poller dependabot";
  /** A description with a list of follow-ups. */
  const LISTS = `Why.\n\n${START}\n\n1. [ ] **A.** B.\n`;
  type Pull = ReturnType<typeof pull>;
  const pull = (
    o: {
      login?: string;
      from?: string;
      draft?: boolean;
      merged?: boolean;
      body?: string | null;
    } = {},
  ) => ({
    number: 7,
    draft: o.draft ?? false,
    merged: o.merged ?? false,
    body: o.body === undefined ? LISTS : o.body,
    user: { login: o.login ?? "dana" },
    head: { repo: { full_name: o.from ?? "acme/site" } },
  });
  /** The jobs of run.yml whose `if` holds for an event, with every part
   * on unless `parts` says otherwise. */
  const started = (
    event: Record<string, unknown>,
    inputs: Record<string, string> = {},
  ) => {
    const { name, ...payload } = event;
    const context = {
      github: {
        event_name: name,
        event: { repository: { default_branch: "main" }, ...payload },
        repository: "acme/site",
        ref_name: event.ref ?? "main",
        actor: (event.pull_request as Pull | undefined)?.user.login ?? "dana",
      },
      inputs: {
        parts: EVERY_PART,
        job: "",
        ticket: "",
        "override-label": "verdict-override",
        ...inputs,
      },
    };
    return Object.entries(run.jobs)
      .filter(([, job]) => evaluate(job.if!, context))
      .map(([id]) => id);
  };
  const target = (action: string, more: Record<string, unknown> = {}) => ({
    name: "pull_request_target",
    action,
    pull_request: pull(),
    ...more,
  });

  it("reads an expression as GitHub does", () => {
    const context = { a: { b: "x" }, list: "one two" };
    expect(evaluate("a.b == 'x' && (a.c == '' || a.b != 'x')", context)).toBe(
      true,
    );
    expect(evaluate('!contains(fromJSON(\'["x", "y"]\'), a.b)', context)).toBe(
      false,
    );
    expect(evaluate("contains(format(' {0} ', list), ' two ')", context)).toBe(
      true,
    );
    expect(evaluate("contains(format(' {0} ', list), ' tw ')", context)).toBe(
      false,
    );
  });

  it("compares text whatever its case, as GitHub does", () => {
    const context = { github: { repository: "Acme/Site" } };
    expect(evaluate("github.repository == 'acme/site'", context)).toBe(true);
    expect(evaluate("github.repository != 'acme/site'", context)).toBe(false);
    expect(evaluate("github.repository == 'acme/other'", context)).toBe(false);
  });

  it.each<[string, Record<string, unknown>, string[]]>([
    [
      "a push to the default branch",
      { name: "push" },
      ["check", "enroll", "conflicts"],
    ],
    ["a push to another branch", { name: "push", ref: "feature" }, ["check"]],
    [
      "a pull request opened",
      target("opened"),
      ["verdict", "merge-policy", "board", "review"],
    ],
    [
      "a draft opened",
      { ...target("opened"), pull_request: pull({ draft: true }) },
      ["verdict", "merge-policy", "board"],
    ],
    [
      "a push to a pull request",
      target("synchronize"),
      ["verdict", "merge-policy", "review"],
    ],
    [
      "a push to a draft",
      { ...target("synchronize"), pull_request: pull({ draft: true }) },
      ["verdict", "merge-policy"],
    ],
    [
      "a pull request marked ready",
      target("ready_for_review"),
      ["verdict", "merge-policy", "board", "review"],
    ],
    [
      "a pull request given another base branch",
      target("edited", { changes: { base: { ref: { from: "side" } } } }),
      ["verdict", "merge-policy", "review"],
    ],
    [
      "a pull request whose title is edited",
      target("edited", { changes: { title: { from: "Old" } } }),
      [],
    ],
    ["a pull request made a draft", target("converted_to_draft"), ["board"]],
    ["a pull request closed", target("closed"), ["board"]],
    [
      "a pull request merged, whose description lists follow-ups",
      { ...target("closed"), pull_request: pull({ merged: true }) },
      ["board", "follow-ups"],
    ],
    [
      "a pull request merged, whose description lists none",
      {
        ...target("closed"),
        pull_request: pull({ merged: true, body: "Why." }),
      },
      ["board"],
    ],
    [
      "a pull request merged with no description",
      { ...target("closed"), pull_request: pull({ merged: true, body: null }) },
      ["board"],
    ],
    [
      "a fork's pull request merged, whose description lists follow-ups",
      {
        ...target("closed"),
        pull_request: pull({ merged: true, from: "mallory/site" }),
      },
      [],
    ],
    [
      "the override label added",
      target("labeled", { label: { name: "verdict-override" } }),
      ["verdict"],
    ],
    ["another label added", target("labeled", { label: { name: "bug" } }), []],
    [
      "a pull request of Dependabot's opened",
      { ...target("opened"), pull_request: pull({ login: "dependabot[bot]" }) },
      ["verdict", "dependabot"],
    ],
    [
      "a fork's pull request opened",
      { ...target("opened"), pull_request: pull({ from: "mallory/site" }) },
      ["verdict"],
    ],
    [
      "a review submitted",
      { name: "pull_request_review", pull_request: pull() },
      ["answer"],
    ],
    [
      "a review submitted on a fork's pull request",
      {
        name: "pull_request_review",
        pull_request: pull({ from: "mallory/site" }),
      },
      [],
    ],
    [
      "01:00, 13:00, and 19:00",
      { name: "schedule", schedule: "0 1,13,19 * * *" },
      ["dependencies", "updates"],
    ],
    ["07:00", { name: "schedule", schedule: "0 7 * * *" }, ["board"]],
    ["09:00", { name: "schedule", schedule: "0 9 * * *" }, ["conflicts"]],
    [
      "the poller's own schedule",
      { name: "schedule", schedule: "*/5 * * * *" },
      ["poller"],
    ],
    [
      "the poller's schedule on the hour",
      { name: "schedule", schedule: "0 * * * *" },
      ["poller"],
    ],
  ])("on %s, starts %j", (_, event, jobs) => {
    expect(started(event)).toEqual(jobs);
  });

  it.each<[Record<string, string>, string[]]>([
    [{ job: "build", ticket: "12" }, ["build"]],
    [{ ticket: "12" }, ["build"]],
    [{ job: "review", pr: "7", review: "9" }, ["answer"]],
    [{ job: "answer", pr: "7" }, ["answer"]],
    [{ job: "conflicts" }, ["conflicts"]],
    [{ job: "conflict", pr: "7" }, ["conflict"]],
    [{ job: "dependencies" }, ["dependencies"]],
    [{ job: "dependency", pr: "7" }, ["dependency"]],
    [{ job: "updates" }, ["updates"]],
    [{ job: "board" }, ["board"]],
    [{ job: "poller" }, ["poller"]],
    [{ job: "polish" }, ["unknown"]],
    [{}, []],
  ])("by hand with %j, starts %j", (inputs, jobs) => {
    expect(started({ name: "workflow_dispatch" }, inputs)).toEqual(jobs);
  });

  it("starts no job a part turns off, and still the verdict, a build, an answer, the sweep, and updates", () => {
    const off = { parts: "" };
    expect(started(target("opened"), off)).toEqual(["verdict"]);
    expect(
      started({ name: "schedule", schedule: "0 1,13,19 * * *" }, off),
    ).toEqual(["updates"]);
    expect(started({ name: "schedule", schedule: "0 7 * * *" }, off)).toEqual(
      [],
    );
    expect(started({ name: "schedule", schedule: "*/5 * * * *" }, off)).toEqual(
      [],
    );
    expect(
      started({ name: "workflow_dispatch" }, { ...off, job: "board" }),
    ).toEqual([]);
    expect(started({ name: "push" }, off)).toEqual(["check", "conflicts"]);
    expect(started({ name: "push" }, { parts: "board poller" })).toEqual([
      "check",
      "conflicts",
    ]);
  });

  it("starts Dependabot's auto-merge for a push Dependabot made, and for no other event of the pull request", () => {
    const its = { pull_request: pull({ login: "dependabot[bot]" }) };
    expect(started({ ...target("synchronize"), ...its })).toContain(
      "dependabot",
    );
    for (const action of ["ready_for_review", "labeled", "closed"])
      expect(started({ ...target(action), ...its }), action).not.toContain(
        "dependabot",
      );
  });

  it("takes the override label's name from what the repository's file passes", () => {
    const renamed = target("labeled", { label: { name: "ship it" } });
    expect(started(renamed, { "override-label": "ship it" })).toEqual([
      "verdict",
    ]);
    expect(started(renamed)).toEqual([]);
  });

  it("starts the approval policies' checks on a push, a change of base, and a draft, and approves on the label or an approving review", () => {
    const on = {
      parts: "approval-policies",
      "policy-label": "policy-override",
    };
    for (const action of [
      "opened",
      "synchronize",
      "ready_for_review",
      "converted_to_draft",
    ])
      expect(started(target(action), on), action).toContain("approval-prepare");
    expect(
      started(target("edited", { changes: { base: { ref: {} } } }), on),
    ).toEqual(["verdict", "approval-prepare"]);
    expect(started(target("edited", { changes: { title: {} } }), on)).toEqual(
      [],
    );
    expect(
      started(target("labeled", { label: { name: "policy-override" } }), on),
    ).toContain("approval-label");
    expect(
      started(
        {
          name: "pull_request_review",
          pull_request: pull(),
          review: { state: "approved" },
        },
        on,
      ),
    ).toContain("approval-label");
    expect(
      started(target("opened"), {
        parts: "",
        "policy-label": "policy-override",
      }),
    ).not.toContain("approval-prepare");
  });

  it("passes neither override with the other's label", () => {
    const on = {
      parts: "approval-policies review",
      "policy-label": "policy-override",
    };
    const policy = started(
      target("labeled", { label: { name: "policy-override" } }),
      on,
    );
    expect(policy).toContain("approval-label");
    expect(policy).not.toContain("verdict");
    const verdict = started(
      target("labeled", { label: { name: "verdict-override" } }),
      on,
    );
    expect(verdict).toContain("verdict");
    expect(verdict).not.toContain("approval-label");
  });

  it("fails one job, naming it, for a job it does not have", () => {
    const { dir } = sandbox();
    const r = runScript(run.jobs.unknown!.steps![0]!.run!, dir, {
      JOB: "polish",
    });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("::error::Unknown job polish.");
  });
});

describe("the jobs that run no session", () => {
  const { jobs } = run;

  it.each([
    "check",
    "verdict",
    "merge-policy",
    "board",
    "follow-ups",
    "poller",
    "enroll",
    "conflicts",
    "dependencies",
  ])(
    "%s checks out the default branch, never the pull request, and installs the factory before it runs it",
    (name) => {
      const job = jobs[name]!;
      const checkout = job.steps![0]!;
      expect(checkout.uses).toBe("actions/checkout@v7");
      // How much history it fetches is its own; which commit, never.
      expect(checkout.with?.ref).toBeUndefined();
      expect(checkout.with?.repository).toBeUndefined();
      expect(names(job).slice(1, 3)).toEqual([
        "Set up Node",
        "Install the factory",
      ]);
    },
  );

  it("posts the verdict with the workflow's own token, which may read the run's jobs", () => {
    const job = jobs.verdict!;
    expect(job.permissions).toMatchObject({
      actions: "read",
      statuses: "write",
    });
    const post = step(job, "Post the verdict");
    expect(post.run).toBe('factory review verdict ${PR:+--pr "$PR"}');
    expect(post.env!.GH_TOKEN).toBe("${{ github.token }}");
  });

  it("classifies with the workflow's token, and turns auto-merge on only with the app's or the owner's", () => {
    const job = jobs["merge-policy"]!;
    expect(step(job, "Classify").env).toEqual({
      GH_TOKEN: "${{ github.token }}",
    });
    expect(step(job, "Turn auto-merge on or off").env!.GH_TOKEN).toBe(
      "${{ steps.app.outputs.token || secrets.automerge-token }}",
    );
    expect(job.concurrency).toEqual({
      group: "factory-merge-policy-${{ github.event.pull_request.number }}",
      "cancel-in-progress": true,
    });
  });

  it("gives the board's token only to the step that writes the board, and never cancels a sync", () => {
    const job = jobs.board!;
    const collect = step(job, "Read the repository").env!;
    expect(collect.GH_TOKEN).toBe("${{ github.token }}");
    expect(JSON.stringify(collect)).not.toContain("board-token");
    expect(step(job, "Write the board").env).toEqual({
      GH_TOKEN: "${{ steps.app.outputs.token || secrets.board-token }}",
    });
    expect(job.concurrency).toEqual({
      group: "factory-board-sync",
      "cancel-in-progress": false,
    });
  });

  it("opens the ticked tickets from the event, with the workflow's own token, and no more than it needs", () => {
    const job = jobs["follow-ups"]!;
    expect(step(job, "Open the ticked tickets")).toEqual({
      name: "Open the ticked tickets",
      env: { GH_TOKEN: "${{ github.token }}" },
      run: 'factory pr follow-ups --event "$GITHUB_EVENT_PATH"',
    });
    expect(job.permissions).toEqual({
      contents: "read",
      issues: "write",
      "pull-requests": "write",
    });
    expect(job.concurrency).toEqual({
      group: "factory-follow-ups-${{ github.event.pull_request.number }}",
      "cancel-in-progress": false,
    });
  });

  it("syncs the board once those tickets are open, and whether or not that job ran or passed", () => {
    const job = jobs.board!;
    expect(job.needs).toEqual(["follow-ups"]);
    // Without a status function in it, GitHub skips a job whose `needs` did.
    expect(job.if).toMatch(/^!cancelled\(\) && /);
  });

  it("runs one pass of the poller at a time, with the board's token", () => {
    const job = jobs.poller!;
    expect(step(job, "Start the Ready tickets")).toMatchObject({
      run: "factory poller --once",
      env: {
        FACTORY_BOARD_TOKEN:
          "${{ steps.app.outputs.token || secrets.board-token }}",
      },
    });
    expect(job.concurrency).toEqual({
      group: "factory-poller",
      "cancel-in-progress": false,
    });
  });

  it.each([
    ["conflicts", "conflict"],
    ["dependencies", "dependency"],
  ])(
    "%s starts a %s run for each pull request, and none with no token that can",
    (name, kind) => {
      const start = step(jobs[name]!, "Start a run for each");
      expect(valueOf(inside(start.env!.KIND), { github: { job: name } })).toBe(
        kind,
      );
      const started = (env: Record<string, string>) => {
        const { dir, calls } = sandbox({ factory: "" });
        const r = runScript(start.run!, dir, { KIND: kind, ...env });
        return { status: r.status, out: r.stdout.trim(), calls: calls() };
      };

      expect(started({ GH_TOKEN: "t" })).toEqual({
        status: 0,
        out: "",
        calls: [`factory session each ${kind}`],
      });
      expect(started({ GH_TOKEN: "" })).toEqual({
        status: 0,
        out: "No build token is set, so no session starts.",
        calls: [],
      });
    },
  );

  it("opens the updates' pull requests with the build token, and passes with a line when there is none", () => {
    const job = jobs.updates!;
    const open = step(job, "Open the pull requests");
    expect(open.env!.GH_TOKEN).toBe(
      "${{ steps.app.outputs.token || secrets.build-token }}",
    );
    expect(open.run).toContain("factory update --pull-requests");
    expect(job.concurrency).toEqual({
      group: "factory-updates",
      "cancel-in-progress": false,
    });

    const { dir, calls } = sandbox({ factory: "", gh: "", git: "" });
    const r = runScript(open.run!, dir, { GH_TOKEN: "" });
    expect([r.status, r.stdout.trim()]).toEqual([
      0,
      "No build token is set, so no update's pull request is opened. factory doctor shows when you are behind.",
    ]);
    expect(calls()).toEqual([]);
  });
});

describe("the actions the workflows use", () => {
  it("uses one version of each action across every workflow", () => {
    const versions = new Map<string, Set<string>>();
    for (const file of readdirSync(".github/workflows"))
      for (const [, action, version] of readFileSync(
        `.github/workflows/${file}`,
        "utf8",
      ).matchAll(/uses: (actions\/[\w-]+)@(\S+)/g))
        versions.set(
          action!,
          (versions.get(action!) ?? new Set()).add(version!),
        );
    expect(
      [...versions]
        .filter(([, v]) => v.size > 1)
        .map(([a, v]) => `${a}: ${[...v].join(", ")}`),
    ).toEqual([]);
  });
});

describe("the approval policies' jobs", () => {
  const job = (id: string) => run.jobs[id]!;
  const checkout = (j: Job) =>
    j.steps!.find((s) => s.uses?.startsWith("actions/checkout"))!;

  it("runs the commands and the agent with no token, a checkout that keeps none, and only reading the code", () => {
    for (const id of ["approval-commands", "approval-agent"]) {
      const j = job(id);
      expect(j.permissions, id).toEqual({ contents: "read" });
      expect(checkout(j).with?.["persist-credentials"], id).toBe(false);
      expect(JSON.stringify(j.steps), id).not.toMatch(
        /GH_TOKEN|GITHUB_TOKEN|github\.token/,
      );
    }
  });

  it("runs an agent only on a pull request from the repository itself, and not on Dependabot's push", () => {
    const conditions = job("approval-agent")
      .if!.split("&&")
      .map((c) => c.trim());
    expect(conditions).toContain(
      "github.event.pull_request.head.repo.full_name == github.repository",
    );
    expect(conditions).toContain("github.actor != 'dependabot[bot]'");
  });

  it("gives the merge policy the history to read an approval policy's change", () => {
    const checkout = run.jobs["merge-policy"]!.steps!.find((s) =>
      s.uses?.startsWith("actions/checkout"),
    )!;
    expect(checkout.with?.["fetch-depth"]).toBe(0);
  });

  it("installs the version of Claude Code a session runs", () => {
    const install = (j: Job) =>
      j.steps!.find((s) => s.run?.includes("@anthropic-ai/claude-code@"))!.run;
    expect(install(job("approval-agent"))).toBe(install(sessionJob));
  });

  it("checks one pull request at a time, approves one label at a time, and cancels none", () => {
    for (const id of ["approval-prepare", "approval-status", "approval-label"])
      expect(job(id).concurrency?.["cancel-in-progress"], id).toBe(false);
    expect(job("approval-prepare").concurrency?.group).toBe(
      job("approval-status").concurrency?.group,
    );
  });

  it("keeps what was found, and what was approved, for as long as GitHub allows by default", () => {
    const kept = (id: string, name: string) =>
      job(id).steps!.find((s) => s.name === name)!.with!["retention-days"];
    expect(kept("approval-status", "Keep what was found")).toBe(90);
    expect(kept("approval-label", "Keep the approval")).toBe(90);
  });
});

describe("installing the factory in a run", () => {
  const install = step(run.jobs.check!, "Install the factory").run!;
  const npm = { npm: "" };

  /** A checkout whose lock names `version`. */
  const checkout = (version: string | null, manifest?: object) => {
    const box = sandbox(npm);
    if (version !== null) {
      mkdirSync(join(box.dir, ".claude"));
      writeFileSync(
        join(box.dir, ".claude/factory.lock"),
        `# Written by factory sync.\nversion: ${version}\npresets: []\n`,
      );
    }
    if (manifest)
      writeFileSync(join(box.dir, "package.json"), JSON.stringify(manifest));
    return box;
  };

  it("installs the version the repository's lock names", () => {
    const { dir, calls } = checkout("0.3.0", { name: "site" });
    expect(runScript(install, dir).status).toBe(0);
    expect(calls().filter((c) => c.startsWith("npm"))).toEqual([
      "npm install --global --no-audit --no-fund @davidbyoung/software-factory@0.3.0",
    ]);
  });

  it.each([
    "latest",
    "0.3.0 && curl evil",
    "https://example.com/x.tgz",
    "0.0.0-development",
  ])("refuses a lock that names %s, and installs nothing", (version) => {
    const { dir, calls } = checkout(version);
    const r = runScript(install, dir);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain(
      "::error::.claude/factory.lock names no release of the factory.",
    );
    expect(calls().filter((c) => c.startsWith("npm"))).toEqual([]);
  });

  it("installs the checkout itself in the factory's own repository", () => {
    const { dir, calls } = checkout("0.0.0-development", {
      name: "@davidbyoung/software-factory",
    });
    expect(runScript(install, dir).status).toBe(0);
    expect(calls().filter((c) => c.startsWith("npm"))).toEqual([
      "npm ci --ignore-scripts",
      "npm link",
    ]);
  });

  it("is the same script in every job that runs the factory, with its scripts on only where the repository's own dependencies are needed", () => {
    for (const job of Object.values(run.jobs))
      for (const s of job.steps ?? [])
        if (s.name === "Install the factory") expect(s.run).toBe(install);
    for (const job of [review.jobs.check!, prepareJob, publishJob])
      expect(step(job, "Install the factory").run).toBe(install);
    // A session's also says what it installed, for the steps after it.
    const inSession = step(sessionJob, "Install the factory").run!;
    for (const line of install
      .split("\n")
      .filter((l) => /version|npm install/.test(l)))
      expect(inSession).toContain(line);
    expect(inSession).toContain("npm ci\n");
  });
});

describe("the repository's own secrets", () => {
  const take = step(sessionJob, "Take the repository's own secrets");

  it("exports each one a later step reads, masks every line of it first, and skips one that is not set", () => {
    const { dir } = sandbox();
    const r = runScript(take.run!, dir, {
      EXTRA: JSON.stringify({
        NPM_TOKEN: "npm_abc",
        KEY: "line one\nline two",
        UNSET: "",
      }),
    });
    expect(r.status).toBe(0);
    expect(r.stdout.trim().split("\n")).toEqual([
      "::add-mask::npm_abc",
      "::add-mask::line one",
      "::add-mask::line two",
    ]);
    const env = readFileSync(join(dir, "env"), "utf8");
    expect(env).toMatch(/^NPM_TOKEN<<(FACTORY_[0-9a-f]{16})\nnpm_abc\n\1\n/);
    expect(env).toMatch(
      /KEY<<(FACTORY_[0-9a-f]{16})\nline one\nline two\n\1\n/,
    );
    expect(env).not.toContain("UNSET");
  });

  it("does nothing when the repository passes none", () => {
    const { dir } = sandbox();
    expect(runScript(take.run!, dir, { EXTRA: "" })).toMatchObject({
      status: 0,
      stdout: "",
    });
    expect(existsSync(join(dir, "env"))).toBe(false);
  });

  it("is the same script in the board sync, the job that opens the ticked tickets, and the poller", () => {
    for (const job of [
      run.jobs.board!,
      run.jobs["follow-ups"]!,
      run.jobs.poller!,
    ])
      expect(step(job, "Take the repository's own secrets").run).toBe(take.run);
  });
});

describe("the job that prepares a session", () => {
  const gate = step(prepareJob, "Check whether there is work, then the tokens");

  it("runs its steps in this order", () => {
    expect(names(prepareJob)).toEqual([
      "Checkout the default branch",
      "Set up Node",
      "Install the factory",
      "Check whether there is work, then the tokens",
      "Sign in",
      "Name the committer",
      "Hand over what the session works from",
      "Hand it to the session",
      "Release the ticket",
    ]);
  });

  it("releases the ticket of a build that fails or is canceled here", () => {
    const release = step(prepareJob, "Release the ticket");
    expect(release.run).toBe('factory ticket end "$ID"');
    expect(release.if).toBe(
      "(failure() || cancelled()) && inputs.kind == 'build' && steps.gate.outputs.ran == 'true'",
    );
  });

  it("checks out the default branch with full history", () => {
    expect(prepareJob.steps![0]!.with).toMatchObject({
      ref: "${{ github.event.repository.default_branch }}",
      "fetch-depth": 0,
    });
  });

  it("asks whether there is work with the workflow's own token, before any step reads the build token or the app's key", () => {
    expect(gate.env).toEqual({
      GH_TOKEN: "${{ github.token }}",
      FACTORY_BUILD_TOKEN_SET: "${{ secrets.build-token != '' }}",
      FACTORY_APP_KEY_SET:
        "${{ secrets.app-key != '' && vars.FACTORY_APP_CLIENT_ID != '' }}",
      FACTORY_CLAUDE_SET:
        "${{ secrets.claude-token != '' || secrets.claude-api-key != '' }}",
      KIND: "${{ inputs.kind }}",
      ID: "${{ inputs.id }}",
      REVIEW: "${{ inputs.review }}",
    });
    const after = prepareJob.steps!.slice(
      prepareJob.steps!.indexOf(gate) + 1,
      -1,
    );
    expect(after.map((s) => s.if)).toEqual([
      ...Array(3).fill("steps.gate.outputs.ran == 'true'"),
      "steps.prepare.outputs.ran == 'true'",
    ]);
  });

  it.each<[string, string, string]>([
    ["", "", "factory session ready answer 31"],
    ["with a review", "9", "factory session ready answer 31 9"],
  ])("asks about the pull request %s", (_, reviewId, asked) => {
    const { dir, calls } = sandbox({ factory: "" });
    const r = runScript(gate.run!, dir, {
      KIND: "answer",
      ID: "31",
      REVIEW: reviewId,
    });
    expect([r.status, calls()]).toEqual([0, [asked]]);
  });

  it("starts the session only when it handed something over", () => {
    expect(prepareJob.outputs).toEqual({
      ran: "${{ steps.prepare.outputs.ran }}",
    });
    expect(sessionJob.needs).toBe("prepare");
    expect(sessionJob.if).toBe("needs.prepare.outputs.ran == 'true'");
  });

  /** What the step that names the committer hands to the steps after it. */
  const committer = (env: Record<string, string>, gh: string) => {
    const { dir, calls } = sandbox({ gh });
    const script = step(prepareJob, "Name the committer").run!;
    expect(runScript(script, dir, env).status).toBe(0);
    return { env: readFileSync(join(dir, "env"), "utf8"), calls: calls() };
  };

  it("names the build token's owner as the committer, by their no-reply address, with no line break in the name", () => {
    expect(
      committer(
        { KIND: "build", APP_SLUG: "" },
        `echo '{"login":"acme-builds","id":42,"name":null}'`,
      ).env,
    ).toBe(
      "FACTORY_COMMITTER_NAME=acme-builds\nFACTORY_COMMITTER_EMAIL=42+acme-builds@users.noreply.github.com\n",
    );
    expect(
      committer(
        { KIND: "build", APP_SLUG: "" },
        String.raw`printf '%s' '{"login":"d","id":1,"name":"Dana\nPATH=/evil"}'`,
      ).env,
    ).toBe(
      "FACTORY_COMMITTER_NAME=Dana PATH=/evil\nFACTORY_COMMITTER_EMAIL=1+d@users.noreply.github.com\n",
    );
  });

  it("names the app's bot as the committer under the app, by its no-reply address", () => {
    expect(
      committer(
        { KIND: "build", APP_SLUG: "software-factory-for-acme" },
        "echo 4242",
      ),
    ).toEqual({
      env: "FACTORY_COMMITTER_NAME=software-factory-for-acme[bot]\nFACTORY_COMMITTER_EMAIL=4242+software-factory-for-acme[bot]@users.noreply.github.com\n",
      calls: ["gh api /users/software-factory-for-acme[bot] --jq .id"],
    });
  });

  it("asks the code host for no committer for a review, which commits nothing", () => {
    expect(committer({ KIND: "review", APP_SLUG: "" }, "exit 1").calls).toEqual(
      [],
    );
  });

  it("hands over the presets the lock names with the rest, and still hands over when they cannot be read", () => {
    const hand = step(prepareJob, "Hand over what the session works from");
    const { dir, calls } = sandbox({
      factory:
        'echo "cache $XDG_CACHE_HOME" >> "$RUNNER_TEMP/calls"; [ "$1" != sync ]',
    });
    const r = runScript(hand.run!, dir, {
      FACTORY_RUN: "/run",
      KIND: "build",
      ID: "12",
    });
    expect([r.status, calls()]).toEqual([
      0,
      [
        "factory sync --check",
        "cache /run/in/cache",
        "factory session prepare build 12",
        "cache",
      ],
    ]);
  });
});

describe("the job that runs the agent", () => {
  it("runs its steps in this order", () => {
    expect(names(sessionJob)).toEqual([
      "Take what was handed over",
      "Wait for it to be listed",
      "Take what was handed over again",
      "Lay out the default branch",
      "Read what the repository installs with",
      "Set up Node",
      "Install the factory",
      "Take the repository's own secrets",
      "Install the repository's dependencies",
      "Run the build's setup commands",
      "Set up the sandbox",
      "Install Claude Code",
      "Run the session",
      "Hand on what the session left",
    ]);
  });

  it("is bounded by the limit it is given, and the agent by its minutes", () => {
    expect(sessionJob["timeout-minutes"]).toBe("${{ inputs.limit }}");
    expect(step(sessionJob, "Run the session").env).toMatchObject({
      MINUTES: "${{ inputs.minutes }}",
      PROMPT: "${{ inputs.prompt }}",
    });
  });

  it("runs the default branch's copy, and nothing from anywhere else, before the agent starts", () => {
    const { dir } = sandbox();
    mkdirSync(join(dir, "in"));
    writeFileSync(join(dir, "in/run.json"), '{"defaultBranch":"trunk"}');
    const git = (cwd: string, ...args: string[]) => {
      const r = spawnSync(
        "git",
        ["-c", "user.name=t", "-c", "user.email=t@t", ...args],
        { cwd, encoding: "utf8" },
      );
      expect(r.status, r.stderr).toBe(0);
      return r.stdout.trim();
    };
    const from = mkdtempSync(join(tmpdir(), "factory-home-"));
    git(from, "init", "-q");
    git(from, "commit", "-q", "--allow-empty", "-m", "one");
    git(from, "update-ref", "refs/handoff/home", "HEAD");
    git(
      from,
      "bundle",
      "create",
      "-q",
      join(dir, "in/home.bundle"),
      "refs/handoff/home",
    );

    const lay = step(sessionJob, "Lay out the default branch");
    expect(runScript(lay.run!, dir, { GITHUB_WORKSPACE: dir })).toMatchObject({
      status: 0,
    });
    const home = join(dir, "home");
    expect(git(home, "branch", "--show-current")).toBe("trunk");
    expect(git(home, "rev-parse", "HEAD")).toBe(git(from, "rev-parse", "HEAD"));

    const order = names(sessionJob);
    for (const s of sessionJob.steps!.filter(
      (s) =>
        s.run &&
        order.indexOf(s.name) > order.indexOf(lay.name) &&
        !["Set up the sandbox", "Install Claude Code"].includes(s.name) &&
        s.name !== "Take the repository's own secrets",
    ))
      expect(s["working-directory"], s.name).toBe("home");
  });

  it("runs npm ci in the default branch's copy, only where the repository has a package-lock.json", () => {
    expect(
      step(sessionJob, "Install the repository's dependencies"),
    ).toMatchObject({
      if: "steps.node.outputs.lock == 'true'",
      "working-directory": "home",
      run: "npm ci",
    });
  });

  it("takes Node's version from package.json only when it sets engines.node", () => {
    const reads = step(
      sessionJob,
      "Read what the repository installs with",
    ).run!;
    const outputs = (files: Record<string, string>) => {
      const { dir } = sandbox();
      for (const [name, text] of Object.entries(files))
        writeFileSync(join(dir, name), text);
      expect(runScript(reads, dir).status).toBe(0);
      return existsSync(join(dir, "output"))
        ? readFileSync(join(dir, "output"), "utf8")
        : "";
    };
    expect(outputs({})).toBe("");
    expect(outputs({ "package.json": '{"name":"x"}' })).toBe("");
    expect(
      outputs({
        "package.json": '{"engines":{"node":">=22"}}',
        "package-lock.json": "{}",
      }),
    ).toBe("file=home/package.json\nlock=true\n");
    expect(step(sessionJob, "Set up Node").with).toMatchObject({
      "node-version-file": "${{ steps.node.outputs.file }}",
      "node-version": "${{ steps.node.outputs.file == '' && '22' || '' }}",
    });
  });

  it("runs factory build-setup, which runs each command in its folders, and fails when it does", () => {
    const setup = step(sessionJob, "Run the build's setup commands").run!;
    const runSetup = (status: number) => {
      const { dir, calls } = sandbox({ factory: `exit ${status}` });
      return { r: runScript(setup, dir), calls: calls() };
    };
    const ok = runSetup(0);
    expect(ok.r.status).toBe(0);
    expect(ok.calls).toEqual(["factory build-setup"]);
    expect(runSetup(1).r.status).not.toBe(0);
  });

  it("gives the session one Claude credential: the subscription's when both are set, and neither input's own variable", () => {
    const script = step(sessionJob, "Run the session").run!;
    const seen = (env: Record<string, string>) => {
      const { dir, calls } = sandbox({
        factory:
          'echo "oauth=${CLAUDE_CODE_OAUTH_TOKEN-none} key=${ANTHROPIC_API_KEY-none} inputs=${OAUTH_TOKEN_INPUT-none},${API_KEY_INPUT-none}" > "$RUNNER_TEMP/seen"',
      });
      const r = runScript(script, dir, env);
      expect([r.status, calls()]).toEqual([0, ["factory session run"]]);
      return readFileSync(join(dir, "seen"), "utf8").trim();
    };
    expect(seen({ OAUTH_TOKEN_INPUT: "sub", API_KEY_INPUT: "key" })).toBe(
      "oauth=sub key=none inputs=none,none",
    );
    expect(seen({ OAUTH_TOKEN_INPUT: "", API_KEY_INPUT: "key" })).toBe(
      "oauth=none key=key inputs=none,none",
    );
  });

  it("installs a pinned version of Claude Code", () => {
    expect(step(sessionJob, "Install Claude Code").run).toMatch(
      /@anthropic-ai\/claude-code@\d+\.\d+\.\d+$/,
    );
  });
});

describe("the job that publishes what a session left", () => {
  it("runs its steps in this order", () => {
    expect(names(publishJob)).toEqual([
      "Checkout the default branch",
      "Set up Node",
      "Install the factory",
      "Name the run's folder",
      "Take what was handed over",
      "Take what the session left",
      "Wait for it to be listed",
      "Take what the session left again",
      "Record the review",
      "Sign in",
      "Start the next answer",
      "Publish what the session left",
      "Release the ticket",
    ]);
  });

  it("looks again for what the session left, as the session's job does", () => {
    const first = step(publishJob, "Take what the session left");
    const again = step(publishJob, "Take what the session left again");
    expect(again.with).toEqual(first.with);
    expect(again.if).toBe("steps.left.outcome == 'failure'");
    expect(again["continue-on-error"]).toBe(true);
  });

  it("releases a build's ticket whatever happened before, signing in for it when it has to", () => {
    const release = step(publishJob, "Release the ticket");
    expect(release.run).toBe('factory ticket end "$ID"');
    expect(release.if).toBe(
      "always() && inputs.kind == 'build' && steps.app.outputs.signed == 'true'",
    );
    expect(step(publishJob, "Sign in").if).toContain(
      "(!success() && inputs.kind == 'build')",
    );
  });

  it("runs whatever the session did, once something was handed over, so a build's claim is always released", () => {
    expect(publishJob.needs).toEqual(["prepare", "session"]);
    expect(publishJob.if).toBe(
      "always() && needs.prepare.outputs.ran == 'true'",
    );
    expect(
      step(publishJob, "Take what the session left")["continue-on-error"],
    ).toBe(true);
  });

  it("outlasts the hour it waits for CI", () => {
    expect(publishJob["timeout-minutes"]).toBe(75);
  });

  it("records a review alone with a review's session, and publishes any other", () => {
    const runs = (kind: string, next: string, signed = next) =>
      publishJob
        .steps!.filter(
          (s) =>
            s.name !== "Release the ticket" &&
            s.if?.includes("inputs.kind") &&
            evaluate(s.if, {
              inputs: { kind },
              steps: {
                record: { outputs: { next } },
                app: { outputs: { signed } },
              },
            }),
        )
        .map((s) => s.name);

    expect(runs("review", "")).toEqual(["Record the review"]);
    expect(runs("review", "true")).toEqual([
      "Record the review",
      "Sign in",
      "Start the next answer",
    ]);
    // With no sign-in there is nothing to start an answer with.
    expect(runs("review", "true", "")).toEqual([
      "Record the review",
      "Sign in",
    ]);
    for (const kind of ["build", "answer", "conflict", "dependency"])
      expect(runs(kind, ""), kind).toEqual([
        "Sign in",
        "Publish what the session left",
      ]);
  });

  it("reads what each job left from outside the checkout, by the names they were handed on by", () => {
    const artifact = (job: Job, name: string) => step(job, name).with!.name;
    const into = (name: string) => step(publishJob, name).with!.path;

    expect(artifact(publishJob, "Take what was handed over")).toBe(
      artifact(prepareJob, "Hand it to the session"),
    );
    expect(artifact(sessionJob, "Take what was handed over")).toBe(
      artifact(prepareJob, "Hand it to the session"),
    );
    expect(artifact(publishJob, "Take what the session left")).toBe(
      artifact(sessionJob, "Hand on what the session left"),
    );
    expect(into("Take what was handed over")).toBe(
      "${{ runner.temp }}/factory/in",
    );
    expect(into("Take what the session left")).toBe(
      "${{ runner.temp }}/factory/out",
    );
  });
});

describe("the five jobs that run a session", () => {
  const SESSIONS: [string, string, string, string][] = [
    ["build", "build", "build", "`factory-build`"],
    ["review", "review", "review", "`.github/factory-review.md`"],
    ["answer", "answer", "review", "`factory-address-review`"],
    ["conflict", "conflict", "conflicts", "`factory-resolve-conflicts`"],
    ["dependency", "dependency", "dependencies", "`factory-deps`"],
  ];
  const calling = Object.entries(run.jobs).filter(([, job]) => job.uses);
  const REPOSITORY = new URL("..", import.meta.url).pathname;
  /** A command of the factory's, or a module's call, run in an empty folder
   * with nothing signed in and no settings, so it reads no code host. */
  const outside = (args: string[]) => {
    const dir = mkdtempSync(join(tmpdir(), "factory-outside-"));
    const r = spawnSync(process.execPath, args, {
      cwd: dir,
      env: { PATH: "/usr/bin:/bin", HOME: dir },
      encoding: "utf8",
    });
    return { status: r.status, said: r.stdout + r.stderr };
  };

  it("are the only ones that call another workflow", () => {
    expect(calling.map(([id]) => id)).toEqual(SESSIONS.map(([id]) => id));
  });

  it.each(SESSIONS)(
    "%s calls session.yml for a %s session, with the settings' minutes and limit and the instructions' name",
    (name, kind, minutes, instructions) => {
      const job = run.jobs[name]!;
      expect(job.uses).toBe("./.github/workflows/session.yml");
      expect(job.with).toMatchObject({
        kind,
        minutes: `\${{ inputs.${minutes}-minutes }}`,
        limit: `\${{ inputs.${minutes}-limit }}`,
      });
      expect(job.with!.prompt).toContain(instructions);
      expect(job.secrets).toEqual({
        "build-token": "${{ secrets.build-token }}",
        "app-key": "${{ secrets.app-key }}",
        "claude-token": "${{ secrets.claude-token }}",
        "claude-api-key": "${{ secrets.claude-api-key }}",
        extra: "${{ secrets.extra }}",
      });
    },
  );

  it.each(SESSIONS)(
    "%s tells the session it works in ../work, with no sign-in",
    (name) => {
      const { prompt } = run.jobs[name]!.with!;
      expect(prompt).toContain("The branch you work on is in `../work`");
      expect(prompt).toContain("`cd ../work`");
      expect(prompt).toContain("no sign-in to the code host");
    },
  );

  it.each([...SESSIONS.map(([, kind]) => [kind, true]), ["polish", false]] as [
    string,
    boolean,
  ][])(
    "%s is a kind that `factory session ready` and `prepare` know: %s",
    (kind, known) => {
      const ready = outside([
        join(REPOSITORY, "bin/factory.js"),
        "session",
        "ready",
        kind,
        "7",
      ]);
      const jobs = JSON.stringify(join(REPOSITORY, "src/session-jobs.mts"));
      const prepare = outside([
        "--input-type=module",
        "-e",
        `const { run } = await import(${jobs}); await run("prepare", ["${kind}", "7"]);`,
      ]);

      expect(ready.status).toBe(known ? 1 : 2);
      for (const { said } of [ready, prepare]) {
        expect(said).not.toBe("");
        expect(!said.includes("Usage: factory session")).toBe(known);
      }
    },
  );

  it("gives an answer the pull request's and the review's numbers, from the event or from a run by hand", () => {
    const given = (
      key: string,
      event: Record<string, unknown>,
      inputs: Record<string, string>,
    ) =>
      valueOf(inside(run.jobs.answer!.with![key]), {
        github: { event },
        inputs,
      });
    const event = { pull_request: { number: 31 }, review: { id: 9 } };

    expect(given("id", event, {})).toBe(31);
    expect(given("review", event, {})).toBe(9);
    expect(given("id", {}, { pr: "31", review: "9" })).toBe("31");
    expect(given("review", {}, { pr: "31", review: "9" })).toBe("9");
    expect(given("review", {}, { pr: "31" })).toBe("");
  });

  it("works each pull request's conflict, its dependency, and each answer once at a time, and cancels none", () => {
    for (const [job, group] of [
      ["conflict", "factory-conflict-${{ inputs.pr }}"],
      ["dependency", "factory-dependency-${{ inputs.pr }}"],
      [
        "answer",
        "factory-answer-${{ inputs.pr || github.event.pull_request.number }}-${{ github.event.review.id || inputs.review }}",
      ],
    ])
      expect(run.jobs[job]!.concurrency, job).toEqual({
        group,
        "cancel-in-progress": false,
      });
  });

  it("reviews a pull request's newest push alone, and sets no limit on a build", () => {
    expect(run.jobs.review!.concurrency).toEqual({
      group: "factory-review-${{ github.event.pull_request.number }}",
      "cancel-in-progress": true,
    });
    expect(run.jobs.build!.concurrency).toBeUndefined();
  });

  it("keeps one search for conflicts and one for dependencies waiting, and cancels none", () => {
    expect(run.jobs.conflicts!.concurrency).toEqual({
      group: "factory-conflicts",
      "cancel-in-progress": false,
    });
    expect(run.jobs.dependencies!.concurrency).toEqual({
      group: "factory-deps",
      "cancel-in-progress": false,
    });
  });
});

describe("a token of the organization's app, where its key reaches the run", () => {
  const LIST = "List the repositories the app's token is for";
  const MAKE = "Make the app's token";
  const SAY = "Say that the app is not installed";
  const AGAIN = "Give git the app's token";
  /** Each job that needs more than the workflow's own token, holds a
   * checkout to read the lock from, and ends within the hour a token of
   * the app's lasts. */
  const JOBS: [string, Job][] = [
    ["run.yml's merge-policy", run.jobs["merge-policy"]!],
    ["run.yml's board", run.jobs.board!],
    ["run.yml's poller", run.jobs.poller!],
    ["run.yml's updates", run.jobs.updates!],
    ["run.yml's enroll", run.jobs.enroll!],
    ["run.yml's conflicts", run.jobs.conflicts!],
    ["run.yml's dependencies", run.jobs.dependencies!],
  ];
  const list = step(run.jobs.board!, LIST);
  const REACHES = { APP_KEY_SET: "true", CLIENT_ID: "Iv23li" };

  it.each(JOBS)(
    "%s makes one once the factory is installed, for the repositories the factory names",
    (_, job) => {
      const order = names(job);
      const at = order.indexOf(LIST);
      expect(order.indexOf("Install the factory")).toBeLessThan(at);
      expect(order.slice(at, at + 3)).toEqual([LIST, MAKE, SAY]);
      expect(step(job, LIST)).toMatchObject({
        id: "repositories",
        env: {
          APP_KEY_SET: "${{ secrets.app-key != '' }}",
          CLIENT_ID: "${{ vars.FACTORY_APP_CLIENT_ID }}",
        },
        run: list.run,
      });
      const make = step(job, MAKE);
      expect(make).toMatchObject({
        id: "app",
        uses: "actions/create-github-app-token@v3",
      });
      expect(make.if).toContain("steps.repositories.outputs.names != ''");
      expect(make.with).toMatchObject({
        "client-id": "${{ vars.FACTORY_APP_CLIENT_ID }}",
        "private-key": "${{ secrets.app-key }}",
        owner: "${{ github.repository_owner }}",
        repositories: "${{ steps.repositories.outputs.names }}",
      });
    },
  );

  it.each<[string, Workflow]>([
    ["run.yml", run],
    ["poller.yml", read("poller.yml")],
  ])(
    "%s hands the app's key to the step that makes the token, and to a session it calls, and only compares it anywhere else",
    (_, file) => {
      const given = Object.values(file.jobs)
        .map((job) =>
          job.uses
            ? job.secrets?.["app-key"]
            : job.steps!.find((s) => s.name === MAKE)?.with?.["private-key"],
        )
        .filter((value) => value !== undefined);

      expect(given.length).toBeGreaterThan(0);
      for (const value of given) expect(value).toBe("${{ secrets.app-key }}");
      const across = Object.values(file.jobs).flatMap((job) =>
        (job.steps ?? []).filter((s) => ACROSS.includes(s.name!)),
      );
      expect(keyUses(file)).toBe(given.length + across.length);
    },
  );

  it("asks the factory for the repositories only when the key and the client ID both reach the run", () => {
    const listed = (env: Record<string, string>) => {
      const { dir, calls } = sandbox({ factory: "echo web,factory-config" });
      const r = runScript(list.run!, dir, env);
      const output = join(dir, "output");
      return {
        status: r.status,
        calls: calls(),
        output: existsSync(output) ? readFileSync(output, "utf8") : "",
      };
    };

    expect(listed(REACHES)).toEqual({
      status: 0,
      calls: ["factory session repositories"],
      output: "names=web,factory-config\n",
    });
    for (const env of [
      { ...REACHES, APP_KEY_SET: "false" },
      { ...REACHES, CLIENT_ID: "" },
    ])
      expect(listed(env)).toEqual({ status: 0, calls: [], output: "" });
  });

  it("fails the step, and so makes no token, when the factory cannot name the repositories", () => {
    const { dir } = sandbox({ factory: "exit 1" });

    expect(runScript(list.run!, dir, REACHES).status).not.toBe(0);
    expect(existsSync(join(dir, "output"))).toBe(false);
  });

  it("makes one for the repository alone for Dependabot's pull request, whose code it does not check out", () => {
    const job = run.jobs.dependabot!;
    expect(names(job)).toEqual([
      "Read the update",
      "Check whether the app's key reaches the run",
      MAKE,
      SAY,
      "Enable auto-merge",
    ]);
    const check = step(job, "Check whether the app's key reaches the run");
    expect(check).toMatchObject({ id: "repositories", env: list.env });
    expect(step(job, MAKE)).toMatchObject({
      id: "app",
      if: "steps.repositories.outputs.names != ''",
      uses: "actions/create-github-app-token@v3",
      with: { repositories: "${{ steps.repositories.outputs.names }}" },
    });
    const output = (env: Record<string, string>) => {
      const { dir, calls } = sandbox({ factory: "" });
      const r = runScript(check.run!, dir, {
        GITHUB_REPOSITORY: "acme/web",
        ...env,
      });
      const file = join(dir, "output");
      return [
        r.status,
        calls(),
        existsSync(file) ? readFileSync(file, "utf8") : "",
      ];
    };

    expect(output(REACHES)).toEqual([0, [], "names=web\n"]);
    expect(output({ ...REACHES, APP_KEY_SET: "false" })).toEqual([0, [], ""]);
    expect(output({ ...REACHES, CLIENT_ID: "" })).toEqual([0, [], ""]);
  });

  it.each([...JOBS, ["run.yml's dependabot", run.jobs.dependabot!]] as [
    string,
    Job,
  ][])(
    "%s fails, saying who installs the app, when no token could be made",
    (_, job) => {
      expect(step(job, MAKE)).not.toHaveProperty("continue-on-error");
      const say = step(job, SAY);
      expect(say.if).toContain("failure()");
      expect(say.if).toContain("steps.app.outcome == 'failure'");

      const r = runScript(say.run!, sandbox().dir, {
        GITHUB_REPOSITORY: "acme/web",
        GITHUB_REPOSITORY_OWNER: "acme",
        GITHUB_SERVER_URL: "https://github.com",
      });
      expect(r.stdout).toBe(
        "::error::The software factory's app for acme is not installed on acme/web. An owner of acme adds it: https://github.com/organizations/acme/settings/installations\n",
      );
    },
  );

  it.each<[string, Job, string, string, string]>([
    [
      "turns auto-merge on",
      run.jobs["merge-policy"]!,
      "Turn auto-merge on or off",
      "GH_TOKEN",
      "automerge-token",
    ],
    [
      "writes the board",
      run.jobs.board!,
      "Write the board",
      "GH_TOKEN",
      "board-token",
    ],
    [
      "starts the Ready tickets",
      run.jobs.poller!,
      "Start the Ready tickets",
      "FACTORY_BOARD_TOKEN",
      "board-token",
    ],
    [
      "opens the updates' pull requests",
      run.jobs.updates!,
      "Open the pull requests",
      "GH_TOKEN",
      "build-token",
    ],
    [
      "turns auto-merge on for Dependabot's pull request",
      run.jobs.dependabot!,
      "Enable auto-merge",
      "GH_TOKEN",
      "automerge-token",
    ],
    [
      "starts a run for each pull request that conflicts",
      run.jobs.conflicts!,
      "Start a run for each",
      "GH_TOKEN",
      "build-token",
    ],
    [
      "starts a run for each of Dependabot's pull requests",
      run.jobs.dependencies!,
      "Start a run for each",
      "GH_TOKEN",
      "build-token",
    ],
  ])(
    "%s with the app's token, and with the token it uses today when there is none",
    (_, job, name, variable, today) => {
      const token = (app: string) =>
        valueOf(inside(step(job, name).env![variable]), {
          steps: { app: { outputs: { token: app } } },
          secrets: { [today]: "a person's" },
        });

      expect(token("the app's")).toBe("the app's");
      expect(token("")).toBe("a person's");
    },
  );

  it("reads a person's token in no step but as what stands in for the app's", () => {
    const person = /secrets\.(?:build|board|automerge)-token(?! != '')/;
    const found = [run, review, session].flatMap((file) =>
      Object.values(file.jobs).flatMap((job) =>
        (job.steps ?? []).flatMap((s) =>
          [...Object.values(s.env ?? {}), ...Object.values(s.with ?? {})]
            .filter((v): v is string => typeof v === "string")
            .filter(
              (v) =>
                person.test(v) &&
                !v.includes("steps.app.outputs.token || secrets.") &&
                !v.includes("secrets.app-key == ''"),
            )
            .map(() => `${job.name}: ${s.name}`),
        ),
      ),
    );

    expect(found).toEqual([]);
  });

  it("checks out for the updates with the workflow's own token under the app, and with the build token without it", () => {
    const token = (
      secrets: Record<string, string>,
      vars: Record<string, string>,
    ) =>
      valueOf(inside(run.jobs.updates!.steps![0]!.with!.token), {
        secrets,
        vars,
        github: { token: "the workflow's" },
      });
    const both = { "app-key": "key", "build-token": "a person's" };
    const id = { FACTORY_APP_CLIENT_ID: "Iv23li" };

    expect(token(both, id)).toBe("the workflow's");
    expect(token({ ...both, "app-key": "" }, id)).toBe("a person's");
    expect(token(both, {})).toBe("a person's");
    expect(token({}, {})).toBe("the workflow's");
  });

  it("checks the updates' job out again with the app's token before it pushes, and cleans nothing the factory's install left", () => {
    const job = run.jobs.updates!;
    const again = step(job, AGAIN);
    expect(again.uses).toBe("actions/checkout@v7");
    expect(again.if).toContain("steps.app.outputs.token != ''");
    expect(again.with).toEqual({
      "fetch-depth": 0,
      clean: false,
      token: "${{ steps.app.outputs.token }}",
    });
    const order = names(job);
    expect(order.indexOf(MAKE)).toBeLessThan(order.indexOf(AGAIN));
    expect(order.indexOf(AGAIN)).toBeLessThan(
      order.indexOf("Open the pull requests"),
    );
  });

  it("commits an update as the app's bot, and signs nothing, whatever the signing key holds", () => {
    const open = step(run.jobs.updates!, "Open the pull requests");
    expect(open.env!.APP_SLUG).toBe("${{ steps.app.outputs.app-slug }}");
    const { dir, calls } = sandbox({ gh: "echo 4242", git: "", factory: "" });

    const r = runScript(open.run!, dir, {
      GH_TOKEN: "ghs_app",
      APP_SLUG: "software-factory-for-acme",
      SIGNING_KEY_INPUT: "PRIVATE KEY",
    });
    expect(r.status).toBe(0);
    expect(calls()).toEqual([
      "gh api /users/software-factory-for-acme[bot] --jq .id",
      "git config --global user.name software-factory-for-acme[bot]",
      "git config --global user.email 4242+software-factory-for-acme[bot]@users.noreply.github.com",
      "factory update --pull-requests",
    ]);
    expect(existsSync(join(dir, "factory-signing-key"))).toBe(false);
  });
});

describe("what each job's token of the app may do", () => {
  const FILES = ["run.yml", "review.yml", "session.yml", "poller.yml"];
  /** Every step that makes a token of the app's, by its file and job,
   * with the permissions it asks for, each by the name the app's
   * registration gives it. */
  const tokens = FILES.flatMap((file) =>
    Object.entries(read(file).jobs).flatMap(([id, job]) =>
      (job.steps ?? [])
        .filter((s) => s.uses?.startsWith("actions/create-github-app-token"))
        .map((s) => ({
          job: `${file} ${id}`,
          permissions: Object.fromEntries(
            Object.entries(s.with ?? {})
              .filter(([name]) => name.startsWith("permission-"))
              .map(([name, level]) => [
                name.slice("permission-".length).replaceAll("-", "_"),
                level,
              ]),
          ),
        })),
    ),
  );
  const of = (job: string) => tokens.find((t) => t.job === job)?.permissions;

  it.each<[string, string, Record<string, string>]>([
    [
      "turns auto-merge on or off",
      "run.yml merge-policy",
      { pull_requests: "write", contents: "write" },
    ],
    [
      "writes the board's cards for the repository's tickets",
      "run.yml board",
      { organization_projects: "write", issues: "read" },
    ],
    [
      "reads the board, the tickets, and their pull requests, notes a start on a ticket, and starts its build",
      "run.yml poller",
      {
        organization_projects: "read",
        issues: "write",
        pull_requests: "read",
        actions: "write",
      },
    ],
    [
      "pushes an update's branch, a workflow's file with it, and opens its pull request",
      "run.yml updates",
      { contents: "write", workflows: "write", pull_requests: "write" },
    ],
    [
      "sets the repository's software-factory property",
      "run.yml enroll",
      { repository_custom_properties: "write" },
    ],
    [
      "finds the pull requests that conflict, and starts a run for each",
      "run.yml conflicts",
      { actions: "write", pull_requests: "read" },
    ],
    [
      "finds Dependabot's pull requests, and starts a run for each",
      "run.yml dependencies",
      { actions: "write", pull_requests: "read" },
    ],
    [
      "turns auto-merge on for Dependabot's pull request",
      "run.yml dependabot",
      { pull_requests: "write", contents: "write" },
    ],
    [
      "does what a repository's poller does, and reads each repository's settings",
      "poller.yml poller",
      {
        organization_projects: "read",
        issues: "write",
        pull_requests: "read",
        actions: "write",
        contents: "read",
      },
    ],
    [
      "pushes the branch that rewrites the poller's own file, and opens its pull request",
      "poller.yml updates",
      { contents: "write", workflows: "write", pull_requests: "write" },
    ],
  ])("the job that %s asks for that and no more", (_, job, permissions) => {
    expect(of(job)).toEqual(permissions);
  });

  it("has a set for every token a job makes, so none falls back to everything the app may do", () => {
    expect(tokens.map((t) => t.job)).toEqual([
      "run.yml merge-policy",
      "run.yml board",
      "run.yml poller",
      "run.yml enroll",
      "run.yml conflicts",
      "run.yml dependencies",
      "run.yml dependabot",
      "run.yml updates",
      "poller.yml poller",
      "poller.yml updates",
    ]);
    for (const token of tokens)
      expect(Object.keys(token.permissions).length, token.job).toBeGreaterThan(
        0,
      );
  });

  it("lets only the job that requires the verdict set a repository's properties", () => {
    expect(
      tokens
        .filter((t) => "repository_custom_properties" in t.permissions)
        .map((t) => t.job),
    ).toEqual(["run.yml enroll"]);
  });

  it("asks for nothing the app's registration does not hold, which GitHub would refuse", () => {
    const held: Record<string, string> = manifestOf(
      "Software Factory for acme",
      "http://127.0.0.1/registered",
    ).default_permissions;
    const beyond = tokens.flatMap((t) =>
      Object.entries(t.permissions)
        .filter(
          ([name, level]) =>
            !(name in held) || (level === "write" && held[name] !== "write"),
        )
        .map(([name, level]) => `${t.job}: ${name}: ${level}`),
    );

    expect(beyond).toEqual([]);
  });
});

describe("the sign-in of the two jobs around a session", () => {
  const KEY = {
    FACTORY_APP_CLIENT_ID: "${{ vars.FACTORY_APP_CLIENT_ID }}",
    FACTORY_APP_PRIVATE_KEY: "${{ secrets.app-key }}",
  };
  const APP = {
    FACTORY_APP_CLIENT_ID: "Iv23client",
    FACTORY_APP_PRIVATE_KEY: "PRIVATE KEY",
  };
  const JOBS: [string, Job][] = [
    ["prepare", prepareJob],
    ["publish", publishJob],
  ];
  const signing = (job: Job, env: Record<string, string>) => {
    const { dir, calls } = sandbox({ factory: "", gh: "" });
    const r = runScript(step(job, "Sign in").run!, dir, {
      // Publish alone reads it: a review's answer needs a person's token.
      ...(job === publishJob ? { BUILD_TOKEN_SET: "true" } : {}),
      ...env,
    });
    return {
      status: r.status,
      said: r.stdout + r.stderr,
      calls: calls(),
    };
  };

  it.each(JOBS)(
    "in %s is as the app wherever its key and the client ID both reach the run",
    (_, job) => {
      expect(signing(job, APP)).toEqual({
        status: 0,
        said: "",
        calls: ["factory session token"],
      });
    },
  );

  // `gh auth login` refuses a token without `read:org`, which the token
  // `factory init` asks for does not have.
  it.each(JOBS)(
    "in %s only points git at the CLI where either does not, checking no scope of the token's",
    (_, job) => {
      for (const missing of Object.keys(APP))
        expect(signing(job, { ...APP, [missing]: "" }), missing).toEqual({
          status: 0,
          said: "",
          calls: ["gh auth setup-git --hostname github.com --force"],
        });
    },
  );

  it("in publish signs nothing in with neither the app nor a person's token, and says so", () => {
    expect(
      signing(publishJob, {
        FACTORY_APP_CLIENT_ID: "",
        FACTORY_APP_PRIVATE_KEY: "",
        BUILD_TOKEN_SET: "false",
      }),
    ).toEqual({
      status: 0,
      said: "No build token is set, so no answer starts.\n",
      calls: [],
    });
  });

  it.each(JOBS)(
    "in %s fails when the app's token cannot be made, and falls back to no other",
    (_, job) => {
      const { dir, calls } = sandbox({ factory: "exit 1", gh: "" });
      const r = runScript(step(job, "Sign in").run!, dir, {
        ...APP,
        BUILD_TOKEN_SET: "true",
      });
      expect([r.status, calls()]).toEqual([1, ["factory session token"]]);
    },
  );

  /** The steps of each job that reach the code host once it is signed in. */
  const REACHING: [string, Job, string][] = [
    ["prepare", prepareJob, "Name the committer"],
    ["prepare", prepareJob, "Hand over what the session works from"],
    ["prepare", prepareJob, "Release the ticket"],
    ["publish", publishJob, "Start the next answer"],
    ["publish", publishJob, "Publish what the session left"],
    ["publish", publishJob, "Release the ticket"],
  ];
  /** The token a step is given, for a kind of run, a person's token, and
   * whether the app's key and the client ID reach it. */
  const given = (
    job: Job,
    name: string,
    o: { kind: string; person: string; key?: string; id?: string },
  ) =>
    valueOf(inside(step(job, name).env!.GH_TOKEN), {
      secrets: { "build-token": o.person, "app-key": o.key ?? "" },
      vars: { FACTORY_APP_CLIENT_ID: o.id ?? "" },
      inputs: { kind: o.kind },
      github: { token: "the workflow's" },
    });

  it.each(REACHING)(
    "in %s gives a person's token to a step that reaches the code host, and none where the app signs in: $2",
    (_, job, name) => {
      const o = { kind: "build", person: "a person's" };
      expect(given(job, name, o)).toBe("a person's");
      expect(given(job, name, { ...o, key: "K" })).toBe("a person's");
      expect(given(job, name, { ...o, id: "I" })).toBe("a person's");
      expect(given(job, name, { ...o, key: "K", id: "I" })).toBe("");
    },
  );

  it("gives a person's token to no other step of the two jobs", () => {
    for (const job of [prepareJob, publishJob]) {
      const holding = job
        .steps!.filter((s) =>
          Object.values(s.env ?? {}).some(
            (v) =>
              /build-token/.test(String(v)) &&
              !/build-token != ''/.test(String(v)),
          ),
        )
        .map((s) => s.name);
      expect(holding).toEqual([
        // To read another repository with, where no app's key is set.
        ...(job === publishJob ? ["Record the review"] : []),
        ...REACHING.filter(([, j]) => j === job).map(([, , name]) => name),
      ]);
      expect(job).not.toHaveProperty("env");
    }
  });

  it("stands the workflow's own token in for a person's only in preparing a review, which reads", () => {
    for (const [, job, name] of REACHING)
      for (const kind of [
        "review",
        "build",
        "answer",
        "conflict",
        "dependency",
      ])
        expect(given(job, name, { kind, person: "" }), `${name}: ${kind}`).toBe(
          kind === "review" && job === prepareJob ? "the workflow's" : "",
        );
  });

  it("keeps a person's token out of the sign-in's own environment", () => {
    expect(step(prepareJob, "Sign in").env).toEqual(KEY);
    expect(step(publishJob, "Sign in").env).toEqual({
      ...KEY,
      BUILD_TOKEN_SET: "${{ secrets.build-token != '' }}",
    });
  });

  it("hands the app's key to the steps that sign in, and to the one that signs in again after CI, and only compares it anywhere else", () => {
    const given = [
      step(prepareJob, "Sign in"),
      step(publishJob, "Sign in"),
      step(publishJob, "Publish what the session left"),
      // These reach another of a ticket's repositories, or may.
      step(prepareJob, "Hand over what the session works from"),
      step(prepareJob, "Release the ticket"),
      step(publishJob, "Release the ticket"),
    ];
    for (const s of given) expect(s.env).toMatchObject(KEY);
    const record = step(publishJob, "Record the review");
    expect(keyUses(record)).toBe(1);
    expect(keyUses(session)).toBe(given.length + 1);
  });

  it("makes no token of its own in a step, and renews none behind the others", () => {
    const text = JSON.stringify(session);
    expect(text).not.toContain("create-github-app-token");
    expect(text).not.toContain("--keep");
    expect(text).not.toContain("nohup");
  });

  it("signs no commit: nothing of a session reads the signing key, which the updates' job alone does", () => {
    expect(JSON.stringify(session)).not.toContain("signing-key");
    const reading = Object.entries(run.jobs)
      .filter(([, job]) => JSON.stringify(job).includes("secrets.signing-key"))
      .map(([id]) => id);
    expect(reading).toEqual(["updates"]);
  });
});

describe("the review and its verdict, which stay the workflow's own", () => {
  const OTHER =
    /steps\.app\.|app-key|(?:build|board|automerge)-token|create-github-app-token/;

  /** What a step is given to read another repository with, by the pull
   * request's body and the job a run by hand asks for. */
  const reading = (
    s: Step,
    o: { body?: string | null; job?: string; id?: string; key?: string },
  ) => {
    const scope = {
      secrets: { "app-key": o.key ?? "K", "build-token": "a person's" },
      vars: { FACTORY_APP_CLIENT_ID: o.id ?? "I" },
      inputs: { job: o.job ?? "", pr: "" },
      github: {
        event_name: o.job ? "workflow_dispatch" : "pull_request_target",
        event: { pull_request: { body: o.body ?? null } },
      },
    };
    return {
      key: valueOf(inside(s.env!.FACTORY_APP_PRIVATE_KEY), scope),
      person: valueOf(inside(s.env!.FACTORY_BUILD_TOKEN), scope),
    };
  };
  const READERS: [string, Step][] = [
    ["the verdict", step(run.jobs.verdict!, "Post the verdict")],
    ["a review", step(publishJob, "Record the review")],
  ];

  it.each(READERS)(
    "posts %s with the workflow's own token, and is given another to read with only for a pull request that is part of a ticket",
    (_, s) => {
      expect(s.env!.GH_TOKEN).toBe("${{ github.token }}");
      expect(s.env!.FACTORY_ACROSS).toBe("read");
      expect(reading(s, { body: "Closes #12" }).key).toBe("");
      expect(reading(s, { body: null }).key).toBe("");
      expect(reading(s, { body: "Part of acme/api#12" })).toEqual({
        key: "K",
        person: "",
      });
      expect(reading(s, { body: "Part of #12", key: "", id: "" })).toEqual({
        key: "",
        person: "a person's",
      });
    },
  );

  it("names no other person's token in the verdict's job, and none of an action's", () => {
    expect(JSON.stringify(run.jobs.verdict)).not.toMatch(
      /(?:board|automerge)-token|create-github-app-token|steps\.app\./,
    );
  });

  it("gives the verdict's job one to read with when another repository starts it again", () => {
    const s = step(run.jobs.verdict!, "Post the verdict");
    expect(reading(s, { job: "order" }).key).toBe("K");
    expect(reading(s, { job: "build" }).key).toBe("");
  });

  it("records a review with the workflow's own token, and no other, before the job signs in", () => {
    const record = step(publishJob, "Record the review");
    expect(record.env).toMatchObject({
      GH_TOKEN: "${{ github.token }}",
      CONCLUSION: "${{ needs.session.result }}",
    });
    expect(record.run).toBe("factory session publish");
    expect(publishJob).not.toHaveProperty("env");

    const before = publishJob.steps!.slice(
      0,
      publishJob.steps!.indexOf(record),
    );
    for (const s of before)
      expect(JSON.stringify(s), s.name).not.toMatch(OTHER);
    expect(names(publishJob).indexOf("Sign in")).toBeGreaterThan(
      publishJob.steps!.indexOf(record),
    );
  });

  it("gives the workflow's own token to no other step that publishes", () => {
    const given = publishJob
      .steps!.filter((s) => JSON.stringify(s).includes("github.token"))
      .map((s) => s.name);
    expect(given).toEqual(["Record the review"]);
  });
});

/** The workflows of this repository, and the two a repository's sync
 * writes, by name. */
const EVERY: [string, Workflow][] = [
  ...readdirSync(".github/workflows")
    .filter((file) => file.endsWith(".yml"))
    .map((file): [string, Workflow] => [file, read(file)]),
  [`${FACTORY_FILE}, as sync writes it`, factoryYml()],
  [`${REVIEW_FILE}, as sync writes it`, factoryReviewYml()],
];

/** Every secret a part of a workflow names, however it names it. A step's
 * own name is text. */
const secretsIn = (part: unknown) => [
  ...new Set(
    (
      JSON.stringify(part ?? null, (key, value) =>
        key === "name" ? undefined : value,
      ).match(/\bsecrets\b(?:\.[\w-]+|\s*\[[^\]]*\])?/g) ?? []
    ).sort(),
  ),
];
/** What signs a step in to the code host: a secret that is a sign-in, the
 * workflow's own token, or a command or an action that makes or takes one. */
const SIGN_IN =
  /app-key|(?:build|board|automerge)-token|signing-key|github\.token|GITHUB_TOKEN|GH_TOKEN|steps\.app\b|create-github-app-token|session token|gh auth|FACTORY_APP_PRIVATE_KEY/;
/** Whether a step starts an AI. */
const startsAi = (s: Step) =>
  /\bfactory session run\b|(?:^|[\s;&|("'])claude(?=[\s"']|$)/m.test(
    s.run ?? "",
  ) || (s.uses ?? "").startsWith("anthropics/");
const AI = EVERY.flatMap(([file, workflow]) =>
  Object.entries(workflow.jobs)
    .filter(([, job]) => job.steps?.some(startsAi))
    .map(([id, job]): [string, Job] => [`${file} ${id}`, job]),
);

describe("the AI and a sign-in to the code host, which are never in the same job", () => {
  it.each([
    "factory session run",
    "cd work && claude -p x",
    'timeout 5m claude "$P"',
  ])("takes a step that runs %s as one that starts an AI", (script) => {
    expect(startsAi({ name: "s", run: script })).toBe(true);
  });

  it.each([
    "npm install @anthropic-ai/claude-code@2.1.0",
    "factory session ready",
  ])("does not take a step that runs %s as one", (script) => {
    expect(startsAi({ name: "s", run: script })).toBe(false);
  });

  it("starts an AI in one job of every workflow there is: the session's", () => {
    expect(AI.map(([name]) => name)).toEqual(["session.yml session"]);
  });

  it.each(AI)(
    "names no sign-in in any step or value of %s but the install's, which reads packages",
    (_, job) => {
      const { steps, ...own } = job;
      expect(step(job, "Install the repository's dependencies").env).toEqual({
        GITHUB_TOKEN: "${{ github.token }}",
      });
      const found = [
        ...steps!
          .filter((s) => s.name !== "Install the repository's dependencies")
          .filter((s) => SIGN_IN.test(JSON.stringify(s)))
          .map((s) => s.name),
        ...Object.entries(own)
          .filter(([, value]) => SIGN_IN.test(JSON.stringify(value)))
          .map(([key]) => key),
      ];
      expect(found).toEqual([]);
    },
  );

  it("lets the session's job's own token read packages and nothing else, and gives it no cache another run shares", () => {
    expect(sessionJob.permissions).toEqual({ packages: "read" });
    expect(sessionJob["cache-mode"]).toBe("none");
  });

  it("gives the session's job no secret but the two Claude credentials and the repository's own", () => {
    expect(secretsIn(sessionJob)).toEqual([
      "secrets.claude-api-key",
      "secrets.claude-token",
      "secrets.extra",
    ]);
  });

  it("gives the Claude credentials to the step that starts the agent alone, after the repository's own commands", () => {
    const holding = sessionJob
      .steps!.filter((s) => /secrets\.claude/.test(JSON.stringify(s)))
      .map((s) => s.name);
    expect(holding).toEqual(["Run the session"]);
  });

  it("uses no action in the session's job that signs in, as a checkout does", () => {
    expect(
      new Set(sessionJob.steps!.flatMap((s) => s.uses?.split("@")[0] ?? [])),
    ).toEqual(
      new Set([
        "actions/download-artifact",
        "actions/setup-node",
        "actions/upload-artifact",
      ]),
    );
  });

  it("does nothing after the session but hand on `clean`", () => {
    const order = names(sessionJob);
    const after = sessionJob.steps!.slice(order.indexOf("Run the session") + 1);
    expect(after).toEqual([
      {
        name: "Hand on what the session left",
        if: "always() && steps.session.outcome != 'skipped'",
        uses: "actions/upload-artifact@v6",
        with: {
          name: "out-${{ inputs.kind }}",
          path: "clean",
          "if-no-files-found": "ignore",
          overwrite: true,
          "retention-days": 7,
        },
      },
    ]);
  });

  it("keeps what was handed over one day, and hands over what Prepare wrote alone", () => {
    const uploads = prepareJob.steps!.filter((s) =>
      s.uses?.startsWith("actions/upload-artifact"),
    );
    expect(uploads.map((s) => s.with)).toEqual([
      {
        name: "in-${{ inputs.kind }}",
        path: "${{ runner.temp }}/factory/in",
        "include-hidden-files": true,
        overwrite: true,
        "retention-days": 1,
      },
    ]);
  });

  it.each<[string, Job]>([
    ["prepare", prepareJob],
    ["publish", publishJob],
  ])(
    "holds no Claude credential and none of the repository's own secrets in %s",
    (_, job) => {
      const given = secretsIn(
        job.steps!.map((s) => ({
          ...s,
          env: Object.fromEntries(
            Object.entries(s.env ?? {}).filter(([, v]) => !v.includes("!= ''")),
          ),
        })),
      );
      expect(given).toEqual(["secrets.app-key", "secrets.build-token"]);
      expect(secretsIn(job.env)).toEqual([]);
    },
  );
});

describe("the two jobs around a session, which have a sign-in", () => {
  const JOBS: [string, Job][] = [
    ["prepare", prepareJob],
    ["publish", publishJob],
  ];

  it.each(JOBS)(
    "%s checks out the default branch once, storing no sign-in, and shares no cache",
    (_, job) => {
      const checkouts = job.steps!.filter((s) =>
        s.uses?.startsWith("actions/checkout"),
      );
      expect(checkouts).toHaveLength(1);
      expect(checkouts[0]!.with).toMatchObject({
        ref: "${{ github.event.repository.default_branch }}",
        "persist-credentials": false,
      });
      expect(checkouts[0]!.with).not.toHaveProperty("repository");
      expect(checkouts[0]!.with).not.toHaveProperty("path");
      expect(job["cache-mode"]).toBe("none");
    },
  );

  it.each(JOBS)(
    "%s runs nothing but the factory's commands and the code host's, from the default branch's checkout",
    (_, job) => {
      const scripts = job.steps!.filter(
        (s) => s.run && s.name !== "Install the factory",
      );
      for (const s of scripts) {
        expect(s, s.name).not.toHaveProperty("working-directory");
        expect(s.run, s.name).not.toMatch(
          /(?:^|[\s;&|(])(?:git|npm|npx|node|bash|sh|source|eval|exec|cd|pushd)\s|bundle|\/out\b/m,
        );
      }
      expect(
        new Set(job.steps!.flatMap((s) => s.uses?.split("@")[0] ?? [])),
      ).toEqual(
        new Set([
          "actions/checkout",
          "actions/setup-node",
          job === prepareJob
            ? "actions/upload-artifact"
            : "actions/download-artifact",
        ]),
      );
    },
  );

  it("puts what was handed on outside the checkout", () => {
    for (const s of publishJob.steps!.filter((s) =>
      s.uses?.startsWith("actions/download-artifact"),
    ))
      expect(s.with!.path, s.name).toMatch(/^\$\{\{ runner\.temp \}\}\//);
  });
});

describe("a pull request's own code, in run.yml", () => {
  /** What names a pull request's own commit or branch. */
  const HEAD =
    /pull_request\.head\.(?:sha|ref)|head_sha|head_ref|refs\/pull\/|merge_commit_sha|gh pr checkout|github\.(?:sha|ref)\b/;
  const target = Object.entries(run.jobs).filter(
    ([, job]) => !job.if || job.if.includes("pull_request_target"),
  );

  it("is judged in these jobs, which start on pull_request_target", () => {
    expect(target.map(([id]) => id)).toEqual([
      "verdict",
      "approval-prepare",
      "approval-label",
      "across",
      "merge-policy",
      "board",
      "follow-ups",
      "review",
      "dependabot",
    ]);
  });

  it.each(target)("is never checked out by %s", (_, job) => {
    const called = job.uses ? Object.values(session.jobs) : [job];
    for (const each of called) {
      expect(JSON.stringify(each)).not.toMatch(HEAD);
      for (const s of each.steps!.filter((s) =>
        s.uses?.startsWith("actions/checkout"),
      )) {
        expect([
          undefined,
          "${{ github.event.repository.default_branch }}",
        ]).toContain(s.with?.ref);
        expect(s.with ?? {}).not.toHaveProperty("repository");
      }
    }
    expect(JSON.stringify(job)).not.toMatch(HEAD);
  });
});

describe("the files GitHub runs from a pull request's copy", () => {
  it.each<[string, Workflow]>([
    ["review.yml", review],
    [
      "factory-review.yml, whatever the settings turn on",
      factoryReviewYml({ secrets: ["NPM_TOKEN", "GITHUB_TOKEN"] }),
    ],
  ])(
    "%s names no secret, and may only read the code and Actions",
    (_, file) => {
      expect(secretsIn(file)).toEqual([]);
      expect(JSON.stringify(file)).not.toMatch(/inherit/);
      expect(file.permissions).toEqual({ actions: "read", contents: "read" });
      for (const job of Object.values(file.jobs))
        expect(job).not.toHaveProperty("permissions");
    },
  );
});

describe("what the two files grant the jobs they call, which can have no more", () => {
  type Permissions = Record<string, string>;
  const RANK = ["none", "read", "write"];
  /** The most each of some jobs asks for. */
  const most = (asked: Permissions[]) => {
    const all: Permissions = {};
    for (const [name, level] of asked.flatMap((p) => Object.entries(p)))
      if (RANK.indexOf(level) > RANK.indexOf(all[name] ?? "none"))
        all[name] = level;
    return all;
  };
  const asked = (file: Workflow) =>
    Object.values(file.jobs)
      .filter((job) => !job.uses)
      .map((job) => job.permissions ?? file.permissions);
  const calling = Object.entries(run.jobs).filter(([, job]) => job.uses);

  it.each<[string, string[]]>([
    ["no secret of the repository's own", []],
    ["a sign-in with the workflow's own token in .npmrc", ["GITHUB_TOKEN"]],
  ])(
    "is what some job of theirs asks for, and no more, with %s",
    (_, secrets) => {
      const grants = factoryYml({ secrets }).permissions;
      expect(grants).toEqual(most([...asked(run), ...asked(session)]));
    },
  );

  it("is what review.yml asks for, and no more, from factory-review.yml", () => {
    expect(factoryReviewYml().permissions).toEqual(most(asked(review)));
  });

  it.each(calling)(
    "is what a job of session.yml asks for, and no more, from %s",
    (_, job) => {
      expect(job.permissions).toEqual(most(asked(session)));
    },
  );
});

describe("the names one part of the factory goes by for another", () => {
  it("names an answer's run as the runner counts it, a pull request's as it finds its review, and leaves any other to GitHub", () => {
    const named = (
      inputs: Record<string, string>,
      github: Record<string, unknown> = { event_name: "workflow_dispatch" },
    ) => valueOf(inside(factoryYml()["run-name"]), { inputs, github });
    const event = { pull_request: { number: 31, head: { sha: "abc" } } };

    expect(named({ job: "answer", pr: "31" })).toBe(answerName(31));
    expect(named({ job: "build", ticket: "12" })).toBe("Build #12");
    expect(named({}, { event_name: "pull_request_target", event })).toBe(
      "#31 at abc",
    );
    expect(named({ job: "conflict", pr: "31" })).toBe("");
    expect(named({}, { event_name: "pull_request_review", event })).toBe("");
  });

  it("names the review's jobs as the runner looks for them", () => {
    const [calling] = Object.keys(factoryYml().jobs);
    const name = `${calling} / ${run.jobs.review!.name} / `;

    expect(REVIEW_JOBS).toBe(name);
    expect(Object.values(session.jobs).map((job) => job.name)).toEqual([
      "Prepare",
      "Session",
      "Publish",
    ]);
  });
});

describe("the job that makes the verdict required, once a setup has merged", () => {
  const job = run.jobs.enroll!;

  it("runs factory enroll with the app's token, or a person's build token, or the workflow's own, and says which it holds", () => {
    const enroll = step(job, "Require the verdict");
    expect(enroll.run).toBe("factory enroll");
    const env = (app: string, person: string) =>
      Object.fromEntries(
        Object.entries(enroll.env!).map(([name, value]) => [
          name,
          valueOf(inside(value), {
            steps: { app: { outputs: { token: app } } },
            secrets: { "build-token": person },
            github: { token: "the workflow's" },
          }),
        ]),
      );

    expect(env("the app's", "a person's")).toEqual({
      GH_TOKEN: "the app's",
      FACTORY_APP_TOKEN_SET: true,
      FACTORY_BUILD_TOKEN_SET: true,
    });
    expect(env("", "a person's")).toEqual({
      GH_TOKEN: "a person's",
      FACTORY_APP_TOKEN_SET: false,
      FACTORY_BUILD_TOKEN_SET: true,
    });
    expect(env("", "")).toEqual({
      GH_TOKEN: "the workflow's",
      FACTORY_APP_TOKEN_SET: false,
      FACTORY_BUILD_TOKEN_SET: false,
    });
  });

  it("is the job's last step, and one run goes at a time", () => {
    expect(names(job).at(-1)).toBe("Require the verdict");
    expect(job.concurrency).toEqual({
      group: "factory-enroll",
      "cancel-in-progress": false,
    });
  });
});

describe("review.yml", () => {
  const { jobs } = review;

  it("has the one job that reads a pull request's own code, on every pull request", () => {
    expect(Object.keys(jobs)).toEqual(["check"]);
    expect(jobs.check!.if).toBeUndefined();
    expect(step(jobs.check!, "Check the settings").run).toBe(
      "factory config check",
    );
  });

  it("stores no sign-in at the checkout, for the pull request's own code to read", () => {
    expect(step(jobs.check!, "Checkout").with).toEqual({
      "persist-credentials": false,
    });
  });

  it("compares the files with the base commit's lock, with no sign-in in what the factory runs with", () => {
    const compare = step(jobs.check!, "Compare the copies with their source");
    expect(compare.env).toEqual({
      BASE: "${{ github.event.pull_request.base.sha }}",
      TOKEN: "${{ github.token }}",
    });
    const { dir, calls } = sandbox({
      git: "",
      factory: 'echo "token ${TOKEN-none}" >> "$RUNNER_TEMP/calls"',
    });
    const r = runScript(compare.run!, dir, { BASE: "abc123", TOKEN: "t0ken" });

    expect([r.status, r.stdout + r.stderr]).toEqual([0, ""]);
    expect(calls()).toEqual([
      expect.stringMatching(/^git -c http\.extraheader=.* origin abc123$/),
      "factory sync --check --against abc123 --public",
      "token none",
    ]);
  });

  describe("the step that checks factory.yml", () => {
    const check = () => step(jobs.check!, "Check that factory.yml is enabled");
    /** The step, with GitHub's answer as the GitHub CLI gives it. */
    const answered = (gh: string) => {
      const { dir, calls } = sandbox({ gh });
      const r = runScript(check().run!, dir, {
        GH_TOKEN: "t0ken",
        GITHUB_REPOSITORY: "acme/web",
      });
      return { status: r.status, printed: r.stdout + r.stderr, calls };
    };
    const refused = (said: string) =>
      `echo '{"message":"as GitHub gives it"}'; printf '%s\\n' ${said} >&2; exit 1`;
    const FIX =
      "Enable it on the Actions tab, or run: gh workflow enable factory.yml. Then push a commit to this pull request.";

    it("asks for the state of the repository's own factory.yml", () => {
      expect(answered("echo active").calls()).toEqual([
        "gh api repos/acme/web/actions/workflows/factory.yml --jq .state",
      ]);
    });

    it.each<[string, string, number, string]>([
      [
        "fails, saying GitHub did it, when GitHub switched it off",
        "echo disabled_inactivity",
        1,
        `::error::GitHub switched factory.yml off after 60 days with no activity, so nothing posts "Review verdict" here. ${FIX}`,
      ],
      [
        "fails, not saying GitHub did it, when a person disabled it",
        "echo disabled_manually",
        1,
        `::error::factory.yml is disabled, so nothing posts "Review verdict" here. ${FIX}`,
      ],
      [
        "passes in a fork where GitHub has it off",
        "echo disabled_fork",
        0,
        "factory.yml is off in this fork",
      ],
      ["passes when it is enabled", "echo active", 0, "factory.yml is enabled"],
      [
        "passes when the default branch does not have it yet",
        refused("'gh: Not Found (HTTP 404)'"),
        0,
        "factory.yml is not on the default branch yet",
      ],
      [
        "passes with a warning that gives the last line of the error when GitHub does not answer",
        refused("'a notice' 'gh: Bad Gateway (HTTP 502)'"),
        0,
        "::warning::Could not tell whether factory.yml is enabled: Bad Gateway (HTTP 502)",
      ],
      [
        "passes with a warning that names a state it does not know",
        "echo deleted",
        0,
        "::warning::Could not tell whether factory.yml is enabled: its state is deleted",
      ],
    ])("%s", (_, gh, status, printed) => {
      const r = answered(gh);
      expect([r.status, r.printed]).toEqual([status, `${printed}\n`]);
    });

    it("runs whatever the steps before it did, unless the run was canceled", () => {
      expect(check().if).toBe("${{ !cancelled() }}");
    });

    it("is the one step that holds GitHub's token for the GitHub CLI", () => {
      const holders = jobs.check!.steps!.filter(
        (s) => s.env && "GH_TOKEN" in s.env,
      );
      expect(holders.map((s) => [s.name, s.env])).toEqual([
        [
          "Check that factory.yml is enabled",
          { GH_TOKEN: "${{ github.token }}" },
        ],
      ]);
    });
  });
});

describe("Dependabot's auto-merge", () => {
  const job = run.jobs.dependabot!;

  it("is turned on only for Dependabot's own pull request, never a major, and never one that names the factory", () => {
    expect(job.if!.replace(/\s+/g, " ")).toBe(
      "contains(format(' {0} ', inputs.parts), ' dependabot ') && github.event_name == 'pull_request_target' && contains(fromJSON('[\"opened\", \"reopened\", \"synchronize\"]'), github.event.action) && github.actor == 'dependabot[bot]'",
    );
    const enable = step(job, "Enable auto-merge");
    expect(enable.if!.replace(/\s+/g, " ")).toBe(
      "steps.meta.outputs.update-type != 'version-update:semver-major' && !contains(steps.meta.outputs.dependency-names, 'davidbyoung/software-factory')",
    );
    expect(job.permissions).toEqual({
      contents: "read",
      "pull-requests": "read",
    });
  });

  it("checks nothing out", () => {
    expect(JSON.stringify(job)).not.toContain("actions/checkout");
  });
});

describe("poller.yml, which an organization's factory-poller.yml calls", () => {
  const poller = read("poller.yml");
  const { jobs } = poller;
  const TOKEN = "${{ steps.app.outputs.token }}";
  const calling = (version = "0.4.0") =>
    pollerWorkflow({ owner: "acme", version, pollMinutes: 30 });
  const started = (event: { name: string; schedule?: string }) =>
    Object.entries(jobs)
      .filter(([, job]) =>
        evaluate(job.if!, {
          github: {
            event_name: event.name,
            event: { schedule: event.schedule },
          },
        }),
      )
      .map(([id]) => id);
  /** A checkout of the repository that holds the preset, with the file
   * that calls this one. */
  const checkout = (file: string, commands: Record<string, string> = {}) => {
    const box = sandbox(commands);
    mkdirSync(join(box.dir, ".github/workflows"), { recursive: true });
    writeFileSync(join(box.dir, POLLER_FILE), file);
    return box;
  };

  it("takes one secret, the app's key, which is not required, and no input", () => {
    expect(poller.on.workflow_call).toEqual({
      secrets: { "app-key": { required: false } },
    });
    expect(poller.permissions).toEqual({ contents: "read" });
  });

  it.each<[string, { name: string; schedule?: string }, string[]]>([
    [
      "a schedule of minutes",
      { name: "schedule", schedule: "*/30 * * * *" },
      ["poller"],
    ],
    [
      "the schedule on the hour",
      { name: "schedule", schedule: "0 * * * *" },
      ["poller"],
    ],
    ["01:00", { name: "schedule", schedule: "0 1 * * *" }, ["updates"]],
    ["a run by hand", { name: "workflow_dispatch" }, ["updates"]],
  ])("on %s, starts %j", (_, event, ids) => {
    expect(started(event)).toEqual(ids);
  });

  it("tells the two schedules of the file that calls it apart, as that file is written", () => {
    const [own, updates] = (
      parse(calling()).on.schedule as { cron: string }[]
    ).map(({ cron }) => started({ name: "schedule", schedule: cron }));
    expect([own, updates]).toEqual([["poller"], ["updates"]]);
  });

  it("makes one pass at a time over the preset beside the file that calls it", () => {
    const job = jobs.poller!;
    expect(job.concurrency).toEqual({
      group: "factory-poller",
      "cancel-in-progress": false,
    });
    expect(step(job, "Start the Ready tickets")).toMatchObject({
      run: "factory poller --once --preset factory-preset.yaml",
      env: { FACTORY_BOARD_TOKEN: TOKEN },
    });
  });

  it.each(["poller", "updates"])(
    "%s acts with a token of the app's for every repository it is installed on, made once the key is seen to reach the run",
    (id) => {
      const job = jobs[id]!;
      const token = step(job, "Make the app's token");
      expect(token).toMatchObject({
        id: "app",
        uses: "actions/create-github-app-token@v3",
      });
      expect(token.with).toMatchObject({
        "client-id": "${{ vars.FACTORY_APP_CLIENT_ID }}",
        "private-key": "${{ secrets.app-key }}",
        owner: "${{ github.repository_owner }}",
      });
      expect(token.with).not.toHaveProperty("repositories");
      const order = names(job);
      expect(order.indexOf("Check the app's key reaches the repository")).toBe(
        order.indexOf("Make the app's token") - 1,
      );
      expect(order.indexOf("Make the app's token")).toBeLessThan(
        order.length - 1,
      );
    },
  );

  it("fails, saying who sets the organization up, when the key or the client ID does not reach the run", () => {
    const check = step(
      jobs.poller!,
      "Check the app's key reaches the repository",
    );
    expect(check.env).toEqual({
      APP_KEY_SET: "${{ secrets.app-key != '' }}",
      CLIENT_ID: "${{ vars.FACTORY_APP_CLIENT_ID }}",
    });
    const run = (env: Record<string, string>) =>
      runScript(check.run!, sandbox().dir, {
        GITHUB_REPOSITORY: "acme/factory-config",
        GITHUB_REPOSITORY_OWNER: "acme",
        GITHUB_SERVER_URL: "https://github.com",
        ...env,
      });

    expect(run({ APP_KEY_SET: "true", CLIENT_ID: "Iv23li" }).status).toBe(0);
    for (const env of [
      { APP_KEY_SET: "false", CLIENT_ID: "Iv23li" },
      { APP_KEY_SET: "true", CLIENT_ID: "" },
    ]) {
      const r = run(env);
      expect(r.status).toBe(1);
      expect(r.stdout).toBe(
        "::error::FACTORY_APP_PRIVATE_KEY or FACTORY_APP_CLIENT_ID does not reach acme/factory-config. An owner of acme runs: factory init --org https://github.com/acme\n",
      );
    }
  });

  it("installs the release the file that calls it names", () => {
    const install = step(jobs.poller!, "Install the factory");
    const { dir, calls } = checkout(calling("0.4.0"), { npm: "" });

    expect(runScript(install.run!, dir).status).toBe(0);
    expect(calls()).toEqual([
      "npm install --global --no-audit --no-fund @davidbyoung/software-factory@0.4.0",
    ]);
    expect(step(jobs.updates!, "Install the factory").run).toBe(install.run);
  });

  it("installs nothing, naming the file, when it names no release", () => {
    const install = step(jobs.poller!, "Install the factory");
    const { dir, calls } = checkout(
      calling().replace("poller.yml@v0.4.0", "poller.yml@main"),
      { npm: "" },
    );

    const r = runScript(install.run!, dir);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe(
      "::error::.github/workflows/factory-poller.yml names no release of the factory after poller.yml@v.\n",
    );
    expect(calls()).toEqual([]);
  });

  it("checks out with the app's token, so the update's branch is pushed as the app", () => {
    const job = jobs.updates!;
    expect(step(job, "Checkout the default branch").with).toEqual({
      "fetch-depth": 0,
      token: TOKEN,
    });
    expect(names(job).indexOf("Make the app's token")).toBeLessThan(
      names(job).indexOf("Checkout the default branch"),
    );
    expect(job.concurrency).toEqual({
      group: "factory-poller-updates",
      "cancel-in-progress": false,
    });
  });

  it("commits as the app's bot, then opens the update's pull request with the app's token", () => {
    const open = step(jobs.updates!, "Open the pull request");
    expect(open.env).toEqual({
      GH_TOKEN: TOKEN,
      APP_SLUG: "${{ steps.app.outputs.app-slug }}",
    });
    const { dir, calls } = sandbox({ gh: "echo 4242", git: "", factory: "" });

    const r = runScript(open.run!, dir, {
      APP_SLUG: "software-factory-for-acme",
    });
    expect(r.status).toBe(0);
    expect(calls()).toEqual([
      "gh api /users/software-factory-for-acme[bot] --jq .id",
      "git config --global user.name software-factory-for-acme[bot]",
      "git config --global user.email 4242+software-factory-for-acme[bot]@users.noreply.github.com",
      "factory update --pull-requests",
    ]);
  });
});
