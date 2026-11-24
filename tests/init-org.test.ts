// `factory init --org ADDRESS`: what it refuses, what it finds and asks,
// the plan it shows, and what it does once told to go ahead, run against an
// in-memory organization and ticket system with scripted answers. No test
// reaches GitHub, opens a browser, or listens on a port.
import { describe, expect, it } from "vitest";
import type {
  Installation,
  NewApp,
  Organization,
  OrganizationHost,
  OrganizationPlan,
} from "../src/code-host/types.mts";
import { PassThrough } from "node:stream";
import { main, readLineFrom, type InitOrgDeps } from "../src/init-org.mts";
import type { Ask } from "../src/init-shared.mts";
import type { Registry } from "../src/tools.mts";
import { pollerWorkflow } from "../src/workflow-files.mts";
import { scriptedAgent, withFakeAgent, withFakeTickets } from "./fake-tools";
import { memoryCodeHost } from "./memory-code-host";
import { memoryRunner } from "./memory-runner";
import { memoryTickets } from "./memory-tickets";
import { memoryTools } from "./memory-tools";

const ADDRESS = "https://github.com/acme";
const KEY =
  "-----BEGIN RSA PRIVATE KEY-----\nthe key\n-----END RSA PRIVATE KEY-----";
const TOKEN = "sk-ant-oat01-token";
const API_KEY = "sk-ant-api03-key";
/** Every value a test pastes or is handed, none of which may be printed. */
const VALUES = [KEY, "the key", TOKEN, API_KEY];

const PAID: OrganizationPlan = {
  name: "GitHub Team",
  rules: true,
  privateSecrets: true,
};
const FREE: OrganizationPlan = {
  name: "GitHub Free",
  rules: false,
  privateSecrets: false,
};
const INSTALLED: Installation = {
  id: 52811,
  app: "Software Factory for acme",
  all: true,
  page: "https://github.com/organizations/acme/settings/installations/52811",
};
const RERUN =
  "Run factory init --org https://github.com/acme again: it carries on from here.";

const PRESET = `# The preset for every acme repository.
# factory-preset.yaml, written by factory init --org. It is yours to edit.
version: 2
tickets:
  type: github
  board: 12
  columns:
    backlog: Backlog
    refining: In refinement
    ready: Ready
    building: In progress
    review: In review
    done: Done
pr-review:
  commands: []
builds:
  trigger: github-action
  poll-minutes: 30
`;
const POLLER = ".github/workflows/factory-poller.yml";
/** `acme/factory-config` as a finished setup leaves it. */
const CONFIG = {
  isPrivate: true,
  files: {
    "README.md": "# factory-config\n",
    "factory-preset.yaml": PRESET,
    [POLLER]: pollerWorkflow({
      owner: "acme",
      version: "0.4.0",
      pollMinutes: 30,
    }),
  },
};

type Seed = {
  kind: "organization" | "person" | null;
  role: "owner" | "member" | null;
  plan: OrganizationPlan;
  /** The permissions the sign-in lacks. */
  lacks: string[];
  repositories: Record<
    string,
    { isPrivate: boolean; files: Record<string, string> }
  >;
  secrets: string[];
  variables: Record<string, string>;
  rules: string[];
  /** The app's installation as the run finds it at its start. */
  installation: Installation | null;
  /** The installation that shows once she presses Install: null for one
   * that never shows. */
  installs: Installation | null;
  /** What the app's own count of its repositories says. */
  on: { count: number; covered: boolean };
  /** Whether an app of the name is registered already. */
  taken: boolean;
  /** How the code comes back: by the browser, or by an address she
   * pastes. */
  returns: "browser" | "pasted";
  /** What each operation fails with. */
  fail: Partial<Record<keyof Organization, Error>>;
};

/** An organization kept in memory, which records every call in order. */
function memoryOrganization(seed: Seed, name: string) {
  const log: string[] = [];
  const values = new Map<string, string>();
  const pastes: boolean[] = [];
  const called = <K extends keyof Organization>(op: K, ...args: unknown[]) => {
    log.push([op, ...args].join(" "));
    if (seed.fail[op]) throw seed.fail[op];
  };
  const organization: Organization = {
    async kind() {
      called("kind");
      return seed.kind;
    },
    async role() {
      called("role");
      return seed.role;
    },
    async plan() {
      called("plan");
      return seed.plan;
    },
    async signInLacks() {
      called("signInLacks");
      return seed.lacks.length
        ? {
            scopes: seed.lacks,
            tool: "the GitHub CLI",
            fix: ["grant", seed.lacks.join(",")],
          }
        : null;
    },
    async repository(repo) {
      called("repository", repo);
      const found = seed.repositories[repo];
      return found ? { isPrivate: found.isPrivate } : null;
    },
    async createRepository(repo, o) {
      called("createRepository", repo, o.isPrivate ? "private" : "public");
      seed.repositories[repo] = { isPrivate: o.isPrivate, files: {} };
    },
    async file(repo, path) {
      called("file", repo, path);
      return seed.repositories[repo]?.files[path] ?? null;
    },
    async putFiles(repo, files) {
      called("putFiles", repo, ...Object.keys(files));
      for (const [path, text] of Object.entries(files)) {
        if (path in seed.repositories[repo]!.files)
          throw new Error(`${path} is already there`);
        seed.repositories[repo]!.files[path] = text;
      }
    },
    async secretNames() {
      called("secretNames");
      return [...seed.secrets];
    },
    async setSecret(secret, value) {
      called("setSecret", secret);
      values.set(secret, value);
      if (!seed.secrets.includes(secret)) seed.secrets.push(secret);
    },
    async variable(variable) {
      called("variable", variable);
      return seed.variables[variable] ?? null;
    },
    async setVariable(variable, value) {
      called("setVariable", variable, value);
      seed.variables[variable] = value;
    },
    async defineProperty(property, allowed) {
      called("defineProperty", property, allowed.join("|"));
    },
    async ruleNames() {
      called("ruleNames");
      return [...seed.rules];
    },
    async requireCheckWhere(rule, check, where) {
      called(
        "requireCheckWhere",
        rule,
        check,
        `${where.property}=${where.value}`,
        where.source,
      );
      seed.rules.push(rule);
    },
    appName: () => {
      const wanted = `Software Factory for ${name}`;
      return { name: wanted.slice(0, 34), shortened: wanted.length > 34 };
    },
    async appNamed(app) {
      called("appNamed", app);
      return seed.taken ? { owner: name } : null;
    },
    async registerApp(o) {
      called("registerApp", o.name);
      o.open("http://127.0.0.1:4100/");
      if (seed.returns === "pasted") {
        const stop = new AbortController();
        for (let again = false; ; again = true) {
          pastes.push(again);
          if ((await o.pasted(stop.signal, again)).includes("state=right"))
            break;
        }
      }
      const app: NewApp = {
        id: 9,
        slug: "software-factory-for-acme",
        clientId: "Iv23client",
        key: KEY,
      };
      await o.keep(app);
      log.push("sent the browser to install");
      return { id: app.id, slug: app.slug, clientId: app.clientId };
    },
    async installation(clientId) {
      called("installation", clientId);
      return seed.installation;
    },
    async awaitInstallation(clientId) {
      called("awaitInstallation", clientId);
      return seed.installs;
    },
    async installedOn(id, app, repo) {
      called("installedOn", id, app.clientId, repo);
      if (app.key !== KEY) throw new Error("not the app's key");
      return seed.on;
    },
    appsPage: () => `https://github.com/organizations/${name}/settings/apps`,
  };
  return { organization, log, values, pastes };
}

