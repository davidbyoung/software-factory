import { Writable } from "node:stream";
import { styleText } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { colorOn, painter } from "../src/lib/color.mts";
import { boardDeps } from "../src/board.mts";
import { defaultDeps as configDeps } from "../src/config.mts";
import { doctorDeps } from "../src/doctor.mts";
import { presetDeps } from "../src/preset-commands.mts";
import { terminalStyle } from "../src/status.mts";

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
    [undefined, false, false],
    ["0", true, false],
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
  });
});

describe("each command's own dependencies", () => {
  afterEach(() => vi.unstubAllEnvs());
  const root = process.cwd();
  const paints = {
    doctor: () => doctorDeps(root).paint!,
    preset: () => presetDeps(root).paint!,
    "config explain": () => configDeps(root).paint!,
    "board check": () => boardDeps([]).paint!,
    status: () => painter(terminalStyle().color),
  };

  it.each(Object.entries(paints))(
    "%s colors where colorOn says, and stays plain where it does not",
    (_name, paint) => {
      vi.stubEnv("FORCE_COLOR", "1");
      expect(paint()("red", "x")).not.toBe("x");
      vi.stubEnv("FORCE_COLOR", "0");
      expect(paint()("red", "x")).toBe("x");
    },
  );
});
