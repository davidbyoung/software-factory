#!/usr/bin/env node
// A pull request's fixed steps, through GitHub's GraphQL and REST APIs.
//
//   factory pr state [N] [--wait]   # what factory-address-review steps 0 to 1b read
//   factory pr threads N [--all]    # unresolved review threads, or every one
//   factory pr reply N COMMENT_ID --body-file FILE
//   factory pr resolve N COMMENT_ID
//   factory pr ready N              # refuses an unverified commit when git signs
//   factory pr closes N             # the tickets the pull request closes, by key
//   factory pr cost N               # notes this session's cost on the pull request
//   factory pr wait-checks N        # every check on HEAD
//   factory pr review-pending N REVIEW  # exits 0 when an approver's review needs an answer
//   factory pr conflicts            # the pull requests the conflict sweep takes
//   factory pr open --title TITLE --body-file FILE [--base BRANCH] [--ready|--draft]
//   factory pr view N --field FIELD # one field of a pull request
//   factory pr review N REVIEW      # a review's author, body, and line comments
//   factory pr comments N [--from-approvers]  # conversation comments, or only an approver's
//   factory pr unverified N         # the commits not shown as signed
//   factory pr failed N             # each failed job's log, and a failed check's own report
//   factory pr review-again N       # a fresh review of the same commit
//   factory pr push                 # this branch, or its commits handed over
//   factory pr pull                 # the remote's commits on this branch
//
// COMMENT_ID is a thread's first comment, as `threads` prints it. A failed
// read exits 1 with the error; `review-pending` and `conflicts`, which a
// workflow's only-if gate reads 0 as work and 1 as none, exit 2 on a failed read.
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, statSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { loadSettings, reachOf, repoRoot } from "./config.mts";
import { branchDeps, repositoryRemote } from "./lib/default-branch.mts";
import { openTickets } from "./tickets/index.mts";
import { ownLinks, ticketsOf } from "./lib/pull-tickets.mts";
import { readClock, writeClock } from "./lib/clock.mts";
import { measureSession, projectsDir } from "./lib/usage.mts";
import { AGENT_MARK, commentBody } from "./lib/work-status.mts";
import { changedLines, parseLcov, uncovered } from "./patch-coverage.mts";
import { unfinished, toChecks, type Check } from "./pr-watch.mts";
import {
  openCodeHost,
  type CodeHost,
  type Pull,
  type PullComment,
  type Review,
  type Thread,
} from "./code-host/index.mts";
import { BUNDLE_LIMIT, handoffIn } from "./handoff/index.mts";
import { COMMITS, commitsFault, commitsIn } from "./handoff/links.mts";
import { openRunner, type Run, type Runner } from "./runner/index.mts";
import { refuseBareTags, refuseOverride } from "./guard-ticket-text.mts";
import { labelOf, PR_LABELS, type Labels } from "./labels.mts";

import type { Tickets } from "./tickets/types.mts";
import { takeCost, type CostDeps } from "./ticket.mts";
import * as say from "./lib/output.mts";

export type Deps = {
  /** The repository, as owner/name, from the factory's settings. */
  repository: string;
  codeHost: CodeHost;
  runner: Runner;
  sleep: (ms: number) => Promise<unknown>;
  out: (line: string) => void;
  readFile: (path: string) => string;
  git: (args: string[]) => string;
  /** The name of the repository's remote in the checkout, for the base
   * `uncovered` compares with. It rejects with why when no remote is the
   * repository's. */
  remote: () => Promise<string>;
  /** Milliseconds, for how long `wait-checks` has waited. */
  now?: () => number;
  /** For GITHUB_ACTIONS, which says GraphQL is open without asking. */
  env?: Record<string, string | undefined>;
  /** The settings' ticket system, and whether the code host's own links
   * count (`lib/pull-tickets.mts`), for `closes`. */
  tickets?: () => Promise<{ tickets: Tickets; own: boolean }>;
  /** The session's cost clock, for `cost`. */
  cost?: CostDeps;
  /** The name of each label the factory puts on pull requests, for
   * `label`; the defaults without it. */
  labels?: () => Promise<Labels["codeHost"]>;
  /** Whether the settings have the automated review on; on without it. */
  reviewOn?: () => Promise<boolean>;
};