type Answers = {
  select?: string[];
  confirm?: boolean[];
  secret?: string[];
  /** Each line typed where the command reads an address. */
  typed?: string[];
};

type Setup = {
  address?: string;
  argv?: string[];
  answers?: Answers;
  org?: Partial<Seed>;
  boards?: { number: number; title: string; columns: string[] }[];
  createRefused?: string;
  agentInstalled?: boolean;
  tools?: (base: Registry) => Registry;
};

function setup(o: Setup = {}) {
  const seed: Seed = {
    kind: "organization",
    role: "owner",
    plan: PAID,
    lacks: [],
    repositories: {},
    secrets: [],
    variables: {},
    rules: [],
    installation: null,
    installs: INSTALLED,
    on: { count: 212, covered: true },
    taken: false,
    returns: "browser",
    fail: {},
    ...o.org,
  };
  /** Every line printed and every question asked, in the order they came. */
  const transcript: string[] = [];
  const out: string[] = [];
  const opened: string[] = [];
  const ran: string[][] = [];
  const selects: { message: string; names: string[]; fallback?: string }[] = [];
  const confirms: { message: string; fallback: boolean }[] = [];
  const queue = {
    select: [...(o.answers?.select ?? [])],
    confirm: [...(o.answers?.confirm ?? [])],
    secret: [...(o.answers?.secret ?? [])],
    typed: [...(o.answers?.typed ?? [])],
  };
  const next = <K extends keyof typeof queue>(kind: K, message: string) => {
    transcript.push(`? ${kind}: ${message}`);
    if (!queue[kind].length) throw new Error(`no scripted ${kind}: ${message}`);
    return queue[kind].shift()!;
  };
  const ask: Ask = {
    checkbox: async (message) => {
      throw new Error(`no checkbox is asked: ${message}`);
    },
    select: async (message, choices, fallback) => {
      selects.push({ message, names: choices.map((c) => c.name), fallback });
      const chosen = next("select", message) as string;
      if (!choices.some((c) => c.value === chosen))
        throw new Error(`no choice ${chosen}`);
      return chosen;
    },
    confirm: async (message, fallback) => {
      confirms.push({ message, fallback });
      return next("confirm", message) as boolean;
    },
    secret: async (message) => next("secret", message) as string,
    input: async (message) => {
      throw new Error(`no input is asked: ${message}`);
    },
  };
  const tickets = memoryTickets([], {
    boards: o.boards ?? [],
    createRefused: o.createRefused,
  });
  const organizations = new Map<
    string,
    ReturnType<typeof memoryOrganization>
  >();
  const github: OrganizationHost = {
    label: "GitHub",
    serves: (address) => /^https?:\/\/github\.com(\/|$)/.test(address),
    ownerOf: (address) =>
      /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/?$/.exec(address)?.[1] ?? null,
    addressOf: (owner) => `https://github.com/${owner}`,
    organization: (name) => {
      if (!organizations.has(name))
        organizations.set(name, memoryOrganization(seed, name));
      return organizations.get(name)!.organization;
    },
  };
  const tools = (o.tools ?? ((b) => b))(
    memoryTools({
      codeHost: memoryCodeHost([], { owner: "acme" }).codeHost,
      runner: memoryRunner().runner,
      tickets: tickets.tickets,
      agent: scriptedAgent([], { installed: o.agentInstalled ?? true }),
    }),
  );
  const d: InitOrgDeps = {
    ask,
    out: (line) => {
      out.push(line);
      transcript.push(line);
    },
    interactive: async (argv) => {
      ran.push(argv);
      return 0;
    },
    openPage: (url) => opened.push(url),
    hasCommand: () => true,
    hosts: { github },
    tools,
    readLine: async () => {
      transcript.push("(reads a line)");
      if (!queue.typed.length) throw new Error("nothing typed");
      return queue.typed.shift()!;
    },
    packageVersion: "0.4.0",
  };
  return {
    run: () => main(o.argv ?? ["--org", o.address ?? ADDRESS], d),
    seed,
    out,
    transcript,
    opened,
    ran,
    selects,
    confirms,
    queue,
    tickets,
    /** The in-memory organization, once the command has asked for it. */
    org: (name = "acme") => organizations.get(name)!,
    /** The names of the operations that changed the organization. */
    changes: (name = "acme") =>
      (organizations.get(name)?.log ?? []).filter((l) =>
        /^(createRepository|putFiles|set|define|require|registerApp)/.test(l),
      ),
  };
}

