import { describe, expect, it } from "vitest";
import {
  entryOf,
  markersIn,
  recordOf,
} from "../src/tickets/record-comments.mts";
import { asIssue, type GithubIssue } from "./ticket-fixture.ts";
import {
  commentBody,
  derive,
  issueCost,
  DEFAULT_COLUMNS,
  isNotStarted,
  isStale,
  parseCosts,
  parseMarkers,
  parseRuns,
  toClear,
  toSnapshot,
  doneAt,
  workState,
  type CommentKind,
  type Issue,
  type IssueComment,
  type PullRequest,
} from "../src/lib/work-status.mts";
import {
  fromIssuesPages,
  toBoard,
  type BoardPage,
  type IssuesPage,
} from "../src/tickets/github.mts";
import {
  fromLinkingPages,
  toPull,
  type LinkingPage,
  type RawPull,
} from "../src/code-host/github.mts";

import { memoryTickets } from "./memory-tickets";

const AGENT = "<!-- agent -->";
const at = (minute: number) =>
  new Date(Date.UTC(2026, 10, 9, 12, minute)).toISOString();
let nextId = 100;
const said = (minute: number, marker: string, id = nextId++): IssueComment => ({
  id: String(id),
  createdAt: at(minute),
  author: "acme",
  body: `Text.\n\n<!-- work-status: ${marker} -->\n${AGENT}`,
});
/** The markers a comment's body carries, read as GitHub's adapter reads
 * them, then parsed. */
const bodyMarkers = (body: string) =>
  parseMarkers(markersIn({ id: "1", createdAt: at(0), author: "acme", body }));
/** The work state of comments, read as GitHub's adapter reads them. */
const stateOf = (comments: IssueComment[]) => workState(recordOf(comments));
const LINKS_IN = memoryTickets().tickets.linksIn;
/** Ticket 7 as a comment names it. */
const SEVEN = { key: "7", ref: "#7" };
const issue = (over: Partial<GithubIssue> = {}): Issue =>
  asIssue({
    key: "7",
    title: "An issue",
    state: "open",
    closedAt: null,
    labels: [],
    comments: [],
    ...over,
  });
const pull = (over: Partial<PullRequest> = {}): PullRequest => ({
  number: 50,
  createdAt: at(30),
  body: "Closes #7",
  closes: ["7"],
  isDraft: true,
  checks: null,
  openThreads: 0,
  author: "acme",
  ...over,
  // The links as `linkPulls` reads them from the body.
  partOf: over.partOf ?? LINKS_IN(over.body ?? "Closes #7").partOf,
});
const ready = (minute: number) => ({ status: "Ready", updatedAt: at(minute) });

describe("parseMarkers", () => {
  it.each([
    [
      "refining local 359bd84e",
      { kind: "refining", where: "local", id: "359bd84e" },
    ],
    [
      "claim cloud cse_01Ab3x",
      { kind: "claim", where: "cloud", id: "cse_01Ab3x" },
    ],
    [
      "claim actions 123456789",
      { kind: "claim", where: "actions", id: "123456789" },
    ],
    [
      "started cloud st_0123456789ab",
      { kind: "started", where: "cloud", marker: "st_0123456789ab" },
    ],
    [
      "started actions st_0123456789ab",
      { kind: "started", where: "actions", marker: "st_0123456789ab" },
    ],
    ["waiting", { kind: "waiting" }],
    ["refined", { kind: "refined" }],
    ["released", { kind: "released" }],
    ["cleared", { kind: "cleared" }],
    ["partial", { kind: "partial" }],
  ])("reads %s", (marker, expected) => {
    expect(
      bodyMarkers(`Hi.\n\n<!-- work-status: ${marker} -->\n${AGENT}`),
    ).toEqual([expected]);
  });

  it("ignores a marker in a comment without the agent mark", () => {
    expect(bodyMarkers("<!-- work-status: released -->")).toEqual([]);
  });

  it("ignores a marker that shares its line with other text", () => {
    expect(
      bodyMarkers(`See <!-- work-status: released --> here.\n${AGENT}`),
    ).toEqual([]);
  });

  it("ignores a marker inside a fenced code block, and reads one after it", () => {
    const body = [
      "```",
      "<!-- work-status: released -->",
      "```",
      "<!-- work-status: cleared -->",
      AGENT,
    ].join("\n");

    expect(bodyMarkers(body)).toEqual([{ kind: "cleared" }]);
  });

  it("keeps a tilde fence open across a backtick line", () => {
    const body = [
      "~~~",
      "```",
      "<!-- work-status: released -->",
      "~~~",
      AGENT,
    ].join("\n");

    expect(bodyMarkers(body)).toEqual([]);
  });

  it("ignores a marker that ends a line of other text", () => {
    expect(bodyMarkers(`See <!-- work-status: released -->\n${AGENT}`)).toEqual(
      [],
    );
  });

  it("rejects an unknown kind", () => {
    expect(bodyMarkers(`<!-- work-status: claim moon x -->\n${AGENT}`)).toEqual(
      [],
    );
  });
});

