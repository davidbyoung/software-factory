// What changed, as the commands of the settings read it: from where the
// branch left the default branch, from the last commit, or from the
// default branch itself. Each asks git every time and keeps nothing.

/** Runs git in the repository; `ok` is whether it exited 0. */
export type Git = (args: string[]) => { ok: boolean; out: string };

/** The files that changed, or why they can't be told, and the commit they
 * are compared with. */
export type Change =
  | { files: string[]; base: string }
  | { files: null; why: "no-remote" | "no-shared" | "no-commit"; base: "" };

const lines = (out: string) => out.split("\n").filter(Boolean);

/** Edits to tracked files since `from`, under their old names too, and new
 * files git doesn't ignore. */
function since(git: Git, from: string): string[] {
  const edited = git(["diff", "--name-only", "--no-renames", from]);
  const added = git(["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...lines(edited.out), ...lines(added.out)])].sort();
}

/** What the branch changed since it left `origin/DEFAULT`, committed or
 * not: what the gate, coverage, and the site comparison read. */
export function branchChange(git: Git, defaultBranch: string): Change {
  const remote = `origin/${defaultBranch}`;
  if (!git(["rev-parse", "--verify", "-q", `${remote}^{commit}`]).ok)
    return { files: null, why: "no-remote", base: "" };
  const base = git(["merge-base", "HEAD", remote]);
  if (!base.ok || !base.out.trim())
    return { files: null, why: "no-shared", base: "" };
  return { files: since(git, base.out.trim()), base: base.out.trim() };
}

/** What differs from the last commit: what the commit guard reads. */
export function commitChange(git: Git): Change {
  if (!git(["rev-parse", "--verify", "-q", "HEAD"]).ok)
    return { files: null, why: "no-commit", base: "" };
  return { files: since(git, "HEAD"), base: "HEAD" };
}

/** What differs from `origin/DEFAULT` itself, before or after a merge with
 * it: what relock reads. */
export function relockChange(git: Git, defaultBranch: string): Change {
  const remote = `origin/${defaultBranch}`;
  if (!git(["rev-parse", "--verify", "-q", `${remote}^{commit}`]).ok)
    return { files: null, why: "no-remote", base: "" };
  const base = git(["merge-base", "HEAD", remote]);
  return { files: since(git, remote), base: base.ok ? base.out.trim() : "" };
}

/** The line that says why the change can't be told, and how to fix it. */
export function cannotTell(
  change: Extract<Change, { files: null }>,
  remote: string,
): [string, string] {
  if (change.why === "no-shared")
    return [
      `this branch shares no commit with ${remote}`,
      "In a shallow clone, fetch the history with: git fetch --unshallow origin",
    ];
  if (change.why === "no-commit")
    return ["there is no commit yet", "Commit once, and it reads from there."];
  const [, name] = remote.split("/");
  return [
    `there is no ${remote} to compare with`,
    `Fetch it with: git fetch origin ${name}`,
  ];
}
