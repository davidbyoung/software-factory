// Presets: npm packages of settings, agents, and skills that several
// repositories share. `.claude/factory.yaml` names them under `presets`,
// and `factory sync` combines the factory's defaults, each preset in the
// order listed, and the repository's own settings into the lock, with
// where each value came from. Every other command reads the lock.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { DEFAULT_CODE_HOST } from "./code-host/index.mts";
import { ROLE_SHAPE, ROLES, SETTINGS_FILE, SETTINGS_KEYS } from "./config.mts";
import { BUILT } from "./tool-names.mts";

export const PRESET_FILE = "factory-preset.yaml";
export const CHOICES_FILE = ".claude/factory.choices.yaml";
export const LOCK_FILE = ".claude/factory.lock";
/** The layer name of the repository's own settings. */
export const OWN = SETTINGS_FILE;
export const SYNC = "npx --no-install factory sync";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** One value as text that is the same for equal values, whatever the order
 * of a block's keys. */
export function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (isObj(v))
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
      .join(",")}}`;
  return JSON.stringify(v) ?? "undefined";
}

// ---------------------------------------------------------------- Finding

/** A preset's package and the folder in it: `@acme/p/node` is the folder
 * `node` of the package `@acme/p`. */
export function splitName(name: string): { pkg: string; folder: string } {
  const parts = name.split("/");
  const n = name.startsWith("@") ? 2 : 1;
  return {
    pkg: parts.slice(0, n).join("/"),
    folder: parts.slice(n).join("/"),
  };
}

/** A package's folder and version, found as Node finds it from `root`, or
 * null when it is not installed. */
export function findPackage(
  root: string,
  pkg: string,
): { dir: string; version: string } | null {
  for (let at = root; ; at = dirname(at)) {
    const manifest = join(at, "node_modules", pkg, "package.json");
    if (existsSync(manifest)) {
      const { version } = JSON.parse(readFileSync(manifest, "utf8"));
      return { dir: dirname(manifest), version: String(version) };
    }
    if (dirname(at) === at) return null;
  }
}

export type Found = {
  name: string;
  pkg: string;
  folder: string;
  /** The preset's own folder, which holds its file. */
  dir: string;
  version: string;
};

export class PresetError extends Error {}

/** The preset NAME as installed from `root`. Throws a PresetError saying
 * what to do when it is not installed, or is no preset. */
export function findPreset(root: string, name: string): Found {
  const { pkg, folder } = splitName(name);
  const found = findPackage(root, pkg);
  if (!found) throw new PresetError(`${name}: not installed. Run: npm ci`);
  const dir = folder ? join(found.dir, folder) : found.dir;
  if (!existsSync(join(dir, PRESET_FILE)))
    throw new PresetError(
      `${name}: no ${PRESET_FILE} in node_modules/${pkg}${folder ? `/${folder}` : ""}`,
    );
  return { name, pkg, folder, dir, version: found.version };
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

/** The agents and skills a preset in `dir` ships, each as the path it is
 * written to in a repository and the file it comes from. */
export function shipped(dir: string): [string, string][] {
  const agents = walk(join(dir, "agents"))
    .filter((f) => !f.includes("/") && f.endsWith(".md"))
    .map((f): [string, string] => [
      `.claude/agents/${f}`,
      join(dir, "agents", f),
    ]);
  const skills = walk(join(dir, "skills"))
    .filter((f) => f.includes("/"))
    .map((f): [string, string] => [
      `.claude/skills/${f}`,
      join(dir, "skills", f),
    ]);
  return [...agents, ...skills];
}

/** How many agents and skills a preset ships, as `preset check` says it. */
export function shipsText(dir: string): string {
  const files = shipped(dir).map(([to]) => to);
  const agents = files.filter((f) => f.startsWith(".claude/agents/")).length;
  const skills = new Set(
    files
      .filter((f) => f.startsWith(".claude/skills/"))
      .map((f) => f.split("/")[2]),
  ).size;
  if (!agents && !skills) return "no agents or skills";
  const n = (k: number, one: string) => `${k} ${one}${k === 1 ? "" : "s"}`;
  return `${n(agents, "agent")}, ${n(skills, "skill")}`;
}

// ---------------------------------------------------------------- Checking

/** The keys no preset can set: each decides who a session takes
 * instructions from or what merges without a person. */
export const OWN_ONLY = [
  "repository",
  "auto-merge.allow",
  "auto-merge.commands",
];

/** The list roles' paths, such as `plugins.build.reviewers`. */
export const PLUGIN_LISTS = ROLES.filter((r) => ROLE_SHAPE[r].list).map(
  (r) => `plugins.${ROLE_SHAPE[r].phase}.${ROLE_SHAPE[r].key}`,
);

/** The first key a block has that the settings do not know, as `factory
 * config check` words it: `KEY: unknown key`. */
export function unknownKey(raw: unknown): string | null {
  const visit = (v: unknown, path: string, shown: string): string | null => {
    const allowed = SETTINGS_KEYS[path];
    if (!allowed || !isObj(v)) return null;
    const extra =
      path === "tickets" && typeof v.type === "string"
        ? (BUILT.tickets[v.type] ?? [])
        : [];
    for (const [k, value] of Object.entries(v)) {
      const at = path ? `${path}.${k}` : k;
      const show = shown ? `${shown}.${k}` : k;
      if (!allowed.includes(k) && !extra.includes(k))
        return `${show}: unknown key`;
      const inner =
        SETTINGS_KEYS[`${at}[]`] && Array.isArray(value)
          ? value
              .map((item, i) => visit(item, `${at}[]`, `${show}[${i}]`))
              .find(Boolean)
          : visit(value, at, show);
      if (inner) return inner;
    }
    return null;
  };
  return visit(raw, "", "");
}

/** What is wrong with a preset's own settings, each as `KEY: MESSAGE`,
 * before it is combined with any other layer. */
export function presetFaults(raw: unknown): {
  key: string;
  message: string;
  /** Which of the refusals it is, for `preset check`'s advice. */
  kind: "own-only" | "presets" | "off" | "unknown";
}[] {
  const faults: ReturnType<typeof presetFaults> = [];
  if (!isObj(raw)) {
    faults.push({
      key: "version",
      message: "must be 2",
      kind: "unknown",
    });
    return faults;
  }
  if (raw.version !== 2)
    faults.push({ key: "version", message: "must be 2", kind: "unknown" });
  for (const key of OWN_ONLY) {
    const [a, b] = key.split(".") as [string, string?];
    const at = b ? (isObj(raw[a]) ? (raw[a] as Obj)[b] : undefined) : raw[a];
    if (at !== undefined)
      faults.push({
        key,
        message: "a preset can't set this",
        kind: "own-only",
      });
  }
  if (raw.presets !== undefined)
    faults.push({
      key: "presets",
      message: "a preset can't name another preset",
      kind: "presets",
    });
  for (const path of PLUGIN_LISTS) {
    const list = get(raw, path);
    if (Array.isArray(list))
      list.forEach((item, i) => {
        if (isObj(item) && "off" in item)
          faults.push({
            key: `${path}[${i}]`,
            message: "off: only .claude/factory.yaml can leave a plugin out",
            kind: "off",
          });
      });
  }
  const unknown = unknownKey(raw);
  if (unknown) {
    const at = unknown.indexOf(": ");
    faults.push({
      key: unknown.slice(0, at),
      message: unknown.slice(at + 2),
      kind: "unknown",
    });
  }
  return faults;
}

function get(raw: unknown, path: string): unknown {
  let at = raw;
  for (const part of path.split(".")) {
    if (!isObj(at)) return undefined;
    at = at[part];
  }
  return at;
}

// ---------------------------------------------------------------- Combining

/** One layer's settings: a preset's, or `.claude/factory.yaml`'s. */
export type Layer = { name: string; raw: Obj };

/** Where a value in effect came from. `over` names the presets whose
 * values it replaced, where that is part of its mark. */
export type Source = {
  from: string;
  state?: "chosen" | "not-chosen";
  over?: string[];
};

export type Replaced = { from: string; value: unknown };

export type Disagreement = {
  key: string;
  /** Each preset's value, in layer order. */
  values: Replaced[];
  applies: string;
  chosen: boolean;
};

export type Resolution = {
  /** The combined settings, as one file would write them. */
  raw: Obj;
  /** By key: a setting's dotted path, a list item's `PATH[ITEM]`, a
   * plugin's `PATH.NAME`, or a file's path. */
  sources: Map<string, Source>;
  overridden: Map<string, Replaced[]>;
  disagreements: Disagreement[];
  /** The keys each preset sets, for telling a stale choice. */
  setBy: Map<string, Set<string>>;
  /** Each agent or skill file a preset ships that is written, by its path
   * in the repository: the file it comes from and its preset. */
  files: Map<string, { from: string; source: string }>;
  /** `kept PATH, ... over NAME` for each preset file not written. */
  kept: string[];
};

export const itemKey = (path: string, item: unknown) =>
  `${path}[${stable(item)}]`;

const STEPS = new Set([
  "commands.gate",
  "commands.before-commit",
  "commands.build-setup",
]);
const VALUES = new Set([
  "pr-review.commands",
  "auto-merge.allow",
  "auto-merge.deny",
  "auto-merge.commands",
  "site.pages",
  "site.widths",
  "site.checks",
  "site.hide",
]);
const TYPED: Record<string, string> = {
  tickets: "github",
  specs: "none",
  "code-host": DEFAULT_CODE_HOST,
};
const LISTS = new Set(PLUGIN_LISTS);
/** A block is merged key by key: every path the settings give keys for,
 * but a role that takes one plugin, which is one value. */
const isBlock = (path: string) =>
  path in SETTINGS_KEYS &&
  !ROLES.some(
    (r) =>
      !ROLE_SHAPE[r].list &&
      path === `plugins.${ROLE_SHAPE[r].phase}.${ROLE_SHAPE[r].key}`,
  );

type Entry = { layer: string; value: unknown };

export type Combine = {
  layers: Layer[];
  choices: Record<string, string>;
  /** Whether a path is one of the factory's own files. */
  factoryFile?: (path: string) => boolean;
  /** Whether a path is a file the repository wrote itself. */
  ownFile?: (path: string) => boolean;
  /** Each preset's shipped files, by its name. */
  ships?: Map<string, [string, string][]>;
  read?: (file: string) => string;
};

/** The layers combined, the later over the earlier, with
 * `.claude/factory.yaml` last. */
export function combine(c: Combine): Resolution {
  const r: Resolution = {
    raw: {},
    sources: new Map(),
    overridden: new Map(),
    disagreements: [],
    setBy: new Map(),
    files: new Map(),
    kept: [],
  };

  const single = (
    key: string,
    es: Entry[],
    same: (v: unknown) => string = stable,
    shown: (e: Entry) => unknown = (e) => e.value,
  ): Entry => {
    const own = es.find((e) => e.layer === OWN);
    const presets = es.filter((e) => e.layer !== OWN);
    for (const e of presets) {
      const set = r.setBy.get(key) ?? new Set<string>();
      set.add(e.layer);
      r.setBy.set(key, set);
    }
    let winner: Entry;
    if (own) {
      winner = own;
      r.sources.set(
        key,
        presets.length
          ? { from: OWN, over: presets.map((e) => e.layer) }
          : { from: OWN },
      );
    } else {
      const named = c.choices[key];
      const chosen = presets.find((e) => e.layer === named);
      winner = chosen ?? presets.at(-1)!;
      const others = presets.filter(
        (e) => same(e.value) !== same(winner.value),
      );
      if (others.length) {
        r.sources.set(key, {
          from: winner.layer,
          state: chosen ? "chosen" : "not-chosen",
          over: [...new Set(others.map((e) => e.layer))],
        });
        r.disagreements.push({
          key,
          values: presets.map((e) => ({ from: e.layer, value: shown(e) })),
          applies: winner.layer,
          chosen: Boolean(chosen),
        });
      } else r.sources.set(key, { from: winner.layer });
    }
    const replaced = es
      .filter((e) => e !== winner)
      .map((e) => ({ from: e.layer, value: shown(e) }));
    if (replaced.length) r.overridden.set(key, replaced);
    return winner;
  };

  const merge = (path: string, es: Entry[]): unknown => {
    if (path in TYPED) {
      const typeOf = (v: unknown) =>
        typeof v === "string" ? v : isObj(v) ? v.type : undefined;
      let current: unknown = TYPED[path];
      let start = 0;
      es.forEach((e, i) => {
        const t = typeOf(e.value);
        if (t === undefined) return;
        if (t !== current) start = i;
        current = t;
      });
      if (start > 0)
        r.overridden.set(
          path,
          es.slice(0, start).map((e) => ({ from: e.layer, value: e.value })),
        );
      return block(
        path,
        es.slice(start).map((e) => ({
          ...e,
          value: typeof e.value === "string" ? { type: e.value } : e.value,
        })),
      );
    }
    if (LISTS.has(path)) return plugins(path, es);
    if (VALUES.has(path)) return values(path, es);
    if (STEPS.has(path) || !isBlock(path)) return single(path, es).value;
    return block(path, es);
  };

  const block = (path: string, es: Entry[]): unknown => {
    // A value that is not a block is left for the settings' own check to
    // name, from the last layer that wrote one.
    const odd = es.filter((e) => e.value !== null && !isObj(e.value));
    if (odd.length) return single(path, es).value;
    const keys = [
      ...new Set(es.flatMap((e) => Object.keys((e.value as Obj) ?? {}))),
    ];
    const out: Obj = {};
    for (const k of keys) {
      const at = path ? `${path}.${k}` : k;
      const sub = es
        .filter((e) => isObj(e.value) && k in e.value)
        .map((e) => ({ layer: e.layer, value: (e.value as Obj)[k] }));
      out[k] = merge(at, sub);
    }
    return out;
  };

  const values = (path: string, es: Entry[]): unknown => {
    const odd = es.find((e) => !Array.isArray(e.value));
    if (odd) return single(path, es).value;
    const out: unknown[] = [];
    const seen = new Set<string>();
    for (const e of es)
      for (const item of e.value as unknown[]) {
        const k = stable(item);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(item);
        r.sources.set(itemKey(path, item), { from: e.layer });
      }
    const layers = [...new Set(es.map((e) => e.layer))];
    r.sources.set(
      path,
      layers.length === 1 ? { from: layers[0]! } : { from: "" },
    );
    return out;
  };

  const plugins = (path: string, es: Entry[]): unknown => {
    const odd = es.find((e) => !Array.isArray(e.value));
    if (odd) return single(path, es).value;
    const groups = new Map<string, Entry[]>();
    const nameOf = (item: unknown, i: string) =>
      isObj(item) &&
      (typeof item.agent === "string" || typeof item.skill === "string")
        ? String(item.agent ?? item.skill)
        : `\0${i}`;
    for (const e of es)
      (e.value as unknown[]).forEach((item, i) => {
        const name = nameOf(item, `${e.layer}${i}`);
        groups.set(name, [
          ...(groups.get(name) ?? []),
          { layer: e.layer, value: item },
        ]);
      });
    const out: unknown[] = [];
    for (const [name, group] of groups) {
      if (name.startsWith("\0")) {
        out.push(group[0]!.value);
        continue;
      }
      const own = group.find((e) => e.layer === OWN);
      if (
        own &&
        isObj(own.value) &&
        own.value.off === true &&
        group.length === 1
      )
        throw new PresetError(`${path}: ${name}: off, but no preset names it`);
      out.push(single(`${path}.${name}`, group).value);
    }
    r.sources.set(path, { from: "" });
    return out;
  };

  r.raw = block(
    "",
    c.layers.map((l) => ({ layer: l.name, value: l.raw })),
  ) as Obj;

  // The files the presets ship: the factory's own and the repository's own
  // stay, and two presets' files are chosen as a single value is.
  const byPath = new Map<string, Entry[]>();
  for (const l of c.layers)
    for (const [to, from] of c.ships?.get(l.name) ?? [])
      byPath.set(to, [
        ...(byPath.get(to) ?? []),
        { layer: l.name, value: from },
      ]);
  const read = c.read ?? ((f: string) => readFileSync(f, "utf8"));
  const pkgPath = (file: string) => {
    const at = file.lastIndexOf(`${sep}node_modules${sep}`);
    return at < 0
      ? file
      : file
          .slice(at + 14)
          .split(sep)
          .join("/");
  };
  for (const [to, es] of byPath) {
    const last = es.at(-1)!.layer;
    if (c.factoryFile?.(to)) {
      r.kept.push(`kept ${to}, the factory's own, over ${last}`);
      continue;
    }
    if (c.ownFile?.(to)) {
      r.kept.push(`kept ${to}, this repository's own, over ${last}`);
      continue;
    }
    const winner = single(
      to,
      es,
      (v) => read(String(v)),
      (e) => pkgPath(String(e.value)),
    );
    r.files.set(to, { from: winner.layer, source: String(winner.value) });
  }
  return r;
}

