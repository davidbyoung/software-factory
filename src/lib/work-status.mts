// Who is working on what, read from the marker comments sessions post on a
// ticket and from the board's Status. The terminal view
// (`factory status`), the board sync (`factory board`), and the
// poller (`factory poller`) all decide from this one module, so they
// cannot disagree. It reads tickets as the ticket interface returns them
// (`tickets/types.mts`) and never calls a ticket system itself.
import { TICKET_LABELS } from "../labels.mts";
import {
  AGENT_MARK,
  CI_BOT,
  MERGED_MARKER,
  linesOutsideFences,
  renderEntry,
} from "../tickets/record-comments.mts";
import type {
  Board,
  BoardItem,
  Entry,
  Key,
  NewEntry,
  Ticket,
  TicketComment,
} from "../tickets/types.mts";
import { listed } from "./listed.mts";
import { listMarker, listText, standing } from "./repositories.mts";
import type { Listed, Progress } from "./repositories.mts";
import type { CostNote } from "./usage.mts";

export type { Board, BoardField, BoardItem } from "../tickets/types.mts";
export { AGENT_MARK, CI_BOT };

export const STATUSES = [
  "Backlog",
  "In refinement",
  "Ready",
  "In progress",
  "In review",
  "Done",
] as const;
export type Status = (typeof STATUSES)[number];

/** The six states a ticket moves through, by the key a repository's
 * settings use for each. Inside the code a state stays one of `Status`; a
 * board's own column names are applied only where the board is read and
 * where it is written. */
export const STATE_KEYS = {
  backlog: "Backlog",
  refining: "In refinement",
  ready: "Ready",
  building: "In progress",
  review: "In review",
  done: "Done",
} as const satisfies Record<string, Status>;
export type StateKey = keyof typeof STATE_KEYS;

/** The columns each state has on the board, the first the one a ticket
 * moves to, or null for a board with none. */
export type Columns = Record<Status, readonly string[] | null>;

/** The factory's own board: every state has the column of its own name. */
export const DEFAULT_COLUMNS: Columns = {
  Backlog: ["Backlog"],
  "In refinement": ["In refinement"],
  Ready: ["Ready"],
  "In progress": ["In progress"],
  "In review": ["In review"],
  Done: ["Done"],
};

/** A name matches whatever its capitals and the spaces around it. */
export const sameName = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** The columns a ticket in `status` shows in: its own, or else the
 * nearest earlier state's. Nothing but an approved ticket shows in the
 * Ready column, so a state with no column passes over it. */
export function columnsFor(
  status: Status,
  columns: Columns,
): readonly string[] {
  for (let i = STATUSES.indexOf(status); i >= 0; i--) {
    const names = columns[STATUSES[i]];
    if (names !== null && (STATUSES[i] !== "Ready" || status === "Ready"))
      return names;
  }
  return columns.Backlog ?? ["Backlog"];
}

/** The column a ticket in `status` moves to: the first of `columnsFor`. */
export const columnFor = (status: Status, columns: Columns): string =>
  columnsFor(status, columns)[0]!;

/** The state that lists a column named `name`, or null when none does. */
export function statusOfColumn(name: string, columns: Columns): Status | null {
  return (
    STATUSES.find((s) => columns[s]?.some((c) => sameName(c, name))) ?? null
  );
}

/** How a sentence names where the card is: "In progress" when the state has
 * a column of its own, "in Todo" when it shows in another's. */
function cardAt(status: Status, columns: Columns): string {
  const name = columnFor(status, columns);
  return columns[status] === null ? `in ${name}` : name;
}
export type RunsIn = "Local" | "Actions" | "";
/** Where a session runs: on a person's machine, or in a GitHub Actions run. */
export type SessionKind = "local" | "actions";
/** Where a marker says its session ran. `cloud` is only read, from comments
 * posted before unattended runs moved to GitHub Actions; nothing writes it. */
export type MarkedWhere = SessionKind | "cloud";

export type Marker =
  | { kind: "refining"; where: MarkedWhere; id: string }
  | { kind: "waiting" }
  | { kind: "refined" }
  | { kind: "started"; where: MarkedWhere; marker: string }
  | { kind: "claim"; where: MarkedWhere; id: string }
  | { kind: "released" }
  | { kind: "cleared" }
  | { kind: "partial" }
  | { kind: "merged" }
  | { kind: "finished" };

