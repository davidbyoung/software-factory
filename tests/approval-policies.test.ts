import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  agentOutcome,
  answerOf,
  changedFiles,
  checkEnv,
  checksOf,
  diffOf,
  outcomeOf,
  runCommand,
  statusOf,
  type Git,
  type Input,
  type Result,
} from "../src/approval-policies.mts";
import type { ApprovalPolicy } from "../src/config.mts";

const policy = (
  o: Partial<ApprovalPolicy> & { name: string },
): ApprovalPolicy => ({
  run: "x",
  agent: null,
  in: null,
  files: null,
  ...o,
});

describe("which policies a change sets off", () => {
  const licenses = policy({ name: "licenses", files: ["package-lock.json"] });
  const migrations = policy({
    name: "migrations",
    in: ["services/*"],
    files: ["./db/migrations/**"],
  });

  it("sets off a policy whose files match, with only those files", () => {
    const checks = checksOf(
      [licenses],
      [
        { filename: "package-lock.json", status: "modified" },
        { filename: "README.md", status: "modified" },
      ],
    );
    expect(checks).toEqual([
      {
        policy: licenses,
        folder: null,
        files: [{ filename: "package-lock.json", status: "modified" }],
      },
    ]);
  });

  it("sets off nothing when no file matches", () => {
    expect(
      checksOf([licenses], [{ filename: "a.ts", status: "added" }]),
    ).toEqual([]);
  });

  it("checks each folder under in on its own, a folder only the change adds included", () => {
    const checks = checksOf(
      [migrations],
      [
        { filename: "services/orders/db/migrations/1.sql", status: "added" },
        {
          filename: "services/payments-v2/db/migrations/1.sql",
          status: "added",
        },
        { filename: "services/orders/src/a.ts", status: "modified" },
      ],
    );
    expect(
      checks.map((c) => [c.folder, c.files.map((f) => f.filename)]),
    ).toEqual([
      ["services/orders", ["services/orders/db/migrations/1.sql"]],
      ["services/payments-v2", ["services/payments-v2/db/migrations/1.sql"]],
    ]);
  });

  it("counts a renamed file under its old name", () => {
    const moved = {
      filename: "lock/package-lock.json.bak",
      previous_filename: "package-lock.json",
      status: "renamed",
    };
    expect(checksOf([licenses], [moved])[0]?.files).toEqual([moved]);
  });
});

describe("the change, from git", () => {
  let dir = "";
  afterEach(() => rmSync(dir, { recursive: true, force: true }));
  const git: Git = (args) => {
    const r = spawnSync("git", ["-C", dir, ...args], {
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
      },
    });
    return { ok: r.status === 0, out: r.stdout };
  };
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  const commit = (message: string) => {
    git(["add", "-A"]);
    git([
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@t",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-qm",
      message,
    ]);
    return git(["rev-parse", "HEAD"]).out.trim();
  };
  const start = () => {
    dir = mkdtempSync(join(tmpdir(), "approval-git-"));
    git(["init", "-q"]);
    write("package-lock.json", "{}\n");
    write("old.txt", "same\nsame\nsame\n");
    return commit("base");
  };

  it("lists each changed file, a rename under both names", () => {
    const base = start();
    write("package-lock.json", '{"license": "MIT"}\n');
    git(["mv", "old.txt", "new.txt"]);
    const head = commit("change");
    expect(changedFiles(git, base, head)).toEqual([
      { filename: "new.txt", previous_filename: "old.txt", status: "renamed" },
      { filename: "package-lock.json", status: "modified" },
    ]);
    const diff = diffOf(git, base, head, [
      { filename: "package-lock.json", status: "modified" },
    ]);
    expect(diff).toContain('+{"license": "MIT"}');
    expect(diff).not.toContain("old.txt");
  });

  it("reads the working folder, uncommitted and untracked files included", () => {
    const base = start();
    write("package-lock.json", '{"license": "GPL-3.0"}\n');
    write("new/file.json", "fresh\n");
    const files = changedFiles(git, base, null);
    expect(files).toEqual([
      { filename: "package-lock.json", status: "modified" },
      { filename: "new/file.json", status: "added" },
    ]);
    const diff = diffOf(git, base, null, files!);
    expect(diff).toContain('+{"license": "GPL-3.0"}');
    expect(diff).toContain("+fresh");
  });

  it("is null when git can't compare the two", () => {
    start();
    expect(changedFiles(git, "0".repeat(40), "HEAD")).toBeNull();
  });
});

