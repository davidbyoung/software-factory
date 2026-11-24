// What a cloud session's log shows of the agent: one line for each thing it
// says and each tool it runs, then how it ended.
import { describe, expect, it } from "vitest";
import { isJob, publishTicketDeps, shown } from "../src/session-jobs.mts";
import { main as ticketMain, ticketDeps } from "../src/ticket.mts";
import { fakeSettings } from "./fake-gh";
import { memoryRunner } from "./memory-runner";
import { memoryTickets } from "./memory-tickets";

const line = (value: unknown) => shown(JSON.stringify(value));
const said = (...content: object[]) =>
  line({ type: "assistant", message: { content } });

describe("what the log shows of the agent", () => {
  it("is each thing it says and each tool it runs, in order, one line each", () => {
    expect(
      said(
        { type: "text", text: "Reading the ticket.\n\n  Then the code." },
        {
          type: "tool_use",
          name: "Bash",
          input: { command: "cd ../work &&\n  npm test", timeout: 1000 },
        },
      ),
    ).toEqual([
      "Reading the ticket. Then the code.",
      "> Bash: cd ../work && npm test",
    ]);
  });

  it("cuts what a tool was given to 200 characters", () => {
    expect(
      said({
        type: "tool_use",
        name: "Bash",
        input: { command: "x".repeat(201) },
      }),
    ).toEqual([`> Bash: ${"x".repeat(200)}`]);
  });

  it("writes what is not text as JSON, and a tool given nothing with nothing after it", () => {
    expect(
      said(
        { type: "tool_use", name: "Todo", input: { items: [{ a: 1 }] } },
        { type: "tool_use", name: "Wait" },
      ),
    ).toEqual(['> Todo: [{"a":1}]', '> Wait: ""']);
  });

  it("is how it ended, then each command it was refused", () => {
    expect(
      line({
        type: "result",
        subtype: "success",
        num_turns: 12,
        duration_ms: 179_999,
        total_cost_usd: 1.25,
        permission_denials: [
          {
            tool_name: "Read",
            tool_input: { file_path: "/proc/self/environ" },
          },
        ],
      }),
    ).toEqual([
      "Finished (success): 12 turns, 2 minutes, $1.25 at API list prices.",
      "Denied: Read: /proc/self/environ",
    ]);
  });

  it("shows nothing a tool answered, which can hold what a file or a page said", () => {
    expect(
      line({
        type: "user",
        message: { content: [{ type: "tool_result", content: "secret" }] },
      }),
    ).toEqual([]);
    expect(said({ type: "thinking", thinking: "hm" })).toEqual([]);
    expect(line({ type: "system", subtype: "init" })).toEqual([]);
  });

  it.each(["", "not JSON", '{"type": "assis'])(
    "shows nothing for a line that is not JSON, %j",
    (text) => {
      expect(shown(text)).toEqual([]);
    },
  );

  it.each(["null", "7", '"text"', "[]"])(
    "shows nothing for a line of JSON that is no object, %s",
    (text) => {
      expect(shown(text)).toEqual([]);
    },
  );

  it.each([
    ["no message", { type: "assistant" }],
    ["a message with no content", { type: "assistant", message: {} }],
  ])("shows nothing for %s", (_, value) => {
    expect(line(value)).toEqual([]);
  });
});

describe("a ticket command Publish runs for a session", () => {
  const run = (tickets: ReturnType<typeof memoryTickets>["tickets"]) => ({
    settings: fakeSettings,
    open: async () => ({ tickets }),
    openPulls: async () => [],
    startSync: async () => {},
    runner: () => memoryRunner().runner,
    env: { GITHUB_ACTIONS: "true", GITHUB_RUN_ID: "555" },
    sleep: async () => {},
  });

  it("stops the ticket by the claim Prepare made, on another machine", async () => {
    const { tickets, comments } = memoryTickets([{ key: "12" }]);
    const said: string[] = [];
    await ticketMain(["claim", "12"], {
      ...ticketDeps(),
      ...run(tickets),
      claimStore: { read: () => null, write: () => {} },
      out: () => {},
    });
    const claim = (await tickets.record.read("12"))[0].id;

    const code = await ticketMain(["stop", "12", "needs ticket 40"], {
      ...publishTicketDeps({ ticket: "12", claim }),
      ...run(tickets),
      out: (line) => said.push(line),
    });

    expect(said).toEqual(["released"]);
    expect(code).toBe(0);
    expect(comments("12").at(-1)!.body).toContain("needs ticket 40");
  });
});

describe("the jobs of a cloud run", () => {
  it("are known by their names alone, and not by what every object has", () => {
    expect(
      ["prepare", "run", "publish", "next", "each"].every((s) => isJob(s)),
    ).toBe(true);
    for (const step of ["ready", "toString", "constructor", "", undefined])
      expect(isJob(step), String(step)).toBe(false);
  });
});
