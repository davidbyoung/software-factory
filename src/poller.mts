#!/usr/bin/env node
// Start a build in GitHub Actions for each card the owner moves to Ready. A board owned
// by a user account sends no event, so this reads it once a minute. It runs
// as a worker on a server the repository's owner hosts, or, with `--once`,
// as one pass of a scheduled workflow, which reads the board and the Ready
// column from the settings in its checkout and needs only the token.
//
// Hosted, its environment: FACTORY_REPOSITORY (owner/name), FACTORY_BOARD_OWNER,
// FACTORY_BOARD_NUMBER, and FACTORY_BOARD_TOKEN (a classic token with the
// repo and project scopes, or a fine-grained one that can also write
// Actions: it starts the workflow). It has no checkout, so it reads
// the repository from its environment rather than the factory's settings.
//
// Once started it never exits on its own: a host that deploys every
// component together can fail the whole deploy when a worker exits during
// a rollout. The one exit is at start, with no repository to read.
//
// It names its implementations itself, having no settings to name them:
// the GitHub ticket adapter, GitHub as the code host, and GitHub Actions as
// the runner, each over the `fetch` transport, since it runs with no `gh`.
import { randomBytes } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import {
  DEFAULT_COLUMNS,
  cardOf,
  type Columns,
  commentBody,
  derive,
  markedComments,
  toSnapshot,
  type Board,
  type RepoSnapshot,
} from "./lib/work-status.mts";
import { githubCodeHost } from "./code-host/github.mts";
import type { CodeHost } from "./code-host/types.mts";
import {
  BUILD_WORKFLOW,
  githubActionsRunner,
} from "./runner/github-actions.mts";
import type { Runner } from "./runner/types.mts";
import { githubTickets } from "./tickets/github.mts";
import { HttpError, fetchTransport, statusOf } from "./tickets/transport.mts";
import { boardOf, type Tickets } from "./tickets/types.mts";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
export const FIRE_LIMIT = 20;
const FIRE_TIMEOUT_MS = 30_000;

/** The open issues the shared derivation puts in Ready, oldest number first. */
export function selectToStart(
  snapshot: RepoSnapshot,
  board: Board,
  columns: Columns = DEFAULT_COLUMNS,
): number[] {
  return snapshot.issues
    .filter(
      (issue) =>
        issue.state === "open" &&
        derive(
          issue,
          cardOf(board, issue.number, columns),
          snapshot.pulls,
          columns,
        ).status === "Ready",
    )
    .map((issue) => issue.number)
    .sort((a, b) => a - b);
}

export function startMarker(): string {
  return `st_${randomBytes(6).toString("hex")}`;
}

/** The columns the poller reads a board by. It runs with no settings file,
 * so it is told the one name it needs, the column that approves a build:
 * FACTORY_READY_COLUMN, which defaults to Ready. */
export function columnsFrom(env: Record<string, string | undefined>): Columns {
  return {
    ...DEFAULT_COLUMNS,
    Ready: env.FACTORY_READY_COLUMN?.trim() || "Ready",
  };
}

/** What a refused dispatch's comment says GitHub answered: the status, and
 * the answer's message or else the status text. */
export function dispatchFailure(error: unknown): {
  status: string;
  reason: string;
} {
  if (error instanceof HttpError)
    return {
      status: String(error.status),
      reason: error.reason || "no reason given",
    };
  const status = statusOf(error);
  return {
    status: status === null ? "nothing" : String(status),
    reason: error instanceof Error ? error.message : String(error),
  };
}

/** When each build started in the past hour went out, read from the start
 * comments on the tickets, so the count holds across a scheduled run and a
 * restart, neither of which keeps it in memory. */
export function recentStarts(issues: RepoSnapshot["issues"], now: number) {
  return issues
    .flatMap((issue) => markedComments(issue.comments))
    .filter((m) => m.marker.kind === "started")
    .map((m) => Date.parse(m.createdAt))
    .filter((at) => now - at < HOUR);
}

/** Whether another fire fits in the rolling hour, given when the recent ones
 * went out. */
export function capAllows(fired: number[], now: number): boolean {
  return fired.filter((at) => now - at < HOUR).length < FIRE_LIMIT;
}