/** The tickets a pull request builds, as the factory counts them. */
export async function pullTickets(d: Deps, pr: number) {
  if (!d.tickets) throw new Error("No ticket system to read links with.");
  const { tickets, own } = await d.tickets();
  const pull = await d.codeHost.get(pr);
  return {
    tickets,
    links: ticketsOf(
      { body: pull.body, closes: own ? await d.codeHost.closes(pr) : [] },
      tickets,
      own,
    ),
  };
}

export function withAgentMark(body: string): string {
  return body.includes(AGENT_MARK)
    ? body
    : `${body.trimEnd()}\n\n${AGENT_MARK}`;
}

export type Report = {
  pull: Pull;
  /** The authors among the reviews and the threads' last comments who can
   * write to the repository. */
  approvers: string[];
  reviewRun: { status: string; conclusion: string | null } | null;
  /** False where the settings turn the automated review off. */
  reviewOn?: boolean;
  summary: PullComment | null;
  conversation: PullComment[];
  reviews: Review[];
  threads: Thread[];
  checks: Check[];
};

const SKIP_AS_LAST = /<!-- (conflict-fix|session-handoff) -->|conflict-stop/;

/** An approver's review bodies still to answer: submitted after the last
 * conversation comment carrying the agent mark, a sweep's own comments
 * aside. */
export function approverReviewsToWork(r: Report): Review[] {
  const answered = r.conversation
    .filter((c) => c.body.includes(AGENT_MARK) && !SKIP_AS_LAST.test(c.body))
    .map((c) => c.createdAt)
    .sort()
    .at(-1);
  return r.reviews.filter(
    (review) =>
      r.approvers.includes(review.author) &&
      review.body.trim() !== "" &&
      !review.body.includes(AGENT_MARK) &&
      (!answered || review.submittedAt > answered),
  );
}

/** A review is coming for this head only where the automated review is on,
 * and on a pull request its job runs on. */
export function reviewExpected(pull: Pull, reviewOn = true): boolean {
  return (
    reviewOn &&
    !pull.isDraft &&
    pull.author !== "dependabot[bot]" &&
    pull.head.repository === pull.base.repository
  );
}

export function isSettled(r: Report): boolean {
  const reviewDone =
    !reviewExpected(r.pull, r.reviewOn) ||
    r.summary !== null ||
    (r.reviewRun?.status === "completed" &&
      r.reviewRun.conclusion !== "success");
  return reviewDone && r.checks.length > 0 && unfinished(r.checks).length === 0;
}

const firstLine = (body: string) =>
  body.replace(AGENT_MARK, "").trim().split("\n")[0].slice(0, 100);

export function formatReport(r: Report): string[] {
  const p = r.pull;
  const lines = [
    `#${p.number} ${p.title}`,
    `state: ${p.state}${p.isDraft ? ", draft" : ", ready"}; head ${p.head.sha.slice(0, 7)} on ${p.head.branch}; base ${p.base.branch}; author ${p.author}`,
    `mergeable: ${p.mergeableState}`,
  ];
  if (!reviewExpected(p, r.reviewOn))
    lines.push("Claude review: none expected on this head");
  else if (!r.reviewRun) lines.push("Claude review: no run yet for this head");
  else
    lines.push(
      `Claude review: ${r.reviewRun.status}${r.reviewRun.conclusion ? `, ${r.reviewRun.conclusion}` : ""}`,
    );
  if (r.summary) {
    const verdict =
      /review-verdict: (\w+)/.exec(r.summary.body)?.[1] ?? "unknown";
    lines.push(`summary: comment ${r.summary.id}, verdict ${verdict}`);
  } else lines.push("summary: none for this head");

  const toAnswer = approverReviewsToWork(r);
  lines.push(`approver review bodies to answer: ${toAnswer.length}`);
  for (const review of toAnswer)
    lines.push(
      `  - review ${review.id} at ${review.submittedAt}: ${firstLine(review.body)}`,
    );

  const open = r.threads.filter((t) => !t.isResolved);
  lines.push(`unresolved threads: ${open.length}`);
  for (const t of open) {
    const last = t.comments.at(-1);
    const approverTurn =
      last !== undefined &&
      r.approvers.includes(last.author) &&
      !last.body.includes(AGENT_MARK);
    lines.push(
      `  - ${t.commentId} on ${t.path}:${t.line ?? "?"}${t.isOutdated ? " (outdated)" : ""} by ${t.comments[0]?.author ?? "?"}${approverTurn ? ", approver's turn" : ""}: ${firstLine(t.comments[0]?.body ?? "")}`,
    );
  }

  lines.push("checks:");
  if (r.checks.length === 0) lines.push("  (none yet)");
  for (const check of r.checks) lines.push(`  - ${check.name}: ${check.state}`);

  const codecov = r.conversation.filter((c) => /codecov/i.test(c.author));
  lines.push(
    codecov.length
      ? `codecov comment: ${codecov.at(-1)!.id}`
      : "codecov comment: none (it comments only when coverage moved)",
  );
  return lines;
}

