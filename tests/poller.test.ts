import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FIRE_LIMIT,
  capAllows,
  dispatchFailure,
  nextDelay,
  readConfig,
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
} from "../src/lib/work-status.mts";
import { HttpError } from "../src/tickets/transport.mts";
import { toBoard } from "../src/tickets/github.mts";
import saved from "./fixtures/sync/repo.json";
// The same repository as GitHub's GraphQL answers it, for the fake fetch.
import repoPages from "./fixtures/sync/repo-graphql.json";
import boardPages from "./fixtures/sync/board.json";

const NOW = Date.parse("2026-11-09T10:00:00Z");
const ENV = {
  FACTORY_BOARD_OWNER: "acme",
  FACTORY_BOARD_NUMBER: "1",
  FACTORY_BOARD_TOKEN: "ghp_secret_github",
};
const DISPATCH =
  "https://api.github.com/repos/acme/widgets/actions/workflows/factory-build.yml/dispatches";

describe("selectToStart", () => {
  it("takes only the cards the derivation puts in Ready", () => {
    // #12 moved to Ready after its refinement; #13's Ready predates a failed
    // fire, and #14's start already counts.
    expect(
      selectToStart(
        toSnapshot(saved.tickets as never, saved.pulls, new Date(NOW)),
        toBoard(boardPages as never, "acme/widgets"),
      ),
    ).toEqual([12]);
  });

  it("does not start a card again after its start failed to fire, until the owner moves it", () => {
    const fireFailed = commentBody({
      kind: "dispatch-failed",
      issue: 7,
      status: "401",
      reason: "Unauthorized",
    });
    const comment = (id: number, minute: number, body: string) => ({
      id,
      createdAt: `2026-11-09T09:0${minute}:00Z`,
      author: "acme",
      body,
    });
    const snapshot = {
      issues: [
        {
          number: 30,
          title: "A failed start",
          state: "open" as const,
          closedAt: null,
          labels: [],
          comments: [
            comment(1, 2, commentBody({ kind: "started", marker: "st_1" })),
            comment(2, 3, fireFailed),
          ],
        },
      ],
      pulls: [],
    };
    const board = (updatedAt: string): Board => ({
      projectId: "P",
      fields: [],
      items: new Map([
        [
          30,
          {
            itemId: "IT30",
            number: 30,
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
      30,
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
      missing: ["FACTORY_BOARD_NUMBER", "FACTORY_BOARD_TOKEN"],
    });
  });

  it("needs neither trigger variable", () => {
    expect(
      readConfig({
        FACTORY_BOARD_OWNER: "x",
        FACTORY_BOARD_NUMBER: "1",
        FACTORY_BOARD_TOKEN: "t",
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
          : repoPages[0],
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
  const state: State = { fired: [], failuresInARow: 0, lastHeartbeat: NOW };
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
    expect(state.fired).toEqual([NOW]);
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

  it("fires nothing once twenty builds started in the hour", async () => {
    const { d, state, comments, logs } = setup({});
    state.fired = Array.from({ length: FIRE_LIMIT }, () => NOW - 60_000);

    await tick(d, state);

    expect(comments()).toEqual([]);
    expect(logs).toContain("#12 waits: 20 builds started in the last hour");
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
      /^not polling: FACTORY_BOARD_NUMBER, FACTORY_BOARD_TOKEN/,
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
  /** The poller and every file it imports, directly or through another, by
   * relative path. */
  function imported(file: string, seen = new Set<string>()): Set<string> {
    seen.add(file);
    const src = readFileSync(file, "utf8");
    for (const [, spec] of src.matchAll(/from\s+"(\.{1,2}\/[^"]+)"/g)) {
      const next = join(dirname(file), spec);
      if (!seen.has(next)) imported(next, seen);
    }
    return seen;
  }

  it("copies the poller and every file it imports", () => {
    const copied = readFileSync("poller.Dockerfile", "utf8")
      .split("\n")
      .filter((line) => /^COPY\s/.test(line))
      .map((line) => line.split(/\s+/)[1]);

    const missing = [...imported("src/poller.mts")].filter(
      (f) => !copied.includes(f),
    );
    expect(missing).toEqual([]);
  });
});
