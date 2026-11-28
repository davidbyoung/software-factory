// The credentials a ticket system keeps on this machine: one YAML file under
// the person's config folder, readable only by them, filed by tool, then by
// the value of the setting the tool names (such as its site), then by each
// part's name. An environment variable of the same name takes priority, as
// CI and hosted sessions inject it from their own secret stores.
//
// The file also holds a person's code host token and coding agent's
// credential, filed by tool and then by `HOST/OWNER`, which only
// `lunamill init` reads, and never from the environment. Beside it,
// `presets.yaml` records the presets last chosen for each owner.
import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { isMap, parseDocument } from "yaml";
import { CredentialError } from "../tickets/types.mts";
import { listed } from "./listed.mts";

type Env = Record<string, string | undefined>;

const HEADER = [
  "# Written by lunamill init. Readable only by you.",
  "# For a ticket system, an environment variable of the same name takes",
  "# priority over a value here.",
];

/** The file, under `$XDG_CONFIG_HOME` when it is set, else `~/.config`. */
export function credentialsPath(env: Env = process.env): string {
  const base = env.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config");
  return join(base, "lunamill", "credentials.yaml");
}

/** A path as a person would type it: from `~` when it is under home. */
export function shownPath(path: string): string {
  const home = homedir();
  return path === home || path.startsWith(`${home}/`)
    ? `~${path.slice(home.length)}`
    : path;
}

export const missingLine = (label: string, site: string, names: string[]) =>
  `No ${label} credential for ${site}. Set ${listed(names)}, or run: lunamill init`;

export const looseLine = (path: string) =>
  `${shownPath(path)} can be read by others, so it was not read. Run: chmod 600 ${shownPath(path)}`;

export const invalidLine = (path: string, reason: string) =>
  `${shownPath(path)} is not valid YAML: ${reason}. Fix or delete it, then run lunamill init again.`;

export const refusedFileLine = (label: string, site: string, reason: string) =>
  `${label} refused the credential on this machine for ${site} (${reason}). It may have expired. Run: lunamill init`;

export const refusedEnvLine = (
  label: string,
  names: string[],
  site: string,
  reason: string,
  env: Env = process.env,
) =>
  `${env.GITHUB_ACTIONS === "true" ? "::error::" : ""}${label} refused ${listed(names)} for ${site} (${reason}). They may have expired. Run lunamill init, and replace them.`;

/** Why a file cannot be read: it is open to others, or not YAML. */
export type Unreadable = {
  unreadable: "loose" | "invalid";
  line: string;
  /** The path as printed, and the parser's reason for an invalid one. */
  path: string;
  reason?: string;
};

/** The parsed file, null when there is none, or why it cannot be read. */
function load(
  path: string,
): ReturnType<typeof parseDocument> | null | Unreadable {
  if (!existsSync(path)) return null;
  if ((statSync(path).mode & 0o077) !== 0)
    return {
      unreadable: "loose",
      line: looseLine(path),
      path: shownPath(path),
    };
  const doc = parseDocument(readFileSync(path, "utf8"));
  if (doc.errors.length) {
    const reason = doc.errors[0]!.message.split("\n")[0]!;
    return {
      unreadable: "invalid",
      line: invalidLine(path, reason),
      path: shownPath(path),
      reason,
    };
  }
  return doc;
}

export type Found =
  | { state: "found"; source: "env" | "file"; values: Record<string, string> }
  | { state: "missing" };

/** The credential for `tool` at `site`: from the environment when every
 * name is set there and not empty, unless `fileOnly`, else from the file.
 * Throws CredentialError when the file is open to others or not YAML. */
export function readCredential(o: {
  tool: string;
  site: string;
  names: string[];
  env?: Env;
  fileOnly?: boolean;
}): Found {
  const env = o.env ?? process.env;
  if (!o.fileOnly && o.names.every((n) => env[n]?.trim()))
    return {
      state: "found",
      source: "env",
      values: Object.fromEntries(o.names.map((n) => [n, env[n]!])),
    };
  const doc = load(credentialsPath(env));
  if (doc === null) return { state: "missing" };
  if ("unreadable" in doc) throw new CredentialError(doc.line);
  const entry = doc.getIn([o.tool, o.site]);
  if (!isMap(entry)) return { state: "missing" };
  const values: Record<string, string> = {};
  for (const n of o.names) {
    const v = entry.get(n);
    if (typeof v !== "string" || !v) return { state: "missing" };
    values[n] = v;
  }
  return { state: "found", source: "file", values };
}

/** The days `init` wrote beside the token it keeps for `tool` at `site`:
 * `pasted`, and `expires` for a token that expires, each null when there
 * is none, with whether the file holds the entry at all. Nothing when the
 * file cannot be read. It never reads the token. */
export function keptDays(o: { tool: string; site: string; env?: Env }): {
  held: boolean;
  pasted: string | null;
  expires: string | null;
} {
  const none = { held: false, pasted: null, expires: null };
  try {
    const doc = load(credentialsPath(o.env ?? process.env));
    if (doc === null || "unreadable" in doc) return none;
    const entry = doc.getIn([o.tool, o.site]);
    if (!isMap(entry)) return none;
    const day = (key: string) => {
      const value = entry.get(key);
      return typeof value === "string" && value ? value : null;
    };
    return { held: true, pasted: day("pasted"), expires: day("expires") };
  } catch {
    return none;
  }
}

