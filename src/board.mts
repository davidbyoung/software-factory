#!/usr/bin/env node
// Keep the board's Status, Session, and Runs in fields in step with the
// marker comments, and Cost with the cost markers. Only this script writes
// them, with one exception:
// `factory ticket ready` sets Status to Ready when the owner asks a local
// session to, and the rules read that as the owner's own move.
//
// In the board job of the factory's run.yml it runs in two steps, so the board's
// token reaches only the second:
//   collect  with the workflow's token: posts the comments a closed pull
//            request or the nightly run calls for, then saves the repository
//   apply    with FACTORY_BOARD_TOKEN: reads the board, checks its fields, and
//            writes what changed
//
// Locally, to see what it would set without writing anything:
//   factory board --dry-run
//   factory board --dry-run --fixture DIR --now ISO
// The second reads repo.json, as collect saves it, and board.json, the
// board's recorded GraphQL pages, from DIR instead of GitHub.
//
// Tickets and the board go through the ticket interface (`tickets/`); the
// pull requests through `code-host/`.
import { TICKET_LABELS } from "./labels.mts";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  columnsOf,
  fieldNamesOf,
  loadSettings,
  type Settings,
} from "./config.mts";
import {
  DEFAULT_COLUMNS,
  STATE_KEYS,
  cardOf,
  columnFor,
  columnsFor,
  sameName,
  statusOfColumn,
  type Columns,
  type StateKey,
  entryFor,
  derive,
  issueCost,
  toClear,
  toSnapshot,
  type Board,
  type BoardField,
  type CommentKind,
  actionsRunLink,
  type Derived,
  type PullRequest,
  type RepoSnapshot,
} from "./lib/work-status.mts";
import { subscriptionDollars } from "./lib/pricing.mts";
import {
  openCodeHost,
  reachCodeHost,
  type CodeHost,
} from "./code-host/index.mts";
import { acrossOf, confirmedList, type Reach } from "./across.mts";
import { finishIfMerged } from "./across-run.mts";
import { sameRepository, type Progress } from "./lib/repositories.mts";
import { openRunner, type Runner } from "./runner/index.mts";
import { fixtureBoard, openTickets, refOf } from "./tickets/index.mts";
import { linkPulls, ownLinks, ticketsOf } from "./lib/pull-tickets.mts";
import { renderEntry } from "./tickets/record-comments.mts";
import {
  need,
  readAll,
  type Key,
  type Links,
  type NewEntry,
  type Ticket,
  type Tickets,
  type Write,
} from "./tickets/types.mts";
import * as say from "./lib/output.mts";

export type { Write };

/** Which of the board's fields the sync writes, named as the settings name
 * them; null means never. */
export type FieldNames = {
  session: string | null;
  runsIn: string | null;
  cost: string | null;
};

/** What the settings say about the board: the column each state shows in
 * and the fields written. */
export type BoardConfig = {
  columns: Columns;
  fields: FieldNames;
  /** The name of the label on every ticket the factory works on. */
  factory: string;
};

export const DEFAULT_FIELDS: FieldNames = {
  session: "Session",
  runsIn: "Runs in",
  cost: "Cost",
};
export const DEFAULT_BOARD: BoardConfig = {
  columns: DEFAULT_COLUMNS,
  fields: DEFAULT_FIELDS,
  factory: TICKET_LABELS.factory,
};

/** The columns and fields the settings name. */
export function boardConfigOf(s: Settings): BoardConfig {
  return {
    columns: columnsOf(s),
    fields: fieldNamesOf(s),
    factory: s.tickets.labels.factory,
  };
}

export type Fields = {
  status: BoardField;
  /** The fields to write, or null for one the sync skips. */
  session: BoardField | null;
  runsIn: BoardField | null;
  cost: BoardField | null;
};

export type Inspection = {
  status: BoardField | null;
  fields: Pick<Fields, "session" | "runsIn" | "cost">;
  /** Each field's line in the report: what the sync does with it. */
  lines: { label: string; text: string }[];
  /** Cards in a column no state names, left alone. */
  notes: string[];
  problems: string[];
};

