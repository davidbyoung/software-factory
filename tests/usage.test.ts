import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { requestPrice } from "../src/lib/pricing.mts";
import {
  costNote,
  noteText,
  measureSession,
  spendIn,
  type Spend,
} from "../src/lib/usage.mts";

const ZERO = {
  input: 0,
  cacheWrite5m: 0,
  cacheWrite1h: 0,
  cacheRead: 0,
  output: 0,
};

/** One transcript line: an assistant entry with the request's usage. */
function entry(
  requestId: string,
  model: string,
  usage: Record<string, unknown>,
  timestamp = "2026-11-11T12:00:00Z",
) {
  return JSON.stringify({
    type: "assistant",
    timestamp,
    requestId,
    message: { model, usage },
  });
}

describe("requestPrice", () => {
  it("prices each kind of token at its own rate", () => {
    expect(
      requestPrice("claude-opus-5-5", {
        input: 1_000_000,
        cacheWrite5m: 2_000_000,
        cacheWrite1h: 3_000_000,
        cacheRead: 4_000_000,
        output: 5_000_000,
      }),
    ).toBeCloseTo(4 * 1 + 5 * 2 + 8 * 3 + 0.2 * 4 + 20 * 5);
  });

  it("bills a Haiku request over 100,000 prompt tokens at the higher rates", () => {
    const at = (input: number) =>
      requestPrice("claude-haiku-5-5", { ...ZERO, input, output: 1_000_000 });
    expect(at(100_000)).toBeCloseTo(0.01 + 0.5);
    expect(at(100_001)).toBeCloseTo(0.0500005 + 2.5);
  });

  it("counts cached tokens toward Haiku's long-prompt rule", () => {
    expect(
      requestPrice("claude-haiku-5-5", {
        ...ZERO,
        input: 10,
        cacheRead: 100_000,
      }),
    ).toBeCloseTo((10 * 0.5 + 100_000 * 0.05) / 1_000_000, 10);
  });

  it("has no price for a model missing from the list", () => {
    expect(requestPrice("claude-fable-5-1", ZERO)).toBeNull();
  });
});

describe("spendIn", () => {
  it("counts a response its transcript repeats once, by request ID, from its last copy", () => {
    const first = entry("req_1", "claude-sonnet-5-5", { output_tokens: 100 });
    const last = entry("req_1", "claude-sonnet-5-5", { output_tokens: 1000 });
    expect(spendIn([`${first}\n${last}\n`]).dollars).toBeCloseTo(0.01, 6);
  });

  it("splits cache writes into 5-minute and 1-hour ones", () => {
    const spend = spendIn([
      entry("req_1", "claude-opus-5-5", {
        cache_creation_input_tokens: 4_000_000,
        cache_creation: {
          ephemeral_5m_input_tokens: 1_000_000,
          ephemeral_1h_input_tokens: 3_000_000,
        },
      }),
    ]);
    expect(spend.dollars).toBeCloseTo(5 + 24);
  });

  it("skips the zero-usage synthetic entries rather than calling them unpriced", () => {
    const spend = spendIn([
      entry("req_1", "<synthetic>", { input_tokens: 0, output_tokens: 0 }),
    ]);
    expect(spend).toEqual({ dollars: 0, priced: 0, unpriced: new Map() });
  });

  it("names tokens on a model with no price instead of counting them as zero", () => {
    const spend = spendIn([
      entry("req_1", "claude-fable-5-1", {
        input_tokens: 100_000,
        output_tokens: 20_000,
      }),
      entry("req_2", "claude-sonnet-5-5", { output_tokens: 1000 }),
    ]);
    expect(spend.unpriced).toEqual(new Map([["claude-fable-5-1", 120_000]]));
    expect(spend.dollars).toBeCloseTo(0.01);
  });

  it("counts only entries from the clock's start on", () => {
    const spend = spendIn(
      [
        [
          entry(
            "req_1",
            "claude-sonnet-5-5",
            { output_tokens: 1000 },
            "2026-11-11T11:59:59Z",
          ),
          entry(
            "req_2",
            "claude-sonnet-5-5",
            { output_tokens: 2000 },
            "2026-11-11T12:00:00Z",
          ),
        ].join("\n"),
      ],
      "2026-11-11T12:00:00Z",
    );
    expect(spend.dollars).toBeCloseTo(0.02);
  });

  it("ignores lines that are not usage", () => {
    const spend = spendIn([
      'not json\n{"type":"user","message":{"content":"hi"}}\n',
    ]);
    expect(spend.priced).toBe(0);
  });
});

describe("costNote", () => {
  const spend = (s: Partial<Spend>): Spend => ({
    dollars: 3.414,
    priced: 2,
    unpriced: new Map(),
    ...s,
  });

  it("gives the line and the hidden marker, to the cent", () => {
    expect(
      noteText(costNote({ ok: true, spend: spend({}) }, "#224", "abc")),
    ).toBe(
      "This session used $0.10 of the subscription ($3.41 at API list prices) on #224 since its last note.\n\n<!-- cost: 3.41 session=abc -->",
    );
  });

  it("ends the sentence with the unpriced tokens, and the marker carries the priced sum", () => {
    expect(
      noteText(
        costNote(
          {
            ok: true,
            spend: spend({
              unpriced: new Map([["claude-fable-5-1", 120_000]]),
            }),
          },
          "#224",
          "abc",
        ),
      ),
    ).toBe(
      "This session used $0.10 of the subscription ($3.41 at API list prices) on #224 since its last note, plus 120,000 tokens on claude-fable-5-1 with no price.\n\n<!-- cost: 3.41 session=abc -->",
    );
  });

  it("says the cost could not be measured when no token is priced", () => {
    const note = noteText(
      costNote(
        {
          ok: true,
          spend: spend({
            dollars: 0,
            priced: 0,
            unpriced: new Map([["claude-fable-5-1", 5]]),
          }),
        },
        "#224",
        "abc",
      ),
    );
    expect(note).toMatch(/^This session's cost could not be measured: /);
    expect(note).not.toContain("<!-- cost:");
  });

  it("says the cost could not be measured when the transcript has no usage", () => {
    expect(
      noteText(
        costNote(
          { ok: true, spend: spend({ dollars: 0, priced: 0 }) },
          "#224",
          "abc",
        ),
      ),
    ).toBe(
      "This session's cost could not be measured: its transcript records no usage since its last note.",
    );
  });
});

describe("measureSession", () => {
  const made: string[] = [];
  afterEach(() => {
    for (const dir of made.splice(0)) rmSync(dir, { recursive: true });
  });

  function projects() {
    const root = mkdtempSync(join(tmpdir(), "usage-"));
    made.push(root);
    const dir = join(root, "-home-user-widgets");
    mkdirSync(join(dir, "s1", "subagents"), { recursive: true });
    writeFileSync(
      join(dir, "s1.jsonl"),
      entry("req_1", "claude-sonnet-5-5", { output_tokens: 1000 }),
    );
    writeFileSync(
      join(dir, "s1", "subagents", "agent-a.jsonl"),
      entry("req_2", "claude-sonnet-5-5", { output_tokens: 1000 }),
    );
    return root;
  }

  it("reads the session's transcript and its subagents'", () => {
    const measured = measureSession(projects(), "s1", null);
    expect(measured.ok && measured.spend.dollars).toBeCloseTo(0.02);
  });

  it("says so when the session has no transcript", () => {
    expect(measureSession(projects(), "s2", null)).toEqual({
      ok: false,
      reason: "no transcript for s2",
    });
  });
});
