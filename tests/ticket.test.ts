import { afterEach, describe, expect, it, vi } from "vitest";
import {
  claimOutcome,
  main,
  withLine,
  type Clock,
  type Deps,
} from "../src/ticket.mts";
import type { PullRequest } from "../src/lib/work-status.mts";
import { sessionIdentity } from "../src/lib/gh.mts";
import { githubActionsRunner } from "../src/runner/github-actions.mts";
import { ghTransport } from "../src/tickets/transport.mts";
import { parseSettings } from "../src/config.mts";
import type { Group, Tickets } from "../src/tickets/types.mts";
import { fakeSettings } from "./fake-gh";
import { memoryRunner } from "./memory-runner";
import { memoryTickets, type Seed } from "./memory-tickets";

const AGENT = "<!-- agent -->";
const marked = (
  id: number,
  minute: number,
  marker: string,
  author = "acme",
) => ({
  id,
  createdAt: `2026-11-09T12:${String(minute).padStart(2, "0")}:00Z`,
  author,
  body: `Text.\n\n<!-- work-status: ${marker} -->\n${AGENT}`,
});

const SESSION = "359bd84e-aaaa-bbbb";
const NOW = new Date("2026-11-09T13:00:00Z");
/** GitHub Actions as the runner. It reads a run from the environment and
 * calls nothing to do it. */
const RUNNER = githubActionsRunner({
  transport: ghTransport(async () => {
    throw new Error("unexpected gh call");
  }),
  repository: "acme/widgets",
});

/** A ticket system holding `seed`, and the command's other dependencies. A
 * session in a GitHub Actions run when `actions` is set. */
function deps(
  seed: Seed[] = [{ number: 7 }],
  options: {
    actions?: boolean;
    stored?: number | null;
    groups?: Group[];
    pulls?: Partial<PullRequest>[];
  } = {},
) {
  const memory = memoryTickets(seed, { groups: options.groups });
  const out: string[] = [];
  const written: [number, number][] = [];
  const clocks = new Map<string, Clock>();
  const measured: (string | null)[] = [];
  const files = new Map<string, string>([
    ["c.md", "Nothing here needs your decision."],
  ]);
  const opened: Partial<Record<"repository" | "board", unknown>>[] = [];
  const d: Deps = {
    open: async (_settings, target) => {
      opened.push(target);
      return { tickets: memory.tickets };
    },
    openPulls: async () =>
      (options.pulls ?? []).map((p) => ({
        number: 1,
        createdAt: "2026-11-09T12:30:00Z",
        body: "",
        closes: [],
        isDraft: false,
        checks: null,
        openThreads: 0,
        author: "acme",
        ...p,
      })),
    runner: () => RUNNER,
    settings: fakeSettings,
    env: options.actions
      ? { GITHUB_ACTIONS: "true", GITHUB_RUN_ID: "555" }
      : { CLAUDE_CODE_SESSION_ID: SESSION },
    sleep: vi.fn(async () => {}),
    out: (line) => out.push(line),
    readFile: (path) => {
      const text = files.get(path);
      if (text === undefined) throw new Error(`ENOENT: ${path}`);
      return text;
    },
    claimStore: {
      read: () => options.stored ?? null,
      write: (issue, id) => written.push([issue, id]),
    },
    now: () => NOW,
    clock: {
      read: (session) => clocks.get(session) ?? null,
      write: (session, clock) => clocks.set(session, clock),
    },
    measure: (_session, since) => {
      measured.push(since);
      return {
        ok: true,
        spend: { dollars: 3.414, priced: 4, unpriced: new Map() },
      };
    },
  };
  return { d, out, written, clocks, measured, memory, files, opened };
}

/** Records the order of the adapter's calls among `log`. */
function logged(t: Tickets, log: string[]) {
  const comment = t.comment;
  const read = t.read;
  t.comment = async (...a) => (log.push("post"), comment(...a));
  t.read = async (...a) => (log.push("read"), read(...a));
}

let errors: string[] = [];
const quiet = () =>
  vi
    .spyOn(console, "error")
    .mockImplementation((line: unknown) => void errors.push(String(line)));
afterEach(() => {
  vi.restoreAllMocks();
  errors = [];
});

const last = (m: ReturnType<typeof memoryTickets>, n: number) =>
  m.comments(n).at(-1)?.body ?? "";

