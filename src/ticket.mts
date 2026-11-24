#!/usr/bin/env node
// The steps a session takes on an issue that are the same every time: claim
// it, check the claim still holds, stop, post a refinement marker, note what
// the session spent, and add a line to the follow-ups issue.
//
//   factory ticket claim N
//   factory ticket still-live N
//   factory ticket stop N "one-line reason"
//   factory ticket end N
//   factory ticket refining|waiting N
//   factory ticket refined N [--check] [--before-file FILE]
//   factory follow-up FILE "what is wrong"
//   factory ticket ready N
//   factory ticket cost N
//
// And the reads and writes the skills make, through the ticket interface
// (`tickets/`), so no skill calls a ticket system itself:
//
//   factory ticket view N [--field title|state|labels|body|ref] [--json]
//   factory ticket answers N   # the comments that count as answers
//   factory ticket list [--label LABEL] [--title "TITLE"] [--json]
//   factory ticket edit N [--title TITLE] [--body-file FILE [--attach FILE]...]
//   factory ticket comment N --body-file FILE [--attach FILE]...
//   factory ticket open --title TITLE --body-file FILE [--label LABEL]...
//   factory ticket label N --add LABEL | --remove LABEL | --was-removed LABEL
//   factory ticket link N [--part]
//   factory ticket blockers N
//   factory ticket block N --by M
//   factory ticket unblock N --by M
//   factory ticket supports GROUP
//
// The cost clock: `claim` and `refining` start the session's clock on N.
// `waiting`, `refined`, `stop`, and `cost` post what the session and its
// subagents spent, as a share of the subscription and at API list prices,
// since the clock started, or since the
// session started when it has none, then restart it. `cost` posts to ticket
// N; `factory pr cost` posts to a pull request. The clock is keyed by
// CLAUDE_CODE_SESSION_ID, the ID the
// hooks receive and the transcript's file name.
//
// `refined` posts its marker only on a ticket whose body a build can read
// (`lib/refined-check.mts`): otherwise it prints one line for each part that
// is missing and exits 1. With `--check` it posts nothing, and prints
// `sound` when nothing is missing.
//
// `ready` moves issue N's card to Ready when the owner asks a session to, so
// the sync and the poller treat it as the owner's own move. It is the one
// write to Status outside the sync, and needs the project scope:
// gh auth refresh -s project.
//
// `end` is a run's last step: it releases this session's claim when the claim
// is live and no open pull request links the ticket, and always exits 0.
//
// FILE is the file or page a follow-up is about, and leads its line. A
// failed read exits 1 with the error; every other outcome is the one line
// printed.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { load as parseYaml } from "js-yaml";
import { setTimeout as sleep } from "node:timers/promises";
import { sessionIdentity } from "./lib/gh.mts";
import { openCodeHost } from "./code-host/index.mts";
import { openRunner } from "./runner/index.mts";
import type { Runner } from "./runner/types.mts";
import { loadSettings, targetOf, type Settings } from "./config.mts";
import {
  AGENT_MARK,
  entryFor,
  sessionTotal,
  sameName,
  reviewingPulls,
  workState,
  type CommentKind,
  type Identity,
  type IssueComment,
  type PullRequest,
} from "./lib/work-status.mts";
import { missingParts } from "./lib/refined-check.mts";
import { labelOf, shownLabels, type Labels } from "./labels.mts";
import { commonDir, readClock, writeClock, type Clock } from "./lib/clock.mts";
import { costNote, measureSession, projectsDir } from "./lib/usage.mts";
import type { CostNote, Measured } from "./lib/usage.mts";
import { boardConfigOf, checkFields, type BoardConfig } from "./board.mts";
import { refuseBareTags, refuseOverride } from "./guard-ticket-text.mts";
import { openTickets } from "./tickets/index.mts";
import {
  GROUPS,
  NotFoundError,
  compareKeys,
  need,
  supports,
  type Entry,
  type Group,
  type Key,
  type Ticket,
  type TicketComment,
  type Tickets,
} from "./tickets/types.mts";
import { linkPulls, ownLinks } from "./lib/pull-tickets.mts";
import { NotSignedInError } from "./code-host/types.mts";

/** The ticket system this session reaches. */
export type Opened = { tickets: Tickets };

