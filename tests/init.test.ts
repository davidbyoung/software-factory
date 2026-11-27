// `factory init`: what it finds, what it asks, the plan it shows, and what
// it does once told to go ahead, run against the in-memory code host,
// runner, and ticket system with scripted answers. No test reaches GitHub.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { Writable } from "node:stream";
import { join } from "node:path";
import { chmodSync, statSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { initDeps, parseRemote } from "../src/init.mts";
import { credentialsPath, readCredential } from "../src/lib/credentials.mts";
import { pagesSpecTool } from "./memory-tools";
import {
  FAKE_EMAIL,
  FAKE_PAGE,
  FAKE_TOKEN,
  REFUSED,
  withCodeHosts,
  withFakeTickets,
  scriptedAgent,
  withFakeAgent,
  withSecondRunner,
} from "./fake-tools";
import { ADD, NONE } from "../src/columns-suggest.mts";
import type { Registry } from "../src/tools.mts";
import type { Agent } from "../src/agent/types.mts";
import type { Group, TicketField, Tickets } from "../src/tickets/types.mts";
import { FACTORY_COLUMNS, FACTORY_COLUMNS_YAML } from "./factory-columns";
import { CODE_HOST, CODE_HOST_YAML } from "./settings-fixture";
import {
  AGENT,
  BRANCH_QUESTION,
  EVERY,
  GATE_QUESTION,
  GOOD,
  init,
  NARROW,
  PRIVATE_KEY,
  printsNoSecret,
  SIX_COLUMNS,
  SPEC_QUESTION,
  type Setup,
} from "./init-harness";
import * as say from "../src/lib/output.mts";

describe("factory init, a first run with every part", () => {
  const firstSetup = (): Setup => ({
    packageJson: false,
    answers: {
      checkbox: [EVERY],
      select: ["new", "own-server"],
      input: ["docs/**, **/*.md"],
      confirm: [true],
      secret: [AGENT, GOOD],
    },
  });
  const first = () => init(firstSetup());

  it("prints what it found before asking anything", async () => {
    const r = first();
    await r.run();
    const start = r.out.indexOf("Found");
    const found = r.out.slice(0, r.out.indexOf("", start)).join("\n");
    expect(found).toContain("Setting up the software factory for acme/site");
    expect(found).toMatch(/Code host +GitHub \(from your git remote\)/);
    expect(found).toMatch(/Tickets +GitHub Issues/);
    expect(found).toMatch(/Coding agent +Claude Code/);
    expect(found).toMatch(/Cloud builds +GitHub Actions/);
    expect(found).not.toContain("package.json");
  });

  it("writes the settings, the review's among them, and syncs, with no package.json and no .gitignore line", async () => {
    const r = first();
    expect(await r.run()).toBe(0);
    expect(r.yaml()).toEqual({
      specs: "none",
      version: 2,
      repository: "acme/site",
      "code-host": CODE_HOST,
      tickets: { board: 1, columns: FACTORY_COLUMNS },
      builds: { trigger: "own-server" },
      "auto-merge": { allow: ["docs/**", "**/*.md"] },
      "pr-review": { commands: [] },
    });
    expect(r.read("package.json")).toBeNull();
    expect(r.read(".gitignore")).toBeNull();
    expect(r.synced()).toBe(1);
  });

  it("creates the board with the factory's columns and fields, keeping a column that matches whatever its case", async () => {
    const r = first();
    await r.run();
    expect(r.tickets.boards).toEqual([
      {
        number: 1,
        title: "site",
        columns: [
          "Backlog",
          "In refinement",
          "Ready",
          "In Progress",
          "In review",
          "Done",
          "Todo",
        ],
        fields: ["Session", "Runs in", "Cost"],
      },
    ]);
    expect(r.columns()).toEqual(FACTORY_COLUMNS);
  });

  it("stores the agent's token, the one access token under each name, and the signing key", async () => {
    const r = first();
    await r.run();
    expect(r.ran).toContainEqual(["claude", "setup-token"]);
    expect(Object.fromEntries(r.runner.secrets)).toEqual({
      CLAUDE_CODE_OAUTH_TOKEN: AGENT,
      FACTORY_BOARD_TOKEN: GOOD,
      FACTORY_AUTOMERGE_TOKEN: GOOD,
      FACTORY_SIGNING_KEY: PRIVATE_KEY,
    });
  });

  it("joins a pasted token that wrapped across lines, and trims its ends", async () => {
    const setup = firstSetup();
    setup.answers!.secret = [
      `${AGENT.slice(0, 10)}\n${AGENT.slice(10)} `,
      ` ${GOOD}\r\n`,
    ];
    const r = init(setup);
    await r.run();
    expect(r.runner.secrets.get("CLAUDE_CODE_OAUTH_TOKEN")).toBe(AGENT);
    expect(r.runner.secrets.get("FACTORY_BOARD_TOKEN")).toBe(GOOD);
  });

  it("opens the page that makes the token, with the scopes the parts need", async () => {
    const r = first();
    await r.run();
    expect(r.opened).toEqual([
      "https://code.example/tokens/new?scopes=push,workflows,board&note=software factory: acme/site",
    ]);
  });

  it("adds the signing key to the account the token belongs to", async () => {
    const r = first();
    await r.run();
    expect(r.host.settings.signingKeys).toEqual([
      { title: "software factory builds", key: "ssh-ed25519 PUBLIC" },
    ]);
  });

  it("allows auto-merge, and leaves the rule for the review's verdict to the first run after the merge", async () => {
    const r = first();
    await r.run();
    expect(r.host.settings.autoMerge).toBe(true);
    expect(r.host.settings.rules).toEqual([]);
  });

  it("names what it cannot do, with the poller's variables but never the token", async () => {
    const r = first();
    await r.run();
    const text = r.out.join("\n");
    expect(text).not.toContain("Install the app");
    expect(text).toContain("FACTORY_REPOSITORY=acme/site");
    expect(text).toContain("FACTORY_BOARD_TOKEN=");
    expect(text).toContain("Every check passed");
    expect(text).toContain("Merge it to finish. Left to do:");
    printsNoSecret(r.out);
  });

  it("leaves the gate's commands to add, last, when the question is left empty", async () => {
    const r = first();
    await r.run();
    const left = r.out.slice(r.out.indexOf("Merge it to finish. Left to do:"));
    expect(left.slice(2, 4)).toEqual([
      "  2. Add the commands that check a change, under commands.gate in .claude/factory.yaml",
      "",
    ]);
  });

  it("colors its closing checks as doctor does, under a heading", async () => {
    const r = first();
    await r.run();
    expect(r.looks.slice(r.out.indexOf("Checks"))).toEqual([
      "{heading:Checks}",
      "  {good:✓} Every check passed",
    ]);
  });

  it("prints its closing checks under doctor's headings, indented beneath Checks", async () => {
    const r = init({
      ...firstSetup(),
      checks: [
        {
          state: "pass",
          text: "The settings are valid",
          group: "Settings and files",
        },
        {
          state: "pass",
          text: "CLAUDE.md imports the factory's rules",
          group: "Claude Code",
        },
        { state: "off", text: "A board", group: "Parts that are off" },
      ],
    });
    await r.run();
    expect(r.out.slice(r.out.indexOf("Checks") + 1)).toEqual([
      "  Settings and files",
      "    ✓ The settings are valid",
      "",
      "  Claude Code",
      "    ✓ CLAUDE.md imports the factory's rules",
      "",
      "  Parts that are off",
      "    - A board",
    ]);
  });

  it("shows the plan, naming secrets but not their values, before changing anything", async () => {
    const r = first();
    await r.run();
    const plan = r.out.slice(
      r.out.findIndex((l) => l.startsWith("This is everything")),
    );
    const text = plan.join("\n");
    expect(text).toContain(".claude/factory.yaml");
    expect(text).not.toContain("package.json");
    expect(text).toContain(
      "Copy the factory's skills, agents, rules, and guards",
    );
    expect(text).toContain("FACTORY_BOARD_TOKEN");
    expect(text).toContain('Require "Review verdict"');
    const go = r.asked.indexOf("confirm: Go ahead?");
    expect(go).toBeGreaterThan(-1);
    expect(r.asked.slice(go + 1).every((q) => q.startsWith("secret: "))).toBe(
      true,
    );
  });
});

describe("factory init, told not to go ahead", () => {
  it("changes nothing", async () => {
    const r = init({
      answers: {
        checkbox: [EVERY],
        select: ["new", "own-server"],
        input: ["docs/**"],
        confirm: [false],
      },
    });
    expect(await r.run()).toBe(0);
    expect(r.read(".claude/factory.yaml")).toBeNull();
    expect(r.synced()).toBe(0);
    expect(r.runner.secrets.size).toBe(0);
    expect(r.tickets.boards).toEqual([]);
    expect(r.host.settings.rules).toEqual([]);
    expect(r.out.at(-1)).toBe("Nothing changed.");
    printsNoSecret(r.out);
  });
});

describe("factory init, the default branch the sync writes", () => {
  const answers = {
    checkbox: [EVERY],
    select: ["new", "own-server"],
    input: ["docs/**"],
    confirm: [false],
  };

  it("lets the plan ask the code host it is setting up, since no settings name one yet", async () => {
    const r = init({ answers, defaultBranch: "develop" });

    await r.run();

    expect(r.branchAsked).toEqual(["develop"]);
  });

  it("stops before asking to go ahead, naming the fix, when nobody can tell it", async () => {
    const r = init({ answers, defaultBranch: null });

    expect(await r.run()).toBe(1);
    expect(r.out.at(-1)).toBe(
      "Could not tell the default branch. Run: git remote set-head origin --auto",
    );
    expect(r.read(".claude/factory.yaml")).toBeNull();
    expect(r.synced()).toBe(0);
  });
});

describe("factory init, run again", () => {
  const SETTINGS = [
    "# Our settings.",
    "version: 2",
    "repository: acme/site",
    CODE_HOST_YAML,
    "tickets:",
    "  board: 3 # the roadmap",
    "auto-merge:",
    "  allow:",
    "    - docs/**",
    "commands:",
    "  before-commit:",
    "    - npm run lint",
    "",
  ].join("\n");
  const SET = {
    FACTORY_BOARD_TOKEN: "x",
    FACTORY_AUTOMERGE_TOKEN: "x",
  };

  it("starts from the parts already on, and does not ask for a secret already set", async () => {
    const r = init({
      settings: SETTINGS,
      secrets: SET,
      boards: [
        {
          number: 3,
          title: "Roadmap",
          columns: [
            "Backlog",
            "In refinement",
            "Ready",
            "In progress",
            "In review",
            "Done",
          ],
        },
      ],
      answers: { checkbox: [["board", "auto-merge"]], confirm: [false, true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.asked).toEqual([
      "select: Which spec tool do you use?",
      "checkbox: Which parts do you want?",
      `input: ${GATE_QUESTION}`,
      "confirm: 2 secrets these parts read are already set. Replace them?",
      "confirm: Go ahead?",
    ]);
    expect(r.opened).toEqual([]);
  });

  const rerun = (settings: string) =>
    init({
      settings,
      secrets: SET,
      boards: [{ number: 3, title: "Roadmap", columns: [] }],
      answers: { checkbox: [["board", "auto-merge"]], confirm: [false, true] },
    });
  const GATE_STEP =
    "Add the commands that check a change, under commands.gate in .claude/factory.yaml";

  it("leaves the gate's commands to add when the settings have none", async () => {
    const r = rerun(SETTINGS);
    await r.run();
    expect(r.out.join("\n")).toContain(`  1. ${GATE_STEP}`);
  });

  it("leaves the gate's commands to add when the settings write an empty list", async () => {
    const r = rerun(`${SETTINGS}  gate: []\n`);
    await r.run();
    expect(r.out.join("\n")).toContain(`  1. ${GATE_STEP}`);
  });

  it("leaves no step about the gate when the settings have one", async () => {
    const r = rerun(`${SETTINGS}  gate:\n    - npm run check\n`);
    await r.run();
    expect(r.out.join("\n")).not.toContain("commands.gate");
    expect(r.out).toContain("Merge it to finish. Nothing else is left to do.");
  });

  it("turns a part off, keeping the rest of the settings and their comments", async () => {
    const r = init({
      settings: SETTINGS,
      secrets: SET,
      boards: [{ number: 3, title: "Roadmap", columns: [] }],
      answers: { checkbox: [["board"]], confirm: [false, true] },
    });
    await r.run();
    const text = r.read(".claude/factory.yaml")!;
    expect(text).toContain("# Our settings.");
    expect(text).toContain("board: 3 # the roadmap");
    expect(text).toContain("npm run lint");
    expect(text).not.toContain("auto-merge");
    expect(r.out.join("\n")).toContain(
      "You can now delete these secrets: FACTORY_AUTOMERGE_TOKEN",
    );
  });

  it("stores a newly pasted token in place of one already set, when told to replace it", async () => {
    const r = init({
      settings: SETTINGS,
      secrets: SET,
      boards: [{ number: 3, title: "Roadmap", columns: [] }],
      answers: {
        checkbox: [["board", "auto-merge"]],
        confirm: [true, true],
        secret: [GOOD],
      },
    });
    await r.run();
    expect(r.runner.secrets.get("FACTORY_BOARD_TOKEN")).toBe(GOOD);
    expect(r.runner.secrets.get("FACTORY_AUTOMERGE_TOKEN")).toBe(GOOD);
    printsNoSecret(r.out);
  });

  it("gives a board the columns the settings name, not the defaults they rename", async () => {
    const r = init({
      settings: `version: 2\nrepository: acme/site\n${CODE_HOST_YAML}\ntickets:\n  board: 3\n  columns:\n    backlog: Todo\n`,
      boards: [
        {
          number: 3,
          title: "Roadmap",
          columns: [
            "Todo",
            "In refinement",
            "Ready",
            "In progress",
            "In review",
            "Done",
          ],
        },
      ],
      secrets: { FACTORY_BOARD_TOKEN: "x" },
      answers: { checkbox: [["board"]], confirm: [false, true] },
    });
    await r.run();
    expect(r.tickets.boards[0].columns).toEqual([
      "Todo",
      "In refinement",
      "Ready",
      "In progress",
      "In review",
      "Done",
    ]);
  });

  it("turns off a board whose columns the settings rename, leaving valid settings", async () => {
    const r = init({
      settings: `version: 2\nrepository: acme/site\n${CODE_HOST_YAML}\ntickets:\n  board: 3\n  columns:\n    backlog: Todo\n  fields:\n    cost: none\n`,
      secrets: { FACTORY_BOARD_TOKEN: "x" },
      answers: { checkbox: [[]], confirm: [true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.yaml()).toEqual({
      specs: "none",
      version: 2,
      repository: "acme/site",
      "code-host": CODE_HOST,
    });
  });

  it("takes the review's setting out when the review is turned off, so the sync removes its workflow", async () => {
    const r = init({
      settings: `version: 2\nrepository: acme/site\n${CODE_HOST_YAML}\npr-review:\n  commands:\n    - npm test\n`,
      answers: { checkbox: [[]], confirm: [true] },
    });
    await r.run();
    expect(r.yaml()).toEqual({
      specs: "none",
      version: 2,
      repository: "acme/site",
      "code-host": CODE_HOST,
    });
  });

  it("keeps the review's commands when the review stays on", async () => {
    const r = init({
      settings: `version: 2\nrepository: acme/site\n${CODE_HOST_YAML}\npr-review:\n  commands:\n    - npm test\n`,
      answers: { checkbox: [["review"]], confirm: [true], secret: [""] },
    });
    await r.run();
    expect(r.yaml()).toMatchObject({ "pr-review": { commands: ["npm test"] } });
  });
});

describe("factory init, the access token", () => {
  it("refuses a token that lacks a scope, naming it, and takes the next", async () => {
    const r = init({
      answers: {
        checkbox: [["cloud"]],
        confirm: [true],
        secret: [AGENT, NARROW, GOOD],
      },
    });
    await r.run();
    expect(r.out).toContain(
      "That token lacks workflows. Make one with every scope checked, and paste it.",
    );
    expect(r.runner.secrets.get("FACTORY_BUILD_TOKEN")).toBe(GOOD);
    printsNoSecret(r.out);
  });

  it("names the scopes to tick as a list", async () => {
    const r = init({
      answers: {
        checkbox: [["board"]],
        select: ["new"],
        confirm: [true],
        secret: [GOOD],
      },
    });
    await r.run();
    expect(r.out).toContain(
      "Check that push, workflows, and board are ticked, choose an expiry, and generate it. 90 days is a good balance: the factory warns you 30 days before it.",
    );
  });

  it("says what a token whose scopes the code host does not report must do", async () => {
    const r = init({
      tokens: { fine: { account: "dave", scopes: null } },
      answers: {
        checkbox: [["board"]],
        select: ["new"],
        confirm: [true],
        secret: ["fine"],
      },
    });
    await r.run();
    expect(r.out).toContain(
      "The code host does not say what this token may do: make sure it can push a branch, change a workflow's file, and write the board.",
    );
  });

  it("leaves the token for later when nothing is pasted", async () => {
    const r = init({
      answers: { checkbox: [["cloud"]], confirm: [true], secret: [AGENT, ""] },
    });
    await r.run();
    expect(r.runner.secrets.has("FACTORY_BUILD_TOKEN")).toBe(false);
    expect(r.out.join("\n")).toContain(
      "No token stored. Run factory init again to add it.",
    );
  });

  it("stops before its first question when the coding agent is not installed", async () => {
    const r = init({
      agent: scriptedAgent([], { installed: false }),
      boards: [{ number: 3, title: "Shop board", columns: ["Todo"] }],
      answers: {},
    });
    expect(await r.run()).toBe(1);
    expect(r.out).toEqual([
      "Setting up the software factory for acme/site",
      "",
      "The factory runs in a coding agent, and Claude Code is not installed.",
      "Install it and run factory init again.",
      "Nothing changed.",
    ]);
    expect(r.asked).toEqual([]);
    expect(r.read(".claude/factory.yaml")).toBeNull();
    expect(r.runner.secrets.size).toBe(0);
    expect(r.tickets.boards[0].columns).toEqual(["Todo"]);
  });
});

describe("factory init, the signing key", () => {
  it("asks for the permission a signing key needs, then adds it", async () => {
    const r = init({
      signingNeedsScope: true,
      answers: {
        checkbox: [["cloud", "signing"]],
        confirm: [true, true],
        secret: [AGENT, GOOD],
      },
    });
    await r.run();
    expect(r.ran).toContainEqual(["grant", "signing"]);
    expect(r.host.settings.signingKeys).toHaveLength(1);
  });

  it("prints the public half when the permission is declined", async () => {
    const r = init({
      signingNeedsScope: true,
      answers: {
        checkbox: [["cloud", "signing"]],
        confirm: [true, false],
        secret: [AGENT, GOOD],
      },
    });
    await r.run();
    expect(r.host.settings.signingKeys).toEqual([]);
    expect(r.out.join("\n")).toContain("ssh-ed25519 PUBLIC");
    expect(r.looks).toContainEqual(
      expect.stringMatching(/^\{yourTurn:Add this public key to .*:\}$/),
    );
    expect(r.looks).toContainEqual(
      expect.stringMatching(/^ {2}\{copy:ssh-ed25519 PUBLIC.*\}$/),
    );
    expect(r.runner.secrets.get("FACTORY_SIGNING_KEY")).toBe(PRIVATE_KEY);
    printsNoSecret(r.out);
  });
});

describe("factory init, the board", () => {
  it("offers the owner's boards, and gives a chosen one what it lacks", async () => {
    const r = init({
      boards: [{ number: 4, title: "Roadmap", columns: ["Todo", "Done"] }],
      agent: scriptedAgent([
        {
          answer: {
            backlog: "Todo",
            refining: NONE,
            ready: NONE,
            building: ADD,
            review: ADD,
            done: "Done",
          },
        },
      ]),
      answers: {
        checkbox: [["board"]],
        select: ["4", "no"],
        confirm: [true],
        secret: [GOOD],
      },
    });
    await r.run();
    printsNoSecret(r.out);
    expect(r.yaml().tickets).toEqual({ board: 4, columns: FACTORY_COLUMNS });
    expect(r.tickets.boards[0].columns.slice(0, 6)).toEqual([
      "Backlog",
      "In refinement",
      "Ready",
      "In progress",
      "In review",
      "Done",
    ]);
  });

  it("says so when the owner's settings refuse a new board, and offers the others", async () => {
    const r = init({
      createRefused: "Projects are turned off for this organization",
      boards: [{ number: 4, title: "Roadmap", columns: [] }],
      answers: {
        checkbox: [["board"]],
        select: ["new", "4"],
        confirm: [true],
        secret: [GOOD],
      },
    });
    await r.run();
    printsNoSecret(r.out);
    expect(r.out.join("\n")).toContain(
      "Could not create a board: Projects are turned off for this organization",
    );
    expect(r.yaml().tickets).toEqual({ board: 4, columns: FACTORY_COLUMNS });
  });

  it("goes on without a board when it cannot make one and there is no other", async () => {
    const r = init({
      createRefused: "Projects are turned off for this organization",
      answers: {
        checkbox: [["board"]],
        select: ["new"],
        confirm: [true],
        secret: [GOOD],
      },
    });
    expect(await r.run()).toBe(0);
    expect(r.out.join("\n")).toContain(
      "No board to use instead: create one on the code host, then run factory init again.",
    );
    expect(r.yaml()).toEqual({
      specs: "none",
      version: 2,
      repository: "acme/site",
      "code-host": CODE_HOST,
    });
  });

  it("turns on a board and cloud builds with builds that start from the board", async () => {
    const r = init({
      answers: {
        checkbox: [["from-board"]],
        select: ["new", "own-server"],
        confirm: [true],
        secret: [AGENT, GOOD],
      },
    });
    await r.run();
    printsNoSecret(r.out);
    expect(r.out).toContain(
      "Builds that start from the board need a board, so that is on too.",
    );
    expect(r.yaml().tickets).toEqual({ board: 1, columns: FACTORY_COLUMNS });
  });
});

describe("factory init, where the poller runs", () => {
  const WHERE = "select: Where does the poller run?";
  const HOW_OFTEN = "select: How often?";
  const chosen = (where: string, more: Partial<Setup> = {}, often?: string) =>
    init({
      ...more,
      answers: {
        checkbox: [["from-board"]],
        select: ["new", where, ...(often ? [often] : [])],
        confirm: [true],
        secret: [AGENT, GOOD],
      },
    });

  it("describes the part as running on a schedule or a server you host", async () => {
    const r = chosen("github-action");
    await r.run();

    expect(r.descriptions[0]!["from-board"]).toBe(
      "a schedule on GitHub Actions, or a small server you host",
    );
  });

  it("offers the schedule first, then a server you host", async () => {
    const r = chosen("github-action");
    await r.run();

    expect(r.asked).toContain(WHERE);
    expect(r.selects[1]!.names).toEqual([
      "A schedule on GitHub Actions, every 5 minutes, nothing to host",
      "A server you host, within a minute",
    ]);
    expect(r.offered[1]).toEqual(["github-action", "own-server"]);
  });

  it("writes the trigger it is given, and on a public repository asks no interval", async () => {
    const r = chosen("github-action");
    await r.run();

    expect(r.asked).not.toContain(HOW_OFTEN);
    expect(r.yaml().builds).toEqual({ trigger: "github-action" });
  });

  it("writes own-server for a server you host", async () => {
    const r = chosen("own-server");
    await r.run();

    expect(r.yaml().builds).toEqual({ trigger: "own-server" });
  });

  it("on a private repository, asks how often, with each interval's runs a month and what a run bills, suggesting 30", async () => {
    const r = chosen("github-action", { private: true }, "15");
    await r.run();

    expect(r.out).toContain(
      "Each run bills at least one Actions minute on a private repository.",
    );
    expect(r.selects[2]).toEqual({
      names: [
        "Every 5 minutes, 8,640 runs a month",
        "Every 10 minutes, 4,320 runs a month",
        "Every 15 minutes, 2,880 runs a month",
        "Every 30 minutes, 1,440 runs a month",
        "Every 60 minutes, 720 runs a month",
      ],
      fallback: "30",
    });
    expect(r.yaml().builds).toEqual({
      trigger: "github-action",
      "poll-minutes": 15,
    });
  });

  it("writes no interval for an answer of 5, the default", async () => {
    const r = chosen("github-action", { private: true }, "5");
    await r.run();

    expect(r.yaml().builds).toEqual({ trigger: "github-action" });
  });

  it("leaves no step about hosting a poller when the schedule runs it", async () => {
    const r = chosen("github-action");
    await r.run();

    expect(r.out.join("\n")).not.toMatch(/poller/i);
  });

  it("names the poller's image and its two variables for a server you host", async () => {
    const r = chosen("own-server");
    await r.run();

    expect(r.out).toContain(
      [
        "  1. Run the poller's image, ghcr.io/davidbyoung/software-factory-poller:0.2.0, where you host it, with:",
        "       FACTORY_REPOSITORY=acme/site",
        "       FACTORY_BOARD_TOKEN=the access token you just made",
        "     It reads the rest from your settings once this pull request merges.",
      ].join("\n"),
    );
  });

  it("gives each variable as one to copy, and the line after them as plain words", async () => {
    const r = chosen("own-server");
    await r.run();
    const left = r.looks.find((l) => l.includes("Run the poller's image"));
    expect(left).toMatch(/^ {2}\{yourTurn:1\.\} Run the poller's image/);
    expect(left!.split("\n").slice(1)).toEqual([
      "       {copy:FACTORY_REPOSITORY=acme/site}",
      "       {copy:FACTORY_BOARD_TOKEN=the access token you just made}",
      "     It reads the rest from your settings once this pull request merges.",
    ]);
  });

  it("says the poller reads the settings once they are on the default branch, when no pull request opened", async () => {
    const r = chosen("own-server", {
      git: (args) => (args[0] === "status" ? { stdout: "" } : undefined),
    });
    await r.run();

    expect(r.out.join("\n")).not.toMatch(/Opened/);
    expect(r.out.join("\n")).toContain(
      "     It reads the rest from your settings once they are on main.",
    );
  });

  it.each(["github-action", "own-server"])(
    "asks neither question on a re-run that finds the trigger %s",
    async (trigger) => {
      const r = init({
        private: true,
        settings: [
          "version: 2",
          "repository: acme/site",
          CODE_HOST_YAML,
          "tickets:",
          "  board: 3",
          "builds:",
          `  trigger: ${trigger}`,
          "",
        ].join("\n"),
        secrets: { CLAUDE_CODE_OAUTH_TOKEN: "x", FACTORY_BOARD_TOKEN: "x" },
        boards: [{ number: 3, title: "Roadmap", columns: SIX_COLUMNS }],
        answers: {
          checkbox: [["board", "cloud", "from-board"]],
          confirm: [false, true],
        },
      });
      await r.run();

      expect(r.asked).not.toContain(WHERE);
      expect(r.asked).not.toContain(HOW_OFTEN);
      expect(r.yaml().builds).toEqual({ trigger });
    },
  );

  it("takes out the interval with the part", async () => {
    const r = init({
      settings: [
        "version: 2",
        "repository: acme/site",
        CODE_HOST_YAML,
        "tickets:",
        "  board: 3",
        "builds:",
        "  trigger: github-action",
        "  poll-minutes: 30",
        "",
      ].join("\n"),
      secrets: { CLAUDE_CODE_OAUTH_TOKEN: "x", FACTORY_BOARD_TOKEN: "x" },
      boards: [{ number: 3, title: "Roadmap", columns: SIX_COLUMNS }],
      answers: { checkbox: [["board", "cloud"]], confirm: [false, true] },
    });
    await r.run();

    expect(r.yaml().builds).toBeUndefined();
  });
});

describe("factory init, repository rules", () => {
  it("says so when the plan allows no rule, and carries on", async () => {
    const r = init({
      rulesRefused: "Upgrade to GitHub Pro or make this repository public",
      workflows: { "factory.yml": "active" },
      answers: { checkbox: [["review"]], confirm: [true], secret: [AGENT] },
    });
    expect(await r.run()).toBe(0);
    expect(r.out.join("\n")).toContain(
      'Could not require "Review verdict": Upgrade to GitHub Pro or make this repository public',
    );
    expect(r.out.join("\n")).toContain("Every check passed");
  });
});

describe("factory init, what CI's own token may do", () => {
  const LEFT =
    "Set CI's own token to read, since code in a pull request could pass \"Review verdict\" with it: your repository's Settings, Actions, General, Workflow permissions. A workflow of yours that writes then says so under its own permissions";
  const answers = (parts: string[]) => ({
    checkbox: [parts],
    confirm: [true],
    secret: [AGENT],
  });

  it.each([
    ["is left to do where it can write", ["review"], true, true],
    ["is nothing to do where it can read", ["review"], false, false],
    ["is nothing to do with the review off", [], true, false],
  ])("%s", async (_, parts, jobsMayWrite, left) => {
    const r = init({ jobsMayWrite, answers: answers(parts) });
    expect(await r.run()).toBe(0);
    expect(r.out.join("\n").includes(LEFT)).toBe(left);
  });
});

describe("factory init, the events the factory's workflow starts on", () => {
  const ROW =
    '  policy        Let .github/workflows/factory.yml run on pull_request_target, as the policy "Software factory"';
  const answers = { checkbox: [[]], confirm: [true] };

  it("plans the policy and adds it where the code host holds the event back", async () => {
    const r = init({ eventsHeld: true, answers });
    expect(await r.run()).toBe(0);
    expect(r.out).toContain(ROW);
    expect(r.out).toContain(
      "✓ Allowed pull_request_target for .github/workflows/factory.yml.",
    );
    expect(r.out.indexOf(ROW)).toBeLessThan(
      r.out.indexOf(
        "✓ Allowed pull_request_target for .github/workflows/factory.yml.",
      ),
    );
    expect(
      await r.host.codeHost.eventAllowed(
        ".github/workflows/factory.yml",
        "pull_request_review",
      ),
    ).toBe("allowed");
  });

  it("leaves it to do by hand, saying where, when the policy cannot be added", async () => {
    const r = init({
      eventsHeld: true,
      eventsRefused: "Resource not accessible",
      answers,
    });
    expect(await r.run()).toBe(0);
    expect(r.out.join("\n")).not.toContain("✓ Allowed pull_request_target");
    expect(r.out.join("\n")).toMatch(
      /\d+\. Let \.github\/workflows\/factory\.yml run on pull_request_target: your repository's Settings, Actions, Policies/,
    );
  });

  it("plans nothing where the code host holds nothing back", async () => {
    const r = init({ answers });
    expect(await r.run()).toBe(0);
    expect(r.out.join("\n")).not.toContain("Policy");
    expect(r.host.log.filter((l) => l.startsWith("allowEvents"))).toEqual([]);
  });
});

describe("factory init, word for word", () => {
  /** The transcript, with this test's config folder as a person's own. */
  const shown = (r: ReturnType<typeof init>) =>
    r.transcript.map((l) => l.replace(r.env.XDG_CONFIG_HOME, "~/.config"));

  it("prints and asks the same on a first run with every part", async () => {
    const r = init({
      packageJson: false,
      answers: {
        checkbox: [EVERY],
        select: ["new", "own-server"],
        input: ["docs/**, **/*.md"],
        confirm: [true],
        secret: [AGENT, GOOD],
      },
    });
    expect(await r.run()).toBe(0);
    expect(shown(r)).toMatchInlineSnapshot(`
      [
        "Setting up the software factory for acme/site",
        "",
        "Found",
        "  Code host      GitHub (from your git remote)",
        "  Account        acme, a personal account",
        "  Tickets        GitHub Issues",
        "  Coding agent   Claude Code",
        "  Cloud builds   GitHub Actions",
        "  Settings       none yet",
        "  Board          none yet",
        "  This machine   no GitHub token for cloud runs",
        "",
        "? input: How should a build name its branch? Use {ticket}, and {user} for the GitHub account:",
        "? select: Which spec tool do you use?",
        "? checkbox: Which parts do you want?",
        "? select: Which board?",
        "? input: Which files may merge without you? (comma-separated)",
        "? select: Where does the poller run?",
        "? input: Which command checks a change here, such as npm test? (leave empty to add it later)",
        "",
        "This is everything setup will do:",
        "  settings      Write .claude/factory.yaml",
        "  files         Copy the factory's skills, agents, rules, and guards",
        "  create        board "site" under acme, linked to the repository, with the factory's columns and fields",
        "  secrets       CLAUDE_CODE_OAUTH_TOKEN, FACTORY_BOARD_TOKEN, FACTORY_AUTOMERGE_TOKEN, FACTORY_SIGNING_KEY",
        "  store         your GitHub token and your Claude token on this machine, in ~/.config/software-factory/credentials.yaml",
        "  repository    allow auto-merge on the repository",
        "  rules         Require "Review verdict" before a merge to the default branch, as the rule "Software factory", once this pull request merges",
        "  pull request  Push the branch set-up-factory and open a pull request",
        "? confirm: Go ahead?",
        "Created board 1, "site".",
        "Added to board 1: Backlog, In refinement, Ready, In review, Session, Runs in, Cost.",
        "",
        "The coding agent's token: running claude setup-token...",
        "? secret: Paste the token it printed, the line that starts sk-ant-oat01- (leave empty to do this later):",
        "Trying the token...",
        "Stored for acme/site, and on this machine for your next repository.",
        "",
        "An access token: opening https://code.example/tokens/new?scopes=push,workflows,board&note=software factory: acme/site",
        "Check that push, workflows, and board are ticked, choose an expiry, and generate it. 90 days is a good balance: the factory warns you 30 days before it.",
        "? secret: Paste it (leave empty to do this later):",
        "It belongs to dave. Stored for acme/site, and on this machine for your next repository.",
        "",
        "Made a signing key and stored it as FACTORY_SIGNING_KEY.",
        "Added its public half to dave as a signing key.",
        "",
        "✓ Opened acme/site#1, "Set up the software factory".",
        "Merge it to finish. Left to do:",
        "  1. Run the poller's image, ghcr.io/davidbyoung/software-factory-poller:0.2.0, where you host it, with:
             FACTORY_REPOSITORY=acme/site
             FACTORY_BOARD_TOKEN=the access token you just made
           It reads the rest from your settings once this pull request merges.",
        "  2. Add the commands that check a change, under commands.gate in .claude/factory.yaml",
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
      ]
    `);
  });

  it("prints and asks the same on a re-run with every part on and every secret set", async () => {
    const r = init({
      settings: [
        "version: 2",
        "repository: acme/site",
        CODE_HOST_YAML,
        "tickets:",
        "  board: 3",
        FACTORY_COLUMNS_YAML,
        "builds:",
        "  trigger: own-server",
        "auto-merge:",
        "  allow:",
        "    - docs/**",
        "pr-review:",
        "  commands: []",
        "specs: none",
        "",
      ].join("\n"),
      secrets: {
        CLAUDE_CODE_OAUTH_TOKEN: "x",
        FACTORY_BOARD_TOKEN: "x",
        FACTORY_AUTOMERGE_TOKEN: "x",
        FACTORY_SIGNING_KEY: "x",
      },
      boards: [{ number: 3, title: "Roadmap", columns: SIX_COLUMNS }],
      workflows: { "factory.yml": "active" },
      answers: { checkbox: [EVERY], confirm: [false, true] },
    });
    expect(await r.run()).toBe(0);
    expect(shown(r)).toMatchInlineSnapshot(`
      [
        "Setting up the software factory for acme/site",
        "",
        "Found",
        "  Code host      GitHub (from your git remote)",
        "  Account        acme, a personal account",
        "  Tickets        GitHub Issues",
        "  Coding agent   Claude Code",
        "  Cloud builds   GitHub Actions",
        "  Settings       .claude/factory.yaml",
        "  Board          3, from your settings",
        "  This machine   no GitHub token for cloud runs",
        "",
        "? checkbox: Which parts do you want?",
        "? input: Which command checks a change here, such as npm test? (leave empty to add it later)",
        "? confirm: 4 secrets these parts read are already set. Replace them?",
        "",
        "This is everything setup will do:",
        "  files         Copy the factory's skills, agents, rules, and guards",
        "  board         give board 3 any of the factory's columns and fields it lacks",
        "  repository    allow auto-merge on the repository",
        "  rules         Require "Review verdict" before a merge to the default branch, as the rule "Software factory"",
        "  pull request  Push the branch set-up-factory and open a pull request",
        "? confirm: Go ahead?",
        "Added to board 3: Session, Runs in, Cost.",
        "",
        "✓ Opened acme/site#1, "Change the software factory's settings".",
        "Merge it to finish. Left to do:",
        "  1. Run the poller's image, ghcr.io/davidbyoung/software-factory-poller:0.2.0, where you host it, with:
             FACTORY_REPOSITORY=acme/site
             FACTORY_BOARD_TOKEN=the access token you just made
           It reads the rest from your settings once this pull request merges.",
        "  2. Add the commands that check a change, under commands.gate in .claude/factory.yaml",
        "",
        "After it merges, come back to main and bring it up to date: git switch main && git pull",
        "",
        "Checks",
        "  ✓ Every check passed",
      ]
    `);
  });
});

describe("factory init, a secret met another way", () => {
  it("asks for no token for cloud builds when the board's token, which they also read, is set", async () => {
    const r = init({
      settings: `version: 2\nrepository: acme/site\n${CODE_HOST_YAML}\n`,
      secrets: { CLAUDE_CODE_OAUTH_TOKEN: "x", FACTORY_BOARD_TOKEN: "x" },
      answers: { checkbox: [["cloud"]], confirm: [false, true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.asked).toEqual([
      "select: Which spec tool do you use?",
      "checkbox: Which parts do you want?",
      `input: ${GATE_QUESTION}`,
      "confirm: 2 secrets these parts read are already set. Replace them?",
      "confirm: Go ahead?",
    ]);
    expect(r.opened).toEqual([]);
  });
});

describe("factory init, a tool's own setup", () => {
  /** Fake Tickets as the only ticket system. */
  const fakeOnly = (b: Registry, t: Tickets) => withFakeTickets(b, t, true);
  const FAKE = `version: 2\nrepository: acme/site\n${CODE_HOST_YAML}\ntickets:\n  type: fake\n`;

  it("asks for the value the ticket system needs, and writes it under tickets", async () => {
    const r = init({
      tools: fakeOnly,
      answers: {
        checkbox: [[]],
        input: ["https://tickets.example"],
        confirm: [true],
        secret: [""],
      },
    });
    expect(await r.run()).toBe(0);
    expect(r.asked.slice(0, 4)).toEqual([
      `input: ${BRANCH_QUESTION}`,
      "select: Which spec tool do you use?",
      "checkbox: Which parts do you want?",
      "input: Your ticket system's address",
    ]);
    expect(r.yaml().tickets).toEqual({
      type: "fake",
      site: "https://tickets.example",
    });
    expect(r.out).toContain("  settings      Write .claude/factory.yaml");
  });

  it("does not ask again for a value already in the settings", async () => {
    const r = init({
      tools: fakeOnly,
      settings: `${FAKE}  site: https://tickets.example\n`,
      secrets: { [FAKE_TOKEN]: "x" },
      answers: { checkbox: [[]], confirm: [false, true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.asked.filter((q) => q.startsWith("input:"))).toEqual([
      `input: ${GATE_QUESTION}`,
    ]);
  });

  it("gets the tool's secret its way, and stores it under the tool's name", async () => {
    const r = init({
      tools: fakeOnly,
      settings: `${FAKE}  site: https://tickets.example\n`,
      answers: { checkbox: [[]], confirm: [true], secret: [GOOD] },
    });
    expect(await r.run()).toBe(0);
    expect(r.out).toContain(`  secrets       ${FAKE_TOKEN}`);
    expect(r.transcript).toEqual(
      expect.arrayContaining([
        `Fake Tickets' token: opening ${FAKE_PAGE}`,
        "? secret: Paste the Fake Tickets token (leave empty to do this later):",
        `Stored as ${FAKE_TOKEN}.`,
      ]),
    );
    expect(r.opened).toEqual([FAKE_PAGE]);
    expect(r.runner.secrets.get(FAKE_TOKEN)).toBe(GOOD);
    printsNoSecret(r.out);
  });

  it("prints the tool's reason for refusing a secret, and asks again", async () => {
    const r = init({
      tools: fakeOnly,
      settings: `${FAKE}  site: https://tickets.example\n`,
      answers: { checkbox: [[]], confirm: [true], secret: ["bad", GOOD] },
    });
    expect(await r.run()).toBe(0);
    expect(r.out).toContain("That token is refused.");
    expect(r.runner.secrets.get(FAKE_TOKEN)).toBe(GOOD);
  });

  it("stores nothing when nothing is pasted, and says to run init again", async () => {
    const r = init({
      tools: fakeOnly,
      settings: `${FAKE}  site: https://tickets.example\n`,
      answers: { checkbox: [[]], confirm: [true], secret: [""] },
    });
    expect(await r.run()).toBe(0);
    expect(r.out).toContain(
      "No Fake Tickets token stored. Run factory init again to add it.",
    );
    expect(r.runner.secrets.has(FAKE_TOKEN)).toBe(false);
  });

  const fakeSet = (replace: boolean) =>
    init({
      tools: fakeOnly,
      settings: `${FAKE}  site: https://tickets.example\n`,
      secrets: { [FAKE_TOKEN]: "x" },
      answers: {
        checkbox: [[]],
        confirm: [replace, true],
        secret: replace ? [GOOD] : [],
      },
    });

  it("keeps a secret already set, asking nothing, when told not to replace it", async () => {
    const r = fakeSet(false);
    await r.run();
    expect(r.asked).toContain(
      "confirm: 1 secret these parts read is already set. Replace it?",
    );
    expect(r.asked.some((q) => q.startsWith("secret:"))).toBe(false);
    expect(r.runner.secrets.get(FAKE_TOKEN)).toBe("x");
  });

  it("asks for a secret already set when told to replace it", async () => {
    const r = fakeSet(true);
    await r.run();
    expect(r.runner.secrets.get(FAKE_TOKEN)).toBe(GOOD);
  });
});

describe("factory init, the branch name", () => {
  const ASKED = `input: ${BRANCH_QUESTION}`;
  const quick = (over: Partial<Setup> = {}) =>
    init({ answers: { checkbox: [[]], confirm: [true] }, ...over });

  it("asks for it first when one tool of each kind leaves nothing to choose", async () => {
    const r = quick();
    expect(await r.run()).toBe(0);
    expect(r.asked[0]).toBe(ASKED);
  });

  it("asks for it right after the tools are chosen", async () => {
    const r = init({
      tools: withSecondRunner,
      answers: { select: ["fake-runner"], checkbox: [[]], confirm: [true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.asked.slice(0, 2)).toEqual([
      "select: Where do cloud builds run?",
      ASKED,
    ]);
  });

  it("writes the pattern it offers, quoted, in a code-host block", async () => {
    const r = quick();
    await r.run();
    expect(r.read(".claude/factory.yaml")).toContain(
      'code-host:\n  type: github\n  branch-name: "{ticket}"\n',
    );
  });

  it("writes a pattern of the person's own, quoted", async () => {
    const r = quick({
      answers: {
        checkbox: [[]],
        confirm: [true],
        branch: ["feature/{user}/{ticket}"],
      },
    });
    await r.run();
    expect(r.read(".claude/factory.yaml")).toContain(
      'code-host:\n  type: github\n  branch-name: "feature/{user}/{ticket}"\n',
    );
  });

  it("says why it refuses a pattern, and asks again", async () => {
    const r = quick({
      answers: {
        checkbox: [[]],
        confirm: [true],
        branch: ["{slug}", "a b/{ticket}", "issue-{ticket}"],
      },
    });
    expect(await r.run()).toBe(0);
    expect(r.asked.filter((q) => q === ASKED)).toHaveLength(3);
    expect(r.out).toContain(
      "{slug} is not a placeholder. The placeholders are {ticket} and {user}",
    );
    expect(r.out).toContain(
      "a b/{ticket} can't be a git branch name: it has a space",
    );
    expect(r.yaml()["code-host"]).toEqual({
      type: "github",
      "branch-name": "issue-{ticket}",
    });
  });

  it("asks nothing on a re-run whose settings have it, and keeps it", async () => {
    const settings = [
      "version: 2",
      "repository: acme/site",
      "code-host:",
      "  type: github",
      '  branch-name: "feature/{user}/{ticket}"',
      "",
    ].join("\n");
    const r = quick({ settings });
    expect(await r.run()).toBe(0);
    expect(r.asked).not.toContain(ASKED);
    expect(r.yaml()["code-host"]).toEqual({
      type: "github",
      "branch-name": "feature/{user}/{ticket}",
    });
  });

  it("asks nothing when a preset in effect supplies it, and writes none", async () => {
    const r = quick({
      settings: "version: 2\nrepository: acme/site\n",
      presetBranchName: "feature/{user}/{ticket}",
    });
    expect(await r.run()).toBe(0);
    expect(r.asked).not.toContain(ASKED);
    expect(r.yaml()["code-host"]).toBeUndefined();
  });

  it("adds it to a code-host block that has only a type, keeping the block", async () => {
    const r = quick({
      settings:
        "version: 2\nrepository: acme/site\ncode-host:\n  # ours\n  type: github\n",
    });
    expect(await r.run()).toBe(0);
    expect(r.read(".claude/factory.yaml")).toContain(
      'code-host:\n  # ours\n  type: github\n  branch-name: "{ticket}"\n',
    );
  });

  it("reads a file set up before it was required, asks for it, and writes the block", async () => {
    const r = quick({
      settings: "version: 2\nrepository: acme/site\ncode-host: github\n",
    });
    expect(await r.run()).toBe(0);
    expect(r.out).not.toContain("Fix it, then run init again.");
    expect(r.asked).toContain(ASKED);
    expect(r.yaml()["code-host"]).toEqual({
      type: "github",
      "branch-name": "{ticket}",
    });
  });
});

describe("factory init, the spec tool", () => {
  const NONE_CHOICE = "None: each ticket holds its own spec";
  const OPENSPEC_CHOICE =
    "OpenSpec: each ticket holds its spec, and each build also keeps it in openspec/specs/";
  const INSTALL_ROW =
    "  install       @fission-ai/openspec, with npm install --save-dev";
  const plain = { checkbox: [[]], confirm: [true] };
  const withSpecs = (specs: string) =>
    `version: 2\nrepository: acme/site\n${CODE_HOST_YAML}\n${specs}\n`;

  it("asks which spec tool right after the branch name, offering None first and choosing it on Enter", async () => {
    const r = init({ answers: plain });
    expect(await r.run()).toBe(0);
    expect(r.asked.slice(0, 3)).toEqual([
      `input: ${BRANCH_QUESTION}`,
      "select: Which spec tool do you use?",
      "checkbox: Which parts do you want?",
    ]);
    expect(r.specChoices).toEqual([
      {
        names: [NONE_CHOICE, OPENSPEC_CHOICE],
        values: ["none", "openspec"],
        fallback: "none",
      },
    ]);
  });

  it("asks it where the branch name would be when that question is skipped", async () => {
    const r = init({ answers: plain, presetBranchName: "{ticket}" });
    expect(await r.run()).toBe(0);
    expect(r.asked.slice(0, 2)).toEqual([
      "select: Which spec tool do you use?",
      "checkbox: Which parts do you want?",
    ]);
  });

  it("writes specs: none for None, and plans and installs nothing", async () => {
    const r = init({ answers: { ...plain, specs: ["none"] } });
    expect(await r.run()).toBe(0);
    expect(r.yaml().specs).toBe("none");
    expect(r.out).not.toContain(INSTALL_ROW);
    expect(r.installs).toEqual([]);
  });

  it("writes specs: openspec for OpenSpec, installs it with npm, and says so", async () => {
    const r = init({ answers: { ...plain, specs: ["openspec"] } });
    expect(await r.run()).toBe(0);
    expect(r.yaml().specs).toBe("openspec");
    expect(r.installs.map((i) => i.argv)).toEqual([
      ["npm", "install", "--save-dev", "@fission-ai/openspec"],
    ]);
    expect(r.out).toContain("Installed @fission-ai/openspec.");
  });

  it("plans the install after every other row and before a part turned off", async () => {
    const r = init({
      answers: { ...plain, specs: ["openspec"] },
      settings: `${withSpecs("")}auto-merge:\n  allow: [docs/**]\n`,
    });
    expect(await r.run()).toBe(0);
    const row = r.out.indexOf(INSTALL_ROW);
    expect(r.out[row - 1]).toMatch(/^ {2}files {9}Copy /);
    expect(r.out[row + 1]).toBe(
      "  turn off      Pull requests that merge themselves",
    );
  });

  it("installs after writing the settings, with OpenSpec named, and before the sync", async () => {
    const r = init({ answers: { ...plain, specs: ["openspec"] } });
    expect(await r.run()).toBe(0);
    expect(r.installs[0]!.settings).toContain("specs: openspec");
    expect(r.installs[0]!.syncedBefore).toBe(0);
    expect(r.synced()).toBe(1);
  });

  it("writes a private package.json and ignores node_modules before the install when there was none", async () => {
    const r = init({
      answers: { ...plain, specs: ["openspec"] },
      packageJson: false,
    });
    expect(await r.run()).toBe(0);
    expect(JSON.parse(r.installs[0]!.packageJson!)).toEqual({
      name: "site",
      private: true,
    });
    expect(r.read(".gitignore")).toBe("node_modules/\n");
  });

  it("prints npm's last five error lines when the install fails, carries on, and puts the install first under Left to do", async () => {
    const r = init({
      answers: { ...plain, specs: ["openspec"] },
      install: {
        status: 1,
        stderr:
          "one\ntwo\nnpm error code E404\nnpm error 404 Not Found\nnpm error a\nnpm error b\n",
      },
    });
    expect(await r.run()).toBe(0);
    const at = r.out.indexOf("Could not install @fission-ai/openspec:");
    expect(r.out.slice(at, at + 6)).toEqual([
      "Could not install @fission-ai/openspec:",
      "  two",
      "  npm error code E404",
      "  npm error 404 Not Found",
      "  npm error a",
      "  npm error b",
    ]);
    expect(r.synced()).toBe(1);
    const left = r.out.indexOf("Merge it to finish. Left to do:");
    expect(r.out[left + 1]).toBe(
      "  1. Install OpenSpec, which a build writes specs with: npm install --save-dev @fission-ai/openspec",
    );
  });

  it("plans no install and installs nothing when package.json lists OpenSpec", async () => {
    const r = init({
      answers: { ...plain, specs: ["openspec"] },
      files: {
        "package.json":
          '{"devDependencies":{"@fission-ai/openspec":"^1.0.0"}}\n',
      },
    });
    expect(await r.run()).toBe(0);
    expect(r.out).not.toContain(INSTALL_ROW);
    expect(r.installs).toEqual([]);
  });

  it("installs nothing when told not to go ahead", async () => {
    const r = init({
      answers: { checkbox: [[]], confirm: [false], specs: ["openspec"] },
    });
    expect(await r.run()).toBe(0);
    expect(r.out).toContain(INSTALL_ROW);
    expect(r.installs).toEqual([]);
  });

  it("does not ask when the settings name a spec tool, keeps it, and installs the one they name", async () => {
    const r = init({
      answers: plain,
      settings: withSpecs("specs:\n  type: openspec\n  check: make specs"),
    });
    expect(await r.run()).toBe(0);
    expect(r.specChoices).toEqual([]);
    expect(r.yaml().specs).toEqual({ type: "openspec", check: "make specs" });
    expect(r.out).toContain(INSTALL_ROW);
    expect(r.installs).toHaveLength(1);
  });

  it("does not ask when a preset names a spec tool, none included", async () => {
    const r = init({ answers: plain, presetSpecs: "none" });
    expect(await r.run()).toBe(0);
    expect(r.specChoices).toEqual([]);
    expect(r.yaml().specs).toBeUndefined();
  });

  it("asks once on a re-run whose settings name no spec tool", async () => {
    const r = init({ answers: plain, settings: withSpecs("") });
    expect(await r.run()).toBe(0);
    expect(r.specChoices).toHaveLength(1);
    expect(r.yaml().specs).toBe("none");
  });

  it("words the choice, the plan, the install, and its failure by another spec tool's adapter", async () => {
    const r = init({
      answers: { ...plain, specs: ["pages"] },
      install: { status: 1, stderr: "pip: not found\n" },
      tools: (b) => ({ ...b, specs: { ...b.specs, pages: pagesSpecTool() } }),
    });
    expect(await r.run()).toBe(0);
    expect(r.specChoices[0]!.names).toEqual([
      NONE_CHOICE,
      OPENSPEC_CHOICE,
      "Pages: each ticket's spec is a page in pages/",
    ]);
    expect(r.out).toContain("  install       pages-cli, with pip install");
    expect(r.installs[0]!.argv).toEqual(["pip", "install", "pages-cli"]);
    expect(r.out).toContain("Could not install pages-cli:");
    expect(r.out).toContain(
      "  1. Install Pages, which a build writes specs with: pip install pages-cli",
    );
  });
});

describe("factory init, with more than one tool of a kind", () => {
  const both = (b: Registry, t: Tickets) => withFakeTickets(b, t);

  it("asks which ticket system right after Found, and writes the choice", async () => {
    const r = init({
      tools: both,
      answers: {
        select: ["fake"],
        checkbox: [[]],
        input: ["https://tickets.example"],
        confirm: [true],
        secret: [""],
      },
    });
    expect(await r.run()).toBe(0);
    expect(r.out).toContain("  Tickets        chosen below");
    expect(r.asked[0]).toBe("select: Which ticket system?");
    expect(r.yaml().tickets).toMatchObject({ type: "fake" });
  });

  // The prompt has no default of its own: the first choice offered is it.
  it("offers the one the settings name first", async () => {
    const r = init({
      tools: both,
      settings: `version: 2\nrepository: acme/site\n${CODE_HOST_YAML}\ntickets:\n  type: fake\n  site: https://tickets.example\n`,
      secrets: { [FAKE_TOKEN]: "x" },
      answers: { select: ["fake"], checkbox: [[]], confirm: [false, true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.out).toContain(
      "  Tickets        Fake Tickets, from your settings",
    );
    expect(r.offered[0]).toEqual(["fake", "github"]);
  });

  it("asks where cloud builds run, and writes the choice", async () => {
    const r = init({
      tools: withSecondRunner,
      answers: { select: ["fake-runner"], checkbox: [[]], confirm: [true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.out).toContain("  Cloud builds   chosen below");
    expect(r.asked[0]).toBe("select: Where do cloud builds run?");
    expect(r.yaml().builds).toEqual({ runner: "fake-runner" });
  });

  it("names every code host it supports when the remote is on none", async () => {
    const r = init({
      tools: (b) => withCodeHosts(b, "Elsewhere", "Yonder"),
      remote: "https://gitlab.com/acme/site.git",
      answers: {},
    });
    expect(await r.run()).toBe(1);
    expect(r.out).toEqual([
      "The origin remote, https://gitlab.com/acme/site.git, is not on a code host the factory supports: GitHub, Elsewhere, and Yonder.",
    ]);
  });
});

describe("factory init, where it cannot start", () => {
  it.each([null, "https://gitlab.com/acme/site.git"])(
    "refuses with the remote %s, asking and changing nothing",
    async (remote) => {
      const r = init({ remote, answers: {} });
      expect(await r.run()).toBe(1);
      expect(r.asked).toEqual([]);
      expect(r.read(".claude/factory.yaml")).toBeNull();
    },
  );
});

describe("parseRemote", () => {
  it("reads the repository and code host from each form of address", () => {
    for (const url of [
      "git@github.com:acme/site.git",
      "https://github.com/acme/site",
      "https://github.com/acme/site.git",
      "ssh://git@github.com/acme/site.git",
    ])
      expect(parseRemote(url)).toEqual({
        codeHost: "github",
        repository: "acme/site",
      });
    expect(parseRemote("https://gitlab.com/acme/site.git")).toBeNull();
  });
});

describe("factory init, the column step", () => {
  const SHOP_COLUMNS = ["Todo", "In Progress", "Code review", "Done"];
  const SHOP = () => [
    { number: 3, title: "Shop board", columns: [...SHOP_COLUMNS] },
  ];
  /** The Proposed docs' suggestion for the Shop board. */
  const SUGGESTION = {
    backlog: "Todo",
    refining: NONE,
    ready: NONE,
    building: "In Progress",
    review: "Code review",
    done: "Done",
  };
  const ALL_SET = {
    FACTORY_BOARD_TOKEN: "x",
    FACTORY_BUILD_TOKEN: "x",
    CLAUDE_CODE_OAUTH_TOKEN: "x",
  };
  /** A first run that picks the Shop board, then answers `select` in turn. */
  const shop = (
    o: {
      answer?: unknown;
      agent?: Agent;
      select?: string[];
      checkbox?: string[][];
      parts?: string[];
      tools?: Setup["tools"];
    } = {},
  ) => {
    const agent =
      o.agent ?? scriptedAgent([{ answer: o.answer ?? { ...SUGGESTION } }]);
    const r = init({
      boards: SHOP(),
      secrets: ALL_SET,
      agent,
      tools: o.tools,
      answers: {
        checkbox: [o.parts ?? ["board"], ...(o.checkbox ?? [])],
        select: ["3", ...(o.select ?? [])],
        confirm: [false, true],
      },
    });
    return { ...r, agent: agent as ReturnType<typeof scriptedAgent> };
  };
  /** The choices of the select that asked `question`. */
  const selectOf = (
    r: { asked: string[]; selects: { names: string[]; fallback?: string }[] },
    question: string,
  ) =>
    r.selects[
      r.asked
        .filter(
          (a) => a.startsWith("select: ") && a !== `select: ${SPEC_QUESTION}`,
        )
        .indexOf(`select: ${question}`)
    ]!;
  /** A column for each state in turn, then yes to the table: Todo, none,
   * a new Ready, and the board's own three. */
  const BY_HAND = [
    "column:Todo",
    NONE,
    ADD,
    "column:In Progress",
    "column:Code review",
    "column:Done",
    "yes",
  ];
  const STEP_LINES = [
    "",
    "Board 3 has the columns Todo, In Progress, Code review, and Done.",
    "Asking Claude Code which of them shows each of the factory's six states...",
    "",
    "  State      Column",
    "  backlog    Todo",
    "  refining   none, shows in Todo",
    "  ready      none",
    "  building   In Progress",
    "  review     Code review",
    "  done       Done",
    "",
    "? select: Use these columns?",
  ];

  it("prints the board's columns and the table after the board question, then asks whether to use them, before the plan", async () => {
    const r = shop({ select: ["yes"] });
    expect(await r.run()).toBe(0);
    const at = r.transcript.indexOf("? select: Which board?");
    expect(r.transcript.slice(at + 1, at + 1 + STEP_LINES.length)).toEqual(
      STEP_LINES,
    );
    expect(
      r.transcript.indexOf("This is everything setup will do:"),
    ).toBeGreaterThan(at + STEP_LINES.length);
    expect(selectOf(r, "Use these columns?")).toEqual({
      names: ["Yes", "Change some", "No: add the factory's columns instead"],
      fallback: "yes",
    });
  });

  it("asks the agent once, with the board's columns and a 60-second limit", async () => {
    const r = shop({ select: ["yes"] });
    await r.run();
    expect(r.agent.asked).toHaveLength(1);
    expect(r.agent.asked[0]!.timeoutMs).toBe(60_000);
    for (const c of SHOP_COLUMNS) expect(r.agent.asked[0]!.prompt).toContain(c);
  });

  it("on Yes writes all six states, and adds only the fields", async () => {
    const r = shop({ select: ["yes"] });
    await r.run();
    expect(r.read(".claude/factory.yaml")).toContain(
      [
        "tickets:",
        "  board: 3",
        "  columns:",
        "    backlog: Todo",
        "    refining: none",
        "    ready: none",
        "    building: In Progress",
        "    review: Code review",
        "    done: Done",
        "",
      ].join("\n"),
    );
    expect(r.tickets.boards[0].columns).toEqual(SHOP_COLUMNS);
    expect(r.out).toContain("Added to board 3: Session, Runs in, Cost.");
  });

  it("names the fields to add by hand on a ticket system that cannot add them", async () => {
    const r = shop({ select: ["yes"] });
    delete r.tickets.tickets.board!.addFields;
    await r.run();
    expect(r.out).toContain(
      "Add any of these fields board 3 lacks, by hand: Session, Runs in, Cost.",
    );
    expect(r.looks).toContain(
      "{yourTurn:Add any of these fields board 3 lacks, by hand:} Session, Runs in, Cost.",
    );
  });

  it("names the columns to add by hand on a ticket system that cannot add them", async () => {
    const r = shop({
      select: ["change", ADD, "yes"],
      checkbox: [["refining"]],
    });
    delete r.tickets.tickets.board!.addColumns;
    expect(await r.run()).toBe(0);
    expect(r.out).toContain(
      "Add these columns to board 3 by hand: In refinement.",
    );
    expect(r.looks).toContain(
      "{yourTurn:Add these columns to board 3 by hand:} In refinement.",
    );
    expect(r.out).toContain("Added to board 3: Session, Runs in, Cost.");
  });

  it("changes the states you pick, offers each state's choices, and adds a column you ask for", async () => {
    const r = shop({
      select: ["change", ADD, "yes"],
      checkbox: [["refining"]],
    });
    expect(await r.run()).toBe(0);
    expect(r.checkboxes.at(-1)).toEqual({
      names: [
        "backlog: Todo",
        "refining: none, shows in Todo",
        "ready: none",
        "building: In Progress",
        "review: Code review",
        "done: Done",
      ],
      checked: [],
    });
    expect(selectOf(r, "Which column shows refining?")).toEqual({
      names: [
        ...SHOP_COLUMNS,
        "No column: a ticket being refined shows in Todo",
        'Add a column called "In refinement"',
      ],
      fallback: NONE,
    });
    expect(r.out).toContain("  refining   In refinement, which init adds");
    expect(r.yaml().tickets).toEqual({
      board: 3,
      columns: {
        backlog: "Todo",
        refining: "In refinement",
        ready: "none",
        building: "In Progress",
        review: "Code review",
        done: "Done",
      },
    });
    expect(r.out).toContain(
      "Added to board 3: In refinement, Session, Runs in, Cost.",
    );
  });

  it("offers no No column for backlog, and no Add for a name the board has", async () => {
    const r = shop({
      select: ["change", "column:Todo", "column:In Progress", "yes"],
      checkbox: [["backlog", "building"]],
    });
    expect(await r.run()).toBe(0);
    const names = (q: string) => selectOf(r, q).names;
    expect(names("Which column shows backlog?")).toEqual([
      ...SHOP_COLUMNS,
      'Add a column called "Backlog"',
    ]);
    expect(names("Which column shows building?")).toEqual([
      ...SHOP_COLUMNS,
      "No column: a ticket being built shows in Todo",
    ]);
  });

  it("says when a column already shows another state, keeps the earlier picks, and asks for the states again", async () => {
    const r = shop({
      select: [
        "change",
        ADD,
        "column:In Progress",
        ADD,
        "column:Code review",
        "yes",
      ],
      checkbox: [
        ["refining", "review"],
        ["refining", "review"],
      ],
    });
    expect(await r.run()).toBe(0);
    expect(r.out).toContain(
      "In Progress already shows building. Pick another column for review.",
    );
    const again = r.checkboxes.at(-1)!;
    expect(again.checked).toEqual(["refining", "review"]);
    expect(again.names).toContain("refining: In refinement, which init adds");
    expect(again.names).toContain("review: Code review");
    expect(r.yaml().tickets).toMatchObject({
      columns: { review: "Code review" },
    });
  });

  it("adds the factory's columns it lacks and writes the factory's six on No", async () => {
    const r = shop({ select: ["no"] });
    expect(await r.run()).toBe(0);
    expect(r.yaml().tickets).toEqual({ board: 3, columns: FACTORY_COLUMNS });
    expect(r.out).toContain(
      "Added to board 3: Backlog, In refinement, Ready, In review, Session, Runs in, Cost.",
    );
    expect(r.tickets.boards[0].columns).toEqual(
      expect.arrayContaining(["Todo", "Code review"]),
    );
  });

  it.each([
    [
      "an answer it can't use",
      { answer: { ...SUGGESTION, refining: "Todo" } },
      "it put Todo in both backlog and refining",
    ],
    [
      "a failed command",
      { failed: { code: 1, error: "Invalid API key · Please run /login" } },
      "it failed: Invalid API key · Please run /login",
    ],
    [
      "a failed command that printed nothing",
      { failed: { code: 2, error: null } },
      "it failed with exit code 2",
    ],
    [
      "no answer in time",
      { timedOut: true as const },
      "it took longer than 60 seconds",
    ],
    [
      "output that isn't the form asked for",
      { answer: undefined },
      "it did not answer in the form asked for",
    ],
  ])(
    "asks for each state's column by hand, in place of stopping, on %s",
    async (_n, got, why) => {
      const r = shop({ agent: scriptedAgent([got]), select: BY_HAND });
      expect(await r.run()).toBe(0);
      const at = r.out.indexOf(
        `Claude Code's answer could not be used: ${why}.`,
      );
      expect(at).toBeGreaterThan(-1);
      expect(r.out[at + 1]).toBe("Choose the column for each state yourself.");
      expect(r.out.join("\n")).not.toMatch(
        /write tickets\.columns in \.claude\/factory\.yaml yourself|Nothing changed/,
      );
      expect(
        r.asked.filter((q) => q.startsWith("select: Which column shows")),
      ).toEqual(
        ["backlog", "refining", "ready", "building", "review", "done"].map(
          (state) => `select: Which column shows ${state}?`,
        ),
      );
      expect(r.columns()).toEqual({
        backlog: "Todo",
        refining: "none",
        ready: "Ready",
        building: "In Progress",
        review: "Code review",
        done: "Done",
      });
    },
  );

  it("prints and asks the same on the way by hand, from the board's columns to the table", async () => {
    const r = shop({
      agent: scriptedAgent([
        { failed: { code: 1, error: "Invalid API key · Please run /login" } },
      ]),
      select: BY_HAND,
    });
    expect(await r.run()).toBe(0);
    const from = r.transcript.indexOf(
      "Board 3 has the columns Todo, In Progress, Code review, and Done.",
    );
    const to = r.transcript.indexOf("? select: Use these columns?");
    expect(r.transcript.slice(from, to + 1)).toEqual([
      "Board 3 has the columns Todo, In Progress, Code review, and Done.",
      "Asking Claude Code which of them shows each of the factory's six states...",
      "Claude Code's answer could not be used: it failed: Invalid API key · Please run /login.",
      "Choose the column for each state yourself.",
      "? select: Which column shows backlog?",
      "? select: Which column shows refining?",
      "? select: Which column shows ready?",
      "? select: Which column shows building?",
      "? select: Which column shows review?",
      "? select: Which column shows done?",
      "",
      "  State      Column",
      "  backlog    Todo",
      "  refining   none, shows in Todo",
      "  ready      Ready, which init adds",
      "  building   In Progress",
      "  review     Code review",
      "  done       Done",
      "",
      "? select: Use these columns?",
    ]);
    expect(r.out).toContain("Added to board 3: Ready, Session, Runs in, Cost.");
  });

  it.each([
    [
      "a board with the factory's six columns",
      { boards: [{ number: 3, title: "Roadmap", columns: SIX_COLUMNS }] },
      ["3"],
      FACTORY_COLUMNS,
    ],
    ["a new board", { boards: SHOP() }, ["new"], FACTORY_COLUMNS],
    [
      "a board with no columns",
      { boards: [{ number: 3, title: "Roadmap", columns: [] }] },
      ["3"],
      FACTORY_COLUMNS,
    ],
    [
      "settings that name every column",
      {
        boards: SHOP(),
        settings: [
          "version: 2",
          "repository: acme/site",
          CODE_HOST_YAML,
          "tickets:",
          "  board: 3",
          FACTORY_COLUMNS_YAML.replace("Backlog", "Todo"),
          "",
        ].join("\n"),
      },
      [],
      { ...FACTORY_COLUMNS, backlog: "Todo" },
    ],
  ])(
    "asks nothing about columns with %s, and writes all six",
    async (_n, setup, select, written) => {
      const agent = scriptedAgent();
      const r = init({
        ...setup,
        secrets: ALL_SET,
        agent,
        answers: { checkbox: [["board"]], select, confirm: [false, true] },
      });
      expect(await r.run()).toBe(0);
      expect(agent.asked).toEqual([]);
      expect(r.out.join("\n")).not.toContain("has the columns");
      expect(r.asked.join("\n")).not.toContain("columns");
      expect(r.columns()).toEqual(written);
    },
  );

  it("says a board has the factory's six columns, and saves them as the board spells them", async () => {
    const spelled = SIX_COLUMNS.map((c) =>
      c === "In progress" ? "In Progress" : c,
    );
    const r = init({
      boards: [{ number: 3, title: "Roadmap", columns: spelled }],
      secrets: ALL_SET,
      agent: scriptedAgent(),
      answers: { checkbox: [["board"]], select: ["3"], confirm: [false, true] },
    });
    expect(await r.run()).toBe(0);
    const at = r.transcript.indexOf("? select: Which board?");
    expect(r.transcript.slice(at + 1, at + 11)).toEqual([
      "",
      "Board 3 has a column for each of the factory's six states:",
      "",
      "  State      Column",
      "  backlog    Backlog",
      "  refining   In refinement",
      "  ready      Ready",
      "  building   In Progress",
      "  review     In review",
      "  done       Done",
    ]);
    expect(r.columns()).toEqual({
      ...FACTORY_COLUMNS,
      building: "In Progress",
    });
  });

  describe("with builds from the board", () => {
    const FROM_BOARD = ["board", "cloud", "from-board"];

    it("tells the agent ready needs a column, can't use an answer without one, and asks for each state's column by hand", async () => {
      const r = shop({
        parts: FROM_BOARD,
        select: ["github-action", ...BY_HAND],
      });
      expect(await r.run()).toBe(0);
      expect(r.agent.asked[0]!.prompt).toContain("ready needs a column");
      const at = r.out.indexOf(
        "Claude Code's answer could not be used: it gave ready no column, and builds start from the board.",
      );
      expect(at).toBeGreaterThan(-1);
      expect(r.out[at + 1]).toBe("Choose the column for each state yourself.");
      expect(r.columns()).toMatchObject({ ready: "Ready" });
    });

    it("offers no No column for ready", async () => {
      const r = shop({
        parts: FROM_BOARD,
        answer: { ...SUGGESTION, ready: ADD },
        select: ["github-action", "change", ADD, "yes"],
        checkbox: [["ready"]],
      });
      expect(await r.run()).toBe(0);
      expect(r.out).toContain("  ready      Ready, which init adds");
      expect(selectOf(r, "Which column shows ready?").names).toEqual([
        ...SHOP_COLUMNS,
        'Add a column called "Ready"',
      ]);
    });
  });

  describe("turning on builds from the board with ready: none", () => {
    const SETTINGS = [
      "version: 2",
      "repository: acme/site",
      CODE_HOST_YAML,
      "tickets:",
      "  board: 3",
      "  columns:",
      "    backlog: Todo",
      "    refining: In refinement",
      "    ready: none",
      "    building: In progress",
      "    review: none",
      "    done: none",
      "",
    ].join("\n");
    const rerun = (select: string[]) => {
      const agent = scriptedAgent();
      const r = init({
        settings: SETTINGS,
        boards: [
          {
            number: 3,
            title: "Shop board",
            columns: ["Todo", "In refinement", "Approved", "In progress"],
          },
        ],
        secrets: ALL_SET,
        agent,
        answers: {
          checkbox: [["board", "cloud", "from-board"]],
          select: ["github-action", ...select],
          confirm: [false, true],
        },
      });
      return { ...r, agent };
    };

    it("asks for a ready column after the poller question, without the agent, and adds Ready", async () => {
      const r = rerun([ADD]);
      expect(await r.run()).toBe(0);
      const at = r.transcript.indexOf("? select: Where does the poller run?");
      expect(r.transcript.slice(at + 1, at + 5)).toEqual([
        "",
        "Builds from the board start when a ticket moves to the ready column,",
        "and your settings give ready no column.",
        "? select: Which column shows ready?",
      ]);
      expect(r.selects.at(-1)!.names).toEqual([
        "Todo",
        "In refinement",
        "Approved",
        "In progress",
        'Add a column called "Ready"',
      ]);
      expect(r.agent.asked).toEqual([]);
      expect(r.columns()).toMatchObject({
        backlog: "Todo",
        ready: "Ready",
      });
      expect(r.tickets.boards[0].columns).toContain("Ready");
    });

    it("writes a board column you pick, asking again when it shows another state", async () => {
      const r = rerun(["column:Todo", "column:Approved"]);
      expect(await r.run()).toBe(0);
      expect(r.out).toContain(
        "Todo already shows backlog. Pick another column for ready.",
      );
      expect(r.asked.filter((a) => a.includes("shows ready"))).toHaveLength(2);
      expect(r.columns()).toMatchObject({
        backlog: "Todo",
        ready: "Approved",
      });
      expect(r.tickets.boards[0].columns).not.toContain("Ready");
    });
  });

  it("names the agent by its registered label in every line", async () => {
    const r = shop({
      tools: (b) =>
        withFakeAgent(b, scriptedAgent([{ answer: { ...SUGGESTION } }])),
      select: ["yes"],
    });
    expect(await r.run()).toBe(0);
    expect(r.out).toContain(
      "Asking Fake Agent which of them shows each of the factory's six states...",
    );
    expect(r.out.join("\n")).not.toContain("Claude Code");
    const missing = shop({
      tools: (b) => withFakeAgent(b, scriptedAgent([], { installed: false })),
    });
    expect(await missing.run()).toBe(1);
    expect(missing.out).toContain(
      "The factory runs in a coding agent, and Fake Agent is not installed.",
    );
  });
});

describe("factory init, a block that leaves states out", () => {
  const ALL_SET = {
    FACTORY_BOARD_TOKEN: "x",
    FACTORY_BUILD_TOKEN: "x",
    CLAUDE_CODE_OAUTH_TOKEN: "x",
  };
  const SHOP_COLUMNS = ["Todo", "In Progress", "Code review", "Done"];
  const settings = (columns: string[]) =>
    [
      "version: 2",
      "repository: acme/site",
      CODE_HOST_YAML,
      "tickets:",
      "  board: 3",
      ...(columns.length
        ? ["  columns:", ...columns.map((c) => `    ${c}`)]
        : []),
      "",
    ].join("\n");
  const rerun = (
    columns: string[],
    o: {
      board?: string[];
      parts?: string[];
      select?: string[];
      checkbox?: string[][];
      answer?: unknown;
    } = {},
  ) => {
    const agent = scriptedAgent(o.answer ? [{ answer: o.answer }] : []);
    const r = init({
      settings: settings(columns),
      boards: [
        { number: 3, title: "Shop board", columns: o.board ?? SHOP_COLUMNS },
      ],
      secrets: ALL_SET,
      agent,
      answers: {
        checkbox: [o.parts ?? ["board"], ...(o.checkbox ?? [])],
        select: o.select ?? [],
        confirm: [false, true],
      },
    });
    return { ...r, agent };
  };
  /** The choices of the select that asked `question`. */
  const selectOf = (
    r: { asked: string[]; selects: { names: string[]; fallback?: string }[] },
    question: string,
  ) =>
    r.selects[
      r.asked
        .filter(
          (a) => a.startsWith("select: ") && a !== `select: ${SPEC_QUESTION}`,
        )
        .indexOf(`select: ${question}`)
    ]!;
  const SHOP_PARTIAL = [
    "backlog: Todo",
    "refining: none",
    "ready: none",
    "review: Code review",
  ];

  it("fills in the states and asks for a branch name both left out of an older file", async () => {
    const r = init({
      settings: settings(SHOP_PARTIAL).replace(`${CODE_HOST_YAML}\n`, ""),
      boards: [{ number: 3, title: "Shop board", columns: SHOP_COLUMNS }],
      secrets: ALL_SET,
      answers: { checkbox: [["board"]], confirm: [false, true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.out).not.toContain("Fix it, then run init again.");
    expect(r.asked).toContain(`input: ${BRANCH_QUESTION}`);
    expect(r.yaml()["code-host"]).toEqual(CODE_HOST);
    expect(Object.keys(r.columns() as object)).toHaveLength(6);
  });

  it("fills in each state left out from the board's column of the factory's name, asking nothing", async () => {
    const r = rerun(SHOP_PARTIAL);
    expect(await r.run()).toBe(0);
    const at = r.transcript.indexOf(
      "Your settings give no column to building or done.",
    );
    expect(r.transcript.slice(at, at + 10)).toEqual([
      "Your settings give no column to building or done.",
      "Board 3 has a column of the factory's name for each:",
      "",
      "  State      Column",
      "  backlog    Todo",
      "  refining   none, shows in Todo",
      "  ready      none",
      "  building   In Progress",
      "  review     Code review",
      "  done       Done",
    ]);
    expect(r.transcript.at(at - 1)).toBe("");
    expect(r.agent.asked).toEqual([]);
    expect(r.asked.join("\n")).not.toContain("columns");
    expect(r.columns()).toEqual({
      backlog: "Todo",
      refining: "none",
      ready: "none",
      building: "In Progress",
      review: "Code review",
      done: "Done",
    });
  });

  it("asks for a state left out whose column the board lacks, saying so, then shows the table", async () => {
    const r = rerun(
      [
        "backlog: Todo",
        "refining: none",
        "ready: none",
        "building: In Progress",
        "done: Done",
      ],
      { select: ["column:Code review", "yes"] },
    );
    expect(await r.run()).toBe(0);
    const at = r.transcript.indexOf(
      "Your settings give no column to review, and board 3 has no In review column.",
    );
    expect(at).toBeGreaterThan(0);
    expect(r.transcript[at + 1]).toBe("? select: Which column shows review?");
    expect(selectOf(r, "Which column shows review?").names).toEqual([
      ...SHOP_COLUMNS,
      "No column: a ticket in review shows in In Progress",
      'Add a column called "In review"',
    ]);
    expect(r.transcript).toContain("? select: Use these columns?");
    expect(r.out).toContain("  review     Code review");
    expect(r.columns()).toMatchObject({ review: "Code review" });
    expect(r.agent.asked).toEqual([]);
  });

  it("asks for a state left out whose factory column another state names, and fills the rest", async () => {
    const r = rerun(
      ["backlog: Todo", "refining: none", "ready: none", "review: In Progress"],
      { select: [NONE, "yes"] },
    );
    expect(await r.run()).toBe(0);
    expect(r.out).toContain(
      "Your settings give no column to building, and In Progress already shows review.",
    );
    expect(selectOf(r, "Which column shows building?").names).toEqual([
      ...SHOP_COLUMNS,
      "No column: a ticket being built shows in Todo",
    ]);
    expect(r.out.join("\n")).not.toContain("no column to done");
    expect(r.columns()).toEqual({
      backlog: "Todo",
      refining: "none",
      ready: "none",
      building: "none",
      review: "In Progress",
      done: "Done",
    });
  });

  it("changes only the states left out on Change some, and writes only those", async () => {
    const r = rerun(
      [
        "backlog: Todo",
        "refining: none",
        "ready: none",
        "building: In Progress",
        "done: Done",
      ],
      {
        select: ["column:Code review", "change", NONE, "yes"],
        checkbox: [["review"]],
      },
    );
    expect(await r.run()).toBe(0);
    expect(r.checkboxes.at(-1)!.names).toEqual(["review: Code review"]);
    expect(r.columns()).toMatchObject({ review: "none", backlog: "Todo" });
  });

  it("on Change some, refuses a column a written state lists, not only its first", async () => {
    const r = rerun(
      [
        "backlog: Todo",
        "refining: none",
        "ready: none",
        "review: [Code review, QA]",
        "done: Done",
      ],
      {
        board: ["Todo", "Doing", "Code review", "QA", "Done"],
        select: ["column:Doing", "change", "column:QA", "column:Doing", "yes"],
        checkbox: [["building"], ["building"]],
      },
    );
    expect(await r.run()).toBe(0);
    expect(r.out).toContain(
      "QA already shows review. Pick another column for building.",
    );
    expect(r.columns()).toMatchObject({ building: "Doing" });
  });

  it("asks again when the column picked for a state left out shows another state", async () => {
    const r = rerun(
      [
        "backlog: Todo",
        "refining: none",
        "ready: none",
        "building: In Progress",
        "done: Done",
      ],
      { select: ["column:Todo", "column:Code review", "yes"] },
    );
    expect(await r.run()).toBe(0);
    expect(r.out).toContain(
      "Todo already shows backlog. Pick another column for review.",
    );
    expect(r.columns()).toMatchObject({ review: "Code review" });
  });

  it("offers no No column for a ready left out when builds start from the board, and doesn't ask the ready-none question", async () => {
    const r = rerun(
      [
        "backlog: Todo",
        "refining: none",
        "building: In Progress",
        "review: Code review",
        "done: Done",
      ],
      {
        parts: ["board", "cloud", "from-board"],
        select: ["github-action", ADD, "yes"],
      },
    );
    expect(await r.run()).toBe(0);
    expect(r.out).toContain(
      "Your settings give no column to ready, and board 3 has no Ready column.",
    );
    expect(r.out).not.toContain("and your settings give ready no column.");
    expect(selectOf(r, "Which column shows ready?").names).toEqual([
      ...SHOP_COLUMNS,
      'Add a column called "Ready"',
    ]);
    expect(r.columns()).toMatchObject({ ready: "Ready" });
  });

  it("suggests columns through the agent when the settings name a board and no columns", async () => {
    const r = rerun([], {
      answer: {
        backlog: "Todo",
        refining: NONE,
        ready: NONE,
        building: "In Progress",
        review: "Code review",
        done: "Done",
      },
      select: ["yes"],
    });
    expect(await r.run()).toBe(0);
    expect(r.agent.asked).toHaveLength(1);
    expect(r.out).toContain(
      "Board 3 has the columns Todo, In Progress, Code review, and Done.",
    );
    expect(r.columns()).toEqual({
      backlog: "Todo",
      refining: "none",
      ready: "none",
      building: "In Progress",
      review: "Code review",
      done: "Done",
    });
  });

  it("still stops on settings with another fault", async () => {
    const r = init({
      settings: settings(["backlog: none"]),
      answers: { checkbox: [["board"]] },
    });
    expect(await r.run()).toBe(1);
    expect(r.out.join("\n")).toContain(
      "tickets.columns.backlog: cannot be none",
    );
    expect(r.out).toContain("Fix it, then run init again.");
  });
});

describe("a re-run where the settings are not valid", () => {
  const rerun = async (...lines: string[]) => {
    const r = init({
      settings: ["version: 2", "repository: acme/site", ...lines, ""].join(
        "\n",
      ),
      answers: {},
    });
    return { code: await r.run(), out: r.out, asked: r.asked };
  };

  it("prints the line config check prints, naming the file once", async () => {
    const r = await rerun("rules:", "  review-rounds: zero");
    expect(r.out).toEqual([
      ".claude/factory.yaml: rules.review-rounds: must be a whole number above zero",
      "Fix it, then run init again.",
    ]);
    expect(r.code).toBe(1);
    expect(r.asked).toEqual([]);
  });

  it("says so of a file that is not YAML before it looks at anything else", async () => {
    const r = await rerun("repository: acme/other: x");
    expect(r.out).toEqual([
      '.claude/factory.yaml: line 3: repository: acme/other: x needs quotes around the name, such as repository: "acme/other: x"',
      "Fix it, then run init again.",
    ]);
    expect(r.code).toBe(1);
    expect(r.asked).toEqual([]);
  });
});

describe("the tokens .npmrc reads", () => {
  const TOKEN = "npm_read_only";
  const JFROG = "https://acme.jfrog.io/artifactory/api/npm/npm/";
  const NPMRC = `@acme:registry=${JFROG}\n//acme.jfrog.io/artifactory/api/npm/npm/:_authToken=\${NPM_TOKEN}\n`;
  const FOUND_ROW = "  .npmrc         reads NPM_TOKEN";
  const INTRO = [
    "",
    `.npmrc reads NPM_TOKEN for ${JFROG}.`,
    "The factory's workflows install with it. Use a token that can only read.",
  ];
  const UNSEEN =
    "NPM_TOKEN isn't set for Dependabot on this repository, and only an organization admin can see whether your organization sets it. If it does, leave this empty.";
  /** A first run with no parts chosen, in a repository with `npmrc`. */
  const first = (npmrc: string, over: Partial<Setup> = {}) =>
    init({
      files: { ".npmrc": npmrc },
      answers: { checkbox: [[]], confirm: [true], secret: [TOKEN] },
      ...over,
    });
  const after = (out: string[], line: string) => out.slice(out.indexOf(line));

  it("lists .npmrc and the names it reads under Found, after Cloud builds", async () => {
    const r = first(`${NPMRC}//b.example/:_authToken=\${B_TOKEN}\n`, {
      answers: { checkbox: [[]], confirm: [true], secret: [TOKEN, TOKEN] },
    });
    await r.run();
    const at = r.out.findIndex((l) => l.startsWith("  Cloud builds"));
    expect(r.out[at + 1]).toBe("  .npmrc         reads NPM_TOKEN, B_TOKEN");
  });

  it("has no .npmrc row when it reads no token", async () => {
    const r = init({
      files: { ".npmrc": "cache=${HOME}/.npm\n" },
      answers: { checkbox: [[]], confirm: [true] },
    });
    await r.run();
    expect(r.out.join("\n")).not.toContain(".npmrc");
  });

  it("asks for a token set nowhere and stores it for Actions and for Dependabot", async () => {
    const r = first(NPMRC);
    expect(await r.run()).toBe(0);
    expect(r.out).toContain(
      "  secrets       NPM_TOKEN for Actions and for Dependabot",
    );
    expect(after(r.transcript, INTRO[1]!).slice(0, 4)).toEqual([
      INTRO[1],
      INTRO[2],
      "? secret: Paste it (leave empty to do this later):",
      "Stored NPM_TOKEN for Actions and for Dependabot.",
    ]);
    expect(r.out).toContain(INTRO[0]);
    expect(r.runner.secrets.get("NPM_TOKEN")).toBe(TOKEN);
    expect(r.runner.dependabotSecrets.get("NPM_TOKEN")).toBe(TOKEN);
    expect(r.out.join("\n")).not.toContain(TOKEN);
  });

  it("asks only for the Dependabot copy when Actions has it", async () => {
    const r = first(NPMRC, { secrets: { NPM_TOKEN: "x" } });
    await r.run();
    expect(r.out).toContain("  secrets       NPM_TOKEN for Dependabot");
    const at =
      "NPM_TOKEN is set for Actions but not for Dependabot, and GitHub never shows a secret's value.";
    expect(after(r.transcript, at).slice(0, 3)).toEqual([
      at,
      "? secret: Paste the same token again (leave empty to do this later):",
      "Stored NPM_TOKEN for Dependabot.",
    ]);
    expect(r.runner.secrets.get("NPM_TOKEN")).toBe("x");
    expect(r.runner.dependabotSecrets.get("NPM_TOKEN")).toBe(TOKEN);
  });

  it("asks only for the Actions copy when Dependabot has it", async () => {
    const r = first(NPMRC, { dependabotSecrets: { NPM_TOKEN: "x" } });
    await r.run();
    expect(r.out).toContain("  secrets       NPM_TOKEN for Actions");
    expect(r.out).toContain(
      "NPM_TOKEN is set for Dependabot but not for Actions, and GitHub never shows a secret's value.",
    );
    expect(r.out).toContain("Stored NPM_TOKEN for Actions.");
    expect(r.runner.secrets.get("NPM_TOKEN")).toBe(TOKEN);
    expect(r.runner.dependabotSecrets.get("NPM_TOKEN")).toBe("x");
  });

  it("asks for a Dependabot copy it can't see on an organization's repository, saying so, after the intro", async () => {
    const r = first(NPMRC, {
      organization: true,
      organizationDependabotSecrets: null,
    });
    await r.run();
    expect(after(r.transcript, INTRO[1]!).slice(0, 4)).toEqual([
      INTRO[1],
      INTRO[2],
      UNSEEN,
      "? secret: Paste it (leave empty to do this later):",
    ]);
    expect(r.runner.dependabotSecrets.get("NPM_TOKEN")).toBe(TOKEN);
  });

  it("reads an owner it can't tell as an organization, asking for a Dependabot copy it can't see", async () => {
    const r = first(NPMRC, {
      codeHostFails: { ownerIsOrganization: new Error("HTTP 502") },
      organizationDependabotSecrets: null,
    });
    await r.run();
    expect(r.out).toContain(UNSEEN);
  });

  it("says only that, before asking for the same token, when Actions has it", async () => {
    const r = first(NPMRC, {
      secrets: { NPM_TOKEN: "x" },
      organization: true,
      organizationDependabotSecrets: null,
    });
    await r.run();
    expect(after(r.transcript, UNSEEN).slice(0, 2)).toEqual([
      UNSEEN,
      "? secret: Paste the same token again (leave empty to do this later):",
    ]);
    expect(r.out.join("\n")).not.toContain("is set for Actions but not");
  });

  it("stores nothing when nothing is pasted, saying the workflows fail until it is", async () => {
    const r = first(NPMRC, {
      answers: { checkbox: [[]], confirm: [true], secret: [""] },
    });
    await r.run();
    expect(r.out).toContain(
      "No NPM_TOKEN stored. The factory's workflows fail at npm ci until it is. Run factory init again to add it.",
    );
    expect(r.runner.secrets.has("NPM_TOKEN")).toBe(false);
    expect(r.runner.dependabotSecrets.has("NPM_TOKEN")).toBe(false);
  });

  it("counts a token set for both among the secrets to replace, storing both copies on yes", async () => {
    const r = first(NPMRC, {
      secrets: { NPM_TOKEN: "old" },
      dependabotSecrets: { NPM_TOKEN: "old" },
      answers: { checkbox: [[]], confirm: [true, true], secret: [TOKEN] },
    });
    await r.run();
    expect(r.asked).toContain(
      "confirm: 1 secret these parts read is already set. Replace it?",
    );
    expect(r.runner.secrets.get("NPM_TOKEN")).toBe(TOKEN);
    expect(r.runner.dependabotSecrets.get("NPM_TOKEN")).toBe(TOKEN);
  });

  it("asks nothing for a token set for both, without replacing", async () => {
    const r = first(NPMRC, {
      secrets: { NPM_TOKEN: "old" },
      dependabotSecrets: { NPM_TOKEN: "old" },
      answers: { checkbox: [[]], confirm: [false, true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.asked.filter((q) => q.startsWith("secret"))).toEqual([]);
  });

  it("asks nothing and stores nothing for GITHUB_TOKEN", async () => {
    const r = first("//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}\n", {
      answers: { checkbox: [[]], confirm: [true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.asked.filter((q) => q.startsWith("secret"))).toEqual([]);
    expect(r.runner.secrets.size).toBe(0);
  });

  it("stops right after Found on a name sync refuses, changing nothing", async () => {
    const r = first("//a.example/:_authToken=${HOME}\n");
    expect(await r.run()).toBe(1);
    expect(r.asked).toEqual([]);
    const at = r.out.indexOf(FOUND_ROW.replace("NPM_TOKEN", "HOME"));
    expect(r.out.slice(at + 1)).toEqual([
      "  Settings       none yet",
      "  Board          none yet",
      "  This machine   no GitHub token for cloud runs",
      "",
      ".npmrc reads ${HOME} to sign in, and the runner sets HOME for itself. Rename it in .npmrc, then run: factory sync",
    ]);
    expect(r.read(".claude/factory.yaml")).toBeNull();
  });

  it("stops when the Dependabot secrets can't be listed", async () => {
    const r = first(NPMRC, {
      runnerFails: { dependabotSecretNames: new Error("HTTP 403") },
    });
    expect(await r.run()).toBe(1);
    expect(r.out.at(-1)).toBe("Could not reach the code host: HTTP 403");
  });

  describe("on a repository an organization owns", () => {
    it("asks for no secret the organization shares, for Actions or a Dependabot one it can see", async () => {
      const r = first(NPMRC, {
        organization: true,
        organizationSecrets: ["NPM_TOKEN"],
        organizationDependabotSecrets: ["NPM_TOKEN"],
        answers: { checkbox: [[]], confirm: [false, true] },
      });
      expect(await r.run()).toBe(0);
      expect(r.asked).toEqual([
        `input: ${BRANCH_QUESTION}`,
        "select: Which spec tool do you use?",
        `input: ${GATE_QUESTION}`,
        "confirm: 1 secret these parts read is already set. Replace it?",
        "confirm: Go ahead?",
      ]);
    });

    it.each([
      [
        "its own",
        { FACTORY_BOARD_TOKEN: "x", FACTORY_AUTOMERGE_TOKEN: "x" },
        true,
      ],
      ["the organization's", { FACTORY_BOARD_TOKEN: "x" }, false],
    ])(
      "offers to delete a secret a part read when it goes only when it is the repository's own: %s",
      async (_, secrets, offered) => {
        const r = init({
          settings: [
            "version: 2",
            "repository: acme/site",
            CODE_HOST_YAML,
            "tickets:",
            "  board: 3",
            "auto-merge:",
            "  allow:",
            "    - docs/**",
            "",
          ].join("\n"),
          secrets,
          organization: true,
          organizationSecrets: ["FACTORY_AUTOMERGE_TOKEN"],
          boards: [{ number: 3, title: "Roadmap", columns: [] }],
          answers: { checkbox: [["board"]], confirm: [true] },
        });
        await r.run();
        expect(
          r.out
            .join("\n")
            .includes(
              "You can now delete these secrets: FACTORY_AUTOMERGE_TOKEN",
            ),
        ).toBe(offered);
      },
    );
  });
});

describe("factory init, the field step", () => {
  const FIELDS: TicketField[] = [
    { name: "Priority", description: null, text: false },
    {
      name: "Acceptance criteria",
      description: "What must be true for this to be done",
      text: true,
    },
    {
      name: "Design notes",
      description: "How engineering plans to build it",
      text: true,
    },
    { name: "Customer", description: "Who asked for it", text: true },
  ];
  const SUGGESTION = {
    decisions: "__description__",
    spec: "Acceptance criteria",
    "acceptance-criteria": "Acceptance criteria",
    "for-the-builder": "Design notes",
  };
  /** "Which parts do you want?" answered with none: the step needs none. */
  const NO_PARTS: string[] = [];
  const fielded = (
    o: {
      answer?: unknown;
      agent?: ReturnType<typeof scriptedAgent>;
      select?: string[];
      checkbox?: string[][];
      settings?: string;
      fields?: TicketField[];
      tools?: Setup["tools"];
      input?: string[];
      secret?: string[];
    } = {},
  ) => {
    const agent =
      o.agent ?? scriptedAgent([{ answer: o.answer ?? { ...SUGGESTION } }]);
    const r = init({
      agent,
      settings: o.settings,
      ticketFields: o.fields ?? FIELDS,
      tools: o.tools,
      answers: {
        checkbox: [NO_PARTS, ...(o.checkbox ?? [])],
        select: o.select ?? [],
        confirm: [true],
        input: o.input,
        secret: o.secret,
      },
    });
    return { ...r, agent };
  };

  /** The field step's lines: from its first to the plan's heading. */
  const step = (out: string[]) =>
    out.slice(
      out.findIndex((l) => l.includes("tickets have the text fields")),
      out.indexOf("This is everything setup will do:"),
    );
  const FOUR = (d: string, s: string, a: string, f: string) =>
    `version: 2\nrepository: acme/site\ntickets:\n  fields:\n    decisions: ${d}\n    spec: ${s}\n    acceptance-criteria: ${a}\n    for-the-builder: ${f}\n${CODE_HOST_YAML}\nspecs: none\n`;

  it("names the text fields and shows the suggestion as a table, before the plan", async () => {
    const r = fielded({ select: ["yes"] });
    expect(await r.run()).toBe(0);
    expect(r.looks).toContain(
      "{skip:Asking Claude Code which of them should hold each of the factory's fields...}",
    );
    expect(step(r.out)).toEqual([
      "acme/site's tickets have the text fields Acceptance criteria, Design notes, and Customer.",
      "Asking Claude Code which of them should hold each of the factory's fields...",
      "",
      "  Factory field         Ticket field",
      "  Decisions             the description",
      "  Spec                  Acceptance criteria",
      "  Acceptance criteria   Acceptance criteria",
      "  For the builder       Design notes",
      "",
      "Your own text stays in the description.",
      "GitHub Issues shows a field's text as typed, without Markdown formatting.",
      "",
      "",
    ]);
    expect(r.selects[0]).toEqual({
      names: ["Yes", "Change some", "No: keep everything in the description"],
      fallback: "yes",
    });
  });

  it("asks the agent once, sending the text fields' names and descriptions only", async () => {
    const r = fielded({ select: ["yes"] });
    await r.run();
    expect(r.agent.asked).toHaveLength(1);
    const q = r.agent.asked[0]!;
    expect(q.prompt).toContain("- Customer: Who asked for it");
    expect(q.prompt).not.toContain("Priority");
    expect(q.prompt).toContain("__description__");
  });

  it("Yes writes all four factory fields, none for the description", async () => {
    const r = fielded({ select: ["yes"] });
    expect(await r.run()).toBe(0);
    expect(r.read(".claude/factory.yaml")).toBe(
      FOUR(
        "none",
        "Acceptance criteria",
        "Acceptance criteria",
        "Design notes",
      ),
    );
  });

  it("keeps a file's comments when it writes the four lines", async () => {
    const r = fielded({
      settings: "# ours\nversion: 2\nrepository: acme/site\n",
      select: ["yes"],
    });
    expect(await r.run()).toBe(0);
    expect(r.read(".claude/factory.yaml")).toContain("# ours");
  });

  it("No keeps everything in the description, writing all four as none", async () => {
    const r = fielded({ select: ["no"] });
    expect(await r.run()).toBe(0);
    expect(r.read(".claude/factory.yaml")).toBe(
      FOUR("none", "none", "none", "none"),
    );
  });

  it("Change some asks only about the factory fields you pick, then shows the table again", async () => {
    const r = fielded({
      checkbox: [["decisions"]],
      select: ["change", "field:Customer", "yes"],
    });
    expect(await r.run()).toBe(0);
    expect(r.checkboxes[1]).toEqual({
      names: [
        "Decisions: the description",
        "Spec: Acceptance criteria",
        "Acceptance criteria: Acceptance criteria",
        "For the builder: Design notes",
      ],
      checked: [],
    });
    expect(r.selects[1]).toEqual({
      names: [
        "The description",
        "Acceptance criteria",
        "Design notes",
        "Customer",
      ],
      fallback: "__description__",
    });
    expect(r.out).toContain("  Decisions             Customer");
    expect(r.read(".claude/factory.yaml")).toBe(
      FOUR(
        "Customer",
        "Acceptance criteria",
        "Acceptance criteria",
        "Design notes",
      ),
    );
  });

  it("Change some with nothing picked goes back to the table", async () => {
    const r = fielded({ checkbox: [[]], select: ["change", "yes"] });
    expect(await r.run()).toBe(0);
    expect(
      r.asked.filter((a) => a === "select: Use these ticket fields?"),
    ).toHaveLength(2);
  });

  it("refuses one ticket field for two factory fields, and asks which to change again", async () => {
    const r = fielded({
      checkbox: [["decisions"], ["decisions"]],
      select: ["change", "field:Design notes", "field:Customer", "yes"],
    });
    expect(await r.run()).toBe(0);
    expect(r.out).toContain(
      "Design notes already holds For the builder. Pick another ticket field for Decisions.",
    );
    expect(r.checkboxes.at(-1)).toEqual({
      names: [
        "Decisions: the description",
        "Spec: Acceptance criteria",
        "Acceptance criteria: Acceptance criteria",
        "For the builder: Design notes",
      ],
      checked: ["decisions"],
    });
    expect(r.yaml().tickets).toMatchObject({
      fields: { decisions: "Customer" },
    });
  });

  it("lets Spec and Acceptance criteria share a ticket field", async () => {
    const r = fielded({
      answer: {
        ...SUGGESTION,
        spec: "Customer",
        "acceptance-criteria": "Customer",
      },
      checkbox: [["spec"]],
      select: ["change", "field:Acceptance criteria", "yes"],
    });
    expect(await r.run()).toBe(0);
    expect(r.out.join("\n")).not.toContain("already holds");
  });

  /** The four asked by hand, then yes to the table: Spec and Acceptance
   * criteria share one, and For the builder has its own. */
  const BY_HAND = [
    "__description__",
    "field:Acceptance criteria",
    "field:Acceptance criteria",
    "field:Design notes",
    "yes",
  ];
  const FAILED = { failed: { code: 1, error: "Invalid API key" } };
  const byHand = (
    select: string[],
    o: { checkbox?: string[][]; agent?: ReturnType<typeof scriptedAgent> } = {},
  ) => fielded({ agent: scriptedAgent([FAILED]), ...o, select });

  it.each([
    ["it took longer than 60 seconds", { timedOut: true as const }],
    ["it failed: Invalid API key", FAILED],
    ["it failed with exit code 2", { failed: { code: 2, error: null } }],
    [
      "it named Notes, which acme/site's tickets don't have",
      { answer: { ...SUGGESTION, decisions: "Notes" } },
    ],
    [
      "it put Design notes in both Decisions and For the builder",
      { answer: { ...SUGGESTION, decisions: "Design notes" } },
    ],
    ["it left out Spec", { answer: { ...SUGGESTION, spec: undefined } }],
    ["it did not answer in the form asked for", { answer: "Customer" }],
  ])("asks by hand, in place of stopping, when %s", async (reason, got) => {
    const r = byHand(BY_HAND, { agent: scriptedAgent([got]) });
    expect(await r.run()).toBe(0);
    const at = r.out.indexOf(
      `Claude Code's answer could not be used: ${reason}.`,
    );
    expect(at).toBeGreaterThan(-1);
    expect(r.out[at + 1]).toBe(
      "Choose where each of the factory's fields goes yourself.",
    );
  });

  it("goes on to the plan by hand, and writes the four lines chosen", async () => {
    const r = byHand(BY_HAND);
    expect(await r.run()).toBe(0);
    expect(r.asked).toContain("confirm: Go ahead?");
    expect(r.read(".claude/factory.yaml")).toBe(
      FOUR(
        "none",
        "Acceptance criteria",
        "Acceptance criteria",
        "Design notes",
      ),
    );
  });

  it("names no command or file as the fix by hand", async () => {
    const r = byHand(BY_HAND);
    await r.run();
    expect(r.out.join("\n")).not.toMatch(
      /write tickets\.fields in \.claude\/factory\.yaml yourself|Nothing changed/,
    );
  });

  it("does not ask the agent a second time by hand", async () => {
    const r = byHand(BY_HAND);
    await r.run();
    expect(r.agent.asked).toHaveLength(1);
  });

  it("prints and asks by hand as drafted, from the text fields to the last question", async () => {
    const r = byHand(BY_HAND);
    expect(await r.run()).toBe(0);
    const from = r.transcript.findIndex((l) => l.includes("text fields"));
    const to = r.transcript.indexOf("? select: Use these ticket fields?");
    expect(r.transcript.slice(from, to + 1)).toEqual([
      "acme/site's tickets have the text fields Acceptance criteria, Design notes, and Customer.",
      "Asking Claude Code which of them should hold each of the factory's fields...",
      "Claude Code's answer could not be used: it failed: Invalid API key.",
      "Choose where each of the factory's fields goes yourself.",
      "",
      "  Factory field         What it holds",
      "  Decisions             the questions refinement settled, and what was chosen",
      "  Spec                  what a change users will notice must do, line by line",
      "  Acceptance criteria   what must be true for any other ticket to be done",
      "  For the builder       how to build it, as a design and a list of tasks",
      "",
      "A ticket has a Spec or Acceptance criteria, never both, so the two can share a ticket field.",
      "",
      "? select: Where does Decisions go?",
      "? select: Where does Spec go?",
      "? select: Where does Acceptance criteria go?",
      "? select: Where does For the builder go?",
      "",
      "  Factory field         Ticket field",
      "  Decisions             the description",
      "  Spec                  Acceptance criteria",
      "  Acceptance criteria   Acceptance criteria",
      "  For the builder       Design notes",
      "",
      "Your own text stays in the description.",
      "GitHub Issues shows a field's text as typed, without Markdown formatting.",
      "",
      "? select: Use these ticket fields?",
    ]);
  });

  it("starts each question by hand on the description, and the last one on Yes, with no No", async () => {
    const r = byHand(BY_HAND);
    await r.run();
    const each = {
      names: [
        "The description",
        "Acceptance criteria",
        "Design notes",
        "Customer",
      ],
      fallback: "__description__",
    };
    expect(r.selects.slice(0, 5)).toEqual([
      each,
      each,
      each,
      each,
      { names: ["Yes", "Change some"], fallback: "yes" },
    ]);
  });

  it("asks the same question again for a ticket field chosen before by hand", async () => {
    const r = byHand([
      "field:Design notes",
      "__description__",
      "__description__",
      "field:Design notes",
      "field:Customer",
      "yes",
    ]);
    expect(await r.run()).toBe(0);
    const at = r.transcript.indexOf(
      "Design notes already holds Decisions. Pick another ticket field for For the builder.",
    );
    expect(r.transcript.slice(at - 1, at + 2)).toEqual([
      "? select: Where does For the builder go?",
      "Design notes already holds Decisions. Pick another ticket field for For the builder.",
      "? select: Where does For the builder go?",
    ]);
    expect(r.selects[4]!.fallback).toBe("__description__");
    expect(r.read(".claude/factory.yaml")).toBe(
      FOUR("Design notes", "none", "none", "Customer"),
    );
  });

  it("goes back to Yes and Change some after a change to fields chosen by hand", async () => {
    const r = byHand(
      [...BY_HAND.slice(0, 4), "change", "field:Customer", "yes"],
      { checkbox: [["decisions"]] },
    );
    expect(await r.run()).toBe(0);
    expect(r.selects[6]!.names).toEqual(["Yes", "Change some"]);
    expect(r.yaml().tickets).toMatchObject({
      fields: { decisions: "Customer" },
    });
  });

  it("underlines the column names and bolds the factory fields in what each holds", async () => {
    const r = byHand(BY_HAND);
    await r.run();
    const at = r.looks.findIndex((l) => l.includes("What it holds"));
    expect(r.looks.slice(at, at + 2)).toEqual([
      "  {heading:Factory field}         {heading:What it holds}",
      "  {name:Decisions}             the questions refinement settled, and what was chosen",
    ]);
    expect(r.looks).toContain(
      "Choose where each of the factory's fields goes yourself.",
    );
    expect(r.looks).toContain(
      "A ticket has a Spec or Acceptance criteria, never both, so the two can share a ticket field.",
    );
  });

  it.each([
    ["no fields group", { ticketGroups: ["board"] as Group[] }],
    [
      "no text field",
      { ticketFields: [{ name: "Priority", description: null, text: false }] },
    ],
    [
      "settings that name one of the four",
      {
        settings: `version: 2\nrepository: acme/site\n${CODE_HOST_YAML}\ntickets:\n  fields:\n    decisions: none\n`,
      },
    ],
  ])("asks nothing about ticket fields with %s", async (_name, extra) => {
    const agent = scriptedAgent([]);
    const r = init({
      agent,
      ticketFields: FIELDS,
      ...extra,
      answers: { checkbox: [NO_PARTS], confirm: [true] },
    });
    expect(await r.run()).toBe(0);
    expect(agent.asked).toEqual([]);
    expect(r.out.join("\n")).not.toContain("text fields");
  });

  it("stops before the plan when reading the ticket fields fails", async () => {
    const r = init({
      agent: scriptedAgent([]),
      ticketFields: FIELDS,
      ticketsFail: { fields: new Error("Server Error (HTTP 500)") },
      answers: { checkbox: [NO_PARTS] },
    });
    expect(await r.run()).toBe(1);
    expect(r.out.slice(-2)).toEqual([
      "Could not read acme/site's ticket fields: Server Error (HTTP 500)",
      "Nothing changed.",
    ]);
    expect(r.read(".claude/factory.yaml")).toBeNull();
  });

  it("names the agent and the ticket system by their registered labels", async () => {
    const agent = scriptedAgent([{ answer: { ...SUGGESTION } }]);
    const r = fielded({
      agent,
      select: ["yes"],
      input: ["https://tickets.example"],
      secret: [""],
      tools: (b, t) => withFakeTickets(withFakeAgent(b, agent), t, true),
    });
    expect(await r.run()).toBe(0);
    const lines = step(r.out).join("\n");
    expect(lines).toContain(
      "Asking Fake Agent which of them should hold each of the factory's fields...",
    );
    expect(lines).toContain(
      "Fake Tickets shows a field's text as typed, without Markdown formatting.",
    );
    expect(lines).not.toMatch(/Claude Code|GitHub/);
  });

  it("names them by their registered labels by hand too", async () => {
    const agent = scriptedAgent([FAILED]);
    const r = fielded({
      agent,
      select: BY_HAND,
      input: ["https://tickets.example"],
      secret: [""],
      tools: (b, t) => withFakeTickets(withFakeAgent(b, agent), t, true),
    });
    expect(await r.run()).toBe(0);
    const lines = step(r.out).join("\n");
    expect(lines).toContain(
      "Fake Agent's answer could not be used: it failed: Invalid API key.",
    );
    expect(lines).not.toMatch(/Claude Code|GitHub/);
  });
});

describe("factory init, a credential kept on the machine", () => {
  const SITE = "acme.example";
  const EMAIL = "dana@acme.example";
  const TOKEN = "t0k3n-dana";
  const GOOD_PAIR = { [FAKE_EMAIL]: EMAIL, [FAKE_TOKEN]: TOKEN };
  const EMAIL_Q = "input: The email of your Fake Tickets account:";
  const TOKEN_Q =
    "secret: Paste the Fake Tickets token (leave empty to do this later):";
  const fake = (b: Registry, t: Tickets) =>
    withFakeTickets(b, t, true, { credential: true });
  const stored = (env: Record<string, string>) =>
    readCredential({
      tool: "fake",
      site: SITE,
      names: [FAKE_EMAIL, FAKE_TOKEN],
      env,
    });
  const SET_UP = `version: 2\nrepository: acme/site\n${CODE_HOST_YAML}\ntickets:\n  type: fake\n  site: ${SITE}\n`;

  describe("on a first setup", () => {
    const first = (o: Partial<Setup> = {}) =>
      init({
        tools: fake,
        answers: {
          checkbox: [[]],
          input: [SITE, EMAIL],
          confirm: [true],
          secret: [TOKEN],
        },
        ...o,
      });

    it("plans the secrets, then storing the credential on this machine", async () => {
      const r = first();
      expect(await r.run()).toBe(0);
      const at = r.out.indexOf(`  secrets       ${FAKE_EMAIL}, ${FAKE_TOKEN}`);
      expect(r.out.slice(at, at + 2)).toEqual([
        `  secrets       ${FAKE_EMAIL}, ${FAKE_TOKEN}`,
        `  store         your Fake Tickets credential on this machine, in ${credentialsPath(r.env)}`,
      ]);
    });

    it("asks for each part in order, then says whose they are and where they went", async () => {
      const r = first();
      expect(await r.run()).toBe(0);
      const at = r.transcript.indexOf(`? ${EMAIL_Q}`);
      expect(r.transcript.slice(at - 1, at + 3)).toEqual([
        `Fake Tickets' token: opening ${FAKE_PAGE}`,
        `? ${EMAIL_Q}`,
        `? ${TOKEN_Q}`,
        "It belongs to Fake User. Stored as FAKE_TICKETS_EMAIL and FAKE_TICKETS_TOKEN, and on this machine.",
      ]);
    });

    it("stores the values as secrets and in a file only its owner can read, printing neither", async () => {
      const r = first();
      expect(await r.run()).toBe(0);
      expect(r.runner.secrets.get(FAKE_EMAIL)).toBe(EMAIL);
      expect(r.runner.secrets.get(FAKE_TOKEN)).toBe(TOKEN);
      expect(stored(r.env)).toEqual({
        state: "found",
        source: "file",
        values: GOOD_PAIR,
      });
      expect(statSync(credentialsPath(r.env)).mode & 0o777).toBe(0o600);
      expect(r.out.join("\n")).not.toContain(TOKEN);
    });

    it("prints the tool's refusal and asks again from the first masked part", async () => {
      const r = first({
        answers: {
          checkbox: [[]],
          input: [SITE, EMAIL],
          confirm: [true],
          secret: [REFUSED, TOKEN],
        },
      });
      expect(await r.run()).toBe(0);
      expect(r.out).toContain(
        "Fake Tickets refused that email and token: 401 Unauthorized. Paste another.",
      );
      expect(r.asked.filter((q) => q === EMAIL_Q)).toHaveLength(1);
      expect(r.asked.filter((q) => q === TOKEN_Q)).toHaveLength(2);
      expect(r.runner.secrets.get(FAKE_TOKEN)).toBe(TOKEN);
    });

    it("prints the tool's message for any other failure, and asks again", async () => {
      const r = first({
        answers: {
          checkbox: [[]],
          input: [SITE, EMAIL],
          confirm: [true],
          secret: ["down", TOKEN],
        },
      });
      expect(await r.run()).toBe(0);
      expect(r.out).toContain("Fake Tickets is down.");
      expect(r.runner.secrets.get(FAKE_TOKEN)).toBe(TOKEN);
    });

    it("stores nothing in either place when a part is left empty", async () => {
      const r = first({
        answers: {
          checkbox: [[]],
          input: [SITE, ""],
          confirm: [true],
        },
      });
      expect(await r.run()).toBe(0);
      expect(r.out).toContain(
        "No Fake Tickets credential stored. Run factory init again to add it.",
      );
      expect(r.runner.secrets.size).toBe(0);
      expect(stored(r.env)).toEqual({ state: "missing" });
    });

    it("stores the credential this machine already holds for the site, asking nothing, once the tool accepts it", async () => {
      const r = first({
        machine: { [SITE]: GOOD_PAIR },
        answers: { checkbox: [[]], input: [SITE], confirm: [true] },
      });
      expect(await r.run()).toBe(0);
      expect(r.out).toContain(
        "It belongs to Fake User. Stored as FAKE_TICKETS_EMAIL and FAKE_TICKETS_TOKEN, from this machine.",
      );
      expect(r.out.some((l) => l.startsWith("  Store "))).toBe(false);
      expect(r.runner.secrets.get(FAKE_TOKEN)).toBe(TOKEN);
    });

    it("asks as usual when the tool refuses the one this machine holds", async () => {
      const r = first({
        machine: { [SITE]: { ...GOOD_PAIR, [FAKE_TOKEN]: REFUSED } },
      });
      expect(await r.run()).toBe(0);
      expect(r.asked).toContain(TOKEN_Q);
      expect(stored(r.env)).toMatchObject({ values: GOOD_PAIR });
    });

    it("stops before any other question when the file cannot be read", async () => {
      const r = first({ machine: { other: GOOD_PAIR } });
      chmodSync(credentialsPath(r.env), 0o644);
      expect(await r.run()).toBe(1);
      expect(r.out).toContain(
        `${credentialsPath(r.env)} can be read by others, so it was not read. Run: chmod 600 ${credentialsPath(r.env)}`,
      );
      expect(r.asked).toEqual([]);
    });
  });

  describe("on a re-run", () => {
    const again = (o: Partial<Setup> = {}) =>
      init({
        tools: fake,
        settings: SET_UP,
        secrets: { [FAKE_EMAIL]: "ci@acme.example", [FAKE_TOKEN]: "ci" },
        answers: { input: [EMAIL], secret: [TOKEN], confirm: [false] },
        ...o,
      });
    const row = (r: ReturnType<typeof init>) =>
      r.out.find((l) => l.startsWith("  This machine"));

    it("asks for this machine's missing credential right after Found, stores it here only, and asks whether to change the parts", async () => {
      const r = again();
      expect(await r.run()).toBe(0);
      expect(row(r)).toBe(
        "  This machine   no Fake Tickets credential for acme.example",
      );
      expect(r.asked).toEqual([
        EMAIL_Q,
        TOKEN_Q,
        "confirm: Change which parts are on?",
      ]);
      expect(r.out.slice(-3)).toEqual([
        "It belongs to Fake User. Stored on this machine.",
        "",
        "Nothing else changed.",
      ]);
      expect(stored(r.env)).toMatchObject({ values: GOOD_PAIR });
      expect(r.runner.secrets.get(FAKE_TOKEN)).toBe("ci");
      expect(r.read(".claude/factory.yaml")).toBe(SET_UP);
      expect(r.synced()).toBe(0);
    });

    it("asks again for a credential the tool refuses, naming it in Found", async () => {
      const r = again({
        machine: { [SITE]: { ...GOOD_PAIR, [FAKE_TOKEN]: REFUSED } },
      });
      expect(await r.run()).toBe(0);
      expect(row(r)).toBe(
        "  This machine   Fake Tickets refused the credential for acme.example",
      );
      expect(stored(r.env)).toMatchObject({ values: GOOD_PAIR });
    });

    it("says to replace refused variables, asking for nothing and writing no file, since they would still win", async () => {
      const r = again({
        env: { [FAKE_EMAIL]: EMAIL, [FAKE_TOKEN]: REFUSED },
        answers: { checkbox: [[]], confirm: [false, true] },
      });
      expect(await r.run()).toBe(0);
      expect(r.out).toContain(
        "Fake Tickets refused FAKE_TICKETS_EMAIL and FAKE_TICKETS_TOKEN for acme.example (401 Unauthorized). They may have expired. Run factory init, and replace them.",
      );
      expect(r.asked).not.toContain(TOKEN_Q);
      expect(r.asked).not.toContain("confirm: Change which parts are on?");
      expect(stored({ XDG_CONFIG_HOME: r.env.XDG_CONFIG_HOME })).toEqual({
        state: "missing",
      });
    });

    it("asks nothing for an accepted one, and carries on as before", async () => {
      const r = again({
        machine: { [SITE]: GOOD_PAIR },
        answers: { checkbox: [[]], confirm: [false, true] },
      });
      expect(await r.run()).toBe(0);
      expect(row(r)).toBe(
        "  This machine   Fake Tickets credential for acme.example",
      );
      expect(r.asked).not.toContain("confirm: Change which parts are on?");
      expect(r.asked).toContain("checkbox: Which parts do you want?");
    });

    it("says the tool's line and still asks when a part is left empty", async () => {
      const r = again({ answers: { input: [""], confirm: [false] } });
      expect(await r.run()).toBe(0);
      expect(r.out).toContain(
        "No Fake Tickets credential stored. Run factory init again to add it.",
      );
      expect(r.asked).toContain("confirm: Change which parts are on?");
    });

    it("carries on to the parts on a yes, storing missing secrets from this machine with no second prompt", async () => {
      const r = again({
        secrets: {},
        answers: {
          input: [EMAIL],
          secret: [TOKEN],
          confirm: [true, true],
          checkbox: [[]],
        },
      });
      expect(await r.run()).toBe(0);
      expect(r.asked.filter((q) => q === TOKEN_Q)).toHaveLength(1);
      expect(r.out).toContain(
        "It belongs to Fake User. Stored as FAKE_TICKETS_EMAIL and FAKE_TICKETS_TOKEN, from this machine.",
      );
      expect(r.runner.secrets.get(FAKE_TOKEN)).toBe(TOKEN);
    });

    it("stops with this machine set up when the repository's secrets cannot be listed", async () => {
      const r = again({
        runnerFails: {
          secretNames: new Error("403 Must have admin rights to Repository"),
        },
      });
      expect(await r.run()).toBe(0);
      expect(r.out.at(-1)).toBe(
        "Could not list the repository's secrets, so the parts are left as they are: 403 Must have admin rights to Repository",
      );
      expect(r.asked).not.toContain("confirm: Change which parts are on?");
      expect(stored(r.env)).toMatchObject({ values: GOOD_PAIR });
    });

    it.each([
      [
        "open to others",
        (path: string) => chmodSync(path, 0o604),
        /can be read by others, so it was not read\. Run: chmod 600 /,
      ],
      [
        "not YAML",
        (path: string) => writeFileSync(path, "fake: ["),
        /is not valid YAML: .*\. Fix or delete it, then run factory init again\.$/,
      ],
    ])(
      "stops right after Found, asking nothing, when the file is %s",
      async (_, spoil, line) => {
        const r = again({ machine: { other: GOOD_PAIR } });
        spoil(credentialsPath(r.env));
        expect(await r.run()).toBe(1);
        expect(r.out.at(-1)).toMatch(line);
        expect(r.out.at(-2)).toBe("");
        expect(r.asked).toEqual([]);
      },
    );
  });

  it("shows no ticket credential's This machine row and asks no such question with GitHub's tickets", async () => {
    const r = init({
      settings: `version: 2\nrepository: acme/site\n${CODE_HOST_YAML}\n`,
      answers: { checkbox: [[]], confirm: [true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.out.filter((l) => l.includes("This machine"))).toEqual([
      "  This machine   no GitHub token for cloud runs",
    ]);
    expect(r.asked).not.toContain("confirm: Change which parts are on?");
  });
});

describe("init's own dependencies", () => {
  const stream = (tty: boolean) => {
    const written: string[] = [];
    const write = (chunk: unknown, _e: unknown, done: () => void) => {
      written.push(String(chunk));
      done();
    };
    return Object.assign(new Writable({ write }), {
      written,
      isTTY: tty,
      getColorDepth: () => (tty ? 8 : 1),
      hasColors: () => tty,
    });
  };

  it("prints in color in a terminal that shows it, and not when piped", async () => {
    vi.stubEnv("NO_COLOR", undefined);
    vi.stubEnv("FORCE_COLOR", undefined);
    const root = mkdtempSync(join(tmpdir(), "init-deps-"));
    const printed = async (tty: boolean) => {
      const to = stream(tty);
      (await initDeps(root, to)).out(say.mark("ok", "done"));
      return to.written.join("");
    };

    expect(await printed(true)).toContain("\x1B[32m✓");
    expect(await printed(false)).toBe("✓ done\n");
  });
});
