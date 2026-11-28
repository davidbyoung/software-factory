// The last job of a run that started a session in the cloud: it checks what
// the session left and does it on the code host. It is the only job with a
// sign-in, it holds no AI, and nothing the session made is checked out or
// run here.
//
//   lunamill session publish    # with LUNAMILL_PUBLISH naming the folder
//
//   LUNAMILL_PUBLISH/in/run.json       from Prepare, as the session got it
//   LUNAMILL_PUBLISH/out/build.bundle  the session's commits
//   LUNAMILL_PUBLISH/out/request.json  the commands it asked for
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
  confirmedList,
  homeOf,
  progressOf,
  repositoriesOf,
  type Reach,
} from "./across.mts";
import type { CodeHost } from "./code-host/index.mts";
import { nextToBuild, sameRepository } from "./lib/repositories.mts";
import { list as listFollowUp } from "./follow-ups.mts";
import { checkBundle, type BundleAnswer } from "./handoff/bundle.mts";
import type { RunFile } from "./handoff/index.mts";
import { commitsFault, textFault, type Commit } from "./handoff/links.mts";
import {
  allow,
  readRequests,
  withoutMarkers,
  type Asked,
  type ThisRun,
} from "./handoff/requests.mts";
import { costNote } from "./lib/usage.mts";
import {
  AGENT_MARK,
  commentBody,
  entryFor,
  type Columns,
} from "./lib/work-status.mts";
import { dispatchFailure } from "./poller.mts";
import {
  main as prMain,
  newestRuns,
  PASSED,
  withAgentMark,
  type Deps as PrDeps,
} from "./pr.mts";
import type { Runner } from "./runner/index.mts";
import * as say from "./lib/output.mts";
import type { Tickets } from "./tickets/types.mts";

/** Marks a pull request a build in the cloud opened, whose answers start by
 * themselves. No session can write it: its text loses every hidden marker. */
export const CLOUD_MARK = "<!-- factory: cloud-build -->";

/** Marks one the session left for its owner to mark ready. */
export const OWNER_MARK = "<!-- factory: owner-marks-ready -->";

/** Records the ticket a build's pull request is for, which no session can
 * write either: the pull request's own links are the session's words. */
export const ticketMark = (key: string) => `<!-- factory: ticket ${key} -->`;

/** The ticket a build in the cloud recorded on its pull request. */
export function recordedTicket(body: string): string | null {
  if (!body.includes(CLOUD_MARK)) return null;
  const marks = [...body.matchAll(/<!-- factory: ticket (\S+) -->/g)];
  return marks.at(-1)?.[1] ?? null;
}

/** The answers a pull request gets, whatever asked for them. */
export const ANSWERS = 4;

const CI_MS = 60 * 60 * 1000;
/** How long a commit with no run on it is given for one to start. */
const START_MS = 10 * 60 * 1000;
/** How long a sign-in is used: one lasts an hour. */
const SIGN_IN_MS = 45 * 60 * 1000;
const POLL_MS = 15 * 1000;

export type PublishDeps = {
  run: RunFile;
  /** The folder the session's job handed over. */
  dir: string;
  codeHost: CodeHost;
  runner: Runner;
  tickets: Tickets;
  /** Runs a `lunamill ticket` command, its files read through `readFile`. */
  ticket(argv: string[], readFile: (path: string) => string): Promise<number>;
  pr: PrDeps;
  /** A bare clone of the repository, made now. */
  clone(): string;
  /** Pushes a commit from the clone to a branch, forward only, and throws
   * in the code host's words. */
  push(clone: string, commit: string, branch: string): void;
  /** How the session's job ended. */
  session: string;
  /** Whether the claim this run made is still the ticket's. */
  claimed(): Promise<boolean>;
  /** The commits the bundle adds, from the clone. */
  commits(clone: string, tip: string): Commit[];
  /** The lines a pull request here starts with, for a ticket that names
   * other repositories, or null for any other. */
  linkLines(): Promise<string[] | null>;
  /** The next repository of the ticket's to build, once this one's pull
   * request is open, or null. */
  next(): Promise<string | null>;
  /** Starts a build in another of the ticket's repositories. */
  startBuild(repository: string): Promise<void>;
  /** A new start's own word. */
  marker(): string;
  columns: Columns;
  /** The reviews that ask for changes a pull request is answered after. */
  reviewRounds: number;
  now(): number;
  sleep(ms: number): Promise<unknown>;
  /** Makes the sign-in new again, since waiting can outlast it. */
  signIn(): Promise<void>;
  out(line: string): void;
};

