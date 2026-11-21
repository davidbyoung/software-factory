#!/usr/bin/env node
// The steps a session takes on an issue that are the same every time: claim
// it, check the claim still holds, stop, post a refinement marker, note what
// the session spent, and add a line to the follow-ups issue.
//
//   npx --no-install factory ticket claim N
//   npx --no-install factory ticket still-live N
//   npx --no-install factory ticket stop N "one-line reason"
//   npx --no-install factory ticket end N
//   npx --no-install factory ticket refining|waiting N
//   npx --no-install factory ticket refined N [--check] [--before-file FILE]
//   npx --no-install factory follow-up FILE "what is wrong"
//   npx --no-install factory ticket ready N
//   npx --no-install factory ticket cost N
//
// And the reads and writes the skills make, through the ticket interface
// (`tickets/`), so no skill calls a ticket system itself:
//
//   factory ticket view N [--field title|state|labels|body] [--json]
//   factory ticket list [--label LABEL] [--title "TITLE"] [--json]
//   factory ticket edit N [--title TITLE] [--body-file FILE [--attach FILE]...]
//   factory ticket comment N --body-file FILE [--attach FILE]...
//   factory ticket open --title TITLE --body-file FILE [--label LABEL]...
//   factory ticket label N --add LABEL | --remove LABEL | --was-removed LABEL
//   factory ticket link N
//   factory ticket blockers N
//   factory ticket block N --by M
//   factory ticket unblock N --by M
//   factory ticket supports GROUP
//
// The cost clock: `claim` and `refining` start the session's clock on N.
// `waiting`, `refined`, `stop`, and `cost` post what the session and its
// subagents spent, as a share of the subscription and at API list prices,
// since the clock started, or since the
// session started when it has none, then restart it. `cost` posts to issue
// or pull request N. The clock is keyed by CLAUDE_CODE_SESSION_ID, the ID the
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
import { setTimeout as sleep } from "node:timers/promises";
import { sessionIdentity } from "./lib/gh.mts";
import { openCodeHost } from "./code-host/index.mts";
import { openRunner } from "./runner/index.mts";
import type { Runner } from "./runner/types.mts";
import { loadSettings, targetOf, type Settings } from "./config.mts";
import {
  commentBody,
  sameName,
  reviewingPulls,
  workState,
  type CommentKind,
  type Identity,
  type IssueComment,
  type PullRequest,
} from "./lib/work-status.mts";
import { missingParts } from "./lib/refined-check.mts";
import { commonDir, readClock, writeClock, type Clock } from "./lib/clock.mts";
import { costNote, measureSession, projectsDir } from "./lib/usage.mts";
import type { Measured } from "./lib/usage.mts";
import { boardConfigOf, checkFields, type BoardConfig } from "./board.mts";
import { refuseBareTags, refuseOverride } from "./guard-ticket-text.mts";
import { openTickets } from "./tickets/index.mts";
import {
  GROUPS,
  need,
  supports,
  type Group,
  type Ticket,
  type Tickets,
} from "./tickets/types.mts";
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
  /** The factory's settings, read once when the command starts. */
  settings: () => Promise<Settings>;
  env: Record<string, string | undefined>;
  sleep: (ms: number) => Promise<unknown>;
  out: (line: string) => void;
  /** Where this checkout remembers the claim it posted on each issue. */
  claimStore: {
    read: (issue: number) => number | null;
    write: (issue: number, commentId: number) => void;
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
};

export type { Clock };

export async function readComments(
  c: { tickets: Tickets },
  issue: number,
): Promise<IssueComment[]> {
  return (await c.tickets.read(issue)).comments;
}

/** The cost note for what this session spent since its clock started, and
 * the clock restarted from now. */
function takeCost(issue: number, d: Deps): string {
  const session = d.env.CLAUDE_CODE_SESSION_ID ?? "";
  if (!session)
    return costNote(
      { ok: false, reason: "CLAUDE_CODE_SESSION_ID is not set" },
      issue,
      session,
    );
  const clock = d.clock.read(session);
  const now = d.now().toISOString();
  const note = costNote(
    measure(d, session, clock?.start ?? null),
    issue,
    session,
  );
  // Only claim and refining choose the issue: a note posted elsewhere, such
  // as on a pull request, keeps the clock's.
  d.clock.write(session, { issue: clock ? clock.issue : null, start: now });
  return note;
}