/** A minute between reads, and ten once ten in a row have failed. */
export function nextDelay(failuresInARow: number): number {
  return failuresInARow >= 10 ? 10 * MINUTE : MINUTE;
}

export type Config = {
  owner: string;
  number: number;
  githubToken: string;
};

export function readConfig(
  env: Record<string, string | undefined>,
): Config | { missing: string[] } {
  const names = [
    "FACTORY_BOARD_OWNER",
    "FACTORY_BOARD_NUMBER",
    "FACTORY_BOARD_TOKEN",
  ];
  const missing = names.filter((name) => !env[name]);
  if (missing.length) return { missing };
  return {
    owner: env.FACTORY_BOARD_OWNER!,
    number: Number(env.FACTORY_BOARD_NUMBER),
    githubToken: env.FACTORY_BOARD_TOKEN!,
  };
}

export type State = {
  failuresInARow: number;
  lastHeartbeat: number;
};

export type Deps = {
  /** The repository whose issues it starts, as owner/name. */
  repository: string;
  fetch: typeof fetch;
  env: Record<string, string | undefined>;
  now: () => number;
  log: (line: string) => void;
  marker: () => string;
  /** The repository's default branch, read from GitHub once the poller is
   * running; a dispatch runs on it. */
  defaultBranch?: string;
};

/** The ticket system, the code host, and the runner, over the `fetch`
 * transport. */
export function sources(d: Deps, c: Config) {
  const transport = fetchTransport({
    token: c.githubToken,
    fetch: d.fetch,
    timeoutMs: FIRE_TIMEOUT_MS,
    userAgent: "ready-poller",
  });
  return {
    tickets: githubTickets({
      transport,
      repository: d.repository,
      board: c.number,
      boardOwner: c.owner,
    }),
    codeHost: githubCodeHost({ transport, repository: d.repository }),
    runner: githubActionsRunner({ transport, repository: d.repository }),
  };
}

async function readAll(tickets: Tickets, codeHost: CodeHost, d: Deps) {
  const [read, open] = await Promise.all([
    tickets.readAll!({ board: true }),
    codeHost.open(),
  ]);
  return {
    snapshot: toSnapshot(read, open, new Date(d.now())),
    board: boardOf(read),
  };
}

/** Start a build of one ticket on the default branch. */
async function dispatch(
  runner: Runner,
  branch: string,
  issue: number,
): Promise<{ ok: true } | { ok: false; status: string; reason: string }> {
  try {
    await runner.startBuild(issue, branch);
    return { ok: true };
  } catch (error) {
    return { ok: false, ...dispatchFailure(error) };
  }
}

/** One minute's work. It never throws: every failure is logged, and a failed
 * read counts toward the slower retry. */