const FIELD_KINDS = [
  {
    key: "session",
    setting: "session",
    label: "Session",
    type: "TEXT",
    typeName: "Text",
    options: [],
  },
  {
    key: "runsIn",
    setting: "runs-in",
    label: "Runs in",
    type: "SINGLE_SELECT",
    typeName: "a single select",
    options: ["Local", "Actions"],
  },
  {
    key: "cost",
    setting: "cost",
    label: "Cost",
    type: "NUMBER",
    typeName: "a Number",
    options: [],
  },
] as const;

/** What the factory will do with a board's fields: the problems that stop
 * it, and what each field and column means. The sync never creates or
 * changes a field. */
export function inspectBoard(
  fields: BoardField[],
  cfg: BoardConfig,
  /** The field the ticket system keeps the columns in. */
  columnField: string,
): Inspection {
  const problems: string[] = [];
  const find = (name: string) => fields.find((f) => sameName(f.name, name));
  const status = find(columnField) ?? null;
  const notes: string[] = [];

  if (status?.dataType !== "SINGLE_SELECT") {
    problems.push(`the ${columnField} field is missing or not a single select`);
  } else {
    const names = (status.options ?? []).map((o) => o.name);
    const missing = (Object.keys(STATE_KEYS) as StateKey[]).flatMap((key) =>
      (cfg.columns[STATE_KEYS[key]] ?? [])
        .filter((column) => !names.some((n) => sameName(n, column)))
        .map((column) => `${column} (tickets.columns.${key})`),
    );
    if (missing.length)
      problems.push(`the ${columnField} field lacks ${missing.join(", ")}`);
    for (const name of names)
      if (statusOfColumn(name, cfg.columns) === null)
        notes.push(
          `cards in "${name}" are left alone. No state names that column.`,
        );
  }

  const out: Inspection["fields"] = { session: null, runsIn: null, cost: null };
  const lines: Inspection["lines"] = [
    { label: columnField, text: status ? "written" : "missing" },
  ];
  for (const kind of FIELD_KINDS) {
    const name = cfg.fields[kind.key];
    if (name === null) {
      lines.push({ label: kind.label, text: "never written: set to none" });
      continue;
    }
    const named = !sameName(name, DEFAULT_FIELDS[kind.key]!);
    const key = `tickets.fields.${kind.setting}`;
    const field = find(name);
    if (!field) {
      if (named)
        problems.push(
          `the ${name} field is missing or not ${kind.typeName} (${key})`,
        );
      else
        lines.push({
          label: kind.label,
          text: `skipped: the board has no field named ${name}`,
        });
      continue;
    }
    const lacking =
      field.dataType !== kind.type
        ? null
        : kind.options.filter(
            (o) => !(field.options ?? []).some((x) => sameName(x.name, o)),
          );
    if (field.dataType !== kind.type || lacking!.length) {
      const what =
        lacking && lacking.length
          ? `lacks ${lacking.join(", ")}`
          : `is not ${kind.typeName}`;
      problems.push(
        named
          ? `the ${name} field ${lacking?.length ? what : `is missing or not ${kind.typeName}`} (${key})`
          : `the ${name} field ${what}: name another field in ${key}, or set it to none`,
      );
      continue;
    }
    out[kind.key] = field;
    lines.push({ label: kind.label, text: "written" });
  }
  return { status, fields: out, lines, notes, problems };
}

/** The board's fields, or an error naming everything that is wrong with
 * them. */
export function checkFields(
  fields: BoardField[],
  cfg: BoardConfig,
  columnField: string,
): Fields {
  const found = inspectBoard(fields, cfg, columnField);
  if (found.problems.length)
    throw new Error(`The board: ${found.problems.join("; ")}.`);
  return { status: found.status!, ...found.fields };
}

/** A row of `factory board check`: a state, a column no state names, or a
 * field the sync writes. `none` is a state whose column cannot be told,
 * when the board has no Status field to read. */
