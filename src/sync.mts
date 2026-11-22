// Writes the factory's skills, agents, rules, review instructions,
// workflows, and the actions they call from the package into the
// repository, the agents and skills its presets ship, its hook entries
// into `.claude/settings.json`, the rules' import into `CLAUDE.md`, and
// `.claude/factory.lock`: the factory's version, the presets, the settings
// in effect, and the files it wrote. Every other command reads the
// settings from the lock.
//
//   factory sync           # write what differs
//   factory sync --check   # write nothing; exit 1 naming what differs
//
// A copy is the source, byte for byte but for what the settings and the
// repository decide: the minutes a session may run, the poller's schedule,
// the rules' numbers, and the default branch's name in the push triggers.
// Edit the source in the package, never the copy. A file the lock lists that the package no longer has is
// deleted. Nothing else is.
import { PR_LABELS } from "./labels.mts";
import type { Registry } from "./tools.mts";
import { colorOn, painter, plain, type Paint } from "./lib/color.mts";
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
  filesDeps,
  repoRoot,
  resolveFiles,
  RULE_NUMBERS,
  staleOf,
  defaultDeps,
  type Resolved,
  type SessionKind,
  type Settings,
} from "./config.mts";
import {
  CHOICES_FILE,
  choicesText,
  settingsHash,
  staleChoices,
  type Replaced,
} from "./preset.mts";
import {
  branchDeps,
  CANNOT_TELL,
  defaultBranch,
} from "./lib/default-branch.mts";

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
  "agents/factory-e2e-reviewer.md": (s) => s.commands.endToEnd !== null,
  "skills/factory-deps": (_, has) => has(DEPENDABOT),
  "workflows/factory-deps.yml": (_, has) => has(DEPENDABOT),
  "workflows/factory-deps-auto-merge.yml": (_, has) => has(DEPENDABOT),
  "workflows/factory-board-sync.yml": (s) => s.tickets.board !== null,
  "workflows/factory-merge-policy.yml": (s) => s.autoMerge.allow.length > 0,
  "workflows/factory-claude-review.yml": (s) => s.prReview !== null,
  "workflows/factory-poller.yml": (s) => s.builds.trigger === "github-action",
};

const POLLER_WORKFLOW = "workflows/factory-poller.yml";

/** The scheduled poller's workflow, its one `cron` line set to run every
 * `minutes`: on the hour for 60, every N minutes past it otherwise. */
export function withSchedule(text: string, minutes: number, file: string) {
  const pattern = /^(\s+- cron: )"[^"]*"$/gm;
  if ((text.match(pattern) ?? []).length !== 1)
    throw new Error(
      `${file}: expected one cron line, to set the poller's schedule`,
    );
  const cron = minutes === 60 ? "0 * * * *" : `*/${minutes} * * * *`;
  return text.replace(pattern, (_, lead) => `${lead}"${cron}"`);
}

/** The workflows whose push trigger names the default branch. A workflow
 * cannot ask for it in a trigger, so the sync writes it there. */
const PUSH_WORKFLOWS = [
  "workflows/factory-check.yml",
  "workflows/factory-conflicts.yml",
];

/** A workflow with the one `branches:` line of its push trigger naming the
 * default branch and nothing else. */
export function withDefaultBranch(text: string, name: string, file: string) {
  const pattern = /^(\s+branches: )\[[^\]\n]*\]$/gm;
  if ((text.match(pattern) ?? []).length !== 1)
    throw new Error(
      `${file}: expected one branches line, to set the push trigger's branch`,
    );
  // Plain where YAML reads the name as text, quoted otherwise.
  const written = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(name)
    ? name
    : JSON.stringify(name);
  return text.replace(pattern, (_, lead) => `${lead}[${written}]`);
}

const BUILD_WORKFLOW = "workflows/factory-build.yml";
const VERDICT_WORKFLOW = "workflows/factory-review-verdict.yml";

