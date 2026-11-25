// Writes the factory's skills, agents, rules, and review instructions from
// the package into the repository, the two workflow files that call the
// factory's own workflows, the agents and skills its presets ship, its hook
// entries into `.claude/settings.json`, the rules' import into `CLAUDE.md`,
// and `.claude/factory.lock`: the factory's version, the commit each preset
// is pinned to, the settings in effect, and the files it wrote. Every other
// command reads the settings from the lock.
//
//   factory sync           # write what differs
//   factory sync --check   # write nothing; exit 1 naming what differs
//   factory sync --check --against COMMIT [--public]
//                          # and check each pin that differs from the
//                          # lock at COMMIT against its preset's repository
//
// A copy is the source, byte for byte but for the rules' numbers the
// settings give. Edit the source in the package, never the copy. The two
// workflow files are written from the settings (`workflow-files.mts`). A
// file the lock lists that this version no longer writes is deleted.
// Nothing else is.
import type { Registry } from "./tools.mts";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { firstRefusal, npmrcAt } from "./npmrc.mts";
import { refOf } from "./tickets/index.mts";
import {
  FACTORY_FILE,
  factoryWorkflow,
  REVIEW_FILE,
  reviewWorkflow,
  type Part,
  type WorkflowOptions,
} from "./workflow-files.mts";
import {
  filesDeps,
  repoRoot,
  resolveFiles,
  RULE_NUMBERS,
  staleOf,
  defaultDeps,
  PresetsError,
  type Resolved,
  type Settings,
  SETTINGS_FILE,
} from "./config.mts";
import {
  CHOICES_FILE,
  choicesText,
  fileHash,
  pinLines,
  pinsOf,
  scalar,
  settingsHash,
  staleChoices,
  yamlDump,
  type Pinned,
  type Replaced,
} from "./preset.mts";
import {
  fetchDeps,
  fileAt,
  pinFaults,
  shippedText,
  type FetchDeps,
} from "./preset-fetch.mts";
import { sameRepository, WORK } from "./lib/repositories.mts";
import {
  branchDeps,
  needDefaultBranch,
  NoDefaultBranch,
} from "./lib/default-branch.mts";
import * as say from "./lib/output.mts";

/** The package's own folder: the parent of `src/`, or of `dist/` once
 * compiled. */
export const PACKAGE = dirname(dirname(fileURLToPath(import.meta.url)));

export const LOCK = ".claude/factory.lock";
export const SETTINGS_JSON = ".claude/settings.json";
export const CLAUDE_MD = "CLAUDE.md";
export const IMPORT_LINE = "@.claude/factory/rules.md";
const LAUNCHER = "bin/factory.js";

const DEPENDABOT = ".github/dependabot.yml";

/** Whether the repository has a file, by its path from the root. */
type Has = (path: string) => boolean;

/** A part of the package written only when a setting or a file in the
 * repository turns it on, by its path in the package: a skill's folder or
 * an agent's file. Everything else is the factory's core, called by its
 * own steps, and is written to every repository. */
export const NEEDS: Record<string, (s: Settings, has: Has) => boolean> = {
  "skills/factory-design": (s) => s.site !== null,
  "agents/factory-ui-reviewer.md": (s) => s.site !== null,
  "agents/factory-e2e-reviewer.md": (s) => s.commands.endToEnd !== null,
  "skills/factory-deps": (_, has) => has(DEPENDABOT),
};

/** The parts that are on, which a job of the factory's workflows is
 * skipped without, in the order the workflow files list them. */
export function partsOn(s: Settings, has: Has): Part[] {
  const on: [Part, boolean][] = [
    ["review", s.prReview !== null],
    ["board", s.tickets.board !== null || s.tickets.statuses],
    ["auto-merge", s.autoMerge.allow.length > 0],
    ["poller", s.builds.trigger === "github-action" && !s.builds.pollerIn],
    ["dependabot", has(DEPENDABOT)],
  ];
  return on.filter(([, is]) => is).map(([part]) => part);
}

const WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];
const ORDINALS = [
  "zeroth",
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
  "eleventh",
];
const count = (n: number) => WORDS[n] ?? String(n);
const ordinal = (n: number) =>
  ORDINALS[n] ??
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
const capital = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const rounds = (n: number) => `${count(n)} round${n === 1 ? "" : "s"}`;