export type BoardRow = {
  state: "pass" | "fail" | "unknown" | "off" | "none";
  key: string;
  text: string;
};

const KIND_WORDS: Record<string, string> = {
  TEXT: "text field",
  SINGLE_SELECT: "single select field",
  NUMBER: "number field",
};

/** What `factory board check` says of each state and each field. */
export function boardRows(
  fields: BoardField[],
  cfg: BoardConfig,
  columnField: string,
): { columns: BoardRow[]; fields: BoardRow[] } {
  const find = (name: string) => fields.find((f) => sameName(f.name, name));
  const status = find(columnField) ?? null;
  const readable = status?.dataType === "SINGLE_SELECT";
  const options = readable ? (status.options ?? []).map((o) => o.name) : [];

  const columns: BoardRow[] = (Object.keys(STATE_KEYS) as StateKey[]).map(
    (key) => {
      const names = cfg.columns[STATE_KEYS[key]];
      if (names === null)
        return {
          state: "off",
          key,
          text:
            key === "ready"
              ? "none"
              : `none, shows in ${columnFor(STATE_KEYS[key], cfg.columns)}`,
        };
      const joined = names.join(", ");
      if (!readable) return { state: "none", key, text: joined };
      const missing = names.filter((n) => !options.some((o) => sameName(o, n)));
      if (missing.length)
        return {
          state: "fail",
          key,
          text: `${joined}: no such column on the board${names.length > 1 ? `: ${missing.join(", ")}` : ""}`,
        };
      return { state: "pass", key, text: joined };
    },
  );
  for (const name of options)
    if (statusOfColumn(name, cfg.columns) === null)
      columns.push({
        state: "unknown",
        key: name,
        text: "no state: left alone",
      });

  const rows: BoardRow[] = [
    status === null
      ? { state: "fail", key: columnField, text: "no such field" }
      : readable
        ? { state: "pass", key: columnField, text: "synced" }
        : { state: "fail", key: columnField, text: "not a single select" },
  ];
  for (const kind of FIELD_KINDS) {
    const name = cfg.fields[kind.key];
    const key = kind.label;
    if (name === null) {
      rows.push({ state: "off", key, text: "off" });
      continue;
    }
    const named = !sameName(name, DEFAULT_FIELDS[kind.key]!);
    const setting = `tickets.fields.${kind.setting}`;
    const field = find(name);
    if (!field) {
      rows.push(
        named
          ? { state: "fail", key, text: `no such field: ${name}` }
          : { state: "unknown", key, text: "skipped: no such field" },
      );
      continue;
    }
    const wrong =
      field.dataType !== kind.type
        ? `not a ${KIND_WORDS[kind.type]}`
        : (() => {
            const lacking = kind.options.filter(
              (o) => !(field.options ?? []).some((x) => sameName(x.name, o)),
            );
            return lacking.length ? `lacks ${lacking.join(", ")}` : null;
          })();
    rows.push(
      wrong === null
        ? { state: "pass", key, text: "synced" }
        : {
            state: "fail",
            key,
            text: named
              ? `${name}: ${wrong}`
              : `${wrong}: name another field in ${setting}, or set it to none`,
          },
    );
  }
  return { columns, fields: rows };
}

const MARKS: Record<BoardRow["state"], say.MarkKind | null> = {
  pass: "ok",
  fail: "fail",
  unknown: "look",
  off: "off",
  none: null,
};

/** The report `factory board check` prints: each state's column, then each
 * field, under the setting each comes from. */
export function boardReport(
  number: number,
  board: Board,
  cfg: BoardConfig,
): say.Line[] {
  const rows = boardRows(board.fields, cfg, board.columnField);
  const row = (r: BoardRow) =>
    say.row(r.key, r.text, { width: 10, mark: MARKS[r.state] });
  return [
    board.title
      ? say.text(`Board ${number}, `, say.name(`"${board.title}"`))
      : say.text(`Board ${number}`),
    say.BLANK,
    say.heading("tickets.columns"),
    ...rows.columns.map(row),
    say.BLANK,
    say.heading("tickets.fields"),
    ...rows.fields.map(row),
  ];
}

