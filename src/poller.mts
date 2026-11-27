#!/usr/bin/env node
// Start a build in GitHub Actions for each card the owner moves to Ready. A board owned
// by a user account sends no event, so this reads it once a minute. It runs
// as a worker on a server the repository's owner hosts, or, with `--once`,
// as one pass of a scheduled workflow, which reads the board and the Ready
// column from the settings in its checkout and needs only the token. With
// `--once --preset FILE` that pass is an organization's: it reads them from
// the organization's preset, and starts the builds of every repository
// with a ticket in the Ready column of the one board.
//
// Hosted, its environment is FACTORY_REPOSITORY (owner/name) and
// FACTORY_BOARD_TOKEN (a classic token with the repo and project scopes,
// or a fine-grained one that can also write Actions: it starts the
// workflow). It has no checkout, so at every pass it reads the settings
// the scheduled pass reads from the lock on the default branch.
//
// Once started it never exits on its own: a host that deploys every
// component together can fail the whole deploy when a worker exits during
// a rollout. The one exit is at start, with no repository to read.
//
// It names the code host and the runner itself, GitHub and GitHub Actions,
// each over the `fetch` transport, since it runs with no `gh`.
import { TICKET_LABELS } from "./labels.mts";
import { BUILT } from "./tool-names.mts";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  columnsOf,
  loadSettings,
  MAX_PER_HOUR,
  parseSettings,
  presetEntriesOf,
  SETTINGS_FILE,
  SettingsError,
  type Settings,
} from "./config.mts";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  DEFAULT_COLUMNS,
  cardOf,
  type Columns,
  entryFor,
  derive,
  markedComments,
  toSnapshot,
  type Board,
  type RepoSnapshot,
} from "./lib/work-status.mts";
import { githubCodeHost, githubOrganization } from "./code-host/github.mts";
import type { CodeHost } from "./code-host/types.mts";
import {
  FACTORY_WORKFLOW,
  githubActionsRunner,
} from "./runner/github-actions.mts";
import type { Runner } from "./runner/types.mts";
import { DEFAULT_TICKETS, openSystem } from "./tickets/index.mts";
import type { Registry } from "./tools.mts";
import { HttpError, fetchTransport, statusOf } from "./tickets/transport.mts";
import {
  boardOf,
  compareKeys,
  CredentialError,
  need,
  type Key,
  type Tickets,
} from "./tickets/types.mts";
import { linkPulls, ownLinks } from "./lib/pull-tickets.mts";
import * as say from "./lib/output.mts";

/** The image each release publishes the hosted poller as. */
export const POLLER_IMAGE = "ghcr.io/davidbyoung/software-factory-poller";

/** The variables a hosted poller read before it read the settings. */
const RETIRED = [
  "FACTORY_BOARD_OWNER",
  "FACTORY_BOARD_NUMBER",
  "FACTORY_READY_COLUMN",
  "FACTORY_LABEL",
  "FACTORY_MAX_PER_HOUR",
];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
export const FIRE_LIMIT = MAX_PER_HOUR;
const FIRE_TIMEOUT_MS = 30_000;

/** The open issues the shared derivation puts in Ready, in key order. */
export function selectToStart(
  snapshot: RepoSnapshot,
  board: Board,
  columns: Columns = DEFAULT_COLUMNS,
): Key[] {
  return snapshot.issues
    .filter(
      (issue) =>
        issue.finishedAt === null &&
        derive(
          issue,
          cardOf(board, issue.key, columns),
          snapshot.pulls,
          columns,
        ).status === "Ready",
    )
    .map((issue) => issue.key)
    .sort((a, b) => {
      const rank = (k: Key) => board.items.get(k)?.rank ?? 0;
      return rank(a) - rank(b) || compareKeys(a, b);
    });
}

export function startMarker(): string {
  return `st_${randomBytes(6).toString("hex")}`;
}