export type Deps = {
  /** The adapter the settings pick, for the repository and board named. */
  open: (
    settings: Settings,
    target: { repository: string; board: number | null },
  ) => Promise<Opened>;
  /** The open pull requests of a repository, on the code host the settings
   * name, which `end` reads for a link to the ticket. */
  openPulls: (repository: string, codeHost: string) => Promise<PullRequest[]>;
  /** The runner the settings name, which says whether this session is in
   * one of its runs. */
  runner: (repository: string, name: string) => Pick<Runner, "thisRun">;
  /** Starts the board sync on the default branch, through the runner. */
  startSync: (repository: string, settings: Settings) => Promise<void>;
  /** The factory's settings, read once when the command starts. */
  settings: () => Promise<Settings>;
  env: Record<string, string | undefined>;
  sleep: (ms: number) => Promise<unknown>;
  out: (line: string) => void;
  /** The follow-ups ticket this clone last opened, which GitHub may not
   * list for a few seconds after. */
  followUpStore: { read: () => Key | null; write: (key: Key) => void };
  /** Where this checkout remembers the claim it posted on each issue. */
  claimStore: {
    read: (issue: Key) => string | null;
    write: (issue: Key, commentId: string) => void;
  };
  readFile: (path: string) => string;
  now: () => Date;
  /** The session's cost clock, by session ID. */
  clock: {
    read: (session: string) => Clock | null;
    write: (session: string, clock: Clock) => void;
  };
  /** What the session spent since `since`, or since it started. */
  measure: (session: string, since: string | null) => Measured;
  /** Who the code host's CLI is signed in as, for a branch name's
   * `{user}`. */
  signedInAs: (repository: string, codeHost: string) => Promise<string>;
};

/** The dependencies, with the repository, board, and ticket system. */
type Ctx = Deps & {
  config: BoardConfig;
  /** The code host the settings name. */
  codeHost: string;
  /** `code-host.branch-name`, which commands always have. */
  branchName: string;
  repository: string;
  board: number | null;
  tickets: Tickets;
  /** Whether the code host's own links say which tickets a pull request
   * closes (`lib/pull-tickets.mts`). */
  own: boolean;
  /** The name of each label the factory adds. */
  labels: Labels;
};

export type { Clock };

export async function readComments(
  c: { tickets: Tickets },
  issue: Key,
): Promise<Entry[]> {
  return c.tickets.record.read(issue);
}

/** What a cost note needs: the session's clock and what it spent. */
export type CostDeps = Pick<Deps, "env" | "clock" | "now" | "measure">;

/** A cost note, and the clock restart to make once it is posted, so a note
 * that fails to post leaves the clock where it was. */
export type TakenCost = { note: CostNote; restart: () => void };

/** The cost note for what this session spent since its clock started. `on`
 * is where the note is posted, as written in prose. With `total`, the
 * session's total already recorded on the ticket, the note holds the new
 * total. */
export function takeCost(on: string, d: CostDeps, total?: number): TakenCost {
  const session = d.env.CLAUDE_CODE_SESSION_ID ?? "";
  if (!session)
    return {
      note: costNote(
        { ok: false, reason: "CLAUDE_CODE_SESSION_ID is not set" },
        on,
        session,
      ),
      restart: () => {},
    };
  const clock = d.clock.read(session);
  const now = d.now().toISOString();
  const note = costNote(
    measure(d, session, clock?.start ?? null),
    on,
    session,
    total,
  );
  return {
    note,
    // Only claim and refining choose the issue: a note posted elsewhere,
    // such as on a pull request, keeps the clock's.
    restart: () =>
      d.clock.write(session, { issue: clock ? clock.issue : null, start: now }),
  };
}

/** The cost note for a ticket: the session's running total on it. */
async function ticketCost(issue: Key, d: Ctx): Promise<TakenCost> {
  const session = d.env.CLAUDE_CODE_SESSION_ID ?? "";
  const total = session
    ? sessionTotal(await d.tickets.record.read(issue), session)
    : 0;
  return takeCost(d.tickets.ref(issue), d, total);
}

function measure(d: CostDeps, session: string, since: string | null): Measured {
  try {
    return d.measure(session, since);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reason: `its transcript could not be read (${reason})`,
    };
  }
}

function startClock(issue: Key, d: Deps) {
  const session = d.env.CLAUDE_CODE_SESSION_ID ?? "";
  if (session) d.clock.write(session, { issue, start: d.now().toISOString() });
}

async function post(c: Ctx, issue: Key, kind: CommentKind) {
  return c.tickets.record.add(issue, entryFor(kind, c.config.columns));
}

