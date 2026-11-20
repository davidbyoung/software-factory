// The `factory preset` commands: add and remove a preset, choose between
// two presets where they disagree, check a preset before publishing it,
// and say what a preset update changes in this repository.
//
//   factory preset add NAME [--yes] [--dry-run]
//   factory preset remove NAME [--yes] [--dry-run]
//   factory preset choices
//   factory preset choose KEY PRESET
//   factory preset check
//   factory preset changes REF
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { STATUS_CODES } from "node:http";
import { dirname, join, relative, sep } from "node:path";
import {
  filesDeps,
  parseChoices,
  repoRoot,
  resolveFiles,
  SETTINGS_FILE,
  SettingsError,
  type Deps,
  type Resolved,
} from "./config.mts";
import {
  CHOICES_FILE,
  choicesText,
  findPackage,
  LOCK_FILE,
  OWN,
  PLUGIN_LISTS,
  presetFaults,
  PRESET_FILE,
  readLock,
  shipped,
  shipsText,
  splitName,
  stable,
  staleMessages,
  type Lock,
} from "./preset.mts";
import type { Check } from "./setup.mts";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const DEPENDABOT = ".github/dependabot.yml";

export type PresetDeps = {
  root: string;
  /** Where `preset check` looks for a package, the folder it runs in. */
  cwd: string;
  out: (line: string) => void;
  err: (line: string) => void;
  /** Whether the questions can be asked. */
  terminal: boolean;
  /** Asks one question and gives the answer typed. */
  ask: (question: string) => Promise<string>;
  /** Runs npm with these arguments in the root. */
  npm: (args: string[]) => { status: number; stdout: string; stderr: string };
  /** Runs `factory sync`, giving each line it prints to `out`. */
  sync: (out: (line: string) => void) => Promise<number>;
  /** A file's text at a git revision, or null when it has none there. */
  show: (ref: string, path: string) => string | null;
  /** The settings resolved from the files, as `factory sync` resolves them,
   * with `.claude/factory.yaml` and the choices file as given. */
  resolve: (own: string, choices: string | null) => Promise<Resolved>;
  write: (path: string, text: string | null) => void;
  read: (path: string) => string | null;
};

// ---------------------------------------------------------------- Values

/** A value as the summaries show it: a list's items joined, a plugin by its
 * name. */
export function show(v: unknown): string {
  if (Array.isArray(v)) return v.map(show).join(", ") || "none";
  if (isObj(v)) {
    if (typeof v.agent === "string") return v.agent;
    if (typeof v.skill === "string") return v.skill;
    return JSON.stringify(v);
  }
  if (v === null || v === undefined) return "none";
  return String(v);
}

function getPath(raw: unknown, path: string[]): unknown {
  let at = raw;
  for (const part of path) {
    if (!isObj(at)) return undefined;
    at = at[part];
  }
  return at;
}

/** The settings in effect with every default filled in, from the lines
 * `factory config explain` prints. */
async function effective(r: Resolved): Promise<Obj> {
  const { explainLines, markerOf } = await import("./explain.mts");
  const { load } = await import("js-yaml");
  const lines = await explainLines(
    r.settings,
    markerOf(r.resolution),
    r.exists,
  );
  return (load(lines.join("\n")) as Obj) ?? {};
}

const VALUE_LISTS = [
  "pr-review.commands",
  "auto-merge.deny",
  "site.pages",
  "site.widths",
  "site.checks",
  "site.hide",
];

/** The plugin list a key such as `plugins.build.reviewers.NAME` is in. */
const pluginListOf = (key: string) =>
  PLUGIN_LISTS.find((p) => key.startsWith(`${p}.`));

/** The value a layer gives a key in a resolution: the one in effect, or the
 * one it replaced. */
function valueOf(r: Resolved, key: string, layer: string): unknown {
  const src = r.resolution.sources.get(key);
  if (src?.from === layer) return valueInEffect(r, key);
  return r.resolution.overridden.get(key)?.find((o) => o.from === layer)?.value;
}

function valueInEffect(r: Resolved, key: string): unknown {
  const list = pluginListOf(key);
  if (list) {
    const name = key.slice(list.length + 1);
    const items = getPath(r.resolution.raw, list.split("."));
    return Array.isArray(items)
      ? items.find((i) => isObj(i) && (i.agent ?? i.skill) === name)
      : undefined;
  }
  if (key.startsWith(".claude/")) return r.resolution.files.get(key)?.source;
  return getPath(r.resolution.raw, key.split("."));
}

// ---------------------------------------------------------------- Summaries

type Row = { key: string; text: string };
type Group = { title: string; rows: Row[] };

function summary(head: string, groups: Group[], files: string[]): string[] {
  const shown = groups.filter((g) => g.rows.length);
  const width =
    Math.max(0, ...shown.flatMap((g) => g.rows.map((r) => r.key.length))) + 3;
  return [
    head,
    "",
    ...shown.flatMap((g) => [
      `  ${g.title}`,
      ...g.rows.map((r) => `    ${r.key.padEnd(width)}${r.text}`),
    ]),
    ...(files.length ? ["", ...files.map((f) => `  ${f}`)] : []),
  ];
}

/** A question asked until the answer is one of `options`. */
async function choose(
  d: PresetDeps,
  question: string,
  options: string[],
): Promise<string> {
  for (;;) {
    const answer = (await d.ask(question)).trim();
    if (options.includes(answer)) return answer;
  }
}

/** `Apply? [y/N]`: anything but `y` is no. */
async function apply(d: PresetDeps): Promise<boolean> {
  return (await d.ask("Apply? [y/N] ")).trim() === "y";
}

// ---------------------------------------------------------------- Files

