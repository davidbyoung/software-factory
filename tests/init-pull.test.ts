// `factory init`, from "Go ahead?" to the pull request: the plan's rows,
// the gate, the branch and its commit, the push, the pull request, the
// lines when one of those fails, and the rule that requires the review's
// verdict.
import { docsPage } from "../src/init-shared.mts";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileRows, openPull, runGate, type GitResult } from "../src/init.mts";
import { writeCredential } from "../src/lib/credentials.mts";
import { IMPORT_LINE, withHooks } from "../src/sync.mts";
import { CODE_HOST_YAML } from "./settings-fixture";
import { AGENT, GOOD, init, type Setup } from "./init-harness";
import { into } from "./printed";

const GATED = `version: 2\nrepository: acme/site\n${CODE_HOST_YAML}\ncommands:\n  gate:\n    - npm run check\n`;
const OPENED_FIRST = '✓ Opened acme/site#1, "Set up the software factory".';
/** A run that goes ahead with no part on. */
const quick = (over: Partial<Setup> = {}) =>
  init({ answers: { checkbox: [[]], confirm: [true] }, ...over });
/** The plan's rows, as printed. */
const planOf = (out: string[]) => {
  const at = out.indexOf("This is everything setup will do:");
  const end = out.findIndex((l, i) => i > at && !l.startsWith("  "));
  return out.slice(at + 1, end < 0 ? undefined : end);
};
const commands = (git: string[][]) => git.map((args) => args[0]);

describe("factory init, the plan's rows", () => {
  it("names the settings, the copies, and the workflows in one row each, and the pull request last", async () => {
    const r = quick({
      syncs: [
        ".claude/skills/factory-build/SKILL.md",
        ".claude/factory/rules.md",
        ".github/workflows/factory.yml",
        ".github/workflows/factory-review.yml",
        ".claude/factory.lock",
      ],
      answers: {
        checkbox: [["auto-merge"]],
        input: ["docs/**"],
        confirm: [true],
        secret: [""],
      },
    });
    await r.run();
    const at = r.out.indexOf("This is everything setup will do:");
    expect(r.out.slice(at + 1, at + 7)).toEqual([
      "  settings      Write .claude/factory.yaml and .claude/factory.lock",
      "  files         Copy the factory's skills, agents, rules, and guards",
      "  workflows     Write .github/workflows/factory.yml and factory-review.yml",
      "  secrets       FACTORY_AUTOMERGE_TOKEN",
      "  store         your GitHub token on this machine, in " +
        `${r.env.XDG_CONFIG_HOME}/software-factory/credentials.yaml`,
      "  repository    allow auto-merge on the repository",
    ]);
    expect(planOf(r.out).at(-1)).toBe(
      "  pull request  Push the branch set-up-factory and open a pull request",
    );
  });

  it("has a row only for the kind of file that changes", () => {
    expect(fileRows([], null)).toEqual([]);
    expect(fileRows([".github/workflows/factory.yml"], null)).toEqual([
      ["workflows", "Write .github/workflows/factory.yml"],
    ]);
    expect(
      fileRows(
        [
          "package.json",
          ".claude/factory.choices.yaml",
          ".gitignore",
          ".claude/agents/acme.md",
        ],
        "acme's own agent",
      ),
    ).toEqual([
      [
        "settings",
        "Write .claude/factory.choices.yaml, package.json, and .gitignore",
      ],
      [
        "files",
        "Copy the factory's skills, agents, rules, and guards, and acme's own agent",
      ],
    ]);
  });

  it("asks whether to go ahead with no for Enter", async () => {
    const r = quick();
    await r.run();
    expect(r.fallbacks["Go ahead?"]).toBe(false);
  });

  it("plans no pull request, makes no branch, and says the files already match, when no file would change", async () => {
    const r = quick({ settings: `${GATED}specs: none\n`, syncs: [] });
    expect(await r.run()).toBe(0);
    expect(planOf(r.out)).toEqual([]);
    expect(r.out).toContain("Nothing to commit: the files already match.");
    expect(commands(r.git)).not.toContain("switch");
    expect(r.read(".claude/factory.yaml")).toBe(`${GATED}specs: none\n`);
  });
});