/** A request's files, as Publish names them, so no path of the session's
 * is ever opened. */
function filesOf(asked: Asked): {
  argv: string[];
  readFile: (path: string) => string;
} {
  const names = new Map(
    Object.keys(asked.files).map((path, i) => [path, `asked-${i}.md`]),
  );
  const texts = new Map(
    Object.entries(asked.files).map(([path, text]) => [names.get(path)!, text]),
  );
  return {
    argv: asked.argv.map((word) => names.get(word) ?? word),
    readFile: (path) => {
      const text = texts.get(basename(path));
      if (text === undefined) throw new Error(`${path} was not handed over`);
      return text;
    },
  };
}

const marked = (text: string) =>
  text.includes(AGENT_MARK) ? text : withAgentMark(text);

/** The most of one line that Publish says of its own accord. */
const SAID = 500;

/** A reason as one line with no marker, since some of it may be a session's
 * own words. */
const plain = (text: string) =>
  withoutMarkers(text).replace(/\s+/g, " ").trim().slice(0, SAID);

/** Posts the lines, and after them a marker of Publish's own. */
async function tell(d: PublishDeps, lines: string[], mark = ""): Promise<void> {
  const body = withAgentMark(`${lines.map(plain).join("\n")}${mark}`);
  if (d.run.pull !== null) await d.codeHost.comment(d.run.pull, body);
  else if (d.run.ticket !== null) await d.tickets.comment(d.run.ticket, body);
}

/** What the bundle holds, or why it is not pushed. */
function checked(d: PublishDeps, clone: string): BundleAnswer {
  const answer = checkBundle({
    repo: clone,
    bundle: join(d.dir, "out/build.bundle"),
    base: d.run.base,
    defaultBranch: d.run.defaultBranch,
    workflows: d.runner.workflowsFolder,
    ...(d.run.pull === null ? {} : { published: d.run.base }),
  });
  if ("refused" in answer) return answer;
  const fault = commitsFault(d, d.commits(clone, answer.tip));
  return fault ? { refused: fault } : answer;
}

const isOpen = ({ argv }: Asked) => argv[0] === "pr" && argv[1] === "open";
const isStop = ({ argv }: Asked) =>
  argv[0] === "ticket" && (argv[1] === "stop" || argv[1] === "end");

/** Why nothing of the session's is pushed, found before anything is, since a
 * branch pushed with nothing to show for it is work nobody sees. */
async function faultBefore(
  d: PublishDeps,
  asked: Asked[],
  mine: ThisRun,
): Promise<string | null> {
  const { run } = d;
  if (run.pull !== null) {
    const now = await d.codeHost.get(run.pull);
    if (now.state !== "open") return `#${run.pull} is not open any more`;
    if (now.head.sha !== run.base)
      return `#${run.pull} has a newer commit than the one the session worked from`;
    return null;
  }
  const opens = asked.filter(isOpen);
  if (opens.length === 0) return "the session asked for no pull request";
  for (const one of opens) {
    const may = allow(one, mine);
    if ("refused" in may) return may.refused;
    // As it would be posted: what is taken out or cut off can make a link.
    const fault = textFault(
      d,
      [...may.argv, ...Object.values(may.files)].join("\n\n"),
    );
    if (fault) return `the pull request ${fault}`;
  }
  return null;
}