describe("workState", () => {
  it("makes the oldest claim live by time, whatever the comment IDs", () => {
    const older = said(1, "claim local aaa", 9);
    const newer = said(2, "claim local bbb", 3);

    expect(stateOf([newer, older]).live?.id).toBe("9");
  });

  it("makes the oldest claim live when none was", () => {
    const first = said(1, "claim local aaa", 2);
    const second = said(1, "claim local bbb", 3);

    expect(stateOf([first, second]).live?.id).toBe("2");
  });

  it("orders claims posted in the same second as the ticket system returned them, never by their IDs", () => {
    expect(
      stateOf([said(1, "claim local b", 9), said(1, "claim local a", 8)]).live
        ?.id,
    ).toBe("9");
  });

  it("never counts a claim posted while another was live, even after a release", () => {
    const state = stateOf([
      said(1, "claim local aaa", 1),
      said(2, "claim local bbb", 2),
      said(3, "released", 3),
    ]);

    expect(state.live).toBeNull();
    expect(state.lastLive?.id).toBe("1");
  });

  it("keeps the newest claim that was ever live after a rebuild", () => {
    const state = stateOf([
      said(1, "claim local aaa", 1),
      said(2, "released", 2),
      said(3, "claim local bbb", 3),
    ]);

    expect(state.lastLive?.id).toBe("3");
  });

  it("lets a claim that never counted turn live once the live one is deleted", () => {
    expect(stateOf([said(2, "claim local bbb", 2)]).live?.id).toBe("2");
  });

  it.each(["released", "cleared"])("ends the live claim on %s", (end) => {
    expect(stateOf([said(1, "claim local a"), said(2, end)]).live).toBeNull();
  });

  it.each(["claim local a", "released", "cleared", "refining local x"])(
    "ends a start on %s",
    (marker) => {
      expect(
        stateOf([said(1, "started actions st_1"), said(2, marker)]).start,
      ).toBeNull();
    },
  );

  it("keeps a start that nothing followed", () => {
    expect(stateOf([said(1, "started actions st_1", 5)]).start?.id).toBe("5");
  });
});

