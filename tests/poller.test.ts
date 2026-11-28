import { spawnSync } from "node:child_process";
import { asIssue } from "./ticket-fixture.ts";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FIRE_LIMIT,
  capAllows,
  dispatchFailure,
  nextDelay,
  once,
  onceEach,
  oncePreset,
  onceSettings,
  presetSettings,
  readConfig,
  serve,
  hosted,
  sources,
  selectToStart,
  stamped,
  startMarker,
  tick,
  type Deps,
  type State,
} from "../src/poller.mts";
import {
  commentBody,
  toSnapshot,
  type Board,
  type BoardItem,
} from "../src/lib/work-status.mts";
import { HttpError } from "../src/tickets/transport.mts";
import { parseSettings } from "../src/config.mts";
import { toBoard } from "../src/tickets/github.mts";
import saved from "./fixtures/sync/repo.json";
// The same repository as GitHub's GraphQL answers it, for the fake fetch.
import repoPages from "./fixtures/sync/repo-graphql.json";
import boardPages from "./fixtures/sync/board.json";
import { KODOR_COLUMNS } from "./kodor-columns";
import { CODE_HOST } from "./settings-fixture";
import { builtOf, TOOLS } from "../src/tools.mts";
import { memoryTickets } from "./memory-tickets";
import { FAKE_EMAIL, FAKE_TOKEN, withFakeTickets } from "./fake-tools";

const NOW = Date.parse("2026-11-09T10:00:00Z");
const ENV = {
  KODOR_BOARD_OWNER: "acme",
  KODOR_BOARD_NUMBER: "1",
  KODOR_BOARD_TOKEN: "ghp_secret_github",
  KODOR_READY_COLUMN: "Ready",
};
const DISPATCH =
  "https://api.github.com/repos/acme/widgets/actions/workflows/kodor.yml/dispatches";
const LOCK_URL =
  "https://api.github.com/repos/acme/widgets/contents/.claude/kodor.lock";

describe("selectToStart", () => {
  it("starts Ready tickets in key order, letters first and then the number as a number", () => {
    const ready = (key: string) =>
      asIssue({
        key,
        title: key,
        state: "open" as const,
        closedAt: null,
        labels: [],
        comments: [],
      });
    const card = (key: string): [string, BoardItem] => [
      key,
      {
        itemId: `IT_${key}`,
        key,
        status: "Ready",
        updatedAt: "2026-11-09T09:00:00Z",
        session: "",
        runsIn: "",
      },
    ];
    const keys = ["PROJ-12", "PROJ-9", "OPS-3"];

    expect(
      selectToStart(
        { issues: keys.map(ready), pulls: [] },
        {
          projectId: "P",
          columnField: "Status",
          fields: [],
          items: new Map(keys.map(card)),
        },
      ),
    ).toEqual(["OPS-3", "PROJ-9", "PROJ-12"]);
  });

  it("takes only the cards the derivation puts in Ready", () => {
    // #12 moved to Ready after its refinement; #13's Ready predates a failed
    // fire, and #14's start already counts.
    expect(
      selectToStart(
        toSnapshot(saved.tickets as never, saved.pulls, new Date(NOW)),
        toBoard(boardPages as never, "acme/widgets"),
      ),
    ).toEqual(["12"]);
  });

  it("does not start a card again after its start failed to fire, until the owner moves it", () => {
    const fireFailed = commentBody({
      kind: "dispatch-failed",
      issue: { key: "7", ref: "#7" },
      status: "401",
      reason: "Unauthorized",
    });
    const comment = (id: number, minute: number, body: string) => ({
      id: String(id),
      createdAt: `2026-11-09T09:0${minute}:00Z`,
      author: "acme",
      body,
    });
    const snapshot = {
      issues: [
        asIssue({
          key: "30",
          title: "A failed start",
          state: "open" as const,
          closedAt: null,
          labels: [],
          comments: [
            comment(1, 2, commentBody({ kind: "started", marker: "st_1" })),
            comment(2, 3, fireFailed),
          ],
        }),
      ],
      pulls: [],
    };
    const board = (updatedAt: string): Board => ({
      projectId: "P",
      columnField: "Status",
      fields: [],
      items: new Map([
        [
          "30",
          {
            itemId: "IT30",
            key: "30",
            status: "Ready",
            updatedAt,
            session: "",
            runsIn: "",
          },
        ],
      ]),
    });

    expect(selectToStart(snapshot, board("2026-11-09T09:01:00Z"))).toEqual([]);
    expect(selectToStart(snapshot, board("2026-11-09T09:04:00Z"))).toEqual([
      "30",
    ]);
  });
});

describe("startMarker", () => {
  it("is st_ and 12 hex characters", () => {
    expect(startMarker()).toMatch(/^st_[0-9a-f]{12}$/);
  });
});

describe("dispatchFailure", () => {
  it("gives the status and the answer's message", () => {
    expect(
      dispatchFailure(new HttpError(403, "x", "Resource not accessible")),
    ).toEqual({
      status: "403",
      reason: "Resource not accessible",
    });
  });

  it("falls back to a stated lack of reason", () => {
    expect(dispatchFailure(new HttpError(500, "x"))).toEqual({
      status: "500",
      reason: "no reason given",
    });
  });

  it("reports nothing answered for a failed fetch", () => {
    expect(dispatchFailure(new TypeError("fetch failed"))).toEqual({
      status: "nothing",
      reason: "fetch failed",
    });
  });
});

describe("capAllows", () => {
  const hourOf = (n: number, minutesAgo: number) =>
    Array.from({ length: n }, () => NOW - minutesAgo * 60_000);

  it("allows the twentieth fire in an hour, not the twenty-first", () => {
    expect(capAllows(hourOf(FIRE_LIMIT - 1, 10), NOW)).toBe(true);
    expect(capAllows(hourOf(FIRE_LIMIT, 10), NOW)).toBe(false);
  });

  it("forgets fires older than an hour", () => {
    expect(capAllows(hourOf(FIRE_LIMIT, 61), NOW)).toBe(true);
  });
});

describe("nextDelay", () => {
  it("waits a minute, and ten after ten failed reads in a row", () => {
    expect(nextDelay(0)).toBe(60_000);
    expect(nextDelay(9)).toBe(60_000);
    expect(nextDelay(10)).toBe(600_000);
  });
});

describe("readConfig", () => {
  it("names every missing variable", () => {
    expect(readConfig({ KODOR_BOARD_OWNER: "x" })).toEqual({
      missing: [
        "KODOR_BOARD_NUMBER",
        "KODOR_BOARD_TOKEN",
        "KODOR_READY_COLUMN",
      ],
    });
  });

  it("counts a ready column of only spaces as missing", () => {
    expect(
      readConfig({
        KODOR_BOARD_OWNER: "x",
        KODOR_BOARD_NUMBER: "1",
        KODOR_BOARD_TOKEN: "t",
        KODOR_READY_COLUMN: "  ",
      }),
    ).toEqual({ missing: ["KODOR_READY_COLUMN"] });
  });

  it("needs neither trigger variable", () => {
    expect(
      readConfig({
        KODOR_BOARD_OWNER: "x",
        KODOR_BOARD_NUMBER: "1",
        KODOR_BOARD_TOKEN: "t",
        KODOR_READY_COLUMN: "Ready",
      }),
    ).toMatchObject({ owner: "x", number: 1 });
  });
});

type Answer =
  { status: number; body?: unknown; statusText?: string } | Error | "hang";