describe("claim", () => {
  it("waits between posting its claim and reading the comments back", async () => {
    const { d, memory } = deps();
    const log: string[] = [];
    logged(memory.tickets, log);
    d.sleep = vi.fn(async () => void log.push("sleep"));

    await main(["claim", "7"], d);

    expect(log).toEqual(["post", "sleep", "read"]);
  });

  it("claims when its own comment is the live one, and remembers it", async () => {
    const { d, out, written, memory } = deps([
      { number: 7 },
      { number: 3, state: "closed" },
    ]);
    memory.blockers.set(7, [3]);

    expect(await main(["claim", "7"], d)).toBe(0);
    expect(out).toEqual(["claimed"]);
    const mine = memory.comments(7).at(-1)!;
    expect(written).toEqual([[7, mine.id]]);
    expect(mine.body).toContain(
      "Building this in a local session, 359bd84e.\n\n<!-- work-status: claim local 359bd84e -->",
    );
    expect(d.sleep).toHaveBeenCalledWith(5000);
  });

  it("posts an Actions claim naming the run and who started it", async () => {
    const { d, out, memory } = deps();
    d.env = {
      ...d.env,
      GITHUB_ACTIONS: "true",
      GITHUB_RUN_ID: "123456789",
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: "acme/widgets",
      GITHUB_ACTOR: "alice",
    };

    expect(await main(["claim", "7"], d)).toBe(0);
    expect(out).toEqual(["claimed"]);
    expect(last(memory, 7)).toContain(
      "Building this in GitHub Actions, run [123456789](https://github.com/acme/widgets/actions/runs/123456789), started by @alice.\n\n<!-- work-status: claim actions 123456789 -->",
    );
  });

  it("is held by an Actions run whose claim is live", async () => {
    const { d, out } = deps([
      { number: 7, comments: [marked(49, 1, "claim actions 123456789")] },
    ]);

    await main(["claim", "7"], d);

    expect(out).toEqual(["held by 123456789"]);
  });

  it("deletes its claim and names the holder when another claim is live", async () => {
    const { d, out, written, memory } = deps([
      { number: 7, comments: [marked(49, 1, "claim local other9")] },
    ]);

    await main(["claim", "7"], d);

    expect(out).toEqual(["held by other9"]);
    expect(written).toEqual([]);
    expect(memory.comments(7).map((c) => c.id)).toEqual([49]);
  });

  it("stops an Actions run on an open blocker with the stopped comment, and claims nothing", async () => {
    const { d, out, memory } = deps([{ number: 7 }, { number: 3 }], {
      actions: true,
    });
    memory.blockers.set(7, [3]);

    await main(["claim", "7"], d);

    expect(out).toEqual(["blocked by: #3"]);
    expect(last(memory, 7)).toContain(
      "Stopped without a pull request: it waits on #3, which has to merge first. The card stays In progress, waiting on you. Run `factory build 7` to try again, or move it to Ready.",
    );
    expect(
      memory
        .comments(7)
        .map((c) => c.body)
        .join("\n"),
    ).not.toContain("work-status: claim");
  });

  it("posts nothing on an open blocker in a local session", async () => {
    const { d, out, memory } = deps([{ number: 7 }, { number: 3 }]);
    memory.blockers.set(7, [3]);

    await main(["claim", "7"], d);

    expect(out).toEqual(["blocked by: #3"]);
    expect(memory.comments(7)).toEqual([]);
  });

  it("claims on a ticket system with no blockers", async () => {
    const { d, out } = deps([{ number: 7 }], { groups: [] });

    expect(await main(["claim", "7"], d)).toBe(0);
    expect(out).toEqual(["claimed"]);
  });

  it("deletes its claim and exits 1 when the read-back fails", async () => {
    quiet();
    const { d, out, memory } = deps();
    memory.tickets.read = async () => {
      throw new Error("HTTP 502");
    };

    expect(await main(["claim", "7"], d)).toBe(1);
    expect(out).toEqual(["could not read"]);
    expect(memory.comments(7)).toEqual([]);
  });

  it("posts the stopped comment when an Actions claim cannot be read back", async () => {
    quiet();
    const { d, memory } = deps([{ number: 7 }], { actions: true });
    memory.tickets.read = async () => {
      throw new Error("HTTP 502");
    };

    expect(await main(["claim", "7"], d)).toBe(1);
    expect(last(memory, 7)).toContain(
      "Stopped without a pull request: I could not read the claim back. The card stays In progress, waiting on you. Run `factory build 7` to try again, or move it to Ready.",
    );
  });

  it("exits 1 rather than claiming when the blockers cannot be read", async () => {
    quiet();
    const { d, out, memory } = deps();
    memory.tickets.blockers!.list = async () => {
      throw new Error("HTTP 500");
    };

    expect(await main(["claim", "7"], d)).toBe(1);
    expect(out).toEqual(["could not read"]);
    expect(memory.comments(7)).toEqual([]);
  });
});

describe("end", () => {
  const actions = (seed: Seed[], pulls?: Partial<PullRequest>[]) => {
    const r = deps(seed, { stored: 50, pulls });
    r.d.env = { ...r.d.env, GITHUB_ACTIONS: "true", GITHUB_RUN_ID: "123" };
    return r;
  };
  const claimed: Seed[] = [
    { number: 7, comments: [marked(50, 1, "claim actions 123")] },
  ];

  it("releases the live claim when no pull request links the ticket", async () => {
    const { d, out, memory } = actions(claimed);

    expect(await main(["end", "7"], d)).toBe(0);
    expect(out).toEqual(["released"]);
    expect(last(memory, 7)).toContain("The run ended without a pull request.");
    expect(last(memory, 7)).toContain("<!-- work-status: released -->");
  });

  it("keeps the claim when a pull request closes the ticket", async () => {
    const { d, out, memory } = actions(claimed, [{ closes: [7] }]);

    expect(await main(["end", "7"], d)).toBe(0);
    expect(out).toEqual(["kept"]);
    expect(memory.comments(7)).toHaveLength(1);
  });

  it("keeps the claim for a Part of link to the follow-ups issue", async () => {
    const { d, out } = actions(
      [
        {
          number: 7,
          labels: ["follow-up"],
          comments: [marked(50, 1, "claim actions 123")],
        },
      ],
      [{ body: "Part of #7\n\nLines." }],
    );

    expect(await main(["end", "7"], d)).toBe(0);
    expect(out).toEqual(["kept"]);
  });

  it("posts nothing for another session's claim", async () => {
    const { d, out, memory } = actions([
      { number: 7, comments: [marked(60, 1, "claim actions 999")] },
    ]);

    expect(await main(["end", "7"], d)).toBe(0);
    expect(out).toEqual(["not live"]);
    expect(memory.comments(7)).toHaveLength(1);
  });

  it("posts nothing once the claim was released", async () => {
    const { d, out, memory } = actions([
      {
        number: 7,
        comments: [
          marked(50, 1, "claim actions 123"),
          marked(51, 2, "released"),
        ],
      },
    ]);

    expect(await main(["end", "7"], d)).toBe(0);
    expect(out).toEqual(["not live"]);
    expect(memory.comments(7)).toHaveLength(2);
  });
});

describe("stop", () => {
  it("posts the local stopped comment while its claim is live", async () => {
    const { d, out, memory } = deps(
      [{ number: 7, comments: [marked(50, 1, "claim local 359bd84e")] }],
      { stored: 50 },
    );

    expect(await main(["stop", "7", "the gate failed twice"], d)).toBe(0);
    expect(out).toEqual(["released"]);
    expect(last(memory, 7)).toContain(
      "Stopped without a pull request: the gate failed twice. The card stays In progress, waiting on you. Tell a session to work #7 again, or move it to Ready to build it in GitHub Actions.",
    );
  });

  it("releases an Actions run's claim, saying to move the card to Ready", async () => {
    const { d, out, memory } = deps(
      [{ number: 7, comments: [marked(50, 1, "claim actions 123456789")] }],
      { stored: 50 },
    );
    d.env = { ...d.env, GITHUB_ACTIONS: "true", GITHUB_RUN_ID: "123456789" };

    expect(await main(["stop", "7", "the gate failed twice"], d)).toBe(0);
    expect(out).toEqual(["released"]);
    expect(last(memory, 7)).toContain(
      "Stopped without a pull request: the gate failed twice. The card stays In progress, waiting on you. Run `factory build 7` to try again, or move it to Ready.\n\n",
    );
    expect(last(memory, 7)).toContain("<!-- work-status: released -->");
  });

  it("posts nothing once the claim is no longer live", async () => {
    const { d, out, memory } = deps(
      [
        {
          number: 7,
          comments: [
            marked(50, 1, "claim local 359bd84e"),
            marked(51, 2, "cleared", "github-actions[bot]"),
          ],
        },
      ],
      { stored: 50 },
    );

    expect(await main(["stop", "7", "x"], d)).toBe(3);
    expect(out).toEqual(["not live; posted nothing"]);
    expect(memory.comments(7)).toHaveLength(2);
  });
});

