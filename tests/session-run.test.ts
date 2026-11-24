import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  sandboxSettings,
  sessionCommand,
} from "../src/agent/claude-code-session.mts";
import type { CloudSession } from "../src/agent/types.mts";
import type { RunFile } from "../src/handoff/index.mts";
import {
  runSession,
  sessionEnv,
  type SessionDeps,
} from "../src/session-run.mts";

const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    "git",
    ["-c", "user.name=a", "-c", "user.email=a@example.com", ...args],
    { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();

let dir: string;
let base: string;
let run: RunFile;

/** What Prepare hands over for a branch that has changed a skill. */
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "session-"));
  const source = join(dir, "source");
  git(dir, "init", "-q", "-b", "trunk", source);
  mkdirSync(join(source, ".claude"));
  writeFileSync(join(source, ".claude/skill.md"), "the default branch's\n");
  git(source, "add", "-A");
  git(source, "commit", "-q", "-m", "first");
  git(source, "update-ref", "refs/handoff/home", "HEAD");
  writeFileSync(join(source, ".claude/skill.md"), "the session's\n");
  git(source, "commit", "-q", "-am", "change a skill");
  git(source, "update-ref", "refs/handoff/work", "HEAD");
  base = git(source, "rev-parse", "HEAD");
  mkdirSync(join(dir, "in"));
  git(
    source,
    "bundle",
    "create",
    "-q",
    join(dir, "in/home.bundle"),
    "refs/handoff/home",
  );
  git(
    source,
    "bundle",
    "create",
    "-q",
    join(dir, "in/work.bundle"),
    "refs/handoff/home",
    "refs/handoff/work",
  );
  run = {
    version: 1,
    kind: "answer",
    repository: "acme/widgets",
    defaultBranch: "trunk",
    base,
    branch: "12-work",
    ticket: "12",
    ref: "#12",
    pull: 31,
    round: 1,
    claim: null,
    committer: { name: "factory[bot]", email: "1+factory[bot]@example.com" },
  };
  writeFileSync(join(dir, "in/run.json"), JSON.stringify(run));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function world(
  agent: (cwd: string, line: (text: string) => void) => void,
  over: Partial<SessionDeps> = {},
) {
  const out: string[] = [];
  const started: CloudSession[] = [];
  const d: SessionDeps = {
    dir,
    env: { PATH: process.env.PATH },
    hosts: ["repo.example.com"],
    prompt: "Answer it.",
    minutes: 10,
    git: (cwd, args) => void git(cwd, ...args),
    install: ["/opt/factory"],
    settings: sandboxSettings,
    command(s, file) {
      started.push(s);
      return sessionCommand(s, file);
    },
    async agent({ cwd, line }) {
      agent(cwd, line);
      return 0;
    },
    out: (line) => out.push(line),
    ...over,
  };
  return { d, out, started };
}

describe("a session in the cloud", () => {
  it("starts in the default branch, with its own branch beside it", async () => {
    let home = "";
    const w = world((cwd) => {
      home = readFileSync(join(cwd, ".claude/skill.md"), "utf8");
    });

    await runSession(w.d);

    expect(home).toBe("the default branch's\n");
    const work = join(dir, "work");
    expect(readFileSync(join(work, ".claude/skill.md"), "utf8")).toBe(
      "the session's\n",
    );
    expect(git(work, "branch", "--show-current")).toBe("12-work");
    expect(git(work, "rev-parse", "HEAD")).toBe(base);
    expect(git(work, "rev-parse", "--abbrev-ref", "origin/HEAD")).toBe(
      "origin/trunk",
    );
  });

  it("cannot write what it was handed, where it starts, or the factory", async () => {
    const w = world(() => {});
    await runSession(w.d);
    expect(w.started[0].readOnly).toEqual([
      join(dir, "in"),
      join(dir, "home"),
      "/opt/factory",
    ]);
  });

  it("hands on its commits and what it asks for, and nothing else", async () => {
    const w = world(() => {
      for (const name of ["build.bundle", "request.json", "other.txt"])
        writeFileSync(join(dir, "out", name), "x");
    });

    await runSession(w.d);

    expect(readdirSync(join(dir, "clean")).sort()).toEqual([
      "build.bundle",
      "request.json",
    ]);
  });

  it("hands on no link it left in their place", async () => {
    const secret = join(dir, "secret");
    writeFileSync(secret, "a credential");
    const w = world(() => symlinkSync(secret, join(dir, "out/request.json")));

    await runSession(w.d);

    expect(existsSync(join(dir, "clean/request.json"))).toBe(false);
    expect(w.out).toEqual([
      "Left request.json behind: it is not an ordinary file.",
    ]);
  });

  it("hands on the agent's own answer, whatever its commands wrote", async () => {
    const w = world(
      (_, line) => {
        writeFileSync(join(dir, "out/answer.json"), '{"verdict":"ready"}');
        line(
          JSON.stringify({
            type: "result",
            structured_output: { verdict: "changes" },
          }),
        );
      },
      { schema: {} },
    );

    expect(await runSession(w.d)).toBe(0);

    expect(
      JSON.parse(readFileSync(join(dir, "clean/answer.json"), "utf8")),
    ).toEqual({ verdict: "changes" });
  });

  it.each([
    ["gave none", JSON.stringify({ type: "result" })],
    [
      "ended in an error",
      JSON.stringify({
        type: "result",
        is_error: true,
        structured_output: { verdict: "ready" },
      }),
    ],
  ])("fails when it was to answer and %s", async (_, printed) => {
    const w = world((__, line) => line(printed), { schema: {} });
    expect(await runSession(w.d)).toBe(1);
    expect(existsSync(join(dir, "clean/answer.json"))).toBe(false);
  });
});

