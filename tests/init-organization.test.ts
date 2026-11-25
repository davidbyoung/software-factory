// `factory init` in a repository an organization owns, and the rows a
// person's repository gets in their place: what it finds, which presets
// it follows, what it does not ask, and which parts it offers.
import { describe, expect, it } from "vitest";
import { organizationState } from "../src/init.mts";
import { writeCredential } from "../src/lib/credentials.mts";
import { FACTORY_COLUMNS } from "./factory-columns";
import { CODE_HOST_YAML } from "./settings-fixture";
import {
  AGENT,
  GATE_QUESTION,
  GOOD,
  init,
  printsNoSecret,
  type FakePreset,
  type Setup,
} from "./init-harness";

const ROOT = "acme/factory-config";
const GO = `${ROOT}//go`;
const NODE = `${ROOT}//node`;
/** The presets of the ticket's example organization. */
const PRESETS: Record<string, FakePreset> = {
  [ROOT]: {
    about: "The preset for every acme repository.",
    settings: {
      tickets: { board: 12, columns: FACTORY_COLUMNS },
      "code-host": { "branch-name": "{user}/{ticket}" },
      specs: "none",
      "pr-review": { commands: [] },
      builds: { trigger: "github-action" },
    },
  },
  [GO]: { about: "The preset for acme's Go repositories." },
  [NODE]: {
    about: "The preset for acme's Node repositories.",
    settings: {
      commands: { gate: ["npm run check"] },
      plugins: {
        build: {
          reviewers: [{ agent: "acme-reviewer", files: ["src/**"] }],
        },
      },
    },
    ships: [
      ".claude/agents/acme-reviewer.md",
      ".claude/skills/acme-release/SKILL.md",
    ],
  },
};
const SYNCS = [
  ".claude/skills/factory-build/SKILL.md",
  ".claude/agents/acme-reviewer.md",
  ".claude/skills/acme-release/SKILL.md",
  ".github/workflows/factory.yml",
  ".github/workflows/factory-review.yml",
  ".claude/factory.lock",
];
/** An organization `factory init --org` has set up, whose secrets reach
 * the repository. */
const SET_UP: Partial<Setup> = {
  remote: "git@github.com:acme/web.git",
  organization: true,
  organizationVariables: ["FACTORY_APP_CLIENT_ID"],
  organizationSecrets: ["CLAUDE_CODE_OAUTH_TOKEN", "FACTORY_APP_PRIVATE_KEY"],
  definedProperties: ["software-factory"],
};
const dev = (over: Partial<Setup> = {}) =>
  init({
    ...SET_UP,
    presets: PRESETS,
    config: [ROOT, GO, NODE],
    syncs: SYNCS,
    answers: { checkbox: [[ROOT, NODE], []], confirm: [true] },
    ...over,
  });