function measure(d: Deps, session: string, since: string | null): Measured {
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

function startClock(issue: number, d: Deps) {
  const session = d.env.CLAUDE_CODE_SESSION_ID ?? "";
  if (session) d.clock.write(session, { issue, start: d.now().toISOString() });
}

async function post(c: Ctx, issue: number, kind: CommentKind) {
  return c.tickets.comment(issue, commentBody(kind, c.config.columns));
}

async function remove(c: Ctx, commentId: number) {
  await c.tickets.deleteComment(commentId);
}

/** What the ticket waits on that is still open; none when the ticket
 * system records no blockers. */
export async function openBlockers(c: { tickets: Tickets }, issue: number) {
  if (!c.tickets.blockers) return [];
  const blockers = await c.tickets.blockers.list(issue);
  return blockers.filter((b) => b.state === "open").map((b) => b.number);
}

/** The outcome of a claim, as `factory-build` reads it. */
export function claimOutcome(
  comments: IssueComment[],
  mine: number,
): "claimed" | `held by ${string}` {
  const { live } = workState(comments);
  if (live?.id === mine) return "claimed";
  const holder =
    live && live.marker.kind === "claim" ? live.marker.id : "unknown";
  return `held by ${holder}`;
}

async function claim(issue: number, who: Identity, d: Ctx) {
  // A run nobody is watching posts the stopped comment, so the card does not
  // sit as "starting"; a session with a person at it just reports.
  const stopUnattended = async (reason: string) => {
    if (who.where === "actions")
      await post(d, issue, {
        kind: "stopped",
        where: "actions",
        issue,
        reason,
      });
  };

  let blockers: number[];
  try {
    blockers = await openBlockers(d, issue);
  } catch (error) {
    await stopUnattended("I could not read what this issue waits on").catch(
      () => {},
    );
    throw error;
  }
  if (blockers.length > 0) {
    const list = blockers.map((n) => `#${n}`).join(", ");
    await stopUnattended(`it waits on ${list}, which has to merge first`);
    return `blocked by: ${list}`;
  }

  const mine = await post(d, issue, { kind: "claim", who });
  await d.sleep(5000);
  let comments: IssueComment[];
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
  } else await remove(d, mine);
  return outcome;
}

async function stillLive(issue: number, d: Ctx): Promise<boolean> {
  const mine = d.claimStore.read(issue);
  if (mine === null) return false;
  return claimOutcome(await readComments(d, issue), mine) === "claimed";
}

/** Releases the claim this session holds on the ticket when no open pull
 * request links it: `released`, `kept`, or `not live`. This session's claim
 * is the one it stored, or the live one carrying its own place and ID. */
async function end(
  issue: number,
  who: Identity,
  d: Ctx,
): Promise<"released" | "kept" | "not live"> {
  const ticket = await d.tickets.read(issue);
  const live = workState(ticket.comments).live;
  const stored = d.claimStore.read(issue);
  const mine =
    live !== null &&
    live.marker.kind === "claim" &&
    (live.id === stored ||
      (live.marker.where === who.where && live.marker.id === who.id));
  if (!mine) return "not live";
  const pulls = await d.openPulls(d.repository, d.codeHost);
  if (reviewingPulls(ticket, pulls).length > 0) return "kept";
  await post(d, issue, { kind: "ended", issue });
  return "released";
}

export function withLine(body: string, line: string): string {
  return `${body.trimEnd()}\n${line.trim()}\n`;
}

/** Adds a line to the open follow-ups issue, or opens the issue when none
 * is open. The file leads the line, so each one names what it is about. */
async function followUp(file: string, text: string, d: Ctx) {
  const line = `- [ ] ${file}: ${text}`;
  const open = (await d.tickets.listOpen()).filter((t) =>
    t.labels.includes("follow-up"),
  );
  const [first] = open.sort((a, b) => a.number - b.number);
  if (first) {
    const issue = await d.tickets.read(first.number);
    await d.tickets.writeBody(first.number, withLine(issue.body, line));
    return `added to #${first.number}`;
  }
  const body = withLine(
    'Small problems noticed while doing other work, one line each, built together once the owner approves this issue. See "Follow-ups" in `.claude/factory/rules.md`.\n',
    line,
  );
  const made = await d.tickets.open({
    title: "Follow-ups",
    labels: ["follow-up"],
    body,
  });
  return `opened #${made}`;
}

