#!/usr/bin/env node
// The steps a session takes on an issue that are the same every time: claim
// it, check the claim still holds, stop, post a refinement marker, and note
// what the session spent.
//
//   factory ticket claim N
//   factory ticket still-live N
//   factory ticket stop N "one-line reason"
//   factory ticket end N
//   factory ticket refining|waiting N
//   factory ticket refined N [--check] [--before-file FILE]
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
// A failed read exits 1 with the error; every other outcome is the one line
// printed.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { load as parseYaml } from "js-yaml";
import { setTimeout as sleep } from "node:timers/promises";
import { sessionIdentity } from "./lib/gh.mts";
import { openCodeHost, reachCodeHost } from "./code-host/index.mts";
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
import { missingParts, OUTSIDE_DOCS_AND_TESTS } from "./lib/refined-check.mts";
import { labelOf, shownLabels, type Labels } from "./labels.mts";
import {
  claimPath,
  commonDir,
  readClock,
  writeClock,
  type Clock,
} from "./lib/clock.mts";
import type { Reach } from "./across.mts";
import { homeOf, readList } from "./across.mts";
import {
  builtHere,
  linkLines,
  notBuildable,
  repositories,
} from "./ticket-repositories.mts";
import { sectionOf, withSection, wordOf } from "./lib/repositories.mts";
import type { CodeHost } from "./code-host/index.mts";
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
import * as say from "./lib/output.mts";

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
  /** The code host of any of a ticket's repositories. `own` is the
   * checkout's. */
  reach: (
    repository: string,
    codeHost: string,
    own: string,
  ) => Promise<CodeHost>;
  /** Has a pull request's "Merge order" worked out again, by a run in its
   * own repository. */
  startOrder: (
    repository: string,
    pull: number,
    settings: Settings,
  ) => Promise<void>;
  /** Whether what is run was asked for by a session in the cloud, which may
   * not change which repositories a ticket names. */
  fromCloudSession?: boolean;
  /** Starts the board sync on the default branch, through the runner. */
  startSync: (repository: string, settings: Settings) => Promise<void>;
  /** The factory's settings, read once when the command starts. */
  settings: () => Promise<Settings>;
  env: Record<string, string | undefined>;
  sleep: (ms: number) => Promise<unknown>;
  out: (line: string) => void;
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
  /** Whether the default branch has `name` as a whole word, outside docs
   * and tests. */
  hasName: (name: string) => boolean;
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
  /** The code host of any of a ticket's repositories. */
  hostOf: Reach;
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

/** A ticket's repositories keep a build of it from starting here. */
class NotBuildable extends Error {}

/** What the ticket's repositories ask of this checkout. */
const place = (d: Ctx) => ({
  tickets: d.tickets,
  repository: d.repository,
  reach: d.hostOf,
});

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

  let fault: string | null;
  try {
    fault = await notBuildable(await d.tickets.read(issue), place(d));
  } catch (error) {
    await stopUnattended("I could not read which repositories it names").catch(
      () => {},
    );
    throw error;
  }
  if (fault !== null) {
    await stopUnattended(fault);
    throw new NotBuildable(fault);
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
  const built = await builtHere(ticket, place(d));
  if (built ?? reviewingPulls(ticket, pulls).length > 0) return "kept";
  await post(d, issue, { kind: "ended", issue: named(d, issue) });
  return "released";
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
    say.plainError(ADOPT_USAGE);
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
  const may = await Promise.all(authors.map((a) => t.mayDecide(a, ticket.key)));
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
  "repositories",
  "blockers",
  "block",
  "unblock",
  "supports",
]);

/** The branch a build of `ticket` pushes, from `code-host.branch-name`.
 * In a run under an organization's app the user is the app, by the slug
 * FACTORY_APP_SLUG holds: the code host tells an app's token nothing of
 * who is signed in. */
export async function branchName(
  ticket: Key,
  pattern: string,
  signedInAs: () => Promise<string>,
  env: Record<string, string | undefined> = process.env,
): Promise<string> {
  let user = env.FACTORY_APP_SLUG ?? "";
  if (!user && pattern.includes("{user}"))
    try {
      user = await signedInAs();
    } catch (e) {
      if (!(e instanceof NotSignedInError)) throw e;
      throw new Error(
        "code-host.branch-name uses {user}, and gh is not signed in: run gh auth login",
        { cause: e },
      );
    }
  return pattern
    .replaceAll("{ticket}", wordOf(ticket))
    .replaceAll("{user}", user);
}

