#!/usr/bin/env node
// What is being refined or built, and by which session, in the terminal.
//
//   factory status
//   factory status --watch  # read again every 15 seconds
//   status --hook   # the form `factory session-start` prints
//
// Reads the board as well as the repository, so the GitHub CLI needs the
// project scope once, which `factory ticket ready` also needs to write it:
// gh auth refresh -s project
// The repository and the board come from the factory's settings, whose
// loader needs dependencies installed; before npm ci the hook prints
// nothing.
import { setTimeout as sleep } from "node:timers/promises";
import {
  NO_DEPENDENCIES,
  SettingsError,
  loadSettings,
  repoRoot,
  targetOf,
  type Settings,
  type Target,
} from "./config.mts";
import { appSessionLink } from "./lib/gh.mts";
import {
  DEFAULT_COLUMNS,
  type Columns,
  type Status,
  cardOf,
  derive,
  isNotStarted,
  watchOf,
  type Watch,
  isStale,
  isStuck,
  actionsRunLink,
  markedComments,
  parseRuns,
  toSnapshot,
  type Board,
  type Derived,
  type PullRequest,
  type Issue,
  type RepoSnapshot,
  type ReviewerRun,
} from "./lib/work-status.mts";
import {
  boardOf,
  readAll,
  type Key,
  type Tickets,
  CredentialError,
} from "./tickets/types.mts";
import { linkPulls, ownLinks } from "./lib/pull-tickets.mts";
import { openTickets } from "./tickets/index.mts";
import {
  openCodeHost,
  reachCodeHost,
  type CodeHost,
} from "./code-host/index.mts";
import { acrossOf, type Reach } from "./across.mts";
import {
  mergeOrder,
  ownerOf,
  sameRepository,
  waitsFor,
  type Progress,
} from "./lib/repositories.mts";
import { clonesIn, ticketOfWord, workFolder } from "./workspace.mts";
import { openRunner, type Runner } from "./runner/index.mts";
import type { Opened } from "./setup.mts";
import type { Registry } from "./tools.mts";
import { subscriptionDollars } from "./lib/pricing.mts";
import { dollars } from "./lib/usage.mts";
import { minutes, resultText } from "./reviewers.mts";
import * as say from "./lib/output.mts";

const HOOK_LIMIT_MS = 20_000;
const HOUR = 3600_000;

export type Row = {
  /** A ticket's key, or a pull request's number. */
  key: string;
  /** How it is written: the ticket system's form, or `#N` for a pull
   * request. */
  name: string;
  kind: "issue" | "pull";
  title: string;
  derived: Derived | null;
  pulls: PullRequest[];
  /** Each reviewer's latest run in the card's current status. */
  runs: ReviewerRun[];
  flags: string[];
  /** The card's board Cost, which the sync writes; null with none. */
  cost: number | null;
};

const RUN_STATUSES = new Set(["In refinement", "In progress", "In review"]);

/** Each reviewer's latest run on the issue since its current session began:
 * the newest `refining` marker for a card In refinement, the newest claim
 * for one In progress or In review. A run needs a session clock, which only
 * those markers start, so a build's card does not carry its refinement's
 * runs. */
export function cardRuns(issue: Issue, derived: Derived): ReviewerRun[] {
  if (!RUN_STATUSES.has(derived.status)) return [];
  const kind = derived.status === "In refinement" ? "refining" : "claim";
  const began = markedComments(issue.record)
    .filter((m) => m.marker.kind === kind)
    .at(-1)?.at;
  if (!began) return [];
  const latest = new Map<string, ReviewerRun>();
  for (const run of issue.record.flatMap(parseRuns)) {
    if (Date.parse(run.start) < Date.parse(began)) continue;
    const seen = latest.get(run.reviewer);
    if (!seen || Date.parse(run.start) >= Date.parse(seen.start))
      latest.set(run.reviewer, run);
  }
  return [...latest.values()].sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start),
  );
}

export function age(since: string | null, now: Date): string {
  if (!since) return "";
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - Date.parse(since)) / 60_000),
  );
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

export function isWatching(body: string, now: Date): boolean {
  const written = /<!-- session-watching: (\S+) -->/.exec(body)?.[1];
  return written !== undefined && now.getTime() - Date.parse(written) < HOUR;
}

/** One row per open issue, and one per open pull request that closes no
 * issue, such as Dependabot's. */