/** Says that nothing was pushed, and why. A conflict's run also marks the
 * commit, so the sweep does not start another on it. */
async function refuse(d: PublishDeps, why: string): Promise<void> {
  const lines = [
    `Not pushed: ${why}${why.includes(" changes ") ? ", which a build in the cloud can't push" : ""}.`,
    `Build this ticket on your computer: tell a session to work it.${inRun(d, "The commits are in the run")}`,
  ];
  lines.map(plain).forEach((line) => d.out(line));
  const mark =
    d.run.kind === "conflict"
      ? `\n\n<!-- conflict-stop head=${d.run.base} -->`
      : "";
  await tell(d, lines, mark);
}

/** Where to read more, when the run has a page. */
function inRun(d: PublishDeps, what: string): string {
  const page = d.runner.thisRun(d.pr.env ?? {})?.page;
  return page ? ` ${what}: ${page}` : "";
}

/** What the session's job says of how it ended, or null when none of what it
 * left arrived. */
function endedFile(d: PublishDeps): { dropped: string[] } | null {
  const file = join(d.dir, "out/ended.json");
  return existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as { dropped: string[] })
    : null;
}

/** The open tickets a run of this kind opened for the same pull request, by
 * the titles their skills give them. */
async function openedBefore(d: PublishDeps): Promise<string[]> {
  const { kind, pull } = d.run;
  const title =
    kind === "conflict"
      ? `#${pull}: merge conflict with the default branch needs a decision`
      : kind === "dependency"
        ? `Dependabot #${pull}: `
        : null;
  if (title === null) return [];
  return (await d.tickets.listUnfinished())
    .filter((t) => t.title.startsWith(title))
    .map((t) => t.key);
}

/** The body with the line that links the run's ticket, for one that names
 * other repositories, whether or not the session wrote it. */
async function withLinks(body: string, d: PublishDeps): Promise<string> {
  const lines = await d.linkLines();
  const { ticket } = d.run;
  if (!lines || ticket === null) return body;
  if (d.tickets.linksIn(body).partOf.includes(ticket)) return body;
  return `${lines.join("\n")}\n\n${body}`;
}

/** The next of the ticket's repositories to build, once this one's pull
 * request is open, or null: none where the list is not confirmed. */
export async function nextRepository(
  key: string,
  d: { tickets: Tickets; repository: string; reach: Reach },
): Promise<string | null> {
  const ticket = await d.tickets.read(key);
  const home = homeOf(d.tickets, key, d.repository);
  const list = repositoriesOf(ticket, d.tickets, home);
  if (!list || !(await confirmedList(ticket, list, d.reach)).counts)
    return null;
  const all = await progressOf(ticket, list, d.tickets, d.reach);
  // Its own was opened a moment ago, which a list can still lack.
  const others = all.filter((r) => !sameRepository(r.name, d.repository));
  return nextToBuild(others)?.name ?? null;
}

/** Starts the build in the ticket's next repository, which ends this run's
 * claim on it, or says why it did not start. */
async function buildNext(d: PublishDeps, pull: number): Promise<void> {
  const { ticket, ref, repository } = d.run;
  if (ticket === null || ref === null || !d.run.others) return;
  const next = await d.next();
  if (next === null) return;
  await d.tickets.record.add(
    ticket,
    entryFor(
      {
        kind: "built-next",
        built: { repository, pull },
        next,
        marker: d.marker(),
      },
      d.columns,
    ),
  );
  try {
    await d.startBuild(next);
    d.out(`Started the build in ${next}.`);
  } catch (error) {
    const why = dispatchFailure(error);
    d.out(`The build in ${next} did not start: ${why.status} (${why.reason})`);
    await d.tickets.record.add(
      ticket,
      entryFor(
        { kind: "dispatch-failed", issue: { key: ticket, ref }, ...why },
        d.columns,
      ),
    );
  }
}

