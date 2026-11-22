import { describe, expect, it } from "vitest";
import { parseClock } from "../src/lib/clock.mts";

const START = "2026-11-22T12:00:00Z";

describe("the cost clock's file", () => {
  it("reads the ticket's key", () => {
    expect(
      parseClock(JSON.stringify({ issue: "PROJ-12", start: START })),
    ).toEqual({ issue: "PROJ-12", start: START });
  });

  it("reads a clock written before tickets had keys, its number as the key", () => {
    expect(parseClock(JSON.stringify({ issue: 12, start: START }))).toEqual({
      issue: "12",
      start: START,
    });
  });

  it("reads a clock on no ticket", () => {
    expect(parseClock(JSON.stringify({ issue: null, start: START }))).toEqual({
      issue: null,
      start: START,
    });
  });

  it.each([
    ["a start that is no time", JSON.stringify({ issue: "12", start: "soon" })],
    ["a ticket that is neither", JSON.stringify({ issue: [12], start: START })],
    ["text that is not JSON", "{"],
  ])("is null for %s", (_what, text) => {
    expect(parseClock(text)).toBeNull();
  });
});
