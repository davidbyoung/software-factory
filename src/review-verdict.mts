#!/usr/bin/env node
// Post the "Review verdict" commit status from a GitHub Actions event.
//
//   factory review verdict    # reads GITHUB_EVENT_NAME and _PATH
//
// Runs from main's copy, on two events: the pull request's own workflow
// finishing (workflow_run), whose review job is what it judges, and the
// pull request itself (pull_request_target: opened, pushed to, marked ready,
// or labeled with the override). The verdict is posted on one commit, so a
// new push always starts without one.
import { loadSettings } from "./config.mts";
import { PR_LABELS } from "./labels.mts";
import { readFileSync } from "node:fs";
import { openCodeHost } from "./code-host/index.mts";
import type { CodeHost } from "./code-host/types.mts";
import { openRunner } from "./runner/index.mts";

// The status's name, which the main ruleset requires by exactly this text.
export const CONTEXT = "Review verdict";
/** The override's name when the settings give it no other. */
export const OVERRIDE = PR_LABELS["verdict-override"];

export type Verdict = "ready" | "changes" | null;

export type Input = {
  event: "workflow_run" | "pull_request_target";
  /** pull_request_target's action, such as synchronize or labeled. */
  action?: string;
  /** The label added or removed, on a labeled or unlabeled action. */
  label?: string;
  /** The override's name, as `code-host.labels` gives it. */
  override?: string;
  /** Dependabot opened it, and the code host verifies every commit on it
   * as Dependabot's. */
  isDependabot: boolean;
  isDraft: boolean;
  /** The override label is on the pull request. A push removes it, so it
   * always applies to the head. */
  hasOverride: boolean;
  /** The account the code host says added the override can write to the
   * repository. Agents act through such accounts too; the guard hook stops
   * them on a person's laptop. This stops everyone else. */
  overrideByApprover?: boolean;
  /** The code host could not say who added it, or whether they can write. */
  overrideUnchecked?: boolean;
  /** How the review's job ended in the run that finished: success, failure,
   * cancelled, skipped. */
  runConclusion?: string;
  /** The settings turn the automated review off, so none is coming. */
  reviewOff?: boolean;
  /** The marker in the review's summary for this commit; null if none. */
  verdict: Verdict;
};

