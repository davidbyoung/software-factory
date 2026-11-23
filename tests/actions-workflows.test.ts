// The four workflows that run unattended and the agent action they call,
// read as files, and the action's scripts run for real.
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

const PACKAGE = ".";
type Step = {
  id?: string;
  name: string;
  uses?: string;
  if?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
};
type Job = {
  if?: string;
  "timeout-minutes": number;
  steps: Step[];
};
type Workflow = {
  on: Record<string, unknown>;
  concurrency?: { group: string; "cancel-in-progress": boolean };
  jobs: Record<string, Job>;
};
type Action = {
  outputs: Record<string, { value: string }>;
  runs: { steps: Step[] };
};

const read = (name: string) =>
  load(readFileSync(`${PACKAGE}/workflows/${name}`, "utf8")) as Workflow;
const action = load(
  readFileSync(`${PACKAGE}/actions/factory-agent/action.yml`, "utf8"),
) as Action;
const steps = action.runs.steps;
const step = (name: string) => steps.find((s) => s.name === name)!;
const agentOf = (w: Workflow) =>
  Object.values(w.jobs)[0].steps.find((s) =>
    s.uses?.endsWith("factory-agent"),
  )!;
const jobOf = (w: Workflow) => Object.values(w.jobs)[0];

const WORKFLOWS: [string, number, number][] = [
  ["factory-build.yml", 230, 240],
  ["factory-review.yml", 50, 60],
  ["factory-conflicts.yml", 110, 120],
  ["factory-deps.yml", 50, 60],
];

describe("the minutes and the job limits", () => {
  it.each(WORKFLOWS)(
    "%s passes %i minutes and limits its job to %i",
    (name, minutes, limit) => {
      const w = read(name);
      expect(agentOf(w).with!.minutes).toBe(minutes);
      expect(jobOf(w)["timeout-minutes"]).toBe(limit);
    },
  );

  it("stops the session with the shell after the minutes it was given", () => {
    const session = step("Run the session");
    expect(session.env!.MINUTES).toBe("${{ inputs.minutes }}");
    expect(session.run).toContain(
      'timeout --kill-after=30s "${MINUTES}m" claude',
    );
  });
});

describe("factory-build.yml's last step", () => {
  const build = jobOf(read("factory-build.yml"));
  const last = build.steps.at(-1)!;

  it("ends the claim with the build token, whatever happened, once the install succeeded", () => {
    expect(last.run).toBe(
      "npx --no-install factory ticket end ${{ inputs.ticket }}",
    );
    expect(last.env!.GH_TOKEN).toBe(
      "${{ secrets.FACTORY_BUILD_TOKEN || secrets.FACTORY_BOARD_TOKEN }}",
    );
    expect(last.if).toBe("always() && steps.agent.outputs.installed == 'true'");
  });

  it("reads the action's installed output, which the install step sets after npm ci", () => {
    expect(action.outputs.installed.value).toBe(
      "${{ steps.install.outputs.installed }}",
    );
    const install = step("Install dependencies");
    expect(install.id).toBe("install");
    expect(install.run!.indexOf("npm ci")).toBeLessThan(
      install.run!.indexOf('installed=true" >> "$GITHUB_OUTPUT"'),
    );
  });
});

