import { describe, expect, it } from "vitest";
import {
  ADD,
  NONE,
  check,
  prompt,
  schema,
  table,
  written,
  type Mapping,
} from "../src/columns-suggest.mts";

const BOARD = ["Todo", "In Progress", "Code review", "Done"];

/** The Proposed docs' suggestion for the Shop board. */
const SHOP = {
  backlog: "Todo",
  refining: NONE,
  ready: NONE,
  building: "In Progress",
  review: "Code review",
  done: "Done",
};

const reason = (answer: unknown, fromBoard = false) => {
  const r = check(answer, BOARD, fromBoard, 3);
  return "reason" in r ? r.reason : null;
};

describe("checking the agent's answer", () => {
  it("reads the Shop board's suggestion as a mapping", () => {
    expect(check(SHOP, BOARD, false, 3)).toEqual({
      mapping: {
        backlog: { column: "Todo" },
        refining: "none",
        ready: "none",
        building: { column: "In Progress" },
        review: { column: "Code review" },
        done: { column: "Done" },
      },
    });
  });

  it.each([
    [
      "a column the board lacks",
      { ...SHOP, review: "QA" },
      "it named QA, which board 3 doesn't have",
    ],
    [
      "one column in two states",
      { ...SHOP, refining: "Todo" },
      "it put Todo in both backlog and refining",
    ],
    ["a state left out", { ...SHOP, review: undefined }, "it left out review"],
    [
      "a value that isn't a string",
      { ...SHOP, done: 4 },
      "it did not answer in the form asked for",
    ],
    ["no answer at all", undefined, "it did not answer in the form asked for"],
    [
      "no column for backlog",
      { ...SHOP, backlog: NONE },
      "it gave backlog no column, and every ticket starts there",
    ],
  ])("refuses %s, in the issue's words", (_name, answer, words) => {
    expect(reason(answer)).toBe(words);
  });

  it("refuses no column for ready only when builds start from the board", () => {
    expect(reason(SHOP, true)).toBe(
      "it gave ready no column, and builds start from the board",
    );
    expect(reason(SHOP, false)).toBeNull();
  });

  it("gives the first reason in the issue's order when several apply", () => {
    const all = {
      backlog: NONE,
      refining: "Todo",
      ready: "Todo",
      building: "QA",
      done: 4,
    };
    expect(reason(all, true)).toBe("it named QA, which board 3 doesn't have");
    expect(reason({ ...all, building: NONE }, true)).toBe(
      "it put Todo in both refining and ready",
    );
    expect(reason({ ...all, building: NONE, ready: NONE }, true)).toBe(
      "it left out review",
    );
    expect(
      reason(
        { ...all, building: NONE, ready: NONE, review: "Code review" },
        true,
      ),
    ).toBe("it did not answer in the form asked for");
    expect(
      reason(
        {
          ...all,
          building: NONE,
          ready: NONE,
          review: "Code review",
          done: "Done",
        },
        true,
      ),
    ).toBe("it gave backlog no column, and every ticket starts there");
  });

  it("reads adding a column the board has, in other capitals, as that column", () => {
    const r = check(
      { ...SHOP, building: ADD },
      ["Todo", "in progress", "Code review", "Done"],
      false,
      3,
    );
    expect(r).toMatchObject({
      mapping: { building: { column: "in progress" } },
    });
  });

  it("reads adding a column the board lacks as a column init adds", () => {
    expect(check({ ...SHOP, refining: ADD }, BOARD, false, 3)).toMatchObject({
      mapping: { refining: "add" },
    });
  });
});

describe("the table", () => {
  const mapping = (over: Partial<Mapping>): Mapping => ({
    backlog: { column: "Todo" },
    refining: "none",
    ready: "none",
    building: { column: "In Progress" },
    review: { column: "Code review" },
    done: { column: "Done" },
    ...over,
  });

  it("prints the Proposed docs' table for the Shop board", () => {
    expect(table(mapping({}))).toEqual([
      "  State      Column",
      "  backlog    Todo",
      "  refining   none, shows in Todo",
      "  ready      none",
      "  building   In Progress",
      "  review     Code review",
      "  done       Done",
    ]);
  });

  it("names a column init adds, and a state shown in it by its name alone", () => {
    const lines = table(
      mapping({ refining: "add", building: "none", ready: "add" }),
    );
    expect(lines[2]).toBe("  refining   In refinement, which init adds");
    expect(lines[3]).toBe("  ready      Ready, which init adds");
    expect(lines[4]).toBe("  building   none, shows in In refinement");
  });
});

describe("what Yes writes", () => {
  it("writes only the states whose column isn't the factory's name", () => {
    const m = check(SHOP, BOARD, false, 3) as { mapping: Mapping };
    expect(written(m.mapping)).toEqual([
      ["backlog", "Todo"],
      ["refining", "none"],
      ["ready", "none"],
      ["review", "Code review"],
    ]);
    expect(written({ ...m.mapping, refining: "add", review: "add" })).toEqual([
      ["backlog", "Todo"],
      ["ready", "none"],
    ]);
  });
});

describe("what is sent to the agent", () => {
  it("sends the column names, each state's key and meaning, and whether ready may be none", () => {
    const manual = prompt(BOARD, false);
    for (const c of BOARD) expect(manual).toContain(`- ${c}`);
    expect(manual).toContain("- refining: a session is turning it into a spec");
    expect(manual).toContain(`ready may be ${NONE}`);
    expect(prompt(BOARD, true)).toContain("ready needs a column");
  });

  it("asks for each state as one of the board's columns or a token", () => {
    const s = schema(BOARD) as {
      required: string[];
      properties: Record<string, { enum: string[] }>;
    };
    expect(s.required).toEqual([
      "backlog",
      "refining",
      "ready",
      "building",
      "review",
      "done",
    ]);
    expect(s.properties.review!.enum).toEqual([...BOARD, NONE, ADD]);
  });
});