describe("its environment", () => {
  it("has no token or path of the runner's, and no sign-in", () => {
    const env = sessionEnv(
      {
        PATH: "/bin",
        GITHUB_TOKEN: "x",
        GH_TOKEN: "x",
        GITHUB_ENV: "x",
        ACTIONS_RUNTIME_TOKEN: "x",
        RUNNER_TEMP: "x",
        FACTORY_APP_PRIVATE_KEY: "x",
        NPM_TOKEN: "the repository's own",
      },
      run,
      dir,
    );
    expect(Object.values(env)).not.toContain("x");
    expect(env).toMatchObject({
      PATH: "/bin",
      NPM_TOKEN: "the repository's own",
    });
  });

  it("commits as the account handed over, written by Claude", () => {
    expect(sessionEnv({}, run, dir)).toMatchObject({
      GIT_AUTHOR_NAME: "Claude",
      GIT_COMMITTER_NAME: "factory[bot]",
      GIT_COMMITTER_EMAIL: "1+factory[bot]@example.com",
    });
  });
});

describe("how Claude Code is confined", () => {
  const session: CloudSession = {
    prompt: "Do it.",
    work: "/s/work",
    out: "/s/out",
    cache: "/s/cache",
    read: ["/s/in"],
    readOnly: ["/s/in", "/s/home"],
    hosts: ["repo.example.com"],
    maxTurns: 10,
  };

  it("is by settings that cannot be left, with its credentials kept from commands", () => {
    expect(sandboxSettings(session)).toEqual({
      disableAllHooks: true,
      sandbox: {
        enabled: true,
        failIfUnavailable: true,
        allowUnsandboxedCommands: false,
        autoAllowBashIfSandboxed: true,
        network: { allowedDomains: ["registry.npmjs.org", "repo.example.com"] },
        credentials: {
          envVars: [
            { name: "CLAUDE_CODE_OAUTH_TOKEN", mode: "deny" },
            { name: "ANTHROPIC_API_KEY", mode: "deny" },
          ],
        },
        filesystem: {
          allowWrite: ["/s/work", "/s/out", "/s/cache"],
          denyWrite: ["/s/in", "/s/home"],
        },
      },
      permissions: {
        deny: [
          "Read(//proc/**)",
          "Read(//sys/**)",
          "Edit(//proc/**)",
          "Edit(//sys/**)",
          "WebFetch",
          "WebSearch",
        ],
      },
    });
  });

  const allowed = (s: CloudSession) => {
    const { args } = sessionCommand(s, "/s/settings.json");
    return args[args.indexOf("--allowedTools") + 1].split(",");
  };

  it("edits only its branch and what it hands over", () => {
    const edits = allowed(session).filter((t) => /Edit|Write/.test(t));
    expect(edits).toEqual(["Edit(//s/work/**)", "Edit(//s/out/**)"]);
  });

  it("edits nothing when it is to answer", () => {
    expect(
      allowed({ ...session, schema: {} }).filter((t) => /Edit|Write/.test(t)),
    ).toEqual([]);
  });

  it("passes its settings on the command line, where a repository's cannot loosen them", () => {
    const { args } = sessionCommand(session, "/s/settings.json");
    expect(args).toEqual(
      expect.arrayContaining([
        "--settings",
        "/s/settings.json",
        "--setting-sources",
        "project",
      ]),
    );
  });
});
