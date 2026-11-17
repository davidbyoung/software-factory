// The repository's default branch, by name, for everything that used to
// assume `main`. Each source is asked in turn, and the first to answer wins:
//
//   1. In a workflow run, the event's payload, which names it.
//   2. `origin/HEAD`, which a clone sets.
//   3. The code host. Its answer is written to `origin/HEAD`, so the next
//      run asks nobody.
//
// A checkout with no `origin` remote has nobody to ask, and takes git's own
// default: `init.defaultBranch`, or `main`. With a remote and no answer,
// nothing is assumed: the caller stops with CANNOT_TELL.
//
//   factory default-branch   # prints the name, or exits 1 with the fix
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** A git command's exit, and what it printed. */
export type Git = (args: string[]) => { ok: boolean; out: string };

/** Git, run in `cwd`, with its errors dropped. */
export const gitIn =
  (cwd: string): Git =>
  (args) => {
    const r = spawnSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return { ok: r.status === 0, out: r.stdout ?? "" };
  };

export type Deps = {
  env: Record<string, string | undefined>;
  /** Reads the event file of a workflow run. */
  readFile: (path: string) => string;
  git: Git;
  /** The code host's answer. It rejects when the host cannot be asked. */
  host: () => Promise<string>;
};

/** What a caller lets answer: every source, or `origin/HEAD` alone, for a
 * caller that must ask nobody and assume nothing. */
export type Sources = "all" | "origin-head";

export const CANNOT_TELL =
  "Could not tell the default branch. Run: git remote set-head origin --auto";

/** Thrown where a command cannot go on without the default branch. */
export class NoDefaultBranch extends Error {
  constructor() {
    super(CANNOT_TELL);
  }
}

/** The default branch a workflow run's event names, or null outside a run
 * and for an event that names none. */
function fromEvent(d: Deps): string | null {
  const path = d.env.GITHUB_EVENT_PATH;
  if (!path) return null;
  try {
    const event = JSON.parse(d.readFile(path)) as {
      repository?: { default_branch?: unknown };
    };
    const name = event.repository?.default_branch;
    return typeof name === "string" && name ? name : null;
  } catch {
    return null;
  }
}

/** The default branch's name, or null when no source the caller allows
 * answers. */
export async function defaultBranch(
  d: Deps,
  sources: Sources = "all",
): Promise<string | null> {
  if (sources === "all") {
    const named = fromEvent(d);
    if (named) return named;
  }
  const head = d.git(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  const pointed = head.out.trim().replace(/^origin\//, "");
  if (head.ok && pointed) return pointed;
  if (sources === "origin-head") return null;

  if (!d.git(["remote", "get-url", "origin"]).ok) {
    const own = d.git(["config", "init.defaultBranch"]);
    return (own.ok && own.out.trim()) || "main";
  }
  let name: string;
  try {
    name = (await d.host()).trim();
  } catch {
    return null;
  }
  if (!name) return null;
  // Remembered, so the next run asks nobody. It can fail in a shallow or
  // single-branch checkout, where the host is asked again next time.
  d.git(["remote", "set-head", "origin", name]);
  return name;
}

/** The default branch's name, for a command that cannot go on without it. */
export async function needDefaultBranch(
  d: Deps,
  sources: Sources = "all",
): Promise<string> {
  const name = await defaultBranch(d, sources);
  if (name === null) throw new NoDefaultBranch();
  return name;
}

/** The sources of the checkout at `root`. The code host is the one the
 * checkout's settings name, and is loaded only when it is asked, so a
 * caller that runs before every command stays quick. */
export const branchDeps = (
  root: string,
  env: Record<string, string | undefined> = process.env,
): Deps => ({
  env,
  readFile: (path) => readFileSync(path, "utf8"),
  git: gitIn(root),
  host: async () => {
    const { defaultDeps, loadSettings, reachOf } =
      await import("../config.mts");
    const { openCodeHost } = await import("../code-host/index.mts");
    const { repository, codeHost } = await reachOf(env, () =>
      loadSettings(defaultDeps(root)),
    );
    return openCodeHost(repository, codeHost).defaultBranch();
  },
});

export async function main(
  argv: string[],
  d: Deps,
  out: (line: string) => void,
  err: (line: string) => void,
): Promise<number> {
  if (argv.length > 0) {
    err("Usage: factory default-branch");
    return 2;
  }
  const name = await defaultBranch(d);
  if (name === null) {
    err(CANNOT_TELL);
    return 1;
  }
  out(name);
  return 0;
}

/** `factory default-branch`. */
export async function run(argv: string[]): Promise<number> {
  const { repoRoot } = await import("../config.mts");
  return main(
    argv,
    branchDeps(repoRoot()),
    (line) => console.log(line),
    (line) => console.error(line),
  );
}