/** The mark `factory config explain` gives a value from `source`, or null
 * for none: a value only `.claude/factory.yaml` sets has none. */
export function markText(source: Source | undefined): string | null {
  if (!source) return "default";
  if (source.from === "") return null;
  if (source.from === OWN)
    return source.over?.length ? `over ${source.over.join(" and ")}` : null;
  if (source.state === "chosen")
    return `${source.from}, chosen over ${source.over!.join(" and ")}`;
  if (source.state === "not-chosen") return `${source.from}, not chosen yet`;
  return source.from;
}

// ---------------------------------------------------------------- Choices

export const CHOICES_HEADER = [
  "# Written by `factory preset add`, `remove`, and `choices`: which preset",
  "# wins where two presets set the same thing. Change it with",
  "# `npx --no-install factory preset choices`.",
];

/** The choices file's text, or null when it holds no choice. */
export function choicesText(choices: Record<string, string>): string | null {
  const keys = Object.keys(choices);
  if (!keys.length) return null;
  return [
    ...CHOICES_HEADER,
    ...keys.map((k) => `${k}: ${JSON.stringify(choices[k])}`),
    "",
  ].join("\n");
}

/** Each choice a sync drops, with why: its preset is no longer listed, or
 * no longer sets its key. */
export function staleChoices(
  choices: Record<string, string>,
  presets: string[],
  setBy: Map<string, Set<string>>,
): { key: string; reason: string }[] {
  return Object.entries(choices).flatMap(([key, name]) =>
    !presets.includes(name)
      ? [{ key, reason: `${name} is no longer in presets` }]
      : !setBy.get(key)?.has(name)
        ? [{ key, reason: `${name} no longer sets it` }]
        : [],
  );
}