/** No pasted or handed value reaches anything printed. */
function printsNoSecret(out: string[]) {
  const text = out.join("\n");
  for (const v of VALUES) expect(text).not.toContain(v);
}

/** A first run's answers: a new board, a subscription, every 30 minutes,
 * go ahead, and the token. */
const FIRST: Answers = {
  select: ["new", "CLAUDE_CODE_OAUTH_TOKEN", "30"],
  confirm: [true],
  secret: [TOKEN],
};
/** An organization whose every part is set up. */
const DONE: Partial<Seed> = {
  repositories: { "factory-config": CONFIG },
  secrets: ["FACTORY_APP_PRIVATE_KEY", "CLAUDE_CODE_OAUTH_TOKEN"],
  variables: { FACTORY_APP_CLIENT_ID: "Iv23client" },
  rules: ["Software factory"],
  installation: INSTALLED,
};

describe("factory init --org, what it refuses before it asks", () => {
  const refusal = async (o: Setup) => {
    const s = setup(o);
    expect(await s.run()).toBe(1);
    expect(s.transcript.some((l) => l.startsWith("?"))).toBe(false);
    expect(s.changes()).toEqual([]);
    return s.out;
  };

  it("refuses a host that is not a code host the factory supports", async () => {
    expect(
      await refusal({ address: "https://code.acme.example/acme" }),
    ).toEqual([
      "✗ code.acme.example is not a code host the factory supports: GitHub.",
      "Nothing changed.",
    ]);
  });

  it("refuses a word that is no address", async () => {
    expect(await refusal({ address: "acme" })).toEqual([
      "✗ Which code host is acme on? Give its address, such as https://github.com/acme.",
      "Nothing changed.",
    ]);
  });

  it("refuses to run with no address at all", async () => {
    expect(await refusal({ argv: ["--org"] })).toEqual([
      "✗ factory init --org takes an organization's address, such as https://github.com/acme.",
      "Nothing changed.",
    ]);
  });

  it("refuses an address on the code host that is not an organization's", async () => {
    expect(await refusal({ address: "https://github.com/acme/web" })).toEqual([
      "✗ https://github.com/acme/web is not an organization's address. Give one such as https://github.com/acme.",
      "Nothing changed.",
    ]);
  });

  it("refuses an account that is not an owner", async () => {
    expect(await refusal({ org: { role: "member" } })).toEqual([
      "✗ You are not an owner of acme, and registering an app and storing its secrets need one.",
      "Nothing changed.",
    ]);
  });

  it("refuses a personal account", async () => {
    expect(
      await refusal({
        address: "https://github.com/sam",
        org: { kind: "person" },
      }),
    ).toEqual([
      "✗ sam is a personal account, which has nothing to set up once: no shared secrets, and a board that refuses an app's token.",
      "Run factory init in each repository. Nothing changed.",
    ]);
  });

  it("refuses an address GitHub has no organization for", async () => {
    expect(
      await refusal({
        address: "https://github.com/nobody-here",
        org: { kind: null },
      }),
    ).toEqual([
      "✗ https://github.com/nobody-here: GitHub has no organization of that name.",
      "Nothing changed.",
    ]);
  });

  it("stops, as factory init does, when the coding agent is not installed", async () => {
    expect(await refusal({ agentInstalled: false })).toEqual([
      "The factory runs in a coding agent, and Claude Code is not installed.",
      "Install it and run factory init again.",
      "Nothing changed.",
    ]);
  });

  it("stops, as factory init does, when the code host cannot be reached", async () => {
    expect(
      await refusal({
        org: {
          fail: { kind: new Error("gh api users/acme: run gh auth login") },
        },
      }),
    ).toEqual([
      "Could not reach the code host: gh api users/acme: run gh auth login",
    ]);
  });
});

describe("factory init --org, the sign-in's permissions", () => {
  it("changes nothing when she will not grant what the GitHub CLI lacks", async () => {
    const s = setup({
      org: { lacks: ["admin:org"] },
      answers: { confirm: [false] },
    });
    expect(await s.run()).toBe(0);
    expect(s.transcript).toEqual([
      "? confirm: Setting acme up needs the admin:org permission for the GitHub CLI. Open your browser to grant it?",
      "Nothing changed.",
    ]);
    expect(s.confirms[0]!.fallback).toBe(true);
    expect(s.ran).toEqual([]);
    expect(s.changes()).toEqual([]);
  });

  it("names every permission missing, grants them, and carries on", async () => {
    const s = setup({
      org: { ...DONE, lacks: ["admin:org", "project"] },
      answers: { confirm: [true, false] },
    });
    expect(await s.run()).toBe(0);
    expect(s.transcript[0]).toBe(
      "? confirm: Setting acme up needs the admin:org and project permissions for the GitHub CLI. Open your browser to grant them?",
    );
    expect(s.ran).toEqual([["grant", "admin:org,project"]]);
    expect(s.out.at(-1)).toBe("✓ acme is set up. Nothing to do.");
  });
});