export function toRows(
  snapshot: RepoSnapshot,
  board: Board,
  blockers: Map<Key, Key[]>,
  now: Date,
  options: {
    /** What starts builds from the board, so that a card left in Ready is
     * worth flagging; null when builds.trigger is manual. */
    watch?: Watch | null;
    columns?: Columns;
    /** How the ticket system writes a ticket. */
    ref: (key: Key) => string;
    /** The open pull requests of each ticket that names several
     * repositories, in every one. */
    across?: Map<Key, PullRequest[]>;
    /** The tickets whose repositories could not be read. */
    unread?: Map<Key, string>;
    /** The title of each ticket of another repository's that a pull request
     * here is part of, or null when it could not be read. */
    elsewhere?: Map<Key, string | null>;
  },
): { rows: Row[]; closed: Row[] } {
  const watch =
    options.watch === undefined ? watchOf("own-server", 5) : options.watch;
  const columns = options.columns ?? DEFAULT_COLUMNS;
  const rows: Row[] = [];
  const closed: Row[] = [];
  const claimed = new Set<number>();
  for (const issue of snapshot.issues) {
    const derived = derive(
      issue,
      cardOf(board, issue.key, columns),
      snapshot.pulls,
      columns,
      snapshot.across?.get(issue.key),
    );
    const pulls =
      options.across?.get(issue.key) ??
      snapshot.pulls.filter((p) => derived.pulls.includes(p.number));
    pulls.forEach((p) => {
      if (!p.across || snapshot.pulls.some((x) => x === p))
        claimed.add(p.number);
    });
    const flags: string[] = [];
    const unread = options.unread?.get(issue.key);
    if (unread) flags.push(`could not read its repositories: ${unread}`);
    if (isStale(derived, now)) flags.push("stale");
    if (
      watch &&
      isNotStarted(derived, blockers.get(issue.key) ?? [], now, watch.minutes)
    )
      flags.push(watch.flag);
    const row: Row = {
      key: issue.key,
      name: options.ref(issue.key),
      kind: "issue",
      title: issue.title,
      derived,
      pulls,
      runs: cardRuns(issue, derived),
      flags,
      cost: board.items.get(issue.key)?.cost ?? null,
    };
    (derived.status === "Done" ? closed : rows).push(row);
  }
  for (const pull of snapshot.pulls) {
    if (claimed.has(pull.number)) continue;
    if (pull.closes.length > 0) continue;
    const other = pull.partOf.find((k) => options.elsewhere?.has(k));
    const its = other && options.elsewhere!.get(other);
    rows.push({
      key: String(pull.number),
      name: `#${pull.number}`,
      kind: "pull",
      title: other
        ? `part of ${options.ref(other)}${its ? `: ${its}` : ""}`
        : `pull request by ${pull.author}`,
      derived: null,
      pulls: [pull],
      runs: [],
      flags: [],
      cost: null,
    });
  }
  return { rows, closed };
}

/** Where a ticket's number, a pull request's number, and an Actions run's
 * ID each lead. */
export type Links = {
  ticket: (key: Key) => string;
  pull: (n: number) => string;
  run: (id: string) => string;
};

/** Whether and how to dress the output: colors, links, and fitting to the
 * window are for a terminal; anything else gets plain text. Numbers and
 * runs link where `links` says, when it is given. */
export type Style = {
  color: boolean;
  width: number | null;
  links?: Links;
  /** The board's columns, which head the groups. */
  columns?: Columns;
};
export const PLAIN: Style = { color: false, width: null };

/** Colors, links, and fitting to the window go together, where `colorOn`
 * says the output is colored. */
export function styleFor(color: boolean, columns: number | undefined): Style {
  return color ? { color: true, width: columns ?? 80 } : PLAIN;
}

const GROUPS: Status[] = [
  "Backlog",
  "In refinement",
  "Ready",
  "In progress",
  "In review",
];
const UNLINKED = "Pull requests that close no issue";
const INDENT = "  ";
const GAP = "  ";
const MIN_TITLE = 20;
const HEADER = ["#", "Title", "Time in status", "Cost", "Session"];

/** Words that color nothing themselves: a ticket's title can hold a
 * command. */
type Seg = say.Part;

const linkTo = (row: Pick<Row, "kind" | "key">, style: Style) =>
  row.kind === "issue"
    ? style.links?.ticket(row.key)
    : style.links?.pull(Number(row.key));
