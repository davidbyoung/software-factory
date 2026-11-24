// `factory init`, from "Go ahead?" to the pull request: the plan's rows,
// the gate, the branch and its commit, the push, the pull request, the
// lines when one of those fails, and the rule that requires the review's
// verdict.
import { describe, expect, it } from "vitest";
import {
  fileRows,
  freeBranch,
  openPull,
  runGate,
  type GitResult,
} from "../src/init.mts";
import { CODE_HOST_YAML } from "./settings-fixture";
import { AGENT, GOOD, init, type Setup } from "./init-harness";

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
    expect(r.ran).toContainEqual(["gate", "npm run check"]);
    expect(r.synced()).toBe(1);
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
        out: (l) => out.push(l),
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
        out: (l) => out.push(l),
      },
      ["a", "b", "c"],
    );
    expect(passed).toBe(false);
    expect(ran).toEqual(["a", "b"]);
    expect(out[0]).toBe("✗ b fails here, so a build could not finish:");
  });

  it("runs none when nothing sets a gate", async () => {
    const r = quick();
    expect(await r.run()).toBe(0);
    expect(r.ran.filter((argv) => argv[0] === "gate")).toEqual([]);
    expect(r.out.join("\n")).not.toContain("here.");
  });
});

describe("factory init, the branch and its commit", () => {
  it("makes set-up-factory from the commit checked out, commits only the paths it and the sync wrote, and pushes to the repository's remote", async () => {
    const r = quick();
    expect(await r.run()).toBe(0);
    const paths = [
      ".claude/factory.yaml",
      ".claude/skills/factory-build/SKILL.md",
    ];
    const at = r.git.findIndex((args) => args[0] === "status");
    expect(r.git.slice(at)).toEqual([
      [
        "status",
        "--porcelain",
        "-z",
        "--no-renames",
        "--untracked-files=all",
        "--",
        ...paths,
      ],
      ["switch", "--quiet", "-c", "set-up-factory"],
      ["add", "--all", "--", ...paths],
      [
        "commit",
        "--quiet",
        "--message",
        "Set up the software factory",
        "--",
        ...paths,
      ],
      ["push", "--quiet", "--set-upstream", "origin", "set-up-factory"],
    ]);
  });

  it("commits only the paths git says changed", async () => {
    const r = quick({
      git: (args) =>
        args[0] === "status"
          ? { stdout: " M .claude/factory.yaml\0" }
          : undefined,
    });
    await r.run();
    expect(r.git.find((args) => args[0] === "add")).toEqual([
      "add",
      "--all",
      "--",
      ".claude/factory.yaml",
    ]);
  });

  it("takes set-up-factory-2, and so on, when the name is taken here or on the remote", () => {
    const taken = (here: string[], there: string[]) => (args: string[]) =>
      ({
        status:
          args[0] === "show-ref"
            ? here.includes(args.at(-1)!.replace("refs/heads/", ""))
              ? 0
              : 1
            : there.includes(args.at(-1)!)
              ? 0
              : 2,
        stdout: "",
        stderr: "",
      }) satisfies GitResult;
    expect(freeBranch({ git: taken([], []) }, "origin")).toBe("set-up-factory");
    expect(freeBranch({ git: taken(["set-up-factory"], []) }, "origin")).toBe(
      "set-up-factory-2",
    );
    expect(
      freeBranch(
        { git: taken(["set-up-factory"], ["set-up-factory-2"]) },
        "origin",
      ),
    ).toBe("set-up-factory-3");
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
  it("says nothing else is left when nothing is", async () => {
    const r = quick({ settings: GATED });
    await r.run();
    const at = r.out.findIndex((l) => l.startsWith("✓ Opened"));
    expect(r.out.slice(at + 1, at + 4)).toEqual([
      "Merge it to finish. Nothing else is left to do.",
      "",
      "Checks",
    ]);
  });

  it("lists what is left, without a step to commit, when something is", async () => {
    const r = quick();
    await r.run();
    const at = r.out.indexOf(OPENED_FIRST);
    expect(r.out.slice(at + 1, at + 4)).toEqual([
      "Merge it to finish. Left to do:",
      "  1. Add the commands that check a change, under commands.gate in .claude/factory.yaml",
      "",
    ]);
    expect(r.out.join("\n")).not.toMatch(/Commit this|Nothing is committed/);
  });
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
      out: (l: string) => out.push(l),
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

  it("plans no rule of the repository's own where the organization's property puts its rule on it", async () => {
    const r = init({
      organization: true,
      organizationVariables: ["FACTORY_APP_CLIENT_ID"],
      organizationSecrets: [
        "CLAUDE_CODE_OAUTH_TOKEN",
        "FACTORY_APP_PRIVATE_KEY",
      ],
      properties: { "software-factory": null },
      workflows: { "factory.yml": "active" },
      answers: { checkbox: [["review"]], confirm: [true] },
    });
    await r.run();
    expect(r.out.join("\n")).not.toMatch(/^ {2}rules /m);
    expect(r.host.settings.rules).toEqual([]);
    expect(r.out.join("\n")).not.toContain("Once it merges");
  });
});
