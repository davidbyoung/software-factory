import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkBundle } from "../src/handoff/bundle.mts";

// Each test makes the repository a session would work in, bundles what the
// session committed, and has the check read the bundle against a bare clone
// made before it, as Publish does.
let dir: string;
let work: string;
let bare: string;
let base: string;

const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    "git",
    ["-c", "user.name=a", "-c", "user.email=a@example.com", ...args],
    { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();

const write = (path: string, text: string) => {
  mkdirSync(dirname(join(work, path)), { recursive: true });
  writeFileSync(join(work, path), text);
};

const commit = (message: string) => {
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", message);
  return git(work, "rev-parse", "HEAD");
};

/** A change on the default branch that the clone has and the session's
 * branch does not. */
const moveTrunk = (path: string, text: string) => {
  git(work, "switch", "-q", "trunk");
  write(path, text);
  commit("a change on trunk");
  git(work, "push", "-q", bare, "trunk");
  git(work, "switch", "-q", "branch");
};

const bundle = (...refs: string[]) => {
  const file = join(dir, "build.bundle");
  git(work, "bundle", "create", "-q", file, ...refs);
  return file;
};

const check = (file: string, o: { published?: string } = {}) =>
  checkBundle({
    repo: bare,
    bundle: file,
    base,
    defaultBranch: "trunk",
    workflows: ".github/workflows",
    ...o,
  });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "bundle-"));
  work = join(dir, "work");
  bare = join(dir, "bare.git");
  git(dir, "init", "-q", "-b", "trunk", work);
  write(".github/workflows/ci.yml", "v1\n");
  write("a.txt", "a\n");
  base = commit("the first commit");
  git(dir, "clone", "-q", "--bare", work, bare);
  git(work, "switch", "-q", "-c", "branch");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("a bundle a session hands over", () => {
  it("is accepted with its newest commit when it only adds ordinary files", () => {
    write("b.txt", "b\n");
    const tip = commit("add b");
    expect(check(bundle(`${base}..branch`))).toEqual({ tip, commits: 1 });
  });

  it("is accepted when it changes a skill or the rules", () => {
    write(".claude/skills/x/SKILL.md", "x\n");
    write("CLAUDE.md", "x\n");
    const tip = commit("change the rules");
    expect(check(bundle(`${base}..branch`))).toEqual({ tip, commits: 1 });
  });

  it("is accepted when it merges a default branch that changed a workflow", () => {
    write("b.txt", "b\n");
    commit("add b");
    moveTrunk(".github/workflows/ci.yml", "v2\n");
    git(work, "merge", "-q", "--no-edit", "trunk");
    const tip = git(work, "rev-parse", "HEAD");
    expect(check(bundle(`${base}..branch`))).toEqual({ tip, commits: 2 });
  });

  it("is accepted when a commit already published has what a new one may not", () => {
    write(".github/workflows/ci.yml", "a person's\n");
    const published = commit("a person's change to a workflow");
    git(work, "push", "-q", bare, "branch");
    write("b.txt", "b\n");
    const tip = commit("add b");
    base = published;
    expect(check(bundle(`${published}..branch`), { published })).toEqual({
      tip,
      commits: 1,
    });
  });

  const refused: [string, RegExp, () => string][] = [
    [
      "adds a workflow file",
      /commit [0-9a-f]{7} changes \.github\/workflows\/evil\.yml/,
      () => {
        write(".github/workflows/evil.yml", "x\n");
        commit("evil");
        return bundle(`${base}..branch`);
      },
    ],
    [
      "adds a workflow file and removes it again",
      /changes \.github\/workflows\/evil\.yml/,
      () => {
        write(".github/workflows/evil.yml", "x\n");
        commit("evil");
        git(work, "rm", "-q", ".github/workflows/evil.yml");
        commit("hide it");
        return bundle(`${base}..branch`);
      },
    ],
    [
      "spells the workflows folder in another case",
      /changes \.GitHub\/Workflows\/evil\.yml/,
      () => {
        write(".GitHub/Workflows/evil.yml", "x\n");
        commit("evil");
        return bundle(`${base}..branch`);
      },
    ],
    [
      "hides a workflow file in a merge of the default branch",
      /changes \.github\/workflows\/evil\.yml/,
      () => {
        write("b.txt", "b\n");
        commit("add b");
        moveTrunk("c.txt", "c\n");
        git(work, "merge", "-q", "--no-edit", "--no-commit", "trunk");
        write(".github/workflows/evil.yml", "x\n");
        commit("merge");
        return bundle(`${base}..branch`);
      },
    ],
    [
      "undoes a workflow change with a merge",
      /leaves \.github\/workflows unlike the default branch/,
      () => {
        write("b.txt", "b\n");
        commit("add b");
        moveTrunk(".github/workflows/ci.yml", "v2\n");
        git(work, "merge", "-q", "-s", "ours", "--no-edit", "trunk");
        return bundle(`${base}..branch`);
      },
    ],
    [
      "adds a symbolic link",
      /adds a symbolic link, link/,
      () => {
        symlinkSync("/etc/passwd", join(work, "link"));
        commit("link");
        return bundle(`${base}..branch`);
      },
    ],
    [
      "adds a submodule",
      /adds a submodule, sub/,
      () => {
        git(work, "update-index", "--add", "--cacheinfo", `160000,${base},sub`);
        git(work, "commit", "-q", "-m", "sub");
        return bundle(`${base}..branch`);
      },
    ],
    [
      "merges something other than the default branch",
      /merges something other than the default branch/,
      () => {
        git(work, "switch", "-q", "-c", "other");
        write("o.txt", "o\n");
        commit("o");
        git(work, "switch", "-q", "branch");
        write("b.txt", "b\n");
        commit("add b");
        git(work, "merge", "-q", "--no-edit", "other");
        return bundle(`${base}..branch`);
      },
    ],
    [
      "does not start from the commit handed over",
      /does not start from the commit/,
      () => {
        git(work, "switch", "-q", "--orphan", "fresh");
        write("z.txt", "z\n");
        commit("fresh");
        return bundle("fresh");
      },
    ],
    [
      "holds two branches",
      /holds more than one branch/,
      () => {
        write("b.txt", "b\n");
        commit("add b");
        git(work, "branch", "second");
        return bundle(`${base}..branch`, "second");
      },
    ],
    [
      "is not a bundle",
      /is not a bundle/,
      () => {
        writeFileSync(join(dir, "x.bundle"), "nothing of the kind\n");
        return join(dir, "x.bundle");
      },
    ],
  ];
  it.each(refused)("is refused when it %s", (_, why, make) => {
    const answer = check(make());
    expect(answer).toHaveProperty("refused");
    expect((answer as { refused: string }).refused).toMatch(why);
  });

  it("is refused when it drops a commit already published", () => {
    write("b.txt", "b\n");
    const published = commit("add b");
    git(work, "push", "-q", bare, "branch");
    git(work, "reset", "-q", "--hard", base);
    write("c.txt", "c\n");
    commit("add c");
    expect(check(bundle(`${base}..branch`), { published })).toEqual({
      refused: "it drops a commit that is already on the pull request",
    });
  });
});
