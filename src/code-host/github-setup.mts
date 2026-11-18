// GitHub as the code host: the remotes it recognizes, the one access token
// the factory's jobs use, the signed-in check, and what removing the
// factory leaves on it.
import { listed } from "../lib/listed.mts";
import {
  AUTOMERGE_TOKEN,
  BOARD_TOKEN,
  BUILD_TOKEN,
  type Part,
} from "../parts.mts";
import {
  RULE,
  type Need,
  type SetupContext,
  type ToolSetup,
} from "../setup.mts";
import type { TokenNeed } from "./types.mts";

/** The repository a remote's address names, or null for one not on
 * GitHub. */
export function githubRepository(url: string): string | null {
  const match =
    /^(?:git@github\.com:|(?:https|ssh):\/\/(?:git@)?github\.com\/)([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(
      url.trim(),
    );
  return match ? `${match[1]}/${match[2]}` : null;
}

/** What a token must be able to do, in words. */
const NEED_TEXT: Record<TokenNeed, string> = {
  push: "push a branch",
  workflows: "change a workflow's file",
  board: "write the board",
};

/** The board is GitHub's to write only when the tickets are GitHub's. */
const githubBoard = (c: SetupContext) =>
  c.parts.has("board") && c.chosen.tickets === "github";

/** What the one token must be able to do for the parts on. */
function tokenNeeds(c: SetupContext): TokenNeed[] {
  return githubBoard(c)
    ? ["push", "workflows", "board"]
    : ["push", "workflows"];
}

/** The names the token is stored under: the board's with a board, which
 * builds also read, the build token's without one, and the auto-merge
 * token's. */
function tokenNames(c: SetupContext): string[] {
  const names: string[] = [];
  if (githubBoard(c)) names.push(BOARD_TOKEN);
  else if (c.parts.has("cloud")) names.push(BUILD_TOKEN);
  if (c.parts.has("auto-merge")) names.push(AUTOMERGE_TOKEN);
  return names;
}

/** The secrets each part on reads from the token. */
function tokenReads(c: SetupContext): Need[] {
  const needs: Need[] = [];
  const add = (part: Part, anyOf: string[]) => {
    if (c.parts.has(part)) needs.push({ part, anyOf });
  };
  add("cloud", [BUILD_TOKEN, BOARD_TOKEN]);
  if (c.chosen.tickets === "github") {
    add("board", [BOARD_TOKEN]);
    add("from-board", [BOARD_TOKEN]);
  }
  add("auto-merge", [AUTOMERGE_TOKEN]);
  return needs;
}

const ALL_TOKENS = [BOARD_TOKEN, BUILD_TOKEN, AUTOMERGE_TOKEN];

export const githubCodeHostSetup: ToolSetup = {
  steps: (c) => {
    const needs = tokenReads(c);
    if (!needs.length) return [];
    const codeHost = c.opened.codeHost;
    const wants = tokenNeeds(c);
    const scopes = codeHost.scopesFor(wants);
    const page = codeHost.newTokenPage(
      scopes,
      `software factory: ${c.repository}`,
    );
    return [
      {
        kind: "secret",
        needs,
        storeAs: tokenNames(c),
        intro: [
          "",
          `An access token: opening ${page}`,
          `Check that ${listed(scopes)} ${scopes.length === 1 ? "is" : "are"} ticked, choose an expiry, and generate it.`,
        ],
        get: { page },
        prompt: "Paste it (leave empty to do this later):",
        skipped: "No token stored.",
        verify: async (value) => {
          let owned: { account: string; scopes: string[] | null };
          try {
            owned = await codeHost.tokenOwner(value);
          } catch (e) {
            throw new Error(
              `${e instanceof Error ? e.message : String(e)}. Paste another.`,
            );
          }
          const lacking = owned.scopes
            ? scopes.filter((x) => !owned.scopes!.includes(x))
            : [];
          if (lacking.length)
            throw new Error(
              `That token lacks ${listed(lacking)}. Make one with every scope checked, and paste it.`,
            );
          return {
            account: owned.account,
            lines:
              owned.scopes === null
                ? [
                    `The code host does not say what this token may do: make sure it can ${listed(wants.map((n) => NEED_TEXT[n]))}.`,
                  ]
                : [],
          };
        },
        stored: (names, account) =>
          `It belongs to ${account}. Stored as ${names.join(", ")}.`,
      },
    ];
  },

  checks: async (c) => {
    try {
      return [
        {
          state: "pass",
          text: `Signed in to the code host as ${await c.opened.codeHost.signedInAs()}`,
        },
      ];
    } catch (e) {
      return [
        {
          state: "fail",
          text: "Signed in to the code host",
          fix: e instanceof Error ? e.message : String(e),
        },
      ];
    }
  },

  leftovers: (c) => {
    const lines: string[] = [];
    // init only ever adds the rule, so it can outlast the review.
    const sure = c.settings?.prReview != null;
    lines.push(
      `Delete the "${RULE}" ruleset first${sure ? "" : ", if there is one"}, under Settings, Rules: until then every pull request waits on its "Review verdict" check`,
    );
    const names = ALL_TOKENS.filter(
      (n) => c.secrets === null || c.secrets.includes(n),
    );
    if (names.length)
      lines.push(
        `Delete the secret${names.length === 1 ? "" : "s"} ${listed(names)}${c.secrets === null ? " if set" : ""}`,
      );
    return lines;
  },
};
