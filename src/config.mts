#!/usr/bin/env node
// The factory's settings, from `.claude/factory.yaml`. This is the one place
// they are read: a command loads them once when it starts and passes down
// what its functions need, and nothing under src/lib/ loads them.
//
//   factory config get KEY     # e.g. repository, tickets.board
//   factory plugins [ROLE]     # kind, name, role, files or labels
//   factory config check       # prints nothing when sound
//
// A list prints one item per line. A failure names the key and exits 1.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { DEFAULT_CODE_HOST, unsupportedCodeHost } from "./code-host/index.mts";
import { matchesAny } from "./lib/glob.mts";
import { DEFAULT_RUNNER, unsupportedRunner } from "./runner/index.mts";
import { BUILT, unsupported, type Built } from "./tool-names.mts";
import {
  DEFAULT_COLUMNS,
  STATE_KEYS,
  sameName,
  type Columns,
  type StateKey,
} from "./lib/work-status.mts";

export class SettingsError extends Error {}

export const ROLES = ["mockups", "builder", "reviewer"] as const;
export type Role = (typeof ROLES)[number];
export const TRIGGERS = ["own-server", "github-action", "manual"] as const;
export const SPECS = ["none", "openspec"] as const;

const FIELD_DEFAULTS = {
  session: "Session",
  "runs-in": "Runs in",
  cost: "Cost",
} as const;
export type FieldKey = keyof typeof FIELD_DEFAULTS;

export type Plugin = {
  kind: "skill" | "agent";
  name: string;
  role: Role;
  files: string[];
  labels: string[];
};

export type Settings = {
  version: 1;
  repository: string;
  tickets: {
    type: string;
    /** The keys the ticket system adds under `tickets`, by name. */
    options: Record<string, string>;
    board: number | null;
    /** The board's column for each state, null for none. */
    columns: Record<StateKey, string | null>;
    /** The board's field for each of three the sync writes, null for none. */
    fields: Record<FieldKey, string | null>;
  };
  /** Where pull requests are. */
  codeHost: { type: string };
  builds: {
    /** What notices a card moved to Ready and starts its build. */
    trigger: (typeof TRIGGERS)[number];
    /** Where an unattended build runs. */
    runner: string;
  };
  specs: (typeof SPECS)[number];
  beforeCommit: string[];
  /** Commands an unattended build runs from the root before it starts. */
  buildSetup: string[];
  plugins: Plugin[];
  autoMerge: { allow: string[]; deny: string[]; commands: string[] };
  /** The CI review, on when `ci-review` is written, with the commands it
   * may run as prefixes beside the factory's own; null when it is off. */
  ciReview: { commands: string[] } | null;
  /** How the factory looks at the repository's website; null when the
   * repository is not one. */
  site: Site | null;
  /** How long each kind of unattended session may run, in minutes. */
  sessionMinutes: Record<SessionKind, number>;
};

/** Each kind of unattended session, with how long it may run by default. */
export const SESSION_MINUTES = {
  build: 230,
  conflicts: 110,
  review: 50,
  dependencies: 50,
} as const;
export type SessionKind = keyof typeof SESSION_MINUTES;

export type Site = {
  start: string;
  url: string;
  designGuide: string | null;
  /** The paths to look at, or null to find them. */
  pages: string[] | null;
  widths: number[];
  hide: string[];
  checks: string[];
  maxPages: number;
  startMinutes: number;
  /** The WCAG level axe-core measures against, or none. */
  accessibility: Accessibility;
  /** Whether a style value the base site does not use is reported. */
  newValues: boolean;
};

export const ACCESSIBILITY = [
  "wcag22aa",
  "wcag21aa",
  "wcag2aa",
  "none",
] as const;
export type Accessibility = (typeof ACCESSIBILITY)[number];

/** The agent that needs `site`. */
export const SITE_AGENT = "factory-ui-reviewer";
export const NO_PLAYWRIGHT = "site needs Playwright: npm install -D playwright";

/** The keys each block allows, by the block's path: `""` is the top of the
 * file and `plugins[]` is one plug-in. `settings.schema.json` lists the same
 * keys, and a test fails when the two differ. A key the code accepts goes
 * here, in the schema, and in docs/configuration.md. */