async function readPull(p: CodeHost, pr: number, d: Deps): Promise<Pull> {
  for (let attempt = 1; ; attempt++) {
    const pull = await p.get(pr);
    if (pull.mergeableState !== "unknown" || attempt >= 5) return pull;
    await d.sleep(10_000);
  }
}

/** The distinct names among `authors` that can write to the repository,
 * asking the code host once for each. Rejects when it cannot say. */
async function writers(p: CodeHost, authors: string[]): Promise<string[]> {
  const distinct = [...new Set(authors)];
  const can = await Promise.all(distinct.map((a) => p.canWrite(a)));
  return distinct.filter((_, i) => can[i]);
}

async function readReport(p: CodeHost, pr: number, d: Deps): Promise<Report> {
  const pull = await readPull(p, pr, d);
  const sha = pull.head.sha;
  const [runs, conversation, reviews, threads, checkRuns, statuses] =
    await Promise.all([
      d.runner.reviewRuns(sha),
      p.comments(pr),
      p.reviews(pr),
      p.threads(pr),
      p.checkRuns(sha),
      p.statuses(sha),
    ]);
  const summary =
    conversation
      .filter(
        (c) =>
          c.author === "github-actions[bot]" &&
          c.body.includes(`claude-review sha=${sha}`),
      )
      .at(-1) ?? null;
  const authors = [
    ...reviews.map((review) => review.author),
    ...threads
      .filter((t) => !t.isResolved)
      .flatMap((t) => t.comments.at(-1)?.author ?? []),
  ];
  return {
    pull,
    approvers: await writers(p, authors),
    reviewRun: runs[0] ?? null,
    reviewOn: (await d.reviewOn?.()) ?? true,
    summary,
    conversation,
    reviews,
    threads,
    checks: toChecks(checkRuns, statuses),
  };
}

const POLL_MS = 30_000;

/** How long `wait-checks` waits for a first run before it decides the
 * repository runs no CI on this commit. */
export const NO_CHECKS_MS = 120_000;

/** The events whose runs `wait-checks` waits on. The factory's own
 * workflows start on pull_request_target and workflow_run, and a failed
 * board sync should not stop a pull request being marked ready. */
const WAITED_EVENTS = ["pull_request", "push"];
export const PASSED = ["success", "skipped", "neutral"];
const passed = (conclusion: string | null) => PASSED.includes(conclusion ?? "");

/** The newest run of each workflow, among the waited-on events. */
export function newestRuns(runs: Run[]): Run[] {
  const newest = new Map<number, Run>();
  for (const r of runs) {
    if (!WAITED_EVENTS.includes(r.event)) continue;
    const seen = newest.get(r.jobs);
    if (!seen || r.id > seen.id) newest.set(r.jobs, r);
  }
  return [...newest.values()];
}

