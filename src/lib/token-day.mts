// The day each token a person keeps on their machine stops working, and
// the lines `doctor`, `status`, and `init` say it in. The token `claude
// setup-token` makes stops a year after it was made.
// GitHub never shows a secret, only the day it was last stored, so the day
// is counted from that, or from the day `init` wrote beside the token on
// this machine when that is earlier. A token is made before it is stored,
// so the day can be early, never late.
import { AGENT_TOKEN } from "../parts.mts";
import type { Check } from "../setup.mts";
import { listed } from "./listed.mts";
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
    ? `An owner of ${t.org} runs lunamill init --org to replace it`
    : "Run lunamill init to replace it";

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
            ? `an owner of ${t.org} runs lunamill init --org`
            : "Run lunamill init",
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
        `${AGENT_TOKEN} stopped working by ${t.day}. ${fix ?? "Run lunamill init"}`,
      );
}

/** The coding agent's token's day, from the repository's own secrets,
 * then the organization's that reach it. `org` names the organization
 * that owns the repository, and `pasted` is read only for a person's. */
export function agentTokenDay(o: {
  own: { name: string; stored: string }[];
  shared: { name: string; stored: string }[];
  org: string | null;
  pasted: string | null;
  now: Date;
}): TokenDay | null {
  const own = o.own.find((x) => x.name === AGENT_TOKEN);
  if (own)
    return tokenDay({
      stored: own.stored,
      pasted: o.org === null ? o.pasted : null,
      now: o.now,
    });
  const shared = o.shared.find((x) => x.name === AGENT_TOKEN);
  return shared && o.org !== null
    ? tokenDay({ stored: shared.stored, now: o.now, org: o.org })
    : null;
}

/** `init`'s line before it asks about a token from 30 days before its
 * day. */
export const nearLine = (t: TokenDay): string =>
  t.stage === "over"
    ? `${AGENT_TOKEN} stopped working by ${t.day}: a Claude token lasts a year.`
    : `${AGENT_TOKEN} stops working by ${t.day}, ${when(t.left)}: a Claude token lasts a year.`;

/** `init`'s line for the token on this machine that it does not store. */
export const notStoredLine = (t: TokenDay): string =>
  t.stage === "over"
    ? `The Claude token on this machine stopped working by ${t.day}, so it is not stored here.`
    : `The Claude token on this machine stops working by ${t.day}, ${when(t.left)}, so it is not stored here.`;

/** The day a GitHub access token expires, from the `expires` `init` wrote
 * beside it: a day, or `never`. Null for anything else. */
export type AccessDay =
  | { day: "never"; left: null; stage: "never" }
  | { day: string; left: number; stage: Stage };

export function accessDay(expires: string, now: Date): AccessDay | null {
  if (expires === "never") return { day: "never", left: null, stage: "never" };
  const day = /^\d{4}-\d{2}-\d{2}$/.test(expires) ? dayOf(expires) : null;
  if (day === null) return null;
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  const left = Math.round((Date.parse(`${day}T00:00:00Z`) - today) / DAY_MS);
  return { day, left, stage: stageOf(left) };
}

/** Which of the token's secrets set on the repository hold the machine's
 * token, and which hold an older one, with the earliest day one of those
 * was stored. One stored on or after the day the token was pasted holds
 * it, since `init` stores it from the machine; with no such day, each
 * does. */
export type Holders = {
  names: string[];
  older: string[];
  oldest: string | null;
};

export function holders(o: {
  secrets: { name: string; stored: string }[];
  names: string[];
  pasted: string | null;
}): Holders {
  const out: Holders = { names: [], older: [], oldest: null };
  for (const name of o.names) {
    const set = o.secrets.find((x) => x.name === name);
    if (!set) continue;
    const day = dayOf(set.stored);
    if (o.pasted === null || day === null || day >= o.pasted)
      out.names.push(name);
    else {
      out.older.push(name);
      if (out.oldest === null || day < out.oldest) out.oldest = day;
    }
  }
  return out;
}

const ACCESS = "The GitHub access token";

/** The line on secrets that hold an older token than the machine's. */
const olderText = (t: AccessDay | null, older: string[]) =>
  `${listed(older)} here ${older.length === 1 ? "is" : "are"} older than the GitHub access token on this machine. ${
    t !== null && (t.stage === "soon" || t.stage === "over")
      ? "Run lunamill init to replace it"
      : "Run lunamill init to store that one in its place"
  }`;

/** `doctor`'s lines on the access token: its day, for the secrets that
 * hold it, then the secrets that hold an older one. */
export function accessChecks(t: AccessDay | null, h: Holders): Check[] {
  const out: Check[] = [];
  const names = listed(h.names);
  if (t !== null && h.names.length)
    out.push(
      t.stage === "never"
        ? { state: "pass", text: `${ACCESS} in ${names} has no expiry date` }
        : t.stage === "fine"
          ? { state: "pass", text: `${ACCESS} in ${names} expires on ${t.day}` }
          : t.stage === "soon"
            ? {
                state: "unknown",
                text: `${ACCESS} in ${names} expires on ${t.day}, ${when(t.left)}. Run lunamill init to replace it`,
              }
            : {
                state: "fail",
                text: `${ACCESS} in ${names} expired on ${t.day}`,
                fix: "Run lunamill init",
              },
    );
  if (h.older.length)
    out.push({ state: "unknown", text: olderText(t, h.older) });
  return out;
}

/** `status`'s lines on the access token: from 30 days before its day, and
 * for secrets that hold an older one. */
export function accessStatusLines(t: AccessDay | null, h: Holders): say.Line[] {
  const out: say.Line[] = [];
  if (t !== null && h.names.length && t.stage === "soon")
    out.push(
      say.mark(
        "look",
        `${ACCESS} expires on ${t.day}, ${when(t.left)}. Run lunamill init to replace it`,
      ),
    );
  if (t !== null && h.names.length && t.stage === "over")
    out.push(
      say.mark("fail", `${ACCESS} expired on ${t.day}. Run lunamill init`),
    );
  if (h.older.length) out.push(say.mark("look", olderText(t, h.older)));
  return out;
}

/** `init`'s line before it asks for a new access token. */
export const accessNearLine = (t: AccessDay & { left: number }): string =>
  t.stage === "over"
    ? `${ACCESS} expired on ${t.day}.`
    : `${ACCESS} expires on ${t.day}, ${when(t.left)}.`;

/** `init`'s line before it offers the machine's newer token. */
export const olderStoredLine = (h: Holders, pasted: string): string =>
  `${listed(h.older)} here ${h.older.length === 1 ? "was" : "were"} stored on ${h.oldest}, before the GitHub access token on this machine, pasted on ${pasted}.`;

/** `init`'s line for the access token on this machine that it does not
 * store. */
export const accessNotStoredLine = (t: AccessDay & { left: number }): string =>
  `${ACCESS} on this machine expires on ${t.day}, ${when(t.left)}, so it is not stored here.`;