describe("factory init --org, a first run", () => {
  it("prints what the draft shows, from what it found to the line a developer runs", async () => {
    const s = setup({
      answers: FIRST,
      boards: [
        { number: 7, title: "Engineering", columns: [] },
        { number: 11, title: "Old", columns: [] },
      ],
    });
    expect(await s.run()).toBe(0);
    expect(s.transcript).toEqual([
      "Setting up the software factory for the organization acme",
      "",
      "Found",
      "  Code host        GitHub (from the address)",
      "  You              an owner of acme",
      "  Tickets          GitHub Issues",
      "  Coding agent     Claude Code (on this machine)",
      "  Preset           none yet",
      "",
      "? select: Which board?",
      "? select: What pays for sessions in the cloud?",
      "Each run of the poller bills at least one Actions minute in a private repository.",
      "? select: How often does the poller read the board?",
      "",
      "This is everything setup will do:",
      '  app       Register the GitHub App "Software Factory for acme" and install it',
      "  secrets   Store FACTORY_APP_PRIVATE_KEY, CLAUDE_CODE_OAUTH_TOKEN, and the variable FACTORY_APP_CLIENT_ID for acme",
      "  preset    Create acme/factory-config, a private repository, with the organization's preset and the poller",
      '  rule      Require "Review verdict" on repositories set up with the factory',
      "  board     Create a board with the factory's columns and fields",
      "? confirm: Go ahead?",
      "",
      '✓ Created board 12, "Software factory".',
      "✓ Created acme/factory-config.",
      'Opened GitHub in your browser. Press "Create GitHub App", then "Install".',
      "If the page it sends you to does not load, paste that page's address here:",
      "✓ Registered the app and installed it on 212 repositories.",
      "",
      "The coding agent's token: running claude setup-token...",
      "? secret: Paste the token it printed (leave empty to do this later):",
      "✓ Stored 2 secrets and 1 variable for acme.",
      '✓ Required "Review verdict" where the property software-factory is "on".',
      "",
      "A developer sets a repository up with: factory init",
    ]);
    printsNoSecret(s.out);
  });

  it("offers a new board first, then each of the organization's Projects", async () => {
    const s = setup({
      answers: FIRST,
      boards: [{ number: 7, title: "Engineering", columns: [] }],
    });
    await s.run();
    expect(s.selects[0]).toEqual({
      message: "Which board?",
      names: ["A new one, made with the factory's columns", "7  Engineering"],
      fallback: undefined,
    });
  });

  it("asks what pays for sessions in the cloud: a subscription first, or an API key", async () => {
    const s = setup({ answers: FIRST });
    await s.run();
    expect(s.selects[1]!.names).toEqual([
      "A Claude subscription (it runs claude setup-token for you)",
      "An API key",
    ]);
  });

  it("offers today's intervals for the poller, with 30 minutes first", async () => {
    const s = setup({ answers: FIRST });
    await s.run();
    expect(s.selects[2]).toEqual({
      message: "How often does the poller read the board?",
      names: [
        "Every 30 minutes, 1,440 runs a month",
        "Every 5 minutes, 8,640 runs a month",
        "Every 10 minutes, 4,320 runs a month",
        "Every 15 minutes, 2,880 runs a month",
        "Every 60 minutes, 720 runs a month",
      ],
      fallback: "30",
    });
  });

  it("changes nothing when she does not go ahead, which is what Enter answers", async () => {
    const s = setup({ answers: { ...FIRST, confirm: [false] } });
    expect(await s.run()).toBe(0);
    expect(s.confirms).toEqual([{ message: "Go ahead?", fallback: false }]);
    expect(s.out.at(-1)).toBe("Nothing changed.");
    expect(s.changes()).toEqual([]);
    expect(s.tickets.boards).toEqual([]);
    expect(s.opened).toEqual([]);
  });

  it("works in order: the board, factory-config, the app, the secrets, the rule", async () => {
    const s = setup({ answers: FIRST });
    await s.run();
    expect(s.changes()).toEqual([
      "createRepository factory-config private",
      "putFiles factory-config README.md factory-preset.yaml .github/workflows/factory-poller.yml",
      "registerApp Software Factory for acme",
      "setSecret FACTORY_APP_PRIVATE_KEY",
      "setVariable FACTORY_APP_CLIENT_ID Iv23client",
      "setSecret CLAUDE_CODE_OAUTH_TOKEN",
      "defineProperty software-factory on|off",
      "requireCheckWhere Software factory Review verdict software-factory=on runner",
    ]);
    // The board is made before the preset that names it is written.
    expect(s.tickets.boards.map((b) => b.title)).toEqual(["Software factory"]);
    expect(
      s.seed.repositories["factory-config"]!.files["factory-preset.yaml"],
    ).toContain("board: 1\n");
  });

  it("creates the board with the factory's columns and fields, and says only that it created it", async () => {
    const s = setup({ answers: FIRST });
    await s.run();
    expect(s.tickets.boards[0]!.columns.slice(0, 6)).toEqual([
      "Backlog",
      "In refinement",
      "Ready",
      // The new board's own spelling of a column it came with.
      "In Progress",
      "In review",
      "Done",
    ]);
    expect(s.tickets.boards[0]!.fields).toEqual(["Session", "Runs in", "Cost"]);
    expect(s.out.filter((l) => l.includes("board 1"))).toEqual([
      '✓ Created board 1, "Software factory".',
    ]);
  });

  it("gives an existing board the columns and fields it lacks, and asks nothing about its columns", async () => {
    const s = setup({
      answers: { ...FIRST, select: ["7", "CLAUDE_CODE_OAUTH_TOKEN", "30"] },
      boards: [
        {
          number: 7,
          title: "Engineering",
          columns: ["Backlog", "Doing", "Done"],
        },
      ],
    });
    expect(await s.run()).toBe(0);
    expect(s.out).toContain(
      "  board     Give board 7 any of the factory's columns and fields it lacks",
    );
    expect(s.out).toContain(
      "Added to board 7: In refinement, Ready, In progress, In review, Session, Runs in, Cost.",
    );
    expect(s.out.some((l) => l.includes("Created board"))).toBe(false);
    expect(s.selects.map((x) => x.message)).toEqual([
      "Which board?",
      "What pays for sessions in the cloud?",
      "How often does the poller read the board?",
    ]);
    expect(
      s.seed.repositories["factory-config"]!.files["factory-preset.yaml"],
    ).toContain("board: 7\n");
  });

  it("asks which ticket system once the factory has two, in place of the row", async () => {
    const s = setup({
      answers: {
        ...FIRST,
        select: ["github", "new", "CLAUDE_CODE_OAUTH_TOKEN", "30"],
      },
      tools: (base) => withFakeTickets(base, memoryTickets([]).tickets),
    });
    expect(await s.run()).toBe(0);
    expect(s.out.some((l) => l.startsWith("  Tickets"))).toBe(false);
    expect(s.selects[0]).toEqual({
      message: "Which ticket system?",
      names: ["GitHub Issues", "Fake Tickets"],
      fallback: undefined,
    });
  });
});