describe("the action's setup commands", () => {
  const setup = step("Run the build's setup commands");

  /** The step's script, run with an `npx` that prints `commands` for
   * `factory config get commands.build-setup`, one to a line and nothing
   * at all for an empty list, as the command does, and fails on anything
   * else. */
  const runSetup = (commands: string[]) => {
    const dir = mkdtempSync(join(tmpdir(), "build-setup-"));
    mkdirSync(join(dir, "bin"));
    writeFileSync(
      join(dir, "bin", "npx"),
      [
        "#!/bin/bash",
        'if [ "$*" = "--no-install factory config get commands.build-setup" ]; then',
        commands.length > 0
          ? `  printf '%s\\n' ${commands.map((c) => `'${c}'`).join(" ")}`
          : "  :",
        "else",
        '  echo "no such setting: $*" >&2; exit 1',
        "fi",
      ].join("\n"),
      { mode: 0o755 },
    );
    const r = spawnSync("bash", ["-eo", "pipefail", "-c", setup.run!], {
      cwd: dir,
      env: {
        PATH: `${join(dir, "bin")}:${process.env.PATH}`,
        RUNNER_TEMP: dir,
      } as unknown as NodeJS.ProcessEnv,
      encoding: "utf8",
    });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
  };

  it("runs each commands.build-setup command of the settings, in order", () => {
    const r = runSetup(["echo first", "echo second"]);
    expect([r.status, r.stderr]).toEqual([0, ""]);
    expect(r.stdout.split("\n").filter((l) => !l.startsWith("::"))).toEqual([
      "first",
      "second",
      "",
    ]);
  });

  it("runs nothing, and passes, when commands.build-setup is not set or empty", () => {
    const r = runSetup([]);
    expect([r.status, r.stderr]).toEqual([0, ""]);
    expect(r.stdout).not.toContain("::group::");
    expect(r.stdout).toBe("");
  });

  it("stops the run at the first command that fails", () => {
    const r = runSetup(["echo first", "exit 3", "echo third"]);
    expect(r.status).toBe(3);
    expect(r.stdout).toContain("first");
    expect(r.stdout).not.toContain("third\n");
  });

  it("run before the session", () => {
    const names = steps.map((s) => s.name);
    expect(names).toContain(setup.name);
    expect(names.indexOf(setup.name)).toBeLessThan(
      names.indexOf("Run the session"),
    );
  });
});

describe("the action's session step", () => {
  it("sets FACTORY_UNATTENDED=1, which the permission hook answers for", () => {
    expect(step("Run the session").env).toMatchObject({
      FACTORY_UNATTENDED: "1",
    });
  });
});

describe("the action's log filter", () => {
  const script = step("Run the session").run!;
  const filter = /jq --unbuffered -r '([\s\S]*?)'\n/.exec(script)![1];
  const stream = [
    {
      type: "assistant",
      message: { content: [{ type: "text", text: "Editing." }] },
    },
    {
      type: "system",
      subtype: "permission_denied",
      tool_name: "Edit",
      tool_use_id: "t1",
      decision_reason_type: "mode",
      decision_reason:
        "Claude requested permissions to edit .claude/skills/x/SKILL.md",
      message: "denied",
    },
    {
      type: "result",
      subtype: "success",
      num_turns: 3,
      duration_ms: 120000,
      total_cost_usd: 0.5,
      permission_denials: [
        {
          tool_name: "Edit",
          tool_use_id: "t1",
          tool_input: { file_path: `.claude/skills/${"x".repeat(300)}.md` },
        },
      ],
    },
  ];
  const lines = spawnSync("jq", ["--unbuffered", "-r", filter], {
    input: stream.map((m) => JSON.stringify(m)).join("\n"),
    encoding: "utf8",
  }).stdout.split("\n");

  it("prints each denial as it happens, with the tool and the reason", () => {
    expect(lines).toContain(
      "Denied: Edit: Claude requested permissions to edit .claude/skills/x/SKILL.md",
    );
  });

  it("prints each of the result's denials after the turns and the cost, cut to 200 characters", () => {
    const finished = lines.findIndex((l) => l.startsWith("Finished (success)"));
    expect(finished).toBeGreaterThan(-1);
    const denial = lines[finished + 1];
    expect(denial.startsWith("Denied: Edit: .claude/skills/xxx")).toBe(true);
    expect(denial).toHaveLength("Denied: Edit: ".length + 200);
  });
});

