import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.restoreAllMocks());
import {
  boardReport,
  checkFields,
  closedPullComments,
  inspectBoard,
  main as boardMain,
  nightlyComments,
  planSync,
  type BoardConfig,
  type Deps as BoardDeps,
} from "../src/board.mts";
import {
  main as configMain,
  parseSettings,
  settingsPath,
  columnsOf,
  fieldNamesOf,
  type Deps as ConfigDeps,
} from "../src/config.mts";
import { columnsFrom, selectToStart } from "../src/poller.mts";
import { formatRows, toRows } from "../src/status.mts";
import { main as ticketMain } from "../src/ticket.mts";
import {
  DEFAULT_COLUMNS,
  cardOf,
  columnFor,
  commentBody,
  derive,
  statusOfColumn,
  toSnapshot,
  type Board,
  type BoardField,
  type Columns,
  type CommentKind,
  type Issue,
  watchOf,
} from "../src/lib/work-status.mts";
import { toBoard, type BoardPage } from "../src/tickets/github.mts";
import stockPages from "./fixtures/stock-board.json";
import { painter } from "../src/lib/color.mts";
import { BOARD_FIELDS, memoryTickets } from "./memory-tickets";

const AGENT = "<!-- agent -->";
const RUN_PAGE = (id: string) => `https://runs.example/${id}`;
const at = (m: number) =>
  `2026-11-09T${String(10 + Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00Z`;
const marked = (id: number, minute: number, marker: string) => ({
  id,
  author: "acme",
  createdAt: at(minute),
  body: `text\n\n<!-- work-status: ${marker} -->\n${AGENT}`,
});
const issue = (
  number: number,
  comments: Issue["comments"] = [],
  over: Partial<Issue> = {},
): Issue => ({
  number,
  title: `Issue ${number}`,
  state: "open",
  closedAt: null,
  labels: [],
  comments,
  ...over,
});

/** GitHub's stock board, and the mapping a repository writes for it. */
const STOCK_YAML = {
  version: 2,
  repository: "acme/widgets",
  tickets: {
    board: 7,
    columns: {
      backlog: "Todo",
      refining: "none",
      ready: "none",
      building: "In Progress",
      review: "none",
      done: "Done",
    },
  },
};
const parse = (raw: unknown) => parseSettings(raw, () => true);
const STOCK = parse(STOCK_YAML);
const STOCK_COLUMNS = columnsOf(STOCK);
const STOCK_CONFIG: BoardConfig = {
  columns: STOCK_COLUMNS,
  fields: fieldNamesOf(STOCK),
};
const stockBoard = (): Board =>
  toBoard(stockPages as BoardPage[], "acme/widgets");
const withCards = (
  board: Board,
  cards: [number, string | null, string][],
): Board => ({
  ...board,
  items: new Map(
    cards.map(([number, status, updatedAt]) => [
      number,
      {
        itemId: `I${number}`,
        number,
        status,
        updatedAt,
        session: "",
        runsIn: "",
      },
    ]),
  ),
});

