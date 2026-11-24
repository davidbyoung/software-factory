// Reading a preset's repository with git: the newest commit of its default
// branch, and one commit downloaded into the cache on the machine. Only
// `factory preset add`, `factory update`, the check of a pull request that
// moves a pin, and a sync that has to restore a copy come here. Every other
// command reads the lock and the copies in the repository.
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { devNull, homedir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_CODE_HOST, openCodeHost } from "./code-host/index.mts";
import { cacheRoot, presetCommitDir } from "./lib/cache.mts";
import {
  fileHash,
  LOCK_FILE,
  ownFiles,
  parseName,
  pinsOf,
  PresetError,
  readPreset,
  short,
  stable,
  withPins,
  yamlDump,
  type Pinned,
} from "./preset.mts";
import { POLLER_FILE } from "./workflow-files.mts";

export type GitResult = { status: number; stdout: string; stderr: string };

/** Runs git with these arguments in `cwd`, with this environment and no
 * other. */
export type Git = (
  args: string[],
  o: { cwd: string; env: Record<string, string | undefined> },
) => GitResult;

const MINUTES = 5;

/** Git, stopped when it has not ended after five minutes, so a run nobody
 * watches fails where it would wait. */
export const runGit: Git = (args, o) => {
  const r = spawnSync("git", args, {
    ...o,
    encoding: "utf8",
    timeout: MINUTES * 60_000,
  });
  const stopped = (r.error as NodeJS.ErrnoException)?.code === "ETIMEDOUT";
  return {
    status: r.status ?? 1,
    stdout: r.stdout ?? "",
    stderr: stopped
      ? `git did not answer in ${MINUTES} minutes`
      : r.stderr || (r.error?.message ?? ""),
  };
};

export type FetchDeps = {
  git: Git;
  /** The cache's folder, as `cacheRoot` gives it. */
  cache: string;
  /** Where git reads a repository from, as the code host's `remote`. */
  remote: (repo: string) => { url: string; host: string };
  /** The repository that follows the presets, as its settings name it. */
  repository: string;
  env: Record<string, string | undefined>;
  /** The token the code host's own command-line tool is signed in with, or
   * null when it is signed in as nobody. */
  signIn?: () => string | null;
};

/** What reads the presets of `repository` on this machine. */
export const fetchDeps = (
  repository: string,
  codeHost: string = DEFAULT_CODE_HOST,
  env: Record<string, string | undefined> = process.env,
): FetchDeps => {
  const host = openCodeHost(repository, codeHost);
  let token: string | null | undefined;
  return {
    git: runGit,
    cache: cacheRoot(env, homedir()),
    remote: host.remote,
    repository,
    env,
    // Asked once: every git call reads the environment again.
    signIn: () => (token === undefined ? (token = host.gitToken()) : token),
  };
};

/** A repository git could not read. Its message is git's own last line. */
export class FetchError extends Error {}

/** Whether a preset's repository has the same owner as the repository that
 * follows it: the first part of each name. */
export const sameOwner = (repo: string, repository: string) =>
  repo.split("/")[0]!.toLowerCase() === repository.split("/")[0]!.toLowerCase();

/** Why `repo` could not be read, as `factory update` says it mid-sentence. */
export const whyUnread = (e: unknown, repo: string, repository: string) =>
  sameOwner(repo, repository)
    ? (e instanceof Error ? e.message : String(e)).replace(/\.+$/, "")
    : "not found, or private";

const TOKEN = "FACTORY_PRESET_TOKEN";

/** The environment git reads a preset's repository with. One of the same
 * owner is read with `GH_TOKEN` or `GITHUB_TOKEN` as the password, as a run
 * has them, or else the token the code host's own tool is signed in with,
 * or else git's own sign-in on the machine. Any other is read with no sign-in at
 * all: no credential helper, and no system or global settings, which could
 * name one. Nothing ever waits on a person: git asks for nothing at the
 * terminal or through a program, and Git Credential Manager, which opens
 * a window of its own, is told to fail instead. */
