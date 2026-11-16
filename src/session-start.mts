// The SessionStart hook, run as `factory session-start`. Its output opens
// the session's context, so work left on another branch is visible before
// anything new starts: the checkout's state, the local branches with work
// not on origin/main, then each ticket's state.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Git = (args: string[]) => { ok: boolean; out: string };

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

/** Each local branch but main with work origin/main lacks, as
 * "NAME (N commits not on origin/main)". Pull requests are squash-merged, so
 * a merged branch still has commits main lacks: it counts as merged when
 * merging it into main would change nothing. */
export function unmergedBranches(git: Git): string[] {
  const mainTree = git(["rev-parse", "origin/main^{tree}"]).out.trim();
  const branches = git([
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/heads",
  ])
    .out.split("\n")
    .filter((b) => b && b !== "main");
  const found: string[] = [];
  for (const b of branches) {
    const merged = git(["merge-tree", "--write-tree", "origin/main", b]);
    if (merged.ok && merged.out.split("\n")[0] === mainTree) continue;
    const count = Number(
      git(["rev-list", "--count", `origin/main..${b}`]).out.trim() || 0,
    );
    if (count > 0) found.push(`${b} (${count} commits not on origin/main)`);
  }
  return found;
}

/** What the hook prints before the tickets' state. */
export function repositoryState(git: Git): string[] {
  git(["fetch", "-q", "origin", "main"]);
  const lines = [
    "## Repository state at session start",
    "",
    "```",
    git(["status", "-sb"]).out.trimEnd(),
    "```",
    "",
  ];
  const unmerged = unmergedBranches(git);
  if (unmerged.length) {
    lines.push(
      "Local branches with work not on origin/main:",
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

export async function run(): Promise<number> {
  const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  try {
    process.chdir(dir);
  } catch {
    return 0;
  }
  console.log(repositoryState(gitIn(dir)).join("\n"));
  const behind = installBehind(dir);
  if (behind) console.log(`\n${behind}\n`);
  // What each ticket's board card says, and who is working on it. The status
  // command enforces its own time limit, since a hook the harness kills
  // prints nothing.
  const error = console.error;
  console.error = () => {};
  try {
    return await (await import("./status.mts")).run(["--hook"]);
  } catch {
    return 0;
  } finally {
    console.error = error;
  }
}