/** Waits until GitHub shows the pushed commit as the pull request's head,
 * then until every workflow run for that commit has completed, and says how
 * they ended. It goes by runs, not check runs alone, since a job that waits
 * on another has no check run until that one finishes. */
async function waitChecks(
  p: CodeHost,
  d: Deps,
  pr: number,
): Promise<{ line: string; code: number }> {
  const now = d.now ?? Date.now;
  const sha = d.git(["rev-parse", "HEAD"]).trim();
  for (;;) {
    const pull = await p.get(pr);
    if (pull.head.sha === sha) break;
    await d.sleep(2000);
  }
  const headAt = now();
  for (;;) {
    const runs = newestRuns(await d.runner.runs(sha));
    if (runs.length === 0 && now() - headAt >= NO_CHECKS_MS)
      return { line: "no checks", code: 0 };
    if (runs.length > 0 && runs.every((r) => r.status === "completed")) {
      const failed = runs.filter((r) => !PASSED.includes(r.conclusion ?? ""));
      if (failed.length === 0) return { line: "success", code: 0 };
      const reported = new Set(failed.map((r) => r.checksId));
      const names = (await p.checkRuns(sha))
        .filter(
          (c) =>
            reported.has(c.checksId ?? -1) &&
            !PASSED.includes(c.conclusion ?? ""),
        )
        .map((c) => c.name);
      return { line: `failure: ${names.join(", ")}`, code: 3 };
    }
    await d.sleep(runs.length === 0 ? 15_000 : POLL_MS);
  }
}

/** What `view --field` prints, by the field's name. */
const FIELDS: Record<string, (pull: Pull) => string> = {
  head: (p) => p.head.sha,
  branch: (p) => p.head.branch,
  base: (p) => p.base.branch,
  title: (p) => p.title,
  body: (p) => p.body,
  state: (p) => p.state,
  mergeable: (p) => p.mergeableState,
};

/** How many lines of a failed job's log `failed` prints, from its end. */
const LOG_TAIL = 200;

const USAGE = `Usage: factory pr state [N] [--wait] | threads N [--all] | reply N COMMENT_ID --body-file FILE | resolve N COMMENT_ID | ready N | closes N | cost N | for-branch BRANCH | wait-checks N | comments N [--author LOGIN] [--contains TEXT] [--from-approvers] [--json] | comment N --body-file FILE | comment-view ID | label N --add LABEL | --remove LABEL | review-pending N REVIEW | conflicts | open --title TITLE --body-file FILE [--base BRANCH] [--ready|--draft] | view N --field ${Object.keys(FIELDS).join("|")} | review N REVIEW | unverified N | uncovered [BASE] [LCOV] | failed N | review-again N`;

function option(args: string[], name: string): string | undefined {
  const at = args.indexOf(name);
  if (at === -1) return undefined;
  const value = args[at + 1];
  if (value === undefined) throw new Error(USAGE);
  return value;
}

/** A conversation comment as `pr comments` lists it: ID, author, time, and
 * its first line. */
export function commentLine(c: PullComment): string {
  const first = c.body.replace(AGENT_MARK, "").trim().split("\n")[0];
  return `${c.id} ${c.author} ${c.createdAt} ${first}`.trimEnd();
}

/** A conversation comment under GitHub's own field names, which
 * `comments --json` has always printed. */
const inGithubNames = (c: PullComment) => ({
  id: c.id,
  user: { login: c.author },
  body: c.body,
  created_at: c.createdAt,
});

/** Whether git is set to sign commits here. An unset value exits non-zero. */
function gitSigns(d: Deps): boolean {
  try {
    return d.git(["config", "--get", "commit.gpgsign"]).trim() === "true";
  } catch {
    return false;
  }
}

/** Whether an approver's review has something in it to work, and if not,
 * why: "closed", "not an approver's", or "the factory's own reply". An
 * empty body counts for nothing, since the factory's reply is a review with
 * an empty body and one comment carrying the marker. */