export function gitEnv(
  d: Pick<FetchDeps, "env" | "repository" | "cache" | "signIn">,
  repo: string,
): Record<string, string | undefined> {
  const base = {
    ...d.env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_ASKPASS: "",
    GCM_INTERACTIVE: "never",
    // The cache is no repository's, so no checkout's own settings apply.
    GIT_CEILING_DIRECTORIES: dirname(d.cache),
  };
  const config = (from: number, values: [string, string][]) =>
    Object.fromEntries([
      ["GIT_CONFIG_COUNT", String(from + values.length)],
      ...values.flatMap(([key, value], i) => [
        [`GIT_CONFIG_KEY_${from + i}`, key],
        [`GIT_CONFIG_VALUE_${from + i}`, value],
      ]),
    ]);
  if (!sameOwner(repo, d.repository))
    return {
      ...base,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: devNull,
      ...config(0, [["credential.helper", ""]]),
    };
  const token = d.env.GH_TOKEN || d.env.GITHUB_TOKEN || d.signIn?.();
  if (!token) return base;
  // An empty helper clears the machine's own, and the token stays out of
  // git's arguments, which other processes can read.
  return {
    ...base,
    [TOKEN]: token,
    ...config(Number(d.env.GIT_CONFIG_COUNT) || 0, [
      ["credential.helper", ""],
      [
        "credential.helper",
        `!f() { echo username=x-access-token; echo "password=$${TOKEN}"; }; f`,
      ],
    ]),
  };
}

/** The line of git's that says why it failed: its last `fatal:` line, or
 * its last line when it has none. */
export function lastGitLine(stderr: string): string {
  const lines = stderr.split("\n").filter((l) => l.trim() !== "");
  return (
    lines.filter((l) => l.startsWith("fatal:")).at(-1) ??
    lines.at(-1) ??
    ""
  ).trim();
}

const COMMIT = /^[0-9a-f]{40}([0-9a-f]{24})?$/;

/** The newest commit of the default branch of a preset's repository.
 * Throws a FetchError when the repository cannot be read. */
export function newestCommit(d: FetchDeps, repo: string): string {
  mkdirSync(d.cache, { recursive: true });
  const r = d.git(["ls-remote", d.remote(repo).url, "HEAD"], {
    cwd: d.cache,
    env: gitEnv(d, repo),
  });
  if (r.status !== 0) throw new FetchError(lastGitLine(r.stderr));
  const commit = /^([0-9a-f]+)\tHEAD$/m.exec(r.stdout)?.[1];
  if (!commit || !COMMIT.test(commit))
    throw new FetchError("it has no commit on a default branch");
  return commit;
}

/** The folder of the cache that holds one commit of a preset's repository,
 * or null when this machine has not downloaded it. */
export function cachedCommit(
  d: Pick<FetchDeps, "cache" | "remote">,
  repo: string,
  commit: string,
): string | null {
  const dir = presetCommitDir(d.cache, d.remote(repo).host, repo, commit);
  return COMMIT.test(commit) && existsSync(dir) ? dir : null;
}

/** One commit of a preset's repository in the cache, downloaded when it is
 * not there yet: the folder it is checked out in. Throws a FetchError when
 * it cannot be read. */
export function fetchCommit(
  d: FetchDeps,
  repo: string,
  commit: string,
): string {
  // A commit comes from the lock, which a pull request can change: only a
  // full ID is ever handed to git, never an option.
  if (!COMMIT.test(commit)) throw new FetchError(`${commit} is not a commit`);
  const { url, host } = d.remote(repo);
  const dir = presetCommitDir(d.cache, host, repo, commit);
  if (existsSync(dir)) return dir;
  // Checked out beside its place and moved there whole, so a download that
  // stops halfway is never read as the commit.
  const temp = `${dir}.${process.pid}.tmp`;
  rmSync(temp, { recursive: true, force: true });
  mkdirSync(temp, { recursive: true });
  const env = gitEnv(d, repo);
  try {
    for (const args of [
      ["init", "--quiet"],
      ["fetch", "--quiet", "--depth", "1", url, commit],
      ["checkout", "--quiet", "FETCH_HEAD"],
    ]) {
      const r = d.git(args, { cwd: temp, env });
      if (r.status !== 0) throw new FetchError(lastGitLine(r.stderr));
    }
    renameSync(temp, dir);
  } catch (e) {
    rmSync(temp, { recursive: true, force: true });
    if (!existsSync(dir)) throw e;
  }
  return dir;
}

/** When a commit of a preset's repository was committed. */
export function commitDate(d: FetchDeps, repo: string, commit: string): Date {
  const r = d.git(["cat-file", "commit", "HEAD"], {
    cwd: fetchCommit(d, repo, commit),
    env: gitEnv(d, repo),
  });
  const seconds = /^committer .* (\d+) [+-]\d{4}$/m.exec(r.stdout)?.[1];
  if (r.status !== 0 || !seconds) throw new FetchError(lastGitLine(r.stderr));
  return new Date(Number(seconds) * 1000);
}

