import { readFileSync } from "node:fs";
import { entryOf } from "../src/tickets/record-comments.mts";
import { load as loadYaml } from "js-yaml";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkFields,
  closedPullComments,
  logLine,
  main,
  nightlyComments,
  planSync,
  DEFAULT_BOARD,
  type Deps,
  type PullSource,
  type Saved,
} from "../src/board.mts";
import {
  DEFAULT_COLUMNS,
  toSnapshot,
  type BoardField,
  type PullRequest,
  type RepoSnapshot,
} from "../src/lib/work-status.mts";
import { toBoard, type BoardPage } from "../src/tickets/github.mts";
import savedJson from "./fixtures/sync/repo.json";
import boardPages from "./fixtures/sync/board.json";
import { fakeSettings } from "./fake-gh";
import { memoryTickets, type MemoryOptions, type Seed } from "./memory-tickets";
import { API, confirming, network, SECTION, WEB, type Place } from "./network";
import { into, plainOf } from "./printed";

const FIXTURE = "tests/fixtures/sync";
const NOW = new Date("2026-11-09T10:00:00Z");
const SAVED = savedJson as Saved;
const BOARD = () => toBoard(boardPages as BoardPage[], "acme/widgets");

afterEach(() => vi.restoreAllMocks());

/** The fixture's tickets in memory, with the recorded board's cards. */
function seeded(options: MemoryOptions = {}) {
  const mem = memoryTickets(structuredClone(SAVED.tickets), {
    firstCommentId: 5000,
    ...options,
  });
  for (const item of BOARD().items.values()) mem.card(item.key, item);
  return mem;
}

/** The page of a run, as GitHub Actions' runner gives it. */
const RUN_PAGE = (id: string) =>
  `https://github.com/acme/widgets/actions/runs/${id}`;

/** The fixture's pull requests, recording what each read asked for. */
function fakePulls(closes: Record<number, string[]> = {}) {
  const asked: { costs: boolean }[] = [];
  const pulls: PullSource = {
    open: async (options) => (
      asked.push(options),
      structuredClone(SAVED.pulls)
    ),
    linking: async () => structuredClone(SAVED.donePulls),
    closes: async (n) => closes[n] ?? [],
  };
  return { pulls, asked };
}

function deps(
  mem = seeded(),
  env: Deps["env"] = {},
  pulls: PullSource = fakePulls().pulls,
) {
  const out: string[] = [];
  const written: Record<string, string> = {};
  const files: Record<string, string> = {};
  const targets: { repository: string; board: number | null }[] = [];
  const d: Deps = {
    open: async (_settings, target) => (
      targets.push(target),
      { tickets: mem.tickets, pulls }
    ),
    runner: () => ({ runPage: RUN_PAGE }),
    reach: async () => {
      throw new Error("unexpected reach");
    },
    env,
    now: () => NOW,
    out: into(out),
    err: (line) => console.error(plainOf(line)),
    readFile: (path) => files[path] ?? readFileSync(path, "utf8"),
    writeFile: (path, text) => (written[path] = text),
    settings: fakeSettings,
  };
  return { d, out, written, files, targets, mem };
}

describe("dry run on the recorded fixture", () => {
  it("sets each issue's fields from the shared derivation", async () => {
    const { d, out, targets } = deps();

    expect(await main(["--dry-run", "--fixture", FIXTURE], d)).toBe(0);
    expect(targets).toEqual([]);
    expect(out).toEqual([
      "#10 Status=In refinement, Session=359bd84e, Runs in=Local, Cost=(empty) (set Status, Session, Runs in)",
      "#11 Status=In refinement, Session=Waiting on you, Runs in=(empty), Cost=(empty) (set Session)",
      "#12 Status=Ready, Session=(empty), Runs in=(empty), Cost=(empty) (unchanged)",
      "#13 Status=In progress, Session=Waiting on you, Runs in=(empty), Cost=(empty) (set Status, Session)",
      "#14 Status=In progress, Session=cloud, starting, Runs in=(empty), Cost=(empty) (set Status, Session)",
      "#15 Status=In progress, Session=cloud cse_01Ab3x, Runs in=(empty), Cost=(empty) (set Session)",
      "#16 Status=In review, Session=359bd84e, Runs in=Local, Cost=(empty) (set Status)",
      "#18 Status=Backlog, Session=(empty), Runs in=(empty), Cost=(empty) (added to the board; set Status)",
      "#17 Status=Done, Session=cloud cse_01Zz9y, Runs in=(empty), Cost=(empty) (set Status, Session)",
    ]);
  });
});

