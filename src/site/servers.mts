// Starting a site with the repository's `start` command, waiting for it to
// answer, and stopping it. A site is a process group, so stopping it ends
// whatever the command started.
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export class SiteError extends Error {}

export type Running = {
  url: string;
  pid: number;
  /** The last lines the command printed. */
  tail: () => string[];
};

/** A port nothing is listening on. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as { port: number };
      s.close(() => resolve(port));
    });
  });
}

/** `url` with `$PORT` filled in. */
export const withPort = (text: string, port: number) =>
  text.replaceAll("$PORT", String(port));

/** Run `start` from `cwd` with PORT set, and wait up to `minutes` for `url`
 * to answer. Fails with the last lines the command printed. */
export async function startSite(
  opts: {
    start: string;
    url: string;
    cwd: string;
    minutes: number;
    port: number;
  },
  onSpawn: (pid: number) => void = () => {},
): Promise<Running> {
  // The command's output goes to a file, not a pipe: a pipe fills when
  // nothing reads it, which blocks the site while a check runs and breaks it
  // once `--keep` has let this process end.
  const log = join(mkdtempSync(join(tmpdir(), "factory-site-log-")), "log");
  const out = openSync(log, "a");
  const child = spawn("sh", ["-c", opts.start], {
    cwd: opts.cwd,
    env: { ...process.env, PORT: String(opts.port) },
    detached: true,
    stdio: ["ignore", out, out],
  });
  closeSync(out);
  // A site outlives the command that started it when `--keep` is given.
  child.unref();
  onSpawn(child.pid!);
  let exited = false;
  child.on("exit", () => (exited = true));
  const url = withPort(opts.url, opts.port);
  const running: Running = {
    url,
    pid: child.pid!,
    tail: () =>
      readFileSync(log, "utf8").split("\n").filter(Boolean).slice(-15),
  };
  const deadline = Date.now() + opts.minutes * 60_000;
  while (Date.now() < deadline) {
    if (exited) break;
    try {
      await fetch(url, { signal: AbortSignal.timeout(2000) });
      return running;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  stopProcess(running.pid);
  throw new SiteError(
    `the site did not answer at ${url}${exited ? " (its command exited)" : ` in ${opts.minutes} minutes`}. Last lines it printed:\n${running.tail().join("\n")}`,
  );
}

/** Starts every site at once, and resolves when each answers. Each process
 * is in `pids` from the moment it is spawned: when one site fails to start,
 * or the run is interrupted while they start, the caller's cleanup is all
 * that stops the others. */
export function startSites(
  sites: Parameters<typeof startSite>[0][],
  pids: number[],
): Promise<Running[]> {
  return Promise.all(
    sites.map((site) => startSite(site, (pid) => pids.push(pid))),
  );
}

export function stopProcess(pid: number): void {
  for (const target of [-pid, pid]) {
    try {
      process.kill(target, "SIGTERM");
      return;
    } catch {
      // Already gone.
    }
  }
}

/** Whether the repository is a git checkout with this ref. */
export const defaultBranch = (root: string): string => {
  try {
    return execFileSync(
      "git",
      ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
  } catch {
    return "origin/main";
  }
};

/** A detached worktree of `ref` in a temporary folder, with its dependencies
 * installed when it has a lockfile. Returns its path. */
export function addWorktree(root: string, ref: string): string {
  const dir = join(mkdtempSync(join(tmpdir(), "factory-site-")), "base");
  execFileSync("git", ["worktree", "add", "--detach", dir, ref], {
    cwd: root,
    stdio: "ignore",
  });
  if (existsSync(join(dir, "package-lock.json")))
    execFileSync("npm", ["ci", "--prefer-offline", "--no-audit", "--no-fund"], {
      cwd: dir,
      stdio: "ignore",
    });
  return dir;
}

export function removeWorktree(root: string, dir: string): void {
  try {
    execFileSync("git", ["worktree", "remove", "--force", dir], {
      cwd: root,
      stdio: "ignore",
    });
  } catch {
    // Already removed.
  }
  rmSync(join(dir, ".."), { recursive: true, force: true });
  // A worktree whose folder is already gone is only a record until pruned.
  try {
    execFileSync("git", ["worktree", "prune"], { cwd: root, stdio: "ignore" });
  } catch {
    // Nothing to prune.
  }
}

export type Kept = {
  before: { url: string; pid: number };
  after: { url: string; pid: number };
  worktree: string;
};

const stateFile = (root: string) =>
  join(root, "node_modules/.cache/factory/site/kept.json");

export function keep(root: string, kept: Kept): void {
  mkdirSync(join(stateFile(root), ".."), { recursive: true });
  writeFileSync(stateFile(root), JSON.stringify(kept));
}

/** Ends what `--keep` left running and removes its worktree. */
export function stopKept(root: string): boolean {
  if (!existsSync(stateFile(root))) return false;
  const kept = JSON.parse(readFileSync(stateFile(root), "utf8")) as Kept;
  stopProcess(kept.before.pid);
  stopProcess(kept.after.pid);
  removeWorktree(root, kept.worktree);
  rmSync(stateFile(root), { force: true });
  return true;
}