describe("factory init, in an organization's repository that is set up", () => {
  it("prints and asks what the ticket's transcript shows, from the first line to the pull request", async () => {
    const r = dev();
    expect(await r.run()).toBe(0);
    expect(r.transcript).toEqual([
      "Setting up the software factory for acme/web",
      "",
      "Found",
      "  Code host        GitHub (from your git remote)",
      "  Organization     acme, set up: its app's key and its Claude token are stored",
      "  Presets          acme/factory-config holds 3",
      "  Coding agent     Claude Code",
      "  Cloud builds     GitHub Actions",
      "  Settings         none yet",
      "",
      "? checkbox: Which of acme's presets does this repository follow?",
      "",
      "From the presets, so not asked",
      "  Tickets          GitHub Issues on board 12",
      "  Branch names     {user}/{ticket}",
      "  Spec tool        none",
      "  Gate             npm run check",
      "  Parts            a board, the review, and builds that start from the board",
      "Stored for acme, so not asked",
      "  CLAUDE_CODE_OAUTH_TOKEN and FACTORY_APP_PRIVATE_KEY, which turn on builds in the cloud",
      "",
      "? checkbox: Also turn on here?",
      "",
      "This is everything setup will do:",
      "  settings      Write .claude/factory.yaml and .claude/factory.lock",
      "  files         Copy the factory's skills, agents, rules, and guards, and acme's own reviewer and skill",
      "  workflows     Write .github/workflows/factory.yml and factory-review.yml",
      "  pull request  Push the branch set-up-factory and open a pull request",
      "? confirm: Go ahead?",
      "",
      "✓ npm run check passes here.",
      '✓ Opened acme/web#1, "Set up the software factory".',
      "Merge it to finish. Nothing else is left to do.",
      "",
      "After it merges:",
      "  1. Come back to main and bring it up to date:",
      "       git switch main && git pull",
      "  2. Start a new session of your coding agent here. It loads the factory from the files now in your repository.",
      "  3. Refine a ticket with /factory-refine N, then build it with /factory-build N.",
      "The steps in full:",
      "     https://github.com/davidbyoung/software-factory/blob/v0.2.0/docs/quick-start.md#4-open-a-ticket",
      "",
      "Checks",
      "  ✓ Every check passed",
    ]);
  });

  it("has bold labels, dim notes, cyan to copy, and yellow on what the person does, from the first line to the last", async () => {
    const r = dev();
    expect(await r.run()).toBe(0);
    expect(r.looks).toEqual([
      "Setting up the software factory for {name:acme/web}",
      "",
      "{heading:Found}",
      "  {name:Code host}        GitHub (from your git remote)",
      "  {name:Organization}     acme, set up: its app's key and its Claude token are stored",
      "  {name:Presets}          acme/factory-config holds 3",
      "  {name:Coding agent}     Claude Code",
      "  {name:Cloud builds}     GitHub Actions",
      "  {name:Settings}         {skip:none yet}",
      "",
      "",
      "{heading:From the presets, so not asked}",
      "  {name:Tickets}          GitHub Issues on board 12",
      "  {name:Branch names}     {user}/{ticket}",
      "  {name:Spec tool}        none",
      "  {name:Gate}             npm run check",
      "  {name:Parts}            a board, the review, and builds that start from the board",
      "{heading:Stored for acme, so not asked}",
      "  CLAUDE_CODE_OAUTH_TOKEN and FACTORY_APP_PRIVATE_KEY, which turn on builds in the cloud",
      "",
      "",
      "{heading:This is everything setup will do:}",
      "  {name:settings}      Write .claude/factory.yaml and .claude/factory.lock",
      "  {name:files}         Copy the factory's skills, agents, rules, and guards, and acme's own reviewer and skill",
      "  {name:workflows}     Write .github/workflows/factory.yml and factory-review.yml",
      "  {name:pull request}  Push the branch set-up-factory and open a pull request",
      "",
      "{good:✓} npm run check passes here.",
      '{good:✓} Opened {name:acme/web#1}, "Set up the software factory".',
      "{yourTurn:Merge it to finish. Nothing else is left to do.}",
      "",
      "{yourTurn:After it merges:}",
      "  {yourTurn:1.} Come back to main and bring it up to date:",
      "       {copy:git switch main && git pull}",
      "  {yourTurn:2.} Start a new session of your coding agent here. It loads the factory from the files now in your repository.",
      "  {yourTurn:3.} Refine a ticket with {copy:/factory-refine N}, then build it with {copy:/factory-build N}.",
      "The steps in full:",
      "     {copy:https://github.com/davidbyoung/software-factory/blob/v0.2.0/docs/quick-start.md#4-open-a-ticket}",
      "",
      "{heading:Checks}",
      "  {good:✓} Every check passed",
    ]);
  });

  it("gives the command an owner runs for an organization not set up, with its address, as one to copy", async () => {
    const r = dev({
      organizationVariables: [],
      organizationSecrets: [],
      config: undefined,
      definedProperties: [],
      answers: { checkbox: [[]], confirm: [false] },
    });
    await r.run().catch(() => {});
    expect(r.looks).toContain(
      "  {name:Organization}     acme, not set up: an owner runs {copy:factory init --org https://github.com/acme}",
    );
  });

  it("is set up when the app's client ID, its key, and a credential of the coding agent's all reach the repository", () => {
    const state = (variables: string[], secrets: string[]) =>
      organizationState({
        variables,
        secrets,
        agent: ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY"],
      });
    const ID = ["FACTORY_APP_CLIENT_ID"];
    const KEY = "FACTORY_APP_PRIVATE_KEY";
    expect(state(ID, [KEY, "ANTHROPIC_API_KEY"])).toEqual({
      setUp: true,
      stored: ["ANTHROPIC_API_KEY", KEY],
    });
    expect(state([], [KEY, "ANTHROPIC_API_KEY"]).setUp).toBe(false);
    expect(state(ID, ["ANTHROPIC_API_KEY"]).setUp).toBe(false);
    expect(state(ID, [KEY])).toEqual({ setUp: false, stored: [] });
  });

  describe("the secrets stored for the organization", () => {
    const HEADING = "Stored for acme, so not asked";
    const block = (out: string[]) =>
      out.slice(out.indexOf(HEADING), out.indexOf(HEADING) + 3);

    it("are named under their own heading, after what the presets answer", async () => {
      const r = dev();
      await r.run();
      expect(block(r.out)).toEqual([
        HEADING,
        "  CLAUDE_CODE_OAUTH_TOKEN and FACTORY_APP_PRIVATE_KEY, which turn on builds in the cloud",
        "",
      ]);
      expect(r.out.indexOf(HEADING)).toBeGreaterThan(
        r.out.indexOf("From the presets, so not asked"),
      );
    });

    it("name the coding agent's credential that reaches the repository, whichever it is", async () => {
      const r = dev({
        organizationSecrets: ["ANTHROPIC_API_KEY", "FACTORY_APP_PRIVATE_KEY"],
      });
      await r.run();
      expect(block(r.out)[1]).toBe(
        "  ANTHROPIC_API_KEY and FACTORY_APP_PRIVATE_KEY, which turn on builds in the cloud",
      );
    });

    it("are named with no preset to answer anything, before the first question", async () => {
      const r = init({
        ...SET_UP,
        answers: { checkbox: [[]], confirm: [true] },
      });
      await r.run();
      const at = r.transcript.indexOf(HEADING);
      expect(at).toBeGreaterThan(-1);
      expect(r.transcript.findIndex((l) => l.startsWith("? "))).toBeGreaterThan(
        at,
      );
      expect(r.out.join("\n")).not.toContain("From the presets");
    });

    it("are not named in a person's repository, whatever secrets it has", async () => {
      const r = init({
        remote: "git@github.com:sam/api.git",
        secrets: { CLAUDE_CODE_OAUTH_TOKEN: "x", FACTORY_APP_PRIVATE_KEY: "x" },
        answers: { checkbox: [[]], confirm: [false, false] },
      });
      await r.run();
      expect(r.out.join("\n")).not.toContain("so not asked");
    });
  });

  describe("the parts the presets turn on", () => {
    const row = (out: string[]) => out.find((l) => l.startsWith("  Parts "));
    const one = (settings: Record<string, unknown>) =>
      init({
        ...SET_UP,
        argv: ["--preset", "acme/one"],
        presets: { "acme/one": { settings } },
        answers: { checkbox: [[]], confirm: [false] },
      });

    it("are named in one row: a board, the review, and builds that start from the board", async () => {
      const r = dev();
      await r.run();
      expect(row(r.out)).toBe(
        "  Parts            a board, the review, and builds that start from the board",
      );
    });

    it("name only the review when that is all a preset turns on, and offer the rest", async () => {
      const r = one({ "pr-review": { commands: [] } });
      await r.run();
      expect(row(r.out)).toBe("  Parts            the review");
      expect(r.checkboxes[0]!.names).toEqual([
        "A board",
        "Builds that start when you move a card to Ready",
        "Pull requests that merge themselves",
      ]);
    });

    it("name a board, and not builds from it, for a preset whose trigger is manual", async () => {
      const r = one({
        tickets: { board: 12, columns: FACTORY_COLUMNS },
        builds: { trigger: "manual" },
      });
      await r.run();
      expect(row(r.out)).toBe("  Parts            a board");
    });

    it("have no row when the presets turn none on", async () => {
      const r = one({ specs: "none" });
      await r.run();
      expect(r.out).toContain("  Spec tool        none");
      expect(row(r.out)).toBeUndefined();
    });
  });

  it("asks for no token, opens no page, and stores no secret", async () => {
    const r = dev();
    await r.run();
    expect(r.asked.filter((q) => q.startsWith("secret:"))).toEqual([]);
    expect(r.opened).toEqual([]);
    expect(r.ran.filter((argv) => argv[0] === "claude")).toEqual([]);
    expect(r.runner.secrets.size).toBe(0);
  });

  it("offers only pull requests that merge themselves, unchecked, when the presets and the stored secrets decide the rest", async () => {
    const r = dev();
    await r.run();
    expect(r.checkboxes[1]).toEqual({
      names: ["Pull requests that merge themselves"],
      checked: [],
    });
  });

  it("offers each part nothing has decided, and never builds in the cloud or signed commits", async () => {
    const r = init({
      ...SET_UP,
      answers: { checkbox: [[]], confirm: [true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.asked).toContain("checkbox: Also turn on here?");
    expect(r.checkboxes[0]!.names).toEqual([
      "An automated review of every pull request",
      "A board",
      "Builds that start when you move a card to Ready",
      "Pull requests that merge themselves",
    ]);
  });

  it("keeps builds in the cloud on, from the stored secrets, with the parts the presets turn on", async () => {
    const r = dev({
      answers: { checkbox: [[ROOT, NODE], []], confirm: [false] },
    });
    await r.run();
    expect(r.out.join("\n")).not.toContain("turn off");
  });

  it("offers pull requests that merge themselves checked once the settings turn them on", async () => {
    const r = init({
      ...SET_UP,
      settings: `version: 2\nrepository: acme/web\n${CODE_HOST_YAML}\nauto-merge:\n  allow: [docs/**]\n`,
      answers: { checkbox: [["auto-merge"]], confirm: [true] },
    });
    await r.run();
    expect(r.checkboxes[0]!.checked).toEqual(["auto-merge"]);
  });

  it("leaves an admin to allow auto-merge when the code host refuses the person who ran it", async () => {
    const r = dev({
      answers: {
        checkbox: [[ROOT, NODE], ["auto-merge"]],
        input: ["docs/**"],
        confirm: [true],
      },
      codeHostFails: { allowAutoMerge: new Error("HTTP 403") },
    });
    expect(await r.run()).toBe(0);
    expect(r.out).toContain("Could not allow auto-merge: HTTP 403");
    const at = r.out.indexOf("Merge it to finish. Left to do:");
    expect(r.out[at + 1]).toBe(
      '  1. An admin of acme/web allows auto-merge: Settings, General, "Allow auto-merge"',
    );
  });

  it("writes none of what the presets give into the repository's own settings", async () => {
    const r = dev();
    await r.run();
    expect(r.yaml()).toEqual({
      version: 2,
      repository: "acme/web",
      presets: [ROOT, NODE],
    });
  });

  it("offers to delete the repository's own copy of a secret the organization now stores", async () => {
    const r = dev({
      secrets: {
        FACTORY_BOARD_TOKEN: "x",
        CLAUDE_CODE_OAUTH_TOKEN: "x",
        FACTORY_SIGNING_KEY: "x",
        OTHER_SECRET: "x",
      },
    });
    await r.run();
    expect(r.out).toContain(
      "You can now delete these secrets: FACTORY_BOARD_TOKEN, CLAUDE_CODE_OAUTH_TOKEN, FACTORY_SIGNING_KEY",
    );
  });
});

describe("factory init, in a private repository of an organization whose plan keeps its secrets from it", () => {
  /** The organization is set up, and the runner lists its secrets for the
   * repository, which cannot use them. */
  const free = (over: Partial<Setup> = {}) =>
    dev({
      private: true,
      secretsWithheldBy: "GitHub Free",
      answers: { checkbox: [[ROOT, NODE]], confirm: [true] },
      ...over,
    });

  it("says its secrets do not reach the repository, whatever the listing says, with the line that says what stays off", async () => {
    const r = free();
    expect(await r.run()).toBe(0);
    expect(r.out[4]).toBe(
      "  Organization     acme, set up, but its secrets do not reach this repository: GitHub Free shares them only with public repositories, or an owner narrowed them",
    );
    expect(r.out).toContain(
      "Builds on your machine work now. The review and builds in the cloud stay off until acme is set up.",
    );
    expect(r.out.join("\n")).not.toContain("Stored for acme, so not asked");
  });

  it("turns on no part that reads a secret, and asks for none", async () => {
    const r = free();
    await r.run();
    expect(r.asked.filter((q) => /secret|Also turn on/.test(q))).toEqual([]);
    expect(r.out.join("\n")).not.toContain("so that is on too");
    expect(r.runner.secrets.size).toBe(0);
  });

  it("says so with no factory-config to be found", async () => {
    const r = init({
      ...SET_UP,
      private: true,
      secretsWithheldBy: "GitHub Free",
      answers: { checkbox: [[]], confirm: [false] },
    });
    await r.run();
    expect(r.out[4]).toMatch(
      /^ {2}Organization {5}acme, set up, but its secrets do not reach this repository: /,
    );
  });

  it("trusts the listing when the code host cannot say what the plan shares", async () => {
    const r = dev({
      private: true,
      codeHostFails: { secretsWithheldBy: new Error("HTTP 502") },
    });
    await r.run();
    expect(r.out[4]).toBe(
      "  Organization     acme, set up: its app's key and its Claude token are stored",
    );
  });
});

describe("factory init, in an organization's repository its secrets do not reach", () => {
  const LINE =
    "Builds on your machine work now. The review and builds in the cloud stay off until acme is set up.";
  const bare = (over: Partial<Setup> = {}) =>
    init({
      remote: "git@github.com:acme/web.git",
      organization: true,
      answers: { checkbox: [[]], confirm: [true] },
      ...over,
    });
  const found = (out: string[]) =>
    out.slice(out.indexOf("Found") + 1, out.indexOf(LINE) + 2);

  it("says an owner sets the organization up, with the command, when it has no factory-config", async () => {
    const r = bare();
    expect(await r.run()).toBe(0);
    expect(found(r.out)).toEqual([
      "  Code host        GitHub (from your git remote)",
      "  Organization     acme, not set up: an owner runs factory init --org https://github.com/acme",
      "  Tickets          GitHub Issues",
      "  Coding agent     Claude Code",
      "  Cloud builds     GitHub Actions",
      "  Settings         none yet",
      "  Board            none yet",
      "",
      LINE,
      "",
    ]);
  });

  it("says its secrets do not reach the repository when it has a factory-config", async () => {
    const r = bare({
      config: [ROOT],
      presets: PRESETS,
      organizationVariables: ["FACTORY_APP_CLIENT_ID"],
      answers: { checkbox: [[]], confirm: [true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.out[4]).toBe(
      "  Organization     acme, set up, but its secrets do not reach this repository: GitHub Free shares them only with public repositories, or an owner narrowed them",
    );
    expect(r.out).toContain(LINE);
  });

  describe("with no question left to ask", () => {
    /** Each place the transcript has two blank lines together. */
    const doubled = (transcript: string[]) =>
      transcript.flatMap((line, i) =>
        line === "" && transcript[i - 1] === ""
          ? [transcript.slice(i - 2, i + 2)]
          : [],
      );
    const HEADING = "This is everything setup will do:";

    it("leaves one blank line before the plan when the settings answer everything", async () => {
      const r = bare({
        settings: `version: 2\nrepository: acme/web\n${CODE_HOST_YAML}\nspecs: none\ncommands:\n  gate:\n    - npm test\n`,
        answers: { confirm: [false] },
      });
      await r.run();
      expect(r.asked).toEqual(["confirm: Go ahead?"]);
      const at = r.transcript.indexOf(HEADING);
      expect(r.transcript.slice(at - 3, at + 1)).toEqual([
        "",
        LINE,
        "",
        HEADING,
      ]);
      expect(doubled(r.transcript)).toEqual([]);
    });

    it("leaves one blank line before the plan when the presets answer everything", async () => {
      const r = bare({
        argv: ["--preset", ROOT, "--preset", NODE],
        presets: PRESETS,
        answers: { confirm: [false] },
      });
      await r.run();
      expect(r.asked).toEqual(["confirm: Go ahead?"]);
      const at = r.transcript.indexOf(HEADING);
      expect(r.transcript.slice(at - 2, at + 1)).toEqual([
        "  Parts            a board, the review, and builds that start from the board",
        "",
        HEADING,
      ]);
      expect(doubled(r.transcript)).toEqual([]);
    });
  });

  it("asks for no token of a person's, and offers no part that reads one", async () => {
    const r = bare();
    await r.run();
    expect(r.asked).toEqual([
      "input: How should a build name its branch? Use {ticket}, and {user} for the GitHub account:",
      "select: Which spec tool do you use?",
      `input: ${GATE_QUESTION}`,
      "confirm: Go ahead?",
    ]);
    expect(r.opened).toEqual([]);
    expect(r.runner.secrets.size).toBe(0);
  });

  it("leaves the parts a preset turns on without asking for the tokens they read", async () => {
    const r = bare({
      config: [ROOT],
      presets: PRESETS,
      answers: { checkbox: [[ROOT]], confirm: [true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.asked.filter((q) => /secret|Also turn on/.test(q))).toEqual([]);
    expect(r.out.join("\n")).not.toContain("Stored for acme, so not asked");
    // Builds in the cloud stay off, as the line under Found says.
    expect(r.out.join("\n")).not.toContain("so that is on too");
  });

  it("still offers a part whose secrets someone stored on the repository by hand", async () => {
    const r = bare({
      secrets: { FACTORY_AUTOMERGE_TOKEN: "x", FACTORY_BOARD_TOKEN: "x" },
    });
    await r.run();
    expect(r.checkboxes[0]!.names).toEqual([
      "A board",
      "Pull requests that merge themselves",
    ]);
  });
});

describe("factory init, in a repository a person owns", () => {
  const sam = (over: Partial<Setup> = {}) =>
    init({
      remote: "git@github.com:sam/api.git",
      answers: { checkbox: [[]], confirm: [true] },
      ...over,
    });
  const SITE = "code.example/sam";

  it("prints the account and what this machine holds, as the ticket's transcript shows", async () => {
    const r = sam();
    expect(await r.run()).toBe(0);
    const rows = r.out.slice(0, r.out.indexOf("", 2));
    expect(rows).toEqual([
      "Setting up the software factory for sam/api",
      "",
      "Found",
      "  Code host      GitHub (from your git remote)",
      "  Account        sam, a personal account",
      "  Tickets        GitHub Issues",
      "  Coding agent   Claude Code",
      "  Cloud builds   GitHub Actions",
      "  Settings       none yet",
      "  Board          none yet",
      "  This machine   no GitHub token for cloud runs",
    ]);
  });

  it("names the tokens this machine holds for the account", async () => {
    const r = sam();
    writeCredential({
      tool: "github",
      site: SITE,
      values: { token: GOOD },
      env: r.env,
    });
    writeCredential({
      tool: "claude-code",
      site: SITE,
      values: { CLAUDE_CODE_OAUTH_TOKEN: AGENT },
      env: r.env,
    });
    await r.run();
    expect(r.out).toContain(
      "  This machine   a GitHub token for sam, and a Claude token",
    );
    printsNoSecret(r.out);
  });

  it("names a token held for another account as none", async () => {
    const r = sam();
    writeCredential({
      tool: "github",
      site: "code.example/acme",
      values: { token: GOOD },
      env: r.env,
    });
    await r.run();
    expect(r.out).toContain("  This machine   no GitHub token for cloud runs");
  });

  it("asks which parts, with every part to choose from, and no organization's lines", async () => {
    const r = sam();
    await r.run();
    expect(r.asked).toContain("checkbox: Which parts do you want?");
    expect(r.checkboxes[0]!.names).toHaveLength(6);
    expect(r.out.join("\n")).not.toMatch(/Organization|so not asked/);
  });
});