export const SETTINGS_KEYS: Record<string, readonly string[]> = {
  "": [
    "version",
    "repository",
    "tickets",
    "code-host",
    "builds",
    "specs",
    "before-commit",
    "build-setup",
    "plugins",
    "auto-merge",
    "ci-review",
    "site",
    "session-minutes",
  ],
  tickets: ["type", "board", "columns", "fields"],
  "tickets.columns": Object.keys(STATE_KEYS),
  "tickets.fields": Object.keys(FIELD_DEFAULTS),
  "code-host": ["type"],
  builds: ["trigger", "runner"],
  specs: ["type"],
  "auto-merge": ["allow", "deny", "commands"],
  "ci-review": ["commands"],
  site: [
    "start",
    "url",
    "design-guide",
    "pages",
    "widths",
    "hide",
    "checks",
    "max-pages",
    "start-minutes",
    "accessibility",
    "new-values",
  ],
  "plugins[]": ["skill", "agent", "role", "files", "labels"],
  "session-minutes": Object.keys(SESSION_MINUTES),
};

function wholeNumber(v: unknown, key: string, fallback: number): number {
  if (v === undefined) return fallback;
  return Number.isInteger(v) && (v as number) > 0
    ? (v as number)
    : fail(key, "must be a whole number above zero");
}

function parseSite(v: unknown, exists: (p: string) => boolean): Site | null {
  if (v === undefined) return null;
  const o = object(v, "site");
  for (const k of ["start", "url"] as const) {
    if (typeof o[k] !== "string" || !o[k])
      fail(`site.${k}`, "is required when site is written");
  }
  const guide = o["design-guide"];
  if (guide !== undefined && (typeof guide !== "string" || !exists(guide)))
    fail("site.design-guide", "must be a file that exists");
  let widths = [390, 1280];
  if (o.widths !== undefined) {
    if (!Array.isArray(o.widths) || o.widths.length === 0)
      fail("site.widths", "must be a list of widths in pixels");
    widths = (o.widths as unknown[]).map((w, i) =>
      wholeNumber(w, `site.widths[${i}]`, 0),
    );
  }
  const acc = o.accessibility ?? "wcag22aa";
  if (!(ACCESSIBILITY as readonly unknown[]).includes(acc))
    fail("site.accessibility", `must be one of ${ACCESSIBILITY.join(", ")}`);
  const nv = o["new-values"] ?? true;
  if (typeof nv !== "boolean") fail("site.new-values", "must be true or false");
  return {
    start: o.start as string,
    url: o.url as string,
    designGuide: typeof guide === "string" ? guide : null,
    pages: o.pages === undefined ? null : strings(o.pages, "site.pages"),
    widths,
    hide: strings(o.hide, "site.hide"),
    checks: strings(o.checks, "site.checks"),
    maxPages: wholeNumber(o["max-pages"], "site.max-pages", 4),
    startMinutes: wholeNumber(o["start-minutes"], "site.start-minutes", 5),
    accessibility: acc as Accessibility,
    newValues: nv as boolean,
  };
}

/** `factory config get site`: every key in the table's order. */
export function siteLines(site: Site): string[] {
  const show = (v: string | number | boolean | string[] | null) =>
    Array.isArray(v) ? v.join(", ") || "none" : v === null ? "none" : String(v);
  return [
    ["start", site.start],
    ["url", site.url],
    ["design-guide", site.designGuide],
    ["pages", site.pages === null ? "found" : site.pages],
    ["widths", site.widths.map(String)],
    ["hide", site.hide],
    ["checks", site.checks],
    ["max-pages", site.maxPages],
    ["start-minutes", site.startMinutes],
    ["accessibility", site.accessibility],
    ["new-values", site.newValues],
  ].map(
    ([k, v]) =>
      `${k}: ${show(v as string | number | boolean | string[] | null)}`,
  );
}

/** The root of the repository a command runs in: the nearest folder at or
 * above `from` that holds `.git`, or `from` itself when none does. */
export function repoRoot(from = process.cwd()): string {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, ".git"))) return dir;
    if (dirname(dir) === dir) return from;
  }
}
export const SETTINGS_FILE = ".claude/factory.yaml";

type Obj = Record<string, unknown>;

const fail = (key: string, message: string): never => {
  throw new SettingsError(`${SETTINGS_FILE}: ${key}: ${message}`);
};

const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** A block of settings. Its keys are `SETTINGS_KEYS[path]` and `extra`,
 * and `path` is the block's `key` unless a list's item names it otherwise. */
