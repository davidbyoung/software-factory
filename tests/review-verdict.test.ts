import { describe, it, expect } from "vitest";
import { memoryCodeHost, type MemoryCodeHostOptions } from "./memory-code-host";
import { afterEach, vi } from "vitest";
import {
  apply,
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

  it("passes and announces when an approver adds the override", () => {
    expect(
      pr({
        action: "labeled",
        label: "verdict: override",
        senderIsApprover: true,
      }),
    ).toEqual({
      state: "success",
      description: "Overridden by an approver",
      announceOverride: true,
    });
  });

  it("ignores the label's old name, as it does any other label", () => {
    expect(
      pr({
        action: "labeled",
        label: "verdict: owner override",
        senderIsApprover: true,
      }),
    ).toBeNull();
  });

  it("removes an override anyone else adds, keeps the review's verdict, and says why", () => {
    expect(
      pr({
        action: "labeled",
        label: "verdict: override",
        senderIsApprover: false,
        verdict: "changes",
      }),
    ).toEqual({
      state: "failure",
      description: "The review asked for changes",
      removeOverride: true,
      explainRemoval: "not an approver",
    });
  });

  it("removes an override when who added it cannot be checked, and says so", () => {
    expect(
      pr({
        action: "labeled",
        label: "verdict: override",
        senderIsApprover: false,
        senderUnchecked: true,
      }),
    ).toEqual({
      state: "pending",
      description: "Waiting for the review of this commit",
      removeOverride: true,
      explainRemoval: "could not check",
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

// The event as GitHub sends it, applied to a pull request in an
// organization's repository, where the name before the slash is nobody's
// login.
describe("apply", () => {
  afterEach(() => vi.restoreAllMocks());
  const HEAD = "4c1d2ab0000";
  const SUMMARY = {
    id: 1,
    author: "github-actions[bot]",
    body: `Review.\n<!-- claude-review sha=${HEAD} -->\n<!-- review-verdict: changes -->`,
    createdAt: "2026-11-22T15:00:00Z",
  };
  const setUp = (
    options: MemoryCodeHostOptions = {},
    labels = ["verdict: override"],
  ) => {
    const host = memoryCodeHost(
      [
        {
          number: 31,
          labels,
          head: { sha: HEAD, branch: "28", repository: "acme/x" },
          comments: [SUMMARY],
          threads: [],
        },
      ],
      { writers: ["alice", "dana"], ...options },
    );
    const log: string[] = [];
    const go = (action: string, sender: string) =>
      apply({
        eventName: "pull_request_target",
        event: {
          action,
          label: { name: "verdict: override" },
          sender: { login: sender },
          repository: { owner: { login: "acme" } },
          pull_request: { number: 31 },
        },
        pulls: host.codeHost,
        log: (line) => void log.push(line),
      });
    return { host, log, go };
  };
  const comments = (host: ReturnType<typeof memoryCodeHost>) =>
    host
      .pull(31)
      .comments.slice(1)
      .map((c) => c.body);

  it("passes the verdict when an approver adds the override", async () => {
    const { host, log, go } = setUp();

    await go("labeled", "alice");
    expect(log).toContain(
      `Review verdict on ${HEAD}: success, Overridden by an approver`,
    );
    expect(host.pull(31).labels).toEqual(["verdict: override"]);
    expect(comments(host)).toEqual([
      "`Review verdict` overridden by @alice at 4c1d2ab. 0 review thread(s) still open; each must be resolved before this can merge. A new push removes the override.",
    ]);
  });

  it("passes it for a second approver after a push removed the first's", async () => {
    const { host, log, go } = setUp();

    await go("labeled", "alice");
    await go("synchronize", "acme-builds");
    expect(host.pull(31).labels).toEqual([]);
    host.change(31, { labels: ["verdict: override"] });
    await go("labeled", "dana");
    expect(log.at(-1)).toBe(
      `Review verdict on ${HEAD}: success, Overridden by an approver`,
    );
    expect(comments(host).at(-1)).toMatch(
      /^`Review verdict` overridden by @dana /,
    );
  });

  it("removes an override from an account that cannot write, keeps the review's verdict, and says why", async () => {
    const { host, log, go } = setUp();

    await go("labeled", "bob");
    expect(log).toContain(
      `Review verdict on ${HEAD}: failure, The review asked for changes`,
    );
    expect(host.pull(31).labels).toEqual([]);
    expect(comments(host)).toEqual([
      "Removed `verdict: override`: @bob cannot write to this repository, and only an account that can may pass the verdict.",
    ]);
  });

  it("removes the override, says so, and fails when the code host cannot say who can write", async () => {
    const { host, log, go } = setUp({
      fail: { canWrite: new Error("gh: Server Error (HTTP 500)") },
    });

    await expect(go("labeled", "bob")).rejects.toThrow(
      "gh: Server Error (HTTP 500)",
    );
    expect(log).toContain(
      `Review verdict on ${HEAD}: failure, The review asked for changes`,
    );
    expect(host.pull(31).labels).toEqual([]);
    expect(comments(host)).toEqual([
      "Removed `verdict: override`: could not check whether @bob can write to this repository. Add the label again to retry.",
    ]);
  });

  it("asks who can write only for the override label", async () => {
    const { host, go } = setUp({}, []);

    await go("synchronize", "bob");
    expect(host.log.filter((l) => l.startsWith("canWrite"))).toEqual([]);
  });

  it("refuses an override from an account the ticket system lets decide but the code host does not let write", async () => {
    const { host, go } = setUp({ writers: ["dev"] });

    await go("labeled", "pm");
    expect(host.pull(31).labels).toEqual([]);
  });
});