const width = (segs: Seg[]) => segs.reduce((n, s) => n + [...s.text].length, 0);

const as = (role: say.Role, segs: Seg[]): Seg[] =>
  segs.map((s) => ({ ...s, role }));
const spaces = (n: number): Seg => ({ text: " ".repeat(Math.max(0, n)) });

/** Shortens the runs to `max` characters, ending in "…", when they are longer. */
function fit(segs: Seg[], max: number | null): Seg[] {
  if (max === null || width(segs) <= max) return segs;
  const out: Seg[] = [];
  let room = max - 1;
  for (const seg of segs) {
    if (room <= 0) break;
    const chars = [...seg.text].slice(0, room);
    out.push({ ...seg, text: chars.join("") });
    room -= chars.length;
  }
  const last = out[out.length - 1];
  last.text = `${last.text.trimEnd()}…`;
  return out;
}

const CHECKS: Record<string, string> = {
  SUCCESS: "checks passing",
  FAILURE: "checks failing",
  ERROR: "checks failing",
  PENDING: "checks pending",
  EXPECTED: "checks pending",
};

/** The pull request's line under its row; a row that is the pull request
 * already shows its number. */
function pullLine(
  pull: PullRequest,
  now: Date,
  named: boolean,
  style: Style,
): Seg[] {
  const parts = [
    pull.isDraft ? "draft" : "ready for review",
    pull.checks === null
      ? "no checks"
      : (CHECKS[pull.checks] ?? `checks ${pull.checks.toLowerCase()}`),
    pull.openThreads === 0
      ? "no open threads"
      : `${pull.openThreads} open thread${pull.openThreads === 1 ? "" : "s"}`,
  ];
  if (isWatching(pull.body, now)) parts.push("a session is watching it");
  if (pull.across?.waits) parts.push(`waits for ${pull.across.waits}`);
  const rest = parts.join(" · ");
  return named
    ? [
        { text: "↳ Pull request " },
        {
          text: pull.across?.ref ?? `#${pull.number}`,
          url:
            pull.across?.url ??
            linkTo({ kind: "pull", key: String(pull.number) }, style),
        },
        { text: ` · ${rest}` },
      ]
    : [{ text: `↳ ${rest}` }];
}

// The columns of a reviewer row, fixed so they line up in every card.
const RUN_NAME = 15;
const RUN_MODEL = 6;
const RUN_RESULT = 20;
const RUN_TIME = 11;

/** One reviewer's row under its card: a mark that carries the result
 * without color, the name, the model, the result, how long it ran, and its
 * cost in subscription dollars. */
export function runLine(run: ReviewerRun, now: Date, indent = ""): say.Line {
  const pad = (text: string, n: number) =>
    text + " ".repeat(Math.max(0, n - [...text].length));
  const stuck = isStuck(run, now);
  const result = resultText(run, now);
  const [mark, role]: [string, say.Role] = stuck
    ? ["?", "yourTurn"]
    : {
        running: ["…", "skip"] as [string, say.Role],
        passed: ["✓", "good"] as [string, say.Role],
        failed: ["✗", "bad"] as [string, say.Role],
        "no verdict": ["?", "yourTurn"] as [string, say.Role],
      }[run.result];
  const cells: Seg[][] = [
    [{ role, text: mark }, { text: ` ${pad(run.reviewer, RUN_NAME)}` }],
    [say.skip(pad(run.model, RUN_MODEL))],
    [{ role, text: stuck ? result : pad(result, RUN_RESULT) }],
  ];
  if (!stuck && run.result === "running")
    cells.push([say.skip(`${minutes(run.start, now.toISOString())} so far`)]);
  else if (!stuck) {
    const time = run.end ? minutes(run.start, run.end) : "";
    const cost =
      run.cost === undefined ? "" : dollars(subscriptionDollars(run.cost));
    cells.push([say.skip(pad(time, RUN_TIME))]);
    if (cost) cells.push([say.skip(cost)]);
  }
  return line([
    { text: indent },
    ...cells.flatMap((c, i) => (i ? [{ text: GAP }, ...c] : c)),
  ]);
}

/** A line of words, with no spaces at its end. */
function line(segs: Seg[]): say.Line {
  const kept = [...segs];
  for (;;) {
    const last = kept.at(-1);
    if (!last || last.text !== last.text.trimEnd()) {
      if (!last) break;
      const text = last.text.trimEnd();
      kept.pop();
      if (text) {
        kept.push({ ...last, text });
        break;
      }
    } else if (last.text === "") kept.pop();
    else break;
  }
  return say.cells(kept);
}

