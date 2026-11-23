#!/usr/bin/env node
// Wait until a pull request needs its session's attention, say why, and exit.
//
//   factory pr watch N             # run in the background
//   factory pr watch N --release   # stop claiming the pull request
//
// Each event is reported once, so a check judged fine as-is does not wake the
// session again. Run it again after working what it reported, until it prints
// "merged" or "closed". While it runs, the pull request's body carries a mark
// that the `factory-address-review` skill reads, so a workflow does not answer the owner's
// review alongside this session.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { reachOf, repoRoot } from "./config.mts";
import {
  branchDeps,
  needDefaultBranch,
  NoDefaultBranch,
} from "./lib/default-branch.mts";
import {
  openCodeHost,
  type CheckRun,
  type CodeHost,
  type CommitStatus,
} from "./code-host/index.mts";

export type Check = {
  /** A re-run has a new id, so its result is news on the same commit. */
  id: number;
  name: string;
  state: "pending" | "passed" | "failed";
  url?: string;
};

export type Comment = {
  id: number;
  author: string;
  where: string;
  body: string;
};

export type Snapshot = {
  state: string;
  merged: boolean;
  headSha: string;
  mergeableState: string;
  checks: Check[];
  /** Conversation comments on the pull request, for the review summaries. */
  conversation: Comment[];
  comments: Comment[];
  reviews: Comment[];
};

export type WatchEvent = { key: string; line: string };

const FAILED_CONCLUSIONS = new Set([
  "failure",
  "timed_out",
  "cancelled",
  "startup_failure",
  "action_required",
]);
const AGENT_MARKER = "<!-- agent -->";
const REVIEW_CHECK = "Claude review";
const REVIEW_BOT = "github-actions[bot]";

export function toChecks(runs: CheckRun[], statuses: CommitStatus[]): Check[] {
  return [
    ...runs.map((run): Check => {
      const state =
        run.status !== "completed"
          ? "pending"
          : FAILED_CONCLUSIONS.has(run.conclusion ?? "")
            ? "failed"
            : "passed";
      return { id: run.id, name: run.name, state, url: run.link };
    }),
    ...statuses.map((status): Check => {
      const state =
        status.state === "pending"
          ? "pending"
          : status.state === "success"
            ? "passed"
            : "failed";
      return { id: status.id, name: status.name, state, url: status.link };
    }),
  ];
}

/** The last one, since re-running the review posts another for the commit. */
function reviewSummary(snapshot: Snapshot): Comment | undefined {
  return snapshot.conversation
    .filter(
      (comment) =>
        comment.author === REVIEW_BOT &&
        comment.body.includes(`claude-review sha=${snapshot.headSha}`),
    )
    .at(-1);
}

function fingerprint(body: string): string {
  return createHash("sha256").update(body).digest("hex").slice(0, 12);
}

/** A failed review run posts no summary, so that run ends the wait for one. */
function reviewIsOver(snapshot: Snapshot): boolean {
  if (reviewSummary(snapshot)) return true;
  const run = snapshot.checks.find((check) => check.name === REVIEW_CHECK);
  return run?.state === "failed";
}

/** What needs the session now and has not been reported. A closed pull
 * request ends the watch, so nothing else about it is news. `branch` is the
 * default branch, which a conflict's line names. */
export function newEvents(
  snapshot: Snapshot,
  seen: Set<string>,
  branch: string,
): WatchEvent[] {
  if (snapshot.merged) return [{ key: "merged", line: "merged" }];
  if (snapshot.state !== "open") return [{ key: "closed", line: "closed" }];

  const sha = snapshot.headSha;
  const found: WatchEvent[] = [];
  if (snapshot.mergeableState === "dirty") {
    found.push({
      key: `conflict:${sha}`,
      line: `conflict with ${branch} at ${sha}`,
    });
  }
  for (const check of snapshot.checks) {
    if (check.state !== "failed") continue;
    found.push({
      key: `failed:${check.id}`,
      line: `check failed: ${check.name} ${check.url ?? ""}`.trim(),
    });
  }
  const summary = reviewSummary(snapshot);
  if (summary) {
    const verdict =
      /review-verdict: (\w+)/.exec(summary.body)?.[1] ?? "unknown";
    found.push({
      key: `review:${summary.id}`,
      line: `review of ${sha}: ${verdict}`,
    });
  }
  // The reviewer posts its findings one at a time, and a push partway through
  // would cancel it, so they wait for it to finish.
  const reviewRunning = snapshot.checks.some(
    (check) => check.name === REVIEW_CHECK && check.state === "pending",
  );
  for (const comment of snapshot.comments) {
    if (comment.body.includes(AGENT_MARKER)) continue;
    if (reviewRunning && comment.author === REVIEW_BOT) continue;
    found.push({
      key: `comment:${comment.id}:${fingerprint(comment.body)}`,
      line: `comment ${comment.id} by ${comment.author} on ${comment.where}`,
    });
  }
  for (const review of snapshot.reviews) {
    if (!review.body.trim() || review.body.includes(AGENT_MARKER)) continue;
    found.push({
      key: `review-body:${review.id}:${fingerprint(review.body)}`,
      line: `review body ${review.id} by ${review.author}`,
    });
  }
  const finished =
    snapshot.checks.length > 0 &&
    snapshot.checks.every((check) => check.state !== "pending") &&
    reviewIsOver(snapshot);
  if (finished) {
    found.push({
      key: `finished:${snapshot.checks
        .map((check) => check.id)
        .sort()
        .join(",")}`,
      line: `every check has finished on ${sha}`,
    });
  }
  return found.filter((event) => !seen.has(event.key));
}