describe("factory init, the gate", () => {
  it("runs each gate command after the sync, and says they pass", async () => {
    const r = quick({ settings: GATED });
    expect(await r.run()).toBe(0);
    expect(r.gates).toEqual([{ command: "npm run check", syncedBefore: 1 }]);
    const at = r.out.indexOf("✓ npm run check passes here.");
    expect(r.out.slice(at - 1, at + 3)).toEqual([
      "",
      "✓ npm run check passes here.",
      '✓ Opened acme/site#1, "Change the software factory\'s settings".',
      "Merge it to finish. Nothing else is left to do.",
    ]);
  });

  it("runs the command the question was answered with", async () => {
    const r = quick({
      answers: { checkbox: [[]], confirm: [true], gate: ["make check"] },
    });
    expect(await r.run()).toBe(0);
    expect(r.ran).toContainEqual(["gate", "make check"]);
    expect(r.out).toContain("✓ make check passes here.");
  });

  it("names several commands as a list", async () => {
    const out: string[] = [];
    const passed = await runGate(
      {
        gate: async () => ({ status: 0, output: "" }),
        out: into(out),
      },
      ["npm run lint", "npm test"],
    );
    expect(passed).toBe(true);
    expect(out).toEqual(["✓ npm run lint and npm test pass here."]);
  });

  it("prints the failing command's last five lines, commits nothing, and exits 1", async () => {
    const r = quick({
      settings: GATED,
      gate: {
        "npm run check": {
          status: 1,
          output:
            "one\ntwo\nthree\nfour\nfive\nsrc/cart.test.ts: 2 tests failed\n",
        },
      },
    });
    expect(await r.run()).toBe(1);
    expect(r.out.slice(-7)).toEqual([
      "✗ npm run check fails here, so a build could not finish:",
      "    two",
      "    three",
      "    four",
      "    five",
      "    src/cart.test.ts: 2 tests failed",
      "Fix it, or change commands.gate in .claude/factory.yaml, then run factory init again. Nothing is committed.",
    ]);
    expect(commands(r.git)).not.toContain("commit");
    expect(commands(r.git)).not.toContain("switch");
    await expect(r.host.codeHost.listOpen()).resolves.toEqual([]);
  });

  it("stops at the first command that fails", async () => {
    const ran: string[] = [];
    const out: string[] = [];
    const passed = await runGate(
      {
        gate: async (command) => {
          ran.push(command);
          return { status: command === "b" ? 2 : 0, output: "boom\n" };
        },
        out: into(out),
      },
      ["a", "b", "c"],
    );
    expect(passed).toBe(false);
    expect(ran).toEqual(["a", "b"]);
    expect(out[0]).toBe("✗ b fails here, so a build could not finish:");
  });

  it("leaves the command's own output as it is, its marks and addresses too", async () => {
    const looks: string[] = [];
    await runGate(
      {
        gate: async () => ({
          status: 1,
          output: "✗ it broke, see https://a.example\nRun: factory init\n",
        }),
        out: into([], looks),
      },
      ["a"],
    );
    expect(looks.slice(0, 3)).toEqual([
      "{bad:✗} a fails here, so a build could not finish:",
      "    ✗ it broke, see https://a.example",
      "    Run: factory init",
    ]);
  });

  it("runs none when nothing sets a gate", async () => {
    const r = quick();
    expect(await r.run()).toBe(0);
    expect(r.ran.filter((argv) => argv[0] === "gate")).toEqual([]);
    expect(r.out.join("\n")).not.toMatch(/(pass|passes|fails) here/);
  });
});

