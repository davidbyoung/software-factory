// The factory's own workflows, which a repository's two short files call:
// run.yml, review.yml, and session.yml, read as YAML, and the scripts of
// their steps run for real.
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { SESSION_MINUTES } from "../src/config.mts";
import { POLLER_FILE, pollerWorkflow } from "../src/workflow-files.mts";

type Step = {
  id?: string;
  name: string;
  uses?: string;
  if?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
  "working-directory"?: string;
};
type Job = {
  name: string;
  if?: string;
  uses?: string;
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
    };
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
const sessionJob = session.jobs.session!;

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
    expect(run.on.workflow_call.secrets).toEqual(
      Object.fromEntries(
        [
          "build-token",
          "board-token",
          "automerge-token",
          "app-key",
          "signing-key",
          "claude-token",
          "claude-api-key",
          "extra",
        ].map((name) => [name, { required: false }]),
      ),
    );
    for (const file of [review, session]) {
      expect(file.on.workflow_call.secrets).toHaveProperty("app-key");
      for (const secret of Object.values(file.on.workflow_call.secrets!))
        expect(secret.required).toBe(false);
    }
  });

  it("defaults each session's minutes to the settings' default, and its job's limit to ten over", () => {
    const inputs = run.on.workflow_call.inputs!;
    for (const [kind, minutes] of Object.entries(SESSION_MINUTES)) {
      expect(inputs[`${kind}-minutes`]!.default).toBe(minutes);
      expect(inputs[`${kind}-limit`]!.default).toBe(minutes + 10);
    }
  });

  it("gives the workflow's own token only reading the code unless a job asks for more", () => {
    expect(run.permissions).toEqual({ contents: "read" });
    expect(review.permissions).toEqual({ contents: "read" });
    expect(session.permissions).toEqual({
      contents: "read",
      "pull-requests": "read",
    });
  });
});

const truthy = (v: unknown) => v !== "" && v !== false && v != null;

/** What a GitHub Actions expression comes to, evaluated as GitHub does for
 * what the workflows use: `==`, `!=`, `&&`, `||`, `!`, parentheses, text in
 * single quotes, a path into the contexts, and `contains`, `format`, and
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
      return (left === primary()) === equal;
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

/** The expression a value written as `${{ ... }}` holds. */
const inside = (value: unknown) =>
  /^\$\{\{([\s\S]*)\}\}$/.exec(String(value))![1]!;

