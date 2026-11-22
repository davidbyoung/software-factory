import { describe, expect, it } from "vitest";
import {
  commentFor,
  lastAssistantText,
  main,
  modelName,
  verdictOf,
  type Deps,
  type State,
} from "../src/reviewers.mts";
import { parseRuns, type ReviewerRun } from "../src/lib/work-status.mts";
import { memoryTickets, type MemoryOptions } from "./memory-tickets";

const SESSION = "f4f3f560-aaaa";
const START = new Date("2026-11-11T19:40:00Z");
const TRANSCRIPT = JSON.stringify({
  type: "assistant",
  requestId: "req_1",
  message: {
    model: "claude-sonnet-5-5",
    usage: { output_tokens: 84_000 },
    content: [{ type: "text", text: "Done.\n\nVerdict: pass" }],
  },
});

/** The ticket system the hook records on: ticket #224, whose first comment
 * gets ID 77, failing as `fail` says. `opened` counts the times the hook
 * opened it. */
function system(fail: MemoryOptions["fail"] = {}, firstCommentId = 77) {
  const mem = memoryTickets([{ number: 224 }], { fail, firstCommentId });
  let opened = 0;
  return {
    mem,
    open: async () => (opened++, mem.tickets),
    opened: () => opened,
    /** Every body posted on #224, as it stands now. */
    bodies: () => mem.comments(224).map((c) => c.body),
  };
}

function deps(
  open: Deps["tickets"],
  clock: Deps["clock"] = () => ({ issue: "224", start: START.toISOString() }),
) {
  const states = new Map<string, State>();
  const out: string[] = [];
  let now = START;
  const d: Deps = {
    tickets: open,
    now: () => now,
    clock,
    readFile: (path) =>
      path === "agents/factory-test-reviewer.md"
        ? "---\nname: factory-test-reviewer\nmodel: sonnet\ntools: Read\n---\n\nBody."
        : path === "t.jsonl"
          ? TRANSCRIPT
          : null,
    state: {
      read: (session, issue) =>
        structuredClone(
          states.get(`${session}/${issue}`) ?? { commentId: null, runs: [] },
        ),
      write: (session, issue, state) =>
        states.set(`${session}/${issue}`, structuredClone(state)),
    },
    locked: (_session, work) => work(),
    out: (line) => out.push(line),
  };
  const later = (minutes: number) =>
    (now = new Date(START.getTime() + minutes * 60_000));
  return { d, states, out, later };
}

const input = (over: object = {}) => ({
  session_id: SESSION,
  agent_id: "a1",
  agent_type: "factory-test-reviewer",
  ...over,
});
const runsIn = (body: string) =>
  parseRuns({ id: "1", createdAt: "", author: "x", body });

