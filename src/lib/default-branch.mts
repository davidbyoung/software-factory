// The repository's default branch, by name, for everything that used to
// assume `main`. Each source is asked in turn, and the first to answer wins:
//
//   1. In a workflow run, the event's payload, which names it.
//   2. `REMOTE/HEAD`, which a clone sets.
//   3. The code host. Its answer is written to `REMOTE/HEAD`, so the next
//      run asks nobody.
//
// REMOTE is the remote whose address is the repository the settings'
// `repository` line names, whatever that remote is called, or `origin`
// where no remote's is and `origin`'s address names no repository the
// factory can read. A checkout whose settings name a repository no remote
// has stops with the line that says so. A checkout with no settings reads
// `origin`, and with no `origin` remote it has nobody to ask, and takes
// git's own default: `init.defaultBranch`, or `main`. With a remote and no
// answer, nothing is assumed: the caller stops with the line `cannotTell`
// gives.
//
//   lunamill default-branch   # prints the name, or exits 1 with the fix
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as say from "./output.mts";

/** A git command's exit, and what it printed. */
export type Git = (args: string[]) => { ok: boolean; out: string };

/** Git, run in `cwd`, with its errors dropped. A diff can run past
 * spawnSync's 1 MiB default, which would read as git failing. */
export const gitIn =
  (cwd: string): Git =>
  (args) => {
    const r = spawnSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 256 << 20,
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
  /** The settings' `repository` line, or null in a checkout whose settings
   * have none, or that has no settings. */
  repository: () => Promise<string | null>;
  /** The repository a remote's address names, or null for an address on
   * no code host lunamill supports. */
  repositoryOf: (address: string) => Promise<string | null>;
};

/** What a caller lets answer: every source, or the remote's HEAD alone, for
 * a caller that must ask nobody and assume nothing. */
export type Sources = "all" | "origin-head";

/** The line for a checkout whose remote, `remote`, has no answer. */
export const cannotTell = (remote: string) =>
  `Could not tell the default branch. Run: git remote set-head ${remote} --auto`;

/** Thrown where a command cannot go on without the default branch. Its
 * message is the line to print. */
export class NoDefaultBranch extends Error {
  constructor(line: string) {
    super(line);
  }
}

/** Thrown where the settings name a repository no remote has. */
export class NoRemote extends NoDefaultBranch {}

/** A remote, and the repository its address names, null for an address on
 * no code host lunamill supports. */
export type Remote = { name: string; repository: string | null };

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The name of the remote whose address names `repository`, whatever
 * address it has. Where several do, `origin` is the one, and otherwise the
 * first. Where none does, it is `origin` when that remote's address names
 * no repository, as an SSH host alias or a proxy's address does not: the
 * factory cannot tell which repository that is. Otherwise null. */
export function remoteFor(
  repository: string,
  remotes: Remote[],
): string | null {
  const names = remotes
    .filter((r) => r.repository !== null && same(r.repository, repository))
    .map((r) => r.name);
  if (names.length > 0) return names.includes("origin") ? "origin" : names[0]!;
  return remotes.some((r) => r.name === "origin" && r.repository === null)
    ? "origin"
    : null;
}

/** The line for a checkout whose settings name a repository none of its
 * remotes has, naming `origin`'s repository when there is an `origin`. */
export function noRemoteLine(repository: string, remotes: Remote[]): string {
  const origin = remotes.find((r) => r.name === "origin")?.repository;
  return `✗ repository: .claude/lunamill.yaml says ${repository}, and no remote here is ${repository}. ${origin ? `origin is ${origin}. ` : ""}Add the remote, or change the line and run lunamill sync.`;
}

/** The checkout's remotes, each by the address it fetches from. */
async function remotesOf(d: Deps): Promise<Remote[]> {
  const remotes: Remote[] = [];
  for (const name of d.git(["remote"]).out.split("\n").filter(Boolean)) {
    const address = d.git(["remote", "get-url", name]).out.trim();
    remotes.push({ name, repository: await d.repositoryOf(address) });
  }
  return remotes;
}