/** The columns `tick` reads a board by: the defaults, with the column
 * that approves a build from FACTORY_READY_COLUMN, which `readConfig`
 * requires and each pass sets from its settings. */
export function columnsFrom(env: Record<string, string | undefined>): Columns {
  return {
    ...DEFAULT_COLUMNS,
    Ready: [env.FACTORY_READY_COLUMN!.trim()],
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
    .flatMap((issue) => markedComments(issue.record))
    .filter((m) => m.marker.kind === "started")
    .map((m) => Date.parse(m.at))
    .filter((at) => now - at < HOUR);
}

/** Whether another fire fits in the rolling hour, given when the recent ones
 * went out. */
export function capAllows(
  fired: number[],
  now: number,
  max: number = FIRE_LIMIT,
): boolean {
  return fired.filter((at) => now - at < HOUR).length < max;
}

/** A minute between reads, and ten once ten in a row have failed. */
export function nextDelay(failuresInARow: number): number {
  return failuresInARow >= 10 ? 10 * MINUTE : MINUTE;
}

export type Config = {
  owner: string;
  number: number;
  githubToken: string;
  /** How many builds it starts in any one hour. */
  maxPerHour: number;
};

export function readConfig(
  env: Record<string, string | undefined>,
): Config | { missing: string[] } | { wrong: string } {
  const names = [
    "FACTORY_BOARD_OWNER",
    "FACTORY_BOARD_NUMBER",
    "FACTORY_BOARD_TOKEN",
    "FACTORY_READY_COLUMN",
  ];
  const missing = names.filter((name) => !env[name]?.trim());
  if (missing.length) return { missing };
  const max = env.FACTORY_MAX_PER_HOUR?.trim();
  const maxPerHour = max ? Number(max) : FIRE_LIMIT;
  if (!/^\d+$/.test(String(maxPerHour)) || maxPerHour < 1)
    return {
      wrong: "FACTORY_MAX_PER_HOUR must be a whole number, 1 or more",
    };
  return {
    owner: env.FACTORY_BOARD_OWNER!,
    number: Number(env.FACTORY_BOARD_NUMBER),
    githubToken: env.FACTORY_BOARD_TOKEN!,
    maxPerHour,
  };
}

export type State = {
  failuresInARow: number;
  lastHeartbeat: number;
  /** The hosted poller's reason not to poll, while one holds. */
  reason?: string | null;
  /** The hosted poller's last `settings from` line. */
  settingsLine?: string;
  /** Whether the hosted poller has looked for the variables it no longer
   * reads. */
  retiredChecked?: boolean;
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
  /** The ticket system to read, its settings under `tickets`, and whether
   * the code host's links are its own, from the settings; the default
   * system when not given. */
  ticketSystem?: {
    type: string;
    options: Record<string, unknown>;
    own: boolean;
  };
  /** The ticket systems to open it from; the factory's own unless given. */
  systems?: Registry["tickets"];
  /** The factory's own version; the package's unless given. */
  version?: string;
};

const HOSTED = { type: DEFAULT_TICKETS, options: {}, own: true };

/** The code host and a reader of any repository's files, over the
 * `fetch` transport: what the hosted poller needs before it knows the
 * board. */
function reader(d: Deps, token: string) {
  const transport = fetchTransport({
    token,
    fetch: d.fetch,
    timeoutMs: FIRE_TIMEOUT_MS,
    userAgent: "ready-poller",
  });
  return {
    transport,
    codeHost: githubCodeHost({ transport, repository: d.repository }),
    /** A file's text on the default branch of any repository the token
     * reads, or null when it has none. */
    file: (repository: string, path: string) => {
      const [owner, name] = repository.split("/") as [string, string];
      return githubOrganization({ transport, name: owner }).file(name, path);
    },
  };
}

/** The ticket system, the code host, and the runner, over the `fetch`
 * transport. */
export async function sources(d: Deps, c: Config) {
  const { transport, codeHost, file } = reader(d, c.githubToken);
  const system = d.ticketSystem ?? HOSTED;
  return {
    tickets: await openSystem(
      d.systems ?? (await import("./tools.mts")).TOOLS.tickets,
      system.type,
      system.options,
      { repository: d.repository, board: c.number, boardOwner: c.owner },
      null,
      { transport },
      d.env,
    ),
    codeHost,
    runner: githubActionsRunner({ transport, repository: d.repository }),
    file,
  };
}

/** The `builds.trigger` in effect in a repository, from its default
 * branch: its own settings file's key, else what its lock records, which
 * `factory sync` combined from its presets, its choices, and the default.
 * Null when the file is missing or cannot be read, or when it sets none
 * and the lock cannot say: one missing, unreadable, from a release that
 * recorded no settings, or not pinning a preset the file lists. */
async function triggerInEffect(
  file: (repository: string, path: string) => Promise<string | null>,
  repository: string,
): Promise<string | null> {
  try {
    const text = await file(repository, SETTINGS_FILE);
    if (text === null) return null;
    const { load } = await import("js-yaml");
    const own = load(text) as {
      builds?: { trigger?: unknown };
      presets?: unknown;
    } | null;
    const trigger = own?.builds?.trigger;
    if (typeof trigger === "string") return trigger;
    const P = await import("./preset.mts");
    const lockText = await file(repository, P.LOCK_FILE);
    if (lockText === null) return null;
    const lock = P.readLock(lockText, load);
    const pinned = new Set(lock.presets.map((p) => p.name));
    if (presetEntriesOf(own?.presets).some((e) => !pinned.has(e.name)))
      return null;
    const inEffect = (lock.settings?.builds as { trigger?: unknown } | null)
      ?.trigger;
    return typeof inEffect === "string" ? inEffect : null;
  } catch {
    return null;
  }
}

async function readAll(tickets: Tickets, codeHost: CodeHost, d: Deps) {
  const [read, open] = await Promise.all([
    tickets.readAll({
      board: true,
      label: d.env.FACTORY_LABEL?.trim() || TICKET_LABELS.factory,
    }),
    codeHost.open(),
  ]);
  return {
    snapshot: toSnapshot(
      read,
      linkPulls(open, tickets, (d.ticketSystem ?? HOSTED).own),
      new Date(d.now()),
      [],
      columnsFrom(d.env),
    ),
    board: boardOf(read),
  };
}

/** Start a build of one ticket on the default branch. */
async function dispatch(
  runner: Runner,
  branch: string,
  issue: Key,
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
  if ("wrong" in config) {
    d.log(`not polling: ${config.wrong}`);
    state.failuresInARow += 1;
    return;
  }
  let tickets, codeHost, runner, read;
  try {
    ({ tickets, codeHost, runner } = await sources(d, config));
    read = await readAll(tickets, codeHost, d);
    state.failuresInARow = 0;
  } catch (error) {
    state.failuresInARow += 1;
    d.log(
      `read failed (${state.failuresInARow} in a row): ${error instanceof CredentialError ? error.message : String(error)}`,
    );
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
    const ref = tickets.ref(issue);
    try {
      const blockers = await tickets.blockers!.list(issue);
      const open = blockers.filter((b) => b.state === "open");
      if (open.length) {
        d.log(
          `${ref} waits on ${open.map((b) => tickets.ref(b.key)).join(", ")}`,
        );
        continue;
      }
    } catch (error) {
      d.log(
        `${ref} skipped: its blockers could not be read (${String(error)})`,
      );
      continue;
    }
    if (!capAllows(fired, d.now(), config.maxPerHour)) {
      d.log(
        `${ref} waits: ${config.maxPerHour} builds started in the last hour (builds.max-per-hour)`,
      );
      continue;
    }

    const marker = d.marker();
    try {
      await tickets.record.add(
        issue,
        entryFor({ kind: "started", marker }, columns),
      );
    } catch (error) {
      d.log(`${ref} not started: the start comment failed (${String(error)})`);
      continue;
    }
    fired.push(d.now());
    const outcome = await dispatch(runner, d.defaultBranch, issue);
    if (outcome.ok) {
      d.log(`${ref} started ${marker}: dispatched ${FACTORY_WORKFLOW}`);
      continue;
    }
    d.log(`${ref} dispatch failed: ${outcome.status} (${outcome.reason})`);
    try {
      await tickets.record.add(
        issue,
        entryFor(
          {
            kind: "dispatch-failed",
            issue: { key: issue, ref },
            status: outcome.status,
            reason: outcome.reason,
          },
          columns,
        ),
      );
    } catch (error) {
      d.log(`${ref} dispatch-failure comment failed (${String(error)})`);
    }
  }
}

/** What one scheduled pass reads from the settings: the board's number,
 * and the column that approves a build, each null when the settings have
 * none. */
export type OnceSettings = {
  board: number | null;
  ready: string | null;
  /** The name of the label on every ticket the factory works on. */
  factory: string;
  /** How many builds it starts in any one hour; 20 unless given. */
  maxPerHour?: number;
  /** The settings' ticket system; the default one when not given. */
  ticketSystem?: Deps["ticketSystem"];
};

export function onceSettings(s: Settings): OnceSettings {
  return {
    board: s.tickets.board,
    ready: columnsOf(s).Ready?.[0] ?? null,
    factory: s.tickets.labels.factory,
    maxPerHour: s.builds.maxPerHour,
    ticketSystem: {
      type: s.tickets.type,
      options: s.tickets.options,
      own: ownLinks(s),
    },
  };
}

/** One pass, for a scheduled run: the board and the Ready column come from
 * the settings, the board's owner is the repository's, and only the token
 * comes from the environment. 1 when it read nothing or could not read. */
export async function once(s: OnceSettings, d: Deps): Promise<number> {
  const env = onceEnv(s, d, SETTINGS_FILE);
  if (env === null) return 1;
  const state: State = { failuresInARow: 0, lastHeartbeat: d.now() };
  await tick(
    { ...d, env, ...(s.ticketSystem ? { ticketSystem: s.ticketSystem } : {}) },
    state,
  );
  return state.failuresInARow > 0 ? 1 : 0;
}

/** The environment `tick` reads, from what `file` set, or null once it has
 * logged that `file` names no board or no Ready column. */
function onceEnv(s: OnceSettings, d: Deps, file: string): Deps["env"] | null {
  if (s.board === null) {
    d.log(`No board to read: tickets.board is not set in ${file}.`);
    return null;
  }
  if (s.ready === null) {
    d.log(`No card can start a build: the Ready column is none in ${file}.`);
    return null;
  }
  return envOf(s, d);
}

/** The environment `tick` reads, from settings that name a board and a
 * Ready column. The board's owner is the repository's. */
function envOf(s: OnceSettings, d: Deps): Deps["env"] {
  return {
    ...d.env,
    FACTORY_BOARD_OWNER: d.repository.split("/")[0],
    FACTORY_BOARD_NUMBER: String(s.board),
    FACTORY_READY_COLUMN: s.ready!,
    FACTORY_LABEL: s.factory,
    FACTORY_MAX_PER_HOUR: String(s.maxPerHour ?? FIRE_LIMIT),
  };
}

/** The settings the hosted poller uses, from the lock's `settings`, and
 * nothing else: a key or value it does not use, from a newer release or
 * not, is left out before they are checked. */
function used(raw: Record<string, unknown>): Record<string, unknown> {
  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  const pick = (o: unknown, keys: readonly string[]) =>
    isObj(o)
      ? Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]))
      : {};
  const tickets = isObj(raw.tickets) ? raw.tickets : {};
  const type = isObj(tickets.type) ? tickets.type.type : tickets.type;
  const options = typeof type === "string" ? (BUILT.tickets[type] ?? []) : [];
  const columns = pick(tickets.columns, ["ready"]);
  const labels = pick(tickets.labels, ["factory"]);
  return {
    ...pick(raw, ["version", "repository"]),
    tickets: {
      ...pick(tickets, ["type", "board", ...options]),
      ...(Object.keys(columns).length ? { columns } : {}),
      ...(Object.keys(labels).length ? { labels } : {}),
    },
    builds: pick(raw.builds, ["trigger", "max-per-hour"]),
  };
}

