import { describe, expect, it } from "vitest";
import type { Answer } from "../src/agent/types.mts";
import {
  ADD,
  NONE,
  check,
  chooseColumns,
  prompt,
  schema,
  suggestColumns,
  table,
  written,
  type Mapping,
} from "../src/columns-suggest.mts";
import type { Ask } from "../src/init-shared.mts";
import { scriptedAgent } from "./fake-tools";

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
  it("writes every state, a column init adds by the factory's name", () => {
    const m = check(SHOP, BOARD, false, 3) as { mapping: Mapping };
    expect(written(m.mapping)).toEqual([
      ["backlog", "Todo"],
      ["refining", "none"],
      ["ready", "none"],
      ["building", "In Progress"],
      ["review", "Code review"],
      ["done", "Done"],
    ]);
    expect(written({ ...m.mapping, refining: "add", review: "add" })).toEqual([
      ["backlog", "Todo"],
      ["refining", "In refinement"],
      ["ready", "none"],
      ["building", "In Progress"],
      ["review", "In review"],
      ["done", "Done"],
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

/** Answers each select in turn, and records what each offered. */
function asking(answers: string[]) {
  const queue = [...answers];
  const out: string[] = [];
  const selects: { message: string; names: string[]; fallback?: string }[] = [];
  const unasked = async (message: string): Promise<never> => {
    throw new Error(`not asked here: ${message}`);
  };
  const ask: Ask = {
    select: async (message, choices, fallback) => {
      selects.push({ message, names: choices.map((c) => c.name), fallback });
      const chosen = queue.shift();
      if (chosen === undefined) throw new Error(`no answer for: ${message}`);
      if (!choices.some((c) => c.value === chosen))
        throw new Error(`no choice ${chosen} for: ${message}`);
      return chosen;
    },
    checkbox: unasked,
    confirm: unasked,
    secret: unasked,
    input: unasked,
  };
  return {
    d: { ask, out: (line: string) => void out.push(line) },
    out,
    selects,
  };
}

describe("choosing each state's column by hand", () => {
  /** The Shop board, answered as its suggestion would have been, with a
   * Ready column added since builds start from the board. */
  const BY_HAND = [
    "column:Todo",
    NONE,
    ADD,
    "column:In Progress",
    "column:Code review",
    "column:Done",
  ];

  it("asks one question for each state, in order, then shows the table and writes what Yes accepts", async () => {
    const a = asking([...BY_HAND, "yes"]);
    const lines = await chooseColumns(a.d, { columns: BOARD, fromBoard: true });
    expect(a.selects.map((x) => x.message)).toEqual([
      "Which column shows backlog?",
      "Which column shows refining?",
      "Which column shows ready?",
      "Which column shows building?",
      "Which column shows review?",
      "Which column shows done?",
      "Use these columns?",
    ]);
    expect(a.out).toEqual([
      "",
      "  State      Column",
      "  backlog    Todo",
      "  refining   none, shows in Todo",
      "  ready      Ready, which init adds",
      "  building   In Progress",
      "  review     Code review",
      "  done       Done",
      "",
    ]);
    expect(lines).toEqual([
      ["backlog", "Todo"],
      ["refining", "none"],
      ["ready", "Ready"],
      ["building", "In Progress"],
      ["review", "Code review"],
      ["done", "Done"],
    ]);
  });

  it("offers the board's columns, the factory's own column where the board lacks it, and no column where a state may have none", async () => {
    const a = asking([...BY_HAND, "yes"]);
    await chooseColumns(a.d, { columns: BOARD, fromBoard: true });
    const [backlog, refining, ready, building, , done] = a.selects;
    expect(backlog).toEqual({
      message: "Which column shows backlog?",
      names: [...BOARD, 'Add a column called "Backlog"'],
      fallback: ADD,
    });
    expect(refining!.names).toEqual([
      ...BOARD,
      "No column: a ticket being refined shows in Todo",
      'Add a column called "In refinement"',
    ]);
    // Builds start from the board, so ready has to have a column.
    expect(ready!.names).toEqual([...BOARD, 'Add a column called "Ready"']);
    // In progress is on the board in other capitals, and is offered first.
    // A ticket being built never shows in the ready column, which starts
    // builds.
    expect(building!.names).toEqual([
      ...BOARD,
      "No column: a ticket being built shows in Todo",
    ]);
    expect(building!.fallback).toBe("column:In Progress");
    expect(done!.names).toEqual([
      ...BOARD,
      "No column: a ticket that is done shows in Code review",
    ]);
    expect(done!.fallback).toBe("column:Done");
  });

  it("lets ready have no column when builds do not start from the board", async () => {
    const a = asking([...BY_HAND, "yes"]);
    await chooseColumns(a.d, { columns: BOARD, fromBoard: false });
    expect(a.selects[2]!.names).toEqual([
      ...BOARD,
      "No column: builds start only when you ask",
      'Add a column called "Ready"',
    ]);
  });

  it("asks again for a state given a column that already shows another", async () => {
    const a = asking([
      "column:Todo",
      "column:Todo",
      NONE,
      ...BY_HAND.slice(2),
      "yes",
    ]);
    const lines = await chooseColumns(a.d, { columns: BOARD, fromBoard: true });
    expect(a.out[0]).toBe(
      "Todo already shows backlog. Pick another column for refining.",
    );
    expect(a.selects.map((x) => x.message).slice(0, 3)).toEqual([
      "Which column shows backlog?",
      "Which column shows refining?",
      "Which column shows refining?",
    ]);
    expect(lines[1]).toEqual(["refining", "none"]);
  });
});

describe("a suggestion that cannot be used", () => {
  const BOARD_3 = { board: 3, columns: BOARD, fromBoard: true };
  const FAILURES: [string, Answer, string][] = [
    [
      "a failed command",
      { failed: { code: 1, error: "Invalid API key · Please run /login" } },
      "it failed: Invalid API key · Please run /login",
    ],
    [
      "a run past its time",
      { timedOut: true },
      "it took longer than 60 seconds",
    ],
    [
      "an answer that leaves a state out",
      { answer: { backlog: "Todo" } },
      "it left out refining",
    ],
  ];

  it.each(FAILURES)(
    "stops the command after %s, unless asked to go on by hand",
    async (_name, answer, reason) => {
      const a = asking([]);
      const got = await suggestColumns(
        { ...a.d, agent: scriptedAgent([answer]), label: "Claude Code" },
        BOARD_3,
      );
      expect(got).toBe(1);
      expect(a.out.slice(-3)).toEqual([
        `Claude Code's answer could not be used: ${reason}.`,
        "Run factory init again, or write tickets.columns in .claude/factory.yaml yourself.",
        "Nothing changed.",
      ]);
    },
  );

  it.each(FAILURES)(
    "goes on to ask by hand after %s, when told to, and names no command or file as the fix",
    async (_name, answer, reason) => {
      const a = asking([
        "column:Todo",
        NONE,
        ADD,
        "column:In Progress",
        "column:Code review",
        "column:Done",
        "yes",
      ]);
      const got = await suggestColumns(
        { ...a.d, agent: scriptedAgent([answer]), label: "Claude Code" },
        { ...BOARD_3, byHand: true },
      );
      expect(a.out.slice(0, 4)).toEqual([
        "",
        "Board 3 has the columns Todo, In Progress, Code review, and Done.",
        "Asking Claude Code which of them shows each of the factory's six states...",
        `Claude Code's answer could not be used: ${reason}.`,
      ]);
      expect(a.out[4]).toBe("Choose the column for each state yourself.");
      expect(a.out.join("\n")).not.toMatch(
        /factory init|factory\.yaml|Nothing changed/,
      );
      expect(got).toEqual([
        ["backlog", "Todo"],
        ["refining", "none"],
        ["ready", "Ready"],
        ["building", "In Progress"],
        ["review", "Code review"],
        ["done", "Done"],
      ]);
    },
  );
});
