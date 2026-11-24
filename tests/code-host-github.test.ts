import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  githubCodeHost,
  githubOrganization,
  githubOwner,
  githubServes,
  type LinkingPage,
  type RawPull,
} from "../src/code-host/github.mts";
import type { Reply } from "../src/code-host/github-app.mts";
import { organizationHosts } from "../src/code-host/index.mts";
import { NoRulesError, NotSignedInError } from "../src/code-host/types.mts";
import { GhError } from "../src/lib/gh.mts";
import { NotFoundError } from "../src/tickets/types.mts";
import { fetchTransport, ghTransport } from "../src/tickets/transport.mts";
import { fakeGh } from "./fake-gh";

const REPO = "acme/widgets";
const notFound = () => new Error("gh api: Not Found (HTTP 404)");

function pulls(routes: Parameters<typeof fakeGh>[0], cli = true) {
  const gh = fakeGh(routes);
  const p = githubCodeHost({
    transport: ghTransport(gh.run),
    repository: REPO,
    cli: cli ? gh.run : undefined,
  });
  return { p, calls: gh.calls };
}

const rawPull = (n: number, extra: Partial<RawPull> = {}): RawPull => ({
  number: n,
  createdAt: "2026-11-09T12:00:00Z",
  body: `Closes #${n - 100}`,
  isDraft: false,
  author: { login: "acme" },
  closingIssuesReferences: {
    nodes: [
      { number: n - 100, repository: { nameWithOwner: REPO } },
      { number: 1, repository: { nameWithOwner: "someone/else" } },
    ],
  },
  ...extra,
});