/** What the hosted poller reads from the lock's text on `branch`: the
 * settings, or why it polls nothing. `own` is its own version, named
 * beside the lock's when a setting it uses can't be read. */
export async function hostedSettings(
  text: string,
  branch: string,
  own: string,
): Promise<{ settings: OnceSettings } | { reason: string }> {
  const { load } = await import("js-yaml");
  const P = await import("./preset.mts");
  const fault = (words: string, written: string) =>
    `${P.LOCK_FILE} on ${branch}: ${words}${
      written && written !== own
        ? ` (written by factory ${written}, and this poller is ${own}: run ${POLLER_IMAGE}:${written})`
        : ""
    }`;
  let lock: ReturnType<typeof P.readLock>;
  try {
    lock = P.readLock(text, load);
  } catch (e) {
    return { reason: fault((e as Error).message.split("\n")[0]!, "") };
  }
  if (!lock.settings)
    return {
      reason: fault(
        P.staleMessages.earlier.slice(P.LOCK_FILE.length + 1),
        lock.version,
      ),
    };
  let s: Settings;
  try {
    s = parseSettings(used(lock.settings), () => true, undefined, {
      partial: true,
    });
  } catch (e) {
    if (!(e instanceof SettingsError)) throw e;
    return {
      reason: fault(e.message.replace(`${SETTINGS_FILE}: `, ""), lock.version),
    };
  }
  if (s.builds.trigger !== "own-server")
    return {
      reason: `builds.trigger is ${s.builds.trigger} on ${branch}, not own-server`,
    };
  const settings = onceSettings(s);
  if (settings.board === null)
    return { reason: `tickets.board is not set on ${branch}` };
  if (settings.ready === null)
    return {
      reason: fault(
        "tickets.columns.ready: no column shows ready, so nothing would start a build: name one, or set builds.trigger to manual",
        lock.version,
      ),
    };
  return { settings };
}