describe("reviewer runs", () => {
  it("posts a running row on the clock's issue when a reviewer starts", async () => {
    const t = system();
    const { d, states, out } = deps(t.open);

    expect(await main("start", input(), "agents", d)).toBe(0);

    const [body] = t.bodies();
    expect(body).toContain(
      "| factory-test-reviewer | Sonnet | 2026-11-11 19:40 UTC | running |  |  |",
    );
    expect(body).toContain(`<!-- reviewer-runs session=${SESSION} -->`);
    expect(runsIn(body)).toEqual([
      {
        id: "a1",
        reviewer: "factory-test-reviewer",
        model: "Sonnet",
        start: START.toISOString(),
        result: "running",
      },
    ]);
    expect(states.get(`${SESSION}/224`)?.commentId).toBe("77");
    expect(out).toEqual([]);
  });

  it("edits the same comment on the finish, with the verdict, how long it ran, and its cost", async () => {
    const t = system();
    const { d, later } = deps(t.open);

    await main("start", input(), "agents", d);
    later(3);
    await main(
      "stop",
      input({
        agent_transcript_path: "t.jsonl",
        last_assistant_message: "Done.\n\nVerdict: pass",
      }),
      "agents",
      d,
    );

    const comments = t.mem.comments(224);
    expect(comments.map((c) => c.id)).toEqual(["77"]);
    expect(comments[0].body).toContain(
      "| factory-test-reviewer | Sonnet | 2026-11-11 19:40 UTC | passed | 3 min | $0.03 ($0.84) |",
    );
    expect(comments[0].body).not.toContain("<!-- cost:");
  });

  it("reads the verdict from the transcript when the hook does not give the last message", async () => {
    const t = system();
    const { d } = deps(t.open);

    await main("start", input(), "agents", d);
    await main(
      "stop",
      input({ agent_transcript_path: "t.jsonl" }),
      "agents",
      d,
    );

    expect(runsIn(t.bodies()[0])[0].result).toBe("passed");
  });

  it("reads the verdict from the report a reviewer hands back through a tool call", async () => {
    const t = system();
    const { d } = deps(t.open);
    const line = (content: unknown) =>
      JSON.stringify({ type: "assistant", message: { content } });
    const read = d.readFile;
    d.readFile = (path) =>
      path === "handback.jsonl"
        ? [
            line([{ type: "text", text: "Now the pixel diffs." }]),
            line([
              {
                type: "tool_use",
                name: "SubagentHandback",
                input: {
                  message: "Two tests.\n\nVerdict: fail, 2 findings to fix",
                },
              },
            ]),
          ].join("\n")
        : read(path);

    await main("start", input(), "agents", d);
    await main(
      "stop",
      input({
        agent_transcript_path: "handback.jsonl",
        last_assistant_message: "Now the pixel diffs.",
      }),
      "agents",
      d,
    );

    expect(runsIn(t.bodies()[0])[0]).toMatchObject({
      result: "failed",
      findings: 2,
    });
  });

  it("keeps a finish whose start went unrecorded", async () => {
    const t = system();
    const { d } = deps(t.open);

    await main(
      "stop",
      input({ last_assistant_message: "Verdict: fail, 1 finding to fix" }),
      "agents",
      d,
    );

    expect(t.bodies()[0]).toContain("| 1 finding to fix |");
  });

  it("posts the comment again when the earlier one was deleted", async () => {
    const t = system({}, 71);
    const { d, states } = deps(t.open);

    await main("start", input(), "agents", d);
    await t.mem.tickets.deleteComment("71");
    await main("stop", input({ last_assistant_message: "x" }), "agents", d);

    expect(states.get(`${SESSION}/224`)?.commentId).toBe("72");
    expect(t.mem.comments(224).map((c) => c.id)).toEqual(["72"]);
  });

  it("warns rather than posting a second comment when the edit fails for another reason", async () => {
    const t = system({ editComment: new Error("HTTP 500 Server Error") });
    const { d, out } = deps(t.open);

    await main("start", input(), "agents", d);
    await main("stop", input({ last_assistant_message: "x" }), "agents", d);

    expect(t.mem.comments(224)).toHaveLength(1);
    expect(out).toHaveLength(1);
    expect(JSON.parse(out[0]).systemMessage).toContain("HTTP 500");
  });

  it("corrects the model from the transcript on the finish", async () => {
    const t = system();
    const { d } = deps(t.open);
    const read = d.readFile;
    d.readFile = (path) =>
      path === "t.jsonl"
        ? TRANSCRIPT.replace("claude-sonnet-5-5", "claude-opus-5-5")
        : read(path);

    await main("start", input(), "agents", d);
    await main(
      "stop",
      input({ agent_transcript_path: "t.jsonl" }),
      "agents",
      d,
    );

    expect(runsIn(t.bodies()[0])[0].model).toBe("Opus");
  });

  it("records nothing for an agent that is not a reviewer", async () => {
    const t = system();
    const { d } = deps(t.open);

    expect(
      await main("start", input({ agent_type: "Explore" }), "agents", d),
    ).toBe(0);
    expect(t.opened()).toBe(0);
    expect(t.bodies()).toEqual([]);
  });

  it("records nothing when the session's clock is not running", async () => {
    const t = system();
    const { d, out } = deps(t.open, () => null);

    expect(await main("start", input(), "agents", d)).toBe(0);
    expect(t.opened()).toBe(0);
    expect(out).toEqual([]);
  });

  it("records nothing when the session's clock names no issue", async () => {
    const t = system();
    const { d, out } = deps(t.open, () => ({
      issue: null,
      start: START.toISOString(),
    }));

    expect(await main("start", input(), "agents", d)).toBe(0);
    expect(t.opened()).toBe(0);
    expect(out).toEqual([]);
  });

  it("shows one warning line and exits 0 when GitHub cannot be reached", async () => {
    const t = system({
      comment: new Error("gh api -X POST: connection refused"),
    });
    const { d, out } = deps(t.open);

    expect(await main("start", input(), "agents", d)).toBe(0);
    expect(out.map((line) => JSON.parse(line))).toEqual([
      {
        systemMessage:
          "The factory-test-reviewer run was not recorded on ticket 224: gh api -X POST: connection refused",
      },
    ]);
  });

  it("exits 0 when the clock cannot be read", async () => {
    const { d, out } = deps(system().open, () => {
      throw new Error("not a git repository");
    });

    expect(await main("start", input(), "agents", d)).toBe(0);
    expect(JSON.parse(out[0]).systemMessage).toBe(
      "The factory-test-reviewer run was not recorded: not a git repository",
    );
  });
});