/** The phrases in a copied file that state one of the rules' numbers, by
 * the file's path in the package: each the default's words, the setting's
 * words, and whether the setting differs from its default. */
const RULE_PHRASES: Record<
  string,
  (r: Settings["rules"]) => [RegExp, string, boolean][]
> = {
  "rules.md": (r) => [
    [
      /under about 30 lines/g,
      `under about ${r.smallChangeLines} lines`,
      r.smallChangeLines !== RULE_NUMBERS["small-change-lines"],
    ],
    [
      /After two rounds,/g,
      `After ${rounds(r.reviewRounds)},`,
      r.reviewRounds !== RULE_NUMBERS["review-rounds"],
    ],
  ],
  "skills/factory-address-review/SKILL.md": (r) => [
    [
      /^## 6\. Two rounds, then escalate$/gm,
      `## 6. ${capital(rounds(r.reviewRounds))}, then escalate`,
      r.reviewRounds !== RULE_NUMBERS["review-rounds"],
    ],
    [
      /at most two(\s+)rounds\*\*\. When the third review arrives/g,
      `at most ${count(r.reviewRounds)}$1round${r.reviewRounds === 1 ? "" : "s"}**. When the ${ordinal(r.reviewRounds + 1)} review arrives`,
      r.reviewRounds !== RULE_NUMBERS["review-rounds"],
    ],
  ],
};

/** A copy with the rules' numbers the settings give in place of the
 * defaults. A phrase is replaced only when its number is not the default,
 * and must then match exactly once. */
export function withRules(text: string, r: Settings["rules"], file: string) {
  let out = text;
  for (const [pattern, words, set] of RULE_PHRASES[file]?.(r) ?? []) {
    if (!set) continue;
    if ((out.match(pattern) ?? []).length !== 1)
      throw new Error(
        `${file}: expected one match for ${pattern.source}, to set a number from rules`,
      );
    out = out.replace(pattern, words);
  }
  return out;
}

function walk(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory()
        ? walk(path, base)
        : [relative(base, path).split(sep).join("/")];
    });
}

/** Each copy, as [path in the package, path in the repository]. */
export function copies(pkg: string, s: Settings, has: Has): [string, string][] {
  const wanted = (from: string) => {
    const [kind, name] = from.split("/");
    const needs = NEEDS[`${kind}/${name}`];
    return !needs || needs(s, has);
  };
  const out: [string, string][] = [];
  const add = (dir: string, to: string) => {
    for (const f of walk(join(pkg, dir)))
      if (wanted(`${dir}/${f}`)) out.push([`${dir}/${f}`, `${to}/${f}`]);
  };
  add("skills", ".claude/skills");
  add("agents", ".claude/agents");
  out.push(["rules.md", ".claude/factory/rules.md"]);
  out.push(["review.md", ".github/factory-review.md"]);
  return out;
}

/** The launcher's path from the repository's root, where the package is in
 * the repository: the root's own, where the repository is the package
 * itself, and the package's own folder, as a workspace has it. Null
 * anywhere else, where the hooks run the factory installed on the machine. */
export function launcherPath(pkg: string, root: string): string | null {
  const rel = relative(realpathSync(root), realpathSync(pkg))
    .split(sep)
    .join("/");
  if (rel === "") return LAUNCHER;
  return !rel.startsWith("..") && !rel.startsWith("/")
    ? `${rel}/${LAUNCHER}`
    : null;
}

type HookEntry = {
  type: "command";
  command: string;
  timeout?: number;
  statusMessage?: string;
};
type HookGroup = { matcher?: string; hooks: HookEntry[] };
type ClaudeSettings = {
  hooks?: Record<string, HookGroup[]>;
  permissions?: { additionalDirectories?: unknown } & Record<string, unknown>;
} & Record<string, unknown>;

/** What a hook prints where the factory is not installed on the machine. */
export const notInstalled = (name: string) =>
  `The factory is not installed on this machine. Install it once: npm install -g ${name}`;

/** The hook entries: one per event, and a second before a tool runs, the
 * guard on the credentials file for the tools that read, search, and list
 * files. With no `launcher` they run the machine's `factory`, the package
 * `name` installs. Where it is missing, the two guards block the call,
 * since exit 2 is what stops a tool, the session-start hook says so on
 * stdout, which a session shows, and the rest do nothing. */