describe("factory init --org, what it creates in factory-config", () => {
  it("writes the preset the draft shows, with the board's number and the interval", async () => {
    const s = setup({
      answers: FIRST,
      boards: [{ number: 11, title: "Old", columns: [] }],
    });
    await s.run();
    const files = s.seed.repositories["factory-config"]!.files;
    expect(Object.keys(files)).toEqual([
      "README.md",
      "factory-preset.yaml",
      POLLER,
    ]);
    expect(files["factory-preset.yaml"]).toBe(PRESET);
  });

  it("writes the poller's workflow at the installed factory's version and the interval's cron", async () => {
    const s = setup({ answers: FIRST });
    await s.run();
    const text = s.seed.repositories["factory-config"]!.files[POLLER]!;
    expect(text).toBe(
      pollerWorkflow({ owner: "acme", version: "0.4.0", pollMinutes: 30 }),
    );
    expect(text).toContain('- cron: "*/30 * * * *" # the poller');
    expect(text).toContain("poller.yml@v0.4.0");
  });

  it("writes a README that says what the two files are", async () => {
    const s = setup({ answers: FIRST });
    await s.run();
    const readme = s.seed.repositories["factory-config"]!.files["README.md"]!;
    expect(readme).toContain("factory-preset.yaml");
    expect(readme).toContain(POLLER);
    expect(readme).toContain("acme");
  });

  it("leaves poll-minutes out of the preset at 5, which is the cron's */5", async () => {
    const s = setup({
      answers: { ...FIRST, select: ["new", "CLAUDE_CODE_OAUTH_TOKEN", "5"] },
    });
    await s.run();
    const files = s.seed.repositories["factory-config"]!.files;
    expect(files["factory-preset.yaml"]).toMatch(
      /builds:\n  trigger: github-action\n$/,
    );
    expect(files[POLLER]).toContain('- cron: "*/5 * * * *" # the poller');
  });

  it("leaves a file that is there as it is, and writes one that is missing", async () => {
    const mine = "# My own notes\n";
    const s = setup({
      answers: { confirm: [false, true] },
      org: {
        ...DONE,
        repositories: {
          "factory-config": {
            isPrivate: true,
            files: { "README.md": mine, "factory-preset.yaml": PRESET },
          },
        },
      },
    });
    expect(await s.run()).toBe(0);
    expect(s.out).toContain(
      "  preset    Write .github/workflows/factory-poller.yml in acme/factory-config",
    );
    expect(s.out).toContain(
      "✓ Wrote .github/workflows/factory-poller.yml in acme/factory-config.",
    );
    const files = s.seed.repositories["factory-config"]!.files;
    expect(files["README.md"]).toBe(mine);
    expect(files["factory-preset.yaml"]).toBe(PRESET);
    // The cron follows the interval the preset already holds.
    expect(files[POLLER]).toBe(CONFIG.files[POLLER]);
    expect(s.changes()).toEqual([
      "putFiles factory-config .github/workflows/factory-poller.yml",
    ]);
  });
});

describe("factory init --org, on GitHub Free", () => {
  const free = () =>
    setup({
      answers: { ...FIRST, select: ["new", "CLAUDE_CODE_OAUTH_TOKEN"] },
      org: { plan: FREE },
    });

  it("says what the plan leaves out, makes factory-config public, and leaves the rule to each repository", async () => {
    const s = free();
    expect(await s.run()).toBe(0);
    expect(s.out.slice(2, 9)).toEqual([
      "Found",
      "  Code host        GitHub (from the address)",
      "  You              an owner of acme",
      "  Plan             GitHub Free: acme's secrets reach only its public repositories, and it has no organization-wide rules",
      "  Tickets          GitHub Issues",
      "  Coding agent     Claude Code (on this machine)",
      "  Preset           none yet",
    ]);
    const plan = s.out.slice(
      s.out.indexOf("This is everything setup will do:") + 1,
    );
    expect(plan.slice(0, 5)).toEqual([
      '  app       Register the GitHub App "Software Factory for acme" and install it',
      "  secrets   Store FACTORY_APP_PRIVATE_KEY, CLAUDE_CODE_OAUTH_TOKEN, and the variable FACTORY_APP_CLIENT_ID for acme",
      "  preset    Create acme/factory-config, a public repository, with the organization's preset and the poller",
      "- rule      Each repository's own: once its setup merges, an admin of it runs factory init",
      "  board     Create a board with the factory's columns and fields",
    ]);
    expect(s.out.slice(-4)).toEqual([
      "✓ Stored 2 secrets and 1 variable for acme.",
      "- rule      Each repository's own: once its setup merges, an admin of it runs factory init",
      "",
      "A developer sets a repository up with: factory init",
    ]);
    expect(s.changes()).toContain("createRepository factory-config public");
    expect(s.changes().some((l) => /^(define|require)/.test(l))).toBe(false);
  });

  it("asks for no interval, and the poller reads every 5 minutes", async () => {
    const s = free();
    await s.run();
    expect(s.selects.map((x) => x.message)).toEqual([
      "Which board?",
      "What pays for sessions in the cloud?",
    ]);
    const files = s.seed.repositories["factory-config"]!.files;
    expect(files["factory-preset.yaml"]).not.toContain("poll-minutes");
    expect(files[POLLER]).toContain('- cron: "*/5 * * * *" # the poller');
  });
});

