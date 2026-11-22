import { describe, expect, it, vi } from "vitest";
import { asIssue, type GithubIssue } from "./ticket-fixture.ts";
import { painter } from "../src/lib/color.mts";
import {
  age,
  failureLine,
  formatRows,
  isWatching,
  main,
  runLine,
  sessionCell,
  styleFor,
  toRows,
  type Deps,
  type Style,
} from "../src/status.mts";
import type {
  Board,
  Issue,
  PullRequest,
  ReviewerRun,
} from "../src/lib/work-status.mts";
import {
  NO_DEPENDENCIES,
  SettingsError,
  parseSettings,
} from "../src/config.mts";
import { watchOf } from "../src/lib/work-status.mts";
import { fakeSettings } from "./fake-gh";
import { memoryTickets } from "./memory-tickets";
import { toBoard, type BoardPage } from "../src/tickets/github.mts";
import { CredentialError, type Ticket } from "../src/tickets/types.mts";
import saved from "./fixtures/sync/repo.json";
import boardPages from "./fixtures/sync/board.json";
import { FACTORY_COLUMNS } from "./factory-columns";
import { CODE_HOST } from "./settings-fixture";

/** The sync fixture's tickets and cards in the in-memory adapter, and its
 * open pull requests. `fail` makes the tickets' list fail. */
function fixtureSource(fail?: Error): {
  source: Deps["source"];
  open: ReturnType<typeof vi.fn>;
} {
  const mem = memoryTickets(saved.tickets as Ticket[], {
    fail: fail ? { read: fail } : {},
  });
  for (const item of toBoard(
    boardPages as BoardPage[],
    "acme/widgets",
  ).items.values())
    mem.card(item.key, item);
  const open = vi.fn(async () => saved.pulls as PullRequest[]);
  return {
    source: async () => ({
      tickets: mem.tickets,
      pulls: { open, address: LINKS.pull },
      runner: { runPage: LINKS.run },
      own: true,
    }),
    open,
  };
}

const NOW = new Date("2026-11-09T12:00:00Z");
/** How GitHub, and the in-memory adapter, write a ticket. */
const REF = (key: string) => `#${key}`;
const LINKS_IN = memoryTickets().tickets.linksIn;
const issue = (number: number, over: Partial<GithubIssue> = {}): Issue =>
  asIssue({
    key: String(number),
    title: `Issue ${number}`,
    state: "open",
    closedAt: null,
    labels: [],
    comments: [],
    ...over,
  });
const pull = (
  number: number,
  over: Partial<PullRequest> = {},
): PullRequest => ({
  number,
  createdAt: "2026-11-09T11:00:00Z",
  body: "",
  closes: [],
  isDraft: false,
  checks: "SUCCESS",
  openThreads: 2,
  author: "acme",
  ...over,
  // The links as `linkPulls` reads them from the body.
  partOf: over.partOf ?? LINKS_IN(over.body ?? "").partOf,
});
const board = (cards: [number, string, string][] = []): Board => ({
  projectId: "P",
  fields: [],
  items: new Map(
    cards.map(([number, status, updatedAt]) => [
      String(number),
      {
        itemId: `I${number}`,
        key: String(number),
        status,
        updatedAt,
        session: "",
        runsIn: "",
      },
    ]),
  ),
});

describe("toRows", () => {
  it("shares an issue's row with the pull request that closes it, in both rows when it closes two", () => {
    const { rows } = toRows(
      {
        issues: [issue(1), issue(2)],
        pulls: [pull(9, { closes: ["1", "2"] })],
      },
      board(),
      new Map(),
      NOW,
      { ref: REF },
    );

    expect(rows.map((r) => [r.key, r.pulls.map((p) => p.number)])).toEqual([
      ["1", [9]],
      ["2", [9]],
    ]);
  });

  it("gives a pull request that closes nothing its own row", () => {
    const { rows } = toRows(
      { issues: [], pulls: [pull(9, { author: "dependabot" })] },
      board(),
      new Map(),
      NOW,
      { ref: REF },
    );

    expect(rows).toMatchObject([
      { key: "9", name: "#9", kind: "pull", derived: null },
    ]);
  });

  it("keeps a partial follow-ups pull request in its issue's row only", () => {
    const { rows } = toRows(
      {
        issues: [issue(201, { labels: ["follow-up"] })],
        pulls: [pull(9, { body: "Part of #201: its first line." })],
      },
      board(),
      new Map(),
      NOW,
      { ref: REF },
    );

    expect(rows.map((r) => r.key)).toEqual(["201"]);
  });

  it("keeps a partial pull request in the row of the follow-ups ticket the settings name", () => {
    const { rows } = toRows(
      {
        issues: [issue(201, { labels: ["follow-ups"] })],
        pulls: [pull(9, { body: "Part of #201: its first line." })],
      },
      board(),
      new Map(),
      NOW,
      { ref: REF, followUp: "follow-ups" },
    );

    expect(rows.map((r) => r.key)).toEqual(["201"]);
    expect(rows[0]!.derived!.status).toBe("In review");
  });

  it("gives no row to a partial pull request of a closed follow-ups ticket the settings name", () => {
    const { rows } = toRows(
      {
        issues: [
          issue(201, {
            labels: ["follow-ups"],
            state: "closed",
            closedAt: "2026-11-09T10:00:00Z",
          }),
        ],
        pulls: [pull(9, { body: "Part of #201: its first line." })],
      },
      board(),
      new Map(),
      NOW,
      { ref: REF, followUp: "follow-ups" },
    );

    expect(rows.map((r) => r.key)).toEqual([]);
  });

  it("gives no row of its own to a pull request whose issue is already closed", () => {
    const { rows } = toRows(
      {
        issues: [
          issue(3, { state: "closed", closedAt: "2026-11-09T10:00:00Z" }),
        ],
        pulls: [pull(9, { closes: ["3"] })],
      },
      board(),
      new Map(),
      NOW,
      { ref: REF },
    );

    expect(rows).toEqual([]);
  });

  it("lists closed issues apart from the rows", () => {
    const { rows, closed } = toRows(
      {
        issues: [
          issue(3, { state: "closed", closedAt: "2026-11-09T10:00:00Z" }),
        ],
        pulls: [],
      },
      board(),
      new Map(),
      NOW,
      { ref: REF },
    );

    expect(rows).toEqual([]);
    expect(closed.map((r) => r.key)).toEqual(["3"]);
  });

  it("flags a Ready card unstarted, but not one with an open blocker", () => {
    const { rows } = toRows(
      { issues: [issue(1), issue(2)], pulls: [] },
      board([
        [1, "Ready", "2026-11-09T11:00:00Z"],
        [2, "Ready", "2026-11-09T11:00:00Z"],
      ]),
      new Map([["2", ["5"]]]),
      NOW,
      { ref: REF },
    );

    expect(rows.map((r) => r.flags)).toEqual([
      ["not started, is the poller running?"],
      [],
    ]);
  });
  it("flags no card when nothing starts builds from the board", () => {
    const { rows } = toRows(
      { issues: [issue(1)], pulls: [] },
      board([[1, "Ready", "2026-11-09T11:00:00Z"]]),
      new Map(),
      NOW,
      { watch: watchOf("manual", 5), ref: REF },
    );

    expect(rows[0].flags).toEqual([]);
  });

  it.each([
    [5, "11:39:00", "11:41:00"],
    [30, "11:14:00", "11:16:00"],
  ])(
    "with the schedule every %i minutes, flags a Ready card only after that plus 15, naming the workflow",
    (minutes, over, under) => {
      const { rows } = toRows(
        { issues: [issue(1), issue(2)], pulls: [] },
        board([
          [1, "Ready", `2026-11-09T${over}Z`],
          [2, "Ready", `2026-11-09T${under}Z`],
        ]),
        new Map(),
        NOW,
        { watch: watchOf("github-action", minutes), ref: REF },
      );

      expect(rows.map((r) => r.flags)).toEqual([
        ["not started, is the factory-poller workflow running?"],
        [],
      ]);
    },
  );

  it("with a hosted poller, flags a Ready card after 5 minutes, asking after the poller", () => {
    const { rows } = toRows(
      { issues: [issue(1), issue(2)], pulls: [] },
      board([
        [1, "Ready", "2026-11-09T11:54:00Z"],
        [2, "Ready", "2026-11-09T11:56:00Z"],
      ]),
      new Map(),
      NOW,
      { watch: watchOf("own-server", 5), ref: REF },
    );

    expect(rows.map((r) => r.flags)).toEqual([
      ["not started, is the poller running?"],
      [],
    ]);
  });
});

