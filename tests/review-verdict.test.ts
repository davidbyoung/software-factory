import { afterEach, describe, it, expect, vi } from "vitest";
import {
  memoryCodeHost,
  type MemoryCodeHostOptions,
  type PullSeed,
} from "./memory-code-host";
import type { CommitStatus } from "../src/code-host/types.mts";
import {
  apply,
  decide,
  REVIEW,
  run,
  verdictIn,
  type Input,
} from "../src/review-verdict.mts";

const base: Input = {
  event: "review",
  isDependabot: false,
  isDraft: false,
  hasOverride: false,
  conclusion: "success",
  verdict: null,
};
const on = (overrides: Partial<Input>) => decide({ ...base, ...overrides });

describe("decide, with the automated review off", () => {
  const OFF = { state: "success", description: "The automated review is off" };
  const off = (overrides: Partial<Input>) =>
    decide({ ...base, reviewOff: true, ...overrides });

  it.each<[string, Partial<Input>]>([
    ["the review finishing", { conclusion: "skipped" }],
    [
      "a pull request opened",
      { event: "pull_request_target", action: "opened" },
    ],
    ["a push", { event: "pull_request_target", action: "synchronize" }],
    [
      "a draft",
      { event: "pull_request_target", action: "opened", isDraft: true },
    ],
    [
      "an override on it",
      { event: "pull_request_target", action: "opened", hasOverride: true },
    ],
    [
      "the override label added",
      {
        event: "pull_request_target",
        action: "labeled",
        label: "verdict-override",
      },
    ],
  ])("passes on %s", (_, input) => {
    expect(off(input)).toEqual(OFF);
  });

  it("still says why Dependabot's pull request is not reviewed", () => {
    expect(off({ isDependabot: true })?.description).toMatch(/^Review skipped/);
  });

  it("posts nothing when another label is added", () => {
    expect(
      off({ event: "pull_request_target", action: "labeled", label: "bug" }),
    ).toBeNull();
  });
});

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
    expect(on({ conclusion: "cancelled", verdict: "ready" })?.state).toBe(
      "failure",
    );
  });

  it("leaves a draft pending when the review was skipped", () => {
    expect(on({ conclusion: "skipped", isDraft: true })).toEqual({
      state: "pending",
      description: "Draft: no review until it is marked ready",
    });
  });

  it("does not overwrite an approver's override", () => {
    expect(
      on({
        hasOverride: true,
        overrideOnHead: true,
        overrideByApprover: true,
        verdict: "changes",
      }),
    ).toBeNull();
  });

  it("removes an override no approver added, and posts what the review said", () => {
    expect(on({ hasOverride: true, verdict: "changes" })).toEqual({
      state: "failure",
      description: "The review asked for changes",
      removeOverride: true,
      explainRemoval: "not an approver",
    });
  });

  it("passes Dependabot without a review", () => {
    expect(
      on({ isDependabot: true, conclusion: "skipped", verdict: null })?.state,
    ).toBe("success");
  });
});