/** The factory's version, from its package's manifest. */
function ownVersion(): string {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  return (
    JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      version: string;
    }
  ).version;
}

/** One pass of the hosted poller: the settings from the lock on the
 * default branch, then the board as `tick` reads it. It never throws. */
export async function hosted(d: Deps, state: State): Promise<void> {
  const token = d.env.FACTORY_BOARD_TOKEN?.trim();
  if (!token) {
    d.log("not polling: FACTORY_BOARD_TOKEN not set");
    state.failuresInARow += 1;
    return;
  }
  const { codeHost, file } = reader(d, token);
  if (!d.defaultBranch) {
    try {
      d.defaultBranch = await codeHost.defaultBranch();
    } catch (error) {
      state.failuresInARow += 1;
      d.log(`default branch not read: ${String(error)}`);
      return;
    }
  }
  const branch = d.defaultBranch;
  if (!state.retiredChecked) {
    state.retiredChecked = true;
    const set = RETIRED.filter((name) => d.env[name]?.trim());
    if (set.length)
      d.log(
        `${set.join(", ")} ${set.length === 1 ? "is" : "are"} no longer read: the settings on ${branch} are. Take ${set.length === 1 ? "it" : "them"} out of the poller's environment.`,
      );
  }
  const { LOCK_FILE } = await import("./preset.mts");
  let text: string | null;
  try {
    text = await file(d.repository, LOCK_FILE);
  } catch (error) {
    state.failuresInARow += 1;
    d.log(`read failed (${state.failuresInARow} in a row): ${String(error)}`);
    return;
  }
  const read =
    text === null
      ? {
          reason: `no ${LOCK_FILE} on ${branch} yet. Merge the pull request that sets the factory up.`,
        }
      : await hostedSettings(text, branch, d.version ?? ownVersion());
  if ("reason" in read) {
    // A pass that goes on to poll leaves the count to `tick`, which resets
    // it only once the board reads.
    state.failuresInARow = 0;
    if (read.reason !== state.reason) {
      d.log(`not polling: ${read.reason}`);
      state.lastHeartbeat = d.now();
    } else if (d.now() - state.lastHeartbeat >= HOUR) {
      d.log(`heartbeat: not polling: ${read.reason}`);
      state.lastHeartbeat = d.now();
    }
    state.reason = read.reason;
    return;
  }
  state.reason = null;
  const s = read.settings;
  const line = `settings from ${LOCK_FILE} on ${branch}: board ${s.board}, ready column "${s.ready}", label "${s.factory}", ${s.maxPerHour ?? FIRE_LIMIT} builds an hour`;
  if (line !== state.settingsLine) d.log(line);
  state.settingsLine = line;
  await tick(
    {
      ...d,
      env: envOf(s, d),
      ...(s.ticketSystem ? { ticketSystem: s.ticketSystem } : {}),
    },
    state,
  );
}