/** Opens the run's pull request from what the session asked for. */
async function open(d: PublishDeps, asked: Asked): Promise<number> {
  const at = (flag: string) => asked.argv[asked.argv.indexOf(flag) + 1];
  const body = await withLinks(asked.files[at("--body-file")]!, d);
  return d.codeHost.create({
    title: withoutMarkers(at("--title")),
    body: [
      body.trimEnd(),
      "",
      CLOUD_MARK,
      ...(d.run.ticket === null ? [] : [ticketMark(d.run.ticket)]),
      ...(asked.argv.includes("--draft") ? [OWNER_MARK] : []),
      "",
    ].join("\n"),
    head: d.run.branch,
    base: d.run.defaultBranch,
    draft: true,
  });
}

/** Why a pull request gets no further answer, or null when it does. */
async function spent(
  d: PublishDeps,
  pull: number,
  createdAt: string,
): Promise<string | null> {
  const asked = (await d.codeHost.comments(pull)).filter(
    (c) =>
      c.author === d.runner.poster &&
      c.body.includes("<!-- review-verdict: changes -->"),
  ).length;
  if (asked > d.reviewRounds)
    return `${d.reviewRounds} reviews were answered, and the next still asks for changes`;
  return (await d.runner.answersTo(pull, createdAt)) >= ANSWERS
    ? `it has had ${ANSWERS} answers`
    : null;
}

/** Starts the next answer to a pull request a build in the cloud opened, or
 * says on it that it waits for a person. */
export async function nextAnswer(d: PublishDeps, pull: number): Promise<void> {
  const { body, createdAt } = await d.codeHost.get(pull);
  if (!body.includes(CLOUD_MARK)) {
    d.out("No build in the cloud opened it, so a person has it answered.");
    return;
  }
  const why = await spent(d, pull, createdAt ?? "");
  if (why !== null) {
    d.out(`No answer starts: ${why}.`);
    await d.codeHost.comment(
      pull,
      withAgentMark(
        `This waits for a person: ${why}. What is still open is in its checks and threads.`,
      ),
    );
    return;
  }
  await d.runner.startAnswer(pull, d.run.defaultBranch);
  d.out(`Started an answer to #${pull}.`);
}

/** The commits, pushed, or null when there are none or they are refused. */
async function pushed(
  d: PublishDeps,
  asked: Asked[],
  mine: ThisRun,
): Promise<{ tip: string | null; refused: boolean }> {
  const none = { tip: null, refused: false };
  if (!existsSync(join(d.dir, "out/build.bundle"))) {
    if (!endedFile(d)?.dropped.includes("build.bundle")) return none;
    await refuse(d, "its commits are not a file of at most 20 MB");
    return { tip: null, refused: true };
  }
  // A session that stopped says so itself, and its run keeps its commits.
  if (d.run.pull === null && !asked.some(isOpen) && asked.some(isStop))
    return none;
  let why = await faultBefore(d, asked, mine);
  if (why === null) {
    const clone = d.clone();
    const answer = checked(d, clone);
    if ("refused" in answer) why = answer.refused;
    else
      try {
        d.push(clone, answer.tip, d.run.branch);
        d.out(`Pushed ${answer.commits} commits to ${d.run.branch}.`);
        return { tip: answer.tip, refused: false };
      } catch (error) {
        why = `the code host refused it: ${(error as Error).message}`;
      }
  }
  await refuse(d, why);
  return { tip: null, refused: true };
}

