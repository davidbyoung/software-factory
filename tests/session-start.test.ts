import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  gitIn,
  installBehind,
  repositoryState,
} from "../src/session-start.mts";

// A clone of an origin with three local branches: one with a commit main
// lacks, one squash-merged into main, and one with no commits of its own.
let root: string;
let clone: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "session-start-"));
  const origin = join(root, "origin.git");
  clone = join(root, "clone");
  const git = (...args: string[]) =>
    execFileSync(
      "git",
      ["-c", "user.name=t", "-c", "user.email=t@t", ...args],
      {
        cwd: clone,
        stdio: "pipe",
      },
    );
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", origin]);
  execFileSync("git", ["clone", "-q", origin, clone], { stdio: "pipe" });
  git("checkout", "-q", "-b", "main");
  git("commit", "-q", "--allow-empty", "-m", "init");
  git("push", "-q", "origin", "main");

  git("checkout", "-q", "-b", "unfinished");
  writeFileSync(join(clone, "a.txt"), "a\n");
  git("add", "a.txt");
  git("commit", "-q", "-m", "one");
  git("commit", "-q", "--allow-empty", "-m", "two");

  git("checkout", "-q", "main");
  git("checkout", "-q", "-b", "squashed");
  writeFileSync(join(clone, "b.txt"), "b\n");
  git("add", "b.txt");
  git("commit", "-q", "-m", "b");
  git("checkout", "-q", "main");
  git("merge", "-q", "--squash", "squashed");
  git("commit", "-q", "-m", "squash b");
  git("push", "-q", "origin", "main");

  git("branch", "empty");
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("factory session-start", () => {
  it("lists only the branches with work not on origin/main", () => {
    const lines = repositoryState(gitIn(clone));
    const at = lines.indexOf("Local branches with work not on origin/main:");

    expect(at).toBeGreaterThan(0);
    expect(lines.slice(at + 2).filter((l) => l.startsWith("- "))).toEqual([
      "- unfinished (2 commits not on origin/main)",
    ]);
    expect(lines.at(-1)).toBe(
      "Mention any of these to the user before starting work on another branch.",
    );
  });

  it("opens with the checkout's state", () => {
    const lines = repositoryState(gitIn(clone));

    expect(lines.slice(0, 3)).toEqual([
      "## Repository state at session start",
      "",
      "```",
    ]);
    expect(lines[3]).toMatch(/^## main/);
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