/** The ticket as a comment names it. */
const named = (c: { tickets: Tickets }, key: Key) => ({
  key,
  ref: c.tickets.ref(key),
});

async function remove(c: Ctx, entryId: string) {
  await c.tickets.record.remove(entryId);
}

/** What the ticket waits on that is still open; none when the ticket
 * system records no blockers. */
export async function openBlockers(
  c: { tickets: Tickets },
  issue: Key,
): Promise<Key[]> {
  if (!c.tickets.blockers) return [];
  const blockers = await c.tickets.blockers.list(issue);
  return blockers.filter((b) => b.state === "open").map((b) => b.key);
}

/** The outcome of a claim, as `factory-build` reads it. */
export function claimOutcome(
  comments: Entry[],
  mine: string,
): "claimed" | `held by ${string}` {
  const { live } = workState(comments);
  if (live?.id === mine) return "claimed";
  const holder =
    live && live.marker.kind === "claim" ? live.marker.id : "unknown";
  return `held by ${holder}`;
}

async function claim(issue: Key, who: Identity, d: Ctx) {
  // A run nobody is watching posts the stopped comment, so the card does not
  // sit as "starting"; a session with a person at it just reports.
  const stopUnattended = async (reason: string) => {
    if (who.where === "actions")
      await post(d, issue, {
        kind: "stopped",
        where: "actions",
        issue: named(d, issue),
        reason,
      });
  };

  let blockers: Key[];
  try {
    blockers = await openBlockers(d, issue);
  } catch (error) {
    await stopUnattended("I could not read what this issue waits on").catch(
      () => {},
    );
    throw error;
  }
  if (blockers.length > 0) {
    const list = blockers.map((k) => d.tickets.ref(k)).join(", ");
    await stopUnattended(`it waits on ${list}, which has to merge first`);
    return `blocked by: ${list}`;
  }

  const mine = await post(d, issue, { kind: "claim", who });
  await d.sleep(5000);
  let comments: Entry[];
  try {
    comments = await readComments(d, issue);
  } catch (error) {
    await remove(d, mine).catch(() => {});
    await stopUnattended("I could not read the claim back").catch(() => {});
    throw error;
  }
  const outcome = claimOutcome(comments, mine);
  if (outcome === "claimed") {
    d.claimStore.write(issue, mine);
    startClock(issue, d);
    await adoptNamed(d, issue);
  } else await remove(d, mine);
  return outcome;
}

async function stillLive(issue: Key, d: Ctx): Promise<boolean> {
  const mine = d.claimStore.read(issue);
  if (mine === null) return false;
  return claimOutcome(await readComments(d, issue), mine) === "claimed";
}

/** Releases the claim this session holds on the ticket when no open pull
 * request links it: `released`, `kept`, or `not live`. This session's claim
 * is the one it stored, or the live one carrying its own place and ID. */
async function end(
  issue: Key,
  who: Identity,
  d: Ctx,
): Promise<"released" | "kept" | "not live"> {
  const ticket = await d.tickets.read(issue);
  const live = workState(ticket.record).live;
  const stored = d.claimStore.read(issue);
  const mine =
    live !== null &&
    live.marker.kind === "claim" &&
    (live.id === stored ||
      (live.marker.where === who.where && live.marker.id === who.id));
  if (!mine) return "not live";
  const pulls = linkPulls(
    await d.openPulls(d.repository, d.codeHost),
    d.tickets,
    d.own,
  );
  if (reviewingPulls(ticket, pulls, d.labels.tickets["follow-up"]).length > 0)
    return "kept";
  await post(d, issue, { kind: "ended", issue: named(d, issue) });
  return "released";
}

export function withLine(body: string, line: string): string {
  return `${body.trimEnd()}\n${line.trim()}\n`;
}

/** The follow-ups ticket this clone last opened, when it is still open and
 * still carries the label, read directly: a list made seconds after it was
 * opened can leave it out, and opening a second one breaks the one-ticket
 * rule. */
