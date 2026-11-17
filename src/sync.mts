// Writes the factory's skills, agents, rules, review instructions,
// workflows, and the actions they call from the package into the
// repository, its hook entries into `.claude/settings.json`, the rules'
// import into `CLAUDE.md`, and
// `.claude/factory.lock`: the factory's version and the files it wrote.
//
//   factory sync           # write what differs
//   factory sync --check   # write nothing; exit 1 naming what differs
//
// A copy is the source, byte for byte: edit the source in the package, never
// the copy. A file the lock lists that the package no longer has is
// deleted. Nothing else is.
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
import {
  defaultDeps,
  loadSettings,
  repoRoot,
  RULE_NUMBERS,
  type SessionKind,
  type Settings,
} from "./config.mts";

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
 * repository turns it on, by its path in the package: a skill's folder, an
 * agent's file, or a workflow's file. Everything else is the factory's
 * core, called by its own steps, and is written to every repository. */
const NEEDS: Record<string, (s: Settings, has: Has) => boolean> = {
  "skills/factory-design": (s) => s.site !== null,
  "agents/factory-ui-reviewer.md": (s) => s.site !== null,
  "skills/factory-deps": (_, has) => has(DEPENDABOT),
  "workflows/factory-deps.yml": (_, has) => has(DEPENDABOT),
  "workflows/factory-deps-auto-merge.yml": (_, has) => has(DEPENDABOT),
  "workflows/factory-board-sync.yml": (s) => s.tickets.board !== null,
  "workflows/factory-merge-policy.yml": (s) => s.autoMerge.allow.length > 0,
  "workflows/factory-claude-review.yml": (s) => s.ciReview !== null,
};

/** The workflows that run a Claude session, by the kind of session each
 * runs. */
const SESSION_WORKFLOWS: Record<string, SessionKind> = {
  "factory-build.yml": "build",
  "factory-conflicts.yml": "conflicts",
  "factory-review.yml": "review",
  "factory-deps.yml": "dependencies",
};

/** A session workflow with the minutes its session may run, and its job 10
 * more, so the steps after the session still run before the job is
 * stopped. */
export function withMinutes(text: string, minutes: number, file: string) {
  const one = (pattern: RegExp, value: number, out: string) => {
    if ((out.match(pattern) ?? []).length !== 1)
      throw new Error(
        `${file}: expected one line matching ${pattern.source}, to set the session's minutes`,
      );
    return out.replace(pattern, (_, indent) => `${indent}${value}`);
  };
  const session = one(/^(\s+minutes: )\d+$/gm, minutes, text);
  return one(/^(\s+timeout-minutes: )\d+$/gm, minutes + 10, session);
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
  add("workflows", ".github/workflows");
  add("actions", ".github/actions");
  return out;
}

/** The launcher's path from the repository's root: the root's own, where
 * the repository is the package itself; the package's own folder where it
 * is inside the repository, as a workspace or installed; and where it would
 * be installed otherwise. */
export function launcherPath(pkg: string, root: string, name: string) {
  const rel = relative(realpathSync(root), realpathSync(pkg))
    .split(sep)
    .join("/");
  if (rel === "") return LAUNCHER;
  const base =
    !rel.startsWith("..") && !rel.startsWith("/")
      ? rel
      : `node_modules/${name}`;
  return `${base}/${LAUNCHER}`;
}

type HookEntry = {
  type: "command";
  command: string;
  timeout?: number;
  statusMessage?: string;
};
type HookGroup = { matcher?: string; hooks: HookEntry[] };
type ClaudeSettings = { hooks?: Record<string, HookGroup[]> } & Record<
  string,
  unknown
>;

