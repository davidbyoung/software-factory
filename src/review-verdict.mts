#!/usr/bin/env node
// Post the "Review verdict" commit status from a GitHub Actions event.
//
//   npx --no-install factory review verdict    # reads GITHUB_EVENT_NAME and _PATH
//
// Runs from main's copy, on two events: the Claude review finishing
// (workflow_run), and the pull request itself (pull_request_target: opened,
// pushed to, marked ready, or labeled "verdict: override"). The verdict is posted
// on one commit, so a new push always starts without one.
import { readFileSync } from "node:fs";
import { openCodeHost } from "./code-host/index.mts";
import { openRunner } from "./runner/index.mts";

// The status's name, which the main ruleset requires by exactly this text.
export const CONTEXT = "Review verdict";
export const OVERRIDE = "verdict: override";

export type Verdict = "ready" | "changes" | null;

export type Input = {
  event: "workflow_run" | "pull_request_target";
  /** pull_request_target's action, such as synchronize or labeled. */
  action?: string;
  /** The label added or removed, on a labeled or unlabeled action. */
  label?: string;
  isDependabot: boolean;
  isDraft: boolean;
  /** The override label is on the pull request. A push removes it, so it
   * always applies to the head. */
  hasOverride: boolean;
  /** The account behind a labeled event is the repository's owner. Agents
   * act through that account too; the guard hook stops them on the
   * owner's laptop. This stops everyone else. */
  senderIsOwner?: boolean;
  /** workflow_run's conclusion: success, failure, cancelled, skipped. */
  runConclusion?: string;
  /** The marker in the review's summary for this commit; null if none. */
  verdict: Verdict;
};

export type Decision = {
  state: "success" | "failure" | "pending";
  description: string;
  removeOverride?: boolean;
  announceOverride?: boolean;
};

const WAITING: Decision = {
  state: "pending",
  description: "Waiting for the review of this commit",
};
const DRAFT: Decision = {
  state: "pending",
  description: "Draft: no review until it is marked ready",
};
const OVERRIDDEN: Decision = {
  state: "success",
  description: "Overridden by the owner",
};

function fromVerdict(verdict: Verdict, ifMissing: Decision): Decision {
  if (verdict === "ready") {
    return { state: "success", description: "The review found it ready" };
  }
  if (verdict === "changes") {
    return { state: "failure", description: "The review asked for changes" };
  }
  return ifMissing;
}

/** The status to post, or null to leave the commit's status as it is. */
export function decide(input: Input): Decision | null {
  if (input.isDependabot) {
    return {
      state: "success",
      description: "Review skipped: Dependabot. CI and end-to-end are the gate",
    };
  }
  if (input.event === "workflow_run") {
    // An override already vouches for this commit; a late review must not
    // overwrite it.
    if (input.hasOverride) return null;
    if (input.runConclusion === "skipped") {
      return input.isDraft
        ? DRAFT
        : { state: "pending", description: "The review did not run" };
    }
    if (input.runConclusion !== "success") {
      return { state: "failure", description: "The review did not finish" };
    }
    return fromVerdict(input.verdict, {
      state: "failure",
      description: "The review posted no verdict",
    });
  }
  switch (input.action) {
    case "labeled":
      if (input.label !== OVERRIDE) return null;
      if (!input.senderIsOwner) {
        return { ...fromVerdict(input.verdict, WAITING), removeOverride: true };
      }
      return { ...OVERRIDDEN, announceOverride: true };
    case "unlabeled":
      return input.label === OVERRIDE
        ? fromVerdict(input.verdict, WAITING)
        : null;
    case "synchronize":
      // The owner overrode the commit they read. The new one is unread.
      return { ...WAITING, removeOverride: input.hasOverride };
    default:
      if (input.hasOverride) return OVERRIDDEN;
      if (input.isDraft) return DRAFT;
      return fromVerdict(input.verdict, WAITING);
  }
}