async function yamlDoc(text: string) {
  const { parseDocument } = await import("yaml");
  return parseDocument(text);
}

/** `.claude/factory.yaml` with NAME added, quoted, at the end of
 * `presets`, which goes after `repository` when it is new. */
async function withPreset(text: string, name: string): Promise<string> {
  const { Scalar, isMap, isSeq, YAMLSeq, Pair } = await import("yaml");
  const doc = await yamlDoc(text);
  const item = new Scalar(name);
  item.type = Scalar.QUOTE_DOUBLE;
  const list = doc.get("presets");
  if (isSeq(list)) list.items.push(item);
  else if (isMap(doc.contents)) {
    const seq = new YAMLSeq();
    seq.items.push(item);
    const at = doc.contents.items.findIndex(
      (p) => String((p.key as { value?: unknown })?.value) === "repository",
    );
    doc.contents.items.splice(
      at + 1,
      0,
      new Pair(
        new Scalar("presets"),
        seq,
      ) as (typeof doc.contents.items)[number],
    );
  }
  return doc.toString({ flowCollectionPadding: false, lineWidth: 0 });
}

/** `.claude/factory.yaml` without NAME in `presets`, and without `presets`
 * once it is empty. */
async function withoutPreset(text: string, name: string): Promise<string> {
  const { isSeq, isScalar } = await import("yaml");
  const doc = await yamlDoc(text);
  const list = doc.get("presets");
  if (isSeq(list)) {
    list.items = list.items.filter((i) => !(isScalar(i) && i.value === name));
    if (!list.items.length) doc.delete("presets");
  }
  return doc.toString({ flowCollectionPadding: false, lineWidth: 0 });
}

/** `.claude/factory.yaml` without its own value for `key`, and without a
 * block that leaves empty. */
async function withoutKey(text: string, key: string): Promise<string> {
  const { isMap, isSeq } = await import("yaml");
  const doc = await yamlDoc(text);
  const list = pluginListOf(key);
  if (list) {
    const name = key.slice(list.length + 1);
    const seq = doc.getIn(list.split("."));
    if (isSeq(seq))
      seq.items = seq.items.filter((i) => {
        const v = (i as { toJSON?: () => unknown }).toJSON?.();
        return !(isObj(v) && (v.agent ?? v.skill) === name);
      });
  } else doc.deleteIn(key.split("."));
  const path = (list ?? key).split(".");
  for (let n = path.length - 1; n > 0; n--) {
    const parent = doc.getIn(path.slice(0, n));
    if (isMap(parent) && parent.items.length === 0)
      doc.deleteIn(path.slice(0, n));
    else break;
  }
  return doc.toString({ flowCollectionPadding: false, lineWidth: 0 });
}

/** `.claude/factory.yaml` with `value` as its own for `key`. */
async function withKey(
  text: string,
  key: string,
  value: unknown,
): Promise<string> {
  const { isSeq } = await import("yaml");
  const doc = await yamlDoc(text);
  const list = pluginListOf(key);
  if (list) {
    const seq = doc.getIn(list.split("."));
    if (isSeq(seq)) seq.items.push(doc.createNode(value));
    else doc.setIn(list.split("."), doc.createNode([value]));
  } else doc.setIn(key.split("."), doc.createNode(value));
  return doc.toString({ flowCollectionPadding: false, lineWidth: 0 });
}

// ---------------------------------------------------------------- npm

/** The registry npm installs a package from. */
function registryOf(d: PresetDeps, pkg: string): string {
  const scope = pkg.startsWith("@") ? pkg.split("/")[0] : null;
  const get = (key: string) => {
    const r = d.npm(["config", "get", key]);
    const v = r.stdout.trim();
    return r.status === 0 && v && v !== "undefined" ? v : null;
  };
  return (scope && get(`${scope}:registry`)) ?? get("registry") ?? "";
}

/** npm's failure in the factory's words. */
export function installError(
  name: string,
  stderr: string,
  registry: string,
): string[] {
  const code = /code E(\d{3})\b/.exec(stderr)?.[1];
  if (!code) {
    const last =
      stderr
        .split("\n")
        .filter((l) => /^npm (error|ERR!)/.test(l))
        .at(-1) ??
      stderr.trim().split("\n").at(-1) ??
      "";
    return [`npm couldn't install ${name}:`, last];
  }
  const lines = [
    `npm couldn't install ${name}: ${registry} answered ${code} ${STATUS_CODES[Number(code)] ?? ""}.`.replace(
      " .",
      ".",
    ),
  ];
  if (["401", "403", "404"].includes(code))
    lines.push(
      `If it's a private package, give this machine a token for ${registry}, as .npmrc expects.`,
    );
  return lines;
}

function inPackageJson(d: PresetDeps, pkg: string): boolean {
  const text = d.read("package.json");
  if (!text) return false;
  const m = JSON.parse(text) as Record<string, Record<string, string>>;
  return Boolean(m.dependencies?.[pkg] ?? m.devDependencies?.[pkg]);
}

// ---------------------------------------------------------------- Dependabot

async function loadYaml(text: string | null): Promise<unknown> {
  if (text === null) return null;
  const { load } = await import("js-yaml");
  try {
    return load(text);
  } catch {
    return null;
  }
}

/** Whether a group in `.github/dependabot.yml` has the package as its only
 * pattern. */
export async function hasOwnGroup(
  text: string | null,
  pkg: string,
): Promise<boolean> {
  const o = await loadYaml(text);
  const updates = isObj(o) && Array.isArray(o.updates) ? o.updates : [];
  return updates.some(
    (u) =>
      isObj(u) &&
      isObj(u.groups) &&
      Object.values(u.groups).some(
        (g) =>
          isObj(g) &&
          Array.isArray(g.patterns) &&
          g.patterns.length === 1 &&
          g.patterns[0] === pkg,
      ),
  );
}