/** The preset NAME as one commit of its repository holds it, downloading
 * the commit when the cache lacks it. Throws a FetchError when it cannot
 * be read, and a PresetError when the commit holds no such preset. */
export function pinAt(
  d: FetchDeps,
  name: string,
  commit: string,
  load: (text: string) => unknown,
): Pinned {
  const dir = fetchCommit(d, parseName(name).repo, commit);
  return {
    name,
    commit,
    poller: existsSync(join(dir, POLLER_FILE)),
    ...readPreset(dir, name, load),
  };
}

/** The text of a file the preset pinned at `pin` ships, by its path in a
 * repository that follows it, or null when the commit cannot be read or
 * does not hold the file as the lock records it. */
export function shippedText(
  d: FetchDeps,
  pin: Pinned,
  path: string,
): string | null {
  const { repo, folder } = parseName(pin.name);
  try {
    const file = join(
      fetchCommit(d, repo, pin.commit),
      folder,
      path.replace(/^\.claude\//, ""),
    );
    const text = existsSync(file) ? readFileSync(file, "utf8") : null;
    return text !== null && fileHash(text) === pin.files[path] ? text : null;
  } catch (e) {
    if (e instanceof FetchError) return null;
    throw e;
  }
}

/** Whether a preset's own files, its `factory-preset.yaml` and everything
 * under the `agents/` and `skills/` beside it, differ between two commits
 * of its repository. Both are downloaded when the cache lacks them. */
export function presetDiffers(
  d: FetchDeps,
  name: string,
  from: string,
  to: string,
): boolean {
  const { repo, folder } = parseName(name);
  const at = (commit: string) =>
    stable(ownFiles(join(fetchCommit(d, repo, commit), folder)));
  return from !== to && at(from) !== at(to);
}

/** What is wrong with the pins of a lock, beside those of the lock it is
 * to replace: a pin whose commit moved, or is new, that does not hold what
 * its commit holds, and a pin whose commit stayed while what it records
 * changed. Only a moved or new pin's repository is read. */
export function pinFaults(
  d: FetchDeps,
  pins: Pinned[],
  base: Pinned[],
  load: (text: string) => unknown,
  unread?: (pin: Pinned) => void,
): string[] {
  const same = (a: Pinned, b: Pinned) =>
    a.poller === b.poller &&
    stable(a.settings) === stable(b.settings) &&
    stable(a.files) === stable(b.files);
  return pins.flatMap((pin) => {
    const was = base.find((b) => b.name === pin.name);
    if (was?.commit === pin.commit)
      return same(was, pin)
        ? []
        : [
            `${LOCK_FILE}: the settings or files recorded for ${pin.name} changed, and its commit did not. Restore the lock from the default branch, then run: factory sync`,
          ];
    const differs = `${LOCK_FILE}: ${pin.name} at ${short(pin.commit)} does not match what that commit holds. Run: factory update`;
    try {
      return same(pinAt(d, pin.name, pin.commit, load), pin) ? [] : [differs];
    } catch (e) {
      if (e instanceof PresetError) return [differs];
      if (e instanceof FetchError && unread) {
        unread(pin);
        return [];
      }
      if (e instanceof FetchError)
        return [
          `${LOCK_FILE}: ${pin.name} at ${short(pin.commit)} could not be read to check it: ${e.message}`,
        ];
      throw e;
    }
  });
}

/** A file's text at a git revision of the repository at `root`, or null
 * when it has none there. */
export function fileAt(root: string, ref: string, path: string) {
  try {
    return execFileSync("git", ["show", `${ref}:${path}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

/** Moves the pin of the preset NAME in the lock of the repository at
 * `root` to `commit`, with its settings and hashes as that commit holds
 * them, adding the pin when the lock has none for it. The lock's other
 * parts stay as they were until the next `factory sync`. */
export async function movePin(
  root: string,
  name: string,
  commit: string,
  d: FetchDeps,
): Promise<Pinned> {
  const { load, dump } = await import("js-yaml");
  const at = join(root, LOCK_FILE);
  const text = existsSync(at) ? readFileSync(at, "utf8") : null;
  const pin = pinAt(d, name, commit, load);
  const pins = pinsOf(text, load);
  const next = pins.some((p) => p.name === name)
    ? pins.map((p) => (p.name === name ? pin : p))
    : [...pins, pin];
  mkdirSync(dirname(at), { recursive: true });
  writeFileSync(at, withPins(text, next, yamlDump(dump)));
  return pin;
}