/** Set the card's Status to Ready, as the owner would. */
async function moveToReady(issue: number, d: Ctx) {
  const found = await d.tickets.read(issue);
  if (found.state !== "open") throw new Error(`#${issue} is closed.`);
  if (d.board === null) throw new Error("The settings name no board.");
  const ready = d.config.columns.Ready?.[0] ?? null;
  if (ready === null)
    throw new Error(
      `This board has no column for ready. Tell a session to build #${issue}, or run factory build ${issue}.`,
    );
  const board = need(d.tickets, "board");
  const read = await board.read();
  const item = read.items.get(issue);
  if (!item) throw new Error(`#${issue} is not on the board.`);
  if (item.status !== null && sameName(item.status, ready)) return;
  const fields = checkFields(read.fields, d.config);
  const option = fields.status.options?.find((o) => sameName(o.name, ready));
  try {
    await board.set(item.itemId, [
      { field: fields.status.name, optionName: option?.name ?? ready },
    ]);
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
export function formatTicket(t: Ticket): string[] {
  const lines = [
    `#${t.number} ${t.title}`,
    `state: ${t.state}`,
    `labels: ${t.labels.join(", ") || "(none)"}`,
    "",
    t.body.trimEnd() || "(no body)",
  ];
  for (const c of t.comments)
    lines.push(
      "",
      `--- comment ${c.id} by ${c.author} at ${c.createdAt}`,
      c.body.trimEnd(),
    );
  return lines;
}

const FIELDS = ["title", "state", "labels", "body"] as const;

const READS_AND_WRITES = new Set([
  "view",
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

/** The branch a build of `ticket` pushes, from `code-host.branch-name`. */
async function branchOf(ticket: number, d: Ctx): Promise<string> {
  let user = "";
  if (d.branchName.includes("{user}"))
    try {
      user = await d.signedInAs(d.repository, d.codeHost);
    } catch (e) {
      if (!(e instanceof NotSignedInError)) throw e;
      throw new Error(
        "code-host.branch-name uses {user}, and gh is not signed in: run gh auth login",
        { cause: e },
      );
    }
  return d.branchName
    .replaceAll("{ticket}", String(ticket))
    .replaceAll("{user}", user);
}

/** The commands that read or write a ticket for a skill. Null when
 * `command` is not one of them. */
async function ticketCommand(
  command: string,
  args: string[],
  d: Ctx,
): Promise<number | null> {
  const t = d.tickets;
  const n = Number(args[0]);
  const numbered = () => {
    if (!Number.isInteger(n) || n <= 0) throw new Error(USAGE);
    return n;
  };
  const json = args.includes("--json");
  switch (command) {
    case "view": {
      const ticket = await t.read(numbered());
      const field = option(args, "--field");
      if (json) d.out(JSON.stringify(ticket, null, 2));
      else if (field === undefined) formatTicket(ticket).forEach(d.out);
      else if (!(FIELDS as readonly string[]).includes(field))
        throw new Error(`--field is one of ${FIELDS.join(", ")}.`);
      else if (field === "labels") ticket.labels.forEach(d.out);
      else d.out(String(ticket[field as "title" | "state" | "body"]));
      return 0;
    }
    case "list": {
      const label = option(args, "--label");
      const title = option(args, "--title");
      const kept = (await t.listOpen())
        .filter((x) => label === undefined || x.labels.includes(label))
        .filter((x) => title === undefined || x.title === title)
        .sort((a, b) => a.number - b.number);
      if (json) d.out(JSON.stringify(kept, null, 2));
      else
        for (const x of kept)
          d.out(`${x.number}\t${x.title}\t${x.labels.join(", ")}`);
      return 0;
    }
    case "edit":
    case "comment": {
      const ticket = numbered();
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
      d.out(
        String(await t.open({ title, body, labels: options(args, "--label") })),
      );
      return 0;
    }
    case "label": {
      const ticket = numbered();
      const add = option(args, "--add");
      const removed = option(args, "--remove");
      const was = option(args, "--was-removed");
      const given = [add, removed, was].filter((x) => x !== undefined);
      if (given.length !== 1) throw new Error(USAGE);
      if (was !== undefined) {
        const history = need(t, "label-history");
        d.out((await history.wasRemoved(ticket, was)) ? "yes" : "no");
      } else if (add !== undefined) {
        // GitHub labels a pull request through its ticket API too.
        refuseOverride(add);
        await t.addLabel(ticket, add);
        d.out("added");
      } else {
        await t.removeLabel(ticket, removed!);
        d.out("removed");
      }
      return 0;
    }
    case "link":
      d.out(t.linkText(numbered()));
      return 0;
    case "branch": {
      const ticket = await t.read(numbered());
      d.out(await branchOf(ticket.number, d));
      return 0;
    }
    case "blockers": {
      const list = await need(t, "blockers").list(numbered());
      for (const b of list) d.out(`#${b.number} ${b.state}`);
      return 0;
    }
    case "block":
    case "unblock": {
      const ticket = numbered();
      const by = Number(option(args, "--by"));
      if (!Number.isInteger(by) || by <= 0) throw new Error(USAGE);
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

const USAGE =
  "Usage: npx --no-install factory ticket claim|still-live|stop|end|refining|waiting|refined|ready|cost|view|list|edit|comment|open|label|link|branch|blockers|block|unblock|supports|follow-up ...";

export async function main(argv: string[], deps: Deps): Promise<number> {
  const [command, first, ...rest] = argv;
  const issue = Number(first);
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
    };
    if (command === "supports") {
      if (!first || !(GROUPS as readonly string[]).includes(first))
        throw new Error(
          `No group ${first ?? ""}: the groups are ${GROUPS.join(", ")}.`,
        );
      d.out(supports(d.tickets, first as Group) ? "yes" : "no");
      return 0;
    }
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
    if (!command || !Number.isInteger(issue) || issue <= 0)
      throw new Error(USAGE);

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
        await post(d, issue, {
          kind: "stopped",
          where: who.where,
          issue,
          reason: rest[0],
          cost: takeCost(issue, d),
        });
        d.out("released");
        return 0;
      }
      case "end":
        d.out(await end(issue, who, d));
        return 0;
      case "ready":
        await moveToReady(issue, d);
        d.out("ready");
        return 0;
      case "refining":
        await post(d, issue, { kind: "refining", who });
        startClock(issue, d);
        break;
      case "waiting":
        await post(d, issue, { kind: "waiting", cost: takeCost(issue, d) });
        break;
      case "cost":
        await post(d, issue, { kind: "cost", cost: takeCost(issue, d) });
        break;
      case "refined": {
        // A body the build could not read gets no marker, whoever wrote it.
        const ticket = await d.tickets.read(issue);
        const missing = missingParts(ticket.body, ticket.labels);
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
        await post(d, issue, {
          kind: "refined",
          issue,
          before,
          cost: takeCost(issue, d),
        });
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

function claimPath(issue: number) {
  return join(commonDir(), `work-claim-${issue}`);
}

/** `factory ticket ...` and `factory follow-up ...`. */
export async function run(argv: string[]): Promise<number> {
  return main(argv, {
    open: (settings, target) => openTickets(settings, target),
    openPulls: (repository, codeHost) =>
      openCodeHost(repository, codeHost).open(),
    signedInAs: (repository, codeHost) =>
      openCodeHost(repository, codeHost).signedInAs(),
    runner: (repository, name) => openRunner(repository, name),
    settings: () => loadSettings(),
    env: process.env,
    sleep,
    out: (line) => console.log(line),
    readFile: (path) => readFileSync(path, "utf8"),
    now: () => new Date(),
    clock: { read: readClock, write: writeClock },
    measure: (session, since) =>
      measureSession(projectsDir(process.env), session, since),
    claimStore: {
      read: (issue) => {
        const path = claimPath(issue);
        return existsSync(path) ? Number(readFileSync(path, "utf8")) : null;
      },
      write: (issue, id) => writeFileSync(claimPath(issue), String(id)),
    },
  });
}