/** What a pass for an organization reads from its preset's text, parsed
 * as a repository that follows only that preset would read it. Throws a
 * SettingsError that names `file`. */
export async function presetSettings(
  text: string,
  file: string,
  repository: string,
): Promise<OnceSettings> {
  const { load } = await import("js-yaml");
  const { parsePreset } = await import("./preset.mts");
  const raw = parsePreset(text, file, load);
  return onceSettings(
    parseSettings({ ...raw, repository }, () => true, undefined, {
      preset: true,
    }),
  );
}

/** One pass for an organization: the board `file`'s preset names is read
 * once for the repositories with a ticket in its Ready column, and each
 * gets the pass `once` makes, with its own hourly cap. The board's owner
 * is the owner of `d.repository`, the repository that holds the preset.
 * A repository whose settings in effect set another `builds.trigger` is
 * left. 1 when the board could not be read. A repository that could not be read
 * is logged, as a warning in a workflow's run, and fails nothing: one
 * ticket in a repository the token does not reach would otherwise fail
 * every pass. */
export async function onceEach(
  s: OnceSettings,
  d: Deps,
  file: string,
): Promise<number> {
  const env = onceEnv(s, d, file);
  if (env === null) return 1;
  const config = readConfig(env);
  if ("missing" in config || "wrong" in config) {
    d.log(
      `not polling: ${"missing" in config ? `${config.missing.join(", ")} not set` : config.wrong}`,
    );
    return 1;
  }
  const all = { ...d, env, ticketSystem: s.ticketSystem ?? HOSTED };
  let repositories: string[];
  let fileOf: Awaited<ReturnType<typeof sources>>["file"];
  try {
    const opened = await sources(all, config);
    fileOf = opened.file;
    const board = need(opened.tickets, "board");
    if (!board.readyRepositories)
      throw new Error(
        `the ${all.ticketSystem.type} ticket system cannot list a board's repositories`,
      );
    repositories = await board.readyRepositories(config.number, s.ready!);
  } catch (error) {
    d.log(
      `read failed: ${error instanceof CredentialError ? error.message : String(error)}`,
    );
    return 1;
  }
  const warn = d.env.GITHUB_ACTIONS === "true";
  for (const repository of repositories) {
    // A repository that starts its builds another way, or by hand, is not
    // started from here as well.
    const trigger = await triggerInEffect(fileOf, repository);
    if (trigger !== null && trigger !== "github-action") {
      d.log(
        `${repository}: builds.trigger is ${trigger} there, so its tickets are left`,
      );
      continue;
    }
    const state: State = { failuresInARow: 0, lastHeartbeat: d.now() };
    await tick(
      {
        ...all,
        repository,
        defaultBranch: undefined,
        // A failed read is counted before it is logged, so only its line
        // is the warning.
        log: (line) =>
          d.log(
            `${warn && state.failuresInARow > 0 ? WARNING : ""}${repository}: ${line}`,
          ),
      },
      state,
    );
  }
  return 0;
}

