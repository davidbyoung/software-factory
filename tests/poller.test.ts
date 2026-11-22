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
  onceSettings,
  readConfig,
  sources,
  selectToStart,
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
import { FACTORY_COLUMNS } from "./factory-columns";
import { CODE_HOST } from "./settings-fixture";
import { builtOf, TOOLS } from "../src/tools.mts";
import { memoryTickets } from "./memory-tickets";
import { FAKE_EMAIL, FAKE_TOKEN, withFakeTickets } from "./fake-tools";

const NOW = Date.parse("2026-11-09T10:00:00Z");
const ENV = {
  FACTORY_BOARD_OWNER: "acme",
  FACTORY_BOARD_NUMBER: "1",
  FACTORY_BOARD_TOKEN: "ghp_secret_github",
  FACTORY_READY_COLUMN: "Ready",
};
const DISPATCH =
  "https://api.github.com/repos/acme/widgets/actions/workflows/factory-build.yml/dispatches";

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
        { projectId: "P", fields: [], items: new Map(keys.map(card)) },
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
    expect(readConfig({ FACTORY_BOARD_OWNER: "x" })).toEqual({
      missing: [
        "FACTORY_BOARD_NUMBER",
        "FACTORY_BOARD_TOKEN",
        "FACTORY_READY_COLUMN",
      ],
    });
  });

  it("counts a ready column of only spaces as missing", () => {
    expect(
      readConfig({
        FACTORY_BOARD_OWNER: "x",
        FACTORY_BOARD_NUMBER: "1",
        FACTORY_BOARD_TOKEN: "t",
        FACTORY_READY_COLUMN: "  ",
      }),
    ).toEqual({ missing: ["FACTORY_READY_COLUMN"] });
  });

  it("needs neither trigger variable", () => {
    expect(
      readConfig({
        FACTORY_BOARD_OWNER: "x",
        FACTORY_BOARD_NUMBER: "1",
        FACTORY_BOARD_TOKEN: "t",
        FACTORY_READY_COLUMN: "Ready",
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
      Authorization: `Bearer ${ENV.FACTORY_BOARD_TOKEN}`,
      "User-Agent": "ready-poller",
    });
  });

  it("posts the start comment, then dispatches the build on the default branch", async () => {
    const { d, state, calls, comments, dispatches } = setup({});

    await tick(d, state);

    expect(comments()).toEqual([
      "Starting a build in GitHub Actions: the card moved to Ready.\n\n<!-- work-status: started actions st_0123456789ab -->\n<!-- agent -->",
    ]);
    expect(dispatches()).toEqual([{ ref: "trunk", inputs: { ticket: "12" } }]);
    const order = calls.map((c) =>
      c.url === DISPATCH ? "dispatch" : c.url.split("/").at(-1),
    );
    expect(order.slice(-2)).toEqual(["comments", "dispatch"]);
  });

  it("starts no card in a column other than the one FACTORY_READY_COLUMN names", async () => {
    const { d, state, comments, dispatches } = setup(
      {},
      { ...ENV, FACTORY_READY_COLUMN: "Ready for dev" },
    );

    await tick(d, state);

    expect(dispatches()).toEqual([]);
    expect(comments()).toEqual([]);
  });

  it("starts a card in the column FACTORY_READY_COLUMN names, and its comment names that column", async () => {
    const renamed = JSON.parse(
      JSON.stringify(boardPages[0]).replaceAll(
        '"name":"Ready"',
        '"name":"Ready for dev"',
      ),
    );
    const { d, state, comments, dispatches } = setup(
      { boardPage: renamed },
      { ...ENV, FACTORY_READY_COLUMN: "Ready for dev" },
    );

    await tick(d, state);

    expect(dispatches()).toEqual([{ ref: "trunk", inputs: { ticket: "12" } }]);
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
    const { d, state, calls, logs } = setup(
      {},
      { FACTORY_BOARD_OWNER: "acme" },
    );

    await tick(d, state);

    expect(calls).toEqual([]);
    expect(logs[0]).toMatch(
      /^not polling: FACTORY_BOARD_NUMBER, FACTORY_BOARD_TOKEN, FACTORY_READY_COLUMN not set/,
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

describe("onceSettings", () => {
  const read = (raw: Record<string, unknown>) =>
    onceSettings(
      parseSettings(
        {
          version: 2,
          repository: "acme/widgets",
          "code-host": CODE_HOST,
          ...raw,
        },
        () => true,
      ),
    );

  it("takes the board and the Ready column from the settings", () => {
    expect(read({ tickets: { board: 7, columns: FACTORY_COLUMNS } })).toEqual({
      board: 7,
      ready: "Ready",
      followUp: "follow-up",
      factory: "factory",
      maxPerHour: 20,
      ticketSystem: { type: "github", options: {}, own: true },
    });
  });

  it("takes the ticket system the settings name, whose links are not the code host's own", () => {
    const tools = withFakeTickets(TOOLS, memoryTickets([]).tickets);
    const s = parseSettings(
      {
        version: 2,
        repository: "acme/widgets",
        "code-host": CODE_HOST,
        tickets: {
          type: "fake",
          site: "acme.example",
          board: 7,
          columns: FACTORY_COLUMNS,
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

  it("takes the follow-ups label the settings rename", () => {
    expect(
      read({
        tickets: {
          board: 7,
          columns: FACTORY_COLUMNS,
          labels: { "follow-up": "follow-ups" },
        },
      }).followUp,
    ).toBe("follow-ups");
  });

  it("takes a Ready column the settings rename", () => {
    expect(
      read({
        tickets: {
          board: 7,
          columns: { ...FACTORY_COLUMNS, ready: "Ready for dev" },
        },
      }),
    ).toMatchObject({
      board: 7,
      ready: "Ready for dev",
      followUp: "follow-up",
    });
  });

  it("has no board when the settings name none", () => {
    expect(read({}).board).toBeNull();
  });

  it("has no Ready column when the settings set it to none", () => {
    expect(
      read({
        tickets: { board: 7, columns: { ...FACTORY_COLUMNS, ready: "none" } },
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
      "read failed (1 in a row): No Fake Tickets credential for acme.example. Set FAKE_TICKETS_EMAIL and FAKE_TICKETS_TOKEN, or run: factory init",
    ]);
    expect(state.failuresInARow).toBe(1);
  });
});

describe("once", () => {
  const TOKEN = { FACTORY_BOARD_TOKEN: ENV.FACTORY_BOARD_TOKEN };
  const settings = {
    board: 1,
    ready: "Ready",
    followUp: "follow-up",
    factory: "factory",
  };

  it("starts each Ready ticket and returns 0", async () => {
    const { d, dispatches } = setup({}, TOKEN);

    expect(await once(settings, d)).toBe(0);
    expect(dispatches()).toEqual([{ ref: "trunk", inputs: { ticket: "12" } }]);
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

  it("starts no build of the follow-ups ticket, by its configured name, while a pull request builds part of it", async () => {
    const repo = structuredClone(repoPages[0]);
    const r = repo.data.repository;
    r.open.nodes.find((n) => n.number === 12)!.labels.nodes = [
      { name: "follow-ups" },
    ] as never;
    r.pullRequests.nodes.push({
      ...structuredClone(r.pullRequests.nodes[0]!),
      number: 42,
      body: "Part of #12: its first line.",
      closingIssuesReferences: { nodes: [] },
    });
    const { d, dispatches } = setup({ repoPage: repo }, TOKEN);

    await once({ ...settings, followUp: "follow-ups" }, d);

    expect(dispatches()).toEqual([]);
  });

  it("returns 1, saying why, when it cannot read the board", async () => {
    const { d, logs } = setup({ graphql: { status: 502 } }, TOKEN);

    expect(await once(settings, d)).toBe(1);
    expect(logs[0]).toMatch(/^read failed/);
  });

  it("returns 1, naming the token, when FACTORY_BOARD_TOKEN is not set", async () => {
    const { d, logs } = setup({}, {});

    expect(await once(settings, d)).toBe(1);
    expect(logs).toContain("not polling: FACTORY_BOARD_TOKEN not set");
  });

  it.each([
    [
      { board: null, ready: "Ready" },
      "No board to read: tickets.board is not set in .claude/factory.yaml.",
    ],
    [
      { board: 1, ready: null },
      "No card can start a build: the Ready column is none in .claude/factory.yaml.",
    ],
  ])(
    "returns 1 and reads nothing when the settings give it nothing to poll",
    async (given, said) => {
      const { d, calls, logs } = setup({}, TOKEN);

      expect(
        await once({ ...given, followUp: "follow-up", factory: "factory" }, d),
      ).toBe(1);
      expect(calls).toEqual([]);
      expect(logs).toEqual([said]);
    },
  );
});

describe("the poller's start", () => {
  it("exits with a message naming FACTORY_REPOSITORY when it is not set", () => {
    const env = { ...process.env };
    delete env.FACTORY_REPOSITORY;
    const r = spawnSync("node", ["src/poller.mts"], {
      env,
      encoding: "utf8",
      timeout: 5000,
    });

    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toContain("FACTORY_REPOSITORY is not set");
  });
});

describe("poller.Dockerfile", () => {
  const file = readFileSync("poller.Dockerfile", "utf8");
  const name = JSON.parse(readFileSync("package.json", "utf8")).name as string;

  it("installs the factory's published version the build names, without its dev tools", () => {
    expect(file).toMatch(/^ARG VERSION$/m);
    expect(file).toContain(`npm install --omit=dev`);
    expect(file).toContain(`"${name}@\${VERSION}"`);
  });

  it("names this repository as its source, so Dependabot can read its versions", () => {
    expect(file).toMatch(
      /^LABEL org\.opencontainers\.image\.source="https:\/\/github\.com\/davidbyoung\/software-factory"$/m,
    );
  });

  it("runs the installed poller as an unprivileged user", () => {
    expect(file).toMatch(/^USER node$/m);
    expect(file).toMatch(
      new RegExp(
        `^CMD \\["node", "node_modules/${name.replace("/", "\\/")}/bin/factory\\.js", "poller"\\]$`,
        "m",
      ),
    );
  });
});

describe("tickets without the factory label", () => {
  /** The recorded pages with the factory label taken off ticket 12. */
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
        node.labels.nodes = node.labels.nodes.filter(
          (l) => l.name !== "factory",
        );
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

  it("finds the label by the name FACTORY_LABEL gives it", async () => {
    const renamed = JSON.parse(
      JSON.stringify(repoPages[0]).replaceAll(
        '{"name":"factory"}',
        '{"name":"built-by-factory"}',
      ),
    );
    const { d, state, dispatches } = setup(
      { repoPage: renamed },
      { ...ENV, FACTORY_LABEL: "built-by-factory" },
    );

    await tick(d, state);

    expect(dispatches()).toEqual([{ ref: "trunk", inputs: { ticket: "12" } }]);
  });
});

describe("the hourly cap's setting", () => {
  it("starts no more than FACTORY_MAX_PER_HOUR says", async () => {
    const { d, state, dispatches, logs } = setup(
      withStarts({ ready: 5, started: 0, minutesAgo: 0 }),
      { ...ENV, FACTORY_MAX_PER_HOUR: "2" },
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
    "polls nothing with FACTORY_MAX_PER_HOUR %s, and says why",
    async (max) => {
      const { d, state, calls, logs } = setup(
        {},
        {
          ...ENV,
          FACTORY_MAX_PER_HOUR: max,
        },
      );

      await tick(d, state);

      expect(calls).toEqual([]);
      expect(logs).toEqual([
        "not polling: FACTORY_MAX_PER_HOUR must be a whole number, 1 or more",
      ]);
    },
  );

  it("passes builds.max-per-hour to a scheduled pass", async () => {
    const { d, dispatches } = setup(
      withStarts({ ready: 5, started: 0, minutesAgo: 0 }),
      { FACTORY_BOARD_TOKEN: ENV.FACTORY_BOARD_TOKEN },
    );

    await once(
      {
        board: 1,
        ready: "Ready",
        followUp: "follow-up",
        factory: "factory",
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