describe("dry run on the live board", () => {
  it("prints each ticket as its ticket system writes it, and writes nothing", async () => {
    const { d, out, mem } = deps();

    expect(await main(["--dry-run"], d)).toBe(0);
    expect(out).toContain(
      "#16 Status=In review, Session=359bd84e, Runs in=Local, Cost=(empty) (set Status)",
    );
    expect(mem.writes).toEqual([]);
  });
});

describe("logLine", () => {
  it("names a card in a column no state names, as the ticket system writes it", () => {
    const [plan] = planSync(
      toSnapshot(SAVED.tickets, SAVED.pulls, NOW, SAVED.donePulls),
      BOARD(),
      RUN_PAGE,
    );
    expect(
      logLine({ ...plan, key: "PROJ-12", unmapped: "QA" }, (key) => key),
    ).toBe('PROJ-12 card is in "QA", which no state names (left alone)');
  });
});

describe("checkFields", () => {
  const fields = boardPages[0].data.owner.projectV2.fields
    .nodes as BoardField[];

  it("accepts the board as set up", () => {
    expect(checkFields(fields, DEFAULT_BOARD, "Status").status.id).toBe(
      "F_status",
    );
  });

  it("reads the columns from the field the ticket system names", () => {
    const renamed = fields.map((f) =>
      f.name === "Status" ? { ...f, name: "Estado" } : f,
    );
    expect(checkFields(renamed, DEFAULT_BOARD, "Estado").status.id).toBe(
      "F_status",
    );
  });

  it("requires Local and Actions under Runs in", () => {
    const without = (name: string) =>
      fields.map((f) =>
        f.name === "Runs in"
          ? { ...f, options: f.options!.filter((o) => o.name !== name) }
          : f,
      );

    expect(() =>
      checkFields(without("Actions"), DEFAULT_BOARD, "Status"),
    ).toThrow(
      "The board: the Runs in field lacks Actions: name another field in tickets.fields.runs-in, or set it to none.",
    );
    expect(() =>
      checkFields(without("Local"), DEFAULT_BOARD, "Status"),
    ).toThrow("the Runs in field lacks Local");
  });

  it("names every problem at once", () => {
    const broken = fields
      .filter((f) => f.name !== "Session")
      .map((f) =>
        f.name === "Status"
          ? { ...f, options: f.options!.filter((o) => o.name !== "Ready") }
          : f.name === "Runs in"
            ? { ...f, dataType: "TEXT" }
            : f.name === "Cost"
              ? { ...f, dataType: "TEXT" }
              : f,
      );

    expect(() => checkFields(broken, DEFAULT_BOARD, "Status")).toThrow(
      "The board: the Status field lacks Ready (tickets.columns.ready); the Runs in field is not a single select: name another field in tickets.fields.runs-in, or set it to none; the Cost field is not a Number: name another field in tickets.fields.cost, or set it to none.",
    );
  });
});

describe("closedPullComments", () => {
  const event = (merged: boolean, body = "Closes #16") => ({
    action: "closed",
    pull_request: { number: 40, merged, body },
  });
  /** The comments for `ev`, its closing links `closes` as the code host
   * gives them, and its body read for part of a ticket. */
  const closed = (
    ev: ReturnType<typeof event>,
    closes: number[],
    followUps: number[],
  ) =>
    closedPullComments(
      ev,
      {
        closes: closes.map(String),
        partOf: memoryTickets().tickets.linksIn(ev.pull_request.body).partOf,
      },
      followUps.map(String),
      DEFAULT_COLUMNS,
      (key) => `#${key}`,
      [...closes, ...followUps].map(String),
    );

  it("releases each issue a pull request closed without merging would have closed", () => {
    expect(closed(event(false), [16], [])).toEqual([
      {
        issue: "16",
        entry: expect.objectContaining({ tellsPerson: true }),
        body: expect.stringMatching(
          /^Pull request #40 was closed without merging\. The card stays In progress, waiting on you\.[\s\S]*work-status: released/,
        ),
      },
    ]);
  });

  it("posts nothing on an issue a merged pull request closed", () => {
    expect(closed(event(true), [16], [])).toEqual([]);
  });

  it("releases the follow-ups issue a merged pull request built part of", () => {
    const [comment] = closed(
      event(true, "Part of #201: its first line."),
      [],
      [201],
    );

    expect(comment.issue).toBe("201");
    expect(comment.body).toMatch(
      /^Pull request #40 merged part of these follow-ups\./,
    );
  });

  it("gives the follow-ups issue a pull request built part of the closed-without-merging text", () => {
    const [comment] = closed(event(false, "Part of #201."), [], [201]);

    expect(comment.body).toMatch(
      /^Pull request #40 was closed without merging/,
    );
  });

  it("leaves a follow-ups issue the pull request closes, and one it only mentions", () => {
    expect(
      closed(
        event(true, "Closes #201. A finding went on #198."),
        [201],
        [201, 198],
      ),
    ).toEqual([]);
  });

  it("leaves a follow-ups issue its last batch closes, though the body also says part of it", () => {
    expect(
      closed(
        event(true, "Part of #201, its last lines. Closes #201"),
        [201],
        [201],
      ),
    ).toEqual([]);
  });

  it("ignores any action but closed", () => {
    expect(closed({ ...event(false), action: "reopened" }, [16], [])).toEqual(
      [],
    );
  });
});