export type Plan = {
  key: Key;
  itemId: string | null;
  derived: Derived;
  /** The cost markers' sum as subscription dollars, or null when there are
   * none. */
  cost: number | null;
  /** The column to move the card to, or null when it stays. */
  column: string | null;
  /** The factory's own fields to write. */
  writes: Write[];
  /** Why the repositories of a ticket that names several could not be
   * read: the sync leaves such a card alone. */
  unread?: string;
  /** The column the card sits in when no state names it: the sync leaves
   * such a card alone. */
  unmapped?: string;
};

/** What each issue's fields should hold, and which writes get them there.
 * A card's Session is an Actions run's page, which `runPage` gives for its
 * ID, and any other session as it is. */
export function planSync(
  snapshot: RepoSnapshot,
  board: Board,
  runPage: (id: string) => string,
  cfg: BoardConfig = DEFAULT_BOARD,
  unread?: Map<Key, string>,
): Plan[] {
  const everyPull = [...snapshot.pulls, ...(snapshot.donePulls ?? [])];
  const fields = checkFields(board.fields, cfg, board.columnField);
  return snapshot.issues.map((issue) => {
    const derived = derive(
      issue,
      cardOf(board, issue.key, cfg.columns),
      snapshot.pulls,
      cfg.columns,
      snapshot.across?.get(issue.key),
    );
    const listPrice = issueCost(issue, everyPull);
    const cost =
      listPrice === null
        ? null
        : Math.round(subscriptionDollars(listPrice) * 100) / 100;
    const item = board.items.get(issue.key);
    const base = {
      key: issue.key,
      itemId: item?.itemId ?? null,
      derived,
      cost,
    };
    const why = unread?.get(issue.key);
    if (why !== undefined)
      return { ...base, column: null, writes: [], unread: why };
    if (
      item?.status != null &&
      statusOfColumn(item.status, cfg.columns) === null
    )
      return { ...base, column: null, writes: [], unmapped: item.status };
    const session = actionsRunLink(derived, runPage) ?? derived.session;
    const runsIn = derived.runsIn;
    const column = columnFor(derived.status, cfg.columns);
    const option = fields.status.options?.find((o) => sameName(o.name, column));
    const writes: Write[] = [];
    const move =
      item?.status == null ||
      !columnsFor(derived.status, cfg.columns).some((c) =>
        sameName(item.status!, c),
      )
        ? (option?.name ?? column)
        : null;
    if (fields.session && (item?.session ?? "") !== session)
      writes.push(
        session
          ? { field: fields.session.name, text: session }
          : { field: fields.session.name, clear: true },
      );
    if (fields.runsIn && (item?.runsIn ?? "") !== runsIn) {
      const runsInOption = fields.runsIn.options?.find((o) =>
        sameName(o.name, runsIn),
      );
      writes.push(
        runsIn
          ? {
              field: fields.runsIn.name,
              optionName: runsInOption?.name ?? runsIn,
            }
          : { field: fields.runsIn.name, clear: true },
      );
    }
    if (fields.cost && (item?.cost ?? null) !== cost)
      writes.push(
        cost === null
          ? { field: fields.cost.name, clear: true }
          : { field: fields.cost.name, number: cost },
      );
    return { ...base, column: move, writes };
  });
}

export function logLine(plan: Plan, ref: (key: Key) => string): string {
  const d = plan.derived;
  const name = ref(plan.key);
  if (plan.unmapped !== undefined)
    return `${name} card is in "${plan.unmapped}", which no state names (left alone)`;
  if (plan.unread !== undefined)
    return `${name} repositories could not be read: ${plan.unread} (left alone)`;
  const cost = plan.cost === null ? "(empty)" : plan.cost.toFixed(2);
  const values = `Status=${d.status}, Session=${d.session || "(empty)"}, Runs in=${d.runsIn || "(empty)"}, Cost=${cost}`;
  if (plan.writes.length === 0 && plan.column === null)
    return `${name} ${values} (unchanged)`;
  const added = plan.itemId ? "" : "added to the board; ";
  const set = [
    ...(plan.column === null ? [] : ["Status"]),
    ...plan.writes.map((w) => w.field),
  ];
  return `${name} ${values} (${added}set ${set.join(", ")})`;
}

