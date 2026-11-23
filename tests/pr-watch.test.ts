import { describe, it, expect } from "vitest";
import {
  isPermanentFailure,
  newEvents,
  toChecks,
  watchMarkNeedsRenewing,
  withWatchMark,
  withoutWatchMark,
  type Check,
  type Comment,
  type Snapshot,
} from "../src/pr-watch.mts";

const SHA = "abc123";
const BOT = "github-actions[bot]";
const check = (over: Partial<Check> = {}): Check => ({
  id: 1,
  name: "Tests",
  state: "passed",
  ...over,
});
const comment = (over: Partial<Comment> = {}): Comment => ({
  id: 1,
  author: "owner",
  where: "a.ts:3",
  body: "Fix this.",
  ...over,
});
const summary = (id: number, sha: string, verdict: string) =>
  comment({
    id,
    author: BOT,
    body: `Text.\n<!-- review-verdict: ${verdict} -->\n<!-- claude-review sha=${sha} -->`,
  });
const snapshot = (over: Partial<Snapshot> = {}): Snapshot => ({
  state: "open",
  merged: false,
  headSha: SHA,
  mergeableState: "clean",
  checks: [check({ state: "pending" })],
  conversation: [],
  comments: [],
  reviews: [],
  ...over,
});
const lines = (over: Partial<Snapshot>, seen = new Set<string>()) =>
  newEvents(snapshot(over), seen, "main").map((event) => event.line);
const keysOf = (over: Partial<Snapshot>) =>
  new Set(
    newEvents(snapshot(over), new Set(), "main").map((event) => event.key),
  );

