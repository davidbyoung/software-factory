// What a session hands over is a git bundle, and this decides whether it
// may be pushed. It is read as data in a bare clone: nothing in it is
// checked out, no hook runs, and the machine's git settings are not read,
// so a file or a setting the session wrote is never run here.
import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { devNull } from "node:os";

/** The most a bundle may hold. */
const LIMIT = 20_000_000;

const LINK = "120000";
const SUBMODULE = "160000";

export type BundleCheck = {
  /** A bare clone of the repository, made before the bundle was read. */
  repo: string;
  bundle: string;
  /** The commit the session was handed. */
  base: string;
  defaultBranch: string;
  /** The newest commit already on this run's branch, when there is one. */
  published?: string;
  /** The folder whose files decide what runs with the repository's secrets. */
  workflows: string;
};

export type BundleAnswer =
  { tip: string; commits: number } | { refused: string };

class Refused extends Error {}

type Git = (...args: string[]) => { ok: boolean; out: string };

function gitIn(repo: string): Git {
  const env = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: devNull,
    GIT_TERMINAL_PROMPT: "0",
  };
  return (...args) => {
    const r = spawnSync(
      "git",
      [
        "-C",
        repo,
        "-c",
        `core.hooksPath=${devNull}`,
        "-c",
        "transfer.fsckObjects=true",
        ...args,
      ],
      { encoding: "utf8", env, maxBuffer: 256 << 20 },
    );
    return { ok: r.status === 0, out: r.stdout ?? "" };
  };
}

/** Each file a commit changes, with its new mode. For a merge, only those
 * that differ from every parent, which is what the merge itself wrote. */
function changedBy(git: Git, commit: string): { mode: string; path: string }[] {
  const r = git(
    "diff-tree",
    "-r",
    "-c",
    "-z",
    "--root",
    "--raw",
    "--no-commit-id",
    "--no-renames",
    commit,
  );
  if (!r.ok) throw new Refused(`its commit ${short(commit)} cannot be read`);
  const parts = r.out.split("\0").filter((p) => p !== "");
  const found: { mode: string; path: string }[] = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    // A line starts with one colon for each parent, then a mode for each,
    // then the new mode.
    const colons = /^:+/.exec(parts[i])?.[0].length;
    if (!colons)
      throw new Refused(`its commit ${short(commit)} cannot be read`);
    const modes = parts[i].slice(colons).split(" ");
    found.push({ mode: modes[colons], path: parts[i + 1] });
  }
  return found;
}

const short = (commit: string) => commit.slice(0, 7);

function within(path: string, folder: string): boolean {
  return path.toLowerCase().startsWith(`${folder.toLowerCase()}/`);
}

function checkCommit(git: Git, commit: string, o: BundleCheck): void {
  const trunk = `refs/heads/${o.defaultBranch}`;
  const parents = git("rev-list", "--parents", "-n", "1", commit)
    .out.trim()
    .split(" ")
    .slice(1);
  for (const parent of parents.slice(1))
    if (!git("merge-base", "--is-ancestor", parent, trunk).ok)
      throw new Refused(
        `commit ${short(commit)} merges something other than the default branch`,
      );
  for (const { mode, path } of changedBy(git, commit)) {
    if (mode === LINK)
      throw new Refused(
        `commit ${short(commit)} adds a symbolic link, ${path}`,
      );
    if (mode === SUBMODULE)
      throw new Refused(`commit ${short(commit)} adds a submodule, ${path}`);
    if (within(path, o.workflows) || path.toLowerCase() === o.workflows)
      throw new Refused(`commit ${short(commit)} changes ${path}`);
  }
}

function check(git: Git, o: BundleCheck): { tip: string; commits: number } {
  const trunk = `refs/heads/${o.defaultBranch}`;
  const size = statSync(o.bundle, { throwIfNoEntry: false })?.size;
  if (size === undefined) throw new Refused("it handed over no commits");
  if (size > LIMIT) throw new Refused("it is larger than 20 MB");
  const listed = git("bundle", "list-heads", o.bundle);
  const heads = listed.out.trim().split("\n").filter(Boolean);
  if (!listed.ok || heads.length === 0) throw new Refused("it is not a bundle");
  if (heads.length > 1) throw new Refused("it holds more than one branch");
  const [tip, ref] = heads[0].split(" ");
  const incoming = "refs/incoming/tip";
  if (
    !git("fetch", "-q", "--no-tags", o.bundle, `+${ref}:${incoming}`).ok ||
    git("rev-parse", incoming).out.trim() !== tip
  )
    throw new Refused("it does not apply to the commit it was handed");
  if (!git("merge-base", "--is-ancestor", o.base, tip).ok)
    throw new Refused("it does not start from the commit it was handed");
  if (o.published && !git("merge-base", "--is-ancestor", o.published, tip).ok)
    throw new Refused("it drops a commit that is already on the pull request");
  const from = o.published ? [o.published] : [];
  const added = git("rev-list", tip, "--not", trunk, o.base, ...from);
  const commits = added.out.trim().split("\n").filter(Boolean);
  if (!added.ok) throw new Refused("its commits cannot be listed");
  if (commits.length === 0) throw new Refused("it handed over no commits");
  for (const commit of commits) checkCommit(git, commit, o);
  checkFolder(git, tip, o);
  return { tip, commits: commits.length };
}

/** A merge that keeps the branch's own side of a workflow file changes
 * nothing that `checkCommit` sees, and still undoes the default branch's.
 * So the folder as a whole has to be one the branch already had: the
 * default branch's where they meet, or what was there to start with. */
function checkFolder(git: Git, tip: string, o: BundleCheck): void {
  const folder = (commit: string) =>
    git("rev-parse", "-q", "--verify", `${commit}:${o.workflows}`).out.trim();
  const meets = (commit: string) =>
    git("merge-base", commit, `refs/heads/${o.defaultBranch}`).out.trim();
  const start = o.published ?? o.base;
  const own = folder(tip);
  if (own === folder(meets(tip))) return;
  // The default branch has not been merged in since the start, so what a
  // person put there before this run is still all there is.
  if (meets(tip) === meets(start) && own === folder(start)) return;
  throw new Refused(`it leaves ${o.workflows} unlike the default branch's`);
}

/** Whether the bundle may be pushed, with its newest commit and how many it
 * adds, or why not. */
export function checkBundle(o: BundleCheck): BundleAnswer {
  try {
    return check(gitIn(o.repo), o);
  } catch (error) {
    if (error instanceof Refused) return { refused: error.message };
    throw error;
  }
}