describe("derive", () => {
  it("is In progress in Actions while a run's claim is live", () => {
    expect(
      derive(
        issue({ comments: [said(1, "claim actions 123456789")] }),
        null,
        [],
      ),
    ).toMatchObject({
      status: "In progress",
      session: "123456789",
      runsIn: "Actions",
    });
  });

  it("is Done once closed, with the last live claim", () => {
    const closed = issue({
      state: "closed",
      closedAt: at(50),
      comments: [said(1, "claim cloud cse_9")],
    });

    expect(derive(closed, ready(0), [])).toMatchObject({
      status: "Done",
      session: "cloud cse_9",
      runsIn: "",
      since: at(50),
    });
  });

  it("is In review while an open pull request closes it", () => {
    const comments = [said(1, "claim local 359bd84e"), said(2, "released")];

    expect(derive(issue({ comments }), null, [pull()])).toMatchObject({
      status: "In review",
      session: "359bd84e",
      runsIn: "Local",
      since: at(30),
      pulls: [50],
    });
  });

  it("puts the follow-ups issue In review on a pull request that builds part of it", () => {
    const followUps = issue({ labels: ["follow-up"] });
    const partial = pull({ closes: [], body: "Part of #7: its first line." });

    expect(derive(followUps, null, [partial]).status).toBe("In review");
    expect(derive(issue(), null, [partial]).status).toBe("Backlog");
  });

  it("finds the follow-ups issue by the label name the settings give it", () => {
    const followUps = issue({ labels: ["follow-ups"] });
    const partial = pull({ closes: [], body: "Part of #7: its first line." });

    expect(
      derive(followUps, null, [partial], DEFAULT_COLUMNS, "follow-ups").status,
    ).toBe("In review");
    expect(
      derive(
        issue({ labels: ["follow-up"] }),
        null,
        [partial],
        DEFAULT_COLUMNS,
        "follow-ups",
      ).status,
    ).toBe("Backlog");
  });

  it("leaves the follow-ups issue alone when a pull request only links a line to it", () => {
    const followUps = issue({ labels: ["follow-up"] });
    const linking = pull({
      closes: ["3"],
      body: "Closes #3. A finding is on #7.",
    });

    expect(derive(followUps, null, [linking]).status).toBe("Backlog");
  });

  it("does not read part of #70 as part of #7", () => {
    const followUps = issue({ labels: ["follow-up"] });

    expect(
      derive(followUps, null, [pull({ closes: [], body: "Part of #70." })])
        .status,
    ).toBe("Backlog");
  });

  it("names the rebuild's session In review, not the first build's", () => {
    const comments = [
      said(1, "claim local first111"),
      said(2, "released"),
      said(3, "claim local second22"),
    ];

    expect(derive(issue({ comments }), null, [pull()]).session).toBe(
      "second22",
    );
  });

  it("is In progress with a live claim, over a Ready card", () => {
    expect(
      derive(issue({ comments: [said(5, "claim actions 123")] }), ready(1), []),
    ).toMatchObject({
      status: "In progress",
      session: "123",
      runsIn: "Actions",
      since: at(5),
    });
  });

  it("is In progress, starting, while only the poller's start counts", () => {
    expect(
      derive(
        issue({ comments: [said(5, "started actions st_1")] }),
        ready(1),
        [],
      ),
    ).toMatchObject({
      status: "In progress",
      session: "actions, starting",
      runsIn: "Actions",
    });
  });

  it("is In progress, actions starting, for a start the poller made for Actions", () => {
    expect(
      derive(
        issue({ comments: [said(5, "started actions st_1")] }),
        ready(1),
        [],
      ),
    ).toMatchObject({
      status: "In progress",
      session: "actions, starting",
      runsIn: "Actions",
    });
  });

  it("is Ready when the card moved there after the newest reset", () => {
    expect(
      derive(issue({ comments: [said(5, "refined")] }), ready(6), []),
    ).toMatchObject({ status: "Ready", since: at(6), session: "", runsIn: "" });
  });

  it.each(["released", "cleared", "refined", "refining local x", "waiting"])(
    "is not Ready when %s came after the card moved",
    (marker) => {
      expect(
        derive(issue({ comments: [said(6, marker)] }), ready(5), []).status,
      ).not.toBe("Ready");
    },
  );

  it("is Ready with no markers at all", () => {
    expect(derive(issue(), ready(5), []).status).toBe("Ready");
  });

  it("is In refinement while a refinement start is newest", () => {
    expect(
      derive(
        issue({ comments: [said(1, "refining local cse2xxxx")] }),
        null,
        [],
      ),
    ).toMatchObject({
      status: "In refinement",
      session: "cse2xxxx",
      runsIn: "Local",
      since: at(1),
    });
  });

  it("is In refinement, waiting on you, after a comment round", () => {
    const comments = [said(1, "refining local a"), said(2, "waiting")];

    expect(derive(issue({ comments }), null, [])).toMatchObject({
      status: "In refinement",
      session: "Waiting on you",
      runsIn: "",
      since: at(2),
    });
  });

  it("lets Ready set after a waiting round outrank In refinement", () => {
    const comments = [said(2, "waiting")];

    expect(derive(issue({ comments }), ready(3), []).status).toBe("Ready");
  });

  it("leaves waiting once a build of the round claimed and released it", () => {
    const comments = [
      said(2, "waiting"),
      said(3, "claim local a"),
      said(4, "released"),
    ];

    expect(derive(issue({ comments }), null, []).status).toBe("In progress");
  });

  it("leaves waiting once the poller's start for the round failed to fire", () => {
    const comments = [
      said(2, "waiting"),
      said(4, "started actions st_1"),
      said(5, "released"),
    ];

    expect(derive(issue({ comments }), ready(3), []).status).toBe(
      "In progress",
    );
  });

  it("is Backlog with the card's time when the owner moved it after refinement", () => {
    const comments = [said(1, "refining local a"), said(2, "refined")];

    expect(
      derive(issue({ comments }), { status: "Backlog", updatedAt: at(3) }, []),
    ).toMatchObject({ status: "Backlog", since: at(3) });
  });

  it("is Backlog off the board, with no time", () => {
    expect(derive(issue(), null, [])).toMatchObject({
      status: "Backlog",
      since: null,
    });
  });
});

