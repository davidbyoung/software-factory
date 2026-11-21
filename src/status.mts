#!/usr/bin/env node
// What is being refined or built, and by which session, in the terminal.
//
//   npx --no-install factory status
//   npx --no-install factory status --watch  # read again every 15 seconds
//   status --hook   # the form `factory session-start` prints
//
// Reads the board as well as the repository, so the GitHub CLI needs the
// project scope once, which `factory ticket ready` also needs to write it:
// gh auth refresh -s project
// The repository and the board come from the factory's settings, whose
// loader needs dependencies installed; before npm ci the hook prints
// nothing.
import { colorOn, painter } from "./lib/color.mts";
import { setTimeout as sleep } from "node:timers/promises";
import {
  NO_DEPENDENCIES,
  SettingsError,
  loadSettings,
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
  buildsPartOf,
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
import { boardOf, readAll, type Tickets } from "./tickets/types.mts";
import { openTickets } from "./tickets/index.mts";
import { openCodeHost, type CodeHost } from "./code-host/index.mts";
import { openRunner, type Runner } from "./runner/index.mts";
import { subscriptionDollars } from "./lib/pricing.mts";
import { dollars } from "./lib/usage.mts";
import { minutes, resultText } from "./reviewers.mts";

const HOOK_LIMIT_MS = 20_000;
const HOUR = 3600_000;

export type Row = {
  number: number;
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
  const began = markedComments(issue.comments)
    .filter((m) => m.marker.kind === kind)
    .at(-1)?.createdAt;
  if (!began) return [];
  const latest = new Map<string, ReviewerRun>();
  for (const run of issue.comments.flatMap(parseRuns)) {
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
 * issue and builds no part of the follow-ups, such as Dependabot's. */
export function toRows(
  snapshot: RepoSnapshot,
  board: Board,
  blockers: Map<number, number[]>,
  now: Date,
  /** What starts builds from the board, so that a card left in Ready is
   * worth flagging; null when builds.trigger is manual. */
  watch: Watch | null = watchOf("own-server", 5),
  columns: Columns = DEFAULT_COLUMNS,
): { rows: Row[]; closed: Row[] } {
  const rows: Row[] = [];
  const closed: Row[] = [];
  const claimed = new Set<number>();
  for (const issue of snapshot.issues) {
    const derived = derive(
      issue,
      cardOf(board, issue.number, columns),
      snapshot.pulls,
      columns,
    );
    const pulls = snapshot.pulls.filter((p) =>
      derived.pulls.includes(p.number),
    );
    pulls.forEach((p) => claimed.add(p.number));
    const flags: string[] = [];
    if (isStale(derived, now)) flags.push("stale");
    if (
      watch &&
      isNotStarted(
        derived,
        blockers.get(issue.number) ?? [],
        now,
        watch.minutes,
      )
    )
      flags.push(watch.flag);
    const row: Row = {
      number: issue.number,
      kind: "issue",
      title: issue.title,
      derived,
      pulls,
      runs: cardRuns(issue, derived),
      flags,
      cost: board.items.get(issue.number)?.cost ?? null,
    };
    (derived.status === "Done" ? closed : rows).push(row);
  }
  for (const pull of snapshot.pulls) {
    if (claimed.has(pull.number)) continue;
    const followUps = snapshot.issues.filter(
      (i) =>
        i.labels.includes("follow-up") && buildsPartOf(pull.body, i.number),
    );
    if (pull.closes.length > 0 || followUps.length > 0) continue;
    rows.push({
      number: pull.number,
      kind: "pull",
      title: `pull request by ${pull.author}`,
      derived: null,
      pulls: [pull],
      runs: [],
      flags: [],
      cost: board.items.get(pull.number)?.cost ?? null,
    });
  }
  return { rows, closed };
}

/** Where a ticket's number, a pull request's number, and an Actions run's
 * ID each lead. */
export type Links = {
  ticket: (n: number) => string;
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

const ESC = "\x1B";
type Sgr =
  | "bold"
  | "dim"
  | "underline"
  | "red"
  | "green"
  | "yellow"
  | "magenta"
  | "cyan"
  | "blueBright"
  | "whiteBright";

const GROUPS: { name: Status; color: Sgr }[] = [
  { name: "Backlog", color: "whiteBright" },
  { name: "In refinement", color: "yellow" },
  { name: "Ready", color: "green" },
  { name: "In progress", color: "cyan" },
  { name: "In review", color: "magenta" },
];
const UNLINKED = "Pull requests that close no issue";
const INDENT = "  ";
const GAP = "  ";
const MIN_TITLE = 20;
const HEADER = ["#", "Title", "Time in status", "Cost", "Session"];

/** A run of text, linked when it has a url. */
type Seg = { text: string; url?: string };

const linkTo = (kind: "ticket" | "pull", style: Style, n: number) =>
  style.links?.[kind](n);
const width = (segs: Seg[]) => segs.reduce((n, s) => n + [...s.text].length, 0);

function paint(text: string, style: Style, ...codes: Sgr[]): string {
  if (!style.color || codes.length === 0) return text;
  return painter(true)(codes, text);
}

function render(segs: Seg[], style: Style): string {
  return segs
    .map((s) =>
      s.url && style.color
        ? `${ESC}]8;;${s.url}${ESC}\\${s.text}${ESC}]8;;${ESC}\\`
        : s.text,
    )
    .join("");
}

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
  const rest = parts.join(" · ");
  return named
    ? [
        { text: "↳ Pull request " },
        { text: `#${pull.number}`, url: linkTo("pull", style, pull.number) },
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
export function runLine(run: ReviewerRun, now: Date, style: Style): string {
  const pad = (text: string, n: number) =>
    text + " ".repeat(Math.max(0, n - [...text].length));
  const stuck = isStuck(run, now);
  const result = resultText(run, now);
  const [mark, color]: [string, Sgr] = stuck
    ? ["?", "dim"]
    : {
        running: ["…", "yellow"] as [string, Sgr],
        passed: ["✓", "green"] as [string, Sgr],
        failed: ["✗", "red"] as [string, Sgr],
        "no verdict": ["?", "dim"] as [string, Sgr],
      }[run.result];
  const parts = [
    `${paint(mark, style, color)} ${pad(run.reviewer, RUN_NAME)}`,
    paint(pad(run.model, RUN_MODEL), style, "dim"),
    paint(stuck ? result : pad(result, RUN_RESULT), style, color),
  ];
  if (!stuck && run.result === "running")
    parts.push(
      paint(`${minutes(run.start, now.toISOString())} so far`, style, "dim"),
    );
  else if (!stuck) {
    const time = run.end ? minutes(run.start, run.end) : "";
    const cost =
      run.cost === undefined ? "" : dollars(subscriptionDollars(run.cost));
    parts.push(paint(pad(time, RUN_TIME), style, "dim"));
    if (cost) parts.push(paint(cost, style, "dim"));
  }
  return parts.join(GAP).trimEnd();
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
): string[] {
  const lines: string[] = [];
  if (rows.length === 0) lines.push("Nothing open.");
  else {
    const cells = rows.map((row) => {
      const url = linkTo(
        row.kind === "issue" ? "ticket" : "pull",
        style,
        row.number,
      );
      return {
        row,
        number: `#${row.number}`,
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
    const pad = (text: string, n: number) =>
      " ".repeat(Math.max(0, n - [...text].length));
    const sub = " ".repeat(subIndent);

    const head = (text: string, n = 0) =>
      paint(text, style, "bold", "underline") + pad(text, n);
    lines.push(
      INDENT +
        [
          head(HEADER[0], numW),
          head(HEADER[1], titleW),
          head(HEADER[2], timeW),
          head(HEADER[3], costW),
          head(HEADER[4]),
        ].join(GAP),
    );

    const groups = [
      ...GROUPS.map((g) => ({
        ...g,
        // The repository's column for the state, or the factory's own name
        // where the board has none.
        label: (style.columns ?? DEFAULT_COLUMNS)[g.name]?.[0] ?? g.name,
        cells: cells.filter(
          (c) => c.row.kind === "issue" && c.row.derived?.status === g.name,
        ),
        always: true,
      })),
      {
        name: UNLINKED,
        label: UNLINKED,
        color: "whiteBright" as Sgr,
        cells: cells.filter((c) => c.row.kind === "pull"),
        always: false,
      },
    ];
    for (const group of groups) {
      if (!group.always && group.cells.length === 0) continue;
      const count = String(group.cells.length);
      lines.push(
        "",
        group.cells.length
          ? `${paint(group.label, style, "bold", group.color)}  ${paint(count, style, "dim")}`
          : paint(`${group.label}  ${count}`, style, "dim"),
      );
      for (const c of group.cells) {
        const title = fit([{ text: c.row.title, url: c.url }], titleW);
        const session =
          c.session === "Waiting on you"
            ? paint(c.session, style, "bold", "yellow")
            : render(sessionSegs(c.session, c.row.derived, style.links), style);
        lines.push(
          (
            INDENT +
            paint(
              render([{ text: c.number, url: c.url }], style),
              style,
              "blueBright",
            ) +
            pad(c.number, numW) +
            GAP +
            render(title, style) +
            pad(title.map((s) => s.text).join(""), titleW) +
            GAP +
            paint(c.time, style, "dim") +
            pad(c.time, timeW) +
            GAP +
            c.cost +
            pad(c.cost, costW) +
            GAP +
            session
          ).trimEnd(),
        );
        for (const pull of c.row.pulls)
          lines.push(
            sub +
              paint(
                render(
                  fit(
                    pullLine(pull, now, c.row.kind === "issue", style),
                    subMax,
                  ),
                  style,
                ),
                style,
                "dim",
              ),
          );
        for (const run of c.row.runs)
          lines.push(sub + runLine(run, now, style));
        for (const flag of c.row.flags)
          lines.push(
            sub +
              paint(
                render(fit([{ text: `⚠ ${flag}` }], subMax), style),
                style,
                "red",
              ),
          );
      }
    }
  }
  if (withClosed && closed.length > 0)
    lines.push(
      "",
      `${paint("Closed in the last 24 hours:", style, "dim")} ${closed
        .map((r) =>
          paint(
            render(
              [
                {
                  text: `#${r.number}`,
                  url: linkTo("ticket", style, r.number),
                },
              ],
              style,
            ),
            style,
            "blueBright",
          ),
        )
        .join(", ")}`,
    );
  return lines;
}

/** The one line a failed read prints. */
export function failureLine(error: unknown): string {
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
};

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
    readAll(source.tickets, { board: target.board !== null }),
    source.pulls.open({ checks: true }),
  ]);
  const snapshot = toSnapshot(tickets, pulls, now);
  const board = boardOf(tickets);
  const blockers = new Map<number, number[]>();
  for (const issue of snapshot.issues) {
    if (
      !source.tickets.blockers ||
      derive(
        issue,
        cardOf(board, issue.number, target.columns),
        snapshot.pulls,
        target.columns,
      ).status !== "Ready"
    )
      continue;
    const list = await source.tickets.blockers.list(issue.number);
    blockers.set(
      issue.number,
      list.filter((b) => b.state === "open").map((b) => b.number),
    );
  }
  return formatRows(
    toRows(snapshot, board, blockers, now, target.watch, target.columns),
    now,
    !hook,
    { ...style, links, columns: target.columns },
  );
}

export type Deps = {
  /** The ticket system and pull requests for the target. */
  source: (settings: Settings, target: Target) => Promise<Source>;
  now: () => Date;
  out: (line: string) => void;
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
// The alternate screen with the cursor hidden, and back.
const ENTER = `${ESC}[?1049h${ESC}[?25l`;
const LEAVE = `${ESC}[?25h${ESC}[?1049l`;

/** A frame that overwrites the one on screen: home, each line erased to its
 * end, then everything below. No newline ends it, which would scroll a
 * frame as tall as the window. */
export function frame(lines: string[]): string {
  return `${ESC}[H${lines.map((l) => `${l}${ESC}[K`).join("\n")}${ESC}[J`;
}

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
    if (!(hook && error.message === NO_DEPENDENCIES)) d.out(error.message);
    return hook ? 0 : 1;
  }
  if (hook) {
    const limit = d.sleep(HOOK_LIMIT_MS).then(() => "timeout" as const);
    const work = (async () => {
      const source = await d.source(settings, target);
      return [
        "## Work in progress",
        "",
        "```",
        ...(await snapshotLines(source, target, d.now(), true)),
        "```",
      ];
    })().catch((error: unknown) => [failureLine(error)]);
    const result = await Promise.race([work, limit]);
    if (result === "timeout") {
      d.out("Work status: GitHub did not answer within 20 seconds.");
    } else result.forEach((line) => d.out(line));
    return 0;
  }
  const watch = argv.includes("--watch");
  let shown = "";
  if (watch) {
    d.write(ENTER);
    d.onInterrupt(() => d.write(LEAVE));
  }
  // Opened once and kept while --watch draws; a failed open is tried again
  // on the next draw.
  let source: Source | null = null;
  for (;;) {
    let lines: string[];
    let code = 0;
    try {
      source ??= await d.source(settings, target);
      lines = await snapshotLines(
        source,
        target,
        d.now(),
        false,
        d.style?.() ?? PLAIN,
      );
    } catch (error) {
      lines = [failureLine(error)];
      code = 1;
    }
    if (!watch) {
      lines.forEach((line) => d.out(line));
      return code;
    }
    const next = frame(lines);
    if (next !== shown) d.write(next);
    shown = next;
    await d.sleep(WATCH_MS);
  }
}

/** The style for what `run` prints to stdout. */
export const terminalStyle = (): Style =>
  styleFor(colorOn(), process.stdout.columns);

/** `factory status [--watch]`, and `factory session-start`'s second half. */
export async function run(argv: string[]): Promise<number> {
  const code = await main(argv, {
    source: async (settings, target) => {
      const { tickets } = await openTickets(settings, target);
      return {
        tickets,
        pulls: openCodeHost(target.repository, settings.codeHost.type),
        runner: openRunner(target.repository, settings.builds.runner),
      };
    },
    now: () => new Date(),
    out: (line) => console.log(line),
    sleep,
    write: (text) => process.stdout.write(text),
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