/** The board's Runs in, lowercased, before a session ID; a phrase such as
 * "Waiting on you" as it is. A desktop app session's `local_…` ID shows as
 * its UUID's first eight characters. */
export function sessionCell(derived: Derived | null): string {
  if (!derived?.session) return "";
  if (/[\s,]/.test(derived.session) || !derived.runsIn) return derived.session;
  const id = derived.session.replace(/^local_([^-]{8})-.*$/, "$1");
  return `${derived.runsIn.toLowerCase()} ${id}`;
}

/** The Session cell, its session's ID linked to open that session in the
 * desktop app when the app knows it, and an Actions run's to the run's
 * page when the links are given. */
function sessionSegs(
  cell: string,
  derived: Derived | null,
  links: Links | undefined,
): Seg[] {
  const session = derived?.session;
  const run = derived && links ? actionsRunLink(derived, links.run) : null;
  const url = run ?? (session === undefined ? null : appSessionLink(session));
  const [where, id] = cell.split(" ");
  return url && id !== undefined
    ? [{ text: `${where} ` }, { text: id, url }]
    : [{ text: cell }];
}

export function formatRows(
  { rows, closed }: { rows: Row[]; closed: Row[] },
  now: Date,
  withClosed = true,
  style: Style = PLAIN,
): say.Line[] {
  const lines: say.Line[] = [];
  if (rows.length === 0) lines.push(say.text("Nothing open."));
  else {
    const cells = rows.map((row) => {
      const url = linkTo(row, style);
      return {
        row,
        number: row.name,
        url,
        time: age(row.derived?.since ?? null, now),
        // Read from the board, never summed here, so it matches the card.
        cost: row.cost === null ? "" : dollars(row.cost),
        session: sessionCell(row.derived),
      };
    });
    const col = (i: number, values: string[]) =>
      Math.max(HEADER[i].length, ...values.map((v) => [...v].length));
    const numW = col(
      0,
      cells.map((c) => c.number),
    );
    const timeW = col(
      2,
      cells.map((c) => c.time),
    );
    const costW = col(
      3,
      cells.map((c) => c.cost),
    );
    const sessionW = col(
      4,
      cells.map((c) => c.session),
    );
    const titleNatural = col(
      1,
      rows.map((r) => r.title),
    );
    const subIndent = INDENT.length + numW + GAP.length;
    const titleW =
      style.width === null
        ? titleNatural
        : Math.max(
            MIN_TITLE,
            Math.min(
              titleNatural,
              style.width -
                subIndent -
                GAP.length -
                timeW -
                GAP.length -
                costW -
                GAP.length -
                sessionW,
            ),
          );
    const subMax =
      style.width === null
        ? null
        : Math.max(MIN_TITLE, style.width - subIndent);
    const gap = GAP.length;
    const sub = " ".repeat(subIndent);

    lines.push(
      say.heads(
        [
          [HEADER[0]!, numW + gap],
          [HEADER[1]!, titleW + gap],
          [HEADER[2]!, timeW + gap],
          [HEADER[3]!, costW + gap],
          [HEADER[4]!, 0],
        ],
        { indent: INDENT.length },
      ),
    );

    const groups = [
      ...GROUPS.map((name) => ({
        // The repository's column for the state, or the factory's own name
        // where the board has none.
        label: (style.columns ?? DEFAULT_COLUMNS)[name]?.[0] ?? name,
        cells: cells.filter(
          (c) => c.row.kind === "issue" && c.row.derived?.status === name,
        ),
        always: true,
      })),
      {
        label: UNLINKED,
        cells: cells.filter((c) => c.row.kind === "pull"),
        always: false,
      },
    ];
    for (const group of groups) {
      if (!group.always && group.cells.length === 0) continue;
      const count = String(group.cells.length);
      lines.push(
        say.BLANK,
        group.cells.length
          ? say.text(
              { role: "heading", text: group.label },
              say.asIs("  "),
              say.skip(count),
            )
          : say.text(say.skip(`${group.label}  ${count}`)),
      );
      for (const c of group.cells) {
        const title = fit([{ text: c.row.title, url: c.url }], titleW);
        const session =
          c.session === "Waiting on you"
            ? as("yourTurn", [{ text: c.session }])
            : sessionSegs(c.session, c.row.derived, style.links);
        lines.push(
          line([
            { text: INDENT },
            ...as("copy", [{ text: c.number, url: c.url }]),
            spaces(numW - [...c.number].length + gap),
            ...title,
            spaces(titleW - width(title) + gap),
            say.skip(c.time),
            spaces(timeW - [...c.time].length + gap),
            { text: c.cost },
            spaces(costW - [...c.cost].length + gap),
            ...session,
          ]),
        );
        for (const pull of c.row.pulls)
          lines.push(
            line([
              { text: sub },
              ...as(
                "skip",
                fit(pullLine(pull, now, c.row.kind === "issue", style), subMax),
              ),
            ]),
          );
        for (const run of c.row.runs) lines.push(runLine(run, now, sub));
        for (const flag of c.row.flags)
          lines.push(
            line([
              { text: sub },
              ...as("bad", fit([{ text: `⚠ ${flag}` }], subMax)),
            ]),
          );
      }
    }
  }
  if (withClosed && closed.length > 0)
    lines.push(
      say.BLANK,
      say.text(
        say.skip("Done in the last 24 hours:"),
        say.asIs(" "),
        ...closed.flatMap((r, i) => [
          ...(i ? [say.asIs(", ")] : []),
          ...as("copy", [{ text: r.name, url: linkTo(r, style) }]),
        ]),
      ),
    );
  return lines;
}