describe("factory init --org, registering the app", () => {
  it("stores the key and the client ID the moment it has them, before the browser goes on to install", async () => {
    const s = setup({ answers: FIRST });
    await s.run();
    const log = s.org().log;
    const sent = log.indexOf("sent the browser to install");
    expect(log.indexOf("setSecret FACTORY_APP_PRIVATE_KEY")).toBeLessThan(sent);
    expect(
      log.indexOf("setVariable FACTORY_APP_CLIENT_ID Iv23client"),
    ).toBeLessThan(sent);
    expect(log.indexOf("setSecret FACTORY_APP_PRIVATE_KEY")).toBeGreaterThan(
      log.indexOf("registerApp Software Factory for acme"),
    );
    expect(s.org().values.get("FACTORY_APP_PRIVATE_KEY")).toBe(KEY);
    printsNoSecret(s.transcript);
  });

  it("opens its own page, then says what to press and where to paste", async () => {
    const s = setup({ answers: FIRST });
    await s.run();
    expect(s.opened).toEqual(["http://127.0.0.1:4100/"]);
    expect(s.out.indexOf("✓ Created acme/factory-config.") + 1).toBe(
      s.out.indexOf(
        'Opened GitHub in your browser. Press "Create GitHub App", then "Install".',
      ),
    );
  });

  it("takes a pasted address when her browser cannot reach her machine, and asks again for one that is not this run's", async () => {
    const s = setup({
      answers: {
        ...FIRST,
        typed: [
          "http://127.0.0.1:4100/registered?code=c&state=wrong",
          "http://127.0.0.1:4100/registered?code=c&state=right",
        ],
      },
      org: { returns: "pasted" },
    });
    expect(await s.run()).toBe(0);
    const from = s.transcript.indexOf(
      'Opened GitHub in your browser. Press "Create GitHub App", then "Install".',
    );
    expect(s.transcript.slice(from, from + 6)).toEqual([
      'Opened GitHub in your browser. Press "Create GitHub App", then "Install".',
      "If the page it sends you to does not load, paste that page's address here:",
      "(reads a line)",
      "That address is not from this run. Paste the address of the page that did not load:",
      "(reads a line)",
      "✓ Registered the app and installed it on 212 repositories.",
    ]);
  });

  it("says how to free the name when an app of that name is already registered", async () => {
    const s = setup({ answers: FIRST, org: { taken: true } });
    await s.run();
    const at = s.out.indexOf(
      'An app named "Software Factory for acme" is already registered. Delete it under acme\'s Settings, Developer settings, or type another name in the form.',
    );
    expect(at).toBeGreaterThan(-1);
    expect(at + 1).toBe(
      s.out.indexOf(
        'Opened GitHub in your browser. Press "Create GitHub App", then "Install".',
      ),
    );
  });

  it("shortens the organization in a name over the code host's limit, and says so in the plan", async () => {
    const s = setup({
      address: "https://github.com/a-very-long-organization-name",
      answers: FIRST,
    });
    await s.run();
    expect(s.out).toContain(
      '  app       Register the GitHub App "Software Factory for a-very-long-o", its name cut to the 34 characters GitHub allows, and install it',
    );
    expect(s.changes("a-very-long-organization-name")).toContain(
      "registerApp Software Factory for a-very-long-o",
    );
  });

  it("counts one repository as one", async () => {
    const s = setup({
      answers: FIRST,
      org: { on: { count: 1, covered: true } },
    });
    await s.run();
    expect(s.out).toContain(
      "✓ Registered the app and installed it on 1 repository.",
    );
  });

  it("fails when no installation shows in 10 minutes, with the key already stored", async () => {
    const s = setup({ answers: FIRST, org: { installs: null } });
    expect(await s.run()).toBe(1);
    expect(s.out.slice(-2)).toEqual([
      "✗ Could not see the app installed after 10 minutes.",
      RERUN,
    ]);
    expect(s.seed.secrets).toContain("FACTORY_APP_PRIVATE_KEY");
    expect(s.seed.variables.FACTORY_APP_CLIENT_ID).toBe("Iv23client");
  });

  it("fails when the install leaves factory-config out, with the page that adds it", async () => {
    const s = setup({
      answers: FIRST,
      org: {
        installs: { ...INSTALLED, all: false },
        on: { count: 3, covered: false },
      },
    });
    expect(await s.run()).toBe(1);
    expect(s.out.slice(-2)).toEqual([
      "✗ The app is not installed on acme/factory-config, which every repository's runs read. Add it: https://github.com/organizations/acme/settings/installations/52811",
      RERUN,
    ]);
    expect(s.out.some((l) => l.startsWith("✓ Registered"))).toBe(false);
  });
});

