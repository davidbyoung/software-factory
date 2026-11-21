#!/usr/bin/env node
// Keep the board's Status, Session, and Runs in fields in step with the
// marker comments, and Cost with the cost markers. Only this script writes
// them, with one exception:
// `factory ticket ready` sets Status to Ready when the owner asks a local
// session to, and the rules read that as the owner's own move.
//
// In .github/workflows/factory-board-sync.yml it runs in two steps, so the board's
// token reaches only the second:
//   collect  with the workflow's token: posts the comments a closed pull
//            request or the nightly run calls for, then saves the repository
//   apply    with FACTORY_BOARD_TOKEN: reads the board, checks its fields, and
//            writes what changed
//
// Locally, to see what it would set without writing anything:
//   npx --no-install factory board --dry-run
//   npx --no-install factory board --dry-run --fixture DIR --now ISO
// The second reads repo.json, as collect saves it, and board.json, the
// board's recorded GraphQL pages, from DIR instead of GitHub.
//
// Tickets and the board go through the ticket interface (`tickets/`); the
// pull requests through `code-host/`.
import {
  colorOn,
  painter,
  plain,
  type Paint,
  type StyleFormat,
} from "./lib/color.mts";
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
  commentBody,
  derive,
  buildsPartOf,
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
import { openCodeHost } from "./code-host/index.mts";
import { openRunner, type Runner } from "./runner/index.mts";
import { toBoard, type BoardPage } from "./tickets/github.mts";
import { openTickets } from "./tickets/index.mts";
import {
  need,
  readAll,
  type Ticket,
  type Tickets,
  type Write,
} from "./tickets/types.mts";

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
export type BoardConfig = { columns: Columns; fields: FieldNames };

export const DEFAULT_FIELDS: FieldNames = {
  session: "Session",
  runsIn: "Runs in",
  cost: "Cost",
};
export const DEFAULT_BOARD: BoardConfig = {
  columns: DEFAULT_COLUMNS,
  fields: DEFAULT_FIELDS,
};