/** The registry `.npmrc` sends a package's scope to, or null. */
export function npmrcRegistry(text: string | null, pkg: string): string | null {
  if (!text || !pkg.startsWith("@")) return null;
  const scope = pkg.split("/")[0]!;
  for (const line of text.split("\n")) {
    const m = /^\s*(@[^:\s]+):registry\s*=\s*(\S+)\s*$/.exec(line);
    if (m && m[1] === scope) return m[2]!;
  }
  return null;
}

const bare = (url: string) => url.replace(/\/+$/, "");

/** The lines `preset add` ends with for what Dependabot still needs. */
export async function nextLines(
  dependabot: string | null,
  npmrc: string | null,
  pkg: string,
): Promise<string[]> {
  if (dependabot === null) return [];
  const out: string[] = [];
  if (!(await hasOwnGroup(dependabot, pkg)))
    out.push(
      `Next: in ${DEPENDABOT}, give ${pkg} a group of its own, so its updates arrive as their own pull requests.`,
    );
  const registry = npmrcRegistry(npmrc, pkg);
  if (registry) {
    const o = await loadYaml(dependabot);
    const known =
      isObj(o) && isObj(o.registries)
        ? Object.values(o.registries).map((r) =>
            isObj(r) && typeof r.url === "string" ? bare(r.url) : "",
          )
        : [];
    if (!known.includes(bare(registry)))
      out.push(
        `Next: in ${DEPENDABOT}, add ${registry} under registries, so Dependabot sees new versions of ${pkg}.`,
      );
  }
  return out;
}

/** Runs the sync, saying the choices file was written, where it was, just
 * before the lock, as the sync would have said it. */
async function syncing(d: PresetDeps, wroteChoices: boolean): Promise<number> {
  const lines: string[] = [];
  const code = await d.sync((l) => lines.push(l));
  if (wroteChoices) {
    const at = lines.indexOf(`wrote ${LOCK_FILE}`);
    lines.splice(at < 0 ? lines.length : at, 0, `wrote ${CHOICES_FILE}`);
  }
  for (const line of lines) d.out(line);
  return code;
}

// ---------------------------------------------------------------- add

const PAREN = "this preset";

export async function add(argv: string[], d: PresetDeps): Promise<number> {
  const name = argv.find((a) => !a.startsWith("--"));
  const yes = argv.includes("--yes");
  const dry = argv.includes("--dry-run");
  if (!name) {
    d.err("Usage: factory preset add NAME [--yes] [--dry-run]");
    return 2;
  }
  const ownText = d.read(SETTINGS_FILE);
  if (ownText === null) {
    d.err(`${SETTINGS_FILE} is missing. Run: npx --no-install factory init`);
    return 1;
  }
  const own = (await loadYaml(ownText)) as Obj | null;
  const listed = Array.isArray(own?.presets) ? own.presets.map(String) : [];
  if (listed.includes(name)) {
    d.err(`${name} is already in presets`);
    return 1;
  }
  const { pkg } = splitName(name);
  const before = inPackageJson(d, pkg);
  const undo = () => {
    if (!before) d.npm(["uninstall", pkg]);
  };
  if (!before) {
    const r = d.npm(["install", "--save-dev", pkg]);
    if (r.status !== 0) {
      for (const line of installError(name, r.stderr, registryOf(d, pkg)))
        d.err(line);
      return 1;
    }
  }

  const choicesBefore = d.read(CHOICES_FILE);
  let now: Resolved;
  let after: Resolved;
  try {
    now = await d.resolve(ownText, choicesBefore);
    after = await d.resolve(await withPreset(ownText, name), choicesBefore);
  } catch (e) {
    undo();
    d.err(e instanceof Error ? e.message : String(e));
    return 1;
  }
  const version = after.presets.find((p) => p.name === name)!.version;
  const [effNow, effAfter] = await Promise.all([
    effective(now),
    effective(after),
  ]);

  const added: Row[] = [];
  const replacesDefault: Row[] = [];
  const disagrees = new Map<string, Row[]>();
  const yours: Row[] = [];
  const questions: {
    key: string;
    kind: "disagree" | "yours";
    other: string;
    mine: string;
    theirs: string;
  }[] = [];
  for (const [key, setters] of after.resolution.setBy) {
    if (!setters.has(name) || key.startsWith(".claude/")) continue;
    const mine = valueOf(after, key, name);
    const src = after.resolution.sources.get(key);
    const list = pluginListOf(key);
    if (src?.from === OWN) {
      const theirs = valueInEffect(after, key);
      if (stable(theirs) === stable(mine)) continue;
      yours.push({
        key: list ?? key,
        text: `yours: ${show(theirs)}   ${PAREN}'s: ${show(mine)}`,
      });
      questions.push({
        key,
        kind: "yours",
        other: OWN,
        mine: show(mine),
        theirs: show(theirs),
      });
      continue;
    }
    const before = now.resolution.sources.get(key);
    if (before && before.from !== OWN && setters.size > 1) {
      const theirs = valueOf(now, key, before.from);
      if (stable(theirs) === stable(mine)) continue;
      const rows = disagrees.get(before.from) ?? [];
      rows.push({
        key: list ?? key,
        text: `${before.from}: ${show(theirs)}   ${PAREN}: ${show(mine)}`,
      });
      disagrees.set(before.from, rows);
      questions.push({
        key,
        kind: "disagree",
        other: before.from,
        mine: show(mine),
        theirs: show(theirs),
      });
      continue;
    }
    if (list) {
      added.push({ key: list, text: `+ ${show(mine)}` });
      continue;
    }
    const was = getPath(effNow, key.split("."));
    if (stable(was) === stable(mine)) continue;
    replacesDefault.push({ key, text: `${show(was)} → ${show(mine)}` });
  }
  for (const path of VALUE_LISTS) {
    const was = getPath(effNow, path.split("."));
    const is = getPath(effAfter, path.split("."));
    if (!Array.isArray(is)) continue;
    const had = new Set((Array.isArray(was) ? was : []).map(stable));
    for (const item of is)
      if (
        !had.has(stable(item)) &&
        after.resolution.sources.get(`${path}[${stable(item)}]`)?.from === name
      )
        added.push({ key: path, text: `+ ${show(item)}` });
  }
  const locked = await lockFiles(d);
  const writes = [...after.resolution.files]
    .filter(([to, f]) => f.from === name && !now.resolution.files.has(to))
    .filter(([to]) => !existsSync(join(d.root, to)) || locked.includes(to))
    .map(([to]) => `writes ${to}`);

  for (const line of summary(
    `${name} ${version} would change these settings here:`,
    [
      { title: "added", rows: added },
      { title: "replaces the default", rows: replacesDefault },
      ...[...disagrees].map(([other, rows]) => ({
        title: `disagrees with ${other}`,
        rows,
      })),
      { title: `replaced by your ${SETTINGS_FILE}`, rows: yours },
    ],
    writes,
  ))
    d.out(line);

  if (dry) {
    undo();
    return 0;
  }
  if (!yes && !d.terminal) {
    undo();
    d.out("");
    d.out("Run it in a terminal to choose, or add --yes to apply it.");
    return 1;
  }

  const choices = parseChoices(choicesBefore, (await import("js-yaml")).load);
  let text = await withPreset(ownText, name);
  if (!yes) {
    if (questions.length) {
      d.out("");
      d.out("Choose:");
    }
    for (const q of questions) {
      const k = q.key;
      if (q.kind === "disagree") {
        const options = q.mine === q.theirs ? ["1", "2"] : [q.mine, q.theirs];
        const a = await choose(
          d,
          `  ${k}: ${q.mine} from ${PAREN}, or ${q.theirs} from ${q.other}? [${options.join("/")}] `,
          options,
        );
        choices[k] = a === options[0] ? name : q.other;
      } else {
        const a = await choose(
          d,
          `  ${k}: keep yours, or drop it and use ${PAREN}'s? [keep/drop] `,
          ["keep", "drop"],
        );
        if (a === "drop") text = await withoutKey(text, k);
      }
    }
    d.out("");
    if (!(await apply(d))) {
      undo();
      d.out("Nothing changed.");
      return 0;
    }
  }
  d.write(SETTINGS_FILE, text);
  d.out(`added ${name} to presets in ${SETTINGS_FILE}`);
  const chosen = choicesText(choices);
  if (chosen !== choicesBefore) d.write(CHOICES_FILE, chosen);
  const code = await syncing(d, chosen !== choicesBefore && chosen !== null);
  for (const line of await nextLines(d.read(DEPENDABOT), d.read(".npmrc"), pkg))
    d.out(line);
  return code;
}

