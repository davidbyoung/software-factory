// `factory init`: what it finds, what it asks, the plan it shows, and what
// it does once told to go ahead, run against the in-memory code host,
// runner, and ticket system with scripted answers. No test reaches GitHub.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NoDefaultBranch } from "../src/lib/default-branch.mts";
import { afterEach, describe, expect, it } from "vitest";
import { load } from "js-yaml";
import { main, parseRemote, type Ask, type InitDeps } from "../src/init.mts";
import type { Part } from "../src/parts.mts";
import { memoryCodeHost } from "./memory-code-host";
import { memoryRunner } from "./memory-runner";
import { memoryTickets } from "./memory-tickets";
import { memoryTools } from "./memory-tools";
import {
  FAKE_PAGE,
  FAKE_TOKEN,
  withCodeHosts,
  withFakeTickets,
  scriptedAgent,
  withFakeAgent,
  withSecondRunner,
} from "./fake-tools";
import { ADD, NONE } from "../src/columns-suggest.mts";
import type { Registry } from "../src/tools.mts";
import type { Agent } from "../src/agent/types.mts";
import type { Tickets } from "../src/tickets/types.mts";

const GOOD = "tok_good";
const NARROW = "tok_narrow";
const AGENT = "agent_token";
const PRIVATE_KEY = "-----BEGIN PRIVATE-----\nsecret key\n-----END-----";
/** Every value a test pastes or makes, none of which may be printed. */
const VALUES = [GOOD, NARROW, AGENT, PRIVATE_KEY, "secret key"];

type Answers = {
  checkbox?: (Part | string)[][];
  select?: string[];
  confirm?: boolean[];
  secret?: string[];
  input?: string[];
};

/** Answers each question in turn from the script, and records each one. */
function scripted(answers: Answers, log: (line: string) => void = () => {}) {
  const asked: string[] = [];
  /** The values each select offered, in order. */
  const offered: string[][] = [];
  /** Each select's choices as they read, and the one chosen if none is
   * picked, in order. */
  const selects: { names: string[]; fallback?: string }[] = [];
  /** What each checkbox's choices say under them, by value. */
  const descriptions: Record<string, string | undefined>[] = [];
  /** Each checkbox's choices as they read, and which start picked. */
  const checkboxes: { names: string[]; checked: string[] }[] = [];
  const queue = {
    checkbox: [...(answers.checkbox ?? [])],
    select: [...(answers.select ?? [])],
    confirm: [...(answers.confirm ?? [])],
    secret: [...(answers.secret ?? [])],
    input: [...(answers.input ?? [])],
  };
  const next = <K extends keyof typeof queue>(kind: K, message: string) => {
    asked.push(`${kind}: ${message}`);
    log(`? ${kind}: ${message}`);
    if (!queue[kind].length) throw new Error(`no scripted ${kind}: ${message}`);
    return queue[kind].shift()!;
  };
  const ask: Ask = {
    checkbox: async (message, choices) => {
      descriptions.push(
        Object.fromEntries(choices.map((c) => [c.value, c.description])),
      );
      checkboxes.push({
        names: choices.map((c) => c.name),
        checked: choices.filter((c) => c.checked).map((c) => c.value),
      });
      const chosen = next("checkbox", message) as string[];
      for (const c of chosen)
        if (!choices.some((x) => x.value === c))
          throw new Error(`no choice ${c}`);
      return chosen;
    },
    select: async (message, choices, fallback) => {
      offered.push(choices.map((c) => c.value));
      selects.push({ names: choices.map((c) => c.name), fallback });
      return next("select", message) as string;
    },
    confirm: async (message) => next("confirm", message) as boolean,
    secret: async (message) => next("secret", message) as string,
    input: async (message) => next("input", message) as string,
  };
  return { ask, asked, offered, selects, descriptions, checkboxes, queue };
}