const ESC = "\x1B";
const SITE = "https://github.com/acme/widgets";
const LINKS = {
  ticket: (key: string) => `${SITE}/issues/${key}`,
  pull: (n: number) => `${SITE}/pull/${n}`,
  run: (id: string) => `${SITE}/actions/runs/${id}`,
};
const TTY = { color: true, width: 120, links: LINKS };
const p = painter(true);
/** Text as a pattern that matches it exactly. */
const re = (text: string) => text.replace(/[[\]\\^$.*+?()|{}]/g, "\\$&");
/** The codes a format opens and closes with, for a line whose text a
 * pattern matches loosely. */
const ends = (format: Parameters<typeof p>[0]) => p(format, "\0").split("\0");
const issueLink = (n: number, text: string) =>
  `${ESC}]8;;https://github.com/acme/widgets/issues/${n}${ESC}\\${text}${ESC}]8;;${ESC}\\`;
const pullLink = (n: number, text: string) =>
  `${ESC}]8;;https://github.com/acme/widgets/pull/${n}${ESC}\\${text}${ESC}]8;;${ESC}\\`;
const claimed = (where: "local" | "cloud" | "actions", id: string) => ({
  id: "1",
  author: "acme",
  createdAt: "2026-11-09T11:00:00Z",
  body: `<!-- work-status: claim ${where} ${id} -->\n<!-- agent -->`,
});
const closedIssue = (number: number) =>
  issue(number, { state: "closed", closedAt: "2026-11-09T10:00:00Z" });
const plainLines = (
  issues: Issue[],
  pulls: PullRequest[],
  cards: [number, string, string][] = [],
) =>
  formatRows(
    toRows({ issues, pulls }, board(cards), new Map(), NOW, { ref: REF }),
    NOW,
  );

