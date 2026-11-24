import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BOARD_QUERY,
  ISSUES_QUERY,
  commentIdFromUrl,
  githubTickets,
  type BoardPage,
  type IssuesPage,
  type RawIssue,
} from "../src/tickets/github.mts";
import {
  HttpError,
  fetchTransport,
  ghTransport,
  nextLink,
  statusOf,
  type Transport,
} from "../src/tickets/transport.mts";
import {
  NotFoundError,
  readAll,
  supports,
  type Ticket,
} from "../src/tickets/types.mts";
import { fakeGh } from "./fake-gh";
import { memoryTickets } from "./memory-tickets";
import recordedPages from "./fixtures/sync/repo-graphql.json";
import saved from "./fixtures/sync/repo.json";

const REPO = "acme/widgets";
const notFound = () => new Error("gh api: Not Found (HTTP 404)");
const serverError = () => new Error("gh api: Server Error (HTTP 500)");

const restIssue = (n: number, extra: Record<string, unknown> = {}) => ({
  number: n,
  id: 9000 + n,
  node_id: `I_${n}`,
  title: `Ticket ${n}`,
  state: "open",
  closed_at: null,
  body: `Body ${n}`,
  labels: [{ name: "enhancement" }],
  ...extra,
});
/** The read a write makes first, to check the number is an issue. */
const ISSUE_7: [RegExp, unknown] = [
  /^api repos\/acme\/widgets\/issues\/7$/,
  restIssue(7),
];
const GET_7 = "api repos/acme/widgets/issues/7";
const restComment = (id: number) => ({
  id,
  created_at: "2026-11-09T12:00:00Z",
  body: `Comment ${id}`,
  user: { login: "acme" },
});

function tickets(
  routes: Parameters<typeof fakeGh>[0],
  opts: {
    cli?: boolean;
    board?: number | null;
  } = {},
) {
  const gh = fakeGh(routes);
  const t = githubTickets({
    transport: ghTransport(gh.run),
    repository: REPO,
    board: opts.board === undefined ? 1 : opts.board,
    cli: opts.cli ? gh.run : undefined,
  });
  return { t, calls: gh.calls };
}

const rawIssue = (n: number, state: "OPEN" | "CLOSED" = "OPEN"): RawIssue => ({
  number: n,
  title: `Ticket ${n}`,
  state,
  closedAt: state === "CLOSED" ? "2026-11-09T10:00:00Z" : null,
  body: `Body ${n}`,
  labels: { nodes: [{ name: "enhancement" }] },
  comments: {
    nodes: [
      {
        databaseId: n * 10,
        createdAt: "2026-11-09T12:00:00Z",
        body: `Comment on ${n}`,
        author: n === 2 ? null : { login: "acme" },
      },
    ],
  },
});

const issuesPage = (
  open: RawIssue[],
  closed: RawIssue[],
  next: string | null,
): IssuesPage => ({
  data: {
    repository: {
      open: {
        pageInfo: { hasNextPage: next !== null, endCursor: next },
        nodes: open,
      },
      closed: { nodes: closed },
    },
  },
});

const boardPage = (
  items: { n: number; repo?: string; status?: string }[],
  next: string | null = null,
): BoardPage => ({
  data: {
    owner: {
      projectV2: {
        id: "PVT_1",
        fields: {
          nodes: [
            {
              id: "F_status",
              name: "Status",
              dataType: "SINGLE_SELECT",
              options: [
                { id: "O_ready", name: "Ready" },
                { id: "O_backlog", name: "Backlog" },
              ],
            },
            { id: "F_session", name: "Session", dataType: "TEXT" },
            { id: "F_cost", name: "Cost", dataType: "NUMBER" },
          ],
        },
        items: {
          pageInfo: { hasNextPage: next !== null, endCursor: next },
          nodes: items.map((i) => ({
            id: `PVTI_${i.n}`,
            content: {
              number: i.n,
              repository: { nameWithOwner: i.repo ?? REPO },
            },
            status: {
              name: i.status ?? "Ready",
              updatedAt: "2026-11-09T11:00:00Z",
            },
            session: { text: "" },
            runsIn: null,
            cost: { number: 1.5 },
          })),
        },
      },
    },
  },
});

describe("the GitHub CLI transport", () => {
  it("reads an answer that is plain text as it is, with one call", async () => {
    const gh = fakeGh([
      [/actions\/jobs\/51\/logs$/, "first line\nError: it broke\n"],
    ]);

    expect(
      await ghTransport(gh.run).text(`repos/${REPO}/actions/jobs/51/logs`),
    ).toBe("first line\nError: it broke\n");
    // Without the flag the CLI refuses to print an answer that holds a
    // terminal's color codes, as a job's log does.
    expect(gh.calls).toEqual([
      `api --allow-escape-sequences repos/${REPO}/actions/jobs/51/logs`,
    ]);
  });
});

