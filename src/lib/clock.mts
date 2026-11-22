// A session's cost clock: when its spend was last noted, and on which issue.
// `factory ticket` starts and restarts it; the reviewer-run hooks read it
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

export const clockPath = (session: string) =>
  join(commonDir(), `work-clock-${session}`);

/** The clock, or null when none was started or it cannot be read. */
export function readClock(session: string): Clock | null {
  const path = clockPath(session);
  return existsSync(path) ? parseClock(readFileSync(path, "utf8")) : null;
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
  writeFileSync(clockPath(session), JSON.stringify(clock));
}
