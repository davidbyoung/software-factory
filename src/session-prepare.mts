// The first job of a run that starts a session in the cloud: it decides
// whether there is something to do, claims the ticket of a build, and hands
// over what the session works from, which has no sign-in of its own.
//
//   factory session prepare build TICKET
//   factory session prepare review|answer|conflict|dependency PULL
//
// It writes FACTORY_PREPARE/in, which `handoff/index.mts` describes, with
// two bundles: `home.bundle`, the default branch the session starts in, and
// `work.bundle`, the same and the branch it works on. Nothing on that branch
// is checked out or run.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CodeHost, Pull } from "./code-host/index.mts";
import type { RunFile } from "./handoff/index.mts";
import { recording, type Call } from "./handoff/replay.mts";
import type { Kind } from "./handoff/requests.mts";
import { ticketsOf } from "./lib/pull-tickets.mts";
import {
  confirmedList,
  homeOf,
  progressOf,
  repositoriesOf,
  type Reach,
} from "./across.mts";
import {
  lastPart,
  nextToBuild,
  sameRepository,
  type Listed,
  type Progress,
} from "./lib/repositories.mts";
import { AGENT_MARK, entryFor, type Columns } from "./lib/work-status.mts";
import { notBuildable } from "./ticket-repositories.mts";
import type { Runner } from "./runner/index.mts";
import { recordedTicket } from "./session-publish.mts";
import type { Tickets } from "./tickets/types.mts";

/** The marker a review's summary carries. */
const REVIEW_MARK = /<!--\s*claude-review\b/;

type Adapters = {
  tickets: Tickets;
  codeHost: CodeHost;
  runner: Runner;
  /** The code host of any of the ticket's repositories. */
  reach: Reach;
};

export type PrepareDeps = Adapters & {
  repository: string;
  /** Where `in/` goes. */
  dir: string;
  /** Whether the code host's own links say which tickets a pull closes. */
  ownLinks: boolean;
  /** The account the review's summaries are posted from. */
  poster: string;
  /** Runs a `factory ticket` or `factory pr` command through the adapters
   * given, and gives what it printed. */
  ticket(
    argv: string[],
    on: Adapters,
  ): Promise<{ code: number; lines: string[] }>;
  pr(argv: string[], on: Adapters): Promise<{ code: number; lines: string[] }>;
  /** Runs `factory deps` through the adapters given. */
  deps(on: Adapters): Promise<unknown>;
  /** What is wrong with the presets a commit's lock names, beside the
   * default branch's: a lock that was written by hand, or by a session. */
  pinFaults(commit: string): string[];
  git(args: string[]): string;
  /** Starts a build of the ticket in another of its repositories, where it
   * is typed as `key`. */
  startBuild(repository: string, key: string): Promise<void>;
  /** Puts another repository's files, as a branch or the default branch has
   * them, in an archive at `path`, or answers false when it is too large. */
  archive(
    repository: string,
    branch: string | null,
    path: string,
  ): Promise<boolean>;
  /** Whose words say why a repository can't be seen. */
  underApp: boolean;
  /** The claim this checkout made on the ticket. */
  claimOf(ticket: string): string | null;
  committer: RunFile["committer"];
  columns: Columns;
  out(line: string): void;
};

/** Why a run has nothing to hand over, which ends it without a session. */
class Nothing extends Error {}

const heading = /^## (?:Spec|Acceptance criteria)\s*$/m;

/** The commands a skill reads with, for a run on a ticket and a pull
 * request: whatever they read is what the session can read. */
function readsOf(run: RunFile, o: { comments: number[]; reviews: number[] }) {
  const pr = (...argv: (string | number)[]) => ({
    of: "pr" as const,
    argv: argv.map(String),
  });
  const ticket = (...argv: string[]) => ({ of: "ticket" as const, argv });
  const of: { of: "pr" | "ticket"; argv: string[] }[] = [
    pr("conflicts"),
    pr("for-branch", run.branch),
    ticket("list"),
  ];
  const { pull, ticket: key } = run;
  if (pull !== null)
    of.push(
      pr("state", pull),
      pr("threads", pull, "--all"),
      pr("failed", pull),
      pr("closes", pull),
      pr("comments", pull),
      pr("comments", pull, "--from-approvers"),
      pr("unverified", pull),
      pr("view", pull, "--field", "head"),
      ...o.comments.map((id) => pr("comment-view", id)),
      ...o.reviews.map((id) => pr("review", pull, id)),
      ...o.reviews.map((id) => pr("review-pending", pull, id)),
    );
  if (key !== null)
    of.push(
      ticket("view", key),
      ticket("repositories", key),
      ticket("answers", key),
      ticket("blockers", key),
      ticket("branch", key),
      ticket("link", key),
      ticket("refined", key, "--check"),
      ticket("label", key, "--was-removed", "spec"),
    );
  return of;
}