describe("tickets.columns and tickets.fields in the settings", () => {
  const base = { version: 2, repository: "o/n", tickets: { board: 3 } };
  const withTickets = (tickets: object, builds?: object) => ({
    ...base,
    tickets: { board: 3, ...tickets },
    ...(builds ? { builds } : {}),
  });

  it("gives every state and field its default when nothing is written", () => {
    const s = parse(base);
    expect(columnsOf(s)).toEqual(DEFAULT_COLUMNS);
    expect(fieldNamesOf(s)).toEqual({
      session: "Session",
      runsIn: "Runs in",
      cost: "Cost",
    });
  });

  it("keeps the default for a key left out and reads none as no column", () => {
    const s = parse(
      withTickets(
        { columns: { backlog: "Todo", refining: "none" } },
        { trigger: "manual" },
      ),
    );
    expect(s.tickets.columns).toMatchObject({
      backlog: ["Todo"],
      refining: null,
      ready: ["Ready"],
      done: ["Done"],
    });
    expect(
      parse(withTickets({ fields: { cost: "none" } })).tickets.fields,
    ).toEqual({ session: "Session", "runs-in": "Runs in", cost: null });
  });

  it.each([
    [
      "an unknown state",
      { columns: { blocked: "X" } },
      "tickets.columns.blocked: unknown key",
    ],
    [
      "a key that is not a heading in lowercase",
      { fields: { Notes: "X" } },
      "tickets.fields.Notes: must be a heading in lowercase, with hyphens for spaces",
    ],
    [
      "two factory fields in one ticket field",
      { fields: { decisions: "Notes", "for-the-builder": "notes" } },
      "tickets.fields.for-the-builder: names the same field as decisions",
    ],
    [
      "backlog none",
      { columns: { backlog: "none" } },
      "tickets.columns.backlog",
    ],
    [
      "two states with one column",
      { columns: { refining: "Ready" } },
      "tickets.columns.ready: names the same column as refining",
    ],
    [
      "the same column in other capitals",
      { columns: { refining: " backlog " } },
      "tickets.columns.refining: names the same column as backlog",
    ],
  ])("rejects %s, naming the key", (_name, tickets, message) => {
    expect(() => parse(withTickets(tickets))).toThrow(message);
  });

  it("rejects columns and fields with no board", () => {
    expect(() =>
      parse({ ...base, tickets: { columns: { backlog: "Todo" } } }),
    ).toThrow("tickets.columns: needs tickets.board");
    expect(() =>
      parse({ ...base, tickets: { fields: { cost: "none" } } }),
    ).toThrow("tickets.fields: needs tickets.board");
  });

  it("reads the ticket-side fields with no board, Spec and Acceptance criteria sharing one", () => {
    const s = parse({
      ...base,
      tickets: {
        fields: {
          spec: "Acceptance criteria",
          "acceptance-criteria": "Acceptance criteria",
          "proposed-docs": "Docs draft",
        },
      },
    });
    expect(s.tickets.ticketFields).toEqual({
      decisions: null,
      spec: "Acceptance criteria",
      "acceptance-criteria": "Acceptance criteria",
      "for-the-builder": null,
      "proposed-docs": "Docs draft",
    });
  });

  it("rejects ready: none unless builds.trigger is manual, with the words the issue gives", () => {
    const message =
      "no column shows ready, so nothing would start a build: name one, or set builds.trigger to manual";
    expect(() =>
      parse(
        withTickets({ columns: { ready: "none" } }, { trigger: "own-server" }),
      ),
    ).toThrow(message);
    expect(() =>
      parse(withTickets({ columns: { ready: "none" } })),
    ).not.toThrow();
  });

  it("prints a column's name in effect, default included, or none", async () => {
    const d = (yaml: string): [ConfigDeps, string[]] => {
      const out: string[] = [];
      return [
        {
          readFile: () => yaml,
          exists: () => true,
          listFiles: () => [],
          hasPackage: () => true,
          loadYaml: async () => (await import("js-yaml")).load,
          out: (l) => out.push(l),
          err: () => {},
        },
        out,
      ];
    };
    const [a, outA] = d(
      "version: 2\nrepository: o/n\ntickets:\n  board: 1\n  columns:\n    ready: Ready for dev\n",
    );
    await configMain(["get", "tickets.columns.ready"].slice(1), a);
    const [b, outB] = d("version: 2\nrepository: o/n\ntickets:\n  board: 1\n");
    await configMain(["tickets.columns.done"], b);
    const [c, outC] = d(
      "version: 2\nrepository: o/n\ntickets:\n  board: 1\n  columns:\n    ready: none\n",
    );
    await configMain(["tickets.columns.ready"], c);
    expect([outA, outB, outC]).toEqual([["Ready for dev"], ["Done"], ["none"]]);
  });

  it("reads the settings from FACTORY_SETTINGS in place of the repository's file", () => {
    expect(settingsPath("/repo", { FACTORY_SETTINGS: "/tmp/s.yaml" })).toBe(
      "/tmp/s.yaml",
    );
    expect(settingsPath("/repo", {})).toBe("/repo/.claude/factory.yaml");
  });
});

describe("the column a ticket shows in", () => {
  it.each([
    ["Backlog", "Todo"],
    ["In refinement", "Todo"],
    ["In progress", "In Progress"],
    ["In review", "In Progress"],
    ["Done", "Done"],
  ] as const)("puts %s in %s on the stock mapping", (status, column) => {
    expect(columnFor(status, STOCK_COLUMNS)).toBe(column);
  });

  it("matches a name whatever its capitals", () => {
    expect(statusOfColumn("in progress", DEFAULT_COLUMNS)).toBe("In progress");
    expect(statusOfColumn(" IN PROGRESS ", STOCK_COLUMNS)).toBe("In progress");
  });

  it("never shows a ticket being built in the ready column", () => {
    const columns: Columns = {
      ...DEFAULT_COLUMNS,
      "In progress": null,
      "In review": null,
    };
    expect(columnFor("In progress", columns)).toBe("In refinement");
    expect(columnFor("In review", columns)).toBe("In refinement");
    expect(columnFor("Ready", columns)).toBe("Ready");
  });

  it("leaves a closed ticket in the nearest earlier column when done is none", () => {
    expect(columnFor("Done", { ...STOCK_COLUMNS, Done: null })).toBe(
      "In Progress",
    );
  });

  it("reads a card in a column no state names as unmapped, and a card with no Status as none", () => {
    const board = withCards(stockBoard(), [
      [1, "Blocked", at(5)],
      [2, null, at(5)],
      [3, "todo", at(5)],
    ]);
    expect(cardOf(board, 1, STOCK_COLUMNS)?.status).toBe("Unmapped");
    expect(cardOf(board, 2, STOCK_COLUMNS)?.status).toBeNull();
    expect(cardOf(board, 3, STOCK_COLUMNS)?.status).toBe("Backlog");
  });

  it("keeps a refined ticket refined after the sync wrote its card to Todo", () => {
    const refined = issue(5, [marked(1, 0, "refined")]);
    const card = { status: "Backlog", updatedAt: at(10) };
    expect(derive(refined, card, [], STOCK_COLUMNS).status).toBe(
      "In refinement",
    );
  });

  it("still sends a refined ticket back to the backlog when its card moved to Backlog on the default board", () => {
    const refined = issue(5, [marked(1, 0, "refined")]);
    const card = { status: "Backlog", updatedAt: at(10) };
    expect(derive(refined, card, []).status).toBe("Backlog");
  });

  it("keeps a released ticket In progress on a board whose building column is the backlog's", () => {
    const columns: Columns = {
      ...DEFAULT_COLUMNS,
      "In progress": null,
      "In review": null,
      "In refinement": null,
      Ready: null,
    };
    const released = issue(5, [marked(1, 0, "released")]);
    expect(
      derive(released, { status: "Backlog", updatedAt: at(10) }, [], columns)
        .status,
    ).toBe("In progress");
  });
});