export async function reviewPending(
  p: CodeHost,
  pr: number,
  reviewId: number,
): Promise<{ pending: true } | { pending: false; why: string }> {
  const pull = await p.get(pr);
  if (pull.state !== "open")
    return {
      pending: false,
      why: `#${pr} is ${pull.merged ? "merged" : "closed"}`,
    };
  const review = (await p.reviews(pr)).find((r) => r.id === reviewId);
  if (!review) throw new Error(`No review ${reviewId} on #${pr}.`);
  if (!(await p.canWrite(review.author)))
    return { pending: false, why: `review ${reviewId} is not an approver's` };
  const { body } = review;
  if (body.trim() !== "" && !body.includes(AGENT_MARK))
    return { pending: true };
  const comments = await p.reviewCommentsOf(pr, reviewId);
  if (comments.some((c) => !c.body.includes(AGENT_MARK)))
    return { pending: true };
  return {
    pending: false,
    why: `review ${reviewId} is the factory's own reply: nothing of an approver's in it`,
  };
}

const CONFLICT_READS = 5;
const CONFLICT_WAIT_MS = 10_000;

/** The numbers of the pull requests the conflict sweep takes, oldest first:
 * not a draft, from this repository, not Dependabot's, based on the default
 * branch, `dirty`, and with no stop comment for the current head. GitHub
 * computes the state lazily, so an `unknown` one is read up to 5 times, 10
 * seconds apart. */
export async function conflicting(
  p: CodeHost,
  sleepFor: (ms: number) => Promise<unknown>,
): Promise<number[]> {
  const base = await p.defaultBranch();
  const queue = (await p.listOpen())
    .filter(
      (pull) =>
        !pull.isDraft &&
        pull.base.branch === base &&
        pull.author !== "dependabot[bot]" &&
        pull.head.repository === pull.base.repository,
    )
    .sort(
      (a, b) =>
        (a.createdAt ?? "").localeCompare(b.createdAt ?? "") ||
        a.number - b.number,
    );
  const found: number[] = [];
  for (const { number } of queue)
    if (await conflicts(p, number, sleepFor)) found.push(number);
  return found;
}

/** Whether a pull request is `dirty`, with no stop comment for its head. */
async function conflicts(
  p: CodeHost,
  number: number,
  sleepFor: (ms: number) => Promise<unknown>,
): Promise<boolean> {
  let pull = await p.get(number);
  for (
    let read = 1;
    pull.mergeableState === "unknown" && read < CONFLICT_READS;
    read++
  ) {
    await sleepFor(CONFLICT_WAIT_MS);
    pull = await p.get(number);
  }
  return pull.mergeableState === "dirty" && !(await stoppedOn(p, pull));
}

/** Whether a conflict run stopped on the pull request's newest commit. */
export async function stoppedOn(p: CodeHost, pull: Pull): Promise<boolean> {
  const stop = `conflict-stop head=${pull.head.sha}`;
  return (await p.comments(pull.number)).some((c) => c.body.includes(stop));
}