// ---------------------------------------------------------------- The lock

/** `sha256:` and the hex SHA-256 of the settings file, a NUL byte, then the
 * choices file, or nothing for a missing file. */
export function settingsHash(own: string | null, choices: string | null) {
  const h = createHash("sha256");
  h.update(own ?? "");
  h.update("\0");
  h.update(choices ?? "");
  return `sha256:${h.digest("hex")}`;
}

export const staleMessages = {
  missing: `${LOCK_FILE} is missing. Run: ${SYNC}`,
  earlier: `${LOCK_FILE} is from an earlier version of the factory. Run: ${SYNC}`,
  changed: (file: string) =>
    `${file} changed since the last sync. Run: ${SYNC}`,
  notInstalled: (name: string) =>
    `${name} is in ${LOCK_FILE} but not installed. Run: npm ci`,
  version: (name: string, installed: string, locked: string) =>
    `${name} is ${installed} in node_modules but ${locked} in ${LOCK_FILE}. Run: ${SYNC}`,
};

export type Lock = {
  version: string;
  presets: { name: string; version: string }[];
  hash: string | null;
  settings: Obj | null;
  overridden: Record<string, Replaced[]>;
  files: string[];
};

/** The lock's text read as YAML. A lock from an earlier release has no
 * `settings`, and reads with it null. */