export type IssueComment = TicketComment;

/** An entry carrying a marker, in the order the rules read them. */
export type Marked = Entry & { marker: Marker };

const MARKER_LINE =
  /^<!-- work-status: (?:(refining|claim) (local|cloud|actions) (\S+)|started (cloud|actions) (\S+)|(waiting|refined|released|cleared|partial|merged|finished)) -->$/;

/** The work-status markers among an entry's marker lines. */
export function parseMarkers(markers: string[]): Marker[] {
  const found: Marker[] = [];
  for (const line of markers) {
    const match = MARKER_LINE.exec(line);
    if (!match) continue;
    const [, session, where, id, startWhere, started, bare] = match;
    if (session === "refining" || session === "claim") {
      found.push({ kind: session, where: where as MarkedWhere, id });
    } else if (started) {
      found.push({
        kind: "started",
        where: startWhere as MarkedWhere,
        marker: started,
      });
    } else {
      found.push({
        kind: bare as
          | "waiting"
          | "refined"
          | "released"
          | "cleared"
          | "partial"
          | "merged"
          | "finished",
      });
    }
  }
  return found;
}

// Cost markers, which say what a session or a pull request review spent at API list
// prices: `<!-- cost: 3.41 session=ID -->` from a session,
// `<!-- cost: 0.92 -->` from the pull request review's summary.

const COST_LINE = /^<!-- cost: (\d+(?:\.\d+)?)(?: session=\S+)? -->$/;

/** Whether a body already carries a cost marker, read as `parseCosts` reads
 * one: on a line of its own, outside a fenced code block. A marker quoted in
 * prose does not count. */
export function hasCostMarker(body: string): boolean {
  return linesOutsideFences(body).some((line) => COST_LINE.test(line));
}

/** The cost markers in one pull request comment, read as markers are: each
 * on a line of its own, outside a fenced code block. A comment counts when
 * it carries the agent mark, whoever posted it, or when the pull request
 * review's bot posted it. */
export function parseCosts(comment: IssueComment): number[] {
  if (!comment.body.includes(AGENT_MARK) && comment.author !== CI_BOT)
    return [];
  return linesOutsideFences(comment.body).flatMap((line) => {
    const match = COST_LINE.exec(line);
    return match ? [Number(match[1])] : [];
  });
}

const TOTAL_LINE = /^<!-- cost-total: (\d+(?:\.\d+)?) session=(\S+) -->$/;

/** A session's newest running total on the ticket, or 0 with none. */
export function sessionTotal(record: Entry[], session: string): number {
  let total = 0;
  for (const entry of record)
    for (const line of entry.markers) {
      const match = TOTAL_LINE.exec(line);
      if (match && match[2] === session) total = Number(match[1]);
    }
  return total;
}

/** The issue's Cost, to the cent: each session's newest running total on
 * it, added up, and every `cost:` marker on it and on each pull request,
 * open, merged, or closed, that builds it. Null when there are none. */
export function issueCost(issue: Issue, pulls: PullRequest[]): number | null {
  const totals = new Map<string, number>();
  const costs: number[] = [];
  for (const entry of issue.record)
    for (const line of entry.markers) {
      const total = TOTAL_LINE.exec(line);
      if (total) totals.set(total[2], Number(total[1]));
      const cost = COST_LINE.exec(line);
      if (cost) costs.push(Number(cost[1]));
    }
  for (const pull of pulls)
    if (pull.closes.includes(issue.key) || pull.partOf.includes(issue.key))
      for (const c of pull.comments ?? []) costs.push(...parseCosts(c));
  const all = [...totals.values(), ...costs];
  if (all.length === 0) return null;
  return Math.round(all.reduce((a, b) => a + b, 0) * 100) / 100;
}

// Reviewer runs, which the SubagentStart and SubagentStop hooks record in one
// "Reviewers in this session" comment per session
// (`factory reviewers`). Each row carries a hidden copy of itself.

export const REVIEWER_RUNS_MARK = "<!-- reviewer-runs session=";