describe("derive: a card moves only forward on its own", () => {
  const backlog = (minute: number) => ({
    status: "Backlog",
    updatedAt: at(minute),
  });
  const waitingOnYou = (status: string, minute: number) => ({
    status,
    session: "Waiting on you",
    runsIn: "",
    since: at(minute),
  });
  /** A comment as the session, sync, or poller posts it. */
  const posted = (minute: number, kind: CommentKind): IssueComment => ({
    id: String(nextId++),
    createdAt: at(minute),
    author: "acme",
    body: commentBody(kind),
  });
  // Each way a build ends without a merge: what it followed, and the comment
  // that ends it.
  const ended: [string, string, CommentKind][] = [
    [
      "stopped",
      "claim actions 123",
      { kind: "stopped", where: "actions", issue: SEVEN, reason: "r" },
    ],
    [
      "cleared-claim",
      "claim actions 123",
      { kind: "cleared-claim", issue: SEVEN, since: at(1) },
    ],
    [
      "cleared-start",
      "started actions st_1",
      { kind: "cleared-start", issue: SEVEN, since: at(1) },
    ],
    [
      "pull-closed",
      "claim actions 123",
      { kind: "pull-closed", issue: SEVEN, pull: 9 },
    ],
    [
      "fire-failed",
      "started actions st_1",
      {
        kind: "dispatch-failed",
        issue: SEVEN,
        status: "401",
        reason: "Unauthorized",
      },
    ],
  ];
  const endedComments = (begun: string, end: CommentKind) => [
    said(1, begun),
    posted(2, end),
  ];

  it("stays In refinement, waiting on you, once refinement is done", () => {
    const comments = [said(1, "refining local a"), said(2, "refined")];

    expect(derive(issue({ comments }), backlog(0), [])).toMatchObject(
      waitingOnYou("In refinement", 2),
    );
  });

  it.each(ended)(
    "stays In progress, waiting on you, after %s",
    (_name, begun, end) => {
      expect(
        derive(
          issue({ comments: endedComments(begun, end) }),
          { status: "In progress", updatedAt: at(1) },
          [],
        ),
      ).toMatchObject(waitingOnYou("In progress", 2));
    },
  );

  it("goes to Backlog after part of the follow-ups merged, ending its claim", () => {
    const comments = [
      said(1, "claim actions 123"),
      posted(2, { kind: "follow-ups-merged", pull: 9 }),
    ];
    const followUps = issue({ labels: ["follow-up"], comments });

    expect(stateOf(comments).live).toBeNull();
    expect(
      derive(followUps, { status: "In review", updatedAt: at(1) }, []),
    ).toMatchObject({ status: "Backlog", session: "", since: at(2) });
  });

  it("ends a start on a partial merge", () => {
    expect(
      stateOf([said(1, "started actions st_1"), said(2, "partial")]).start,
    ).toBeNull();
  });

  it.each<[string, IssueComment[]]>([
    ["refined", [said(1, "refined")]],
    ["waiting", [said(1, "waiting")]],
    ...ended.map(([name, begun, end]): [string, IssueComment[]] => [
      name,
      endedComments(begun, end),
    ]),
  ])("is Backlog when the owner moved it there after %s", (_name, comments) => {
    expect(derive(issue({ comments }), backlog(9), []).status).toBe("Backlog");
  });

  it.each([
    ["claim local a", "In progress"],
    ["started actions st_1", "In progress"],
    ["refining local a", "In refinement"],
  ])(
    "is not Backlog when the owner moved it there under %s",
    (marker, status) => {
      const comments = [said(1, "refined"), said(2, marker)];

      expect(derive(issue({ comments }), backlog(9), []).status).toBe(status);
    },
  );

  it("is not Backlog when the card's Backlog is older than the newest marker", () => {
    const comments = [said(2, "claim local a"), said(3, "released")];

    expect(derive(issue({ comments }), backlog(1), []).status).toBe(
      "In progress",
    );
  });

  it.each(ended)(
    "is Ready when the owner moved it there after %s",
    (_name, begun, end) => {
      expect(
        derive(issue({ comments: endedComments(begun, end) }), ready(3), [])
          .status,
      ).toBe("Ready");
    },
  );

  it("is Ready only when the owner moved it there after a partial merge", () => {
    const comments = [said(1, "claim local a"), said(2, "partial")];

    expect(derive(issue({ comments }), ready(1), []).status).toBe("Backlog");
    expect(derive(issue({ comments }), ready(3), []).status).toBe("Ready");
  });

  it.each([
    ["claim local a", "In progress", "a"],
    ["started actions st_1", "In progress", "actions, starting"],
    ["refining local b", "In refinement", "b"],
  ])("moves on from a stop when %s follows", (marker, status, session) => {
    const comments = [
      said(1, "claim local x"),
      said(2, "released"),
      said(3, marker),
    ];

    expect(derive(issue({ comments }), backlog(9), [])).toMatchObject({
      status,
      session,
    });
  });

  const LATER = new Date(Date.UTC(2026, 10, 12));

  it.each([
    ["In progress", ["claim local a", "released"]],
    ["In refinement", ["refining local a", "refined"]],
  ])("does not flag %s, waiting on you, stale", (status, markers) => {
    const waiting = derive(
      issue({ comments: markers.map((m, i) => said(i + 1, m)) }),
      null,
      [],
    );

    expect(waiting).toMatchObject({ status, session: "Waiting on you" });
    expect(isStale(waiting, LATER)).toBe(false);
  });

  it("clears nothing after a stop", () => {
    const comments = [said(1, "claim local a"), said(2, "released")];

    expect(toClear(issue({ comments }), [], LATER)).toBeNull();
  });
});

const NOW = new Date(Date.UTC(2026, 10, 10, 13, 0));

