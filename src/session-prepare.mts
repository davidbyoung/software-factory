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
import { missingParts } from "./lib/refined-check.mts";
import { ticketsOf } from "./lib/pull-tickets.mts";
import { AGENT_MARK } from "./lib/work-status.mts";
import type { Runner } from "./runner/index.mts";
import type { Tickets } from "./tickets/types.mts";

/** The marker a review's summary carries. */
const REVIEW_MARK = /<!--\s*claude-review\b/;

type Adapters = { tickets: Tickets; codeHost: CodeHost; runner: Runner };

export type PrepareDeps = Adapters & {
  repository: string;
  /** Where `in/` goes. */
  dir: string;
  labels: Readonly<Record<"spec" | "follow-up", string>>;
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
  git(args: string[]): string;
  /** The claim this checkout made on the ticket. */
  claimOf(ticket: string): string | null;
  committer: RunFile["committer"];
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
    ticket("list", "--label", "follow-up"),
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
  const branch = (await d.ticket(["branch", key], on)).lines[0];
  const claim = (await d.ticket(["claim", key], on)).lines;
  if (!claim.includes("claimed")) throw new Nothing(claim.join("\n"));
  const stop = async (why: string): Promise<never> => {
    await d.ticket(["stop", key, why], on);
    throw new Nothing(why);
  };
  const ticket = await d.tickets.read(key);
  const labels = d.labels;
  if (
    !ticket.labels.includes(labels["follow-up"]) &&
    !heading.test(ticket.body)
  )
    await stop(
      "it has no Spec or Acceptance criteria section, so there is nothing to build yet: refine it first",
    );
  const missing = missingParts(ticket.body, ticket.labels, labels);
  if (missing.length > 0)
    await stop(`it is not one a build can read: ${missing.join("; ")}`);
  await freeBranch(branch, d, stop);
  return {
    version: 1,
    kind: "build",
    repository: d.repository,
    defaultBranch: await d.codeHost.defaultBranch(),
    base,
    branch,
    ticket: key,
    ref: d.tickets.ref(key),
    pull: null,
    round: 0,
    claim: d.claimOf(key),
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
  const key = closes[0] ?? partOf[0] ?? null;
  return {
    version: 1,
    kind,
    repository: d.repository,
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

/** The run handed over, or null with the reason printed. */
export async function prepare(
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
  for (const key of await named(run, d))
    await d.ticket(["view", key], on).catch(() => {});

  writeFileSync(join(dir, "run.json"), JSON.stringify(run, null, 2));
  writeFileSync(join(dir, "snapshot.json"), JSON.stringify(calls));
  return run;
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