describe("nightlyComments", () => {
  it("clears claims and starts over 24 hours old", () => {
    const later = new Date("2026-11-10T09:30:00Z");
    const comments = nightlyComments(
      toSnapshot(SAVED.tickets, SAVED.pulls, NOW, SAVED.donePulls),
      later,
      DEFAULT_COLUMNS,
      (key) => `#${key}`,
      "follow-up",
    );

    expect(comments.map((c) => [c.issue, c.body.split(":")[0]])).toEqual([
      ["14", "Cleared the build started 2026-11-09 08"],
      ["15", "Cleared the claim from 2026-11-09 08"],
    ]);
  });
});

describe("collect", () => {
  it("with --dry-run, says which comment it would post, and posts none", async () => {
    const { pulls } = fakePulls({ 40: ["16"] });
    const { d, files, out, mem } = deps(seeded(), {}, pulls);
    files["event.json"] = JSON.stringify({
      action: "closed",
      pull_request: { number: 40, merged: false, body: "Closes #16" },
    });
    const before = mem.comments(16).length;

    await main(
      [
        "collect",
        "--out",
        "o.json",
        "--event",
        "event.json",
        "--event-name",
        "pull_request_target",
        "--dry-run",
      ],
      d,
    );
    expect(out).toEqual([
      "would comment on #16: Pull request #40 was closed without merging. The card stays In progress, waiting on you. Move it to Ready to rebuild it, or ask a session to refine it first.",
    ]);
    expect(mem.comments(16)).toHaveLength(before);
  });

  it("tells the follow-ups ticket a merged pull request built part of it", async () => {
    const mem = seeded();
    mem.state.get("18")!.labels.push("follow-up");
    const { d, files } = deps(mem, {}, fakePulls().pulls);
    files["event.json"] = JSON.stringify({
      action: "closed",
      pull_request: { number: 40, merged: true, body: "Part of #18: a line." },
    });

    expect(
      await main(
        [
          "collect",
          "--out",
          "o.json",
          "--event",
          "event.json",
          "--event-name",
          "pull_request_target",
        ],
        d,
      ),
    ).toBe(0);
    expect(mem.comments(18).map((c) => c.body)).toEqual([
      expect.stringMatching(
        /^Pull request #40 merged part of these follow-ups\./,
      ),
    ]);
  });

  it("finds the follow-ups ticket by the label name the settings give it", async () => {
    const mem = seeded();
    mem.state.get("18")!.labels.push("follow-ups");
    const { d, files } = deps(mem, {}, fakePulls().pulls);
    d.settings = async () => {
      const s = await fakeSettings();
      return {
        ...s,
        tickets: {
          ...s.tickets,
          labels: { ...s.tickets.labels, "follow-up": "follow-ups" },
        },
      };
    };
    files["event.json"] = JSON.stringify({
      action: "closed",
      pull_request: { number: 40, merged: true, body: "Part of #18: a line." },
    });

    await main(
      [
        "collect",
        "--out",
        "o.json",
        "--event",
        "event.json",
        "--event-name",
        "pull_request_target",
      ],
      d,
    );
    expect(mem.comments(18).map((c) => c.body)).toEqual([
      expect.stringMatching(
        /^Pull request #40 merged part of these follow-ups\./,
      ),
    ]);
  });

  it("releases the issues of a pull request closed without merging, then reads again", async () => {
    const { pulls } = fakePulls({ 40: ["16"] });
    const { d, files, written, mem } = deps(seeded(), {}, pulls);
    files["event.json"] = JSON.stringify({
      action: "closed",
      pull_request: { number: 40, merged: false, body: "Closes #16" },
    });
    const before = mem.comments(16).length;

    expect(
      await main(
        [
          "collect",
          "--out",
          "o.json",
          "--event",
          "event.json",
          "--event-name",
          "pull_request_target",
        ],
        d,
      ),
    ).toBe(0);
    const posted = mem.comments(16).slice(before);
    expect(posted.map((c) => c.body)).toEqual([
      expect.stringMatching(
        /^Pull request #40 was closed without merging[\s\S]*<!-- work-status: released -->/,
      ),
    ]);
    // What it saves was read after the comment went up.
    expect(written["o.json"]).toContain("was closed without merging");
  });

  it("clears stale claims only on the nightly run, then reads again", async () => {
    const { d, written, mem } = deps();
    d.now = () => new Date("2026-11-10T09:30:00Z");
    const count = () =>
      [...mem.state.values()].reduce((n, t) => n + t.comments.length, 0);
    const before = count();

    await main(
      ["collect", "--out", "o.json", "--event-name", "issue_comment"],
      d,
    );
    expect(count()).toBe(before);

    await main(["collect", "--out", "o.json", "--event-name", "schedule"], d);
    expect(count()).toBe(before + 2);
    expect(mem.comments(14).at(-1)!.body).toMatch(/^Cleared the build/);
    expect(mem.comments(15).at(-1)!.body).toMatch(/^Cleared the claim/);
    expect(written["o.json"]).toContain("Cleared the claim");
  });
});

