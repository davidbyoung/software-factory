// Presets: folders of settings, agents, and skills, each in a repository
// on the code host, that several repositories share. `.claude/factory.yaml`
// names them under `presets`, and the lock pins each to one commit, with
// its settings and a hash of each file it ships. `factory sync` combines
// the factory's defaults, each preset in the order listed, and the
// repository's own settings into the lock, with where each value came
// from. Every other command reads the lock.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { DEFAULT_CODE_HOST } from "./code-host/index.mts";
import {
  parseSettings,
  readYaml,
  ROLE_SHAPE,
  ROLES,
  SETTINGS_FILE,
  SETTINGS_KEYS,
  SettingsError,
  UnknownKeyError,
  wordsOf,
} from "./config.mts";
import { BUILT } from "./tool-names.mts";
import { NPMRC, refusal } from "./npmrc.mts";

export const PRESET_FILE = "factory-preset.yaml";
export const CHOICES_FILE = ".claude/factory.choices.yaml";
export const LOCK_FILE = ".claude/factory.lock";
/** The layer name of the repository's own settings. */
export const OWN = SETTINGS_FILE;
export const SYNC = "factory sync";

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

// ---------------------------------------------------------------- Naming

export class PresetError extends Error {}

/** A name that is no preset's, which `factory sync` prints with its mark. */
export class PresetNameError extends PresetError {}

const SEGMENT = /^(?!\.{1,2}$)[\w.-]+$/;

/** A preset's repository and the folder in it: `acme/config//node` is the
 * folder `node` of the repository `acme/config`. The repository's owner may
 * hold more than one part. Throws for a name of any other shape. */
export function parseName(name: string): { repo: string; folder: string } {
  if (name.startsWith("@"))
    throw new PresetNameError(
      `presets: ${JSON.stringify(name)} is an npm package, and a preset now comes from a repository. Name the repository, such as acme/factory-config.`,
    );
  const at = name.indexOf("//");
  const repo = at < 0 ? name : name.slice(0, at);
  const folder = at < 0 ? null : name.slice(at + 2);
  const parts = repo.split("/");
  if (
    parts.length < 2 ||
    !parts.every((p) => SEGMENT.test(p)) ||
    (folder !== null && !folder.split("/").every((p) => SEGMENT.test(p)))
  )
    throw new PresetNameError(
      `presets: ${JSON.stringify(name)} is not a preset's name. Write its repository, as OWNER/NAME or OWNER/NAME//FOLDER`,
    );
  return { repo, folder: folder ?? "" };
}

/** A repository's owner, as a message names it: all of its name but the
 * last part. */
export const ownerOf = (repo: string) => repo.slice(0, repo.lastIndexOf("/"));

/** The first seven characters of a commit, as every line shows one. */
export const short = (commit: string) => commit.slice(0, 7);

// ---------------------------------------------------------------- Reading

/** A preset as the lock pins it: one commit of its repository, whether
 * the repository holds an organization's poller there, its settings as its
 * file had them there, less `version`, and the hash of each agent and
 * skill it ships, by the file's path in a repository that follows it. */
export type Pinned = {
  name: string;
  commit: string;
  poller: boolean;
  settings: Obj;
  files: Record<string, string>;
};

/** `sha256:` and the hex SHA-256 of a file's text, read as UTF-8 as the
 * sync writes it. */
export const fileHash = (text: string) =>
  `sha256:${createHash("sha256").update(text).digest("hex")}`;

/** Where a file a preset ships is in the preset's own folder, from its
 * path in a repository that follows it. */
