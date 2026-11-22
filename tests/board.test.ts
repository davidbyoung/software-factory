import { readFileSync } from "node:fs";
import { load as loadYaml } from "js-yaml";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkFields,
  closedPullComments,
  logLine,
  main,
  nightlyComments,
  planSync,
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
import { memoryTickets, type MemoryOptions } from "./memory-tickets";

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
    env,
    now: () => NOW,
    out: (line) => out.push(line),
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
    expect(checkFields(fields).status.id).toBe("F_status");
  });

  it("requires Local and Actions under Runs in", () => {
    const without = (name: string) =>
      fields.map((f) =>
        f.name === "Runs in"
          ? { ...f, options: f.options!.filter((o) => o.name !== name) }
          : f,
      );

    expect(() => checkFields(without("Actions"))).toThrow(
      "The board: the Runs in field lacks Actions: name another field in tickets.fields.runs-in, or set it to none.",
    );
    expect(() => checkFields(without("Local"))).toThrow(
      "the Runs in field lacks Local",
    );
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

    expect(() => checkFields(broken)).toThrow(
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
    );

  it("releases each issue a pull request closed without merging would have closed", () => {
    expect(closed(event(false), [16], [])).toEqual([
      {
        issue: "16",
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
      .comments.push(marker("5.96", "acme-builds"));
    expect(costWrites(s, 12)).toEqual([{ field: "Cost", number: 0.18 }]);
  });

  it("sets the subscription share of the markers on the issue and on a merged or closed pull request that builds it", () => {
    const s = snapshot();
    s.issues.find((i) => i.key === "12")!.comments.push(marker("5.96"));
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
    s.issues.find((i) => i.key === "12")!.comments.push(marker("5.96"));
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
      .comments.push({
        id: "999",
        createdAt: "2026-11-09T09:00:00Z",
        body: "<!-- cost: 250 session=s -->\n<!-- agent -->",
        author: "acme",
      });
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
    saved.tickets.find((t) => t.key === "12")!.comments.push(actionsClaim);
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

    expect(plan.writes).toEqual([
      { field: "Status", optionName: "In progress" },
      {
        field: "Session",
        text: "https://github.com/acme/widgets/actions/runs/123456789",
      },
      { field: "Runs in", optionName: "Actions" },
    ]);
  });
});

describe("workflows/factory-board-sync.yml", () => {
  const workflow = loadYaml(
    readFileSync(
      new URL("../workflows/factory-board-sync.yml", import.meta.url),
      "utf8",
    ),
  ) as {
    on: Record<string, unknown>;
    jobs: { sync: { if: string; steps: { uses?: string; with?: object }[] } };
  };

  // A pull_request run uses the pull request's own copy of the sync with
  // FACTORY_BOARD_TOKEN, so an unreviewed edit to the sync could rewrite the board.
  it("runs main's copy of the sync on pull request events", () => {
    expect(Object.keys(workflow.on)).toContain("pull_request_target");
    expect(Object.keys(workflow.on)).not.toContain("pull_request");
    const checkout = workflow.jobs.sync.steps.find((s) =>
      s.uses?.startsWith("actions/checkout"),
    );
    expect(checkout).toBeDefined();
    expect(
      (checkout?.with as { ref?: string } | undefined)?.ref,
    ).toBeUndefined();
  });

  it("still skips Dependabot's pull requests, and forks'", () => {
    const condition = workflow.jobs.sync.if.replace(/\s+/g, " ");
    expect(condition).toContain(
      "github.event_name != 'pull_request_target' ||",
    );
    expect(condition).toContain(
      "github.event.pull_request.user.login != 'dependabot[bot]'",
    );
    expect(condition).toContain(
      "github.event.pull_request.head.repo.full_name == github.repository",
    );
  });
});
