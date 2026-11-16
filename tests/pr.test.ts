import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatReport,
  isSettled,
  main,
  ownerReviewsToWork,
  reviewExpected,
  withAgentMark,
  type Deps,
  type Report,
} from "../src/pr.mts";
import type { Run } from "../src/runner/types.mts";
import {
  memoryCodeHost,
  type MemoryCodeHostOptions,
  type PullSeed,
} from "./memory-code-host";
import { memoryRunner, type MemoryRunnerOptions } from "./memory-runner";

afterEach(() => vi.restoreAllMocks());

const AGENT = "<!-- agent -->";

/** `factory pr` against the in-memory code host and runner, which share one
 * log of what was asked of them. */
function pr(
  seed: PullSeed[] = [],
  options: MemoryCodeHostOptions & { runner?: MemoryRunnerOptions } = {},
) {
  const log: string[] = [];
  const host = memoryCodeHost(seed, { ...options, log });
  const runner = memoryRunner({ ...options.runner, log });
  const out: string[] = [];
  const d = {
    repository: "acme/widgets",
    codeHost: host.codeHost,
    runner: runner.runner,
    sleep: vi.fn<(ms: number) => Promise<void>>(async () => {}),
    out: (line: string) => void out.push(line),
    readFile: () => "Fixed in abc123.",
    git: (args: string[]): string => {
      if (args.join(" ") === "rev-parse HEAD") return "deadbeef\n";
      throw new Error(`git ${args.join(" ")} is not set`);
    },
  } satisfies Deps;
  return { d, out, log, host, runner };
}

const thread = (commentId: number, over: object = {}) => ({
  commentId,
  nodeId: `T_${commentId}`,
  isResolved: false,
  isOutdated: false,
  path: "a.ts",
  line: 3,
  comments: [{ id: commentId, author: "acme", body: "Why this?" }],
  ...over,
});

describe("main", () => {
  it("resolve resolves the thread that holds the comment, and no other", async () => {
    const { d, out, host } = pr([
      {
        number: 204,
        threads: [
          thread(10),
          thread(20, {
            comments: [
              { id: 20, author: "acme", body: "And this?" },
              { id: 21, author: "acme", body: "Still open." },
            ],
          }),
        ],
      },
    ]);

    expect(await main(["resolve", "204", "21"], d)).toBe(0);
    expect(out).toEqual(["resolved"]);
    expect(host.pull(204).threads.map((t) => t.isResolved)).toEqual([
      false,
      true,
    ]);
  });

  describe("ready checks signatures only when git is set to sign", () => {
    const run = (config: string | Error, unverified: string[]) => {
      const made = pr([{ number: 9, isDraft: true, unverified }]);
      const d = {
        ...made.d,
        git: (args: string[]) => {
          if (args.join(" ") !== "config --get commit.gpgsign")
            throw new Error(`unexpected git ${args.join(" ")}`);
          if (config instanceof Error) throw config;
          return `${config}\n`;
        },
      };
      return { ...made, code: main(["ready", "9"], d) };
    };

    it("refuses, naming each commit not verified and the reason, and leaves the draft", async () => {
      const r = run("true", ["bbbbbbb unsigned"]);

      expect(await r.code).toBe(1);
      expect(r.out.join("\n")).toContain("bbbbbbb unsigned");
      expect(r.host.pull(9).isDraft).toBe(true);
    });

    it("marks ready when every commit is verified", async () => {
      const r = run("true", []);

      expect(await r.code).toBe(0);
      expect(r.out).toEqual(["ready"]);
      expect(r.host.pull(9).isDraft).toBe(false);
    });

    it.each([["false"], [new Error("exit 1")]])(
      "asks about no commit when commit.gpgsign is %s",
      async (config) => {
        const r = run(config, ["bbbbbbb unsigned"]);

        expect(await r.code).toBe(0);
        expect(r.log).toEqual(["ready 9"]);
        expect(r.host.pull(9).isDraft).toBe(false);
      },
    );
  });

  it("reply adds the agent mark to the file's text and prints the reply's ID", async () => {
    const { d, out, host } = pr([{ number: 204, threads: [thread(77)] }]);

    expect(await main(["reply", "204", "77", "--body-file", "f.md"], d)).toBe(
      0,
    );
    const reply = host.pull(204).threads[0].comments.at(-1)!;
    expect(reply.body).toBe(`Fixed in abc123.\n\n${AGENT}`);
    expect(out).toEqual([`replied ${reply.id}`]);
  });

  it("threads prints the unresolved threads as JSON", async () => {
    const { d, out } = pr([
      { number: 204, threads: [thread(10), thread(20, { isResolved: true })] },
    ]);

    expect(await main(["threads", "204"], d)).toBe(0);
    expect(JSON.parse(out.join("\n"))).toEqual([thread(10)]);
  });

  it("threads --all prints the resolved threads too", async () => {
    const { d, out } = pr([
      { number: 204, threads: [thread(10), thread(20, { isResolved: true })] },
    ]);

    expect(await main(["threads", "204", "--all"], d)).toBe(0);
    expect(JSON.parse(out.join("\n"))).toEqual([
      thread(10),
      thread(20, { isResolved: true }),
    ]);
  });

  it("exits nonzero and prints the error when a read fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { d, out } = pr([{ number: 204 }], {
      fail: { threads: new Error("HTTP 502") },
    });

    expect(await main(["threads", "204"], d)).toBe(1);
    expect(error).toHaveBeenCalledWith("HTTP 502");
    expect(out).toEqual([]);
  });

  it("state reads the head's summary, after waiting out an unknown mergeable state", async () => {
    const summary = (id: number, sha: string, verdict: string) => ({
      id,
      author: "github-actions[bot]",
      body: `<!-- review-verdict: ${verdict} -->\n<!-- claude-review sha=${sha} -->`,
      createdAt: "2026-11-09T10:00:00Z",
    });
    const { d, out, host } = pr(
      [
        {
          number: 9,
          mergeableState: "unknown",
          head: { sha: "abc1234", branch: "b", repository: "acme/widgets" },
          comments: [
            summary(2, "abc1234", "ready"),
            summary(3, "0ld0ld0", "changes"),
          ],
        },
      ],
      {
        commits: {
          abc1234: {
            checkRuns: [
              {
                id: 1,
                name: "Tests",
                status: "completed",
                conclusion: "success",
              },
            ],
          },
        },
        runner: {
          reviewRuns: {
            abc1234: [{ status: "completed", conclusion: "success" }],
          },
        },
      },
    );
    d.sleep.mockImplementation(async () =>
      host.change(9, { mergeableState: "clean" }),
    );

    expect(await main(["state", "9"], d)).toBe(0);
    expect(d.sleep).toHaveBeenCalledWith(10_000);
    expect(out).toContain("mergeable: clean");
    expect(out).toContain("Claude review: completed, success");
    expect(out).toContain("summary: comment 2, verdict ready");
    expect(out).toContain("  - Tests: passed");
  });

  it("state takes the open pull request from the current branch when no number is given", async () => {
    const made = pr([
      {
        number: 9,
        title: "From the branch",
        head: { sha: "abc1234", branch: "issue-1-x", repository: null },
      },
    ]);
    const d = { ...made.d, git: () => "issue-1-x\n" };

    expect(await main(["state"], d)).toBe(0);
    expect(made.out[0]).toBe("#9 From the branch");
  });
});