/** The remote the default branch is read from: the one `remoteFor` gives
 * for the `repository` line, or `origin` in a checkout with no settings.
 * It rejects with NoRemote when the line names a repository no remote
 * has. */
export async function repositoryRemote(d: Deps): Promise<string> {
  const repository = await d.repository();
  if (repository === null) return "origin";
  const remotes = await remotesOf(d);
  const name = remoteFor(repository, remotes);
  if (name !== null) return name;
  throw new NoRemote(noRemoteLine(repository, remotes));
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
 * answers. It rejects with NoRemote where `repositoryRemote` does. */
export async function defaultBranch(
  d: Deps,
  sources: Sources = "all",
): Promise<string | null> {
  if (sources === "all") {
    const named = fromEvent(d);
    if (named) return named;
  }
  const remote = await repositoryRemote(d);
  const head = d.git([
    "symbolic-ref",
    "--short",
    `refs/remotes/${remote}/HEAD`,
  ]);
  const pointed = head.out.trim();
  if (head.ok && pointed)
    return pointed.startsWith(`${remote}/`)
      ? pointed.slice(remote.length + 1)
      : pointed;
  if (sources === "origin-head") return null;

  if (!d.git(["remote", "get-url", remote]).ok) {
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
  d.git(["remote", "set-head", remote, name]);
  return name;
}

/** The default branch's name, for a command that cannot go on without it. */
export async function needDefaultBranch(
  d: Deps,
  sources: Sources = "all",
): Promise<string> {
  const name = await defaultBranch(d, sources);
  if (name === null)
    throw new NoDefaultBranch(cannotTell(await repositoryRemote(d)));
  return name;
}

/** The sources of the checkout at `root`. The code host is the one the
 * checkout's settings name, and is loaded only when it is asked, so a
 * caller that runs before every command stays quick. The `repository` line
 * is read from the settings file alone, since no preset may set it, so a
 * lock that is stale or missing does not stop the lookup. */
export const branchDeps = (
  root: string,
  env: Record<string, string | undefined> = process.env,
  settings?: () => Promise<import("../config.mts").Settings>,
): Deps => ({
  env,
  readFile: (path) => readFileSync(path, "utf8"),
  git: gitIn(root),
  host: async () => {
    const { defaultDeps, loadSettings, reachOf } =
      await import("../config.mts");
    const { openCodeHost } = await import("../code-host/index.mts");
    const { repository, codeHost } = await reachOf(
      env,
      settings ?? (() => loadSettings(defaultDeps(root))),
    );
    return openCodeHost(repository, codeHost).defaultBranch();
  },
  repository: async () => {
    let text: string;
    try {
      text = readFileSync(
        env.LUNAMILL_SETTINGS || join(root, ".claude/lunamill.yaml"),
        "utf8",
      );
    } catch {
      return null;
    }
    const { parse } = await import("yaml");
    try {
      const line = (parse(text) as { repository?: unknown } | null)?.repository;
      return typeof line === "string" && line ? line : null;
    } catch {
      return null;
    }
  },
  repositoryOf: async (address) => {
    const { TOOLS } = await import("../tools.mts");
    for (const host of Object.values(TOOLS.codeHost)) {
      const repository = host.repositoryOf(address);
      if (repository) return repository;
    }
    return null;
  },
});

export async function main(
  argv: string[],
  d: Deps,
  out: say.Out,
  err: say.Out,
): Promise<number> {
  if (argv.length > 0) {
    err(say.text("Usage: lunamill default-branch"));
    return 2;
  }
  try {
    out(say.text(say.asIs(await needDefaultBranch(d))));
    return 0;
  } catch (e) {
    if (!(e instanceof NoDefaultBranch)) throw e;
    err(say.text(e.message));
    return 1;
  }
}

/** `lunamill default-branch`. */
export async function run(argv: string[]): Promise<number> {
  const { repoRoot } = await import("../config.mts");
  const { out, err } = say.printersFor("default-branch");
  return main(argv, branchDeps(repoRoot()), out, err);
}
