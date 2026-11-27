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
      "     https://github.com/davidbyoung/software-factory/blob/v0.2.0/docs/get-started/quick-start.md#4-open-a-ticket",
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
      "     {copy:https://github.com/davidbyoung/software-factory/blob/v0.2.0/docs/get-started/quick-start.md#4-open-a-ticket}",
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
  const STOP = /^✗ The presets turn on (.+)\. They need acme's secrets,/;
  const STAYS_OFF = /The review and builds in the cloud stay off/;
  const ROW =
    "  Organization     acme, set up, but its secrets do not reach this repository: GitHub Free shares them only with public repositories";
  /** Every secret each part the presets turn on reads, by hand. */
  const OWN = { CLAUDE_CODE_OAUTH_TOKEN: "x", FACTORY_BOARD_TOKEN: "x" };
  const stopped = (out: string[]) =>
    out.map((l) => STOP.exec(l)?.[1]).find((parts) => parts !== undefined);

  it("stops after the question about presets, saying what cannot work and what to do", async () => {
    const r = free();
    expect(await r.run()).toBe(1);
    expect(r.out[4]).toBe(ROW);
    expect(
      r.transcript.slice(
        r.transcript.indexOf(
          "? checkbox: Which of acme's presets does this repository follow?",
        ),
      ),
    ).toEqual([
      "? checkbox: Which of acme's presets does this repository follow?",
      "",
      "✗ The presets turn on a board, the review, and builds that start from the board. They need acme's secrets, and GitHub Free does not share them with a private repository.",
      "Make acme/web public, or move acme to a paid plan. Then run factory init again.",
      "What GitHub Free leaves out:",
      "     https://github.com/davidbyoung/software-factory/blob/v0.2.0/docs/integrations/github-organizations.md#on-githubs-free-plan",
      "Nothing changed.",
    ]);
  });

  it("changes nothing when it stops", async () => {
    const r = free();
    await r.run();
    expect(r.asked).toHaveLength(1);
    expect(r.read(".claude/factory.yaml")).toBeNull();
    expect(
      r.git.filter(([c]) => ["add", "commit", "push", "switch"].includes(c!)),
    ).toEqual([]);
    expect(r.runner.secrets.size).toBe(0);
    expect(r.synced()).toBe(0);
    expect(r.transcript.join("\n")).not.toMatch(STAYS_OFF);
  });

  it.each<[string, Partial<Setup>]>([
    ["--preset names", { argv: ["--preset", ROOT], config: undefined }],
    [
      "the settings list",
      {
        settings: `version: 2\nrepository: acme/web\npresets:\n  - ${ROOT}\n`,
      },
    ],
  ])("stops for the presets %s", async (_, over) => {
    const r = free({ answers: {}, ...over });
    expect(await r.run()).toBe(1);
    expect(stopped(r.out)).toBe(
      "a board, the review, and builds that start from the board",
    );
    expect(r.asked).toEqual([]);
  });

  it("names only the parts the repository's own secrets do not meet", async () => {
    const r = free({ secrets: { CLAUDE_CODE_OAUTH_TOKEN: "x" } });
    expect(await r.run()).toBe(1);
    expect(stopped(r.out)).toBe("a board and builds that start from the board");
  });

  it("goes on when the repository's own secrets meet every part", async () => {
    const r = free({
      secrets: OWN,
      answers: { checkbox: [[ROOT, NODE], []], confirm: [true] },
    });
    expect(await r.run()).toBe(0);
    expect(stopped(r.out)).toBeUndefined();
    expect(r.out).toContain(
      "  Parts            a board, the review, and builds that start from the board",
    );
    expect(r.out.join("\n")).not.toMatch(STAYS_OFF);
  });

  it("stops all the same when what the organization shares cannot be listed", async () => {
    const r = free({
      runnerFails: { organizationSecretNames: new Error("HTTP 502") },
    });
    expect(await r.run()).toBe(1);
    expect(r.out[4]).toBe(ROW);
    expect(stopped(r.out)).toBe(
      "a board, the review, and builds that start from the board",
    );
  });

  it("leaves alone a part the repository's own settings turn on", async () => {
    const r = free({
      settings: `version: 2\nrepository: acme/web\npresets:\n  - ${NODE}\n${CODE_HOST_YAML}\nspecs: none\npr-review: {}\n`,
      answers: { confirm: [false] },
    });
    await r.run();
    expect(stopped(r.out)).toBeUndefined();
    expect(r.out.join("\n")).not.toMatch(STAYS_OFF);
    expect(r.asked).toContain("confirm: Go ahead?");
  });

  it("ends as it does today, with no stop for the presets and nothing said to stay off, when the repository's own secrets cannot be listed", async () => {
    const r = free({ runnerFails: { secretNames: new Error("HTTP 502") } });
    expect(await r.run()).toBe(1);
    expect(stopped(r.out)).toBeUndefined();
    expect(r.out.join("\n")).not.toMatch(STAYS_OFF);
    expect(r.out.at(-1)).toBe("Could not reach the code host: HTTP 502");
  });

  it("goes on with no preset that turns a part on, and says what stays off until when", async () => {
    const r = free({ answers: { checkbox: [[]], confirm: [false] } });
    await r.run();
    expect(r.out[4]).toBe(ROW);
    const asked = r.transcript.indexOf(
      "? checkbox: Which of acme's presets does this repository follow?",
    );
    expect(r.transcript.slice(asked, asked + 4)).toEqual([
      "? checkbox: Which of acme's presets does this repository follow?",
      "",
      "Builds on your machine work now. The review and builds in the cloud stay off until acme/web is public or acme is on a paid plan.",
      "",
    ]);
    expect(r.out.join("\n").match(new RegExp(STAYS_OFF, "g"))).toHaveLength(1);
  });

  it("says nothing stays off where the repository stores the coding agent's credential", async () => {
    const r = free({
      secrets: { CLAUDE_CODE_OAUTH_TOKEN: "x" },
      answers: { checkbox: [[], []], confirm: [false] },
    });
    await r.run();
    expect(r.asked).toContain("confirm: Go ahead?");
    expect(r.out.join("\n")).not.toMatch(STAYS_OFF);
  });

  it("says so with no factory-config to be found", async () => {
    const r = init({
      ...SET_UP,
      private: true,
      secretsWithheldBy: "GitHub Free",
      answers: { checkbox: [[]], confirm: [false] },
    });
    await r.run();
    expect(r.out[4]).toBe(ROW);
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
  /** An owner shared the secrets only with other repositories. */
  const narrowed = (over: Partial<Setup> = {}) =>
    bare({
      config: [ROOT],
      presets: PRESETS,
      answers: { checkbox: [[ROOT]], confirm: [true] },
      ...over,
    });
  /** Nobody ran `factory init --org`, and a preset is named by hand. */
  const notSetUp = (over: Partial<Setup> = {}) =>
    bare({
      argv: ["--preset", ROOT],
      presets: PRESETS,
      answers: { confirm: [false] },
      ...over,
    });
  const ASKED =
    "? checkbox: Which of acme's presets does this repository follow?";
  const STAYS_OFF = /stay off/;
  const STOP = /^✗ The presets turn on (.+)\. They need acme's secrets,/;
  const stopped = (out: string[]) =>
    out.map((l) => STOP.exec(l)?.[1]).find((parts) => parts !== undefined);
  const ALL = "a board, the review, and builds that start from the board";
  /** Every secret each part the presets turn on reads, by hand. */
  const OWN = { CLAUDE_CODE_OAUTH_TOKEN: "x", FACTORY_BOARD_TOKEN: "x" };
  const DOCS =
    "     https://github.com/davidbyoung/software-factory/blob/v0.2.0/docs/integrations/github-organizations.md#when-the-organizations-secrets-do-not-reach-you";
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
  });

  it("says after the question about presets that the rest stays off until the secrets reach it", async () => {
    const r = narrowed({ answers: { checkbox: [[]], confirm: [false] } });
    await r.run();
    const asked = r.transcript.indexOf(ASKED);
    expect(r.transcript.slice(asked, asked + 4)).toEqual([
      ASKED,
      "",
      "Builds on your machine work now. The review and builds in the cloud stay off until acme's secrets reach acme/web.",
      "",
    ]);
    expect(r.out.filter((l) => STAYS_OFF.test(l))).toHaveLength(1);
  });

  it("says both that an owner sets it up and what the plan needs, for a private repository the plan keeps its secrets from", async () => {
    const r = bare({
      private: true,
      secretsWithheldBy: "GitHub Free",
      answers: { confirm: [false] },
    });
    await r.run();
    expect(r.out.filter((l) => STAYS_OFF.test(l))).toEqual([
      "Builds on your machine work now. The review and builds in the cloud stay off until acme is set up, and acme/web is public or acme is on a paid plan.",
    ]);
  });

  it.each<[string, Partial<Setup>]>([
    [
      "the repository's own settings turn the review on",
      {
        settings: `version: 2\nrepository: acme/web\n${CODE_HOST_YAML}\nspecs: none\npr-review: {}\n`,
      },
    ],
    [
      "the repository's own settings start builds from the board",
      {
        settings: `version: 2\nrepository: acme/web\n${CODE_HOST_YAML}\nspecs: none\ntickets:\n  board: 12\nbuilds:\n  trigger: github-action\n`,
      },
    ],
    [
      "the repository stores the coding agent's credential",
      { secrets: { CLAUDE_CODE_OAUTH_TOKEN: "x" } },
    ],
    [
      "the organization shares the coding agent's credential",
      { organizationSecrets: ["ANTHROPIC_API_KEY"] },
    ],
    [
      "the repository's own secrets cannot be listed",
      { runnerFails: { secretNames: new Error("HTTP 502") } },
    ],
  ])("says nothing stays off where %s", async (_, over) => {
    const r = bare({ answers: { checkbox: [[]], confirm: [false] }, ...over });
    await r.run();
    expect(r.out.join("\n")).toContain("acme, not set up");
    expect(r.out.join("\n")).not.toMatch(STAYS_OFF);
  });

  describe("with a preset that turns on a part they do not meet", () => {
    it("stops and lists what an owner shares, and where, when the secrets go only to other repositories", async () => {
      const r = narrowed();
      expect(await r.run()).toBe(1);
      expect(r.transcript.slice(r.transcript.indexOf(ASKED))).toEqual([
        ASKED,
        "",
        `✗ The presets turn on ${ALL}. They need acme's secrets, and those do not reach acme/web.`,
        'An owner of acme gives acme/web access to each of these, under "Repository access". Then run factory init again.',
        "  Secrets: FACTORY_APP_PRIVATE_KEY, and CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY",
        "     https://github.com/organizations/acme/settings/secrets/actions",
        "  Variable: FACTORY_APP_CLIENT_ID",
        "     https://github.com/organizations/acme/settings/variables/actions",
        "If one is not listed there, the owner runs this first:",
        "     factory init --org https://github.com/acme",
        "The steps in full:",
        DOCS,
        "Nothing changed.",
      ]);
    });

    it("stops with the command an owner runs when the organization is not set up", async () => {
      const r = notSetUp();
      expect(await r.run()).toBe(1);
      const at = r.transcript.findIndex((l) => l.startsWith("✗"));
      expect(r.transcript.slice(at - 1)).toEqual([
        "",
        `✗ The presets turn on ${ALL}. They need acme's secrets, and acme is not set up.`,
        "An owner of acme runs this once, from any folder. Then run factory init again.",
        "     factory init --org https://github.com/acme",
        "If acme is set up already, its secrets are not shared with acme/web. How an owner shares them:",
        DOCS,
        "Nothing changed.",
      ]);
    });

    it("says the plan keeps the secrets back too, when the organization is not set up", async () => {
      const r = notSetUp({ private: true, secretsWithheldBy: "GitHub Free" });
      expect(await r.run()).toBe(1);
      const at = r.out.indexOf(
        "     factory init --org https://github.com/acme",
      );
      expect(r.out[at + 1]).toBe(
        "GitHub Free shares those secrets only with public repositories, so also make acme/web public, or move acme to a paid plan.",
      );
    });

    /** The lines between the one on "Repository access" and the one on a
     * secret that is not listed. */
    const lists = (out: string[]) =>
      out.slice(
        out.findIndex((l) => l.includes('"Repository access"')) + 1,
        out.indexOf("If one is not listed there, the owner runs this first:"),
      );
    const SECRETS =
      "     https://github.com/organizations/acme/settings/secrets/actions";
    const VARIABLES =
      "     https://github.com/organizations/acme/settings/variables/actions";
    it.each<[string, Partial<Setup>, string, string[]]>([
      [
        "the app's key",
        {
          organizationSecrets: ["CLAUDE_CODE_OAUTH_TOKEN"],
          organizationVariables: ["FACTORY_APP_CLIENT_ID"],
        },
        "a board and builds that start from the board",
        ["  Secrets: FACTORY_APP_PRIVATE_KEY", SECRETS],
      ],
      [
        "the app's client ID",
        {
          organizationSecrets: [
            "CLAUDE_CODE_OAUTH_TOKEN",
            "FACTORY_APP_PRIVATE_KEY",
          ],
        },
        "a board and builds that start from the board",
        ["  Variable: FACTORY_APP_CLIENT_ID", VARIABLES],
      ],
      [
        "the coding agent's credential",
        {
          organizationSecrets: ["FACTORY_APP_PRIVATE_KEY"],
          organizationVariables: ["FACTORY_APP_CLIENT_ID"],
        },
        "the review and builds that start from the board",
        ["  Secrets: CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY", SECRETS],
      ],
      [
        "the app's key and client ID, with the repository's own credential",
        { secrets: { CLAUDE_CODE_OAUTH_TOKEN: "x" } },
        "a board and builds that start from the board",
        [
          "  Secrets: FACTORY_APP_PRIVATE_KEY",
          SECRETS,
          "  Variable: FACTORY_APP_CLIENT_ID",
          VARIABLES,
        ],
      ],
    ])(
      "lists only %s when only that is kept back",
      async (_, over, parts, lines) => {
        const r = narrowed(over);
        expect(await r.run()).toBe(1);
        expect(stopped(r.out)).toBe(parts);
        expect(lists(r.out)).toEqual(lines);
      },
    );

    describe.each([
      ["whose secrets go only to other repositories", narrowed, [[ROOT]]],
      ["that is not set up", notSetUp, []],
    ])("in an organization %s", (_, at, presets) => {
      it("changes nothing", async () => {
        const r = at();
        await r.run();
        expect(r.asked.filter((q) => !q.includes("presets does"))).toEqual([]);
        expect(r.read(".claude/factory.yaml")).toBeNull();
        expect(
          r.git.filter(([c]) =>
            ["add", "commit", "push", "switch"].includes(c!),
          ),
        ).toEqual([]);
        expect(r.runner.secrets.size).toBe(0);
        expect(r.synced()).toBe(0);
      });

      it("says neither that the parts stay off nor that the presets turn them on", async () => {
        const r = at();
        await r.run();
        expect(r.out.join("\n")).not.toMatch(STAYS_OFF);
        expect(r.out.join("\n")).not.toContain("From the presets");
      });

      it("stops for the presets the settings list", async () => {
        const r = at({
          argv: [],
          settings: `version: 2\nrepository: acme/web\npresets:\n  - ${ROOT}\n`,
          answers: {},
        });
        expect(await r.run()).toBe(1);
        expect(stopped(r.out)).toBe(ALL);
        expect(r.asked).toEqual([]);
      });

      it("does not count a part the repository's own settings turn on", async () => {
        const r = at({
          argv: [],
          settings: `version: 2\nrepository: acme/web\npresets:\n  - ${NODE}\n${CODE_HOST_YAML}\nspecs: none\npr-review: {}\n`,
          answers: { confirm: [false] },
        });
        await r.run();
        expect(stopped(r.out)).toBeUndefined();
        expect(r.asked).toContain("confirm: Go ahead?");
      });

      it("goes on when the repository's own secrets meet every part", async () => {
        const r = at({
          secrets: OWN,
          answers: { checkbox: [...presets, []], confirm: [false] },
        });
        await r.run();
        expect(stopped(r.out)).toBeUndefined();
        expect(r.out).toContain(`  Parts            ${ALL}`);
        expect(r.out.join("\n")).not.toMatch(STAYS_OFF);
      });

      it("does not stop when the repository's own secrets cannot be listed", async () => {
        const r = at({ runnerFails: { secretNames: new Error("HTTP 502") } });
        await r.run();
        expect(stopped(r.out)).toBeUndefined();
        expect(r.out.at(-1)).toBe("Could not reach the code host: HTTP 502");
      });
    });

    it("stops for the presets --preset names where a factory-config is found", async () => {
      const r = narrowed({ argv: ["--preset", ROOT], answers: {} });
      expect(await r.run()).toBe(1);
      expect(stopped(r.out)).toBe(ALL);
      expect(r.asked).toEqual([]);
    });
  });

  describe.each([
    ["with a factory-config", narrowed],
    ["without one", notSetUp],
  ])("when what the organization shares cannot be listed, %s", (_, at) => {
    it.each<[string, Setup["runnerFails"], string]>([
      [
        "its secrets",
        { organizationSecretNames: new Error("HTTP 403") },
        "HTTP 403",
      ],
      [
        "its variables",
        { organizationVariableNames: new Error("HTTP 404") },
        "HTTP 404",
      ],
      [
        "both",
        {
          organizationSecretNames: new Error("HTTP 403"),
          organizationVariableNames: new Error("HTTP 404"),
        },
        "HTTP 403",
      ],
    ])(
      "says so and why, and does not stop, for %s",
      async (_, runnerFails, why) => {
        const r = at({ runnerFails });
        await r.run();
        expect(r.out).toContain(
          `  Organization     acme: its secrets could not be listed (${why})`,
        );
        expect(stopped(r.out)).toBeUndefined();
        expect(r.out.join("\n")).not.toMatch(STAYS_OFF);
        expect(r.asked).toContain("confirm: Go ahead?");
      },
    );
  });

  describe("builds in the cloud, with the repository's own secrets meeting the parts", () => {
    it("are not offered when a preset's builds from the board need them", async () => {
      const r = narrowed({
        secrets: OWN,
        answers: { checkbox: [[ROOT], []], confirm: [false] },
      });
      await r.run();
      const offered = r.checkboxes.slice(1).flatMap((c) => c.names);
      expect(offered).not.toContain("Builds in the cloud");
      expect(r.out.join("\n")).not.toMatch(/turn off|so they are off too/);
    });

    it("are still offered when no preset's builds start from the board", async () => {
      const r = narrowed({
        secrets: OWN,
        answers: { checkbox: [[], []], confirm: [false] },
      });
      await r.run();
      expect(r.checkboxes[1]!.names).toContain("Builds in the cloud");
    });
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
        argv: ["--preset", GO, "--preset", NODE],
        presets: {
          ...PRESETS,
          [GO]: {
            about: "The preset for acme's Go repositories.",
            settings: {
              "code-host": { "branch-name": "{ticket}" },
              specs: "none",
            },
          },
        },
        answers: { confirm: [false] },
      });
      await r.run();
      expect(r.asked).toEqual(["confirm: Go ahead?"]);
      const at = r.transcript.indexOf(HEADING);
      expect(r.transcript.slice(at - 2, at + 1)).toEqual([
        "  Gate             npm run check",
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