describe("what the sync writes", () => {
  const snapshot = (...issues: Issue[]) =>
    toSnapshot(issues, [], new Date(at(30)));

  it("puts each ticket's card in its state's column on the stock board", () => {
    const board = withCards(stockBoard(), [
      [1, "Todo", at(0)],
      [2, "Todo", at(0)],
      [3, "Todo", at(0)],
    ]);
    const plans = planSync(
      snapshot(
        issue(1),
        issue(2, [marked(1, 1, "claim actions 99")]),
        issue(3, [], { state: "closed", closedAt: at(20) }),
      ),
      board,
      "acme/widgets",
      RUN_PAGE,
      STOCK_CONFIG,
    );
    const status = (n: number) =>
      plans
        .find((p) => p.number === n)!
        .writes.find((w) => w.field === "Status");
    expect(status(1)).toBeUndefined();
    expect(status(2)).toEqual({ field: "Status", optionName: "In Progress" });
    expect(status(3)).toEqual({ field: "Status", optionName: "Done" });
  });

  it("writes none of a card's fields while it sits in a column no state names", () => {
    const board = withCards(stockBoard(), [[1, "Blocked", at(0)]]);
    const [plan] = planSync(
      snapshot(issue(1, [marked(1, 1, "claim actions 99")])),
      board,
      "acme/widgets",
      RUN_PAGE,
      STOCK_CONFIG,
    );
    expect(plan.writes).toEqual([]);
    expect(plan.unmapped).toBe("Blocked");
  });

  it("places a card that has no Status", () => {
    const board = withCards(stockBoard(), [[1, null, at(0)]]);
    const [plan] = planSync(
      snapshot(issue(1)),
      board,
      "acme/widgets",
      RUN_PAGE,
      STOCK_CONFIG,
    );
    expect(plan.writes).toEqual([{ field: "Status", optionName: "Todo" }]);
  });
});

describe("the optional fields", () => {
  const stock = stockBoard().fields;
  const field = (
    name: string,
    dataType: string,
    options?: string[],
  ): BoardField => ({
    id: `F_${name}`,
    name,
    dataType,
    options: options?.map((o) => ({ id: o, name: o })),
  });
  const config = (fields: Partial<BoardConfig["fields"]>): BoardConfig => ({
    columns: STOCK_COLUMNS,
    fields: { session: "Session", runsIn: "Runs in", cost: "Cost", ...fields },
  });
  const textOf = (fields: BoardField[], cfg: BoardConfig, label: string) =>
    inspectBoard(fields, cfg).lines.find((l) => l.label === label)!.text;

  it("writes a field that is named and present, or left at its default and present", () => {
    const fields = [
      ...stock,
      field("Session", "TEXT"),
      field("cost", "NUMBER"),
    ];
    expect(textOf(fields, config({}), "Session")).toBe("written");
    expect(textOf(fields, config({}), "Cost")).toBe("written");
    expect(
      checkFields(fields, config({ session: "session" })).session?.id,
    ).toBe("F_Session");
  });

  it("fails a field that is named and missing, naming the field and its key", () => {
    expect(() => checkFields(stock, config({ session: "Agent" }))).toThrow(
      "the Agent field is missing or not Text (tickets.fields.session)",
    );
    expect(() =>
      checkFields([...stock, field("Cost", "TEXT")], config({ cost: "Spend" })),
    ).toThrow("(tickets.fields.cost)");
  });

  it("skips a field left at its default that the board lacks, with a note", () => {
    expect(textOf(stock, config({}), "Session")).toBe(
      "skipped: the board has no field named Session",
    );
    expect(checkFields(stock, config({})).session).toBeNull();
  });

  it("fails a default-named field of the wrong type, saying what to do", () => {
    expect(() =>
      checkFields([...stock, field("Cost", "TEXT")], config({})),
    ).toThrow(
      "the Cost field is not a Number: name another field in tickets.fields.cost, or set it to none",
    );
    expect(() =>
      checkFields(
        [...stock, field("Runs in", "SINGLE_SELECT", ["Local"])],
        config({}),
      ),
    ).toThrow(
      "the Runs in field lacks Actions: name another field in tickets.fields.runs-in, or set it to none",
    );
  });

  it("never writes a field set to none, wherever it is", () => {
    const fields = [...stock, field("Cost", "TEXT")];
    expect(checkFields(fields, config({ cost: null })).cost).toBeNull();
    const board = withCards(
      { ...stockBoard(), fields: [...stock, field("Session", "TEXT")] },
      [[1, "Todo", at(0)]],
    );
    const [plan] = planSync(
      toSnapshot(
        [issue(1, [marked(1, 1, "claim actions 99")])],
        [],
        new Date(at(30)),
      ),
      board,
      "acme/widgets",
      RUN_PAGE,
      config({ session: null }),
    );
    expect(plan.writes.map((w) => w.field)).toEqual(["Status"]);
  });
});