/** The five hook entries, one per event. */
export function factoryHooks(launcher: string): [string, HookGroup][] {
  const run = (args: string) =>
    `node "$CLAUDE_PROJECT_DIR"/${launcher} ${args}`;
  return [
    [
      "SessionStart",
      {
        hooks: [
          { type: "command", command: run("session-start"), timeout: 30 },
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
            command: run("guard"),
            timeout: 180,
            statusMessage: "Checking the factory's guards",
          },
        ],
      },
    ],
    [
      "PermissionRequest",
      {
        matcher: "Write|Edit|MultiEdit",
        hooks: [
          { type: "command", command: run("guard permission"), timeout: 30 },
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

const isFactory = (h: HookEntry) =>
  typeof h.command === "string" && h.command.includes(`/${LAUNCHER}`);

/** `.claude/settings.json` with the entries that run the factory's launcher
 * replaced by the five above, and attribution turned off unless the file
 * sets its own. Every other entry stays, in its order. */
export function withHooks(text: string | null, launcher: string): string {
  const settings: ClaudeSettings = text ? JSON.parse(text) : {};
  const hooks = othersHooks(settings);
  for (const [event, group] of factoryHooks(launcher))
    (hooks[event] ??= []).push(group);
  const attribution = settings.attribution ?? NO_ATTRIBUTION;
  return `${JSON.stringify({ ...settings, attribution, hooks }, null, 2)}\n`;
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
  const { hooks: _, ...rest } = JSON.parse(text) as ClaudeSettings;
  const hooks = othersHooks(JSON.parse(text) as ClaudeSettings);
  const after = Object.keys(hooks).length ? { ...rest, hooks } : rest;
  return Object.keys(after).length
    ? `${JSON.stringify(after, null, 2)}\n`
    : null;
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

export function lockText(version: string, files: string[]): string {
  return [
    "# Written by `factory sync`: the factory's version and the files it",
    "# wrote. Do not edit.",
    `version: ${version}`,
    "files:",
    ...files.map((f) => `  - ${f}`),
    "",
  ].join("\n");
}

export function lockedFiles(text: string | null): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((l) => /^ {2}- (.+)$/.exec(l)?.[1])
    .filter((f): f is string => Boolean(f));
}

export type Plan = {
  /** Path from the root, and its text, for each file a sync writes. */
  write: Map<string, string>;
  /** Paths the lock lists that this version no longer writes. */
  remove: string[];
};

/** What a sync of `root` from `pkg` writes and deletes. */
export function plan(pkg: string, root: string, s: Settings): Plan {
  const manifest = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8"));
  const read = (p: string) =>
    existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : null;
  const write = new Map<string, string>();
  const has = (p: string) => existsSync(join(root, p));
  for (const [from, to] of copies(pkg, s, has)) {
    const text = readFileSync(join(pkg, from), "utf8");
    const kind = SESSION_WORKFLOWS[from.replace(/^workflows\//, "")];
    write.set(
      to,
      kind && from.startsWith("workflows/")
        ? withMinutes(text, s.sessionMinutes[kind], from)
        : withRules(text, s.rules, from),
    );
  }
  const launcher = launcherPath(pkg, root, manifest.name);
  write.set(SETTINGS_JSON, withHooks(read(SETTINGS_JSON), launcher));
  write.set(CLAUDE_MD, withImport(read(CLAUDE_MD)));
  const files = [...write.keys()].filter(
    (p) => p !== SETTINGS_JSON && p !== CLAUDE_MD,
  );
  write.set(LOCK, lockText(manifest.version, files));
  const remove = lockedFiles(read(LOCK)).filter(
    (p) => !write.has(p) && existsSync(join(root, p)),
  );
  return { write, remove };
}

/** The paths whose content a sync would change, in the plan's order. */
export function differences(root: string, p: Plan): string[] {
  const changed = [...p.write]
    .filter(([path, text]) => {
      const at = join(root, path);
      return !existsSync(at) || readFileSync(at, "utf8") !== text;
    })
    .map(([path]) => path);
  return [...changed, ...p.remove];
}

export async function main(
  argv: string[],
  d: {
    root: string;
    pkg: string;
    settings: () => Promise<Settings>;
    out: (line: string) => void;
    err: (line: string) => void;
  },
): Promise<number> {
  const check = argv.includes("--check");
  let s: Settings;
  try {
    s = await d.settings();
  } catch (e) {
    d.err(e instanceof Error ? e.message : String(e));
    return 1;
  }
  const p = plan(d.pkg, d.root, s);
  const differ = differences(d.root, p);
  if (check) {
    if (differ.length === 0) return 0;
    d.err("the factory's files are out of sync:");
    for (const path of differ) d.err(`  ${path}`);
    d.err("Run `npx --no-install factory sync` and commit the result.");
    return 1;
  }
  for (const path of differ) {
    const at = join(d.root, path);
    const text = p.write.get(path);
    if (text === undefined) {
      rmSync(at, { force: true });
      d.out(`deleted ${path}`);
    } else {
      mkdirSync(dirname(at), { recursive: true });
      writeFileSync(at, text);
      d.out(`wrote ${path}`);
    }
  }
  return 0;
}

export async function run(argv: string[]): Promise<number> {
  const root = repoRoot();
  return main(argv, {
    root,
    pkg: PACKAGE,
    settings: () => loadSettings(defaultDeps(root)),
    out: (line) => console.log(line),
    err: (line) => console.error(line),
  });
}