/** A note the sync records on a ticket, and how GitHub shows it. */
export type Comment = { issue: Key; entry: NewEntry; body: string };

const note = (issue: Key, c: CommentKind, columns: Columns): Comment => {
  const entry = entryFor(c, columns);
  return { issue, entry, body: renderEntry(entry) };
};

type PullEvent = {
  action: string;
  pull_request: { number: number; merged: boolean; body: string | null };
};

/** The comments a closed pull request calls for: one on each issue it
 * closes when it was not merged. */
export function closedPullComments(
  event: PullEvent,
  links: Links,
  columns: Columns,
  ref: (key: Key) => string,
  /** The tickets with the factory label: no other gets a comment. */
  labeled: Key[],
): Comment[] {
  if (event.action !== "closed") return [];
  const pull = event.pull_request;
  const closes = links.closes.filter((k) => labeled.includes(k));
  const closedKind = (issue: Key): CommentKind => ({
    kind: "pull-closed",
    issue: { key: issue, ref: ref(issue) },
    pull: pull.number,
  });
  const comments: Comment[] = [];
  if (!pull.merged)
    for (const issue of closes)
      comments.push(note(issue, closedKind(issue), columns));
  return comments;
}

/** The nightly run's clears: claims and starts over 24 hours old with no
 * pull request. */
export function nightlyComments(
  snapshot: RepoSnapshot,
  now: Date,
  columns: Columns,
  ref: (key: Key) => string,
  unread?: Map<Key, string>,
): Comment[] {
  return snapshot.issues.flatMap((issue) => {
    if (unread?.has(issue.key)) return [];
    const clear = toClear(
      issue,
      snapshot.pulls,
      now,
      snapshot.across?.get(issue.key),
    );
    if (!clear) return [];
    const named = { key: issue.key, ref: ref(issue.key) };
    return [
      note(
        issue.key,
        clear.kind === "claim"
          ? { kind: "cleared-claim", issue: named, since: clear.since }
          : { kind: "cleared-start", issue: named, since: clear.since },
        columns,
      ),
    ];
  });
}

/** What collect saves for apply: the tickets and the pull requests. */
export type Saved = {
  tickets: Ticket[];
  pulls: PullRequest[];
  donePulls: PullRequest[];
  /** How far each repository is, for a ticket that names others than its
   * own, and why a ticket's could not be read. */
  across?: [Key, Progress[]][];
  unread?: [Key, string][];
};

/** The pull requests the sync reads: the open ones with their comments, for
 * Cost, which issues one closes, and those that linked to a ticket. */
export type PullSource = {
  open(options: { costs: boolean }): Promise<PullRequest[]>;
  linking(skip: number[]): Promise<PullRequest[]>;
  closes(pull: number): Promise<Key[]>;
  /** The address of a pull request's page, for the merge's note. */
  address?(pull: number): string;
};

export type Deps = {
  /** The ticket system and the pull requests for the repository and board
   * named. */
  open: (
    settings: Settings,
    target: { repository: string; board: number | null },
  ) => Promise<{ tickets: Tickets; pulls: PullSource }>;
  /** The runner of that name, for the page of a run. */
  runner: (repository: string, name: string) => Pick<Runner, "runPage">;
  env: Record<string, string | undefined>;
  now: () => Date;
  out: say.Out;
  err: say.Out;
  readFile: (path: string) => string;
  writeFile: (path: string, text: string) => void;
  /** The factory's settings: the ticket system, and the board's number
   * and the repository where FACTORY_BOARD_NUMBER and GITHUB_REPOSITORY do
   * not name them. */
  settings: () => Promise<Settings>;
  /** Any repository's code host, for a ticket that names several. */
  reach: (
    repository: string,
    codeHost: string,
    own: string,
  ) => Promise<CodeHost>;
};