describe("which job an event starts", () => {
  const EVERY_PART = "review board auto-merge poller dependabot";
  const pull = (o: { login?: string; from?: string } = {}) => ({
    number: 7,
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
      ["verdict", "merge-policy", "board"],
    ],
    [
      "a push to a pull request",
      target("synchronize"),
      ["verdict", "merge-policy"],
    ],
    [
      "a pull request marked ready",
      target("ready_for_review"),
      ["verdict", "merge-policy", "board"],
    ],
    ["a pull request made a draft", target("converted_to_draft"), ["board"]],
    ["a pull request closed", target("closed"), ["board"]],
    [
      "the override label added",
      target("labeled", { label: { name: "verdict-override" } }),
      ["verdict"],
    ],
    ["another label added", target("labeled", { label: { name: "bug" } }), []],
    [
      "a pull request of Dependabot's opened",
      { ...target("opened"), pull_request: pull({ login: "dependabot[bot]" }) },
      ["verdict"],
    ],
    [
      "a fork's pull request opened",
      { ...target("opened"), pull_request: pull({ from: "mallory/site" }) },
      ["verdict"],
    ],
    [
      "the pull request's own workflow finishing",
      { name: "workflow_run", workflow_run: { event: "pull_request" } },
      ["verdict"],
    ],
    [
      "another workflow of that name finishing on a push",
      { name: "workflow_run", workflow_run: { event: "push" } },
      [],
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
    [{ job: "conflicts" }, ["conflicts"]],
    [{ job: "dependencies" }, ["dependencies"]],
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

  it("takes the override label's name from what the repository's file passes", () => {
    const renamed = target("labeled", { label: { name: "ship it" } });
    expect(started(renamed, { "override-label": "ship it" })).toEqual([
      "verdict",
    ]);
    expect(started(renamed)).toEqual([]);
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

  it.each(["check", "verdict", "merge-policy", "board", "poller", "enroll"])(
    "%s checks out the default branch, never the pull request, and installs the factory before it runs it",
    (name) => {
      const job = jobs[name]!;
      const checkout = job.steps![0]!;
      expect(checkout.uses).toBe("actions/checkout@v7");
      expect(checkout.with).toBeUndefined();
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
    expect(post.run).toBe("factory review verdict");
    expect(post.env).toEqual({ GH_TOKEN: "${{ github.token }}" });
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
    expect(step(job, "Read the repository").env).toEqual({
      GH_TOKEN: "${{ github.token }}",
    });
    expect(step(job, "Write the board").env).toEqual({
      GH_TOKEN: "${{ steps.app.outputs.token || secrets.board-token }}",
    });
    expect(job.concurrency).toEqual({
      group: "factory-board-sync",
      "cancel-in-progress": false,
    });
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
    expect(step(review.jobs.check!, "Install the factory").run).toBe(install);
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

  it("is the same script in the board sync, the poller, and the review", () => {
    for (const job of [run.jobs.board!, run.jobs.poller!, review.jobs.review!])
      expect(step(job, "Take the repository's own secrets").run).toBe(take.run);
  });
});

describe("a session", () => {
  it("runs its steps in this order", () => {
    expect(names(sessionJob)).toEqual([
      "Checkout the default branch",
      "Read what the repository installs with",
      "Set up Node",
      "Install the factory",
      "Check whether there is work, then the tokens",
      "Sign in as the app",
      "Take the repository's own secrets",
      "Install the repository's dependencies",
      "Run the build's setup commands",
      "Set git's name and email",
      "Set up commit signing",
      "Install Claude Code",
      "Record the commit the session starts on",
      "Run the session",
      "Put the checkout back on the commit the session started on",
      "Release the claim if no pull request was opened",
      "Show how the app's token was renewed",
    ]);
  });

  it("checks out the default branch with full history", () => {
    expect(sessionJob.steps![0]!.with).toMatchObject({
      ref: "${{ github.event.repository.default_branch }}",
      "fetch-depth": 0,
    });
  });

  it("asks whether there is work with the workflow's own token, before any step reads the build token", () => {
    const gate = step(
      sessionJob,
      "Check whether there is work, then the tokens",
    );
    expect(gate.env).toMatchObject({
      GH_TOKEN: "${{ github.token }}",
      FACTORY_BUILD_TOKEN_SET: "${{ secrets.build-token != '' }}",
      FACTORY_APP_KEY_SET:
        "${{ secrets.app-key != '' && vars.FACTORY_APP_CLIENT_ID != '' }}",
      FACTORY_CLAUDE_SET:
        "${{ secrets.claude-token != '' || secrets.claude-api-key != '' }}",
    });
    expect(gate.run).toContain('factory session ready "$KIND" $ARGS');
    const after = sessionJob.steps!.slice(
      names(sessionJob).indexOf(gate.name) + 1,
    );
    for (const s of after.filter(
      (s) => !s.name.startsWith("Release the claim"),
    ))
      expect(s.if).toContain("steps.gate.outputs.ran == 'true'");
  });

  it("is bounded by the limit it is given, and stops the session with the shell at its minutes", () => {
    expect(sessionJob["timeout-minutes"]).toBe("${{ inputs.limit }}");
    const s = step(sessionJob, "Run the session");
    expect(s.env!.MINUTES).toBe("${{ inputs.minutes }}");
    expect(s.run).toContain('timeout --kill-after=30s "${MINUTES}m" claude');
    expect(s.env!.FACTORY_UNATTENDED).toBe("1");
  });

  it("runs npm ci only where the repository has a package-lock.json, and never twice in the factory's own", () => {
    expect(
      step(sessionJob, "Install the repository's dependencies"),
    ).toMatchObject({
      if: "steps.gate.outputs.ran == 'true' && steps.node.outputs.lock == 'true' && steps.install.outputs.own != 'true'",
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
    ).toBe("file=package.json\nlock=true\n");
    expect(step(sessionJob, "Set up Node").with).toMatchObject({
      "node-version-file": "${{ steps.node.outputs.file }}",
      "node-version": "${{ steps.node.outputs.file == '' && '22' || '' }}",
    });
  });

  it("runs each commands.build-setup command of the settings, in order, and stops at the first that fails", () => {
    const setup = step(sessionJob, "Run the build's setup commands").run!;
    const runSetup = (commands: string[]) => {
      const { dir } = sandbox({
        factory:
          '[ "$*" = "config get commands.build-setup" ] || exit 1\n' +
          (commands.length
            ? `printf '%s\\n' ${commands.map((c) => `'${c}'`).join(" ")}`
            : ":"),
      });
      return runScript(setup, dir);
    };
    const ok = runSetup(["echo first", "echo second"]);
    expect(ok.status).toBe(0);
    expect(ok.stdout.split("\n").filter((l) => !l.startsWith("::"))).toEqual([
      "first",
      "second",
      "",
    ]);
    expect(runSetup([])).toMatchObject({ status: 0, stdout: "" });
    const failed = runSetup(["echo first", "false", "echo third"]);
    expect(failed.status).not.toBe(0);
    expect(failed.stdout).not.toContain("third");
  });

  it("signs with the key in a file only its owner can read, and prints none of it", () => {
    const signing = step(sessionJob, "Set up commit signing").run!;
    const { dir } = sandbox();
    const r = runScript(signing, dir, { SIGNING_KEY_INPUT: "PRIVATE KEY" });
    expect([r.status, r.stdout]).toEqual([0, ""]);
    const file = join(dir, "factory-signing-key");
    expect(readFileSync(file, "utf8")).toBe("PRIVATE KEY\n");
    expect(statSync(file).mode & 0o777).toBe(0o600);
    const config = readFileSync(join(dir, ".gitconfig"), "utf8");
    expect(config).toContain("format = ssh");
    expect(config).toContain(`signingkey = ${file}`);
    expect(config).toContain("gpgsign = true");

    const without = sandbox();
    expect(
      runScript(signing, without.dir, { SIGNING_KEY_INPUT: "" }).stdout.trim(),
    ).toBe("No signing key: this build's commits will be unsigned.");
    expect(existsSync(join(without.dir, ".gitconfig"))).toBe(false);
  });

  it("names Claude as a commit's author and the token's owner as its committer", () => {
    const identity = step(sessionJob, "Set git's name and email");
    expect(identity.env).toEqual({
      GH_TOKEN:
        "${{ steps.app.outputs.slug == '' && secrets.build-token || '' }}",
      APP_SLUG: "${{ steps.app.outputs.slug }}",
    });
    const { dir } = sandbox({
      gh: `echo '{"login":"acme-builds","id":42,"name":null}'`,
    });
    expect(runScript(identity.run!, dir).status).toBe(0);
    const config = readFileSync(join(dir, ".gitconfig"), "utf8");
    expect(config).toContain("name = acme-builds");
    expect(config).toContain("email = 42+acme-builds@users.noreply.github.com");
    expect(config).toContain("name = Claude");
    expect(config).toContain("email = noreply@anthropic.com");
  });

  it("names the app's bot as the committer under the app, by its no-reply address, and Claude still as the author", () => {
    const identity = step(sessionJob, "Set git's name and email");
    const { dir, calls } = sandbox({ gh: "echo 4242" });

    const r = runScript(identity.run!, dir, {
      APP_SLUG: "software-factory-for-acme",
    });
    expect(r.status).toBe(0);
    expect(calls()).toEqual([
      "gh api /users/software-factory-for-acme[bot] --jq .id",
    ]);
    const config = readFileSync(join(dir, ".gitconfig"), "utf8");
    expect(config).toContain("name = software-factory-for-acme[bot]");
    expect(config).toContain(
      "email = 4242+software-factory-for-acme[bot]@users.noreply.github.com",
    );
    expect(config).toContain("name = Claude");
    expect(config).toContain("email = noreply@anthropic.com");
  });

  it("signs nothing under the app, whatever the signing key holds, and says so", () => {
    const signing = step(sessionJob, "Set up commit signing");
    expect(signing.env).toEqual({
      SIGNING_KEY_INPUT: "${{ secrets.signing-key }}",
      APP_SLUG: "${{ steps.app.outputs.slug }}",
    });
    const { dir } = sandbox();

    const r = runScript(signing.run!, dir, {
      SIGNING_KEY_INPUT: "PRIVATE KEY",
      APP_SLUG: "software-factory-for-acme",
    });
    expect([r.status, r.stdout]).toEqual([
      0,
      "The app is the committer: this build's commits will be unsigned.\n",
    ]);
    expect(existsSync(join(dir, "factory-signing-key"))).toBe(false);
    expect(existsSync(join(dir, ".gitconfig"))).toBe(false);
  });

  it("gives the session one Claude credential: the subscription's when both are set, and neither input's own variable", () => {
    const script = step(sessionJob, "Run the session").run!;
    const seen = (env: Record<string, string>) => {
      const { dir } = sandbox({
        claude:
          'echo "oauth=${CLAUDE_CODE_OAUTH_TOKEN-none} key=${ANTHROPIC_API_KEY-none} inputs=${OAUTH_TOKEN_INPUT-none},${API_KEY_INPUT-none}" > "$RUNNER_TEMP/seen"\necho "{}"',
      });
      const r = runScript(script, dir, {
        MINUTES: "1",
        PROMPT: "p",
        MODEL: "",
        ...env,
      });
      expect(r.status).toBe(0);
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

  it("puts the checkout back on the commit it started on, whether or not the session failed", () => {
    const back = step(
      sessionJob,
      "Put the checkout back on the commit the session started on",
    );
    expect(back.if).toBe("always() && steps.gate.outputs.ran == 'true'");
    const dir = mkdtempSync(join(tmpdir(), "factory-restore-"));
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
    git("init", "-q", "-b", "main");
    git(
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@t",
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      "one",
    );
    const start = git("rev-parse", "HEAD");
    writeFileSync(join(dir, "factory-start-commit"), `${start}\n`);
    git("switch", "-q", "-c", "work");
    git(
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@t",
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      "two",
    );
    expect(runScript(back.run!, dir).status).toBe(0);
    expect(git("rev-parse", "HEAD")).toBe(start);
  });

  it("releases a build's claim with the build token, whatever happened, once the factory was installed", () => {
    expect(
      step(sessionJob, "Release the claim if no pull request was opened"),
    ).toMatchObject({
      if: "always() && inputs.end-ticket != '' && steps.install.outputs.installed == 'true'",
      env: {
        GH_TOKEN:
          "${{ steps.app.outputs.slug == '' && secrets.build-token || '' }}",
        TICKET: "${{ inputs.end-ticket }}",
      },
      run: 'factory ticket end "$TICKET"',
    });
  });
});

describe("the four jobs that run a session", () => {
  const SESSIONS: [string, string, string, string][] = [
    ["build", "build", "build", "factory-build"],
    ["answer", "review", "review", "factory-address-review"],
    ["conflicts", "conflicts", "conflicts", "factory-resolve-conflicts"],
    ["dependencies", "deps", "dependencies", "factory-deps"],
  ];

  it.each(SESSIONS)(
    "%s calls session.yml for a %s session, with the settings' minutes and limit and the skill's name",
    (name, kind, minutes, skill) => {
      const job = run.jobs[name]!;
      expect(job.uses).toBe("./.github/workflows/session.yml");
      expect(job.with).toMatchObject({
        kind,
        minutes: `\${{ inputs.${minutes}-minutes }}`,
        limit: `\${{ inputs.${minutes}-limit }}`,
      });
      expect(job.with!.prompt).toContain(skill);
      expect(job.with!.prompt).toContain(
        "Use American English and the Oxford comma.",
      );
      expect(job.secrets).toEqual({
        "build-token": "${{ secrets.build-token }}",
        "app-key": "${{ secrets.app-key }}",
        "claude-token": "${{ secrets.claude-token }}",
        "claude-api-key": "${{ secrets.claude-api-key }}",
        "signing-key": "${{ secrets.signing-key }}",
        extra: "${{ secrets.extra }}",
      });
      expect(job.permissions).toEqual({
        contents: "read",
        "pull-requests": "read",
      });
    },
  );

  it("ends a build's claim, and no other session's", () => {
    expect(run.jobs.build!.with!["end-ticket"]).toBe("${{ inputs.ticket }}");
    for (const name of ["answer", "conflicts", "dependencies"])
      expect(run.jobs[name]!.with).not.toHaveProperty("end-ticket");
  });

  it("gives the review's check the pull request's and the review's numbers, from the event or from a run by hand", () => {
    expect(run.jobs.answer!.with!["check-args"]).toBe(
      "${{ github.event.pull_request.number || inputs.pr }} ${{ github.event.review.id || inputs.review }}",
    );
  });

  it("keeps one sweep and one dependency run waiting, cancels none, and sets no limit on answers", () => {
    expect(run.jobs.conflicts!.concurrency).toEqual({
      group: "factory-conflicts",
      "cancel-in-progress": false,
    });
    expect(run.jobs.dependencies!.concurrency).toEqual({
      group: "factory-deps",
      "cancel-in-progress": false,
    });
    expect(run.jobs.answer!.concurrency).toBeUndefined();
    expect(run.jobs.build!.concurrency).toBeUndefined();
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
    ["review.yml's check", review.jobs.check!],
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
      expect(make.with).toEqual({
        "client-id": "${{ vars.FACTORY_APP_CLIENT_ID }}",
        "private-key": "${{ secrets.app-key }}",
        owner: "${{ github.repository_owner }}",
        repositories: "${{ steps.repositories.outputs.names }}",
      });
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
    const job = review.jobs.dependabot!;
    expect(names(job)).toEqual([
      "Read the update",
      "Check whether the app's key reaches the run",
      MAKE,
      SAY,
      "Enable auto-merge",
    ]);
    const check = step(job, "Check whether the app's key reaches the run");
    expect(check).toMatchObject({ id: "repositories", env: list.env });
    expect(step(job, MAKE)).toEqual(step(review.jobs.check!, MAKE));
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

  it.each([...JOBS, ["review.yml's dependabot", review.jobs.dependabot!]] as [
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
      review.jobs.dependabot!,
      "Enable auto-merge",
      "GH_TOKEN",
      "automerge-token",
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
                !v.includes("steps.app.outputs.slug == '' && secrets.") &&
                !v.includes("secrets.app-key == ''"),
            )
            .map((v) => `${job.name}: ${s.name}: ${v}`),
        ),
      ),
    );

    expect(found).toEqual([]);
  });

  it.each<[string, Job]>([
    ["a session", sessionJob],
    ["the updates' job", run.jobs.updates!],
  ])(
    "%s checks out with the workflow's own token under the app, and with the build token without it",
    (_, job) => {
      const token = (
        secrets: Record<string, string>,
        vars: Record<string, string>,
      ) =>
        valueOf(inside(job.steps![0]!.with!.token), {
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
    },
  );

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

describe("a session under the organization's app, whose token lasts an hour", () => {
  const SIGN_IN = "Sign in as the app";
  const signIn = step(sessionJob, SIGN_IN);
  const REACHES = {
    FACTORY_APP_CLIENT_ID: "Iv23client",
    FACTORY_APP_PRIVATE_KEY: "PRIVATE KEY",
  };
  /** The steps that act on the code host as whoever builds. */
  const ACTING = [
    "Set git's name and email",
    "Run the session",
    "Release the claim if no pull request was opened",
  ];
  const context = (o: { app: boolean }) => ({
    secrets: { "app-key": o.app ? "key" : "", "build-token": "a person's" },
    vars: { FACTORY_APP_CLIENT_ID: o.app ? "Iv23client" : "" },
    steps: {
      gate: { outputs: { ran: "true" } },
      app: { outputs: { slug: o.app ? "software-factory-for-acme" : "" } },
    },
    github: { token: "the workflow's" },
  });

  it("hands the app's key to one step alone, and only compares it anywhere else", () => {
    const held = sessionJob.steps!.flatMap((s) =>
      Object.entries({ ...s.env, ...s.with })
        .filter(([, value]) =>
          /secrets\.app-key(?! [!=]= '')/.test(String(value)),
        )
        .map(([name]) => `${s.name}: ${name}`),
    );

    expect(held).toEqual([`${SIGN_IN}: FACTORY_APP_PRIVATE_KEY`]);
    expect(signIn.env).toEqual({
      FACTORY_APP_CLIENT_ID: "${{ vars.FACTORY_APP_CLIENT_ID }}",
      FACTORY_APP_PRIVATE_KEY: "${{ secrets.app-key }}",
    });
  });

  it("signs in once there is work, before any step puts a token in the environment", () => {
    expect(signIn.id).toBe("app");
    const order = names(sessionJob);
    expect(order.indexOf(SIGN_IN)).toBe(
      order.indexOf("Check whether there is work, then the tokens") + 1,
    );
    expect(evaluate(signIn.if!, context({ app: true }))).toBe(true);
    expect(evaluate(signIn.if!, context({ app: false }))).toBe(false);
  });

  it("signs in once in the foreground, then leaves the renewal running behind the steps that follow, its output in a file", () => {
    const { dir, calls } = sandbox({
      factory: [
        'if [ "$3" = "--keep" ]; then',
        '  cat "$RUNNER_TEMP/go" > /dev/null',
        '  echo "renewing with ${FACTORY_APP_PRIVATE_KEY:+the key}"',
        '  echo done > "$RUNNER_TEMP/done"',
        "else",
        '  echo "slug=software-factory-for-acme" >> "$GITHUB_OUTPUT"',
        "fi",
      ].join("\n"),
    });
    execFileSync("mkfifo", [join(dir, "go"), join(dir, "done")]);

    const r = spawnSync("bash", ["-eo", "pipefail", "-c", signIn.run!], {
      cwd: dir,
      env: {
        PATH: `${join(dir, "bin")}:${process.env.PATH}`,
        HOME: dir,
        RUNNER_TEMP: dir,
        GITHUB_OUTPUT: join(dir, "output"),
        ...REACHES,
      },
      encoding: "utf8",
      timeout: 20_000,
    });
    // The renewal waits for this, so it outlives the step's own shell.
    writeFileSync(join(dir, "go"), "");
    readFileSync(join(dir, "done"), "utf8");

    expect(r.status).toBe(0);
    expect(calls()).toEqual([
      "factory session token",
      "factory session token --keep",
    ]);
    expect(readFileSync(join(dir, "output"), "utf8")).toBe(
      "slug=software-factory-for-acme\n",
    );
    expect(readFileSync(join(dir, "factory-token.log"), "utf8")).toBe(
      "renewing with the key\n",
    );
  });

  it("fails the step, and leaves nothing running, when the first sign-in fails", () => {
    const { dir, calls } = sandbox({ factory: "exit 1" });

    expect(runScript(signIn.run!, dir, REACHES).status).toBe(1);
    expect(calls()).toEqual(["factory session token"]);
  });

  it("does nothing when the key does not reach the run", () => {
    const { dir, calls } = sandbox({ factory: "" });

    const r = runScript(signIn.run!, dir, {
      ...REACHES,
      FACTORY_APP_PRIVATE_KEY: "",
    });
    expect([r.status, r.stdout, calls()]).toEqual([0, "", []]);
  });

  it.each(ACTING)(
    "%s reads the CLI's renewed sign-in under the app, with no token in its environment, and a person's token without it",
    (name) => {
      const token = inside(step(sessionJob, name).env!.GH_TOKEN);

      expect(valueOf(token, context({ app: true }))).toBe("");
      expect(valueOf(token, context({ app: false }))).toBe("a person's");
    },
  );

  it("makes no token that is made once, and gives no step but those a token of anyone's", () => {
    expect(JSON.stringify(sessionJob)).not.toContain("create-github-app-token");
    const given = sessionJob
      .steps!.filter((s) =>
        /secrets\.build-token(?! != '')/.test(
          JSON.stringify({ ...s.env, ...s.with }),
        ),
      )
      .map((s) => s.name);

    expect(given).toEqual(["Checkout the default branch", ...ACTING]);
  });

  it("stores no credential at the checkout under the app, so git asks the CLI, and stores the build token without it", () => {
    const checkout = sessionJob.steps![0]!.with!;
    const stored = (o: { app: boolean }) =>
      valueOf(inside(checkout["persist-credentials"]), context(o));

    expect(stored({ app: true })).toBe(false);
    expect(stored({ app: false })).toBe(true);
    expect(valueOf(inside(checkout.token), context({ app: false }))).toBe(
      "a person's",
    );
  });

  it("prints what the renewal logged as the job's last step, whatever happened", () => {
    const show = sessionJob.steps!.at(-1)!;
    expect(show.name).toBe("Show how the app's token was renewed");
    expect(show.if).toContain("always()");
    expect(
      evaluate(show.if!.replace("always() && ", ""), context({ app: true })),
    ).toBe(true);
    expect(
      evaluate(show.if!.replace("always() && ", ""), context({ app: false })),
    ).toBe(false);
    const { dir } = sandbox();
    writeFileSync(
      join(dir, "factory-token.log"),
      "2026-11-23T12:45:00.000Z Renewed the app's token.\n",
    );

    expect(runScript(show.run!, dir).stdout).toBe(
      "2026-11-23T12:45:00.000Z Renewed the app's token.\n",
    );
  });
});

describe("the review and its verdict, which stay the workflow's own", () => {
  it.each<[string, Job]>([
    ["review.yml's review", review.jobs.review!],
    ["run.yml's verdict", run.jobs.verdict!],
  ])(
    "%s makes no token of the app's, and reads neither its key nor a person's token",
    (_, job) => {
      expect(names(job)).not.toContain("Make the app's token");
      expect(JSON.stringify(job)).not.toMatch(
        /steps\.app\.|app-key|(?:build|board|automerge)-token/,
      );
    },
  );

  it("hands the review's action and the verdict's command the workflow's own token", () => {
    expect(step(review.jobs.review!, "Review").with!.github_token).toBe(
      "${{ github.token }}",
    );
    expect(step(run.jobs.verdict!, "Post the verdict").env).toEqual({
      GH_TOKEN: "${{ github.token }}",
    });
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

  it("checks the files on every pull request, against the base commit's lock, with the app's token or the build token only for one from this repository", () => {
    const job = jobs.check!;
    expect(job.if).toBeUndefined();
    const compare = step(job, "Compare the copies with their source");
    expect(compare.env!.BASE).toBe("${{ github.event.pull_request.base.sha }}");
    const token = (from: string, app: string) =>
      valueOf(inside(compare.env!.GH_TOKEN), {
        github: {
          repository: "acme/site",
          event: { pull_request: { head: { repo: { full_name: from } } } },
        },
        steps: { app: { outputs: { token: app } } },
        secrets: { "build-token": "person" },
      });
    expect(token("acme/site", "app")).toBe("app");
    expect(token("acme/site", "")).toBe("person");
    expect(token("mallory/site", "app")).toBe("");
    expect(step(job, "List the repositories the app's token is for").if).toBe(
      "github.event.pull_request.head.repo.full_name == github.repository",
    );
    expect(compare.run).toContain('factory sync --check --against "$BASE"');
    expect(step(job, "Check the settings").run).toBe("factory config check");
  });

  it("runs the review only where it is on, for a ready pull request from this repository that is not Dependabot's", () => {
    expect(jobs.review!.if!.replace(/\s+/g, " ")).toBe(
      "contains(format(' {0} ', inputs.parts), ' review ') && github.event.pull_request.draft == false && github.event.pull_request.head.repo.full_name == github.repository && github.event.pull_request.user.login != 'dependabot[bot]'",
    );
    expect(jobs.review!.name).toBe("Claude review");
    expect(jobs.review!.concurrency).toEqual({
      group: "claude-review-${{ github.event.pull_request.number }}",
      "cancel-in-progress": true,
    });
  });

  it("restores the review's instructions from the base commit before the review reads them", () => {
    const order = names(jobs.review!);
    expect(
      order.indexOf("Read the review instructions from the base commit"),
    ).toBeLessThan(order.indexOf("Review"));
    expect(order.indexOf("List the tools the review may use")).toBeLessThan(
      order.indexOf("Review"),
    );
  });

  it("lists the tools and reads the tickets with the base commit's factory and lock, whatever the pull request's lock names", () => {
    for (const name of [
      "List the tools the review may use",
      "Read the tickets the pull request builds",
      "Record the review's cost",
    ]) {
      const s = step(jobs.review!, name);
      expect(s.env).toMatchObject({
        FACTORY_VERSION: "${{ steps.base.outputs.version }}",
        FACTORY_LOCK: "${{ runner.temp }}/factory.lock",
      });
      expect(s["working-directory"]).toBe(
        "${{ steps.base.outputs.dir || github.workspace }}",
      );
    }
  });

  it("installs the version the base commit's lock names, or the pull request's where the base has none", () => {
    const install = step(
      jobs.review!,
      "Install the base commit's factory",
    ).run!;
    const repo = (base: string | null, head: string) => {
      const { dir, calls } = sandbox({ npm: "" });
      const git = (...args: string[]) =>
        execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
      const commit = (version: string | null) => {
        if (version !== null) {
          mkdirSync(join(dir, ".claude"), { recursive: true });
          writeFileSync(
            join(dir, ".claude/factory.lock"),
            `version: ${version}\n`,
          );
          git("add", ".claude");
        }
        git(
          "-c",
          "user.name=t",
          "-c",
          "user.email=t@t",
          "commit",
          "-q",
          "--allow-empty",
          "-m",
          "c",
        );
        return git("rev-parse", "HEAD");
      };
      git("init", "-q", "-b", "main");
      const sha = commit(base);
      commit(head);
      const r = runScript(install, dir, { BASE: sha });
      return {
        status: r.status,
        npm: calls().filter((c) => c.startsWith("npm")),
        output: readFileSync(join(dir, "output"), "utf8"),
      };
    };
    expect(repo("0.2.0", "0.3.0")).toEqual({
      status: 0,
      npm: [
        "npm install --global --no-audit --no-fund @davidbyoung/software-factory@0.2.0",
      ],
      output: "version=0.2.0\ninstalled=true\n",
    });
    expect(repo(null, "0.3.0").output).toBe("version=0.3.0\ninstalled=true\n");
  });

  it("gives the review one Claude credential, the subscription's when both are set", () => {
    const s = step(jobs.review!, "Review");
    expect(s.with).toMatchObject({
      claude_code_oauth_token: "${{ secrets.claude-token }}",
      anthropic_api_key:
        "${{ !secrets.claude-token && secrets.claude-api-key || '' }}",
      github_token: "${{ github.token }}",
    });
  });

  it("turns auto-merge on only for Dependabot's own pull request, never a major, and never one that names the factory", () => {
    const job = jobs.dependabot!;
    expect(job.if!.replace(/\s+/g, " ")).toBe(
      "contains(format(' {0} ', inputs.parts), ' dependabot ') && github.actor == 'dependabot[bot]'",
    );
    const enable = step(job, "Enable auto-merge");
    expect(enable.if!.replace(/\s+/g, " ")).toBe(
      "steps.meta.outputs.update-type != 'version-update:semver-major' && !contains(steps.meta.outputs.dependency-names, 'davidbyoung/software-factory')",
    );
    expect(enable.env!.GH_TOKEN).toBe(
      "${{ steps.app.outputs.token || secrets.automerge-token }}",
    );
    expect(job.permissions).toEqual({
      contents: "read",
      "pull-requests": "read",
    });
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
      expect(token.with).toEqual({
        "client-id": "${{ vars.FACTORY_APP_CLIENT_ID }}",
        "private-key": "${{ secrets.app-key }}",
        owner: "${{ github.repository_owner }}",
      });
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