describe("the action's only-if", () => {
  const gate = step("Check whether there is work");
  const later = steps.slice(steps.indexOf(gate) + 1);

  it("runs after npm ci and before the setup commands, with the build token", () => {
    const names = steps.map((s) => s.name);
    expect(names.indexOf(gate.name)).toBe(
      names.indexOf("Install dependencies") + 1,
    );
    expect(names.indexOf(gate.name)).toBeLessThan(
      names.indexOf("Run the build's setup commands"),
    );
    expect(gate.env).toMatchObject({
      GH_TOKEN: "${{ inputs.github-token }}",
      ONLY_IF: "${{ inputs.only-if }}",
    });
  });

  it("is tested by every later step", () => {
    expect(later.length).toBeGreaterThan(0);
    for (const s of later)
      expect(s.if).toContain("steps.gate.outputs.ran != 'false'");
    expect(gate.id).toBe("gate");
    expect(action.outputs.ran.value).toBe("${{ steps.gate.outputs.ran }}");
  });

  const runGate = (onlyIf: string) => {
    const dir = mkdtempSync(join(tmpdir(), "gate-"));
    const output = join(dir, "out");
    writeFileSync(output, "");
    const r = spawnSync("bash", ["-eo", "pipefail", "-c", gate.run!], {
      env: {
        PATH: process.env.PATH,
        ONLY_IF: onlyIf,
        GITHUB_OUTPUT: output,
      } as unknown as NodeJS.ProcessEnv,
      encoding: "utf8",
    });
    return {
      status: r.status,
      stdout: r.stdout,
      ran: readFileSync(output, "utf8"),
    };
  };

  it("prints what the command printed and Nothing to do, sets ran false, and ends successfully, when the command fails", () => {
    const r = runGate("echo no pull request conflicts; exit 1");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("no pull request conflicts");
    expect(r.stdout).toContain("Nothing to do.");
    expect(r.ran).toBe("ran=false\n");
  });

  it("fails the step with what the command printed when it exits 2", () => {
    const r = runGate("echo gh api: HTTP 401; exit 2");
    expect(r.status).not.toBe(0);
    expect(r.stdout).toContain("gh api: HTTP 401");
    expect(r.stdout).not.toContain("Nothing to do.");
    expect(r.ran).not.toContain("ran=false");
  });

  it("goes on when the command exits 0", () => {
    const r = runGate("echo 2 open");
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain("Nothing to do.");
    expect(r.ran).toBe("ran=true\n");
  });

  it("goes on with no command", () => {
    expect(runGate("").ran).toBe("ran=true\n");
  });
});

describe("the action ends on the commit it started on", () => {
  const record = step("Record the commit the session starts on");
  const restore = step(
    "Put the checkout back on the commit the session started on",
  );

  it("records the commit before the session and restores it after, whether or not the session failed", () => {
    const names = steps.map((s) => s.name);
    expect(names.indexOf(record.name)).toBeLessThan(
      names.indexOf("Run the session"),
    );
    expect(names.indexOf(restore.name)).toBeGreaterThan(
      names.indexOf("Run the session"),
    );
    expect(restore.if).toMatch(/^always\(\)/);
    expect(restore.run).toContain("git checkout --force --detach");
  });

  it("puts a repository whose branch the session switched back on the first commit, detached", () => {
    const dir = mkdtempSync(join(tmpdir(), "restore-"));
    const repo = join(dir, "repo");
    const temp = join(dir, "temp");
    mkdirSync(repo);
    mkdirSync(temp);
    const env = {
      PATH: process.env.PATH,
      HOME: dir,
      GIT_CONFIG_NOSYSTEM: "1",
      RUNNER_TEMP: temp,
    } as unknown as NodeJS.ProcessEnv;
    const sh = (script: string) =>
      execFileSync("bash", ["-eo", "pipefail", "-c", script], {
        cwd: repo,
        env,
        encoding: "utf8",
      });
    sh(
      "git init -q -b main && git config user.name T && git config user.email t@example.com && echo a > f && git add f && git commit -qm one",
    );
    const first = sh("git rev-parse HEAD").trim();
    sh(record.run!);
    sh("git switch -qc work && echo b > f && git commit -qam two");
    sh(restore.run!);

    expect(sh("git rev-parse HEAD").trim()).toBe(first);
    expect(sh("git branch --show-current").trim()).toBe("");
    expect(sh("cat f").trim()).toBe("a");
  });

  it.each([
    [
      "reinstalls the dependencies when the session changed the lock file",
      true,
    ],
    ["leaves them when it did not", false],
  ])("%s", (_name, changed) => {
    const dir = mkdtempSync(join(tmpdir(), "restore-"));
    const repo = join(dir, "repo");
    const temp = join(dir, "temp");
    const bin = join(dir, "bin");
    for (const d of [repo, temp, bin]) mkdirSync(d);
    // A stand-in npm that records each run.
    writeFileSync(
      join(bin, "npm"),
      `#!/bin/sh\necho "$@" >> "${join(dir, "npm-runs")}"\n`,
      { mode: 0o755 },
    );
    const env = {
      PATH: `${bin}:${process.env.PATH}`,
      HOME: dir,
      GIT_CONFIG_NOSYSTEM: "1",
      RUNNER_TEMP: temp,
    } as unknown as NodeJS.ProcessEnv;
    const sh = (script: string) =>
      execFileSync("bash", ["-eo", "pipefail", "-c", script], {
        cwd: repo,
        env,
        encoding: "utf8",
      });
    sh(
      "git init -q -b main && git config user.name T && git config user.email t@example.com && echo 1 > package-lock.json && echo a > f && git add . && git commit -qm one",
    );
    sh(record.run!);
    sh(
      changed
        ? "echo 2 > package-lock.json && git commit -qam two"
        : "echo b > f && git commit -qam two",
    );
    sh(restore.run!);

    const runs = join(dir, "npm-runs");
    expect(existsSync(runs) ? readFileSync(runs, "utf8").trim() : "").toBe(
      changed ? "ci" : "",
    );
  });
});