describe("wait-checks", () => {
  const run = (
    id: number,
    jobs: number,
    event: string,
    status: string,
    conclusion: string | null,
  ): Run => ({ id, jobs, event, status, conclusion, checksId: id * 10 });
  const HEAD = { sha: "deadbeef", branch: "b", repository: "acme/widgets" };

  /** Pull request 9 with these runs for the commit git says is HEAD,
   * `deadbeef`, on a clock each sleep moves. `afterSleep` holds what changes
   * on the code host or the runner after the first sleep, the second, and
   * so on. */
  function waiting(
    runs: Run[],
    over: {
      head?: string;
      checkRuns?: { name: string; conclusion: string; checksId: number }[];
    } = {},
  ) {
    const made = pr(
      [{ number: 9, head: { ...HEAD, sha: over.head ?? "deadbeef" } }],
      {
        commits: {
          deadbeef: {
            checkRuns: (over.checkRuns ?? []).map((c, at) => ({
              id: at + 1,
              status: "completed",
              ...c,
            })),
          },
        },
        runner: { runs: { deadbeef: runs } },
      },
    );
    let now = 0;
    const afterSleep: (() => void)[] = [];
    const d = {
      ...made.d,
      now: () => now,
      sleep: vi.fn(async (ms: number) => {
        now += ms;
        afterSleep.shift()?.();
      }),
    };
    return { ...made, d, afterSleep };
  }

  it("prints success when each run passed and one was skipped", async () => {
    const { d, out } = waiting([
      run(1, 100, "pull_request", "completed", "success"),
      run(2, 200, "pull_request", "completed", "skipped"),
    ]);

    expect(await main(["wait-checks", "9"], d)).toBe(0);
    expect(out).toEqual(["success"]);
  });

  it("leaves out a failed run whose event is pull_request_target", async () => {
    const { d, out } = waiting([
      run(1, 100, "pull_request", "completed", "success"),
      run(2, 300, "pull_request_target", "completed", "failure"),
      run(3, 400, "workflow_run", "completed", "failure"),
    ]);

    expect(await main(["wait-checks", "9"], d)).toBe(0);
    expect(out).toEqual(["success"]);
  });

  it("ignores an older failed run of the same jobs when a newer one passed", async () => {
    const { d, out } = waiting([
      run(5, 100, "pull_request", "completed", "success"),
      run(4, 100, "pull_request", "completed", "failure"),
    ]);

    expect(await main(["wait-checks", "9"], d)).toBe(0);
    expect(out).toEqual(["success"]);
  });

  it("prints failure naming the check run that failed, and exits 3", async () => {
    const { d, out } = waiting(
      [
        run(1, 100, "pull_request", "completed", "success"),
        run(2, 200, "push", "completed", "failure"),
      ],
      {
        checkRuns: [
          { name: "Unit tests", conclusion: "success", checksId: 10 },
          { name: "Lint", conclusion: "success", checksId: 20 },
          { name: "Browser", conclusion: "failure", checksId: 20 },
          { name: "Verdict", conclusion: "failure", checksId: 30 },
        ],
      },
    );

    expect(await main(["wait-checks", "9"], d)).toBe(3);
    expect(out).toEqual(["failure: Browser"]);
  });

  it("keeps waiting while a run is in progress", async () => {
    const passed = run(1, 100, "pull_request", "completed", "success");
    const { d, out, runner, afterSleep } = waiting([
      passed,
      run(2, 200, "pull_request", "in_progress", null),
    ]);
    afterSleep.push(() =>
      runner.setRuns("deadbeef", [
        passed,
        run(2, 200, "pull_request", "completed", "success"),
      ]),
    );

    expect(await main(["wait-checks", "9"], d)).toBe(0);
    expect(d.sleep).toHaveBeenCalledTimes(1);
    expect(out).toEqual(["success"]);
  });

  it("keeps waiting while the pull request's head is an older commit, and reads no run until it is HEAD", async () => {
    const { d, out, log, host, afterSleep } = waiting(
      [run(1, 100, "pull_request", "completed", "success")],
      { head: "0ldc0mm1t" },
    );
    afterSleep.push(
      () => {},
      () => host.change(9, { head: HEAD }),
    );

    expect(await main(["wait-checks", "9"], d)).toBe(0);
    expect(log).toEqual(["get 9", "get 9", "get 9", "runs deadbeef"]);
    expect(out).toEqual(["success"]);
  });

  it("prints no checks two minutes after the commit became the head with no run", async () => {
    const { d, out } = waiting([]);

    expect(await main(["wait-checks", "9"], d)).toBe(0);
    expect(out).toEqual(["no checks"]);
    expect(d.now()).toBeGreaterThanOrEqual(120_000);
    expect(d.now()).toBeLessThan(180_000);
  });
});