/** The files the lock lists. */
async function lockFiles(d: PresetDeps): Promise<string[]> {
  const text = d.read(LOCK_FILE);
  if (!text) return [];
  const { load } = await import("js-yaml");
  return readLock(text, load).files;
}

// ---------------------------------------------------------------- remove

export async function remove(argv: string[], d: PresetDeps): Promise<number> {
  const name = argv.find((a) => !a.startsWith("--"));
  const yes = argv.includes("--yes");
  const dry = argv.includes("--dry-run");
  if (!name) {
    d.err("Usage: factory preset remove NAME [--yes] [--dry-run]");
    return 2;
  }
  const ownText = d.read(SETTINGS_FILE) ?? "";
  const own = (await loadYaml(ownText)) as Obj | null;
  const listed = Array.isArray(own?.presets) ? own.presets.map(String) : [];
  if (!listed.includes(name)) {
    d.err(`${name} is not in presets`);
    return 1;
  }
  const { load } = await import("js-yaml");
  const choicesBefore = d.read(CHOICES_FILE);
  const choices = parseChoices(choicesBefore, load);
  const kept = Object.fromEntries(
    Object.entries(choices).filter(([, v]) => v !== name),
  );
  const dropped = Object.keys(choices).length - Object.keys(kept).length;
  let now: Resolved;
  let after: Resolved;
  const without = await withoutPreset(ownText, name);
  try {
    now = await d.resolve(ownText, choicesBefore);
    after = await d.resolve(without, choicesText(kept));
  } catch (e) {
    d.err(e instanceof Error ? e.message : String(e));
    return 1;
  }
  const effAfter = await effective(after);
  const removed: Row[] = [];
  const toDefault: Row[] = [];
  const toOther: Row[] = [];
  const chosenAgainst: Row[] = [];
  const questions: {
    key: string;
    old: unknown;
    next: unknown;
    from: string;
  }[] = [];
  for (const [key, src] of now.resolution.sources) {
    // A list's own source is its items', which have lines of their own.
    if (VALUE_LISTS.includes(key) || PLUGIN_LISTS.includes(key)) continue;
    if (src.from !== name || key.startsWith(".claude/")) continue;
    const list = pluginListOf(key);
    const old = valueInEffect(now, key);
    const nextSrc = after.resolution.sources.get(key);
    if (key.includes("[")) {
      const path = key.slice(0, key.indexOf("["));
      if (!after.resolution.sources.has(key))
        removed.push({
          key: path,
          text: `− ${show(JSON.parse(key.slice(path.length + 1, -1)))}`,
        });
      continue;
    }
    if (!nextSrc) {
      if (list) removed.push({ key: list, text: `− ${show(old)}` });
      else
        toDefault.push({
          key,
          text: `${show(old)} → ${show(getPath(effAfter, key.split(".")))}`,
        });
      continue;
    }
    const next = valueInEffect(after, key);
    if (stable(next) === stable(old)) continue;
    const row = {
      key: list ?? key,
      text: `${show(old)} → ${show(next)}, from ${nextSrc.from}`,
    };
    if (src.state === "chosen") {
      chosenAgainst.push(row);
      questions.push({ key, old, next, from: nextSrc.from });
    } else toOther.push(row);
  }
  const locked = await lockFiles(d);
  const deletes = [...now.resolution.files]
    .filter(([to, f]) => f.from === name && !after.resolution.files.has(to))
    .filter(([to]) => locked.includes(to))
    .map(([to]) => `deletes ${to}`);
  for (const line of summary(
    `Removing ${name} would change these settings here:`,
    [
      { title: "removed", rows: removed },
      { title: "back to the default", rows: toDefault },
      { title: "back to another preset's value", rows: toOther },
      { title: "back to a value you chose against", rows: chosenAgainst },
    ],
    deletes,
  ))
    d.out(line);

  if (dry) return 0;
  if (!yes && !d.terminal) {
    d.out("");
    d.out("Run it in a terminal to choose, or add --yes to apply it.");
    return 1;
  }
  let text = without;
  if (!yes) {
    if (questions.length) {
      d.out("");
      d.out("Choose:");
    }
    for (const q of questions) {
      const [use, keep] = [show(q.next), show(q.old)];
      const options = use === keep ? ["1", "2"] : [use, keep];
      const a = await choose(
        d,
        `  ${q.key}: use ${use} from ${q.from}, or keep ${keep} in your ${SETTINGS_FILE}? [${options.join("/")}] `,
        options,
      );
      if (a === options[1]) text = await withKey(text, q.key, q.old);
    }
    d.out("");
    if (!(await apply(d))) {
      d.out("Nothing changed.");
      return 0;
    }
  }
  d.write(SETTINGS_FILE, text);
  d.out(`removed ${name} from presets in ${SETTINGS_FILE}`);
  if (dropped > 0) {
    d.write(CHOICES_FILE, choicesText(kept));
    d.out(
      `removed ${dropped} choice${dropped === 1 ? "" : "s"} from ${CHOICES_FILE}`,
    );
  }
  const { pkg } = splitName(name);
  if (!listed.some((n) => n !== name && splitName(n).pkg === pkg))
    d.npm(["uninstall", pkg]);
  return syncing(d, false);
}

