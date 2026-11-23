// What the factory reads from the repository's own `.npmrc`: the variables
// its sign-in lines read, which the workflows set from secrets of the same
// names, and the registries it names, which Dependabot has to know.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const NPMRC = ".npmrc";
const SYNC = "factory sync";
const PUBLIC_REGISTRY = "https://registry.npmjs.org/";
const SIGN_IN = /:(_authToken|_auth|_password|username)$/;
/** npm's own pattern (`@npmcli/config`'s `env-replace.js`): an odd run of
 * backslashes before `${` makes it text. */
const VARIABLE = /(?<!\\)(\\*)\$\{([^${}?]+)(\?)?\}/g;

export type SignIn = { name: string; key: string };
export type Npmrc = {
  /** Each variable a sign-in line reads, once, in the order first read. */
  names: string[];
  signIns: SignIn[];
  /** Each registry URL a `registry=` or `@scope:registry=` line names. */
  registries: string[];
};

/** The key and value of each setting line, as npm's `ini` reads them. */
function entries(text: string): { key: string; value: string }[] {
  const out: { key: string; value: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const at = line.indexOf("=");
    if (at < 0) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if (/^(".*"|'.*')$/.test(value)) value = value.slice(1, -1);
    out.push({ key, value });
  }
  return out;
}

/** The variables a value reads. */
function variables(value: string): string[] {
  const out: string[] = [];
  for (const m of value.matchAll(VARIABLE))
    if (m[1]!.length % 2 === 0) out.push(m[2]!);
  return out;
}

export function readNpmrc(text: string | null): Npmrc {
  const found: Npmrc = { names: [], signIns: [], registries: [] };
  if (!text) return found;
  for (const { key, value } of entries(text)) {
    if (key === "registry" || /^@[^:]+:registry$/.test(key)) {
      if (!found.registries.includes(value)) found.registries.push(value);
      continue;
    }
    if (!SIGN_IN.test(key)) continue;
    for (const name of variables(value)) {
      found.signIns.push({ name, key });
      if (!found.names.includes(name)) found.names.push(name);
    }
  }
  return found;
}

/** The `.npmrc` at the root, read; nothing when there is none. */
export function npmrcAt(root: string): Npmrc {
  const path = join(root, NPMRC);
  return readNpmrc(existsSync(path) ? readFileSync(path, "utf8") : null);
}

/** Why a name can't be set from a secret, or null when it can. */
export function refusal(name: string): string | null {
  if (name === "GITHUB_TOKEN") return null;
  if (name.startsWith("GITHUB_"))
    return `${NPMRC} reads \${${name}} to sign in, and GitHub refuses a secret whose name starts with GITHUB_. Rename it in ${NPMRC}, then run: ${SYNC}`;
  if (["HOME", "PATH", "CI"].includes(name) || /^(RUNNER|ACTIONS)_/.test(name))
    return `${NPMRC} reads \${${name}} to sign in, and the runner sets ${name} for itself. Rename it in ${NPMRC}, then run: ${SYNC}`;
  return null;
}

/** The first refusal among the names, or null. */
export const firstRefusal = (n: Npmrc) =>
  n.names.map(refusal).find((r) => r !== null) ?? null;

const bare = (url: string) => url.replace(/^[a-z]+:/i, "").replace(/\/+$/, "");

/** The registry a sign-in line is for: the registry URL whose host and
 * path its key starts with, the longest when several do, or else the
 * key's own `//host/path/`. */
export function addressOf(n: Npmrc, name: string): string {
  const key = n.signIns.find((s) => s.name === name)?.key ?? "";
  const at = key.replace(SIGN_IN, "");
  const match = n.registries
    .filter((r) => at === bare(r) || at.startsWith(`${bare(r)}/`))
    .sort((a, b) => bare(b).length - bare(a).length)[0];
  return match ?? at;
}

/** The registries Dependabot has to be told, the public one aside. */
export const privateRegistries = (n: Npmrc) =>
  n.registries.filter((r) => bare(r) !== bare(PUBLIC_REGISTRY));

export { bare as bareRegistry };