describe("withAgentMark", () => {
  it("adds the mark once", () => {
    expect(withAgentMark("Done.\n")).toBe("Done.\n\n<!-- agent -->");
    expect(withAgentMark("Done.\n<!-- agent -->")).toBe(
      "Done.\n<!-- agent -->",
    );
  });
});

const report = (over: Partial<Report> = {}): Report => ({
  pull: {
    number: 9,
    title: "T",
    state: "open",
    isDraft: false,
    mergeableState: "clean",
    author: "acme",
    body: "",
    labels: [],
    head: { sha: "abc1234", branch: "b", repository: "acme/widgets" },
    base: {
      sha: "0000000",
      branch: "main",
      repository: "acme/widgets",
    },
  },
  ownerLogin: "acme",
  reviewRun: { status: "completed", conclusion: "success" },
  summary: {
    id: 1,
    author: "github-actions[bot]",
    body: "<!-- review-verdict: ready -->",
    createdAt: "2026-11-09T10:00:00Z",
  },
  conversation: [],
  reviews: [],
  threads: [],
  checks: [{ id: 1, name: "Tests", state: "passed" }],
  ...over,
});

describe("ownerReviewsToWork", () => {
  const review = (id: number, at: string, body = "Rename it.") => ({
    id,
    author: "acme",
    body,
    submittedAt: at,
  });
  const agentSaid = (at: string, extra = "") => ({
    id: 3,
    author: "acme",
    body: `Done.\n<!-- agent -->${extra}`,
    createdAt: at,
  });

  it("keeps the owner's review bodies after the last agent comment", () => {
    const r = report({
      reviews: [
        review(1, "2026-11-09T09:00:00Z"),
        review(2, "2026-11-09T11:00:00Z"),
      ],
      conversation: [agentSaid("2026-11-09T10:00:00Z")],
    });

    expect(ownerReviewsToWork(r).map((x) => x.id)).toEqual([2]);
  });

  it("does not let a conflict sweep's comment count as the answer", () => {
    const r = report({
      reviews: [review(1, "2026-11-09T09:00:00Z")],
      conversation: [
        agentSaid("2026-11-09T10:00:00Z", "\n<!-- conflict-fix -->"),
      ],
    });

    expect(ownerReviewsToWork(r)).toHaveLength(1);
  });

  it("skips another reviewer's review body", () => {
    const r = report({
      reviews: [{ ...review(1, "2026-11-09T09:00:00Z"), author: "someone" }],
    });

    expect(ownerReviewsToWork(r)).toEqual([]);
  });

  it("skips empty bodies and the session's own thread replies", () => {
    const r = report({
      reviews: [
        review(1, "2026-11-09T09:00:00Z", ""),
        review(2, "2026-11-09T09:00:00Z", "Fixed.\n<!-- agent -->"),
      ],
    });

    expect(ownerReviewsToWork(r)).toEqual([]);
  });
});