describe("factory init --org, the coding agent's credential", () => {
  it("stores an API key as ANTHROPIC_API_KEY, and runs no command for it", async () => {
    const s = setup({
      answers: {
        ...FIRST,
        select: ["new", "ANTHROPIC_API_KEY", "30"],
        secret: [API_KEY],
      },
    });
    expect(await s.run()).toBe(0);
    expect(s.out).toContain(
      "  secrets   Store FACTORY_APP_PRIVATE_KEY, ANTHROPIC_API_KEY, and the variable FACTORY_APP_CLIENT_ID for acme",
    );
    expect(s.transcript).toContain(
      "? secret: Paste the API key (leave empty to do this later):",
    );
    expect(s.org().values.get("ANTHROPIC_API_KEY")).toBe(API_KEY);
    expect(s.seed.secrets).not.toContain("CLAUDE_CODE_OAUTH_TOKEN");
    expect(s.ran).toEqual([]);
    expect(s.out).toContain("✓ Stored 2 secrets and 1 variable for acme.");
    printsNoSecret(s.out);
  });

  it("runs the agent's command for a subscription, and joins a token the terminal wrapped", async () => {
    const s = setup({
      answers: {
        ...FIRST,
        secret: [`${TOKEN.slice(0, 8)}\n ${TOKEN.slice(8)}`],
      },
    });
    await s.run();
    expect(s.ran).toEqual([["claude", "setup-token"]]);
    expect(s.org().values.get("CLAUDE_CODE_OAUTH_TOKEN")).toBe(TOKEN);
  });

  it("names factory init --org as the command to run again when the token is left empty, and counts what it stored", async () => {
    const s = setup({ answers: { ...FIRST, secret: [""] } });
    expect(await s.run()).toBe(0);
    expect(s.out).toContain(
      "No CLAUDE_CODE_OAUTH_TOKEN stored. Run factory init --org https://github.com/acme again to add it.",
    );
    expect(s.out).toContain("✓ Stored 1 secret and 1 variable for acme.");
    expect(s.seed.secrets).toEqual(["FACTORY_APP_PRIVATE_KEY"]);
  });
});

describe("factory init --org, with a coding agent that needs no secret", () => {
  it("asks for none, and stores only the app's key and client ID", async () => {
    const s = setup({
      answers: { select: ["new", "30"], confirm: [true] },
      tools: (base) => withFakeAgent(base),
    });
    expect(await s.run()).toBe(0);
    expect(s.out.some((l) => l.startsWith("  Coding agent"))).toBe(false);
    expect(s.out).toContain(
      "  secrets   Store FACTORY_APP_PRIVATE_KEY and the variable FACTORY_APP_CLIENT_ID for acme",
    );
    expect(s.out).toContain("✓ Stored 1 secret and 1 variable for acme.");
    expect(s.transcript.some((l) => l.startsWith("? secret"))).toBe(false);
  });
});

describe("factory init --org, when the code host stops answering", () => {
  it("stops before any question when it cannot read what is there", async () => {
    const s = setup({ org: { fail: { plan: new Error("HTTP 502") } } });
    expect(await s.run()).toBe(1);
    expect(s.transcript).toEqual([
      "Setting up the software factory for the organization acme",
      "",
      "Could not reach the code host: HTTP 502",
    ]);
  });
});

describe("the line read for a pasted address", () => {
  it("is the first line typed", async () => {
    const input = new PassThrough();
    const line = readLineFrom(input)(new AbortController().signal);
    input.write("http://127.0.0.1:4100/registered?code=c\nmore\n");
    expect(await line).toBe("http://127.0.0.1:4100/registered?code=c");
  });

  it("stops waiting when it is told to", async () => {
    const stop = new AbortController();
    const line = readLineFrom(new PassThrough())(stop.signal);
    stop.abort();
    await expect(line).rejects.toThrow("stopped");
  });

  it("keeps waiting when the input ends with nothing typed", async () => {
    const input = new PassThrough();
    const stop = new AbortController();
    let settled = false;
    const line = readLineFrom(input)(stop.signal).finally(() => {
      settled = true;
    });
    input.end();
    await new Promise((done) => setImmediate(done));
    expect(settled).toBe(false);
    stop.abort();
    await expect(line).rejects.toThrow("stopped");
  });
});

describe("factory init --org, the rule", () => {
  it("prints the rule line and carries on when GitHub refuses the rule", async () => {
    const s = setup({
      answers: FIRST,
      org: {
        fail: { requireCheckWhere: new Error("HTTP 403: Upgrade to Team") },
      },
    });
    expect(await s.run()).toBe(0);
    expect(s.out.slice(-3)).toEqual([
      "- rule      Each repository's own: once its setup merges, an admin of it runs factory init",
      "",
      "A developer sets a repository up with: factory init",
    ]);
  });
});