export type RunResult = "running" | "passed" | "failed" | "no verdict";

export type ReviewerRun = {
  /** The subagent's ID, which ties a finish to its start. */
  id: string;
  reviewer: string;
  model: string;
  start: string;
  end?: string;
  result: RunResult;
  findings?: number;
  cost?: number;
};

const RUN_LINE = /^<!-- reviewer-run: (\{.*\}) -->$/;

export function runLine(run: ReviewerRun): string {
  return `<!-- reviewer-run: ${JSON.stringify(run)} -->`;
}

/** The runs in a session's reviewer-runs entry. */
export function parseRuns(entry: Entry): ReviewerRun[] {
  if (!entry.markers.some((m) => m.startsWith(REVIEWER_RUNS_MARK))) return [];
  return entry.markers.flatMap((line) => {
    const match = RUN_LINE.exec(line);
    if (!match) return [];
    try {
      const run = JSON.parse(match[1]) as ReviewerRun;
      return typeof run.reviewer === "string" &&
        typeof run.start === "string" &&
        !Number.isNaN(Date.parse(run.start))
        ? [run]
        : [];
    } catch {
      return [];
    }
  });
}

/** How long a run may say "running" before it reads as one that never
 * recorded its finish. */
export const STUCK_AFTER_MS = 2 * 60 * 60 * 1000;

export const isStuck = (run: ReviewerRun, now: Date) =>
  run.result === "running" &&
  now.getTime() - Date.parse(run.start) > STUCK_AFTER_MS;

// Entries with the same time keep the order the ticket system returned
// them in: the sort is stable, and their IDs are opaque.
function byTime(a: Entry, b: Entry): number {
  return Date.parse(a.at) - Date.parse(b.at);
}

export function markedComments(record: Entry[]): Marked[] {
  return [...record]
    .sort(byTime)
    .flatMap((entry) =>
      parseMarkers(entry.markers).map((marker) => ({ ...entry, marker })),
    );
}

export type WorkState = {
  /** The claim that holds the issue now. */
  live: Marked | null;
  /** The newest claim that was ever live, for In review and Done. */
  lastLive: Marked | null;
  /** A start the poller posted that no claim, release, clear, or refinement
   * start has followed. */
  start: Marked | null;
};

/** A claim is live when it was posted while no other claim was, and no
 * release or clear has followed. A claim posted while another was live never
 * counts, so a losing run that crashes before deleting it blocks nothing. */
export function workState(comments: Entry[]): WorkState {
  let live: Marked | null = null;
  let lastLive: Marked | null = null;
  let start: Marked | null = null;
  for (const marked of markedComments(comments)) {
    switch (marked.marker.kind) {
      case "claim":
        if (!live) live = lastLive = marked;
        start = null;
        break;
      case "released":
      case "cleared":
      case "partial":
      case "finished":
        live = null;
        start = null;
        break;
      case "refining":
        start = null;
        break;
      case "started":
        start = marked;
        break;
    }
  }
  return { live, lastLive, start };
}

/** A card's state, read through the board's columns. "Unmapped" is a column
 * no state names, which the factory leaves alone. */
export type BoardCard = {
  status: string | null;
  updatedAt: string | null;
};

export type PullRequest = {
  number: number;
  createdAt: string;
  body: string;
  /** The tickets it closes when it merges. The code host fills it with its
   * own links, and `linkPulls` (`lib/pull-tickets.mts`) with what the
   * factory counts. */
  closes: Key[];
  /** The tickets its body says it builds part of, once `linkPulls` has
   * read it; empty before. */
  partOf: Key[];
  isDraft: boolean;
  checks: string | null;
  openThreads: number;
  author: string;
  /** Read for the cost markers on it. */
  comments?: IssueComment[];
  /** How it is written where it may be in another repository, its page,
   * and what it waits for, for a ticket that names several. */
  across?: { ref: string; url: string; waits: string | null };
};

/** A ticket as the rules read it: its body is not needed. */
export type Issue = Omit<Ticket, "body" | "card" | "comments"> & {
  body?: string;
  comments?: TicketComment[];
};

