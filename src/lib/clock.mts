// A session's cost clock: when its spend was last noted, and on which issue.
// `lunamill ticket` starts and restarts it; the reviewer-run hooks read it
// to know which issue a reviewer works for. It lives in the repository's
// shared git directory beside the `work-claim-N` files, keyed by
// CLAUDE_CODE_SESSION_ID. Node built-ins only: the hooks run it before
// npm ci.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** `issue` is null for a clock a cost note started in a session that never
 * claimed or refined an issue: its spend is counted once, but its reviewer
 * runs belong to no issue. */
export type Clock = { issue: string | null; start: string };

/** The repository's shared git directory, so a session that moves to
 * another worktree of the same clone keeps its claims and its clock. */
export function commonDir(): string {
  return execFileSync("git", ["rev-parse", "--git-common-dir"], {
    encoding: "utf8",
  }).trim();
}

/** Where a session's claims and clock are kept: this checkout's own git
 * folder, or, in a clone `lunamill workspace` made, that of the checkout it
 * ran in. `there` and `here` are the ticket's key in each, which differ
 * where a key alone names no repository. */
export type SessionFiles = { dir: string; there?: string; here?: string };

export const SESSION_FILE = "lunamill-session";

export function sessionFiles(own: string = commonDir()): SessionFiles {
  const path = join(own, SESSION_FILE);
  if (!existsSync(path)) return { dir: own };
  try {
    return JSON.parse(readFileSync(path, "utf8")) as SessionFiles;
  } catch {
    return { dir: own };
  }
}

/** A key of this checkout's as the session's first checkout types it. */
export const keyThere = (f: SessionFiles, key: string) =>
  key === f.here ? f.there! : key;
const keyHere = (f: SessionFiles, key: string | null) =>
  key !== null && key === f.there ? f.here! : key;

/** The key as a file's name takes it. */
const inName = (key: string) => key.replace(/[/#]+/g, "-");

export const claimPath = (key: string) => {
  const files = sessionFiles();
  return join(files.dir, `work-claim-${inName(keyThere(files, key))}`);
};

export const clockPath = (session: string) =>
  join(sessionFiles().dir, `work-clock-${session}`);

/** The clock, or null when none was started or it cannot be read. */
export function readClock(session: string): Clock | null {
  const path = clockPath(session);
  const clock = existsSync(path)
    ? parseClock(readFileSync(path, "utf8"))
    : null;
  return clock && { ...clock, issue: keyHere(sessionFiles(), clock.issue) };
}

/** A clock file's text as the clock, or null when it is not one. */
export function parseClock(text: string): Clock | null {
  try {
    const clock = JSON.parse(text) as { issue: unknown; start: string };
    if (Number.isNaN(Date.parse(clock.start))) return null;
    // A clock written before tickets had keys holds the issue's number.
    if (typeof clock.issue === "number" && Number.isInteger(clock.issue))
      return { issue: String(clock.issue), start: clock.start };
    return clock.issue === null || typeof clock.issue === "string"
      ? { issue: clock.issue, start: clock.start }
      : null;
  } catch {
    return null;
  }
}

export function writeClock(session: string, clock: Clock): void {
  const files = sessionFiles();
  const issue = clock.issue === null ? null : keyThere(files, clock.issue);
  writeFileSync(clockPath(session), JSON.stringify({ ...clock, issue }));
}
