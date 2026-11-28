// Which copy of kodor the `kodor` command runs. Plain JavaScript,
// since Node will not run TypeScript from inside node_modules, and free of
// the file system, which `deps` stands in for, so it can be tested alone.
// In order:
//
//   1. The source in the repository it was run from: the first folder at or
//      above `cwd` that has `.git`, when it is this package's own repository,
//      its `package.json` carrying this package's name. So a git worktree
//      runs its own copy.
//   2. The version that repository names, in `version:` of its
//      `.claude/kodor.lock`, or KODOR_VERSION when that is set: this
//      copy when it is that version, and otherwise the copy of it in the
//      cache, which the caller downloads the first time.
//   3. Itself, where no version is named: a repository not set up yet,
//      outside any repository, as in the poller's image, and for `update`,
//      the command that changes the version a repository names.
//
// "Itself" is `src/cli.mts` beside it when that exists, or `dist/cli.mjs`,
// the compiled code an installed package ships.

import { dirname, join } from "node:path";

const RELEASE = /^\d+\.\d+\.\d+$/;

/**
 * @param {{
 *   cwd: string,
 *   here: string,
 *   name: string,
 *   version: string,
 *   cache: string,
 *   env: Record<string, string | undefined>,
 *   command: string | undefined,
 *   exists: (path: string) => boolean,
 *   readName: (manifest: string) => string | null,
 *   read: (path: string) => string | null,
 * }} deps
 * @returns {{ run: string }
 *   | { download: { version: string, dir: string, entry: string } }
 *   | { fault: string }}
 */
export function chooseEntry(deps) {
  const { cwd, here, name, exists, readName } = deps;
  const root = repositoryRoot(cwd, exists);

  if (root) {
    const cli = join(root, "src", "cli.mts");
    if (exists(cli) && readName(join(root, "package.json")) === name)
      return { run: cli };
  }

  const beside = join(here, "src", "cli.mts");
  const self = { run: exists(beside) ? beside : join(here, "dist", "cli.mjs") };

  const wanted =
    deps.env.KODOR_VERSION ||
    (deps.command === "update" || !root ? null : lockVersion(root, deps.read));
  if (!wanted || wanted === deps.version) return self;
  if (!RELEASE.test(wanted))
    return {
      fault: `✗ .claude/kodor.lock names kodor ${wanted}, which is not a release. Run: kodor update`,
    };

  const dir = join(deps.cache, "versions", wanted);
  const entry = join(
    dir,
    "node_modules",
    ...name.split("/"),
    "dist",
    "cli.mjs",
  );
  return exists(entry)
    ? { run: entry }
    : { download: { version: wanted, dir, entry } };
}

/** The version a repository's lock names, or null when it has no lock or
 * the lock names none. Read with a pattern, since the launcher loads no
 * package to parse YAML with. */
function lockVersion(root, read) {
  const text = read(join(root, ".claude", "kodor.lock"));
  return text?.match(/^version: *(\S+) *$/m)?.[1] ?? null;
}

/** Where kodor keeps what it downloads: each version of itself, and
 * each commit of a preset. `src/lib/cache.mts` gives the same folder. */
export function cacheRoot(env, home) {
  return join(env.XDG_CACHE_HOME || join(home, ".cache"), "kodor");
}

/** The line of npm's output that says why it failed: its last `npm error`
 * line but the one naming its log file, or the output's last line when
 * there is none. */
export function lastNpmError(output) {
  const lines = output.split("\n").filter((line) => line.trim() !== "");
  const errors = lines.filter(
    (line) =>
      /^npm (error|ERR!)/.test(line) && !/complete log of this run/.test(line),
  );
  return (errors.at(-1) ?? lines.at(-1) ?? "").trim();
}

/**
 * Downloads one version into the cache with npm, into a folder of its own
 * that is moved into place whole, so two commands that start at once never
 * run a half-installed copy. Returns null, or why it failed.
 *
 * @param {{ version: string, dir: string, entry: string }} download
 * @param {{
 *   name: string,
 *   pid: number,
 *   npm: (args: string[]) => { status: number | null, output: string },
 *   mkdir: (path: string) => void,
 *   rename: (from: string, to: string) => void,
 *   remove: (path: string) => void,
 *   exists: (path: string) => boolean,
 * }} deps
 * @returns {string | null}
 */
export function install(download, deps) {
  const { version, dir, entry } = download;
  const staging = `${dir}.${deps.pid}`;
  deps.mkdir(staging);
  const npm = deps.npm([
    "install",
    "--prefix",
    staging,
    "--no-save",
    "--no-audit",
    "--no-fund",
    `${deps.name}@${version}`,
  ]);
  if (npm.status === 0) {
    // A folder with no copy in it was cut short, and would refuse the move.
    if (!deps.exists(entry)) deps.remove(dir);
    try {
      deps.rename(staging, dir);
    } catch {
      // Another command put it there first.
    }
  }
  deps.remove(staging);
  return deps.exists(entry) ? null : lastNpmError(npm.output);
}

/** The first folder at or above `dir` that has `.git`, or null. */
function repositoryRoot(dir, exists) {
  for (;;) {
    if (exists(join(dir, ".git"))) return dir;
    if (dirname(dir) === dir) return null;
    dir = dirname(dir);
  }
}
