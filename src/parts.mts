// The factory's optional parts: which a repository has on, which secrets
// each reads, and which turn another on. `factory init` and
// `factory doctor` share these rules.
import type { Settings } from "./config.mts";
import type { TokenNeed } from "./code-host/types.mts";

export const PARTS = [
  "review",
  "board",
  "cloud",
  "from-board",
  "auto-merge",
  "signing",
] as const;
export type Part = (typeof PARTS)[number];

/** Each part's name, and what it gives you, in plain words. */
export const PART_TEXT: Record<Part, { name: string; gives: string }> = {
  review: {
    name: "An automated review of every pull request",
    gives: "your coding agent reads each pull request before you do",
  },
  board: {
    name: "A board",
    gives: "every ticket's state, which session has it, and what it cost",
  },
  cloud: {
    name: "Builds in the cloud",
    gives: "a ticket builds with no session open on your machine",
  },
  "from-board": {
    name: "Builds that start when you move a card to Ready",
    gives: "needs a small server you host",
  },
  "auto-merge": {
    name: "Pull requests that merge themselves",
    gives: "changes to files you list as safe do not wait for you",
  },
  signing: {
    name: "Signed commits from cloud builds",
    gives: "a cloud build's commits show as verified",
  },
};

/** The workflow that runs the automated review, which `factory sync`
 * writes while the settings have `ci-review`. */
export const REVIEW_WORKFLOW = ".github/workflows/factory-claude-review.yml";

export const AGENT_TOKEN = "CLAUDE_CODE_OAUTH_TOKEN";
export const AGENT_KEY = "ANTHROPIC_API_KEY";
export const BOARD_TOKEN = "FACTORY_BOARD_TOKEN";
export const BUILD_TOKEN = "FACTORY_BUILD_TOKEN";
export const AUTOMERGE_TOKEN = "FACTORY_AUTOMERGE_TOKEN";
export const SIGNING_KEY = "FACTORY_SIGNING_KEY";

const AGENT = [AGENT_TOKEN, AGENT_KEY];
const ACCESS = [BUILD_TOKEN, BOARD_TOKEN];

/** The parts on: those with a setting, from the settings; and cloud
 * builds and signing, from the secrets set. */
export function partsOn(s: Settings | null, secrets: string[]): Set<Part> {
  const has = (names: string[]) => names.some((n) => secrets.includes(n));
  const on = new Set<Part>();
  if (s?.ciReview) on.add("review");
  if (s?.tickets.board != null) on.add("board");
  if (has(AGENT) && has(ACCESS)) on.add("cloud");
  if (s && s.builds.trigger !== "manual") on.add("from-board");
  if (s && s.autoMerge.allow.length > 0) on.add("auto-merge");
  if (has([SIGNING_KEY])) on.add("signing");
  return on;
}

/** A part that needs another, each named as a note about it reads. */
const NEEDS: { part: Part; needs: Part; parts: string; need: string }[] = [
  {
    part: "from-board",
    needs: "board",
    parts: "Builds that start from the board",
    need: "a board",
  },
  {
    part: "from-board",
    needs: "cloud",
    parts: "Builds that start from the board",
    need: "builds in the cloud",
  },
];

/** The parts chosen, with what one needs turned on alongside it, and a part
 * turned off when one it needs was just turned off. `before` is what was on,
 * so turning a needed part off wins over keeping the part that needs it. */
export function resolveParts(
  before: Set<Part>,
  chosen: Set<Part>,
): { parts: Set<Part>; notes: string[] } {
  const parts = new Set(chosen);
  const notes: string[] = [];
  for (const n of NEEDS) {
    if (!parts.has(n.part) || parts.has(n.needs)) continue;
    if (before.has(n.needs)) {
      parts.delete(n.part);
      notes.push(`${n.parts} need ${n.need}, so they are off too.`);
    } else {
      parts.add(n.needs);
      notes.push(`${n.parts} need ${n.need}, so that is on too.`);
    }
  }
  return { parts, notes };
}

/** The secrets the parts read: each entry is met by any one of its names. */
export function neededSecrets(
  parts: Set<Part>,
): { part: Part; anyOf: string[] }[] {
  const out: { part: Part; anyOf: string[] }[] = [];
  for (const part of PARTS) {
    if (!parts.has(part)) continue;
    if (part === "review") out.push({ part, anyOf: AGENT });
    if (part === "cloud")
      out.push({ part, anyOf: AGENT }, { part, anyOf: ACCESS });
    if (part === "board" || part === "from-board")
      out.push({ part, anyOf: [BOARD_TOKEN] });
    if (part === "auto-merge") out.push({ part, anyOf: [AUTOMERGE_TOKEN] });
    if (part === "signing") out.push({ part, anyOf: [SIGNING_KEY] });
  }
  return out;
}

/** The names the one access token is stored under: the board's with a
 * board, which builds also read, the build token's without one, and the
 * auto-merge token's. */
export function tokenNames(parts: Set<Part>): string[] {
  const names: string[] = [];
  if (parts.has("board")) names.push(BOARD_TOKEN);
  else if (parts.has("cloud")) names.push(BUILD_TOKEN);
  if (parts.has("auto-merge")) names.push(AUTOMERGE_TOKEN);
  return names;
}

/** What the access token must be able to do for the parts. */
export function tokenNeeds(parts: Set<Part>): TokenNeed[] {
  return parts.has("board")
    ? ["push", "workflows", "board"]
    : ["push", "workflows"];
}