describe("the repository read", () => {
  it("asks for the open pull requests' comments, for Cost, and no check state, which the workflow's token cannot read", async () => {
    const { pulls, asked } = fakePulls();
    const { d } = deps(seeded(), {}, pulls);

    await main(["collect", "--out", "o.json", "--event-name", "issues"], d);

    expect(asked).toEqual([{ costs: true }]);
  });

  it("saves the closed and merged pull requests that linked to a ticket", async () => {
    const done: PullRequest = {
      ...SAVED.pulls[0],
      number: 90,
      body: "Closes #12",
      comments: [],
    };
    const pulls: PullSource = {
      ...fakePulls().pulls,
      linking: async () => [done],
    };
    const { d, written } = deps(seeded(), {}, pulls);

    await main(["collect", "--out", "o.json", "--event-name", "issues"], d);

    expect(
      (JSON.parse(written["o.json"]) as Saved).donePulls.map((p) => p.number),
    ).toEqual([90]);
  });
});

describe("apply", () => {
  it("fails when FACTORY_BOARD_TOKEN is missing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { d } = deps();

    expect(await main(["apply", "--in", `${FIXTURE}/repo.json`], d)).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      "FACTORY_BOARD_TOKEN is not set.",
    );
  });

  it("reads the board's number from the settings", async () => {
    const { d, targets } = deps(seeded(), { GH_TOKEN: "t" });
    d.settings = async () => ({
      ...(await fakeSettings()),
      tickets: { ...(await fakeSettings()).tickets, board: 7 },
    });

    await main(["apply", "--in", `${FIXTURE}/repo.json`], d);
    expect(targets).toEqual([{ repository: "acme/widgets", board: 7 }]);
  });

  it("fails when the settings have no board", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { d } = deps(seeded(), { GH_TOKEN: "t" });
    d.settings = async () => ({
      ...(await fakeSettings()),
      tickets: { ...(await fakeSettings()).tickets, board: null },
    });

    expect(await main(["apply", "--in", `${FIXTURE}/repo.json`], d)).toBe(1);
    expect(console.error).toHaveBeenCalledWith("tickets.board is not set.");
  });

  it("fails when the board cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const mem = seeded({
      fail: { board: new Error("HTTP 401 Bad credentials") },
    });
    const { d } = deps(mem, { GH_TOKEN: "t" });

    expect(await main(["apply", "--in", `${FIXTURE}/repo.json`], d)).toBe(1);
    expect(console.error).toHaveBeenCalledWith("HTTP 401 Bad credentials");
  });

  it("fails when the ticket system has no board", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const mem = seeded({ groups: ["blockers", "label-history"] });
    const { d } = deps(mem, { GH_TOKEN: "t" });

    expect(await main(["apply", "--in", `${FIXTURE}/repo.json`], d)).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("does not support board"),
    );
  });

  it("adds a missing card and writes only the fields that changed", async () => {
    const { d, mem } = deps(seeded(), { GH_TOKEN: "t" });

    expect(await main(["apply", "--in", `${FIXTURE}/repo.json`], d)).toBe(0);

    const to = (itemId: string) =>
      mem.writes.filter((w) => w.itemId === itemId).flatMap((w) => w.writes);
    // #18 was not on the board: its card is added, then written.
    expect(mem.board.get("18")?.itemId).toBe("I_18");
    expect(to("I_18")).toEqual([{ field: "Status", optionName: "Backlog" }]);
    // #15 changes only Session; #12 changes nothing.
    expect(to("PVTI_15")).toEqual([
      { field: "Session", text: "cloud cse_01Ab3x" },
    ]);
    expect(to("PVTI_12")).toEqual([]);
    expect(to("PVTI_16")).toEqual([
      { field: "Status", optionName: "In review" },
    ]);
  });

  it("writes nothing with --dry-run", async () => {
    const { d, mem, out } = deps(seeded(), { GH_TOKEN: "t" });

    expect(
      await main(["apply", "--in", `${FIXTURE}/repo.json`, "--dry-run"], d),
    ).toBe(0);
    expect(mem.writes).toEqual([]);
    expect(out).toContainEqual(expect.stringContaining("#15 Status="));
  });
});