describe("still-live", () => {
  it("is not live with no claim recorded", async () => {
    const { d, out } = deps();

    expect(await main(["still-live", "7"], d)).toBe(3);
    expect(out).toEqual(["not live"]);
  });
});

describe("start-check", () => {
  it("is not a command: it prints the usage and exits nonzero", async () => {
    quiet();
    const { d } = deps([
      { number: 7, comments: [marked(1, 1, "started actions st_abc")] },
    ]);

    expect(await main(["start-check", "7", "st_abc"], d)).toBe(1);
    expect(errors.join("\n")).toMatch(/^Usage: .*claim\|still-live\|stop/);
  });
});

// A body `factory-refine` writes for a ticket without the `spec` label, and
// one for a ticket with it, whose tasks are grouped under level-two
// headings as OpenSpec's `tasks.md` has them.
const PLAIN_BODY = [
  "The owner's own words.",
  "",
  "## Decisions",
  "",
  "- Which page: the home page.",
  "",
  "## Acceptance criteria",
  "",
  "- When a guide opens, its title shows.",
].join("\n");
const SPEC_BODY = [
  "The owner's own words.",
  "",
  "## Decisions",
  "",
  "- Which page: the home page.",
  "",
  "## Spec",
  "",
  "### feedback-form (new)",
  "",
  "1. When the form opens, the first field has focus.",
  "",
  "## For the builder",
  "",
  "<details>",
  "",
  "### Design",
  "",
  "#### Where it goes",
  "",
  "### Tasks",
  "",
  "## 1. The form",
  "",
  "- [ ] 1.1 Focus the first field.",
  "",
  "</details>",
].join("\n");
/** `body` without the lines that match, to take one part out. */
const without = (body: string, ...patterns: RegExp[]) =>
  body
    .split("\n")
    .filter((line) => !patterns.some((p) => p.test(line)))
    .join("\n");

describe("refinement markers", () => {
  it("puts a closing comment's text before the refined sentence, on a sound ticket", async () => {
    const { d, out, memory } = deps([{ number: 7, body: PLAIN_BODY }]);

    expect(await main(["refined", "7", "--before-file", "c.md"], d)).toBe(0);

    expect(out).toEqual(["posted"]);
    expect(last(memory, 7)).toContain(
      `Nothing here needs your decision.\n\nThis session used $0.10 of the subscription ($3.41 at API list prices) on #7 since its last note.\n\n<!-- cost: 3.41 session=${SESSION} -->\n\nRefinement is done.`,
    );
  });

  it("posts the refined marker on a sound ticket", async () => {
    const { d, out, memory } = deps([{ number: 7, body: PLAIN_BODY }]);

    expect(await main(["refined", "7"], d)).toBe(0);

    expect(out).toEqual(["posted"]);
    expect(last(memory, 7)).toContain("<!-- work-status: refined -->");
  });
});