/** The dependencies, with the repository the command works on and its
 * ticket system. */
type Ctx = Deps & {
  config: BoardConfig;
  repository: string;
  runPage: (id: string) => string;
  tickets: Tickets;
  pulls: PullSource;
  /** Whether the code host's own links count (`lib/pull-tickets.mts`). */
  own: boolean;
  hostOf: Reach;
  /** Whether a ticket's repositories are kept in a ticket field. */
  inField: boolean;
};

async function postAll(comments: Comment[], d: Ctx, dryRun: boolean) {
  for (const c of comments) {
    const first = c.body.split("\n")[0];
    if (dryRun) {
      d.out(say.text(`would comment on ${d.tickets.ref(c.issue)}: ${first}`));
      continue;
    }
    await d.tickets.record.add(c.issue, c.entry);
    d.out(say.text(`commented on ${d.tickets.ref(c.issue)}: ${first}`));
  }
}

/** Each ticket a merged pull request closed: its merge recorded, and the
 * ticket finished in its ticket system, so the sync then moves it to the
 * first done column. */
async function finishAll(keys: Key[], pull: number, d: Ctx, dryRun: boolean) {
  for (const key of keys) {
    const line = `${d.tickets.ref(key)}: pull request #${pull} merged`;
    if (dryRun) {
      d.out(say.text(`would finish ${line}`));
      continue;
    }
    const link = d.pulls.address?.(pull) ?? `#${pull}`;
    await d.tickets.record.add(
      key,
      entryFor({ kind: "merged", pull, link }, d.config.columns),
    );
    await d.tickets.finish(key);
    d.out(say.text(`finished ${line}`));
  }
}

async function read(d: Ctx): Promise<Saved> {
  const [tickets, open] = await Promise.all([
    readAll(d.tickets, { label: d.config.factory }),
    d.pulls.open({ costs: true }),
  ]);
  const pulls = linkPulls(open, d.tickets, d.own);
  // Only the code host's own links say which closed pull requests built a
  // ticket.
  const donePulls = d.own
    ? linkPulls(
        await d.pulls.linking(pulls.map((p) => p.number)),
        d.tickets,
        d.own,
      )
    : [];
  const { across, unread } = await acrossOf(tickets, {
    tickets: d.tickets,
    repository: d.repository,
    reach: d.hostOf,
    inField: d.inField,
    now: d.now(),
  });
  return {
    tickets,
    pulls,
    donePulls: [...donePulls, ...(await costsAcross(across, unread, d))],
    across: [...across],
    unread: [...unread],
  };
}

/** The pull requests in other repositories that build a ticket, for the
 * costs noted on them, each with a number no other has. A ticket with one
 * that can't be read moves to `unread`. */
async function costsAcross(
  across: Map<Key, Progress[]>,
  unread: Map<Key, string>,
  d: Ctx,
): Promise<PullRequest[]> {
  const out: PullRequest[] = [];
  for (const [key, all] of across)
    try {
      for (const r of all) {
        if (sameRepository(r.name, d.repository)) continue;
        const host = await d.hostOf(r.name);
        for (const p of r.pulls)
          out.push({
            number: -1 - out.length,
            createdAt: p.createdAt,
            body: "",
            closes: [],
            partOf: [key],
            isDraft: p.isDraft,
            checks: null,
            openThreads: 0,
            author: "",
            comments: (await host.comments(p.number)).map((c) => ({
              ...c,
              id: String(c.id),
            })),
          });
      }
    } catch (error) {
      across.delete(key);
      unread.set(key, error instanceof Error ? error.message : String(error));
    }
  return out;
}

/** What the sync works from: the saved tickets with the factory label,
 * whichever version of the factory saved them. */
const snapshotOf = (
  saved: Saved,
  now: Date,
  cfg: BoardConfig = DEFAULT_BOARD,
): RepoSnapshot =>
  toSnapshot(
    saved.tickets.filter((t) => t.labels.includes(cfg.factory)),
    saved.pulls,
    now,
    saved.donePulls,
    cfg.columns,
    new Map(saved.across ?? []),
  );