describe("waiting for the review", () => {
  it("expects no review on a draft, Dependabot's, a fork's, or a conflicted pull request", () => {
    const pull = report().pull;

    expect(reviewExpected(pull)).toBe(true);
    expect(reviewExpected({ ...pull, isDraft: true })).toBe(false);
    expect(reviewExpected({ ...pull, author: "dependabot[bot]" })).toBe(false);
    expect(reviewExpected({ ...pull, mergeableState: "dirty" })).toBe(false);
    expect(
      reviewExpected({
        ...pull,
        head: { ...pull.head, repository: "x/widgets" },
      }),
    ).toBe(false);
  });

  it("settles once the head's summary is in and every check has finished", () => {
    expect(isSettled(report())).toBe(true);
    expect(isSettled(report({ summary: null, reviewRun: null }))).toBe(false);
    expect(
      isSettled(report({ checks: [{ id: 1, name: "E2E", state: "pending" }] })),
    ).toBe(false);
  });

  it("settles without a summary when the review run failed", () => {
    expect(
      isSettled(
        report({
          summary: null,
          reviewRun: { status: "completed", conclusion: "failure" },
        }),
      ),
    ).toBe(true);
  });
});

describe("formatReport", () => {
  it("names the verdict, the owner's turn on a thread, and each check", () => {
    const lines = formatReport(
      report({
        threads: [
          {
            commentId: 7,
            isResolved: false,
            isOutdated: true,
            path: "a.ts",
            line: 3,
            comments: [{ id: 7, author: "acme", body: "Why this?" }],
          },
        ],
      }),
    );

    expect(lines).toContain("summary: comment 1, verdict ready");
    expect(lines).toContain(
      "  - 7 on a.ts:3 (outdated) by acme, owner's turn: Why this?",
    );
    expect(lines).toContain("  - Tests: passed");
  });
});