export type Decision = {
  state: "success" | "failure" | "pending";
  description: string;
  removeOverride?: boolean;
  announceOverride?: boolean;
  /** Why the override was removed, for the comment that says so. */
  explainRemoval?: "not an approver" | "could not check";
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
  description: "Overridden by an approver",
};
const OFF: Decision = {
  state: "success",
  description: "The automated review is off",
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

/** The status an event calls for where no override counts. */
function withoutOverride(input: Input): Decision {
  if (input.event === "workflow_run") {
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
  const label = input.action === "labeled" || input.action === "unlabeled";
  if (input.isDraft && !label) return DRAFT;
  return fromVerdict(input.verdict, WAITING);
}

/** The status to post, or null to leave the commit's status as it is. */
export function decide(input: Input): Decision | null {
  if (input.isDependabot) {
    return {
      state: "success",
      description: "Review skipped: Dependabot. CI and end-to-end are the gate",
    };
  }
  if (input.reviewOff) {
    // A status that waited would wait forever, and a rule that requires
    // this one would hold every pull request.
    const otherLabel =
      (input.action === "labeled" || input.action === "unlabeled") &&
      input.label !== (input.override ?? OVERRIDE);
    return otherLabel ? null : OFF;
  }
  if (input.action === "synchronize") {
    // The approver overrode the commit they read. The new one is unread.
    return { ...WAITING, removeOverride: input.hasOverride };
  }
  if (input.hasOverride && !input.overrideByApprover) {
    return {
      ...withoutOverride(input),
      removeOverride: true,
      explainRemoval: input.overrideUnchecked
        ? "could not check"
        : "not an approver",
    };
  }
  // An override already vouches for this commit; a late review must not
  // overwrite it.
  if (input.event === "workflow_run" && input.hasOverride) return null;
  switch (input.action) {
    case "labeled":
      if (input.label !== (input.override ?? OVERRIDE)) return null;
      return input.hasOverride
        ? { ...OVERRIDDEN, announceOverride: true }
        : withoutOverride(input);
    case "unlabeled":
      return input.label === (input.override ?? OVERRIDE)
        ? withoutOverride(input)
        : null;
    default:
      return input.hasOverride ? OVERRIDDEN : withoutOverride(input);
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

const DEPENDABOT = "dependabot[bot]";

/** Whether Dependabot opened the pull request, and the code host verifies
 * every commit on it, `sha` among them, as Dependabot's. */
async function onlyDependabot(
  pulls: CodeHost,
  pr: { number: number; author: string },
  sha: string,
  log: (line: string) => void,
): Promise<boolean> {
  if (pr.author !== DEPENDABOT) return false;
  try {
    const commits = await pulls.commits(pr.number);
    // A push since the pull request was read can have replaced `sha`.
    return (
      commits.some((c) => c.sha === sha) &&
      commits.every((c) => c.verifiedAuthor === DEPENDABOT)
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log(`Could not check that every commit is Dependabot's: ${reason}`);
    return false;
  }
}

/** Posts the verdict for one event, removes or announces the override,
 * and says why it removed one. When the code host cannot say who added the
 * override, or whether they can write, it removes the label, then rejects
 * with the reason. */
export async function apply(o: {
  eventName: Input["event"];
  /** The event as GitHub sends it. */
  event: any;
  pulls: CodeHost;
  /** The page of the run posting the status. */
  link?: string;
  log: (line: string) => void;
  /** The override's name, as `code-host.labels` gives it. */
  override?: string;
  /** False where the settings turn the automated review off. */
  reviewOn?: boolean;
  /** How the review's job ended in a run, by the run's ID. Without it, the
   * run's own conclusion stands in. */
  reviewConclusion?: (run: number) => Promise<string>;
}): Promise<void> {
  const { eventName, event, pulls, log } = o;
  const override = o.override ?? OVERRIDE;

  // Read the pull request as it is now. The event's copy can be stale: a
  // "marked ready" event sent just after a push carries the previous commit.
  let number: number;
  if (eventName === "workflow_run") {
    const reviewed = event.workflow_run.head_sha;
    const open = (await pulls.forCommit(reviewed)).find(
      (p) => p.state === "open",
    );
    if (!open) return log(`No open pull request has ${reviewed}.`);
    number = open.number;
  } else {
    number = event.pull_request.number;
  }
  const pr = await pulls.get(number);
  const sha: string = pr.head.sha;

  const { labels } = pr;
  const comments = await pulls.comments(pr.number);
  const reviewOff = o.reviewOn === false;
  const runConclusion: string | undefined =
    eventName === "workflow_run" && !reviewOff
      ? ((await o.reviewConclusion?.(event.workflow_run.id)) ??
        event.workflow_run.conclusion)
      : undefined;
  if (
    eventName === "workflow_run" &&
    !reviewOff &&
    !reviewIsAboutHead(
      event.workflow_run.head_sha,
      sha,
      verdictIn(comments, sha),
      runConclusion,
    )
  ) {
    return log(`${sha} is waiting for its own review.`);
  }
  const isDependabot = await onlyDependabot(pulls, pr, sha, log);
  const hasOverride = labels.includes(override);
  let overrideBy: string | null = null;
  let overrideByApprover: boolean | undefined;
  let lookupFailure: unknown;
  if (
    hasOverride &&
    !isDependabot &&
    !reviewOff &&
    event.action !== "synchronize"
  )
    try {
      overrideBy = await pulls.labeledBy(pr.number, override);
      if (overrideBy === null)
        throw new Error(
          `The code host does not say who added \`${override}\`.`,
        );
      overrideByApprover = await pulls.canWrite(overrideBy);
    } catch (error) {
      lookupFailure = error ?? new Error("The access lookup failed.");
    }
  const decision = decide({
    event: eventName,
    action: event.action,
    label: event.label?.name,
    override,
    isDependabot,
    isDraft: pr.isDraft,
    hasOverride,
    overrideByApprover,
    overrideUnchecked: lookupFailure !== undefined,
    runConclusion,
    reviewOff,
    verdict: verdictIn(comments, sha),
  });
  if (!decision) return log("Nothing to post.");

  await pulls.setStatus(sha, {
    state: decision.state,
    name: CONTEXT,
    description: decision.description,
    link: o.link,
  });
  log(`${CONTEXT} on ${sha}: ${decision.state}, ${decision.description}`);

  if (decision.removeOverride) await pulls.removeLabel(pr.number, override);
  if (decision.explainRemoval === "not an approver")
    await pulls.comment(
      pr.number,
      `Removed \`${override}\`: @${overrideBy} cannot write to this repository, and only an account that can may pass the verdict.`,
    );
  if (decision.explainRemoval === "could not check") {
    await pulls.comment(
      pr.number,
      overrideBy === null
        ? `Removed \`${override}\`: could not check who added it, and only an account that can write to this repository may pass the verdict. Add the label again to retry.`
        : `Removed \`${override}\`: could not check whether @${overrideBy} can write to this repository. Add the label again to retry.`,
    );
    throw lookupFailure;
  }
  if (decision.announceOverride) {
    const open = await pulls.openThreadCount(pr.number);
    await pulls.comment(
      pr.number,
      `\`${CONTEXT}\` overridden by @${overrideBy} at ${sha.slice(0, 7)}. ` +
        `${open} review thread(s) still open; each must be resolved before this can merge. ` +
        `A new push removes the override.`,
    );
  }
}

// Only run as a CLI. Importing this module for tests must not call GitHub.
/** `factory review verdict`. */
export async function run(): Promise<number> {
  const repo = process.env.GITHUB_REPOSITORY!;
  try {
    const settings = await loadSettings();
    const runner = openRunner(repo);
    await apply({
      eventName: process.env.GITHUB_EVENT_NAME as Input["event"],
      event: JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH!, "utf8")),
      pulls: openCodeHost(repo),
      link: runner.thisRun(process.env)?.page,
      log: (line) => console.log(line),
      override: settings.codeHost.labels["verdict-override"],
      reviewOn: settings.prReview !== null,
      reviewConclusion: (run) => runner.reviewConclusion(run),
    });
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