async function lastOpened(label: string, d: Ctx) {
  const key = d.followUpStore.read();
  if (key === null) return null;
  try {
    const t = await d.tickets.read(key);
    return t.finishedAt === null && t.labels.includes(label) ? t : null;
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

/** Adds a line to the open follow-ups issue, or opens the issue when none
 * is open. The file leads the line, so each one names what it is about. */
async function followUp(file: string, text: string, d: Ctx) {
  const line = `- [ ] ${file}: ${text}`;
  const label = d.labels.tickets["follow-up"];
  const open = (await d.tickets.listUnfinished()).filter((t) =>
    t.labels.includes(label),
  );
  const [listed] = open.sort((a, b) => compareKeys(a.key, b.key));
  const first = listed ?? (await lastOpened(label, d));
  if (first) {
    const issue = await d.tickets.read(first.key);
    await d.tickets.writeBody(first.key, withLine(issue.body, line));
    return `added to ${d.tickets.ref(first.key)}`;
  }
  const body = withLine(
    'Small problems noticed while doing other work, one line each, built together once the owner approves this issue. See "Follow-ups" in `.claude/factory/rules.md`.\n',
    line,
  );
  const factory = d.labels.tickets.factory;
  for (const l of [label, factory]) await d.tickets.ensureLabel(l);
  const made = await d.tickets.open({
    title: "Follow-ups",
    labels: [label, factory],
    body,
  });
  d.followUpStore.write(made);
  return `opened ${d.tickets.ref(made)}`;
}

/** Adds the factory label to the ticket, creating the label first where
 * the ticket system needs that. */
async function labelFactory(c: Ctx, issue: Key) {
  const name = c.labels.tickets.factory;
  await c.tickets.ensureLabel(name);
  await c.tickets.addLabel(issue, name);
}

/** A ticket named to a session becomes the factory's: it gets the label,
 * and the session says so. */
async function adoptNamed(c: Ctx, issue: Key) {
  const ticket = await c.tickets.read(issue);
  if (ticket.labels.includes(c.labels.tickets.factory)) return;
  await labelFactory(c, issue);
  const ref = c.tickets.ref(issue);
  c.out(
    `${ref} had no factory label: added it, so the factory now tracks ${ref}`,
  );
}

const ADOPT_USAGE =
  "Usage: factory ticket adopt N... | factory ticket adopt --all-open [--since-lock FILE]";

/** Whether the lock an update replaces already has the factory label's
 * setting, which every version before the label lacks. */
function lockHasLabel(text: string): boolean {
  const lock = parseYaml(text) as {
    settings?: { tickets?: { labels?: Record<string, unknown> } };
  } | null;
  return lock?.settings?.tickets?.labels?.factory !== undefined;
}

/** `factory ticket adopt`: labels the tickets named, or every one not
 * finished, and prints those it labeled and how many carry the label. */
async function adopt(args: string[], c: Ctx): Promise<number> {
  const all = args.includes("--all-open");
  const lock = option(args, "--since-lock");
  const keys = args.filter(
    (a, i) => !a.startsWith("--") && args[i - 1] !== "--since-lock",
  );
  if (!all && keys.length === 0) {
    console.error(ADOPT_USAGE);
    return 2;
  }
  const name = c.labels.tickets.factory;
  if (all && lock !== undefined) {
    let text: string | null = null;
    try {
      text = c.readFile(lock);
    } catch {
      text = null;
    }
    if (text !== null && lockHasLabel(text)) {
      c.out(`✓ nothing to label: ${lock} already has tickets.labels.factory`);
      return 0;
    }
  }
  const tickets = all
    ? (await c.tickets.listUnfinished())
        .map((t) => ({ key: t.key, labels: t.labels }))
        .sort((a, b) => compareKeys(a.key, b.key))
    : await Promise.all(
        keys.map(async (k) => {
          const t = await c.tickets.read(c.tickets.key(k));
          return { key: t.key, labels: t.labels };
        }),
      );
  const lacking = tickets.filter((t) => !t.labels.includes(name));
  for (const t of lacking) await labelFactory(c, t.key);
  if (lacking.length)
    c.out(`labeled ${lacking.map((t) => c.tickets.ref(t.key)).join(", ")}`);
  const count = tickets.length;
  const what = `${count}${all ? " open" : ""} ticket${count === 1 ? "" : "s"} ${count === 1 ? "carries" : "carry"} ${name}`;
  c.out(`✓ ${what}${lacking.length === 0 ? "; none needed it" : ""}`);
  return 0;
}

/** Set the card's Status to Ready, as the owner would. */
async function moveToReady(issue: Key, d: Ctx) {
  const ref = d.tickets.ref(issue);
  const found = await d.tickets.read(issue);
  if (found.finishedAt !== null) throw new Error(`${ref} is closed.`);
  if (d.board === null) throw new Error("The settings name no board.");
  const ready = d.config.columns.Ready?.[0] ?? null;
  if (ready === null)
    throw new Error(
      `This board has no column for ready. Tell a session to build ${ref}, or run factory build ${issue}.`,
    );
  const board = need(d.tickets, "board");
  const read = await board.read();
  const item = read.items.get(issue);
  if (!item) throw new Error(`${ref} is not on the board.`);
  if (item.status !== null && sameName(item.status, ready)) return;
  const fields = checkFields(read.fields, d.config, read.columnField);
  const option = fields.status.options?.find((o) => sameName(o.name, ready));
  try {
    await board.move(item.itemId, option?.name ?? ready);
  } catch (error) {
    if (/INSUFFICIENT_SCOPES|required scopes/i.test(String(error)))
      throw new Error(
        "The GitHub CLI can read the board but not write it. Run: gh auth refresh -s project",
      );
    throw error;
  }
}

/** The value after `name`, or undefined when it is absent; a usage error
 * when it is present with nothing after it. */
function option(args: string[], name: string): string | undefined {
  const at = args.indexOf(name);
  if (at === -1) return undefined;
  const value = args[at + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(USAGE);
  return value;
}

/** Every value given for a repeatable option. */
function options(args: string[], name: string): string[] {
  const values: string[] = [];
  args.forEach((a, i) => {
    if (a !== name) return;
    const value = args[i + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(USAGE);
    values.push(value);
  });
  return values;
}

/** A ticket for a reader: title, state, labels, body, and each comment with
 * its ID and author. */
export function formatTicket(
  t: Ticket,
  ref: string,
  names: Labels["tickets"],
): string[] {
  const lines = [
    `${ref} ${t.title}`,
    `state: ${stateOf(t)}`,
    `labels: ${shownLabels(t.labels, names).join(", ") || "(none)"}`,
    "",
    t.body.trimEnd() || "(no body)",
  ];
  for (const c of t.comments) lines.push("", ...formatComment(c));
  return lines;
}

/** A ticket's state as `view` prints it. */
const stateOf = (t: Ticket) => (t.finishedAt === null ? "open" : "closed");

/** One comment as `view` prints it: a line naming it, then its body. */
export function formatComment(c: TicketComment): string[] {
  return [
    `--- comment ${c.id} by ${c.author} at ${c.createdAt}`,
    c.body.trimEnd(),
  ];
}

/** The comments on a ticket that count as answers: by someone the ticket
 * system says may decide, without the agent mark, oldest first. Asks once
 * for each distinct author. */
async function answersOf(t: Tickets, ticket: Ticket): Promise<TicketComment[]> {
  const unmarked = ticket.comments.filter((c) => !c.body.includes(AGENT_MARK));
  const authors = [...new Set(unmarked.map((c) => c.author))];
  const may = await Promise.all(authors.map((a) => t.mayDecide(a)));
  const deciders = new Set(authors.filter((_, i) => may[i]));
  return unmarked
    .filter((c) => deciders.has(c.author))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

const FIELDS = ["title", "state", "labels", "body", "ref"] as const;

/** A ticket as `--json` prints it: its key, then its written form. */
const withRef = <T extends { key: Key }>(t: T, tickets: Tickets) => {
  const { key, ...rest } = t;
  return { key, ref: tickets.ref(key), ...rest };
};

const READS_AND_WRITES = new Set([
  "view",
  "answers",
  "list",
  "edit",
  "comment",
  "open",
  "label",
  "link",
  "branch",
  "blockers",
  "block",
  "unblock",
  "supports",
]);

/** The branch a build of `ticket` pushes, from `code-host.branch-name`.
 * In a run under an organization's app the user is the app, by the slug
 * FACTORY_APP_SLUG holds: the code host tells an app's token nothing of
 * who is signed in. */
async function branchOf(ticket: Key, d: Ctx): Promise<string> {
  let user = d.env.FACTORY_APP_SLUG ?? "";
  if (!user && d.branchName.includes("{user}"))
    try {
      user = await d.signedInAs(d.repository, d.codeHost);
    } catch (e) {
      if (!(e instanceof NotSignedInError)) throw e;
      throw new Error(
        "code-host.branch-name uses {user}, and gh is not signed in: run gh auth login",
        { cause: e },
      );
    }
  return d.branchName.replaceAll("{ticket}", ticket).replaceAll("{user}", user);
}

/** The commands that read or write a ticket for a skill. Null when
 * `command` is not one of them. */
async function ticketCommand(
  command: string,
  args: string[],
  d: Ctx,
): Promise<number | null> {
  const t = d.tickets;
  const keyed = () => {
    if (!args[0] || args[0].startsWith("--")) throw new Error(USAGE);
    return t.key(args[0]);
  };
  const json = args.includes("--json");
  const names = d.labels.tickets;
  /** A ticket label's key as its name, and the override's too, which a
   * session may ask about or remove but never add. */
  const named = (word: string) =>
    labelOf(
      { ...names, "verdict-override": d.labels.codeHost["verdict-override"] },
      word,
    );
  switch (command) {
    case "view": {
      const ticket = await t.read(keyed());
      const field = option(args, "--field");
      if (json) d.out(JSON.stringify(withRef(ticket, t), null, 2));
      else if (field === undefined)
        formatTicket(ticket, t.ref(ticket.key), names).forEach(d.out);
      else if (!(FIELDS as readonly string[]).includes(field))
        throw new Error(`--field is one of ${FIELDS.join(", ")}.`);
      else if (field === "labels")
        shownLabels(ticket.labels, names).forEach(d.out);
      else if (field === "ref") d.out(t.ref(ticket.key));
      else if (field === "state") d.out(stateOf(ticket));
      else d.out(String(ticket[field as "title" | "body"]));
      return 0;
    }
    case "answers": {
      const ticket = await t.read(keyed());
      const answers = await answersOf(t, ticket);
      if (answers.length === 0)
        d.out(`${t.ref(ticket.key)} has no answers from an approver yet.`);
      answers.forEach((c, i) => {
        if (i > 0) d.out("");
        formatComment(c).forEach(d.out);
      });
      return 0;
    }
    case "list": {
      const given = option(args, "--label");
      const label = given === undefined ? undefined : labelOf(names, given);
      const title = option(args, "--title");
      const kept = (await t.listUnfinished())
        .filter((x) => label === undefined || x.labels.includes(label))
        .filter((x) => title === undefined || x.title === title)
        .sort((a, b) => compareKeys(a.key, b.key));
      if (json)
        d.out(
          JSON.stringify(
            kept.map((x) => withRef(x, t)),
            null,
            2,
          ),
        );
      else
        for (const x of kept)
          d.out(
            `${x.key}\t${x.title}\t${shownLabels(x.labels, names).join(", ")}`,
          );
      return 0;
    }
    case "edit":
    case "comment": {
      const ticket = keyed();
      const file = option(args, "--body-file");
      const newTitle = command === "edit" ? option(args, "--title") : undefined;
      if (!file && newTitle === undefined) throw new Error(USAGE);
      if (!file && options(args, "--attach").length) throw new Error(USAGE);
      if (newTitle !== undefined) refuseBareTags(newTitle);
      if (!file) {
        await t.writeTitle(ticket, newTitle!);
        d.out("edited");
        return 0;
      }
      const attach = options(args, "--attach");
      const body = d.readFile(file);
      refuseBareTags(body);
      const files = attach.length ? need(t, "attachments") : null;
      if (command === "edit") {
        // The body first: a body refused, as by a missing ticket field,
        // leaves the title as it was.
        if (files) await files.writeBody(ticket, body, attach);
        else await t.writeBody(ticket, body);
        if (newTitle !== undefined) await t.writeTitle(ticket, newTitle);
        d.out("edited");
      } else
        d.out(
          String(
            files
              ? await files.comment(ticket, body, attach)
              : await t.comment(ticket, body),
          ),
        );
      return 0;
    }
    case "open": {
      const title = option(args, "--title");
      const file = option(args, "--body-file");
      if (!title || !file) throw new Error(USAGE);
      const body = d.readFile(file);
      refuseBareTags(title);
      refuseBareTags(body);
      const labels = [
        ...new Set([
          ...options(args, "--label").map((l) => labelOf(names, l)),
          names.factory,
        ]),
      ];
      for (const l of labels) await t.ensureLabel(l);
      d.out(String(await t.open({ title, body, labels })));
      return 0;
    }
    case "label": {
      const ticket = keyed();
      const add = option(args, "--add");
      const removed = option(args, "--remove");
      const was = option(args, "--was-removed");
      const given = [add, removed, was].filter((x) => x !== undefined);
      if (given.length !== 1) throw new Error(USAGE);
      if (was !== undefined) {
        const history = need(t, "label-history");
        d.out((await history.wasRemoved(ticket, named(was))) ? "yes" : "no");
      } else if (add !== undefined) {
        refuseOverride(add, d.labels.codeHost["verdict-override"]);
        await t.ensureLabel(labelOf(names, add));
        await t.addLabel(ticket, labelOf(names, add));
        d.out("added");
      } else {
        await t.removeLabel(ticket, named(removed!));
        d.out("removed");
      }
      return 0;
    }
    case "link":
      d.out(t.linkText(keyed(), args.includes("--part") ? "part" : "closes"));
      return 0;
    case "branch": {
      const ticket = await t.read(keyed());
      d.out(await branchOf(ticket.key, d));
      return 0;
    }
    case "blockers": {
      const list = await need(t, "blockers").list(keyed());
      for (const b of list) d.out(`${t.ref(b.key)} ${b.state}`);
      return 0;
    }
    case "block":
    case "unblock": {
      const ticket = keyed();
      const given = option(args, "--by");
      if (given === undefined) throw new Error(USAGE);
      const by = t.key(given);
      const blockers = need(t, "blockers");
      if (command === "block") await blockers.add(ticket, by);
      else await blockers.remove(ticket, by);
      d.out(command === "block" ? "blocked" : "unblocked");
      return 0;
    }
    default:
      return null;
  }
}

/** The steps after the reads and writes, each on one ticket. */
const STEPS = new Set([
  "claim",
  "still-live",
  "stop",
  "end",
  "ready",
  "refining",
  "waiting",
  "cost",
  "refined",
]);

const USAGE =
  "Usage: factory ticket claim|still-live|stop|end|refining|waiting|refined|ready|cost|adopt|view|answers|list|edit|comment|open|label|link|branch|blockers|block|unblock|supports|follow-up ...";

/** The commands that record something on a ticket, after each of which
 * the board sync runs, since no ticket system tells the code host. */
const RECORDING = new Set([
  "claim",
  "refining",
  "waiting",
  "refined",
  "stop",
  "end",
  "ready",
  "cost",
  "adopt",
  "open",
  "follow-up",
]);

export async function main(argv: string[], deps: Deps): Promise<number> {
  const code = await command(argv, deps);
  if (code !== 0 || !RECORDING.has(argv[0] ?? "")) return code;
  try {
    const settings = await deps.settings();
    // The sync's workflow is written only where there is a board to sync.
    if (settings.tickets.board === null && !settings.tickets.statuses)
      return code;
    await deps.startSync(targetOf(settings, deps.env).repository, settings);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    deps.out(
      `? the board updates at the nightly sync: couldn't start the board sync (${reason})`,
    );
  }
  return code;
}

async function command(argv: string[], deps: Deps): Promise<number> {
  const [command, first, ...rest] = argv;
  try {
    // `supports` answers before anything is read: it names the groups.
    const settings = await deps.settings();
    const { repository, board } = targetOf(settings, deps.env);
    const opened = await deps.open(settings, { repository, board });
    const d: Ctx = {
      ...deps,
      config: boardConfigOf(settings),
      codeHost: settings.codeHost.type,
      // Null only when init reads the settings to ask for it.
      branchName: settings.codeHost.branchName!,
      repository,
      board,
      ...opened,
      own: ownLinks(settings),
      labels: {
        tickets: settings.tickets.labels,
        codeHost: settings.codeHost.labels,
      },
    };
    if (command === "supports") {
      if (!first || !(GROUPS as readonly string[]).includes(first))
        throw new Error(
          `No group ${first ?? ""}: the groups are ${GROUPS.join(", ")}.`,
        );
      d.out(supports(d.tickets, first as Group) ? "yes" : "no");
      return 0;
    }
    if (command === "adopt")
      return await adopt(first === undefined ? rest : [first, ...rest], d);
    if (command === "follow-up") {
      if (!first || !rest[0]) throw new Error(USAGE);
      d.out(await followUp(first, rest[0], d));
      return 0;
    }
    const handled = await ticketCommand(
      command ?? "",
      first === undefined ? rest : [first, ...rest],
      d,
    );
    if (handled !== null) return handled;
    if (!STEPS.has(command ?? "") || !first || first.startsWith("--"))
      throw new Error(USAGE);
    const issue = d.tickets.key(first);

    if (command === "still-live") {
      const live = await stillLive(issue, d);
      d.out(live ? "live" : "not live");
      return live ? 0 : 3;
    }
    const who = sessionIdentity(
      d.env,
      d.runner(repository, settings.builds.runner),
    );
    switch (command) {
      case "claim":
        d.out(await claim(issue, who, d));
        return 0;
      case "stop": {
        if (!rest[0]) throw new Error(USAGE);
        if (!(await stillLive(issue, d))) {
          d.out("not live; posted nothing");
          return 3;
        }
        {
          const taken = await ticketCost(issue, d);
          await post(d, issue, {
            kind: "stopped",
            where: who.where,
            issue: named(d, issue),
            reason: rest[0],
            cost: taken.note,
          });
          taken.restart();
        }
        d.out("released");
        return 0;
      }
      case "end":
        d.out(await end(issue, who, d));
        return 0;
      case "ready":
        await adoptNamed(d, issue);
        await moveToReady(issue, d);
        d.out("ready");
        return 0;
      case "refining":
        await adoptNamed(d, issue);
        await post(d, issue, { kind: "refining", who });
        startClock(issue, d);
        break;
      case "waiting":
        {
          const taken = await ticketCost(issue, d);
          await post(d, issue, {
            kind: "waiting",
            cost: taken.note,
          });
          taken.restart();
        }
        break;
      case "cost":
        // Read first: a number that is no ticket leaves the clock.
        await d.tickets.read(issue);
        {
          const taken = await ticketCost(issue, d);
          await post(d, issue, {
            kind: "cost",
            cost: taken.note,
          });
          taken.restart();
        }
        break;
      case "refined": {
        // A body the build could not read gets no marker, whoever wrote it.
        const ticket = await d.tickets.read(issue);
        const missing = missingParts(
          ticket.body,
          ticket.labels,
          d.labels.tickets,
        );
        if (missing.length > 0) {
          for (const line of missing) console.error(line);
          return 1;
        }
        if (rest.includes("--check")) {
          d.out("sound");
          return 0;
        }
        const at = rest.indexOf("--before-file");
        const before = at === -1 ? undefined : d.readFile(rest[at + 1]);
        {
          const taken = await ticketCost(issue, d);
          await post(d, issue, {
            kind: "refined",
            issue: named(d, issue),
            before,
            cost: taken.note,
          });
          taken.restart();
        }
        break;
      }
      default:
        throw new Error(USAGE);
    }
    d.out("posted");
    return 0;
  } catch (error) {
    // The steps print one line whatever happens; a read or write for a
    // skill prints nothing on stdout, so nothing there reads as an answer.
    if (!READS_AND_WRITES.has(command ?? ""))
      deps.out(command === "claim" ? "could not read" : "failed");
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function followUpPath() {
  return join(commonDir(), "work-follow-up");
}

function claimPath(issue: Key) {
  return join(commonDir(), `work-claim-${issue}`);
}

/** What the commands run with, outside a test. */
export function ticketDeps(): Deps {
  return {
    open: (settings, target) => openTickets(settings, target),
    openPulls: (repository, codeHost) =>
      openCodeHost(repository, codeHost).open(),
    signedInAs: (repository, codeHost) =>
      openCodeHost(repository, codeHost).signedInAs(),
    runner: (repository, name) => openRunner(repository, name),
    startSync: async (repository, settings) => {
      const branch = await openCodeHost(
        repository,
        settings.codeHost.type,
      ).defaultBranch();
      await openRunner(repository, settings.builds.runner).startSync(branch);
    },
    settings: () => loadSettings(),
    env: process.env,
    sleep,
    out: (line) => console.log(line),
    readFile: (path) => readFileSync(path, "utf8"),
    now: () => new Date(),
    clock: { read: readClock, write: writeClock },
    measure: (session, since) =>
      measureSession(projectsDir(process.env), session, since),
    followUpStore: {
      read: () =>
        existsSync(followUpPath())
          ? readFileSync(followUpPath(), "utf8").trim() || null
          : null,
      write: (key) => writeFileSync(followUpPath(), key),
    },
    claimStore: {
      read: (issue) => {
        const path = claimPath(issue);
        return existsSync(path) ? readFileSync(path, "utf8").trim() : null;
      },
      write: (issue, id) => writeFileSync(claimPath(issue), String(id)),
    },
  };
}

/** `factory ticket ...` and `factory follow-up ...`. */
export async function run(argv: string[]): Promise<number> {
  return main(argv, ticketDeps());
}

/** The claim this checkout made on a ticket, by its record's ID. */
export const claimHere = (issue: Key): string | null =>
  ticketDeps().claimStore.read(issue);