/** The one line a failed read prints. */
export function failureLine(error: unknown): string {
  if (error instanceof CredentialError) return error.message;
  const text = String(error);
  if (/read:project|INSUFFICIENT_SCOPES|required scopes/i.test(text))
    return "Work status: the GitHub CLI cannot read the board yet. Run: gh auth refresh -s project";
  return `Work status: could not read GitHub (${text.split("\n")[0].slice(0, 200)})`;
}

export { targetOf, type Target } from "./config.mts";

/** Where a reading comes from: the ticket system, the code host's pull
 * requests, and the runner, for the page of a run. */
export type Source = {
  tickets: Tickets;
  pulls: Pick<CodeHost, "open" | "address">;
  runner: Pick<Runner, "runPage">;
  /** Whether the code host's own links count (`lib/pull-tickets.mts`). */
  own: boolean;
  /** Any repository's code host, for a ticket that names several. */
  reach: Reach;
  /** Whether a ticket's repositories are kept in a ticket field. */
  inField: boolean;
  /** The clones `factory workspace` left on this machine. */
  clones: () => { key: Key; name: string; folder: string }[];
  /** The lines on the tokens, from 30 days before the day each stops
   * working, and none before then. */
  token?: () => Promise<say.Line[]>;
};

/** The open pull requests of each ticket that names several repositories,
 * as the view shows them. */
async function pullsAcross(
  across: Map<Key, Progress[]>,
  own: { repository: string; pulls: PullRequest[] },
  reach: Reach,
): Promise<Map<Key, PullRequest[]>> {
  const read = new Map<string, Promise<PullRequest[]>>();
  const openIn = (name: string) => {
    if (sameRepository(name, own.repository)) return Promise.resolve(own.pulls);
    if (!read.has(name))
      read.set(
        name,
        reach(name).then((host) => host.open({ checks: true })),
      );
    return read.get(name)!;
  };
  const out = new Map<Key, PullRequest[]>();
  for (const [key, all] of across) {
    const pulls: PullRequest[] = [];
    for (const r of mergeOrder(all)) {
      const waits = waitsFor(all, r.name);
      const host = r.pulls.length ? await reach(r.name) : null;
      for (const p of await openIn(r.name)) {
        if (!r.pulls.some((x) => x.number === p.number)) continue;
        p.across = {
          ref: `${r.name}#${p.number}`,
          url: host!.address(p.number),
          waits:
            waits && (waits.pull ? `${waits.name}#${waits.pull}` : waits.name),
        };
        pulls.push(p);
      }
    }
    out.set(key, pulls);
  }
  return out;
}

/** The title of each ticket elsewhere that a pull request here is part
 * of. */
async function titlesElsewhere(
  pulls: PullRequest[],
  source: Source,
  repository: string,
): Promise<Map<Key, string | null>> {
  const out = new Map<Key, string | null>();
  for (const key of new Set(pulls.flatMap((p) => p.partOf))) {
    const home = source.tickets.home(key);
    if (home === null || sameRepository(home, repository)) continue;
    const title = await source.tickets.read(key).then(
      (t) => t.title,
      () => null,
    );
    out.set(key, title);
  }
  return out;
}