export type Derived = {
  status: Status;
  session: string;
  runsIn: RunsIn;
  /** When the issue entered this Status, or null when nothing records it. */
  since: string | null;
  /** Open pull requests that put the issue In review. */
  pulls: number[];
  /** The open pull requests of a ticket that names other repositories, in
   * every one of them. */
  across?: { repository: string; number: number }[];
};

/** The pull requests that put this issue In review: those that close it,
 * and on the follow-ups ticket, labeled `followUp`, those that build part
 * of it. */
export function reviewingPulls(
  issue: Issue,
  pulls: PullRequest[],
  followUp: string = TICKET_LABELS["follow-up"],
) {
  return pulls.filter(
    (pull) =>
      pull.closes.includes(issue.key) ||
      (issue.labels.includes(followUp) && pull.partOf.includes(issue.key)),
  );
}

const READY_RESETS = new Set([
  "released",
  "cleared",
  "partial",
  "refined",
  "refining",
  "waiting",
  "finished",
]);

// An old `cloud` marker leaves "Runs in" empty: nothing writes it any more.
const RUNS_IN: Record<MarkedWhere, RunsIn> = {
  local: "Local",
  cloud: "",
  actions: "Actions",
};
const runsIn = (where: MarkedWhere): RunsIn => RUNS_IN[where];
// With no "Runs in" value to say where an old cloud session ran, its Session
// says so, as plain text.
const sessionText = (where: MarkedWhere, id: string) =>
  where === "cloud" ? `cloud ${id}` : id;

/** The page of an Actions run, from the board's or the view's session: the
 * run's ID, which `runPage` turns into its page. Null for any other
 * session. */
export function actionsRunLink(
  derived: Pick<Derived, "session" | "runsIn">,
  runPage: (id: string) => string,
): string | null {
  if (derived.runsIn !== "Actions" || !/^\d+$/.test(derived.session))
    return null;
  return runPage(derived.session);
}

function claimSession(
  claim: Marked | null,
): Pick<Derived, "session" | "runsIn"> {
  if (!claim || claim.marker.kind !== "claim")
    return { session: "", runsIn: "" };
  return {
    session: sessionText(claim.marker.where, claim.marker.id),
    runsIn: runsIn(claim.marker.where),
  };
}

/** When the ticket became done: the merge the factory recorded, else its
 * card's last move while in a done column, else when the ticket system
 * finished it. Undefined while it is not done; null when it is done and
 * nothing records when. */
export function doneAt(
  issue: Pick<Issue, "record" | "finishedAt">,
  card: BoardCard | null,
): string | null | undefined {
  const merged = markedComments(issue.record)
    .filter((m) => m.marker.kind === "merged")
    .at(-1);
  if (merged) return merged.at;
  if (card?.status === "Done") return card.updatedAt;
  if (issue.finishedAt !== null) return issue.finishedAt;
  return undefined;
}

/** An issue's Status is the first rule that applies: Done, In review,
 * In progress, Ready, In refinement, Backlog. */
export function derive(
  issue: Issue,
  card: BoardCard | null,
  pulls: PullRequest[],
  columns: Columns = DEFAULT_COLUMNS,
  followUp: string = TICKET_LABELS["follow-up"],
  /** Each of the ticket's repositories with its pull requests, when it
   * names others than its own. */
  repositories?: Progress[],
): Derived {
  const found = deriveOwn(issue, card, pulls, columns, followUp, repositories);
  if (!repositories) return found;
  return {
    ...found,
    across: standing(repositories).open.map(({ repository, number }) => ({
      repository,
      number,
    })),
  };
}