describe("decide, on the pull request's own events", () => {
  const pr = (overrides: Partial<Input>) =>
    on({
      event: "pull_request_target",
      conclusion: undefined,
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

  it("starts over, and removes an approver's override, when the base branch changes", () => {
    expect(
      pr({
        action: "edited",
        baseChanged: true,
        verdict: "ready",
        hasOverride: true,
        overrideOnHead: true,
        overrideByApprover: true,
      }),
    ).toEqual({
      state: "pending",
      description: "Waiting for the review of this commit",
      removeOverride: true,
    });
  });

  it("posts nothing for an edit that leaves the base branch alone", () => {
    expect(pr({ action: "edited", verdict: "ready" })).toBeNull();
    expect(on({ action: "edited", reviewOff: true })).toBeNull();
  });

  it("passes and announces when an approver adds the override", () => {
    expect(
      pr({
        action: "labeled",
        label: "verdict-override",
        hasOverride: true,
        overrideOnHead: true,
        overrideByApprover: true,
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
      }),
    ).toBeNull();
  });

  it("removes an override anyone else adds, keeps the review's verdict, and says why", () => {
    expect(
      pr({
        action: "labeled",
        label: "verdict-override",
        hasOverride: true,
        overrideByApprover: false,
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
        label: "verdict-override",
        hasOverride: true,
        overrideUnchecked: true,
      }),
    ).toEqual({
      state: "pending",
      description: "Waiting for the review of this commit",
      removeOverride: true,
      explainRemoval: "could not check",
    });
  });

  it("does not pass for an override already off the pull request", () => {
    expect(pr({ action: "labeled", label: "verdict-override" })).toEqual({
      state: "pending",
      description: "Waiting for the review of this commit",
    });
  });

  it("removes an override no approver added when any other label changes", () => {
    expect(
      pr({ action: "labeled", label: "bug", hasOverride: true }),
    ).toMatchObject({
      state: "pending",
      removeOverride: true,
      explainRemoval: "not an approver",
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
        label: "verdict-override",
        verdict: "changes",
      })?.state,
    ).toBe("failure");
    expect(
      pr({
        action: "unlabeled",
        label: "verdict-override",
        verdict: null,
      })?.state,
    ).toBe("pending");
  });

  it("returns a draft to the review's verdict when the override is removed", () => {
    expect(
      pr({
        action: "unlabeled",
        label: "verdict-override",
        isDraft: true,
        verdict: "changes",
      })?.state,
    ).toBe("failure");
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

  it("keeps an approver's override when a labeled pull request is reopened", () => {
    expect(
      pr({
        action: "reopened",
        hasOverride: true,
        overrideOnHead: true,
        overrideByApprover: true,
      }),
    ).toEqual({ state: "success", description: "Overridden by an approver" });
  });

  it("removes an override no approver added when a labeled draft is reopened", () => {
    expect(
      pr({ action: "reopened", hasOverride: true, isDraft: true }),
    ).toEqual({
      state: "pending",
      description: "Draft: no review until it is marked ready",
      removeOverride: true,
      explainRemoval: "not an approver",
    });
  });
});

describe("verdictIn", () => {
  const status = (state: string, over: Partial<CommitStatus> = {}) => ({
    id: 1,
    name: REVIEW,
    state,
    author: "github-actions[bot]",
    ...over,
  });

  it.each([
    ["success", "ready"],
    ["failure", "changes"],
    ["error", "changes"],
    ["pending", null],
  ])("reads the review's status, %s, as %s", (state, verdict) => {
    expect(verdictIn([status(state)])).toBe(verdict);
  });

  it("finds it among a commit's other statuses", () => {
    expect(
      verdictIn([status("failure", { name: "ci" }), status("success")]),
    ).toBe("ready");
  });

  it.each<[string, Partial<CommitStatus>]>([
    ["of another name", { name: "Review verdict" }],
    ["anyone else set", { author: "someone" }],
    ["nobody is said to have set", { author: undefined }],
  ])("ignores a status %s", (_, over) => {
    expect(verdictIn([status("success", over)])).toBeNull();
  });
});

// The event as GitHub sends it, applied to a pull request in an
// organization's repository, where the name before the slash is nobody's
// login.
describe("apply", () => {
  const HEAD = "4c1d2ab0000";
  // A comment never decides the verdict, whoever posted it, so the one here
  // says what the status does not.
  const SAYS = (verdict: string) => ({
    id: 1,
    author: "github-actions[bot]",
    body: `Review.\n<!-- review-verdict: ${verdict} -->\n<!-- claude-review sha=${HEAD} -->`,
    createdAt: "2026-11-22T15:00:00Z",
  });
  const reviewed = (state: string) => ({
    [HEAD]: {
      statuses: [{ id: 2, name: REVIEW, state, author: "github-actions[bot]" }],
    },
  });
  const setUp = (
    options: MemoryCodeHostOptions = {},
    labels = ["verdict-override"],
    override?: string,
    reviewOn = true,
  ) => {
    const host = memoryCodeHost(
      [
        {
          number: 31,
          labels,
          head: { sha: HEAD, branch: "28", repository: "acme/x" },
          comments: [SAYS("ready")],
          threads: [],
        },
      ],
      {
        writers: ["alice", "dana"],
        commits: reviewed("failure"),
        ...options,
      },
    );
    const log: string[] = [];
    const go = (
      action: string,
      sender: string,
      added = override ?? "verdict-override",
      seen = host.pull(31).head.sha,
    ) => {
      if (action === "labeled")
        host.change(31, { labeledBy: { [added]: sender } });
      return apply({
        eventName: "pull_request_target",
        event: {
          action,
          label: { name: added },
          sender: { login: sender },
          repository: { owner: { login: "acme" } },
          pull_request: { number: 31, head: { sha: seen } },
        },
        pulls: host.codeHost,
        log: (line) => void log.push(line),
        override,
        reviewOn,
      });
    };
    return { host, log, go };
  };
  const comments = (host: ReturnType<typeof memoryCodeHost>) =>
    host
      .pull(31)
      .comments.slice(1)
      .map((c) => c.body);

  const finished = (
    over: { reviewOn?: boolean } = {},
    conclusion = "success",
    seed: Partial<PullSeed> = {},
    options: MemoryCodeHostOptions = {},
  ) => {
    const host = memoryCodeHost(
      [
        {
          number: 31,
          labels: [],
          head: { sha: HEAD, branch: "28", repository: "acme/x" },
          comments: [SAYS("changes")],
          threads: [],
          ...seed,
        },
      ],
      { commits: reviewed("success"), ...options },
    );
    const log: string[] = [];
    const go = () =>
      apply({
        eventName: "review",
        event: { pull: 31, sha: HEAD, conclusion, verdict: "ready" },
        pulls: host.codeHost,
        log: (line) => log.push(line),
        ...over,
      });
    return { host, log, go };
  };

  it("passes a commit its review's run found ready", async () => {
    const { log, go } = finished();

    await go();
    expect(log).toEqual([
      `Review verdict on ${HEAD}: success, The review found it ready`,
    ]);
  });

  it("fails a commit whose review did not finish", async () => {
    const { log, go } = finished({}, "cancelled");

    await go();
    expect(log).toEqual([
      `Review verdict on ${HEAD}: failure, The review did not finish`,
    ]);
  });

  it.each(["success", "failure", "cancelled", "skipped"])(
    "leaves a newer commit alone after a review of the one before, which ended in %s",
    async (conclusion) => {
      const { host, log, go } = finished({}, conclusion, {
        head: { sha: "newer", branch: "28", repository: "acme/x" },
      });

      await go();
      expect(log).toEqual(["newer is waiting for its own review."]);
      expect(host.log.filter((l) => /^setStatus/.test(l))).toEqual([]);
    },
  );

  it("posts nothing on a pull request that is no longer open", async () => {
    const { host, log, go } = finished({}, "success", { state: "closed" });

    await go();
    expect(log).toEqual(["#31 is not open."]);
    expect(host.log.filter((l) => /^setStatus/.test(l))).toEqual([]);
  });

  it("passes every pull request where the automated review is off", async () => {
    const { log, go } = finished({ reviewOn: false });

    await go();
    expect(log).toEqual([
      `Review verdict on ${HEAD}: success, The automated review is off`,
    ]);
  });

  it("passes the verdict when an approver adds the override", async () => {
    const { host, log, go } = setUp();

    await go("labeled", "alice");
    expect(log).toContain(
      `Review verdict on ${HEAD}: success, Overridden by an approver`,
    );
    const writes = host.log.filter((l) => /^(comment|setStatus) /.test(l));
    expect(writes).toEqual(["comment 31", `setStatus ${HEAD} Review verdict`]);
    expect(host.pull(31).labels).toEqual(["verdict-override"]);
    expect(comments(host)).toEqual([
      `\`Review verdict\` overridden by @alice at 4c1d2ab. 0 review thread(s) still open; each must be resolved before this can merge. A new push, or a change of the base branch, removes the override.\n<!-- verdict-override: ${HEAD} -->`,
    ]);
  });

  it("passes nothing when the label's event names a commit that is no longer the head", async () => {
    const { host, log, go } = setUp();

    await go("labeled", "alice", undefined, "01d5a00000");
    expect(host.log.filter((l) => /^setStatus/.test(l))).toEqual([]);
    expect(log).toEqual([
      `The override names 01d5a00, and ${HEAD} is the head: nothing to post.`,
    ]);
    expect(host.pull(31).labels).toEqual([]);
    expect(comments(host)).toEqual([
      "Removed `verdict-override`: a newer commit, 4c1d2ab, is unread. Add it again once its review has run.",
    ]);
  });

  it("says why when the push's own run took the stale override off first", async () => {
    const { host, go } = setUp({}, []);

    await go("labeled", "alice", undefined, "01d5a00000");
    expect(host.log.filter((l) => /^setStatus/.test(l))).toEqual([]);
    expect(comments(host)).toEqual([
      "Removed `verdict-override`: a newer commit, 4c1d2ab, is unread. Add it again once its review has run.",
    ]);
  });

  it("passes it for a second approver after a push removed the first's", async () => {
    const { host, log, go } = setUp();

    await go("labeled", "alice");
    await go("synchronize", "acme-builds");
    expect(host.pull(31).labels).toEqual([]);
    host.change(31, { labels: ["verdict-override"] });
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
      "Removed `verdict-override`: @bob cannot write to this repository, and only an account that can may pass the verdict.",
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
      "Removed `verdict-override`: could not check whether @bob can write to this repository. Add the label again to retry.",
    ]);
  });

  describe("the override label in the repository", () => {
    const LOOK = {
      color: "b60205",
      description:
        "Passes Review verdict for the current commit; a push removes it",
    };

    it("is created once the status is posted, under the name the settings give", async () => {
      const { host, go } = setUp({}, [], "owner-pass");

      await go("opened", "alice");
      expect(host.settings.labels).toEqual({ "owner-pass": LOOK });
      const calls = host.log.map((l) => l.split(" ")[0]);
      expect(calls.indexOf("ensureLabel")).toBeGreaterThan(
        calls.indexOf("setStatus"),
      );
    });

    it("is not looked for where the automated review is off", async () => {
      const { host, go } = setUp({}, [], undefined, false);

      await go("opened", "alice");
      expect(host.log.join("\n")).toContain("setStatus");
      expect(host.log.join("\n")).not.toContain("ensureLabel");
    });

    it("is left to the pull request's own event when a review ends", async () => {
      const { host, go } = finished();

      await go();
      expect(host.log.join("\n")).not.toContain("ensureLabel");
    });

    it("stops nothing when it can't be created: the log says why", async () => {
      const { host, log, go } = setUp({
        fail: { ensureLabel: new Error("HTTP 403") },
      });

      await go("synchronize", "alice");
      expect(log).toEqual([
        `Review verdict on ${HEAD}: pending, Waiting for the review of this commit`,
        "Could not create the label verdict-override: HTTP 403",
      ]);
      expect(host.pull(31).labels).toEqual([]);
    });
  });

  describe("with the override renamed by the settings", () => {
    it("passes the verdict for an approver who adds the configured name", async () => {
      const { log, go } = setUp({}, ["owner-pass"], "owner-pass");

      await go("labeled", "alice");
      expect(log).toContain(
        `Review verdict on ${HEAD}: success, Overridden by an approver`,
      );
    });

    it("ignores the default name once the settings rename the override", async () => {
      const { log, go } = setUp({}, ["verdict-override"], "owner-pass");

      await go("labeled", "alice", "verdict-override");
      expect(log).toEqual(["Nothing to post."]);
    });

    it("removes the configured name from an account that cannot write, naming it", async () => {
      const { host, go } = setUp({}, ["owner-pass"], "owner-pass");

      await go("labeled", "bob");
      expect(host.pull(31).labels).toEqual([]);
      expect(comments(host)).toEqual([
        "Removed `owner-pass`: @bob cannot write to this repository, and only an account that can may pass the verdict.",
      ]);
    });

    it("names the configured label when it cannot check who added it", async () => {
      const { host, go } = setUp(
        { fail: { canWrite: new Error("gh: Server Error (HTTP 500)") } },
        ["owner-pass"],
        "owner-pass",
      );

      await expect(go("labeled", "bob")).rejects.toThrow("HTTP 500");
      expect(comments(host)).toEqual([
        "Removed `owner-pass`: could not check whether @bob can write to this repository. Add the label again to retry.",
      ]);
    });
  });

  describe("where no override could pass the verdict", () => {
    const asked = (host: ReturnType<typeof memoryCodeHost>) =>
      host.log.filter((l) => /^(canWrite|labeledBy)/.test(l));

    it.each<[string, string, string[]]>([
      ["the label is off", "reopened", []],
      ["a push takes it off", "synchronize", ["verdict-override"]],
    ])("does not ask who added it when %s", async (_, action, labels) => {
      const { host, go } = setUp({}, labels);

      await go(action, "bob");
      expect(asked(host)).toEqual([]);
    });

    it.each<[string, { reviewOn?: boolean }, Partial<PullSeed>]>([
      ["the automated review is off", { reviewOn: false }, {}],
      [
        "the pull request is Dependabot's",
        {},
        {
          author: "dependabot[bot]",
          commits: [{ sha: HEAD, verifiedAuthor: "dependabot[bot]" }],
        },
      ],
    ])("does not ask who added it when %s", async (_, over, seed) => {
      const { host, go } = finished(over, "success", {
        labels: ["verdict-override"],
        ...seed,
      });

      await go();
      expect(asked(host)).toEqual([]);
    });
  });

  describe("with the override on at an event that did not add it", () => {
    const CANNOT = (who: string) =>
      `Removed \`verdict-override\`: @${who} cannot write to this repository, and only an account that can may pass the verdict.`;

    it.each(["bob", "github-actions[bot]"])(
      "removes it on a reopened pull request when %s added it, whoever reopened it",
      async (adder) => {
        const { host, log, go } = setUp();
        host.change(31, { labeledBy: { "verdict-override": adder } });

        await go("reopened", "alice");
        expect(log).toEqual([
          `Review verdict on ${HEAD}: failure, The review asked for changes`,
        ]);
        expect(host.pull(31).labels).toEqual([]);
        expect(comments(host)).toEqual([CANNOT(adder)]);
      },
    );

    const RECORD = (sha: string, author = "github-actions[bot]", id = 9) => ({
      id,
      author,
      body: `Overridden.\n<!-- verdict-override: ${sha} -->`,
      createdAt: "2026-11-22T16:00:00Z",
    });

    it("keeps an approver's on a pull request someone else reopened", async () => {
      const { host, log, go } = setUp({ owner: "github-actions[bot]" });

      await go("labeled", "alice");
      await go("reopened", "bob");
      expect(log.at(-1)).toBe(
        `Review verdict on ${HEAD}: success, Overridden by an approver`,
      );
      expect(host.pull(31).labels).toEqual(["verdict-override"]);
    });

    it("does not pass a reopened head the newest override was not given on", async () => {
      const { host, log, go } = setUp();
      host.change(31, {
        labeledBy: { "verdict-override": "alice" },
        comments: [
          SAYS("ready"),
          RECORD(HEAD),
          RECORD("01d5a00000", undefined, 10),
        ],
      });

      await go("reopened", "bob");
      expect(log).toEqual([
        `Review verdict on ${HEAD}: failure, The review asked for changes`,
      ]);
      expect(host.pull(31).labels).toEqual(["verdict-override"]);
    });

    it("counts no record another account posted", async () => {
      const { host, log, go } = setUp();
      host.change(31, {
        labeledBy: { "verdict-override": "alice" },
        comments: [SAYS("ready"), RECORD(HEAD, "bob")],
      });

      await go("reopened", "bob");
      expect(log).toEqual([
        `Review verdict on ${HEAD}: failure, The review asked for changes`,
      ]);
    });

    it("keeps the override a review finds on the head its record names", async () => {
      const { host, log, go } = finished(
        {},
        "success",
        {
          labels: ["verdict-override"],
          labeledBy: { "verdict-override": "alice" },
          comments: [RECORD(HEAD)],
        },
        { writers: ["alice"] },
      );

      await go();
      expect(log).toEqual(["Nothing to post."]);
      expect(host.pull(31).labels).toEqual(["verdict-override"]);
    });

    it("posts what the review found on a head the override was not given on", async () => {
      const { log, go } = finished(
        {},
        "success",
        {
          labels: ["verdict-override"],
          labeledBy: { "verdict-override": "alice" },
          comments: [RECORD("01d5a00000")],
        },
        { writers: ["alice"] },
      );

      await go();
      expect(log).toEqual([
        `Review verdict on ${HEAD}: success, The review found it ready`,
      ]);
    });

    it("removes it when the review finishes, and posts what the review said", async () => {
      const { host, log, go } = finished({}, "success", {
        labels: ["verdict-override"],
        labeledBy: { "verdict-override": "bob" },
      });

      await go();
      expect(log).toEqual([
        `Review verdict on ${HEAD}: success, The review found it ready`,
      ]);
      expect(host.pull(31).labels).toEqual([]);
      expect(comments(host)).toEqual([CANNOT("bob")]);
    });

    it("judges the account that added the label now on, not an earlier event's", async () => {
      const { host, log } = setUp();
      host.change(31, { labeledBy: { "verdict-override": "bob" } });

      await apply({
        eventName: "pull_request_target",
        event: {
          action: "labeled",
          label: { name: "verdict-override" },
          sender: { login: "alice" },
          pull_request: { number: 31, head: { sha: HEAD } },
        },
        pulls: host.codeHost,
        log: (line) => void log.push(line),
      });
      expect(log).toEqual([
        `Review verdict on ${HEAD}: failure, The review asked for changes`,
      ]);
      expect(comments(host)).toEqual([CANNOT("bob")]);
    });

    it.each<[string, MemoryCodeHostOptions, string]>([
      [
        "names nobody",
        {},
        "The code host does not say who added `verdict-override`.",
      ],
      [
        "cannot be read",
        { fail: { labeledBy: new Error("gh: Server Error (HTTP 500)") } },
        "gh: Server Error (HTTP 500)",
      ],
    ])(
      "removes it, says so, and fails when its record of who added it %s",
      async (_, options, reason) => {
        const { host, log, go } = setUp(options);

        await expect(go("reopened", "alice")).rejects.toThrow(reason);
        expect(log).toEqual([
          `Review verdict on ${HEAD}: failure, The review asked for changes`,
        ]);
        expect(host.pull(31).labels).toEqual([]);
        expect(comments(host)).toEqual([
          "Removed `verdict-override`: could not check who added it, and only an account that can write to this repository may pass the verdict. Add the label again to retry.",
        ]);
      },
    );
  });

  describe("on a pull request from Dependabot", () => {
    const BOT = "dependabot[bot]";
    const PASSED = `Review verdict on ${HEAD}: success, Review skipped: Dependabot. CI and end-to-end are the gate`;
    const JUDGED = `Review verdict on ${HEAD}: pending, The review did not run`;
    const by = (verifiedAuthor: string | null, sha = HEAD) => ({
      sha,
      verifiedAuthor,
    });
    const bump = (seed: Partial<PullSeed>, options?: MemoryCodeHostOptions) =>
      finished({}, "skipped", { author: BOT, ...seed }, options);

    it("skips the review when the code host verifies every commit as Dependabot's", async () => {
      const { log, go } = bump({ commits: [by(BOT, "1"), by(BOT)] });

      await go();
      expect(log).toEqual([PASSED]);
    });

    it.each<[string, Partial<PullSeed>]>([
      ["one commit is someone else's", { commits: [by("bob", "1"), by(BOT)] }],
      [
        "one commit is nobody's for certain",
        { commits: [by(null, "1"), by(BOT)] },
      ],
      ["the code host lists no commit", { commits: [] }],
      ["the commit judged is not among them", { commits: [by(BOT, "1")] }],
      ["another account opened it", { author: "bob", commits: [by(BOT)] }],
    ])("judges it as any other when %s", async (_, seed) => {
      const { log, go } = bump(seed);

      await go();
      expect(log).toEqual([JUDGED]);
    });

    it("judges it as any other, and says why, when its commits cannot be read", async () => {
      const { log, go } = bump(
        { commits: [by(BOT)] },
        { fail: { commits: new Error("gh: Server Error (HTTP 500)") } },
      );

      await go();
      expect(log).toEqual([
        "Could not check that every commit is Dependabot's: gh: Server Error (HTTP 500)",
        JUDGED,
      ]);
    });
  });

  it("honors an override from an approver whose login the event spells in another case", async () => {
    const { host, log, go } = setUp();

    await go("labeled", "Alice");
    expect(log).toContain(
      `Review verdict on ${HEAD}: success, Overridden by an approver`,
    );
    expect(host.pull(31).labels).toEqual(["verdict-override"]);
  });
});

describe("factory review verdict", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fails on an event it does not read", async () => {
    vi.stubEnv("GITHUB_EVENT_NAME", "workflow_run");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await run()).toBe(1);
    expect(error).toHaveBeenCalledWith(
      "factory review verdict reads pull_request_target, not workflow_run: a review's run posts its own verdict.",
    );
  });
});