describe("Cost", () => {
  const board = BOARD();
  const marker = (n: string, author = "acme") => ({
    id: "1",
    createdAt: "2026-11-09T09:00:00Z",
    author,
    body: `<!-- cost: ${n} session=s -->\n<!-- agent -->`,
  });
  const snapshot = (): RepoSnapshot =>
    structuredClone(
      toSnapshot(SAVED.tickets, SAVED.pulls, NOW, SAVED.donePulls),
    );
  const costWrites = (s: RepoSnapshot, number: number) =>
    planSync(s, board, RUN_PAGE)
      .find((p) => p.key === String(number))!
      .writes.filter((w) => w.field === "Cost");

  it("counts a cost an agent account posted, whoever owns the repository", () => {
    const s = snapshot();
    s.issues
      .find((i) => i.key === "12")!
      .record.push(entryOf(marker("5.96", "acme-builds"))!);
    expect(costWrites(s, 12)).toEqual([{ field: "Cost", number: 0.18 }]);
  });

  it("sets the subscription share of the markers on the issue and on a merged or closed pull request that builds it", () => {
    const s = snapshot();
    s.issues.find((i) => i.key === "12")!.record.push(entryOf(marker("5.96"))!);
    s.donePulls = [
      {
        number: 90,
        createdAt: "2026-11-09T09:00:00Z",
        body: "Closes #12",
        closes: ["12"],
        partOf: [],
        isDraft: false,
        checks: null,
        openThreads: 0,
        author: "acme",
        comments: [
          {
            ...marker("0.92"),
            body: "<!-- cost: 0.92 -->",
            author: "github-actions[bot]",
          },
        ],
      },
    ];
    expect(costWrites(s, 12)).toEqual([{ field: "Cost", number: 0.21 }]);
  });

  it("adds the markers on an open pull request that builds the issue", () => {
    const s = snapshot();
    s.pulls.push({
      number: 91,
      createdAt: "2026-11-09T09:00:00Z",
      body: "Closes #12",
      closes: ["12"],
      partOf: [],
      isDraft: true,
      checks: null,
      openThreads: 0,
      author: "acme",
      comments: [marker("1.25")],
    });
    expect(costWrites(s, 12)).toEqual([{ field: "Cost", number: 0.04 }]);
  });

  it("leaves Cost empty on a card with no markers", () => {
    expect(costWrites(snapshot(), 12)).toEqual([]);
  });

  it("clears a Cost no marker supports", () => {
    const withCost = BOARD();
    withCost.items.get("12")!.cost = 4;
    const plan = planSync(snapshot(), withCost, RUN_PAGE).find(
      (p) => p.key === "12",
    )!;
    expect(plan.writes).toEqual([{ field: "Cost", clear: true }]);
  });

  it("writes nothing when the card already holds the sum", () => {
    const s = snapshot();
    s.issues.find((i) => i.key === "12")!.record.push(entryOf(marker("5.96"))!);
    const withCost = BOARD();
    withCost.items.get("12")!.cost = 0.18;
    expect(
      planSync(s, withCost, RUN_PAGE).find((p) => p.key === "12")!.writes,
    ).toEqual([]);
  });

  it("writes the number to the Cost field", async () => {
    const saved: Saved = structuredClone(SAVED);
    saved.tickets
      .find((t) => t.key === "12")!
      .record.push(
        entryOf({
          id: "999",
          createdAt: "2026-11-09T09:00:00Z",
          body: "<!-- cost: 250 session=s -->\n<!-- agent -->",
          author: "acme",
        })!,
      );
    const { d, files, mem } = deps(seeded(), { GH_TOKEN: "t" });
    files["in.json"] = JSON.stringify(saved);

    expect(await main(["apply", "--in", "in.json"], d)).toBe(0);
    expect(
      mem.writes.filter((w) => w.itemId === "PVTI_12").flatMap((w) => w.writes),
    ).toEqual([{ field: "Cost", number: 7.5 }]);
  });
});