describe("the sentences that name a column", () => {
  const kinds: CommentKind[] = [
    { kind: "refined", issue: 7 },
    { kind: "started", marker: "st_1" },
    {
      kind: "dispatch-failed",
      issue: 7,
      status: "401",
      reason: "Unauthorized",
    },
    { kind: "stopped", where: "actions", issue: 7, reason: "r" },
    { kind: "stopped", where: "local", issue: 7, reason: "r" },
    { kind: "ended", issue: 7 },
    { kind: "cleared-claim", issue: 7, since: at(0) },
    { kind: "cleared-start", issue: 7, since: at(0) },
    { kind: "follow-ups-merged", pull: 9 },
    { kind: "pull-closed", issue: 7, pull: 9 },
  ];
  const sentence = (body: string) => body.split("\n\n<!--")[0];
  const stockWithReady: Columns = {
    ...STOCK_COLUMNS,
    Ready: ["Ready for dev"],
  };

  it.each(kinds)(
    "names no factory column on the stock mapping: $kind",
    (kind) => {
      const text = sentence(commentBody(kind, stockWithReady));
      expect(text).not.toMatch(
        /\bReady\b(?! for dev)|In refinement|In review|Backlog/,
      );
    },
  );

  it("says where the card is when its state has no column, and names the ready column", () => {
    expect(
      sentence(commentBody({ kind: "refined", issue: 7 }, stockWithReady)),
    ).toContain("The card stays in Todo until it moves to Ready for dev");
    expect(
      sentence(commentBody({ kind: "ended", issue: 7 }, stockWithReady)),
    ).toBe(
      "The run ended without a pull request. The card stays In Progress, waiting on you. Move it to Ready for dev to try again.",
    );
  });

  it("tells no one to move a card where there is no ready column", () => {
    const none = STOCK_COLUMNS;
    expect(sentence(commentBody({ kind: "refined", issue: 7 }, none))).toBe(
      "Refinement is done. This board has no column for approving a build: tell a session to build #7, or run `factory build 7`.",
    );
    expect(sentence(commentBody({ kind: "ended", issue: 7 }, none))).toBe(
      "The run ended without a pull request. The card stays In Progress, waiting on you. To try again, tell a session to build #7, or run `factory build 7`.",
    );
    expect(
      sentence(
        commentBody(
          { kind: "stopped", where: "actions", issue: 7, reason: "r" },
          none,
        ),
      ),
    ).toBe(
      "Stopped without a pull request: r. The card stays In Progress, waiting on you. Run `factory build 7` to try again.",
    );
    expect(
      sentence(
        commentBody(
          { kind: "stopped", where: "local", issue: 7, reason: "r" },
          none,
        ),
      ),
    ).toBe(
      "Stopped without a pull request: r. The card stays In Progress, waiting on you. Tell a session to work #7 again.",
    );
    expect(
      sentence(commentBody({ kind: "pull-closed", issue: 7, pull: 9 }, none)),
    ).toBe(
      "Pull request #9 was closed without merging. The card stays In Progress, waiting on you. Tell a session to build #7, or run `factory build 7`, to rebuild it, or ask a session to refine it first.",
    );
    for (const kind of kinds.filter(
      (k) => k.kind !== "started" && k.kind !== "dispatch-failed",
    ))
      expect(commentBody(kind, none)).not.toMatch(/move it to|moves to/i);
  });

  it("keeps the markers in the factory's words whatever the columns", () => {
    expect(commentBody({ kind: "ended", issue: 7 }, STOCK_COLUMNS)).toContain(
      "<!-- work-status: released -->",
    );
    expect(commentBody({ kind: "refined", issue: 7 }, STOCK_COLUMNS)).toContain(
      "<!-- work-status: refined -->",
    );
  });

  it("names the stock mapping's columns in the closed pull request's and the nightly sync's comments", () => {
    const [closed] = closedPullComments(
      {
        action: "closed",
        pull_request: { number: 9, merged: false, body: null },
      },
      [7],
      [],
      STOCK_COLUMNS,
    );
    expect(closed.body).toContain("Tell a session to build #7");
    const claimed = issue(7, [
      {
        id: 1,
        author: "acme",
        createdAt: "2026-11-01T00:00:00Z",
        body: `<!-- work-status: claim actions 1 -->\n${AGENT}`,
      },
    ]);
    const [nightly] = nightlyComments(
      toSnapshot([claimed], [], new Date("2026-11-09T00:00:00Z")),
      new Date("2026-11-09T00:00:00Z"),
      STOCK_COLUMNS,
    );
    expect(nightly.body).toContain(
      "The card stays In Progress, waiting on you. To try again, tell a session to build #7",
    );
  });
});