// ---------------------------------------------------------------- choices

export async function choices(_argv: string[], d: PresetDeps): Promise<number> {
  const ownText = d.read(SETTINGS_FILE) ?? "";
  const before = d.read(CHOICES_FILE);
  let r: Resolved;
  try {
    r = await d.resolve(ownText, before);
  } catch (e) {
    d.err(e instanceof Error ? e.message : String(e));
    return 1;
  }
  // What is not chosen yet comes first: it is what a choice is wanted for.
  const list = [
    ...r.resolution.disagreements.filter((g) => !g.chosen),
    ...r.resolution.disagreements.filter((g) => g.chosen),
  ];
  if (!list.length) {
    d.out("No two presets disagree here.");
    return 0;
  }
  const valueWidth =
    Math.max(
      ...list.flatMap((g) => g.values.map((v) => show(v.value).length)),
    ) + 2;
  const item = (i: number, v: { from: string; value: unknown }) =>
    `  ${i + 1}) ${show(v.value).padEnd(valueWidth)}${v.from}`;
  const column =
    Math.max(
      ...list.map((g) => g.key.length),
      ...list.flatMap((g) => g.values.map((v, i) => item(i, v).length)),
    ) + 5;
  const next = { ...r.choices };
  for (const [n, g] of list.entries()) {
    if (n) d.out("");
    d.out(`${g.key.padEnd(column)}${g.chosen ? "chosen" : "not chosen yet"}`);
    g.values.forEach((v, i) =>
      d.out(
        v.from === g.applies
          ? `${item(i, v).padEnd(column)}← applies now`
          : item(i, v),
      ),
    );
    if (!d.terminal) continue;
    const numbers = g.values.map((_, i) => String(i + 1));
    const a = await choose(
      d,
      `  choose [${numbers.join("/")}, Enter keeps it]: `,
      ["", ...numbers],
    );
    if (a) next[g.key] = g.values[Number(a) - 1]!.from;
  }
  if (!d.terminal) return 0;
  d.out("");
  const text = choicesText(next);
  if (stable(next) === stable(r.choices)) {
    d.out("Nothing changed.");
    return 0;
  }
  d.write(CHOICES_FILE, text);
  return syncing(d, text !== null);
}

export async function chooseOne(
  argv: string[],
  d: PresetDeps,
): Promise<number> {
  const [key, preset] = argv;
  if (!key || !preset) {
    d.err("Usage: factory preset choose KEY PRESET");
    return 2;
  }
  const before = d.read(CHOICES_FILE);
  let r: Resolved;
  try {
    r = await d.resolve(d.read(SETTINGS_FILE) ?? "", before);
  } catch (e) {
    d.err(e instanceof Error ? e.message : String(e));
    return 1;
  }
  const g = r.resolution.disagreements.find((x) => x.key === key);
  if (!g) {
    d.err(`${key}: no two presets disagree on this`);
    return 1;
  }
  if (!g.values.some((v) => v.from === preset)) {
    d.err(`${key}: ${preset} doesn't set this`);
    return 1;
  }
  const text = choicesText({ ...r.choices, [key]: preset });
  if (text !== before) d.write(CHOICES_FILE, text);
  return syncing(d, text !== before);
}

