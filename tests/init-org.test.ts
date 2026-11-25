// `factory init --org ADDRESS`: what it refuses, what it finds and asks,
// the plan it shows, and what it does once told to go ahead, run against an
// in-memory organization and ticket system with scripted answers. No test
// reaches GitHub, opens a browser, or listens on a port.
import { afterEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import type { Answer } from "../src/agent/types.mts";
import { ADD, NONE } from "../src/columns-suggest.mts";
import type {
  Installation,
  NewApp,
  Organization,
  OrganizationHost,
  OrganizationPlan,
} from "../src/code-host/types.mts";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { main, readLineFrom, type InitOrgDeps } from "../src/init-org.mts";
import { onPath, pageOpener } from "../src/init-shared.mts";
import { defaultInWords, type Ask } from "../src/lib/prompts.mts";
import type { Tickets } from "../src/tickets/types.mts";
import type { Registry } from "../src/tools.mts";
import { pollerWorkflow } from "../src/workflow-files.mts";
import {
  scriptedAgent,
  tryingSpawn,
  withFakeAgent,
  withFakeTickets,
  type Try,
} from "./fake-tools";
import { memoryCodeHost } from "./memory-code-host";
import { memoryRunner } from "./memory-runner";
import { memoryTickets } from "./memory-tickets";
import { memoryTools } from "./memory-tools";
import { into } from "./printed";

/** While `on`, starting any command and asking for the repository's root
 * both throw, and each attempt is recorded. */
const forbidden = vi.hoisted(() => ({ on: false, tried: [] as string[] }));
vi.mock("node:child_process", async (original) => {
  const real = await original<typeof import("node:child_process")>();
  const guarded = (name: keyof typeof real) =>
    ((...args: unknown[]) => {
      if (forbidden.on) {
        forbidden.tried.push(`${name} ${String(args[0])}`);
        throw new Error(`started a command: ${String(args[0])}`);
      }
      return (real[name] as (...a: unknown[]) => unknown)(...args);
    }) as never;
  return {
    ...real,
    exec: guarded("exec"),
    execSync: guarded("execSync"),
    execFile: guarded("execFile"),
    execFileSync: guarded("execFileSync"),
    spawn: guarded("spawn"),
    spawnSync: guarded("spawnSync"),
  };
});
vi.mock("../src/config.mts", async (original) => {
  const real = await original<typeof import("../src/config.mts")>();
  return {
    ...real,
    repoRoot: (...args: Parameters<typeof real.repoRoot>) => {
      if (forbidden.on) {
        forbidden.tried.push("repoRoot");
        throw new Error("asked for the repository's root");
      }
      return real.repoRoot(...args);
    },
  };
});

const LAUNCHER = join(
  dirname(dirname(fileURLToPath(import.meta.url))),
  "bin/factory.js",
);
const ADDRESS = "https://github.com/acme";
const KEY =
  "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----";
const TOKEN = "sk-ant-oat01-token";
const API_KEY = "sk-ant-api03-key";
/** Every value a test pastes or is handed, none of which may be printed. */
const VALUES = [KEY, "MIIEowIBAAKCAQEA", TOKEN, API_KEY];

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
const INSTALL_PAGE =
  "https://github.com/apps/software-factory-for-acme/installations/new/permissions?suggested_target_id=4242";
/** Step 1 of registering the app, down to where it waits for the code. */
const STEP_1 = [
  "",
  'Registering the GitHub App "Software Factory for acme". Two steps, both in your browser.',
  "",
  "1. Create the app. Your browser should open this address. If it does not, open it yourself:",
  "     http://127.0.0.1:4100/",
  '   Then press "Create GitHub App".',
  "   Waiting for GitHub to send your browser back. If that page does not load, paste its address here:",
];
const CREATED = "✓ Created the app, and stored its key for acme.";
/** Step 2's lines after its first, down to where it waits. */
const INSTALLING = [
  `     ${INSTALL_PAGE}`,
  '   Choose all repositories, or a selection that includes factory-config, and press "Install".',
  "   Waiting up to 10 minutes for the installation to show.",
  "(waits for the installation)",
];
const STEP_2 = [
  "",
  "2. Install it. Your browser should open this address. If it does not, open it yourself:",
  ...INSTALLING,
];
/** Where the preset is edited, and where the docs give the steps. */
const ADDRESSES = [
  "The settings every repository shares are yours to edit:",
  "     https://github.com/acme/factory-config/blob/HEAD/factory-preset.yaml",
  "The steps in full:",
  "     https://github.com/davidbyoung/software-factory/blob/v0.4.0/docs/github/setup.md#in-an-organization",
];
/** How a run that did something ends. `because` is why a third step is
 * left to each repository's admin, where no organization's rule was made. */
const ending = (because?: string) => [
  "✓ acme is set up.",
  "",
  "Next, in each repository you want the factory in:",
  "  1. A developer installs the factory once on their machine:",
  "       npm install -g @davidbyoung/software-factory",
  "  2. In the repository's checkout, they run:",
  "       factory init",
  "     It asks them for no token, and opens the pull request that sets the repository up.",
  ...(because
    ? [
        "  3. Once that pull request merges, an admin of the repository runs factory init there",
        `     again, to require "Review verdict". ${because}`,
      ]
    : []),
  "",
  ...ADDRESSES,
];
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
code-host:
  type: github
  branch-name: "{ticket}"
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
  /** The organization's app as the code host finds it with no
   * installation, or null when it cannot. */
  registered: { name: string; slug: string; installPage: string } | null;
  /** How the code comes back: by the browser, or by an address she
   * pastes. */
  returns: "browser" | "pasted";
  /** What each operation fails with. */
  fail: Partial<Record<keyof Organization, Error>>;
};