function deriveOwn(
  issue: Issue,
  card: BoardCard | null,
  pulls: PullRequest[],
  columns: Columns,
  followUp: string,
  repositories: Progress[] | undefined,
): Derived {
  const work = workState(issue.record);
  const marked = markedComments(issue.record);

  const done = doneAt(issue, card);
  if (done !== undefined) {
    return {
      status: "Done",
      ...claimSession(work.lastLive),
      since: done,
      pulls: [],
    };
  }

  const stands = repositories ? standing(repositories) : null;
  if (stands?.reviewing)
    return {
      status: "In review",
      ...claimSession(work.lastLive),
      since: stands.open.map((p) => p.at).sort()[0] ?? null,
      pulls: [],
    };

  const reviewing = stands ? [] : reviewingPulls(issue, pulls, followUp);
  if (reviewing.length > 0) {
    const first = [...reviewing].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    )[0];
    return {
      status: "In review",
      ...claimSession(work.lastLive),
      since: first.createdAt,
      pulls: reviewing.map((pull) => pull.number),
    };
  }

  if (work.live) {
    return {
      status: "In progress",
      ...claimSession(work.live),
      since: work.live.at,
      pulls: [],
    };
  }
  if (work.start) {
    const where =
      work.start.marker.kind === "started" ? work.start.marker.where : "cloud";
    return {
      status: "In progress",
      session: `${where}, starting`,
      runsIn: runsIn(where),
      since: work.start.at,
      pulls: [],
    };
  }

  if (card?.status === "Ready" && card.updatedAt) {
    const reset = marked.filter((m) => READY_RESETS.has(m.marker.kind)).at(-1);
    if (!reset || Date.parse(card.updatedAt) > Date.parse(reset.at)) {
      return {
        status: "Ready",
        session: "",
        runsIn: "",
        since: card.updatedAt,
        pulls: [],
      };
    }
  }

  // Past the session rules, the newest marker says where the card stands. A
  // card moves only forward on its own: when the next step is the owner's,
  // it stays where it is, waiting on them, until they move it. Their move
  // to Backlog wins once it is later than that marker.
  const newest = marked.at(-1);
  const waitingOn = (status: Status, since: string): Derived => ({
    status,
    session: "Waiting on you",
    runsIn: "",
    since,
    pulls: [],
  });
  const backlog = (since: string | null): Derived => ({
    status: "Backlog",
    session: "",
    runsIn: "",
    since,
    pulls: [],
  });
  if (!newest) return backlog(card?.updatedAt ?? null);
  // A card in the backlog column says the owner sent the ticket back only
  // when the ticket's own state shows in another column: where it shows in
  // that one too, the sync put the card there.
  const ownerBacklog =
    card?.status === "Backlog" &&
    card.updatedAt !== null &&
    Date.parse(card.updatedAt) > Date.parse(newest.at) &&
    !(newest.marker.kind === "waiting" || newest.marker.kind === "refined"
      ? sameName(
          columnFor("In refinement", columns),
          columnFor("Backlog", columns),
        )
      : newest.marker.kind === "released" || newest.marker.kind === "cleared"
        ? sameName(
            columnFor("In progress", columns),
            columnFor("Backlog", columns),
          )
        : false)
      ? card.updatedAt
      : null;

  if (stands?.partly)
    return ownerBacklog
      ? backlog(ownerBacklog)
      : waitingOn("In progress", newest.at);

  switch (newest.marker.kind) {
    case "refining":
      return {
        status: "In refinement",
        session: sessionText(newest.marker.where, newest.marker.id),
        runsIn: runsIn(newest.marker.where),
        since: newest.at,
        pulls: [],
      };
    case "waiting":
    case "refined":
      return ownerBacklog
        ? backlog(ownerBacklog)
        : waitingOn("In refinement", newest.at);
    case "released":
    case "cleared":
      return ownerBacklog
        ? backlog(ownerBacklog)
        : waitingOn("In progress", newest.at);
    case "partial":
      return backlog(ownerBacklog ?? newest.at);
    default:
      return backlog(card?.updatedAt ?? null);
  }
}

const HOUR = 60 * 60 * 1000;

/** Over 24 hours In progress or In refinement with a session. */
export function isStale(derived: Derived, now: Date): boolean {
  if (derived.status !== "In progress" && derived.status !== "In refinement")
    return false;
  if (!derived.session || derived.session === "Waiting on you") return false;
  return (
    derived.since !== null &&
    now.getTime() - Date.parse(derived.since) > 24 * HOUR
  );
}

/** How long a card may sit in Ready before the poller should have started
 * it, and what the flag asks then; null when nothing starts builds from
 * the board. A schedule runs every few minutes and often late, so it gets
 * its interval and 15 minutes more. `pollerIn` is the repository whose
 * schedule it is, when it is not the repository's own. */
