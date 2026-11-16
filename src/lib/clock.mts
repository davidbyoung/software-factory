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
export type Clock = { issue: number | null; start: string };

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
  if (!existsSync(path)) return null;
  try {
    const clock = JSON.parse(readFileSync(path, "utf8")) as Clock;
    return (clock.issue === null || Number.isInteger(clock.issue)) &&
      !Number.isNaN(Date.parse(clock.start))
      ? clock
      : null;
  } catch {
    return null;
  }
}

export function writeClock(session: string, clock: Clock): void {
  writeFileSync(clockPath(session), JSON.stringify(clock));
}