describe("a build in GitHub Actions", () => {
  const actionsClaim = {
    id: "998",
    createdAt: "2026-11-09T09:00:00Z",
    body: "Building.\n\n<!-- work-status: claim actions 123456789 -->\n<!-- agent -->",
    author: "acme",
  };
  const withClaim = (): Saved => {
    const saved: Saved = structuredClone(SAVED);
    saved.tickets
      .find((t) => t.key === "12")!
      .record.push(entryOf(actionsClaim)!);
    return saved;
  };

  it("sets Runs in to Actions and Session to the run's link", () => {
    const saved = withClaim();
    const board = BOARD();
    const plan = planSync(
      toSnapshot(saved.tickets, saved.pulls, NOW, saved.donePulls),
      board,
      RUN_PAGE,
    ).find((p) => p.key === "12")!;

    expect(plan.column).toBe("In progress");
    expect(plan.writes).toEqual([
      {
        field: "Session",
        text: "https://github.com/acme/widgets/actions/runs/123456789",
      },
      { field: "Runs in", optionName: "Actions" },
    ]);
  });
});

describe("run.yml's board job", () => {
  const job = (
    loadYaml(
      readFileSync(
        new URL("../.github/workflows/run.yml", import.meta.url),
        "utf8",
      ),
    ) as {
      jobs: {
        board: { if: string; steps: { uses?: string; with?: object }[] };
      };
    }
  ).jobs.board;
  const condition = job.if.replace(/\s+/g, " ");
  const events = [
    ...new Set(
      [...condition.matchAll(/github\.event_name == '(\w+)'/g)].map(
        (m) => m[1],
      ),
    ),
  ];

  // A pull_request run uses the pull request's own copy of the sync with
  // FACTORY_BOARD_TOKEN, so an unreviewed edit to the sync could rewrite the board.
  it("runs the default branch's copy of the sync on pull request events", () => {
    expect(events).toContain("pull_request_target");
    expect(events).not.toContain("pull_request");
    const checkout = job.steps.find((s) =>
      s.uses?.startsWith("actions/checkout"),
    );
    expect(checkout).toBeDefined();
    expect(
      (checkout?.with as { ref?: string } | undefined)?.ref,
    ).toBeUndefined();
  });

  it("runs when the factory starts it, on pull request events, and nightly, never on a ticket's own events", () => {
    expect([...events].sort()).toEqual([
      "pull_request_target",
      "schedule",
      "workflow_dispatch",
    ]);
  });

  it("still skips Dependabot's pull requests, and forks'", () => {
    expect(condition).toContain(
      "github.event.pull_request.user.login != 'dependabot[bot]'",
    );
    expect(condition).toContain(
      "github.event.pull_request.head.repo.full_name == github.repository",
    );
  });
});