export type Watch = { minutes: number; flag: string };

export function watchOf(
  trigger: "own-server" | "github-action" | "manual",
  pollMinutes: number,
  pollerIn?: string,
): Watch | null {
  if (trigger === "manual") return null;
  if (trigger === "github-action")
    return {
      minutes: pollMinutes + 15,
      flag: pollerIn
        ? `not started, is the poller in ${pollerIn} running?`
        : "not started, is the poller's job in factory.yml running?",
    };
  return { minutes: 5, flag: "not started, is the poller running?" };
}

/** Ready for longer than the poller takes, with no start: it should have
 * fired. */
export function isNotStarted(
  derived: Derived,
  openBlockers: Key[],
  now: Date,
  minutes = 5,
): boolean {
  return (
    derived.status === "Ready" &&
    openBlockers.length === 0 &&
    derived.since !== null &&
    now.getTime() - Date.parse(derived.since) > minutes * 60 * 1000
  );
}

/** A claim or start over 24 hours old with no pull request, which the
 * nightly sync clears. Null when there is nothing to clear. */
export function toClear(
  issue: Issue,
  pulls: PullRequest[],
  now: Date,
  followUp: string = TICKET_LABELS["follow-up"],
  repositories?: Progress[],
): {
  kind: "claim" | "start";
  since: string;
} | null {
  const built = repositories
    ? !standing(repositories).unbuilt
    : reviewingPulls(issue, pulls, followUp).length > 0;
  if (issue.finishedAt !== null || built) return null;
  const work = workState(issue.record);
  const old = (m: Marked | null) =>
    m !== null && now.getTime() - Date.parse(m.at) > 24 * HOUR;
  if (old(work.live)) return { kind: "claim", since: work.live!.at };
  if (old(work.start)) {
    return { kind: "start", since: work.start!.at };
  }
  return null;
}

/** "2026-11-09 14:05 UTC" */
export function utc(iso: string): string {
  return `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export type Identity = {
  where: SessionKind;
  id: string;
  link?: string;
  /** Who started an Actions run. */
  actor?: string;
};

/** The comments sessions, the poller, and the sync post: one visible
 * sentence, then its marker line and the agent mark. */
/** A ticket as a comment names it: its key, for a command, and its written
 * form, for prose. */
export type Named = { key: Key; ref: string };

export type CommentKind =
  | { kind: "refining"; who: Identity }
  | { kind: "waiting"; cost?: CostNote }
  | {
      kind: "refined";
      issue: Named;
      before?: string;
      cost?: CostNote;
    }
  | { kind: "started"; marker: string }
  | {
      kind: "dispatch-failed";
      issue: Named;
      status: string;
      reason: string;
    }
  | { kind: "claim"; who: Identity }
  | {
      kind: "stopped";
      where: SessionKind;
      issue: Named;
      reason: string;
      cost?: CostNote;
    }
  | { kind: "cost"; cost: CostNote }
  | { kind: "ended"; issue: Named }
  | { kind: "cleared-claim"; issue: Named; since: string }
  | { kind: "cleared-start"; issue: Named; since: string }
  | { kind: "follow-ups-merged"; pull: number }
  | { kind: "pull-closed"; issue: Named; pull: number; repository?: string }
  | {
      kind: "built-next";
      built: { repository: string; pull: number };
      next: string;
      marker: string;
    }
  | { kind: "repository-added"; added: string[] }
  | { kind: "repositories"; list: Listed[] }
  | { kind: "all-merged"; pulls: { repository: string; number: number }[] }
  | { kind: "merged"; pull: number; link: string };

function sessionPhrase(who: Identity): string {
  if (who.where === "actions") {
    const run = who.link ? `[${who.id}](${who.link})` : who.id;
    const by = who.actor ? `, started by @${who.actor}` : "";
    return `in GitHub Actions, run ${run}${by}.`;
  }
  const where = "in a local session";
  if (who.id === "unknown") return `${where}.`;
  return `${where}, ${who.id}.`;
}

/** "The card stays In progress, waiting on you." */
const waiting = (columns: Columns) =>
  `The card stays ${cardAt("In progress", columns)}, waiting on you.`;

/** Where a ticket can be sent to build again: the Ready column when the
 * board has one, and always a session. */
const again = (issue: Named, columns: Columns) => {
  const ready = columns.Ready?.[0] ?? null;
  if (ready === null)
    return `To try again, tell a session to build ${issue.ref}, or run \`factory build ${issue.key}\`.`;
  return `Move it to ${ready} to try again.`;
};

