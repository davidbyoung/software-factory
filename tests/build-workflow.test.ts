// The build workflow and the agent action it calls, read as files: what
// starts a build, what it may touch, and what the session gets.
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

const PACKAGE = ".";
type Step = {
  name: string;
  uses?: string;
  run?: string;
  with?: Record<string, string>;
  env?: Record<string, string>;
};
type Workflow = {
  "run-name": string;
  on: Record<string, { inputs: Record<string, unknown> }>;
  permissions: Record<string, string>;
  jobs: Record<
    string,
    { permissions?: unknown; "timeout-minutes": number; steps: Step[] }
  >;
};
type Action = {
  inputs: Record<string, { required: boolean }>;
  runs: { using: string; steps: Step[] };
};

const workflow = load(
  readFileSync(`${PACKAGE}/workflows/factory-build.yml`, "utf8"),
) as Workflow;
const action = load(
  readFileSync(`${PACKAGE}/actions/factory-agent/action.yml`, "utf8"),
) as Action;
const BUILD_TOKEN =
  "${{ secrets.FACTORY_BUILD_TOKEN || secrets.FACTORY_BOARD_TOKEN }}";

describe("workflows/factory-build.yml", () => {
  const [job] = Object.values(workflow.jobs);
  const checkout = job.steps[0];
  const agent = job.steps.find(
    (s) => s.uses === "./.github/actions/factory-agent",
  );

  it("starts only from a dispatch, taking only the ticket", () => {
    expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
    expect(Object.keys(workflow.on.workflow_dispatch.inputs)).toEqual([
      "ticket",
    ]);
  });

  it("takes the ticket's key as text, as the Run workflow form shows it", () => {
    expect(workflow.on.workflow_dispatch.inputs.ticket).toEqual({
      description: "The ticket's key, such as 12",
      required: true,
      type: "string",
    });
  });

  it("names each run Build # and the ticket", () => {
    expect(workflow["run-name"]).toBe("Build #${{ inputs.ticket }}");
  });

  it("may only read the repository with its own token", () => {
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(job.permissions).toBeUndefined();
  });

  // A local action is read from the checkout, so the checkout comes first.
  it("checks the repository out before it calls the action", () => {
    expect(checkout.uses).toMatch(/^actions\/checkout@/);
    expect(job.steps.indexOf(agent!)).toBeGreaterThan(0);
  });

  it("checks out the default branch with full history and the build token", () => {
    expect(checkout.with).toMatchObject({
      ref: "${{ github.event.repository.default_branch }}",
      "fetch-depth": 0,
    });
    expect(checkout.with!.token).toContain(
      "secrets.FACTORY_BUILD_TOKEN || secrets.FACTORY_BOARD_TOKEN",
    );
  });

  // The action's inputs are the contract the later workflows build on.
  it("passes the action its seven inputs, the minutes among them", () => {
    expect(agent!.with).toEqual({
      minutes: 230,
      prompt: expect.stringContaining(
        'invoke `factory-build` with "${{ inputs.ticket }}"',
      ),
      "github-token": BUILD_TOKEN,
      "claude-oauth-token": "${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}",
      "anthropic-api-key": "${{ secrets.ANTHROPIC_API_KEY }}",
      model: "${{ vars.FACTORY_BUILD_MODEL }}",
      "signing-key": "${{ secrets.FACTORY_SIGNING_KEY }}",
    });
  });

  // The job's limit, not the turn limit, is what bounds a build.
  it("is bounded by 240 minutes, ten above the session's", () => {
    expect(job["timeout-minutes"]).toBe(240);
  });
});

