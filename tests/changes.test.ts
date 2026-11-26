import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  branchChange,
  commitChange,
  relockChange,
} from "../src/lib/changes.mts";
import { gitIn } from "../src/lib/default-branch.mts";

const made: string[] = [];
afterEach(() => {
  while (made.length) rmSync(made.pop()!, { recursive: true, force: true });
});

/** A repository with one commit on `main`, which `origin/main` points at,
 * and a branch `work` from it. */
function repo() {
  const dir = mkdtempSync(join(tmpdir(), "changes-"));
  made.push(dir);
  const sh = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  sh("init", "-q", "-b", "main");
  sh("config", "user.email", "t@example.com");
  sh("config", "user.name", "t");
  sh("config", "commit.gpgsign", "false");
  const write = (path: string, text = path) =>
    writeFileSync(join(dir, path), text);
  write("a.ts");
  write("b.ts");
  write("old.ts");
  sh("add", "-A");
  sh("commit", "-qm", "first");
  sh("update-ref", "refs/remotes/origin/main", "HEAD");
  sh("switch", "-qc", "work");
  return { dir, sh, write, git: gitIn(dir) };
}

describe("branchChange", () => {
  it("reads commits, staged and unstaged edits, new files, and both names of a rename", () => {
    const { dir, sh, write, git } = repo();
    write("a.ts", "changed and committed");
    sh("commit", "-qam", "edit a");
    write("b.ts", "edited, not staged");
    sh("mv", "old.ts", "new.ts");
    write("added.ts");

    const change = branchChange(git, "main");
    expect(change.files).toEqual([
      "a.ts",
      "added.ts",
      "b.ts",
      "new.ts",
      "old.ts",
    ]);
    expect(change.base).toBe(
      execFileSync("git", ["rev-parse", "origin/main"], {
        cwd: dir,
        encoding: "utf8",
      }).trim(),
    );
  });

  it("leaves out what the default branch changed after the branch left it, once merged in", () => {
    const { sh, write, git } = repo();
    sh("switch", "-q", "main");
    write("main-only.ts");
    sh("add", "-A");
    sh("commit", "-qm", "on main");
    sh("update-ref", "refs/remotes/origin/main", "HEAD");
    sh("switch", "-q", "work");
    write("mine.ts");
    sh("add", "-A");
    sh("commit", "-qm", "mine");
    sh("merge", "-q", "--no-edit", "origin/main");

    expect(branchChange(git, "main").files).toEqual(["mine.ts"]);
  });

  it("leaves out what the default branch changed after the branch left it, before a merge", () => {
    const { sh, write, git } = repo();
    write("mine.ts");
    sh("add", "-A");
    sh("commit", "-qm", "mine");
    sh("switch", "-q", "main");
    write("main-only.ts");
    sh("add", "-A");
    sh("commit", "-qm", "on main");
    sh("update-ref", "refs/remotes/origin/main", "HEAD");
    sh("switch", "-q", "work");

    expect(branchChange(git, "main").files).toEqual(["mine.ts"]);
  });

  it("can't tell without origin/main", () => {
    const { sh, git } = repo();
    sh("update-ref", "-d", "refs/remotes/origin/main");
    expect(branchChange(git, "main")).toEqual({
      files: null,
      why: "no-remote",
      base: "",
    });
  });

  it("can't tell for a branch that shares no commit with origin/main", () => {
    const { sh, write, git } = repo();
    sh("switch", "-q", "--orphan", "alone");
    write("x.ts");
    sh("add", "-A");
    sh("commit", "-qm", "alone");
    expect(branchChange(git, "main")).toMatchObject({
      files: null,
      why: "no-shared",
    });
  });
});

describe("commitChange", () => {
  it("reads what differs from the last commit, and new files", () => {
    const { sh, write, git } = repo();
    write("a.ts", "committed");
    sh("commit", "-qam", "edit");
    write("b.ts", "not yet");
    write("c.ts");
    expect(commitChange(git).files).toEqual(["b.ts", "c.ts"]);
  });

  it("can't tell before the first commit", () => {
    const dir = mkdtempSync(join(tmpdir(), "changes-"));
    made.push(dir);
    execFileSync("git", ["init", "-q"], { cwd: dir });
    expect(commitChange(gitIn(dir))).toMatchObject({
      files: null,
      why: "no-commit",
    });
  });
});

describe("relockChange", () => {
  it("leaves out a lock the default branch bumped, while a merge with it is in progress", () => {
    const { dir, sh, write, git } = repo();
    write("a.ts", "mine");
    sh("commit", "-qam", "mine");
    sh("switch", "-q", "main");
    write("a.ts", "theirs");
    write("main.lock", "bumped on main");
    sh("add", "-A");
    sh("commit", "-qm", "bump");
    sh("update-ref", "refs/remotes/origin/main", "HEAD");
    sh("switch", "-q", "work");
    try {
      sh("merge", "-q", "--no-edit", "origin/main");
    } catch {
      // The conflict in a.ts stops the merge, as one in a lock file would.
    }
    expect(existsSync(join(dir, ".git/MERGE_HEAD"))).toBe(true);
    expect(existsSync(join(dir, "main.lock"))).toBe(true);
    expect(relockChange(git, "main").files).toEqual(["a.ts"]);
  });

  it("reads what differs from origin/main itself, so a lock only main bumped is left out", () => {
    const { dir, sh, write, git } = repo();
    sh("switch", "-q", "main");
    write("main.lock", "bumped on main");
    sh("add", "-A");
    sh("commit", "-qm", "bump");
    sh("update-ref", "refs/remotes/origin/main", "HEAD");
    sh("switch", "-q", "work");
    write("mine.lock", "mine");
    sh("add", "-A");
    sh("commit", "-qm", "mine");
    sh("merge", "-q", "--no-edit", "origin/main");
    unlinkSync(join(dir, "b.ts"));

    expect(relockChange(git, "main").files).toEqual(["b.ts", "mine.lock"]);
  });
});