export function factoryHooks(
  launcher: string | null,
  name = "",
): [string, HookGroup][] {
  const factory = launcher
    ? `node "$CLAUDE_PROJECT_DIR"/${launcher}`
    : "factory";
  const unless = (otherwise: string) =>
    launcher ? "" : `command -v factory >/dev/null 2>&1 || ${otherwise}; `;
  const say = `echo "${notInstalled(name)}"`;
  const run = (args: string) => `${factory} ${args}`;
  const installed = unless(`{ ${say} >&2; exit 2; }`);
  const guard = (args: string) => `${installed}${factory} ${args}`;
  // It runs before every file read, search, and listing, so the shell
  // starts the factory only for an input that holds the file's path.
  const named = `input=$(cat); case "$input" in *software-factory/credentials*) ;; *) exit 0 ;; esac; printf '%s' "$input" | `;
  return [
    [
      "SessionStart",
      {
        hooks: [
          {
            type: "command",
            command: `${unless(`{ ${say}; exit 0; }`)}${run("session-start")}`,
            timeout: 30,
          },
        ],
      },
    ],
    [
      "PreToolUse",
      {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            command: guard("guard"),
            timeout: 180,
            statusMessage: "Checking the factory's guards",
          },
        ],
      },
    ],
    [
      "PreToolUse",
      {
        matcher: "Read|Grep|Glob",
        hooks: [
          {
            type: "command",
            command: `${installed}${named}${run("guard credentials")}`,
            timeout: 30,
          },
        ],
      },
    ],
    [
      "PermissionRequest",
      {
        matcher: "Write|Edit|MultiEdit",
        hooks: [
          {
            type: "command",
            command: `${unless("exit 0")}${run("guard permission")}`,
            timeout: 30,
          },
        ],
      },
    ],
    [
      "SubagentStart",
      {
        hooks: [
          {
            type: "command",
            command: `${run("reviewers start")} 2>/dev/null || true`,
            timeout: 30,
          },
        ],
      },
    ],
    [
      "SubagentStop",
      {
        hooks: [
          {
            type: "command",
            command: `${run("reviewers stop")} 2>/dev/null || true`,
            timeout: 30,
          },
        ],
      },
    ],
  ];
}

/** Claude Code's lines that name an AI in a commit and a pull request, all
 * off: a person's account owns every commit. It is in this file because a
 * session that runs where nobody's own settings reach, as a build in GitHub
 * Actions does, reads the repository's. */
const NO_ATTRIBUTION = { commit: "", pr: "", sessionUrl: false };

/** An entry that runs the factory: its launcher by path, as the factory's
 * own repository and every earlier release wrote it, or the machine's
 * `factory` on one of the three commands the hooks run. */
const isFactory = (h: HookEntry) =>
  typeof h.command === "string" &&
  (h.command.includes(`/${LAUNCHER}`) ||
    /(?:^|[\s;&|{(])factory (?:session-start|guard|reviewers)\b/.test(
      h.command,
    ));

/** `.claude/settings.json` with the entries that run the factory's launcher
 * replaced by those above, and attribution turned off unless the file
 * sets its own. Every other entry stays, in its order. */
export function withHooks(
  text: string | null,
  launcher: string | null,
  name = "",
): string {
  const settings: ClaudeSettings = text ? JSON.parse(text) : {};
  const hooks = othersHooks(settings);
  for (const [event, group] of factoryHooks(launcher, name))
    (hooks[event] ??= []).push(group);
  const attribution = settings.attribution ?? NO_ATTRIBUTION;
  return written({
    ...settings,
    permissions: withWork(settings),
    attribution,
    hooks,
  });
}

/** The file's text, with the list of folders on one line where it fits, as
 * a formatter writes it. */
function written(settings: ClaudeSettings): string {
  const text = JSON.stringify(settings, null, 2).replace(
    /^( *"additionalDirectories": )\[\n([^\]]*)\n *\]/m,
    (whole, head: string, items: string) => {
      const line = `${head}[${items
        .split("\n")
        .map((item) => item.trim())
        .join(" ")}]`;
      return line.length <= 79 ? line : whole;
    },
  );
  return `${text}\n`;
}

/** The folders a session may also edit, the one the clones of a ticket's
 * other repositories go in apart. */
const otherFolders = (settings: ClaudeSettings): unknown[] => {
  const listed = settings.permissions?.additionalDirectories;
  return Array.isArray(listed) ? listed.filter((d) => d !== WORK) : [];
};

const withWork = (settings: ClaudeSettings) => ({
  ...settings.permissions,
  additionalDirectories: [...otherFolders(settings), WORK],
});

/** The permissions without that folder, or undefined when none are left. */
function withoutWork(settings: ClaudeSettings) {
  if (!settings.permissions) return undefined;
  const { additionalDirectories: _, ...rest } = settings.permissions;
  const others = otherFolders(settings);
  const left = others.length
    ? { ...rest, additionalDirectories: others }
    : rest;
  return Object.keys(left).length ? left : undefined;
}

/** Every hook entry that is not the factory's, by event. */
function othersHooks(settings: ClaudeSettings): Record<string, HookGroup[]> {
  const hooks: Record<string, HookGroup[]> = {};
  for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
    const kept = groups
      .map((g) => ({ ...g, hooks: g.hooks.filter((h) => !isFactory(h)) }))
      .filter((g) => g.hooks.length > 0);
    if (kept.length) hooks[event] = kept;
  }
  return hooks;
}