/** The comments the session may read: one in the review's own format counts
 * only from the account the review's run posts from, so nobody else can
 * tell the reviewer what it has already read. */
function trusted(host: CodeHost, poster: string): CodeHost {
  const read = <T extends { author: string; body: string }>(c: T): T =>
    REVIEW_MARK.test(c.body) && c.author !== poster
      ? { ...c, body: c.body.replaceAll("<!--", "&lt;!--") }
      : c;
  return {
    ...host,
    comments: async (pull) => (await host.comments(pull)).map(read),
    commentView: async (id) => read(await host.commentView(id)),
  };
}

async function build(
  key: string,
  base: string,
  d: PrepareDeps,
): Promise<RunFile> {
  const on: Adapters = d;
  const spans = await others(key, d);
  if (spans) await ours(key, spans, d);
  const branch = (await d.ticket(["branch", key], on)).lines[0];
  const claim = (await d.ticket(["claim", key], on)).lines;
  if (!claim.includes("claimed")) throw new Nothing(claim.join("\n"));
  const stop = async (why: string): Promise<never> => {
    await d.ticket(["stop", key, why], on);
    throw new Nothing(why);
  };
  const ticket = await d.tickets.read(key);
  if (!heading.test(ticket.body))
    await stop(
      "it has no Spec or Acceptance criteria section, so there is nothing to build yet: refine it first",
    );
  await freeBranch(branch, d, stop);
  return {
    version: 1,
    kind: "build",
    repository: d.repository,
    remote: d.codeHost.remote(d.repository).url,
    defaultBranch: await d.codeHost.defaultBranch(),
    base,
    branch,
    ticket: key,
    ref: d.tickets.ref(key),
    pull: null,
    round: 0,
    claim: d.claimOf(key),
    ...(spans ? { others: spans.others } : {}),
    committer: d.committer,
  };
}

/** Frees the branch a build pushes, or stops where an earlier build's work
 * is still on it. */
async function freeBranch(
  branch: string,
  d: PrepareDeps,
  stop: (why: string) => Promise<never>,
): Promise<void> {
  const [head] = d
    .git(["ls-remote", "origin", `refs/heads/${branch}`])
    .split(/\s/);
  if (!head) return;
  const last = await d.codeHost.lastForBranch(branch);
  if (last?.state === "open")
    await stop(
      `Branch ${branch} is already on origin, with open pull request #${last.number}`,
    );
  if (
    last?.state === "merged" &&
    (await d.codeHost.get(last.number)).head.sha === head
  ) {
    d.git(["push", "-q", "origin", "--delete", branch]);
    d.out(
      `Branch ${branch}'s pull request #${last.number} merged; replacing it.`,
    );
    return;
  }
  await stop(
    `Branch ${branch} is already on origin, with work no pull request merged. Open a pull request from it to keep that work, or delete it with: git push origin --delete ${branch}`,
  );
}

type Spans = {
  list: Listed[];
  progress: Progress[];
  others: NonNullable<RunFile["others"]>;
};

/** A repository's privacy, or null when it can't be seen. */
const isPrivate = async (name: string, d: PrepareDeps) =>
  (await (await d.reach(name)).visible())?.isPrivate ?? null;

/** Whether this run may read the ticket: one of a public repository reads
 * nothing of a private one's, since what its session reads could end up in
 * a public pull request. */
async function mayRead(key: string, d: PrepareDeps): Promise<boolean> {
  const home = homeOf(d.tickets, key, d.repository);
  if (sameRepository(home, d.repository)) return true;
  if ((await isPrivate(d.repository, d)) !== false) return true;
  return (await isPrivate(home, d)) === false;
}

/** The ticket's other repositories, for one that names any and whose list
 * was confirmed. Their folders are filled in once they are copied. */
async function others(key: string, d: PrepareDeps): Promise<Spans | null> {
  const ticket = await d.tickets.read(key);
  const home = homeOf(d.tickets, key, d.repository);
  const list = repositoriesOf(ticket, d.tickets, home);
  if (!list) return null;
  if (!(await confirmedList(ticket, list, d.reach)).counts)
    return { list, progress: [], others: [] };
  const progress = await progressOf(ticket, list, d.tickets, d.reach);
  return {
    list,
    progress,
    others: progress
      .filter((r) => !sameRepository(r.name, d.repository))
      .map((r) => ({
        repository: r.name,
        pull: r.pulls.find((p) => p.state === "open")?.number ?? null,
        folder: null,
      })),
  };
}

/** Goes on only when this repository is the one to build: it starts the
 * build of any other that is, and stops a ticket that can't be built. */
