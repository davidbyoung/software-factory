#!/usr/bin/env node
// Post the "Review verdict" commit status.
//
//   kodor review verdict    # reads GITHUB_EVENT_NAME and _PATH
//   kodor review verdict --pr N   # again, for a pull request
//
// It is posted on two occasions: a review ending, by the review's own run
// (`review-record.mts`), and an event of the pull request itself
// (pull_request_target: opened, pushed to, marked ready, given another base
// branch, or labeled with the override), by this command, from main's copy. What the review found is
// what its run says as it ends, and after that the status the run set on
// the commit, never a comment.
// The verdict is posted on one commit, so a new push always starts without
// one.
import { loadSettings } from "./config.mts";
import { PR_LABELS } from "./labels.mts";
import { readFileSync } from "node:fs";
import { openCodeHost } from "./code-host/index.mts";
import type {
  CodeHost,
  CommitStatus,
  PullComment,
} from "./code-host/types.mts";
import { NotFoundError } from "./tickets/types.mts";
import { CI_BOT } from "./lib/work-status.mts";
import { openRunner } from "./runner/index.mts";
import { liveOrder, ORDER, type Order } from "./merge-order.mts";
import * as say from "./lib/output.mts";

// The status's name, which the main ruleset requires by exactly this text.
export const CONTEXT = "Review verdict";
/** The status a review's run sets on the commit it reviewed. */
export const REVIEW = "Automated review";
/** The override's name when the settings give it no other. */
export const OVERRIDE = PR_LABELS["verdict-override"];
/** How the override looks where kodor creates it. */
const OVERRIDE_LOOK = {
  color: "b60205",
  description:
    "Passes Review verdict for the current commit; a push removes it",
};

export type Verdict = "ready" | "changes" | null;