/** Whether every event of the five has the factory's entry. */
export function hasFactoryHooks(text: string | null): boolean {
  if (!text) return false;
  const hooks = (JSON.parse(text) as ClaudeSettings).hooks ?? {};
  return factoryHooks(LAUNCHER).every(([event]) =>
    (hooks[event] ?? []).some((g) => g.hooks.some(isFactory)),
  );
}

/** Whether any hook entry is the factory's. */
export function hasAnyFactoryHook(text: string | null): boolean {
  if (!text) return false;
  const hooks = (JSON.parse(text) as ClaudeSettings).hooks ?? {};
  return Object.values(hooks).some((groups) =>
    groups.some((g) => g.hooks.some(isFactory)),
  );
}

/** `.claude/settings.json` with the factory's entries taken out and an
 * emptied `hooks` dropped, or null when nothing is left. */
export function withoutHooks(text: string): string | null {
  const {
    hooks: _,
    permissions: __,
    ...others
  } = JSON.parse(text) as ClaudeSettings;
  const permissions = withoutWork(JSON.parse(text) as ClaudeSettings);
  const rest = permissions ? { ...others, permissions } : others;
  const hooks = othersHooks(JSON.parse(text) as ClaudeSettings);
  const after = Object.keys(hooks).length ? { ...rest, hooks } : rest;
  return Object.keys(after).length ? written(after) : null;
}

export const hasImport = (text: string | null): boolean =>
  text !== null && text.split("\n").some((line) => line.trim() === IMPORT_LINE);

/** `CLAUDE.md` with the rules' import added when no line is that import. */
export function withImport(text: string | null): string {
  if (text === null) return `${IMPORT_LINE}\n`;
  if (hasImport(text)) return text;
  return `${text}${text.endsWith("\n") || !text ? "" : "\n"}\n${IMPORT_LINE}\n`;
}

/** `CLAUDE.md` without the rules' import, nor the blank line `withImport`
 * put before it, or null when nothing else is left. */
export function withoutImport(text: string): string | null {
  const lines = text.split("\n");
  const at = lines.findIndex((line) => line.trim() === IMPORT_LINE);
  if (at < 0) return text;
  const from = at > 0 && lines[at - 1] === "" ? at - 1 : at;
  lines.splice(from, at - from + 1);
  const after = lines.join("\n");
  return after.trim() ? after : null;
}

export type LockParts = {
  version: string;
  /** The `presets` block, as `pinLines` writes it. */
  presets: string[];
  hash: string;
  /** The variables `.npmrc`'s sign-in lines read. */
  npmrcVariables: string[];
  /** The settings in effect, as `factory config explain` prints them. */
  settings: string[];
  overridden: Record<string, Replaced[]>;
  files: string[];
};