describe("the refined check", () => {
  /** `factory ticket refined 7`, with `args` after it, on a ticket with this
   * body and these labels. */
  async function refined(body: string, labels: string[], args = ["--check"]) {
    quiet();
    const { d, out, memory, clocks } = deps([{ number: 7, body, labels }]);
    const code = await main(["refined", "7", ...args], d);
    return { code, out, errors, posted: memory.comments(7), clocks };
  }

  it("prints `sound`, posts nothing, and exits 0 with --check on a sound ticket", async () => {
    const r = await refined(PLAIN_BODY, []);

    expect(r.code).toBe(0);
    expect(r.out).toEqual(["sound"]);
    expect(r.errors).toEqual([]);
    expect(r.posted).toEqual([]);
  });

  it("leaves the session's cost clock alone with --check", async () => {
    const r = await refined(PLAIN_BODY, []);

    expect(r.clocks.size).toBe(0);
  });

  describe("a ticket without the spec label", () => {
    it("is sound with Decisions, and Acceptance criteria with a list item under it", async () => {
      expect((await refined(PLAIN_BODY, ["bug"])).out).toEqual(["sound"]);
    });

    it.each([
      ["no Decisions heading", [/^## Decisions$/], ["missing: ## Decisions"]],
      [
        "no Acceptance criteria heading",
        [/^## Acceptance criteria$/],
        ["missing: ## Acceptance criteria"],
      ],
      [
        "no list item under Acceptance criteria",
        [/^- When a guide/],
        ["missing: a list item under ## Acceptance criteria"],
      ],
    ])("is not sound with %s", async (_, lines, missing) => {
      const r = await refined(without(PLAIN_BODY, ...lines), []);

      expect(r.code).toBe(1);
      expect(r.errors).toEqual(missing);
    });

    it("does not count a list item under a later heading as the criteria's", async () => {
      const body = `${without(PLAIN_BODY, /^- When a guide/)}\n\n## Mockups\n\n- One picture.`;

      expect((await refined(body, [])).errors).toEqual([
        "missing: a list item under ## Acceptance criteria",
      ]);
    });

    it("does not read a heading inside a code block as the body's own", async () => {
      const body = [
        "```markdown",
        "## Decisions",
        "## Acceptance criteria",
        "- A sample line.",
        "```",
      ].join("\n");

      expect((await refined(body, [])).errors).toEqual([
        "missing: ## Decisions",
        "missing: ## Acceptance criteria",
      ]);
    });

    it("is sound with a Spec section beside its criteria, as a small change that makes a spec line false has", async () => {
      const body = `${PLAIN_BODY}\n\n## Spec\n\n### labels (modified)\n\n1. When a label is renamed, the page shows its new name.`;

      expect((await refined(body, [])).out).toEqual(["sound"]);
    });
  });

  describe("a ticket with the spec label", () => {
    it("is sound with Decisions, a Spec with a capability and a numbered line, and For the builder with Design and Tasks", async () => {
      expect((await refined(SPEC_BODY, ["spec"])).out).toEqual(["sound"]);
    });

    it("takes a capability marked (modified)", async () => {
      const body = SPEC_BODY.replace("feedback-form (new)", "card (modified)");

      expect((await refined(body, ["spec"])).out).toEqual(["sound"]);
    });

    it.each([
      ["no Decisions heading", [/^## Decisions$/], ["missing: ## Decisions"]],
      ["no Spec heading", [/^## Spec$/], ["missing: ## Spec"]],
      [
        "no capability heading under Spec",
        [/^### feedback-form/],
        [
          "missing: a ### NAME (new) or ### NAME (modified) heading under ## Spec",
        ],
      ],
      [
        "no numbered line under Spec",
        [/^1\. When the form/],
        ["missing: a numbered line under ## Spec"],
      ],
      [
        "no For the builder heading",
        [/^## For the builder$/],
        ["missing: ## For the builder"],
      ],
      [
        "no Design under For the builder",
        [/^### Design$/],
        ["missing: ### Design under ## For the builder"],
      ],
      [
        "no Tasks under For the builder",
        [/^### Tasks$/],
        ["missing: ### Tasks under ## For the builder"],
      ],
    ])("is not sound with %s", async (_, lines, missing) => {
      const r = await refined(without(SPEC_BODY, ...lines), ["spec"]);

      expect(r.code).toBe(1);
      expect(r.errors).toEqual(missing);
    });

    it("is not sound with only what a ticket without the label needs", async () => {
      expect((await refined(PLAIN_BODY, ["spec"])).errors).toEqual([
        "missing: ## Spec",
        "missing: ## For the builder",
      ]);
    });

    it("does not take a capability heading with no mark", async () => {
      const body = SPEC_BODY.replace("feedback-form (new)", "feedback-form");

      expect((await refined(body, ["spec"])).errors).toEqual([
        "missing: a ### NAME (new) or ### NAME (modified) heading under ## Spec",
      ]);
    });
  });

  it("takes the follow-ups issue as sound whatever its body holds", async () => {
    const r = await refined("- [ ] docs/cli.md: a stale line.", ["follow-up"]);

    expect(r.code).toBe(0);
    expect(r.out).toEqual(["sound"]);
  });

  it("prints one line on standard error for each missing part, posts nothing, and exits 1 with --check", async () => {
    const r = await refined(
      without(SPEC_BODY, /^## Decisions$/, /^### Tasks$/),
      ["spec"],
    );

    expect(r.code).toBe(1);
    expect(r.errors).toEqual([
      "missing: ## Decisions",
      "missing: ### Tasks under ## For the builder",
    ]);
    expect(r.out).toEqual([]);
    expect(r.posted).toEqual([]);
  });

  it("posts no marker without --check on a ticket that is not sound, prints the same lines, and exits 1", async () => {
    const r = await refined(
      without(SPEC_BODY, /^## Decisions$/, /^### Tasks$/),
      ["spec"],
      ["--before-file", "c.md"],
    );

    expect(r.code).toBe(1);
    expect(r.errors).toEqual([
      "missing: ## Decisions",
      "missing: ### Tasks under ## For the builder",
    ]);
    expect(r.out).toEqual([]);
    expect(r.posted).toEqual([]);
    expect(r.clocks.size).toBe(0);
  });

  it("posts the marker on the follow-ups issue, whatever its body holds", async () => {
    const r = await refined("", ["follow-up"], []);

    expect(r.code).toBe(0);
    expect(r.out).toEqual(["posted"]);
    expect(r.posted.at(-1)?.body).toContain("<!-- work-status: refined -->");
  });
});

describe("ready", () => {
  // GitHub's answer to a project mutation from a token with read:project
  // but not project. Its last sentence is GitHub's real one, from a
  // read-only query for a scope the token lacked on 2026-11-12.
  const SCOPES = new Error(
    "gh api graphql -f query=mutation SetOption: gh: Your token has not been granted the required scopes to execute this query. The 'updateProjectV2ItemFieldValue' field requires one of the following scopes: ['project'], but your token has only been granted the: ['gist', 'read:org', 'read:project', 'repo'] scopes. Please modify your token's scopes at: https://github.com/settings/tokens.",
  );
  const onBoard = (over: { state?: "open" | "closed" } = {}) => {
    const r = deps([
      { number: 10, state: over.state ?? "open" },
      { number: 12 },
      { number: 99 },
    ]);
    r.memory.card(10, { status: "Backlog" });
    r.memory.card(12, { status: "Ready" });
    return r;
  };

  it("sets the card's Status to Ready and prints ready", async () => {
    const { d, out, memory } = onBoard();

    expect(await main(["ready", "10"], d)).toBe(0);
    expect(out).toEqual(["ready"]);
    expect(memory.writes).toEqual([
      { itemId: "I_10", writes: [{ field: "Status", optionName: "Ready" }] },
    ]);
    expect(memory.board.get(10)?.status).toBe("Ready");
  });

  it("changes nothing on a card already in Ready", async () => {
    const { d, out, memory } = onBoard();

    expect(await main(["ready", "12"], d)).toBe(0);
    expect(out).toEqual(["ready"]);
    expect(memory.writes).toEqual([]);
  });

  it("names gh auth refresh -s project when the token cannot write the board", async () => {
    quiet();
    const { d, out, memory } = onBoard();
    memory.tickets.board!.set = async () => {
      throw SCOPES;
    };

    expect(await main(["ready", "10"], d)).toBe(1);
    expect(out).toEqual(["failed"]);
    expect(errors.join("\n")).toMatch(/gh auth refresh -s project$/);
  });

  it("refuses a closed issue", async () => {
    quiet();
    const { d, memory } = onBoard({ state: "closed" });

    expect(await main(["ready", "10"], d)).toBe(1);
    expect(errors.join("\n")).toMatch(/#10 is closed/);
    expect(memory.writes).toEqual([]);
  });

  it("refuses an issue that is not on the board", async () => {
    quiet();
    const { d } = onBoard();

    expect(await main(["ready", "99"], d)).toBe(1);
    expect(errors.join("\n")).toMatch(/#99 is not on the board/);
  });

  it("names the board group on a ticket system without one", async () => {
    quiet();
    const r = deps([{ number: 10 }], { groups: [] });

    expect(await main(["ready", "10"], r.d)).toBe(1);
    expect(errors.join("\n")).toMatch(/does not support board/);
  });
});

describe("follow-up", () => {
  const LINE = "The usage text names a flag that was removed.";

  it("appends the line, led by its file, to the open follow-ups issue", async () => {
    const { d, out, memory } = deps([
      {
        number: 201,
        title: "Follow-ups",
        labels: ["follow-up"],
        body: "- [ ] a\n",
      },
    ]);

    await main(["follow-up", "src/pr.mts", LINE], d);

    expect(out).toEqual(["added to #201"]);
    expect(memory.state.get(201)?.body).toBe(
      `- [ ] a\n- [ ] src/pr.mts: ${LINE}\n`,
    );
  });

  it("opens the follow-ups issue when none is open", async () => {
    const { d, out, memory } = deps([
      { number: 209, labels: ["follow-up"], state: "closed" },
    ]);

    await main(["follow-up", "src/pr.mts", LINE], d);

    expect(out).toEqual(["opened #210"]);
    const opened = memory.state.get(210)!;
    expect(opened.title).toBe("Follow-ups");
    expect(opened.labels).toEqual(["follow-up"]);
    expect(opened.body).toContain('"Follow-ups" in `.claude/factory/rules.md`');
    expect(opened.body).toContain(`- [ ] src/pr.mts: ${LINE}`);
  });

  it("adds to the lowest-numbered issue when more than one is open", async () => {
    const { d, out, memory } = deps([
      { number: 230, labels: ["follow-up"] },
      { number: 201, labels: ["follow-up"] },
    ]);

    await main(["follow-up", "src/pr.mts", LINE], d);

    expect(out).toEqual(["added to #201"]);
    expect(memory.state.get(201)?.body).toContain(LINE);
    expect(memory.state.get(230)?.body).toBe("");
  });

  it("posts nothing when the file is missing", async () => {
    quiet();
    const { d, memory } = deps([]);

    expect(await main(["follow-up", "", LINE], d)).toBe(1);
    expect(memory.state.size).toBe(0);
  });

  it("posts nothing when the text is missing", async () => {
    quiet();
    const { d, memory } = deps([]);

    expect(await main(["follow-up", "src/pr.mts"], d)).toBe(1);
    expect(memory.state.size).toBe(0);
  });

  it("no longer takes the old command, and its usage names the new one", async () => {
    quiet();
    const { d, memory } = deps([]);

    expect(await main(["finding", "tooling", "- [ ] b"], d)).toBe(1);
    expect(memory.state.size).toBe(0);
    expect(errors.join("\n")).toMatch(/\|follow-up\b/);
    expect(errors.join("\n")).not.toMatch(/\bfinding\b/);
  });
});

describe("claimOutcome", () => {
  it("names unknown when nothing is live", () => {
    expect(claimOutcome([], 5)).toBe("held by unknown");
  });
});

describe("withLine", () => {
  it("adds the line under the last one", () => {
    expect(withLine("Intro.\n\n- [ ] a\n\n", " - [ ] b ")).toBe(
      "Intro.\n\n- [ ] a\n- [ ] b\n",
    );
  });
});

describe("sessionIdentity", () => {
  const outside = memoryRunner().runner;

  it("takes a local session's first eight characters", () => {
    expect(
      sessionIdentity({ CLAUDE_CODE_SESSION_ID: "359bd84e-1234" }, outside),
    ).toEqual({ where: "local", id: "359bd84e" });
  });

  it("takes the desktop app's ID for a local session run in the app", () => {
    expect(
      sessionIdentity(
        {
          CLAUDE_CODE_SESSION_ID: "359bd84e-1234",
          CLAUDE_CODE_HOST_SESSION_ID:
            "local_38f582e5-2fdb-4e52-b976-ea355a7fa2db",
        },
        outside,
      ),
    ).toEqual({
      where: "local",
      id: "local_38f582e5-2fdb-4e52-b976-ea355a7fa2db",
    });
  });

  it("goes by the runner's run, with its page and who started it, over a local session's ID", () => {
    const inRun = memoryRunner({
      thisRun: {
        id: "123456789",
        page: "https://runner.example/runs/123456789",
        startedBy: "alice",
      },
    }).runner;

    expect(
      sessionIdentity({ CLAUDE_CODE_SESSION_ID: "359bd84e-1234" }, inRun),
    ).toEqual({
      where: "actions",
      id: "123456789",
      link: "https://runner.example/runs/123456789",
      actor: "alice",
    });
  });

  it("leaves out the link and the actor of a run that gives neither", () => {
    const inRun = memoryRunner({ thisRun: { id: "unknown" } }).runner;

    expect(sessionIdentity({}, inRun)).toStrictEqual({
      where: "actions",
      id: "unknown",
    });
  });

  it("writes unknown when the environment does not say", () => {
    expect(sessionIdentity({}, outside)).toEqual({
      where: "local",
      id: "unknown",
    });
  });
});

describe("the cost clock", () => {
  it("starts on a claim that holds, on the claimed issue", async () => {
    const { d, clocks, memory } = deps();

    expect(await main(["claim", "7"], d)).toBe(0);
    expect(clocks.get(SESSION)).toEqual({
      issue: 7,
      start: NOW.toISOString(),
    });
    expect(last(memory, 7)).not.toContain("cost");
  });

  it("does not start on a claim another session holds", async () => {
    const { d, clocks, out } = deps([
      { number: 7, comments: [marked(50, 1, "claim local other")] },
    ]);

    expect(await main(["claim", "7"], d)).toBe(0);
    expect(out).toEqual(["held by other"]);
    expect(clocks.size).toBe(0);
  });

  it("starts on refining, which posts no cost", async () => {
    const { d, clocks, measured, memory } = deps([{ number: 9 }]);

    await main(["refining", "9"], d);
    expect(clocks.get(SESSION)).toEqual({
      issue: 9,
      start: NOW.toISOString(),
    });
    expect(measured).toEqual([]);
    expect(last(memory, 9)).not.toContain("cost");
  });

  it("notes the spend since the clock started on waiting, then restarts it", async () => {
    const { d, clocks, measured, memory } = deps([{ number: 9 }]);
    clocks.set(SESSION, { issue: 9, start: "2026-11-09T12:00:00Z" });

    await main(["waiting", "9"], d);

    expect(measured).toEqual(["2026-11-09T12:00:00Z"]);
    expect(last(memory, 9)).toContain(
      `This session used $0.10 of the subscription ($3.41 at API list prices) on #9 since its last note.\n\n<!-- cost: 3.41 session=${SESSION} -->`,
    );
    expect(clocks.get(SESSION)).toEqual({
      issue: 9,
      start: NOW.toISOString(),
    });
  });

  it("puts the cost note in the stopped comment", async () => {
    const { d, memory } = deps(
      [{ number: 7, comments: [marked(50, 1, "claim local 359bd84e")] }],
      { stored: 50 },
    );

    await main(["stop", "7", "x"], d);
    expect(last(memory, 7)).toMatch(
      /This session used \$0\.10[^\n]*\n\n<!-- cost: 3\.41 session=\S+ -->\n\n<!-- work-status: released -->/,
    );
  });

  it("counts from the session's start when it has no clock", async () => {
    const { d, measured, clocks } = deps([{ number: 230 }]);

    expect(await main(["cost", "230"], d)).toBe(0);
    expect(measured).toEqual([null]);
    // The clock it starts names no issue, so reviewer runs are not filed on
    // the pull request.
    expect(clocks.get(SESSION)).toEqual({
      issue: null,
      start: NOW.toISOString(),
    });
  });

  it("posts the cost note to issue or pull request N with the agent mark", async () => {
    const { d, out, memory } = deps([{ number: 230 }]);

    expect(await main(["cost", "230"], d)).toBe(0);
    expect(out).toEqual(["posted"]);
    expect(last(memory, 230)).toBe(
      `This session used $0.10 of the subscription ($3.41 at API list prices) on #230 since its last note.\n\n<!-- cost: 3.41 session=${SESSION} -->\n<!-- agent -->`,
    );
  });

  it("keeps the clock on its issue when the note goes to a pull request", async () => {
    const { d, clocks } = deps([{ number: 230 }]);
    clocks.set(SESSION, { issue: 7, start: "2026-11-09T12:00:00Z" });

    await main(["cost", "230"], d);
    expect(clocks.get(SESSION)).toEqual({
      issue: 7,
      start: NOW.toISOString(),
    });
  });

  it("says why when the session cannot read its usage, posts no cost, and exits 0", async () => {
    const { d, memory } = deps([{ number: 230 }]);
    d.measure = () => ({ ok: false, reason: "no transcript for x" });

    expect(await main(["cost", "230"], d)).toBe(0);
    expect(last(memory, 230)).toBe(
      "This session's cost could not be measured: no transcript for x.\n<!-- agent -->",
    );
  });

  it("says why when the transcript read throws", async () => {
    const { d, memory } = deps([{ number: 230 }]);
    d.measure = () => {
      throw new Error("EACCES");
    };

    expect(await main(["cost", "230"], d)).toBe(0);
    expect(last(memory, 230)).toContain(
      "could not be measured: its transcript could not be read (EACCES).",
    );
  });

  it("says why without a session ID", async () => {
    const { d, memory } = deps([{ number: 230 }]);
    d.env = {};

    expect(await main(["cost", "230"], d)).toBe(0);
    expect(last(memory, 230)).toContain(
      "could not be measured: CLAUDE_CODE_SESSION_ID is not set.",
    );
  });

  it("leaves the clock alone when a stop posts nothing", async () => {
    const { d, clocks } = deps([{ number: 7 }], { stored: 50 });
    const clock = { issue: 7, start: "2026-11-09T12:00:00Z" };
    clocks.set(SESSION, clock);

    await main(["stop", "7", "x"], d);
    expect(clocks.get(SESSION)).toEqual(clock);
  });
});

// The commands the skills read and write tickets with: one test per row of
// the issue's command table, against the in-memory adapter.
describe("the ticket commands", () => {
  const SEVEN: Seed = {
    number: 7,
    title: "Send every ticket read through one interface",
    labels: ["enhancement", "spec"],
    body: "## Acceptance criteria\n\n1. It works.\n",
    comments: [
      {
        id: 41,
        author: "acme",
        createdAt: "2026-11-09T12:01:00Z",
        body: "Refinement is done.",
      },
    ],
  };

  it("view prints the ticket for a reader: title, state, labels, body, and each comment with its ID and author", async () => {
    const { d, out } = deps([SEVEN]);

    expect(await main(["view", "7"], d)).toBe(0);
    expect(out.join("\n")).toBe(
      [
        "#7 Send every ticket read through one interface",
        "state: open",
        "labels: enhancement, spec",
        "",
        "## Acceptance criteria\n\n1. It works.",
        "",
        "--- comment 41 by acme at 2026-11-09T12:01:00Z",
        "Refinement is done.",
      ].join("\n"),
    );
  });

  it.each([
    ["title", ["Send every ticket read through one interface"]],
    ["state", ["open"]],
    ["labels", ["enhancement", "spec"]],
    ["body", ["## Acceptance criteria\n\n1. It works.\n"]],
  ])(
    "view --field %s prints that field and nothing else",
    async (field, want) => {
      const { d, out } = deps([SEVEN]);

      expect(await main(["view", "7", "--field", field], d)).toBe(0);
      expect(out).toEqual(want);
    },
  );

  it("view --field refuses a field it does not have", async () => {
    quiet();
    const { d, out } = deps([SEVEN]);

    expect(await main(["view", "7", "--field", "author"], d)).toBe(1);
    expect(out).toEqual([]);
  });

  it("view --json prints what the adapter returned, as one JSON value", async () => {
    const { d, out, memory } = deps([SEVEN]);

    expect(await main(["view", "7", "--json"], d)).toBe(0);
    expect(JSON.parse(out.join("\n"))).toEqual(await memory.tickets.read(7));
  });

  it("list prints each open ticket's number, title, and labels", async () => {
    const { d, out } = deps([
      SEVEN,
      { number: 3, title: "Follow-ups", labels: ["follow-up"] },
      { number: 5, state: "closed" },
    ]);

    expect(await main(["list"], d)).toBe(0);
    expect(out).toEqual([
      "3\tFollow-ups\tfollow-up",
      "7\tSend every ticket read through one interface\tenhancement, spec",
    ]);
  });

  it("list --label keeps the tickets with that label", async () => {
    const { d, out } = deps([
      SEVEN,
      { number: 3, title: "Follow-ups", labels: ["follow-up"] },
    ]);

    await main(["list", "--label", "follow-up"], d);
    expect(out).toEqual(["3\tFollow-ups\tfollow-up"]);
  });

  it("list --title keeps the tickets whose title is exactly that", async () => {
    const { d, out } = deps([
      SEVEN,
      { number: 3, title: "Follow-ups" },
      { number: 4, title: "Follow-ups, the second" },
    ]);

    await main(["list", "--title", "Follow-ups"], d);
    expect(out).toEqual(["3\tFollow-ups\t"]);
  });

  it("list returns every open ticket when there are more than 100", async () => {
    const seed = Array.from({ length: 150 }, (_, i) => ({ number: i + 1 }));
    const { d, out } = deps(seed);

    await main(["list"], d);
    expect(out).toHaveLength(150);
  });

  it("list --json prints what the adapter returned, as one JSON value", async () => {
    const { d, out, memory } = deps([SEVEN]);

    await main(["list", "--json"], d);
    expect(JSON.parse(out.join("\n"))).toEqual(await memory.tickets.listOpen());
  });

  it("edit replaces the body from the file", async () => {
    const { d, out, memory, files } = deps([SEVEN]);
    files.set("body.md", "## Spec\n\nNew.\n");

    expect(await main(["edit", "7", "--body-file", "body.md"], d)).toBe(0);
    expect(out).toEqual(["edited"]);
    expect(memory.state.get(7)?.body).toBe("## Spec\n\nNew.\n");
  });

  it("edit --title retitles the ticket and leaves its body", async () => {
    const { d, out, memory } = deps([SEVEN]);
    const body = memory.state.get(7)?.body;

    expect(await main(["edit", "7", "--title", "A new title"], d)).toBe(0);
    expect(out).toEqual(["edited"]);
    expect(memory.state.get(7)?.title).toBe("A new title");
    expect(memory.state.get(7)?.body).toBe(body);
  });

  it("edit --title with --body-file changes both", async () => {
    const { d, memory, files } = deps([SEVEN]);
    files.set("body.md", "New.\n");

    await main(["edit", "7", "--title", "T", "--body-file", "body.md"], d);
    expect(memory.state.get(7)?.title).toBe("T");
    expect(memory.state.get(7)?.body).toBe("New.\n");
  });

  it("edit with neither --title nor --body-file is a usage error", async () => {
    quiet();
    const { d, out } = deps([SEVEN]);

    expect(await main(["edit", "7"], d)).toBe(1);
    expect(out).toEqual([]);
    expect(errors.join("\n")).toMatch(/Usage/);
  });

  it("edit --attach adds the images", async () => {
    const { d, memory, files } = deps([SEVEN]);
    files.set("body.md", "With a mockup.");

    await main(["edit", "7", "--body-file", "body.md", "--attach", "a.png"], d);
    expect(memory.attached).toEqual([{ ticket: 7, files: ["a.png"] }]);
    expect(memory.state.get(7)?.body).toBe("With a mockup.");
  });

  it("comment posts the file and prints the comment's ID, its hidden markers unchanged", async () => {
    const { d, out, memory, files } = deps([SEVEN]);
    files.set(
      "c.md",
      "Round one.\n\n<!-- work-status: waiting -->\n<!-- agent -->",
    );

    expect(await main(["comment", "7", "--body-file", "c.md"], d)).toBe(0);
    const made = memory.comments(7).at(-1)!;
    expect(out).toEqual([String(made.id)]);
    expect(made.body).toBe(
      "Round one.\n\n<!-- work-status: waiting -->\n<!-- agent -->",
    );
  });

  it("comment --attach attaches each image", async () => {
    const { d, out, memory } = deps([SEVEN]);

    await main(
      [
        "comment",
        "7",
        "--body-file",
        "c.md",
        "--attach",
        "a.png",
        "--attach",
        "b.png",
      ],
      d,
    );
    expect(memory.attached).toEqual([{ ticket: 7, files: ["a.png", "b.png"] }]);
    expect(out).toEqual([String(memory.comments(7).at(-1)!.id)]);
  });

  it("open opens a ticket with its labels and prints its number", async () => {
    const { d, out, memory, files } = deps([SEVEN]);
    files.set("o.md", "A conflict needs you.");

    expect(
      await main(
        [
          "open",
          "--title",
          "Conflict on #12",
          "--body-file",
          "o.md",
          "--label",
          "conflict",
          "--label",
          "factory",
        ],
        d,
      ),
    ).toBe(0);
    expect(out).toEqual(["8"]);
    expect(memory.state.get(8)).toMatchObject({
      title: "Conflict on #12",
      body: "A conflict needs you.",
      labels: ["conflict", "factory"],
    });
  });

  it("label --add adds the label", async () => {
    const { d, out, memory } = deps([SEVEN]);

    expect(await main(["label", "7", "--add", "ready"], d)).toBe(0);
    expect(out).toEqual(["added"]);
    expect(memory.state.get(7)?.labels).toContain("ready");
  });

  it("label --remove takes the label off", async () => {
    const { d, out, memory } = deps([SEVEN]);

    expect(await main(["label", "7", "--remove", "spec"], d)).toBe(0);
    expect(out).toEqual(["removed"]);
    expect(memory.state.get(7)?.labels).toEqual(["enhancement"]);
  });

  it("label --was-removed prints yes for a label once taken off, and no otherwise", async () => {
    const { d, out, memory } = deps([SEVEN]);
    memory.removedLabels.set(7, ["spec"]);

    await main(["label", "7", "--was-removed", "spec"], d);
    await main(["label", "7", "--was-removed", "enhancement"], d);
    expect(out).toEqual(["yes", "no"]);
  });

  it("label takes exactly one of --add, --remove, and --was-removed", async () => {
    quiet();
    const { d, memory } = deps([SEVEN]);

    expect(await main(["label", "7", "--add", "a", "--remove", "b"], d)).toBe(
      1,
    );
    expect(memory.state.get(7)?.labels).toEqual(["enhancement", "spec"]);
  });

  it("link prints what makes a merged pull request close the ticket", async () => {
    const { d, out } = deps([SEVEN]);

    expect(await main(["link", "7"], d)).toBe(0);
    expect(out).toEqual(["Closes #7"]);
  });

  it("blockers prints one line per ticket it waits on, with whether it is open", async () => {
    const { d, out, memory } = deps([
      SEVEN,
      { number: 3 },
      { number: 4, state: "closed" },
    ]);
    memory.blockers.set(7, [3, 4]);

    expect(await main(["blockers", "7"], d)).toBe(0);
    expect(out).toEqual(["#3 open", "#4 closed"]);
  });

  it("block records that the ticket waits on another", async () => {
    const { d, out, memory } = deps([SEVEN, { number: 3 }]);

    expect(await main(["block", "7", "--by", "3"], d)).toBe(0);
    expect(out).toEqual(["blocked"]);
    expect(memory.blockers.get(7)).toEqual([3]);
  });

  it("unblock removes that record", async () => {
    const { d, out, memory } = deps([SEVEN, { number: 3 }]);
    memory.blockers.set(7, [3]);

    expect(await main(["unblock", "7", "--by", "3"], d)).toBe(0);
    expect(out).toEqual(["unblocked"]);
    expect(memory.blockers.get(7)).toEqual([]);
  });

  it.each(["board", "blockers", "label-history", "attachments"])(
    "supports %s prints yes when the adapter has it",
    async (group) => {
      const { d, out } = deps([SEVEN]);

      expect(await main(["supports", group], d)).toBe(0);
      expect(out).toEqual(["yes"]);
    },
  );

  it.each(["board", "blockers", "label-history", "attachments"])(
    "supports %s prints no, and exits 0, when the adapter lacks it",
    async (group) => {
      const { d, out } = deps([SEVEN], { groups: [] });

      expect(await main(["supports", group], d)).toBe(0);
      expect(out).toEqual(["no"]);
    },
  );

  it("supports exits non-zero for a group that does not exist", async () => {
    quiet();
    const { d, out } = deps([SEVEN]);

    expect(await main(["supports", "wiki"], d)).toBe(1);
    expect(out).toEqual([]);
    expect(errors.join("\n")).toContain(
      "board, blockers, label-history, attachments",
    );
  });
});

describe("a ticket command whose adapter lacks the group it needs", () => {
  const cases: [string, string[], string][] = [
    [
      "comment --attach",
      ["comment", "7", "--body-file", "c.md", "--attach", "a.png"],
      "attachments",
    ],
    [
      "edit --attach",
      ["edit", "7", "--body-file", "c.md", "--attach", "a.png"],
      "attachments",
    ],
    [
      "label --was-removed",
      ["label", "7", "--was-removed", "spec"],
      "label-history",
    ],
    ["blockers", ["blockers", "7"], "blockers"],
    ["block", ["block", "7", "--by", "3"], "blockers"],
    ["unblock", ["unblock", "7", "--by", "3"], "blockers"],
  ];

  it.each(cases)(
    "%s exits non-zero, names the group, and posts nothing",
    async (_name, argv, group) => {
      quiet();
      const { d, out, memory } = deps(
        [{ number: 7, body: "Before." }, { number: 3 }],
        { groups: [] },
      );

      expect(await main(argv, d)).toBe(1);
      expect(out).toEqual([]);
      expect(errors.join("\n")).toContain(`does not support ${group}`);
      // Nothing reached the ticket, its blockers, or its labels.
      expect(memory.comments(7)).toEqual([]);
      expect(memory.state.get(7)?.body).toBe("Before.");
      expect(memory.blockers.get(7)).toBeUndefined();
      expect(memory.state.get(7)?.labels).toEqual([]);
    },
  );
});

describe("a ticket command whose adapter call fails", () => {
  it.each([
    ["view", ["view", "7"], "read"],
    ["view --field body", ["view", "7", "--field", "body"], "read"],
    ["list", ["list"], "listOpen"],
    ["edit", ["edit", "7", "--body-file", "c.md"], "writeBody"],
    ["comment", ["comment", "7", "--body-file", "c.md"], "comment"],
    ["open", ["open", "--title", "T", "--body-file", "c.md"], "open"],
    ["label --add", ["label", "7", "--add", "x"], "addLabel"],
    ["label --remove", ["label", "7", "--remove", "x"], "removeLabel"],
    ["block", ["block", "7", "--by", "3"], "blockers"],
    ["blockers", ["blockers", "7"], "blockers"],
  ] as const)(
    "%s exits non-zero with the error and prints nothing that reads as an answer",
    async (_name, argv, op) => {
      quiet();
      const r = deps([{ number: 7 }]);
      const failing = memoryTickets([{ number: 7 }], {
        fail: { [op]: new Error("HTTP 502: Bad Gateway") },
      });
      r.d.open = async () => ({ tickets: failing.tickets });

      expect(await main([...argv], r.d)).toBe(1);
      expect(r.out).toEqual([]);
      expect(errors.join("\n")).toContain("HTTP 502: Bad Gateway");
    },
  );

  it("view of a ticket that does not exist exits non-zero with not found", async () => {
    quiet();
    const { d, out } = deps([]);

    expect(await main(["view", "404"], d)).toBe(1);
    expect(out).toEqual([]);
    expect(errors.join("\n")).toContain("#404 was not found");
  });
});

describe("a ticket command given a body with a bare tag", () => {
  const BARE = "Rename `x` to <slug> in the title.";

  it.each([
    ["edit", ["edit", "7", "--body-file", "bare.md"]],
    ["comment", ["comment", "7", "--body-file", "bare.md"]],
    ["open", ["open", "--title", "T", "--body-file", "bare.md"]],
  ])(
    "%s exits non-zero, names the tag, and posts nothing",
    async (_name, argv) => {
      quiet();
      const { d, out, memory, files } = deps([{ number: 7, body: "Before." }]);
      files.set("bare.md", BARE);

      expect(await main(argv, d)).toBe(1);
      expect(out).toEqual([]);
      expect(errors.join("\n")).toContain("<slug>");
      expect(memory.comments(7)).toEqual([]);
      expect(memory.state.get(7)?.body).toBe("Before.");
      expect(memory.state.size).toBe(1);
    },
  );
});

describe("a ticket system other than GitHub", () => {
  it("fails ticket view with the message naming the one built", async () => {
    quiet();
    const { d, out, opened } = deps([{ number: 1 }]);
    d.settings = async () =>
      parseSettings(
        {
          version: 2,
          repository: "acme/widgets",
          tickets: { type: "jira" },
        },
        () => true,
      );

    expect(await main(["view", "1"], d)).toBe(1);
    expect(out).toEqual([]);
    expect(opened).toEqual([]);
    expect(errors.join("\n")).toContain(
      'tickets.type "jira" is not supported. "github" is the only ticket system built.',
    );
  });
});

describe("the owner's override label", () => {
  it.each(["verdict: override", "Verdict: Override"])(
    "label --add %s is refused and adds nothing",
    async (label) => {
      quiet();
      const { d, out, memory } = deps([{ number: 7 }]);

      expect(await main(["label", "7", "--add", label], d)).toBe(1);
      expect(out).toEqual([]);
      expect(memory.state.get(7)?.labels).toEqual([]);
      expect(errors.join("\n")).toContain("an agent never adds");
    },
  );
});

describe("a ticket opened with a bare tag in its title", () => {
  it("is refused, naming the tag, and nothing opens", async () => {
    quiet();
    const { d, memory } = deps([{ number: 7 }]);

    expect(
      await main(
        ["open", "--title", "Rename <slug>", "--body-file", "c.md"],
        d,
      ),
    ).toBe(1);
    expect(errors.join("\n")).toContain("<slug>");
    expect(memory.state.size).toBe(1);
  });
});
