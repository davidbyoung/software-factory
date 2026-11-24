// `factory init` against the real git: a checkout cloned from a repository
// in a temporary folder, with none of this machine's git settings, so the
// commands the setup's commit is made with are run, not only listed.
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { devNull, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkedOut,
  freeBranch,
  initDeps,
  main,
  openPull,
  addRemote,
  whichRepository,
  type Files,
  type InitDeps,
  type Where,
} from "../src/init.mts";
import { TOOLS } from "../src/tools.mts";
import { scripted } from "./init-harness";
import { memoryCodeHost } from "./memory-code-host";
import { memoryRunner } from "./memory-runner";
import { memoryTickets } from "./memory-tickets";
import { memoryTools } from "./memory-tools";
import { CODE_HOST_YAML } from "./settings-fixture";

let world: string;
let remote: string;
let root: string;
let d: InitDeps;

const git = (cwd: string, ...args: string[]) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.replace(/\n$/, "");
};
const put = (path: string, text: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

beforeEach(async () => {
  world = mkdtempSync(join(tmpdir(), "init-git-"));
  for (const [name, value] of Object.entries({
    HOME: world,
    GIT_CONFIG_GLOBAL: devNull,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Dev",
    GIT_AUTHOR_EMAIL: "dev@acme.test",
    GIT_COMMITTER_NAME: "Dev",
    GIT_COMMITTER_EMAIL: "dev@acme.test",
  }))
    vi.stubEnv(name, value);
  remote = join(world, "remote.git");
  root = join(world, "checkout");
  git(world, "init", "--quiet", "--bare", "--initial-branch", "main", remote);
  git(world, "clone", "--quiet", remote, root);
  put("README.md", "# web\n");
  git(root, "add", "--all");
  git(root, "commit", "--quiet", "--message", "Start");
  git(root, "push", "--quiet", "origin", "HEAD:main");
  d = await initDeps(root);
});
afterEach(() => rmSync(world, { recursive: true, force: true }));

describe("init's own git", () => {
  it("reads every remote, by its name and the address it fetches from", () => {
    git(root, "remote", "add", "upstream", "git@github.com:acme/web.git");
    expect(d.remotes()).toEqual([
      { name: "origin", url: remote },
      { name: "upstream", url: "git@github.com:acme/web.git" },
    ]);
  });

  it("gives a command's status, and what it printed on each stream", () => {
    expect(d.git(["rev-parse", "--abbrev-ref", "HEAD"])).toEqual({
      status: 0,
      stdout: "main\n",
      stderr: "",
    });
    const failed = d.git(["rev-parse", "--verify", "--quiet", "no-such"]);
    expect(failed.status).not.toBe(0);
  });

  it("runs a gate command from the root, with everything it printed in order, and its status", async () => {
    put("marker", "");
    expect(
      await d.gate("ls marker; echo to-error >&2; echo to-out; exit 3"),
    ).toEqual({ status: 3, output: "marker\nto-error\nto-out\n" });
  });
});

describe("the checkout, against the default branch as fetched", () => {
  const at = () => ({ repository: "acme/web", remote: "origin", base: "main" });
  const lines: string[] = [];
  const io = () => ({ git: d.git, out: (l: string) => lines.push(l) });
  beforeEach(() => lines.splice(0));

  it("goes on at the default branch's commit, giving it", () => {
    expect(checkedOut(io(), at())).toEqual({
      sha: git(root, "rev-parse", "HEAD"),
    });
  });

  it("goes on behind it, on a branch of another name", () => {
    const first = git(root, "rev-parse", "HEAD");
    put("more.md", "more\n");
    git(root, "add", "--all");
    git(root, "commit", "--quiet", "--message", "More");
    git(root, "push", "--quiet", "origin", "HEAD:main");
    git(root, "switch", "--quiet", "-c", "old-work", first);
    expect(checkedOut(io(), at())).toEqual({
      sha: git(root, "rev-parse", "origin/main"),
    });
    expect(lines).toEqual([]);
  });

  it("stops ahead of it, naming the branch", () => {
    git(root, "switch", "--quiet", "-c", "cart-fix");
    put("cart.md", "cart\n");
    git(root, "add", "--all");
    git(root, "commit", "--quiet", "--message", "Fix the cart");
    expect(checkedOut(io(), at())).toBe(1);
    expect(lines).toEqual([
      "✗ This checkout is on the branch cart-fix, which has commits main does not. Switch to main, then run factory init again.",
      "Nothing changed.",
    ]);
  });

  it("stops ahead of it on no branch, naming none", () => {
    git(root, "switch", "--quiet", "--detach");
    put("cart.md", "cart\n");
    git(root, "add", "--all");
    git(root, "commit", "--quiet", "--message", "Fix the cart");
    expect(checkedOut(io(), at())).toBe(1);
    expect(lines).toEqual([
      "✗ This checkout has commits main does not. Switch to main, then run factory init again.",
      "Nothing changed.",
    ]);
  });

  it("stops with git's reason when the remote has no such branch", () => {
    expect(checkedOut(io(), { ...at(), base: "trunk" })).toBe(1);
    expect(lines[0]).toMatch(
      /^✗ Could not fetch trunk from acme\/web: fatal: couldn't find remote ref trunk$/,
    );
  });
});

describe("a fork's parent chosen, which is no remote yet", () => {
  const lines: string[] = [];
  const out = (l: string) => void lines.push(l);
  const choose = () =>
    whichRepository({
      remotes: d.remotes,
      tools: TOOLS,
      ask: scripted({ select: ["acme/web"] }).ask,
      out,
      forkOf: async (_codeHost, repository) =>
        repository === "dev/web" ? "acme/web" : null,
    });
  const remotes = () => git(root, "remote").split("\n");
  beforeEach(() => {
    lines.splice(0);
    git(root, "remote", "set-url", "origin", "git@github.com:dev/web.git");
  });

  it("is chosen with the name and the address it will have, and the checkout left as it was", async () => {
    expect(await choose()).toEqual({
      codeHost: "github",
      repository: "acme/web",
      remote: "upstream",
      url: "git@github.com:acme/web.git",
    });
    expect(remotes()).toEqual(["origin"]);
    expect(lines).toEqual([]);
  });

  it("is added as the remote upstream, at the fork's own kind of address, and said so", async () => {
    const where = await choose();
    expect(addRemote({ git: d.git, out }, where as Where)).toBe(true);
    expect(git(root, "remote", "get-url", "upstream")).toBe(
      "git@github.com:acme/web.git",
    );
    expect(git(root, "remote", "get-url", "origin")).toBe(
      "git@github.com:dev/web.git",
    );
    expect(lines).toEqual(["Added the remote upstream, acme/web."]);
  });

  it("is added as upstream-2 when a remote is called upstream, which is left as it was", async () => {
    git(root, "remote", "add", "upstream", "https://gitlab.com/else/where.git");
    const where = await choose();
    expect(addRemote({ git: d.git, out }, where as Where)).toBe(true);
    expect(git(root, "remote", "get-url", "upstream-2")).toBe(
      "git@github.com:acme/web.git",
    );
    expect(git(root, "remote", "get-url", "upstream")).toBe(
      "https://gitlab.com/else/where.git",
    );
    expect(lines).toEqual(["Added the remote upstream-2, acme/web."]);
  });

  it("says git's reason, and that nothing changed, when it cannot be added", async () => {
    const where = (await choose()) as Where;
    git(root, "remote", "add", "upstream", "https://gitlab.com/else/where.git");
    expect(addRemote({ git: d.git, out }, where)).toBe(false);
    expect(lines).toEqual([
      "✗ Could not add the remote upstream: error: remote upstream already exists.",
      "Nothing changed.",
    ]);
  });

  it("has its default branch fetched, and its branch names read, by address, adding no remote", () => {
    expect(
      checkedOut(
        { git: d.git, out },
        { repository: "acme/web", remote: remote, base: "main" },
      ),
    ).toEqual({ sha: git(root, "rev-parse", "HEAD") });
    git(root, "push", "--quiet", remote, "HEAD:set-up-factory");
    expect(freeBranch(d, remote)).toBe("set-up-factory-2");
    expect(remotes()).toEqual(["origin"]);
  });
});

describe("the setup's commit, against the real git", () => {
  const PATHS = [
    ".claude/factory.yaml",
    ".claude/skills/factory-build/SKILL.md",
    ".github/workflows/old.yml",
    ".claude/never-written.md",
  ];
  const lines: string[] = [];
  const pull = (over: Partial<Parameters<typeof openPull>[1]> = {}) =>
    openPull(
      { git: d.git, out: (l) => lines.push(l) },
      {
        codeHost: { create: async () => 41 },
        repository: "acme/web",
        remote: "origin",
        base: "main",
        branch: "set-up-factory",
        paths: PATHS,
        title: "Set up the software factory",
        body: "",
        ...over,
      },
    );
  beforeEach(() => {
    lines.splice(0);
    // A workflow the sync deletes, and work of the person's own: one file
    // staged, one changed, and one untracked.
    put(".github/workflows/old.yml", "on: push\n");
    put("staged.md", "staged\n");
    git(root, "add", "--all");
    git(root, "commit", "--quiet", "--message", "Earlier work");
    git(root, "push", "--quiet", "origin", "HEAD:main");
    rmSync(join(root, ".github/workflows/old.yml"));
    put(".claude/factory.yaml", "version: 2\n");
    put(".claude/skills/factory-build/SKILL.md", "build\n");
    put("staged.md", "staged, and changed\n");
    git(root, "add", "staged.md");
    put("README.md", "# web, edited\n");
    put("notes.txt", "mine\n");
  });

  it("commits the paths it wrote or deleted, and nothing else, on the new branch", async () => {
    expect(await pull()).toEqual({ state: "opened", number: 41 });
    expect(git(root, "rev-parse", "--abbrev-ref", "HEAD")).toBe(
      "set-up-factory",
    );
    expect(git(root, "log", "-1", "--format=%s")).toBe(
      "Set up the software factory",
    );
    expect(
      git(root, "show", "--name-status", "--format=", "HEAD").split("\n"),
    ).toEqual([
      "A\t.claude/factory.yaml",
      "A\t.claude/skills/factory-build/SKILL.md",
      "D\t.github/workflows/old.yml",
    ]);
  });

  it("leaves what else was staged, changed, or untracked as it was", async () => {
    await pull();
    expect(git(root, "status", "--porcelain").split("\n")).toEqual([
      " M README.md",
      "M  staged.md",
      "?? notes.txt",
    ]);
  });

  it("pushes the branch to the repository's remote, from the commit that was checked out", async () => {
    const before = git(root, "rev-parse", "HEAD");
    await pull();
    expect(git(remote, "rev-parse", "set-up-factory")).toBe(
      git(root, "rev-parse", "HEAD"),
    );
    expect(git(root, "rev-parse", "HEAD~1")).toBe(before);
    expect(lines).toEqual([
      '✓ Opened acme/web#41, "Set up the software factory".',
    ]);
  });

  it("makes no branch when none of its paths changed", async () => {
    expect(await pull({ paths: ["staged-elsewhere.md", "LICENSE"] })).toEqual({
      state: "nothing",
    });
    expect(git(root, "rev-parse", "--abbrev-ref", "HEAD")).toBe("main");
    expect(lines).toEqual(["Nothing to commit: the files already match."]);
  });

  it("says git's own line, and leaves the commit here, when the remote refuses the push", async () => {
    expect(await pull({ remote: "nowhere" })).toEqual({ state: "failed" });
    expect(lines[0]).toMatch(/^✗ Could not push set-up-factory to acme\/web: /);
    expect(lines[1]).toBe(
      "The commit is on the branch set-up-factory here. Push it and open a pull request.",
    );
    expect(git(root, "log", "-1", "--format=%s")).toBe(
      "Set up the software factory",
    );
  });

  it("takes the next name when set-up-factory is a branch here, or on the remote", async () => {
    expect(freeBranch(d, "origin")).toBe("set-up-factory");
    git(root, "branch", "set-up-factory");
    expect(freeBranch(d, "origin")).toBe("set-up-factory-2");
    git(root, "push", "--quiet", "origin", "main:set-up-factory-2");
    expect(freeBranch(d, "origin")).toBe("set-up-factory-3");
  });
});

describe("the files the sync writes, against the real sync and the real git", () => {
  const ADDRESS = "git@github.com:acme/web.git";
  const STALE = ".github/workflows/factory-poller.yml";
  const RULES = ".claude/factory/rules.md";
  const settings = (review: boolean) =>
    [
      "version: 2",
      "repository: acme/web",
      CODE_HOST_YAML,
      "specs: none",
      "commands:",
      "  gate:",
      "    - test -f .claude/factory.lock",
      ...(review ? ["pr-review:", "  commands: []"] : []),
      "",
    ].join("\n");
  const files = (text: string): Files => ({
    settings: text,
    choices: null,
    lock: read(".claude/factory.lock"),
  });
  const read = (path: string) =>
    existsSync(join(root, path))
      ? readFileSync(join(root, path), "utf8")
      : null;
  /** Each path git says differs from the last commit, with its mark. */
  const changed = () =>
    git(root, "status", "--porcelain", "--untracked-files=all")
      .split("\n")
      .filter(Boolean)
      .map((l) => ({ mark: l.slice(0, 2), path: l.slice(3) }));
  const printed: string[] = [];

  beforeEach(async () => {
    // The checkout's remote has GitHub's address, which a stand-in for ssh
    // serves from this test's folder, so the remote is found by the
    // repository's name as it is on a person's machine.
    mkdirSync(join(world, "acme"));
    symlinkSync(remote, join(world, "acme", "web.git"));
    const ssh = join(world, "ssh");
    writeFileSync(
      ssh,
      `#!/bin/sh\ncd "${world}" || exit 1\nshift\nexec sh -c "$*"\n`,
    );
    chmodSync(ssh, 0o755);
    vi.stubEnv("GIT_SSH_COMMAND", ssh);
    vi.stubEnv("GIT_SSH_VARIANT", "simple");
    git(root, "remote", "set-url", "origin", ADDRESS);
    git(root, "remote", "set-head", "origin", "main");
    // The sync is the command's own, which runs where it is called from.
    vi.spyOn(process, "cwd").mockReturnValue(root);
    printed.splice(0);
    vi.spyOn(console, "log").mockImplementation((l) => void printed.push(l));
    vi.spyOn(console, "error").mockImplementation((l) => void printed.push(l));
    // A repository set up by an earlier release, as its default branch
    // has it: the review on, a workflow the factory no longer writes, which
    // the lock lists, and a rule file someone edited by hand.
    put(".claude/factory.yaml", settings(true));
    expect(await d.sync(), printed.join("\n")).toBe(0);
    put(STALE, "on: schedule\n");
    put(
      ".claude/factory.lock",
      `${read(".claude/factory.lock")}  - ${STALE}\n`,
    );
    put(RULES, "# Edited by hand\n");
    git(root, "add", "--all");
    git(root, "commit", "--quiet", "--message", "Set up the software factory");
    git(root, "push", "--quiet", "origin", "HEAD:main");
  });

  it("names, before the sync runs, exactly the paths the sync then writes or deletes", async () => {
    const paths = await d.syncChanges(
      files(settings(true)),
      async () => "main",
    );
    expect(changed()).toEqual([]);
    expect(await d.sync(), printed.join("\n")).toBe(0);

    expect(
      changed()
        .map((c) => c.path)
        .sort(),
    ).toEqual([...paths].sort());
    expect(changed()).toEqual(
      expect.arrayContaining([
        { mark: " D", path: STALE },
        { mark: " M", path: RULES },
      ]),
    );
  });

  it("names the paths for the settings as they will read, not as the file on disk has them", async () => {
    const next = settings(false);
    const paths = await d.syncChanges(files(next), async () => "main");
    put(".claude/factory.yaml", next);
    expect(await d.sync(), printed.join("\n")).toBe(0);
    expect(
      changed()
        .map((c) => c.path)
        .filter((path) => path !== ".claude/factory.yaml")
        .sort(),
    ).toEqual([...paths].sort());
    expect(paths).toContain(".github/workflows/factory-review.yml");
  });

  it("commits, through the whole of init, the settings and what the sync wrote or deleted, and nothing the checkout held before", async () => {
    put("staged.md", "staged\n");
    git(root, "add", "staged.md");
    put("README.md", "# web, edited\n");
    put("notes.txt", "mine\n");
    const before = changed();
    const host = memoryCodeHost([], { owner: "dev" });
    const tickets = memoryTickets([]).tickets;
    const out: string[] = [];
    const code = await main([], {
      ...d,
      ask: scripted({ checkbox: [[]], confirm: [true] }).ask,
      out: (l) => out.push(l),
      tools: memoryTools({
        codeHost: host.codeHost,
        runner: memoryRunner().runner,
        tickets,
      }),
      forkOf: async () => null,
      presets: { ...d.presets, held: async () => null },
      hasCommand: () => true,
      checks: async () => [],
      env: { XDG_CONFIG_HOME: join(world, "config") },
    });
    expect(code, [...out, ...printed].join("\n")).toBe(0);
    expect(out).toContain(
      '✓ Opened acme/web#1, "Change the software factory\'s settings".',
    );

    // The review was turned off, which the settings and both workflows
    // show; the stale workflow went, and the hand edit with it.
    const committed = git(root, "show", "--name-status", "--format=", "HEAD")
      .split("\n")
      .sort();
    expect(committed).toEqual(
      [
        "M\t.claude/factory.yaml",
        "M\t.claude/factory.lock",
        `M\t${RULES}`,
        `D\t${STALE}`,
        "M\t.github/workflows/factory-review.yml",
        "M\t.github/workflows/factory.yml",
      ].sort(),
    );
    // Everything init and the sync changed is in the commit, so what
    // differs from it now is what differed before, as it was.
    expect(changed()).toEqual(before);
    expect(git(remote, "rev-parse", "set-up-factory")).toBe(
      git(root, "rev-parse", "HEAD"),
    );
    expect(await host.codeHost.get(1)).toMatchObject({
      head: { branch: "set-up-factory" },
      base: { branch: "main" },
    });
  });
});
