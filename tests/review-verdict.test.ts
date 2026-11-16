import { describe, it, expect } from "vitest";
import {
  decide,
  reviewIsAboutHead,
  verdictIn,
  type Input,
} from "../src/review-verdict.mts";

const base: Input = {
  event: "workflow_run",
  isDependabot: false,
  isDraft: false,
  hasOverride: false,
  runConclusion: "success",
  verdict: null,
};
const on = (overrides: Partial<Input>) => decide({ ...base, ...overrides });

describe("decide, when the review finishes", () => {
  it("passes a commit the review found ready", () => {
    expect(on({ verdict: "ready" })?.state).toBe("success");
  });

  it("fails a commit the review asked changes for", () => {
    expect(on({ verdict: "changes" })?.state).toBe("failure");
  });

  it("fails a commit whose review posted no verdict", () => {
    expect(on({ verdict: null })).toEqual({
      state: "failure",
      description: "The review posted no verdict",
    });
  });

  it("fails a commit whose review did not finish, whatever it said", () => {
    expect(on({ runConclusion: "cancelled", verdict: "ready" })?.state).toBe(
      "failure",
    );
  });

  it("leaves a draft pending when the review was skipped", () => {
    expect(on({ runConclusion: "skipped", isDraft: true })).toEqual({
      state: "pending",
      description: "Draft: no review until it is marked ready",
    });
  });

  it("does not overwrite the owner's override", () => {
    expect(on({ hasOverride: true, verdict: "changes" })).toBeNull();
  });

  it("passes Dependabot without a review", () => {
    expect(
      on({ isDependabot: true, runConclusion: "skipped", verdict: null })
        ?.state,
    ).toBe("success");
  });
});

describe("decide, on the pull request's own events", () => {
  const pr = (overrides: Partial<Input>) =>
    on({
      event: "pull_request_target",
      runConclusion: undefined,
      ...overrides,
    });

  it("starts a pushed commit pending, without carrying a verdict over", () => {
    expect(pr({ action: "synchronize", verdict: "ready" })).toEqual({
      state: "pending",
      description: "Waiting for the review of this commit",
      removeOverride: false,
    });
  });

  it("removes the override when a new commit is pushed", () => {
    expect(
      pr({ action: "synchronize", hasOverride: true })?.removeOverride,
    ).toBe(true);
  });

  it("passes and announces when the owner adds the override", () => {
    expect(
      pr({
        action: "labeled",
        label: "verdict: override",
        senderIsOwner: true,
      }),
    ).toEqual({
      state: "success",
      description: "Overridden by the owner",
      announceOverride: true,
    });
  });

  it("ignores the label's old name, as it does any other label", () => {
    expect(
      pr({
        action: "labeled",
        label: "verdict: owner override",
        senderIsOwner: true,
      }),
    ).toBeNull();
  });

  it("removes an override anyone else adds, and keeps the review's verdict", () => {
    expect(
      pr({
        action: "labeled",
        label: "verdict: override",
        senderIsOwner: false,
        verdict: "changes",
      }),
    ).toEqual({
      state: "failure",
      description: "The review asked for changes",
      removeOverride: true,
    });
  });

  it("ignores other labels", () => {
    expect(pr({ action: "labeled", label: "merge: automatic" })).toBeNull();
    expect(pr({ action: "unlabeled", label: "merge: automatic" })).toBeNull();
  });

  it("returns to the review's verdict when the override is removed", () => {
    expect(
      pr({
        action: "unlabeled",
        label: "verdict: override",
        verdict: "changes",
      })?.state,
    ).toBe("failure");
    expect(
      pr({
        action: "unlabeled",
        label: "verdict: override",
        verdict: null,
      })?.state,
    ).toBe("pending");
  });

  it("keeps a draft pending when it is opened", () => {
    expect(pr({ action: "opened", isDraft: true })?.description).toBe(
      "Draft: no review until it is marked ready",
    );
  });

  it("waits for the review when a pull request is marked ready", () => {
    expect(pr({ action: "ready_for_review" })).toEqual({
      state: "pending",
      description: "Waiting for the review of this commit",
    });
  });

  it("keeps the verdict of an unchanged head when it is reopened", () => {
    expect(pr({ action: "reopened", verdict: "ready" })?.state).toBe("success");
  });

  it("passes Dependabot on its own pushes too", () => {
    expect(pr({ action: "synchronize", isDependabot: true })?.state).toBe(
      "success",
    );
  });

  it("keeps an override when a labeled pull request is reopened", () => {
    expect(pr({ action: "reopened", hasOverride: true })?.state).toBe(
      "success",
    );
  });
});

describe("verdictIn", () => {
  const bot = "github-actions[bot]";
  const summary = (sha: string, verdict: string) => ({
    author: bot,
    body: `Ready.\n\n<!-- review-verdict: ${verdict} -->\n<!-- claude-review sha=${sha} -->`,
  });

  it("reads the marker from the last summary for that commit", () => {
    expect(
      verdictIn([summary("aaa", "changes"), summary("aaa", "ready")], "aaa"),
    ).toBe("ready");
  });

  it("ignores summaries of other commits", () => {
    expect(verdictIn([summary("aaa", "ready")], "bbb")).toBeNull();
  });

  it("ignores a marker posted by anyone but the review bot", () => {
    expect(
      verdictIn([{ ...summary("aaa", "ready"), author: "someone" }], "aaa"),
    ).toBeNull();
  });

  it("is null when the summary has no marker", () => {
    expect(
      verdictIn(
        [{ author: bot, body: "Ready.\n<!-- claude-review sha=aaa -->" }],
        "aaa",
      ),
    ).toBeNull();
  });
});

describe("reviewIsAboutHead", () => {
  it("lets a review of the head set the head's verdict", () => {
    expect(reviewIsAboutHead("bbb", "bbb", null)).toBe(true);
  });

  it("lets a review started by a stale event set it, when it wrote a summary for the head", () => {
    expect(reviewIsAboutHead("aaa", "bbb", "ready", "success")).toBe(true);
  });

  it("keeps the head's own verdict when an older commit's cancelled review arrives late", () => {
    // #141: the push of the head cancelled the previous commit's review, and
    // its completion event came after the head's review had posted "ready".
    expect(reviewIsAboutHead("aaa", "bbb", "ready", "cancelled")).toBe(false);
  });

  it("keeps the head's own verdict when an older commit's failed review arrives late", () => {
    expect(reviewIsAboutHead("aaa", "bbb", "ready", "failure")).toBe(false);
    expect(reviewIsAboutHead("aaa", "bbb", "changes", "timed_out")).toBe(false);
  });

  it("leaves the head alone after a review of an older commit", () => {
    expect(reviewIsAboutHead("aaa", "bbb", null)).toBe(false);
  });

  it("lets a run that failed or timed out set the head's verdict, so it never waits on nothing", () => {
    expect(reviewIsAboutHead("aaa", "bbb", null, "failure")).toBe(true);
    expect(reviewIsAboutHead("aaa", "bbb", null, "timed_out")).toBe(true);
  });

  it("leaves the head alone after a run a newer push cancelled", () => {
    expect(reviewIsAboutHead("aaa", "bbb", null, "cancelled")).toBe(false);
  });
});
