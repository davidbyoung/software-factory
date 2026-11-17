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
import { afterEach, describe, expect, it } from "vitest";
import { load } from "js-yaml";
import { main, parseRemote, type Ask, type InitDeps } from "../src/init.mts";
import type { Part } from "../src/parts.mts";
import { memoryCodeHost } from "./memory-code-host";
import { memoryRunner } from "./memory-runner";
import { memoryTickets } from "./memory-tickets";

const GOOD = "tok_good";
const NARROW = "tok_narrow";
const AGENT = "agent_token";
const PRIVATE_KEY = "-----BEGIN PRIVATE-----\nsecret key\n-----END-----";
/** Every value a test pastes or makes, none of which may be printed. */
const VALUES = [GOOD, NARROW, AGENT, PRIVATE_KEY, "secret key"];

type Answers = {
  checkbox?: Part[][];
  select?: string[];
  confirm?: boolean[];
  secret?: string[];
  input?: string[];
};

/** Answers each question in turn from the script, and records each one. */
function scripted(answers: Answers, log: (line: string) => void = () => {}) {
  const asked: string[] = [];
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
      const chosen = next("checkbox", message) as string[];
      for (const c of chosen)
        if (!choices.some((x) => x.value === c))
          throw new Error(`no choice ${c}`);
      return chosen;
    },
    select: async (message) => next("select", message) as string,
    confirm: async (message) => next("confirm", message) as boolean,
    secret: async (message) => next("secret", message) as string,
    input: async (message) => next("input", message) as string,
  };
  return { ask, asked, queue };
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
  const { ask, asked, queue } = scripted(setup.answers, (line) =>
    transcript.push(line),
  );
  const host = memoryCodeHost([], {
    owner: "dave",
    tokens: {
      [GOOD]: { account: "dave", scopes: ["push", "workflows", "board"] },
      [NARROW]: { account: "dave", scopes: ["push"] },
      ...setup.tokens,
    },
    signingNeedsScope: setup.signingNeedsScope,
    rulesRefused: setup.rulesRefused,
  });
  const runner = memoryRunner({ secrets: setup.secrets ?? {} });
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
    open: () => ({
      codeHost: host.codeHost,
      runner: runner.runner,
      tickets: tickets.tickets,
    }),
    sync: async () => {
      synced++;
      return 0;
    },
    syncChanges: () => [".claude/skills/factory-build/SKILL.md"],
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
    queue,
    ran,
    opened,
    synced: () => synced,
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
        select: ["new"],
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
      version: 1,
      repository: "acme/site",
      tickets: { board: 1 },
      builds: { trigger: "own-server" },
      "auto-merge": { allow: ["docs/**", "**/*.md"] },
      "ci-review": { commands: [] },
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
        select: ["new"],
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

describe("factory init, run again", () => {
  const SETTINGS = [
    "# Our settings.",
    "version: 1",
    "repository: acme/site",
    "tickets:",
    "  board: 3 # the roadmap",
    "auto-merge:",
    "  allow:",
    "    - docs/**",
    "before-commit:",
    "  - npm run lint",
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
        "version: 1\nrepository: acme/site\ntickets:\n  board: 3\n  columns:\n    backlog: Todo\n",
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
        "version: 1\nrepository: acme/site\ntickets:\n  board: 3\n  columns:\n    backlog: Todo\n  fields:\n    cost: none\n",
      secrets: { FACTORY_BOARD_TOKEN: "x" },
      answers: { checkbox: [[]], confirm: [true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.yaml()).toEqual({ version: 1, repository: "acme/site" });
  });

  it("takes the review's setting out when the review is turned off, so the sync removes its workflow", async () => {
    const r = init({
      settings:
        "version: 1\nrepository: acme/site\nci-review:\n  commands:\n    - npm test\n",
      answers: { checkbox: [[]], confirm: [true] },
    });
    await r.run();
    expect(r.yaml()).toEqual({ version: 1, repository: "acme/site" });
  });

  it("keeps the review's commands when the review stays on", async () => {
    const r = init({
      settings:
        "version: 1\nrepository: acme/site\nci-review:\n  commands:\n    - npm test\n",
      answers: { checkbox: [["review"]], confirm: [true], secret: [""] },
    });
    await r.run();
    expect(r.yaml()).toMatchObject({ "ci-review": { commands: ["npm test"] } });
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
      answers: {
        checkbox: [["board"]],
        select: ["4"],
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
    expect(r.yaml()).toEqual({ version: 1, repository: "acme/site" });
  });

  it("turns on a board and cloud builds with builds that start from the board", async () => {
    const r = init({
      answers: {
        checkbox: [["from-board"]],
        select: ["new"],
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
        select: ["new"],
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
        "  2. Host the poller, which starts a build when a card moves to Ready, with:
             FACTORY_REPOSITORY=acme/site
             FACTORY_BOARD_OWNER=acme
             FACTORY_BOARD_NUMBER=1
             FACTORY_BOARD_TOKEN=the access token you just made",
        "  3. Commit this on a branch, open a pull request, and merge it.",
        "",
        "Checks",
        "  ✓ Every check passed",
      ]
    `);
  });

  it("prints and asks the same on a re-run with every part on and every secret set", async () => {
    const r = init({
      settings: [
        "version: 1",
        "repository: acme/site",
        "tickets:",
        "  board: 3",
        "builds:",
        "  trigger: own-server",
        "auto-merge:",
        "  allow:",
        "    - docs/**",
        "ci-review:",
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
        "  2. Host the poller, which starts a build when a card moves to Ready, with:
             FACTORY_REPOSITORY=acme/site
             FACTORY_BOARD_OWNER=acme
             FACTORY_BOARD_NUMBER=3
             FACTORY_BOARD_TOKEN=the access token you just made",
        "  3. Commit this on a branch, open a pull request, and merge it.",
        "",
        "Checks",
        "  ✓ Every check passed",
      ]
    `);
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