/** The `pasted` day of `keptDays`. */
export const pastedDay = (o: { tool: string; site: string; env?: Env }) =>
  keptDays(o).pasted;

/** Whether the file has an entry for `tool` at `site`; null when it
 * cannot be read. */
export function hasEntry(tool: string, site: string, env: Env = process.env) {
  try {
    const doc = load(credentialsPath(env));
    if (doc === null) return false;
    if ("unreadable" in doc) return null;
    return isMap(doc.getIn([tool, site]));
  } catch {
    return null;
  }
}

/** Stores the values for `tool` at `site`, keeping every other entry. The
 * folder is made, or tightened, to 700; the new file is written at 600
 * beside the old one and renamed over it, so a failed write leaves the old
 * one and nobody else can read it at any moment. */
export function writeCredential(o: {
  tool: string;
  site: string;
  values: Record<string, string>;
  env?: Env;
}): void {
  const path = credentialsPath(o.env ?? process.env);
  ownFolder(dirname(path));
  const old = load(path);
  if (old && "unreadable" in old) throw new CredentialError(old.line);
  const doc = old ?? emptyDocument(HEADER);
  for (const [name, value] of Object.entries(o.values))
    doc.setIn([o.tool, o.site, name], value);
  writeOwned(path, String(doc));
}

/** A document with no entry yet under these comment lines, written one
 * key to a line. */
function emptyDocument(header: string[]) {
  const doc = parseDocument(`${header.join("\n")}\n{}\n`);
  if (isMap(doc.contents)) doc.contents.flow = false;
  return doc;
}

function ownFolder(dir: string): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  if ((statSync(dir).mode & 0o077) !== 0) chmodSync(dir, 0o700);
}

/** Writes a file at 600 in a folder at 700, as `writeCredential` says. */
function writeOwned(path: string, text: string): void {
  ownFolder(dirname(path));
  const temporary = `${path}.${process.pid}.tmp`;
  const fd = openSync(temporary, "wx", 0o600);
  try {
    writeSync(fd, text);
  } finally {
    closeSync(fd);
  }
  try {
    renameSync(temporary, path);
  } catch (e) {
    rmSync(temporary, { force: true });
    throw e;
  }
}

/** `presets.yaml`, beside the credentials file. */
export const presetsPath = (env: Env = process.env) =>
  join(dirname(credentialsPath(env)), "presets.yaml");

/** The presets this machine last chose for an owner, filed as
 * `HOST/OWNER`: none when the file has no list for it, or cannot be
 * read. */
export function rememberedPresets(
  site: string,
  env: Env = process.env,
): string[] {
  const path = presetsPath(env);
  if (!existsSync(path)) return [];
  const doc = parseDocument(readFileSync(path, "utf8"));
  const names = doc.errors.length ? null : doc.toJS()?.[site];
  return Array.isArray(names)
    ? names.filter((n): n is string => typeof n === "string")
    : [];
}

/** Records the presets chosen for an owner, keeping every other owner's. */
export function rememberPresets(
  site: string,
  names: string[],
  env: Env = process.env,
): void {
  const path = presetsPath(env);
  const old = existsSync(path)
    ? parseDocument(readFileSync(path, "utf8"))
    : null;
  const doc =
    old && !old.errors.length && isMap(old.contents)
      ? old
      : emptyDocument(["# Written by lunamill init."]);
  doc.set(site, names);
  writeOwned(path, String(doc));
}

/** What a refusal says: the status and its text, such as
 * `401 Unauthorized`. */
export function refusalReason(e: unknown): string {
  const r = e as { status?: number; reason?: string; message?: string };
  return r.status
    ? `${r.status}${r.reason ? ` ${r.reason}` : ""}`
    : String(r.message ?? e);
}

/** Why the file cannot be read, or null when it can or there is none. */
export function fileProblem(env: Env = process.env): Unreadable | null {
  const doc = load(credentialsPath(env));
  return doc && "unreadable" in doc ? doc : null;
}

/** The credential on this machine and what the ticket system says of it:
 * the one state `init` and `doctor` both read. */
export type MachineState =
  | (Unreadable & { state: "unreadable" })
  | { state: "missing" }
  | {
      state: "accepted";
      source: "env" | "file";
      values: Record<string, string>;
      account: string;
    }
  | {
      state: "refused" | "unchecked";
      source: "env" | "file";
      values: Record<string, string>;
      reason: string;
    };

export async function machineState(
  step: {
    parts: { name: string }[];
    check: (
      values: Record<string, string>,
      site: string,
    ) => Promise<{ account: string }>;
  },
  tool: string,
  site: string,
  env: Env = process.env,
): Promise<MachineState> {
  const problem = fileProblem(env);
  const names = step.parts.map((p) => p.name);
  if (problem && !names.every((n) => env[n]?.trim()))
    return { state: "unreadable", ...problem };
  const found = readCredential({ tool, site, names, env });
  if (found.state === "missing") return found;
  try {
    const { account } = await step.check(found.values, site);
    return {
      state: "accepted",
      source: found.source,
      values: found.values,
      account,
    };
  } catch (e) {
    return {
      state:
        (e as { status?: number }).status === 401 ? "refused" : "unchecked",
      source: found.source,
      values: found.values,
      reason: refusalReason(e),
    };
  }
}