export async function main(argv: string[], d: Deps): Promise<number> {
  const [command, ...rest] = argv;
  const numbers = rest.filter((a) => /^\d+$/.test(a)).map(Number);
  try {
    const p = d.codeHost;
    switch (command) {
      case "state": {
        const pr =
          numbers[0] ??
          (await p.forBranch(d.git(["branch", "--show-current"]).trim()));
        if (pr === null) {
          d.out("no open pull request for this branch");
          return 3;
        }
        let report = await readReport(p, pr, d);
        while (rest.includes("--wait") && !isSettled(report)) {
          await d.sleep(POLL_MS);
          report = await readReport(p, pr, d);
        }
        formatReport(report).forEach((line) => d.out(line));
        return 0;
      }
      case "threads": {
        const [pr] = numbers;
        if (!pr) throw new Error(USAGE);
        const threads = await p.threads(pr);
        const listed = rest.includes("--all")
          ? threads
          : threads.filter((t) => !t.isResolved);
        d.out(JSON.stringify(listed, null, 2));
        return 0;
      }
      case "reply": {
        const [pr, commentId] = numbers;
        const file = rest[rest.indexOf("--body-file") + 1];
        if (!pr || !commentId || !rest.includes("--body-file") || !file)
          throw new Error(USAGE);
        const id = await p.reply(
          pr,
          commentId,
          withAgentMark(d.readFile(file)),
        );
        d.out(`replied ${id}`);
        return 0;
      }
      case "resolve": {
        const [pr, commentId] = numbers;
        if (!pr || !commentId) throw new Error(USAGE);
        await p.resolve(pr, commentId);
        d.out("resolved");
        return 0;
      }
      case "ready": {
        const [pr] = numbers;
        if (!pr) throw new Error(USAGE);
        if (gitSigns(d)) {
          const bad = await p.unverifiedCommits(pr);
          if (bad.length > 0) {
            d.out(
              `Not marked ready: git is set to sign, and GitHub shows these commits as not verified:`,
            );
            bad.forEach((line) => d.out(line));
            return 1;
          }
        }
        await p.ready(pr);
        d.out("ready");
        return 0;
      }
      case "for-branch": {
        const [branch] = rest;
        if (!branch || rest.length > 1) throw new Error(USAGE);
        const last = await p.lastForBranch(branch);
        d.out(last ? `#${last.number} ${last.state}` : "none");
        return 0;
      }
      case "closes": {
        const [pr] = numbers;
        if (!pr) throw new Error(USAGE);
        d.out((await pullTickets(d, pr)).links.closes.join(" "));
        return 0;
      }
      case "cost": {
        const [pr] = numbers;
        if (!pr || !d.cost) throw new Error(USAGE);
        // Read first: a number that is no pull request leaves the clock.
        await p.get(pr);
        const taken = takeCost(`#${pr}`, d.cost);
        await p.comment(pr, commentBody({ kind: "cost", cost: taken.note }));
        taken.restart();
        d.out("posted");
        return 0;
      }
      case "wait-checks": {
        const [pr] = numbers;
        if (!pr) throw new Error(USAGE);
        const result = await waitChecks(p, d, pr);
        d.out(result.line);
        return result.code;
      }
      case "review-pending": {
        const [pr, review] = numbers;
        if (!pr || !review) throw new Error(USAGE);
        const result = await reviewPending(p, pr, review);
        if (result.pending) {
          d.out("pending");
          return 0;
        }
        d.out(`nothing to do: ${result.why}`);
        return 1;
      }
      case "conflicts": {
        const found = await conflicting(p, d.sleep);
        if (found.length === 0) {
          d.out("no pull request conflicts with the default branch");
          return 1;
        }
        found.forEach((n) => d.out(String(n)));
        return 0;
      }
      case "comments": {
        const pr = Number(rest[0]);
        if (!Number.isInteger(pr) || pr <= 0) throw new Error(USAGE);
        const author = option(rest, "--author");
        const contains = option(rest, "--contains");
        let kept = (await p.comments(pr)).filter(
          (c) =>
            (author === undefined || c.author === author) &&
            (contains === undefined || c.body.includes(contains)),
        );
        if (rest.includes("--from-approvers")) {
          const can = await writers(
            p,
            kept.map((c) => c.author),
          );
          kept = kept.filter((c) => can.includes(c.author));
        }
        if (rest.includes("--json"))
          d.out(JSON.stringify(kept.map(inGithubNames), null, 2));
        else kept.forEach((c) => d.out(commentLine(c)));
        return 0;
      }
      case "comment": {
        const pr = Number(rest[0]);
        const file = option(rest, "--body-file");
        if (!Number.isInteger(pr) || pr <= 0 || !file) throw new Error(USAGE);
        const body = d.readFile(file);
        refuseBareTags(body);
        d.out(String(await p.comment(pr, body)));
        return 0;
      }
      case "comment-view": {
        const id = Number(rest[0]);
        if (!Number.isInteger(id) || id <= 0) throw new Error(USAGE);
        d.out((await p.commentView(id)).body);
        return 0;
      }
      case "label": {
        const pr = Number(rest[0]);
        const add = rest.includes("--add") ? option(rest, "--add") : undefined;
        const remove = rest.includes("--remove")
          ? option(rest, "--remove")
          : undefined;
        if (
          !Number.isInteger(pr) ||
          pr <= 0 ||
          (add === undefined) === (remove === undefined)
        )
          throw new Error(USAGE);
        const names = d.labels ? await d.labels() : PR_LABELS;
        if (add !== undefined) {
          refuseOverride(add, names);
          await p.addLabel(pr, labelOf(names, add));
        } else await p.removeLabel(pr, labelOf(names, remove!));
        d.out(add !== undefined ? "added" : "removed");
        return 0;
      }
      case "open": {
        const title = option(rest, "--title");
        const file = option(rest, "--body-file");
        if (!title || !file) throw new Error(USAGE);
        const body = d.readFile(file);
        refuseBareTags(body);
        const number = await p.create({
          title,
          body,
          head: d.git(["branch", "--show-current"]).trim(),
          base: option(rest, "--base") ?? (await p.defaultBranch()),
          draft: !rest.includes("--ready"),
        });
        d.out(String(number));
        return 0;
      }
      case "push": {
        const branch = d.git(["branch", "--show-current"]).trim();
        const h = handoffIn(d.env ?? {});
        if (h) {
          const run = h.run();
          // What was merged in from the default branch is there already.
          const main = `origin/${run.defaultBranch}`;
          const range = ["HEAD", "--not", run.base, main];
          const n = Number(d.git(["rev-list", "--count", ...range]));
          if (n === 0) throw new Error("There is no commit to hand over.");
          if (!d.tickets)
            throw new Error("No ticket system to read links with.");
          const { tickets } = await d.tickets();
          const fault = commitsFault(
            { codeHost: p, tickets, run },
            commitsIn(d.git(["log", "-z", COMMITS, ...range])),
          );
          if (fault)
            throw new Error(
              `Nothing is handed over: ${fault}. Change that commit, then run this again.`,
            );
          d.git(["bundle", "create", "-q", h.bundle, ...range]);
          if (statSync(h.bundle).size > BUNDLE_LIMIT) {
            rmSync(h.bundle);
            throw new Error(
              "Nothing is handed over: its commits are larger than 20 MB.",
            );
          }
          d.out(`Handed over ${n} commit${n === 1 ? "" : "s"} on ${branch}.`);
          return 0;
        }
        if (branch === (await p.defaultBranch()))
          throw new Error(`${branch} is the default branch. Push another.`);
        const remote = await d.remote();
        d.git(["push", "-q", "-u", remote, branch]);
        d.out(`Pushed ${branch} to ${remote}.`);
        return 0;
      }
      case "pull": {
        const branch = d.git(["branch", "--show-current"]).trim();
        if (handoffIn(d.env ?? {})) {
          d.out("This is the newest commit there was when the run started.");
          return 0;
        }
        const remote = await d.remote();
        d.git(["pull", "-q", "--no-rebase", remote, branch]);
        d.out(`Merged ${remote}'s ${branch}.`);
        return 0;
      }
      case "view": {
        const pr = Number(rest[0]);
        const field = option(rest, "--field");
        if (!Number.isInteger(pr) || pr <= 0 || !field) throw new Error(USAGE);
        const read = FIELDS[field];
        if (!read)
          throw new Error(
            `No field "${field}". A pull request's fields are ${Object.keys(FIELDS).join(", ")}.`,
          );
        d.out(read(await p.get(pr)));
        return 0;
      }
      case "review": {
        const [pr, id] = numbers;
        if (!pr || !id) throw new Error(USAGE);
        const review = (await p.reviews(pr)).find((r) => r.id === id);
        if (!review) throw new Error(`review ${id} on #${pr} was not found`);
        const comments = await p.reviewCommentsOf(pr, id);
        d.out(
          JSON.stringify(
            {
              author: review.author,
              body: review.body,
              comments: comments.map((c) => ({
                id: c.id,
                author: c.author,
                replyTo: c.replyTo,
                path: c.path,
                line: c.line,
                body: c.body,
              })),
            },
            null,
            2,
          ),
        );
        return 0;
      }
      case "uncovered": {
        if (rest.length > 2) throw new Error(USAGE);
        const [base, lcov = "coverage/lcov.info"] = rest;
        let report: string;
        try {
          report = d.readFile(lcov);
        } catch {
          d.out(
            `No coverage report at ${lcov}. Run the project's coverage command first.`,
          );
          return 1;
        }
        const from = base ?? `${await d.remote()}/${await p.defaultBranch()}`;
        const diff = d.git(["diff", "-U0", `${from}...HEAD`]);
        const source = (path: string) => {
          try {
            return d.readFile(path);
          } catch {
            return null;
          }
        };
        uncovered(
          parseLcov(report, process.cwd()),
          changedLines(diff),
          source,
        ).forEach((line) => d.out(line));
        return 0;
      }
      case "unverified": {
        const [pr] = numbers;
        if (!pr) throw new Error(USAGE);
        (await p.unverifiedCommits(pr)).forEach((line) => d.out(line));
        return 0;
      }
      case "failed": {
        const [pr] = numbers;
        if (!pr) throw new Error(USAGE);
        const sha = (await p.get(pr)).head.sha;
        const failedRuns = newestRuns(await d.runner.runs(sha)).filter(
          (r) => r.status === "completed" && !passed(r.conclusion),
        );
        for (const run of failedRuns)
          for (const job of await d.runner.failedJobs(run.id)) {
            d.out(`== ${job.name}`);
            d.out(job.log.trimEnd().split("\n").slice(-LOG_TAIL).join("\n"));
          }
        for (const check of await p.checkRuns(sha)) {
          if (check.status !== "completed" || passed(check.conclusion))
            continue;
          if (!check.report) continue;
          d.out(`== ${check.name}, in its own words`);
          d.out(check.report);
        }
        return 0;
      }
      case "review-again": {
        const [pr] = numbers;
        if (!pr) throw new Error(USAGE);
        const sha = (await p.get(pr)).head.sha;
        if (!(await d.runner.reviewAgain(sha))) {
          d.out(`no review has run on ${sha}`);
          return 1;
        }
        d.out(`asked for a fresh review of ${sha}`);
        return 0;
      }
      default:
        throw new Error(USAGE);
    }
  } catch (error) {
    say.plainError(error instanceof Error ? error.message : String(error));
    // The only-if gate reads 1 as "nothing to do", so a check that could not
    // tell exits 2.
    return command === "review-pending" || command === "conflicts" ? 2 : 1;
  }
}