describe("a pull request that waits for another repository's", () => {
  const WAITS = {
    state: "pending" as const,
    description: "Waits for acme/api#88 to merge",
  };
  const post = async (
    order: typeof WAITS | { state: "success"; description: string } | null,
    over: Partial<Parameters<typeof apply>[0]> = {},
    seed: Partial<PullSeed> = {},
  ) => {
    const host = memoryCodeHost(
      [{ number: 41, body: "Part of acme/api#12", ...seed }],
      {
        writers: ["alice"],
        commits: {
          head41: {
            statuses: [
              {
                id: 1,
                name: REVIEW,
                state: "success",
                author: "github-actions[bot]",
              },
            ],
          },
        },
      },
    );
    const log: string[] = [];
    const bodies: string[] = [];
    await apply({
      eventName: "order",
      event: { pull: 41 },
      pulls: host.codeHost,
      log: (line) => void log.push(line),
      order: async (body) => {
        bodies.push(body);
        return order;
      },
      ...over,
    } as Parameters<typeof apply>[0]);
    const states = Object.fromEntries(
      host.commit("head41").statuses.map((s) => [s.name, s.state]),
    );
    return { log, states, bodies, host };
  };

  it("shows what it waits for, and the verdict waits with it", async () => {
    const r = await post(WAITS);
    expect(r.bodies).toEqual(["Part of acme/api#12"]);
    expect(r.log).toEqual([
      "Merge order on head41: pending, Waits for acme/api#88 to merge",
      "Review verdict on head41: pending, Waits for acme/api#88 to merge",
    ]);
    expect(r.states).toMatchObject({
      "Merge order": "pending",
      "Review verdict": "pending",
    });
  });

  it("shows what the review found once there is nothing to wait for", async () => {
    const r = await post({
      state: "success",
      description: "Nothing to wait for",
    });
    expect(r.states).toMatchObject({
      "Merge order": "success",
      "Review verdict": "success",
    });
  });

  it.each<[string, Partial<Parameters<typeof apply>[0]>, Partial<PullSeed>]>([
    ["with the automated review off", { reviewOn: false }, {}],
    [
      "overridden by an approver",
      {},
      {
        labels: ["verdict-override"],
        labeledBy: { "verdict-override": "alice" },
      },
    ],
  ])("waits %s too", async (_, over, seed) => {
    const r = await post(WAITS, over, seed);
    expect(r.states["Review verdict"]).toBe("pending");
  });

  it("keeps a verdict that asks for changes", async () => {
    const r = await post(WAITS, {
      eventName: "review",
      event: {
        pull: 41,
        sha: "head41",
        conclusion: "success",
        verdict: "changes",
      },
    } as Partial<Parameters<typeof apply>[0]>);
    expect(r.states["Review verdict"]).toBe("failure");
  });

  it("gets no Merge order when it is part of no such ticket", async () => {
    const r = await post(null);
    expect(r.states).not.toHaveProperty("Merge order");
    expect(r.states["Review verdict"]).toBe("success");
  });

  it("gets none when it is a fork's, whatever its text says", async () => {
    const r = await post(
      WAITS,
      {},
      { head: { sha: "head41", branch: "b", repository: "mallory/widgets" } },
    );
    expect(r.bodies).toEqual([]);
    expect(r.states).not.toHaveProperty("Merge order");
  });

  it("posts nothing on one that closed meanwhile", async () => {
    const r = await post(WAITS, {}, { state: "closed" });
    expect(r.states).not.toHaveProperty("Merge order");
    expect(r.log).toEqual(["#41 is not open."]);
  });
});