async function ours(key: string, spans: Spans, d: PrepareDeps): Promise<void> {
  const ticket = await d.tickets.read(key);
  const ref = d.tickets.ref(key);
  const home = homeOf(d.tickets, key, d.repository);
  let fault: string | null = null;
  try {
    const seen: [string, boolean][] = [];
    for (const name of new Set([...spans.list.map((r) => r.name), home])) {
      const found = await isPrivate(name, d);
      if (found === null)
        fault ??= d.underApp
          ? `${ref} names ${name}, which was not found`
          : `The build token can't see ${name}`;
      else seen.push([name, found]);
    }
    const hidden = seen.find(([, hides]) => hides);
    const open = seen.find(([, hides]) => !hides);
    if (hidden && open)
      fault ??= `${open[0]} is public and ${hidden[0]} is private, so no build in the cloud reads both: build it on your computer`;
    fault ??= await notBuildable(ticket, d);
  } catch (error) {
    fault = error instanceof Error ? error.message : String(error);
  }
  if (fault !== null) {
    await d.tickets.record.add(
      key,
      entryFor(
        {
          kind: "stopped",
          where: "actions",
          issue: { key, ref },
          reason: fault,
        },
        d.columns,
      ),
    );
    throw new Nothing(fault);
  }
  const next = nextToBuild(spans.progress);
  if (!next)
    throw new Nothing(`Every repository of ${ref} has a pull request.`);
  if (sameRepository(next.name, d.repository)) return;
  await d.startBuild(next.name, d.tickets.keyIn(key, next.name));
  throw new Nothing(`Started the build in ${next.name}.`);
}

/** Copies each other repository the session may read, as its pull request
 * has it, or its default branch. */
async function copies(run: RunFile, dir: string, d: PrepareDeps) {
  if (!run.others?.length || run.ticket === null) return;
  const spans = await others(run.ticket, d);
  const open = (await isPrivate(d.repository, d)) === false;
  const kept: NonNullable<RunFile["others"]> = [];
  for (const other of run.others) {
    // Nothing of a private repository reaches a public one's session.
    if (open && (await isPrivate(other.repository, d)) !== false) continue;
    const folder = lastPart(other.repository);
    const pull = spans?.progress
      .find((r) => r.name === other.repository)
      ?.pulls.find((p) => p.state === "open");
    mkdirSync(join(dir, "others"), { recursive: true });
    const whole = await d.archive(
      other.repository,
      pull?.branch ?? null,
      join(dir, "others", `${folder}.tar`),
    );
    if (!whole)
      d.out(
        `${other.repository} is too large to hand over, so it is not read.`,
      );
    kept.push({ ...other, folder: whole ? folder : null });
  }
  run.others = kept;
}

async function ofPull(
  kind: Kind,
  pull: Pull,
  d: PrepareDeps,
): Promise<RunFile> {
  const main = await d.codeHost.defaultBranch();
  if (pull.state !== "open") throw new Nothing(`#${pull.number} is not open.`);
  if (pull.base.branch !== main)
    throw new Nothing(
      `#${pull.number} goes into ${pull.base.branch}, not ${main}, so no session works on it.`,
    );
  if (pull.head.repository !== d.repository)
    throw new Nothing(
      `#${pull.number} comes from another repository, so no session works on it.`,
    );
  const { closes, partOf } = ticketsOf(
    { body: pull.body, closes: await d.codeHost.closes(pull.number) },
    d.tickets,
    d.ownLinks,
  );
  const found = recordedTicket(pull.body) ?? closes[0] ?? partOf[0] ?? null;
  const key = found !== null && (await mayRead(found, d)) ? found : null;
  const spans =
    key !== null && (kind === "review" || kind === "answer")
      ? await others(key, d)
      : null;
  return {
    version: 1,
    kind,
    repository: d.repository,
    remote: d.codeHost.remote(d.repository).url,
    defaultBranch: main,
    base: pull.head.sha,
    branch: pull.head.branch,
    ticket: key,
    ref: key === null ? null : d.tickets.ref(key),
    pull: pull.number,
    round:
      kind === "answer"
        ? await d.runner.answersTo(pull.number, pull.createdAt ?? "")
        : 0,
    claim: null,
    ...(spans ? { others: spans.others } : {}),
    committer: d.committer,
  };
}

/** Bundles the default branch, and the same with the branch the session
 * works on, read from the remote as git data. */
