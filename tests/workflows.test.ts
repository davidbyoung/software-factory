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
          "signing-key",
          "claude-token",
          "claude-api-key",
          "extra",
        ].map((name) => [name, { required: false }]),
      ),
    );
    for (const file of [review, session])
      for (const secret of Object.values(file.on.workflow_call.secrets!))
        expect(secret.required).toBe(false);
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

describe("which job an event starts", () => {
  const { jobs } = run;
  const on = (job: string) => jobs[job]!.if!.replace(/\s+/g, " ");

  it("checks the files on a push only: a pull request's check is review.yml's", () => {
    expect(on("check")).toBe("github.event_name == 'push'");
  });

  it("records the verdict when the pull request's own workflow finishes, and on the pull request's events, a label only when it is the override", () => {
    expect(on("verdict")).toContain(
      "github.event_name == 'workflow_run' && github.event.workflow_run.event == 'pull_request'",
    );
    expect(on("verdict")).toContain(
      `contains(fromJSON('["opened", "reopened", "synchronize", "ready_for_review"]'), github.event.action)`,
    );
    expect(on("verdict")).toContain(
      "(github.event.action == 'labeled' || github.event.action == 'unlabeled') && github.event.label.name == inputs.override-label",
    );
  });

  it.each([
    ["merge-policy", " auto-merge "],
    ["board", " board "],
    ["poller", " poller "],
    ["dependencies", " dependabot "],
  ])("skips %s unless its part is on", (job, part) => {
    expect(on(job)).toMatch(
      new RegExp(
        `^contains\\(format\\(' \\{0\\} ', inputs\\.parts\\), '${part}'\\) &&`,
      ),
    );
  });

  it("starts the verdict, a build, an answer, the sweep, and updates whatever the parts", () => {
    for (const job of ["verdict", "build", "answer", "conflicts", "updates"])
      expect(on(job)).not.toContain("inputs.parts");
  });

  it("tells the schedules apart by their text, and takes any other for the poller", () => {
    expect(on("board")).toContain("github.event.schedule == '0 7 * * *'");
    expect(on("conflicts")).toContain("github.event.schedule == '0 9 * * *'");
    for (const job of ["dependencies", "updates"])
      expect(on(job)).toContain("github.event.schedule == '0 1,13,19 * * *'");
    expect(on("poller")).toContain(
      "github.event.schedule != '0 1,13,19 * * *' && github.event.schedule != '0 7 * * *' && github.event.schedule != '0 9 * * *'",
    );
  });

  it.each([
    ["board", "board"],
    ["poller", "poller"],
    ["answer", "review"],
    ["conflicts", "conflicts"],
    ["dependencies", "dependencies"],
    ["updates", "updates"],
  ])("starts %s by hand when the job asked for is %s", (job, asked) => {
    expect(on(job)).toContain(
      `github.event_name == 'workflow_dispatch' && inputs.job == '${asked}'`,
    );
  });

  it("starts a build by hand for the job build, or for a ticket alone", () => {
    expect(on("build")).toBe(
      "github.event_name == 'workflow_dispatch' && (inputs.job == 'build' || (inputs.job == '' && inputs.ticket != ''))",
    );
  });

  it("fails one job, naming it, for a job it does not have", () => {
    expect(on("unknown")).toBe(
      `github.event_name == 'workflow_dispatch' && inputs.job != '' && !contains(fromJSON('["build", "review", "conflicts", "dependencies", "updates", "board", "poller"]'), inputs.job)`,
    );
    const { dir } = sandbox();
    const r = runScript(jobs.unknown!.steps![0]!.run!, dir, { JOB: "polish" });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("::error::Unknown job polish.");
  });

  it("answers a review, and syncs the board, only for a pull request from this repository", () => {
    for (const job of ["answer", "board", "merge-policy"])
      expect(on(job)).toContain(
        "github.event.pull_request.head.repo.full_name == github.repository",
      );
  });

  it("sweeps on a push only to the default branch", () => {
    expect(on("conflicts")).toContain(
      "github.event_name == 'push' && github.ref_name == github.event.repository.default_branch",
    );
  });
});