const listedOf = ({ name, after }: Progress) => ({ name, after });
const finishing = (d: Ctx) => ({
  tickets: d.tickets,
  columns: d.config.columns,
  out: d.out,
});

async function collect(
  d: Ctx,
  opts: {
    event?: string;
    eventName?: string;
    nightly: boolean;
    dryRun: boolean;
  },
): Promise<Saved> {
  let saved = await read(d);
  let snapshot = snapshotOf(saved, d.now(), d.config);

  if (opts.eventName === "pull_request_target" && opts.event) {
    const event = JSON.parse(d.readFile(opts.event)) as PullEvent;
    if (event.action === "closed") {
      const labeled = snapshot.issues.map((i) => i.key);
      const links = ticketsOf(
        {
          body: event.pull_request.body ?? "",
          closes: d.own ? await d.pulls.closes(event.pull_request.number) : [],
        },
        d.tickets,
        d.own,
      );
      const comments = closedPullComments(
        event,
        links,
        d.config.columns,
        (k) => d.tickets.ref(k),
        labeled,
      );
      await postAll(comments, d, opts.dryRun);
      const done = event.pull_request.merged
        ? links.closes.filter((k) => labeled.includes(k))
        : [];
      await finishAll(done, event.pull_request.number, d, opts.dryRun);
      if ((comments.length || done.length) && !opts.dryRun) {
        saved = await read(d);
        snapshot = snapshotOf(saved, d.now(), d.config);
      }
    }
  }

  if (opts.nightly) {
    const comments = nightlyComments(
      snapshot,
      d.now(),
      d.config.columns,
      (k) => d.tickets.ref(k),
      new Map(saved.unread ?? []),
    );
    await postAll(comments, d, opts.dryRun);
    let finished = false;
    if (!opts.dryRun)
      for (const [key, all] of saved.across ?? []) {
        const ticket = await d.tickets.read(key);
        if ((await confirmedList(ticket, all.map(listedOf), d.hostOf)).counts)
          finished = (await finishIfMerged(key, all, finishing(d))) || finished;
      }
    if ((comments.length || finished) && !opts.dryRun) saved = await read(d);
  }
  return saved;
}

/** Writes the board, through `board`: adds each ticket's card it lacks and
 * sets the fields that changed. */
async function apply(
  saved: Saved,
  board: Board,
  d: Deps & {
    repository: string;
    config: BoardConfig;
    runPage: (id: string) => string;
    ref: (key: Key) => string;
  },
  write: Tickets["board"] | null,
) {
  const inspected = inspectBoard(board.fields, d.config, board.columnField);
  if (inspected.problems.length)
    throw new Error(`The board: ${inspected.problems.join("; ")}.`);
  for (const line of inspected.lines)
    if (line.text.startsWith("skipped"))
      d.out(say.text(`${line.label} ${line.text}`));
  const plans = planSync(
    snapshotOf(saved, d.now(), d.config),
    board,
    d.runPage,
    d.config,
    new Map(saved.unread ?? []),
  );
  for (const plan of plans) {
    d.out(say.text(logLine(plan, d.ref)));
    if (!write || (plan.writes.length === 0 && plan.column === null)) continue;
    const itemId = plan.itemId ?? (await write.add(plan.key));
    if (plan.column !== null) await write.move(itemId, plan.column);
    if (plan.writes.length) await write.set(itemId, plan.writes);
  }
}

function option(argv: string[], name: string): string | undefined {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
}

/** The board's number: FACTORY_BOARD_NUMBER where it is set, and
 * otherwise `tickets.board` in the settings. */
async function projectNumber(d: Deps): Promise<number> {
  if (d.env.FACTORY_BOARD_NUMBER) {
    const number = Number(d.env.FACTORY_BOARD_NUMBER);
    if (!Number.isInteger(number) || number < 1)
      throw new Error("FACTORY_BOARD_NUMBER is not a board number.");
    return number;
  }
  const board = (await d.settings()).tickets.board;
  if (board === null) throw new Error("tickets.board is not set.");
  return board;
}