export async function publish(d: PublishDeps): Promise<number> {
  const { run } = d;
  const requests = join(d.dir, "out/request.json");
  let asked: Asked[];
  try {
    asked = existsSync(requests)
      ? readRequests(readFileSync(requests, "utf8"))
      : [];
  } catch (error) {
    d.out(`Refused every request: ${(error as Error).message}`);
    asked = [];
  }
  if (run.kind === "build" && !(await d.claimed())) {
    d.out("The claim ended before this run did, so nothing is published.");
    return 1;
  }
  if (d.session === "success" && endedFile(d) === null) {
    const why = `What the session left did not arrive, so nothing was done with it.${inRun(d, "Its run")}`;
    d.out(why);
    await tell(d, [why]);
    return 1;
  }

  let pull = run.pull;
  const threads = pull === null ? [] : await d.codeHost.threads(pull);
  const mine: ThisRun = {
    kind: run.kind,
    ticket: run.ticket,
    pull,
    comments: threads.map((t) => t.commentId),
    branch: run.branch,
    base: run.base,
    opened: await openedBefore(d),
  };
  const { tip, refused } = await pushed(d, asked, mine);
  // What it says of commits that were not pushed is not true, so only what
  // stands without them is done.
  if (refused) asked = asked.filter(isStop);
  let failed = refused;
  for (const one of asked) {
    const may = allow(one, { ...mine, pull });
    if ("refused" in may) {
      d.out(`Refused: ${may.refused}`);
      continue;
    }
    try {
      if (isOpen(may)) {
        if (tip === null) throw new Error("there is no commit to open it for");
        pull = await open(d, may);
        d.out(`Opened #${pull}.`);
        continue;
      }
      const { argv, readFile } = filesOf(may);
      if (argv[0] === "follow-up") {
        if (pull === null) {
          d.out(`Refused: lunamill follow-up ${argv[1]}: no pull request`);
          continue;
        }
        const listed = await listFollowUp(
          pull,
          { title: argv[1]!, text: argv[2]! },
          {
            codeHost: d.codeHost,
            tickets: d.tickets,
            out: (line) => d.out(`  ${say.render(line, false)}`),
          },
        );
        if (listed !== 0) failed = true;
        continue;
      }
      const says = /^(?:(?:pr|ticket) comment|ticket open)$/.test(
        argv.slice(0, 2).join(" "),
      );
      const read = (path: string) =>
        says ? marked(readFile(path)) : readFile(path);
      const code =
        argv[0] === "pr"
          ? await prMain(argv.slice(1), {
              ...d.pr,
              readFile: read,
              out: (line) => d.out(`  ${line}`),
            })
          : await d.ticket(argv.slice(1), read);
      if (code !== 0) throw new Error(`exit ${code}`);
    } catch (error) {
      failed = true;
      d.out(
        `Failed: lunamill ${one.argv.slice(0, 3).join(" ")}: ${(error as Error).message}`,
      );
    }
  }
  if (run.kind === "build" && pull !== null) await buildNext(d, pull);
  await postCost(d, pull);
  if (d.session !== "success" && tip === null && !refused) {
    d.out("The session did not finish.");
    await tell(d, [
      `The session did not finish, and nothing of its was pushed.${inRun(d, "Its run")}`,
    ]);
  }
  const said = asked.some(
    (a) => isStop(a) || (a.argv[0] === "ticket" && a.argv[1] === "comment"),
  );
  if (run.kind === "build" && d.session === "success" && tip === null)
    if (!refused && !said)
      await tell(d, [
        `The session ended with nothing to push, and did not say why.${inRun(d, "Its run")}`,
      ]);
  if (pull !== null && tip !== null) await settle(d, pull, tip);
  return failed ? 1 : 0;
}

/** Notes what the session cost, for the board, as its job counted it. */
export async function postCost(
  d: Pick<PublishDeps, "dir" | "run" | "codeHost" | "tickets" | "out">,
  pull: number | null,
): Promise<void> {
  const file = join(d.dir, "out/cost.json");
  if (!existsSync(file)) return;
  const { dollars, session } = JSON.parse(readFileSync(file, "utf8")) as {
    dollars: unknown;
    session: unknown;
  };
  if (typeof dollars !== "number" || !/^[\w-]{1,64}$/.test(String(session)))
    return;
  const on = pull !== null ? `#${pull}` : d.run.ref;
  if (on === null) return;
  const cost = costNote(
    { ok: true, spend: { dollars, priced: 1, unpriced: new Map() } },
    on,
    String(session),
  );
  const body = commentBody({ kind: "cost", cost });
  if (pull !== null) await d.codeHost.comment(pull, body);
  else if (d.run.ticket !== null) await d.tickets.comment(d.run.ticket, body);
}