describe("the jobs that run no session", () => {
  const { jobs } = run;

  it.each(["check", "verdict", "merge-policy", "board", "poller"])(
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

  it("classifies with the workflow's token, and turns auto-merge on only with the owner's", () => {
    const job = jobs["merge-policy"]!;
    expect(step(job, "Classify").env).toEqual({
      GH_TOKEN: "${{ github.token }}",
    });
    expect(step(job, "Turn auto-merge on or off").env!.GH_TOKEN).toBe(
      "${{ secrets.automerge-token }}",
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
      GH_TOKEN: "${{ secrets.board-token }}",
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
      env: { FACTORY_BOARD_TOKEN: "${{ secrets.board-token }}" },
    });
    expect(job.concurrency).toEqual({
      group: "factory-poller",
      "cancel-in-progress": false,
    });
  });

  it("opens the updates' pull requests with the build token, and passes with a line when there is none", () => {
    const job = jobs.updates!;
    const open = step(job, "Open the pull requests");
    expect(open.env!.GH_TOKEN).toBe("${{ secrets.build-token }}");
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
    ]);
  });

  it("checks out the default branch with full history and the build token", () => {
    expect(sessionJob.steps![0]!.with).toEqual({
      ref: "${{ github.event.repository.default_branch }}",
      "fetch-depth": 0,
      token: "${{ secrets.build-token || github.token }}",
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
      FACTORY_CLAUDE_SET:
        "${{ secrets.claude-token != '' || secrets.claude-api-key != '' }}",
    });
    expect(gate.run).toContain('factory session ready "$KIND" $ARGS');
    const after = sessionJob.steps!.slice(
      names(sessionJob).indexOf(gate.name) + 1,
    );
    for (const s of after.slice(0, -1))
      expect(s.if).toContain("steps.gate.outputs.ran == 'true'");
  });

  it("is bounded by the limit it is given, and stops the session with the shell at its minutes", () => {
    expect(sessionJob["timeout-minutes"]).toBe("${{ inputs.limit }}");
    const s = step(sessionJob, "Run the session");
    expect(s.env!.MINUTES).toBe("${{ inputs.minutes }}");
    expect(s.run).toContain('timeout --kill-after=30s "${MINUTES}m" claude');
    expect(s.env!.FACTORY_UNATTENDED).toBe("1");
    expect(s.env!.GH_TOKEN).toBe("${{ secrets.build-token }}");
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
    expect(identity.env).toEqual({ GH_TOKEN: "${{ secrets.build-token }}" });
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

  it("exports each Claude credential only when its secret is set, the subscription's first", () => {
    const script = step(sessionJob, "Run the session").run!;
    expect(script).toContain(
      'if [ -n "$OAUTH_TOKEN_INPUT" ]; then\n  export CLAUDE_CODE_OAUTH_TOKEN="$OAUTH_TOKEN_INPUT"\nelif [ -n "$API_KEY_INPUT" ]; then\n  export ANTHROPIC_API_KEY="$API_KEY_INPUT"\nfi',
    );
    expect(script).toContain("unset OAUTH_TOKEN_INPUT API_KEY_INPUT");
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
        GH_TOKEN: "${{ secrets.build-token }}",
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

describe("review.yml", () => {
  const { jobs } = review;

  it("checks the files on every pull request, against the base commit's lock, with the build token only for one from this repository", () => {
    const job = jobs.check!;
    expect(job.if).toBeUndefined();
    const compare = step(job, "Compare the copies with their source");
    expect(compare.env).toEqual({
      BASE: "${{ github.event.pull_request.base.sha }}",
      GH_TOKEN:
        "${{ github.event.pull_request.head.repo.full_name == github.repository && secrets.build-token || '' }}",
    });
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
    expect(enable.env!.GH_TOKEN).toBe("${{ secrets.automerge-token }}");
    expect(job.permissions).toEqual({
      contents: "read",
      "pull-requests": "read",
    });
  });
});