function object(
  v: unknown,
  key: string,
  path = key,
  extra: readonly string[] = [],
): Obj {
  if (v === undefined) return {};
  if (!isObj(v)) return fail(key, "must be a block of settings");
  const allowed = [...SETTINGS_KEYS[path]!, ...extra];
  for (const k of Object.keys(v)) {
    if (!allowed.includes(k)) fail(key ? `${key}.${k}` : k, "unknown key");
  }
  return v;
}

function strings(v: unknown, key: string): string[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) return fail(key, "must be a list");
  return v.map((item, i) =>
    typeof item === "string" && item
      ? item
      : fail(`${key}[${i}]`, "must be text"),
  );
}

/** The CI review's commands: each becomes `Bash(COMMAND:*)` in a list
 * that commas separate, so none may hold a comma, a parenthesis, or a
 * quote. */
function reviewCommands(v: unknown): string[] {
  const key = "ci-review.commands";
  return strings(v, key).map((command, i) =>
    /[,()"]/.test(command)
      ? fail(`${key}[${i}]`, "must hold no comma, parenthesis, or quote")
      : command,
  );
}

function oneOf<T extends string>(
  v: unknown,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  if (v === undefined) return fallback;
  return allowed.includes(v as T)
    ? (v as T)
    : fail(key, `must be one of ${allowed.join(", ")}`);
}

/** A block of names for the keys of `defaults`: each left out keeps its
 * default, and "none" is null. */
function names(
  v: unknown,
  key: string,
  defaults: Record<string, string>,
): Record<string, string | null> {
  const o = object(v, key);
  return Object.fromEntries(
    Object.entries(defaults).map(([k, fallback]) => {
      const value = o[k];
      if (value === undefined) return [k, fallback];
      if (value === "none") return [k, null];
      if (typeof value !== "string" || !value.trim())
        return fail(`${key}.${k}`, "must be a name, or none");
      return [k, value.trim()];
    }),
  );
}

/** A part you can swap, written as a block with a `type` or as one word. */
function typed(v: unknown, key: string, extra?: readonly string[]): Obj {
  if (typeof v === "string") return { type: v };
  return object(v, key, key, extra);
}

function plugin(v: unknown, i: number, exists: (p: string) => boolean) {
  const key = `plugins[${i}]`;
  const o = object(v, key, "plugins[]");
  const kind =
    "skill" in o && !("agent" in o)
      ? "skill"
      : "agent" in o && !("skill" in o)
        ? "agent"
        : fail(key, "names one skill or one agent");
  const name = o[kind];
  if (typeof name !== "string" || !/^[\w-]+$/.test(name))
    fail(`${key}.${kind}`, "must be a name");
  const path =
    kind === "skill"
      ? `.claude/skills/${name}/SKILL.md`
      : `.claude/agents/${name}.md`;
  if (!exists(path)) fail(`${key}.${kind}`, `${path} does not exist`);
  return {
    kind,
    name: name as string,
    role:
      o.role === undefined
        ? fail(`${key}.role`, `must be one of ${ROLES.join(", ")}`)
        : oneOf(o.role, `${key}.role`, ROLES, "reviewer"),
    files: strings(o.files, `${key}.files`),
    labels: strings(o.labels, `${key}.labels`),
  } satisfies Plugin;
}

/** The settings with every default filled in. Throws a SettingsError naming
 * the key on anything unsound. `exists` says whether a path from the root
 * exists, for the plug-ins' files. */
export function parseSettings(
  raw: unknown,
  exists: (path: string) => boolean,
  built: Built = BUILT,
): Settings {
  const top = object(raw ?? {}, "");
  if (top.version !== 1) fail("version", "must be 1");
  if (
    typeof top.repository !== "string" ||
    !/^[\w.-]+\/[\w.-]+$/.test(top.repository)
  )
    fail("repository", "must be owner/name");

  const declared = (v: unknown): readonly string[] => {
    const type = isObj(v) ? v.type : v;
    return typeof type === "string" ? (built.tickets[type] ?? []) : [];
  };
  const ticketType =
    (isObj(top.tickets) ? top.tickets.type : top.tickets) ?? "github";
  if (typeof ticketType !== "string" || !(ticketType in built.tickets))
    // The same words every ticket command fails with (`tickets/index.mts`).
    throw new SettingsError(
      `${SETTINGS_FILE}: ${unsupported("tickets.type", String(ticketType), "ticket system", Object.keys(built.tickets))}`,
    );
  const tickets = typed(top.tickets, "tickets", declared(top.tickets));
  const options = Object.fromEntries(
    declared(top.tickets)
      .filter((k) => tickets[k] !== undefined)
      .map((k) => [
        k,
        typeof tickets[k] === "string" && tickets[k]
          ? (tickets[k] as string)
          : fail(`tickets.${k}`, "must be text"),
      ]),
  );
  const board = tickets.board;
  if (
    board !== undefined &&
    board !== "none" &&
    !(Number.isInteger(board) && (board as number) > 0)
  )
    fail("tickets.board", "must be a whole number above zero, or none");

  const codeHost =
    typed(top["code-host"], "code-host").type ?? DEFAULT_CODE_HOST;
  if (typeof codeHost !== "string" || !built.codeHost.includes(codeHost))
    throw new SettingsError(
      `${SETTINGS_FILE}: ${unsupportedCodeHost(String(codeHost), built.codeHost)}`,
    );

  const builds = object(top.builds, "builds");
  const trigger = oneOf(builds.trigger, "builds.trigger", TRIGGERS, "manual");
  const runner = builds.runner ?? DEFAULT_RUNNER;
  if (typeof runner !== "string" || !built.runner.includes(runner))
    throw new SettingsError(
      `${SETTINGS_FILE}: ${unsupportedRunner(String(runner), built.runner)}`,
    );
  const hasBoard = typeof board === "number";
  if (tickets.columns !== undefined && !hasBoard)
    fail("tickets.columns", "needs tickets.board");
  if (tickets.fields !== undefined && !hasBoard)
    fail("tickets.fields", "needs tickets.board");
  const columns = names(
    tickets.columns,
    "tickets.columns",
    Object.fromEntries(
      Object.entries(STATE_KEYS).map(([k, s]) => [k, DEFAULT_COLUMNS[s]!]),
    ),
  ) as Record<StateKey, string | null>;
  if (columns.backlog === null)
    fail(
      "tickets.columns.backlog",
      "cannot be none: every ticket starts there",
    );
  const seen = new Map<string, string>();
  for (const [key, name] of Object.entries(columns)) {
    if (name === null) continue;
    const other = [...seen].find(([n]) => sameName(n, name));
    if (other)
      fail(`tickets.columns.${key}`, `names the same column as ${other[1]}`);
    seen.set(name, key);
  }
  if (columns.ready === null && trigger !== "manual")
    fail(
      "tickets.columns.ready",
      "no column shows ready, so nothing would start a build: name one, or set builds.trigger to manual",
    );
  const fieldNames = names(
    tickets.fields,
    "tickets.fields",
    FIELD_DEFAULTS,
  ) as Record<FieldKey, string | null>;
  const specs = typed(top.specs ?? "none", "specs");
  const autoMerge = object(top["auto-merge"], "auto-merge");
  const ciReview =
    top["ci-review"] === undefined
      ? null
      : object(top["ci-review"] ?? {}, "ci-review");
  if (top.plugins !== undefined && !Array.isArray(top.plugins))
    fail("plugins", "must be a list");

  const site = parseSite(top.site, exists);
  const plugins = ((top.plugins as unknown[]) ?? []).map((p, i) =>
    plugin(p, i, exists),
  );
  if (!site && plugins.some((p) => p.kind === "agent" && p.name === SITE_AGENT))
    fail("site", `is required to list ${SITE_AGENT}`);

  return {
    version: 1,
    repository: top.repository as string,
    tickets: {
      type: ticketType,
      options,
      board: typeof board === "number" ? board : null,
      columns,
      fields: fieldNames,
    },
    codeHost: { type: codeHost },
    builds: { trigger, runner },
    specs: oneOf(specs.type, "specs", SPECS, "none"),
    beforeCommit: strings(top["before-commit"], "before-commit"),
    buildSetup: strings(top["build-setup"], "build-setup"),
    plugins,
    autoMerge: {
      allow: strings(autoMerge.allow, "auto-merge.allow"),
      deny: strings(autoMerge.deny, "auto-merge.deny"),
      commands: strings(autoMerge.commands, "auto-merge.commands"),
    },
    ciReview: ciReview && { commands: reviewCommands(ciReview.commands) },
    site,
    sessionMinutes: sessionMinutesOf(top["session-minutes"]),
  };
}

function sessionMinutesOf(v: unknown): Record<SessionKind, number> {
  const o = object(v, "session-minutes");
  return Object.fromEntries(
    Object.entries(SESSION_MINUTES).map(([kind, fallback]) => [
      kind,
      wholeNumber(o[kind], `session-minutes.${kind}`, fallback),
    ]),
  ) as Record<SessionKind, number>;
}

/** One line for each pattern that matches none of `files`: a stale pattern
 * is how a policy rots. */
export function patternWarnings(s: Settings, files: string[]): string[] {
  const lists: [string, string[]][] = [
    ...s.plugins.map((p, i): [string, string[]] => [
      `plugins[${i}].files`,
      p.files,
    ]),
    ["auto-merge.allow", s.autoMerge.allow],
    ["auto-merge.deny", s.autoMerge.deny],
  ];
  return lists.flatMap(([key, patterns]) =>
    patterns
      .filter((p) => !files.some((f) => matchesAny(f, [p])))
      .map((p) => `${key}: ${p} matches no file`),
  );
}

type YamlLoad = (text: string) => unknown;

export type Deps = {
  readFile: () => string;
  exists: (path: string) => boolean;
  /** Whether an npm package resolves from the repository's root. */
  hasPackage: (name: string) => boolean;
  listFiles: () => string[];
  loadYaml: () => Promise<YamlLoad>;
  out: (line: string) => void;
  err: (line: string) => void;
};

export const NO_DEPENDENCIES =
  "The factory's settings cannot be read until dependencies are installed: run npm ci.";

/** js-yaml is loaded when needed, so a checkout without dependencies gets
 * one line saying what to do rather than a stack trace. */
async function read(d: Deps): Promise<Settings> {
  let load: YamlLoad;
  try {
    load = await d.loadYaml();
  } catch {
    throw new SettingsError(NO_DEPENDENCIES);
  }
  let raw: unknown;
  try {
    raw = load(d.readFile());
  } catch (e) {
    throw new SettingsError(`${SETTINGS_FILE}: ${(e as Error).message}`);
  }
  return parseSettings(raw, d.exists);
}

/** The settings file: FACTORY_SETTINGS where it is set, for trying settings
 * against a board without changing the repository's, and otherwise the
 * repository's own. */
export const settingsPath = (
  root: string,
  env: Record<string, string | undefined> = process.env,
) => env.FACTORY_SETTINGS || `${root}/${SETTINGS_FILE}`;

export const defaultDeps = (root = repoRoot()): Deps => ({
  readFile: () => readFileSync(settingsPath(root), "utf8"),
  exists: (path) => existsSync(`${root}/${path}`),
  hasPackage: (name) => {
    try {
      createRequire(`${root}/package.json`).resolve(`${name}/package.json`);
      return true;
    } catch {
      return false;
    }
  },
  listFiles: () =>
    execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard"],
      { cwd: root, encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean),
  loadYaml: async () => (await import("js-yaml")).load,
  out: (line) => console.log(line),
  err: (line) => console.error(line),
});

/** The column each state shows in on the board, null for none. */
export function columnsOf(s: Settings): Columns {
  const out = { ...DEFAULT_COLUMNS };
  for (const [key, status] of Object.entries(STATE_KEYS))
    out[status] = s.tickets.columns[key as StateKey];
  return out;
}

/** The board's names for the fields the sync writes, null for none. */
export function fieldNamesOf(s: Settings) {
  return {
    session: s.tickets.fields.session,
    runsIn: s.tickets.fields["runs-in"],
    cost: s.tickets.fields.cost,
  };
}

/** The settings of the checkout the command runs in. */
export const loadSettings = (d: Deps = defaultDeps()) => read(d);

function lookup(s: Settings, key: string): unknown {
  const camel: Record<string, string> = {
    "before-commit": "beforeCommit",
    "build-setup": "buildSetup",
    "auto-merge": "autoMerge",
    "ci-review": "ciReview",
    "code-host": "codeHost",
    "design-guide": "designGuide",
    "max-pages": "maxPages",
    "start-minutes": "startMinutes",
    "session-minutes": "sessionMinutes",
  };
  let v: unknown = s;
  for (const part of key.split(".")) {
    if (!isObj(v)) return undefined;
    v = v[camel[part] ?? part];
  }
  return v;
}

/** The factory's design skill, which `factory sync` writes where there is a
 * site. */
const DESIGN_SKILL = ".claude/skills/factory-design/SKILL.md";

/** The settings' plug-ins, and the factory's design skill as the mockups
 * plug-in of a site that lists none, once it is synced. */
export function pluginsOf(
  s: Settings,
  exists: (path: string) => boolean,
): Plugin[] {
  if (!s.site || s.plugins.some((p) => p.role === "mockups")) return s.plugins;
  if (!exists(DESIGN_SKILL)) return s.plugins;
  return [
    {
      kind: "skill",
      name: "factory-design",
      role: "mockups",
      files: [],
      labels: [],
    },
    ...s.plugins,
  ];
}

export async function main(argv: string[], d: Deps): Promise<number> {
  const [command, arg] = argv;
  if (!command) {
    d.err("Usage: factory config get KEY | config check | plugins [ROLE]");
    return 2;
  }
  let s: Settings;
  try {
    s = await read(d);
  } catch (e) {
    if (!(e instanceof SettingsError)) throw e;
    d.err(e.message);
    return 1;
  }
  if (command === "check") {
    if (s.site && !d.hasPackage("playwright")) {
      d.err(NO_PLAYWRIGHT);
      return 1;
    }
    for (const w of patternWarnings(s, d.listFiles())) d.err(`warning: ${w}`);
    if (s.site && !s.plugins.some((p) => p.role === "mockups"))
      if (!d.exists(DESIGN_SKILL))
        d.err(
          `warning: ${DESIGN_SKILL} is missing: run \`npx --no-install factory sync\` to give the site its design skill`,
        );
    return 0;
  }
  if (command === "plugins") {
    for (const p of pluginsOf(s, d.exists)) {
      if (arg && p.role !== arg) continue;
      d.out([p.kind, p.name, p.role, ...p.files, ...p.labels].join(" ").trim());
    }
    return 0;
  }
  if (command === "site" && s.site) {
    for (const line of siteLines(s.site)) d.out(line);
    return 0;
  }
  const v =
    command.startsWith("site") && !s.site ? undefined : lookup(s, command);
  if (command === "site.pages" && s.site?.pages === null) {
    d.out("found");
    return 0;
  }
  if (v === undefined || isObj(v)) {
    d.err(`${SETTINGS_FILE}: ${command}: not a setting that prints`);
    return 1;
  }
  // An unset key of the site's settings prints `none`; elsewhere, nothing.
  const empty = Array.isArray(v) && v.length === 0;
  for (const line of Array.isArray(v) && !(empty && command.startsWith("site"))
    ? v
    : [empty ? "none" : (v ?? "none")])
    d.out(String(line));
  return 0;
}

/** `factory config get KEY`, `factory config check`, and
 * `factory plugins [ROLE]`. */
export async function run(argv: string[]): Promise<number> {
  return main(argv, defaultDeps());
}

/** What a reading needs from the settings. */
export type Target = {
  repository: string;
  board: number | null;
  /** Whether something starts builds from the board. */
  watched: boolean;
  /** The column each state shows in on the board. */
  columns: Columns;
};

/** The settings' answer, with GITHUB_REPOSITORY and FACTORY_BOARD_NUMBER
 * winning where they are set. */
export function targetOf(
  s: Settings,
  env: Record<string, string | undefined>,
): Target {
  return {
    repository: env.GITHUB_REPOSITORY || s.repository,
    board: env.FACTORY_BOARD_NUMBER
      ? Number(env.FACTORY_BOARD_NUMBER)
      : s.tickets.board,
    watched: s.builds.trigger !== "manual",
    columns: columnsOf(s),
  };
}

/** The repository, code host, and runner for a command a workflow runs
 * too. There GITHUB_REPOSITORY names the repository and the settings are
 * not read, so an unreadable settings file cannot fail the workflow's step,
 * and the code host and the runner are the defaults. */
export async function reachOf(
  env: Record<string, string | undefined>,
  settings: () => Promise<Settings> = loadSettings,
): Promise<{ repository: string; codeHost: string; runner: string }> {
  if (env.GITHUB_REPOSITORY)
    return {
      repository: env.GITHUB_REPOSITORY,
      codeHost: DEFAULT_CODE_HOST,
      runner: DEFAULT_RUNNER,
    };
  const s = await settings();
  return {
    repository: s.repository,
    codeHost: s.codeHost.type,
    runner: s.builds.runner,
  };
}