describe("the poller", () => {
  const board = (column: string) =>
    withCards(stockBoard(), [[1, column, at(0)]]);
  const snap = toSnapshot([issue(1)], [], new Date(at(30)));

  it("starts a build for a card in the column FACTORY_READY_COLUMN names, and no other", () => {
    const columns = columnsFrom({ FACTORY_READY_COLUMN: "Ready for dev" });
    expect(selectToStart(snap, board("Ready for dev"), columns)).toEqual([1]);
    expect(selectToStart(snap, board("ready for dev"), columns)).toEqual([1]);
    expect(selectToStart(snap, board("Ready"), columns)).toEqual([]);
  });

  it("defaults to Ready", () => {
    expect(columnsFrom({}).Ready).toEqual(["Ready"]);
    expect(selectToStart(snap, board("Ready"), columnsFrom({}))).toEqual([1]);
  });
});

describe("factory ticket ready", () => {
  const run = async (
    settings: ReturnType<typeof parse>,
    status: string,
    options: string[] = [],
  ) => {
    const fields = BOARD_FIELDS.map((f) =>
      f.name === "Status"
        ? {
            ...f,
            options: [
              ...f.options!,
              ...options.map((name) => ({ id: name, name })),
            ],
          }
        : f,
    );
    const memory = memoryTickets([{ number: 10 }], { fields });
    memory.card(10, { status });
    const out: string[] = [];
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await ticketMain(["ready", "10"], {
      open: async () => ({ tickets: memory.tickets }),
      openPulls: async () => [],
      runner: () => ({ thisRun: () => null }),
      settings: async () => settings,
      env: { CLAUDE_CODE_SESSION_ID: "s" },
      sleep: async () => {},
      out: (l) => out.push(l),
      claimStore: { read: () => null, write: () => {} },
      readFile: () => "",
      now: () => new Date(at(0)),
      clock: { read: () => null, write: () => {} },
      measure: () => ({
        ok: true,
        spend: { dollars: 0, priced: 0, unpriced: new Map() },
      }),
    });
    const message = err.mock.calls.flat().join(" ");
    err.mockRestore();
    return { code, out, memory, message };
  };

  it("sets the column the settings name for ready", async () => {
    const settings = parse({
      ...STOCK_YAML,
      tickets: { board: 7, columns: { ready: "ready for DEV" } },
    });
    const { code, memory } = await run(settings, "Backlog", ["Ready for dev"]);
    expect(code).toBe(0);
    expect(memory.writes).toEqual([
      {
        itemId: "I_10",
        writes: [{ field: "Status", optionName: "Ready for dev" }],
      },
    ]);
  });

  it("fails with the issue's words when the board has no ready column", async () => {
    const { code, message, memory } = await run(STOCK, "Backlog");
    expect(code).toBe(1);
    expect(message).toBe(
      "This board has no column for ready. Tell a session to build #10, or run factory build 10.",
    );
    expect(memory.writes).toEqual([]);
  });
});

describe("factory status", () => {
  const lines = (columns: Columns | undefined) =>
    formatRows(
      toRows(
        { issues: [issue(1, [marked(1, 0, "refined")])], pulls: [] },
        withCards(stockBoard(), [[1, "Todo", at(5)]]),
        new Map(),
        new Date(at(30)),
        watchOf("own-server", 5),
        columns ?? DEFAULT_COLUMNS,
      ),
      new Date(at(30)),
      false,
      { color: false, width: null, columns },
    );

  it("heads each group with the repository's column, or the factory's name for a state with none", () => {
    const heads = lines(STOCK_COLUMNS).filter(
      (l) => l && !l.startsWith(" ") && !l.startsWith("#"),
    );
    expect(heads).toEqual(
      expect.arrayContaining([
        "Todo  0",
        "In refinement  1",
        "Ready  0",
        "In Progress  0",
        "In review  0",
      ]),
    );
    expect(heads.join("\n")).not.toContain("Backlog");
  });
});