// ---------------------------------------------------------------- check

const ADVICE: Record<string, string> = {
  "own-only": ". Remove it, and set it in each repository that wants it",
  presets:
    ". Remove it, and list each preset in the repositories that use this one",
  off: ". Remove it: only a repository can leave a plugin out",
  unknown: "",
};

/** Each folder under `dir` with a preset file, the package's own first. */
function presetFolders(dir: string, base = dir): string[] {
  const here = existsSync(join(dir, PRESET_FILE))
    ? [relative(base, dir).split(sep).join("/")]
    : [];
  const subs = readdirSync(dir)
    .filter(
      (f) =>
        !["node_modules", "agents", "skills", ".git"].includes(f) &&
        statSync(join(dir, f)).isDirectory(),
    )
    .sort()
    .flatMap((f) => presetFolders(join(dir, f), base));
  return [...here, ...subs];
}

export async function check(_argv: string[], d: PresetDeps): Promise<number> {
  const none = "No preset here: no factory-preset.yaml beside a package.json";
  const manifest = join(d.cwd, "package.json");
  if (!existsSync(manifest)) {
    d.err(none);
    return 1;
  }
  const folders = presetFolders(d.cwd);
  if (!folders.length) {
    d.err(none);
    return 1;
  }
  const pkg = String(JSON.parse(readFileSync(manifest, "utf8")).name ?? "");
  const { load } = await import("js-yaml");
  const names = folders.map((f) => (f ? `${pkg}/${f}` : pkg));
  const shippedNames = new Set(
    folders.flatMap((f) =>
      shipped(join(d.cwd, f)).map(([to]) =>
        to.startsWith(".claude/agents/") ? to.slice(15, -3) : to.split("/")[2]!,
      ),
    ),
  );
  const problems: string[] = [];
  const notes: string[] = [];
  folders.forEach((f) => {
    const file = f ? `${f}/${PRESET_FILE}` : PRESET_FILE;
    let raw: unknown;
    try {
      raw = load(readFileSync(join(d.cwd, file), "utf8"));
    } catch (e) {
      problems.push(`${file}: ${(e as Error).message.split("\n")[0]}`);
      return;
    }
    for (const fault of presetFaults(raw))
      problems.push(
        `${file}: ${fault.key}: ${fault.message}${ADVICE[fault.kind]}`,
      );
    const plugins = isObj(raw) ? raw.plugins : undefined;
    for (const path of [
      ...PLUGIN_LISTS,
      "plugins.refine.refiner",
      "plugins.refine.mockups",
      "plugins.test.prover",
    ]) {
      const at = getPath({ plugins }, path.split("."));
      for (const item of Array.isArray(at)
        ? at
        : at === undefined
          ? []
          : [at]) {
        const n = isObj(item) ? (item.agent ?? item.skill) : undefined;
        if (typeof n !== "string" || n.startsWith("factory-")) continue;
        if (!shippedNames.has(n))
          notes.push(
            `${file}: ${path}: ${n}: not shipped here, so each repository that uses this preset must provide it`,
          );
      }
    }
  });
  if (problems.length) {
    for (const line of [...problems, ...notes]) d.out(line);
    return 1;
  }
  const width = Math.max(...names.map((n) => n.length)) + 3;
  folders.forEach((f, i) =>
    d.out(`${names[i]!.padEnd(width)}${shipsText(join(d.cwd, f))}`),
  );
  for (const line of notes) d.out(line);
  return 0;
}

// ---------------------------------------------------------------- changes

type Mark = { from: string; state?: "chosen" | "not-chosen" };

/** A mark's text read back: who a value came from, and whether it was
 * chosen. No mark is `.claude/factory.yaml`'s own. */
export function readMark(text: string | undefined | null): Mark {
  const t = text?.trim();
  if (!t) return { from: OWN };
  if (t === "default") return { from: "default" };
  if (t.startsWith("over ")) return { from: OWN };
  let m = /^(.+), chosen over .+$/.exec(t);
  if (m) return { from: m[1]!, state: "chosen" };
  m = /^(.+), not chosen yet$/.exec(t);
  if (m) return { from: m[1]!, state: "not-chosen" };
  return { from: t };
}

/** Each setting's mark in a lock, by the key `combine` gives it. */
export async function lockMarks(text: string): Promise<Map<string, Mark>> {
  const { parseDocument, isMap, isSeq, isScalar } = await import("yaml");
  const doc = parseDocument(text);
  const out = new Map<string, Mark>();
  const settings = doc.get("settings");
  const visit = (node: unknown, path: string[]) => {
    const key = path.join(".");
    if (isMap(node)) {
      for (const pair of node.items) {
        const k = String((pair.key as { value?: unknown }).value);
        visit(pair.value, [...path, k]);
      }
      // A role that takes one plugin is marked on its name's line.
      const name = node.items.find((p) =>
        ["agent", "skill"].includes(
          String((p.key as { value?: unknown }).value),
        ),
      );
      if (name && isScalar(name.value) && !out.has(key))
        out.set(key, readMark(name.value.comment));
      return;
    }
    if (isSeq(node)) {
      const list = PLUGIN_LISTS.includes(key);
      node.items.forEach((item) => {
        if (list && isMap(item)) {
          const name = item.items.find((p) =>
            ["agent", "skill"].includes(
              String((p.key as { value?: unknown }).value),
            ),
          );
          if (name && isScalar(name.value))
            out.set(`${key}.${name.value.value}`, readMark(name.value.comment));
        } else if (isScalar(item)) {
          out.set(`${key}[${stable(item.value)}]`, readMark(item.comment));
          if (!out.has(key)) out.set(key, readMark(item.comment));
        }
      });
      return;
    }
    if (isScalar(node)) out.set(key, readMark(node.comment));
  };
  visit(settings, []);
  return out;
}