describe("flags", () => {
  const derived = (over: object) => ({
    status: "In progress" as const,
    session: "a",
    runsIn: "Local" as const,
    since: at(0),
    pulls: [],
    ...over,
  });

  it("calls a session over 24 hours old stale", () => {
    expect(isStale(derived({}), NOW)).toBe(true);
    expect(isStale(derived({ since: NOW.toISOString() }), NOW)).toBe(false);
  });

  it("does not call an old In review row stale", () => {
    expect(isStale(derived({ status: "In review" }), NOW)).toBe(false);
  });

  it("does not call a round waiting on the owner stale", () => {
    expect(
      isStale(
        derived({ status: "In refinement", session: "Waiting on you" }),
        NOW,
      ),
    ).toBe(false);
  });

  it("flags a Ready card unstarted after 5 minutes with no open blocker", () => {
    const readyFor = (minutes: number) =>
      derived({
        status: "Ready",
        since: new Date(NOW.getTime() - minutes * 60_000).toISOString(),
      });

    expect(isNotStarted(readyFor(6), [], NOW)).toBe(true);
    expect(isNotStarted(readyFor(4), [], NOW)).toBe(false);
    expect(isNotStarted(readyFor(6), ["12"], NOW)).toBe(false);
  });
});

describe("toClear", () => {
  it("clears a live claim over 24 hours old", () => {
    expect(
      toClear(issue({ comments: [said(0, "claim local a")] }), [], NOW),
    ).toEqual({ kind: "claim", since: at(0) });
  });

  it("clears an Actions run's claim over 24 hours old", () => {
    expect(
      toClear(issue({ comments: [said(0, "claim actions 123")] }), [], NOW),
    ).toEqual({ kind: "claim", since: at(0) });
  });

  it("clears a start over 24 hours old", () => {
    expect(
      toClear(issue({ comments: [said(0, "started actions st_1")] }), [], NOW),
    ).toEqual({ kind: "start", since: at(0) });
  });

  it("leaves a claim whose pull request is open", () => {
    expect(
      toClear(issue({ comments: [said(0, "claim local a")] }), [pull()], NOW),
    ).toBeNull();
  });

  it("leaves a claim under 24 hours old", () => {
    const fresh = { ...said(0, "claim local a"), createdAt: NOW.toISOString() };

    expect(toClear(issue({ comments: [fresh] }), [], NOW)).toBeNull();
  });
});

