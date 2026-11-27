// Which of the factory's optional parts a repository has on, and what each
// needs: the rules `factory init` and `factory doctor` share.
import { describe, expect, it } from "vitest";
import { parseSettings } from "../src/config.mts";
import {
  neededSecrets,
  PARTS,
  partsOn,
  resolveParts,
  type Part,
} from "../src/parts.mts";
import { secretSteps, TOOLS } from "../src/tools.mts";
import { memoryContext } from "./memory-tools";
import { memoryTickets } from "./memory-tickets";
import { withFakeTickets } from "./fake-tools";
import { FACTORY_COLUMNS } from "./factory-columns";
import { CODE_HOST } from "./settings-fixture";

const settings = (raw: Record<string, unknown> = {}) =>
  parseSettings(
    { version: 2, repository: "acme/site", "code-host": CODE_HOST, ...raw },
    () => true,
  );
const set = (...parts: Part[]) => new Set<Part>(parts);
/** What today's tools read for cloud builds. */
const cloud = secretSteps(TOOLS, memoryContext(["cloud"])).flatMap((x) =>
  x.step.needs.filter((n) => n.part === "cloud"),
);

describe("partsOn", () => {
  it("finds none in a repository with only the basics", () => {
    expect(partsOn(settings(), [], cloud)).toEqual(set());
  });

  it("reads a board, builds from the board, and auto-merge from the settings", () => {
    const s = settings({
      tickets: { board: 3, columns: FACTORY_COLUMNS },
      builds: { trigger: "own-server" },
      "auto-merge": { allow: ["docs/**"] },
    });
    expect(partsOn(s, [], cloud)).toEqual(
      set("board", "from-board", "auto-merge"),
    );
  });

  it("reads the review from its setting, and the rest from the secrets set", () => {
    expect(
      partsOn(
        settings({ "pr-review": true }),
        [
          "CLAUDE_CODE_OAUTH_TOKEN",
          "FACTORY_BUILD_TOKEN",
          "FACTORY_SIGNING_KEY",
        ],
        cloud,
      ),
    ).toEqual(set("review", "cloud", "signing"));
  });

  it("takes cloud builds to be off with the agent's token and no access token", () => {
    expect(partsOn(settings(), ["CLAUDE_CODE_OAUTH_TOKEN"], cloud)).toEqual(
      set(),
    );
  });

  it("takes cloud builds to be on under an organization's app, and signing to be off whatever key is set", () => {
    expect(
      partsOn(
        settings(),
        [
          "CLAUDE_CODE_OAUTH_TOKEN",
          "FACTORY_APP_PRIVATE_KEY",
          "FACTORY_SIGNING_KEY",
        ],
        cloud,
      ),
    ).toEqual(set("cloud"));
  });
});

describe("resolveParts", () => {
  it("turns on a board and cloud builds with builds that start from the board", () => {
    const { parts, notes } = resolveParts(set(), set("from-board"));
    expect(parts).toEqual(set("from-board", "board", "cloud"));
    expect(notes).toEqual([
      "Builds that start from the board need a board, so that is on too.",
      "Builds that start from the board need builds in the cloud, so that is on too.",
    ]);
  });

  it("leaves off, with no note, a needed part that cannot be turned on here", () => {
    const { parts, notes } = resolveParts(
      set(),
      set("from-board"),
      (part) => part !== "cloud",
    );
    expect(parts).toEqual(set("from-board", "board"));
    expect(notes).toEqual([
      "Builds that start from the board need a board, so that is on too.",
    ]);
  });

  it("turns builds from the board off when a board was turned off", () => {
    const before = set("board", "cloud", "from-board");
    const { parts, notes } = resolveParts(before, set("cloud", "from-board"));
    expect(parts).toEqual(set("cloud"));
    expect(notes).toEqual([
      "Builds that start from the board need a board, so they are off too.",
    ]);
  });
});