export async function main(argv: string[], deps: Deps): Promise<number> {
  const dryRun = argv.includes("--dry-run");
  try {
    const settings = await deps.settings();
    const config = boardConfigOf(settings);
    const { repository } = settings;
    const runner = deps.runner(repository, settings.builds.runner);
    const runPage = (id: string) => runner.runPage(id);
    const ref = refOf(settings.tickets.type);
    const fixture = option(argv, "--fixture");
    if (
      argv[0] !== "collect" &&
      argv[0] !== "apply" &&
      argv[0] !== "check" &&
      !dryRun
    )
      throw new Error("Run collect, apply, or check, or --dry-run.");
    if (fixture) {
      const saved: Saved = JSON.parse(
        deps.readFile(join(fixture, "repo.json")),
      );
      const boardPages: unknown = JSON.parse(
        deps.readFile(join(fixture, "board.json")),
      );
      await apply(
        saved,
        fixtureBoard(boardPages, repository),
        { ...deps, repository, config, runPage, ref },
        null,
      );
      return 0;
    }
    const board = argv[0] === "collect" ? null : await projectNumber(deps);
    const opened = await deps.open(settings, { repository, board });
    const d: Ctx = {
      ...deps,
      config,
      repository,
      runPage,
      ...opened,
      own: ownLinks(settings),
      hostOf: (name) => deps.reach(name, settings.codeHost.type, repository),
      inField: settings.tickets.ticketFields.repositories !== null,
    };
    if (argv[0] === "collect") {
      const out = option(argv, "--out");
      if (!out) throw new Error("collect needs --out FILE.");
      const saved = await collect(d, {
        event: option(argv, "--event"),
        eventName: option(argv, "--event-name"),
        nightly: option(argv, "--event-name") === "schedule",
        dryRun,
      });
      d.writeFile(out, JSON.stringify(saved));
      return 0;
    }
    const boardOps = need(d.tickets, "board");
    if (argv[0] === "check") {
      const found = await boardOps.read();
      const number = await projectNumber(deps);
      for (const line of boardReport(number, found, config)) d.out(line);
      const rows = boardRows(found.fields, config, found.columnField);
      return [...rows.columns, ...rows.fields].some((r) => r.state === "fail")
        ? 1
        : 0;
    }
    if (argv[0] === "apply") {
      const input = option(argv, "--in");
      if (!input) throw new Error("apply needs --in FILE.");
      if (!d.env.GH_TOKEN) throw new Error("FACTORY_BOARD_TOKEN is not set.");
      await apply(
        JSON.parse(d.readFile(input)),
        await boardOps.read(),
        { ...d, ref },
        dryRun ? null : boardOps,
      );
      return 0;
    }
    const saved = await collect(d, { nightly: false, dryRun: true });
    await apply(saved, await boardOps.read(), { ...d, ref }, null);
    return 0;
  } catch (error) {
    deps.err(say.text(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

/** The dependencies `run` gives `main`. */
export function boardDeps(argv: string[]): Deps {
  const nowArg = option(argv, "--now");
  return {
    open: async (settings, target) => {
      const { tickets } = await openTickets(settings, target);
      return {
        tickets,
        pulls: openCodeHost(target.repository, settings.codeHost.type),
      };
    },
    runner: (repository, name) => openRunner(repository, name),
    reach: reachCodeHost,
    env: process.env,
    now: () => (nowArg ? new Date(nowArg) : new Date()),
    ...say.printersFor(argv[0] === "check" ? "board check" : "board"),
    readFile: (path) => readFileSync(path, "utf8"),
    writeFile: (path, text) => writeFileSync(path, text),
    settings: () => loadSettings(),
  };
}

/** `factory board collect` and `factory board apply`. */
export async function run(argv: string[]): Promise<number> {
  return main(argv, boardDeps(argv));
}