export const shippedFrom = (to: string) => to.replace(/^\.claude\//, "");

/** Whether a path is one a preset's file is written to: an agent's file,
 * or a file in a skill's folder. */
export const isShippedPath = (path: string) =>
  /^\.claude\/(agents\/[^/]+\.md|skills\/[^/]+\/.+)$/.test(path) &&
  !path.split("/").includes("..");

/** The preset NAME as a checkout of its repository holds it: its settings
 * and the hashes of what it ships. Throws a PresetError when the checkout
 * has no preset file for it, or the file is not one a preset can be. */
export function readPreset(
  checkout: string,
  name: string,
  load: (text: string) => unknown,
): Pick<Pinned, "settings" | "files"> {
  const { repo, folder } = parseName(name);
  const dir = folder ? join(checkout, folder) : checkout;
  if (!existsSync(join(dir, PRESET_FILE)))
    throw new PresetError(
      `${name}: no ${folder ? `${folder}/` : ""}${PRESET_FILE} in ${repo}`,
    );
  let raw: Obj;
  try {
    raw = parsePreset(readFileSync(join(dir, PRESET_FILE), "utf8"), name, load);
  } catch (e) {
    throw e instanceof SettingsError ? new PresetError(e.message) : e;
  }
  // The version is the preset file's own, and never the repository's.
  const { version: _, ...settings } = raw;
  return {
    settings,
    files: Object.fromEntries(
      shipped(dir).map(([to, from]) => [
        to,
        fileHash(readFileSync(from, "utf8")),
      ]),
    ),
  };
}

/** A preset's own files in `dir`: its preset file and everything under the
 * `agents/` and `skills/` beside it, each by its path in the folder, with
 * the hash of its text. */
export function ownFiles(dir: string): Record<string, string> {
  const paths = [
    ...(existsSync(join(dir, PRESET_FILE)) ? [PRESET_FILE] : []),
    ...["agents", "skills"].flatMap((sub) =>
      walk(join(dir, sub)).map((f) => `${sub}/${f}`),
    ),
  ];
  return Object.fromEntries(
    paths.map((p) => [p, fileHash(readFileSync(join(dir, p), "utf8"))]),
  );
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

/** One thing wrong with a preset: what is said of it after the preset's
 * name, and which of the refusals it is, for `preset check`'s advice. */
export type PresetFault = {
  text: string;
  kind: "own-only" | "presets" | "off" | "unknown" | "value";
};

/** Everything wrong with a preset's settings by themselves: what only a
 * preset is refused for, then the first fault of the rules it shares with
 * `.claude/factory.yaml`. */
export function presetFaults(raw: unknown): PresetFault[] {
  const faults: PresetFault[] = [];
  if (!isObj(raw)) return sharedFault(raw);
  for (const key of OWN_ONLY)
    if (get(raw, key) !== undefined)
      faults.push({
        text: `${key}: a preset can't set this`,
        kind: "own-only",
      });
  if (raw.presets !== undefined)
    faults.push({
      text: "presets: a preset can't name another preset",
      kind: "presets",
    });
  // What has just been refused is left out of what the shared rules read,
  // so nothing is refused twice.
  const rest = structuredClone(raw);
  delete rest.repository;
  delete rest.presets;
  if (isObj(rest["auto-merge"])) {
    delete rest["auto-merge"].allow;
    delete rest["auto-merge"].commands;
  }
  for (const path of PLUGIN_LISTS) {
    const list = get(rest, path);
    if (Array.isArray(list))
      list.forEach((item, i) => {
        if (!isObj(item) || !("off" in item)) return;
        faults.push({
          text: `${path}[${i}]: off: only .claude/factory.yaml can leave a plugin out`,
          kind: "off",
        });
        item.off = true;
      });
  }
  return [...faults, ...sharedFault(rest)];
}

/** A preset's settings from its file's text. Throws a SettingsError with
 * the first thing wrong with them, after `name`. */
export function parsePreset(
  text: string,
  name: string,
  load: (text: string) => unknown,
): Obj {
  const raw = readYaml(text, name, load);
  const fault = presetFaults(raw)[0];
  if (fault) throw new SettingsError(`${name}: ${fault.text}`);
  return raw as Obj;
}

/** The faults of a preset as the lock pins it, which leaves its version
 * out. */
export const pinnedFaults = (pin: Pick<Pinned, "settings">) =>
  presetFaults({ version: 2, ...pin.settings });

/** The first fault of the rules a preset shares with the repository's own
 * file, or none. The agents and skills it names may be a repository's. */
function sharedFault(raw: unknown): PresetFault[] {
  try {
    parseSettings(raw, () => true, BUILT, { preset: true });
    return [];
  } catch (e) {
    if (!(e instanceof SettingsError)) throw e;
    return [
      {
        text: wordsOf(e),
        kind: e instanceof UnknownKeyError ? "unknown" : "value",
      },
    ];
  }
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
   * in the repository: its preset, and the hash the lock pins it at. */
  files: Map<string, { from: string; hash: string }>;
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
  "builds.hosts",
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
  /** The hash of each file a preset ships, by the preset's name and the
   * file's path in the repository. */
  ships?: Map<string, Record<string, string>>;
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
  // stay, and two presets' files are chosen as a single value is. A file
  // is shown as its path in its preset's repository.
  const byPath = new Map<string, Entry[]>();
  for (const l of c.layers)
    for (const [to, hash] of Object.entries(c.ships?.get(l.name) ?? {}))
      byPath.set(to, [
        ...(byPath.get(to) ?? []),
        { layer: l.name, value: hash },
      ]);
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
    const winner = single(to, es, stable, (e) => {
      const { folder } = parseName(e.layer);
      return `${folder ? `${folder}/` : ""}${shippedFrom(to)}`;
    });
    r.files.set(to, { from: winner.layer, hash: String(winner.value) });
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
  "# `factory preset choices`.",
];

/** The choices file's text, or null when it holds no choice. */
export function choicesText(choices: Record<string, string>): string | null {
  const keys = Object.keys(choices);
  if (!keys.length) return null;
  return [
    ...CHOICES_HEADER,
    ...keys.map((k) => `${k}: ${scalar(choices[k])}`),
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
  unreadable: `${LOCK_FILE} can't be read. Run: ${SYNC}`,
};

export type Lock = {
  version: string;
  presets: Pinned[];
  hash: string | null;
  /** The variables `.npmrc`'s sign-in lines read at the last sync. */
  npmrcVariables: string[];
  settings: Obj | null;
  overridden: Record<string, Replaced[]>;
  files: string[];
};

/** The lock's text read as YAML. A lock from an earlier release has no
 * `settings`, and reads with it null. A preset it records without a commit
 * is one an earlier release wrote, and is left out. */
export function readLock(text: string, load: (t: string) => unknown): Lock {
  const o = load(text);
  const d = isObj(o) ? o : {};
  return {
    version: String(d.version ?? ""),
    presets: Array.isArray(d.presets)
      ? d.presets
          .filter(isObj)
          .filter((p) => typeof p.commit === "string" && p.commit)
          .map((p) => ({
            name: String(p.name),
            commit: String(p.commit),
            poller: p.poller === true,
            settings: isObj(p.settings) ? p.settings : {},
            files: Object.fromEntries(
              Object.entries(isObj(p.files) ? p.files : {}).map(([k, v]) => [
                k,
                String(v),
              ]),
            ),
          }))
      : [],
    hash: typeof d["settings-hash"] === "string" ? d["settings-hash"] : null,
    npmrcVariables: Array.isArray(d["npmrc-variables"])
      ? d["npmrc-variables"].map(String)
      : [],
    settings: isObj(d.settings) ? d.settings : null,
    overridden: isObj(d.overridden)
      ? (d.overridden as Record<string, Replaced[]>)
      : {},
    files: Array.isArray(d.files) ? d.files.map(String) : [],
  };
}

/** A lock a merge left with conflict markers, with the first side of each
 * conflict. */
function firstSides(text: string): string {
  let side: "none" | "first" | "other" = "none";
  return text
    .split("\n")
    .filter((line) => {
      if (line.startsWith("<<<<<<<")) side = "first";
      else if (side !== "none" && /^(\|{7}|={7})/.test(line)) side = "other";
      else if (line.startsWith(">>>>>>>")) side = "none";
      else return side !== "other";
      return false;
    })
    .join("\n");
}

/** The version of the factory a lock names, or null when it names none. */
export const lockedVersion = (lock: string | null): string | null =>
  /^version: *(\S+) *$/m.exec(lock ?? "")?.[1] ?? null;

/** The presets a lock pins. A lock with conflict markers is read with the
 * first side of each conflict, and one that still can't be read pins
 * none. */
export function pinsOf(
  text: string | null,
  load: (t: string) => unknown,
): Pinned[] {
  if (text === null) return [];
  for (const t of [text, firstSides(text)])
    try {
      return readLock(t, load).presets;
    } catch {
      // The next reading, or none.
    }
  return [];
}

/** The repository whose poller starts the builds of one that follows
 * `pins`: the first preset's that holds an organization's poller, or
 * undefined when none does. */
export function pollerOf(pins: Pinned[]): string | undefined {
  const pin = pins.find((p) => p.poller);
  return pin && parseName(pin.name).repo;
}

/** A key or a value as YAML: plain where it reads back as the same text,
 * quoted as JSON otherwise. */
export const scalar = (v: unknown) =>
  typeof v === "string" &&
  /^[A-Za-z0-9_./][A-Za-z0-9_./ -]*$/.test(v) &&
  !/ $/.test(v) &&
  !/^(true|false|null|yes|no|on|off|~|[-+.\d][\d._eE+-]*)$/i.test(v)
    ? v
    : JSON.stringify(v);

/** js-yaml's `dump` as the lock writes a preset's settings: no line is
 * folded, and nothing is written as a reference to an earlier value. */
export const yamlDump =
  (dump: (v: unknown, o?: object) => string) => (v: unknown) =>
    dump(v, { lineWidth: -1, noRefs: true });

/** The lock's `presets` block. `dump` writes a value as YAML. */
export function pinLines(
  pins: Pinned[],
  dump: (v: unknown) => string,
): string[] {
  if (!pins.length) return ["presets: []"];
  const under = (key: string, lines: string[]) =>
    lines.length
      ? [`    ${key}:`, ...lines.map((l) => `      ${l}`)]
      : [`    ${key}: {}`];
  return [
    "presets:",
    ...pins.flatMap((p) => [
      `  - name: ${scalar(p.name)}`,
      `    commit: ${scalar(p.commit)}`,
      `    poller: ${p.poller}`,
      ...under(
        "settings",
        Object.keys(p.settings).length
          ? dump(p.settings).trimEnd().split("\n")
          : [],
      ),
      ...under(
        "files",
        Object.entries(p.files).map(([f, h]) => `${scalar(f)}: ${h}`),
      ),
    ]),
  ];
}

/** A lock's text with `pins` as the presets it pins and everything else
 * as it was, for `factory sync` to bring the rest in step with. */
export function withPins(
  text: string | null,
  pins: Pinned[],
  dump: (v: unknown) => string,
): string {
  const block = pinLines(pins, dump);
  const lines = text === null ? [""] : text.split("\n");
  const start = lines.findIndex((l) => /^presets:/.test(l));
  if (start < 0) return [...block, ...lines].join("\n");
  const after = lines.findIndex((l, i) => i > start && /^\S/.test(l));
  return [
    ...lines.slice(0, start),
    ...block,
    ...(after < 0 ? [""] : lines.slice(after)),
  ].join("\n");
}

export type StaleDeps = {
  lock: string | null;
  own: string | null;
  choices: string | null;
  /** The files of the two that differ from the last commit, for naming the
   * one that changed. */
  changed: () => string[];
  load: (t: string) => unknown;
  /** The variables `.npmrc`'s sign-in lines read now. */
  npmrcNames?: string[];
};

/** Why the lock is stale, the first of: missing, unreadable, from an
 * earlier release, a settings file changed, `.npmrc`'s variables changed.
 * Null when it is current. */
export function staleReason(d: StaleDeps): string | null {
  if (d.lock === null) return staleMessages.missing;
  let lock: Lock;
  try {
    lock = readLock(d.lock, d.load);
  } catch {
    return staleMessages.unreadable;
  }
  if (!lock.settings) return staleMessages.earlier;
  if (lock.hash !== settingsHash(d.own, d.choices)) {
    const changed = d.changed();
    const choicesOnly =
      changed.includes(CHOICES_FILE) && !changed.includes(SETTINGS_FILE);
    return staleMessages.changed(choicesOnly ? CHOICES_FILE : SETTINGS_FILE);
  }
  const names = d.npmrcNames ?? [];
  const refused = names.map(refusal).find((r) => r !== null);
  if (refused) return refused;
  if (names.join("\n") !== lock.npmrcVariables.join("\n"))
    return staleMessages.changed(NPMRC);
  return null;
}
