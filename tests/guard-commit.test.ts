import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { writeSettings } from "./locked.ts";
import { checkCommit, ownLauncher } from "../src/guard-commit.mts";
import { CANNOT_TELL, type Sources } from "../src/lib/default-branch.mts";
import { CODE_HOST_YAML } from "./settings-fixture";

const LAUNCHER = new URL("../bin/factory.js", import.meta.url).pathname;
const MAIN_BLOCK = "main is checked out";
const GATE_BLOCK = "the gate failed";
const OVERRIDE_BLOCK = "is the owner's label";

// A repository on main with a worktree beside it on a feature branch, the
// layout a local session builds in. Its `origin/HEAD` says main is the
// default branch, as a clone's does. Beside them, a repository whose default
// branch is develop, with develop checked out, and worktrees of it on main
// and on a feature branch.
let root: string;
let main: string;
let feature: string;
let develop: string;
let developMain: string;
let developFeature: string;

/** A repository at `dir` with one commit on `branch`, and an `origin/HEAD`
 * that names `branch` the default. */
function repository(dir: string, branch: string) {
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, stdio: "pipe" });
  execFileSync("git", ["init", "-q", "-b", branch, dir]);
  git(
    "-c",
    "user.name=t",
    "-c",
    "user.email=t@t",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "init",
  );
  git("update-ref", `refs/remotes/origin/${branch}`, "HEAD");
  git(
    "symbolic-ref",
    "refs/remotes/origin/HEAD",
    `refs/remotes/origin/${branch}`,
  );
  return git;
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "guard-git-"));
  main = join(root, "main");
  feature = join(root, "feature");
  develop = join(root, "develop");
  developMain = join(root, "develop-main");
  developFeature = join(root, "develop-feature");
  repository(main, "main")("worktree", "add", "-q", "-b", "feature", feature);
  const git = repository(develop, "develop");
  git("worktree", "add", "-q", "-b", "main", developMain);
  git("worktree", "add", "-q", "-b", "feature", developFeature);
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

/** Runs the hook on a Bash call made from `cwd`. These bare repositories
 * have no factory settings, so a call that gets past the branch check is
 * let through. */
function hook(command: string, cwd: string) {
  return spawnSync("node", [LAUNCHER, "guard", "commit"], {
    input: JSON.stringify({ cwd, tool_input: { command } }),
    encoding: "utf8",
    // A workflow run's event names the default branch of the repository
    // the tests run in, not of these.
    env: { ...process.env, GITHUB_EVENT_PATH: "" },
  });
}