describe("factory init, the branch and its commit", () => {
  /** What git was asked after the name of a command it ran once. */
  const ran = (r: ReturnType<typeof init>, command: string) => {
    const calls = r.git.filter((args) => args[0] === command);
    expect(calls).toHaveLength(1);
    return calls[0]!.slice(1);
  };

  it("makes the branch set-up-factory from the commit checked out, moving to no other first", async () => {
    const r = quick();
    expect(await r.run()).toBe(0);
    const made = ran(r, "switch");
    expect(made).toContain("-c");
    // The name comes last: a commit named after it would be where the
    // branch starts.
    expect(made.at(-1)).toBe("set-up-factory");
    expect(
      commands(r.git).filter((c) =>
        ["checkout", "reset", "merge", "rebase", "pull"].includes(c),
      ),
    ).toEqual([]);
  });

  it("pushes the branch to the remote of the repository chosen, not to origin", async () => {
    const r = init({
      remotes: [
        { name: "origin", url: "git@github.com:dev/web.git" },
        { name: "upstream", url: "git@github.com:acme/web.git" },
      ],
      forks: { "dev/web": "acme/web" },
      answers: { select: ["acme/web"], checkbox: [[]], confirm: [true] },
    });
    expect(await r.run()).toBe(0);
    const pushed = ran(r, "push");
    expect(pushed).toContain("upstream");
    expect(pushed).toContain("set-up-factory");
    expect(pushed).not.toContain("origin");
  });

  it("hands on the paths it wrote itself and the paths the sync would change, and no other", async () => {
    const syncs = [
      ".claude/skills/factory-build/SKILL.md",
      ".github/workflows/factory.yml",
      ".claude/factory.lock",
    ];
    const r = quick({
      syncs,
      packageJson: false,
      answers: { checkbox: [[]], confirm: [true], specs: ["openspec"] },
    });
    expect(await r.run()).toBe(0);
    const asked = ran(r, "status");
    expect(asked.slice(asked.indexOf("--") + 1).sort()).toEqual(
      [
        ".claude/factory.yaml",
        "package.json",
        ".gitignore",
        // What the spec tool's install writes.
        "package-lock.json",
        ...syncs,
      ].sort(),
    );
  });

  it("names the branch it will take in the plan, and makes that one", async () => {
    const r = quick({
      git: (args) =>
        args[0] === "ls-remote" && args.at(-1) === "set-up-factory"
          ? { status: 0 }
          : undefined,
    });
    await r.run();
    expect(r.out).toContain(
      "  pull request  Push the branch set-up-factory-2 and open a pull request",
    );
    expect(r.git).toContainEqual([
      "switch",
      "--quiet",
      "-c",
      "set-up-factory-2",
    ]);
  });

  it("opens a pull request into the default branch that is no draft, described by the plan's rows", async () => {
    const r = quick({ defaultBranch: "trunk" });
    await r.run();
    const pull = await r.host.codeHost.get(1);
    expect(pull).toMatchObject({
      title: "Set up the software factory",
      isDraft: false,
      head: { branch: "set-up-factory" },
      base: { branch: "trunk" },
    });
    expect(pull.body).toBe(
      [
        "```text",
        "settings      Write .claude/factory.yaml",
        "files         Copy the factory's skills, agents, rules, and guards",
        "pull request  Push the branch set-up-factory and open a pull request",
        "```",
        "",
      ].join("\n"),
    );
  });

  it("titles it a change when the default branch has a settings file", async () => {
    const r = quick({ settings: GATED });
    await r.run();
    expect(r.git).toContainEqual([
      "cat-file",
      "-e",
      "base000:.claude/factory.yaml",
    ]);
    expect((await r.host.codeHost.get(1)).title).toBe(
      "Change the software factory's settings",
    );
    expect(r.out).toContain(
      '✓ Opened acme/site#1, "Change the software factory\'s settings".',
    );
  });

  it("titles it a setup when only this checkout has a settings file", async () => {
    const r = quick({
      settings: GATED,
      git: (args) => (args[0] === "cat-file" ? { status: 128 } : undefined),
    });
    await r.run();
    expect((await r.host.codeHost.get(1)).title).toBe(
      "Set up the software factory",
    );
  });
});