// The pull-request commands the skills and workflows call instead of
// GitHub's issues API: one test per row of the issue's table.
describe("the pull-request commands", () => {
  const comment = (id: number, author: string, body: string) => ({
    id,
    author,
    body,
    createdAt: "2026-11-14T12:00:00Z",
  });
  const CONVERSATION = [
    comment(
      1,
      "github-actions[bot]",
      "Review.\n<!-- claude-review sha=abc -->",
    ),
    comment(2, "acme", `Please fix the label.\n\n${AGENT}`),
    comment(3, "codecov[bot]", "Coverage moved."),
  ];
  const twelve = (over: Partial<PullSeed> = {}) =>
    pr([{ number: 12, comments: CONVERSATION, ...over }]);
  let errors: string[] = [];
  const quiet = () =>
    vi
      .spyOn(console, "error")
      .mockImplementation((line: unknown) => void errors.push(String(line)));
  afterEach(() => {
    errors = [];
  });

  it("comments lists each conversation comment's ID, author, time, and first line, reading nothing else", async () => {
    const { d, out, log } = twelve();

    expect(await main(["comments", "12"], d)).toBe(0);
    expect(out).toEqual([
      "1 github-actions[bot] 2026-11-14T12:00:00Z Review.",
      "2 acme 2026-11-14T12:00:00Z Please fix the label.",
      "3 codecov[bot] 2026-11-14T12:00:00Z Coverage moved.",
    ]);
    expect(log).toEqual(["comments 12"]);
  });

  it("comments --author keeps one author's, and --contains those whose body has the text", async () => {
    const byAuthor = twelve();
    const byText = twelve();

    await main(["comments", "12", "--author", "acme"], byAuthor.d);
    await main(
      ["comments", "12", "--contains", "claude-review sha=abc"],
      byText.d,
    );
    expect(byAuthor.out.map((l) => l.split(" ")[0])).toEqual(["2"]);
    expect(byText.out.map((l) => l.split(" ")[0])).toEqual(["1"]);
  });

  it("comments --json prints the comments as one JSON value, under GitHub's field names", async () => {
    const { d, out } = twelve();

    await main(["comments", "12", "--json"], d);
    expect(JSON.parse(out.join("\n"))).toEqual(
      CONVERSATION.map((c) => ({
        id: c.id,
        user: { login: c.author },
        body: c.body,
        created_at: "2026-11-14T12:00:00Z",
      })),
    );
  });

  it("comment posts the file as it is and prints the comment's ID", async () => {
    const { d, out, host } = twelve();
    d.readFile = () => `Fixed in abc123.\n${AGENT}`;

    expect(await main(["comment", "12", "--body-file", "c.md"], d)).toBe(0);
    const posted = host.pull(12).comments.at(-1)!;
    expect(posted.body).toBe(`Fixed in abc123.\n${AGENT}`);
    expect(out).toEqual([String(posted.id)]);
  });

  it("comment exits non-zero, names the tag, and posts nothing when the body has a bare tag", async () => {
    quiet();
    const { d, out, log } = twelve();
    d.readFile = () => "Rename it to <slug>.";

    expect(await main(["comment", "12", "--body-file", "c.md"], d)).toBe(1);
    expect(out).toEqual([]);
    expect(errors.join("\n")).toContain("<slug>");
    expect(log).toEqual([]);
  });

  it("comment-view prints one comment's body", async () => {
    const { d, out } = twelve();

    expect(await main(["comment-view", "2"], d)).toBe(0);
    expect(out).toEqual([`Please fix the label.\n\n${AGENT}`]);
  });

  it("label --add adds the label", async () => {
    const { d, out, host } = twelve();

    expect(await main(["label", "12", "--add", "merge: manual"], d)).toBe(0);
    expect(out).toEqual(["added"]);
    expect(host.pull(12).labels).toEqual(["merge: manual"]);
  });

  it("label --remove takes the label off", async () => {
    const { d, out, host } = twelve({
      labels: ["merge: automatic", "spec"],
    });

    expect(await main(["label", "12", "--remove", "merge: automatic"], d)).toBe(
      0,
    );
    expect(out).toEqual(["removed"]);
    expect(host.pull(12).labels).toEqual(["spec"]);
  });

  it("closes prints the tickets a pull request closes", async () => {
    const { d, out } = twelve({ closes: [7, 8] });

    expect(await main(["closes", "12"], d)).toBe(0);
    expect(out).toEqual(["7 8"]);
  });

  it("label --add refuses the owner's override and adds nothing", async () => {
    quiet();
    const { d, out, log } = twelve();

    expect(await main(["label", "12", "--add", "verdict: override"], d)).toBe(
      1,
    );
    expect(out).toEqual([]);
    expect(log).toEqual([]);
  });
});