/** `factory poller --once --preset FILE`: one pass for the organization
 * whose preset the file at `path` is, in a workflow of the repository that
 * holds it, which GITHUB_REPOSITORY names. */
export async function oncePreset(
  path: string,
  d: Omit<Deps, "repository">,
  read: (path: string) => string = (p) => readFileSync(p, "utf8"),
): Promise<number> {
  const repository = d.env.GITHUB_REPOSITORY;
  if (!repository) {
    d.log(
      `GITHUB_REPOSITORY is not set, so no owner's board can be read. Run this in a workflow of the repository that holds ${path}.`,
    );
    return 1;
  }
  let text: string;
  try {
    text = read(path);
  } catch (e) {
    d.log(`${path} could not be read: ${(e as Error).message}`);
    return 1;
  }
  let settings: OnceSettings;
  try {
    settings = await presetSettings(text, path, repository);
  } catch (e) {
    if (!(e instanceof SettingsError)) throw e;
    d.log(e.message);
    return 1;
  }
  return onceEach(settings, { ...d, repository }, path);
}

/** What marks a line as a warning in a workflow's run, which reads it only
 * at the start of the line. */
const WARNING = "::warning::";

/** A line as the poller prints it, after the time. */
export function stamped(line: string, at: Date): string {
  const mark = line.startsWith(WARNING) ? WARNING : "";
  return `${mark}${at.toISOString()} ${line.slice(mark.length)}`;
}