function bundles(run: RunFile, dir: string, git: PrepareDeps["git"]): void {
  const main = `refs/remotes/origin/${run.defaultBranch}`;
  git(["fetch", "-q", "origin", run.defaultBranch]);
  const home = "refs/handoff/home";
  const work = "refs/handoff/work";
  git(["update-ref", home, main]);
  if (run.pull === null) git(["update-ref", work, run.base]);
  else {
    git(["fetch", "-q", "origin", run.branch]);
    const now = git(["rev-parse", "FETCH_HEAD"]).trim();
    if (now !== run.base)
      throw new Nothing(`#${run.pull} moved on while this run was starting.`);
    git(["update-ref", work, now]);
  }
  git(["bundle", "create", "-q", join(dir, "home.bundle"), home]);
  git(["bundle", "create", "-q", join(dir, "work.bundle"), home, work]);
}

/** The run handed over, or null with the reason printed. A build that fails
 * here releases its ticket. */
export async function prepare(
  kind: Kind,
  id: string,
  d: PrepareDeps,
): Promise<RunFile | null> {
  try {
    return await handOver(kind, id, d);
  } catch (error) {
    if (kind === "build")
      await d.ticket(["end", d.tickets.key(id)], d).catch(() => {});
    throw error;
  }
}

async function handOver(
  kind: Kind,
  id: string,
  d: PrepareDeps,
): Promise<RunFile | null> {
  const dir = join(d.dir, "in");
  mkdirSync(dir, { recursive: true });
  let run: RunFile;
  try {
    const main = await d.codeHost.defaultBranch();
    d.git(["fetch", "-q", "origin", main]);
    const base = d.git(["rev-parse", `refs/remotes/origin/${main}`]).trim();
    run =
      kind === "build"
        ? await build(d.tickets.key(id), base, d)
        : await ofPull(kind, await d.codeHost.get(Number(id)), d);
    bundles(run, dir, d.git);
    await copies(run, dir, d);
    if (kind === "review") {
      const faults = d.pinFaults(run.base);
      if (faults.length > 0)
        throw new Error(
          `#${run.pull} is not reviewed until this is fixed: ${faults.join("; ")}`,
        );
    }
  } catch (error) {
    if (!(error instanceof Nothing)) throw error;
    d.out(error.message);
    return null;
  }

  const calls: Call[] = [];
  const on: Adapters = {
    tickets: recording("tickets", d.tickets, calls),
    codeHost: recording("codeHost", trusted(d.codeHost, d.poster), calls),
    runner: recording("runner", d.runner, calls),
    reach: async (name) => {
      const host = await d.reach(name);
      return sameRepository(name, d.repository)
        ? recording("codeHost", host, calls)
        : recording("codeHost", host, calls, `${name}:`);
    },
  };
  const comments = run.pull === null ? [] : await d.codeHost.comments(run.pull);
  const reviews = run.pull === null ? [] : await d.codeHost.reviews(run.pull);
  // A read that fails here fails the same way in the session, by its record
  // or for want of one.
  for (const read of readsOf(run, {
    comments: comments.map((c) => c.id),
    reviews: reviews.map((r) => r.id),
  }))
    await d[read.of](read.argv, on).catch(() => {});
  await on.codeHost.defaultBranch();
  if (kind === "dependency") await d.deps(on).catch(() => {});
  const others = kind === "conflict" ? merged(run, d) : [];
  for (const pull of others) {
    await on.codeHost.get(pull).catch(() => {});
    const closes = await on.codeHost.closes(pull).catch(() => []);
    for (const key of closes) await d.ticket(["view", key], on).catch(() => {});
  }
  for (const key of await named(run, d))
    await d.ticket(["view", key], on).catch(() => {});

  writeFileSync(join(dir, "run.json"), JSON.stringify(run, null, 2));
  writeFileSync(join(dir, "snapshot.json"), JSON.stringify(calls));
  return run;
}

/** The pull requests on the default branch since the run's branch left it,
 * newest first, at most 30: what a conflict may be with. */
function merged(run: RunFile, d: PrepareDeps): number[] {
  const main = `refs/remotes/origin/${run.defaultBranch}`;
  const subjects = d.git(["log", "--format=%s", `${run.base}..${main}`]);
  return [...subjects.matchAll(/\(#(\d+)\)$/gm)]
    .map((m) => Number(m[1]))
    .slice(0, 30);
}

/** The tickets the run's own ticket names, at most 20. */
async function named(run: RunFile, d: PrepareDeps): Promise<string[]> {
  if (run.ticket === null) return [];
  const { body, comments } = await d.tickets.read(run.ticket);
  const own = comments
    .filter((c) => !c.body.includes(AGENT_MARK))
    .map((c) => c.body);
  const open = await d.tickets.listUnfinished();
  const text = [body, ...own].join("\n");
  return open
    .map((t) => t.key)
    .filter((k) => k !== run.ticket && mentions(text, d.tickets.ref(k)))
    .slice(0, 20);
}

function mentions(text: string, ref: string): boolean {
  const at = text.indexOf(ref);
  return at >= 0 && !/[\w-]/.test(text[at + ref.length] ?? " ");
}
