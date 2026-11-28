// Lunamill's optional parts: which a repository has on, which secrets
// they read, and which turn another on. `lunamill init` and
// `lunamill doctor` share these rules; the secrets each tool reads come from
// its steps (`setup.mts`).
import type { Settings } from "./config.mts";
import type { Need } from "./setup.mts";

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
    gives: "a schedule on GitHub Actions, or a small server you host",
  },
  "auto-merge": {
    name: "Pull requests that merge themselves",
    gives: "changes to files you list as safe do not wait for you",
  },
  signing: {
    name: "Signed commits on Lunamill's updates",
    gives: "the pull requests that update Lunamill show as verified",
  },
};

export const AGENT_TOKEN = "CLAUDE_CODE_OAUTH_TOKEN";
export const AGENT_KEY = "ANTHROPIC_API_KEY";
export const BOARD_TOKEN = "LUNAMILL_BOARD_TOKEN";
export const BUILD_TOKEN = "LUNAMILL_BUILD_TOKEN";
export const AUTOMERGE_TOKEN = "LUNAMILL_AUTOMERGE_TOKEN";
export const SIGNING_KEY = "LUNAMILL_SIGNING_KEY";
/** The key of an organization's app, which stands in for each token above
 * wherever the organization shares it. */
export const APP_KEY = "LUNAMILL_APP_PRIVATE_KEY";

/** The parts on: those with a setting, from the settings; cloud builds,
 * when every secret the tools read for them is set; and signing, from its
 * key, which an organization's app never signs with. */
export function partsOn(
  s: Settings | null,
  secrets: string[],
  cloudNeeds: Need[],
): Set<Part> {
  const has = (names: string[]) => names.some((n) => secrets.includes(n));
  const on = new Set<Part>();
  if (s?.prReview) on.add("review");
  if (s?.tickets.board != null) on.add("board");
  if (cloudNeeds.length && cloudNeeds.every((n) => has(n.anyOf)))
    on.add("cloud");
  if (s && s.builds.trigger !== "manual") on.add("from-board");
  if (s && s.autoMerge.allow.length > 0) on.add("auto-merge");
  if (has([SIGNING_KEY]) && !has([APP_KEY])) on.add("signing");
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
 * so turning a needed part off wins over keeping the part that needs it. A
 * needed part that cannot be turned on here is left off, with no note. */
export function resolveParts(
  before: Set<Part>,
  chosen: Set<Part>,
  available: (part: Part) => boolean = () => true,
): { parts: Set<Part>; notes: string[] } {
  const parts = new Set(chosen);
  const notes: string[] = [];
  for (const n of NEEDS) {
    if (!parts.has(n.part) || parts.has(n.needs)) continue;
    if (before.has(n.needs)) {
      parts.delete(n.part);
      notes.push(`${n.parts} need ${n.need}, so they are off too.`);
    } else if (available(n.needs)) {
      parts.add(n.needs);
      notes.push(`${n.parts} need ${n.need}, so that is on too.`);
    }
  }
  return { parts, notes };
}

/** A secret read, by the tool whose step reads it, or Lunamill's own. */
export type Needed = Need & { tool: string };

/** The secrets read for the parts on, from the tools' secret steps, with
 * the signing key, which is Lunamill's own. Each is met by any one of
 * its names. */
export function neededSecrets(
  parts: ReadonlySet<Part>,
  steps: { tool: string; step: { needs: Need[] } }[],
): Needed[] {
  const out: Needed[] = steps.flatMap(({ tool, step }) =>
    step.needs
      .filter((n) => n.part === null || parts.has(n.part))
      .map((n) => ({ ...n, tool })),
  );
  if (parts.has("signing"))
    out.push({ part: "signing", anyOf: [SIGNING_KEY], tool: "lunamill" });
  return out;
}