/** The columns and fields the settings name. */
export function boardConfigOf(s: Settings): BoardConfig {
  return { columns: columnsOf(s), fields: fieldNamesOf(s) };
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
  cfg: BoardConfig = DEFAULT_BOARD,
): Inspection {
  const problems: string[] = [];
  const find = (name: string) => fields.find((f) => sameName(f.name, name));
  const status = find("Status") ?? null;
  const notes: string[] = [];

  if (status?.dataType !== "SINGLE_SELECT") {
    problems.push("the Status field is missing or not a single select");
  } else {
    const names = (status.options ?? []).map((o) => o.name);
    const missing = (Object.keys(STATE_KEYS) as StateKey[]).flatMap((key) =>
      (cfg.columns[STATE_KEYS[key]] ?? [])
        .filter((column) => !names.some((n) => sameName(n, column)))
        .map((column) => `${column} (tickets.columns.${key})`),
    );
    if (missing.length)
      problems.push(`the Status field lacks ${missing.join(", ")}`);
    for (const name of names)
      if (statusOfColumn(name, cfg.columns) === null)
        notes.push(
          `cards in "${name}" are left alone. No state names that column.`,
        );
  }

  const out: Inspection["fields"] = { session: null, runsIn: null, cost: null };
  const lines: Inspection["lines"] = [
    { label: "Status", text: status ? "written" : "missing" },
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
  cfg: BoardConfig = DEFAULT_BOARD,
): Fields {
  const found = inspectBoard(fields, cfg);
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
  settings: Pick<Settings, "builds">,
): { columns: BoardRow[]; fields: BoardRow[] } {
  const find = (name: string) => fields.find((f) => sameName(f.name, name));
  const status = find("Status") ?? null;
  const readable = status?.dataType === "SINGLE_SELECT";
  const options = readable ? (status.options ?? []).map((o) => o.name) : [];
  const ready = cfg.columns.Ready?.[0] ?? null;

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
      if (
        key === "ready" &&
        ready !== DEFAULT_COLUMNS.Ready![0] &&
        settings.builds.trigger === "own-server"
      )
        return {
          state: "unknown",
          key,
          text: `${joined}: the poller needs FACTORY_READY_COLUMN set to "${ready}"`,
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
      ? { state: "fail", key: "Status", text: "no such field" }
      : readable
        ? { state: "pass", key: "Status", text: "synced" }
        : { state: "fail", key: "Status", text: "not a single select" },
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

const MARKS: Record<BoardRow["state"], [string, StyleFormat | null]> = {
  pass: ["✓", "green"],
  fail: ["✗", "red"],
  unknown: ["?", "yellow"],
  off: ["-", "dim"],
  none: [" ", null],
};

/** The report `factory board check` prints: each state's column, then each
 * field, under the setting each comes from. */
export function boardReport(
  number: number,
  board: Board,
  cfg: BoardConfig,
  settings: Pick<Settings, "builds">,
  paint: Paint = plain,
): string[] {
  const rows = boardRows(board.fields, cfg, settings);
  const row = (r: BoardRow) => {
    const [mark, color] = MARKS[r.state];
    return `  ${color ? paint(color, mark) : mark} ${r.key.padEnd(10)} ${r.text}`;
  };
  return [
    board.title ? `Board ${number}, "${board.title}"` : `Board ${number}`,
    "",
    "tickets.columns",
    ...rows.columns.map(row),
    "",
    "tickets.fields",
    ...rows.fields.map(row),
  ];
}

export type Plan = {
  number: number;
  itemId: string | null;
  derived: Derived;
  /** The cost markers' sum as subscription dollars, or null when there are
   * none. */
  cost: number | null;
  writes: Write[];
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
  repository: string,
  runPage: (id: string) => string,
  cfg: BoardConfig = DEFAULT_BOARD,
): Plan[] {
  const owner = repository.split("/")[0];
  const everyPull = [...snapshot.pulls, ...(snapshot.donePulls ?? [])];
  const fields = checkFields(board.fields, cfg);
  return snapshot.issues.map((issue) => {
    const derived = derive(
      issue,
      cardOf(board, issue.number, cfg.columns),
      snapshot.pulls,
      cfg.columns,
    );
    const listPrice = issueCost(issue, everyPull, owner);
    const cost =
      listPrice === null
        ? null
        : Math.round(subscriptionDollars(listPrice) * 100) / 100;
    const item = board.items.get(issue.number);
    const base = {
      number: issue.number,
      itemId: item?.itemId ?? null,
      derived,
      cost,
    };
    if (
      item?.status != null &&
      statusOfColumn(item.status, cfg.columns) === null
    )
      return { ...base, writes: [], unmapped: item.status };
    const session = actionsRunLink(derived, runPage) ?? derived.session;
    const runsIn = derived.runsIn;
    const column = columnFor(derived.status, cfg.columns);
    const option = fields.status.options?.find((o) => sameName(o.name, column));
    const writes: Write[] = [];
    if (
      item?.status == null ||
      !columnsFor(derived.status, cfg.columns).some((c) =>
        sameName(item.status!, c),
      )
    )
      writes.push({
        field: fields.status.name,
        optionName: option?.name ?? column,
      });
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
    return { ...base, writes };
  });
}

export function logLine(plan: Plan): string {
  const d = plan.derived;
  if (plan.unmapped !== undefined)
    return `#${plan.number} card is in "${plan.unmapped}", which no state names (left alone)`;
  const cost = plan.cost === null ? "(empty)" : plan.cost.toFixed(2);
  const values = `Status=${d.status}, Session=${d.session || "(empty)"}, Runs in=${d.runsIn || "(empty)"}, Cost=${cost}`;
  if (plan.writes.length === 0) return `#${plan.number} ${values} (unchanged)`;
  const added = plan.itemId ? "" : "added to the board; ";
  return `#${plan.number} ${values} (${added}set ${plan.writes.map((w) => w.field).join(", ")})`;
}

export type Comment = { issue: number; body: string };

type PullEvent = {
  action: string;
  pull_request: { number: number; merged: boolean; body: string | null };
};

/** The comments a closed pull request calls for: one on each issue it
 * closes when it was not merged, and one on each open follow-ups issue it
 * built part of without closing. */
export function closedPullComments(
  event: PullEvent,
  closes: number[],
  openFollowUps: number[],
  columns: Columns = DEFAULT_COLUMNS,
): Comment[] {
  if (event.action !== "closed") return [];
  const pull = event.pull_request;
  const closedKind = (issue: number): CommentKind => ({
    kind: "pull-closed",
    issue,
    pull: pull.number,
  });
  const comments: Comment[] = [];
  if (!pull.merged)
    for (const issue of closes)
      comments.push({ issue, body: commentBody(closedKind(issue), columns) });
  for (const followUps of openFollowUps) {
    if (closes.includes(followUps) || !buildsPartOf(pull.body ?? "", followUps))
      continue;
    comments.push({
      issue: followUps,
      body: commentBody(
        pull.merged
          ? { kind: "follow-ups-merged", pull: pull.number }
          : closedKind(followUps),
        columns,
      ),
    });
  }
  return comments;
}

/** The nightly run's clears: claims and starts over 24 hours old with no
 * pull request. */
export function nightlyComments(
  snapshot: RepoSnapshot,
  now: Date,
  columns: Columns = DEFAULT_COLUMNS,
): Comment[] {
  return snapshot.issues.flatMap((issue) => {
    const clear = toClear(issue, snapshot.pulls, now);
    if (!clear) return [];
    return [
      {
        issue: issue.number,
        body: commentBody(
          clear.kind === "claim"
            ? { kind: "cleared-claim", issue: issue.number, since: clear.since }
            : {
                kind: "cleared-start",
                issue: issue.number,
                since: clear.since,
              },
          columns,
        ),
      },
    ];
  });
}

/** What collect saves for apply: the tickets and the pull requests. */
export type Saved = {
  tickets: Ticket[];
  pulls: PullRequest[];
  donePulls: PullRequest[];
};

/** The pull requests the sync reads: the open ones with their comments, for
 * Cost, which issues one closes, and those that linked to a ticket. */
export type PullSource = {
  open(options: { costs: boolean }): Promise<PullRequest[]>;
  linking(skip: number[]): Promise<PullRequest[]>;
  closes(pull: number): Promise<number[]>;
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
  out: (line: string) => void;
  readFile: (path: string) => string;
  writeFile: (path: string, text: string) => void;
  /** The factory's settings: the ticket system, and the board's number
   * and the repository where FACTORY_BOARD_NUMBER and GITHUB_REPOSITORY do
   * not name them. */
  settings: () => Promise<Settings>;
  paint?: Paint;
};

/** The dependencies, with the repository the command works on and its
 * ticket system. */
type Ctx = Deps & {
  config: BoardConfig;
  repository: string;
  runPage: (id: string) => string;
  tickets: Tickets;
  pulls: PullSource;
};

async function postAll(comments: Comment[], d: Ctx, dryRun: boolean) {
  for (const c of comments) {
    const first = c.body.split("\n")[0];
    if (dryRun) {
      d.out(`would comment on #${c.issue}: ${first}`);
      continue;
    }
    await d.tickets.comment(c.issue, c.body);
    d.out(`commented on #${c.issue}: ${first}`);
  }
}

async function read(d: Ctx): Promise<Saved> {
  const [tickets, pulls] = await Promise.all([
    readAll(d.tickets),
    d.pulls.open({ costs: true }),
  ]);
  const donePulls = await d.pulls.linking(pulls.map((p) => p.number));
  return { tickets, pulls, donePulls };
}

const snapshotOf = (saved: Saved, now: Date): RepoSnapshot =>
  toSnapshot(saved.tickets, saved.pulls, now, saved.donePulls);

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
  let snapshot = snapshotOf(saved, d.now());

  if (opts.eventName === "pull_request_target" && opts.event) {
    const event = JSON.parse(d.readFile(opts.event)) as PullEvent;
    if (event.action === "closed") {
      const followUps = snapshot.issues
        .filter((i) => i.state === "open" && i.labels.includes("follow-up"))
        .map((i) => i.number);
      const comments = closedPullComments(
        event,
        await d.pulls.closes(event.pull_request.number),
        followUps,
        d.config.columns,
      );
      await postAll(comments, d, opts.dryRun);
      if (comments.length && !opts.dryRun) {
        saved = await read(d);
        snapshot = snapshotOf(saved, d.now());
      }
    }
  }

  if (opts.nightly) {
    const comments = nightlyComments(snapshot, d.now(), d.config.columns);
    await postAll(comments, d, opts.dryRun);
    if (comments.length && !opts.dryRun) saved = await read(d);
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
  },
  write: Tickets["board"] | null,
) {
  const inspected = inspectBoard(board.fields, d.config);
  if (inspected.problems.length)
    throw new Error(`The board: ${inspected.problems.join("; ")}.`);
  for (const line of inspected.lines)
    if (line.text.startsWith("skipped")) d.out(`${line.label} ${line.text}`);
  const plans = planSync(
    snapshotOf(saved, d.now()),
    board,
    d.repository,
    d.runPage,
    d.config,
  );
  for (const plan of plans) {
    d.out(logLine(plan));
    if (!write || plan.writes.length === 0) continue;
    const itemId = plan.itemId ?? (await write.add(plan.number));
    await write.set(itemId, plan.writes);
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
    const repository = deps.env.GITHUB_REPOSITORY || settings.repository;
    const runner = deps.runner(repository, settings.builds.runner);
    const runPage = (id: string) => runner.runPage(id);
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
      const boardPages: BoardPage[] = JSON.parse(
        deps.readFile(join(fixture, "board.json")),
      );
      await apply(
        saved,
        toBoard(boardPages, repository),
        { ...deps, repository, config, runPage },
        null,
      );
      return 0;
    }
    const board = argv[0] === "collect" ? null : await projectNumber(deps);
    const opened = await deps.open(settings, { repository, board });
    const d: Ctx = { ...deps, config, repository, runPage, ...opened };
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
      for (const line of boardReport(number, found, config, settings, d.paint))
        d.out(line);
      const rows = boardRows(found.fields, config, settings);
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
        d,
        dryRun ? null : boardOps,
      );
      return 0;
    }
    const saved = await collect(d, { nightly: false, dryRun: true });
    await apply(saved, await boardOps.read(), d, null);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
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
    env: process.env,
    now: () => (nowArg ? new Date(nowArg) : new Date()),
    out: (line) => console.log(line),
    readFile: (path) => readFileSync(path, "utf8"),
    writeFile: (path, text) => writeFileSync(path, text),
    settings: () => loadSettings(),
    paint: painter(colorOn()),
  };
}

/** `factory board collect` and `factory board apply`. */
export async function run(argv: string[]): Promise<number> {
  return main(argv, boardDeps(argv));
}