/** The parts of the dependencies that are the same however it runs. */
function liveDeps(): Omit<Deps, "repository"> {
  return {
    fetch,
    env: process.env,
    now: () => Date.now(),
    log: (line) => say.plain(stamped(line, new Date())),
    marker: startMarker,
  };
}

/** The hosted poller: it names its repository, then makes a pass, waits,
 * and makes another, `passes` times, which is forever but in a test. */
export async function serve(
  d: Deps,
  wait: (ms: number) => Promise<unknown> = sleep,
  passes = Infinity,
): Promise<void> {
  const state: State = { failuresInARow: 0, lastHeartbeat: 0 };
  d.log(`ready-poller started for ${d.repository}`);
  for (let pass = 0; pass < passes; pass++) {
    try {
      await hosted(d, state);
    } catch (error) {
      d.log(`tick failed: ${String(error)}`);
    }
    if (pass + 1 < passes) await wait(nextDelay(state.failuresInARow));
  }
}

async function main(): Promise<number> {
  const repository = process.env.FACTORY_REPOSITORY;
  if (!repository) {
    say.plainError(
      "ready-poller not started: FACTORY_REPOSITORY is not set. Set it to the repository, as owner/name.",
    );
    return 1;
  }
  const d = { ...liveDeps(), repository };
  process.on("unhandledRejection", (error) =>
    d.log(`unhandled: ${String(error)}`),
  );
  await serve(d);
  return 0;
}

/** `factory poller`, `factory poller --once`, and `factory poller --once
 * --preset FILE`. The settings are loaded only for `--once` alone, since
 * the hosted poller has no checkout and an organization's has no settings
 * but its preset. */
export async function run(argv: string[] = []): Promise<number> {
  const at = argv.indexOf("--preset");
  if (at >= 0) {
    const file = argv[at + 1];
    if (!file || !argv.includes("--once")) {
      say.plainError("Usage: factory poller --once --preset FILE");
      process.exit(2);
    }
    process.exit(await oncePreset(file, liveDeps()));
  }
  if (argv.includes("--once")) {
    const s = await loadSettings();
    process.exit(
      await once(onceSettings(s), { ...liveDeps(), repository: s.repository }),
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