describe("commentBody", () => {
  const local = { where: "local" as const, id: "359bd84e" };

  it.each([
    [
      { kind: "claim", who: local },
      "Building this in a local session, 359bd84e.",
      "claim local 359bd84e",
    ],
    [
      {
        kind: "claim",
        who: {
          where: "actions",
          id: "123456789",
          link: "https://github.com/o/r/actions/runs/123456789",
          actor: "alice",
        },
      },
      "Building this in GitHub Actions, run [123456789](https://github.com/o/r/actions/runs/123456789), started by @alice.",
      "claim actions 123456789",
    ],
    [
      { kind: "claim", who: { where: "local", id: "unknown" } },
      "Building this in a local session.",
      "claim local unknown",
    ],
    [
      { kind: "refining", who: { where: "local", id: "unknown" } },
      "Refining this issue in a local session.",
      "refining local unknown",
    ],
    [
      { kind: "waiting" },
      "Refinement is waiting on you: the questions are in the comment above.",
      "waiting",
    ],
    [
      { kind: "refined", issue: SEVEN },
      "Refinement is done. The card stays In refinement until it moves to Ready, which starts a build in GitHub Actions: move it there, or ask this session to. To build it on your machine instead, tell a local session to work #7.",
      "refined",
    ],
    [
      { kind: "started", marker: "st_ab" },
      "Starting a build in GitHub Actions: the card moved to Ready.",
      "started actions st_ab",
    ],
    [
      {
        kind: "dispatch-failed",
        issue: SEVEN,
        status: "403",
        reason: "Forbidden",
      },
      "Could not start a build in GitHub Actions: GitHub answered 403 (Forbidden). The card stays In progress, waiting on you. Move it to Ready to try again.",
      "released",
    ],
    [
      {
        kind: "stopped",
        where: "actions",
        issue: SEVEN,
        reason: "blocked by #3",
      },
      "Stopped without a pull request: blocked by #3. The card stays In progress, waiting on you. Run `factory build 7` to try again, or move it to Ready.",
      "released",
    ],
    [
      {
        kind: "stopped",
        where: "local",
        issue: SEVEN,
        reason: "blocked by #3",
      },
      "Stopped without a pull request: blocked by #3. The card stays In progress, waiting on you. Tell a session to work #7 again, or move it to Ready to build it in GitHub Actions.",
      "released",
    ],
    [
      { kind: "cleared-claim", issue: SEVEN, since: at(5) },
      "Cleared the claim from 2026-11-09 12:05 UTC: no pull request after 24 hours, so that session has stopped. The card stays In progress, waiting on you. Move it to Ready to try again.",
      "cleared",
    ],
    [
      { kind: "cleared-start", issue: SEVEN, since: at(5) },
      "Cleared the build started 2026-11-09 12:05 UTC: no claim or pull request after 24 hours. The card stays In progress, waiting on you. Move it to Ready to try again.",
      "cleared",
    ],
    [
      { kind: "follow-ups-merged", pull: 9 },
      "Pull request #9 merged part of these follow-ups. The unchecked lines wait for the next build; the card is back in Backlog.",
      "partial",
    ],
    [
      { kind: "pull-closed", issue: SEVEN, pull: 9 },
      "Pull request #9 was closed without merging. The card stays In progress, waiting on you. Move it to Ready to rebuild it, or ask a session to refine it first.",
      "released",
    ],
  ] as const)("writes %j", (kind, sentence, marker) => {
    expect(commentBody(kind)).toBe(
      `${sentence}\n\n<!-- work-status: ${marker} -->\n${AGENT}`,
    );
  });

  it("names a ticket by its key in a command and by its written form in prose", () => {
    // A written form unlike the key, so a command given the written form
    // shows.
    const key = { key: "web-7", ref: "WEB 7" };
    expect(
      commentBody({
        kind: "stopped",
        where: "actions",
        issue: key,
        reason: "x",
      }),
    ).toContain("Run `factory build web-7` to try again");
    expect(
      commentBody({ kind: "stopped", where: "local", issue: key, reason: "x" }),
    ).toContain("Tell a session to work WEB 7 again");
    expect(
      commentBody(
        { kind: "pull-closed", issue: key, pull: 9 },
        { ...DEFAULT_COLUMNS, Ready: null },
      ),
    ).toContain("Tell a session to build WEB 7, or run `factory build web-7`");
  });

  it("puts a closing comment's own text before the refined sentence", () => {
    expect(
      commentBody({
        kind: "refined",
        issue: SEVEN,
        before: "Nothing to decide.\n",
      }),
    ).toMatch(/^Nothing to decide\.\n\nRefinement is done\./);
  });

  it("names Backlog in no comment but a partial follow-ups merge's", () => {
    const kinds: CommentKind[] = [
      { kind: "refining", who: local },
      { kind: "waiting" },
      { kind: "refined", issue: SEVEN },
      { kind: "started", marker: "st_ab" },
      {
        kind: "dispatch-failed",
        issue: SEVEN,
        status: "403",
        reason: "Forbidden",
      },
      {
        kind: "dispatch-failed",
        issue: SEVEN,
        status: "401",
        reason: "Unauthorized",
      },
      { kind: "claim", who: local },
      { kind: "stopped", where: "actions", issue: SEVEN, reason: "r" },
      { kind: "stopped", where: "local", issue: SEVEN, reason: "r" },
      { kind: "cleared-claim", issue: SEVEN, since: at(5) },
      { kind: "cleared-start", issue: SEVEN, since: at(5) },
      { kind: "follow-ups-merged", pull: 9 },
      { kind: "pull-closed", issue: SEVEN, pull: 9 },
    ];

    expect(
      kinds
        .filter((kind) => /Backlog/.test(commentBody(kind)))
        .map((kind) => kind.kind),
    ).toEqual(["follow-ups-merged"]);
  });

  it("writes a marker its own parser reads", () => {
    const body = commentBody({ kind: "claim", who: local });

    expect(bodyMarkers(body)).toEqual([
      { kind: "claim", where: "local", id: "359bd84e" },
    ]);
  });
});