describe("verdictOf", () => {
  it.each([
    ["Verdict: pass", { result: "passed" }],
    ["Verdict: fail, 2 findings to fix", { result: "failed", findings: 2 }],
    ["Verdict: fail, 1 finding to fix", { result: "failed", findings: 1 }],
    ["No verdict here.", { result: "no verdict" }],
    ["`Verdict: pass`", { result: "passed" }],
    ["**Verdict: fail, 2 findings to fix**", { result: "failed", findings: 2 }],
    [
      "Verdict: pass\n...\nVerdict: fail, 3 findings to fix",
      { result: "failed", findings: 3 },
    ],
  ])("reads %j", (report, expected) => {
    expect(verdictOf(report)).toEqual(expected);
  });
});

describe("modelName", () => {
  it("reads the frontmatter's model as the row shows it", () => {
    expect(modelName("---\nname: x\nmodel: opus\n---\n")).toBe("Opus");
    expect(modelName("---\nmodel: claude-sonnet-5-5\n---\n")).toBe("Sonnet");
    expect(modelName("---\nname: x\n---\nmodel: opus")).toBe("unknown");
    expect(modelName(null)).toBe("unknown");
  });
});

describe("lastAssistantText", () => {
  it("takes the last assistant text, skipping tool calls", () => {
    const line = (content: unknown) =>
      JSON.stringify({ type: "assistant", message: { content } });
    expect(
      lastAssistantText(
        [
          line([{ type: "text", text: "First." }]),
          line([{ type: "text", text: "Verdict: pass" }]),
          line([{ type: "tool_use", name: "Read" }]),
          "not json",
        ].join("\n"),
      ),
    ).toBe("Verdict: pass");
  });
});

describe("commentFor", () => {
  const run = (over: Partial<ReviewerRun>): ReviewerRun => ({
    id: "a",
    reviewer: "ui-reviewer",
    model: "Opus",
    start: START.toISOString(),
    result: "running",
    ...over,
  });

  it("shows a run still running two hours on as no finish recorded", () => {
    const body = commentFor(
      SESSION,
      [run({})],
      new Date(START.getTime() + 2 * 3600_000 + 60_000),
    );
    expect(body).toContain(
      "| ui-reviewer | Opus | 2026-11-11 19:40 UTC | no finish recorded |  |  |",
    );
  });

  it("names a finish with no verdict line", () => {
    const body = commentFor(
      SESSION,
      [run({ result: "no verdict", end: "2026-11-11T19:59:00Z", cost: 5.02 })],
      START,
    );
    expect(body).toContain("| finished, no verdict | 19 min | $0.15 ($5.02) |");
  });
});