describe("review-pending", () => {
  const review = (body: string, author = "acme", comments: string[] = []) => ({
    id: 5,
    author,
    body,
    submittedAt: "2026-11-09T12:00:00Z",
    comments: comments.map((text, at) => ({
      id: at + 1,
      author,
      body: text,
      createdAt: "2026-11-09T12:00:00Z",
    })),
  });
  const run = async (seed: Partial<PullSeed>) => {
    const { d, out } = pr([{ number: 12, ...seed }]);
    const code = await main(["review-pending", "12", "5"], d);
    return { code, out };
  };

  it.each([
    [{ state: "closed" }, /#12 is closed/],
    [{ state: "closed", merged: true }, /#12 is merged/],
  ])("exits 1 for a pull request that is %j", async (state, why) => {
    const { code, out } = await run({
      ...state,
      reviews: [review("Fix this.")],
    });
    expect(code).toBe(1);
    expect(out[0]).toMatch(why);
  });

  it("exits 1 for a review by someone else", async () => {
    const { code, out } = await run({
      reviews: [review("Fix this.", "mallory")],
    });
    expect(code).toBe(1);
    expect(out[0]).toMatch(/someone else's/);
  });

  it("exits 1 for the factory's reply: an empty body and one comment with the marker", async () => {
    const { code, out } = await run({
      reviews: [review("", "acme", [`Fixed.\n\n${AGENT}`])],
    });
    expect(code).toBe(1);
    expect(out[0]).toMatch(/own reply/);
  });

  it("exits 2, with the error, when the review cannot be read", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { d } = pr([{ number: 12 }], {
      fail: { get: new Error("HTTP 401") },
    });
    expect(await main(["review-pending", "12", "5"], d)).toBe(2);
    expect(error).toHaveBeenCalledWith("HTTP 401");
    error.mockRestore();
  });

  it("exits 0 for an owner's review with only a body", async () => {
    const { code } = await run({ reviews: [review("Please change this.")] });
    expect(code).toBe(0);
  });

  it("exits 0 for an owner's review with only comments", async () => {
    const { code } = await run({
      reviews: [review("", "acme", ["Rename this."])],
    });
    expect(code).toBe(0);
  });
});

describe("conflicts", () => {
  const repo = "acme/widgets";
  const listed = (
    number: number,
    over: Partial<PullSeed> = {},
    created = `2026-11-0${number}T00:00:00Z`,
  ): PullSeed => ({
    number,
    head: { branch: `b${number}`, sha: `sha${number}`, repository: repo },
    createdAt: created,
    mergeableState: "dirty",
    ...over,
  });
  const run = async (pulls: PullSeed[], afterSleep: (() => void)[] = []) => {
    const made = pr(pulls);
    made.d.sleep.mockImplementation(async () => afterSleep.shift()?.());
    const code = await main(["conflicts"], made.d);
    return { ...made, code, sleep: made.d.sleep };
  };

  it("exits 2, with the error, when the pull requests cannot be read", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { d } = pr([], { fail: { listOpen: new Error("HTTP 401") } });
    expect(await main(["conflicts"], d)).toBe(2);
    expect(error).toHaveBeenCalledWith("HTTP 401");
    error.mockRestore();
  });

  it("exits 1 when nothing is open", async () => {
    const { code } = await run([]);
    expect(code).toBe(1);
  });

  it("prints a dirty pull request and exits 0", async () => {
    const { code, out } = await run([listed(3)]);
    expect(code).toBe(0);
    expect(out).toEqual(["3"]);
  });

  it("prints oldest first", async () => {
    const { out } = await run([
      listed(9, {}, "2026-11-02T00:00:00Z"),
      listed(4, {}, "2026-11-05T00:00:00Z"),
    ]);
    expect(out).toEqual(["9", "4"]);
  });

  it("leaves a dirty draft", async () => {
    expect((await run([listed(3, { isDraft: true })])).code).toBe(1);
  });

  it("leaves Dependabot's, a fork's, and one based elsewhere", async () => {
    const { code } = await run([
      listed(3, { author: "dependabot[bot]" }),
      listed(4, {
        head: { branch: "x", sha: "s", repository: "someone/widgets" },
      }),
      listed(5, { base: { branch: "next", sha: "base", repository: repo } }),
    ]);
    expect(code).toBe(1);
  });

  it("leaves one that is only behind", async () => {
    expect((await run([listed(3, { mergeableState: "behind" })])).code).toBe(1);
  });

  it("leaves one with a stop comment for its head, and takes one whose stop is for an older head", async () => {
    const stop = (sha: string) => [
      {
        id: 1,
        author: "acme",
        body: `Stopping.\n\n<!-- conflict-stop head=${sha} -->\n${AGENT}`,
        createdAt: "2026-11-09T12:00:00Z",
      },
    ];
    const { out } = await run([
      listed(3, { comments: stop("sha3") }),
      listed(4, { comments: stop("old") }),
    ]);
    expect(out).toEqual(["4"]);
  });

  it("reads an unknown state again, ten seconds apart, until it is dirty", async () => {
    const made = pr([listed(3, { mergeableState: "unknown" })]);
    made.d.sleep
      .mockImplementationOnce(async () => {})
      .mockImplementationOnce(async () =>
        made.host.change(3, { mergeableState: "dirty" }),
      );

    expect(await main(["conflicts"], made.d)).toBe(0);
    expect(made.out).toEqual(["3"]);
    expect(made.d.sleep).toHaveBeenCalledTimes(2);
    expect(made.d.sleep).toHaveBeenCalledWith(10_000);
  });

  it("gives up on a state that stays unknown after 5 reads", async () => {
    const { code, sleep, log } = await run([
      listed(3, { mergeableState: "unknown" }),
    ]);
    expect(code).toBe(1);
    expect(sleep).toHaveBeenCalledTimes(4);
    expect(log.filter((call) => call === "get 3")).toHaveLength(5);
  });
});

describe("what the skills run in place of the code host's and the runner's own tools", () => {
  let errors: string[] = [];
  const quiet = () =>
    vi
      .spyOn(console, "error")
      .mockImplementation((line: unknown) => void errors.push(String(line)));
  afterEach(() => {
    errors = [];
  });

  /** A session on a branch, with a body file to open a pull request from. */
  function onBranch(
    branch: string,
    body: string,
    options: Parameters<typeof pr>[1] = {},
  ) {
    const made = pr([{ number: 7 }], options);
    const d: Deps = {
      ...made.d,
      readFile: () => body,
      git: (args) => {
        if (args.join(" ") === "branch --show-current") return `${branch}\n`;
        throw new Error(`git ${args.join(" ")} is not set`);
      },
    };
    return { ...made, d };
  }

  describe("open", () => {
    it("opens a draft from the current branch into the default branch, and prints its number alone", async () => {
      const { d, out, host } = onBranch("issue-9-fix", "Closes #9\n\nWhy.");

      expect(
        await main(["open", "--title", "Fix it", "--body-file", "b.md"], d),
      ).toBe(0);

      expect(out).toEqual(["8"]);
      expect(host.pull(8)).toMatchObject({
        title: "Fix it",
        body: "Closes #9\n\nWhy.",
        isDraft: true,
        head: { branch: "issue-9-fix" },
        base: { branch: "main" },
      });
    });

    it("opens it ready with --ready, into the branch --base names", async () => {
      const { d, host } = onBranch("issue-9-fix", "Body.");

      expect(
        await main(
          [
            "open",
            "--title",
            "Fix it",
            "--body-file",
            "b.md",
            "--ready",
            "--base",
            "release",
          ],
          d,
        ),
      ).toBe(0);

      expect(host.pull(8)).toMatchObject({
        isDraft: false,
        base: { branch: "release" },
      });
    });

    it("fails with the code host's own words, and prints no number", async () => {
      quiet();
      const { d, out } = onBranch("issue-9-fix", "Body.", {
        fail: {
          create: new Error("A pull request already exists for o:issue-9-fix."),
        },
      });

      expect(
        await main(["open", "--title", "Fix it", "--body-file", "b.md"], d),
      ).toBe(1);

      expect(out).toEqual([]);
      expect(errors.join("\n")).toContain(
        "A pull request already exists for o:issue-9-fix.",
      );
    });

    it("refuses a body with a bare tag name, and opens nothing", async () => {
      quiet();
      const { d, out, log } = onBranch("issue-9-fix", "Fill in <slug> here.");

      expect(
        await main(["open", "--title", "Fix it", "--body-file", "b.md"], d),
      ).toBe(1);

      expect(out).toEqual([]);
      expect(log).toEqual([]);
    });
  });

  describe("view", () => {
    const seeded = () =>
      pr([
        {
          number: 12,
          title: "Add the thing",
          body: "Closes #3",
          mergeableState: "dirty",
          head: {
            sha: "0123456789abcdef",
            branch: "issue-3-thing",
            repository: "acme/widgets",
          },
        },
      ]);

    it.each([
      ["head", "0123456789abcdef"],
      ["branch", "issue-3-thing"],
      ["base", "main"],
      ["title", "Add the thing"],
      ["body", "Closes #3"],
      ["state", "open"],
      ["mergeable", "dirty"],
    ])("prints the pull request's %s", async (field, value) => {
      const { d, out } = seeded();

      expect(await main(["view", "12", "--field", field], d)).toBe(0);
      expect(out).toEqual([value]);
    });

    it("refuses a field it does not have, and names the ones it has", async () => {
      quiet();
      const { d, out } = seeded();

      expect(await main(["view", "12", "--field", "color"], d)).toBe(1);
      expect(out).toEqual([]);
      expect(errors.join("\n")).toContain(
        "head, branch, base, title, body, state, mergeable",
      );
    });
  });

  describe("review", () => {
    const reviewed = () =>
      pr([
        {
          number: 12,
          reviews: [
            {
              id: 900,
              author: "acme",
              body: "Two things.",
              submittedAt: "2026-11-09T13:00:00Z",
              comments: [
                {
                  id: 901,
                  author: "acme",
                  body: "Why this?",
                  createdAt: "2026-11-09T13:00:00Z",
                  path: "a.ts",
                  line: 3,
                  replyTo: 880,
                },
              ],
            },
          ],
        },
      ]);

    it("prints a review's author, its body, and the comments it left on lines", async () => {
      const { d, out } = reviewed();

      expect(await main(["review", "12", "900"], d)).toBe(0);
      expect(JSON.parse(out.join("\n"))).toEqual({
        author: "acme",
        body: "Two things.",
        comments: [
          {
            id: 901,
            author: "acme",
            replyTo: 880,
            path: "a.ts",
            line: 3,
            body: "Why this?",
          },
        ],
      });
    });

    it("says so when the pull request has no such review", async () => {
      quiet();
      const { d, out } = reviewed();

      expect(await main(["review", "12", "5"], d)).toBe(1);
      expect(out).toEqual([]);
      expect(errors.join("\n")).toContain("review 5 on #12 was not found");
    });
  });

  describe("unverified", () => {
    it("prints each commit not shown as signed", async () => {
      const { d, out } = pr([
        { number: 12, unverified: ["abc1234 unsigned", "def5678 unknown_key"] },
      ]);

      expect(await main(["unverified", "12"], d)).toBe(0);
      expect(out).toEqual(["abc1234 unsigned", "def5678 unknown_key"]);
    });

    it("prints nothing when every commit is", async () => {
      const { d, out } = pr([{ number: 12 }]);

      expect(await main(["unverified", "12"], d)).toBe(0);
      expect(out).toEqual([]);
    });
  });

  describe("failed", () => {
    const lines = (count: number) =>
      Array.from({ length: count }, (_, i) => `line ${i + 1}`).join("\n");
    const run = (id: number, jobs: number, event: string, ended: string) => ({
      id,
      jobs,
      event,
      status: "completed",
      conclusion: ended,
      checksId: id,
    });

    it("prints each failed job's name and the last 200 lines of its log", async () => {
      const { d, out } = pr([{ number: 12 }], {
        runner: {
          runs: { head12: [run(4, 100, "pull_request", "failure")] },
          failedJobs: { 4: [{ name: "Tests", log: lines(250) }] },
        },
      });

      expect(await main(["failed", "12"], d)).toBe(0);
      expect(out[0]).toBe("== Tests");
      expect(out.slice(1).join("\n")).toBe(
        lines(250).split("\n").slice(-200).join("\n"),
      );
    });

    it("prints what a failed check wrote about itself", async () => {
      const { d, out } = pr([{ number: 12 }], {
        commits: {
          head12: {
            checkRuns: [
              {
                id: 1,
                name: "Dependabot",
                status: "completed",
                conclusion: "failure",
                report: "Could not resolve the lockfile.",
              },
              {
                id: 3,
                name: "Smoke",
                status: "completed",
                conclusion: "timed_out",
                report: "Gave up after 30 minutes.",
              },
              {
                id: 2,
                name: "CI",
                status: "completed",
                conclusion: "success",
                report: "All good.",
              },
            ],
          },
        },
      });

      expect(await main(["failed", "12"], d)).toBe(0);
      expect(out).toEqual([
        "== Dependabot, in its own words",
        "Could not resolve the lockfile.",
        "== Smoke, in its own words",
        "Gave up after 30 minutes.",
      ]);
    });

    it("prints only the failures wait-checks counts: the newest run of each set, started by a push or a pull request", async () => {
      const { d, out } = pr([{ number: 12 }], {
        runner: {
          runs: {
            head12: [
              run(5, 100, "pull_request", "success"),
              run(4, 100, "pull_request", "failure"),
              run(6, 300, "pull_request_target", "failure"),
            ],
          },
          failedJobs: {
            4: [{ name: "Tests, superseded", log: "old" }],
            6: [{ name: "Board sync", log: "not waited on" }],
          },
        },
      });

      expect(await main(["failed", "12"], d)).toBe(0);
      expect(out).toEqual([]);
    });

    it("prints the failed jobs of the newest run of a set when it failed", async () => {
      const { d, out } = pr([{ number: 12 }], {
        runner: {
          runs: {
            head12: [
              run(4, 100, "pull_request", "success"),
              run(7, 100, "pull_request", "failure"),
            ],
          },
          failedJobs: { 7: [{ name: "Tests", log: "Error: it broke" }] },
        },
      });

      expect(await main(["failed", "12"], d)).toBe(0);
      expect(out).toEqual(["== Tests", "Error: it broke"]);
    });

    it("prints nothing when nothing on the last commit failed", async () => {
      const { d, out } = pr([{ number: 12 }]);

      expect(await main(["failed", "12"], d)).toBe(0);
      expect(out).toEqual([]);
    });
  });

  describe("review-again", () => {
    it("asks the runner to review the pull request's last commit again", async () => {
      const { d, out, runner } = pr([{ number: 12 }], {
        runner: {
          reviewRuns: {
            head12: [{ status: "completed", conclusion: "success" }],
          },
        },
      });

      expect(await main(["review-again", "12"], d)).toBe(0);
      expect(out).toEqual(["asked for a fresh review of head12"]);
      expect(runner.reviewsAsked).toEqual(["head12"]);
    });

    it("says so when no review has run on that commit", async () => {
      const { d, out, runner } = pr([{ number: 12 }]);

      expect(await main(["review-again", "12"], d)).toBe(1);
      expect(out).toEqual(["no review has run on head12"]);
      expect(runner.reviewsAsked).toEqual([]);
    });
  });
});