describe("tickets without the factory label", () => {
  const unlabel = (saved: Saved, key: string) => {
    const t = saved.tickets.find((x) => x.key === key)!;
    t.labels = t.labels.filter((l) => l !== "factory");
  };

  it("writes nothing to the card of a ticket without the label, and leaves it where it is", async () => {
    const saved: Saved = structuredClone(SAVED);
    unlabel(saved, "15");
    unlabel(saved, "18");
    const { d, files, mem, out } = deps(seeded(), { GH_TOKEN: "t" });
    files["in.json"] = JSON.stringify(saved);
    const before = structuredClone(mem.board.get("15"));

    expect(await main(["apply", "--in", "in.json"], d)).toBe(0);
    expect(mem.writes.filter((w) => w.itemId === "PVTI_15")).toEqual([]);
    expect(mem.board.get("15")).toEqual(before);
    // #18 was not on the board, and is not added.
    expect(mem.board.has("18")).toBe(false);
    expect(out.filter((l) => /#1[58]\b/.test(l))).toEqual([]);
  });

  it("reads only labeled tickets when it collects", async () => {
    const mem = seeded();
    for (const key of ["15", "18"]) {
      const t = mem.state.get(key)!;
      t.labels = t.labels.filter((l) => l !== "factory");
    }
    const { d, written } = deps(mem, { GH_TOKEN: "t" });

    expect(await main(["collect", "--out", "repo.json"], d)).toBe(0);
    const keys = (JSON.parse(written["repo.json"]) as Saved).tickets.map(
      (t) => t.key,
    );
    expect(keys).not.toContain("15");
    expect(keys).not.toContain("18");
    expect(keys).toContain("12");
  });

  it("posts no comment on a ticket without the label when a pull request that closes it is closed", () => {
    expect(
      closedPullComments(
        {
          action: "closed",
          pull_request: { number: 90, merged: false, body: "Closes #15" },
        },
        { closes: ["15"], partOf: [] },
        [],
        DEFAULT_COLUMNS,
        (k) => `#${k}`,
        [],
      ),
    ).toEqual([]);
  });
});

describe("a merged pull request", () => {
  const merged = (mem = seeded(), dryRun = false) => {
    const { pulls } = fakePulls({ 40: ["16"] });
    const r = deps(mem, {}, pulls);
    r.files["event.json"] = JSON.stringify({
      action: "closed",
      pull_request: { number: 40, merged: true, body: "Closes #16" },
    });
    const argv = [
      "collect",
      "--out",
      "o.json",
      "--event",
      "event.json",
      "--event-name",
      "pull_request_target",
      ...(dryRun ? ["--dry-run"] : []),
    ];
    return { ...r, run: () => main(argv, r.d) };
  };

  it("finishes the labeled ticket it closes, and saves it as done", async () => {
    const r = merged();

    expect(await r.run()).toBe(0);
    expect(r.mem.state.get("16")!.finishedAt).not.toBeNull();
    const saved = JSON.parse(r.written["o.json"]) as Saved;
    const plan = planSync(
      toSnapshot(saved.tickets, saved.pulls, NOW, saved.donePulls),
      BOARD(),
      RUN_PAGE,
    ).find((p) => p.key === "16")!;
    expect(plan.derived.status).toBe("Done");
    expect(plan.column).toBe("Done");
  });

  it("posts nothing on GitHub, which shows the merge itself", async () => {
    const r = merged();
    const before = r.mem.comments(16).length;

    await r.run();
    expect(r.mem.comments(16)).toHaveLength(before);
  });

  it("changes nothing with --dry-run, and says what it would do", async () => {
    const r = merged(seeded(), true);

    await r.run();
    expect(r.mem.state.get("16")!.finishedAt).toBeNull();
    expect(r.out).toContain("would finish #16: pull request #40 merged");
  });

  it("leaves a ticket without the label alone", async () => {
    const mem = seeded();
    const t = mem.state.get("16")!;
    t.labels = t.labels.filter((l) => l !== "factory");
    const r = merged(mem);

    await r.run();
    expect(r.mem.state.get("16")!.finishedAt).toBeNull();
  });
});

describe("a card in a done column", () => {
  it("is left in any column tickets.columns.done lists, whatever the ticket's state", () => {
    const board = BOARD();
    board.fields
      .find((f) => f.name === "Status")!
      .options!.push({ id: "O_Released", name: "Released" });
    board.items.get("12")!.status = "Released";
    const cfg = {
      ...DEFAULT_BOARD,
      columns: { ...DEFAULT_BOARD.columns, Done: ["Done", "Released"] },
    };
    const plan = planSync(
      toSnapshot(SAVED.tickets, SAVED.pulls, NOW, SAVED.donePulls),
      board,
      RUN_PAGE,
      cfg,
    ).find((p) => p.key === "12")!;

    expect(plan.derived.status).toBe("Done");
    expect(plan.column).toBeNull();
  });
});

describe("the sync's own notes", () => {
  it("records a nightly clear through the ticket system, with no hidden text in its comment", async () => {
    const mem = memoryTickets(
      [
        {
          key: "PROJ-1",
          labels: ["factory"],
          record: [
            {
              id: "e-1",
              at: "2026-11-07T09:00:00Z",
              author: "acme",
              text: "Building this in a local session, s.",
              markers: ["<!-- work-status: claim local s -->"],
            },
          ],
        },
      ],
      { strict: true },
    );
    const { d } = deps(mem);

    expect(
      await main(["collect", "--out", "o.json", "--event-name", "schedule"], d),
    ).toBe(0);
    const [comment] = mem.comments("PROJ-1");
    expect(comment.body).toMatch(
      /^Cleared the claim from 2026-11-07 09:00 UTC/,
    );
    expect(comment.body).not.toContain("<!--");
    expect(mem.state.get("PROJ-1")!.record.at(-1)!.markers).toEqual([
      "<!-- work-status: cleared -->",
    ]);
  });
});

describe("a ticket across repositories", () => {
  const PART = { body: "Part of #12", state: "closed", merged: true };
  const world = (
    places: Record<string, Place>,
    over: { comments?: Seed["comments"]; body?: string } = {},
  ) => {
    const mem = memoryTickets(
      [
        {
          key: "12",
          labels: ["factory"],
          body: over.body ?? `The ask.\n\n${SECTION}`,
          comments: over.comments ?? [confirming([API, WEB])],
        },
      ],
      { repository: "acme/api" },
    );
    const pulls: PullSource = {
      open: async () => [],
      linking: async () => [],
      closes: async () => [],
    };
    const r = deps(mem, {}, pulls);
    r.d.settings = async () => ({
      ...(await fakeSettings()),
      repository: "acme/api",
    });
    const net = network(places);
    r.d.reach = async (name) => net.reach(name);
    const collect = async (nightly = false) => {
      expect(
        await main(
          [
            "collect",
            "--out",
            "o.json",
            ...(nightly ? ["--event-name", "schedule"] : []),
          ],
          r.d,
        ),
      ).toBe(0);
      const saved = JSON.parse(r.written["o.json"]) as Saved;
      r.files["o.json"] = r.written["o.json"];
      return saved;
    };
    const apply = async () => {
      r.d.env = { GH_TOKEN: "t" };
      expect(await main(["apply", "--in", "o.json"], r.d)).toBe(0);
    };
    return { ...r, collect, apply };
  };
  const OPEN: Record<string, Place> = {
    "acme/api": { pulls: [{ number: 88, body: "Part of #12" }] },
    "acme/web": { pulls: [{ number: 41, body: "Part of acme/api#12" }] },
  };
  const claim = (createdAt: string) => ({
    id: "c1",
    author: "dev",
    createdAt,
    body: "Building.\n\n<!-- work-status: claim local s1 -->\n<!-- agent -->",
  });

  it("is in review on the board once every repository has a pull request", async () => {
    const w = world(OPEN);
    await w.collect();
    await w.apply();
    expect(w.mem.board.get("12")!.status).toBe("In review");
  });

  it("adds what each pull request cost, wherever it is", async () => {
    const cost = (number: number, dollars: string) => ({
      id: number,
      author: "dev",
      createdAt: "2026-11-09T12:30:00Z",
      body: `<!-- cost: ${dollars} session=a -->\n<!-- agent -->`,
    });
    const w = world({
      ...OPEN,
      "acme/web": {
        pulls: [
          {
            number: 41,
            body: "Part of acme/api#12",
            comments: [cost(1, "33.00")],
          },
        ],
      },
    });
    await w.collect();
    await w.apply();
    expect(w.mem.board.get("12")!.cost).toBeGreaterThan(0);
  });

  it("leaves the card alone, and its claim, when a repository cannot be read", async () => {
    const w = world(
      { ...OPEN, "acme/web": { fail: { recentPulls: new Error("HTTP 502") } } },
      { comments: [confirming([API, WEB]), claim("2026-11-01T10:00:00Z")] },
    );
    await w.collect(true);
    await w.apply();
    expect(w.out).toContain(
      "#12 repositories could not be read: HTTP 502 (left alone)",
    );
    expect(w.mem.board.has("12")).toBe(false);
    expect(w.mem.comments(12)).toHaveLength(2);
  });

  it("keeps an old claim at night while every repository has a pull request", async () => {
    const w = world(OPEN, {
      comments: [confirming([API, WEB]), claim("2026-11-01T10:00:00Z")],
    });
    await w.collect(true);
    expect(w.mem.comments(12)).toHaveLength(2);
  });

  it("clears an old claim at night while one has none", async () => {
    const w = world(
      { ...OPEN, "acme/web": {} },
      { comments: [confirming([API, WEB]), claim("2026-11-01T10:00:00Z")] },
    );
    await w.collect(true);
    expect(w.mem.comments(12).at(-1)!.body).toContain("Cleared the claim");
  });

  const MERGED: Record<string, Place> = {
    "acme/api": { pulls: [{ number: 88, ...PART }] },
    "acme/web": {
      pulls: [{ number: 41, ...PART, body: "Part of acme/api#12" }],
    },
  };

  it("is finished at night when every one merged and its run said nothing", async () => {
    const w = world(MERGED);
    await w.collect(true);
    expect(w.mem.state.get("12")!.finishedAt).not.toBeNull();
    expect(w.mem.comments(12).at(-1)!.body).toContain(
      "Every repository merged: acme/api#88, acme/web#41.",
    );
  });

  it("is not finished at night by a list nobody who may confirmed", async () => {
    const w = world(MERGED, { comments: [confirming([API, WEB], "mallory")] });
    await w.collect(true);
    expect(w.mem.state.get("12")!.finishedAt).toBeNull();
  });

  it("is not finished by a sync that is not the nightly one", async () => {
    const w = world(MERGED);
    await w.collect();
    expect(w.mem.state.get("12")!.finishedAt).toBeNull();
  });
});