export function lockText(l: LockParts): string {
  const replaced = Object.entries(l.overridden);
  return [
    "# Written by `factory sync`: the factory's version, the presets, the",
    "# settings in effect, and the files it wrote. Do not edit.",
    `version: ${l.version}`,
    ...l.presets,
    `settings-hash: ${l.hash}`,
    ...(l.npmrcVariables.length
      ? ["npmrc-variables:", ...l.npmrcVariables.map((n) => `  - ${n}`)]
      : ["npmrc-variables: []"]),
    "settings:",
    ...l.settings.map((line) => `  ${line}`),
    ...(replaced.length
      ? [
          "overridden:",
          ...replaced.flatMap(([key, values]) => [
            `  ${scalar(key)}:`,
            ...values.flatMap((r) => [
              `    - from: ${JSON.stringify(r.from)}`,
              `      value: ${JSON.stringify(r.value)}`,
            ]),
          ]),
        ]
      : ["overridden: {}"]),
    "files:",
    ...l.files.map((f) => `  - ${f}`),
    "",
  ].join("\n");
}

/** The files a lock lists, from any release's lock. One that a merge left
 * with conflict markers is read line by line, from each side's `files`. */
export function lockedFiles(
  text: string | null,
  load: (t: string) => unknown,
): string[] {
  if (!text) return [];
  try {
    const o = load(text) as { files?: unknown } | null;
    return Array.isArray(o?.files) ? o.files.map(String) : [];
  } catch {
    const out: string[] = [];
    let inFiles = false;
    for (const line of text.split("\n")) {
      if (/^files:/.test(line)) inFiles = true;
      else if (/^\S/.test(line) && !/^(<{7}|={7}|>{7})/.test(line))
        inFiles = false;
      const item = inFiles ? /^ {2}- (.+)$/.exec(line)?.[1] : undefined;
      if (item && !out.includes(item)) out.push(item);
    }
    return out;
  }
}

export type Plan = {
  /** Path from the root, and its text, for each file a sync writes. */
  write: Map<string, string>;
  /** Paths the lock lists that this version no longer writes, and the
   * choices file once its last choice is dropped. */
  remove: string[];
  /** A line for each preset file left as it is. */
  kept: string[];
  /** Each preset's file whose copy is missing or is not what the lock
   * records, and that could not be copied again from its preset. */
  unrestored: { path: string; preset: string }[];
  /** A line for each choice dropped. */
  dropped: string[];
};

/** What a sync of `root` from `pkg` writes and deletes, in a repository
 * whose default branch is `branch`. `restore` gives the text of a file a
 * preset ships, or null when its repository cannot be read; without it no
 * copy is restored. */
export async function plan(
  pkg: string,
  root: string,
  r: Resolved,
  branch: string,
  systems?: Registry["tickets"],
  restore?: (pin: Pinned, path: string) => string | null,
): Promise<Plan> {
  const { load, dump } = await import("js-yaml");
  const { explainLines, markerOf } = await import("./explain.mts");
  const s = r.settings;
  const manifest = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8"));
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : null;
  const write = new Map<string, string>();
  const has = (p: string) => existsSync(join(root, p));
  const npmrc = npmrcAt(root);
  // The registry loads the coding agent, which imports this file.
  const ticketTool = (systems ?? (await import("./tools.mts")).TOOLS.tickets)[
    s.tickets.type
  ];
  const credential = ticketTool?.setup.credential;
  const ticketNames = credential?.parts.map((p) => p.name) ?? [];
  for (const [from, to] of copies(pkg, s, has))
    write.set(
      to,
      withRules(readFileSync(join(pkg, from), "utf8"), s.rules, from),
    );
  const launcher = launcherPath(pkg, root);
  const workflows: WorkflowOptions = {
    // The factory's own repository runs the workflows in the same commit.
    version: launcher === LAUNCHER ? null : manifest.version,
    branch,
    parts: partsOn(s, has),
    pollMinutes:
      s.builds.trigger === "github-action" && !s.builds.pollerIn
        ? s.builds.pollMinutes
        : null,
    ref: refOf(s.tickets.type),
    minutes: s.sessionMinutes,
    overrideLabel: s.codeHost.labels["verdict-override"],
    secrets: [...new Set([...npmrc.names, ...ticketNames])],
  };
  write.set(FACTORY_FILE, factoryWorkflow(workflows));
  write.set(REVIEW_FILE, reviewWorkflow(workflows));
  const files = [...write.keys()];
  // A preset's agent or skill, unless the factory's own file or one the
  // repository wrote itself is at its path: those always stay. The copy
  // here is kept while it is what the lock records, so no preset's
  // repository is read for it.
  const previous = lockedFiles(read(LOCK), load);
  const kept: string[] = [];
  const unrestored: Plan["unrestored"] = [];
  for (const [to, { from, hash }] of r.resolution.files) {
    if (write.has(to)) kept.push(`kept ${to}, the factory's own, over ${from}`);
    else if (existsSync(join(root, to)) && !previous.includes(to))
      kept.push(`kept ${to}, this repository's own, over ${from}`);
    else {
      const copy = read(to);
      const text =
        copy !== null && fileHash(copy) === hash
          ? copy
          : (restore?.(
              r.presets.find((p) => p.name === from)!,
              to,
            ) ?? null);
      if (text === null) unrestored.push({ path: to, preset: from });
      else write.set(to, text);
      files.push(to);
    }
  }
  write.set(
    SETTINGS_JSON,
    withHooks(read(SETTINGS_JSON), launcher, manifest.name),
  );
  write.set(CLAUDE_MD, withImport(read(CLAUDE_MD)));

  // A choice whose preset is gone, or no longer sets its key, is dropped.
  const stale = staleChoices(
    r.choices,
    r.presets.map((p) => p.name),
    r.resolution.setBy,
  );
  const choices = { ...r.choices };
  for (const c of stale) delete choices[c.key];
  const chosen = stale.length ? choicesText(choices) : r.choicesText;
  const remove: string[] = [];
  if (stale.length) {
    if (chosen === null) remove.push(CHOICES_FILE);
    else write.set(CHOICES_FILE, chosen);
  }

  const settings = await explainLines(
    s,
    markerOf(r.resolution),
    (p) => r.exists(p) || write.has(p),
  );
  write.set(
    LOCK,
    lockText({
      version: manifest.version,
      presets: pinLines(r.presets, yamlDump(dump)),
      hash: settingsHash(r.ownText, chosen),
      npmrcVariables: npmrc.names,
      settings,
      overridden: Object.fromEntries(r.resolution.overridden),
      files,
    }),
  );
  remove.unshift(
    ...previous.filter((p) => !files.includes(p) && existsSync(join(root, p))),
  );
  return {
    write,
    remove: remove.filter((p) => existsSync(join(root, p))),
    kept,
    unrestored,
    dropped: stale.map((c) => `dropped the choice for ${c.key}: ${c.reason}`),
  };
}