describe("factory init --org, run again", () => {
  it("prints what it found, offers to replace the Claude token, and has nothing to do", async () => {
    const s = setup({ org: DONE, answers: { confirm: [false] } });
    expect(await s.run()).toBe(0);
    expect(s.transcript).toEqual([
      "Setting up the software factory for the organization acme",
      "",
      "Found",
      "  Code host        GitHub (from the address)",
      "  You              an owner of acme",
      "  App              Software Factory for acme, installed on all repositories",
      "  Secrets          FACTORY_APP_PRIVATE_KEY and CLAUDE_CODE_OAUTH_TOKEN, stored",
      "  Preset           acme/factory-config",
      '  Rule             "Review verdict" is required where software-factory is "on"',
      "",
      "? confirm: Replace CLAUDE_CODE_OAUTH_TOKEN?",
      "✓ acme is set up. Nothing to do.",
    ]);
    expect(s.confirms[0]!.fallback).toBe(false);
    expect(s.changes()).toEqual([]);
  });

  it("says an install on some repositories is on the repositories she chose", async () => {
    const s = setup({
      org: { ...DONE, installation: { ...INSTALLED, all: false } },
      answers: { confirm: [false] },
    });
    await s.run();
    expect(s.out).toContain(
      "  App              Software Factory for acme, installed on the repositories you chose",
    );
  });

  it("replaces the Claude token when asked to, and does nothing else", async () => {
    const s = setup({
      org: DONE,
      answers: { confirm: [true, true], secret: [TOKEN] },
    });
    expect(await s.run()).toBe(0);
    const from = s.transcript.indexOf(
      "? confirm: Replace CLAUDE_CODE_OAUTH_TOKEN?",
    );
    expect(s.transcript.slice(from + 1)).toEqual([
      "",
      "This is everything setup will do:",
      "  secrets   Store CLAUDE_CODE_OAUTH_TOKEN for acme",
      "? confirm: Go ahead?",
      "",
      "",
      "The coding agent's token: running claude setup-token...",
      "? secret: Paste the token it printed (leave empty to do this later):",
      "✓ Stored 1 secret for acme.",
      "",
      "A developer sets a repository up with: factory init",
    ]);
    expect(s.changes()).toEqual(["setSecret CLAUDE_CODE_OAUTH_TOKEN"]);
  });

  it("does only what is missing: here the rule", async () => {
    const s = setup({
      org: { ...DONE, rules: [] },
      answers: { confirm: [false, true] },
    });
    expect(await s.run()).toBe(0);
    const plan = s.out.slice(
      s.out.indexOf("This is everything setup will do:") + 1,
    );
    expect(plan).toEqual([
      '  rule      Require "Review verdict" on repositories set up with the factory',
      "",
      '✓ Required "Review verdict" where the property software-factory is "on".',
      "",
      "A developer sets a repository up with: factory init",
    ]);
    expect(s.changes()).toEqual([
      "defineProperty software-factory on|off",
      "requireCheckWhere Software factory Review verdict software-factory=on runner",
    ]);
  });

  it("sends her to the organization's apps when the app is registered and not installed, and waits", async () => {
    const s = setup({
      org: { ...DONE, installation: null },
      answers: { confirm: [false, true] },
    });
    expect(await s.run()).toBe(0);
    expect(s.out).toContain(
      "  App              registered, and not installed yet",
    );
    expect(s.out).toContain(
      "  app       Install the GitHub App, which is registered",
    );
    const from = s.out.indexOf(
      'The app is registered and not installed yet. Opened acme\'s apps in your browser: press its name, then "Install App".',
    );
    expect(from).toBeGreaterThan(-1);
    expect(s.out[from + 1]).toBe("✓ Installed the app.");
    expect(s.opened).toEqual([
      "https://github.com/organizations/acme/settings/apps",
    ]);
    expect(s.org().log).toContain("awaitInstallation Iv23client");
    // No app is registered a second time, and no key is asked of GitHub.
    expect(s.changes()).toEqual([]);
    expect(s.org().log.some((l) => l.startsWith("installedOn"))).toBe(false);
  });

  it("fails when that installation never shows", async () => {
    const s = setup({
      org: { ...DONE, installation: null, installs: null },
      answers: { confirm: [false, true] },
    });
    expect(await s.run()).toBe(1);
    expect(s.out.slice(-2)).toEqual([
      "✗ Could not see the app installed after 10 minutes.",
      RERUN,
    ]);
  });
});

describe("factory init --org, a step that fails", () => {
  it("says what it could not do, with the code host's reason, and how to carry on", async () => {
    const s = setup({
      answers: FIRST,
      org: {
        fail: {
          createRepository: new Error("HTTP 403: Repository creation failed"),
        },
      },
    });
    expect(await s.run()).toBe(1);
    expect(s.out.slice(-2)).toEqual([
      "✗ Could not create acme/factory-config: HTTP 403: Repository creation failed",
      RERUN,
    ]);
    expect(s.tickets.boards).toEqual([]);
  });

  it("fails when the board cannot be created", async () => {
    const s = setup({
      answers: FIRST,
      createRefused: "Projects are disabled for acme",
    });
    expect(await s.run()).toBe(1);
    expect(s.out.slice(-2)).toEqual([
      "✗ Could not create a board: Projects are disabled for acme",
      RERUN,
    ]);
    expect(s.changes()).toEqual(["createRepository factory-config private"]);
  });

  it("fails when the app's key cannot be stored, and prints no key", async () => {
    const s = setup({
      answers: FIRST,
      org: { fail: { setSecret: new Error("HTTP 403") } },
    });
    expect(await s.run()).toBe(1);
    expect(s.out.slice(-2)).toEqual([
      "✗ Could not store FACTORY_APP_PRIVATE_KEY: HTTP 403",
      RERUN,
    ]);
    printsNoSecret(s.out);
  });

  it("fails when the app cannot be registered", async () => {
    const s = setup({
      answers: FIRST,
      org: { fail: { registerApp: new Error("GitHub refused the code") } },
    });
    expect(await s.run()).toBe(1);
    expect(s.out.slice(-2)).toEqual([
      "✗ Could not register the app: GitHub refused the code",
      RERUN,
    ]);
  });

  it("carries on from a run that stopped after factory-config was created", async () => {
    const s = setup({
      answers: FIRST,
      org: {
        repositories: { "factory-config": { isPrivate: true, files: {} } },
      },
    });
    expect(await s.run()).toBe(0);
    expect(s.out).toContain("  Preset           acme/factory-config");
    expect(s.out).toContain(
      "  preset    Write README.md, factory-preset.yaml, and .github/workflows/factory-poller.yml in acme/factory-config",
    );
    expect(s.changes()[0]).toBe(
      "putFiles factory-config README.md factory-preset.yaml .github/workflows/factory-poller.yml",
    );
  });
});