/** `factory pr ...`. */
export async function run(argv: string[]): Promise<number> {
  const { repository, codeHost, runner } = await reachOf(process.env);
  return main(argv, prDeps(repository, codeHost, runner));
}

/** What `run` gives `main`, for the repository and the code host and
 * runner named. */
export function prDeps(
  repository: string,
  codeHost: string,
  runner: string,
): Deps {
  return {
    repository,
    codeHost: openCodeHost(repository, codeHost),
    runner: openRunner(repository, runner),
    sleep,
    out: say.plainPrinter(),
    readFile: (path) => readFileSync(path, "utf8"),
    // A branch's whole diff, which `uncovered` reads, can pass Node's 1 MB.
    // Git's own error is in the thrown message, so it is not printed twice.
    git: (args) =>
      execFileSync("git", args, {
        encoding: "utf8",
        maxBuffer: 256 << 20,
        stdio: ["ignore", "pipe", "pipe"],
      }),
    remote: () => repositoryRemote(branchDeps(repoRoot())),
    env: process.env,
    tickets: async () => {
      const settings = await loadSettings();
      const { tickets } = await openTickets(settings, {
        repository,
        board: null,
      });
      return { tickets, own: ownLinks(settings) };
    },
    labels: async () => (await loadSettings()).codeHost.labels,
    reviewOn: async () => (await loadSettings()).prReview !== null,
    cost: {
      env: process.env,
      now: () => new Date(),
      clock: { read: readClock, write: writeClock },
      measure: (session, since) =>
        measureSession(projectsDir(process.env), session, since),
    },
  };
}
