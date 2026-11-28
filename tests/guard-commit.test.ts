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
import {
  addsOverride,
  checkCommit,
  ownLauncher,
} from "../src/guard-commit.mts";
import { branchDeps } from "../src/lib/default-branch.mts";
import { CODE_HOST_YAML } from "./settings-fixture";

const LAUNCHER = new URL("../bin/lunamill.js", import.meta.url).pathname;
const MAIN_BLOCK = "main is checked out";
const GATE_BLOCK = "the gate failed";
const OVERRIDE_BLOCK = "is an approver's label";

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
 * have no lunamill settings, so a call that gets past the branch check is
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

describe("lunamill guard commit", () => {
  // These checkouts have no lunamill settings, so a commit the branch check
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

  it("lets a commit through in a repository Lunamill does not govern, one with no settings", () => {
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
          (top) => ({
            ...branchDeps(top, {}),
            git: () => ({ ok: true, out: "origin/rel.1\n" }),
          }),
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

  // Whether a checkout has `.claude/lunamill.yaml` decides which sources the
  // guard lets answer, and what it does when none does. The code host is
  // stood in for here, so no test asks one.
  describe("when the default branch cannot be told", () => {
    let repo: string;

    /** The guard on a commit in a new checkout on main, with settings that
     * name o/r or without, and these remotes: each a name, an address, and
     * the branch its HEAD names, if any. A workflow run's event names
     * `event`, if any, and the code host answers `host`, or cannot be
     * asked. */
    async function guarded(o: {
      settings: boolean;
      remotes?: [name: string, address: string, head?: string][];
      event?: string;
      host?: string;
    }) {
      repo = mkdtempSync(join(tmpdir(), "guard-git-branch-"));
      const git = (...args: string[]) =>
        execFileSync("git", args, { cwd: repo, stdio: "pipe" });
      execFileSync("git", ["init", "-q", "-b", "main", repo]);
      for (const [name, address, head] of o.remotes ?? []) {
        git("remote", "add", name, address);
        if (head)
          git(
            "symbolic-ref",
            `refs/remotes/${name}/HEAD`,
            `refs/remotes/${name}/${head}`,
          );
      }
      if (o.settings) {
        mkdirSync(join(repo, ".claude"));
        writeFileSync(
          join(repo, ".claude/lunamill.yaml"),
          `version: 1\nrepository: o/r\n${CODE_HOST_YAML}\n`,
        );
      }
      const env: Record<string, string> = {};
      if (o.event) {
        env.GITHUB_EVENT_PATH = join(repo, "event.json");
        writeFileSync(
          env.GITHUB_EVENT_PATH,
          JSON.stringify({ repository: { default_branch: o.event } }),
        );
      }
      let asked = 0;
      const block = await checkCommit(
        { cwd: repo, tool_input: { command: "git commit -m x" } },
        () => {},
        (top) => ({
          ...branchDeps(top, env),
          host: async () => {
            asked += 1;
            if (o.host === undefined) throw new Error("no code host");
            return o.host;
          },
        }),
      );
      return { block, asked };
    }

    afterEach(() => rmSync(repo, { recursive: true, force: true }));

    it("blocks the git command, naming the fix, in a checkout that has Lunamill's settings", async () => {
      const { block, asked } = await guarded({
        settings: true,
        remotes: [["origin", "https://github.com/o/r.git"]],
      });

      expect(block).toBe(
        "Could not tell the default branch. Run: git remote set-head origin --auto",
      );
      expect(asked).toBe(1);
    });

    it("lets the command through in a checkout without settings, having read origin/HEAD alone", async () => {
      const { block, asked } = await guarded({
        settings: false,
        remotes: [["origin", "https://github.com/o/r.git"]],
        event: "main",
        host: "main",
      });

      expect(block).toBeNull();
      expect(asked).toBe(0);
    });

    it("still blocks a commit on the default branch in a checkout without settings whose origin/HEAD names it", async () => {
      const { block } = await guarded({
        settings: false,
        remotes: [["origin", "https://github.com/o/r.git", "main"]],
      });

      expect(block).toBe(
        "main is checked out. Create a branch from origin/main first.",
      );
    });

    it("reads the default branch from the remote that is the settings' repository, and names that remote, whatever it is called", async () => {
      const { block } = await guarded({
        settings: true,
        remotes: [
          ["origin", "git@github.com:dev/r.git", "develop"],
          ["upstream", "git@github.com:o/r.git", "main"],
        ],
      });

      expect(block).toBe(
        "main is checked out. Create a branch from upstream/main first.",
      );
    });

    it("reads origin where its address is an SSH host alias, which names no repository Lunamill can read", async () => {
      const { block } = await guarded({
        settings: true,
        remotes: [["origin", "git@github-work:o/r.git", "main"]],
      });

      expect(block).toBe(
        "main is checked out. Create a branch from origin/main first.",
      );
    });

    it("blocks the git command with the line that names the repository, where no remote is the settings' repository", async () => {
      const { block, asked } = await guarded({
        settings: true,
        remotes: [["origin", "git@github.com:dev/r.git", "main"]],
        host: "main",
      });

      expect(block).toBe(
        "✗ repository: .claude/lunamill.yaml says o/r, and no remote here is o/r. origin is dev/r. Add the remote, or change the line and run lunamill sync.",
      );
      expect(asked).toBe(0);
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
      blocked("gh pr edit 5 --add-label verdict-override");
    });

    it("blocks adding policy-override, an approver's label too", () => {
      blocked("gh pr edit 5 --add-label policy-override");
    });

    it("blocks --add-label written with an equals sign", () => {
      blocked('gh pr edit 5 --add-label="verdict-override"');
    });

    it("blocks it in any letter case, as GitHub matches labels", () => {
      blocked("gh pr edit 5 --add-label Verdict-Override");
    });

    it("blocks adding it in a command chained after another", () => {
      blocked("echo hi && gh pr edit 5 --add-label verdict-override");
    });

    it("blocks adding it as a labels[] field", () => {
      blocked(
        "gh api -X POST repos/o/r/issues/5/labels -f labels[]=verdict-override",
      );
    });

    it("blocks a write to the labels API that names it anywhere", () => {
      blocked(
        `echo '{"labels":["verdict-override"]}' | gh api repos/o/r/issues/5/labels --input -`,
      );
    });

    it("blocks a PUT to the labels API that names it in any field", () => {
      blocked(
        "gh api --method PUT repos/o/r/issues/5/labels -f x=verdict-override",
      );
    });

    it("allows removing it", () => {
      const r = hook("gh pr edit 5 --remove-label verdict-override", feature);
      expect(r.status).toBe(0);
    });

    it("allows a comment that only mentions it", () => {
      const r = hook(
        'gh pr comment 5 --body "the verdict-override label is yours to add"',
        feature,
      );
      expect(r.status).toBe(0);
    });

    it("allows adding another label beside removing it", () => {
      const r = hook(
        "gh pr edit 5 --remove-label verdict-override --add-label bug",
        feature,
      );
      expect(r.status).toBe(0);
    });

    describe("named with a colon and a space", () => {
      const NAME = "owner: pass";

      it.each([
        'gh pr edit 5 --add-label "owner: pass"',
        'gh pr edit 5 --add-label "Owner: Pass"',
        "gh api -X POST repos/o/r/issues/5/labels -f labels[]=owner%3A%20pass",
        "gh pr edit 5 --add-label owner:+pass",
      ])("finds it added in %s", (command) => {
        expect(addsOverride(command, NAME)).toBe(true);
      });

      it("reads the name as text, not as a pattern", () => {
        expect(addsOverride("gh pr edit 5 --add-label a.b", "a+b")).toBe(false);
        expect(addsOverride("gh pr edit 5 --add-label a+b", "a+b")).toBe(true);
      });

      it("lets the default name through once the settings rename it", () => {
        expect(
          addsOverride("gh pr edit 5 --add-label verdict-override", NAME),
        ).toBe(false);
      });
    });

    describe("renamed in the checkout's lock", () => {
      let repo: string;
      afterEach(() => rmSync(repo, { recursive: true, force: true }));

      it("blocks adding the name the lock gives it", async () => {
        repo = mkdtempSync(join(tmpdir(), "guard-git-override-"));
        execFileSync("git", ["init", "-q", "-b", "feature", repo]);
        mkdirSync(join(repo, ".claude"));
        writeFileSync(
          join(repo, ".claude/lunamill.lock"),
          [
            "version: 1.0.0",
            "presets: []",
            "settings-hash: x",
            "settings:",
            "  version: 1",
            "  repository: o/r",
            "  code-host:",
            '    branch-name: "{ticket}"',
            "    labels:",
            '      verdict-override: "owner: pass"',
            '      policy-override: "owner: accepts"',
            "files: []",
            "",
          ].join("\n"),
        );
        const check = (command: string) =>
          checkCommit({ cwd: repo, tool_input: { command } }, () => {});

        expect(await check('gh pr edit 5 --add-label "owner: pass"')).toContain(
          "is an approver's label",
        );
        expect(
          await check('gh pr edit 5 --add-label "owner: accepts"'),
        ).toContain("is an approver's label");
        expect(
          await check("gh pr edit 5 --add-label verdict-override"),
        ).toBeNull();
      });
    });
  });

  // The commands come from the settings in the commit's own checkout. Here
  // each test writes them, or settings that cannot be read.
  describe("commands.before-commit", () => {
    let repo: string;
    const LOG = "ran.txt";

    function withLoader(settings: string) {
      repo = mkdtempSync(join(tmpdir(), "guard-git-settings-"));
      const git = (...args: string[]) =>
        execFileSync("git", args, { cwd: repo });
      execFileSync("git", ["init", "-q", "-b", "feature", repo]);
      // The remote the settings' `repository` line names, whose default
      // branch is main.
      git("remote", "add", "origin", "https://github.com/o/r.git");
      git(
        "symbolic-ref",
        "refs/remotes/origin/HEAD",
        "refs/remotes/origin/main",
      );
      writeSettings(repo, settings);
    }
    const ran = () =>
      existsSync(join(repo, LOG))
        ? readFileSync(join(repo, LOG), "utf8").trim().split("\n")
        : [];
    const prints = (...commands: string[]) =>
      `version: 1\nrepository: o/r\n${CODE_HOST_YAML}\ncommands:\n  before-commit: ${JSON.stringify(commands)}\n`;

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

    it("blocks a commit on the default branch of the remote the settings name", () => {
      withLoader(prints());
      execFileSync("git", ["checkout", "-q", "-b", "main"], { cwd: repo });
      const r = hook("git commit -m x", repo);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain(MAIN_BLOCK);
    });

    it("blocks a commit with the line that names the repository, in a checkout whose settings name a repository no remote has", () => {
      withLoader(prints());
      execFileSync("git", ["remote", "remove", "origin"], { cwd: repo });
      const r = hook("git commit -m x", repo);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain(
        "✗ repository: .claude/lunamill.yaml says o/r, and no remote here is o/r. Add the remote, or change the line and run lunamill sync.",
      );
    });

    it("blocks the commit when the settings cannot be read", () => {
      withLoader("version: 3\nrepository: o/r\n");
      const r = hook("git commit -m x", repo);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain("Lunamill's settings could not be read");
      expect(r.stderr).toContain("version: must be 1");
    });

    it("blocks the commit, naming the fix, when the settings changed since the last sync", () => {
      withLoader(prints(`echo one >> ${LOG}`));
      writeFileSync(join(repo, ".claude/lunamill.yaml"), prints());
      const r = hook("git commit -m x", repo);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain(
        ".claude/lunamill.yaml changed since the last sync. Run: lunamill sync",
      );
      expect(ran()).toEqual([]);
    });

    describe("with commands for some folders", () => {
      const PACKAGES = (before: string) =>
        `version: 1\nrepository: o/r\n${CODE_HOST_YAML}\ncommands:\n  gate:\n    - run: npm test\n      in: packages/*\n  before-commit:\n    - run: ${JSON.stringify(before)}\n      in: packages/*\n`;
      /** The repository committed, with two packages, and `changed`
       * edited since. */
      function packages(before: string, changed: string[]) {
        withLoader(PACKAGES(before));
        for (const name of ["api", "web"]) {
          mkdirSync(join(repo, "packages", name), { recursive: true });
          writeFileSync(join(repo, "packages", name, "a.ts"), "a\n");
        }
        const git = (...args: string[]) =>
          execFileSync(
            "git",
            [
              "-c",
              "user.email=t@e",
              "-c",
              "user.name=t",
              "-c",
              "commit.gpgsign=false",
              ...args,
            ],
            { cwd: repo },
          );
        git("add", "-A");
        git("commit", "-qm", "first");
        for (const f of changed) writeFileSync(join(repo, f), "changed\n");
      }
      const LOGGED = `echo $(basename $PWD) >> "$(git rev-parse --show-toplevel)/${LOG}"`;

      it("runs a command only in the folders the change touches", () => {
        packages(LOGGED, ["packages/api/a.ts"]);
        const r = hook("git commit -m x", repo);
        expect(r.status).toBe(0);
        expect(ran()).toEqual(["api"]);
      });

      it("runs every command when a file no gate command covers changed", () => {
        packages(LOGGED, ["README.md"]);
        const r = hook("git commit -m x", repo);
        expect(r.status).toBe(0);
        expect(ran()).toEqual(["api", "web"]);
      });

      it("names each folder a command failed in, after running it in each", () => {
        packages(`${LOGGED}; exit 1`, [
          "packages/api/a.ts",
          "packages/web/a.ts",
        ]);
        const r = hook("git commit -m x", repo);
        expect(r.status).toBe(2);
        expect(ran()).toEqual(["api", "web"]);
        expect(r.stderr).toContain(
          `the gate failed on: cd packages/api && ${LOGGED}; exit 1, cd packages/web && ${LOGGED}; exit 1. Fix the errors above, then commit.`,
        );
      });
    });

    it("blocks the commit on settings that still have before-commit at the top level, saying where it moved", () => {
      withLoader(
        `version: 1\nrepository: o/r\n${CODE_HOST_YAML}\nbefore-commit: ["echo old >> ${LOG}"]\n`,
      );
      const r = hook("git commit -m x", repo);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain(
        "before-commit: moved to commands.before-commit",
      );
      expect(ran()).toEqual([]);
    });

    describe("in a checkout with its own copy of Lunamill", () => {
      const PACKAGE = dirname(dirname(LAUNCHER));
      const CHECKOUT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
        cwd: PACKAGE,
        encoding: "utf8",
      }).trim();
      const ASKED = "asked.json";

      /** A checkout whose settings have a key this copy does not know, as a
       * branch that adds one has, and a copy of lunamill, where this one
       * sits in its checkout, that records the call and exits with `status`. */
      function withOwnCopy(status: number) {
        withLoader(
          `version: 1\nrepository: o/r\n${CODE_HOST_YAML}\nadded-on-this-branch: 1\n`,
        );
        const bin = join(repo, relative(CHECKOUT, PACKAGE), "bin");
        mkdirSync(bin, { recursive: true });
        writeFileSync(
          join(bin, "lunamill.js"),
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