export type Input = {
  event: "review" | "pull_request_target";
  /** pull_request_target's action, such as synchronize or labeled. */
  action?: string;
  /** An edited action changed the base branch. */
  baseChanged?: boolean;
  /** The label added or removed, on a labeled or unlabeled action. */
  label?: string;
  /** The override's name, as `code-host.labels` gives it. */
  override?: string;
  /** Dependabot opened it, and the code host verifies every commit on it
   * as Dependabot's. */
  isDependabot: boolean;
  isDraft: boolean;
  /** The override label is on the pull request. */
  hasOverride: boolean;
  /** The override was given on this commit: the labeled event names it, or
   * the newest record of one does. A push's run takes the label off only
   * after the push, so the label alone can sit on an unread commit. */
  overrideOnHead?: boolean;
  /** The account the code host says added the override can write to the
   * repository. Agents act through such accounts too; the guard hook stops
   * them on a person's laptop. This stops everyone else. */
  overrideByApprover?: boolean;
  /** The code host could not say who added it, or whether they can write. */
  overrideUnchecked?: boolean;
  /** How the review ended: success, failure, cancelled, or skipped. */
  conclusion?: string;
  /** The settings turn the automated review off, so none is coming. */
  reviewOff?: boolean;
  /** What the review found, as its run or its status on this commit says;
   * null with neither. */
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
  if (input.event === "review") {
    if (input.conclusion === "skipped") {
      return input.isDraft
        ? DRAFT
        : { state: "pending", description: "The review did not run" };
    }
    if (input.conclusion !== "success") {
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
  if (input.action === "edited" && !input.baseChanged) return null;
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
  if (input.action === "synchronize" || input.action === "edited") {
    // The approver overrode the change they read: a new commit, or this one
    // against another base, is unread.
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
  const overridden = input.hasOverride && input.overrideOnHead === true;
  if (input.event === "review" && overridden) return null;
  switch (input.action) {
    case "labeled":
      if (input.label !== (input.override ?? OVERRIDE)) return null;
      return overridden
        ? { ...OVERRIDDEN, announceOverride: true }
        : withoutOverride(input);
    case "unlabeled":
      return input.label === (input.override ?? OVERRIDE)
        ? withoutOverride(input)
        : null;
    default:
      return overridden ? OVERRIDDEN : withoutOverride(input);
  }
}

/** The commit an override was given on, in the announcement that records
 * it. */
const recordOf = (sha: string) => `<!-- verdict-override: ${sha} -->`;
const RECORD = /<!-- verdict-override: ([0-9a-f]+) -->/;

/** The commit the newest override's record names, among the workflow's own
 * comments, or null. */
export function overriddenAt(comments: PullComment[]): string | null {
  const record = comments
    .filter((c) => c.author === CI_BOT)
    .map((c) => RECORD.exec(c.body)?.[1])
    .filter((sha) => sha !== undefined)
    .at(-1);
  return record ?? null;
}

/** What the review's own run says of the commit whose statuses these are.
 * Anyone who can write to the repository can set a status, so only the
 * workflow's account's counts. */
export function verdictIn(statuses: CommitStatus[]): Verdict {
  const status = statuses.find((s) => s.name === REVIEW && s.author === CI_BOT);
  if (!status || status.state === "pending") return null;
  return status.state === "success" ? "ready" : "changes";
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

export type VerdictEvent =
  /** The event as GitHub sends it. */
  | { eventName: "pull_request_target"; event: any }
  /** Another repository's pull request changed what this one waits for. */
  | { eventName: "order"; event: { pull: number } }
  /** A review of the commit `sha` ended. */
  | {
      eventName: "review";
      event: {
        pull: number;
        sha: string;
        conclusion: string;
        /** What the review found. Its own run says: a status read back just
         * after it is set can be missing. */
        verdict: Verdict;
      };
    };

/** Posts the verdict for one event, removes or announces the override,
 * and says why it removed one. When the code host cannot say who added the
 * override, or whether they can write, it removes the label, then rejects
 * with the reason. */
export async function apply(
  o: VerdictEvent & {
    pulls: CodeHost;
    /** The page of the run posting the status. */
    link?: string;
    log: (line: string) => void;
    /** The override's name, as `code-host.labels` gives it. */
    override?: string;
    /** False where the settings turn the automated review off. */
    reviewOn?: boolean;
    /** What a pull request with this body waits for, or null when it is
     * part of no ticket across repositories. */
    order?: (body: string) => Promise<Order | null>;
  },
): Promise<void> {
  const { pulls, log } = o;
  const override = o.override ?? OVERRIDE;
  const review = o.eventName === "review" ? o.event : null;
  const event = o.eventName === "pull_request_target" ? o.event : {};

  // Read the pull request as it is now. The event's copy can be stale: a
  // "marked ready" event sent just after a push carries the previous commit.
  const pr = await pulls.get(
    o.eventName === "pull_request_target"
      ? event.pull_request.number
      : o.event.pull,
  );
  const sha: string = pr.head.sha;
  if (review && pr.state !== "open") return log(`#${pr.number} is not open.`);
  if (review && review.sha !== sha)
    return log(`${sha} is waiting for its own review.`);

  if (o.eventName === "order" && pr.state !== "open")
    return log(`#${pr.number} is not open.`);

  // One from a fork is part of no ticket's order, whatever it says.
  const own = pr.head.repository === pr.base.repository;
  const order = o.order && own ? await o.order(pr.body) : null;
  if (order) {
    await pulls.setStatus(sha, { ...order, name: ORDER, link: o.link });
    log(`${ORDER} on ${sha}: ${order.state}, ${order.description}`);
  }

  const { labels } = pr;
  const reviewOff = o.reviewOn === false;
  const isDependabot = await onlyDependabot(pulls, pr, sha, log);
  const labeled = event.action === "labeled" && event.label?.name === override;
  // The approver read the commit their event names, not one pushed since.
  if (labeled && !reviewOff && !isDependabot) {
    const seen: string = event.pull_request.head?.sha ?? "";
    if (seen !== sha) {
      try {
        await pulls.removeLabel(pr.number, override);
      } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;
      }
      await pulls.comment(
        pr.number,
        `Removed \`${override}\`: a newer commit, \`${sha.slice(0, 7)}\`, is unread. Add it again once its review has run.`,
      );
      return log(
        `The override names ${seen.slice(0, 7)}, and ${sha} is the head: nothing to post.`,
      );
    }
  }
  const hasOverride = labels.includes(override);
  let overrideBy: string | null = null;
  let overrideByApprover: boolean | undefined;
  let lookupFailure: unknown;
  if (
    hasOverride &&
    !isDependabot &&
    !reviewOff &&
    event.action !== "synchronize" &&
    event.action !== "edited"
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
  const overrideOnHead =
    labeled ||
    (overrideByApprover === true &&
      overriddenAt(await pulls.comments(pr.number)) === sha);
  const decided = decide({
    event: review ? "review" : "pull_request_target",
    action: event.action,
    baseChanged: event.changes?.base !== undefined,
    label: event.label?.name,
    override,
    isDependabot,
    isDraft: pr.isDraft,
    hasOverride,
    overrideOnHead,
    overrideByApprover,
    overrideUnchecked: lookupFailure !== undefined,
    conclusion: review?.conclusion,
    reviewOff,
    verdict: review ? review.verdict : verdictIn(await pulls.statuses(sha)),
  });
  if (!decided) return log("Nothing to post.");
  // Whatever passes it, an earlier pull request merges first.
  const decision: Decision =
    decided.state === "success" && order?.state === "pending"
      ? { ...decided, ...order }
      : decided;

  // The record first: a pass with none would not outlive the next event.
  if (decision.announceOverride) {
    const open = await pulls.openThreadCount(pr.number);
    await pulls.comment(
      pr.number,
      `\`${CONTEXT}\` overridden by @${overrideBy} at ${sha.slice(0, 7)}. ` +
        `${open} review thread(s) still open; each must be resolved before this can merge. ` +
        `A new push, or a change of the base branch, removes the override.\n${recordOf(sha)}`,
    );
  }

  await pulls.setStatus(sha, {
    state: decision.state,
    name: CONTEXT,
    description: decision.description,
    link: o.link,
  });
  log(`${CONTEXT} on ${sha}: ${decision.state}, ${decision.description}`);

  // Only a person adds the override, so no adding of it creates the label.
  if (!review && !reviewOff)
    try {
      await pulls.ensureLabel(override, OVERRIDE_LOOK);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      log(`Could not create the label ${override}: ${reason}`);
    }

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
}

// Only run as a CLI. Importing this module for tests must not call GitHub.
/** `kodor review verdict`. */
export async function run(argv: string[] = []): Promise<number> {
  const repo = process.env.GITHUB_REPOSITORY!;
  try {
    const eventName = process.env.GITHUB_EVENT_NAME;
    const again = argv[0] === "--pr" ? Number(argv[1]) : null;
    if (again !== null && !(Number.isInteger(again) && again > 0))
      throw new Error("Usage: kodor review verdict [--pr N]");
    if (again === null && eventName !== "pull_request_target")
      throw new Error(
        `kodor review verdict reads pull_request_target, not ${eventName}: a review's run posts its own verdict.`,
      );
    const settings = await loadSettings();
    await apply({
      ...(again === null
        ? {
            eventName: "pull_request_target" as const,
            event: JSON.parse(
              readFileSync(process.env.GITHUB_EVENT_PATH!, "utf8"),
            ),
          }
        : { eventName: "order" as const, event: { pull: again } }),
      order: (body) => liveOrder(body, (line) => say.plain(line)),
      pulls: openCodeHost(repo),
      link: openRunner(repo).thisRun(process.env)?.page,
      log: say.plainPrinter(),
      override: settings.codeHost.labels["verdict-override"],
      reviewOn: settings.prReview,
    });
    return 0;
  } catch (error) {
    say.plainError(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