function fakeFetch(answers: {
  dispatch?: Answer;
  repo?: Answer;
  blockers?: Answer;
  comment?: Answer;
  graphql?: Answer;
  /** The board's page, in place of the recorded one. */
  boardPage?: unknown;
  /** The repository's page, in place of the recorded one. */
  repoPage?: unknown;
  /** `.claude/kodor.lock` on the default branch: its text, or GitHub's
   * answer. Not found unless given. */
  lock?: string | Answer;
}) {
  const calls: {
    url: string;
    body: string;
    headers: Record<string, string>;
  }[] = [];
  const respond = (answer: Answer, signal?: AbortSignal | null) => {
    if (answer === "hang")
      return new Promise<Response>((_, reject) =>
        signal?.addEventListener("abort", () => reject(signal.reason)),
      );
    if (answer instanceof Error) return Promise.reject(answer);
    return Promise.resolve(
      new Response(
        answer.status === 204 ? null : JSON.stringify(answer.body ?? {}),
        {
          status: answer.status,
          statusText: answer.statusText ?? "",
        },
      ),
    );
  };
  const run = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = String(init?.body ?? "");
    calls.push({
      url,
      body,
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    if (url === DISPATCH)
      return respond(answers.dispatch ?? { status: 204 }, init?.signal);
    if (url === "https://api.github.com/repos/acme/widgets")
      return respond(
        answers.repo ?? { status: 200, body: { default_branch: "trunk" } },
      );
    if (url.endsWith("/graphql")) {
      if (answers.graphql) return respond(answers.graphql);
      const query = JSON.parse(body).query as string;
      return respond({
        status: 200,
        body: query.includes("projectV2")
          ? (answers.boardPage ?? boardPages[0])
          : (answers.repoPage ?? repoPages[0]),
      });
    }
    if (url.includes("blocked_by"))
      return respond(answers.blockers ?? { status: 200, body: [] });
    if (url.endsWith("/comments"))
      return respond(answers.comment ?? { status: 201, body: { id: 1 } });
    if (url === LOCK_URL)
      return respond(
        typeof answers.lock === "string"
          ? {
              status: 200,
              body: { content: Buffer.from(answers.lock).toString("base64") },
            }
          : (answers.lock ?? { status: 404, body: { message: "Not Found" } }),
      );
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
  return { run, calls };
}

function setup(
  answers: Parameters<typeof fakeFetch>[0],
  env: Deps["env"] = ENV,
) {
  const fetch = fakeFetch(answers);
  const logs: string[] = [];
  const d: Deps = {
    repository: "acme/widgets",
    fetch: fetch.run,
    env,
    now: () => NOW,
    log: (line) => logs.push(line),
    marker: () => "st_0123456789ab",
  };
  const state: State = { failuresInARow: 0, lastHeartbeat: NOW };
  const dispatches = () =>
    fetch.calls
      .filter((c) => c.url === DISPATCH)
      .map((c) => JSON.parse(c.body));
  const comments = () =>
    fetch.calls
      .filter((c) => c.url.endsWith("/comments"))
      .map((c) => JSON.parse(c.body).body);
  return { d, state, logs, calls: fetch.calls, comments, dispatches };
}

/** The recorded pages with `ready` more Ready cards, each refined and moved
 * to Ready as #12 was, and `started` start comments posted `minutesAgo`
 * minutes before NOW, on tickets closed since or, with `open`, still open.
 * `body` writes some other comment in place of each start. */
function withStarts(o: {
  ready?: number;
  started: number;
  minutesAgo: number;
  open?: boolean;
  body?: (number: number) => string;
}) {
  const repo = structuredClone(repoPages[0]);
  const board = structuredClone(boardPages[0]);
  const r = repo.data.repository;
  const twelve = r.open.nodes.find((n) => n.number === 12)!;
  const card = board.data.owner.projectV2.items.nodes.find(
    (n) => n.content.number === 12,
  )!;
  for (let i = 0; i < (o.ready ?? 0); i++) {
    const number = 100 + i;
    r.open.nodes.push({
      ...structuredClone(twelve),
      id: `I_${number}`,
      number,
    });
    board.data.owner.projectV2.items.nodes.push({
      ...structuredClone(card),
      id: `PVTI_${number}`,
      content: { ...card.content, number },
    });
  }
  const at = new Date(NOW - o.minutesAgo * 60_000).toISOString();
  for (let i = 0; i < o.started; i++) {
    const number = 200 + i;
    const node = {
      ...structuredClone(r.closed.nodes[0]),
      id: `I_${number}`,
      number,
      state: o.open ? "OPEN" : "CLOSED",
      closedAt: o.open ? null : at,
      comments: {
        nodes: [
          {
            databaseId: 5000 + i,
            createdAt: at,
            author: { login: "acme" },
            body: o.body
              ? o.body(number)
              : commentBody({ kind: "started", marker: `st_${number}` }),
          },
        ],
      },
    };
    (o.open ? r.open.nodes : r.closed.nodes).push(node as never);
  }
  return { graphql: undefined, repoPage: repo, boardPage: board };
}

describe("tick", () => {
  it("reads GitHub over the fetch transport, with its token and its own name", async () => {
    const { d, state, calls } = setup({});

    await tick(d, state);

    const read = calls.find((c) => c.url === "https://api.github.com/graphql");
    expect(read?.headers).toMatchObject({
      Authorization: `Bearer ${ENV.KODOR_BOARD_TOKEN}`,
      "User-Agent": "ready-poller",
    });
  });

  it("posts the start comment, then dispatches the build on the default branch", async () => {
    const { d, state, calls, comments, dispatches } = setup({});

    await tick(d, state);

    expect(comments()).toEqual([
      "Starting a build in GitHub Actions: the card moved to Ready.\n\n<!-- work-status: started actions st_0123456789ab -->\n<!-- agent -->",
    ]);
    expect(dispatches()).toEqual([
      { ref: "trunk", inputs: { job: "build", ticket: "12" } },
    ]);
    const order = calls.map((c) =>
      c.url === DISPATCH ? "dispatch" : c.url.split("/").at(-1),
    );
    expect(order.slice(-2)).toEqual(["comments", "dispatch"]);
  });

  it("starts no card in a column other than the one KODOR_READY_COLUMN names", async () => {
    const { d, state, comments, dispatches } = setup(
      {},
      { ...ENV, KODOR_READY_COLUMN: "Ready for dev" },
    );

    await tick(d, state);

    expect(dispatches()).toEqual([]);
    expect(comments()).toEqual([]);
  });

  it("starts a card in the column KODOR_READY_COLUMN names, and its comment names that column", async () => {
    const renamed = JSON.parse(
      JSON.stringify(boardPages[0]).replaceAll(
        '"name":"Ready"',
        '"name":"Ready for dev"',
      ),
    );
    const { d, state, comments, dispatches } = setup(
      { boardPage: renamed },
      { ...ENV, KODOR_READY_COLUMN: "Ready for dev" },
    );

    await tick(d, state);

    expect(dispatches()).toEqual([
      { ref: "trunk", inputs: { job: "build", ticket: "12" } },
    ]);
    expect(comments()[0]).toContain("the card moved to Ready for dev.");
  });

  it("reads the default branch once, not every minute", async () => {
    const { d, state, calls } = setup({});

    await tick(d, state);
    await tick(d, state);

    expect(
      calls.filter(
        (c) => c.url === "https://api.github.com/repos/acme/widgets",
      ),
    ).toHaveLength(1);
  });

  it("starts with neither trigger variable set", async () => {
    const { d, state, dispatches } = setup({});

    await tick(d, state);

    expect(dispatches()).toHaveLength(1);
  });

  it("posts the dispatch-failure comment, with GitHub's message, carrying released", async () => {
    const { d, state, comments } = setup({
      dispatch: {
        status: 403,
        statusText: "Forbidden",
        body: { message: "Resource not accessible by personal access token" },
      },
    });

    await tick(d, state);

    expect(comments()[1]).toBe(
      "Could not start a build in GitHub Actions: GitHub answered 403 (Resource not accessible by personal access token). The card stays In progress, waiting on you. Move it to Ready to try again.\n\n<!-- work-status: released -->\n<!-- agent -->",
    );
  });

  it("falls back to the status text when GitHub's answer has no message", async () => {
    const { d, state, comments } = setup({
      dispatch: { status: 404, statusText: "Not Found" },
    });
    // The fake answers with an object body that has no message.

    await tick(d, state);

    expect(comments()[1]).toMatch(/answered 404 \(Not Found\)/);
  });

  it("survives a dispatch that gets no response at all", async () => {
    const { d, state, comments } = setup({
      dispatch: new TypeError("fetch failed"),
    });

    await expect(tick(d, state)).resolves.toBeUndefined();
    expect(comments()[1]).toMatch(/answered nothing \(fetch failed\)/);
  });

  it("does not dispatch when the start comment cannot be posted", async () => {
    const { d, state, dispatches } = setup({ comment: { status: 500 } });

    await tick(d, state);

    expect(dispatches()).toEqual([]);
  });

  it("skips a card with an open blocker, or blockers it cannot read", async () => {
    const blocked = setup({
      blockers: { status: 200, body: [{ number: 3, state: "open" }] },
    });
    const unreadable = setup({ blockers: { status: 502 } });

    await tick(blocked.d, blocked.state);
    await tick(unreadable.d, unreadable.state);

    expect(blocked.comments()).toEqual([]);
    expect(unreadable.comments()).toEqual([]);
    expect(blocked.logs).toContain("#12 waits on #3");
  });

  it("starts nothing once twenty start comments were posted in the past hour, though it keeps no count of its own", async () => {
    const { d, state, comments, logs } = setup(
      withStarts({ started: FIRE_LIMIT, minutesAgo: 59 }),
    );

    await tick(d, state);

    expect(comments()).toEqual([]);
    expect(logs).toContain(
      "#12 waits: 20 builds started in the last hour (builds.max-per-hour)",
    );
  });

  it("counts the start comments on tickets still open", async () => {
    const { d, state, comments } = setup(
      withStarts({ started: FIRE_LIMIT, minutesAgo: 10, open: true }),
    );

    await tick(d, state);

    expect(comments()).toEqual([]);
  });

  it("counts no comment but a start", async () => {
    const { d, state, dispatches } = setup(
      withStarts({
        started: FIRE_LIMIT,
        minutesAgo: 10,
        body: (n) =>
          `Text.\n\n<!-- work-status: claim local s${n} -->\n<!-- agent -->`,
      }),
    );

    await tick(d, state);

    expect(dispatches()).not.toEqual([]);
  });

  it("forgets a start comment over an hour old", async () => {
    const { d, state, dispatches } = setup(
      withStarts({ started: FIRE_LIMIT, minutesAgo: 61 }),
    );

    await tick(d, state);

    expect(dispatches()).not.toEqual([]);
  });

  it("counts the builds it starts in the same pass, so twenty-five Ready cards start twenty", async () => {
    const { d, state, dispatches } = setup(
      withStarts({ ready: 25, started: 0, minutesAgo: 0 }),
    );

    await tick(d, state);

    expect(dispatches()).toHaveLength(FIRE_LIMIT);
  });

  it("counts a failed read and keeps going", async () => {
    const { d, state, logs } = setup({ graphql: { status: 502 } });
    state.failuresInARow = 9;

    await expect(tick(d, state)).resolves.toBeUndefined();
    expect(state.failuresInARow).toBe(10);
    expect(logs[0]).toMatch(/^read failed \(10 in a row\)/);
  });

  it("logs the missing variables and reads nothing", async () => {
    const { d, state, calls, logs } = setup({}, { KODOR_BOARD_OWNER: "acme" });

    await tick(d, state);

    expect(calls).toEqual([]);
    expect(logs[0]).toMatch(
      /^not polling: KODOR_BOARD_NUMBER, KODOR_BOARD_TOKEN, KODOR_READY_COLUMN not set/,
    );
  });

  it("logs an hourly heartbeat with the Ready count", async () => {
    const { d, state, logs } = setup({});
    state.lastHeartbeat = NOW - 3_600_000;

    await tick(d, state);

    expect(logs).toContain("heartbeat: 1 Ready card");
  });

  it("never logs a token", async () => {
    const { d, state, logs } = setup({
      dispatch: { status: 401, statusText: "Unauthorized" },
    });
    state.lastHeartbeat = 0;

    await tick(d, state);

    expect(logs.join("\n")).not.toMatch(/secret/);
  });
});

describe("the poller you host", () => {
  /** A lock as `kodor sync` writes it, written by factory `version`, with
   * `tickets` and `settings` adding lines under each. */
  function lockOf(
    o: {
      version?: string;
      ready?: string;
      label?: string;
      max?: number;
      trigger?: string;
      board?: string;
      tickets?: string[];
      settings?: string[];
    } = {},
  ) {
    return [
      "# Written by `kodor sync`. Do not edit.",
      `version: ${o.version ?? "0.2.0"}`,
      "presets: []",
      "settings:",
      "  version: 1",
      "  repository: acme/widgets",
      "  tickets:",
      "    type: github",
      // `kodor config check` refuses columns with no board.
      ...(o.board === "none"
        ? []
        : [
            `    board: ${o.board ?? 1}`,
            "    columns:",
            "      backlog: Backlog",
            "      refining: In refinement",
            `      ready: ${o.ready ?? "Ready"}`,
            "      building: In progress",
            "      review: In review",
            "      done: Done",
          ]),
      "    labels:",
      `      kodor: ${o.label ?? "kodor"}`,
      ...(o.tickets ?? []).map((l) => `    ${l}`),
      "  builds:",
      `    trigger: ${o.trigger ?? "own-server"}`,
      `    max-per-hour: ${o.max ?? 20}`,
      ...(o.settings ?? []).map((l) => `  ${l}`),
      "",
    ].join("\n");
  }

  /** A hosted poller of acme/widgets at 0.2.0. `answers.lock` can be
   * swapped between passes. */
  function host(
    over: Parameters<typeof fakeFetch>[0] = {},
    env: Deps["env"] = { KODOR_BOARD_TOKEN: "ghp_secret_github" },
  ) {
    const answers: Parameters<typeof fakeFetch>[0] = {
      lock: lockOf(),
      ...over,
    };
    const s = setup(answers, env);
    s.d.version = "0.2.0";
    return { ...s, answers };
  }

  const SETTINGS_LINE =
    'settings from .claude/kodor.lock on trunk: board 1, ready column "Ready", label "kodor", 20 builds an hour';
  const MANUAL =
    "not polling: builds.trigger is manual on trunk, not own-server";

  it("starts a card in the ready column the lock names", async () => {
    const { d, state, dispatches } = host();

    await hosted(d, state);

    expect(dispatches()).toEqual([
      { ref: "trunk", inputs: { job: "build", ticket: "12" } },
    ]);
  });

  it("starts no card in Ready when the lock names another column, whatever KODOR_READY_COLUMN says", async () => {
    const { d, state, dispatches } = host(
      { lock: lockOf({ ready: "Approved" }) },
      {
        KODOR_BOARD_TOKEN: "ghp_secret_github",
        KODOR_READY_COLUMN: "Ready",
      },
    );

    await hosted(d, state);

    expect(dispatches()).toEqual([]);
  });

  it("reads the board the lock names, owned by the repository's owner, whatever the old variables say", async () => {
    const { d, state, calls } = host(
      { lock: lockOf({ board: "7" }) },
      {
        KODOR_BOARD_TOKEN: "ghp_secret_github",
        KODOR_BOARD_OWNER: "someone-else",
        KODOR_BOARD_NUMBER: "1",
      },
    );

    await hosted(d, state);

    const boards = calls
      .filter((c) => c.url.endsWith("/graphql"))
      .map((c) => JSON.parse(c.body))
      .filter((b) => b.query.includes("projectV2"))
      .map((b) => [b.variables.owner, b.variables.number]);
    expect(boards.length).toBeGreaterThan(0);
    expect(new Set(boards.map(String))).toEqual(new Set(["acme,7"]));
  });

  it("finds tickets by the label the lock names, whatever KODOR_LABEL says", async () => {
    const renamed = JSON.parse(
      JSON.stringify(repoPages[0]).replaceAll(
        '{"name":"kodor"}',
        '{"name":"built-by-factory"}',
      ),
    );
    const { d, state, dispatches } = host(
      { repoPage: renamed, lock: lockOf({ label: "built-by-factory" }) },
      { KODOR_BOARD_TOKEN: "ghp_secret_github", KODOR_LABEL: "kodor" },
    );

    await hosted(d, state);

    expect(dispatches()).toHaveLength(1);
  });

  it("keeps the hourly cap the lock sets, whatever KODOR_MAX_PER_HOUR says", async () => {
    const { d, state, dispatches, logs } = host(
      {
        ...withStarts({ ready: 5, started: 0, minutesAgo: 0 }),
        lock: lockOf({ max: 2 }),
      },
      { KODOR_BOARD_TOKEN: "ghp_secret_github", KODOR_MAX_PER_HOUR: "20" },
    );

    await hosted(d, state);

    expect(dispatches()).toHaveLength(2);
    expect(logs).toContainEqual(
      expect.stringMatching(/waits: 2 builds started in the last hour/),
    );
  });

  it("logs the settings it read once while they stay the same", async () => {
    const { d, state, logs } = host();

    await hosted(d, state);
    await hosted(d, state);

    expect(logs.filter((l) => l.startsWith("settings from"))).toEqual([
      SETTINGS_LINE,
    ]);
  });

  it.each([
    [
      { ready: "Approved" },
      'board 1, ready column "Approved", label "kodor", 20 builds an hour',
    ],
    [
      { board: "7" },
      'board 7, ready column "Ready", label "kodor", 20 builds an hour',
    ],
    [
      { label: "built" },
      'board 1, ready column "Ready", label "built", 20 builds an hour',
    ],
    [
      { max: 5 },
      'board 1, ready column "Ready", label "kodor", 5 builds an hour',
    ],
  ])("logs the settings again when %o changes", async (change, read) => {
    const { d, state, logs, answers } = host();
    await hosted(d, state);
    answers.lock = lockOf(change);

    await hosted(d, state);

    expect(logs.filter((l) => l.startsWith("settings from"))).toEqual([
      SETTINGS_LINE,
      `settings from .claude/kodor.lock on trunk: ${read}`,
    ]);
  });

  it.each([
    [
      { KODOR_LABEL: "kodor" },
      "KODOR_LABEL is no longer read: the settings on trunk are. Take it out of the poller's environment.",
    ],
    [
      {
        KODOR_MAX_PER_HOUR: "20",
        KODOR_BOARD_OWNER: "acme",
        KODOR_READY_COLUMN: "Ready",
        KODOR_BOARD_NUMBER: " ",
      },
      "KODOR_BOARD_OWNER, KODOR_READY_COLUMN, KODOR_MAX_PER_HOUR are no longer read: the settings on trunk are. Take them out of the poller's environment.",
    ],
  ])(
    "names the variables it no longer reads, once, before the settings",
    async (old, line) => {
      const { d, state, logs } = host(
        {},
        { KODOR_BOARD_TOKEN: "ghp_secret_github", ...old },
      );

      await hosted(d, state);
      await hosted(d, state);

      expect(logs.filter((l) => l.includes("no longer read"))).toEqual([line]);
      expect(logs.indexOf(line)).toBeLessThan(logs.indexOf(SETTINGS_LINE));
    },
  );

  it("names no variable when none of the old ones is set", async () => {
    const { d, state, logs } = host();

    await hosted(d, state);

    expect(logs.join("\n")).not.toMatch(/no longer read/);
  });

  it.each([
    [
      "no lock on the default branch",
      { lock: { status: 404, body: { message: "Not Found" } } },
      "no .claude/kodor.lock on trunk yet. Merge the pull request that sets kodor up.",
    ],
    [
      "a manual trigger",
      { lock: lockOf({ trigger: "manual" }) },
      "builds.trigger is manual on trunk, not own-server",
    ],
    [
      "a schedule",
      { lock: lockOf({ trigger: "github-action" }) },
      "builds.trigger is github-action on trunk, not own-server",
    ],
    [
      "no board",
      { lock: lockOf({ board: "none" }) },
      "tickets.board is not set on trunk",
    ],
    [
      "a cap it can't read, from its own release",
      { lock: lockOf({ max: 0 }) },
      ".claude/kodor.lock on trunk: builds.max-per-hour: must be a whole number, 1 or more",
    ],
    [
      "a cap it can't read, from another release",
      { lock: lockOf({ max: 0, version: "0.3.0" }) },
      ".claude/kodor.lock on trunk: builds.max-per-hour: must be a whole number, 1 or more (written by kodor 0.3.0, and this poller is 0.2.0: run ghcr.io/kodor-ai/kodor-poller:0.3.0)",
    ],
    [
      "a ready column of none",
      { lock: lockOf({ ready: "none" }) },
      ".claude/kodor.lock on trunk: tickets.columns.ready: no column shows ready, so nothing would start a build: name one, or set builds.trigger to manual",
    ],
    [
      "a lock with no settings",
      { lock: "version: 0.1.0\npresets: []\n" },
      ".claude/kodor.lock on trunk: is from an earlier version of kodor. Run: kodor sync (written by kodor 0.1.0, and this poller is 0.2.0: run ghcr.io/kodor-ai/kodor-poller:0.1.0)",
    ],
  ])("starts nothing with %s, and says why", async (_, answers, reason) => {
    const { d, state, logs, comments, dispatches } = host(answers);

    await hosted(d, state);

    expect(dispatches()).toEqual([]);
    expect(comments()).toEqual([]);
    expect(logs).toEqual([`not polling: ${reason}`]);
  });

  it("starts nothing with a lock whose columns leave out the ready one, and says why", async () => {
    const { d, state, logs, dispatches } = host({
      lock: lockOf().replace("      ready: Ready\n", ""),
    });

    await hosted(d, state);

    expect(dispatches()).toEqual([]);
    expect(logs).toEqual([
      "not polling: .claude/kodor.lock on trunk: tickets.columns.ready: no column shows ready, so nothing would start a build: name one, or set builds.trigger to manual",
    ]);
  });

  it("reads no lock when the default branch can't be read, and counts it", async () => {
    const { d, state, logs, calls } = host({
      repo: { status: 500, statusText: "Server Error" },
    });

    await hosted(d, state);

    expect(calls.map((c) => c.url)).not.toContain(LOCK_URL);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatch(/^default branch not read: /);
    expect(state.failuresInARow).toBe(1);
  });

  it("starts nothing with a lock that is not YAML, and gives the parser's first line", async () => {
    const { d, state, logs, dispatches } = host({ lock: "version: [0.2.0\n" });

    await hosted(d, state);

    expect(dispatches()).toEqual([]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatch(/^not polling: \.claude\/kodor\.lock on trunk: \S/);
    expect(logs[0]).not.toContain("\n");
  });

  it("names kodor's own version when the test gives none", async () => {
    const own = JSON.parse(readFileSync("package.json", "utf8")).version;
    const { d, state, logs } = host({
      lock: lockOf({ max: 0, version: "9.9.9" }),
    });
    delete d.version;

    await hosted(d, state);

    expect(logs[0]).toContain(`and this poller is ${own}:`);
  });

  it("reads past keys and values it does not use", async () => {
    const { d, state, dispatches } = host({
      lock: lockOf({
        version: "0.3.0",
        tickets: ["triage: Inbox"],
        settings: [
          "  poll-minutes: 7",
          "commands:",
          "  gate: 12",
          "newer-setting: true",
        ],
      }),
    });

    await hosted(d, state);

    expect(dispatches()).toHaveLength(1);
  });

  it("logs a reason once while it holds", async () => {
    const { d, state, logs } = host({ lock: lockOf({ trigger: "manual" }) });

    await hosted(d, state);
    await hosted(d, state);

    expect(logs).toEqual([MANUAL]);
  });

  it("logs a reason again when it changes to another", async () => {
    const { d, state, logs, answers } = host({
      lock: { status: 404, body: { message: "Not Found" } },
    });
    await hosted(d, state);
    answers.lock = lockOf({ trigger: "manual" });

    await hosted(d, state);

    expect(logs).toEqual([
      "not polling: no .claude/kodor.lock on trunk yet. Merge the pull request that sets kodor up.",
      MANUAL,
    ]);
  });

  it("repeats a reason that holds in its hourly heartbeat", async () => {
    const { d, state, logs } = host({ lock: lockOf({ trigger: "manual" }) });
    await hosted(d, state);
    d.now = () => NOW + 3_600_000;

    await hosted(d, state);

    expect(logs).toEqual([
      MANUAL,
      "heartbeat: not polling: builds.trigger is manual on trunk, not own-server",
    ]);
  });

  it("resets the count of failed reads at a pass that read the lock, even one that polls nothing", async () => {
    const { d, state } = host({ lock: lockOf({ trigger: "manual" }) });
    state.failuresInARow = 3;

    await hosted(d, state);

    expect(state.failuresInARow).toBe(0);
  });

  it("polls again at the first pass after the reason clears", async () => {
    const { d, state, logs, dispatches, answers } = host({
      lock: lockOf({ trigger: "manual" }),
    });
    await hosted(d, state);
    answers.lock = lockOf();

    await hosted(d, state);

    expect(dispatches()).toHaveLength(1);
    expect(logs.slice(0, 2)).toEqual([MANUAL, SETTINGS_LINE]);
  });

  it("uses nothing it read at an earlier pass once the lock can't be read", async () => {
    const { d, state, dispatches, answers } = host();
    await hosted(d, state);
    const before = dispatches().length;
    answers.lock = lockOf({ max: 0 });

    await hosted(d, state);

    expect(dispatches()).toHaveLength(before);
  });

  it("counts a failed read of the lock toward the slower retry", async () => {
    const { d, state, logs, dispatches } = host({
      lock: { status: 500, statusText: "Server Error" },
    });

    await hosted(d, state);

    expect(state.failuresInARow).toBe(1);
    expect(logs[0]).toMatch(/^read failed \(1 in a row\): /);
    expect(dispatches()).toEqual([]);
  });

  it.each([{}, { KODOR_BOARD_TOKEN: "  " }])(
    "polls nothing without a token, and counts it",
    async (env) => {
      const { d, state, calls, logs } = host({}, env);

      await hosted(d, state);

      expect(calls).toEqual([]);
      expect(logs).toEqual(["not polling: KODOR_BOARD_TOKEN not set"]);
      expect(state.failuresInARow).toBe(1);
    },
  );

  it("names its repository when it starts, before its first pass", async () => {
    const { d, logs } = host({}, {});

    await serve(d, async () => {}, 1);

    expect(logs).toEqual([
      "ready-poller started for acme/widgets",
      "not polling: KODOR_BOARD_TOKEN not set",
    ]);
  });

  it("counts a board that keeps failing, past a good read of the lock, and backs off after ten", async () => {
    const { d, logs } = host({ graphql: { status: 502 } });
    const waits: number[] = [];

    await serve(d, async (ms) => waits.push(ms), 11);

    expect(waits).toEqual([...Array(9).fill(60_000), 600_000]);
    expect(logs.at(-1)).toMatch(/^read failed \(11 in a row\): /);
  });

  it("waits a minute between passes, and ten once ten in a row have failed", async () => {
    const { d } = host({}, {});
    const waits: number[] = [];

    await serve(d, async (ms) => waits.push(ms), 11);

    expect(waits).toEqual([...Array(9).fill(60_000), 600_000]);
  });
});

describe("onceSettings", () => {
  const read = (raw: Record<string, unknown>) =>
    onceSettings(
      parseSettings(
        {
          version: 1,
          repository: "acme/widgets",
          "code-host": CODE_HOST,
          ...raw,
        },
        () => true,
      ),
    );

  it("takes the board and the Ready column from the settings", () => {
    expect(read({ tickets: { board: 7, columns: KODOR_COLUMNS } })).toEqual({
      board: 7,
      ready: "Ready",
      kodor: "kodor",
      maxPerHour: 20,
      ticketSystem: { type: "github", options: {}, own: true },
    });
  });

  it("takes the ticket system the settings name, whose links are not the code host's own", () => {
    const tools = withFakeTickets(TOOLS, memoryTickets([]).tickets);
    const s = parseSettings(
      {
        version: 1,
        repository: "acme/widgets",
        "code-host": CODE_HOST,
        tickets: {
          type: "fake",
          site: "acme.example",
          board: 7,
          columns: KODOR_COLUMNS,
        },
      },
      () => true,
      builtOf(tools),
    );
    expect(onceSettings(s).ticketSystem).toEqual({
      type: "fake",
      options: { site: "acme.example" },
      own: false,
    });
  });

  it("takes a Ready column the settings rename", () => {
    expect(
      read({
        tickets: {
          board: 7,
          columns: { ...KODOR_COLUMNS, ready: "Ready for dev" },
        },
      }),
    ).toMatchObject({
      board: 7,
      ready: "Ready for dev",
    });
  });

  it("has no board when the settings name none", () => {
    expect(read({}).board).toBeNull();
  });

  it("has no Ready column when the settings set it to none", () => {
    expect(
      read({
        tickets: { board: 7, columns: { ...KODOR_COLUMNS, ready: "none" } },
        builds: { trigger: "manual" },
      }).ready,
    ).toBeNull();
  });
});

describe("the ticket system the poller opens", () => {
  const CONFIG = {
    owner: "acme",
    number: 7,
    githubToken: "ghp_x",
    maxPerHour: 20,
  };
  const fake = (opened: (Record<string, string> | undefined)[]) =>
    withFakeTickets(TOOLS, memoryTickets([]).tickets, false, {
      credential: true,
      opened,
    }).tickets;

  it("opens the settings' ticket system through the registry, with its credential", async () => {
    const opened: (Record<string, string> | undefined)[] = [];
    const { d } = setup(
      {},
      {
        ...ENV,
        [FAKE_EMAIL]: "ci@acme.example",
        [FAKE_TOKEN]: "t0k",
      },
    );
    await sources(
      {
        ...d,
        systems: fake(opened),
        ticketSystem: {
          type: "fake",
          options: { site: "acme.example" },
          own: false,
        },
      },
      CONFIG,
    );
    expect(opened).toEqual([
      { [FAKE_EMAIL]: "ci@acme.example", [FAKE_TOKEN]: "t0k" },
    ]);
  });

  it("opens the default ticket system with no settings, as a hosted poller has none", async () => {
    const opened: (Record<string, string> | undefined)[] = [];
    const { d } = setup({});
    const systems = fake(opened);
    let github = 0;
    systems.github = {
      ...systems.github!,
      open: () => {
        github += 1;
        return memoryTickets([]).tickets;
      },
    };
    await sources({ ...d, systems }, CONFIG);
    expect([github, opened]).toEqual([1, []]);
  });

  it("logs a missing credential as its message, and counts a failed read", async () => {
    const { d, state, logs } = setup({});
    await tick(
      {
        ...d,
        systems: fake([]),
        ticketSystem: {
          type: "fake",
          options: { site: "acme.example" },
          own: false,
        },
        env: { ...ENV, XDG_CONFIG_HOME: "/nonexistent" },
      },
      state,
    );
    expect(logs).toEqual([
      "read failed (1 in a row): No Fake Tickets credential for acme.example. Set FAKE_TICKETS_EMAIL and FAKE_TICKETS_TOKEN, or run: kodor init",
    ]);
    expect(state.failuresInARow).toBe(1);
  });
});

describe("once", () => {
  const TOKEN = { KODOR_BOARD_TOKEN: ENV.KODOR_BOARD_TOKEN };
  const settings = {
    board: 1,
    ready: "Ready",
    kodor: "kodor",
  };

  it("starts each Ready ticket and returns 0", async () => {
    const { d, dispatches } = setup({}, TOKEN);

    expect(await once(settings, d)).toBe(0);
    expect(dispatches()).toEqual([
      { ref: "trunk", inputs: { job: "build", ticket: "12" } },
    ]);
  });

  it("reads the board its settings name, owned by the repository's owner", async () => {
    const { d, calls } = setup({}, TOKEN);

    await once({ ...settings, board: 7 }, d);

    const board = calls
      .filter((c) => c.url.endsWith("/graphql"))
      .map((c) => JSON.parse(c.body))
      .find((b) => String(b.query).includes("projectV2"));
    expect(board.variables).toMatchObject({ owner: "acme", number: 7 });
  });

  it("starts no card outside the Ready column its settings name", async () => {
    const { d, dispatches } = setup({}, TOKEN);

    await once({ ...settings, ready: "Ready for dev" }, d);

    expect(dispatches()).toEqual([]);
  });

  it("returns 1, saying why, when it cannot read the board", async () => {
    const { d, logs } = setup({ graphql: { status: 502 } }, TOKEN);

    expect(await once(settings, d)).toBe(1);
    expect(logs[0]).toMatch(/^read failed/);
  });

  it("returns 1, naming the token, when KODOR_BOARD_TOKEN is not set", async () => {
    const { d, logs } = setup({}, {});

    expect(await once(settings, d)).toBe(1);
    expect(logs).toContain("not polling: KODOR_BOARD_TOKEN not set");
  });

  it.each([
    [
      { board: null, ready: "Ready" },
      "No board to read: tickets.board is not set in .claude/kodor.yaml.",
    ],
    [
      { board: 1, ready: null },
      "No card can start a build: the Ready column is none in .claude/kodor.yaml.",
    ],
  ])(
    "returns 1 and reads nothing when the settings give it nothing to poll",
    async (given, said) => {
      const { d, calls, logs } = setup({}, TOKEN);

      expect(await once({ ...given, kodor: "kodor" }, d)).toBe(1);
      expect(calls).toEqual([]);
      expect(logs).toEqual([said]);
    },
  );
});

describe("a line the poller prints", () => {
  it("starts with the time, and keeps a warning's mark before it, where a workflow's run reads it", () => {
    const at = new Date("2026-11-09T10:00:00Z");
    expect(stamped("#12 waits on #3", at)).toBe(
      "2026-11-09T10:00:00.000Z #12 waits on #3",
    );
    expect(stamped("::warning::acme/web: read failed", at)).toBe(
      "::warning::2026-11-09T10:00:00.000Z acme/web: read failed",
    );
  });
});

describe("the poller's start", () => {
  it("exits with a message naming KODOR_REPOSITORY when it is not set", () => {
    const env = { ...process.env };
    delete env.KODOR_REPOSITORY;
    const r = spawnSync("node", ["src/poller.mts"], {
      env,
      encoding: "utf8",
      timeout: 5000,
    });

    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toContain("KODOR_REPOSITORY is not set");
  });
});

describe("poller.Dockerfile", () => {
  const file = readFileSync("poller.Dockerfile", "utf8");
  const name = JSON.parse(readFileSync("package.json", "utf8")).name as string;

  it("installs kodor's published version the build names, without its dev tools", () => {
    expect(file).toMatch(/^ARG VERSION$/m);
    expect(file).toContain(`npm install --omit=dev`);
    expect(file).toContain(`"${name}@\${VERSION}"`);
  });

  it("names this repository as its source, so Dependabot can read its versions", () => {
    expect(file).toMatch(
      /^LABEL org\.opencontainers\.image\.source="https:\/\/github\.com\/kodor-ai\/kodor"$/m,
    );
  });

  it("runs the installed poller as an unprivileged user", () => {
    expect(file).toMatch(/^USER node$/m);
    expect(file).toMatch(
      new RegExp(
        `^CMD \\["node", "node_modules/${name.replace("/", "\\/")}/bin/kodor\\.js", "poller"\\]$`,
        "m",
      ),
    );
  });
});

describe("tickets without the kodor label", () => {
  /** The recorded pages with the kodor label taken off ticket 12. */
  const unlabeled = () => {
    const page = structuredClone(repoPages[0]) as {
      data: {
        repository: {
          open: {
            nodes: { number: number; labels: { nodes: { name: string }[] } }[];
          };
        };
      };
    };
    for (const node of page.data.repository.open.nodes)
      if (node.number === 12)
        node.labels.nodes = node.labels.nodes.filter((l) => l.name !== "kodor");
    return page;
  };

  it("starts no build of a Ready ticket without the label, and logs nothing for it", async () => {
    const { d, state, logs, comments, dispatches } = setup({
      repoPage: unlabeled(),
    });

    await tick(d, state);

    expect(dispatches()).toEqual([]);
    expect(comments()).toEqual([]);
    expect(logs.filter((l) => l.includes("#12"))).toEqual([]);
  });

  it("finds the label by the name KODOR_LABEL gives it", async () => {
    const renamed = JSON.parse(
      JSON.stringify(repoPages[0]).replaceAll(
        '{"name":"kodor"}',
        '{"name":"built-by-factory"}',
      ),
    );
    const { d, state, dispatches } = setup(
      { repoPage: renamed },
      { ...ENV, KODOR_LABEL: "built-by-factory" },
    );

    await tick(d, state);

    expect(dispatches()).toEqual([
      { ref: "trunk", inputs: { job: "build", ticket: "12" } },
    ]);
  });
});

describe("the hourly cap's setting", () => {
  it("starts no more than KODOR_MAX_PER_HOUR says", async () => {
    const { d, state, dispatches, logs } = setup(
      withStarts({ ready: 5, started: 0, minutesAgo: 0 }),
      { ...ENV, KODOR_MAX_PER_HOUR: "2" },
    );

    await tick(d, state);

    expect(dispatches()).toHaveLength(2);
    expect(logs).toContainEqual(
      expect.stringMatching(
        /waits: 2 builds started in the last hour \(builds\.max-per-hour\)$/,
      ),
    );
  });

  it.each(["0", "two", "1.5"])(
    "polls nothing with KODOR_MAX_PER_HOUR %s, and says why",
    async (max) => {
      const { d, state, calls, logs } = setup(
        {},
        {
          ...ENV,
          KODOR_MAX_PER_HOUR: max,
        },
      );

      await tick(d, state);

      expect(calls).toEqual([]);
      expect(logs).toEqual([
        "not polling: KODOR_MAX_PER_HOUR must be a whole number, 1 or more",
      ]);
    },
  );

  it("passes builds.max-per-hour to a scheduled pass", async () => {
    const { d, dispatches } = setup(
      withStarts({ ready: 5, started: 0, minutesAgo: 0 }),
      { KODOR_BOARD_TOKEN: ENV.KODOR_BOARD_TOKEN },
    );

    await once(
      {
        board: 1,
        ready: "Ready",
        kodor: "kodor",
        maxPerHour: 3,
      },
      d,
    );
    expect(dispatches()).toHaveLength(3);
  });
});

describe("the board's order", () => {
  it("starts Ready tickets by their cards' rank, then by key", () => {
    const ready = (key: string) =>
      asIssue({
        key,
        title: key,
        state: "open" as const,
        closedAt: null,
        labels: [],
        comments: [],
      });
    const card = (key: string, rank: number): [string, BoardItem] => [
      key,
      {
        itemId: `I_${key}`,
        key,
        status: "Ready",
        updatedAt: "2026-11-09T12:00:00Z",
        session: "",
        runsIn: "",
        rank,
      },
    ];
    const keys = ["5", "9", "12", "30"];
    const board: Board = {
      projectId: "P",
      columnField: "Status",
      fields: [],
      items: new Map([
        card("5", 2),
        card("9", 0),
        card("12", 1),
        card("30", 1),
      ]),
    };

    expect(
      selectToStart({ issues: keys.map(ready), pulls: [] }, board),
    ).toEqual(["9", "12", "30", "5"]);
  });
});

/** The preset `kodor init --org` writes for acme. */
const PRESET = [
  "# The preset for every acme repository.",
  "version: 1",
  "tickets:",
  "  type: github",
  "  board: 12",
  "  columns:",
  "    backlog: Backlog",
  "    refining: In refinement",
  "    ready: Ready",
  "    building: In progress",
  "    review: In review",
  "    done: Done",
  "pr-review: true",
  "builds:",
  "  trigger: github-action",
  "  poll-minutes: 30",
];

describe("an organization's preset, as its one poller reads it", () => {
  const read = (lines: string[]) =>
    presetSettings(lines.join("\n"), "kodor-preset.yaml", "acme/kodor-config");

  it("takes the ticket system, the board, the Ready column, the labels, and the hourly cap", async () => {
    expect(await read(PRESET)).toEqual({
      board: 12,
      ready: "Ready",
      kodor: "kodor",
      maxPerHour: 20,
      ticketSystem: { type: "github", options: {}, own: true },
    });
  });

  it("reads a preset that leaves settings to its repositories", async () => {
    const left = PRESET.filter((l) => !/trigger|poll-minutes/.test(l));
    expect(
      await read([
        ...left,
        "  poll-minutes: 30",
        "plugins:",
        "  build:",
        "    reviewers:",
        "      - agent: kodor-ui-reviewer",
        "        files: [src/**]",
        "  test:",
        "    reviewers:",
        "      - agent: kodor-e2e-reviewer",
        "        files: [e2e/**]",
        "site:",
        "  accessibility: wcag22aa",
        "specs:",
        "  check: npm run specs",
        "commands:",
        "  coverage:",
        "    run: npm run coverage",
      ]),
    ).toMatchObject({ board: 12, ready: "Ready" });
  });

  it("takes the names and the cap the preset changes", async () => {
    const lines = PRESET.map((l) =>
      l === "    ready: Ready" ? "    ready: Ready for dev" : l,
    );
    lines.splice(
      lines.indexOf("pr-review: true"),
      0,
      "  labels:",
      "    kodor: built-by-factory",
    );
    expect(await read([...lines, "  max-per-hour: 3"])).toMatchObject({
      ready: "Ready for dev",
      kodor: "built-by-factory",
      maxPerHour: 3,
    });
  });

  it.each([
    [
      [...PRESET, "repository: acme/web"],
      "kodor-preset.yaml: repository: a preset can't set this",
    ],
    [
      PRESET.map((l) => (l === "  board: 12" ? "  board: twelve" : l)),
      "kodor-preset.yaml: tickets.board: must be a whole number above zero, or none",
    ],
    [["version: 1", "tickets: ["], /^kodor-preset\.yaml: /],
  ])(
    "refuses a preset no repository could follow, naming the file",
    async (lines, said) => {
      await expect(read(lines)).rejects.toThrow(said);
    },
  );
});

describe("one pass for every repository on an organization's board", () => {
  const TOKEN = "ghs_secret_app";
  const SETTINGS = {
    board: 12,
    ready: "Ready",
    kodor: "kodor",
  };
  const answer = (status: number, body: unknown = {}, statusText = "") =>
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      statusText,
    });
  const UNREACHABLE = {
    data: { repository: null },
    errors: [
      {
        message: "Could not resolve to a Repository with the name 'acme/web'.",
      },
    ],
  };

  /** GitHub as an installation's token sees it: `ready` lists the board's
   * repositories with a ticket in Ready, each of which holds the recorded
   * tickets, with #12 Ready. */
  function org(o: {
    ready: string[] | Response;
    /** What a repository answers a dispatch with, by its name. */
    dispatch?: Record<string, Response>;
    /** The repositories the token cannot read. */
    unreachable?: string[];
    /** Each repository's own `.claude/kodor.yaml` on its default branch,
     * or what GitHub answers in place of it; it has none unless given. */
    own?: Record<string, string | Response>;
    /** Each repository's `.claude/kodor.lock` the same way. */
    lock?: Record<string, string | Response>;
    pages?: { repoPage: unknown; boardPage: unknown };
    settings?: Partial<Parameters<typeof onceEach>[0]>;
    token?: string | null;
    env?: Record<string, string>;
  }) {
    const calls: { url: string; body: string }[] = [];
    const board = structuredClone(
      (o.pages?.boardPage ?? boardPages[0]) as (typeof boardPages)[0],
    );
    const items = board.data.owner.projectV2.items;
    items.nodes = (Array.isArray(o.ready) ? o.ready : []).flatMap((repo) =>
      items.nodes.map((n) => ({
        ...n,
        id: `${n.id}_${repo}`,
        content: { ...n.content, repository: { nameWithOwner: repo } },
      })),
    );
    const fake = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = String(init?.body ?? "");
      calls.push({ url, body });
      const repo = /repos\/([^/]+\/[^/]+)/.exec(url)?.[1] ?? "";
      if (url.endsWith("/graphql")) {
        const { query, variables } = JSON.parse(body);
        if (query.includes("ReadyRepositories"))
          return o.ready instanceof Response
            ? o.ready
            : answer(200, {
                data: {
                  owner: {
                    projectV2: {
                      items: {
                        pageInfo: { hasNextPage: false, endCursor: null },
                        nodes: o.ready.map((r) => ({
                          content: {
                            state: "OPEN",
                            repository: { nameWithOwner: r },
                          },
                          status: { name: "Ready" },
                        })),
                      },
                    },
                  },
                },
              });
        if (query.includes("projectV2")) return answer(200, board);
        return o.unreachable?.includes(`${variables.owner}/${variables.name}`)
          ? answer(200, UNREACHABLE)
          : answer(200, o.pages?.repoPage ?? repoPages[0]);
      }
      const path = /\/contents\/(.+)$/.exec(url)?.[1];
      if (path === ".claude/kodor.yaml" || path === ".claude/kodor.lock") {
        const file = (path === ".claude/kodor.yaml" ? o.own : o.lock)?.[repo];
        if (file instanceof Response) return file.clone();
        return file === undefined
          ? answer(404, { message: "Not Found" }, "Not Found")
          : answer(200, { content: Buffer.from(file).toString("base64") });
      }
      if (url.endsWith("/dispatches"))
        return o.dispatch?.[repo]?.clone() ?? answer(204);
      if (url === `https://api.github.com/repos/${repo}`)
        return answer(200, {
          default_branch: repo === "acme/api" ? "main" : "trunk",
        });
      if (url.includes("blocked_by")) return answer(200, []);
      if (url.endsWith("/comments")) return answer(201, { id: 1 });
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;
    const logs: string[] = [];
    const d: Deps = {
      repository: "acme/kodor-config",
      fetch: fake,
      env: {
        ...(o.token === null ? {} : { KODOR_BOARD_TOKEN: o.token ?? TOKEN }),
        ...o.env,
      },
      now: () => NOW,
      log: (line) => logs.push(line),
      marker: () => "st_0123456789ab",
    };
    const sent = (end: string) =>
      calls
        .filter((c) => c.url.endsWith(end))
        .map((c) => [
          /repos\/([^/]+\/[^/]+)/.exec(c.url)![1],
          JSON.parse(c.body),
        ]);
    return {
      d,
      run: () =>
        onceEach({ ...SETTINGS, ...o.settings }, d, "kodor-preset.yaml"),
      logs,
      calls,
      dispatches: () => sent("/dispatches"),
      comments: () => sent("/comments").map(([repo, c]) => [repo, c.body]),
      readyReads: () =>
        calls
          .filter((c) => c.body.includes("ReadyRepositories"))
          .map((c) => JSON.parse(c.body).variables),
      /** The repositories whose own settings file was asked for. */
      ownReads: () =>
        calls
          .filter((c) => c.url.includes("/contents/"))
          .map((c) => /repos\/(.+)\/contents\/(.+)$/.exec(c.url)!.slice(1, 3)),
      /** The repositories whose tickets were read. */
      ticketReads: () =>
        calls
          .filter((c) => c.body.includes("issues("))
          .map((c) => JSON.parse(c.body).variables)
          .map((v) => `${v.owner}/${v.name}`),
    };
  }
  const build = (ref: string) => ({
    ref,
    inputs: { job: "build", ticket: "12" },
  });
  const STARTED =
    "Starting a build in GitHub Actions: the card moved to Ready.\n\n<!-- work-status: started actions st_0123456789ab -->\n<!-- agent -->";

  it("reads the board once for its repositories, as GITHUB_REPOSITORY's owner's, then starts each one's Ready ticket", async () => {
    const o = org({ ready: ["acme/web", "acme/api"] });

    expect(await o.run()).toBe(0);
    expect(o.readyReads()).toEqual([
      { owner: "acme", number: 12, after: null },
    ]);
    expect(o.comments()).toEqual([
      ["acme/web", STARTED],
      ["acme/api", STARTED],
    ]);
    expect(o.dispatches()).toEqual([
      ["acme/web", build("trunk")],
      ["acme/api", build("main")],
    ]);
    expect(o.logs).toEqual([
      "acme/web: #12 started st_0123456789ab: dispatched kodor.yml",
      "acme/api: #12 started st_0123456789ab: dispatched kodor.yml",
    ]);
  });

  it("starts each build on its own repository's default branch", async () => {
    const o = org({ ready: ["acme/web", "acme/api"] });

    await o.run();

    expect(o.dispatches().map(([repo, sent]) => [repo, sent.ref])).toEqual([
      ["acme/web", "trunk"],
      ["acme/api", "main"],
    ]);
  });

  it("starts nothing, and reads no repository, with no ticket in Ready", async () => {
    const o = org({ ready: [] });

    expect(await o.run()).toBe(0);
    expect(o.calls).toHaveLength(1);
  });

  it("comments that the build could not start in a repository with no kodor.yml, and goes on to the next", async () => {
    const o = org({
      ready: ["acme/web", "acme/api"],
      dispatch: { "acme/web": answer(404, {}, "Not Found") },
    });

    expect(await o.run()).toBe(0);
    expect(o.comments()).toEqual([
      ["acme/web", STARTED],
      [
        "acme/web",
        "Could not start a build in GitHub Actions: GitHub answered 404 (Not Found). The card stays In progress, waiting on you. Move it to Ready to try again.\n\n<!-- work-status: released -->\n<!-- agent -->",
      ],
      ["acme/api", STARTED],
    ]);
    expect(o.dispatches().map(([repo]) => repo)).toEqual([
      "acme/web",
      "acme/api",
    ]);
  });

  it("says which repository the token cannot read, goes on to the next, and still returns 0", async () => {
    const o = org({
      ready: ["acme/web", "acme/api"],
      unreachable: ["acme/web"],
    });

    expect(await o.run()).toBe(0);
    expect(o.logs).toEqual([
      "acme/web: read failed (1 in a row): Error: GitHub graphql: Could not resolve to a Repository with the name 'acme/web'.",
      "acme/api: #12 started st_0123456789ab: dispatched kodor.yml",
    ]);
    expect(o.dispatches()).toEqual([["acme/api", build("main")]]);
  });

  it("marks that repository's line as a warning in a workflow's run, and no other line", async () => {
    const o = org({
      ready: ["acme/web", "acme/api"],
      unreachable: ["acme/web"],
      env: { GITHUB_ACTIONS: "true" },
    });

    expect(await o.run()).toBe(0);
    expect(o.logs).toEqual([
      "::warning::acme/web: read failed (1 in a row): Error: GitHub graphql: Could not resolve to a Repository with the name 'acme/web'.",
      "acme/api: #12 started st_0123456789ab: dispatched kodor.yml",
    ]);
  });

  const OWN = (trigger: string | null, presets = ["acme/kodor-config"]) =>
    [
      "version: 1",
      "repository: acme/web",
      ...(presets.length
        ? ["presets:", ...presets.map((p) => `  - ${p}`)]
        : []),
      ...(trigger === null ? [] : ["builds:", `  trigger: ${trigger}`]),
      "",
    ].join("\n");
  /** A lock as `kodor sync` writes it, pinning `presets` and recording
   * the settings in effect, or, with a null trigger, none, as a lock from
   * an earlier release does. */
  const LOCK = (presets: string[], trigger: string | null) =>
    [
      "version: 0.0.0-development",
      ...(presets.length
        ? [
            "presets:",
            ...presets.flatMap((p) => [
              `  - name: ${p}`,
              "    commit: 3f9c2e1",
              "    settings: {}",
            ]),
          ]
        : ["presets: []"]),
      ...(trigger === null
        ? []
        : ["settings:", "  builds:", `    trigger: ${trigger}`]),
      "",
    ].join("\n");
  const STARTED_API =
    "acme/api: #12 started st_0123456789ab: dispatched kodor.yml";

  describe("a repository whose own settings file sets builds.trigger", () => {
    it.each(["manual", "own-server"])(
      "is left alone when the file itself says %s, whatever the preset it follows says, and the next repository is polled",
      async (trigger) => {
        const o = org({
          ready: ["acme/web", "acme/api"],
          own: { "acme/web": OWN(trigger) },
        });

        expect(await o.run()).toBe(0);
        expect(o.logs).toEqual([
          `acme/web: builds.trigger is ${trigger} there, so its tickets are left`,
          STARTED_API,
        ]);
        expect(o.ticketReads()).toEqual(["acme/api"]);
        expect(o.dispatches().map(([repo]) => repo)).toEqual(["acme/api"]);
      },
    );

    it("prints that line with no warning mark in a workflow's run: it is what the repository asked for", async () => {
      const o = org({
        ready: ["acme/web"],
        own: { "acme/web": OWN("manual") },
        env: { GITHUB_ACTIONS: "true" },
      });

      await o.run();

      expect(o.logs).toEqual([
        "acme/web: builds.trigger is manual there, so its tickets are left",
      ]);
    });

    it.each<[string, string | Response | undefined]>([
      ["the file itself says github-action", OWN("github-action")],
      ["the default branch has no such file", undefined],
      ["the file cannot be read", answer(500, { message: "Server Error" })],
      ["the file is not YAML", "builds: ["],
    ])("is polled when %s, and its lock is not read", async (_, file) => {
      const o = org({
        ready: ["acme/web"],
        own: file === undefined ? {} : { "acme/web": file },
        lock: { "acme/web": LOCK(["acme/kodor-config"], "manual") },
      });

      expect(await o.run()).toBe(0);
      expect(o.ownReads()).toEqual([["acme/web", ".claude/kodor.yaml"]]);
      expect(o.dispatches()).toEqual([["acme/web", build("trunk")]]);
      expect(o.calls.map((c) => c.url)).not.toContainEqual(
        expect.stringContaining("kodor-config/contents"),
      );
    });
  });

  describe("a repository whose own settings file sets no builds.trigger", () => {
    const READS = [
      ["acme/web", ".claude/kodor.yaml"],
      ["acme/web", ".claude/kodor.lock"],
    ];

    it.each<[string, string[], string]>([
      ["a preset it follows says manual", ["acme/kodor-config"], "manual"],
      [
        "a preset it follows says own-server",
        ["acme/kodor-config"],
        "own-server",
      ],
      [
        "two presets disagree and the choice it recorded says own-server",
        ["acme/kodor-config", "acme/kodor-config//node"],
        "own-server",
      ],
    ])(
      "is left when %s, as the settings in effect its lock records",
      async (_, presets, trigger) => {
        const o = org({
          ready: ["acme/web", "acme/api"],
          own: { "acme/web": OWN(null, presets) },
          lock: { "acme/web": LOCK(presets, trigger) },
        });

        expect(await o.run()).toBe(0);
        expect(o.logs).toEqual([
          `acme/web: builds.trigger is ${trigger} there, so its tickets are left`,
          STARTED_API,
        ]);
        expect(o.ownReads().filter(([repo]) => repo === "acme/web")).toEqual(
          READS,
        );
        expect(o.dispatches().map(([repo]) => repo)).toEqual(["acme/api"]);
      },
    );

    it("is left as manual, the default, when it follows no preset", async () => {
      const o = org({
        ready: ["acme/web"],
        own: { "acme/web": OWN(null, []) },
        lock: { "acme/web": LOCK([], "manual") },
        env: { GITHUB_ACTIONS: "true" },
      });

      expect(await o.run()).toBe(0);
      expect(o.logs).toEqual([
        "acme/web: builds.trigger is manual there, so its tickets are left",
      ]);
      expect(o.dispatches()).toEqual([]);
    });

    it("is polled when a preset it follows says github-action", async () => {
      const o = org({
        ready: ["acme/web"],
        own: { "acme/web": OWN(null) },
        lock: { "acme/web": LOCK(["acme/kodor-config"], "github-action") },
      });

      expect(await o.run()).toBe(0);
      expect(o.ownReads()).toEqual(READS);
      expect(o.dispatches()).toEqual([["acme/web", build("trunk")]]);
    });

    it.each<[string, string | Response | undefined]>([
      ["the default branch has no lock", undefined],
      ["the lock cannot be read", answer(500, { message: "Server Error" })],
      ["the lock is not YAML", "settings: ["],
      [
        "the lock is from a release that recorded no settings",
        LOCK(["acme/kodor-config"], null),
      ],
      ["the lock does not pin a preset the file lists", LOCK([], "manual")],
    ])("is polled when %s", async (_, lock) => {
      const o = org({
        ready: ["acme/web"],
        own: { "acme/web": OWN(null) },
        lock: lock === undefined ? {} : { "acme/web": lock },
      });

      expect(await o.run()).toBe(0);
      expect(o.ownReads()).toEqual(READS);
      expect(o.dispatches()).toEqual([["acme/web", build("trunk")]]);
    });
  });

  it("counts the hourly cap for each repository on its own", async () => {
    const o = org({
      ready: ["acme/web", "acme/api"],
      pages: withStarts({ ready: 2, started: 0, minutesAgo: 0 }),
      settings: { maxPerHour: 1 },
    });

    await o.run();

    expect(o.dispatches().map(([repo]) => repo)).toEqual([
      "acme/web",
      "acme/api",
    ]);
  });

  it("returns 1, saying why, when the board cannot be read", async () => {
    const o = org({ ready: answer(502) });

    expect(await o.run()).toBe(1);
    expect(o.logs).toHaveLength(1);
    expect(o.logs[0]).toMatch(/^read failed: /);
  });

  it("returns 1, naming the token, when KODOR_BOARD_TOKEN is not set", async () => {
    const o = org({ ready: ["acme/web"], token: null });

    expect(await o.run()).toBe(1);
    expect(o.logs).toEqual(["not polling: KODOR_BOARD_TOKEN not set"]);
    expect(o.calls).toEqual([]);
  });

  it.each([
    [
      { board: null },
      "No board to read: tickets.board is not set in kodor-preset.yaml.",
    ],
    [
      { ready: null },
      "No card can start a build: the Ready column is none in kodor-preset.yaml.",
    ],
  ])(
    "returns 1 and reads nothing when the preset gives it nothing to poll",
    async (settings, said) => {
      const o = org({ ready: ["acme/web"], settings });

      expect(await o.run()).toBe(1);
      expect(o.calls).toEqual([]);
      expect(o.logs).toEqual([said]);
    },
  );

  describe("kodor poller --once --preset FILE", () => {
    const from = (
      o: ReturnType<typeof org>,
      env: Record<string, string>,
      read: (path: string) => string = () => PRESET.join("\n"),
    ) => {
      const { repository: _, ...rest } = o.d;
      return oncePreset(
        "kodor-preset.yaml",
        { ...rest, env: { ...rest.env, ...env } },
        read,
      );
    };
    const RUN = { GITHUB_REPOSITORY: "acme/kodor-config" };

    it("reads the board the file names, owned by GITHUB_REPOSITORY's owner, and starts its repositories' tickets", async () => {
      const o = org({ ready: ["acme/web"] });

      expect(await from(o, RUN)).toBe(0);
      expect(o.readyReads()).toEqual([
        { owner: "acme", number: 12, after: null },
      ]);
      expect(o.dispatches()).toEqual([["acme/web", build("trunk")]]);
    });

    it("stops, reading nothing, outside a workflow's run", async () => {
      const o = org({ ready: ["acme/web"] });

      expect(await from(o, {})).toBe(1);
      expect(o.logs).toEqual([
        "GITHUB_REPOSITORY is not set, so no owner's board can be read. Run this in a workflow of the repository that holds kodor-preset.yaml.",
      ]);
      expect(o.calls).toEqual([]);
    });

    it("stops with what is wrong with the file, reading nothing", async () => {
      const o = org({ ready: ["acme/web"] });

      expect(await from(o, RUN, () => "version: 2\n")).toBe(1);
      expect(
        await from(o, RUN, () => {
          throw new Error("ENOENT: no such file or directory");
        }),
      ).toBe(1);
      expect(o.logs).toEqual([
        "kodor-preset.yaml: version: must be 1: this file is version 2, see https://github.com/kodor-ai/kodor/blob/main/docs/maintain/upgrade-notes.md#moving-to-kodor",
        "kodor-preset.yaml could not be read: ENOENT: no such file or directory",
      ]);
      expect(o.calls).toEqual([]);
    });
  });
});