const MARK = /\n*<!-- session-watching: (\S+) -->/;

export function withWatchMark(body: string, now: Date): string {
  const stripped = withoutWatchMark(body);
  return `${stripped}\n\n<!-- session-watching: ${now.toISOString()} -->`;
}

export function withoutWatchMark(body: string): string {
  return body.replace(MARK, "");
}

/** A mark goes stale after an hour, so a session that has gone stops holding
 * back the workflow soon after. Renewing it covers the time a session spends
 * working what the watcher reported, when nothing renews it. */
export function watchMarkNeedsRenewing(body: string, now: Date): boolean {
  const written = MARK.exec(body)?.[1];
  if (!written) return true;
  const ageMs = now.getTime() - new Date(written).getTime();
  return !(ageMs < 15 * 60 * 1000);
}

/** A login that has expired or a pull request that does not exist will not
 * recover by waiting, so the session should hear about it now. */
export function isPermanentFailure(error: unknown): boolean {
  return /HTTP 40[14]\b/.test(String(error));
}

async function readSnapshot(
  p: CodeHost,
  pr: number,
): Promise<{ snapshot: Snapshot; body: string }> {
  const pull = await p.get(pr);
  const sha: string = pull.head.sha;
  const [runs, statuses, conversation, comments, reviews] = await Promise.all([
    p.checkRuns(sha),
    p.statuses(sha),
    p.comments(pr),
    p.reviewComments(pr),
    p.reviews(pr),
  ]);
  const toComment = (raw: {
    id: number;
    author: string;
    body: string;
    path?: string;
    line?: number | null;
  }): Comment => ({
    id: raw.id,
    author: raw.author,
    where: raw.path ? `${raw.path}:${raw.line ?? "?"}` : "the pull request",
    body: raw.body,
  });
  return {
    body: pull.body,
    snapshot: {
      state: pull.state,
      merged: pull.merged ?? false,
      headSha: sha,
      mergeableState: pull.mergeableState,
      checks: toChecks(runs, statuses),
      conversation: conversation.map(toComment),
      comments: comments.map(toComment),
      reviews: reviews.map(toComment),
    },
  };
}

const POLL_MS = 30_000;
// A laptop that sleeps pauses this timer, so this is an hour of failing awake.
const MAX_FAILURES = 120;

async function main(argv: string[]) {
  const pr = argv[0];
  if (!/^\d+$/.test(pr ?? "")) {
    console.error("Usage: factory pr watch PR_NUMBER [--release]");
    process.exit(2);
  }
  const { repository, codeHost } = await reachOf(process.env);
  const p = openCodeHost(repository, codeHost);
  const n = Number(pr);
  if (argv[1] === "--release") {
    const { body } = await readSnapshot(p, n);
    await p.setBody(n, withoutWatchMark(body));
    return;
  }

  // The code host is already open, so it is the one asked where the
  // checkout does not say.
  let branch: string;
  try {
    branch = await needDefaultBranch({
      ...branchDeps(repoRoot()),
      host: () => p.defaultBranch(),
    });
  } catch (error) {
    if (!(error instanceof NoDefaultBranch)) throw error;
    console.error(error.message);
    process.exit(1);
  }

  const seenFile = execFileSync(
    "git",
    ["rev-parse", "--git-path", `watch-pr-${pr}.json`],
    { encoding: "utf8" },
  ).trim();
  const seen = new Set<string>(
    existsSync(seenFile) ? JSON.parse(readFileSync(seenFile, "utf8")) : [],
  );

  let failures = 0;
  for (;;) {
    try {
      const { snapshot, body } = await readSnapshot(p, n);
      const events = newEvents(snapshot, seen, branch);
      if (snapshot.state !== "open") {
        rmSync(seenFile, { force: true });
        console.log(events.map((event) => event.line).join("\n"));
        return;
      }
      if (watchMarkNeedsRenewing(body, new Date())) {
        try {
          await p.setBody(n, withWatchMark(body, new Date()));
        } catch (error) {
          // Not a reason to hold back what is ready to report.
          console.error(`Could not renew the watch mark: ${error}`);
        }
      }
      if (events.length > 0) {
        console.log(events.map((event) => event.line).join("\n"));
        for (const event of events) seen.add(event.key);
        writeFileSync(seenFile, JSON.stringify([...seen]));
        return;
      }
      failures = 0;
    } catch (error) {
      failures += 1;
      if (isPermanentFailure(error) || failures >= MAX_FAILURES) throw error;
    }
    await sleep(POLL_MS);
  }
}

// Only run as a CLI. Importing this module for tests must not call GitHub.
/** `factory pr watch N [--release]`. */
export async function run(argv: string[]): Promise<number> {
  await main(argv);
  return 0;
}