describe("newEvents", () => {
  it("has nothing to say while checks run and nobody has commented", () => {
    expect(lines({})).toEqual([]);
  });

  it("reports a failed check while others are still running", () => {
    expect(
      lines({
        checks: [
          check({ state: "failed", url: "https://ci/1" }),
          check({ id: 2, name: "End-to-end", state: "pending" }),
        ],
      }),
    ).toEqual(["check failed: Tests https://ci/1"]);
  });

  it("reports a failed run once, and again when a re-run fails", () => {
    const failed = { checks: [check({ state: "failed" })] };
    const seen = keysOf(failed);

    expect(lines(failed, seen)).toEqual([]);
    expect(
      lines({ checks: [check({ id: 2, state: "failed" })] }, seen),
    ).toEqual(["check failed: Tests"]);
  });

  it("reports the head commit's review with its verdict, not an older one", () => {
    expect(lines({ conversation: [summary(1, "old", "ready")] })).toEqual([]);
    expect(lines({ conversation: [summary(1, SHA, "changes")] })).toEqual([
      `review of ${SHA}: changes`,
    ]);
  });

  it("reports a re-run review of the same commit, with the new verdict", () => {
    const first = { conversation: [summary(1, SHA, "changes")] };
    const seen = keysOf(first);

    expect(lines(first, seen)).toEqual([]);
    expect(
      lines(
        {
          conversation: [summary(1, SHA, "changes"), summary(2, SHA, "ready")],
        },
        seen,
      ),
    ).toEqual([`review of ${SHA}: ready`]);
  });

  it("takes a review summary only from the reviewer", () => {
    const quoted = { ...summary(1, SHA, "ready"), author: "owner" };

    expect(lines({ conversation: [quoted] })).toEqual([]);
  });

  it("reports someone else's comment once, and not the session's own reply", () => {
    const comments = [
      comment({ id: 1 }),
      comment({ id: 2, body: "Fixed.\n\n<!-- agent -->" }),
    ];
    const seen = keysOf({ comments });

    expect(lines({ comments })).toEqual(["comment 1 by owner on a.ts:3"]);
    expect(lines({ comments }, seen)).toEqual([]);
  });

  it("reports a second comment on the same line", () => {
    const seen = keysOf({ comments: [comment({ id: 1 })] });

    expect(lines({ comments: [comment({ id: 2 })] }, seen)).toEqual([
      "comment 2 by owner on a.ts:3",
    ]);
  });

  it("reports a comment again when it is edited", () => {
    const seen = keysOf({ comments: [comment()] });

    expect(lines({ comments: [comment({ body: "Other." })] }, seen)).toEqual([
      "comment 1 by owner on a.ts:3",
    ]);
  });

  it("holds the reviewer's comments until its run ends, but not the owner's", () => {
    const comments = [
      comment({ id: 1, author: BOT }),
      comment({ id: 2, author: "owner" }),
    ];
    const running = [
      check({ name: "review / Claude review", state: "pending" }),
    ];
    const ended = [check({ name: "review / Claude review", state: "passed" })];

    expect(lines({ comments, checks: running })).toEqual([
      "comment 2 by owner on a.ts:3",
    ]);
    expect(lines({ comments, checks: ended })).toContain(
      `comment 1 by ${BOT} on a.ts:3`,
    );
  });

  it("reports a review's body, and not an empty, blank, or marked one", () => {
    const reviews = [
      comment({ id: 7, body: "Rename it." }),
      comment({ id: 8, body: "" }),
      comment({ id: 9, body: "   \n" }),
      comment({ id: 10, body: "Done.\n\n<!-- agent -->" }),
    ];

    expect(lines({ reviews })).toEqual(["review body 7 by owner"]);
  });

  it("reports a second review's body, and an edited one", () => {
    const seen = keysOf({ reviews: [comment({ id: 7 })] });

    expect(lines({ reviews: [comment({ id: 7 })] }, seen)).toEqual([]);
    expect(lines({ reviews: [comment({ id: 8 })] }, seen)).toEqual([
      "review body 8 by owner",
    ]);
    expect(
      lines({ reviews: [comment({ id: 7, body: "Other." })] }, seen),
    ).toEqual(["review body 7 by owner"]);
  });

  it("reports a conflict once per commit", () => {
    const dirty = { mergeableState: "dirty" };
    const seen = keysOf(dirty);

    expect(lines(dirty)).toEqual([`conflict with main at ${SHA}`]);
    expect(lines(dirty, seen)).toEqual([]);
    expect(lines({ ...dirty, headSha: "def456" }, seen)).toEqual([
      "conflict with main at def456",
    ]);
  });

  it("names the default branch in a conflict's line, whatever it is called", () => {
    const dirty = snapshot({ mergeableState: "dirty" });

    expect(newEvents(dirty, new Set(), "develop").map((e) => e.line)).toEqual([
      `conflict with develop at ${SHA}`,
    ]);
  });

  it("says every check has finished only once the review is in", () => {
    const checks = [check()];

    expect(lines({ checks })).toEqual([]);
    expect(lines({ checks, conversation: [summary(1, SHA, "ready")] })).toEqual(
      [`review of ${SHA}: ready`, `every check has finished on ${SHA}`],
    );
  });

  it("says so again when a re-run finishes, not otherwise", () => {
    const conversation = [summary(1, SHA, "ready")];
    const seen = keysOf({ checks: [check()], conversation });

    expect(lines({ checks: [check()], conversation }, seen)).toEqual([]);
    expect(lines({ checks: [check({ id: 2 })], conversation }, seen)).toEqual([
      `every check has finished on ${SHA}`,
    ]);
  });

  it("waits for no review where the automated review is off", () => {
    expect(lines({ checks: [check()], reviewOn: false })).toEqual([
      `every check has finished on ${SHA}`,
    ]);
  });

  it("stops waiting for a review whose run failed and posted nothing", () => {
    const checks = [check({ name: "review / Claude review", state: "failed" })];

    expect(lines({ checks })).toContain(`every check has finished on ${SHA}`);
  });

  it("does not call an empty list of checks finished", () => {
    expect(
      lines({ checks: [], conversation: [summary(1, SHA, "ready")] }),
    ).toEqual([`review of ${SHA}: ready`]);
  });

  it("reports only that a pull request ended, whatever else is open", () => {
    const failing = [check({ state: "failed" })];

    expect(lines({ merged: true, state: "closed", checks: failing })).toEqual([
      "merged",
    ]);
    expect(lines({ state: "closed", checks: failing })).toEqual(["closed"]);
  });
});