describe("factory-review.yml", () => {
  const w = read("factory-review.yml");
  const job = jobOf(w);

  it("starts on a submitted review, or by hand with the pull request's and the review's numbers", () => {
    expect(Object.keys(w.on)).toEqual([
      "pull_request_review",
      "workflow_dispatch",
    ]);
    expect(w.on.pull_request_review).toEqual({ types: ["submitted"] });
    expect(
      Object.keys((w.on.workflow_dispatch as { inputs: object }).inputs),
    ).toEqual(["pr", "review"]);
  });

  it("runs only for a pull request from this repository, and sets no limit on runs", () => {
    expect(job.if).toContain(
      "github.event.pull_request.head.repo.full_name == github.repository",
    );
    expect(w.concurrency).toBeUndefined();
  });

  it("checks with review-pending, and runs the owner-review section of factory-address-review", () => {
    expect(agentOf(w).with!["only-if"]).toBe(
      "npx --no-install factory pr review-pending ${{ github.event.pull_request.number || inputs.pr }} ${{ github.event.review.id || inputs.review }}",
    );
    expect(String(agentOf(w).with!.prompt)).toContain(
      'section "A run started by the owner\'s review"',
    );
  });

  it("checks out the default branch with full history and the build token", () => {
    expect(job.steps[0].with).toMatchObject({
      ref: "${{ github.event.repository.default_branch }}",
      "fetch-depth": 0,
    });
    expect(String(job.steps[0].with!.token)).toContain("FACTORY_BUILD_TOKEN");
  });
});

describe("factory-check.yml", () => {
  it("starts on a push to the one branch its trigger names, and on every pull request", () => {
    expect(read("factory-check.yml").on).toEqual({
      push: { branches: ["main"] },
      pull_request: null,
    });
  });
});

describe("factory-conflicts.yml", () => {
  const w = read("factory-conflicts.yml");

  // The source names main; `factory sync` writes the repository's default
  // branch in its place (`tests/sync.test.ts`).
  it("starts on a push to the one branch its trigger names, nightly at 09:00 UTC, and by hand", () => {
    expect(w.on).toEqual({
      push: { branches: ["main"] },
      schedule: [{ cron: "0 9 * * *" }],
      workflow_dispatch: null,
    });
  });

  it("runs a push's job only for the default branch", () => {
    expect(jobOf(w).if).toContain(
      "github.ref_name == github.event.repository.default_branch",
    );
    expect(jobOf(w).if).toContain("github.event_name != 'push'");
  });

  it("keeps one run waiting, and cancels none", () => {
    expect(w.concurrency).toEqual({
      group: "factory-conflicts",
      "cancel-in-progress": false,
    });
  });

  it("checks with pr conflicts and runs the sweep section", () => {
    expect(agentOf(w).with!["only-if"]).toBe(
      "npx --no-install factory pr conflicts",
    );
    expect(String(agentOf(w).with!.prompt)).toContain(
      'section "The conflict sweep"',
    );
  });
});

describe("factory-deps.yml", () => {
  const w = read("factory-deps.yml");

  it("starts at 01:00, 13:00, and 19:00 UTC, and by hand", () => {
    expect(w.on).toEqual({
      schedule: [{ cron: "0 1,13,19 * * *" }],
      workflow_dispatch: null,
    });
  });

  it("keeps one run waiting, and cancels none", () => {
    expect(w.concurrency).toEqual({
      group: "factory-deps",
      "cancel-in-progress": false,
    });
  });

  it("checks with deps --any and runs factory-deps", () => {
    expect(agentOf(w).with!["only-if"]).toBe(
      "npx --no-install factory deps --any",
    );
    expect(String(agentOf(w).with!.prompt)).toContain("factory-deps");
  });
});
