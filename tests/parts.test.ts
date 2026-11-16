// Which of the factory's optional parts a repository has on, and what each
// needs: the rules `factory init` and `factory doctor` share.
import { describe, expect, it } from "vitest";
import { parseSettings } from "../src/config.mts";
import {
  neededSecrets,
  partsOn,
  resolveParts,
  tokenNames,
  tokenNeeds,
  type Part,
} from "../src/parts.mts";

const settings = (raw: Record<string, unknown> = {}) =>
  parseSettings({ version: 1, repository: "acme/site", ...raw }, () => true);
const set = (...parts: Part[]) => new Set<Part>(parts);

describe("partsOn", () => {
  it("finds none in a repository with only the basics", () => {
    expect(partsOn(settings(), [])).toEqual(set());
  });

  it("reads a board, builds from the board, and auto-merge from the settings", () => {
    const s = settings({
      tickets: { board: 3 },
      builds: { trigger: "own-server" },
      "auto-merge": { allow: ["docs/**"] },
    });
    expect(partsOn(s, [])).toEqual(set("board", "from-board", "auto-merge"));
  });

  it("reads the review from its setting, and the rest from the secrets set", () => {
    expect(
      partsOn(settings({ "ci-review": null }), [
        "CLAUDE_CODE_OAUTH_TOKEN",
        "FACTORY_BUILD_TOKEN",
        "FACTORY_SIGNING_KEY",
      ]),
    ).toEqual(set("review", "cloud", "signing"));
  });

  it("takes cloud builds to be off with the agent's token and no access token", () => {
    expect(partsOn(settings(), ["CLAUDE_CODE_OAUTH_TOKEN"])).toEqual(set());
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
  it("names the secrets each part reads, any one of a pair doing", () => {
    expect(neededSecrets(set("review", "cloud", "auto-merge"))).toEqual([
      {
        part: "review",
        anyOf: ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY"],
      },
      {
        part: "cloud",
        anyOf: ["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY"],
      },
      { part: "cloud", anyOf: ["FACTORY_BUILD_TOKEN", "FACTORY_BOARD_TOKEN"] },
      { part: "auto-merge", anyOf: ["FACTORY_AUTOMERGE_TOKEN"] },
    ]);
  });

  it("stores the one access token under each name the parts read", () => {
    expect(tokenNames(set("board", "cloud", "auto-merge"))).toEqual([
      "FACTORY_BOARD_TOKEN",
      "FACTORY_AUTOMERGE_TOKEN",
    ]);
    expect(tokenNames(set("cloud"))).toEqual(["FACTORY_BUILD_TOKEN"]);
    expect(tokenNames(set("review"))).toEqual([]);
  });

  it("asks the token to write the board only with a board", () => {
    expect(tokenNeeds(set("cloud"))).toEqual(["push", "workflows"]);
    expect(tokenNeeds(set("board"))).toEqual(["push", "workflows", "board"]);
  });
});
