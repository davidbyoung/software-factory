#!/usr/bin/env node
// The factory's settings, from `.claude/factory.yaml`. This is the one place
// they are read: a command loads them once when it starts and passes down
// what its functions need, and nothing under src/lib/ loads them.
//
//   factory config get KEY     # e.g. repository, tickets.board
//   factory plugins [ROLE]     # kind, name, role, files or labels
//   factory config check       # ✓ The settings are valid., or what is wrong
//
// A list prints one item per line. A failure names the key and exits 1.
import { colorOn, painter, plain, type Paint } from "./lib/color.mts";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { DEFAULT_CODE_HOST, unsupportedCodeHost } from "./code-host/index.mts";
import { matchesAny } from "./lib/glob.mts";
import { listed } from "./lib/listed.mts";
import { DEFAULT_RUNNER, unsupportedRunner } from "./runner/index.mts";
import { FACTORY_FIELDS, type FieldMapping } from "./ticket-fields.mts";
import { PR_LABELS, sameLabel, TICKET_LABELS, type Labels } from "./labels.mts";
import {
  BUILT,
  unsupported,
  type Built,
  type LabelFault,
} from "./tool-names.mts";
import {
  DEFAULT_COLUMNS,
  STATE_KEYS,
  sameName,
  watchOf,
  type Watch,
  type Columns,
  type StateKey,
  type Status,
} from "./lib/work-status.mts";

export class SettingsError extends Error {}

/** What a plugin does, in the order `factory plugins` prints them. */
export const ROLES = [
  "refiner",
  "mockups",
  "builder",
  "reviewer",
  "prover",
  "test-reviewer",
  "resolver",
] as const;
export type Role = (typeof ROLES)[number];
/** The phases `plugins` is grouped by. */
export const PHASES = ["refine", "build", "test", "conflicts"] as const;

type RoleShape = {
  phase: (typeof PHASES)[number];
  key: string;
  kind: Plugin["kind"];
  list: boolean;
  files: "required" | "optional" | "none";
  labels: "required" | "none";
};

/** A role's shape: one plugin with no files and no labels, unless `takes`
 * says otherwise. */
const shapeOf = (
  phase: RoleShape["phase"],
  key: string,
  kind: RoleShape["kind"],
  takes: Partial<Pick<RoleShape, "list" | "files" | "labels">> = {},
): RoleShape => ({
  phase,
  key,
  kind,
  list: false,
  files: "none",
  labels: "none",
  ...takes,
});

/** Each role: the phase and key it is written under, the one kind it
 * takes, whether it holds one plugin or a list, and whether a plugin in
 * it must have, may have, or cannot have `files` and `labels`. */
export const ROLE_SHAPE: Record<Role, RoleShape> = {
  refiner: shapeOf("refine", "refiner", "skill"),
  mockups: shapeOf("refine", "mockups", "skill"),
  builder: shapeOf("build", "builders", "skill", {
    list: true,
    labels: "required",
  }),
  reviewer: shapeOf("build", "reviewers", "agent", {
    list: true,
    files: "required",
  }),
  prover: shapeOf("test", "prover", "skill"),
  "test-reviewer": shapeOf("test", "reviewers", "agent", {
    list: true,
    files: "optional",
  }),
  resolver: shapeOf("conflicts", "resolvers", "skill", {
    list: true,
    files: "required",
  }),
};

/** A role's path in the settings, such as `plugins.build.reviewers`. */
const rolePath = (role: Role) =>
  `plugins.${ROLE_SHAPE[role].phase}.${ROLE_SHAPE[role].key}`;

/** The keys of each role's block, by its path in `SETTINGS_KEYS`: a list's
 * items are under the path with `[]` after it. */
const roleKeys = (): Record<string, string[]> =>
  Object.fromEntries(
    ROLES.map((role) => {
      const shape = ROLE_SHAPE[role];
      return [
        `${rolePath(role)}${shape.list ? "[]" : ""}`,
        [
          shape.kind,
          ...(shape.files === "none" ? [] : ["files"]),
          ...(shape.labels === "none" ? [] : ["labels"]),
          // Only the repository's own settings leave out a plugin that a
          // preset adds, and only from a list.
          ...(shape.list ? ["off"] : []),
        ],
      ];
    }),
  );
export const TRIGGERS = ["own-server", "github-action", "manual"] as const;
/** How often the scheduled poller may check the board, in minutes: each
 * divides an hour, so a schedule every N minutes keeps an even beat. */
