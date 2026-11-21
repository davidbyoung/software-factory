import { Writable } from "node:stream";
import { styleText } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { colorOn, painter } from "../src/lib/color.mts";

/** A stream Node accepts, reporting a terminal and a color depth as a real
 * one does: a terminal with `NO_COLOR` or `TERM=dumb` reports depth 1. */
function stream(isTTY: boolean, depth = 8): Writable {
  const s = new Writable({ write: (_c, _e, cb) => cb() });
  Object.assign(s, { isTTY, getColorDepth: () => depth });
  return s;
}

describe("colorOn", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["1", false, true],
    ["", false, true],
    ["true", false, true],
    [undefined, false, false],
    ["0", true, false],
    ["false", true, false],
    ["yes", true, false],
  ])("FORCE_COLOR=%s, terminal %s: %s", (force, tty, expected) => {
    vi.stubEnv("FORCE_COLOR", force);
    expect(colorOn(stream(tty))).toBe(expected);
  });

  it("colors a terminal that reports colors", () => {
    vi.stubEnv("FORCE_COLOR", undefined);
    expect(colorOn(stream(true, 8))).toBe(true);
  });

  it("leaves a terminal plain when it reports none, as NO_COLOR makes it", () => {
    vi.stubEnv("FORCE_COLOR", undefined);
    expect(colorOn(stream(true, 1))).toBe(false);
  });
});

describe("painter", () => {
  it("leaves text as it is when off", () => {
    expect(painter(false)("green", "✓")).toBe("✓");
  });

  it("paints with Node's codes when on", () => {
    expect(painter(true)(["bold", "red"], "✗")).toBe(
      styleText(["bold", "red"], "✗", { validateStream: false }),
    );
    expect(painter(true)("green", "✓")).not.toBe("✓");
  });
});