export async function tick(d: Deps, state: State): Promise<void> {
  const config = readConfig(d.env);
  if ("missing" in config) {
    d.log(`not polling: ${config.missing.join(", ")} not set`);
    state.failuresInARow += 1;
    return;
  }
  const { tickets, codeHost, runner } = sources(d, config);
  let read;
  try {
    read = await readAll(tickets, codeHost, d);
    state.failuresInARow = 0;
  } catch (error) {
    state.failuresInARow += 1;
    d.log(`read failed (${state.failuresInARow} in a row): ${String(error)}`);
    return;
  }

  if (!d.defaultBranch) {
    try {
      d.defaultBranch = await codeHost.defaultBranch();
    } catch (error) {
      state.failuresInARow += 1;
      d.log(`default branch not read: ${String(error)}`);
      return;
    }
  }

  const columns = columnsFrom(d.env);
  const ready = selectToStart(read.snapshot, read.board, columns);
  // This pass's own start comments are not in what it read, so it adds them.
  const fired = recentStarts(read.snapshot.issues, d.now());
  if (d.now() - state.lastHeartbeat >= HOUR) {
    d.log(
      `heartbeat: ${ready.length} Ready card${ready.length === 1 ? "" : "s"}`,
    );
    state.lastHeartbeat = d.now();
  }

  for (const issue of ready) {
    try {
      const blockers = await tickets.blockers!.list(issue);
      const open = blockers.filter((b) => b.state === "open");
      if (open.length) {
        d.log(
          `#${issue} waits on ${open.map((b) => `#${b.number}`).join(", ")}`,
        );
        continue;
      }
    } catch (error) {
      d.log(
        `#${issue} skipped: its blockers could not be read (${String(error)})`,
      );
      continue;
    }
    if (!capAllows(fired, d.now())) {
      d.log(`#${issue} waits: ${FIRE_LIMIT} builds started in the last hour`);
      continue;
    }

    const marker = d.marker();
    try {
      await tickets.comment(
        issue,
        commentBody({ kind: "started", marker }, columns),
      );
    } catch (error) {
      d.log(
        `#${issue} not started: the start comment failed (${String(error)})`,
      );
      continue;
    }
    fired.push(d.now());
    const outcome = await dispatch(runner, d.defaultBranch, issue);
    if (outcome.ok) {
      d.log(`#${issue} started ${marker}: dispatched ${BUILD_WORKFLOW}`);
      continue;
    }
    d.log(`#${issue} dispatch failed: ${outcome.status} (${outcome.reason})`);
    try {
      await tickets.comment(
        issue,
        commentBody(
          {
            kind: "dispatch-failed",
            issue,
            status: outcome.status,
            reason: outcome.reason,
          },
          columns,
        ),
      );
    } catch (error) {
      d.log(`#${issue} dispatch-failure comment failed (${String(error)})`);
    }
  }
}

/** What one scheduled pass reads from the settings: the board's number,
 * and the column that approves a build, each null when the settings have
 * none. */
export type OnceSettings = { board: number | null; ready: string | null };

/** One pass, for a scheduled run: the board and the Ready column come from
 * the settings, the board's owner is the repository's, and only the token
 * comes from the environment. 1 when it read nothing or could not read. */
export async function once(s: OnceSettings, d: Deps): Promise<number> {
  if (s.board === null) {
    d.log(
      "No board to read: tickets.board is not set in .claude/factory.yaml.",
    );
    return 1;
  }
  if (s.ready === null) {
    d.log(
      "No card can start a build: the Ready column is none in .claude/factory.yaml.",
    );
    return 1;
  }
  const env = {
    ...d.env,
    FACTORY_BOARD_OWNER: d.repository.split("/")[0],
    FACTORY_BOARD_NUMBER: String(s.board),
    FACTORY_READY_COLUMN: s.ready,
  };
  const state: State = { failuresInARow: 0, lastHeartbeat: d.now() };
  await tick({ ...d, env }, state);
  return state.failuresInARow > 0 ? 1 : 0;
}

/** The parts of the dependencies that are the same however it runs. */
function liveDeps(repository: string): Deps {
  return {
    repository,
    fetch,
    env: process.env,
    now: () => Date.now(),
    log: (line) => console.log(`${new Date().toISOString()} ${line}`),
    marker: startMarker,
  };
}

async function main(): Promise<number> {
  const repository = process.env.FACTORY_REPOSITORY;
  if (!repository) {
    console.error(
      "ready-poller not started: FACTORY_REPOSITORY is not set. Set it to the repository, as owner/name.",
    );
    return 1;
  }
  const state: State = { failuresInARow: 0, lastHeartbeat: 0 };
  const d = liveDeps(repository);
  process.on("unhandledRejection", (error) =>
    d.log(`unhandled: ${String(error)}`),
  );
  d.log("ready-poller started");
  for (;;) {
    try {
      await tick(d, state);
    } catch (error) {
      d.log(`tick failed: ${String(error)}`);
    }
    await sleep(nextDelay(state.failuresInARow));
  }
}

/** `factory poller`, and `factory poller --once`. The settings are loaded
 * only for `--once`, so the hosted poller, which has no checkout, needs none. */
export async function run(argv: string[] = []): Promise<number> {
  if (argv.includes("--once")) {
    const { columnsOf, loadSettings } = await import("./config.mts");
    const s = await loadSettings();
    process.exit(
      await once(
        { board: s.tickets.board, ready: columnsOf(s).Ready },
        liveDeps(s.repository),
      ),
    );
  }
  process.exit(await main());
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await run();
}