type Ci = "passed" | "failed" | "not finished" | "not started";

/** How CI ended on the commit, waited for up to `CI_MS`. lunamill's own
 * check runs on every pull request, so no run at all means something kept
 * them from starting, and not that there is no CI. */
async function ciOn(d: PublishDeps, tip: string): Promise<Ci> {
  const start = d.now();
  let signedIn = start;
  for (;;) {
    const waited = d.now() - start;
    try {
      if (d.now() - signedIn >= SIGN_IN_MS) {
        await d.signIn();
        signedIn = d.now();
      }
      const runs = newestRuns(await d.runner.runs(tip));
      if (runs.length === 0 && waited >= START_MS) return "not started";
      if (runs.length > 0 && runs.every((r) => r.status === "completed"))
        return runs.every((r) => PASSED.includes(r.conclusion ?? ""))
          ? "passed"
          : "failed";
    } catch (error) {
      d.out(`Could not read CI: ${(error as Error).message}`);
    }
    if (waited >= CI_MS) return "not finished";
    await d.sleep(POLL_MS);
  }
}

const WAITS: Partial<Record<Ci, string>> = {
  "not finished":
    "CI has not finished after an hour, so this stays as it is until a person looks.",
  "not started":
    "No check has started on this commit, so it stays as it is until a person looks.",
};

/** Signs in again, trying a few times, or fails naming what is left as it
 * is. */
async function signedIn(d: PublishDeps, pull: number): Promise<void> {
  for (let left = 3; ; left--)
    try {
      return await d.signIn();
    } catch (error) {
      if (left === 0)
        throw new Error(
          `#${pull} is left as it is: ${(error as Error).message}`,
          {
            cause: error,
          },
        );
      await d.sleep(POLL_MS);
    }
}

/** Says so on a build's pull request when the code host would close another
 * ticket with it, whatever was read in its words. */
async function closesOther(d: PublishDeps, pull: number): Promise<boolean> {
  const { body } = await d.codeHost.get(pull);
  if (!body.includes(CLOUD_MARK)) return false;
  const own = recordedTicket(body) ?? d.run.ticket;
  const closes = await d.codeHost.closes(pull);
  const other = closes.find((key) => key !== own || d.run.others);
  if (other === undefined) return false;
  const why =
    other === own
      ? "before its other repositories have"
      : "which is not its ticket";
  await d.codeHost.comment(
    pull,
    withAgentMark(
      `This would close ${d.tickets.ref(other)} when it merges, ${why}, so nothing more is done with it until a person looks.`,
    ),
  );
  return true;
}

/** Waits for CI on the commit, then marks the pull request ready or starts
 * the next answer. */
async function settle(
  d: PublishDeps,
  pull: number,
  tip: string,
): Promise<void> {
  // Asked now, and again before it is marked ready, since the code host may
  // take a moment to work it out.
  if (await closesOther(d, pull)) return;
  const ci = await ciOn(d, tip);
  await signedIn(d, pull);
  d.out(`CI ${ci}.`);
  if (ci === "failed") return nextAnswer(d, pull);
  const waits = WAITS[ci];
  if (waits) {
    await d.codeHost.comment(pull, withAgentMark(waits));
    return;
  }
  const now = await d.codeHost.get(pull);
  if (!now.isDraft) return;
  if (!now.body.includes(CLOUD_MARK) || now.body.includes(OWNER_MARK)) {
    d.out("It stays a draft for a person to mark ready.");
    return;
  }
  // A person may have pushed while this waited, and that commit's CI is not
  // the one that passed.
  if (now.head.sha !== tip) {
    d.out("The pull request has a newer commit, so it is not marked ready.");
    return;
  }
  if (await closesOther(d, pull)) return;
  await d.codeHost.ready(pull);
  d.out(`Marked #${pull} ready.`);
}