describe("factory guard commit", () => {
  // These checkouts have no factory settings, so a commit the branch check
  // lets through is let through whole.
  it("reads the branch from the directory a command cds into", () => {
    const r = hook(`cd ${feature} && git commit -m x`, main);
    expect(r.status).toBe(0);
    expect(r.stderr).not.toContain(MAIN_BLOCK);
  });

  it("blocks a commit that cds into a checkout on main", () => {
    const r = hook(`cd ${main} && git commit -m x`, feature);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain(MAIN_BLOCK);
  });

  it("reads the branch from git -C's directory", () => {
    const r = hook(`git -C ${feature} commit -m x`, main);
    expect(r.status).toBe(0);
    expect(r.stderr).not.toContain(MAIN_BLOCK);
  });

  it("lets a commit through in a repository the factory does not govern, one with no settings", () => {
    const r = hook("git commit -m x", feature);
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
  });

  // The hook blanks quoted text with a $ in it, so it cannot tell where
  // `cd "$D"` goes; it then reads the session's directory, as before.
  it("blocks a commit after a cd it cannot follow, from main", () => {
    const r = hook('cd "$D" && git commit -m x', main);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain(MAIN_BLOCK);
  });

  it("ends a cd at the close of its subshell", () => {
    const r = hook(`(cd ${feature} && git status) && git commit -m x`, main);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain(MAIN_BLOCK);
  });

  it("blocks git -c key=value commit on main", () => {
    const r = hook("git -c user.name=x commit -m x", main);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain(MAIN_BLOCK);
  });

  it("blocks git -c key=value push to main", () => {
    const r = hook("git -c http.extraHeader=x push origin main", feature);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("pushing to main");
  });

  describe("a default branch that is not called main", () => {
    it("blocks a commit with the default branch checked out, by its name", () => {
      const r = hook("git commit -m x", develop);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain(
        "develop is checked out. Create a branch from origin/develop first.",
      );
    });

    it("lets a commit through on a branch called main there", () => {
      const r = hook("git commit -m x", developMain);
      expect([r.status, r.stderr]).toEqual([0, ""]);
    });

    it("blocks a push to the default branch, by its name", () => {
      const r = hook("git push origin develop", developFeature);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain(
        "pushing to develop. develop only changes through a merged pull request.",
      );
    });

    it("blocks a push of another branch to the default one", () => {
      const r = hook("git push origin HEAD:refs/heads/develop", developFeature);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain("pushing to develop.");
    });

    it("lets a push to a branch called main through there", () => {
      const r = hook("git push origin main", developFeature);
      expect([r.status, r.stderr]).toEqual([0, ""]);
    });

    it("reads a branch name as text, not as a pattern, in a push", async () => {
      const push = (to: string) =>
        checkCommit(
          { cwd: feature, tool_input: { command: `git push origin ${to}` } },
          () => {},
          async () => "rel.1",
        );

      expect(await push("relx1")).toBeNull();
      expect(await push("rel.1")).toBe(
        "pushing to rel.1. rel.1 only changes through a merged pull request.",
      );
    });

    it("reads each checkout's own default branch in one call", () => {
      const r = hook(
        `git -C ${developMain} commit -m x && git -C ${main} commit -m x`,
        developFeature,
      );
      expect(r.status).toBe(2);
      expect(r.stderr).toContain("main is checked out.");
    });
  });

  // Whether a checkout has `.claude/factory.yaml` decides which sources the
  // guard lets answer, and what it does when none does. The sources are
  // stood in for here, so no test asks a code host.
  describe("when the default branch cannot be told", () => {
    let repo: string;

    /** The guard on a commit in a new checkout on main, with settings or
     * without, whose default branch is what `answer` gives. */
    async function guarded(settings: boolean, answer: string | null) {
      repo = mkdtempSync(join(tmpdir(), "guard-git-branch-"));
      execFileSync("git", ["init", "-q", "-b", "main", repo]);
      if (settings) {
        mkdirSync(join(repo, ".claude"));
        writeFileSync(
          join(repo, ".claude/factory.yaml"),
          `version: 2\nrepository: o/r\n${CODE_HOST_YAML}\n`,
        );
      }
      const asked: [string, Sources][] = [];
      const block = await checkCommit(
        { cwd: repo, tool_input: { command: "git commit -m x" } },
        () => {},
        async (top, sources) => {
          asked.push([top, sources]);
          return answer;
        },
      );
      return { block, asked };
    }

    afterEach(() => rmSync(repo, { recursive: true, force: true }));

    it("blocks the git command, naming the fix, in a checkout that has the factory's settings", async () => {
      const { block, asked } = await guarded(true, null);

      expect(block).toBe(
        "Could not tell the default branch. Run: git remote set-head origin --auto",
      );
      expect(block).toBe(CANNOT_TELL);
      expect(asked).toEqual([[realpathSync(repo), "all"]]);
    });

    it("lets the command through in a checkout without settings, having read origin/HEAD alone", async () => {
      const { block, asked } = await guarded(false, null);

      expect(block).toBeNull();
      expect(asked).toEqual([[realpathSync(repo), "origin-head"]]);
    });

    it("still blocks a commit on the default branch in a checkout without settings whose origin/HEAD names it", async () => {
      const { block } = await guarded(false, "main");

      expect(block).toBe(
        "main is checked out. Create a branch from origin/main first.",
      );
    });

    it("lets a commit through, through the hook, in a checkout with no settings and no origin/HEAD", () => {
      repo = mkdtempSync(join(tmpdir(), "guard-git-branch-"));
      execFileSync("git", ["init", "-q", "-b", "main", repo]);
      execFileSync("git", ["remote", "add", "origin", "https://x.invalid/r"], {
        cwd: repo,
      });

      const r = hook("git commit -m x", repo);

      expect([r.status, r.stderr]).toEqual([0, ""]);
    });
  });

  describe("the override label", () => {
    const blocked = (command: string) => {
      const r = hook(command, feature);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain(OVERRIDE_BLOCK);
    };

    it("blocks adding it with --add-label", () => {
      blocked('gh pr edit 5 --add-label "verdict: override"');
    });

    it("blocks --add-label written with an equals sign", () => {
      blocked('gh pr edit 5 --add-label="verdict: override"');
    });

    it("blocks it in any letter case, as GitHub matches labels", () => {
      blocked('gh pr edit 5 --add-label "Verdict: Override"');
    });

    it("blocks adding it in a command chained after another", () => {
      blocked('echo hi && gh pr edit 5 --add-label "verdict: override"');
    });

    it("blocks adding it as a labels[] field", () => {
      blocked(
        'gh api -X POST repos/o/r/issues/5/labels -f "labels[]=verdict: override"',
      );
    });

    it("blocks a write to the labels API that names it anywhere", () => {
      blocked(
        `echo '{"labels":["verdict: override"]}' | gh api repos/o/r/issues/5/labels --input -`,
      );
    });

    it("blocks a PUT to the labels API that names it in any field", () => {
      blocked(
        'gh api --method PUT repos/o/r/issues/5/labels -f "x=verdict: override"',
      );
    });

    it("blocks it written with an encoded colon and space", () => {
      blocked(
        "gh api -X POST repos/o/r/issues/5/labels -f labels[]=verdict%3A%20override",
      );
    });

    it("blocks it written with a plus for the space", () => {
      blocked("gh pr edit 5 --add-label verdict:+override");
    });

    it("allows removing it", () => {
      const r = hook(
        'gh pr edit 5 --remove-label "verdict: override"',
        feature,
      );
      expect(r.status).toBe(0);
    });

    it("allows a comment that only mentions it", () => {
      const r = hook(
        'gh pr comment 5 --body "the verdict: override label is yours to add"',
        feature,
      );
      expect(r.status).toBe(0);
    });

    it("allows adding another label beside removing it", () => {
      const r = hook(
        'gh pr edit 5 --remove-label "verdict: override" --add-label bug',
        feature,
      );
      expect(r.status).toBe(0);
    });
  });

  // The commands come from the settings in the commit's own checkout. Here
  // each test writes them, or settings that cannot be read.
  describe("commands.before-commit", () => {
    let repo: string;
    const LOG = "ran.txt";

    function withLoader(settings: string) {
      repo = mkdtempSync(join(tmpdir(), "guard-git-settings-"));
      execFileSync("git", ["init", "-q", "-b", "feature", repo]);
      // With no origin remote, the default branch is git's own: set here, so
      // the machine's own setting does not decide it.
      execFileSync("git", ["config", "init.defaultBranch", "main"], {
        cwd: repo,
      });
      writeSettings(repo, settings);
    }
    const ran = () =>
      existsSync(join(repo, LOG))
        ? readFileSync(join(repo, LOG), "utf8").trim().split("\n")
        : [];
    const prints = (...commands: string[]) =>
      `version: 2\nrepository: o/r\n${CODE_HOST_YAML}\ncommands:\n  before-commit: ${JSON.stringify(commands)}\n`;

    afterEach(() => rmSync(repo, { recursive: true, force: true }));

    it("runs every command, in order, and lets the commit through when all pass", () => {
      withLoader(prints(`echo one >> ${LOG}`, `echo two >> ${LOG}`));
      const r = hook("git commit -m x", repo);
      expect(r.status).toBe(0);
      expect(ran()).toEqual(["one", "two"]);
    });

    it("stops at the first command that fails and blocks the commit", () => {
      withLoader(
        prints(
          `echo one >> ${LOG}`,
          "echo OUT-9 >&2; exit 1",
          `echo three >> ${LOG}`,
        ),
      );
      const r = hook("git commit -m x", repo);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain(GATE_BLOCK);
      expect(r.stderr).toContain("OUT-9\n");
      expect(r.stderr).toContain(
        "the gate failed on: echo OUT-9 >&2; exit 1. Fix the errors above, then commit.",
      );
      expect(ran()).toEqual(["one"]);
    });

    it("runs the commands from the repository's root, whatever folder the commit is made in", () => {
      withLoader(prints("pwd > where.txt"));
      mkdirSync(join(repo, "src/deep"), { recursive: true });
      const r = hook("git commit -m x", join(repo, "src/deep"));
      expect(r.status).toBe(0);
      expect(existsSync(join(repo, "src/deep/where.txt"))).toBe(false);
      expect(readFileSync(join(repo, "where.txt"), "utf8").trim()).toBe(
        realpathSync(repo),
      );
    });

    it("gives a command no standard input, so it cannot swallow the commands after it", () => {
      withLoader(prints("cat > /dev/null", "echo SECOND-RAN >&2; exit 1"));
      const r = hook("git commit -m x", repo);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain("SECOND-RAN");
    });

    it("blocks a commit on git's own default branch in a checkout with settings and no origin remote", () => {
      withLoader(prints());
      execFileSync("git", ["checkout", "-q", "-b", "main"], { cwd: repo });
      const r = hook("git commit -m x", repo);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain(MAIN_BLOCK);
    });

    it("blocks the commit when the settings cannot be read", () => {
      withLoader("version: 3\nrepository: o/r\n");
      const r = hook("git commit -m x", repo);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain("the factory's settings could not be read");
      expect(r.stderr).toContain("version: must be 2");
    });

    it("blocks the commit, naming the fix, when the settings changed since the last sync", () => {
      withLoader(prints(`echo one >> ${LOG}`));
      writeFileSync(join(repo, ".claude/factory.yaml"), prints());
      const r = hook("git commit -m x", repo);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain(
        ".claude/factory.yaml changed since the last sync. Run: npx --no-install factory sync",
      );
      expect(ran()).toEqual([]);
    });

    it("blocks the commit on settings that still have before-commit at the top level, saying where it moved", () => {
      withLoader(
        `version: 2\nrepository: o/r\n${CODE_HOST_YAML}\nbefore-commit: ["echo old >> ${LOG}"]\n`,
      );
      const r = hook("git commit -m x", repo);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain(
        "before-commit: moved to commands.before-commit",
      );
      expect(ran()).toEqual([]);
    });

    describe("in a checkout with its own copy of the factory", () => {
      const PACKAGE = dirname(dirname(LAUNCHER));
      const CHECKOUT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
        cwd: PACKAGE,
        encoding: "utf8",
      }).trim();
      const ASKED = "asked.json";

      /** A checkout whose settings have a key this copy does not know, as a
       * branch that adds one has, and a copy of the factory, where this one
       * sits in its checkout, that records the call and exits with `status`. */
      function withOwnCopy(status: number) {
        withLoader(
          `version: 2\nrepository: o/r\n${CODE_HOST_YAML}\nadded-on-this-branch: 1\n`,
        );
        const bin = join(repo, relative(CHECKOUT, PACKAGE), "bin");
        mkdirSync(bin, { recursive: true });
        writeFileSync(
          join(bin, "factory.js"),
          `const fs = require("fs");
           fs.writeFileSync(${JSON.stringify(join(repo, ASKED))}, JSON.stringify({
             args: process.argv.slice(2),
             cwd: process.cwd(),
             input: JSON.parse(fs.readFileSync(0, "utf8")),
           }));
           if (${status}) console.error("OWN-COPY-SAYS-NO");
           process.exit(${status});`,
        );
      }

      it("has that copy check the commit, with the call as it was made", () => {
        withOwnCopy(0);
        const r = hook(`git -C ${repo} commit -m x`, main);
        expect([r.status, r.stderr]).toEqual([0, ""]);
        expect(JSON.parse(readFileSync(join(repo, ASKED), "utf8"))).toEqual({
          args: ["guard", "commit"],
          cwd: realpathSync(repo),
          input: {
            cwd: main,
            tool_input: { command: `git -C ${repo} commit -m x` },
          },
        });
      });

      it("blocks the commit when that copy does, and shows what it said", () => {
        withOwnCopy(2);
        const r = hook("git commit -m x", repo);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain("OWN-COPY-SAYS-NO");
      });

      it("checks a commit in its own checkout itself", () => {
        expect(ownLauncher(CHECKOUT)).toBeNull();
      });
    });
  });
});