describe("transport helpers", () => {
  it("nextLink reads the next page's address from a Link header", () => {
    expect(
      nextLink(
        '<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=5>; rel="last"',
      ),
    ).toBe("https://api.github.com/x?page=2");
    expect(
      nextLink('<https://api.github.com/x?page=1>; rel="prev"'),
    ).toBeNull();
    expect(nextLink(null)).toBeNull();
  });

  it("statusOf reads an HttpError's status, or gh's HTTP code in the message", () => {
    expect(statusOf(new HttpError(404, "gone"))).toBe(404);
    expect(statusOf(notFound())).toBe(404);
    expect(statusOf(new Error("no network"))).toBeNull();
  });

  it("the gh transport rejects a GraphQL answer with errors", async () => {
    const gh = fakeGh([[/graphql/, { errors: [{ message: "bad field" }] }]]);
    await expect(ghTransport(gh.run).graphql("{x}")).rejects.toThrow(
      "bad field",
    );
  });
});

describe("GitHub adapter: read", () => {
  it("reads a ticket and every page of its comments", async () => {
    const { t, calls } = tickets([
      [/^api repos\/acme\/widgets\/issues\/7$/, restIssue(7)],
      [
        /--paginate --slurp repos\/acme\/widgets\/issues\/7\/comments/,
        [[restComment(1)], [restComment(2)]],
      ],
    ]);
    const ticket = await t.read("7");
    expect(ticket).toEqual({
      key: "7",
      title: "Ticket 7",
      finishedAt: null,
      labels: ["enhancement"],
      body: "Body 7",
      comments: [
        {
          id: "1",
          createdAt: "2026-11-09T12:00:00Z",
          body: "Comment 1",
          author: "acme",
        },
        {
          id: "2",
          createdAt: "2026-11-09T12:00:00Z",
          body: "Comment 2",
          author: "acme",
        },
      ],
      record: [],
    });
    expect(calls).toHaveLength(2);
  });

  it("reads a closed ticket as closed, with its close time", async () => {
    const { t } = tickets([
      [
        /issues\/8$/,
        restIssue(8, { state: "closed", closed_at: "2026-11-09T10:00:00Z" }),
      ],
      [/comments/, [[]]],
    ]);
    const ticket = await t.read("8");
    expect(ticket.finishedAt).toBe("2026-11-09T10:00:00Z");
  });

  it("fails as not found for a ticket that does not exist", async () => {
    const { t } = tickets([[/issues\/404$/, notFound()]]);
    await expect(t.read("404")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("fails as not found for a pull request's number", async () => {
    const { t } = tickets([[/issues\/9$/, restIssue(9, { pull_request: {} })]]);
    await expect(t.read("9")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("fails with the error itself, not as not found, on any other failure", async () => {
    const { t } = tickets([[/issues\/7$/, serverError()]]);
    const error = await t.read("7").catch((e) => e);
    expect(error).not.toBeInstanceOf(NotFoundError);
    expect(String(error)).toMatch(/HTTP 500/);
  });
});

describe("GitHub adapter: listUnfinished", () => {
  it("lists every open ticket over 100, leaving pull requests out", async () => {
    const first = Array.from({ length: 100 }, (_, i) => restIssue(i + 1));
    const second = [
      restIssue(101),
      restIssue(102, { pull_request: { url: "x" } }),
      restIssue(103, { labels: ["bug"] }),
    ];
    const { t, calls } = tickets([
      [
        /^api --paginate --slurp repos\/acme\/widgets\/issues\?state=open&per_page=100$/,
        [first, second],
      ],
    ]);
    const open = await t.listUnfinished();
    expect(open).toHaveLength(102);
    expect(open.map((x) => x.key)).not.toContain("102");
    expect(open.at(-1)).toEqual({
      key: "103",
      title: "Ticket 103",
      labels: ["bug"],
    });
    expect(calls).toHaveLength(1);
  });
});

describe("GitHub adapter: readAll", () => {
  it("reads every page of open tickets and the 30 closed ones with one query each, where GraphQL is open", async () => {
    const pages = [
      issuesPage([rawIssue(1), rawIssue(2)], [rawIssue(5, "CLOSED")], "c1"),
      issuesPage([rawIssue(3)], [rawIssue(5, "CLOSED")], null),
    ];
    let page = 0;
    const { t, calls } = tickets([[/Tickets\(/, () => pages[page++]]]);
    const read = await t.readAll();
    expect(
      read.map((x) => [x.key, x.finishedAt === null ? "open" : "closed"]),
    ).toEqual([
      ["1", "open"],
      ["2", "open"],
      ["3", "open"],
      ["5", "closed"],
    ]);
    expect(read[1].comments[0].author).toBe("ghost");
    expect(read[0].body).toBe("Body 1");
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("after=c1");
  });

  it("carries each ticket's card when asked for the board, null off the board", async () => {
    const { t } = tickets([
      [/Tickets\(/, issuesPage([rawIssue(1), rawIssue(2)], [], null)],
      [/Board\(/, boardPage([{ n: 1 }, { n: 2, repo: "someone/else" }])],
    ]);
    const read = await t.readAll!({ board: true });
    expect(read[0].card).toMatchObject({
      itemId: "PVTI_1",
      status: "Ready",
      updatedAt: "2026-11-09T11:00:00Z",
      cost: 1.5,
    });
    expect(read[1].card).toBeNull();
  });
});

describe("GitHub adapter: writes", () => {
  it("writes a ticket's title", async () => {
    const { t, calls } = tickets([[/-X PATCH/, {}], ISSUE_7]);
    await t.writeTitle("7", "New title");
    expect(calls).toEqual([
      GET_7,
      "api -X PATCH repos/acme/widgets/issues/7 -f title=New title",
    ]);
  });

  it("writes a ticket's body", async () => {
    const { t, calls } = tickets([[/-X PATCH/, {}], ISSUE_7]);
    await t.writeBody("7", "New body");
    expect(calls).toEqual([
      GET_7,
      "api -X PATCH repos/acme/widgets/issues/7 -f body=New body",
    ]);
  });

  it("comments, passing hidden markers through, and returns the comment's ID", async () => {
    const { t, calls } = tickets([[/-X POST/, { id: 55 }], ISSUE_7]);
    const body = "Text.\n\n<!-- work-status: refined -->\n<!-- agent -->";
    expect(await t.comment("7", body)).toBe("55");
    expect(calls).toEqual([
      GET_7,
      `api -X POST repos/acme/widgets/issues/7/comments -f body=${body}`,
    ]);
  });

  it("edits and deletes a comment by its ID", async () => {
    const { t, calls } = tickets([
      [/-X PATCH/, {}],
      [/-X DELETE/, ""],
    ]);
    await t.editComment("55", "Edited");
    await t.deleteComment("55");
    expect(calls).toEqual([
      "api -X PATCH repos/acme/widgets/issues/comments/55 -f body=Edited",
      "api -X DELETE repos/acme/widgets/issues/comments/55",
    ]);
  });

  // The reviewer-run record reposts on exactly this NotFoundError
  // (reviewers.test.ts, "posts the comment again when the earlier one was
  // deleted"); this is the translation of GitHub's 404 it relies on.
  it("fails as not found when editing or deleting a comment that is gone, which the reviewer-run record reposts on", async () => {
    const { t } = tickets([[/comments\/55/, notFound()]]);
    await expect(t.editComment("55", "x")).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(t.deleteComment("55")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("fails with the error, not as not found, when an edit fails otherwise", async () => {
    const { t } = tickets([[/comments\/55/, serverError()]]);
    const error = await t.editComment("55", "x").catch((e) => e);
    expect(error).not.toBeInstanceOf(NotFoundError);
    expect(String(error)).toMatch(/HTTP 500/);
  });

  it("opens a ticket with its labels and returns its number", async () => {
    const { t, calls } = tickets([[/-X POST/, { number: 300 }]]);
    expect(
      await t.open({ title: "Follow-ups", body: "B", labels: ["follow-up"] }),
    ).toBe("300");
    expect(calls).toEqual([
      "api -X POST repos/acme/widgets/issues -f title=Follow-ups -f body=B -f labels[]=follow-up",
    ]);
  });

  it("opens a ticket with no labels without sending any", async () => {
    const { t, calls } = tickets([[/-X POST/, { number: 301 }]]);
    await t.open({ title: "T", body: "B", labels: [] });
    expect(calls[0]).not.toContain("labels");
  });

  it("adds a label", async () => {
    const { t, calls } = tickets([[/-X POST/, [{ name: "spec" }]], ISSUE_7]);
    await t.addLabel("7", "spec");
    expect(calls).toEqual([
      GET_7,
      "api -X POST repos/acme/widgets/issues/7/labels -f labels[]=spec",
    ]);
  });

  it("removes a label, escaping its name", async () => {
    const { t, calls } = tickets([[/-X DELETE/, []], ISSUE_7]);
    await t.removeLabel("7", "merge: manual");
    expect(calls).toEqual([
      GET_7,
      "api -X DELETE repos/acme/widgets/issues/7/labels/merge%3A%20manual",
    ]);
  });

  it("treats removing a label the ticket lacks as done", async () => {
    const { t } = tickets([
      [/-X DELETE/, notFound()],
      [/^api repos\/acme\/widgets\/issues\/7$/, restIssue(7)],
    ]);
    await expect(t.removeLabel("7", "spec")).resolves.toBeUndefined();
  });

  it("fails as not found when removing a label from a ticket that does not exist", async () => {
    const { t } = tickets([
      [/-X DELETE/, notFound()],
      [/^api repos\/acme\/widgets\/issues\/404$/, notFound()],
    ]);
    await expect(t.removeLabel("404", "spec")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("gives the link text that closes a ticket on merge, and that builds part of one", () => {
    const { t } = tickets([]);
    expect(t.linkText("12", "closes")).toBe("Closes #12");
    expect(t.linkText("4", "part")).toBe("Part of #4");
  });

  it("reads the tickets a body closes and builds part of, each once, in the body's order", () => {
    const { t } = tickets([]);
    expect(
      t.linksIn(
        "Part of #4. closes #12, Closes #9 and Closes #12. A finding is on #3; #120 is not #12.",
      ),
    ).toEqual({ closes: ["12", "9"], partOf: ["4"] });
  });

  it("writes a ticket as #N, and another repository's as its key", () => {
    const { t } = tickets([]);
    expect(t.ref("12")).toBe("#12");
    expect(t.ref("octo/web#4")).toBe("octo/web#4");
  });

  it("takes a number as a key, and refuses another system's key or another repository's ticket", () => {
    const { t } = tickets([]);
    expect(t.key("12")).toBe("12");
    expect(() => t.key("PROJ-12")).toThrow(
      "PROJ-12 is not a ticket here: a GitHub ticket is its number, such as 12",
    );
    expect(() => t.key("#12")).toThrow("#12 is not a ticket here");
    expect(() => t.key("octo/web#4")).toThrow(
      "octo/web#4 is in another repository: the factory reads only its state as a blocker",
    );
  });

  it("refuses to write to a pull request's number, which GitHub's issues API would accept", async () => {
    const { t, calls } = tickets([
      [
        /^api repos\/acme\/widgets\/issues\/64$/,
        restIssue(64, { pull_request: {} }),
      ],
    ]);
    await expect(t.comment("64", "x")).rejects.toThrow("#64 was not found");
    await expect(t.addLabel("64", "spec")).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(t.read("64")).rejects.toBeInstanceOf(NotFoundError);
    expect(calls.filter((c) => c.includes("-X"))).toEqual([]);
  });

  it("gives the address of a ticket's page", () => {
    const { t } = tickets([]);
    expect(t.address("12")).toBe("https://github.com/acme/widgets/issues/12");
  });
});

describe("GitHub adapter: board", () => {
  it("reads every page of the board's cards for this repository", async () => {
    const pages = [
      boardPage([{ n: 1 }], "b1"),
      boardPage([{ n: 2, status: "Backlog" }]),
    ];
    let page = 0;
    const { t, calls } = tickets([[/Board\(/, () => pages[page++]]]);
    const board = await t.board!.read();
    expect(board.projectId).toBe("PVT_1");
    expect([...board.items.keys()]).toEqual(["1", "2"]);
    expect(board.items.get("2")?.status).toBe("Backlog");
    expect(calls[0]).toContain("owner=acme");
    expect(calls[0]).toContain("number=1");
    expect(calls[1]).toContain("after=b1");
  });

  it("reads a board an organization owns, as it reads a person's", async () => {
    // As GitHub answers: `user(login:)` finds no organization, and
    // `repositoryOwner(login:)` finds either kind of account.
    const project = boardPage([{ n: 1, repo: "acme/site" }]).data.owner!
      .projectV2;
    const read = async (owner: string) => {
      const run = async (args: string[]) => {
        const line = args.join(" ");
        const isUser = owner === "dave";
        if (/user\(login: \$owner\)/.test(line))
          return JSON.stringify({
            data: { user: isUser ? { projectV2: project } : null },
          });
        if (/repositoryOwner\(login: \$owner\)/.test(line))
          return JSON.stringify({ data: { owner: { projectV2: project } } });
        throw new Error(`unexpected gh call: ${line}`);
      };
      const t = githubTickets({
        transport: ghTransport(run),
        repository: `${owner}/site`,
        board: 3,
      });
      return t.board!.read();
    };
    expect((await read("acme")).projectId).toBe("PVT_1");
    expect((await read("dave")).projectId).toBe("PVT_1");
  });

  describe("the repositories with a ticket in a column", () => {
    const item = (repo: string, status: string | null, state = "OPEN") => ({
      content: { state, repository: { nameWithOwner: repo } },
      status: status === null ? null : { name: status },
    });
    const page = (nodes: unknown[], endCursor: string | null = null) => ({
      data: {
        owner: {
          projectV2: {
            items: {
              pageInfo: { hasNextPage: endCursor !== null, endCursor },
              nodes,
            },
          },
        },
      },
    });

    it("names each repository once, in the board's order, from every page of the board asked for", async () => {
      const pages = [
        page(
          [
            item("acme/web", "Ready"),
            item("acme/api", "Backlog"),
            item("acme/web", "Ready"),
          ],
          "p1",
        ),
        page([item("acme/api", "ready"), item("acme/docs", null)]),
      ];
      let at = 0;
      const { t, calls } = tickets([
        [/ReadyRepositories\(/, () => pages[at++]],
      ]);

      expect(await t.board!.readyRepositories!(12, "Ready")).toEqual([
        "acme/web",
        "acme/api",
      ]);
      expect(calls).toHaveLength(2);
      expect(calls[0]).toContain("owner=acme");
      expect(calls[0]).toContain("number=12");
      expect(calls[1]).toContain("after=p1");
    });

    it("leaves out a closed ticket, a draft, and a pull request", async () => {
      const { t } = tickets([
        [
          /ReadyRepositories\(/,
          page([
            item("acme/web", "Ready", "CLOSED"),
            { content: {}, status: { name: "Ready" } },
            { content: null, status: { name: "Ready" } },
          ]),
        ],
      ]);

      expect(await t.board!.readyRepositories!(12, "Ready")).toEqual([]);
    });

    it("fails when the Project cannot be read", async () => {
      const { t } = tickets([
        [/ReadyRepositories\(/, { data: { owner: null } }],
      ]);

      await expect(t.board!.readyRepositories!(12, "Ready")).rejects.toThrow(
        "The Project could not be read.",
      );
    });
  });

  it("reads an empty board when the settings name none", async () => {
    const { t, calls } = tickets([], { board: null });
    const board = await t.board!.read();
    expect(board.items.size).toBe(0);
    expect(calls).toEqual([]);
  });

  it("fails when the Project cannot be read", async () => {
    const { t } = tickets([[/Board\(/, { data: { owner: null } }]]);
    await expect(t.board!.read()).rejects.toThrow(
      "The Project could not be read.",
    );
  });

  it("adds a ticket to the board by its node ID, and returns the card's ID", async () => {
    const { t, calls } = tickets([
      [/Board\(/, boardPage([])],
      [/^api repos\/acme\/widgets\/issues\/7$/, restIssue(7)],
      [
        /AddCard/,
        { data: { addProjectV2ItemById: { item: { id: "PVTI_7" } } } },
      ],
    ]);
    expect(await t.board!.add("7")).toBe("PVTI_7");
    const add = calls.find((c) => c.includes("AddCard"))!;
    expect(add).toContain("project=PVT_1");
    expect(add).toContain("content=I_7");
  });

  it("sets an option, text, a number, and clears a field", async () => {
    const { t, calls } = tickets([
      [/Board\(/, boardPage([{ n: 1 }])],
      [/mutation/, { data: {} }],
    ]);
    await t.board!.set("PVTI_1", [
      { field: "Status", optionName: "Ready" },
      { field: "Session", text: "actions 123" },
      { field: "Cost", number: 18.75 },
      { field: "Session", clear: true },
    ]);
    const mutations = calls.filter((c) => c.includes("mutation"));
    expect(mutations).toHaveLength(4);
    expect(mutations[0]).toMatch(/SetOption.*option=O_ready/);
    expect(mutations[0]).toContain("field=F_status");
    expect(mutations[1]).toMatch(/SetText.*text=actions 123/);
    expect(mutations[2]).toContain("value: {number: 18.75}");
    expect(mutations[3]).toMatch(/ClearField.*field=F_session/);
    for (const m of mutations) expect(m).toContain("item=PVTI_1");
  });

  it("refuses an option the field lacks, a field the board lacks, and a cost that is not a number", async () => {
    const { t } = tickets([
      [/Board\(/, boardPage([{ n: 1 }])],
      [/mutation/, { data: {} }],
    ]);
    await expect(
      t.board!.set("PVTI_1", [{ field: "Status", optionName: "Shipped" }]),
    ).rejects.toThrow("has no Shipped");
    await expect(
      t.board!.set("PVTI_1", [{ field: "Runs in", optionName: "Local" }]),
    ).rejects.toThrow("no Runs in field");
    await expect(
      t.board!.set("PVTI_1", [{ field: "Cost", number: Number.NaN }]),
    ).rejects.toThrow("is not a number");
  });

  it("refuses to write with no board", async () => {
    const { t } = tickets([], { board: null });
    await expect(t.board!.set("x", [])).rejects.toThrow("no board");
    await expect(t.board!.add("1")).rejects.toThrow("no board");
  });
});

describe("GitHub adapter: blockers and label history", () => {
  it("lists what a ticket waits on, open or closed", async () => {
    const { t } = tickets([
      [
        /dependencies\/blocked_by/,
        [
          [
            { number: 3, state: "open" },
            { number: 4, state: "closed" },
          ],
        ],
      ],
    ]);
    expect(await t.blockers!.list("7")).toEqual([
      { key: "3", state: "open" },
      { key: "4", state: "closed" },
    ]);
  });

  it("names a blocker in another repository by that repository", async () => {
    const { t } = tickets([
      [
        /dependencies\/blocked_by/,
        [
          [
            {
              number: 9,
              state: "open",
              repository_url: "https://api.github.com/repos/acme/widgets",
            },
            {
              number: 4,
              state: "open",
              repository_url: "https://api.github.com/repos/octo/web",
            },
          ],
        ],
      ],
    ]);
    expect(await t.blockers!.list("12")).toEqual([
      { key: "9", state: "open" },
      { key: "octo/web#4", state: "open" },
    ]);
  });

  it("records and removes a blocker by the blocker's REST ID", async () => {
    const { t, calls } = tickets([
      [/^api repos\/acme\/widgets\/issues\/3$/, restIssue(3)],
      ISSUE_7,
      [/-X POST/, {}],
      [/-X DELETE/, ""],
    ]);
    await t.blockers!.add("7", "3");
    await t.blockers!.remove("7", "3");
    expect(calls).toContain(
      "api -X POST repos/acme/widgets/issues/7/dependencies/blocked_by -F issue_id=9003",
    );
    expect(calls).toContain(
      "api -X DELETE repos/acme/widgets/issues/7/dependencies/blocked_by/9003",
    );
  });

  it("says whether a label was ever removed", async () => {
    const events = [
      [
        { event: "labeled", label: { name: "spec" } },
        { event: "unlabeled", label: { name: "spec" } },
        { event: "unlabeled", label: { name: "bug" } },
      ],
    ];
    const { t } = tickets([[/events/, events]]);
    expect(await t.labelHistory!.wasRemoved("7", "spec")).toBe(true);
    expect(await t.labelHistory!.wasRemoved("7", "enhancement")).toBe(false);
  });
});

describe("GitHub adapter: fields", () => {
  const fieldsAnswer = {
    data: {
      repository: {
        issueFields: {
          nodes: [
            {
              __typename: "IssueFieldSingleSelect",
              id: "IF_pri",
              name: "Priority",
              description: null,
            },
            {
              __typename: "IssueFieldText",
              id: "IF_ac",
              name: "Acceptance criteria",
              description: "What must be true for this to be done",
            },
          ],
        },
      },
    },
  };

  it("lists the repository's issue fields, saying which hold text", async () => {
    const { t } = tickets([[/IssueFields\(/, fieldsAnswer]]);
    expect(await t.fields!.list()).toEqual([
      { name: "Priority", description: null, text: false },
      {
        name: "Acceptance criteria",
        description: "What must be true for this to be done",
        text: true,
      },
    ]);
    expect(t.fields!.plainText).toBe(true);
  });

  it("reads a ticket's text field values by field name", async () => {
    const { t } = tickets([
      [
        /IssueFieldValues\(/,
        {
          data: {
            repository: {
              issue: {
                issueFieldValues: {
                  nodes: [
                    {
                      value: "1. When it runs, it works.",
                      field: { name: "Acceptance criteria" },
                    },
                    {},
                  ],
                },
              },
            },
          },
        },
      ],
    ]);
    expect(await t.fields!.read("7")).toEqual({
      "Acceptance criteria": "1. When it runs, it works.",
    });
  });

  const writing = () =>
    tickets([
      [/IssueFields\(/, fieldsAnswer],
      [/^api repos\/acme\/widgets\/issues\/7$/, restIssue(7)],
      [/mutation/, { data: {} }],
    ]);
  const operation = (call: string) => /query=mutation (\w+)/.exec(call)?.[1];

  it("sets a field by its ID on the issue's node", async () => {
    const { t, calls } = writing();
    await t.fields!.write("7", { "Acceptance criteria": "Done when" });
    const [set] = calls.filter((c) => c.includes("mutation"));
    expect(operation(set!)).toBe("SetIssueField");
    expect(set).toContain("-f issue=I_7 -f field=IF_ac -f text=Done when");
  });

  it("clears a field given null, by its ID", async () => {
    const { t, calls } = writing();
    await t.fields!.write("7", { Priority: null });
    const [clear] = calls.filter((c) => c.includes("mutation"));
    expect(operation(clear!)).toBe("ClearIssueField");
    expect(clear).toContain("-f issue=I_7 -f field=IF_pri");
  });

  it("refuses to write a field the repository doesn't have", async () => {
    const { t } = tickets([
      [/IssueFields\(/, fieldsAnswer],
      [/^api repos\/acme\/widgets\/issues\/7$/, restIssue(7)],
    ]);
    await expect(t.fields!.write("7", { Notes: "x" })).rejects.toThrow(
      "No issue field called Notes.",
    );
  });
});

describe("GitHub adapter: attachments", () => {
  it("has attachments with the CLI, and comments through gh", async () => {
    const { t, calls } = tickets(
      [
        [
          /^issue comment 7/,
          "https://github.com/acme/widgets/issues/7#issuecomment-777\n",
        ],
      ],
      { cli: true },
    );
    expect(supports(t, "attachments")).toBe(true);
    expect(await t.attachments!.comment("7", "Body", ["a.png", "b.png"])).toBe(
      "777",
    );
    expect(calls[0]).toMatch(
      /^issue comment 7 --repo acme\/widgets --body-file \S+ --attach a\.png --attach b\.png$/,
    );
  });

  it("writes the body beside the first image, so its ./name.png references resolve, and removes it after", async () => {
    let seen = "";
    const { t } = tickets(
      [
        [
          /^issue comment 7/,
          () => {
            seen = calls0();
            return "https://github.com/acme/widgets/issues/7#issuecomment-1\n";
          },
        ],
      ],
      { cli: true },
    );
    const dir = mkdtempSync(join(tmpdir(), "attach-"));
    let calls0 = () => "";
    calls0 = () => readdirSync(dir).join(",");
    await t.attachments!.comment("7", "![a](./a.png)", [join(dir, "a.png")]);
    expect(seen).toMatch(/^\.factory-body-\S+\.md$/);
    expect(readdirSync(dir)).toEqual([]);
    rmSync(dir, { recursive: true });
  });

  it("edits a body with images through gh", async () => {
    const { t, calls } = tickets([[/^issue edit 7/, ""]], { cli: true });
    await t.attachments!.writeBody("7", "Body", ["a.png"]);
    expect(calls[0]).toMatch(/^issue edit 7 .* --attach a\.png$/);
  });

  it("has no attachments without the CLI", () => {
    expect(supports(tickets([], { cli: false }).t, "attachments")).toBe(false);
  });

  it("has every other group", () => {
    const { t } = tickets([]);
    for (const g of ["board", "blockers", "label-history"] as const)
      expect(supports(t, g)).toBe(true);
  });

  it("reads the comment ID from the address gh prints, and fails without one", () => {
    expect(
      commentIdFromUrl("https://github.com/o/r/issues/1#issuecomment-42"),
    ).toBe("42");
    expect(() => commentIdFromUrl("done")).toThrow("no comment address");
  });
});

// The poller reaches GitHub with fetch and a token; every operation it uses
// is run here over both transports.
type Answer = { status?: number; body: unknown; link?: string };

function fakeFetch(route: (url: string, init: RequestInit) => Answer) {
  const calls: { url: string; method: string; body?: string }[] = [];
  const f = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({
      url,
      method: init.method ?? "GET",
      body: init.body as string | undefined,
    });
    const a = route(url, init);
    return new Response(JSON.stringify(a.body), {
      status: a.status ?? 200,
      headers: a.link ? { link: a.link } : {},
    });
  }) as typeof fetch;
  return { f, calls };
}

const graphqlQuery = (init: RequestInit) =>
  (JSON.parse(String(init.body)) as { query: string }).query;

describe("the poller's operations over both transports", () => {
  function overGh(): Transport {
    return ghTransport(
      fakeGh([
        [/Tickets\(/, issuesPage([rawIssue(1)], [], null)],
        [/Board\(/, boardPage([{ n: 1 }])],
        [/blocked_by/, [[{ number: 3, state: "open" }]]],
        [/-X POST/, { id: 61 }],
      ]).run,
    );
  }
  function overFetch(): Transport {
    return fetchTransport({
      token: "t",
      fetch: fakeFetch((url, init) => {
        if (url.endsWith("/graphql")) {
          const q = graphqlQuery(init);
          return {
            body: q.includes("Tickets(")
              ? issuesPage([rawIssue(1)], [], null)
              : boardPage([{ n: 1 }]),
          };
        }
        if (url.includes("blocked_by"))
          return { body: [{ number: 3, state: "open" }] };
        return { body: { id: 61 } };
      }).f,
    });
  }

  for (const [name, make] of [
    ["gh", overGh],
    ["fetch", overFetch],
  ] as const) {
    it(`reads everything with the board, a ticket's blockers, and comments, over ${name}`, async () => {
      const t = githubTickets({
        transport: make(),
        repository: REPO,
        board: 1,
        boardOwner: "acme",
      });
      const read = await t.readAll!({ board: true });
      expect(read.map((x) => [x.key, x.card?.status])).toEqual([
        ["1", "Ready"],
      ]);
      expect(await t.blockers!.list("1")).toEqual([
        { key: "3", state: "open" },
      ]);
      expect(await t.comment("1", "Starting.")).toBe("61");
    });
  }
});

describe("the fetch transport", () => {
  it("sends the token and a REST body, and follows Link headers through every page", async () => {
    const { f, calls } = fakeFetch((url) =>
      url.includes("page=2")
        ? { body: [{ number: 2, state: "open" }] }
        : {
            body: [{ number: 1, state: "open" }],
            link: `<https://api.github.com/repos/${REPO}/issues/7/dependencies/blocked_by?page=2>; rel="next"`,
          },
    );
    const t = githubTickets({
      transport: fetchTransport({ token: "tok", fetch: f }),
      repository: REPO,
      board: null,
    });
    expect((await t.blockers!.list("7")).map((b) => b.key)).toEqual(["1", "2"]);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(
      `https://api.github.com/repos/${REPO}/issues/7/dependencies/blocked_by`,
    );
  });

  it.each([
    [
      "the answer's message",
      { message: "Resource not accessible" },
      "Forbidden",
      "Resource not accessible",
    ],
    [
      "the status text when the answer has no message",
      {},
      "Forbidden",
      "Forbidden",
    ],
  ])(
    "rejects with %s, keeping HTTP 403 in its text",
    async (_n, body, statusText, reason) => {
      const f = (async () =>
        new Response(JSON.stringify(body), {
          status: 403,
          statusText,
        })) as typeof fetch;
      const t = fetchTransport({ token: "tok", fetch: f });
      const error = await t.rest("POST", "repos/x/y").catch((e: unknown) => e);
      expect(statusOf(error)).toBe(403);
      expect(String(error)).toContain("HTTP 403");
      expect((error as HttpError).reason).toBe(reason);
    },
  );

  it("posts a comment's body as JSON with the token", async () => {
    const seen: RequestInit[] = [];
    const { f } = fakeFetch((_url, init) => {
      seen.push(init);
      return { body: { id: 9 } };
    });
    const t = fetchTransport({ token: "tok", fetch: f });
    await t.rest("POST", `repos/${REPO}/issues/1/comments`, {
      fields: { body: "Hi" },
    });
    expect(seen[0].method).toBe("POST");
    expect(JSON.parse(String(seen[0].body))).toEqual({ body: "Hi" });
    expect((seen[0].headers as Record<string, string>).Authorization).toBe(
      "Bearer tok",
    );
  });

  it("reads an answer that is plain text as it is", async () => {
    const f = (async () =>
      new Response("first line\nError: it broke\n")) as typeof fetch;

    expect(
      await fetchTransport({ token: "t", fetch: f }).text(
        `repos/${REPO}/actions/jobs/51/logs`,
      ),
    ).toBe("first line\nError: it broke\n");
  });

  it("fails with an HttpError carrying the status, which the adapter reads as not found on 404", async () => {
    const { f } = fakeFetch(() => ({ status: 404, body: {} }));
    const transport = fetchTransport({ token: "t", fetch: f });
    const error = await transport.rest("GET", "repos/x/y").catch((e) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect(statusOf(error)).toBe(404);
    const t = githubTickets({
      transport,
      repository: REPO,
      board: null,
    });
    await expect(t.deleteComment("5")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("fails on a 500 with the status, never an empty answer", async () => {
    const { f } = fakeFetch(() => ({ status: 500, body: {} }));
    const transport = fetchTransport({ token: "t", fetch: f });
    const error = await transport.graphql("{x}").catch((e) => e);
    expect(statusOf(error)).toBe(500);
  });

  it("rejects a GraphQL answer with errors", async () => {
    const { f } = fakeFetch(() => ({
      body: { errors: [{ message: "Could not resolve" }] },
    }));
    await expect(
      fetchTransport({ token: "t", fetch: f }).graphql(BOARD_QUERY),
    ).rejects.toThrow("Could not resolve");
  });

  it("sends the GraphQL query and its variables", async () => {
    const seen: RequestInit[] = [];
    const { f } = fakeFetch((_url, init) => {
      seen.push(init);
      return { body: issuesPage([], [], null) };
    });
    await fetchTransport({ token: "t", fetch: f }).graphql(ISSUES_QUERY, {
      owner: "o",
      name: "n",
      after: null,
    });
    expect(JSON.parse(String(seen[0].body))).toEqual({
      query: ISSUES_QUERY,
      variables: { owner: "o", name: "n", after: null },
    });
  });
});

// A recorded answer, not one written beside the parser: the repository
// read the board sync saved before this change, run through the adapter's
// GraphQL "Read everything at once".
describe("GitHub adapter: a recorded GraphQL answer", () => {
  it("reads the recorded repository into the tickets the sync saved from it", async () => {
    const { t } = tickets([[/query Tickets/, recordedPages[0]]]);
    const read = await t.readAll!();
    const strip = (x: Ticket) => ({
      key: x.key,
      title: x.title,
      finishedAt: x.finishedAt,
      labels: x.labels,
      comments: x.comments,
    });
    expect(read.map(strip)).toEqual((saved.tickets as Ticket[]).map(strip));
  });
});

// The in-memory adapter every command test runs on must fail where the
// GitHub one fails, or the command tests pass on behavior GitHub lacks.
describe.each([
  ["in memory", () => memoryTickets([{ number: 7 }, { number: 3 }]).tickets],
  [
    "GitHub",
    () =>
      tickets([
        [/-X DELETE .*issues\/7\/labels\//, notFound()],
        [/^api repos\/acme\/widgets\/issues\/7$/, restIssue(7)],
        [/^api repos\/acme\/widgets\/issues\/3$/, restIssue(3)],
        [/-X DELETE .*blocked_by/, notFound()],
        [/issues\/(comments\/)?404/, notFound()],
        [/comments\/404/, notFound()],
      ]).t,
  ],
])("the ticket interface's contract, %s", (_name, make) => {
  it("fails as not found reading a ticket that does not exist", async () => {
    await expect(make().read("404")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("fails as not found editing or deleting a comment that does not exist", async () => {
    const t = make();
    await expect(t.editComment("404", "x")).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(t.deleteComment("404")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("treats removing a label the ticket lacks as done", async () => {
    await expect(make().removeLabel("7", "absent")).resolves.toBeUndefined();
  });

  it("fails as not found removing a blocker that was never recorded", async () => {
    await expect(make().blockers!.remove("7", "3")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("GitHub adapter: what ticket 61 added", () => {
  it("moves a card by writing its Status option", async () => {
    const { t, calls } = tickets([
      [/Board\(/, boardPage([{ n: 1 }])],
      [/mutation/, { data: {} }],
    ]);
    await t.board!.move("PVTI_1", "ready");
    const [mutation] = calls.filter((c) => c.includes("mutation"));
    expect(mutation).toMatch(/SetOption.*option=O_ready/);
    expect(mutation).toContain("field=F_status");
  });

  it("finishes an open issue by closing it as completed", async () => {
    const { t, calls } = tickets([
      ISSUE_7,
      [/-X PATCH repos\/acme\/widgets\/issues\/7/, {}],
    ]);
    await t.finish("7");
    expect(calls.at(-1)).toContain("-X PATCH repos/acme/widgets/issues/7");
    expect(calls.at(-1)).toContain("state=closed");
    expect(calls.at(-1)).toContain("state_reason=completed");
  });

  it("finishes a closed issue without writing", async () => {
    const { t, calls } = tickets([
      [/issues\/7$/, restIssue(7, { state: "closed" })],
    ]);
    await t.finish("7");
    expect(calls).toEqual([GET_7]);
  });

  it("posts nothing for a merge's note, which GitHub shows itself", async () => {
    const { t, calls } = tickets([]);
    expect(
      await t.record.add("7", {
        text: "Merged.",
        markers: ["<!-- work-status: merged -->"],
        tellsPerson: true,
      }),
    ).toBe("");
    expect(calls).toEqual([]);
  });

  it("posts any other entry as a comment, its markers and the agent mark after its text", async () => {
    const { t, calls } = tickets([
      ISSUE_7,
      [/issues\/7\/comments/, { id: 55 }],
    ]);
    expect(
      await t.record.add("7", {
        text: "Building this.",
        markers: ["<!-- work-status: claim local s -->"],
        tellsPerson: false,
      }),
    ).toBe("55");
    expect(calls.at(-1)).toContain(
      "body=Building this.\n\n<!-- work-status: claim local s -->\n<!-- agent -->",
    );
  });

  it("reads only tickets with the label it is asked for", async () => {
    const labeled = {
      ...rawIssue(2),
      labels: { nodes: [{ name: "Factory" }] },
    };
    const { t } = tickets([
      [/Tickets\(/, issuesPage([rawIssue(1), labeled], [], null)],
    ]);
    expect((await t.readAll({ label: "factory" })).map((x) => x.key)).toEqual([
      "2",
    ]);
  });
});