type Setup = {
  answers: Answers;
  settings?: string;
  secrets?: Record<string, string>;
  remote?: string | null;
  packageJson?: boolean;
  boards?: { number: number; title: string; columns: string[] }[];
  signingNeedsScope?: boolean;
  rulesRefused?: string;
  createRefused?: string;
  claude?: boolean;
  files?: Record<string, string>;
  tokens?: Record<string, { account: string; scopes: string[] | null }>;
  tools?: (base: Registry, tickets: Tickets) => Registry;
  /** Whether the repository is private; public unless given. */
  private?: boolean;
  /** The code host's default branch; null when nobody can tell it. */
  defaultBranch?: string | null;
  /** The coding agent's answers. */
  agent?: Agent;
  dependabotSecrets?: Record<string, string>;
  /** Whether an organization owns the repository; a person unless given. */
  organization?: boolean;
  organizationSecrets?: string[];
  organizationDependabotSecrets?: string[] | null;
  runnerFails?: NonNullable<Parameters<typeof memoryRunner>[0]>["fail"];
  codeHostFails?: NonNullable<Parameters<typeof memoryCodeHost>[1]>["fail"];
};

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function init(setup: Setup) {
  const root = mkdtempSync(join(tmpdir(), "init-"));
  roots.push(root);
  if (setup.packageJson !== false)
    writeFileSync(join(root, "package.json"), '{"name":"site"}\n');
  if (setup.settings !== undefined) {
    mkdirSync(join(root, ".claude"), { recursive: true });
    writeFileSync(join(root, ".claude/factory.yaml"), setup.settings);
  }
  for (const [path, text] of Object.entries(setup.files ?? {})) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  const out: string[] = [];
  /** Every line printed and every question asked, in the order they came. */
  const transcript: string[] = [];
  const ran: string[][] = [];
  const opened: string[] = [];
  let synced = 0;
  const { ask, asked, offered, selects, descriptions, checkboxes, queue } =
    scripted(setup.answers, (line) => transcript.push(line));
  const host = memoryCodeHost([], {
    owner: "dave",
    tokens: {
      [GOOD]: { account: "dave", scopes: ["push", "workflows", "board"] },
      [NARROW]: { account: "dave", scopes: ["push"] },
      ...setup.tokens,
    },
    signingNeedsScope: setup.signingNeedsScope,
    rulesRefused: setup.rulesRefused,
    isPrivate: setup.private,
    defaultBranch: setup.defaultBranch ?? undefined,
    ownerIsOrganization: setup.organization,
    fail: setup.codeHostFails,
  });
  /** What the code host answered each time the sync's plan asked it. */
  const branchAsked: string[] = [];
  const runner = memoryRunner({
    secrets: setup.secrets ?? {},
    dependabotSecrets: setup.dependabotSecrets,
    organizationSecrets: setup.organizationSecrets,
    organizationDependabotSecrets: setup.organizationDependabotSecrets,
    fail: setup.runnerFails,
  });
  const tickets = memoryTickets([], {
    boards: setup.boards ?? [],
    createRefused: setup.createRefused,
  });
  const d: InitDeps = {
    root,
    ask,
    out: (line) => {
      out.push(line);
      transcript.push(line);
    },
    remote: () =>
      setup.remote === undefined
        ? "git@github.com:acme/site.git"
        : setup.remote,
    tools: (setup.tools ?? ((b) => b))(
      memoryTools({
        codeHost: host.codeHost,
        runner: runner.runner,
        tickets: tickets.tickets,
        agent: setup.agent,
      }),
      tickets.tickets,
    ),
    sync: async () => {
      synced++;
      return 0;
    },
    syncChanges: async (_text, askHost) => {
      if (setup.defaultBranch === null) throw new NoDefaultBranch();
      branchAsked.push(await askHost());
      return [".claude/skills/factory-build/SKILL.md"];
    },
    interactive: async (argv) => {
      ran.push(argv);
      if (argv[0] === "grant") host.grantScope();
      return 0;
    },
    hasCommand: (name) => (name === "claude" ? setup.claude !== false : true),
    openPage: (url) => opened.push(url),
    keygen: async () => ({
      privateKey: PRIVATE_KEY,
      publicKey: "ssh-ed25519 PUBLIC",
    }),
    checks: async () => [{ state: "pass", text: "Every check passed" }],
    packageName: "@davidbyoung/software-factory",
    packageVersion: "0.2.0",
  };
  const read = (path: string) =>
    existsSync(join(root, path))
      ? readFileSync(join(root, path), "utf8")
      : null;
  return {
    run: () => main([], d),
    out,
    transcript,
    asked,
    offered,
    selects,
    descriptions,
    checkboxes,
    queue,
    ran,
    opened,
    synced: () => synced,
    branchAsked,
    read,
    yaml: () =>
      load(read(".claude/factory.yaml") ?? "") as Record<string, unknown>,
    host,
    runner,
    tickets,
  };
}