/** What the factory records for each kind, and whether a person has to
 * read it: a stop that waits on someone, refinement's closing note, and
 * the merge's note do; a claim, a start, or a cost does not. */
export function entryFor(
  c: CommentKind,
  columns: Columns = DEFAULT_COLUMNS,
): NewEntry {
  const markers = (marker: string, cost?: CostNote) =>
    [cost?.marker, `<!-- work-status: ${marker} -->`].filter(
      (m): m is string => !!m,
    );
  const entry = (
    marker: string,
    text: string,
    tellsPerson: boolean,
    cost?: CostNote,
  ): NewEntry => ({ text, markers: markers(marker, cost), tellsPerson });
  // A session's cost note goes after what the entry says.
  const withCost = (text: string, cost: CostNote | undefined) =>
    cost ? `${text}\n\n${cost.text}` : text;
  const WAITING = waiting(columns);
  const ready = columns.Ready?.[0] ?? null;
  switch (c.kind) {
    case "cost":
      return {
        text: c.cost.text,
        markers: c.cost.marker ? [c.cost.marker] : [],
        tellsPerson: false,
      };
    case "refining":
      return entry(
        `refining ${c.who.where} ${c.who.id}`,
        `Refining this issue ${sessionPhrase(c.who)}`,
        false,
      );
    case "waiting":
      return entry(
        "waiting",
        withCost(
          "Refinement is waiting on you: the questions are in the comment above.",
          c.cost,
        ),
        false,
        c.cost,
      );
    case "refined": {
      const sentence =
        ready === null
          ? `Refinement is done. This board has no column for approving a build: tell a session to build ${c.issue.ref}, or run \`factory build ${c.issue.key}\`.`
          : `Refinement is done. The card stays ${cardAt("In refinement", columns)} until it moves to ${ready}, which starts a build in GitHub Actions: move it there, or ask this session to. To build it on your machine instead, tell a local session to work ${c.issue.ref}.`;
      const before = c.before?.trimEnd();
      const lead = [before, c.cost?.text].filter(Boolean).join("\n\n");
      return entry(
        "refined",
        lead ? `${lead}\n\n${sentence}` : sentence,
        true,
        c.cost,
      );
    }
    case "started":
      return entry(
        `started actions ${c.marker}`,
        `Starting a build in GitHub Actions: the card moved to ${ready ?? "Ready"}.`,
        false,
      );
    case "dispatch-failed":
      return entry(
        "released",
        `Could not start a build in GitHub Actions: GitHub answered ${c.status} (${c.reason}). ${WAITING} ${again(c.issue, columns)}`,
        true,
      );
    case "claim":
      return entry(
        `claim ${c.who.where} ${c.who.id}`,
        `Building this ${sessionPhrase(c.who)}`,
        false,
      );
    case "stopped": {
      const head = `Stopped without a pull request: ${c.reason}. ${WAITING}`;
      const tail =
        c.where === "actions"
          ? `Run \`factory build ${c.issue.key}\` to try again${ready === null ? "." : `, or move it to ${ready}.`}`
          : `Tell a session to work ${c.issue.ref} again${ready === null ? "." : `, or move it to ${ready} to build it in GitHub Actions.`}`;
      return entry(
        "released",
        withCost(`${head} ${tail}`, c.cost),
        true,
        c.cost,
      );
    }
    case "ended":
      return entry(
        "released",
        `The run ended without a pull request. ${WAITING} ${again(c.issue, columns)}`,
        true,
      );
    case "cleared-claim":
      return entry(
        "cleared",
        `Cleared the claim from ${utc(c.since)}: no pull request after 24 hours, so that session has stopped. ${WAITING} ${again(c.issue, columns)}`,
        true,
      );
    case "cleared-start":
      return entry(
        "cleared",
        `Cleared the build started ${utc(c.since)}: no claim or pull request after 24 hours. ${WAITING} ${again(c.issue, columns)}`,
        true,
      );
    case "follow-ups-merged":
      return entry(
        "partial",
        `Pull request #${c.pull} merged part of these follow-ups. The unchecked lines wait for the next build; the card is back in ${columnFor("Backlog", columns)}.`,
        false,
      );
    case "pull-closed": {
      const closed =
        c.repository === undefined
          ? `Pull request #${c.pull}`
          : `${c.repository}#${c.pull}`;
      return entry(
        "released",
        ready === null
          ? `${closed} was closed without merging. ${WAITING} Tell a session to build ${c.issue.ref}, or run \`factory build ${c.issue.key}\`, to rebuild it, or ask a session to refine it first.`
          : `${closed} was closed without merging. ${WAITING} Move it to ${ready} to rebuild it, or ask a session to refine it first.`,
        true,
      );
    }
    case "built-next":
      return {
        text: `Built in ${c.built.repository}: ${c.built.repository}#${c.built.pull}. Starting the build in ${c.next}.`,
        markers: [
          "<!-- work-status: released -->",
          `<!-- work-status: started actions ${c.marker} -->`,
        ],
        tellsPerson: false,
      };
    case "repository-added":
      return entry(
        "released",
        `${listed(c.added)} ${c.added.length === 1 ? "was" : "were"} added. ${WAITING}`,
        true,
      );
    case "repositories":
      return {
        text: `Repositories: ${listText(c.list)}.`,
        markers: [listMarker(c.list)],
        tellsPerson: false,
      };
    case "all-merged":
      return entry(
        "finished",
        `Every repository merged: ${c.pulls.map((p) => `${p.repository}#${p.number}`).join(", ")}.`,
        true,
      );
    case "merged":
      return {
        text: `Merged in pull request #${c.pull}: ${c.link}`,
        markers: [MERGED_MARKER],
        tellsPerson: true,
      };
  }
}