export function readLock(text: string, load: (t: string) => unknown): Lock {
  const o = load(text);
  const d = isObj(o) ? o : {};
  return {
    version: String(d.version ?? ""),
    presets: Array.isArray(d.presets)
      ? d.presets.filter(isObj).map((p) => ({
          name: String(p.name),
          version: String(p.version),
        }))
      : [],
    hash: typeof d["settings-hash"] === "string" ? d["settings-hash"] : null,
    settings: isObj(d.settings) ? d.settings : null,
    overridden: isObj(d.overridden)
      ? (d.overridden as Record<string, Replaced[]>)
      : {},
    files: Array.isArray(d.files) ? d.files.map(String) : [],
  };
}

export type StaleDeps = {
  lock: string | null;
  own: string | null;
  choices: string | null;
  /** The files of the two that differ from the last commit, for naming the
   * one that changed. */
  changed: () => string[];
  /** A package's installed version, null when it is not installed, or
   * undefined when there is no node_modules to look in. */
  installed: (pkg: string) => string | null | undefined;
  load: (t: string) => unknown;
};

/** Why the lock is stale, the first of: missing, from an earlier release,
 * a settings file changed, a preset not installed, a preset at another
 * version. Null when it is current. */
export function staleReason(d: StaleDeps): string | null {
  if (d.lock === null) return staleMessages.missing;
  const lock = readLock(d.lock, d.load);
  if (!lock.settings) return staleMessages.earlier;
  if (lock.hash !== settingsHash(d.own, d.choices)) {
    const changed = d.changed();
    const choicesOnly =
      changed.includes(CHOICES_FILE) && !changed.includes(SETTINGS_FILE);
    return staleMessages.changed(choicesOnly ? CHOICES_FILE : SETTINGS_FILE);
  }
  for (const p of lock.presets) {
    const v = d.installed(splitName(p.name).pkg);
    if (v === null) return staleMessages.notInstalled(p.name);
  }
  for (const p of lock.presets) {
    const v = d.installed(splitName(p.name).pkg);
    if (typeof v === "string" && v !== p.version)
      return staleMessages.version(p.name, v, p.version);
  }
  return null;
}