describe("toSnapshot", () => {
  const REPO = "acme/widgets";
  const rawIssue = (number: number, closedAt: string | null) => ({
    number,
    title: "T",
    state: closedAt ? ("CLOSED" as const) : ("OPEN" as const),
    closedAt,
    labels: { nodes: [{ name: "follow-up" }] },
    comments: {
      nodes: [{ databaseId: 1, createdAt: at(1), body: "b", author: null }],
    },
  });
  const page = (over: object = {}): IssuesPage => ({
    data: {
      repository: {
        open: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [rawIssue(1, null)],
        },
        closed: {
          nodes: [
            rawIssue(2, new Date(NOW.getTime() - 3600_000).toISOString()),
            rawIssue(3, at(0)),
          ],
        },
        ...over,
      },
    },
  });
  const rawPull: RawPull = {
    number: 9,
    createdAt: at(2),
    body: "",
    isDraft: false,
    author: { login: "dependabot" },
    closingIssuesReferences: {
      nodes: [
        { number: 1, repository: { nameWithOwner: REPO } },
        { number: 4, repository: { nameWithOwner: "other/repo" } },
      ],
    },
    reviewThreads: {
      nodes: [{ isResolved: false }, { isResolved: true }],
    },
    commits: {
      nodes: [{ commit: { statusCheckRollup: { state: "SUCCESS" } } }],
    },
  };
  const snapshotOf = (pages: IssuesPage[]) =>
    toSnapshot(fromIssuesPages(pages), [toPull(rawPull, REPO)], NOW);

  it("keeps open issues and those closed in the last day", () => {
    expect(snapshotOf([page()]).issues.map((i) => i.key)).toEqual(["1", "2"]);
  });

  it("keeps this repository's closing references only, and counts open threads", () => {
    expect(snapshotOf([page()]).pulls[0]).toMatchObject({
      closes: ["1"],
      openThreads: 1,
      checks: "SUCCESS",
    });
  });

  it("keeps the open issues of every page", () => {
    const second = page({
      open: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [rawIssue(4, null)],
      },
    });

    expect(snapshotOf([page(), second]).issues.map((i) => i.key)).toEqual([
      "1",
      "4",
      "2",
    ]);
  });

  it("reads the closed and merged pull requests that mentioned an issue, however old, apart from the open ones", () => {
    const old = {
      number: 8,
      createdAt: "2026-01-01T00:00:00Z",
      body: "Part of #1",
      isDraft: false,
      author: { login: "acme" },
      closingIssuesReferences: { nodes: [] },
      comments: {
        nodes: [
          {
            databaseId: 5,
            createdAt: at(3),
            body: "<!-- cost: 1.00 -->",
            author: { login: "github-actions[bot]" },
          },
        ],
      },
    };
    const open = { ...old, number: 9 };
    const links: LinkingPage = {
      data: {
        repository: {
          open: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [
              {
                builders: {
                  nodes: [
                    { source: old },
                    { source: open },
                    // A mention from another issue carries no pull request
                    // fields.
                    { source: {} },
                  ],
                },
              },
            ],
          },
          closed: { nodes: [] },
        },
      },
    };
    const snapshot = toSnapshot(
      fromIssuesPages([page()]),
      [toPull(rawPull, REPO)],
      NOW,
      fromLinkingPages([links], REPO, [9]),
    );
    expect(snapshot.pulls.map((p) => p.number)).toEqual([9]);
    expect(snapshot.donePulls).toMatchObject([
      {
        number: 8,
        openThreads: 0,
        comments: [
          { author: "github-actions[bot]", body: "<!-- cost: 1.00 -->" },
        ],
      },
    ]);
  });

  it("names a deleted account's comment ghost", () => {
    expect(snapshotOf([page()]).issues[0].comments![0].author).toBe("ghost");
  });
});

describe("toBoard", () => {
  const boardPage = (projectV2: unknown): BoardPage =>
    ({ data: { owner: { projectV2 } } }) as BoardPage;

  it("fails when the Project cannot be read", () => {
    expect(() => toBoard([boardPage(null)], "acme/widgets")).toThrow(/Project/);
  });

  it("keeps the cards of every page", () => {
    const item = (n: number) => ({
      id: `IT${n}`,
      content: { number: n, repository: { nameWithOwner: "acme/widgets" } },
      status: null,
      session: null,
      runsIn: null,
    });
    const onePage = (n: number) =>
      boardPage({
        id: "P",
        fields: { nodes: [] },
        items: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [item(n)],
        },
      });

    expect([
      ...toBoard([onePage(1), onePage(2)], "acme/widgets").items.keys(),
    ]).toEqual(["1", "2"]);
  });

  it("keeps this repository's issues, with Status and its time", () => {
    const board = toBoard(
      [
        boardPage({
          id: "P",
          fields: {
            nodes: [{ id: "F", name: "Status", dataType: "SINGLE_SELECT" }, {}],
          },
          items: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [
              {
                id: "IT1",
                content: {
                  number: 7,
                  repository: { nameWithOwner: "acme/widgets" },
                },
                status: { name: "Ready", updatedAt: at(3) },
                session: { text: "a" },
                runsIn: null,
              },
              {
                id: "IT2",
                content: { number: 8, repository: { nameWithOwner: "x/y" } },
                status: null,
                session: null,
                runsIn: null,
              },
              {
                id: "IT3",
                content: {},
                status: null,
                session: null,
                runsIn: null,
              },
            ],
          },
        }),
      ],
      "acme/widgets",
    );

    expect([...board.items.values()]).toEqual([
      {
        itemId: "IT1",
        key: "7",
        status: "Ready",
        updatedAt: at(3),
        session: "a",
        runsIn: "",
        cost: null,
        rank: 0,
      },
    ]);
    expect(board.fields).toHaveLength(1);
  });

  it("reads the Cost a card already holds", () => {
    const board = toBoard(
      [
        boardPage({
          id: "P",
          fields: { nodes: [] },
          items: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [
              {
                id: "IT1",
                content: {
                  number: 7,
                  repository: { nameWithOwner: "acme/widgets" },
                },
                status: null,
                session: null,
                runsIn: null,
                cost: { number: 4 },
              },
            ],
          },
        }),
      ],
      "acme/widgets",
    );

    expect(board.items.get("7")?.cost).toBe(4);
  });
});