/** The entry as GitHub posts it, as a comment. */
export const commentBody = (
  c: CommentKind,
  columns: Columns = DEFAULT_COLUMNS,
): string => renderEntry(entryFor(c, columns));

export type RepoSnapshot = {
  issues: Issue[];
  /** The open pull requests: each puts the issues it builds In review. */
  pulls: PullRequest[];
  /** Closed and merged pull requests that mentioned an issue, read only
   * for their cost markers. */
  donePulls?: PullRequest[];
  /** How far each repository is, for a ticket that names others than its
   * own. */
  across?: Map<Key, Progress[]>;
};

/** What the views and the sync work from: the open tickets and those
 * closed in the last day, from what "Read everything at once" returned, and
 * the pull requests. */
export function toSnapshot(
  tickets: Issue[],
  pulls: PullRequest[],
  now: Date,
  donePulls: PullRequest[] = [],
  columns: Columns = DEFAULT_COLUMNS,
  across?: Map<Key, Progress[]>,
): RepoSnapshot {
  const day = 24 * HOUR;
  const issues = tickets.filter((t) => {
    const card = (t as Partial<Ticket>).card ?? null;
    const done = doneAt(
      t,
      card
        ? {
            status:
              card.status === null
                ? null
                : statusOfColumn(card.status, columns),
            updatedAt: card.updatedAt,
          }
        : null,
    );
    if (done === undefined) return true;
    return done !== null && now.getTime() - Date.parse(done) <= day;
  });
  return {
    issues,
    pulls,
    ...(across ? { across } : {}),
    donePulls: donePulls.filter(
      (d) => !pulls.some((p) => p.number === d.number),
    ),
  };
}

/** A ticket's card, its column read as the state that column shows. A
 * card with no Status has none; one in a column no state names is
 * "Unmapped". */
export const cardOf = (
  board: Board,
  key: Key,
  columns: Columns = DEFAULT_COLUMNS,
): BoardCard | null => {
  const item: BoardItem | undefined = board.items.get(key);
  if (!item) return null;
  const status =
    item.status === null
      ? null
      : (statusOfColumn(item.status, columns) ?? "Unmapped");
  return { status, updatedAt: item.updatedAt };
};
