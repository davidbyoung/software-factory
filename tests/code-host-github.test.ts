import { describe, expect, it } from "vitest";
import {
  githubCodeHost,
  type LinkingPage,
  type RawPull,
} from "../src/code-host/github.mts";
import { NotSignedInError } from "../src/code-host/types.mts";
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