describe("what the parts need", () => {
  const needed = (...parts: Part[]) =>
    neededSecrets(set(...parts), secretSteps(TOOLS, memoryContext(parts)));

  const APP_KEY = "FACTORY_APP_PRIVATE_KEY";

  it("names the secrets each part reads, any one of a pair doing", () => {
    const own = needed("review", "cloud", "auto-merge").map((n) => ({
      ...n,
      anyOf: n.anyOf.filter((name) => name !== APP_KEY),
    }));
    expect(own).toEqual([
      {
        part: "review",
        anyOf: ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY"],
        tool: "Claude Code",
      },
      {
        part: "cloud",
        anyOf: ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY"],
        tool: "Claude Code",
      },
      {
        part: "cloud",
        anyOf: ["FACTORY_BUILD_TOKEN", "FACTORY_BOARD_TOKEN"],
        tool: "GitHub",
      },
      {
        part: "auto-merge",
        anyOf: ["FACTORY_AUTOMERGE_TOKEN"],
        tool: "GitHub",
      },
    ]);
  });

  it("lets an organization's app's key meet each need for a token of the code host's, and none of the coding agent's", () => {
    const met = needed(...PARTS)
      .filter((n) => n.anyOf.includes(APP_KEY))
      .map((n) => `${n.tool}: ${n.part}`);
    expect(met).toEqual([
      "GitHub: cloud",
      "GitHub: board",
      "GitHub: from-board",
      "GitHub: auto-merge",
    ]);
  });

  it("adds the signing key, which is the factory's own", () => {
    expect(needed("signing")).toEqual([
      { part: "signing", anyOf: ["FACTORY_SIGNING_KEY"], tool: "factory" },
    ]);
  });
});

describe("GitHub's one access token", () => {
  /** Today's tools with a ticket system of another kind beside GitHub's. */
  const tools = {
    ...TOOLS,
    tickets: {
      ...TOOLS.tickets,
      elsewhere: { ...TOOLS.tickets.github!, label: "Elsewhere", setup: {} },
    },
  };
  const token = (parts: Part[], tickets?: string) => {
    const step = secretSteps(tools, memoryContext(parts, { tickets })).find(
      (x) => x.tool === "GitHub",
    )?.step;
    return step?.kind === "secret" ? step : undefined;
  };

  it("stores the token under each name the parts read", () => {
    expect(token(["board", "cloud", "auto-merge"])?.storeAs).toEqual([
      "FACTORY_BOARD_TOKEN",
      "FACTORY_AUTOMERGE_TOKEN",
    ]);
    expect(token(["cloud"])?.storeAs).toEqual(["FACTORY_BUILD_TOKEN"]);
    expect(token(["review"])).toBeUndefined();
  });

  it("asks the token to write the board only with a board on GitHub", () => {
    const page = (parts: Part[], tickets?: string) => {
      const get = token(parts, tickets)?.get;
      return get && "page" in get ? get.page : null;
    };
    expect(page(["cloud"])).toContain("scopes=push,workflows&");
    expect(page(["board"])).toContain("scopes=push,workflows,board&");
    expect(page(["board", "cloud"], "elsewhere")).toContain(
      "scopes=push,workflows&",
    );
  });
});

describe("a tool's credential", () => {
  const tools = withFakeTickets(TOOLS, memoryTickets([]).tickets, true, {
    credential: true,
  });
  const steps = secretSteps(tools, memoryContext([], { tickets: "fake" }));

  it("is one of the secret steps, after the tool's own steps", () => {
    expect(
      steps.filter((s) => s.tool === "Fake Tickets").map((s) => s.step.kind),
    ).toEqual(["credential"]);
  });

  it("is read for the parts as a secret is", () => {
    expect(neededSecrets(set(), steps)).toContainEqual({
      part: null,
      anyOf: ["FAKE_TICKETS_TOKEN"],
      tool: "Fake Tickets",
    });
  });
});
