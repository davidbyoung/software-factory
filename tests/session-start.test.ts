import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  gitIn,
  installBehind,
  main,
  repositoryState,
} from "../src/session-start.mts";
import { branchDeps, CANNOT_TELL } from "../src/lib/default-branch.mts";

// Clones of an origin, each with three local branches beside the default
// one: one with two commits the default branch lacks, one squash-merged into
// it, and one with no commits of its own. The origin's default branch is
// main in one clone and develop in the other, which also has a local branch
// called main with a commit develop lacks.
let root: string;
let clone: string;
let onDevelop: string;

function cloned(name: string, base: string): string {
  const origin = join(root, `${name}.git`);
  const dir = join(root, name);
  const git = (...args: string[]) =>
    execFileSync(
      "git",
      ["-c", "user.name=t", "-c", "user.email=t@t", ...args],
      {
        cwd: dir,
        stdio: "pipe",
      },
    );
  execFileSync("git", ["init", "-q", "--bare", "-b", base, origin]);
  execFileSync("git", ["clone", "-q", origin, dir], { stdio: "pipe" });
  git("checkout", "-q", "-b", base);
  git("commit", "-q", "--allow-empty", "-m", "init");
  git("push", "-q", "origin", base);
  git("remote", "set-head", "origin", base);

  git("checkout", "-q", "-b", "unfinished");
  writeFileSync(join(dir, "a.txt"), "a\n");
  git("add", "a.txt");
  git("commit", "-q", "-m", "one");
  git("commit", "-q", "--allow-empty", "-m", "two");

  git("checkout", "-q", base);
  git("checkout", "-q", "-b", "squashed");
  writeFileSync(join(dir, "b.txt"), "b\n");
  git("add", "b.txt");
  git("commit", "-q", "-m", "b");
  git("checkout", "-q", base);
  git("merge", "-q", "--squash", "squashed");
  git("commit", "-q", "-m", "squash b");
  git("push", "-q", "origin", base);

  git("branch", "empty");
  if (base !== "main") {
    git("checkout", "-q", "-b", "main");
    writeFileSync(join(dir, "c.txt"), "c\n");
    git("add", "c.txt");
    git("commit", "-q", "-m", "on main");
    git("checkout", "-q", base);
  }
  return dir;
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "session-start-"));
  clone = cloned("clone", "main");
  onDevelop = cloned("on-develop", "develop");
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

const listed = (lines: string[]) => lines.filter((l) => l.startsWith("- "));

describe("factory session-start", () => {
  it("lists only the branches with work not on origin/main", () => {
    const lines = repositoryState(gitIn(clone), "main");
    const at = lines.indexOf("Local branches with work not on origin/main:");

    expect(at).toBeGreaterThan(0);
    expect(listed(lines.slice(at + 2))).toEqual([
      "- unfinished (2 commits not on origin/main)",
    ]);
    expect(lines.at(-1)).toBe(
      "Mention any of these to the user before starting work on another branch.",
    );
  });

  it("compares with the default branch, whatever it is called, and lists a branch called main like any other", () => {
    const lines = repositoryState(gitIn(onDevelop), "develop");

    expect(lines).toContain("Local branches with work not on origin/develop:");
    expect(listed(lines)).toEqual([
      "- main (1 commits not on origin/develop)",
      "- unfinished (2 commits not on origin/develop)",
    ]);
  });

  it("names the fix, and lists no branch, when the default branch cannot be told", () => {
    const lines = repositoryState(gitIn(clone), null);

    expect(lines).toContain(CANNOT_TELL);
    expect(listed(lines)).toEqual([]);
    expect(lines.join("\n")).not.toContain("Local branches with work");
  });

  it("opens with the checkout's state", () => {
    const lines = repositoryState(gitIn(clone), "main");

    expect(lines.slice(0, 3)).toEqual([
      "## Repository state at session start",
      "",
      "```",
    ]);
    expect(lines[3]).toMatch(/^## main/);
  });
});

describe("the session-start hook", () => {
  /** The hook, run in `dir` with no workflow event and a code host that
   * cannot be asked, and what it printed. */
  const hook = async (dir: string) => {
    const printed: string[] = [];
    const status = await main({
      dir,
      branch: {
        ...branchDeps(dir, {}),
        host: async () => {
          throw new Error("no code host");
        },
      },
      out: (text) => printed.push(text),
      tickets: async () => 0,
    });
    return { status, text: printed.join("\n") };
  };

  it("reads the default branch from the checkout, and compares each branch with origin/develop where it is develop", async () => {
    const { status, text } = await hook(onDevelop);

    expect(status).toBe(0);
    expect(text).toContain("Local branches with work not on origin/develop:");
    expect(text).toContain("- unfinished (2 commits not on origin/develop)");
    expect(text).not.toContain("origin/main");
  });

  it("prints the fix, and compares no branch, where the default branch cannot be told", async () => {
    const dir = cloned("no-head", "main");
    execFileSync("git", ["remote", "set-head", "origin", "--delete"], {
      cwd: dir,
      stdio: "pipe",
    });

    const { status, text } = await hook(dir);

    expect(status).toBe(0);
    expect(text).toContain(CANNOT_TELL);
    expect(text).not.toContain("Local branches with work");
  });
});

describe("installBehind", () => {
  const lock = (packages: Record<string, unknown>) =>
    JSON.stringify({ lockfileVersion: 3, packages });
  const project = (files: { lock?: string; installed?: string }) => {
    const dir = mkdtempSync(join(root, "install-"));
    if (files.lock !== undefined)
      writeFileSync(join(dir, "package-lock.json"), files.lock);
    if (files.installed !== undefined) {
      mkdirSync(join(dir, "node_modules"));
      writeFileSync(
        join(dir, "node_modules", ".package-lock.json"),
        files.installed,
      );
    }
    return dir;
  };
  const factory = {
    "node_modules/factory": { resolved: "packages/factory", link: true },
  };
  const zod = (version: string) => ({ "node_modules/zod": { version } });

  it("says nothing when the install matches the lockfile", () => {
    const l = lock({ ...zod("4.6.7"), ...factory });
    expect(installBehind(project({ lock: l, installed: l }))).toBeNull();
  });

  it("names npm ci when node_modules has no record of an install", () => {
    const dir = project({ lock: lock(zod("4.6.7")) });
    expect(installBehind(dir)).toMatch(/npm ci/);
  });

  it("names npm ci when a package the lockfile lists is missing from the install", () => {
    const dir = project({
      lock: lock({ ...zod("4.6.7"), ...factory }),
      installed: lock(zod("4.6.7")),
    });
    expect(installBehind(dir)).toMatch(/npm ci/);
  });

  it("names npm ci when an installed version differs", () => {
    const dir = project({
      lock: lock(zod("4.6.7")),
      installed: lock(zod("4.5.0")),
    });
    expect(installBehind(dir)).toMatch(/npm ci/);
  });

  it("ignores optional packages the platform did not install", () => {
    const dir = project({
      lock: lock({
        ...zod("4.6.7"),
        "node_modules/fsevents": { version: "2", optional: true },
      }),
      installed: lock(zod("4.6.7")),
    });
    expect(installBehind(dir)).toBeNull();
  });

  it("says nothing without a lockfile", () => {
    expect(installBehind(project({}))).toBeNull();
  });
});