describe("factory board check", () => {
  const stockDeps = (settings = STOCK, board: Board = stockBoard()) => {
    const out: string[] = [];
    const written: unknown[] = [];
    const memory = memoryTickets([]);
    const d: BoardDeps = {
      open: async () => ({
        tickets: {
          ...memory.tickets,
          board: {
            ...memory.tickets.board!,
            read: async () => board,
            add: async () => "I",
            set: async (...args) => void written.push(args),
          },
        },
        pulls: {
          open: async () => [],
          linking: async () => [],
          closes: async () => [],
        },
      }),
      runner: () => ({ runPage: RUN_PAGE }),
      env: {},
      now: () => new Date(at(30)),
      out: (l) => out.push(l),
      readFile: () => "",
      writeFile: () => {},
      settings: async () => settings,
    };
    return { d, out, written };
  };

  /** A report of the board with the factory's own fields, whose Status
   * holds the columns given, with `fields` in place of any of the same name. */
  const fullBoard = (columns: string[], fields: BoardField[] = []): Board => ({
    ...stockBoard(),
    fields: [
      {
        ...BOARD_FIELDS[0]!,
        options: columns.map((name) => ({ id: `O_${name}`, name })),
      },
      ...BOARD_FIELDS.slice(1).filter(
        (f) => !fields.some((g) => g.name === f.name),
      ),
      ...fields,
    ],
  });
  const SIX = [
    "Backlog",
    "In refinement",
    "Ready",
    "In progress",
    "In review",
    "Done",
  ];
  const report = (yaml: Record<string, unknown>, board: Board) => {
    const s = parse({ version: 2, repository: "acme/widgets", ...yaml });
    return boardReport(
      7,
      board,
      { columns: columnsOf(s), fields: fieldNamesOf(s) },
      s,
    );
  };
  const rowOf = (lines: string[], key: string) =>
    lines.find((l) => l.slice(4).startsWith(`${key} `) || l.slice(4) === key);

  it("prints the stock mapping as rows under each setting, each with a mark", async () => {
    const { d, out } = stockDeps();
    expect(await boardMain(["check"], d)).toBe(0);
    expect(out).toEqual([
      'Board 7, "Roadmap"',
      "",
      "tickets.columns",
      "  ✓ backlog    Todo",
      "  - refining   none, shows in Todo",
      "  - ready      none",
      "  ✓ building   In Progress",
      "  - review     none, shows in In Progress",
      "  ✓ done       Done",
      "  ? Blocked    no state: left alone",
      "",
      "tickets.fields",
      "  ✓ Status     synced",
      "  ? Session    skipped: no such field",
      "  ? Runs in    skipped: no such field",
      "  ? Cost       skipped: no such field",
    ]);
  });

  it("marks a state whose column the board lacks, and exits 1", async () => {
    const s = parse({
      ...STOCK_YAML,
      tickets: {
        board: 7,
        columns: { ...STOCK_YAML.tickets.columns, review: "In review" },
      },
    });
    const { d, out } = stockDeps(s);
    expect(await boardMain(["check"], d)).toBe(1);
    expect(out).toContain(
      "  ✗ review     In review: no such column on the board",
    );
    expect(out.join("\n")).not.toMatch(/Problem:|Note:/);
  });

  it("names the missing ones of a state with a list", () => {
    const lines = report(
      { tickets: { board: 7, columns: { review: ["Code review", "QA"] } } },
      fullBoard([
        "Backlog",
        "In refinement",
        "Ready",
        "In progress",
        "Code review",
        "Done",
      ]),
    );
    expect(rowOf(lines, "review")).toBe(
      "  ✗ review     Code review, QA: no such column on the board: QA",
    );
  });

  it("reminds an own-server poller of its ready column, unless the column is missing", () => {
    const yaml = (trigger: string) => ({
      builds: { trigger },
      tickets: { board: 7, columns: { ready: "Ready for dev" } },
    });
    const withColumn = fullBoard(
      SIX.map((c) => (c === "Ready" ? "Ready for dev" : c)),
    );
    expect(rowOf(report(yaml("own-server"), withColumn), "ready")).toBe(
      '  ? ready      Ready for dev: the poller needs FACTORY_READY_COLUMN set to "Ready for dev"',
    );
    expect(rowOf(report(yaml("github-action"), withColumn), "ready")).toBe(
      "  ✓ ready      Ready for dev",
    );
    expect(rowOf(report(yaml("own-server"), fullBoard(SIX)), "ready")).toBe(
      "  ✗ ready      Ready for dev: no such column on the board",
    );
  });

  it("fails a missing Status field, prints the states without a mark, and no extra column", async () => {
    const board = stockBoard();
    board.fields = board.fields.filter((f) => f.name !== "Status");
    const { d, out } = stockDeps(STOCK, board);
    expect(await boardMain(["check"], d)).toBe(1);
    expect(out).toContain("  ✗ Status     no such field");
    expect(out).toContain("    backlog    Todo");
    expect(out.join("\n")).not.toContain("Blocked");
  });

  it("fails a Status field that is not a single select", () => {
    const board = fullBoard(SIX);
    board.fields[0] = { id: "F_status", name: "Status", dataType: "TEXT" };
    expect(rowOf(report({ tickets: { board: 7 } }, board), "Status")).toBe(
      "  ✗ Status     not a single select",
    );
  });

  it.each([
    ["synced", {}, [], "  ✓ Runs in    synced"],
    ["off", { "runs-in": "none" }, [], "  - Runs in    off"],
    [
      "named but missing",
      { "runs-in": "Where" },
      [],
      "  ✗ Runs in    no such field: Where",
    ],
    [
      "named but of the wrong kind",
      { "runs-in": "Where" },
      [{ id: "F_w", name: "Where", dataType: "TEXT" }],
      "  ✗ Runs in    Where: not a single select field",
    ],
    [
      "named but lacking an option",
      { "runs-in": "Where" },
      [
        {
          id: "F_w",
          name: "Where",
          dataType: "SINGLE_SELECT",
          options: [{ id: "L", name: "Local" }],
        },
      ],
      "  ✗ Runs in    Where: lacks Actions",
    ],
    [
      "at its default name but lacking an option",
      {},
      [
        {
          id: "F_runs",
          name: "Runs in",
          dataType: "SINGLE_SELECT",
          options: [{ id: "L", name: "Local" }],
        },
      ],
      "  ✗ Runs in    lacks Actions: name another field in tickets.fields.runs-in, or set it to none",
    ],
  ] as [string, Record<string, string>, BoardField[], string][])(
    "prints a field that is %s",
    (_, fields, boardFields, row) => {
      const lines = report(
        { tickets: { board: 7, fields } },
        fullBoard(SIX, boardFields),
      );
      expect(rowOf(lines, "Runs in")).toBe(row);
    },
  );

  it("colors each row's mark alone when it paints", () => {
    const paint = painter(true);
    const s = parse({
      ...STOCK_YAML,
      tickets: {
        board: 7,
        columns: { ...STOCK_YAML.tickets.columns, review: "In review" },
        fields: { cost: "none" },
      },
    });
    const config = { columns: columnsOf(s), fields: fieldNamesOf(s) };
    const painted = boardReport(7, stockBoard(), config, s, paint);
    expect(painted).toContain(`  ${paint("green", "✓")} backlog    Todo`);
    expect(painted).toContain(
      `  ${paint("red", "✗")} review     In review: no such column on the board`,
    );
    expect(painted).toContain(
      `  ${paint("yellow", "?")} Blocked    no state: left alone`,
    );
    expect(painted).toContain(`  ${paint("dim", "-")} Cost       off`);
    expect(painted.slice(0, 3)).toEqual([
      'Board 7, "Roadmap"',
      "",
      "tickets.columns",
    ]);
    expect(painted.map((l) => l.replace(/\x1B\[\d+m/g, ""))).toEqual(
      boardReport(7, stockBoard(), config, s),
    );
  });

  it("fails the sync with the same words before it writes anything", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { d, out, written } = stockDeps(
      parse({ ...STOCK_YAML, tickets: { board: 7 } }),
    );
    d.env = { GH_TOKEN: "t" };
    d.readFile = () =>
      JSON.stringify({
        tickets: [
          {
            number: 1,
            title: "t",
            state: "open",
            closedAt: null,
            labels: [],
            body: "",
            comments: [],
          },
        ],
        pulls: [],
        donePulls: [],
      });
    expect(await boardMain(["apply", "--in", "saved.json"], d)).toBe(1);
    expect(err.mock.calls.flat().join(" ")).toContain(
      "The board: the Status field lacks Backlog (tickets.columns.backlog)",
    );
    expect(written).toEqual([]);
    expect(out).toEqual([]);
    err.mockRestore();
  });
});