/** A line for each clone left for a ticket that is finished. */
async function clonesLeft(source: Source): Promise<say.Line[]> {
  const lines: say.Line[] = [];
  for (const { key, name, folder } of source.clones()) {
    const finished = await source.tickets.read(key).then(
      (t) => t.finishedAt !== null,
      () => false,
    );
    // In full, so it can be run from a checkout of any of them.
    const full = source.tickets.keyIn(key, "");
    if (finished)
      lines.push(
        say.mark("look", [
          `${name} is still cloned for ${full}: ${folder}. `,
          `Run: factory workspace ${full} --remove`,
        ]),
      );
  }
  return lines;
}

async function snapshotLines(
  source: Source,
  target: Target,
  now: Date,
  hook: boolean,
  style: Style = PLAIN,
) {
  const links: Links = {
    ticket: (n) => source.tickets.address(n),
    pull: (n) => source.pulls.address(n),
    run: (id) => source.runner.runPage(id),
  };
  const [tickets, pulls] = await Promise.all([
    readAll(source.tickets, {
      board: target.board !== null,
      label: target.factory,
    }),
    source.pulls.open({ checks: true }),
  ]);
  const linked = linkPulls(pulls, source.tickets, source.own);
  const { across, unread } = await acrossOf(tickets, {
    tickets: source.tickets,
    repository: target.repository,
    reach: source.reach,
    inField: source.inField,
    now,
  });
  const snapshot = toSnapshot(tickets, linked, now, [], target.columns, across);
  const board = boardOf(tickets);
  const blockers = new Map<Key, Key[]>();
  for (const issue of snapshot.issues) {
    if (
      !source.tickets.blockers ||
      derive(
        issue,
        cardOf(board, issue.key, target.columns),
        snapshot.pulls,
        target.columns,
        across.get(issue.key),
      ).status !== "Ready"
    )
      continue;
    const list = await source.tickets.blockers.list(issue.key);
    blockers.set(
      issue.key,
      list.filter((b) => b.state === "open").map((b) => b.key),
    );
  }
  const rows = formatRows(
    toRows(snapshot, board, blockers, now, {
      across: await pullsAcross(
        across,
        { repository: target.repository, pulls: linked },
        source.reach,
      ),
      unread,
      elsewhere: await titlesElsewhere(linked, source, target.repository),
      watch: target.watch,
      columns: target.columns,
      ref: (k) => source.tickets.ref(k),
    }),
    now,
    !hook,
    { ...style, links, columns: target.columns },
  );
  const left = hook ? [] : await clonesLeft(source);
  return left.length ? [...rows, say.BLANK, ...left] : rows;
}

export type Deps = {
  /** The ticket system and pull requests for the target. */
  source: (settings: Settings, target: Target) => Promise<Source>;
  now: () => Date;
  out: say.Out;
  sleep: (ms: number) => Promise<unknown>;
  /** Writes screen control and whole frames for --watch, with no newline. */
  write: (text: string) => void;
  /** Registers what restores the terminal when --watch is interrupted. */
  onInterrupt: (leave: () => void) => void;
  /** Read on every draw, so --watch follows a resize. The hook is plain. */
  style?: () => Style;
  /** The factory's settings, read once when the command starts. */
  settings: () => Promise<Settings>;
  env: Record<string, string | undefined>;
};

