// The day the token `claude setup-token` makes stops working, a year after
// it was made, and the lines `doctor`, `status`, and `init` say it in.
// GitHub never shows a secret, only the day it was last stored, so the day
// is counted from that, or from the day `init` wrote beside the token on
// this machine when that is earlier. A token is made before it is stored,
// so the day can be early, never late.
import { AGENT_TOKEN } from "../parts.mts";
import type { Check } from "../setup.mts";
import * as say from "./output.mts";

/** How many days before the day the warning starts. */
export const WARN_DAYS = 30;

export type Stage = "fine" | "soon" | "over";

export type TokenDay = {
  /** `YYYY-MM-DD`, in UTC. */
  day: string;
  /** The day it counts from. */
  since: string;
  from: "stored" | "pasted";
  /** Whole days from today to `day`: 0 on the day, below 0 after it. */
  left: number;
  stage: Stage;
  /** The organization that stored it, or null for the repository's own. */
  org: string | null;
};

const DAY_MS = 86_400_000;

/** The UTC day of an ISO time or a `YYYY-MM-DD`, or null for neither. */
export function dayOf(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}(T|$)/.test(value)) return null;
  const time = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(time) ? null : new Date(time).toISOString().slice(0, 10);
}

/** The same day a year later; 29 February gives 1 March. */
function yearAfter(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y! + 1, m! - 1, d!)).toISOString().slice(0, 10);
}

export const stageOf = (left: number): Stage =>
  left < 0 ? "over" : left <= WARN_DAYS ? "soon" : "fine";

/** `today`, `in 1 day`, or `in N days`. */
export const when = (left: number): string =>
  left === 0 ? "today" : left === 1 ? "in 1 day" : `in ${left} days`;

/** The token's day, from `stored`, the secret's `updated_at`, and
 * `pasted`, the day this machine's file holds for it, whichever is
 * earlier. Null when `stored` is no date. */
export function tokenDay(o: {
  stored: string;
  pasted?: string | null;
  now: Date;
  org?: string | null;
}): TokenDay | null {
  const stored = dayOf(o.stored);
  if (stored === null) return null;
  const pasted = o.pasted ? dayOf(o.pasted) : null;
  const from = pasted !== null && pasted < stored ? "pasted" : "stored";
  const since = from === "pasted" ? pasted! : stored;
  const day = yearAfter(since);
  const today = Date.parse(`${o.now.toISOString().slice(0, 10)}T00:00:00Z`);
  const left = Math.round((Date.parse(`${day}T00:00:00Z`) - today) / DAY_MS);
  return { day, since, from, left, stage: stageOf(left), org: o.org ?? null };
}

const ending = (t: TokenDay) =>
  t.org !== null
    ? `a year after ${t.org} stored it`
    : t.from === "pasted"
      ? "a year after you pasted it"
      : "a year after it was stored";

const replace = (t: TokenDay) =>
  t.org !== null
    ? `An owner of ${t.org} runs factory init --org to replace it`
    : "Run factory init to replace it";

/** `doctor`'s line, after the one that says the token is set. */
export function doctorCheck(t: TokenDay): Check {
  switch (t.stage) {
    case "fine":
      return {
        state: "pass",
        text: `${AGENT_TOKEN} stops working by ${t.day}, ${ending(t)}`,
      };
    case "soon":
      return {
        state: "unknown",
        text: `${AGENT_TOKEN} stops working by ${t.day}, ${when(t.left)}, ${ending(t)}. ${replace(t)}`,
      };
    case "over":
      return {
        state: "fail",
        text: `${AGENT_TOKEN} stopped working by ${t.day}, ${ending(t)}`,
        fix:
          t.org !== null
            ? `an owner of ${t.org} runs factory init --org`
            : "Run factory init",
      };
  }
}

/** `status`'s last line, only from 30 days before the day. */
export function statusLine(t: TokenDay): say.Line | null {
  if (t.stage === "fine") return null;
  const fix = t.org !== null ? replace(t) : null;
  return t.stage === "soon"
    ? say.mark(
        "look",
        `${AGENT_TOKEN} stops working by ${t.day}, ${when(t.left)}. ${replace(t)}`,
      )
    : say.mark(
        "fail",
        `${AGENT_TOKEN} stopped working by ${t.day}. ${fix ?? "Run factory init"}`,
      );
}