describe("running a command check", () => {
  const input: Input = {
    version: 1,
    repository: "acme/billing",
    pull: 42,
    base: "b",
    head: "h",
    files: [],
    diff: "",
    in: null,
    ticket: null,
  };

  it("hands it the input on standard input", async () => {
    const ran = await runCommand("cat", input, { cwd: tmpdir() });
    expect(JSON.parse(ran.stdout)).toEqual(input);
  });

  it("keeps every credential out of its environment", async () => {
    process.env.GH_TOKEN = "ghs_secret";
    process.env.GITHUB_TOKEN = "ghs_secret";
    process.env.CLAUDE_CODE_OAUTH_TOKEN = "sk-ant-oat";
    try {
      const ran = await runCommand("env", input, { cwd: tmpdir() });
      expect(ran.stdout).not.toContain("ghs_secret");
      expect(ran.stdout).not.toContain("sk-ant-oat");
      expect(ran.stdout).toContain("PATH=");
    } finally {
      delete process.env.GH_TOKEN;
      delete process.env.GITHUB_TOKEN;
      delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    }
    expect(Object.keys(checkEnv({ FOO_KEY: "x", PATH: "/bin" }))).toEqual([
      "PATH",
    ]);
  });

  it("stops one that runs past its time", async () => {
    const ran = await runCommand("sleep 5", input, {
      cwd: tmpdir(),
      timeoutMs: 100,
    });
    expect(ran.timedOut).toBe(true);
    expect(outcomeOf("sleep 5", ran)).toMatchObject({
      kind: "failed",
      why: "it gave no answer in 30 minutes",
    });
  });
});

describe("a check's answer", () => {
  const ran = (stdout: string, status: number | null = 0) => ({
    status,
    stdout,
    stderr: "boom",
    timedOut: false,
  });

  it("reads its findings, each waiting for approval", () => {
    expect(
      outcomeOf(
        "c",
        ran(
          '{"findings":[{"file":"package-lock.json","title":"GPL","line":3,"why":"policy"}]}',
        ),
      ),
    ).toEqual({
      kind: "findings",
      findings: [
        { file: "package-lock.json", title: "GPL", line: 3, why: "policy" },
      ],
    });
  });

  it("reads an empty list as nothing found", () => {
    expect(outcomeOf("c", ran('{"findings":[]}'))).toEqual({ kind: "nothing" });
  });

  it.each([
    ["not JSON", ran("hello"), "its answer isn't JSON"],
    ["no list", ran('{"found":[]}'), 'its answer has no "findings" list'],
    [
      "no title",
      ran('{"findings":[{"file":"a"}]}'),
      'a finding has no "file" or "title"',
    ],
    ["another exit", ran('{"findings":[]}', 2), "exit 2"],
  ])("fails on %s", (_, r, why) => {
    expect(outcomeOf("node check.mjs", r)).toEqual({
      kind: "failed",
      why,
      command: "node check.mjs",
      stderr: "boom",
    });
  });

  it("reads an agent's empty answer as cleared, not nothing", () => {
    expect(agentOutcome("rollback-checker", { findings: [] })).toEqual({
      kind: "cleared",
      agent: "rollback-checker",
    });
    expect(agentOutcome("r", answerOf("nope"))).toMatchObject({
      kind: "failed",
    });
  });
});

describe("the Approval policies status", () => {
  const label = "policy-override";
  const f = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ file: "a", title: `t${i}` }));
  const status = (results: Result[], unreadable = false) =>
    statusOf(results, { label, unreadable });

  it.each<[string, Result[], string, string]>([
    ["no policy applies", [], "success", "Nothing to approve"],
    [
      "a command found nothing",
      [{ name: "licenses", outcome: { kind: "nothing" } }],
      "success",
      "Nothing to approve",
    ],
    [
      "one policy waits",
      [{ name: "licenses", outcome: { kind: "findings", findings: f(1) } }],
      "pending",
      "licenses: 1 waiting for approval. To accept it, add the policy-override label",
    ],
    [
      "several wait",
      [
        { name: "licenses", outcome: { kind: "findings", findings: f(1) } },
        {
          name: "migrations in services/orders",
          outcome: { kind: "findings", findings: f(2) },
        },
      ],
      "pending",
      "2 policies waiting for approval: licenses, migrations in services/orders. To accept them, add the policy-override label",
    ],
    [
      "a check failed",
      [
        {
          name: "licenses",
          outcome: { kind: "failed", why: "exit 1", command: "c", stderr: "" },
        },
      ],
      "pending",
      "licenses: the check failed, so everything it applies to waits for approval",
    ],
    [
      "an agent can't run",
      [
        {
          name: "migrations",
          outcome: { kind: "cant-run", agent: "rollback-checker" },
        },
      ],
      "pending",
      "migrations: rollback-checker can't run here, so everything it applies to waits for approval",
    ],
    [
      "an agent cleared it",
      [
        {
          name: "migrations",
          outcome: { kind: "cleared", agent: "rollback-checker" },
        },
      ],
      "success",
      "migrations: cleared by rollback-checker, not a person",
    ],
  ])("when %s", (_, results, state, description) => {
    expect(status(results)).toEqual({ state, description });
  });

  it("names no policy when naming them would pass GitHub's 140 characters", () => {
    const many: Result[] = [
      "a-long-policy-name",
      "another-long-one",
      "a-third-one-here",
      "and-a-fourth",
    ].map((name) => ({
      name: `${name} in services/somewhere`,
      outcome: { kind: "findings", findings: f(1) },
    }));
    expect(status(many)).toEqual({
      state: "pending",
      description:
        "4 policies waiting for approval. To accept them, add the policy-override label",
    });
  });

  it("waits on every policy when the change couldn't be read", () => {
    expect(status([], true)).toEqual({
      state: "pending",
      description:
        "The change couldn't be read, so every policy waits for approval",
    });
  });
});