const WATCH_MS = 15_000;
export async function main(argv: string[], d: Deps): Promise<number> {
  const hook = argv.includes("--hook");
  let target: Target;
  let settings: Settings;
  try {
    settings = await d.settings();
    target = targetOf(settings, d.env);
  } catch (error) {
    if (!(error instanceof SettingsError)) throw error;
    // Before npm ci the hook stays quiet.
    if (!(hook && error.message === NO_DEPENDENCIES))
      d.out(say.text(error.message));
    return hook ? 0 : 1;
  }
  // Read once, whatever --watch draws; a failed read says nothing.
  let token: Promise<say.Line[]> | null = null;
  const tokenLines = (source: Source) =>
    (token ??= (source.token?.() ?? Promise.resolve([])).then(
      (lines) => (lines.length ? [say.BLANK, ...lines] : []),
      () => [],
    ));
  if (hook) {
    const limit = d.sleep(HOOK_LIMIT_MS).then(() => "timeout" as const);
    const work = (async () => {
      const source = await d.source(settings, target);
      const [lines, last] = await Promise.all([
        snapshotLines(source, target, d.now(), true),
        tokenLines(source),
      ]);
      return [
        say.text("## Work in progress"),
        say.BLANK,
        say.text("```"),
        ...lines,
        say.text("```"),
        ...last,
      ];
    })().catch((error: unknown) =>
      // A credential to fix is said in place of the tickets' state.
      error instanceof CredentialError
        ? [
            say.text("## Work in progress"),
            say.BLANK,
            say.mark("fail", error.message),
          ]
        : [say.text(failureLine(error))],
    );
    const result = await Promise.race([work, limit]);
    if (result === "timeout") {
      d.out(say.text("Work status: GitHub did not answer within 20 seconds."));
    } else result.forEach((line) => d.out(line));
    return 0;
  }
  const watch = argv.includes("--watch");
  let shown = "";
  if (watch) {
    d.write(say.ENTER_SCREEN);
    d.onInterrupt(() => d.write(say.LEAVE_SCREEN));
  }
  // Opened once and kept while --watch draws; a failed open is tried again
  // on the next draw.
  let source: Source | null = null;
  for (;;) {
    let lines: say.Line[];
    let code = 0;
    const style = d.style?.() ?? PLAIN;
    try {
      source ??= await d.source(settings, target);
      const [rows, last] = await Promise.all([
        snapshotLines(source, target, d.now(), false, style),
        tokenLines(source),
      ]);
      lines = [...rows, ...last];
    } catch (error) {
      lines = [say.text(failureLine(error))];
      code = 1;
    }
    if (!watch) {
      lines.forEach((line) => d.out(line));
      return code;
    }
    const next = say.frame(lines, style.color);
    if (next !== shown) d.write(next);
    shown = next;
    await d.sleep(WATCH_MS);
  }
}

/** The style for what `run` prints to stdout. */
export const terminalStyle = (): Style =>
  styleFor(say.colorOn(), process.stdout.columns);

/** `status`'s read of the coding agent's token, over the tools it opened:
 * the repository's checkout, the factory's tools, and today, unless a test
 * gives others. */
export function tokenReader(
  settings: Settings,
  opened: Opened,
  o: {
    tools?: Registry;
    root?: string;
    env?: Record<string, string | undefined>;
    now?: () => Date;
  } = {},
): () => Promise<say.Line[]> {
  return async () => {
    const [{ tokenWarning }, { TOOLS }, { hasCommand }] = await Promise.all([
      import("./doctor.mts"),
      import("./tools.mts"),
      import("./lib/has-command.mts"),
    ]);
    return tokenWarning({
      settings,
      tools: o.tools ?? TOOLS,
      root: o.root ?? repoRoot(),
      hasCommand,
      opened,
      env: o.env ?? process.env,
      now: (o.now ?? (() => new Date()))(),
    });
  };
}

/** `factory status [--watch]`, and `factory session-start`'s second half. */
export async function run(argv: string[]): Promise<number> {
  const code = await main(argv, {
    source: async (settings, target) => {
      const { tickets } = await openTickets(settings, target);
      const codeHost = openCodeHost(target.repository, settings.codeHost.type);
      const runner = openRunner(target.repository, settings.builds.runner);
      return {
        tickets,
        pulls: codeHost,
        runner,
        token: tokenReader(settings, { codeHost, runner, tickets }),
        own: ownLinks(settings),
        reach: (name) =>
          reachCodeHost(name, settings.codeHost.type, target.repository),
        inField: settings.tickets.ticketFields.repositories !== null,
        clones: () => {
          const owner = ownerOf(target.repository);
          return clonesIn(workFolder(), owner).map((c) => ({
            ...c,
            key: tickets.key(ticketOfWord(c.word, owner)),
          }));
        },
      };
    },
    now: () => new Date(),
    out: say.printersFor(argv.includes("--hook") ? "session-start" : "status")
      .out,
    sleep,
    write: (text) => say.write(text),
    onInterrupt: (leave) => {
      for (const signal of ["SIGINT", "SIGTERM"] as const)
        process.on(signal, () => {
          leave();
          process.exit(130);
        });
    },
    style: terminalStyle,
    settings: () => loadSettings(),
    env: process.env,
  });
  // The hook's time limit leaves its read pending; exit rather than wait on it.
  process.exit(code);
}