export const POLL_MINUTES = [5, 10, 15, 30, 60] as const;
/** The values `specs` takes: none, or a spec tool built. */
export const SPECS = ["none", ...Object.keys(BUILT.specs)];

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
  version: 2;
  repository: string;
  tickets: {
    type: string;
    /** The keys the ticket system adds under `tickets`, by name. */
    options: Record<string, string>;
    board: number | null;
    /** Whether the ticket system has statuses of its own, which
     * `columns` maps whether or not there is a board. */
    statuses: boolean;
    /** The board's column for each state, null for none. */
    /** Each state's columns, the first the one a ticket moves to, or
     * null for none. */
    columns: Record<StateKey, readonly string[] | null>;
    /** The board's field for each of three the sync writes, null for none. */
    fields: Record<FieldKey, string | null>;
    /** Each ticket-side key under `tickets.fields`, the four factory fields
     * first and then any heading of the repository's own, with the ticket
     * field that holds it, or null for the description. */
    ticketFields: FieldMapping;
    /** The name of each label the factory puts on tickets. */
    labels: Labels["tickets"];
  };
  /** Where pull requests are, and the pattern a build's branch is named
   * by. The pattern is null only when init reads settings without it, to
   * ask for it. */
  codeHost: {
    type: string;
    branchName: string | null;
    /** The name of each label the factory puts on pull requests. */
    labels: Labels["codeHost"];
  };
  builds: {
    /** What notices a card moved to Ready and starts its build. */
    trigger: (typeof TRIGGERS)[number];
    /** Where an unattended build runs. */
    runner: string;
    /** How often the scheduled poller checks the board. */
    pollMinutes: (typeof POLL_MINUTES)[number];
    /** How many builds either poller starts in any one hour. */
    maxPerHour: number;
  };
  specs: string;
  /** The command that checks the specs, or null when `specs` is none. */
  specCheck: string | null;
  /** Every command a build runs, each from the repository's root. */
  commands: {
    /** Before an unattended build starts work. */
    buildSetup: string[];
    /** Before every commit a session makes. */
    beforeCommit: string[];
    /** Before a session reports a task done. */
    gate: string[];
    /** One test alone, with `FILE` and `NAME` in its environment. */
    testOne: string | null;
    /** One end-to-end spec alone, with `FILE` in its environment. */
    endToEnd: string | null;
    /** Coverage, and where its report lands. */
    coverage: { run: string; report: string } | null;
    /** Rebuilds the package manager's lock file after a conflict in it. */
    relock: string;
  };
  /** The plugins the settings name, in the roles' order. `pluginsOf` adds
   * the factory's own for each role left out. */
  plugins: Plugin[];
  /** Whether `plugins.test.reviewers` is written. Written, it is the whole
   * list of test reviewers, even when it is empty. */
  testReviewersWritten: boolean;
  autoMerge: { allow: string[]; deny: string[]; commands: string[] };
  /** The pull request review, on when `pr-review` is written, with the commands it
   * may run as prefixes beside the factory's own; null when it is off. */
  prReview: { commands: string[] } | null;
  /** How the factory looks at the repository's website; null when the
   * repository is not one. */
  site: Site | null;
  /** How long each kind of unattended session may run, in minutes. */
  sessionMinutes: Record<SessionKind, number>;
  /** The numbers the process rules use, which `factory sync` writes into
   * the copies of the rules and skills that state them. */
  rules: { smallChangeLines: number; reviewRounds: number };
};

/** Each number the rules use, with its default. */
export const RULE_NUMBERS = {
  "small-change-lines": 30,
  "review-rounds": 2,
} as const;

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
/** The agent that needs `commands.end-to-end`. */
export const E2E_AGENT = "factory-e2e-reviewer";
/** `commands.relock` where none is written. */
export const DEFAULT_RELOCK = "npm install";
export const NO_PLAYWRIGHT = "site needs Playwright: npm install -D playwright";

/** The keys each block allows, by the block's path: `""` is the top of the
 * file and `plugins.build.builders[]` is one builder. `settings.schema.json`
 * lists the same keys, and a test fails when the two differ. A key the code
 * accepts goes here, in the schema, and in docs/configuration.md. */