describe("formatRows", () => {
  it("prints one header row of the five columns", () => {
    const lines = plainLines([issue(1)], []);

    expect(lines[0]).toMatch(/^ +# +Title +Time in status +Cost +Session$/);
  });

  it("prints the card's board Cost under Cost, and nothing for a card with none", () => {
    const cards = board([
      [1, "In progress", "2026-11-09T11:00:00Z"],
      [2, "In progress", "2026-11-09T11:00:00Z"],
    ]);
    cards.items.get("1")!.cost = 1.15;
    const lines = formatRows(
      toRows(
        {
          issues: [
            issue(1, { comments: [claimed("local", "3a5d42f4")] }),
            issue(2, { comments: [claimed("local", "4b6e53a5")] }),
          ],
          pulls: [],
        },
        cards,
        new Map(),
        NOW,
        { ref: REF },
      ),
      NOW,
    );
    const at = lines[0].indexOf("Cost");
    const cell = (n: number) =>
      lines.find((l) => l.includes(`#${n} `))!.slice(at, at + 5);

    expect(cell(1)).toBe("$1.15");
    expect(cell(2)).toBe("     ");
  });

  it("groups issues under every board column, in the board's order, with counts", () => {
    const lines = plainLines(
      [issue(1), issue(2), issue(4)],
      [],
      [
        [1, "Ready", "2026-11-09T11:00:00Z"],
        [2, "Backlog", "2026-11-09T11:00:00Z"],
        [4, "Ready", "2026-11-09T11:00:00Z"],
      ],
    );

    expect(lines.slice(1)).toEqual([
      "",
      "Backlog  1",
      expect.stringMatching(/^ +#2 +Issue 2 +1h$/),
      "",
      "In refinement  0",
      "",
      "Ready  2",
      expect.stringMatching(/^ +#1 +Issue 1 +1h$/),
      expect.stringMatching(/^ +⚠ not started/),
      expect.stringMatching(/^ +#4 +Issue 4 +1h$/),
      expect.stringMatching(/^ +⚠ not started/),
      "",
      "In progress  0",
      "",
      "In review  0",
    ]);
  });

  it("prints the session as where it runs and its ID, and a phrase as it is", () => {
    const lines = plainLines(
      [
        issue(1, { comments: [claimed("local", "3a5d42f4")] }),
        issue(2, {
          comments: [
            {
              id: "2",
              author: "acme",
              createdAt: "2026-11-09T11:00:00Z",
              body: "<!-- work-status: started actions st_0123456789ab -->\n<!-- agent -->",
            },
          ],
        }),
      ],
      [],
      [
        [1, "In progress", "2026-11-09T11:00:00Z"],
        [2, "Ready", "2026-11-09T11:00:00Z"],
      ],
    );

    expect(lines.find((l) => l.includes("#1 "))).toMatch(/ {2}local 3a5d42f4$/);
    expect(lines.find((l) => l.includes("#2 "))).toMatch(
      / {2}actions, starting$/,
    );
  });

  it.each([
    [
      { isDraft: true, openThreads: 1, checks: "FAILURE" },
      "Pull request #9 · draft · checks failing · 1 open thread",
    ],
    [
      { openThreads: 0, checks: "ERROR" },
      "Pull request #9 · ready for review · checks failing · no open threads",
    ],
    [
      { checks: "PENDING" },
      "Pull request #9 · ready for review · checks pending · 2 open threads",
    ],
    [
      { checks: "EXPECTED" },
      "Pull request #9 · ready for review · checks pending · 2 open threads",
    ],
    [
      { checks: null },
      "Pull request #9 · ready for review · no checks · 2 open threads",
    ],
    [
      {
        openThreads: 0,
        body: "<!-- session-watching: 2026-11-09T11:30:00Z -->",
      },
      "Pull request #9 · ready for review · checks passing · no open threads · a session is watching it",
    ],
  ] as [Partial<PullRequest>, string][])(
    "prints the pull request %o on its own line under its issue",
    (over, expected) => {
      const lines = plainLines(
        [issue(1)],
        [pull(9, { closes: ["1"], ...over })],
      );

      const row = lines.findIndex((l) => /^ +#1 /.test(l));
      expect(lines[row + 1].trim()).toBe(`↳ ${expected}`);
      expect(lines[row + 1].indexOf("↳")).toBe(lines[row].indexOf("Issue 1"));
    },
  );

  it("groups pull requests that close no issue after In review, and only when there are some", () => {
    const lines = plainLines([], [pull(203, { author: "dependabot" })]);

    expect(lines.slice(-5, -2)).toEqual([
      "In review  0",
      "",
      "Pull requests that close no issue  1",
    ]);
    expect(plainLines([issue(1)], []).join("\n")).not.toContain(
      "Pull requests that close no issue",
    );
  });

  it("prints a pull request that closes no issue with no session, and its line without its number", () => {
    const lines = plainLines(
      [],
      [pull(203, { author: "dependabot", checks: "SUCCESS", openThreads: 0 })],
    );

    expect(lines.slice(-2)).toEqual([
      expect.stringMatching(/^ +#203 +pull request by dependabot$/),
      expect.stringMatching(
        /^ +↳ ready for review · checks passing · no open threads$/,
      ),
    ]);
  });

  it("warns with ⚠ on its own line after the pull request line", () => {
    const flagged = formatRows(
      {
        rows: [
          {
            ...toRows(
              {
                issues: [issue(1)],
                pulls: [pull(9, { closes: ["1"] })],
              },
              board(),
              new Map(),
              NOW,
              { ref: REF },
            ).rows[0],
            flags: ["stale", "not started, is the poller running?"],
          },
        ],
        closed: [],
      },
      NOW,
    );

    const row = flagged.findIndex((l) => /^ +#1 /.test(l));
    expect(flagged.slice(row + 1).map((l) => l.trim())).toEqual([
      expect.stringMatching(/^↳ Pull request #9/),
      "⚠ stale",
      "⚠ not started, is the poller running?",
    ]);
    expect(flagged[row + 2].indexOf("⚠")).toBe(flagged[row].indexOf("Issue 1"));
  });

  it("prints the closed list after the groups", () => {
    const lines = plainLines([issue(1), closedIssue(3)], []);

    expect(lines.at(-1)).toBe("Closed in the last 24 hours: #3");
  });

  it("leaves the closed list out of the hook's form", () => {
    const closedOnly = toRows(
      { issues: [closedIssue(3)], pulls: [] },
      board(),
      new Map(),
      NOW,
      { ref: REF },
    );

    expect(formatRows(closedOnly, NOW, false)).toEqual(["Nothing open."]);
  });

  it("says so when nothing is open, and still lists what closed", () => {
    expect(plainLines([closedIssue(3)], [])).toEqual([
      "Nothing open.",
      "",
      "Closed in the last 24 hours: #3",
    ]);
  });

  it("prints no escape codes and full titles without a terminal", () => {
    const title = "A".repeat(200);
    const lines = plainLines(
      [issue(1, { title })],
      [pull(9, { closes: ["1"] })],
    );

    expect(lines.join("\n")).not.toContain(ESC);
    expect(lines.join("\n")).toContain(title);
  });
});

describe("formatRows in a terminal", () => {
  const styled = (
    issues: Issue[],
    pulls: PullRequest[],
    cards: [number, string, string][] = [],
    style: Style = TTY,
  ) =>
    formatRows(
      toRows({ issues, pulls }, board(cards), new Map(), NOW, { ref: REF }),
      NOW,
      true,
      { links: LINKS, ...style },
    );

  it("underlines the header's words in bold, and not the spaces between them", () => {
    const head = (word: string) => re(p(["bold", "underline"], word));

    expect(styled([issue(1)], [])[0]).toMatch(
      new RegExp(
        `^ {2}${head("#")} +${head("Title")} +${head("Time in status")} {2}${head("Cost")} {2}${head("Session")}$`,
      ),
    );
  });

  it("paints numbers blue, and dims the time in status and the closed list's label", () => {
    const lines = styled(
      [issue(1, { comments: [claimed("local", "3a5d42f4")] }), closedIssue(3)],
      [],
      [[1, "In progress", "2026-11-09T11:00:00Z"]],
    );

    expect(lines.join("\n")).toContain(p("blueBright", issueLink(1, "#1")));
    expect(lines).toContainEqual(expect.stringContaining(p("dim", "1h")));
    expect(lines.at(-1)).toBe(
      `${p("dim", "Closed in the last 24 hours:")} ${p("blueBright", issueLink(3, "#3"))}`,
    );
  });

  it("links the issue's number and title to the issue, and the pull request's number to it", () => {
    const text = styled([issue(1)], [pull(9, { closes: ["1"] })]).join("\n");

    expect(text).toContain(issueLink(1, "#1"));
    expect(text).toContain(issueLink(1, "Issue 1"));
    expect(text).toContain(`Pull request ${pullLink(9, "#9")}`);
  });

  it("links a pull request that closes no issue by its number and title", () => {
    const text = styled([], [pull(203, { author: "dependabot" })]).join("\n");

    expect(text).toContain(pullLink(203, "#203"));
    expect(text).toContain(pullLink(203, "pull request by dependabot"));
  });

  it("links each closed issue", () => {
    const text = styled([closedIssue(3), closedIssue(4)], []).at(-1);

    expect(text).toContain(issueLink(3, "#3"));
    expect(text).toContain(issueLink(4, "#4"));
  });

  it("colors each heading, and dims a column with no issues", () => {
    const lines = styled(
      [
        issue(1),
        issue(2, {
          comments: [
            {
              id: "4",
              author: "acme",
              createdAt: "2026-11-09T11:00:00Z",
              body: "<!-- work-status: refining local 3a5d42f4 -->\n<!-- agent -->",
            },
          ],
        }),
        issue(4),
        issue(5),
      ],
      [pull(9, { closes: ["5"] }), pull(203)],
      [
        [1, "Backlog", "2026-11-09T11:00:00Z"],
        [2, "In refinement", "2026-11-09T11:00:00Z"],
        [4, "Ready", "2026-11-09T11:00:00Z"],
      ],
    );

    expect(lines).toEqual(
      expect.arrayContaining([
        `${p(["bold", "whiteBright"], "Backlog")}  ${p("dim", "1")}`,
        `${p(["bold", "yellow"], "In refinement")}  ${p("dim", "1")}`,
        `${p(["bold", "green"], "Ready")}  ${p("dim", "1")}`,
        p("dim", "In progress  0"),
        `${p(["bold", "magenta"], "In review")}  ${p("dim", "1")}`,
        `${p(["bold", "whiteBright"], "Pull requests that close no issue")}  ${p("dim", "1")}`,
      ]),
    );
    expect(
      styled(
        [issue(1, { comments: [claimed("local", "3a5d42f4")] })],
        [],
        [[1, "In progress", "2026-11-09T11:00:00Z"]],
      ),
    ).toContain(`${p(["bold", "cyan"], "In progress")}  ${p("dim", "1")}`);
  });

  it("prints Waiting on you in bold yellow", () => {
    const lines = styled(
      [
        issue(1, {
          comments: [
            {
              id: "3",
              author: "acme",
              createdAt: "2026-11-09T11:00:00Z",
              body: "<!-- work-status: waiting -->\n<!-- agent -->",
            },
          ],
        }),
      ],
      [],
      [[1, "In refinement", "2026-11-09T11:00:00Z"]],
    );

    expect(lines).toContainEqual(
      expect.stringMatching(
        new RegExp(` {2}${re(p(["bold", "yellow"], "Waiting on you"))}$`),
      ),
    );
  });

  it("links an Actions run's ID to the run's page", () => {
    const lines = styled(
      [issue(1, { comments: [claimed("actions", "123456789")] })],
      [],
      [[1, "In progress", "2026-11-09T11:00:00Z"]],
    );

    expect(lines).toContainEqual(
      expect.stringMatching(
        new RegExp(
          ` {2}actions ${ESC}\\]8;;https://github\\.com/acme/widgets/actions/runs/123456789${ESC}\\\\123456789${ESC}\\]8;;${ESC}\\\\$`,
        ),
      ),
    );
  });

  it("links a desktop app session's short ID to the session in the app", () => {
    const lines = styled(
      [
        issue(1, {
          comments: [
            claimed("local", "local_38f582e5-2fdb-4e52-b976-ea355a7fa2db"),
          ],
        }),
      ],
      [],
      [[1, "In progress", "2026-11-09T11:00:00Z"]],
    );

    expect(lines).toContainEqual(
      expect.stringMatching(
        new RegExp(
          ` {2}local ${ESC}\\]8;;claude://claude.ai/epitaxy/local_38f582e5-2fdb-4e52-b976-ea355a7fa2db${ESC}\\\\38f582e5${ESC}\\]8;;${ESC}\\\\$`,
        ),
      ),
    );
  });

  it.each([
    ["a local session", claimed("local", "3a5d42f4"), "In progress"],
    [
      "an Actions run that is starting",
      {
        id: "2",
        author: "acme",
        createdAt: "2026-11-09T11:00:00Z",
        body: "<!-- work-status: started actions st_0123456789ab -->\n<!-- agent -->",
      },
      "Ready",
    ],
    [
      "Waiting on you",
      {
        id: "3",
        author: "acme",
        createdAt: "2026-11-09T11:00:00Z",
        body: "<!-- work-status: waiting -->\n<!-- agent -->",
      },
      "In refinement",
    ],
  ])("links nothing in the Session cell for %s", (_, comment, status) => {
    const lines = styled(
      [issue(1, { comments: [comment] }), issue(2)],
      [],
      [
        [1, status, "2026-11-09T11:00:00Z"],
        [2, "Backlog", "2026-11-09T11:00:00Z"],
      ],
    );

    expect(lines.join("\n")).not.toContain("claude://");
    expect(lines.join("\n")).not.toMatch(
      /\]8;;(?!https:\/\/github\.com\/)[^\x1B]/,
    );
  });

  it("prints an old cloud marker's ID as plain text, never as a link", () => {
    const lines = plainLines(
      [
        issue(1, {
          comments: [claimed("cloud", "cse_017oUBNEGeP7Yi4Xm1r46aKE")],
        }),
      ],
      [],
      [[1, "In progress", "2026-11-09T11:00:00Z"]],
    );

    expect(lines.find((l) => l.includes("#1 "))).toMatch(
      / {2}cloud cse_017oUBNEGeP7Yi4Xm1r46aKE$/,
    );
  });

  it("prints the pull request line dim", () => {
    expect(styled([issue(1)], [pull(9, { closes: ["1"] })])).toContainEqual(
      expect.stringMatching(
        new RegExp(
          `^ +${re(ends("dim")[0]!)}↳ Pull request .*${re(ends("dim")[1]!)}$`,
        ),
      ),
    );
  });

  it("prints a warning in red", () => {
    const [row] = toRows(
      { issues: [issue(1)], pulls: [] },
      board(),
      new Map(),
      NOW,
      { ref: REF },
    ).rows;

    expect(
      formatRows(
        { rows: [{ ...row, flags: ["stale"] }], closed: [] },
        NOW,
        true,
        TTY,
      ),
    ).toContainEqual(
      expect.stringMatching(new RegExp(`^ +${re(p("red", "⚠ stale"))}$`)),
    );
  });

  it("shortens titles and pull request lines to the window, and shows more in a wider one", () => {
    const title = "Word ".repeat(40).trim();
    const at = (width: number) =>
      styled(
        [issue(1, { title, comments: [claimed("local", "3a5d42f4")] })],
        [pull(9, { closes: ["1"] })],
        [],
        { color: true, width },
      ).map((l) => l.replace(/\x1B\[[\d;]*m|\x1B\]8;;[^\x1B]*\x1B\\/g, ""));

    for (const width of [80, 120]) {
      const lines = at(width);
      expect(Math.max(...lines.map((l) => [...l].length))).toBeLessThanOrEqual(
        width,
      );
      expect(lines.find((l) => l.includes("#1 "))).toMatch(
        /\S… +\d+h +local 3a5d42f4$/,
      );
    }
    expect(at(70).find((l) => l.includes("↳"))).toMatch(/…$/);
    expect(Math.max(...at(70).map((l) => [...l].length))).toBe(70);
    const shown = (width: number) =>
      at(width)
        .find((l) => l.includes("#1 "))!
        .split("…")[0].length;
    expect(shown(120)).toBeGreaterThan(shown(80));
  });

  it("never shortens a title below 20 characters", () => {
    const lines = styled([issue(1, { title: "T".repeat(60) })], [], [], {
      color: true,
      width: 30,
    });

    expect(lines.join("\n")).toContain(issueLink(1, `${"T".repeat(19)}…`));
  });
});

describe("styleFor", () => {
  it.each([
    [true, 100, { color: true, width: 100 }],
    [true, undefined, { color: true, width: 80 }],
    [false, 100, { color: false, width: null }],
  ])(
    "styles only output that is colored: color %s, %s columns, gives %o",
    (color, columns, expected) => {
      expect(styleFor(color, columns)).toEqual(expected);
    },
  );
});

describe("age", () => {
  it.each([
    ["2026-11-09T11:58:00Z", "2m"],
    ["2026-11-09T07:00:00Z", "5h"],
    ["2026-11-06T12:00:00Z", "3d"],
    [null, ""],
  ])("%s is %s", (since, expected) => {
    expect(age(since, NOW)).toBe(expected);
  });
});

describe("isWatching", () => {
  it("holds for an hour after the mark", () => {
    expect(
      isWatching("<!-- session-watching: 2026-11-09T11:01:00Z -->", NOW),
    ).toBe(true);
    expect(
      isWatching("<!-- session-watching: 2026-11-09T10:59:00Z -->", NOW),
    ).toBe(false);
    expect(isWatching("", NOW)).toBe(false);
  });
});

describe("failureLine", () => {
  it("names the owner's one-time command when the token cannot read the board", () => {
    expect(
      failureLine(
        new Error(
          "Your token has not been granted the required scopes: read:project",
        ),
      ),
    ).toBe(
      "Work status: the GitHub CLI cannot read the board yet. Run: gh auth refresh -s project",
    );
  });

  it("names any other failure in one line", () => {
    expect(failureLine(new Error("HTTP 502\nmore"))).toBe(
      "Work status: could not read GitHub (Error: HTTP 502)",
    );
  });
});

describe("main in a terminal", () => {
  it.each([
    [
      "a ticket's number where the ticket system says",
      "https://tickets.example/1",
    ],
    [
      "a pull request's number where the code host says",
      "https://code.example/pull/9",
    ],
    [
      "an Actions run's ID where the runner says",
      "https://runs.example/123456789",
    ],
  ])("links %s", async (_what, url) => {
    const mem = memoryTickets([
      { number: 1, comments: [claimed("actions", "123456789")] },
    ]);
    const out: string[] = [];
    const d: Deps = {
      source: async () => ({
        tickets: mem.tickets,
        pulls: {
          open: async () => [pull(9, { closes: ["1"] })],
          address: (n) => `https://code.example/pull/${n}`,
        },
        runner: { runPage: (id) => `https://runs.example/${id}` },
        own: true,
      }),
      settings: fakeSettings,
      env: {},
      now: () => NOW,
      out: (l) => out.push(l),
      sleep: async () => {},
      write: () => {},
      onInterrupt: () => {},
      style: () => ({ color: true, width: 200 }),
    };

    expect(await main([], d)).toBe(0);
    expect(out.join("\n")).toContain(`${ESC}]8;;${url}${ESC}\\`);
  });
});

describe("main, for a Ready card", () => {
  it("flags one that has not started, but not one that waits on an open blocker", async () => {
    const mem = memoryTickets([{ number: 1 }, { number: 2 }, { number: 5 }]);
    for (const n of [1, 2])
      mem.card(n, { status: "Ready", updatedAt: "2026-11-09T11:00:00Z" });
    mem.blockers.set("2", ["5"]);
    const out: string[] = [];
    const d: Deps = {
      source: async () => ({
        tickets: mem.tickets,
        pulls: { open: async () => [], address: (n) => `${n}` },
        runner: { runPage: (id) => id },
        own: true,
      }),
      settings: fakeSettings,
      env: {},
      now: () => NOW,
      out: (l) => out.push(l),
      sleep: async () => {},
      write: () => {},
      onInterrupt: () => {},
    };

    expect(await main([], d)).toBe(0);
    const flags = out.filter((l) => l.includes("not started"));
    expect(flags).toHaveLength(1);
    expect(out[out.indexOf(flags[0]) - 1]).toMatch(/^\s+#1 /);
  });
});

describe("main with a mapped board", () => {
  it("heads each group with the column the settings name for its state", async () => {
    const out: string[] = [];
    const settings = parseSettings(
      {
        version: 2,
        repository: "acme/widgets",
        "code-host": CODE_HOST,
        tickets: {
          board: 1,
          columns: {
            ...FACTORY_COLUMNS,
            backlog: "Todo",
            ready: "Ready for dev",
          },
        },
      },
      () => true,
    );
    const d: Deps = {
      source: fixtureSource().source,
      settings: async () => settings,
      env: {},
      now: () => NOW,
      out: (l) => out.push(l),
      sleep: async () => {},
      write: () => {},
      onInterrupt: () => {},
    };

    expect(await main([], d)).toBe(0);
    expect(out.filter((l) => /^(Todo|Ready for dev) /.test(l))).toHaveLength(2);
    expect(out.join("\n")).not.toMatch(/^(Backlog|Ready)  \d/m);
  });
});

describe("main --hook", () => {
  const deps = (source: Deps["source"], sleep: Deps["sleep"]) => {
    const out: string[] = [];
    const d: Deps = {
      source,
      settings: fakeSettings,
      env: {},
      now: () => NOW,
      out: (l) => out.push(l),
      sleep,
      write: () => {},
      onInterrupt: () => {},
    };
    return { d, out };
  };

  it("prints nothing before dependencies are installed", async () => {
    const { d, out } = deps(fixtureSource().source, async () => {});
    d.settings = () => Promise.reject(new SettingsError(NO_DEPENDENCIES));

    expect(await main(["--hook"], d)).toBe(0);
    expect(out).toEqual([]);
  });

  it("prints one line when GitHub has not answered in 20 seconds", async () => {
    const hang: Deps["source"] = () => new Promise(() => {});
    const sleep = vi.fn(async () => {});
    const { d, out } = deps(hang, sleep);

    await main(["--hook"], d);

    expect(sleep).toHaveBeenCalledWith(20_000);
    expect(out).toEqual([
      "Work status: GitHub did not answer within 20 seconds.",
    ]);
  });

  it("prints the open rows without the closed list", async () => {
    const never = () => new Promise(() => {});
    const { source, open } = fixtureSource();
    const { d, out } = deps(source, never);
    d.style = () => ({ color: true, width: 40 });

    await main(["--hook"], d);

    expect(out[0]).toBe("## Work in progress");
    expect(open).toHaveBeenCalledWith({ checks: true });
    expect(out.join("\n")).toContain("#16");
    expect(out.join("\n")).not.toContain("Closed in the last 24 hours");
    expect(out.join("\n")).not.toContain("\x1B");
    expect(out.join("\n")).toContain("A local build opened its pull request");
  });

  it("prints one line when a read fails", async () => {
    const never = () => new Promise(() => {});
    const { d, out } = deps(
      fixtureSource(new Error("gh: HTTP 401 Bad credentials")).source,
      never,
    );

    await main(["--hook"], d);

    expect(out).toEqual([
      "Work status: could not read GitHub (Error: gh: HTTP 401 Bad credentials)",
    ]);
  });
});

describe("main --hook, with a credential to fix", () => {
  it("says what to fix under Work in progress, and exits 0 so the session starts", async () => {
    const line =
      "No Fake Tickets credential for acme.example. Set FAKE_TICKETS_EMAIL and FAKE_TICKETS_TOKEN, or run: factory init";
    const out: string[] = [];
    const d: Deps = {
      source: () => Promise.reject(new CredentialError(line)),
      settings: fakeSettings,
      env: {},
      now: () => NOW,
      out: (l) => out.push(l),
      sleep: () => new Promise(() => {}),
      write: () => {},
      onInterrupt: () => {},
    };

    expect(await main(["--hook"], d)).toBe(0);
    expect(out).toEqual(["## Work in progress", "", `✗ ${line}`]);
  });
});

describe("main", () => {
  const HOME = "\x1B[H";

  /** Runs --watch for `draws` reads, and returns what it wrote. */
  async function watch(draws: number, widths: number[] = []) {
    const fixture = fixtureSource();
    const source = vi.fn(fixture.source);
    const writes: string[] = [];
    const out: string[] = [];
    const interrupts: (() => void)[] = [];
    const stop = new Error("stop");
    let slept = 0;
    const sleep = vi.fn(async () => {
      if (++slept === draws) throw stop;
    });
    await expect(
      main(["--watch"], {
        source,
        settings: fakeSettings,
        env: {},
        now: () => NOW,
        out: (l) => out.push(l),
        sleep,
        write: (text) => writes.push(text),
        onInterrupt: (leave) => interrupts.push(leave),
        style: () => ({ color: true, width: widths.shift() ?? 200 }),
      }),
    ).rejects.toBe(stop);
    return { writes, out, sleep, interrupts, source };
  }

  it("opens the ticket system once and reads it again on each --watch draw", async () => {
    const { source, writes } = await watch(3);

    expect(source).toHaveBeenCalledTimes(1);
    expect(writes.filter((w) => w.startsWith(HOME))).toHaveLength(1);
  });

  it("reads the terminal's style on every --watch draw, so a resize shows", async () => {
    const { writes } = await watch(2, [60, 200]);
    const frames = writes.filter((w) => w.startsWith(HOME));

    expect(frames).toHaveLength(2);
    expect(frames[0]).not.toContain("A local build opened its pull request");
    expect(frames[1]).toContain("A local build opened its pull request");
  });

  it("draws a --watch frame as one write over the last, never clearing first", async () => {
    const { writes, out } = await watch(1);
    const [frame] = writes.filter((w) => w.startsWith(HOME));
    const rows = frame.slice(HOME.length).split("\n");

    expect(out).toEqual([]);
    expect(rows.length).toBeGreaterThan(5);
    for (const row of rows.slice(0, -1))
      expect(row.endsWith("\x1B[K")).toBe(true);
    expect(rows.at(-1)!.endsWith("\x1B[K\x1B[J")).toBe(true);
    expect(writes.join("")).not.toContain("\x1Bc");
    expect(writes.join("")).not.toContain("\x1B[2J");
  });

  it("writes nothing for a --watch frame identical to the one on screen", async () => {
    const { writes } = await watch(3);

    expect(writes.filter((w) => w.startsWith(HOME))).toHaveLength(1);
  });

  it("reads again 15 seconds after each --watch draw", async () => {
    const { sleep } = await watch(1);

    expect(sleep).toHaveBeenCalledWith(15_000);
  });

  it("runs --watch on the alternate screen, and an interrupt restores the terminal", async () => {
    const { writes, interrupts } = await watch(1);

    expect(writes[0]).toBe("\x1B[?1049h\x1B[?25l");
    expect(interrupts).toHaveLength(1);
    interrupts[0]();
    expect(writes.at(-1)).toBe("\x1B[?25h\x1B[?1049l");
  });

  it("prints line by line without --watch, with no screen control", async () => {
    const writes: string[] = [];
    const out: string[] = [];

    expect(
      await main([], {
        source: fixtureSource().source,
        settings: fakeSettings,
        env: {},
        now: () => NOW,
        out: (l) => out.push(l),
        sleep: async () => {},
        write: (text) => writes.push(text),
        onInterrupt: () => {
          throw new Error("no interrupt handler outside --watch");
        },
      }),
    ).toBe(0);
    expect(writes).toEqual([]);
    expect(out.join("\n")).toContain("#16");
  });

  it("exits nonzero on a failed read", async () => {
    const out: string[] = [];

    expect(
      await main([], {
        source: fixtureSource(new Error("gh: HTTP 500")).source,
        settings: fakeSettings,
        env: {},
        now: () => NOW,
        out: (l) => out.push(l),
        sleep: async () => {},
        write: () => {},
        onInterrupt: () => {},
      }),
    ).toBe(1);
    expect(out).toHaveLength(1);
  });
});

describe("reviewer rows", () => {
  const minutesAgo = (n: number) =>
    new Date(NOW.getTime() - n * 60_000).toISOString();
  const marker = (minute: number, text: string) => ({
    id: "1",
    author: "acme",
    createdAt: minutesAgo(minute),
    body: `<!-- work-status: ${text} -->\n<!-- agent -->`,
  });
  const runs = (list: Partial<ReviewerRun>[]) => ({
    id: "2",
    author: "acme",
    createdAt: minutesAgo(1),
    body: [
      "<!-- reviewer-runs session=s -->",
      ...list.map(
        (r, i) =>
          `<!-- reviewer-run: ${JSON.stringify({ id: `a${i}`, result: "running", ...r })} -->`,
      ),
      "<!-- agent -->",
    ].join("\n"),
  });
  const ago = (n: number) => minutesAgo(n);
  // The mockup's sample cards, in the shape the sync reads.
  const mockup = () => {
    const refining = issue(201, {
      title: "Follow-ups",
      comments: [
        marker(12, "refining local 945b966c"),
        runs([
          {
            reviewer: "factory-ticket-readiness",
            model: "Sonnet",
            start: ago(4),
          },
        ]),
      ],
    });
    const building = issue(224, {
      title: "Improvements to AI harness",
      comments: [
        marker(60, "claim local session_01Xy"),
        runs([
          {
            reviewer: "factory-test-reviewer",
            model: "Sonnet",
            start: ago(50),
            end: ago(47),
            result: "passed",
            cost: 0.84,
          },
          {
            reviewer: "ui-reviewer",
            model: "Opus",
            start: ago(40),
            end: ago(16),
            result: "failed",
            findings: 2,
            cost: 6.1,
          },
          {
            reviewer: "a11y-inspector",
            model: "Sonnet",
            start: ago(8),
          },
        ]),
      ],
    });
    const reviewing = issue(198, {
      title: "Follow-ups",
      labels: ["follow-up"],
      comments: [
        marker(300, "claim local 945b966c"),
        runs([
          {
            reviewer: "seo-reviewer",
            model: "Opus",
            start: ago(250),
            end: ago(239),
            result: "passed",
            cost: 2.35,
          },
          {
            reviewer: "study-reader",
            model: "Sonnet",
            start: ago(230),
            end: ago(228),
            result: "passed",
            cost: 0.41,
          },
          {
            reviewer: "ui-reviewer",
            model: "Opus",
            start: ago(220),
            end: ago(201),
            result: "no verdict",
            cost: 5.02,
          },
        ]),
      ],
    });
    return [refining, building, reviewing];
  };

  it("prints the mockup's rows under each card, in columns", () => {
    const lines = formatRows(
      toRows(
        {
          issues: mockup(),
          pulls: [pull(230, { closes: [], body: "" })],
        },
        board(),
        new Map(),
        NOW,
        { ref: REF },
      ),
      NOW,
    ).filter((l) => /^ +[…✓✗?] /.test(l));

    expect(lines).toEqual([
      "        … factory-ticket-readiness  Sonnet  running               4 min so far",
      "        ✓ factory-test-reviewer  Sonnet  passed                3 min        $0.03",
      "        ✗ ui-reviewer      Opus    2 findings to fix     24 min       $0.18",
      "        … a11y-inspector   Sonnet  running               8 min so far",
      "        ✓ seo-reviewer     Opus    passed                11 min       $0.07",
      "        ✓ study-reader     Sonnet  passed                2 min        $0.01",
      "        ? ui-reviewer      Opus    finished, no verdict  19 min       $0.15",
    ]);
  });

  it("puts the rows below the card's pull request line", () => {
    const [, building] = mockup();
    const lines = formatRows(
      toRows(
        { issues: [building], pulls: [pull(230, { closes: ["224"] })] },
        board(),
        new Map(),
        NOW,
        { ref: REF },
      ),
      NOW,
    );
    const at = (pattern: RegExp) => lines.findIndex((l) => pattern.test(l));

    expect(at(/↳ Pull request #230/)).toBeGreaterThan(at(/#224/));
    expect(at(/✓ factory-test-reviewer/)).toBe(at(/↳ Pull request #230/) + 1);
  });

  it("shows only each reviewer's latest run since the card's session began", () => {
    const built = issue(224, {
      comments: [
        marker(200, "refining local a"),
        runs([
          {
            reviewer: "factory-ticket-readiness",
            model: "Sonnet",
            start: ago(190),
            end: ago(180),
            result: "passed",
          },
        ]),
        marker(100, "refined"),
        marker(60, "claim local b"),
        runs([
          {
            reviewer: "factory-test-reviewer",
            model: "Sonnet",
            start: ago(50),
            end: ago(45),
            result: "failed",
            findings: 1,
          },
          {
            reviewer: "factory-test-reviewer",
            model: "Sonnet",
            start: ago(30),
            end: ago(28),
            result: "passed",
          },
        ]),
      ],
    });
    const { rows } = toRows(
      { issues: [built], pulls: [] },
      board(),
      new Map(),
      NOW,
      { ref: REF },
    );

    expect(rows[0].runs.map((r) => [r.reviewer, r.result])).toEqual([
      ["factory-test-reviewer", "passed"],
    ]);
  });

  it("shows no rows under a card in Backlog", () => {
    const parked = issue(5, {
      comments: [
        marker(60, "claim local b"),
        marker(50, "released"),
        runs([
          {
            reviewer: "factory-test-reviewer",
            model: "Sonnet",
            start: ago(55),
          },
        ]),
      ],
    });
    const { rows } = toRows(
      { issues: [parked], pulls: [] },
      board([[5, "Backlog", ago(10)]]),
      new Map(),
      NOW,
      { ref: REF },
    );
    expect(rows[0].derived?.status).toBe("Backlog");
    expect(rows[0].runs).toEqual([]);
  });

  it("shows a run still running after two hours as no finish recorded, with no time or cost", () => {
    const run: ReviewerRun = {
      id: "a",
      reviewer: "ui-reviewer",
      model: "Opus",
      start: ago(121),
      result: "running",
    };
    expect(runLine(run, NOW, { color: false, width: null })).toBe(
      "? ui-reviewer      Opus    no finish recorded",
    );
  });

  it("colors the mark and the result, dims the model, time, and cost, and shows the cost in subscription dollars", () => {
    const color = { color: true, width: 80 };
    const passed = runLine(
      {
        id: "a",
        reviewer: "factory-test-reviewer",
        model: "Sonnet",
        start: ago(5),
        end: ago(2),
        result: "passed",
        cost: 28,
      },
      NOW,
      color,
    );
    expect(passed).toBe(
      `${p("green", "✓")} factory-test-reviewer  ${p("dim", "Sonnet")}  ${p("green", "passed              ")}  ${p("dim", "3 min      ")}  ${p("dim", "$0.84")}`,
    );
    const running = runLine(
      {
        id: "a",
        reviewer: "a11y-inspector",
        model: "Sonnet",
        start: ago(8),
        result: "running",
      },
      NOW,
      color,
    );
    expect(running).toContain(p("yellow", "…"));
    expect(running).toContain(`${ends("yellow")[0]}running`);
    expect(running).toContain(p("dim", "8 min so far"));
    const failed = runLine(
      {
        id: "a",
        reviewer: "ui-reviewer",
        model: "Opus",
        start: ago(30),
        end: ago(6),
        result: "failed",
        findings: 2,
        cost: 6.1,
      },
      NOW,
      color,
    );
    expect(failed).toContain(p("red", "✗"));
    expect(failed).toContain(`${ends("red")[0]}2 findings to fix`);
    const noVerdict = runLine(
      {
        id: "a",
        reviewer: "ui-reviewer",
        model: "Opus",
        start: ago(30),
        end: ago(6),
        result: "no verdict",
        cost: 5,
      },
      NOW,
      color,
    );
    expect(noVerdict).toContain(p("dim", "?"));
    expect(noVerdict).toContain(`${ends("dim")[0]}finished, no verdict`);
  });
});

describe("sessionCell", () => {
  it("shows an Actions run as actions and its run ID", () => {
    expect(
      sessionCell({
        status: "In progress",
        session: "123456789",
        runsIn: "Actions",
        since: null,
        pulls: [],
      }),
    ).toBe("actions 123456789");
  });
});