/** Every leaf of a block, by its dotted path, a list as one value. */
function leaves(
  o: unknown,
  path: string[] = [],
  out = new Map<string, unknown>(),
) {
  if (isObj(o))
    for (const [k, v] of Object.entries(o)) leaves(v, [...path, k], out);
  else out.set(path.join("."), o);
  return out;
}

/** `factory preset changes REF`: what the presets' update changed here,
 * as `factory-deps` comments it. */
export async function changes(argv: string[], d: PresetDeps): Promise<number> {
  const ref = argv[0];
  if (!ref) {
    d.err("Usage: factory preset changes REF");
    return 2;
  }
  const { load } = await import("js-yaml");
  const oldText = d.show(ref, LOCK_FILE);
  const newText = d.read(LOCK_FILE);
  if (newText === null) {
    d.err(staleMessages.missing);
    return 1;
  }
  const empty: Lock = {
    version: "",
    presets: [],
    hash: null,
    settings: {},
    overridden: {},
    files: [],
  };
  const a = oldText ? readLock(oldText, load) : empty;
  const b = readLock(newText, load);
  const [ma, mb] = [
    oldText ? await lockMarks(oldText) : new Map<string, Mark>(),
    await lockMarks(newText),
  ];
  const out: string[] = [];

  const versions = (l: typeof a) =>
    new Map(l.presets.map((p) => [splitName(p.name).pkg, p.version]));
  const [va, vb] = [versions(a), versions(b)];
  for (const [pkg, v] of vb) {
    const was = va.get(pkg);
    if (was !== undefined && was !== v) out.push(`${pkg} ${was} → ${v}`);
  }

  const here: string[] = [];
  const added = b.files.filter((f) => !a.files.includes(f));
  const deleted = a.files.filter((f) => !b.files.includes(f));
  const explained = new Set<string>();
  const fileOf = (name: string, files: string[]) =>
    files.find(
      (f) =>
        f === `.claude/agents/${name}.md` ||
        f.startsWith(`.claude/skills/${name}/`),
    );
  const [la, lb] = [leaves(a.settings), leaves(b.settings)];
  for (const key of new Set([...la.keys(), ...lb.keys()])) {
    const [x, y] = [la.get(key), lb.get(key)];
    if (stable(x) === stable(y)) continue;
    if (PLUGIN_LISTS.includes(key) || VALUE_LISTS.includes(key)) {
      const plug = PLUGIN_LISTS.includes(key);
      const id = (i: unknown) => (plug ? show(i) : stable(i));
      const xs = Array.isArray(x) ? x : [];
      const ys = Array.isArray(y) ? y : [];
      for (const item of ys)
        if (!xs.some((i) => id(i) === id(item))) {
          const file = plug ? fileOf(show(item), added) : undefined;
          if (file) explained.add(file);
          here.push(
            ...(file
              ? [`- ${key}: + ${show(item)},`, `  which wrote ${file}`]
              : [`- ${key}: + ${show(item)}`]),
          );
        }
      for (const item of xs)
        if (!ys.some((i) => id(i) === id(item))) {
          const file = plug ? fileOf(show(item), deleted) : undefined;
          if (file) explained.add(file);
          here.push(
            `- ${key}: − ${show(item)}${file ? `, which deleted ${file}` : ""}`,
          );
        }
      continue;
    }
    const [sa, sb] = [ma.get(key)?.from, mb.get(key)?.from];
    here.push(
      `- ${key}: ${show(x)} → ${show(y)}${sa !== sb && sb && sb !== OWN && sb !== "default" ? `, now from ${sb}` : ""}`,
    );
  }
  for (const f of added) if (!explained.has(f)) here.push(`- wrote ${f}`);
  for (const f of deleted) if (!explained.has(f)) here.push(`- deleted ${f}`);

  const choice: string[] = [];
  for (const [key, mark] of mb) {
    if (mark.state !== "not-chosen") continue;
    if (ma.get(key)?.state === "not-chosen") continue;
    const others = (b.overridden[key] ?? []).filter((o) => o.from !== OWN);
    const now = valueAt(b, key);
    const parts = others.map((o) => `${o.from} now sets ${show(o.value)}`);
    const all = [...parts, `${mark.from} sets ${show(now)}`];
    choice.push(
      `- ${key}: ${all.length > 2 ? `${all.slice(0, -1).join(", ")}, and ${all.at(-1)}` : all.join(", and ")}. ${show(now)} applies, from the later preset, until you choose.`,
    );
  }

  const ignored: string[] = [];
  const needsChoice = new Set(
    [...mb]
      .filter(
        ([k, m]) =>
          m.state === "not-chosen" && ma.get(k)?.state !== "not-chosen",
      )
      .map(([k]) => k),
  );
  for (const [key, entries] of Object.entries(b.overridden)) {
    if (needsChoice.has(key)) continue;
    for (const e of entries) {
      if (e.from === OWN || key.startsWith(".claude/")) continue;
      const was = a.overridden[key]?.find((o) => o.from === e.from);
      const wasInEffect =
        ma.get(key)?.from === e.from ? valueAt(a, key) : was?.value;
      if (stable(wasInEffect) === stable(e.value)) continue;
      if (stable(valueAt(a, key)) !== stable(valueAt(b, key))) continue;
      const mark = mb.get(key);
      if (!mark) continue;
      if (mark.from === OWN)
        ignored.push(`- ${key}, which your ${SETTINGS_FILE} sets`);
      else if (mark.state === "chosen")
        ignored.push(
          `- ${key}: ${show(wasInEffect)} → ${show(e.value)}, but you chose ${mark.from}'s ${show(valueAt(b, key))}`,
        );
      else
        ignored.push(
          `- ${key}: ${show(wasInEffect)} → ${show(e.value)}, but ${mark.from}'s ${show(valueAt(b, key))} applies`,
        );
    }
  }

  const sections: [string, string[]][] = [
    ["Changes here:", here],
    ["Needs a choice:", choice],
    ["Doesn't apply here:", ignored],
  ];
  const shown = sections.filter(([, lines]) => lines.length);
  if (out.length) out.push("");
  if (!shown.length) out.push("Nothing changes here.");
  shown.forEach(([title, lines], i) => {
    if (i) out.push("");
    out.push(title, ...lines);
  });
  if (choice.length)
    out.push(
      "",
      "To choose, on this branch:",
      "  npx --no-install factory preset choices",
    );
  for (const line of out) d.out(line);
  return 0;
}

