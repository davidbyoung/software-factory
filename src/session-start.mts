// The SessionStart hook, run as `factory session-start`. Its output opens
// the session's context, so work left on another branch is visible before
// anything new starts: the checkout's state, the local branches with work
// not on the default branch, then each ticket's state.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  branchDeps,
  CANNOT_TELL,
  defaultBranch,
  gitIn,
  type Deps as BranchDeps,
  type Git,
} from "./lib/default-branch.mts";

export { gitIn };

/** Each local branch but the default one, `branch`, with work
 * origin/BRANCH lacks, as "NAME (N commits not on origin/BRANCH)". Pull
 * requests are squash-merged, so a merged branch still has commits the
 * default branch lacks: it counts as merged when merging it into the
 * default branch would change nothing. */
export function unmergedBranches(git: Git, branch: string): string[] {
  const base = `origin/${branch}`;
  const baseTree = git(["rev-parse", `${base}^{tree}`]).out.trim();
  const branches = git([
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/heads",
  ])
    .out.split("\n")
    .filter((b) => b && b !== branch);
  const found: string[] = [];
  for (const b of branches) {
    const merged = git(["merge-tree", "--write-tree", base, b]);
    if (merged.ok && merged.out.split("\n")[0] === baseTree) continue;
    const count = Number(
      git(["rev-list", "--count", `${base}..${b}`]).out.trim() || 0,
    );
    if (count > 0) found.push(`${b} (${count} commits not on ${base})`);
  }
  return found;
}

/** What the hook prints before the tickets' state. `branch` is the default
 * branch, or null when it could not be told: then no branch is compared
 * with anything, and the line that names the fix stands in for the list. */
export function repositoryState(git: Git, branch: string | null): string[] {
  if (branch !== null) git(["fetch", "-q", "origin", branch]);
  const lines = [
    "## Repository state at session start",
    "",
    "```",
    git(["status", "-sb"]).out.trimEnd(),
    "```",
    "",
  ];
  if (branch === null) return [...lines, CANNOT_TELL];
  const unmerged = unmergedBranches(git, branch);
  if (unmerged.length) {
    lines.push(
      `Local branches with work not on origin/${branch}:`,
      "",
      ...unmerged.map((b) => `- ${b}`),
      "",
      "Mention any of these to the user before starting work on another branch.",
    );
  }
  return lines;
}

type Locked = Record<
  string,
  { version?: string; optional?: boolean; link?: boolean }
>;

const readPackages = (file: string): Locked | null => {
  try {
    return JSON.parse(readFileSync(file, "utf8")).packages ?? null;
  } catch {
    return null;
  }
};

/** A line telling the person to run `npm ci` when `node_modules` is older
 * than `package-lock.json`, or null when it is current or there is no
 * lockfile. Without it, a command installed since the lockfile last changed,
 * such as `factory` once it became a workspace package, is missing and the
 * shell's "Permission denied" says nothing of why. */
export function installBehind(dir: string): string | null {
  const wanted = readPackages(join(dir, "package-lock.json"));
  if (!wanted) return null;
  const line =
    "Your installed dependencies are behind package-lock.json: run `npm ci`.";
  const installed = readPackages(
    join(dir, "node_modules", ".package-lock.json"),
  );
  if (!installed) return line;
  for (const [name, entry] of Object.entries(wanted)) {
    if (name === "" || entry.optional) continue;
    const have = installed[name];
    if (!have) return line;
    if (entry.version !== undefined && have.version !== entry.version)
      return line;
  }
  return null;
}

export type Deps = {
  /** The checkout the session starts in. */
  dir: string;
  /** The sources of the default branch's name. */
  branch: BranchDeps;
  out: (text: string) => void;
  /** Prints each ticket's state, and gives the hook's exit. */
  tickets: () => Promise<number>;
};

export async function main(d: Deps): Promise<number> {
  const branch = await defaultBranch(d.branch).catch(() => null);
  d.out(repositoryState(gitIn(d.dir), branch).join("\n"));
  const behind = installBehind(d.dir);
  if (behind) d.out(`\n${behind}\n`);
  return d.tickets();
}

/** `factory session-start`. */
export async function run(): Promise<number> {
  const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  try {
    process.chdir(dir);
  } catch {
    return 0;
  }
  return main({
    dir,
    branch: branchDeps(dir),
    out: (text) => console.log(text),
    // What each ticket's board card says, and who is working on it. The
    // status command enforces its own time limit, since a hook the harness
    // kills prints nothing.
    tickets: async () => {
      const error = console.error;
      console.error = () => {};
      try {
        return await (await import("./status.mts")).run(["--hook"]);
      } catch {
        return 0;
      } finally {
        console.error = error;
      }
    },
  });
}