describe("parseCosts", () => {
  const comment = (body: string, author = "acme"): IssueComment => ({
    id: "1",
    createdAt: at(1),
    author,
    body,
  });

  it("reads a session's marker on a line of its own", () => {
    expect(
      parseCosts(
        comment(`Spent.\n\n<!-- cost: 3.41 session=abc -->\n${AGENT}`),
      ),
    ).toEqual([3.41]);
  });

  it("reads the CI review's marker without the agent mark", () => {
    expect(
      parseCosts(
        comment(
          "Review cost: $0.92.\n\n<!-- cost: 0.92 -->",
          "github-actions[bot]",
        ),
      ),
    ).toEqual([0.92]);
  });

  it("ignores a comment without the agent mark from anyone but the CI review's bot", () => {
    expect(
      parseCosts(comment("<!-- cost: 3.41 session=abc -->", "acme-builds")),
    ).toEqual([]);
  });

  it("reads a marker with the agent mark whoever posted it", () => {
    expect(
      parseCosts(
        comment(`<!-- cost: 3.41 session=abc -->\n${AGENT}`, "acme-builds"),
      ),
    ).toEqual([3.41]);
  });

  it("ignores a marker inside a code fence or inside a line", () => {
    expect(
      parseCosts(
        comment(
          `\`\`\`\n<!-- cost: 3.41 -->\n\`\`\`\nSee <!-- cost: 1.00 --> here.\n${AGENT}`,
        ),
      ),
    ).toEqual([]);
  });
});

describe("issueCost", () => {
  const cost = (n: string, author = "acme"): IssueComment => ({
    id: String(nextId++),
    createdAt: at(1),
    author,
    body: `<!-- cost: ${n} session=s -->\n${AGENT}`,
  });

  it("sums the issue's markers and those of every pull request that builds it, to the cent", () => {
    const pulls = [
      pull({ number: 50, closes: ["7"], comments: [cost("1.01")] }),
      pull({
        number: 51,
        body: "Part of #7",
        closes: [],
        comments: [cost("2.10")],
      }),
      pull({
        number: 52,
        body: "closes #7",
        closes: ["7"],
        comments: [cost("1")],
      }),
      pull({
        number: 53,
        body: "Closes #70",
        closes: [],
        comments: [cost("9")],
      }),
    ];
    expect(issueCost(issue({ comments: [cost("5.96")] }), pulls)).toBe(10.07);
  });

  it("is null when nothing carries a marker", () => {
    expect(issueCost(issue(), [pull()])).toBeNull();
  });
});

describe("parseRuns", () => {
  const run = {
    id: "a1",
    reviewer: "factory-test-reviewer",
    model: "Sonnet",
    start: at(1),
    result: "passed",
  };
  /** The comment as GitHub's adapter reads it into the record. */
  const comment = (body: string) =>
    entryOf({ id: "1", createdAt: at(1), author: "acme", body }) ?? {
      id: "1",
      at: at(1),
      author: "acme",
      text: body,
      markers: [],
    };

  it("reads each row's hidden copy from a reviewer-runs comment", () => {
    expect(
      parseRuns(
        comment(
          `<!-- reviewer-runs session=s -->\n<!-- reviewer-run: ${JSON.stringify(run)} -->\n${AGENT}`,
        ),
      ),
    ).toEqual([run]);
  });

  it("skips rows that are not runs, and comments that are not the agents'", () => {
    const row = `<!-- reviewer-run: ${JSON.stringify(run)} -->`;
    expect(
      parseRuns(
        comment(
          `<!-- reviewer-runs session=s -->\n<!-- reviewer-run: {nope} -->\n<!-- reviewer-run: {"reviewer":"x","start":"never"} -->\n${AGENT}`,
        ),
      ),
    ).toEqual([]);
    expect(
      parseRuns(comment(`<!-- reviewer-runs session=s -->\n${row}`)),
    ).toEqual([]);
  });
});

describe("when a ticket became done", () => {
  const COLUMNS = {
    ...DEFAULT_COLUMNS,
    Done: ["Done", "Released"] as const,
  };
  const inColumn = (status: string, updatedAt: string) =>
    ({
      ...issue(),
      card: {
        itemId: "I_7",
        key: "7",
        status,
        updatedAt,
        session: "",
        runsIn: "",
      },
    }) as Issue;

  it("keeps a ticket moved to any done column in the last day, by its card's time", () => {
    const now = new Date(at(60));
    expect(
      toSnapshot([inColumn("Released", at(30))], [], now, [], COLUMNS).issues,
    ).toHaveLength(1);
  });

  it("drops one moved there over a day ago", () => {
    const now = new Date(Date.parse(at(30)) + 25 * 60 * 60 * 1000);
    expect(
      toSnapshot([inColumn("Released", at(30))], [], now, [], COLUMNS).issues,
    ).toEqual([]);
  });

  it("takes a merge the factory recorded over the card's time", () => {
    const merged = issue({ comments: [said(50, "merged")] });
    expect(doneAt(merged, { status: "Done", updatedAt: at(1) })).toBe(at(50));
  });
});
