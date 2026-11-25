import { Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as say from "../src/lib/output.mts";
import { colorOn } from "../src/lib/output.mts";
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

describe("each command's own dependencies", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  const root = process.cwd();
  const persons = {
    doctor: () => doctorDeps(root).out,
    "preset add": () => presetDeps(root, "preset add").out,
    "board check": () => boardDeps(["check"]).out,
    "board check's errors": () => boardDeps(["check"]).err,
  };
  const machines = {
    "preset changes": () => presetDeps(root).out,
    "config get": () => configDeps(root).out,
    board: () => boardDeps(["apply"]).out,
  };
  /** What printing a mark wrote, on either stream. */
  const printed = (out: () => say.Out) => {
    const lines: string[] = [];
    const keep = (line: string) => void lines.push(line);
    vi.spyOn(console, "log").mockImplementation(keep);
    vi.spyOn(console, "error").mockImplementation(keep);
    out()(say.mark("ok", "done"));
    return lines.join("");
  };

  it.each(Object.entries(persons))(
    "%s colors where colorOn says, and stays plain where it does not",
    (_name, out) => {
      vi.stubEnv("FORCE_COLOR", "1");
      expect(printed(out)).toContain("\x1B[32m✓");
      vi.stubEnv("FORCE_COLOR", "0");
      expect(printed(out)).toBe("✓ done");
    },
  );

  it.each(Object.entries(machines))("%s never colors", (_name, out) => {
    vi.stubEnv("FORCE_COLOR", "1");
    expect(printed(out)).toBe("✓ done");
  });

  it("status takes its style from colorOn", () => {
    vi.stubEnv("FORCE_COLOR", "1");
    expect(terminalStyle().color).toBe(true);
    vi.stubEnv("FORCE_COLOR", "0");
    expect(terminalStyle().color).toBe(false);
  });
});

describe("a person's command whose standard error goes to a file", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is colored on the terminal and plain in the file", () => {
    for (const name of ["FORCE_COLOR", "NO_COLOR", "NODE_DISABLE_COLORS"])
      vi.stubEnv(name, undefined);
    const as = (s: NodeJS.WriteStream, isTTY: boolean) => {
      const before = Object.getOwnPropertyDescriptors(s);
      Object.defineProperty(s, "isTTY", { value: isTTY, configurable: true });
      Object.defineProperty(s, "getColorDepth", {
        value: () => (isTTY ? 8 : 1),
        configurable: true,
      });
      return () => {
        for (const key of ["isTTY", "getColorDepth"] as const) {
          delete (s as unknown as Record<string, unknown>)[key];
          if (before[key]) Object.defineProperty(s, key, before[key]);
        }
      };
    };
    const restore = [as(process.stdout, true), as(process.stderr, false)];
    const out = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { out: say1, err: say2 } = say.printersFor("gate");
      say1(say.mark("ok", "done"));
      say2(say.mark("fail", "not done"));
    } finally {
      for (const r of restore) r();
    }
    expect(out).toHaveBeenCalledWith(expect.stringContaining("\x1B[32m✓"));
    expect(err).toHaveBeenCalledWith("✗ not done");
  });
});