const branchOf = (ticket: Key, d: Ctx) =>
  branchName(
    ticket,
    d.branchName,
    () => d.signedInAs(d.repository, d.codeHost),
    d.env,
  );

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
      {
        ...names,
        "verdict-override": d.labels.codeHost["verdict-override"],
        "policy-override": d.labels.codeHost["policy-override"],
      },
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
      let body = d.readFile(file);
      refuseBareTags(body);
      if (command === "edit") {
        const section = sectionOf((await t.read(ticket)).body);
        if (
          section ? d.fromCloudSession || !sectionOf(body) : d.fromCloudSession
        )
          body = withSection(body, section);
      }
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
        refuseOverride(add, d.labels.codeHost);
        await t.ensureLabel(labelOf(names, add));
        await t.addLabel(ticket, labelOf(names, add));
        d.out("added");
      } else {
        await t.removeLabel(ticket, named(removed!));
        d.out("removed");
      }
      return 0;
    }
    case "link": {
      const key = keyed();
      const lines = args.includes("--part")
        ? null
        : await linkLines(await t.read(key), place(d));
      (
        lines ?? [t.linkText(key, args.includes("--part") ? "part" : "closes")]
      ).forEach(d.out);
      return 0;
    }
    case "repositories":
      return repositories(keyed(), args.slice(1), {
        ...place(d),
        columns: d.config.columns,
        out: d.out,
        signedInAs: () => d.signedInAs(d.repository, d.codeHost),
        startOrder: async (repository, pull) =>
          d.startOrder(repository, pull, await d.settings()),
      });
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
  "Usage: factory ticket claim|still-live|stop|end|refining|waiting|refined|ready|cost|adopt|view|answers|list|edit|comment|open|label|link|branch|repositories|blockers|block|unblock|supports ...";

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
]);

export async function main(argv: string[], deps: Deps): Promise<number> {
  const code = await command(argv, deps);
  const recorded =
    RECORDING.has(argv[0] ?? "") ||
    (argv[0] === "repositories" && argv.length > 2);
  if (code !== 0 || !recorded) return code;
  try {
    const settings = await deps.settings();
    // The sync's workflow is written only where there is a board to sync.
    if (settings.tickets.board === null && !settings.tickets.statuses)
      return code;
    const { repository, board } = targetOf(settings, deps.env);
    const { tickets } = await deps.open(settings, { repository, board });
    await deps.startSync(syncedIn(argv, tickets, repository), settings);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    deps.out(
      `? the board updates at the nightly sync: couldn't start the board sync (${reason})`,
    );
  }
  return code;
}

/** The repository whose sync keeps the ticket a command recorded on: the
 * ticket's own. */
function syncedIn(
  argv: string[],
  tickets: Tickets,
  repository: string,
): string {
  const key = argv[1];
  if (!key || ["adopt", "open"].includes(argv[0]!)) return repository;
  return homeOf(tickets, tickets.key(key), repository);
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
      hostOf: (other) => deps.reach(other, settings.codeHost.type, repository),
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
          d.hasName,
        );
        try {
          readList(ticket, d.tickets);
        } catch (error) {
          const line = (error as { cause?: { line?: string } }).cause?.line;
          missing.push(
            `missing: a Repositories section that can be read: ${JSON.stringify(line)}`,
          );
        }
        if (missing.length > 0) {
          for (const line of missing) say.plainError(line);
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
    if (error instanceof NotBuildable) {
      deps.out(`✗ ${error.message}`);
      return 1;
    }
    // The steps print one line whatever happens; a read or write for a
    // skill prints nothing on stdout, so nothing there reads as an answer.
    if (!READS_AND_WRITES.has(command ?? ""))
      deps.out(command === "claim" ? "could not read" : "failed");
    say.plainError(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

/** Whether the default branch, as `origin` has it, or the checkout's own
 * tip where `origin` names none, has `name` outside docs and tests. */
export function hasNameIn(cwd: string): (name: string) => boolean {
  const git = (args: string[]) =>
    spawnSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  let ref: string | undefined;
  return (name) => {
    ref ??=
      git([
        "symbolic-ref",
        "--short",
        "refs/remotes/origin/HEAD",
      ]).stdout?.trim() || "HEAD";
    return (
      git(["grep", "-qwF", name, ref, "--", ".", ...OUTSIDE_DOCS_AND_TESTS])
        .status === 0
    );
  };
}

/** What the commands run with, outside a test. */
export function ticketDeps(): Deps {
  return {
    open: (settings, target) => openTickets(settings, target),
    openPulls: (repository, codeHost) =>
      openCodeHost(repository, codeHost).open(),
    signedInAs: (repository, codeHost) =>
      openCodeHost(repository, codeHost).signedInAs(),
    reach: (repository, codeHost, own) =>
      reachCodeHost(repository, codeHost, own),
    startOrder: async (repository, pull, settings) => {
      const branch = await openCodeHost(
        repository,
        settings.codeHost.type,
      ).defaultBranch();
      await openRunner(repository, settings.builds.runner).startOn(
        "order",
        pull,
        branch,
      );
    },
    runner: (repository, name) => openRunner(repository, name),
    hasName: hasNameIn(process.cwd()),
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
    out: say.plainPrinter(),
    readFile: (path) => readFileSync(path, "utf8"),
    now: () => new Date(),
    clock: { read: readClock, write: writeClock },
    measure: (session, since) =>
      measureSession(projectsDir(process.env), session, since),
    claimStore: {
      read: (issue) => {
        const path = claimPath(issue);
        return existsSync(path) ? readFileSync(path, "utf8").trim() : null;
      },
      write: (issue, id) => writeFileSync(claimPath(issue), String(id)),
    },
  };
}

/** `factory ticket ...`. */
export async function run(argv: string[]): Promise<number> {
  return main(argv, ticketDeps());
}

/** The claim this checkout made on a ticket, by its record's ID. */
export const claimHere = (issue: Key): string | null =>
  ticketDeps().claimStore.read(issue);