describe("a state with a list of columns", () => {
  const LIST_YAML = {
    version: 2,
    repository: "acme/widgets",
    tickets: {
      board: 3,
      columns: {
        backlog: "Todo",
        refining: "none",
        ready: "none",
        building: ["In Progress", "Blocked"],
        review: ["Code review", "QA"],
      },
    },
  };
  const LIST = parse(LIST_YAML);
  const sentence = (body: string) => body.split("\n\n<!--")[0];
  const COLUMNS = columnsOf(LIST);
  const CONFIG: BoardConfig = { columns: COLUMNS, fields: fieldNamesOf(LIST) };
  const statusField = (...names: string[]): BoardField => ({
    id: "F_status",
    name: "Status",
    dataType: "SINGLE_SELECT",
    options: names.map((name) => ({ id: `O_${name}`, name })),
  });
  const BOARD_NAMES = [
    "Todo",
    "In Progress",
    "Blocked",
    "Code review",
    "QA",
    "Done",
  ];
  const listBoard = (cards: [number, string | null, string][]): Board => ({
    projectId: "PVT_3",
    title: "Shop board",
    fields: [statusField(...BOARD_NAMES)],
    items: new Map(
      cards.map(([number, status, updatedAt]) => [
        number,
        {
          itemId: `I${number}`,
          number,
          status,
          updatedAt,
          session: "",
          runsIn: "",
        },
      ]),
    ),
  });

  it("reads a list for a state and a single name as a list of one", () => {
    expect(LIST.tickets.columns.review).toEqual(["Code review", "QA"]);
    expect(LIST.tickets.columns.backlog).toEqual(["Todo"]);
    expect(LIST.tickets.columns.refining).toBeNull();
  });

  it.each([
    [
      "a list for ready",
      { ready: ["Ready", "Go"] },
      ".claude/factory.yaml: tickets.columns.ready: must be one column, or none: only a ticket you approved goes there",
    ],
    [
      "an empty list",
      { review: [] },
      ".claude/factory.yaml: tickets.columns.review: must name at least one column",
    ],
    [
      "a listed name another state names",
      { backlog: "Todo", review: ["Code review", "todo"] },
      ".claude/factory.yaml: tickets.columns.review: names the same column as backlog",
    ],
    [
      "a name twice in one list",
      { review: ["QA", "Code review", "qa"] },
      ".claude/factory.yaml: tickets.columns.review: names qa twice",
    ],
  ])("rejects %s, in the words the issue gives", (_name, columns, message) => {
    expect(() =>
      parse({ ...LIST_YAML, tickets: { board: 3, columns } }),
    ).toThrow(message);
  });

  it("puts a ticket in any listed column in that state", () => {
    expect(statusOfColumn("QA", COLUMNS)).toBe("In review");
    expect(statusOfColumn("code review", COLUMNS)).toBe("In review");
    expect(statusOfColumn("Blocked", COLUMNS)).toBe("In progress");
    expect(cardOf(listBoard([[1, "QA", at(0)]]), 1, COLUMNS)?.status).toBe(
      "In review",
    );
  });

  it("names a state's one column by the first name in its list", () => {
    expect(columnFor("In review", COLUMNS)).toBe("Code review");
    expect(
      sentence(commentBody({ kind: "ended", issue: 7 }, COLUMNS)),
    ).toContain("The card stays In Progress, waiting on you.");
  });

  it("writes the first name, and leaves a card already in any listed name", () => {
    const snap = toSnapshot(
      [
        issue(1, [marked(1, 1, "claim actions 99")]),
        issue(2, [marked(1, 1, "claim actions 98")]),
        issue(3, [marked(1, 1, "claim actions 97")]),
        issue(4, [marked(1, 1, "refining local s1")]),
      ],
      [],
      new Date(at(30)),
    );
    const board = listBoard([
      [1, "Todo", at(0)],
      [2, "Blocked", at(0)],
      [3, "In Progress", at(0)],
      [4, "Todo", at(0)],
    ]);
    const plans = planSync(snap, board, "acme/widgets", RUN_PAGE, CONFIG);
    const status = (n: number) =>
      plans
        .find((p) => p.number === n)!
        .writes.find((w) => w.field === "Status");
    expect(status(1)).toEqual({ field: "Status", optionName: "In Progress" });
    expect(status(2)).toBeUndefined();
    expect(status(3)).toBeUndefined();
    expect(status(4)).toBeUndefined();
  });

  it("prints a list's row joined by commas, and reports each listed name the board lacks", () => {
    const report = (names: string[]) =>
      boardReport(
        3,
        { ...listBoard([]), fields: [statusField(...names)] },
        CONFIG,
        LIST,
      );
    expect(report(BOARD_NAMES)).toContain("  ✓ review     Code review, QA");
    expect(report(BOARD_NAMES)).toContain(
      "  ✓ building   In Progress, Blocked",
    );
    expect(report(BOARD_NAMES.filter((n) => n !== "QA"))).toContain(
      "  ✗ review     Code review, QA: no such column on the board: QA",
    );
  });

  it("heads a factory status group with the first name", () => {
    const heads = formatRows(
      toRows(
        { issues: [issue(1, [marked(1, 0, "claim local s1")])], pulls: [] },
        listBoard([[1, "QA", at(5)]]),
        new Map(),
        new Date(at(30)),
        null,
        COLUMNS,
      ),
      new Date(at(30)),
      false,
      { color: false, width: null, columns: COLUMNS },
    ).filter((l) => l && !l.startsWith(" ") && !l.startsWith("#"));
    expect(heads).toEqual(
      expect.arrayContaining(["In Progress  1", "Code review  0"]),
    );
  });
});