describe("actions/factory-agent/action.yml", () => {
  const steps = action.runs.steps;
  const step = (name: string) => {
    const found = steps.find((s) => s.name === name);
    if (!found) throw new Error(`no step named ${name}`);
    return found;
  };
  /** The `if ... fi` blocks of a step's script, each on its own. */
  const blocks = (run: string) => run.match(/^\s*if [^]*?^\s*fi$/gm) ?? [];

  it("takes the eight inputs, the prompt, the minutes, and the build token required", () => {
    expect(
      Object.entries(action.inputs).map(([name, i]) => [name, i.required]),
    ).toEqual([
      ["prompt", true],
      ["minutes", true],
      ["only-if", false],
      ["github-token", true],
      ["claude-oauth-token", false],
      ["anthropic-api-key", false],
      ["model", false],
      ["signing-key", false],
    ]);
  });

  it("checks the credentials, sets up Node, installs, checks for work, runs the setup commands, sets git's identity, sets up signing, installs Claude Code, records the commit, runs the session, then puts the checkout back, in that order", () => {
    expect(action.runs.using).toBe("composite");
    expect(steps.map((s) => s.name)).toEqual([
      "Check the credentials",
      "Set up Node",
      "Install dependencies",
      "Check whether there is work",
      "Run the build's setup commands",
      "Set git's name and email",
      "Set up commit signing",
      "Install Claude Code",
      "Record the commit the session starts on",
      "Run the session",
      "Put the checkout back on the commit the session started on",
    ]);
  });

  it("fails first, naming the secrets, when the build token or both Claude credentials are empty", () => {
    expect(steps[0].name).toBe("Check the credentials");
    const [token, claude] = blocks(steps[0].run!);
    expect(token).toMatch(/if \[ -z "\$BUILD_TOKEN" \]; then/);
    expect(token).toContain("FACTORY_BUILD_TOKEN");
    expect(token).toMatch(/^\s*exit 1$/m);
    expect(claude).toMatch(
      /if \[ -z "\$OAUTH_TOKEN_INPUT" \] && \[ -z "\$API_KEY_INPUT" \]; then/,
    );
    expect(claude).toContain("CLAUDE_CODE_OAUTH_TOKEN");
    expect(claude).toContain("ANTHROPIC_API_KEY");
    expect(claude).toMatch(/^\s*exit 1$/m);
  });

  it("sets up Node from package.json's engines and runs npm ci", () => {
    expect(step("Set up Node").with).toMatchObject({
      "node-version-file": "package.json",
    });
    expect(step("Install dependencies").run!.trim()).toMatch(/^npm ci\n/);
  });

  it("runs each commands.build-setup command from the settings", () => {
    expect(step("Run the build's setup commands").run).toContain(
      "factory config get commands.build-setup >",
    );
  });

  it("sets git's identity from the account that owns the build token", () => {
    const git = step("Set git's name and email");
    expect(git.env?.GH_TOKEN).toBe("${{ inputs.github-token }}");
    expect(git.run).toContain("gh api user");
    expect(git.run).toContain(
      '"$(jq -r .id <<< "$user")+$login@users.noreply.github.com"',
    );
  });

  it("writes the signing key under RUNNER_TEMP, readable only by its owner, and sets the three git values", () => {
    const signing = step("Set up commit signing");
    expect(signing.env).toEqual({
      SIGNING_KEY_INPUT: "${{ inputs.signing-key }}",
    });
    const run = signing.run!;
    expect(run).toContain('key_file="$RUNNER_TEMP/factory-signing-key"');
    expect(run).toContain("umask 077");
    expect(run).toContain('chmod 600 "$key_file"');
    expect(run).toContain("git config --global gpg.format ssh");
    expect(run).toContain('git config --global user.signingkey "$key_file"');
    expect(run).toContain("git config --global commit.gpgsign true");
  });

  it("prints that builds are unsigned, and sets nothing, without a key", () => {
    const run = step("Set up commit signing").run!;
    const [none] = blocks(run);
    expect(none).toMatch(/if \[ -z "\$SIGNING_KEY_INPUT" \]; then/);
    expect(none).toContain(
      `echo "No signing key: this build's commits will be unsigned."`,
    );
    expect(none).toMatch(/^\s*exit 0$/m);
    expect(none).not.toContain("git config");
  });

  it("echoes nothing taken from the key", () => {
    expect(step("Set up commit signing").run).not.toMatch(/set -\w*x/);
    const echoes = step("Set up commit signing")
      .run!.split("\n")
      .filter((l) => /\b(echo|printf|cat)\b/.test(l) && /key/i.test(l));
    expect(echoes.map((l) => l.trim())).toEqual([
      `echo "No signing key: this build's commits will be unsigned."`,
      `(umask 077; printf '%s\\n' "$SIGNING_KEY_INPUT" > "$key_file")`,
    ]);
  });

  it("installs a pinned version of Claude Code", () => {
    expect(step("Install Claude Code").run).toMatch(
      /@anthropic-ai\/claude-code@\d+\.\d+\.\d+$/m,
    );
  });

  // The issue fixes the tool list and the turn limit; the job's 120 minutes
  // is the real bound, so a lower limit would stop long builds early.
  it("runs the session with the build token, the tool list, and the turn limit as written", () => {
    const session = step("Run the session");
    expect(session.env?.GH_TOKEN).toBe("${{ inputs.github-token }}");
    expect(session.run).toContain(
      '--allowedTools "Bash,Read,Write,Edit,Glob,Grep,Agent,Task,Skill"',
    );
    expect(session.run).toContain("--max-turns 1000");
  });

  it("exports each Claude credential only inside a test that its input is not empty", () => {
    const session = step("Run the session");
    const run = session.run!;
    expect(run).toMatch(
      /if \[ -n "\$OAUTH_TOKEN_INPUT" \]; then\s+export CLAUDE_CODE_OAUTH_TOKEN="\$OAUTH_TOKEN_INPUT"\s+elif \[ -n "\$API_KEY_INPUT" \]; then\s+export ANTHROPIC_API_KEY="\$API_KEY_INPUT"\s+fi/,
    );
    expect(
      run.match(/export (CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_API_KEY)/g),
    ).toHaveLength(2);
    expect(session.env).not.toHaveProperty("CLAUDE_CODE_OAUTH_TOKEN");
    expect(session.env).not.toHaveProperty("ANTHROPIC_API_KEY");
  });
});