export const SETTINGS_KEYS: Record<string, readonly string[]> = {
  "": [
    "version",
    "repository",
    "presets",
    "tickets",
    "code-host",
    "builds",
    "specs",
    "commands",
    "plugins",
    "auto-merge",
    "pr-review",
    "site",
    "session-minutes",
    "rules",
  ],
  tickets: ["type", "board", "columns", "fields", "labels"],
  "tickets.labels": Object.keys(TICKET_LABELS),
  "tickets.columns": Object.keys(STATE_KEYS),
  "tickets.fields": [
    ...Object.keys(FIELD_DEFAULTS),
    ...FACTORY_FIELDS.map((f) => f.key),
  ],
  "code-host": ["type", "branch-name", "labels"],
  "code-host.labels": Object.keys(PR_LABELS),
  builds: ["trigger", "runner", "poll-minutes", "max-per-hour"],
  specs: ["type", "check"],
  commands: [
    "build-setup",
    "before-commit",
    "gate",
    "test-one",
    "end-to-end",
    "coverage",
    "relock",
  ],
  "commands.coverage": ["run", "report"],
  "auto-merge": ["allow", "deny", "commands"],
  "pr-review": ["commands"],
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
  plugins: PHASES,
  ...Object.fromEntries(
    PHASES.map((phase) => [
      `plugins.${phase}`,
      ROLES.filter((role) => ROLE_SHAPE[role].phase === phase).map(
        (role) => ROLE_SHAPE[role].key,
      ),
    ]),
  ),
  ...roleKeys(),
  "session-minutes": Object.keys(SESSION_MINUTES),
  rules: Object.keys(RULE_NUMBERS),
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

/** The pull request review's commands: each becomes `Bash(COMMAND:*)` in a list
 * that commas separate, so none may hold a comma, a parenthesis, or a
 * quote. */
function reviewCommands(v: unknown): string[] {
  const key = "pr-review.commands";
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

/** One side's label names: each key the file sets, checked by the tool
 * that shows it, and the rest at their defaults. */
function labelsOf<K extends string>(
  v: unknown,
  key: string,
  defaults: Record<K, string>,
  fault: LabelFault | undefined,
): { names: Record<K, string>; set: K[] } {
  const o = object(v, key);
  const set = (Object.keys(defaults) as K[]).filter((k) => o[k] !== undefined);
  const names = { ...defaults };
  for (const k of set) {
    const value = o[k];
    if (typeof value !== "string") fail(`${key}.${k}`, "must be text");
    const name = (value as string).trim();
    if (!name) fail(`${key}.${k}`, "must not be empty");
    const why = fault?.(name);
    if (why) fail(`${key}.${k}`, why);
    names[k] = name;
  }
  return { names, set };
}

/** Fails on two labels with one name, ignoring capitals, naming a key the
 * file sets: of two it sets, the later. Ticket and pull request labels are
 * compared only when one tool holds both. */
function sameNames(
  sides: { key: string; names: Record<string, string>; set: string[] }[],
  oneTool: boolean,
) {
  const groups = oneTool ? [sides] : sides.map((side) => [side]);
  for (const group of groups) {
    const all = group.flatMap((side) =>
      Object.entries(side.names).map(([k, name]) => ({
        at: `${side.key}.${k}`,
        name,
        set: side.set.includes(k),
      })),
    );
    for (const [i, b] of all.entries())
      for (const a of all.slice(0, i)) {
        if (!sameLabel(a.name, b.name)) continue;
        const [blamed, other] = b.set ? [b, a] : [a, b];
        fail(
          blamed.at,
          `"${blamed.name}" is already ${other.at}. Give each label its own name`,
        );
      }
  }
}

/** A key under `tickets.fields` naming a heading of the repository's own. */
export const OWN_HEADING = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The ticket-side keys under `tickets.fields`: the four factory fields,
 * each a ticket field's name or none, and any other key a heading of the
 * repository's own. Spec and Acceptance criteria may share a field. */
function ticketFieldsOf(o: Obj): FieldMapping {
  const out: FieldMapping = Object.fromEntries(
    FACTORY_FIELDS.map((f) => [f.key, null]),
  );
  const seen: [string, string][] = [];
  for (const [k, value] of Object.entries(o)) {
    if (k in FIELD_DEFAULTS) continue;
    const key = `tickets.fields.${k}`;
    if (!FACTORY_FIELDS.some((f) => f.key === k) && !OWN_HEADING.test(k))
      fail(key, "must be a heading in lowercase, with hyphens for spaces");
    if (value === "none") {
      out[k] = null;
      continue;
    }
    if (typeof value !== "string" || !value.trim())
      fail(key, "must be a name, or none");
    const name = (value as string).trim();
    const other = seen.find(
      ([o, n]) =>
        sameName(n, name) &&
        !([o, k].includes("spec") && [o, k].includes("acceptance-criteria")),
    );
    if (other) fail(key, `names the same field as ${other[0]}`);
    seen.push([k, name]);
    out[k] = name;
  }
  return out;
}

/** Each state's columns: a name, a list of names, or none. With a board,
 * every state is written, since the factory's own names describe one
 * board and a state left to them would read any other wrong. Without one,
 * each state keeps its own name, for the comments and `factory status`.
 * `partial` lets a board's block leave states out, each read as no column
 * and listed in `missing`, for init alone, which fills them in. Only an
 * approved ticket goes to ready, so it takes one name. */
function columnNames(
  v: unknown,
  board: number | null,
  partial: boolean,
  /** The ticket system, when it has statuses of its own. */
  statusesOf: string | null = null,
): {
  columns: Record<StateKey, readonly string[] | null>;
  missing: StateKey[];
} {
  const states = Object.entries(STATE_KEYS) as [StateKey, Status][];
  if (board === null && statusesOf === null)
    return {
      columns: Object.fromEntries(
        states.map(([k, status]) => [k, DEFAULT_COLUMNS[status]]),
      ) as Record<StateKey, readonly string[] | null>,
      missing: [],
    };
  const empty =
    v === undefined || v === null || (isObj(v) && !Object.keys(v).length);
  if (empty && !partial)
    fail(
      "tickets.columns",
      board === null
        ? `is required with tickets.type: ${statusesOf}: run factory init to choose which status shows each state`
        : `is required with tickets.board: run factory init to choose which of board ${board}'s columns shows each state`,
    );
  const o = empty ? {} : object(v, "tickets.columns");
  const missing = states.map(([k]) => k).filter((k) => o[k] === undefined);
  if (missing.length && !partial)
    fail(
      "tickets.columns",
      missing.length === 1
        ? `${missing[0]} has no column: give it a column, a list of columns, or none, or run factory init to choose it`
        : `${listed(missing)} have no column: give each a column, a list of columns, or none, or run factory init to choose them`,
    );
  const out = {} as Record<StateKey, readonly string[] | null>;
  for (const [k] of states) {
    const key = `tickets.columns.${k}`;
    const value = o[k];
    if (Array.isArray(value)) {
      if (k === "ready")
        fail(
          key,
          "must be one column, or none: only a ticket you approved goes there",
        );
      if (value.length === 0) fail(key, "must name at least one column");
      out[k] = value.map((n, i) =>
        typeof n === "string" && n.trim()
          ? n.trim()
          : fail(`${key}[${i}]`, "must be a name"),
      );
    } else if (value === undefined) out[k] = null;
    else if (value === "none") out[k] = null;
    else if (typeof value === "string" && value.trim()) out[k] = [value.trim()];
    else fail(key, "must be a name, a list of names, or none");
  }
  return { columns: out, missing };
}

export const BRANCH_PLACEHOLDERS = ["ticket", "user"] as const;
const QUOTED_EXAMPLE = 'branch-name: "{ticket}"';

/** The pattern a build's branch is named by, or null when it is left out
 * and `partial` lets it be, for init to ask for. */
function branchNameOf(v: unknown, partial: boolean): string | null {
  const key = "code-host.branch-name";
  if (v === undefined || v === null) {
    if (partial) return null;
    return fail(
      key,
      `is required. Run factory init to set it, or add it, such as ${QUOTED_EXAMPLE}`,
    );
  }
  if (isObj(v))
    return fail(key, `is a map, not a pattern. Quote it: ${QUOTED_EXAMPLE}`);
  if (typeof v !== "string")
    return fail(key, `must be a pattern, such as ${QUOTED_EXAMPLE}`);
  const fault = branchPatternFault(v);
  return fault ? fail(key, fault) : v;
}

/** Why a branch name pattern can't be used, in the words the settings
 * check prints after its key, or null when it can. The placeholders are
 * filled before git's rules are applied, so only the pattern's own text
 * can break them. */
export function branchPatternFault(pattern: string): string | null {
  for (const [, name] of pattern.matchAll(/\{([A-Za-z0-9-]+)\}/g))
    if (!(BRANCH_PLACEHOLDERS as readonly string[]).includes(name!))
      return `{${name}} is not a placeholder. The placeholders are ${listed(BRANCH_PLACEHOLDERS.map((p) => `{${p}}`))}`;
  if (!pattern.includes("{ticket}"))
    return "needs {ticket}, or every build gets the same branch";
  const reason = gitBranchFault(
    pattern.replaceAll("{ticket}", "1").replaceAll("{user}", "u"),
  );
  return reason && `${pattern} can't be a git branch name: ${reason}`;
}

/** The first of git's rules for a branch name (`git check-ref-format
 * --branch`) that `name` breaks, or null. */
function gitBranchFault(name: string): string | null {
  if (name.includes(" ")) return "it has a space";
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(name)) return "it has a control character";
  for (const s of ["..", "//", "@{", "~", "^", ":", "?", "*", "[", "\\"])
    if (name.includes(s)) return `it has ${s}`;
  for (const s of ["-", "/"])
    if (name.startsWith(s)) return `it starts with ${s}`;
  for (const s of ["/", ".lock", "."])
    if (name.endsWith(s)) return `it ends with ${s}`;
  const parts = name.split("/");
  if (parts.some((p) => p.startsWith("."))) return "a part starts with .";
  if (parts.some((p) => p.endsWith(".lock"))) return "a part ends with .lock";
  return null;
}

/** A part you can swap, written as a block with a `type` or as one word. */
function typed(v: unknown, key: string, extra?: readonly string[]): Obj {
  if (typeof v === "string") return { type: v };
  return object(v, key, key, extra);
}

/** One plugin, written at `key` in the role `role`. */
function plugin(v: unknown, key: string, role: Role): Plugin {
  const shape = ROLE_SHAPE[role];
  const other = shape.kind === "skill" ? "agent" : "skill";
  if (isObj(v) && (other in v || !(shape.kind in v)))
    fail(key, shape.kind === "skill" ? "names a skill" : "names an agent");
  const o = object(v, key, `${rolePath(role)}${shape.list ? "[]" : ""}`);
  const name = o[shape.kind];
  if (typeof name !== "string" || !/^[\w-]+$/.test(name))
    fail(`${key}.${shape.kind}`, "must be a name");
  const listed = (k: "files" | "labels") => {
    const list = strings(o[k], `${key}.${k}`);
    if (shape[k] === "required" && list.length === 0)
      fail(`${key}.${k}`, "is required");
    return list;
  };
  return {
    kind: shape.kind,
    name: name as string,
    role,
    files: listed("files"),
    labels: listed("labels"),
  };
}

/** The plugins `plugins` names, in the roles' order, and whether it
 * writes the list of test reviewers. */
function pluginsWritten(v: unknown): {
  plugins: Plugin[];
  testReviewersWritten: boolean;
} {
  if (Array.isArray(v))
    fail("plugins", `must be grouped by phase: ${PHASES.join(", ")}`);
  const phases = object(v ?? {}, "plugins");
  const roles = Object.fromEntries(
    PHASES.map((phase) => [
      phase,
      object(phases[phase] ?? {}, `plugins.${phase}`),
    ]),
  );
  const at = (role: Role) =>
    roles[ROLE_SHAPE[role].phase]![ROLE_SHAPE[role].key];
  return {
    plugins: ROLES.flatMap((role) => {
      const written = at(role);
      const key = rolePath(role);
      if (written === undefined) return [];
      if (!ROLE_SHAPE[role].list) return [plugin(written, key, role)];
      if (!Array.isArray(written)) return fail(key, "must be a list");
      // A plugin left out with `off: true` is not used, and its role still
      // counts as written.
      return written.flatMap((item, i) => {
        if (isObj(item) && "off" in item) {
          if (item.off !== true) fail(`${key}[${i}].off`, "must be true");
          return [];
        }
        return [plugin(item, `${key}[${i}]`, role)];
      });
    }),
    testReviewersWritten: at("test-reviewer") !== undefined,
  };
}

/** Where each of the settings' plugins is written, such as
 * `plugins.build.reviewers[0]`. */
function pluginPaths(plugins: Plugin[]): string[] {
  const seen = new Map<Role, number>();
  return plugins.map((p) => {
    if (!ROLE_SHAPE[p.role].list) return rolePath(p.role);
    const i = seen.get(p.role) ?? 0;
    seen.set(p.role, i + 1);
    return `${rolePath(p.role)}[${i}]`;
  });
}

/** A command written as one line of text, or null when it is not written. */
function command(v: unknown, key: string): string | null {
  if (v === undefined) return null;
  return typeof v === "string" && v ? v : fail(key, "must be text");
}

function commandsOf(v: unknown): Settings["commands"] {
  const o = object(v ?? {}, "commands");
  let coverage: Settings["commands"]["coverage"] = null;
  if (o.coverage !== undefined) {
    const c = object(o.coverage ?? {}, "commands.coverage");
    for (const k of ["run", "report"] as const)
      if (typeof c[k] !== "string" || !c[k])
        fail(
          `commands.coverage.${k}`,
          "is required when commands.coverage is written",
        );
    coverage = { run: c.run as string, report: c.report as string };
  }
  return {
    buildSetup: strings(o["build-setup"], "commands.build-setup"),
    beforeCommit: strings(o["before-commit"], "commands.before-commit"),
    gate: strings(o.gate, "commands.gate"),
    testOne: command(o["test-one"], "commands.test-one"),
    endToEnd: command(o["end-to-end"], "commands.end-to-end"),
    coverage,
    relock: command(o.relock, "commands.relock") ?? DEFAULT_RELOCK,
  };
}

/** The settings with every default filled in. Throws a SettingsError naming
 * the key on anything unsound. `exists` says whether a path from the root
 * exists, for the plugins' files. */
export function parseSettings(
  raw: unknown,
  exists: (path: string) => boolean,
  built: Built = BUILT,
  { partial = false }: { partial?: boolean } = {},
): Settings {
  const written = raw ?? {};
  // The version comes before any other key, so a file in the older shape is
  // told so, not told its keys are unknown.
  if (isObj(written)) {
    if (written.version === 1)
      fail(
        "version",
        'must be 2: this file is version 1, see "Moving to settings version 2" in docs/updating.md',
      );
    if (written.version !== 2) fail("version", "must be 2");
    for (const key of ["before-commit", "build-setup"])
      if (key in written) fail(key, `moved to commands.${key}`);
  }
  const top = object(written, "");
  strings(top.presets, "presets");
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

  const codeHostBlock = typed(top["code-host"], "code-host");
  const codeHost = codeHostBlock.type ?? DEFAULT_CODE_HOST;
  if (typeof codeHost !== "string" || !built.codeHost.includes(codeHost))
    throw new SettingsError(
      `${SETTINGS_FILE}: ${unsupportedCodeHost(String(codeHost), built.codeHost)}`,
    );
  const branchName = branchNameOf(codeHostBlock["branch-name"], partial);
  const ticketLabels = labelsOf(
    tickets.labels,
    "tickets.labels",
    TICKET_LABELS,
    built.labelFaults.tickets[ticketType],
  );
  const prLabels = labelsOf(
    codeHostBlock.labels,
    "code-host.labels",
    PR_LABELS,
    built.labelFaults.codeHost[codeHost],
  );
  sameNames(
    [
      { key: "tickets.labels", ...ticketLabels },
      { key: "code-host.labels", ...prLabels },
    ],
    ticketType === codeHost,
  );

  const builds = object(top.builds, "builds");
  const trigger = oneOf(builds.trigger, "builds.trigger", TRIGGERS, "manual");
  const minutes = builds["poll-minutes"];
  if (minutes !== undefined && trigger !== "github-action")
    throw new SettingsError(
      `${SETTINGS_FILE}: builds.poll-minutes needs builds.trigger: github-action`,
    );
  const pollMinutes =
    minutes === undefined
      ? 5
      : POLL_MINUTES.includes(minutes as (typeof POLL_MINUTES)[number])
        ? (minutes as (typeof POLL_MINUTES)[number])
        : fail(
            "builds.poll-minutes",
            `must be one of ${POLL_MINUTES.join(", ")}`,
          );
  const max = builds["max-per-hour"];
  const maxPerHour =
    max === undefined
      ? MAX_PER_HOUR
      : typeof max === "number" && Number.isInteger(max) && max >= 1
        ? max
        : fail("builds.max-per-hour", "must be a whole number, 1 or more");
  const runner = builds.runner ?? DEFAULT_RUNNER;
  if (typeof runner !== "string" || !built.runner.includes(runner))
    throw new SettingsError(
      `${SETTINGS_FILE}: ${unsupportedRunner(String(runner), built.runner)}`,
    );
  const hasBoard = typeof board === "number";
  const statuses = built.statuses.includes(ticketType);
  if (tickets.columns !== undefined && !hasBoard && !statuses)
    fail("tickets.columns", "needs tickets.board");
  const rawFields = isObj(tickets.fields) ? tickets.fields : {};
  const boardFields = Object.fromEntries(
    Object.entries(rawFields).filter(([k]) => k in FIELD_DEFAULTS),
  );
  if (Object.keys(boardFields).length && !hasBoard)
    fail("tickets.fields", "needs tickets.board");
  const { columns, missing } = columnNames(
    tickets.columns,
    hasBoard ? (board as number) : null,
    partial,
    statuses ? ticketType : null,
  );
  if (columns.backlog === null && !missing.includes("backlog"))
    fail(
      "tickets.columns.backlog",
      "cannot be none: every ticket starts there",
    );
  const seen = new Map<string, string>();
  for (const [key, list] of Object.entries(columns)) {
    for (const [i, name] of (list ?? []).entries()) {
      if (list!.slice(0, i).some((n) => sameName(n, name)))
        fail(`tickets.columns.${key}`, `names ${name} twice`);
      const other = [...seen].find(([n]) => sameName(n, name));
      if (other)
        fail(`tickets.columns.${key}`, `names the same column as ${other[1]}`);
    }
    for (const name of list ?? []) seen.set(name, key);
  }
  if (
    columns.ready === null &&
    trigger !== "manual" &&
    !missing.includes("ready")
  )
    fail(
      "tickets.columns.ready",
      "no column shows ready, so nothing would start a build: name one, or set builds.trigger to manual",
    );
  if (tickets.fields !== undefined && !isObj(tickets.fields))
    fail("tickets.fields", "must be a block of settings");
  const fieldNames = names(
    boardFields,
    "tickets.fields",
    FIELD_DEFAULTS,
  ) as Record<FieldKey, string | null>;
  const ticketFields = ticketFieldsOf(rawFields);
  const specsBlock = typed(top.specs ?? "none", "specs");
  const specs = oneOf(
    specsBlock.type,
    "specs",
    ["none", ...Object.keys(built.specs)],
    "none",
  );
  if (specsBlock.check !== undefined && specs === "none")
    throw new SettingsError(
      `${SETTINGS_FILE}: specs.check needs specs.type: openspec`,
    );
  const specCheck =
    specs === "none"
      ? null
      : (command(specsBlock.check, "specs.check") ?? built.specs[specs]!);
  const autoMerge = object(top["auto-merge"], "auto-merge");
  const prReview =
    top["pr-review"] === undefined
      ? null
      : object(top["pr-review"] ?? {}, "pr-review");

  const site = parseSite(top.site, exists);
  const commands = commandsOf(top.commands);
  const { plugins, testReviewersWritten } = pluginsWritten(top.plugins);
  // What an agent of the factory's needs comes before its file: the sync
  // writes the file only once the setting is there.
  const lists = (agent: string) =>
    plugins.some((p) => p.kind === "agent" && p.name === agent);
  if (!site && lists(SITE_AGENT))
    fail("site", `is required to list ${SITE_AGENT}`);
  if (commands.endToEnd === null && lists(E2E_AGENT))
    fail("commands.end-to-end", `is required to list ${E2E_AGENT}`);
  pluginPaths(plugins).forEach((key, i) => {
    const p = plugins[i]!;
    const path =
      p.kind === "skill"
        ? `.claude/skills/${p.name}/SKILL.md`
        : `.claude/agents/${p.name}.md`;
    if (!exists(path)) fail(`${key}.${p.kind}`, `${path} does not exist`);
  });

  return {
    version: 2,
    repository: top.repository as string,
    tickets: {
      type: ticketType,
      options,
      board: typeof board === "number" ? board : null,
      statuses,
      columns,
      fields: fieldNames,
      ticketFields,
      labels: ticketLabels.names,
    },
    codeHost: { type: codeHost, branchName, labels: prLabels.names },
    builds: { trigger, runner, pollMinutes, maxPerHour },
    specs,
    specCheck,
    commands,
    plugins,
    testReviewersWritten,
    autoMerge: {
      allow: strings(autoMerge.allow, "auto-merge.allow"),
      deny: strings(autoMerge.deny, "auto-merge.deny"),
      commands: strings(autoMerge.commands, "auto-merge.commands"),
    },
    prReview: prReview && { commands: reviewCommands(prReview.commands) },
    site,
    sessionMinutes: sessionMinutesOf(top["session-minutes"]),
    rules: rulesOf(top.rules),
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

function rulesOf(v: unknown): Settings["rules"] {
  const o = object(v ?? {}, "rules");
  const n = (k: keyof typeof RULE_NUMBERS) =>
    wholeNumber(o[k], `rules.${k}`, RULE_NUMBERS[k]);
  return {
    smallChangeLines: n("small-change-lines"),
    reviewRounds: n("review-rounds"),
  };
}

/** One line for each pattern that matches none of `files`: a stale pattern
 * is how a policy rots. */
export function patternWarnings(s: Settings, files: string[]): string[] {
  const paths = pluginPaths(s.plugins);
  const lists: [string, string[]][] = [
    ...s.plugins.map((p, i): [string, string[]] => [
      `${paths[i]}.files`,
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
  /** `.claude/factory.yaml`, or the file FACTORY_SETTINGS names. */
  readFile: () => string;
  exists: (path: string) => boolean;
  /** Whether an npm package resolves from the repository's root. */
  hasPackage: (name: string) => boolean;
  listFiles: () => string[];
  loadYaml: () => Promise<YamlLoad>;
  out: (line: string) => void;
  err: (line: string) => void;
  paint?: Paint;
  /** Where the settings come from when every command reads the lock:
   * `check` stops on a stale one. Unset, they are resolved from the files
   * the lock is made from. */
  lock?: { read: () => string | null; check: boolean };
  /** `.claude/factory.choices.yaml`, null when there is none. */
  readChoices?: () => string | null;
  /** The text of `.npmrc` at the root, or null. Read from disk unless
   * given. */
  readNpmrc?: () => string | null;
  /** Where presets are installed from. */
  root?: string;
  /** Which of the settings files differ from the last commit. */
  changed?: () => string[];
  /** A package's installed version: null when it is not installed, and
   * undefined where there is no node_modules to look in. */
  installed?: (pkg: string) => string | null | undefined;
};

export const NO_DEPENDENCIES =
  "The factory's settings cannot be read until dependencies are installed: run npm ci.";

/** js-yaml is loaded when needed, so a checkout without dependencies gets
 * one line saying what to do rather than a stack trace. */
async function yamlOf(d: Deps): Promise<YamlLoad> {
  try {
    return await d.loadYaml();
  } catch {
    throw new SettingsError(NO_DEPENDENCIES);
  }
}

const readOrNull = (path: string) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};

/** The settings resolved from the files the lock is made from: the
 * presets, `.claude/factory.yaml`, and the choices between them. */
export type Resolved = {
  settings: Settings;
  resolution: import("./preset.mts").Resolution;
  presets: import("./preset.mts").Found[];
  /** `.claude/factory.yaml` as written, and its text. */
  own: Record<string, unknown>;
  ownText: string;
  choices: Record<string, string>;
  choicesText: string | null;
  /** Whether a path exists, counting the files the presets ship. */
  exists: (path: string) => boolean;
};

/** The choices file read as a map from a key to a preset's name. */
export function parseChoices(
  text: string | null,
  load: YamlLoad,
): Record<string, string> {
  if (text === null) return {};
  const bad = () =>
    new SettingsError(
      '.claude/factory.choices.yaml: each line must be KEY: "PRESET"',
    );
  let v: unknown;
  try {
    v = load(text);
  } catch {
    throw bad();
  }
  if (v === null || v === undefined) return {};
  if (!isObj(v) || Object.values(v).some((x) => typeof x !== "string"))
    throw bad();
  return v as Record<string, string>;
}

/** js-yaml's error for `key: a: b`, said as the fix: the value needs
 * quotes. Null for any other error. */
function needsQuotes(e: unknown, text: string): string | null {
  const { reason, mark } = e as { reason?: string; mark?: { line: number } };
  if (reason !== "bad indentation of a mapping entry" || !mark) return null;
  const m = /^\s*([^\s:#][^:]*): (\S.*: .*?)\s*$/.exec(
    text.split("\n")[mark.line] ?? "",
  );
  if (!m || /^["'[{]/.test(m[2]!)) return null;
  const [, key, value] = m;
  return `line ${mark.line + 1}: ${key}: ${value} needs quotes around the name, such as ${key}: "${value}"`;
}

/** The settings combined from the factory's defaults, each preset in
 * `presets`, and `.claude/factory.yaml`, as `factory sync` combines them
 * into the lock. `factoryFile` and `ownFile` say which preset files are
 * kept back: the factory's own, and the repository's own. */
export async function resolveFiles(
  d: Deps,
  {
    partial = false,
    ...keep
  }: {
    factoryFile?: (path: string) => boolean;
    ownFile?: (path: string) => boolean;
    /** Read settings init fills in, as `parseSettings` takes it. */
    partial?: boolean;
  } = {},
): Promise<Resolved> {
  const load = await yamlOf(d);
  let ownText: string;
  let own: unknown;
  try {
    ownText = d.readFile();
    own = load(ownText);
  } catch (e) {
    throw new SettingsError(
      `${SETTINGS_FILE}: ${needsQuotes(e, ownText!) ?? (e as Error).message}`,
    );
  }
  const P = await import("./preset.mts");
  const top = isObj(own) ? own : {};
  const names = isObj(own) ? strings(top.presets, "presets") : [];
  const twice = names.find((n, i) => names.indexOf(n) !== i);
  if (twice) throw new SettingsError(`presets: ${twice} is listed twice`);
  const root = d.root ?? repoRoot();
  const presets: import("./preset.mts").Found[] = [];
  const layers: import("./preset.mts").Layer[] = [];
  const ships = new Map<string, [string, string][]>();
  for (const name of names) {
    let found: import("./preset.mts").Found;
    try {
      found = P.findPreset(root, name);
    } catch (e) {
      if (e instanceof P.PresetError) throw new SettingsError(e.message);
      throw e;
    }
    let raw: unknown;
    try {
      raw = load(readFileSync(join(found.dir, P.PRESET_FILE), "utf8"));
    } catch (e) {
      throw new SettingsError(`${name}: ${(e as Error).message}`);
    }
    const fault = P.presetFaults(raw)[0];
    if (fault)
      throw new SettingsError(`${name}: ${fault.key}: ${fault.message}`);
    // The version is the preset file's own, and never the repository's.
    const { version: _, ...settings } = raw as Record<string, unknown>;
    presets.push(found);
    layers.push({ name, raw: settings });
    ships.set(name, P.shipped(found.dir));
  }
  layers.push({ name: P.OWN, raw: top });
  const choicesText = d.readChoices?.() ?? null;
  const choices = parseChoices(choicesText, load);
  let resolution: import("./preset.mts").Resolution;
  try {
    resolution = P.combine({ layers, choices, ships, ...keep });
  } catch (e) {
    if (e instanceof P.PresetError) throw new SettingsError(e.message);
    throw e;
  }
  const exists = (path: string) => d.exists(path) || resolution.files.has(path);
  let settings: Settings;
  try {
    settings = parseSettings(isObj(own) ? resolution.raw : own, exists, BUILT, {
      partial,
    });
  } catch (e) {
    throw e instanceof SettingsError ? fromPreset(e, resolution) : e;
  }
  return {
    settings,
    resolution,
    presets,
    own: top,
    ownText,
    choices,
    choicesText,
    exists,
  };
}

/** A fault the settings' check found in a value a preset gave, named by
 * that preset rather than by `.claude/factory.yaml`. */
function fromPreset(
  e: SettingsError,
  r: import("./preset.mts").Resolution,
): SettingsError {
  const m = new RegExp(
    `^${SETTINGS_FILE.replace(/\./g, "\\.")}: ([^:]+): `,
  ).exec(e.message);
  if (!m) return e;
  const key = m[1]!.replace(/\[\d+\]/g, "");
  for (
    let at = key;
    at;
    at = at.includes(".") ? at.slice(0, at.lastIndexOf(".")) : ""
  ) {
    const from = r.sources.get(at)?.from;
    if (from === undefined) continue;
    if (!from || from === SETTINGS_FILE) return e;
    return new SettingsError(
      `${from}: ${e.message.slice(SETTINGS_FILE.length + 2)}`,
    );
  }
  return e;
}

/** Why the lock `d` reads is stale, or null when it is current or `d`
 * reads none. */
export async function staleOf(d: Deps): Promise<string | null> {
  if (!d.lock) return null;
  const load = await yamlOf(d);
  const P = await import("./preset.mts");
  const root = d.root ?? repoRoot();
  let own: string | null;
  try {
    own = d.readFile();
  } catch {
    own = null;
  }
  return P.staleReason({
    lock: d.lock.read(),
    own,
    choices: d.readChoices?.() ?? null,
    changed: d.changed ?? (() => []),
    installed:
      d.installed ??
      ((pkg) =>
        existsSync(join(root, "node_modules"))
          ? (P.findPackage(root, pkg)?.version ?? null)
          : undefined),
    load,
    npmrcNames: (await import("./npmrc.mts")).readNpmrc(
      d.readNpmrc
        ? d.readNpmrc()
        : existsSync(join(root, ".npmrc"))
          ? readFileSync(join(root, ".npmrc"), "utf8")
          : null,
    ).names,
  });
}

/** The settings in the lock, after checking it is current where `check`
 * says to. */
async function fromLock(
  d: Deps,
  lock: NonNullable<Deps["lock"]>,
): Promise<{ settings: Settings; text: string }> {
  const load = await yamlOf(d);
  const P = await import("./preset.mts");
  if (lock.check) {
    const reason = await staleOf(d);
    if (reason) throw new SettingsError(reason);
  }
  const text = lock.read();
  if (text === null) throw new SettingsError(P.staleMessages.missing);
  let parsed: ReturnType<typeof P.readLock>;
  try {
    parsed = P.readLock(text, load);
  } catch (e) {
    throw new SettingsError(`${P.LOCK_FILE}: ${(e as Error).message}`);
  }
  if (!parsed.settings) throw new SettingsError(P.staleMessages.earlier);
  return { settings: parseSettings(parsed.settings, d.exists), text };
}

/** The lines of the lock's `settings` block, as `factory config explain`
 * printed them when the lock was written. */
export function lockSettingsLines(text: string): string[] {
  const lines = text.split("\n");
  const start = lines.indexOf("settings:");
  if (start < 0) return [];
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line && !line.startsWith("  ")) break;
    out.push(line.slice(2));
  }
  return out;
}

/** The settings file: FACTORY_SETTINGS where it is set, for trying settings
 * against a board without changing the repository's, and otherwise the
 * repository's own. */
export const settingsPath = (
  root: string,
  env: Record<string, string | undefined> = process.env,
) => env.FACTORY_SETTINGS || `${root}/${SETTINGS_FILE}`;

/** The settings of the checkout at `root`, read from its lock, or from
 * the lock FACTORY_LOCK names without checking it is current, or from the
 * settings file FACTORY_SETTINGS names with no lock at all. */
export const defaultDeps = (
  root = repoRoot(),
  env: Record<string, string | undefined> = process.env,
): Deps => ({
  readFile: () => readFileSync(settingsPath(root, env), "utf8"),
  root,
  readChoices: () =>
    env.FACTORY_SETTINGS
      ? null
      : readOrNull(join(root, ".claude/factory.choices.yaml")),
  lock: env.FACTORY_LOCK
    ? { read: () => readOrNull(env.FACTORY_LOCK!), check: false }
    : env.FACTORY_SETTINGS
      ? undefined
      : {
          read: () => readOrNull(join(root, ".claude/factory.lock")),
          check: true,
        },
  changed: () => {
    try {
      return execFileSync(
        "git",
        [
          "status",
          "--porcelain",
          "--",
          SETTINGS_FILE,
          ".claude/factory.choices.yaml",
        ],
        { cwd: root, encoding: "utf8" },
      )
        .split("\n")
        .filter(Boolean)
        .map((l) => l.slice(3));
    } catch {
      return [];
    }
  },
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
  paint: painter(colorOn()),
});

/** The column each state shows in on the board, null for none. */
/** How many builds the poller starts in an hour unless
 * `builds.max-per-hour` says otherwise. */
export const MAX_PER_HOUR = 20;

export function columnsOf(s: Settings): Columns {
  return Object.fromEntries(
    Object.entries(STATE_KEYS).map(([key, status]) => [
      status,
      s.tickets.columns[key as StateKey],
    ]),
  ) as Columns;
}

/** The board's names for the fields the sync writes, null for none. */
export function fieldNamesOf(s: Settings) {
  return {
    session: s.tickets.fields.session,
    runsIn: s.tickets.fields["runs-in"],
    cost: s.tickets.fields.cost,
  };
}

/** The settings of the checkout at `root` resolved from the files the lock
 * is made from, for the commands that make or check the lock. */
export const filesDeps = (
  root = repoRoot(),
  env: Record<string, string | undefined> = process.env,
): Deps => ({ ...defaultDeps(root, env), lock: undefined });

/** The settings of the checkout the command runs in: from its lock, or
 * resolved from the files where `d` reads no lock. */
export async function loadSettings(d: Deps = defaultDeps()): Promise<Settings> {
  return d.lock
    ? (await fromLock(d, d.lock)).settings
    : (await resolveFiles(d)).settings;
}

function lookup(s: Settings, key: string): unknown {
  if (key === "specs.check") return s.specCheck;
  // Coverage is a block whether or not it is written, and its two keys
  // print `none` when it is not.
  if (key === "commands.coverage") return undefined;
  if (s.commands.coverage === null)
    for (const k of SETTINGS_KEYS["commands.coverage"]!)
      if (key === `commands.coverage.${k}`) return null;
  const camel: Record<string, string> = {
    "before-commit": "beforeCommit",
    "build-setup": "buildSetup",
    "test-one": "testOne",
    "end-to-end": "endToEnd",
    "auto-merge": "autoMerge",
    "pr-review": "prReview",
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

/** Every plugin the factory will use, in the roles' order: the settings'
 * own, and the factory's for each role they leave out. The refiner and the
 * prover are always there. The factory's test reviewer is there unless the
 * settings write the list. Its design skill is the mockups plugin of a
 * site that names none, once it is synced. */
export function pluginsOf(
  s: Settings,
  exists: (path: string) => boolean,
): Plugin[] {
  const builtIn = (kind: Plugin["kind"], name: string, role: Role): Plugin => ({
    kind,
    name,
    role,
    files: [],
    labels: [],
  });
  const fallback: Record<Role, Plugin[]> = {
    refiner: [builtIn("skill", "factory-refine", "refiner")],
    mockups:
      s.site && exists(DESIGN_SKILL)
        ? [builtIn("skill", "factory-design", "mockups")]
        : [],
    builder: [],
    reviewer: [],
    prover: [builtIn("skill", "factory-mutate", "prover")],
    "test-reviewer": s.testReviewersWritten
      ? []
      : [builtIn("agent", "factory-test-reviewer", "test-reviewer")],
    resolver: [],
  };
  return ROLES.flatMap((role) => {
    const own = s.plugins.filter((p) => p.role === role);
    return own.length ? own : fallback[role];
  });
}

export async function main(argv: string[], d: Deps): Promise<number> {
  const [command, arg] = argv;
  if (!command) {
    d.err(
      "Usage: factory config get KEY | config check | config explain | plugins [ROLE]",
    );
    return 2;
  }
  // `config check` reads the files the lock is made from, so it can say
  // what is wrong with them while the lock is stale; everything else reads
  // the lock.
  let s: Settings;
  let resolved: Resolved | null = null;
  let lockText: string | null = null;
  try {
    if (d.lock && command !== "check") {
      const read = await fromLock(d, d.lock);
      s = read.settings;
      lockText = read.text;
    } else {
      resolved = await resolveFiles({ ...d, lock: undefined });
      s = resolved.settings;
    }
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
          `warning: ${DESIGN_SKILL} is missing: run \`factory sync\` to give the site its design skill`,
        );
    d.out(`${(d.paint ?? plain)("green", "✓")} The settings are valid.`);
    return 0;
  }
  if (command === "explain") {
    const { explainLines, markerOf, paintExplainLines } =
      await import("./explain.mts");
    const lines =
      lockText !== null
        ? lockSettingsLines(lockText)
        : await explainLines(
            s,
            markerOf(resolved!.resolution),
            resolved!.exists,
          );
    // Printed only: the lock holds the settings, not how to read them.
    const header = [
      '# The settings in effect. "# default" marks the factory\'s own value,',
      "# a preset's name marks that preset's, and an unmarked line is yours.",
    ];
    for (const line of paintExplainLines(
      [...header, ...lines],
      d.paint ?? plain,
    ))
      d.out(line);
    return 0;
  }
  if (command === "plugins") {
    if (arg && !(ROLES as readonly string[]).includes(arg)) {
      d.err(`${arg}: must be one of ${ROLES.join(", ")}`);
      return 1;
    }
    for (const p of pluginsOf(s, d.exists)) {
      if (arg && p.role !== arg) continue;
      d.out([p.kind, p.name, p.role, ...p.files, ...p.labels].join(" "));
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
  /** What starts builds from the board, and how long it may take. */
  watch: Watch | null;
  /** The column each state shows in on the board. */
  columns: Columns;
  /** The name of the follow-ups ticket's label. */
  followUp: string;
  /** The name of the label on every ticket the factory works on. */
  factory: string;
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
    watch: watchOf(s.builds.trigger, s.builds.pollMinutes),
    columns: columnsOf(s),
    followUp: s.tickets.labels["follow-up"],
    factory: s.tickets.labels.factory,
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