describe("pull request reads", () => {
  it("reads a pull request, and fails as not found for one that does not exist", async () => {
    const { p } = pulls([
      [/pulls\/5$/, { number: 5, head: { sha: "abc" } }],
      [/pulls\/6$/, notFound()],
    ]);
    expect((await p.get(5)).number).toBe(5);
    await expect(p.get(6)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns a pull request in the factory's words", async () => {
    const { p } = pulls([
      [
        /pulls\/5$/,
        {
          number: 5,
          title: "Fix it",
          state: "closed",
          merged: true,
          draft: true,
          body: null,
          mergeable_state: "dirty",
          user: { login: "acme" },
          labels: [{ name: "merge: manual" }],
          head: { sha: "abc", ref: "fix", repo: null },
          base: { sha: "000", ref: "main", repo: { full_name: REPO } },
          created_at: "2026-11-09T12:00:00Z",
          auto_merge: { merge_method: "squash" },
        },
      ],
    ]);
    expect(await p.get(5)).toEqual({
      number: 5,
      title: "Fix it",
      state: "closed",
      merged: true,
      isDraft: true,
      body: "",
      mergeableState: "dirty",
      author: "acme",
      labels: ["merge: manual"],
      head: { sha: "abc", branch: "fix", repository: null },
      base: { sha: "000", branch: "main", repository: REPO },
      createdAt: "2026-11-09T12:00:00Z",
      autoMerge: true,
    });
  });

  it("reads a pull request short of fields as not merged, not a draft, by nobody, and of unknown mergeability", async () => {
    const { p } = pulls([[/pulls\/5$/, { number: 5 }]]);
    expect(await p.get(5)).toMatchObject({
      merged: false,
      isDraft: false,
      author: "ghost",
      mergeableState: "unknown",
      labels: [],
      autoMerge: false,
    });
  });

  it("lists every open pull request, and finds the branch's", async () => {
    const { p, calls } = pulls([
      [
        /--paginate --slurp repos\/acme\/widgets\/pulls\?state=open/,
        [[{ number: 1 }], [{ number: 2 }]],
      ],
      [/pulls\?head=acme:issue-1-x&state=open$/, [{ number: 9 }]],
      [/pulls\?head=acme:none&state=open$/, []],
    ]);
    expect((await p.listOpen()).map((x) => x.number)).toEqual([1, 2]);
    expect(await p.forBranch("issue-1-x")).toBe(9);
    expect(await p.forBranch("none")).toBeNull();
    expect(calls).toHaveLength(3);
  });

  it("reads the files a pull request changes, with a renamed file's path before", async () => {
    const { p } = pulls([
      [
        /pulls\/5\/files/,
        [
          [
            { filename: "a.ts", status: "modified" },
            { filename: "c.ts", previous_filename: "b.ts", status: "renamed" },
          ],
        ],
      ],
    ]);
    expect(await p.files(5)).toEqual([
      { path: "a.ts", status: "modified" },
      { path: "c.ts", previousPath: "b.ts", status: "renamed" },
    ]);
  });

  it("reads the merge base of two commits", async () => {
    const { p } = pulls([
      [/compare\/b\.\.\.h$/, { merge_base_commit: { sha: "mb" } }],
    ]);
    expect(await p.mergeBase("b", "h")).toBe("mb");
  });

  it("reads a commit's check runs, each with its link and the ID its run shares", async () => {
    const { p } = pulls([
      [
        /commits\/h\/check-runs/,
        {
          check_runs: [
            {
              id: 1,
              name: "ci",
              status: "completed",
              conclusion: "success",
              html_url: "https://ci/1",
              check_suite: { id: 30 },
            },
          ],
        },
      ],
    ]);
    expect(await p.checkRuns("h")).toEqual([
      {
        id: 1,
        name: "ci",
        status: "completed",
        conclusion: "success",
        link: "https://ci/1",
        checksId: 30,
      },
    ]);
  });

  it("reads what a check wrote about its own result, its title and its summary", async () => {
    const run = (id: number, output?: object) => ({
      id,
      name: `check ${id}`,
      status: "completed",
      conclusion: "failure",
      output,
    });
    const { p } = pulls([
      [
        /commits\/h\/check-runs/,
        {
          check_runs: [
            run(1, { title: "Could not update", summary: "The lockfile." }),
            run(2, { title: null, summary: null }),
            run(3),
          ],
        },
      ],
    ]);

    expect((await p.checkRuns("h")).map((c) => c.report)).toEqual([
      "Could not update\nThe lockfile.",
      undefined,
      undefined,
    ]);
  });

  it("opens a pull request from one branch into another, and returns its number", async () => {
    const { p, calls } = pulls([
      [/-X POST repos\/acme\/widgets\/pulls /, { number: 41 }],
    ]);

    expect(
      await p.create({
        title: "Fix it",
        head: "issue-9-fix",
        base: "main",
        body: "Closes #9",
        draft: true,
      }),
    ).toBe(41);
    expect(calls).toEqual([
      "api -X POST repos/acme/widgets/pulls -f title=Fix it -f head=issue-9-fix -f base=main -f body=Closes #9 -F draft=true",
    ]);
  });

  it("opens a pull request ready for review when it is not to be a draft", async () => {
    const { p, calls } = pulls([
      [/-X POST repos\/acme\/widgets\/pulls /, { number: 42 }],
    ]);

    await p.create({
      title: "Fix it",
      head: "issue-9-fix",
      base: "main",
      body: "B",
      draft: false,
    });
    expect(calls[0]).toMatch(/ -F draft=false$/);
  });

  it("reads a commit's statuses, each by its name", async () => {
    const { p } = pulls([
      [
        /commits\/h\/status$/,
        {
          statuses: [
            {
              id: 2,
              context: "verdict",
              state: "success",
              target_url: "https://ci/2",
            },
          ],
        },
      ],
    ]);
    expect(await p.statuses("h")).toEqual([
      { id: 2, name: "verdict", state: "success", link: "https://ci/2" },
    ]);
  });

  it("reads the pull requests that hold a commit", async () => {
    const { p } = pulls([
      [/commits\/h\/pulls$/, [{ number: 5, state: "open", title: "T" }]],
    ]);
    expect(await p.forCommit("h")).toEqual([{ number: 5, state: "open" }]);
  });
});

describe("pull request conversation and labels", () => {
  it("lists conversation comments in the factory's words, a deleted account as ghost", async () => {
    const { p, calls } = pulls([
      [
        /--paginate --slurp repos\/acme\/widgets\/issues\/5\/comments/,
        [
          [
            {
              id: 1,
              user: { login: "acme" },
              body: "Hello",
              created_at: "2026-11-09T12:00:00Z",
            },
            {
              id: 3,
              user: null,
              body: null,
              created_at: "2026-11-09T12:01:00Z",
            },
          ],
        ],
      ],
    ]);
    expect(await p.comments(5)).toEqual([
      {
        id: 1,
        author: "acme",
        body: "Hello",
        createdAt: "2026-11-09T12:00:00Z",
      },
      { id: 3, author: "ghost", body: "", createdAt: "2026-11-09T12:01:00Z" },
    ]);
    expect(calls).toHaveLength(1);
  });

  it("posts, reads, and edits a conversation comment through the issues API", async () => {
    const { p, calls } = pulls([
      [/-X POST repos\/acme\/widgets\/issues\/5\/comments/, { id: 2 }],
      [
        /^api repos\/acme\/widgets\/issues\/comments\/2$/,
        { id: 2, body: "Hi" },
      ],
      [/-X PATCH repos\/acme\/widgets\/issues\/comments\/2/, {}],
    ]);
    expect(await p.comment(5, "Hi")).toBe(2);
    expect((await p.commentView(2)).body).toBe("Hi");
    await p.editComment(2, "Edited");
    expect(calls).toContain(
      "api -X PATCH repos/acme/widgets/issues/comments/2 -f body=Edited",
    );
  });

  it("fails as not found for a comment that is gone", async () => {
    const { p } = pulls([[/comments\/3/, notFound()]]);
    await expect(p.commentView(3)).rejects.toBeInstanceOf(NotFoundError);
    await expect(p.editComment(3, "x")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("adds and removes a label, escaping its name", async () => {
    const { p, calls } = pulls([[/labels/, []]]);
    await p.addLabel(5, "merge: manual");
    await p.removeLabel(5, "verdict: override");
    expect(calls).toEqual([
      "api -X POST repos/acme/widgets/issues/5/labels -f labels[]=merge: manual",
      "api -X DELETE repos/acme/widgets/issues/5/labels/verdict%3A%20override",
    ]);
  });

  it("sets a body and a commit status, and replies to a review comment", async () => {
    const { p, calls } = pulls([
      [/-X PATCH repos\/acme\/widgets\/pulls\/5/, {}],
      [/statuses\/h/, {}],
      [/replies/, { id: 77 }],
    ]);
    await p.setBody(5, "Body");
    await p.setStatus("h", {
      state: "success",
      name: "Review verdict",
      description: "ok",
      link: "u",
    });
    expect(await p.reply(5, 10, "Done.")).toBe(77);
    expect(calls).toEqual([
      "api -X PATCH repos/acme/widgets/pulls/5 -f body=Body",
      "api -X POST repos/acme/widgets/statuses/h -f state=success -f context=Review verdict -f description=ok -f target_url=u",
      "api -X POST repos/acme/widgets/pulls/5/comments/10/replies -f body=Done.",
    ]);
  });
});

const graphThreads = {
  data: {
    repository: {
      pullRequest: {
        reviewThreads: {
          nodes: [
            {
              id: "PRRT_1",
              isResolved: false,
              isOutdated: false,
              path: "a.ts",
              line: 3,
              comments: {
                nodes: [
                  { databaseId: 10, author: { login: "bot" }, body: "Fix" },
                  { databaseId: 11, author: null, body: "Done" },
                ],
              },
            },
            {
              id: "PRRT_2",
              isResolved: true,
              isOutdated: true,
              path: "b.ts",
              line: null,
              comments: { nodes: [] },
            },
          ],
        },
      },
    },
  },
};

describe("reviews and their comments", () => {
  const onLine = {
    id: 8,
    user: { login: "acme" },
    body: "Rename it.",
    created_at: "2026-11-09T12:02:00Z",
    path: "a.ts",
    line: 3,
  };
  const comment = {
    id: 8,
    author: "acme",
    body: "Rename it.",
    createdAt: "2026-11-09T12:02:00Z",
    path: "a.ts",
    line: 3,
  };

  it("returns a pull request's reviews in the factory's words, one with no body as empty", async () => {
    const { p } = pulls([
      [
        /pulls\/5\/reviews\?/,
        [
          [
            {
              id: 7,
              user: { login: "acme" },
              body: null,
              submitted_at: "2026-11-09T12:03:00Z",
            },
          ],
        ],
      ],
    ]);
    expect(await p.reviews(5)).toEqual([
      {
        id: 7,
        author: "acme",
        body: "",
        submittedAt: "2026-11-09T12:03:00Z",
      },
    ]);
  });

  it("returns the comments one review left, each with its file and line", async () => {
    const { p } = pulls([[/pulls\/5\/reviews\/7\/comments/, [[onLine]]]]);
    expect(await p.reviewCommentsOf(5, 7)).toEqual([comment]);
  });

  it("says which comment a reply in a thread replies to", async () => {
    const { p } = pulls([
      [
        /pulls\/5\/reviews\/7\/comments/,
        [[{ ...onLine, id: 9, in_reply_to_id: 8 }]],
      ],
    ]);
    expect(await p.reviewCommentsOf(5, 7)).toEqual([
      { ...comment, id: 9, replyTo: 8 },
    ]);
  });

  it("returns every review comment on a pull request", async () => {
    const { p } = pulls([[/pulls\/5\/comments\?/, [[onLine]]]]);
    expect(await p.reviewComments(5)).toEqual([comment]);
  });
});

describe("threads, resolve, ready, and closes", () => {
  it("reads threads with GraphQL", async () => {
    const { p, calls } = pulls([[/ReviewThreads/, graphThreads]]);
    const threads = await p.threads(5);
    expect(threads[0]).toEqual({
      commentId: 10,
      nodeId: "PRRT_1",
      isResolved: false,
      isOutdated: false,
      path: "a.ts",
      line: 3,
      comments: [
        { id: 10, author: "bot", body: "Fix" },
        { id: 11, author: "ghost", body: "Done" },
      ],
    });
    expect(threads[1].commentId).toBe(0);
    expect(calls[0]).toContain("number=5");
  });

  it("resolves the thread holding a comment by its node ID", async () => {
    const { p, calls } = pulls([
      [/ReviewThreads/, graphThreads],
      [/ResolveThread/, { data: {} }],
    ]);
    await p.resolve(5, 11);
    expect(calls[1]).toMatch(/ResolveThread.*id=PRRT_1/);
  });

  it("fails to resolve when no thread holds the comment", async () => {
    const { p } = pulls([[/ReviewThreads/, graphThreads]]);
    await expect(p.resolve(5, 99)).rejects.toThrow(
      "No review thread on #5 holds comment 99.",
    );
  });

  it("marks ready with gh pr ready", async () => {
    const { p, calls } = pulls([[/^pr ready/, ""]]);
    await p.ready(5);
    expect(calls).toEqual(["pr ready 5 --repo acme/widgets"]);
  });

  it("refuses to mark ready with no CLI", async () => {
    const { p } = pulls([], false);
    await expect(p.ready(5)).rejects.toThrow("needs the GitHub CLI");
  });

  it("reads the closing issues with GraphQL", async () => {
    const { p } = pulls([
      [
        /ClosingIssues/,
        {
          data: {
            repository: {
              pullRequest: {
                closingIssuesReferences: { nodes: [{ number: 261 }] },
              },
            },
          },
        },
      ],
    ]);
    expect(await p.closes(5)).toEqual(["261"]);
  });
});

describe("the default branch, open threads, and unverified commits", () => {
  it.each([
    [true, true],
    [false, false],
  ])("reads whether the repository is private (%s)", async (given, said) => {
    const { p, calls } = pulls([
      [
        /^api repos\/acme\/widgets$/,
        { default_branch: "main", private: given },
      ],
    ]);
    expect(await p.isPrivate()).toBe(said);
    expect(calls).toEqual(["api repos/acme/widgets"]);
  });

  it.each([
    ["Organization", true],
    ["User", false],
  ])(
    "reads whether an organization owns the repository (%s)",
    async (type, said) => {
      const { p } = pulls([
        [/^api repos\/acme\/widgets$/, { owner: { login: "acme", type } }],
      ]);
      expect(await p.ownerIsOrganization()).toBe(said);
    },
  );

  it("reads the repository's default branch", async () => {
    const { p, calls } = pulls([
      [/^api repos\/acme\/widgets$/, { default_branch: "trunk" }],
    ]);
    expect(await p.defaultBranch()).toBe("trunk");
    expect(calls).toEqual(["api repos/acme/widgets"]);
  });

  it("counts the review threads not resolved", async () => {
    const { p } = pulls([
      [
        /reviewThreads/,
        {
          data: {
            repository: {
              pullRequest: {
                reviewThreads: {
                  nodes: [
                    { isResolved: false },
                    { isResolved: true },
                    { isResolved: false },
                  ],
                },
              },
            },
          },
        },
      ],
    ]);
    expect(await p.openThreadCount(5)).toBe(2);
  });

  it("lists each commit GitHub does not show as verified with its reason, and one with no verification as unknown", async () => {
    const commit = (sha: string, verified: boolean, reason: string) => ({
      sha,
      commit: { verification: { verified, reason } },
    });
    const { p } = pulls([
      [
        /pulls\/9\/commits/,
        [
          commit("aaaaaaa1111111", true, "valid"),
          commit("bbbbbbb2222222", false, "unsigned"),
          { sha: "ccccccc3333333", commit: {} },
        ],
      ],
    ]);
    expect(await p.unverifiedCommits(9)).toEqual([
      "bbbbbbb unsigned",
      "ccccccc unknown",
    ]);
  });

  describe("a pull request's commits, and whose GitHub verifies each is", () => {
    const BOT = "dependabot[bot]";
    const raw = (
      author: string | null,
      committer: string | null,
      verified?: boolean,
    ) => ({
      sha: "abc",
      author: author === null ? null : { login: author },
      committer: committer === null ? null : { login: committer },
      commit: verified === undefined ? {} : { verification: { verified } },
    });

    it.each<[string, ReturnType<typeof raw>, string | null]>([
      ["GitHub signed for its author", raw(BOT, "web-flow", true), BOT],
      ["its author signed", raw("alice", "alice", true), "alice"],
      ["whose signature GitHub refuses", raw(BOT, "web-flow", false), null],
      ["with no word on a signature", raw(BOT, "web-flow"), null],
      ["someone else signed in its author's name", raw(BOT, "bob", true), null],
      ["signed by no account", raw(BOT, null, true), null],
      ["whose author has no account", raw(null, "web-flow", true), null],
    ])("reads a commit %s", async (_, commit, verifiedAuthor) => {
      const { p } = pulls([[/pulls\/9\/commits/, [[commit]]]]);
      expect(await p.commits(9)).toEqual([{ sha: "abc", verifiedAuthor }]);
    });

    it("reads every page, and refuses a list as long as the most GitHub lists", async () => {
      const page = (n: number) =>
        Array.from({ length: n }, () => raw(BOT, "web-flow", true));
      const { p } = pulls([
        [/--paginate .*pulls\/9\/commits/, [page(100), page(100), page(49)]],
        [/--paginate .*pulls\/8\/commits/, [page(100), page(100), page(50)]],
      ]);
      expect(await p.commits(9)).toHaveLength(249);
      await expect(p.commits(8)).rejects.toThrow(
        "GitHub lists at most 250 commits of #8, so there may be more.",
      );
    });
  });
});

describe("who added a label", () => {
  const event = (event: string, label: string, login: string | null) => ({
    event,
    label: { name: label },
    actor: login === null ? null : { login },
  });

  it.each<[string, unknown[][], string | null]>([
    [
      "the newest account to add it, on the last page",
      [
        [event("labeled", "pass", "alice"), event("unlabeled", "pass", "bot")],
        [event("labeled", "pass", "bob")],
      ],
      "bob",
    ],
    [
      "nobody once it is removed",
      [[event("labeled", "pass", "alice"), event("unlabeled", "pass", "bob")]],
      null,
    ],
    [
      "its own adder, whatever happened since to anything else",
      [
        [
          event("labeled", "pass", "alice"),
          event("labeled", "bug", "bob"),
          event("unlabeled", "bug", "bob"),
          { event: "closed", actor: { login: "bob" } },
        ],
      ],
      "alice",
    ],
    [
      "an app's bot, as a bot",
      [[event("labeled", "pass", "github-actions[bot]")]],
      "github-actions[bot]",
    ],
    ["nobody for a deleted account", [[event("labeled", "pass", null)]], null],
    ["nobody where no event adds it", [[]], null],
  ])("is %s", async (_, pages, who) => {
    const { p } = pulls([[/--paginate .*issues\/9\/events/, pages]]);
    expect(await p.labeledBy(9, "pass")).toBe(who);
  });
});

describe("the address of a pull request", () => {
  it("is its page on GitHub", () => {
    expect(pulls([]).p.address(5)).toBe(
      "https://github.com/acme/widgets/pull/5",
    );
  });
});

describe("where git reads a repository from", () => {
  it("is the repository's address on GitHub, whichever repository is asked for", () => {
    expect(pulls([]).p.remote("acme/factory-config")).toEqual({
      url: "https://github.com/acme/factory-config.git",
      host: "github.com",
    });
  });
});

describe("the open pull requests and those linking to tickets", () => {
  it("reads the open pull requests with this repository's closing references, open threads, and checks", async () => {
    const { p, calls } = pulls([
      [
        /OpenPulls/,
        {
          data: {
            repository: {
              pullRequests: {
                nodes: [
                  rawPull(361, {
                    author: null,
                    reviewThreads: {
                      nodes: [{ isResolved: false }, { isResolved: true }],
                    },
                    commits: {
                      nodes: [
                        { commit: { statusCheckRollup: { state: "SUCCESS" } } },
                      ],
                    },
                  }),
                ],
              },
            },
          },
        },
      ],
    ]);
    const [pull] = await p.open({ checks: true });
    expect(pull).toMatchObject({
      number: 361,
      closes: ["261"],
      openThreads: 1,
      checks: "SUCCESS",
      author: "ghost",
      comments: [],
    });
    expect(calls[0]).toContain("-F checks=true");
    expect(calls[0]).toContain("-F costs=false");
  });

  it("asks for the open pull requests' comments when the cost markers are wanted", async () => {
    const { p, calls } = pulls([
      [/OpenPulls/, { data: { repository: { pullRequests: { nodes: [] } } } }],
    ]);
    await p.open({ costs: true });
    expect(calls[0]).toContain("-F costs=true");
  });

  it("reads every page of the pull requests that linked to a ticket, less those it already has", async () => {
    const page = (next: string | null, sources: unknown[]): LinkingPage =>
      ({
        data: {
          repository: {
            open: {
              pageInfo: { hasNextPage: next !== null, endCursor: next },
              nodes: [
                { builders: { nodes: sources.map((source) => ({ source })) } },
              ],
            },
            closed: {
              nodes: [{ builders: { nodes: [{ source: rawPull(305) }] } }],
            },
          },
        },
      }) as LinkingPage;
    const pages = [
      page("c1", [rawPull(301), { number: 302 }, rawPull(303)]),
      page(null, [rawPull(304), {}]),
    ];
    let at = 0;
    const { p, calls } = pulls([[/LinkingPulls/, () => pages[at++]]]);
    const linking = await p.linking([303]);
    expect(linking.map((x) => x.number).sort()).toEqual([301, 304, 305]);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("after=c1");
  });

  it("reads the open pull requests over fetch, as the poller does", async () => {
    const f = (async () =>
      new Response(
        JSON.stringify({
          data: { repository: { pullRequests: { nodes: [rawPull(361)] } } },
        }),
      )) as unknown as typeof fetch;
    const p = githubCodeHost({
      transport: fetchTransport({ token: "t", fetch: f }),
      repository: REPO,
    });
    expect((await p.open()).map((x) => x.closes)).toEqual([["261"]]);
  });
});

describe("who the CLI is signed in as", () => {
  it("is the account GitHub names", async () => {
    const { p } = pulls([[/^api user$/, { login: "dave" }]]);
    expect(await p.signedInAs()).toBe("dave");
  });

  it.each([
    [
      "the CLI signed in as nobody",
      new GhError("gh api user: gh auth login", 4),
    ],
    [
      "a sign-in GitHub refuses",
      new Error("gh api user: Bad credentials (HTTP 401)"),
    ],
  ])("is not signed in for %s", async (_, error) => {
    const { p } = pulls([[/^api user$/, error]]);
    await expect(p.signedInAs()).rejects.toBeInstanceOf(NotSignedInError);
  });

  it("passes any other failure through as it came", async () => {
    const failure = new GhError("gh api user: connection refused", 1);
    const { p } = pulls([[/^api user$/, failure]]);
    await expect(p.signedInAs()).rejects.toBe(failure);
  });
});

describe("the newest pull request from a branch", () => {
  it.each([
    [{ number: 7, state: "open", merged_at: null }, "open"],
    [
      { number: 7, state: "closed", merged_at: "2026-11-20T10:00:00Z" },
      "merged",
    ],
    [{ number: 7, state: "closed", merged_at: null }, "closed"],
  ])("reads %j as %s", async (raw, state) => {
    const { p, calls } = pulls([[/pulls\?head=/, [raw]]]);
    expect(await p.lastForBranch("feature/dave/54")).toEqual({
      number: 7,
      state,
    });
    expect(calls).toEqual([
      "api repos/acme/widgets/pulls?head=acme:feature%2Fdave%2F54&state=all&sort=created&direction=desc&per_page=1",
    ]);
  });

  it("is null when no pull request came from the branch", async () => {
    const { p } = pulls([[/pulls\?head=/, []]]);
    expect(await p.lastForBranch("54")).toBeNull();
  });

  it("asks for a branch whose name has + or & as that name", async () => {
    const { p, calls } = pulls([[/pulls\?head=/, []]]);
    await p.lastForBranch("fix+54&more");
    expect(calls[0]).toContain("head=acme:fix%2B54%26more&state=all");
  });

  it("finds the open pull request of a branch whose name has + or &", async () => {
    const { p, calls } = pulls([[/pulls\?head=/, []]]);
    await p.forBranch("fix+54&more");
    expect(calls[0]).toContain("head=acme:fix%2B54%26more&state=open");
  });
});

describe("the factory's releases, and closing a pull request", () => {
  it("gives the tag of the newest release of the repository asked for", async () => {
    const { p, calls } = pulls([[/releases\/latest/, { tag_name: "v0.3.0" }]]);
    expect(await p.newestRelease("acme/factory")).toBe("v0.3.0");
    expect(calls).toEqual(["api repos/acme/factory/releases/latest"]);
  });

  it("gives null for a repository with no release", async () => {
    const { p } = pulls([[/releases\/latest/, notFound()]]);
    expect(await p.newestRelease("acme/factory")).toBeNull();
  });

  it("throws any other error reading the newest release", async () => {
    const { p } = pulls([[/releases\/latest/, new Error("HTTP 503")]]);
    await expect(p.newestRelease("acme/factory")).rejects.toThrow("HTTP 503");
  });

  it("gives the page of a release by its tag", () => {
    expect(pulls([]).p.releasePage("acme/factory", "v0.3.0")).toBe(
      "https://github.com/acme/factory/releases/tag/v0.3.0",
    );
  });

  it("closes a pull request", async () => {
    const { p, calls } = pulls([[/pulls\/41/, {}]]);
    await p.close(41);
    expect(calls).toEqual([
      "api -X PATCH repos/acme/widgets/pulls/41 -f state=closed",
    ]);
  });
});

/** A gh that answers by the first route whose pattern matches the joined
 * arguments, and records each call with the JSON body `--input` named and
 * what it was given on standard input. */
function recordingGh(routes: [RegExp, unknown | (() => unknown)][]) {
  const calls: { line: string; input?: unknown; stdin?: string }[] = [];
  const answer = (line: string) => {
    const route = routes.find(([p]) => p.test(line));
    if (!route) throw new Error(`unexpected gh call: ${line}`);
    const said =
      typeof route[1] === "function" ? (route[1] as () => unknown)() : route[1];
    if (said instanceof Error) throw said;
    return typeof said === "string" ? said : JSON.stringify(said);
  };
  const run = async (args: string[]) => {
    const line = args.join(" ");
    const at = args.indexOf("--input");
    calls.push({
      line,
      ...(at >= 0
        ? { input: JSON.parse(readFileSync(args[at + 1]!, "utf8")) }
        : {}),
    });
    return answer(line);
  };
  const runIn = async (args: string[], stdin: string) => {
    calls.push({ line: args.join(" "), stdin });
    return answer(args.join(" "));
  };
  return { run, runIn, calls };
}

describe("the rules and properties of a repository", () => {
  const host = (routes: [RegExp, unknown][]) => {
    const g = recordingGh(routes);
    return {
      h: githubCodeHost({ transport: ghTransport(g.run), repository: REPO }),
      calls: g.calls,
    };
  };
  const required = (context: string) => ({
    type: "required_status_checks",
    parameters: { required_status_checks: [{ context }] },
  });

  it("names GitHub Actions as the source of a required status when asked to", async () => {
    const { h, calls } = host([
      [/^api repos\/acme\/widgets\/rulesets/, []],
      [/-X POST repos\/acme\/widgets\/rulesets/, { id: 1 }],
    ]);
    await h.requireCheck("Software factory", "Review verdict", "runner");
    const body = calls[1]!.input as {
      rules: { parameters: { required_status_checks: unknown[] } }[];
    };
    expect(body.rules[0]!.parameters.required_status_checks).toEqual([
      { context: "Review verdict", integration_id: 15368 },
    ]);
  });

  it("says a status is required when a rule GitHub applies to the branch names it", async () => {
    const { h, calls } = host([
      [
        /rules\/branches\/main/,
        [[{ type: "deletion" }, required("Review verdict")]],
      ],
    ]);
    expect(await h.requiresStatus("main", "Review verdict")).toBe(true);
    expect(await h.requiresStatus("main", "Merge order")).toBe(false);
    expect(calls[0]!.line).toBe(
      "api --paginate --slurp repos/acme/widgets/rules/branches/main?per_page=100",
    );
  });

  it("says no status is required on a branch with no rules", async () => {
    const { h } = host([[/rules\/branches\/release%2F1/, [[]]]]);
    expect(await h.requiresStatus("release/1", "Review verdict")).toBe(false);
  });

  it("reads the repository's value for each property", async () => {
    const { h, calls } = host([
      [
        /properties\/values$/,
        [
          { property_name: "software-factory", value: "on" },
          { property_name: "team", value: null },
          { property_name: "languages", value: ["go", "ts"] },
        ],
      ],
    ]);
    expect(await h.properties()).toEqual({
      "software-factory": "on",
      team: null,
      languages: ["go", "ts"],
    });
    expect(calls[0]!.line).toBe("api repos/acme/widgets/properties/values");
  });

  it("says the owner defines a property its schema has", async () => {
    const { h, calls } = host([
      [
        /properties\/schema\/software-factory$/,
        { property_name: "software-factory", value_type: "single_select" },
      ],
    ]);
    expect(await h.ownerDefines("software-factory")).toBe(true);
    expect(calls[0]!.line).toBe(
      "api orgs/acme/properties/schema/software-factory",
    );
  });

  it("says the owner defines no property its schema lacks", async () => {
    const { h } = host([[/properties\/schema\//, notFound()]]);
    expect(await h.ownerDefines("software-factory")).toBe(false);
  });

  it("rejects when the owner will not show its schema, so a caller can tell that from a property that is not there", async () => {
    const { h } = host([
      [/properties\/schema\//, new Error("gh: Forbidden (HTTP 403)")],
    ]);
    await expect(h.ownerDefines("software-factory")).rejects.toThrow(
      "Forbidden",
    );
  });

  const UPGRADE = new Error(
    "gh api --paginate --slurp repos/acme/widgets/rules/branches/main?per_page=100: gh: Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)",
  );

  it("says the plan has no branch rules for the repository, in its own words, when that is why the rules cannot be read", async () => {
    const { h } = host([[/rules\/branches\/main/, UPGRADE]]);
    const refusal = await h.requiresStatus("main", "Review verdict").then(
      () => null,
      (e: unknown) => e,
    );
    expect(refusal).toBeInstanceOf(NoRulesError);
    expect((refusal as Error).message).toBe(
      "GitHub Free has no branch rules for a private repository",
    );
  });

  it("rejects as it was refused for any other reason the rules cannot be read", async () => {
    const { h } = host([
      [
        /rules\/branches\/main/,
        new Error("gh: Resource not accessible by integration (HTTP 403)"),
      ],
    ]);
    const refusal = await h.requiresStatus("main", "Review verdict").then(
      () => null,
      (e: unknown) => e,
    );
    expect(refusal).not.toBeInstanceOf(NoRulesError);
    expect(String(refusal)).toContain("Resource not accessible");
  });

  describe("whether the secrets the owner shares reach the repository", () => {
    const withheld = (isPrivate: boolean, organization: unknown) =>
      host([
        [/^api repos\/acme\/widgets$/, { private: isPrivate }],
        [/^api orgs\/acme$/, organization],
      ]).h.secretsWithheldBy();

    it("names the plan that keeps them from a private repository", async () => {
      expect(await withheld(true, { plan: { name: "free" } })).toBe(
        "GitHub Free",
      );
    });

    it("says they reach a repository anyone can read, whatever the plan", async () => {
      expect(await withheld(false, { plan: { name: "free" } })).toBeNull();
    });

    it("says they reach a private repository on a plan that shares them", async () => {
      expect(await withheld(true, { plan: { name: "team" } })).toBeNull();
    });

    it("says they reach it when the plan cannot be read, as by a member who is no owner", async () => {
      expect(await withheld(true, { login: "acme" })).toBeNull();
      expect(
        await withheld(true, new Error("gh: Forbidden (HTTP 403)")),
      ).toBeNull();
    });
  });

  it("sets the repository's value for a property", async () => {
    const { h, calls } = host([[/properties\/values/, ""]]);
    await h.setProperty("software-factory", "on");
    expect(calls[0]!.line).toMatch(
      /^api -X PATCH repos\/acme\/widgets\/properties\/values --input /,
    );
    expect(calls[0]!.input).toEqual({
      properties: [{ property_name: "software-factory", value: "on" }],
    });
  });
});

describe("an organization's address, on GitHub", () => {
  it("names the owner of an address with or without a last slash", () => {
    expect(githubOwner("https://github.com/acme")).toBe("acme");
    expect(githubOwner("https://github.com/acme/")).toBe("acme");
  });

  it("names no owner for a repository's address, a bare host, or plain http", () => {
    expect(githubOwner("https://github.com/acme/web")).toBeNull();
    expect(githubOwner("https://github.com/")).toBeNull();
    expect(githubOwner("http://github.com/acme")).toBeNull();
    expect(githubOwner("https://github.com/acme?tab=repositories")).toBeNull();
    expect(githubOwner("acme")).toBeNull();
  });

  it("serves github.com and no other host", () => {
    expect(githubServes("https://github.com/acme/web")).toBe(true);
    expect(githubServes("http://github.com/acme")).toBe(true);
    expect(githubServes("https://code.acme.example/acme")).toBe(false);
    expect(githubServes("acme")).toBe(false);
  });
});

describe("the code hosts an organization can be set up on", () => {
  it("has GitHub, which opens an organization over the GitHub CLI", async () => {
    const g = recordingGh([
      [/^api users\/acme$/, { type: "Organization" }],
      [/^secret set/, ""],
    ]);
    const { github } = organizationHosts(g.run, g.runIn);
    expect(github!.label).toBe("GitHub");
    expect(github!.addressOf("acme")).toBe("https://github.com/acme");
    expect(github!.ownerOf("https://github.com/acme/")).toBe("acme");
    expect(github!.serves("https://gitlab.com/acme")).toBe(false);
    const organization = github!.organization("acme");
    expect(await organization.kind()).toBe("organization");
    await organization.setSecret("A", "value");
    expect(g.calls.at(-1)).toEqual({
      line: "secret set A --org acme --visibility all",
      stdin: "value",
    });
  });
});

describe("an organization, on GitHub", () => {
  const SECRET = "-----BEGIN RSA PRIVATE KEY-----\nkey\n-----END-----";
  function org(
    routes: [RegExp, unknown][],
    extra: Partial<Parameters<typeof githubOrganization>[0]> = {},
  ) {
    const g = recordingGh(routes);
    return {
      o: githubOrganization({
        transport: ghTransport(g.run),
        name: "acme",
        cli: g.runIn,
        ...extra,
      }),
      calls: g.calls,
    };
  }
  /** GitHub's answer about the signed-in token, with its scopes. */
  const scoped = (scopes: string | null) =>
    (async () =>
      new Response(JSON.stringify({ login: "priya" }), {
        headers: scopes === null ? {} : { "x-oauth-scopes": scopes },
      })) as unknown as typeof fetch;

  it("tells an organization from a person's account, and from no account", async () => {
    const { o, calls } = org([[/users\/acme$/, { type: "Organization" }]]);
    expect(await o.kind()).toBe("organization");
    expect(calls[0]!.line).toBe("api users/acme");
    expect(await org([[/users\/acme$/, { type: "User" }]]).o.kind()).toBe(
      "person",
    );
    expect(await org([[/users\/acme$/, notFound()]]).o.kind()).toBeNull();
  });

  it("fails when GitHub cannot be asked what the account is", async () => {
    const { o } = org([[/users\/acme$/, new Error("HTTP 503")]]);
    await expect(o.kind()).rejects.toThrow("HTTP 503");
  });

  it("gives the signed-in account's role", async () => {
    const membership = (role: string, state = "active") =>
      org([[/user\/memberships\/orgs\/acme$/, { role, state }]]).o.role();
    expect(await membership("admin")).toBe("owner");
    expect(await membership("member")).toBe("member");
    expect(await membership("admin", "pending")).toBeNull();
    expect(await org([[/memberships/, notFound()]]).o.role()).toBeNull();
    expect(
      await org([
        [/memberships/, new Error("gh: Forbidden (HTTP 403)")],
      ]).o.role(),
    ).toBeNull();
  });

  it("says what GitHub Free leaves out, and that any other plan has it", async () => {
    const plan = (name?: string) =>
      org([[/^api orgs\/acme$/, name ? { plan: { name } } : {}]]).o.plan();
    expect(await plan("free")).toEqual({
      name: "GitHub Free",
      rules: false,
      privateSecrets: false,
    });
    expect(await plan("team")).toEqual({
      name: "GitHub Team",
      rules: true,
      privateSecrets: true,
    });
    expect(await plan()).toEqual({
      name: "GitHub",
      rules: true,
      privateSecrets: true,
    });
  });

  it("names the permissions the GitHub CLI's sign-in lacks, and the command that asks for them", async () => {
    const lacks = (scopes: string | null, token: string | null = "gho_1") =>
      org([], { fetch: scoped(scopes), token: () => token }).o.signInLacks();
    expect(await lacks("gist, read:org, repo, workflow")).toEqual({
      scopes: ["admin:org", "project"],
      tool: "the GitHub CLI",
      fix: [
        "gh",
        "auth",
        "refresh",
        "-h",
        "github.com",
        "-s",
        "admin:org,project",
      ],
    });
    expect((await lacks("admin:org, project, repo"))!.scopes).toEqual([
      "workflow",
    ]);
    expect(await lacks("admin:org, project, repo, workflow")).toBeNull();
    // A token that carries no scopes, and no token at all, cannot say.
    expect(await lacks(null)).toBeNull();
    expect(await lacks("repo", null)).toBeNull();
  });

  it("asks GitHub about the sign-in with its token in a header, not an argument", async () => {
    const seen: { url: string; auth: string | null }[] = [];
    const { o, calls } = org([], {
      token: () => "gho_secret",
      fetch: (async (url: unknown, init: RequestInit = {}) => {
        seen.push({
          url: String(url),
          auth: new Headers(init.headers).get("authorization"),
        });
        return new Response("{}", {
          headers: { "x-oauth-scopes": "admin:org, project, workflow" },
        });
      }) as typeof fetch,
    });
    await o.signInLacks();
    expect(seen).toEqual([
      { url: "https://api.github.com/user", auth: "Bearer gho_secret" },
    ]);
    expect(calls).toEqual([]);
  });

  it("finds a repository of the organization's, or none", async () => {
    const { o, calls } = org([
      [/repos\/acme\/factory-config$/, { private: true }],
    ]);
    expect(await o.repository("factory-config")).toEqual({ isPrivate: true });
    expect(calls[0]!.line).toBe("api repos/acme/factory-config");
    expect(
      await org([[/repos\/acme/, notFound()]]).o.repository("factory-config"),
    ).toBeNull();
  });

  it("creates a repository, private or public", async () => {
    const { o, calls } = org([[/-X POST orgs\/acme\/repos/, { id: 1 }]]);
    await o.createRepository("factory-config", {
      isPrivate: true,
      description: "The software factory's settings",
    });
    expect(calls[0]!.input).toEqual({
      name: "factory-config",
      private: true,
      description: "The software factory's settings",
    });
  });

  it("reads a file's text, and null for one that is not there", async () => {
    const text = "version: 2\n# café\n";
    const { o, calls } = org([
      [
        /contents\/factory-preset\.yaml$/,
        {
          encoding: "base64",
          content: Buffer.from(text)
            .toString("base64")
            .replace(/(.{20})/g, "$1\n"),
        },
      ],
      [/contents\//, notFound()],
    ]);
    expect(await o.file("factory-config", "factory-preset.yaml")).toBe(text);
    expect(calls[0]!.line).toBe(
      "api repos/acme/factory-config/contents/factory-preset.yaml",
    );
    expect(
      await o.file("factory-config", ".github/workflows/factory-poller.yml"),
    ).toBeNull();
  });

  it("writes each file as a commit of its own, and names no file to replace", async () => {
    const { o, calls } = org([
      [/-X PUT repos\/acme\/factory-config\/contents\//, {}],
    ]);
    await o.putFiles("factory-config", {
      "README.md": "# Hello\n",
      ".github/workflows/factory-poller.yml": "name: Factory poller\n",
    });
    expect(calls.map((c) => c.line.split(" --input")[0])).toEqual([
      "api -X PUT repos/acme/factory-config/contents/README.md",
      "api -X PUT repos/acme/factory-config/contents/.github/workflows/factory-poller.yml",
    ]);
    expect(calls[0]!.input).toEqual({
      message: "Add README.md",
      content: Buffer.from("# Hello\n").toString("base64"),
    });
  });

  it("lists every page of the organization's secrets", async () => {
    const first = Array.from({ length: 100 }, (_, i) => ({ name: `S${i}` }));
    const { o } = org([
      [
        /orgs\/acme\/actions\/secrets\?per_page=100&page=1$/,
        { secrets: first },
      ],
      [
        /orgs\/acme\/actions\/secrets\?per_page=100&page=2$/,
        { secrets: [{ name: "FACTORY_APP_PRIVATE_KEY" }] },
      ],
    ]);
    const names = await o.secretNames();
    expect(names).toHaveLength(101);
    expect(names.at(-1)).toBe("FACTORY_APP_PRIVATE_KEY");
  });

  it("stores a secret for every repository, with its value on standard input", async () => {
    const { o, calls } = org([[/^secret set/, ""]]);
    await o.setSecret("FACTORY_APP_PRIVATE_KEY", SECRET);
    expect(calls).toEqual([
      {
        line: "secret set FACTORY_APP_PRIVATE_KEY --org acme --visibility all",
        stdin: SECRET,
      },
    ]);
  });

  it("refuses to store a secret without the GitHub CLI", async () => {
    const { o } = org([], { cli: undefined });
    await expect(o.setSecret("A", "b")).rejects.toThrow(
      "Storing a secret needs the GitHub CLI.",
    );
  });

  it("reads a variable, and null for one that is not set", async () => {
    const { o, calls } = org([
      [/variables\/FACTORY_APP_CLIENT_ID$/, { value: "Iv23client" }],
    ]);
    expect(await o.variable("FACTORY_APP_CLIENT_ID")).toBe("Iv23client");
    expect(calls[0]!.line).toBe(
      "api orgs/acme/actions/variables/FACTORY_APP_CLIENT_ID",
    );
    expect(
      await org([[/variables/, notFound()]]).o.variable(
        "FACTORY_APP_CLIENT_ID",
      ),
    ).toBeNull();
  });

  it("stores a variable for every repository", async () => {
    const { o, calls } = org([[/^variable set/, ""]]);
    await o.setVariable("FACTORY_APP_CLIENT_ID", "Iv23client");
    expect(calls).toEqual([
      {
        line: "variable set FACTORY_APP_CLIENT_ID --org acme --visibility all",
        stdin: "Iv23client",
      },
    ]);
  });

  it("defines a property with the values given, which a repository's own actors may set", async () => {
    const { o, calls } = org([[/properties\/schema/, {}]]);
    await o.defineProperty("software-factory", ["on", "off"]);
    expect(calls[0]!.line).toMatch(
      /^api -X PUT orgs\/acme\/properties\/schema\/software-factory --input /,
    );
    expect(calls[0]!.input).toEqual({
      value_type: "single_select",
      required: false,
      allowed_values: ["on", "off"],
      values_editable_by: "org_and_repo_actors",
    });
  });

  it("lists the names of the organization's rules", async () => {
    const { o, calls } = org([
      [/orgs\/acme\/rulesets/, [[{ name: "Software factory" }, { name: "x" }]]],
    ]);
    expect(await o.ruleNames()).toEqual(["Software factory", "x"]);
    expect(calls[0]!.line).toBe(
      "api --paginate --slurp orgs/acme/rulesets?per_page=100",
    );
  });

  it("requires a status from GitHub Actions where a property has a value", async () => {
    const { o, calls } = org([
      [/--slurp orgs\/acme\/rulesets/, [[]]],
      [/-X POST orgs\/acme\/rulesets/, { id: 1 }],
    ]);
    await o.requireCheckWhere("Software factory", "Review verdict", {
      property: "software-factory",
      value: "on",
      source: "runner",
    });
    expect(calls[1]!.input).toEqual({
      name: "Software factory",
      target: "branch",
      enforcement: "active",
      conditions: {
        ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] },
        repository_property: {
          include: [{ name: "software-factory", property_values: ["on"] }],
          exclude: [],
        },
      },
      rules: [
        {
          type: "required_status_checks",
          parameters: {
            required_status_checks: [
              { context: "Review verdict", integration_id: 15368 },
            ],
            strict_required_status_checks_policy: false,
            do_not_enforce_on_create: true,
          },
        },
      ],
    });
  });

  it("leaves an organization's rule of that name as it is", async () => {
    const { o, calls } = org([
      [/--slurp orgs\/acme\/rulesets/, [[{ name: "Software factory" }]]],
    ]);
    await o.requireCheckWhere("Software factory", "Review verdict", {
      property: "software-factory",
      value: "on",
    });
    expect(calls).toHaveLength(1);
  });

  it("names the organization's app, within the 34 characters GitHub allows", () => {
    expect(org([]).o.appName()).toEqual({
      name: "Software Factory for acme",
      shortened: false,
    });
    expect(
      org([], { name: "a-very-long-organization-name" }).o.appName(),
    ).toEqual({ name: "Software Factory for a-very-long-o", shortened: true });
  });

  it("finds the app of a name by the address GitHub gives it", async () => {
    const { o, calls } = org([
      [/apps\/software-factory-for-acme$/, { owner: { login: "acme" } }],
    ]);
    expect(await o.appNamed("Software Factory for acme")).toEqual({
      owner: "acme",
    });
    expect(calls[0]!.line).toBe("api apps/software-factory-for-acme");
    expect(
      await org([[/apps\//, notFound()]]).o.appNamed(
        "Software Factory for acme",
      ),
    ).toBeNull();
  });

  const INSTALLATIONS = {
    installations: [
      { id: 1, client_id: "Iv23other", app_slug: "other" },
      {
        id: 52811,
        client_id: "Iv23client",
        app_slug: "software-factory-for-acme",
        repository_selection: "selected",
        html_url:
          "https://github.com/organizations/acme/settings/installations/52811",
      },
    ],
  };

  it("finds the installation of an app by its client ID", async () => {
    const { o } = org([
      [/orgs\/acme\/installations\?per_page=100&page=1$/, INSTALLATIONS],
      [
        /apps\/software-factory-for-acme$/,
        { name: "Software Factory for acme" },
      ],
    ]);
    expect(await o.installation("Iv23client")).toEqual({
      id: 52811,
      app: "Software Factory for acme",
      slug: "software-factory-for-acme",
      all: false,
      page: "https://github.com/organizations/acme/settings/installations/52811",
    });
    expect(await o.installation("Iv23absent")).toBeNull();
  });

  it("names an installed app by its address when GitHub will not give its name", async () => {
    const { o } = org([
      [/orgs\/acme\/installations/, INSTALLATIONS],
      [/apps\//, notFound()],
    ]);
    expect((await o.installation("Iv23client"))!.app).toBe(
      "software-factory-for-acme",
    );
  });

  it("waits for an installation, looking every 3 seconds", async () => {
    let looks = 0;
    const slept: number[] = [];
    const { o } = org(
      [
        [
          /orgs\/acme\/installations/,
          () => (++looks < 3 ? { installations: [] } : INSTALLATIONS),
        ],
        [/apps\//, { name: "Software Factory for acme" }],
      ],
      {
        clock: {
          now: () => slept.reduce((a, b) => a + b, 0),
          sleep: async (ms) => {
            slept.push(ms);
          },
        },
      },
    );
    expect((await o.awaitInstallation("Iv23client"))!.id).toBe(52811);
    expect(slept).toEqual([3000, 3000]);
  });

  it("gives up on an installation that has not shown after 10 minutes", async () => {
    let looks = 0;
    let at = 0;
    const { o } = org(
      [
        [
          /orgs\/acme\/installations/,
          () => {
            looks++;
            return { installations: [] };
          },
        ],
      ],
      {
        clock: {
          now: () => at,
          sleep: async (ms) => {
            at += ms;
          },
        },
      },
    );
    expect(await o.awaitInstallation("Iv23client")).toBeNull();
    expect(at).toBe(10 * 60 * 1000);
    // One look at the start, and one after each 3 seconds.
    expect(looks).toBe(201);
  });

  it("counts an installation's repositories as the app, not as the signed-in account", async () => {
    const asked: string[] = [];
    const { o, calls } = org([], {
      clock: { now: () => 0, sleep: async () => {} },
      fetch: (async (url: unknown) => {
        asked.push(String(url).replace("https://api.github.com/", ""));
        return new Response(
          JSON.stringify(
            String(url).endsWith("access_tokens")
              ? { token: "ghs_1" }
              : { total_count: 1, repositories: [{ name: "factory-config" }] },
          ),
        );
      }) as typeof fetch,
    });
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    expect(
      await o.installedOn(
        52811,
        {
          clientId: "Iv23client",
          key: privateKey.export({ type: "pkcs1", format: "pem" }).toString(),
        },
        "factory-config",
      ),
    ).toEqual({ count: 1, covered: true });
    expect(asked).toEqual([
      "app/installations/52811/access_tokens",
      "installation/repositories?per_page=100&page=1",
    ]);
    expect(calls).toEqual([]);
  });

  it("registers an app through the manifest form, and sends the browser to install it on the organization", async () => {
    let visit!: (path: string) => Promise<Reply>;
    const opened: string[] = [];
    const kept: string[] = [];
    const { o } = org([[/^api orgs\/acme$/, { id: 4242 }]], {
      state: () => "state-1",
      listen: async (handle) => {
        visit = handle;
        return { origin: "http://127.0.0.1:4100", close: async () => {} };
      },
      fetch: (async () =>
        new Response(
          JSON.stringify({
            id: 9,
            slug: "software-factory-for-acme",
            client_id: "Iv23client",
            pem: SECRET,
          }),
        )) as unknown as typeof fetch,
    });
    const result = o.registerApp({
      name: "Software Factory for acme",
      open: (page) => opened.push(page),
      pasted: (signal) =>
        new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(new Error("stopped"))),
        ),
      keep: async (app) => {
        kept.push(app.key);
      },
    });
    await expect.poll(() => opened).toEqual(["http://127.0.0.1:4100/"]);
    expect((await visit("/")).body).toContain("state=state-1");
    const reply = await visit("/registered?code=c1&state=state-1");
    expect(reply.headers).toEqual({
      location:
        "https://github.com/apps/software-factory-for-acme/installations/new/permissions?suggested_target_id=4242",
    });
    expect(await result).toEqual({
      id: 9,
      slug: "software-factory-for-acme",
      clientId: "Iv23client",
      installPage:
        "https://github.com/apps/software-factory-for-acme/installations/new/permissions?suggested_target_id=4242",
    });
    expect(kept).toEqual([SECRET]);
  });

  describe("the organization's app, before it is installed", () => {
    const APP = {
      name: "Software Factory for acme",
      slug: "software-factory-for-acme",
      client_id: "Iv23client",
      owner: { login: "Acme", id: 4242 },
    };
    const registered = (answer: unknown) =>
      org([[/^api apps\/software-factory-for-acme$/, answer]]).o.registeredApp(
        "Iv23client",
      );

    it("is found by the name it was registered under, with the page that installs it", async () => {
      expect(await registered(APP)).toEqual({
        name: "Software Factory for acme",
        slug: "software-factory-for-acme",
        installPage:
          "https://github.com/apps/software-factory-for-acme/installations/new/permissions?suggested_target_id=4242",
      });
    });

    it("is not found when no app has that name, as when she typed another in the form", async () => {
      expect(await registered(notFound())).toBeNull();
    });

    it("is not another account's app of that name, or another app of the organization's", async () => {
      expect(
        await registered({ ...APP, owner: { login: "someone", id: 7 } }),
      ).toBeNull();
      expect(await registered({ ...APP, client_id: "Iv23other" })).toBeNull();
    });

    it("is not found when GitHub cannot be asked", async () => {
      expect(await registered(new Error("HTTP 503"))).toBeNull();
    });
  });

  it("gives the page of a file in one of the organization's repositories", () => {
    expect(org([]).o.filePage("factory-config", "factory-preset.yaml")).toBe(
      "https://github.com/acme/factory-config/blob/HEAD/factory-preset.yaml",
    );
  });

  it("gives the page that lists the organization's apps", () => {
    expect(org([]).o.appsPage()).toBe(
      "https://github.com/organizations/acme/settings/apps",
    );
  });
});
