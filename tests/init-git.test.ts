// `factory init` against the real git: a checkout cloned from a repository
// in a temporary folder, with none of this machine's git settings, so the
// commands the setup's commit is made with are run, not only listed.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { devNull, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkedOut,
  freeBranch,
  initDeps,
  openPull,
  type InitDeps,
} from "../src/init.mts";

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

  it("stops with git's reason when the remote has no such branch", () => {
    expect(checkedOut(io(), { ...at(), base: "trunk" })).toBe(1);
    expect(lines[0]).toMatch(
      /^✗ Could not fetch trunk from acme\/web: fatal: couldn't find remote ref trunk$/,
    );
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