/** Whether a finished review should set the head's verdict. It should when
 * it reviewed the head, or when it finished and its summary is for the head
 * anyway, as when the event that started it named an older commit. Once the
 * head has a verdict of its own, a run of an older commit that was
 * cancelled, failed, or timed out leaves it alone: GitHub delivers a run's
 * completion minutes after the fact, so one can arrive after the head's own
 * review has concluded. Until the head has a verdict, a run that failed or
 * timed out sets it, since it may have been reviewing the head and no other
 * review is coming; a run a newer push cancelled leaves the head to its
 * own. */
export function reviewIsAboutHead(
  reviewed: string,
  head: string,
  verdictForHead: Verdict,
  conclusion?: string,
): boolean {
  if (reviewed === head) return true;
  if (verdictForHead !== null) return conclusion === "success";
  return conclusion === "failure" || conclusion === "timed_out";
}

/** The verdict marker in the last review summary for `sha`, if any. */
export function verdictIn(
  comments: { author: string; body: string }[],
  sha: string,
): Verdict {
  const summaries = comments.filter(
    (c) =>
      c.author === "github-actions[bot]" &&
      c.body.includes(`<!-- claude-review sha=${sha} -->`),
  );
  const body = summaries.at(-1)?.body ?? "";
  const match = /<!-- review-verdict: (ready|changes) -->/.exec(body);
  return match ? (match[1] as Verdict) : null;
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY!;
  const eventName = process.env.GITHUB_EVENT_NAME as Input["event"];
  const event = JSON.parse(
    readFileSync(process.env.GITHUB_EVENT_PATH!, "utf8"),
  );
  const pulls = openCodeHost(repo);

  // Read the pull request as it is now. The event's copy can be stale: a
  // "marked ready" event sent just after a push carries the previous commit.
  let number: number;
  if (eventName === "workflow_run") {
    const reviewed = event.workflow_run.head_sha;
    const open = (await pulls.forCommit(reviewed)).find(
      (p) => p.state === "open",
    );
    if (!open) return console.log(`No open pull request has ${reviewed}.`);
    number = open.number;
  } else {
    number = event.pull_request.number;
  }
  const pr = await pulls.get(number);
  const sha: string = pr.head.sha;

  const { labels } = pr;
  const comments = await pulls.comments(pr.number);
  if (
    eventName === "workflow_run" &&
    !reviewIsAboutHead(
      event.workflow_run.head_sha,
      sha,
      verdictIn(comments, sha),
      event.workflow_run.conclusion,
    )
  ) {
    return console.log(`${sha} is waiting for its own review.`);
  }
  const decision = decide({
    event: eventName,
    action: event.action,
    label: event.label?.name,
    isDependabot: pr.author === "dependabot[bot]",
    isDraft: pr.isDraft,
    hasOverride: labels.includes(OVERRIDE),
    senderIsOwner: event.sender?.login === event.repository?.owner?.login,
    runConclusion: event.workflow_run?.conclusion,
    verdict: verdictIn(comments, sha),
  });
  if (!decision) return console.log("Nothing to post.");

  await pulls.setStatus(sha, {
    state: decision.state,
    name: CONTEXT,
    description: decision.description,
    link: openRunner(repo).thisRun(process.env)?.page,
  });
  console.log(
    `${CONTEXT} on ${sha}: ${decision.state}, ${decision.description}`,
  );

  if (decision.removeOverride) await pulls.removeLabel(pr.number, OVERRIDE);
  if (decision.announceOverride) {
    const open = await pulls.openThreadCount(pr.number);
    await pulls.comment(
      pr.number,
      `\`${CONTEXT}\` overridden by @${event.sender.login} at ${sha.slice(0, 7)}. ` +
        `${open} review thread(s) still open; each must be resolved before this can merge. ` +
        `A new push removes the override.`,
    );
  }
}

// Only run as a CLI. Importing this module for tests must not call GitHub.
/** `factory review verdict`. */
export async function run(): Promise<number> {
  await main();
  return 0;
}