/** A setting's value in a lock: a list's whole value, or a plugin by its
 * key's name. */
function valueAt(l: { settings: Obj | null }, key: string): unknown {
  const list = pluginListOf(key);
  if (list) {
    const items = getPath(l.settings, list.split("."));
    const name = key.slice(list.length + 1);
    return Array.isArray(items)
      ? items.find((i) => isObj(i) && (i.agent ?? i.skill) === name)
      : undefined;
  }
  return getPath(l.settings, key.split("."));
}

// ---------------------------------------------------------------- doctor

/** Doctor's lines for the lock and the presets it records. */
export async function presetChecks(
  root: string,
  stale: string | null,
): Promise<Check[]> {
  const out: Check[] = [];
  const read = (p: string) => {
    try {
      return readFileSync(join(root, p), "utf8");
    } catch {
      return null;
    }
  };
  const text = read(LOCK_FILE);
  const { load } = await import("js-yaml");
  const lock = text ? readLock(text, load) : null;
  const shownByPreset = new Set<string>();
  const hasModules = existsSync(join(root, "node_modules"));
  for (const p of lock?.presets ?? []) {
    const pkg = splitName(p.name).pkg;
    const v = hasModules
      ? (findPackage(root, pkg)?.version ?? null)
      : undefined;
    if (v === null) {
      const m = staleMessages.notInstalled(p.name);
      shownByPreset.add(m);
      out.push({ state: "fail", text: m });
    } else if (v !== undefined && v !== p.version) {
      const m = staleMessages.version(p.name, v, p.version);
      shownByPreset.add(m);
      out.push({ state: "fail", text: m });
    } else
      out.push({
        state: "pass",
        text: `${p.name} ${p.version} is installed, as the lock records`,
      });
  }
  if (stale && !shownByPreset.has(stale))
    out.unshift({ state: "fail", text: stale });
  const dependabot = read(DEPENDABOT);
  if (dependabot !== null)
    for (const pkg of new Set(
      (lock?.presets ?? []).map((p) => splitName(p.name).pkg),
    ))
      out.push(
        (await hasOwnGroup(dependabot, pkg))
          ? { state: "pass", text: `${pkg} has a Dependabot group of its own` }
          : {
              state: "fail",
              text: `${pkg} has no Dependabot group of its own, so its updates may arrive with other packages`,
              fix: `in ${DEPENDABOT}, give ${pkg} a group of its own`,
            },
      );
  return out;
}

// ---------------------------------------------------------------- running

export async function main(argv: string[], d: PresetDeps): Promise<number> {
  const [sub, ...rest] = argv;
  const commands: Record<
    string,
    (a: string[], d: PresetDeps) => Promise<number>
  > = {
    add,
    remove,
    choices,
    choose: chooseOne,
    check,
    changes,
  };
  const run = sub ? commands[sub] : undefined;
  if (!run) {
    d.err(
      "Usage: factory preset add NAME | remove NAME | choices | choose KEY PRESET | check | changes REF",
    );
    return 2;
  }
  try {
    return await run(rest, d);
  } catch (e) {
    if (!(e instanceof SettingsError)) throw e;
    d.err(e.message);
    return 1;
  }
}

/** The preset commands' dependencies in the repository at `root`. */
export function presetDeps(root = repoRoot()): PresetDeps {
  const files: Deps = filesDeps(root);
  const readAt = (p: string) => {
    try {
      return readFileSync(join(root, p), "utf8");
    } catch {
      return null;
    }
  };
  return {
    root,
    cwd: process.cwd(),
    out: (l) => console.log(l),
    err: (l) => console.error(l),
    terminal: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    ask: async (question) => {
      const { createInterface } = await import("node:readline/promises");
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      try {
        return await rl.question(question);
      } finally {
        rl.close();
      }
    },
    npm: (args) => {
      const r = spawnSync("npm", args, { cwd: root, encoding: "utf8" });
      return {
        status: r.status ?? 1,
        stdout: r.stdout ?? "",
        stderr: r.stderr ?? "",
      };
    },
    sync: async (out) => {
      const sync = await import("./sync.mts");
      return sync.main([], {
        ...sync.syncDeps(root),
        out,
      });
    },
    show: (ref, path) => {
      try {
        return execFileSync("git", ["show", `${ref}:${path}`], {
          cwd: root,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        });
      } catch {
        return null;
      }
    },
    resolve: (own, choicesFile) =>
      resolveFiles({
        ...files,
        readFile: () => own,
        readChoices: () => choicesFile,
      }),
    write: (path, text) => {
      const at = join(root, path);
      if (text === null) rmSync(at, { force: true });
      else {
        mkdirSync(dirname(at), { recursive: true });
        writeFileSync(at, text);
      }
    },
    read: readAt,
  };
}

/** `factory preset ...`. */
export async function run(argv: string[]): Promise<number> {
  return main(argv, presetDeps());
}