/** An organization kept in memory, which records every call in order. */
function memoryOrganization(
  seed: Seed,
  name: string,
  log: string[],
  waits: () => void,
) {
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
      // A pasted address came from no browser this can send on.
      if (seed.returns === "pasted") o.open(INSTALL_PAGE);
      log.push("sent the browser to install");
      return {
        id: app.id,
        slug: app.slug,
        clientId: app.clientId,
        installPage: INSTALL_PAGE,
      };
    },
    async registeredApp(clientId) {
      called("registeredApp", clientId);
      return seed.registered;
    },
    async installation(clientId) {
      called("installation", clientId);
      return seed.installation;
    },
    async awaitInstallation(clientId) {
      called("awaitInstallation", clientId);
      waits();
      return seed.installs;
    },
    async installedOn(id, app, repo) {
      called("installedOn", id, app.clientId, repo);
      if (app.key !== KEY) throw new Error("not the app's key");
      return seed.on;
    },
    appsPage: () => `https://github.com/organizations/${name}/settings/apps`,
    filePage: (repo, path) =>
      `https://github.com/${name}/${repo}/blob/HEAD/${path}`,
  };
  return { organization, log, values, pastes };
}

type Answers = {
  select?: string[];
  confirm?: boolean[];
  secret?: string[];
  /** Each answer typed to a question, then Enter. */
  input?: string[];
  /** Each line typed where the command reads an address. */
  typed?: string[];
};

type Setup = {
  address?: string;
  argv?: string[];
  answers?: Answers;
  org?: Partial<Seed>;
  boards?: {
    number: number;
    title: string;
    columns: string[];
    fields?: string[];
  }[];
  createRefused?: string;
  /** The coding agent's answers, in turn. */
  agent?: Answer[];
  /** What reading a board's columns fails with. */
  columnsFail?: Error;
  agentInstalled?: boolean;
  /** The installed factory's version; a release unless given. */
  version?: string;
  /** How each try of a pasted credential ends; taken unless given. */
  tries?: Try[];
  /** How long a try may take, in milliseconds. */
  tryMs?: number;
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
    registered: null,
    returns: "browser",
    fail: {},
    ...o.org,
  };
  /** Every line printed and every question asked, in the order they came. */
  const transcript: string[] = [];
  const out: string[] = [];
  /** Every line printed, in color. */
  const looks: string[] = [];
  const opened: string[] = [];
  const ran: string[][] = [];
  const selects: { message: string; names: string[]; fallback?: string }[] = [];
  const confirms: { message: string; fallback: boolean }[] = [];
  const inputs: { message: string; fallback: string }[] = [];
  const queue = {
    select: [...(o.answers?.select ?? [])],
    confirm: [...(o.answers?.confirm ?? [])],
    secret: [...(o.answers?.secret ?? [])],
    input: [...(o.answers?.input ?? [])],
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
    input: async (message, fallback) => {
      inputs.push({ message, fallback });
      transcript.push(`? input: ${message}`);
      return queue.input.shift() ?? fallback;
    },
  };
  const tickets = memoryTickets([], {
    boards: o.boards ?? [],
    createRefused: o.createRefused,
  });
  /** Every call to the organization and every write to a board, in the
   * order they came. */
  const log: string[] = [];
  const board = tickets.tickets.board!;
  const recorded: Tickets = {
    ...tickets.tickets,
    board: {
      ...board,
      columns: async (number) => {
        if (o.columnsFail) throw o.columnsFail;
        return board.columns(number);
      },
      create: async (title) => {
        const number = await board.create!(title);
        log.push(`createBoard ${title}`);
        return number;
      },
      addColumns: async (number, columns) => {
        log.push(`addColumns ${number}`);
        return board.addColumns!(number, columns);
      },
      addFields: async (number, fields) => {
        log.push(`addFields ${number}`);
        return board.addFields!(number, fields);
      },
    },
  };
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
        organizations.set(
          name,
          memoryOrganization(seed, name, log, () =>
            transcript.push("(waits for the installation)"),
          ),
        );
      return organizations.get(name)!.organization;
    },
  };
  const trying = tryingSpawn(o.tries);
  const tools = (o.tools ?? ((b) => b))(
    memoryTools({
      spawn: trying.spawn,
      tryMs: o.tryMs,
      codeHost: memoryCodeHost([], { owner: "acme" }).codeHost,
      runner: memoryRunner().runner,
      tickets: recorded,
      agent: scriptedAgent([...(o.agent ?? [])], {
        installed: o.agentInstalled ?? true,
      }),
    }),
  );
  const d: InitOrgDeps = {
    ask,
    out: (line) => {
      into(out, looks)(line);
      transcript.push(out.at(-1)!);
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
    packageName: "@davidbyoung/software-factory",
    packageVersion: o.version ?? "0.4.0",
  };
  return {
    run: () => main(o.argv ?? ["--org", o.address ?? ADDRESS], d),
    seed,
    out,
    looks,
    transcript,
    opened,
    ran,
    /** The environment each try of a pasted credential ran with. */
    tried: trying.envs,
    selects,
    confirms,
    inputs,
    queue,
    tickets,
    /** The in-memory organization, once the command has asked for it. */
    org: (name = "acme") => organizations.get(name)!,
    /** The operations that changed the organization or a board. */
    changes: () =>
      log.filter((l) =>
        /^(createRepository|putFiles|set|define|require|registerApp|createBoard|add)/.test(
          l,
        ),
      ),
  };
}

/** No pasted or handed value reaches anything printed. */
function printsNoSecret(out: string[]) {
  const text = out.join("\n");
  for (const v of VALUES) expect(text).not.toContain(v);
}