/** The verdict workflow starting on the override by the name the settings
 * give it, written only when it is not the default, in single quotes as
 * GitHub's expressions take text. */
export function withOverride(text: string, name: string, file: string) {
  const fallback = PR_LABELS["verdict-override"];
  if (name === fallback) return text;
  const line = `github.event.label.name == '${fallback}'`;
  if (text.split(line).length !== 2)
    throw new Error(
      `${file}: expected one match for ${line}, to set the override's name`,
    );
  return text.replace(
    line,
    () => `github.event.label.name == '${name.replace(/'/g, "''")}'`,
  );
}

/** The build workflow with its run named as the ticket system writes the
 * ticket, such as `Build #12` on GitHub, which `factory build` finds the
 * run by. */
export function withRunName(
  text: string,
  ref: (key: string) => string,
  file: string,
) {
  const pattern = /^run-name: .*$/gm;
  if ((text.match(pattern) ?? []).length !== 1)
    throw new Error(`${file}: expected one run-name line, to name the build`);
  return text.replace(
    pattern,
    () => `run-name: ${JSON.stringify(`Build ${ref("${{ inputs.ticket }}")}`)}`,
  );
}

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

/** Whether a job, as its lines, installs packages or starts a session:
 * the jobs that run a factory command. */
const runsFactory = (job: string[]) =>
  job.some(
    (l) =>
      (/\bnpm ci\b/.test(l) && !/^\s*#/.test(l)) ||
      /^\s+uses: \.\/\.github\/actions\/factory-agent\s*$/.test(l),
  );

/** The workflows whose jobs read tickets. */
const TICKET_WORKFLOWS = [
  "factory-board-sync.yml",
  "factory-build.yml",
  "factory-review.yml",
  "factory-conflicts.yml",
  "factory-deps.yml",
  "factory-poller.yml",
  "factory-claude-review.yml",
].map((f) => `workflows/${f}`);

/** A workflow whose jobs that run a factory command set each of the ticket
 * system's secret names from the secret of the same name, in the job's
 * `env`, skipping a name the job's `env` already sets, as one `.npmrc`
 * also reads. Only lines are added. */
export function withTicketEnv(text: string, names: string[], file: string) {
  if (!names.length) return text;
  const lines = text.split("\n");
  const jobsAt = lines.indexOf("jobs:");
  if (jobsAt < 0) return text;
  const starts = lines
    .map((l, i) => (i > jobsAt && /^ {2}[A-Za-z0-9_-]+:\s*$/.test(l) ? i : -1))
    .filter((i) => i >= 0);
  const inserts: { at: number; lines: string[] }[] = [];
  starts.forEach((start, k) => {
    const job = lines.slice(start, starts[k + 1] ?? lines.length);
    if (!runsFactory(job)) return;
    const env = job.findIndex((l) => /^ {4}env:\s*$/.test(l));
    const set = new Set<string>();
    if (env >= 0)
      for (const l of job.slice(env + 1)) {
        const m = /^ {6}([A-Za-z0-9_]+):/.exec(l);
        if (!m) break;
        set.add(m[1]!);
      }
    const entries = names
      .filter((n) => !set.has(n))
      .map((n) => `      ${n}: \${{ secrets.${n} }}`);
    if (!entries.length) return;
    const runsOn = job.findIndex((l) => /^ {4}runs-on:/.test(l));
    if (env >= 0)
      inserts.push({ at: start + env + 1 + set.size, lines: entries });
    else if (runsOn >= 0)
      inserts.push({ at: start + runsOn + 1, lines: ["    env:", ...entries] });
    else
      throw new Error(
        `${file}: expected a runs-on line in each job that runs the factory, to set its env`,
      );
  });
  for (const { at, lines: added } of inserts.sort((a, b) => b.at - a.at))
    lines.splice(at, 0, ...added);
  return lines.join("\n");
}

/** A workflow whose jobs that install packages set each name in `names`
 * from a secret of the same name, in the job's `env`, so every step that
 * runs npm reads it, a composite action's included. With `GITHUB_TOKEN`
 * among them, the workflow may also read packages. Only lines are added. */
export function withNpmEnv(text: string, names: string[], file: string) {
  if (!names.length) return text;
  const lines = text.split("\n");
  const jobsAt = lines.indexOf("jobs:");
  if (jobsAt < 0) return text;
  const starts = lines
    .map((l, i) => (i > jobsAt && /^ {2}[A-Za-z0-9_-]+:\s*$/.test(l) ? i : -1))
    .filter((i) => i >= 0);
  const entries = names.map((n) => `      ${n}: \${{ secrets.${n} }}`);
  const inserts: { at: number; lines: string[] }[] = [];
  starts.forEach((start, k) => {
    const end = starts[k + 1] ?? lines.length;
    const job = lines.slice(start, end);
    if (!runsFactory(job)) return;
    const env = job.findIndex((l) => /^ {4}env:\s*$/.test(l));
    const runsOn = job.findIndex((l) => /^ {4}runs-on:/.test(l));
    const permissions = job.findIndex((l) => /^ {4}permissions:\s*$/.test(l));
    if (names.includes("GITHUB_TOKEN") && permissions >= 0)
      inserts.push({
        at: start + permissions + 1,
        lines: ["      packages: read"],
      });
    if (env >= 0) inserts.push({ at: start + env + 1, lines: entries });
    else if (runsOn >= 0)
      inserts.push({ at: start + runsOn + 1, lines: ["    env:", ...entries] });
    else
      throw new Error(
        `${file}: expected a runs-on line in each job that installs, to set its env`,
      );
  });
  if (!inserts.length) return text;
  if (names.includes("GITHUB_TOKEN")) {
    const permissions = lines.indexOf("permissions:");
    if (permissions < 0)
      throw new Error(
        `${file}: expected a permissions block, to let GITHUB_TOKEN read packages`,
      );
    inserts.push({ at: permissions + 1, lines: ["  packages: read"] });
  }
  for (const { at, lines: added } of inserts.sort((a, b) => b.at - a.at))
    lines.splice(at, 0, ...added);
  return lines.join("\n");
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

/** The five hook entries, one per event, and with `credentials` a sixth,
 * the guard on the credentials file for the tools that read, search, and
 * list files. */
export function factoryHooks(
  launcher: string,
  credentials = false,
): [string, HookGroup][] {
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
    ...(credentials
      ? [
          [
            "PreToolUse",
            {
              matcher: "Read|Grep|Glob",
              hooks: [
                {
                  type: "command",
                  command: run("guard credentials"),
                  timeout: 30,
                },
              ],
            },
          ] as [string, HookGroup],
        ]
      : []),
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
 * replaced by those above, and attribution turned off unless the file
 * sets its own. Every other entry stays, in its order. */
export function withHooks(
  text: string | null,
  launcher: string,
  credentials = false,
): string {
  const settings: ClaudeSettings = text ? JSON.parse(text) : {};
  const hooks = othersHooks(settings);
  for (const [event, group] of factoryHooks(launcher, credentials))
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

export type LockParts = {
  version: string;
  presets: { name: string; version: string }[];
  hash: string;
  /** The variables `.npmrc`'s sign-in lines read. */
  npmrcVariables: string[];
  /** The settings in effect, as `factory config explain` prints them. */
  settings: string[];
  overridden: Record<string, Replaced[]>;
  files: string[];
};

/** A key or a value as YAML: plain where it reads back as the same text,
 * quoted as JSON otherwise. */
const scalar = (v: unknown) =>
  typeof v === "string" &&
  /^[A-Za-z0-9_./][A-Za-z0-9_./ -]*$/.test(v) &&
  !/ $/.test(v) &&
  !/^(true|false|null|yes|no|on|off|~|[-+.\d][\d._eE+-]*)$/i.test(v)
    ? v
    : JSON.stringify(v);

export function lockText(l: LockParts): string {
  const replaced = Object.entries(l.overridden);
  return [
    "# Written by `factory sync`: the factory's version, the presets, the",
    "# settings in effect, and the files it wrote. Do not edit.",
    `version: ${l.version}`,
    ...(l.presets.length
      ? [
          "presets:",
          ...l.presets.flatMap((p) => [
            `  - name: ${JSON.stringify(p.name)}`,
            `    version: ${scalar(p.version)}`,
          ]),
        ]
      : ["presets: []"]),
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

const AUTO_MERGE_WORKFLOW = "workflows/factory-deps-auto-merge.yml";
const FACTORY_EXCLUSION =
  "!contains(steps.meta.outputs.dependency-names, 'davidbyoung/software-factory')";

/** The dependency auto-merge workflow with each preset's package held back
 * as the factory's own is, so a preset update waits for a person. */
export function withPresetPackages(
  text: string,
  packages: string[],
  file: string,
) {
  if (!packages.length) return text;
  const at = text.split(FACTORY_EXCLUSION).length - 1;
  if (at !== 1)
    throw new Error(
      `${file}: expected one line holding back the factory, to hold back the presets too`,
    );
  return text
    .split("\n")
    .map((line) => {
      if (line.trim() !== FACTORY_EXCLUSION) return line;
      const indent = line.slice(0, line.indexOf("!"));
      return [
        `${line} &&`,
        ...packages.map(
          (p, i) =>
            `${indent}!contains(steps.meta.outputs.dependency-names, '${p}')${i < packages.length - 1 ? " &&" : ""}`,
        ),
      ].join("\n");
    })
    .join("\n");
}

export type Plan = {
  /** Path from the root, and its text, for each file a sync writes. */
  write: Map<string, string>;
  /** Paths the lock lists that this version no longer writes, and the
   * choices file once its last choice is dropped. */
  remove: string[];
  /** A line for each preset file left as it is. */
  kept: string[];
  /** A line for each choice dropped. */
  dropped: string[];
};

/** What a sync of `root` from `pkg` writes and deletes, in a repository
 * whose default branch is `branch`. */
export async function plan(
  pkg: string,
  root: string,
  r: Resolved,
  branch: string,
  systems?: Registry["tickets"],
): Promise<Plan> {
  const { load } = await import("js-yaml");
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
  for (const [from, to] of copies(pkg, s, has)) {
    const source = readFileSync(join(pkg, from), "utf8");
    const text = PUSH_WORKFLOWS.includes(from)
      ? withDefaultBranch(source, branch, from)
      : from === BUILD_WORKFLOW
        ? withRunName(source, refOf(s.tickets.type), from)
        : from === VERDICT_WORKFLOW
          ? withOverride(source, s.codeHost.labels["verdict-override"], from)
          : source;
    const kind = SESSION_WORKFLOWS[from.replace(/^workflows\//, "")];
    const written =
      kind && from.startsWith("workflows/")
        ? withMinutes(text, s.sessionMinutes[kind], from)
        : from === POLLER_WORKFLOW
          ? withSchedule(text, s.builds.pollMinutes, from)
          : from === AUTO_MERGE_WORKFLOW
            ? withPresetPackages(
                text,
                [...new Set(r.presets.map((p) => p.pkg))],
                from,
              )
            : withRules(text, s.rules, from);
    write.set(
      to,
      from.startsWith("workflows/")
        ? withTicketEnv(
            withNpmEnv(written, npmrc.names, from),
            TICKET_WORKFLOWS.includes(from) ? ticketNames : [],
            from,
          )
        : written,
    );
  }
  // A preset's agent or skill, unless the factory's own file or one the
  // repository wrote itself is at its path: those always stay.
  const previous = lockedFiles(read(LOCK), load);
  const kept: string[] = [];
  for (const [to, { from, source }] of r.resolution.files) {
    if (write.has(to)) kept.push(`kept ${to}, the factory's own, over ${from}`);
    else if (existsSync(join(root, to)) && !previous.includes(to))
      kept.push(`kept ${to}, this repository's own, over ${from}`);
    else write.set(to, readFileSync(source, "utf8"));
  }
  const launcher = launcherPath(pkg, root, manifest.name);
  write.set(
    SETTINGS_JSON,
    withHooks(read(SETTINGS_JSON), launcher, Boolean(credential?.machine)),
  );
  write.set(CLAUDE_MD, withImport(read(CLAUDE_MD)));
  const files = [...write.keys()].filter(
    (p) => p !== SETTINGS_JSON && p !== CLAUDE_MD,
  );

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
      presets: r.presets.map((p) => ({ name: p.name, version: p.version })),
      hash: settingsHash(r.ownText, chosen),
      npmrcVariables: npmrc.names,
      settings,
      overridden: Object.fromEntries(r.resolution.overridden),
      files,
    }),
  );
  remove.unshift(
    ...previous.filter((p) => !write.has(p) && existsSync(join(root, p))),
  );
  return {
    write,
    remove: remove.filter((p) => existsSync(join(root, p))),
    kept,
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
    /** The repository's default branch, or null when it cannot be told. */
    defaultBranch: (s: Settings) => Promise<string | null>;
    out: (line: string) => void;
    err: (line: string) => void;
    paint?: Paint;
    /** Whether a person ran it, so a sync that changes nothing says so;
     * `init` and the preset commands run it inside their own output. */
    announce?: boolean;
  },
): Promise<number> {
  const check = argv.includes("--check");
  const paint = d.paint ?? plain;
  let r: Resolved;
  try {
    if (check) {
      const reason = await d.stale();
      if (reason) {
        d.err(reason);
        return 1;
      }
    }
    r = await d.settings();
    const refused = firstRefusal(npmrcAt(d.root));
    if (refused) {
      d.err(refused);
      return 1;
    }
  } catch (e) {
    d.err(e instanceof Error ? e.message : String(e));
    return 1;
  }
  // Nothing is written with a guessed name: a push trigger that names the
  // wrong branch never runs.
  const branch = await d.defaultBranch(r.settings);
  if (branch === null) {
    d.err(CANNOT_TELL);
    return 1;
  }
  const p = await plan(d.pkg, d.root, r, branch);
  const differ = differences(d.root, p);
  if (check) {
    if (differ.length === 0) {
      d.out(`${paint("green", "✓")} The factory's files match the settings.`);
      return 0;
    }
    const n = differ.length;
    d.err(
      `${paint("red", "✗")} ${n} of the factory's files ${n === 1 ? "doesn't" : "don't"} match the settings:`,
    );
    for (const path of differ) d.err(`  ${path}`);
    d.err("Run factory sync and commit what it writes.");
    return 1;
  }
  for (const line of [...p.kept, ...p.dropped]) d.out(line);
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
  if (differ.length === 0 && d.announce)
    d.out("The factory's files already match the settings. Nothing changed.");
  return 0;
}

/** The sync of the repository at `root`. */
export const syncDeps = (root: string) => ({
  root,
  pkg: PACKAGE,
  settings: () => resolveFiles(filesDeps(root)),
  stale: () => staleOf(defaultDeps(root)),
  defaultBranch: (s: Settings) =>
    defaultBranch(branchDeps(root, process.env, async () => s)),
  out: (line: string) => console.log(line),
  err: (line: string) => console.error(line),
});

/** `announce` is false when `init` runs the sync inside its own output. */
export async function run(argv: string[], announce = true): Promise<number> {
  return main(argv, {
    ...syncDeps(repoRoot()),
    paint: painter(colorOn()),
    announce,
  });
}