describe("toChecks", () => {
  it("reads check runs and commit statuses alike", () => {
    const run = (
      name: string,
      conclusion: string | null,
      status = "completed",
    ) => ({
      id: 1,
      name,
      status,
      conclusion,
    });
    const commitStatus = (name: string, state: string) => ({
      id: 2,
      name,
      state,
    });

    expect(
      toChecks(
        [
          run("running", null, "in_progress"),
          run("success", "success"),
          run("skipped", "skipped"),
          run("neutral", "neutral"),
          run("failure", "failure"),
          run("timed_out", "timed_out"),
          run("cancelled", "cancelled"),
          run("startup_failure", "startup_failure"),
          run("action_required", "action_required"),
        ],
        [
          commitStatus("waiting", "pending"),
          commitStatus("good", "success"),
          commitStatus("red", "failure"),
          commitStatus("broken", "error"),
        ],
      ).map((one) => `${one.name}:${one.state}`),
    ).toEqual([
      "running:pending",
      "success:passed",
      "skipped:passed",
      "neutral:passed",
      "failure:failed",
      "timed_out:failed",
      "cancelled:failed",
      "startup_failure:failed",
      "action_required:failed",
      "waiting:pending",
      "good:passed",
      "red:failed",
      "broken:failed",
    ]);
  });

  it("keeps each one's id and link", () => {
    expect(
      toChecks(
        [
          {
            id: 5,
            name: "run",
            status: "completed",
            conclusion: "failure",
            link: "https://ci/run",
          },
        ],
        [
          {
            id: 6,
            name: "status",
            state: "failure",
            link: "https://ci/status",
          },
        ],
      ),
    ).toEqual([
      { id: 5, name: "run", state: "failed", url: "https://ci/run" },
      { id: 6, name: "status", state: "failed", url: "https://ci/status" },
    ]);
  });
});

describe("isPermanentFailure", () => {
  it("gives up on an expired login or a missing pull request", () => {
    expect(
      isPermanentFailure(new Error("gh: Bad credentials (HTTP 401)")),
    ).toBe(true);
    expect(isPermanentFailure(new Error("gh: Not Found (HTTP 404)"))).toBe(
      true,
    );
  });

  it("keeps trying through a rate limit, a server error, or no network", () => {
    expect(isPermanentFailure(new Error("gh: rate limit (HTTP 403)"))).toBe(
      false,
    );
    expect(isPermanentFailure(new Error("gh: Bad Gateway (HTTP 502)"))).toBe(
      false,
    );
    expect(isPermanentFailure(new Error("dial tcp: no route to host"))).toBe(
      false,
    );
  });
});

describe("the watch mark", () => {
  const now = new Date("2026-11-05T12:00:00.000Z");
  const minutesLater = (minutes: number) =>
    new Date(now.getTime() + minutes * 60 * 1000);

  it("is replaced rather than added to, and leaves the body as it was", () => {
    const once = withWatchMark("Closes #1", now);
    const twice = withWatchMark(once, minutesLater(20));

    expect(twice.match(/session-watching/g)).toHaveLength(1);
    expect(twice).toContain(minutesLater(20).toISOString());
    expect(withoutWatchMark(twice)).toBe("Closes #1");
  });

  it("is renewed only after 15 minutes", () => {
    const body = withWatchMark("Closes #1", now);

    expect(watchMarkNeedsRenewing("Closes #1", now)).toBe(true);
    expect(watchMarkNeedsRenewing(body, minutesLater(14))).toBe(false);
    expect(watchMarkNeedsRenewing(body, minutesLater(15))).toBe(true);
  });

  it("is renewed when its time cannot be read", () => {
    expect(
      watchMarkNeedsRenewing("<!-- session-watching: nonsense -->", now),
    ).toBe(true);
  });
});
