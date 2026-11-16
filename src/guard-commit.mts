// PreToolUse hook for Bash, run as `factory guard commit` or within
// `factory guard`. Blocks commits and pushes on main, force pushes, adding
// the owner's override label, and any commit the fast half of the gate would
// fail: the before-commit commands in `.claude/factory.yaml`. A block is
// exit 2, which stops the call and shows the message to Claude.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultDeps, loadSettings, settingsPath } from "./config.mts";

export type HookInput = { cwd?: string; tool_input?: { command?: string } };

/** Heredoc bodies and quoted strings blanked, so a commit message, grep
 * pattern, or file body that mentions "git push -f" or "main" is not read as
 * part of a command. A quoted single word is unquoted instead: the shell
 * passes "main" to git as main. */
export function blankQuoted(cmd: string): string {
  return `${cmd}\n`
    .replace(/<<-?[ \t]*(['"]?)(\w+)\1[\s\S]*?\n[ \t]*\2(?=\n|$)/g, "")
    .replace(/(["'])([^"'\s;&|<>()$`\\]+)\1/g, "$2")
    .replace(/"(?:[^"\\]|\\[\s\S])*"/g, '""')
    .replace(/'[^']*'/g, "''");
}

const OVERRIDE = String.raw`verdict(:|%3A)( |%20|\+)override`;

/** "verdict: override" is the owner's approval of one commit, and agents act
 * through the owner's account, so GitHub cannot tell their override from the
 * owner's. This is a tripwire, not a lock: it stops the ordinary gh ways of
 * adding it, not a script written to get around it. It reads each command of
 * the chain as typed, since the spaced name is always quoted, and blocks one
 * that adds the override as --add-label's value or a labels[]= field, or that
 * writes to the labels API with the override anywhere in the command, as a
 * body sent with --input does. Removing the override, alone or beside adding
 * another label, is allowed. */
export function addsOverride(raw: string): boolean {
  const segments = raw
    .split(/\|\||&&|[;&|()]|\n/)
    .filter((s) => /^\s*gh\s/.test(s));
  const adds = new RegExp(
    String.raw`--add-label(=|\s+)["']?[^"']*${OVERRIDE}|labels\[\]=[^"']*${OVERRIDE}`,
    "i",
  );
  if (segments.some((s) => adds.test(s))) return true;
  return (
    new RegExp(OVERRIDE, "i").test(raw) &&
    segments.some(
      (s) =>
        /\/labels(\s|$)/.test(s) &&
        /--input|-X\s*(POST|PUT)|--method\s+(POST|PUT)/.test(s),
    )
  );
}

function resolvePath(dir: string, to: string): string {
  if (isAbsolute(to)) return to;
  if (to === "~") return homedir();
  if (to.startsWith("~/")) return join(homedir(), to.slice(2));
  return `${dir}/${to}`;
}

const isWorkTree = (dir: string) =>
  spawnSync("git", ["-C", dir, "rev-parse", "--is-inside-work-tree"], {
    stdio: "ignore",
  }).status === 0;

export type GitCall = { kind: "push" | "commit"; segment: string; dir: string };

/** Each git push and commit in `cmd`, already blanked, with the directory it
 * runs in. A `cd` moves the directory the commands after it run in, and
 * `git -C DIR` moves its own, so the branch is read where the commit or push
 * runs, not where the session sits. Git's global options, such as
 * `-c key=value`, come before the subcommand and are skipped. A subshell's
 * `cd` ends at its `)`. */
export function gitCalls(cmd: string, cwd: string): GitCall[] {
  const calls: GitCall[] = [];
  const stack: string[] = [];
  let dir = cwd;
  const lines = cmd
    .replace(/\|\||&&|[;&|]/g, "\n")
    .replace(/([()])/g, "\n$1\n")
    .split("\n");
  for (const segment of lines) {
    const w = segment.split(/\s+/).filter(Boolean);
    if (w.length === 0) continue;
    if (w[0] === "(") {
      stack.push(dir);
      continue;
    }
    if (w[0] === ")") {
      if (stack.length) dir = stack.pop()!;
      continue;
    }
    if (w[0] === "cd") {
      dir = resolvePath(dir, w[1] ?? homedir());
      continue;
    }
    if (w[0] !== "git") continue;
    let gdir = dir;
    let i = 1;
    while (i < w.length) {
      if (w[i] === "-C") {
        gdir = resolvePath(gdir, w[i + 1] ?? ".");
        i += 2;
      } else if (
        ["-c", "--git-dir", "--work-tree", "--namespace"].includes(w[i])
      ) {
        i += 2;
      } else if (w[i].startsWith("-")) {
        i += 1;
      } else break;
    }
    // A directory the hook cannot follow, such as `cd "$D"` with its quoted
    // text blanked, or `cd -`, falls back to the session's rather than
    // letting the call through.
    if (!isWorkTree(gdir)) gdir = cwd;
    if (w[i] === "push" || w[i] === "commit")
      calls.push({ kind: w[i] as GitCall["kind"], segment, dir: gdir });
  }
  return calls;
}

const lastLines = (text: string) => text.trimEnd().split("\n").slice(-40);

const toplevel = (dir: string) =>
  execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: dir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();

/** The launcher of the factory in the checkout `top`, where this copy sits
 * in its own checkout, or null when there is none or it is this copy. A
 * session's hook runs the copy in the folder the session opened, whichever
 * worktree the commit is in, and each copy reads only the settings it knows. */
export function ownLauncher(top: string): string | null {
  try {
    const pkg = realpathSync(
      join(dirname(fileURLToPath(import.meta.url)), ".."),
    );
    const own = join(top, relative(toplevel(pkg), pkg), "bin", "factory.js");
    return existsSync(own) && realpathSync(dirname(dirname(own))) !== pkg
      ? own
      : null;
  } catch {
    return null;
  }
}

/** The block message for this Bash call, or null to let it through. Writes
 * the failing gate command's output to `err` first. */
export async function checkCommit(
  input: HookInput,
  err: (text: string) => void,
): Promise<string | null> {
  const raw = input.tool_input?.command ?? "";
  const cwd = input.cwd ?? ".";
  if (addsOverride(raw))
    return '"verdict: override" is the owner\'s label. Ask them to add it.';

  const calls = gitCalls(blankQuoted(raw), cwd);
  if (calls.length === 0) return null;

  for (const { dir } of calls) {
    const branch = spawnSync("git", ["-C", dir, "branch", "--show-current"], {
      encoding: "utf8",
    }).stdout;
    if (branch?.trim() === "main")
      return "main is checked out. Create a branch from origin/main first.";
  }

  const pushes = calls.filter((c) => c.kind === "push").map((c) => c.segment);
  if (pushes.some((p) => /\s(--force|-f)(\s|$)|\s\+\S/.test(p)))
    return "force push. Use --force-with-lease if a rewrite is really intended.";
  if (pushes.some((p) => /\s(\S*:)?(refs\/heads\/)?main(\s|$)/.test(p)))
    return "pushing to main. main only changes through a merged pull request.";

  // The fast half of the gate: the before-commit commands in the commit's
  // own checkout's settings, in order, stopping at the first that fails.
  // Settings that cannot be read block the commit, as a failing command
  // would.
  const commit = calls.find((c) => c.kind === "commit");
  if (!commit) return null;
  let top = commit.dir;
  try {
    top = toplevel(commit.dir);
  } catch {
    // Not a checkout: read the settings where the commit runs.
  }
  const own = ownLauncher(top);
  if (own) {
    const r = spawnSync("node", [own, "guard", "commit"], {
      cwd: top,
      input: JSON.stringify(input),
      encoding: "utf8",
    });
    if (r.status === 0) return null;
    err(lastLines(`${r.stdout ?? ""}${r.stderr ?? ""}`).join("\n"));
    return `the factory in ${top} blocked it, as above.`;
  }
  // A repository with no settings is not one the factory governs, such as
  // another repository a session works in: it has no gate to run.
  if (!existsSync(settingsPath(top))) return null;
  let commands: string[];
  try {
    commands = (await loadSettings(defaultDeps(top))).beforeCommit;
  } catch (e) {
    err(lastLines(e instanceof Error ? e.message : String(e)).join("\n"));
    return "the gate failed: the factory's settings could not be read. Fix the error above, then commit.";
  }
  for (const command of commands) {
    const r = spawnSync("bash", ["-c", `exec 2>&1\n${command}`], {
      cwd: top,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (r.status !== 0) {
      err(lastLines(r.stdout ?? "").join("\n"));
      return `the gate failed on: ${command}. Fix the errors above, then commit.`;
    }
  }
  return null;
}