/** The paths whose content a sync would change, in the plan's order. */
export function differences(root: string, p: Plan): string[] {
  const changed = [...p.write]
    .filter(([path, text]) => {
      const at = join(root, path);
      return !existsSync(at) || readFileSync(at, "utf8") !== text;
    })
    .map(([path]) => path);
  // The lock comes last, as it records everything before it.
  return [
    ...changed.filter((path) => path !== LOCK),
    ...p.unrestored.map((u) => u.path),
    ...p.remove,
    ...changed.filter((path) => path === LOCK),
  ];
}

export async function main(
  argv: string[],
  d: {
    root: string;
    pkg: string;
    settings: () => Promise<Resolved>;
    /** Why the lock is stale, or null when it is current. */
    stale: () => Promise<string | null>;
    /** The repository's default branch. It rejects with NoDefaultBranch
     * when it cannot be told. */
    defaultBranch: (s: Settings) => Promise<string>;
    out: say.Out;
    err: say.Out;
    /** Whether a person ran it, so a sync that changes nothing says so;
     * `init` and the preset commands run it inside their own output. */
    announce?: boolean;
    /** What reads a preset's repository, for these settings: to copy a
     * file again, and to check a pin. Without it neither is done. */
    fetch?: (s: Settings) => FetchDeps;
    /** A file's text at a git revision, or null when it has none there. */
    show?: (ref: string, path: string) => string | null;
    /** The repository the pull request being checked is in, or null when
     * none is. */
    pullIn?: string | null;
  },
): Promise<number> {
  const check = argv.includes("--check");
  const againstAt = argv.indexOf("--against");
  const against = againstAt < 0 ? null : argv[againstAt + 1];
  if (againstAt >= 0 && (!check || !against)) {
    d.err(
      say.text("Usage: factory sync [--check [--against COMMIT [--public]]]"),
    );
    return 2;
  }
  let r: Resolved;
  try {
    if (check) {
      const reason = await d.stale();
      if (reason) {
        d.err(say.text(reason));
        return 1;
      }
    }
    r = await d.settings();
    const refused = firstRefusal(npmrcAt(d.root));
    if (refused) {
      d.err(say.text(refused));
      return 1;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    d.err(
      e instanceof PresetsError ? say.mark("fail", message) : say.text(message),
    );
    return 1;
  }
  const { repository } = r.settings;
  if (check && d.pullIn && !sameRepository(d.pullIn, repository)) {
    d.err(
      say.mark(
        "fail",
        `repository: ${SETTINGS_FILE} says ${repository}, and this pull request is in ${d.pullIn}. Change the line and run factory sync.`,
      ),
    );
    return 1;
  }
  // Nothing is written with a guessed name: a push trigger that names the
  // wrong branch never runs.
  let branch: string;
  try {
    branch = await d.defaultBranch(r.settings);
  } catch (e) {
    if (!(e instanceof NoDefaultBranch)) throw e;
    d.err(say.text(e.message));
    return 1;
  }
  const fetch = d.fetch?.(r.settings);
  if (against) {
    if (!fetch) throw new Error("sync --check --against needs fetch");
    const { load } = await import("js-yaml");
    const faults = pinFaults(
      fetch,
      r.presets,
      pinsOf(d.show?.(against, LOCK) ?? null, load),
      load,
      argv.includes("--public")
        ? (pin) =>
            d.out(
              say.text(
                `- ${pin.name} can't be read here without a sign-in: the review's run checks it.`,
              ),
            )
        : undefined,
    );
    for (const fault of faults) d.err(say.mark("fail", fault));
    if (faults.length) return 1;
  }
  // The check reads no network: a copy that is not what the lock records
  // is one of the files that differ.
  const p = await plan(
    d.pkg,
    d.root,
    r,
    branch,
    undefined,
    check || !fetch ? undefined : (pin, path) => shippedText(fetch, pin, path),
  );
  const differ = differences(d.root, p);
  if (check) {
    if (differ.length === 0) {
      d.out(say.mark("ok", "The factory's files match the settings."));
      return 0;
    }
    const n = differ.length;
    d.err(
      say.mark(
        "fail",
        `${n} of the factory's files ${n === 1 ? "doesn't" : "don't"} match the settings:`,
      ),
    );
    for (const path of differ) d.err(say.text(`  ${path}`));
    d.err(say.text("Run factory sync and commit what it writes."));
    return 1;
  }
  if (p.unrestored.length) {
    for (const { path, preset } of p.unrestored)
      d.err(
        say.mark(
          "fail",
          `${path} was edited or deleted, and ${preset} could not be read to restore it. Restore it with: git checkout -- ${path}`,
        ),
      );
    return 1;
  }
  for (const line of [...p.kept, ...p.dropped]) d.out(say.text(line));
  for (const path of differ) {
    const at = join(d.root, path);
    const text = p.write.get(path);
    if (text === undefined) {
      rmSync(at, { force: true });
      d.out(say.text(`deleted ${path}`));
    } else {
      mkdirSync(dirname(at), { recursive: true });
      writeFileSync(at, text);
      d.out(say.text(`wrote ${path}`));
    }
  }
  if (differ.length === 0 && d.announce)
    d.out(
      say.text(
        "The factory's files already match the settings. Nothing changed.",
      ),
    );
  return 0;
}

/** The sync of the repository at `root`. */
export const syncDeps = (root: string) => ({
  root,
  pkg: PACKAGE,
  settings: () => resolveFiles(filesDeps(root)),
  stale: () => staleOf(defaultDeps(root)),
  defaultBranch: (s: Settings) =>
    needDefaultBranch(branchDeps(root, process.env, async () => s)),
  ...say.printersFor("sync"),
  fetch: (s: Settings) => fetchDeps(s.repository, s.codeHost.type),
  show: (ref: string, path: string) => fileAt(root, ref, path),
});

/** The repository whose pull request a run checks, or null where `root` is
 * not that run's checkout: a repository's own tests can run the factory in
 * another. */
export const pullIn = (
  env: Record<string, string | undefined>,
  root: string,
): string | null =>
  env.GITHUB_EVENT_NAME === "pull_request" && env.GITHUB_WORKSPACE === root
    ? (env.GITHUB_REPOSITORY ?? null)
    : null;

/** `factory sync`. */
export async function run(argv: string[], announce = true): Promise<number> {
  return main(argv, {
    ...syncDeps(repoRoot()),
    pullIn: pullIn(process.env, repoRoot()),
    announce,
  });
}