// The step's script, run for real in a throwaway home and repository.
describe("the signing step, run", () => {
  const script = action.runs.steps.find(
    (s) => s.name === "Set up commit signing",
  )!.run!;

  const commitWith = (key: string) => {
    const dir = mkdtempSync(join(tmpdir(), "signing-"));
    const home = join(dir, "home");
    const temp = join(dir, "temp");
    const repo = join(dir, "repo");
    [home, temp, repo].forEach((d) => mkdirSync(d));
    const env = {
      PATH: process.env.PATH,
      HOME: home,
      GIT_CONFIG_NOSYSTEM: "1",
      RUNNER_TEMP: temp,
      SIGNING_KEY_INPUT: key,
    };
    const run = (cmd: string, args: string[]) =>
      execFileSync(cmd, args, {
        cwd: repo,
        env: env as unknown as NodeJS.ProcessEnv,
        encoding: "utf8",
      });
    run("bash", ["-eo", "pipefail", "-c", script]);
    run("git", ["init", "-q"]);
    run("git", ["config", "user.name", "T"]);
    run("git", ["config", "user.email", "t@example.com"]);
    run("git", ["commit", "-q", "--allow-empty", "-m", "x"]);
    return {
      raw: run("git", ["cat-file", "commit", "HEAD"]),
      keyFile: join(temp, "factory-signing-key"),
    };
  };

  it("signs a commit with the key, in a file only its owner can read", () => {
    const dir = mkdtempSync(join(tmpdir(), "keygen-"));
    execFileSync("ssh-keygen", [
      "-q",
      "-t",
      "ed25519",
      "-N",
      "",
      "-f",
      join(dir, "k"),
    ]);
    const { raw, keyFile } = commitWith(readFileSync(join(dir, "k"), "utf8"));
    expect(raw).toContain("-----BEGIN SSH SIGNATURE-----");
    expect(statSync(keyFile).mode & 0o777).toBe(0o600);
  });

  it("leaves a commit unsigned without the key", () => {
    expect(commitWith("").raw).not.toContain("SIGNATURE");
  });
});

describe("a cloud build's commits", () => {
  const script = action.runs.steps.find(
    (s) => s.name === "Set git's name and email",
  )!.run!;

  /** Runs the step with a `gh` that answers as the build token's owner, then
   * commits, and returns the commit's author and committer lines. */
  const commit = () => {
    const dir = mkdtempSync(join(tmpdir(), "identity-"));
    const bin = join(dir, "bin");
    const home = join(dir, "home");
    const repo = join(dir, "repo");
    [bin, home, repo].forEach((d) => mkdirSync(d));
    writeFileSync(
      join(bin, "gh"),
      `#!/bin/sh\necho '{"login":"owner","id":42,"name":"Owner Person"}'\n`,
      { mode: 0o755 },
    );
    const env = {
      PATH: `${bin}:${process.env.PATH}`,
      HOME: home,
      GIT_CONFIG_NOSYSTEM: "1",
    };
    const run = (cmd: string, args: string[]) =>
      execFileSync(cmd, args, {
        cwd: repo,
        env: env as unknown as NodeJS.ProcessEnv,
        encoding: "utf8",
      });
    run("bash", ["-eo", "pipefail", "-c", script]);
    run("git", ["init", "-q"]);
    run("git", ["commit", "-q", "--allow-empty", "-m", "x"]);
    return run("git", ["log", "-1", "--format=%an <%ae>%n%cn <%ce>"])
      .trim()
      .split("\n");
  };

  it("name Claude as their author and the token's owner as their committer", () => {
    expect(commit()).toEqual([
      "Claude <noreply@anthropic.com>",
      "Owner Person <42+owner@users.noreply.github.com>",
    ]);
  });
});