describe("factory init, its closing lines", () => {
  const ADDRESS =
    "https://github.com/davidbyoung/software-factory/blob/v0.2.0/docs/quick-start.md#4-open-a-ticket";
  /** What comes after the setup merges, for a default branch. */
  const after = (branch: string) => [
    "After it merges:",
    `  1. Come back to ${branch} and bring it up to date:`,
    `       git switch ${branch} && git pull`,
    "  2. Start a new session of your coding agent here. It loads the factory from the files now in your repository.",
    "  3. Refine a ticket with /factory-refine N, then build it with /factory-build N.",
    "The steps in full:",
    `     ${ADDRESS}`,
  ];
  const LATER =
    "After it merges, come back to main and bring it up to date: git switch main && git pull";
  /** The lines from the one that says a pull request was opened. */
  const ending = (out: string[]) =>
    out.slice(out.findIndex((l) => l.startsWith("✓ Opened")) + 1);

  it("says what to do after the first setup merges, when nothing else is left", async () => {
    const r = quick({
      answers: { checkbox: [[]], confirm: [true], gate: ["npm test"] },
    });
    await r.run();
    expect(ending(r.out)).toEqual([
      "Merge it to finish. Nothing else is left to do.",
      "",
      ...after("main"),
      "",
      "Checks",
      "  ✓ Every check passed",
    ]);
  });

  it("says it after the list of what is left, which has no step to commit", async () => {
    const r = quick();
    await r.run();
    expect(r.out).toContain(OPENED_FIRST);
    expect(ending(r.out)).toEqual([
      "Merge it to finish. Left to do:",
      "  1. Add the commands that check a change, under commands.gate in .claude/factory.yaml",
      "",
      ...after("main"),
      "",
      "Checks",
      "  ✓ Every check passed",
    ]);
    expect(r.out.join("\n")).not.toMatch(/Commit this|Nothing is committed/);
  });

  it("names the default branch to come back to, whatever it is called", async () => {
    const r = quick({ defaultBranch: "trunk" });
    await r.run();
    expect(ending(r.out).slice(3, 6)).toEqual(after("trunk").slice(0, 3));
  });

  it("says only to come back and bring the branch up to date after a later run's pull request", async () => {
    const r = quick({ settings: GATED });
    await r.run();
    expect(ending(r.out)).toEqual([
      "Merge it to finish. Nothing else is left to do.",
      "",
      LATER,
      "",
      "Checks",
      "  ✓ Every check passed",
    ]);
    expect(r.out.join("\n")).not.toContain("quick-start");
  });

  it("names the docs at the installed release, and on main for a version that is no release", () => {
    expect(docsPage("0.2.0", "quick-start.md#4-open-a-ticket")).toBe(ADDRESS);
    expect(docsPage("0.0.0-development", "quick-start.md")).toBe(
      "https://github.com/davidbyoung/software-factory/blob/main/docs/quick-start.md",
    );
    expect(docsPage("main", "cli.md")).toMatch(/\/blob\/main\/docs\//);
  });

  it("names a page and a heading the docs have", async () => {
    const r = quick();
    await r.run();
    const [, page, anchor] = /\/docs\/([^#]+)#(.+)$/.exec(
      r.out.find((l) => l.includes("/docs/"))!,
    )!;
    // A heading's anchor as the code host makes it: lowercase, no
    // punctuation, a hyphen for each space.
    const anchors = readFileSync(join("docs", page!), "utf8")
      .split("\n")
      .filter((l) => /^#+ /.test(l))
      .map((l) =>
        l
          .replace(/^#+ /, "")
          .toLowerCase()
          .replace(/[^a-z0-9 -]/g, "")
          .replace(/ /g, "-"),
      );
    expect(anchors).toContain(anchor);
  });

  it.each([
    ["told not to go ahead", { answers: { checkbox: [[]], confirm: [false] } }],
    [
      "no file changed",
      {
        git: (args: string[]) =>
          args[0] === "status" ? { stdout: "" } : undefined,
      },
    ],
    [
      "the push is refused",
      {
        git: (args: string[]) =>
          args[0] === "push"
            ? { status: 1, stderr: "remote: no\n" }
            : undefined,
      },
    ],
    ["the sync failed", { syncFails: true }],
    [
      "the gate fails",
      {
        settings: GATED,
        gate: { "npm run check": { status: 1, output: "no\n" } },
      },
    ],
  ] as [string, Partial<Setup>][])(
    "says nothing of after the merge when %s, since no pull request was opened",
    async (_, over) => {
      const r = quick(over);
      await r.run();
      expect(r.out.join("\n")).not.toMatch(/After it merges|The steps in full/);
    },
  );
});

describe("factory init, a step that fails after the files are written", () => {
  it("says git's last line when the commit fails, and where the work is", async () => {
    const r = quick({
      git: (args) =>
        args[0] === "commit"
          ? {
              status: 1,
              stderr:
                "hint: run a formatter\nerror: gpg failed to sign the data\nfatal: failed to write commit object\n",
            }
          : undefined,
    });
    expect(await r.run()).toBe(1);
    expect(r.out.slice(-2)).toEqual([
      "✗ Could not commit: fatal: failed to write commit object",
      "The files are written, and nothing is committed.",
    ]);
    expect(commands(r.git)).not.toContain("push");
  });

  it("says so the same way when the branch cannot be made", async () => {
    const r = quick({
      git: (args) =>
        args[0] === "switch"
          ? {
              status: 128,
              stderr: "fatal: a branch named 'set-up-factory' already exists\n",
            }
          : undefined,
    });
    expect(await r.run()).toBe(1);
    expect(r.out.slice(-2)).toEqual([
      "✗ Could not commit: fatal: a branch named 'set-up-factory' already exists",
      "The files are written, and nothing is committed.",
    ]);
    expect(commands(r.git)).not.toContain("add");
  });

  it("says what the remote said when the push is refused, and that the commit is on the branch here", async () => {
    const r = quick({
      git: (args) =>
        args[0] === "push"
          ? {
              status: 128,
              stderr:
                "remote: Permission to acme/site.git denied to dev.\nfatal: unable to access 'https://github.com/acme/site.git/': The requested URL returned error: 403\n",
            }
          : undefined,
    });
    expect(await r.run()).toBe(1);
    expect(r.out.slice(-2)).toEqual([
      "✗ Could not push set-up-factory to acme/site: remote: Permission to acme/site.git denied to dev.",
      "The commit is on the branch set-up-factory here. Push it and open a pull request.",
    ]);
    await expect(r.host.codeHost.listOpen()).resolves.toEqual([]);
  });

  it("says git's own line for a push the remote said nothing about", async () => {
    const r = quick({
      git: (args) =>
        args[0] === "push"
          ? {
              status: 128,
              stderr: "fatal: Could not read from remote repository.\n",
            }
          : undefined,
    });
    await r.run();
    expect(r.out.at(-2)).toBe(
      "✗ Could not push set-up-factory to acme/site: fatal: Could not read from remote repository.",
    );
  });

  it("says the code host's reason when it will not open the pull request, and that the branch is pushed", async () => {
    const r = quick({
      codeHostFails: {
        create: new Error(
          "403 Resource not accessible by personal access token",
        ),
      },
    });
    expect(await r.run()).toBe(1);
    expect(r.out.slice(-2)).toEqual([
      "✗ Could not open a pull request in acme/site: 403 Resource not accessible by personal access token",
      "The branch set-up-factory is pushed. Open a pull request from it.",
    ]);
  });

  it("runs no gate and commits nothing after a sync that failed, and says so", async () => {
    const r = quick({ settings: GATED, syncFails: true });
    await r.run();
    const at = r.out.indexOf("The sync failed, as above.");
    expect(r.out.slice(at, at + 3)).toEqual([
      "The sync failed, as above.",
      "",
      "The files are written, and nothing is committed.",
    ]);
    expect(r.ran).toEqual([]);
    expect(commands(r.git)).not.toContain("switch");
  });

  it("stops before its first question when the code host cannot say the default branch", async () => {
    const r = quick({
      codeHostFails: { defaultBranch: new Error("HTTP 502") },
    });
    expect(await r.run()).toBe(1);
    expect(r.out).toEqual(["Could not reach the code host: HTTP 502"]);
    expect(r.git).toEqual([]);
  });

  it("opens nothing, and says so, when no file changed", async () => {
    const r = quick({
      settings: GATED,
      git: (args) => (args[0] === "status" ? { stdout: "" } : undefined),
    });
    expect(await r.run()).toBe(0);
    expect(r.out).toContain("Nothing to commit: the files already match.");
    expect(commands(r.git)).not.toContain("switch");
    expect(r.out.join("\n")).not.toMatch(/Opened|Merge it to finish/);
    await expect(r.host.codeHost.listOpen()).resolves.toEqual([]);
  });

  it("still lists what is left when no file changed", async () => {
    const r = quick({
      git: (args) => (args[0] === "status" ? { stdout: "" } : undefined),
    });
    await r.run();
    const at = r.out.indexOf("Nothing to commit: the files already match.");
    expect(r.out.slice(at + 1, at + 3)).toEqual([
      "Left to do:",
      "  1. Add the commands that check a change, under commands.gate in .claude/factory.yaml",
    ]);
  });

  it("reports a pull request opened, nothing to commit, or a failure, to its caller", async () => {
    const out: string[] = [];
    const git = (status: Partial<GitResult>) => (args: string[]) => ({
      status: 0,
      stdout: "",
      stderr: "",
      ...(args[0] === "status" ? status : {}),
    });
    const o = {
      codeHost: { create: async () => 57 },
      repository: "acme/web",
      remote: "origin",
      base: "main",
      branch: "set-up-factory",
      paths: ["a"],
      title: "Change the software factory's settings",
      body: "",
    };
    const d = (status: Partial<GitResult>) => ({
      git: git(status),
      out: into(out),
    });
    expect(await openPull(d({ stdout: "?? a\0" }), o)).toEqual({
      state: "opened",
      number: 57,
    });
    expect(out).toEqual([
      '✓ Opened acme/web#57, "Change the software factory\'s settings".',
    ]);
    expect(await openPull(d({ stdout: "" }), o)).toEqual({ state: "nothing" });
    expect(
      await openPull(
        d({ status: 128, stderr: "fatal: not a git repository\n" }),
        o,
      ),
    ).toEqual({ state: "failed" });
    expect(out.slice(-2)).toEqual([
      "✗ Could not commit: fatal: not a git repository",
      "The files are written, and nothing is committed.",
    ]);
  });
});

describe("factory init, the rule that requires the review's verdict", () => {
  const RULE_ROW =
    '  rules         Require "Review verdict" before a merge to the default branch, as the rule "Software factory"';
  const LEFT =
    'Once it merges, an admin of acme/site runs factory init, to require "Review verdict"';
  const review = (over: Partial<Setup> = {}) =>
    init({
      answers: { checkbox: [["review"]], confirm: [true], secret: [AGENT] },
      ...over,
    });

  it("makes the rule, posted by the runner, when the default branch has the factory's workflow", async () => {
    const r = review({ workflows: { "factory.yml": "active" } });
    expect(await r.run()).toBe(0);
    expect(r.out).toContain(RULE_ROW);
    expect(r.host.settings.rules).toEqual([
      { name: "Software factory", check: "Review verdict", source: "runner" },
    ]);
    expect(r.out.join("\n")).not.toContain("Once it merges");
  });

  it("requires Approval policies beside it once the workflow is there, where the settings have a policy", async () => {
    const policy =
      "approval-policies:\n  - name: licenses\n    run: node check.mjs\n    files: [package-lock.json]\n";
    const r = review({
      workflows: { "factory.yml": "active" },
      settings: `${GATED}${policy}`,
    });
    expect(await r.run()).toBe(0);
    expect(r.host.settings.rules.map((x) => x.check)).toEqual([
      "Review verdict",
      "Approval policies",
    ]);
    const before = review({ settings: `${GATED}${policy}` });
    await before.run();
    expect(before.host.settings.rules).toEqual([]);
  });

  it("makes none before then, and says so in the plan's row", async () => {
    const r = review();
    expect(await r.run()).toBe(0);
    expect(r.out).toContain(`${RULE_ROW}, once this pull request merges`);
    expect(r.host.settings.rules).toEqual([]);
  });

  it("leaves it to an admin, after the merge, in a person's repository with no build token", async () => {
    const r = review();
    await r.run();
    expect(r.out).toContain(`  2. ${LEFT}`);
  });

  it("leaves no such step when a build token is stored, since the first run makes the rule", async () => {
    const r = review({
      answers: {
        checkbox: [["review", "cloud"]],
        confirm: [true],
        secret: [AGENT, GOOD],
      },
    });
    await r.run();
    expect(r.out.join("\n")).not.toContain("Once it merges");
  });

  it("ends a first setup with doctor's own checks saying the verdict is not required yet, and exits 0", async () => {
    const r = review({
      doctor: true,
      // What the sync writes for the coding agent, which doctor looks for.
      files: {
        "CLAUDE.md": `${IMPORT_LINE}\n`,
        ".claude/settings.json": withHooks(null, "bin/factory.js"),
      },
    });
    expect(await r.run()).toBe(0);
    const checks = r.out.slice(r.out.indexOf("Checks"));
    expect(checks).toContain(
      '    - "Review verdict" is not required yet: the rule is made once the setup\'s pull request merges',
    );
    expect(checks.join("\n")).not.toContain("✗");
  });

  describe("with a build token of an account other than the one signed in", () => {
    const BUILDS = "tok_builds";
    /** A token of an account a team made for its builds, which can write
     * and no more, so the first run could not make the rule with it. */
    const tokens = {
      [BUILDS]: {
        account: "acme-builds",
        scopes: ["push", "workflows", "board"],
      },
    };
    const cloud = (over: Partial<Setup> = {}) =>
      review({
        tokens,
        answers: {
          checkbox: [["review", "cloud"]],
          confirm: [true],
          secret: [AGENT, BUILDS],
        },
        ...over,
      });

    it("leaves it to an admin, since that account may not be one", async () => {
      const r = cloud();
      expect(await r.run()).toBe(0);
      expect(r.runner.secrets.get("FACTORY_BUILD_TOKEN")).toBe(BUILDS);
      expect(r.out).toContain(`  2. ${LEFT}`);
    });

    it("leaves no such step for a token of the account that is signed in", async () => {
      const r = cloud({
        answers: {
          checkbox: [["review", "cloud"]],
          confirm: [true],
          secret: [AGENT, GOOD],
        },
      });
      await r.run();
      expect(r.runner.secrets.get("FACTORY_BUILD_TOKEN")).toBe(GOOD);
      expect(r.out.join("\n")).not.toContain("Once it merges");
    });

    it("leaves it to an admin for such a token found on this machine", async () => {
      const r = cloud({
        answers: { checkbox: [["review", "cloud"]], confirm: [true] },
      });
      for (const [tool, values] of [
        ["github", { token: BUILDS }],
        ["claude-code", { CLAUDE_CODE_OAUTH_TOKEN: AGENT }],
      ] as const)
        writeCredential({
          tool,
          site: "code.example/acme",
          values,
          env: r.env,
        });
      expect(await r.run()).toBe(0);
      expect(r.asked.filter((q) => q.startsWith("secret:"))).toEqual([]);
      expect(r.runner.secrets.get("FACTORY_BUILD_TOKEN")).toBe(BUILDS);
      expect(r.out).toContain(`  2. ${LEFT}`);
    });

    it("leaves no such step when init makes the rule itself, the workflow being on the default branch", async () => {
      const r = cloud({ workflows: { "factory.yml": "active" } });
      await r.run();
      expect(r.host.settings.rules).toHaveLength(1);
      expect(r.out.join("\n")).not.toContain("Once it merges");
    });

    it("leaves no such step when nobody can say who is signed in", async () => {
      const r = cloud({
        codeHostFails: { signedInAs: new Error("not signed in") },
      });
      await r.run();
      expect(r.out.join("\n")).not.toContain("Once it merges");
    });
  });

  it("leaves it to an admin when the token was left for later", async () => {
    const r = review({
      answers: {
        checkbox: [["review", "cloud"]],
        confirm: [true],
        secret: [AGENT, ""],
      },
    });
    await r.run();
    expect(r.out.join("\n")).toContain(LEFT);
  });

  it("leaves it to an admin in an organization's repository with no software-factory property", async () => {
    const r = init({
      organization: true,
      organizationVariables: ["FACTORY_APP_CLIENT_ID"],
      organizationSecrets: [
        "CLAUDE_CODE_OAUTH_TOKEN",
        "FACTORY_APP_PRIVATE_KEY",
      ],
      answers: { checkbox: [["review"]], confirm: [true] },
    });
    await r.run();
    expect(r.out).toContain(`${RULE_ROW}, once this pull request merges`);
    expect(r.out.join("\n")).toContain(LEFT);
  });

  describe("where the plan has no branch rules for the repository", () => {
    const NO_RULES = "GitHub Free has no branch rules for a private repository";

    it("plans no rule and leaves no step to an admin, since none could make one", async () => {
      const r = review({ noRules: NO_RULES });
      expect(await r.run()).toBe(0);
      expect(r.out.join("\n")).not.toMatch(/^ {2}rules /m);
      expect(r.out.join("\n")).not.toContain("Once it merges");
    });

    it("tries to make none, even with the workflow on the default branch", async () => {
      const r = review({
        noRules: NO_RULES,
        workflows: { "factory.yml": "active" },
      });
      await r.run();
      expect(r.host.log.filter((l) => l.startsWith("requireCheck"))).toEqual(
        [],
      );
      expect(r.out.join("\n")).not.toContain("Could not require");
    });

    it("plans the rule as usual when the rules cannot be read for another reason", async () => {
      const r = review({
        codeHostFails: { requiresStatus: new Error("HTTP 500") },
      });
      await r.run();
      expect(r.out).toContain(`${RULE_ROW}, once this pull request merges`);
      expect(r.out.join("\n")).toContain(LEFT);
    });
  });

  describe("in an organization that is set up", () => {
    const organization = (over: Partial<Setup> = {}) =>
      init({
        organization: true,
        organizationVariables: ["FACTORY_APP_CLIENT_ID"],
        organizationSecrets: [
          "CLAUDE_CODE_OAUTH_TOKEN",
          "FACTORY_APP_PRIVATE_KEY",
        ],
        answers: { checkbox: [["review"]], confirm: [true] },
        ...over,
      });

    it("plans no rule of the repository's own, and leaves no step to an admin, where the organization defines the property, though the repository has no value for it yet", async () => {
      const r = organization({ definedProperties: ["software-factory"] });
      await r.run();
      expect(await r.host.codeHost.properties()).toEqual({});
      expect(r.out.join("\n")).not.toMatch(/^ {2}rules /m);
      expect(r.out.join("\n")).not.toContain("Once it merges");
    });

    it("makes no rule of the repository's own there, even with the workflow on the default branch", async () => {
      const r = organization({
        definedProperties: ["software-factory"],
        workflows: { "factory.yml": "active" },
      });
      await r.run();
      expect(r.out.join("\n")).not.toMatch(/^ {2}rules /m);
      expect(r.host.settings.rules).toEqual([]);
    });

    it("plans the repository's own rule, and leaves it to an admin, where the organization defines no such property", async () => {
      const r = organization({ definedProperties: ["team"] });
      await r.run();
      expect(r.out).toContain(`${RULE_ROW}, once this pull request merges`);
      expect(r.out.join("\n")).toContain(LEFT);
    });

    it("takes the property as not defined when the organization will not say, which leaves the step to an admin", async () => {
      const r = organization({
        definedProperties: ["software-factory"],
        codeHostFails: {
          ownerDefines: new Error("gh api: Forbidden (HTTP 403)"),
        },
      });
      expect(await r.run()).toBe(0);
      expect(r.out).toContain(`${RULE_ROW}, once this pull request merges`);
      expect(r.out.join("\n")).toContain(LEFT);
    });
  });
});