const EVERY: Part[] = [
  "review",
  "board",
  "cloud",
  "auto-merge",
  "signing",
  "from-board",
];

const SIX_COLUMNS = [
  "Backlog",
  "In refinement",
  "Ready",
  "In progress",
  "In review",
  "Done",
];

/** No pasted or made value reaches anything printed. */
function printsNoSecret(out: string[]) {
  const text = out.join("\n");
  for (const v of VALUES) expect(text).not.toContain(v);
}

describe("factory init, a first run with every part", () => {
  const first = () =>
    init({
      packageJson: false,
      answers: {
        checkbox: [EVERY],
        select: ["new", "own-server"],
        input: ["docs/**, **/*.md"],
        confirm: [true],
        secret: [AGENT, GOOD],
      },
    });

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
    expect(found).toMatch(
      /package\.json +none, so a private one will be created/,
    );
  });

  it("writes the settings, the review's among them, a private package.json, and syncs", async () => {
    const r = first();
    expect(await r.run()).toBe(0);
    expect(r.yaml()).toEqual({
      version: 2,
      repository: "acme/site",
      tickets: { board: 1 },
      builds: { trigger: "own-server" },
      "auto-merge": { allow: ["docs/**", "**/*.md"] },
      "pr-review": { commands: [] },
    });
    expect(JSON.parse(r.read("package.json")!)).toEqual({
      name: "site",
      private: true,
      devDependencies: { "@davidbyoung/software-factory": "^0.2.0" },
    });
    expect(r.read(".gitignore")).toBe("node_modules/\n");
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

  it("allows auto-merge and requires the review's verdict", async () => {
    const r = first();
    await r.run();
    expect(r.host.settings.autoMerge).toBe(true);
    expect(r.host.settings.rules).toEqual([
      { name: "Software factory", check: "Review verdict" },
    ]);
  });

  it("names what it cannot do, with the poller's variables but never the token", async () => {
    const r = first();
    await r.run();
    const text = r.out.join("\n");
    expect(text).toContain(
      "Install the app the review posts through: https://code.example/apps/review",
    );
    expect(text).toContain("FACTORY_REPOSITORY=acme/site");
    expect(text).toContain("FACTORY_BOARD_OWNER=acme");
    expect(text).toContain("FACTORY_BOARD_NUMBER=1");
    expect(text).toContain("Every check passed");
    expect(text).toContain("Nothing is committed.");
    printsNoSecret(r.out);
  });

  it("leaves the gate's commands to add, before the commit, since a new settings file has none", async () => {
    const r = first();
    await r.run();
    const left = r.out.slice(
      r.out.indexOf("Nothing is committed. Left to do:"),
    );
    expect(left.slice(3, 5)).toEqual([
      "  3. Add the commands that check a change, under commands.gate in .claude/factory.yaml",
      "  4. Commit this on a branch, open a pull request, and merge it.",
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
    expect(text).toContain("package.json");
    expect(text).toContain(".claude/skills/factory-build/SKILL.md");
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
      "checkbox: Which parts do you want?",
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
    expect(r.out).toContain(
      "  1. Commit this on a branch, open a pull request, and merge it.",
    );
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
      settings:
        "version: 2\nrepository: acme/site\ntickets:\n  board: 3\n  columns:\n    backlog: Todo\n",
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
      settings:
        "version: 2\nrepository: acme/site\ntickets:\n  board: 3\n  columns:\n    backlog: Todo\n  fields:\n    cost: none\n",
      secrets: { FACTORY_BOARD_TOKEN: "x" },
      answers: { checkbox: [[]], confirm: [true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.yaml()).toEqual({ version: 2, repository: "acme/site" });
  });

  it("takes the review's setting out when the review is turned off, so the sync removes its workflow", async () => {
    const r = init({
      settings:
        "version: 2\nrepository: acme/site\npr-review:\n  commands:\n    - npm test\n",
      answers: { checkbox: [[]], confirm: [true] },
    });
    await r.run();
    expect(r.yaml()).toEqual({ version: 2, repository: "acme/site" });
  });

  it("keeps the review's commands when the review stays on", async () => {
    const r = init({
      settings:
        "version: 2\nrepository: acme/site\npr-review:\n  commands:\n    - npm test\n",
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
      "Check that push, workflows, and board are ticked, choose an expiry, and generate it.",
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
      "No token stored. Run npx --no-install factory init again to add it.",
    );
  });

  it("takes an API key when the coding agent is not installed", async () => {
    const r = init({
      claude: false,
      answers: { checkbox: [["review"]], confirm: [true], secret: [AGENT] },
    });
    await r.run();
    expect(r.ran).toEqual([]);
    expect(r.runner.secrets.get("ANTHROPIC_API_KEY")).toBe(AGENT);
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
    expect(r.yaml().tickets).toEqual({ board: 4 });
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
    expect(r.yaml().tickets).toEqual({ board: 4 });
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
      "No board to use instead: create one on the code host, then run npx --no-install factory init again.",
    );
    expect(r.yaml()).toEqual({ version: 2, repository: "acme/site" });
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
    expect(r.yaml().tickets).toEqual({ board: 1 });
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

  it("names the poller's image and its four settings for a server you host", async () => {
    const r = chosen("own-server");
    await r.run();

    expect(r.out).toContain(
      [
        "  1. Run the poller's image, ghcr.io/davidbyoung/software-factory-poller:0.2.0, where you host it, with:",
        "       FACTORY_REPOSITORY=acme/site",
        "       FACTORY_BOARD_OWNER=acme",
        "       FACTORY_BOARD_NUMBER=1",
        "       FACTORY_BOARD_TOKEN=the access token you just made",
      ].join("\n"),
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
      answers: { checkbox: [["review"]], confirm: [true], secret: [AGENT] },
    });
    expect(await r.run()).toBe(0);
    expect(r.out.join("\n")).toContain(
      'Could not require "Review verdict": Upgrade to GitHub Pro or make this repository public',
    );
    expect(r.out.join("\n")).toContain("Every check passed");
  });
});

describe("factory init, word for word", () => {
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
    expect(r.transcript).toMatchInlineSnapshot(`
      [
        "Setting up the software factory for acme/site",
        "",
        "Found",
        "  Code host      GitHub (from your git remote)",
        "  Tickets        GitHub Issues",
        "  Coding agent   Claude Code",
        "  Cloud builds   GitHub Actions",
        "  package.json   none, so a private one will be created",
        "  Settings       none yet",
        "  Board          none yet",
        "",
        "? checkbox: Which parts do you want?",
        "? select: Which board?",
        "? input: Which files may merge without you? (comma-separated)",
        "? select: Where does the poller run?",
        "",
        "This is everything setup will do:",
        "  Write    .claude/factory.yaml",
        "  Write    package.json",
        "  Write    .gitignore",
        "  Write    .claude/skills/factory-build/SKILL.md",
        "  Create   board "site" under acme, linked to the repository, with the factory's columns and fields",
        "  Secrets  CLAUDE_CODE_OAUTH_TOKEN, FACTORY_BOARD_TOKEN, FACTORY_AUTOMERGE_TOKEN, FACTORY_SIGNING_KEY",
        "  Settings allow auto-merge on the repository",
        "  Rules    Require "Review verdict" before a merge to the default branch, as the rule "Software factory"",
        "? confirm: Go ahead?",
        "Created board 1, "site".",
        "Added to board 1: Backlog, In refinement, Ready, In review, Session, Runs in, Cost.",
        "",
        "The coding agent's token: running claude setup-token...",
        "? secret: Paste the token it printed (leave empty to do this later):",
        "Stored as CLAUDE_CODE_OAUTH_TOKEN.",
        "",
        "An access token: opening https://code.example/tokens/new?scopes=push,workflows,board&note=software factory: acme/site",
        "Check that push, workflows, and board are ticked, choose an expiry, and generate it.",
        "? secret: Paste it (leave empty to do this later):",
        "It belongs to dave. Stored as FACTORY_BOARD_TOKEN, FACTORY_AUTOMERGE_TOKEN.",
        "",
        "Made a signing key and stored it as FACTORY_SIGNING_KEY.",
        "Added its public half to dave as a signing key.",
        "",
        "Nothing is committed. Left to do:",
        "  1. Install the app the review posts through: https://code.example/apps/review",
        "  2. Run the poller's image, ghcr.io/davidbyoung/software-factory-poller:0.2.0, where you host it, with:
             FACTORY_REPOSITORY=acme/site
             FACTORY_BOARD_OWNER=acme
             FACTORY_BOARD_NUMBER=1
             FACTORY_BOARD_TOKEN=the access token you just made",
        "  3. Add the commands that check a change, under commands.gate in .claude/factory.yaml",
        "  4. Commit this on a branch, open a pull request, and merge it.",
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
        "tickets:",
        "  board: 3",
        "builds:",
        "  trigger: own-server",
        "auto-merge:",
        "  allow:",
        "    - docs/**",
        "pr-review:",
        "  commands: []",
        "",
      ].join("\n"),
      secrets: {
        CLAUDE_CODE_OAUTH_TOKEN: "x",
        FACTORY_BOARD_TOKEN: "x",
        FACTORY_AUTOMERGE_TOKEN: "x",
        FACTORY_SIGNING_KEY: "x",
      },
      boards: [{ number: 3, title: "Roadmap", columns: SIX_COLUMNS }],
      answers: { checkbox: [EVERY], confirm: [false, true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.transcript).toMatchInlineSnapshot(`
      [
        "Setting up the software factory for acme/site",
        "",
        "Found",
        "  Code host      GitHub (from your git remote)",
        "  Tickets        GitHub Issues",
        "  Coding agent   Claude Code",
        "  Cloud builds   GitHub Actions",
        "  package.json   yes",
        "  Settings       .claude/factory.yaml",
        "  Board          3, from your settings",
        "",
        "? checkbox: Which parts do you want?",
        "? confirm: 4 secrets these parts read are already set. Replace them?",
        "",
        "This is everything setup will do:",
        "  Write    .gitignore",
        "  Write    .claude/skills/factory-build/SKILL.md",
        "  Board    give board 3 any of the factory's columns and fields it lacks",
        "  Settings allow auto-merge on the repository",
        "  Rules    Require "Review verdict" before a merge to the default branch, as the rule "Software factory"",
        "? confirm: Go ahead?",
        "Added to board 3: Session, Runs in, Cost.",
        "",
        "Nothing is committed. Left to do:",
        "  1. Install the app the review posts through: https://code.example/apps/review",
        "  2. Run the poller's image, ghcr.io/davidbyoung/software-factory-poller:0.2.0, where you host it, with:
             FACTORY_REPOSITORY=acme/site
             FACTORY_BOARD_OWNER=acme
             FACTORY_BOARD_NUMBER=3
             FACTORY_BOARD_TOKEN=the access token you just made",
        "  3. Add the commands that check a change, under commands.gate in .claude/factory.yaml",
        "  4. Commit this on a branch, open a pull request, and merge it.",
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
      settings: "version: 2\nrepository: acme/site\n",
      secrets: { CLAUDE_CODE_OAUTH_TOKEN: "x", FACTORY_BOARD_TOKEN: "x" },
      answers: { checkbox: [["cloud"]], confirm: [false, true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.asked).toEqual([
      "checkbox: Which parts do you want?",
      "confirm: 2 secrets these parts read are already set. Replace them?",
      "confirm: Go ahead?",
    ]);
    expect(r.opened).toEqual([]);
  });
});

describe("factory init, a tool's own setup", () => {
  /** Fake Tickets as the only ticket system. */
  const fakeOnly = (b: Registry, t: Tickets) => withFakeTickets(b, t, true);
  const FAKE = "version: 2\nrepository: acme/site\ntickets:\n  type: fake\n";

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
    expect(r.asked.slice(0, 2)).toEqual([
      "checkbox: Which parts do you want?",
      "input: Your ticket system's address",
    ]);
    expect(r.yaml().tickets).toEqual({
      type: "fake",
      site: "https://tickets.example",
    });
    expect(r.out).toContain("  Write    .claude/factory.yaml");
  });

  it("does not ask again for a value already in the settings", async () => {
    const r = init({
      tools: fakeOnly,
      settings: `${FAKE}  site: https://tickets.example\n`,
      secrets: { [FAKE_TOKEN]: "x" },
      answers: { checkbox: [[]], confirm: [false, true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.asked.some((q) => q.startsWith("input:"))).toBe(false);
  });

  it("gets the tool's secret its way, and stores it under the tool's name", async () => {
    const r = init({
      tools: fakeOnly,
      settings: `${FAKE}  site: https://tickets.example\n`,
      answers: { checkbox: [[]], confirm: [true], secret: [GOOD] },
    });
    expect(await r.run()).toBe(0);
    expect(r.out).toContain(`  Secrets  ${FAKE_TOKEN}`);
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
      "No Fake Tickets token stored. Run npx --no-install factory init again to add it.",
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
      settings:
        "version: 2\nrepository: acme/site\ntickets:\n  type: fake\n  site: https://tickets.example\n",
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
        .filter((a) => a.startsWith("select: "))
        .indexOf(`select: ${question}`)
    ]!;
  const STEP_LINES = [
    "",
    "Board 3 has the columns Todo, In Progress, Code review, and Done.",
    "Asking Claude Code which of them shows each of the factory's six states...",
    "",
    "  State      Column",
    "  backlog    Todo",
    "  refining   no column, shows in Todo",
    "  ready      no column: builds start only when you ask",
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

  it("on Yes writes only the states that differ, and adds only the fields", async () => {
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
        "    review: Code review",
        "",
      ].join("\n"),
    );
    expect(r.tickets.boards[0].columns).toEqual(SHOP_COLUMNS);
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
        "refining: no column, shows in Todo",
        "ready: no column: builds start only when you ask",
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
      columns: { backlog: "Todo", ready: "none", review: "Code review" },
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

  it("adds the factory's columns it lacks and writes no columns on No", async () => {
    const r = shop({ select: ["no"] });
    expect(await r.run()).toBe(0);
    expect(r.yaml().tickets).toEqual({ board: 3 });
    expect(r.out).toContain(
      "Added to board 3: Backlog, In refinement, Ready, In review, Session, Runs in, Cost.",
    );
    expect(r.tickets.boards[0].columns).toEqual(
      expect.arrayContaining(["Todo", "Code review"]),
    );
  });

  it("stops before the plan, changing nothing, when the agent is not installed", async () => {
    const r = shop({ agent: scriptedAgent([], { installed: false }) });
    expect(await r.run()).toBe(1);
    expect(r.out.slice(-4)).toEqual([
      "Board 3 has the columns Todo, In Progress, Code review, and Done.",
      "Matching them to the factory's six states needs Claude Code, which is not installed.",
      "Install it and run factory init again, or write tickets.columns in .claude/factory.yaml yourself.",
      "Nothing changed.",
    ]);
    expect(r.agent.asked).toEqual([]);
    expect(r.asked).not.toContain("confirm: Go ahead?");
    expect(r.read(".claude/factory.yaml")).toBeNull();
    expect(r.tickets.boards[0].columns).toEqual(SHOP_COLUMNS);
    expect(r.tickets.boards[0].fields ?? []).toEqual([]);
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
  ])("stops before the plan, changing nothing, on %s", async (_n, got, why) => {
    const r = shop({ agent: scriptedAgent([got]) });
    expect(await r.run()).toBe(1);
    expect(r.out.slice(-3)).toEqual([
      `Claude Code's answer could not be used: ${why}.`,
      "Run factory init again, or write tickets.columns in .claude/factory.yaml yourself.",
      "Nothing changed.",
    ]);
    expect(r.asked).not.toContain("confirm: Go ahead?");
    expect(r.read(".claude/factory.yaml")).toBeNull();
    expect(r.tickets.boards[0].columns).toEqual(SHOP_COLUMNS);
    expect(r.tickets.boards[0].fields ?? []).toEqual([]);
  });

  it.each([
    [
      "a board with the factory's six columns",
      { boards: [{ number: 3, title: "Roadmap", columns: SIX_COLUMNS }] },
      ["3"],
    ],
    ["a new board", { boards: SHOP() }, ["new"]],
    [
      "a board with no columns",
      { boards: [{ number: 3, title: "Roadmap", columns: [] }] },
      ["3"],
    ],
    [
      "settings that name the columns",
      {
        boards: SHOP(),
        settings:
          "version: 2\nrepository: acme/site\ntickets:\n  board: 3\n  columns:\n    backlog: Todo\n",
      },
      [],
    ],
  ])("asks nothing about columns with %s", async (_n, setup, select) => {
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
  });

  describe("with builds from the board", () => {
    const FROM_BOARD = ["board", "cloud", "from-board"];

    it("tells the agent ready needs a column, and can't use an answer without one", async () => {
      const r = shop({ parts: FROM_BOARD, select: ["github-action"] });
      expect(await r.run()).toBe(1);
      expect(r.agent.asked[0]!.prompt).toContain("ready needs a column");
      expect(r.out).toContain(
        "Claude Code's answer could not be used: it gave ready no column, and builds start from the board.",
      );
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
      "tickets:",
      "  board: 3",
      "  columns:",
      "    backlog: Todo",
      "    ready: none",
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
      expect(r.yaml().tickets).toEqual({
        board: 3,
        columns: { backlog: "Todo" },
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
      expect(r.yaml().tickets).toEqual({
        board: 3,
        columns: { backlog: "Todo", ready: "Approved" },
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
      "Matching them to the factory's six states needs Fake Agent, which is not installed.",
    );
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

  it("lists .npmrc and the names it reads under Found, after package.json", async () => {
    const r = first(`${NPMRC}//b.example/:_authToken=\${B_TOKEN}\n`, {
      answers: { checkbox: [[]], confirm: [true], secret: [TOKEN, TOKEN] },
    });
    await r.run();
    const at = r.out.findIndex((l) => l.startsWith("  package.json"));
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
      "  Secrets  NPM_TOKEN for Actions and for Dependabot",
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
    expect(r.out).toContain("  Secrets  NPM_TOKEN for Dependabot");
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
    expect(r.out).toContain("  Secrets  NPM_TOKEN for Actions");
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
      "No NPM_TOKEN stored. The factory's workflows fail at npm ci until it is. Run npx --no-install factory init again to add it.",
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
      "",
      ".npmrc reads ${HOME} to sign in, and the runner sets HOME for itself. Rename it in .npmrc, then run: npx --no-install factory sync",
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
        "checkbox: Which parts do you want?",
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
          answers: { checkbox: [["board"]], confirm: [false, true] },
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