/** What is printed before the branch question, and the question. */
const BRANCH_LINES = [
  "Every repository that follows the preset names its branches this way, unless its own settings say otherwise.",
  "{user} is the developer's account in a build on their machine, and the app's name in a build in the cloud.",
];
const BRANCH_QUESTION =
  "How should a build name its branch? Use {ticket}, and {user} for the GitHub account:";

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
  variables: {
    FACTORY_APP_CLIENT_ID: "Iv23client",
  },
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

  it("stops when the coding agent is not installed, and names its own command to run again", async () => {
    expect(await refusal({ agentInstalled: false })).toEqual([
      "The factory runs in a coding agent, and Claude Code is not installed.",
      "Install it and run factory init --org https://github.com/acme again.",
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

describe("factory init --org, outside any repository", () => {
  const home = process.cwd();
  const folders: string[] = [];
  /** A new folder that is no git repository, as the working directory. */
  const elsewhere = () => {
    const folder = mkdtempSync(join(tmpdir(), "init-org-"));
    folders.push(folder);
    process.chdir(folder);
    return folder;
  };
  const terminal = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
  afterEach(() => {
    vi.restoreAllMocks();
    if (terminal) Object.defineProperty(process.stdin, "isTTY", terminal);
    else delete (process.stdin as { isTTY?: boolean }).isTTY;
    forbidden.on = false;
    forbidden.tried.length = 0;
    process.chdir(home);
    for (const folder of folders.splice(0))
      rmSync(folder, { recursive: true, force: true });
  });

  it("sets an organization up from a folder that is no repository, and reads no git remote or repository root", async () => {
    elsewhere();
    const s = setup({ answers: FIRST });
    forbidden.on = true;
    const status = await s.run();
    forbidden.on = false;
    expect(forbidden.tried).toEqual([]);
    expect(status).toBe(0);
    expect(s.out).toContain("✓ acme is set up.");
  });

  it("starts from factory init with no repository to find, in a terminal", async () => {
    elsewhere();
    const printed: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line) => {
      printed.push(String(line));
    });
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      configurable: true,
    });
    const { run } = await import("../src/init.mts");
    forbidden.on = true;
    // A word is refused before anything asks the code host.
    const status = await run(["--org", "acme"]);
    forbidden.on = false;
    expect(status).toBe(1);
    expect(printed).toEqual([
      "✗ Which code host is acme on? Give its address, such as https://github.com/acme.",
      "Nothing changed.",
    ]);
    expect(forbidden.tried).toEqual([]);
  });

  it("says it needs a terminal when there is none, as factory init does, before it reads the address", () => {
    const cwd = elsewhere();
    const r = spawnSync("node", [LAUNCHER, "init", "--org", "acme"], {
      cwd,
      encoding: "utf8",
      input: "",
    });
    expect(r.status).toBe(1);
    expect(r.stdout).toBe(
      "factory init asks its questions in a terminal: run it in one.\n",
    );
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
    expect(s.out).toContain("✓ acme is set up. Nothing to do.");
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
      ...BRANCH_LINES,
      `? input: ${BRANCH_QUESTION}`,
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
      ...STEP_1,
      CREATED,
      ...STEP_2,
      "✓ Installed the app on 212 repositories.",
      "",
      "The coding agent's token: running claude setup-token...",
      "? secret: Paste the token it printed, the line that starts sk-ant-oat01- (leave empty to do this later):",
      "Trying the token...",
      "✓ Stored 2 secrets and 1 variable for acme.",
      '✓ Required "Review verdict" where the property software-factory is "on".',
      "",
      ...ending(),
    ]);
    printsNoSecret(s.out);
  });

  it("has bold labels, dim notes, cyan to copy, and yellow on what the person does, from the first line to the last", async () => {
    const s = setup({
      answers: FIRST,
      boards: [
        { number: 7, title: "Engineering", columns: [] },
        { number: 11, title: "Old", columns: [] },
      ],
    });
    expect(await s.run()).toBe(0);
    expect(s.looks).toEqual([
      "Setting up the software factory for the organization {name:acme}",
      "",
      "{heading:Found}",
      "  {name:Code host}        GitHub (from the address)",
      "  {name:You}              an owner of acme",
      "  {name:Tickets}          GitHub Issues",
      "  {name:Coding agent}     Claude Code (on this machine)",
      "  {name:Preset}           {skip:none yet}",
      "",
      ...BRANCH_LINES,
      "Each run of the poller bills at least one Actions minute in a private repository.",
      "",
      "{heading:This is everything setup will do:}",
      '  {name:app}       Register the GitHub App "Software Factory for acme" and install it',
      "  {name:secrets}   Store FACTORY_APP_PRIVATE_KEY, CLAUDE_CODE_OAUTH_TOKEN, and the variable FACTORY_APP_CLIENT_ID for acme",
      "  {name:preset}    Create acme/factory-config, a private repository, with the organization's preset and the poller",
      '  {name:rule}      Require "Review verdict" on repositories set up with the factory',
      "  {name:board}     Create a board with the factory's columns and fields",
      "",
      '{good:✓} Created board 12, "Software factory".',
      "{good:✓} Created acme/factory-config.",
      "",
      '{yourTurn:Registering the GitHub App "Software Factory for acme". Two steps, both in your browser.}',
      "",
      "{yourTurn:1.} Create the app. Your browser should open this address. If it does not, open it yourself:",
      "     {copy:http://127.0.0.1:4100/}",
      '   Then press "Create GitHub App".',
      "   Waiting for GitHub to send your browser back. If that page does not load, paste its address here:",
      "{good:✓} Created the app, and stored its key for acme.",
      "",
      "{yourTurn:2.} Install it. Your browser should open this address. If it does not, open it yourself:",
      `     {copy:${INSTALL_PAGE}}`,
      '   Choose all repositories, or a selection that includes factory-config, and press "Install".',
      "   Waiting up to 10 minutes for the installation to show.",
      "{good:✓} Installed the app on 212 repositories.",
      "",
      "The coding agent's token: running {copy:claude setup-token}...",
      "{skip:Trying the token...}",
      "{good:✓} Stored 2 secrets and 1 variable for acme.",
      '{good:✓} Required "Review verdict" where the property software-factory is "on".',
      "",
      "{good:✓} acme is set up.",
      "",
      "{yourTurn:Next, in each repository you want the factory in:}",
      "  {yourTurn:1.} A developer installs the factory once on their machine:",
      "       {copy:npm install -g @davidbyoung/software-factory}",
      "  {yourTurn:2.} In the repository's checkout, they run:",
      "       {copy:factory init}",
      "     It asks them for no token, and opens the pull request that sets the repository up.",
      "",
      "The settings every repository shares are yours to edit:",
      "     {copy:https://github.com/acme/factory-config/blob/HEAD/factory-preset.yaml}",
      "The steps in full:",
      "     {copy:https://github.com/davidbyoung/software-factory/blob/v0.4.0/docs/github/setup.md#in-an-organization}",
    ]);
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

  it("works in order: the empty repository, the board, the repository's files, the app, the secrets, the rule", async () => {
    const s = setup({ answers: FIRST });
    await s.run();
    expect(s.changes()).toEqual([
      "createRepository factory-config private",
      "createBoard Software factory",
      "addColumns 1",
      "addFields 1",
      "putFiles factory-config README.md factory-preset.yaml .github/workflows/factory-poller.yml",
      "registerApp Software Factory for acme",
      "setSecret FACTORY_APP_PRIVATE_KEY",
      "setVariable FACTORY_APP_CLIENT_ID Iv23client",
      "setSecret CLAUDE_CODE_OAUTH_TOKEN",
      "defineProperty software-factory on|off",
      "requireCheckWhere Software factory Review verdict software-factory=on runner",
    ]);
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

describe("factory init --org, with a board the organization already has", () => {
  const FIELDS = ["Session", "Runs in", "Cost"];
  const SIX = [
    "Backlog",
    "In refinement",
    "Ready",
    "In progress",
    "In review",
    "Done",
  ];
  /** A run that picks board 7, with the coding agent's answers scripted. */
  const existing = (
    board: { columns: string[]; fields?: string[] },
    agent: Answer[] = [],
    select: string[] = ["yes"],
  ) =>
    setup({
      answers: {
        ...FIRST,
        select: ["7", ...select, "CLAUDE_CODE_OAUTH_TOKEN", "30"],
      },
      boards: [{ number: 7, title: "Engineering", ...board }],
      agent,
    });
  const preset = (s: ReturnType<typeof setup>) =>
    s.seed.repositories["factory-config"]!.files["factory-preset.yaml"]!;

  it("has the coding agent suggest which of the board's own columns shows each state, names them in the preset, and adds only what is missing", async () => {
    const s = existing({ columns: ["Todo", "Doing", "Code review", "Done"] }, [
      {
        answer: {
          backlog: "Todo",
          refining: ADD,
          ready: ADD,
          building: "Doing",
          review: "Code review",
          done: "Done",
        },
      },
    ]);
    expect(await s.run()).toBe(0);
    const from = s.transcript.indexOf("? select: Which board?");
    expect(
      s.transcript.slice(
        from,
        s.transcript.indexOf("? select: What pays for sessions in the cloud?"),
      ),
    ).toEqual([
      "? select: Which board?",
      "",
      "Board 7 has the columns Todo, Doing, Code review, and Done.",
      "Asking Claude Code which of them shows each of the factory's six states...",
      "",
      "  State      Column",
      "  backlog    Todo",
      "  refining   In refinement, which init adds",
      "  ready      Ready, which init adds",
      "  building   Doing",
      "  review     Code review",
      "  done       Done",
      "",
      "? select: Use these columns?",
      ...BRANCH_LINES,
      `? input: ${BRANCH_QUESTION}`,
    ]);
    expect(s.out).toContain(
      "  board     Add In refinement, Ready, Session, Runs in, and Cost to board 7",
    );
    const went = s.transcript.indexOf("? confirm: Go ahead?");
    expect(s.transcript.slice(went + 1, went + 5)).toEqual([
      "",
      "Added to board 7: In refinement, Ready, Session, Runs in, Cost.",
      "✓ Created acme/factory-config.",
      "",
    ]);
    expect(preset(s)).toContain(
      [
        "  board: 7",
        "  columns:",
        "    backlog: Todo",
        "    refining: In refinement",
        "    ready: Ready",
        "    building: Doing",
        "    review: Code review",
        "    done: Done",
        "",
      ].join("\n"),
    );
    // Her own columns stay, and none of the factory's is put beside them.
    expect(s.tickets.boards[0]!.columns).toEqual([
      "Todo",
      "In refinement",
      "Ready",
      "Doing",
      "Code review",
      "Done",
    ]);
    expect(s.tickets.boards[0]!.fields).toEqual(FIELDS);
    expect(s.out.some((l) => l.includes("Created board"))).toBe(false);
  });

  it("writes a state the suggestion gives no column as none, quotes a name YAML would misread, and adds neither", async () => {
    const s = existing(
      { columns: ["Todo", "Up next", "Doing: now", "Done"], fields: FIELDS },
      [
        {
          answer: {
            backlog: "Todo",
            refining: NONE,
            ready: "Up next",
            building: "Doing: now",
            review: NONE,
            done: "Done",
          },
        },
      ],
    );
    expect(await s.run()).toBe(0);
    expect(preset(s)).toContain(
      [
        "  columns:",
        "    backlog: Todo",
        "    refining: none",
        "    ready: Up next",
        '    building: "Doing: now"',
        "    review: none",
        "    done: Done",
        "",
      ].join("\n"),
    );
    expect(s.out).toContain("  board     Use board 7 as it is");
    expect(s.out.some((l) => l.startsWith("Added to board"))).toBe(false);
    expect(s.tickets.boards[0]!.columns).toEqual([
      "Todo",
      "Up next",
      "Doing: now",
      "Done",
    ]);
  });

  it("asks nothing about a board with a column for each of the six states, and adds nothing to it", async () => {
    const s = existing({ columns: SIX, fields: FIELDS }, [], []);
    expect(await s.run()).toBe(0);
    const from = s.transcript.indexOf("? select: Which board?");
    expect(s.transcript.slice(from, from + 15)).toEqual([
      "? select: Which board?",
      "",
      "Board 7 has a column for each of the factory's six states:",
      "",
      "  State      Column",
      "  backlog    Backlog",
      "  refining   In refinement",
      "  ready      Ready",
      "  building   In progress",
      "  review     In review",
      "  done       Done",
      ...BRANCH_LINES,
      `? input: ${BRANCH_QUESTION}`,
      "? select: What pays for sessions in the cloud?",
    ]);
    expect(s.out).toContain("  board     Use board 7 as it is");
    expect(s.out.some((l) => l.startsWith("Added to board"))).toBe(false);
    expect(s.tickets.boards[0]).toEqual({
      number: 7,
      title: "Engineering",
      columns: SIX,
      fields: FIELDS,
    });
    expect(preset(s)).toContain("    building: In progress\n");
  });

  it("names only the fields in the plan when the board has every column and lacks them", async () => {
    const s = existing({ columns: SIX }, [], []);
    expect(await s.run()).toBe(0);
    expect(s.out).toContain(
      "  board     Add Session, Runs in, and Cost to board 7",
    );
    expect(s.out).toContain("Added to board 7: Session, Runs in, Cost.");
  });

  it("asks for each state's column by hand when the coding agent's suggestion cannot be used, and carries on from the answers", async () => {
    const s = existing(
      { columns: ["Todo", "Doing", "Code review", "Done"] },
      [
        {
          failed: {
            code: 1,
            error:
              "Failed to authenticate: OAuth session expired and could not be refreshed",
          },
        },
      ],
      [
        "column:Todo",
        NONE,
        ADD,
        "column:Doing",
        "column:Code review",
        "column:Done",
        "yes",
      ],
    );
    expect(await s.run()).toBe(0);
    const from = s.transcript.indexOf("? select: Which board?");
    expect(
      s.transcript.slice(from, s.transcript.indexOf(BRANCH_LINES[0]!)),
    ).toEqual([
      "? select: Which board?",
      "",
      "Board 7 has the columns Todo, Doing, Code review, and Done.",
      "Asking Claude Code which of them shows each of the factory's six states...",
      "Claude Code's answer could not be used: it failed: Failed to authenticate: OAuth session expired and could not be refreshed.",
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
      "  building   Doing",
      "  review     Code review",
      "  done       Done",
      "",
      "? select: Use these columns?",
    ]);
    expect(s.out).toContain(
      "  board     Add Ready, Session, Runs in, and Cost to board 7",
    );
    expect(s.out).toContain("Added to board 7: Ready, Session, Runs in, Cost.");
    expect(preset(s)).toContain(
      [
        "  columns:",
        "    backlog: Todo",
        "    refining: none",
        "    ready: Ready",
        "    building: Doing",
        "    review: Code review",
        "    done: Done",
        "",
      ].join("\n"),
    );
    expect(s.tickets.boards[0]!.columns).toEqual([
      "Todo",
      "Ready",
      "Doing",
      "Code review",
      "Done",
    ]);
  });

  it("names neither factory init nor a repository's settings file as what to do about a failed suggestion", async () => {
    const s = existing(
      { columns: ["Todo", "Doing", "Done"] },
      [{ timedOut: true }],
      ["column:Todo", NONE, ADD, "column:Doing", NONE, "column:Done", "yes"],
    );
    expect(await s.run()).toBe(0);
    const until = s.out.indexOf("This is everything setup will do:");
    const said = s.out.slice(0, until).join("\n");
    expect(said).toContain(
      "Claude Code's answer could not be used: it took longer than 60 seconds.",
    );
    expect(said).not.toMatch(/Run factory init|factory\.yaml|Nothing changed/);
  });

  it("stops before any other question when the board's columns cannot be read", async () => {
    const s = setup({
      answers: { ...FIRST, select: ["7"] },
      boards: [{ number: 7, title: "Engineering", columns: SIX }],
      columnsFail: new Error("HTTP 502"),
    });
    expect(await s.run()).toBe(1);
    expect(s.transcript.slice(-3)).toEqual([
      "? select: Which board?",
      "Could not read board 7's columns: HTTP 502",
      "Nothing changed.",
    ]);
    expect(s.changes()).toEqual([]);
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

  it("offers {ticket} for the branch name, which Enter takes", async () => {
    const s = setup({ answers: FIRST });
    await s.run();
    expect(s.inputs).toEqual([
      { message: BRANCH_QUESTION, fallback: "{ticket}" },
    ]);
  });

  it("says why a branch name cannot be used, asks again, and writes the one that can", async () => {
    const s = setup({
      answers: { ...FIRST, input: ["feature/{user}", "{user}/{ticket}"] },
    });
    expect(await s.run()).toBe(0);
    const from = s.transcript.indexOf(`? input: ${BRANCH_QUESTION}`);
    expect(s.transcript.slice(from, from + 4)).toEqual([
      `? input: ${BRANCH_QUESTION}`,
      "needs {ticket}, or every build gets the same branch",
      `? input: ${BRANCH_QUESTION}`,
      "? select: What pays for sessions in the cloud?",
    ]);
    expect(
      s.seed.repositories["factory-config"]!.files["factory-preset.yaml"],
    ).toContain('branch-name: "{user}/{ticket}"\n');
  });

  it("writes a branch name with a quote in it so that YAML reads it back whole", async () => {
    const s = setup({ answers: { ...FIRST, input: ['a"b/{ticket}'] } });
    await s.run();
    const preset = parse(
      s.seed.repositories["factory-config"]!.files["factory-preset.yaml"]!,
    );
    expect(preset["code-host"]).toEqual({
      type: "github",
      "branch-name": 'a"b/{ticket}',
    });
  });

  it.each([
    ["with a file beside it to write", [false, true], {}],
    ["with nothing to do", [false], { [POLLER]: CONFIG.files[POLLER]! }],
  ])(
    "asks nothing about branches where the preset is there, and leaves it as it is, %s",
    async (_, confirm, poller) => {
      const mine = PRESET.replace(/code-host:\n(  .*\n)+/, "");
      const s = setup({
        answers: { confirm },
        org: {
          ...DONE,
          repositories: {
            "factory-config": {
              isPrivate: true,
              files: {
                "README.md": "mine",
                "factory-preset.yaml": mine,
                ...poller,
              },
            },
          },
        },
      });
      expect(await s.run()).toBe(0);
      expect(s.inputs).toEqual([]);
      for (const line of BRANCH_LINES) expect(s.out).not.toContain(line);
      expect(
        s.seed.repositories["factory-config"]!.files["factory-preset.yaml"],
      ).toBe(mine);
    },
  );

  it("writes a README that says what the two files are", async () => {
    const s = setup({ answers: FIRST });
    await s.run();
    const readme = s.seed.repositories["factory-config"]!.files["README.md"]!;
    expect(readme).toContain(
      [
        "- `factory-preset.yaml` is acme's preset: the ticket system, the board, its",
        "  columns, and how builds name their branches. A repository follows it once",
        "  a developer runs `factory init` there.",
      ].join("\n"),
    );
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
    expect(
      s.out.slice(s.out.indexOf("✓ Stored 2 secrets and 1 variable for acme.")),
    ).toEqual([
      "✓ Stored 2 secrets and 1 variable for acme.",
      "",
      ...ending("GitHub Free has no organization-wide rules."),
    ]);
    // The plan's row is not repeated among the results.
    expect(s.out.filter((l) => l.startsWith("- rule"))).toHaveLength(1);
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

  it("prints each address on a line of its own, tries to open it, and never says a browser opened", async () => {
    const s = setup({ answers: FIRST });
    await s.run();
    expect(s.opened).toEqual(["http://127.0.0.1:4100/"]);
    expect(s.out).toContain("     http://127.0.0.1:4100/");
    expect(s.out).toContain(`     ${INSTALL_PAGE}`);
    expect(s.out.some((l) => /\bOpen(ed|ing)\b/.test(l))).toBe(false);
  });

  it("says the app is created once its key and client ID are stored, before it waits for the installation", async () => {
    const s = setup({ answers: FIRST, org: { installs: null } });
    await s.run();
    const from = s.transcript.indexOf(CREATED);
    expect(from).toBeGreaterThan(-1);
    expect(s.transcript.slice(from + 1, from + 1 + STEP_2.length)).toEqual(
      STEP_2,
    );
    expect(s.seed.secrets).toContain("FACTORY_APP_PRIVATE_KEY");
    expect(s.seed.variables.FACTORY_APP_CLIENT_ID).toBe("Iv23client");
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
    const from = s.transcript.indexOf(STEP_1.at(-1)!);
    expect(s.transcript.slice(from + 1, from + 6 + STEP_2.length)).toEqual([
      "(reads a line)",
      "That address is not from this run. Paste the address of the page that did not load:",
      "(reads a line)",
      CREATED,
      ...STEP_2,
      "✓ Installed the app on 212 repositories.",
    ]);
    // The install page is opened too, since no browser came back to send on.
    expect(s.opened).toEqual(["http://127.0.0.1:4100/", INSTALL_PAGE]);
  });

  it("says how to free the name when an app of that name is already registered", async () => {
    const s = setup({ answers: FIRST, org: { taken: true } });
    await s.run();
    const at = s.out.indexOf(
      'An app named "Software Factory for acme" is already registered. Delete it under acme\'s Settings, Developer settings, or type another name in the form.',
    );
    expect(s.out.slice(at - 2, at + 3)).toEqual([
      "",
      STEP_1[1],
      'An app named "Software Factory for acme" is already registered. Delete it under acme\'s Settings, Developer settings, or type another name in the form.',
      "",
      STEP_1[3],
    ]);
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
    expect(s.changes()).toContain(
      "registerApp Software Factory for a-very-long-o",
    );
  });

  it("counts one repository as one", async () => {
    const s = setup({
      answers: FIRST,
      org: { on: { count: 1, covered: true } },
    });
    await s.run();
    expect(s.out).toContain("✓ Installed the app on 1 repository.");
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
    expect(s.out).toContain(CREATED);
    expect(s.out.some((l) => l.startsWith("✓ Installed"))).toBe(false);
  });
});

describe("factory init --org, the coding agent's credential", () => {
  /** What the browser gives to paste back into claude setup-token. */
  const CODE = "Xy7_pQ2vLm-9aB#kR4tZ0wE8sD1fG5hJ3nC6uI";
  const COPY =
    'Copy the line claude setup-token printed after "Your OAuth token", and paste that.';
  const TOKEN_PROMPT =
    "? secret: Paste the token it printed, the line that starts sk-ant-oat01- (leave empty to do this later):";
  const KEY_PROMPT =
    "? secret: Paste the API key (leave empty to do this later):";
  /** What is printed and asked from the first prompt for the secret to the
   * line that counts what was stored. */
  const asking = (s: ReturnType<typeof setup>, prompt: string) =>
    s.transcript.slice(
      s.transcript.indexOf(prompt),
      s.transcript.findIndex((l) => l.startsWith("✓ Stored")) + 1,
    );

  it("refuses the browser's code where the token is asked for, asks again, and stores the token", async () => {
    const s = setup({ answers: { ...FIRST, secret: [CODE, TOKEN] } });
    expect(await s.run()).toBe(0);
    expect(asking(s, TOKEN_PROMPT)).toEqual([
      TOKEN_PROMPT,
      `That is not the token: it starts sk-ant-oat01-, and what you pasted starts differently. If it has a # in it, it is the code the browser gave you for claude setup-token. ${COPY}`,
      TOKEN_PROMPT,
      "Trying the token...",
      "✓ Stored 2 secrets and 1 variable for acme.",
    ]);
    expect(s.org().values.get("CLAUDE_CODE_OAUTH_TOKEN")).toBe(TOKEN);
    expect(s.org().log.filter((l) => l.startsWith("setSecret"))).toEqual([
      "setSecret FACTORY_APP_PRIVATE_KEY",
      "setSecret CLAUDE_CODE_OAUTH_TOKEN",
    ]);
    const said = s.out.join("\n");
    for (const part of [CODE, CODE.slice(0, 10), CODE.slice(-10)])
      expect(said).not.toContain(part);
  });

  it("says an API key pasted where the token is asked for belongs to the other choice", async () => {
    const s = setup({ answers: { ...FIRST, secret: [API_KEY, TOKEN] } });
    expect(await s.run()).toBe(0);
    expect(asking(s, TOKEN_PROMPT)[1]).toBe(
      `That is an API key, not the token: the token starts sk-ant-oat01-. It belongs to the choice "An API key". ${COPY}`,
    );
    expect(s.org().values.get("CLAUDE_CODE_OAUTH_TOKEN")).toBe(TOKEN);
    expect(s.seed.secrets).not.toContain("ANTHROPIC_API_KEY");
    printsNoSecret(s.out);
  });

  it("refuses what is not an API key where one is asked for, and a setup-token token with the choice it belongs to", async () => {
    const s = setup({
      answers: {
        ...FIRST,
        select: ["new", "ANTHROPIC_API_KEY", "30"],
        secret: [CODE, TOKEN, API_KEY],
      },
    });
    expect(await s.run()).toBe(0);
    expect(asking(s, KEY_PROMPT)).toEqual([
      KEY_PROMPT,
      "That is not an API key: one starts sk-ant-api. Paste the key from the Anthropic console.",
      KEY_PROMPT,
      'That is the token claude setup-token prints, not an API key: one starts sk-ant-api. It belongs to the choice "A Claude subscription". Paste the key from the Anthropic console.',
      KEY_PROMPT,
      "Trying the API key...",
      "✓ Stored 2 secrets and 1 variable for acme.",
    ]);
    expect(s.org().values.get("ANTHROPIC_API_KEY")).toBe(API_KEY);
    expect(s.seed.secrets).not.toContain("CLAUDE_CODE_OAUTH_TOKEN");
    printsNoSecret(s.out);
  });

  it("tries the token before it stores it, and asks again for one Claude Code refuses", async () => {
    const cut = TOKEN.slice(0, 15);
    const s = setup({
      answers: { ...FIRST, secret: [cut, TOKEN] },
      tries: [
        {
          refused:
            "Failed to authenticate. API Error: 401 OAuth access token is invalid.",
        },
      ],
    });
    expect(await s.run()).toBe(0);
    expect(asking(s, TOKEN_PROMPT)).toEqual([
      TOKEN_PROMPT,
      "Trying the token...",
      "Claude Code refused that token: API Error: 401 OAuth access token is invalid. If it was printed over two lines, copy both, then paste it again.",
      TOKEN_PROMPT,
      "Trying the token...",
      "✓ Stored 2 secrets and 1 variable for acme.",
    ]);
    expect(s.org().values.get("CLAUDE_CODE_OAUTH_TOKEN")).toBe(TOKEN);
    expect(s.org().log.filter((l) => l.startsWith("setSecret"))).toEqual([
      "setSecret FACTORY_APP_PRIVATE_KEY",
      "setSecret CLAUDE_CODE_OAUTH_TOKEN",
    ]);
    // Each try had the value pasted, under the token's name.
    expect(s.tried.map((env) => env.CLAUDE_CODE_OAUTH_TOKEN)).toEqual([
      cut,
      TOKEN,
    ]);
    expect(s.out.join("\n")).not.toContain(cut);
  });

  it("stores a token it could not try, and says it is untried", async () => {
    const s = setup({ answers: FIRST, tries: ["hangs"], tryMs: 20 });
    expect(await s.run()).toBe(0);
    expect(asking(s, TOKEN_PROMPT)).toEqual([
      TOKEN_PROMPT,
      "Trying the token...",
      "Could not try the token (it took longer than 0.02 seconds), so it is stored untried.",
      "✓ Stored 2 secrets and 1 variable for acme.",
    ]);
    expect(s.org().values.get("CLAUDE_CODE_OAUTH_TOKEN")).toBe(TOKEN);
  });

  it("tries an API key under its own name, with no token beside it", async () => {
    const s = setup({
      answers: {
        ...FIRST,
        select: ["new", "ANTHROPIC_API_KEY", "30"],
        secret: [API_KEY],
      },
    });
    expect(await s.run()).toBe(0);
    expect(s.tried).toHaveLength(1);
    expect(s.tried[0]!.ANTHROPIC_API_KEY).toBe(API_KEY);
    expect(s.tried[0]!.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined();
  });

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

describe("the answer Enter gives to a question", () => {
  it("is shown in words, with no parentheses to read as part of it", () => {
    expect(defaultInWords("{ticket}")).toBe("Press Enter for {ticket}");
    expect(defaultInWords("docs/**, **/*.md")).toBe(
      "Press Enter for docs/**, **/*.md",
    );
  });

  it("is not shown when there is none", () => {
    expect(defaultInWords("")).toBe("");
  });
});

describe("the command that opens a page", () => {
  const WSL = { WSL_DISTRO_NAME: "Ubuntu" };
  const has =
    (...names: string[]) =>
    (name: string) =>
      names.includes(name);

  it("is Windows' own from WSL, where xdg-open has no browser: wslview first, then explorer.exe", () => {
    expect(
      pageOpener("linux", WSL, has("wslview", "explorer.exe", "xdg-open")),
    ).toBe("wslview");
    expect(pageOpener("linux", WSL, has("explorer.exe", "xdg-open"))).toBe(
      "explorer.exe",
    );
    expect(pageOpener("linux", WSL, has("xdg-open"))).toBe("xdg-open");
    expect(pageOpener("linux", WSL, has())).toBe("xdg-open");
  });

  it("is xdg-open on any other Linux, whatever else is installed", () => {
    expect(pageOpener("linux", {}, has("wslview", "explorer.exe"))).toBe(
      "xdg-open",
    );
  });

  it("is the system's own on macOS and on Windows", () => {
    expect(pageOpener("darwin", WSL, has("wslview"))).toBe("open");
    expect(pageOpener("win32", WSL, has("wslview"))).toBe("explorer");
  });

  it("is found on the PATH by its file, without running it", () => {
    const folder = mkdtempSync(join(tmpdir(), "on-path-"));
    try {
      const ran = join(folder, "ran");
      writeFileSync(join(folder, "explorer.exe"), `#!/bin/sh\ntouch ${ran}\n`, {
        mode: 0o755,
      });
      writeFileSync(join(folder, "notes.txt"), "not a command\n", {
        mode: 0o644,
      });
      const env = { PATH: ["/nowhere-at-all", folder].join(delimiter) };
      expect(onPath("explorer.exe", env)).toBe(true);
      expect(onPath("wslview", env)).toBe(false);
      expect(onPath("notes.txt", env)).toBe(false);
      expect(onPath("explorer.exe", {})).toBe(false);
      expect(existsSync(ran)).toBe(false);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
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
    const line = readLineFrom(input)(stop.signal);
    // The reader hears the end before this does, so by now it has closed.
    const ended = once(input, "end");
    input.end();
    await ended;
    stop.abort();
    await expect(line).rejects.toThrow("stopped");
  });
});

describe("factory init --org, the address of the docs", () => {
  const docsLine = async (version?: string) => {
    const s = setup({ org: DONE, answers: { confirm: [false] }, version });
    await s.run();
    return s.out.at(-1)!.trim();
  };

  it("names the installed release's copy of the page", async () => {
    expect(await docsLine("1.12.3")).toBe(
      "https://github.com/davidbyoung/software-factory/blob/v1.12.3/docs/github/setup.md#in-an-organization",
    );
  });

  it.each(["0.0.0-development", "1.2", "v1.2.3"])(
    "names the default branch's copy for %s, which is no release",
    async (version) => {
      expect(await docsLine(version)).toBe(
        "https://github.com/davidbyoung/software-factory/blob/main/docs/github/setup.md#in-an-organization",
      );
    },
  );

  it("names a page and a heading the docs have", async () => {
    const [, path, anchor] = /\/blob\/[^/]+\/(.+)#(.+)$/.exec(
      await docsLine(),
    )!;
    const headings = readFileSync(join(dirname(LAUNCHER), "..", path!), "utf8")
      .split("\n")
      .filter((line) => /^#+ /.test(line))
      .map((line) =>
        line
          .replace(/^#+ /, "")
          .toLowerCase()
          .replace(/[^a-z0-9 -]/g, "")
          .replaceAll(" ", "-"),
      );
    expect(headings).toContain(anchor);
    expect(anchor).toBe("in-an-organization");
  });
});

describe("factory init --org, the rule", () => {
  it("carries on when GitHub refuses the rule, and leaves it to each repository's admin as a third step", async () => {
    const s = setup({
      answers: FIRST,
      org: {
        fail: { requireCheckWhere: new Error("HTTP 403: Upgrade to Team") },
      },
    });
    expect(await s.run()).toBe(0);
    expect(
      s.out.slice(s.out.indexOf("✓ Stored 2 secrets and 1 variable for acme.")),
    ).toEqual([
      "✓ Stored 2 secrets and 1 variable for acme.",
      "",
      ...ending("GitHub refused the organization's rule."),
    ]);
    expect(s.out.some((l) => l.startsWith("- rule"))).toBe(false);
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
      "? confirm: CLAUDE_CODE_OAUTH_TOKEN is already stored for acme. Replace it? Only if it has expired or been revoked.",
      "✓ acme is set up. Nothing to do.",
      "",
      ...ADDRESSES,
    ]);
    expect(s.confirms[0]!.fallback).toBe(false);
    expect(s.changes()).toEqual([]);
  });

  it("names the API key in the question when that is what is stored", async () => {
    const s = setup({
      org: {
        ...DONE,
        secrets: ["FACTORY_APP_PRIVATE_KEY", "ANTHROPIC_API_KEY"],
      },
      answers: { confirm: [false] },
    });
    expect(await s.run()).toBe(0);
    expect(s.confirms).toEqual([
      {
        message:
          "ANTHROPIC_API_KEY is already stored for acme. Replace it? Only if it has expired or been revoked.",
        fallback: false,
      },
    ]);
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
      "? confirm: CLAUDE_CODE_OAUTH_TOKEN is already stored for acme. Replace it? Only if it has expired or been revoked.",
    );
    expect(s.transcript.slice(from + 1)).toEqual([
      "",
      "This is everything setup will do:",
      "  secrets   Store CLAUDE_CODE_OAUTH_TOKEN for acme",
      "? confirm: Go ahead?",
      "",
      "",
      "The coding agent's token: running claude setup-token...",
      "? secret: Paste the token it printed, the line that starts sk-ant-oat01- (leave empty to do this later):",
      "Trying the token...",
      "✓ Stored 1 secret for acme.",
      "",
      ...ending(),
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
      ...ending(),
    ]);
    expect(s.changes()).toEqual([
      "defineProperty software-factory on|off",
      "requireCheckWhere Software factory Review verdict software-factory=on runner",
    ]);
  });

  describe("with the app registered and not installed", () => {
    const notInstalled = (registered: Seed["registered"]) =>
      setup({
        org: { ...DONE, installation: null, registered },
        answers: { confirm: [false, true] },
      });
    /** What it prints and asks after "Go ahead?" and its blank line. */
    const after = (s: ReturnType<typeof setup>) =>
      s.transcript.slice(s.transcript.indexOf("? confirm: Go ahead?") + 2);

    it("prints only the second step, with the app's name and its install page when the code host can find them", async () => {
      const s = notInstalled({
        name: "Software Factory for acme",
        slug: "software-factory-for-acme",
        installPage: INSTALL_PAGE,
      });
      expect(await s.run()).toBe(0);
      expect(s.out).toContain(
        "  App              registered, and not installed yet",
      );
      expect(s.out).toContain(
        "  app       Install the GitHub App, which is registered",
      );
      expect(after(s)).toEqual([
        'The GitHub App "Software Factory for acme" is registered and not installed yet.',
        "",
        "Install it. Your browser should open this address. If it does not, open it yourself:",
        ...INSTALLING,
        "✓ Installed the app.",
        "",
        ...ending(),
      ]);
      expect(s.opened).toEqual([INSTALL_PAGE]);
      expect(s.org().log).toContain("awaitInstallation Iv23client");
      // No app is registered a second time, and no key is asked of GitHub.
      expect(s.changes()).toEqual([]);
      expect(s.org().log.some((l) => l.startsWith("installedOn"))).toBe(false);
    });

    it("sends her to the organization's list of apps when it cannot find the app", async () => {
      const s = notInstalled(null);
      expect(await s.run()).toBe(0);
      expect(after(s)).toEqual([
        "The GitHub App is registered and not installed yet.",
        "",
        "Install it. Your browser should open this address. If it does not, open it yourself:",
        "     https://github.com/organizations/acme/settings/apps",
        '   Press the app\'s name, then "Install App", choose the repositories, and press "Install".',
        "   Waiting up to 10 minutes for the installation to show.",
        "(waits for the installation)",
        "✓ Installed the app.",
        "",
        ...ending(),
      ]);
      expect(s.opened).toEqual([
        "https://github.com/organizations/acme/settings/apps",
      ]);
    });
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
    expect(s.changes().slice(0, 4)).toEqual([
      "createBoard Software factory",
      "addColumns 1",
      "addFields 1",
      "putFiles factory-config README.md factory-preset.yaml .github/workflows/factory-poller.yml",
    ]);
  });
});
