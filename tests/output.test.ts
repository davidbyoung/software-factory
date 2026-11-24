// The printer every command prints through: what each kind of line looks
// like in color, what colors itself, and that color adds only codes.
import { Writable } from "node:stream";
import { stripVTControlCharacters, styleText } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as say from "../src/lib/output.mts";
import { COMMANDS } from "../src/commands-list.mts";
import { marked } from "./printed";

/** A line as it is printed in color, each look as `{heading:words}`. */
const look = (line: say.Line) => marked(say.render(line, true));
const plain = (line: say.Line) => say.render(line, false);

function stream(isTTY: boolean, depth = 8) {
  const written: string[] = [];
  const s = new Writable({
    write: (chunk, _e, done) => {
      written.push(String(chunk));
      done();
    },
  });
  Object.assign(s, { isTTY, getColorDepth: () => depth });
  return { stream: s, written };
}

describe("the table of looks", () => {
  it("has no blue, magenta, or bright color, and no bold yellow", () => {
    const styles = Object.values(say.ROLES).map((r) => [...r] as string[]);
    expect(styles.flat().filter((c) => /blue|magenta|Bright/.test(c))).toEqual(
      [],
    );
    expect(styles.filter((r) => r.includes("yellow"))).toEqual([["yellow"]]);
  });

  it("paints each role as the table says", () => {
    for (const [role, codes] of Object.entries(say.ROLES))
      expect(
        say.render(new say.Line([{ role: role as say.Role, text: "x" }]), true),
      ).toBe(styleText([...codes], "x", { validateStream: false }));
  });
});

describe("a kind of line", () => {
  const cases: [string, say.Line, string][] = [
    ["a heading", say.heading("Found"), "{heading:Found}"],
    [
      "an indented heading",
      say.heading("GitHub", { indent: 2 }),
      "  {heading:GitHub}",
    ],
    [
      "a table's columns, with no underline on the spaces between",
      say.heads(
        [
          ["State", 8],
          ["Column", 0],
        ],
        { indent: 2 },
      ),
      "  {heading:State}   {heading:Column}",
    ],
    [
      "a row, with no bold on the spaces after the label",
      say.row("You", "an owner of acme", { width: 9 }),
      "  {name:You}       an owner of acme",
    ],
    [
      "a row with a mark",
      say.row("review", "In review", { width: 8, mark: "fail" }),
      "  {bad:✗} {name:review}   In review",
    ],
    [
      "a row whose mark is left out, keeping its place",
      say.row("review", "x", { width: 6, mark: null }),
      "    {name:review} x",
    ],
    [
      "a row with no value yet",
      say.row("Preset", "none yet", { width: 6 }),
      "  {name:Preset} {skip:none yet}",
    ],
    [
      "a row whose value holds a command",
      say.row(
        "Organization",
        "acme, not set up: an owner runs factory init --org https://github.com/acme",
        { width: 12 },
      ),
      "  {name:Organization} acme, not set up: an owner runs {copy:factory init --org https://github.com/acme}",
    ],
    [
      "a step",
      say.step(2, "Run factory init there"),
      "  {yourTurn:2.} Run {copy:factory init} there",
    ],
    [
      "an action",
      say.action("Left to do:", " see https://a.example/b."),
      "{yourTurn:Left to do:} see {copy:https://a.example/b}.",
    ],
    [
      "a mark",
      say.mark("ok", ["Opened ", say.name("acme/web#1"), ", and done"]),
      "{good:✓} Opened {name:acme/web#1}, and done",
    ],
    ["a flag", say.mark("flag", "stale"), "{bad:⚠} stale"],
    ["a note", say.note("Trying the token..."), "{skip:Trying the token...}"],
    ["a blank line", say.BLANK, ""],
    [
      "another tool's line, where nothing colors itself",
      say.verbatim("✗ Run: factory init at https://a.example"),
      "✗ Run: factory init at https://a.example",
    ],
    [
      "a line dim from a place on",
      say.verbatim("a: b  # default", 6),
      "a: b  {skip:# default}",
    ],
    [
      "a person's own words",
      say.text(say.asIs("Have factory doctor warn")),
      "Have factory doctor warn",
    ],
  ];
  it.each(cases)("%s", (_name, line, expected) => {
    expect(look(line)).toBe(expected);
    expect(plain(line)).toBe(stripVTControlCharacters(say.render(line, true)));
  });

  it("is linked in color alone", () => {
    const line = say.text({
      role: "copy",
      text: "#12",
      url: "https://a.example/12",
    });
    expect(say.render(line, true)).toContain(
      "\u001b]8;;https://a.example/12\u001b\\#12",
    );
    expect(plain(line)).toBe("#12");
  });
});

describe("what colors itself in a line", () => {
  it.each([
    ["  ✓ The settings are valid", "  {good:✓} The settings are valid"],
    ["✗ It failed", "{bad:✗} It failed"],
    ["⚠ stale", "{bad:⚠} stale"],
    ["? worth a look", "{yourTurn:?} worth a look"],
    ["- off", "{skip:-} off"],
    ["a - b? ✓ c", "a - b? ✓ c"],
    ["-x", "-x"],
    [
      "Could not reach it: HTTP 502: no",
      "{bad:Could not reach it:} HTTP 502: no",
    ],
    [
      "Could not tell the default branch",
      "{bad:Could not tell the default branch}",
    ],
    ["It could not be read: no", "It could not be read: no"],
    ["Run factory init again.", "Run {copy:factory init} again."],
    [
      "Run factory sync and commit what it writes.",
      "Run {copy:factory sync} and commit what it writes.",
    ],
    ["or run factory update", "or run {copy:factory update}"],
    [
      "first run factory specs new 12 here",
      "first run {copy:factory specs new 12} here",
    ],
    [
      "factory preset add acme/config//node now",
      "{copy:factory preset add acme/config//node} now",
    ],
    [
      "factory preset choose KEY PRESET is it",
      "{copy:factory preset choose KEY PRESET} is it",
    ],
    [
      "Run factory init --org https://github.com/acme again: on",
      "Run {copy:factory init --org https://github.com/acme} again: on",
    ],
    ["run factory init, then wait", "run {copy:factory init}, then wait"],
    [
      "Usage: factory preset add NAME [--yes] [--dry-run]",
      "Usage: {copy:factory preset add NAME [--yes] [--dry-run]}",
    ],
    [
      "Setting up the software factory for acme",
      "Setting up the software factory for acme",
    ],
    [
      "The factory is not installed on this machine",
      "The factory is not installed on this machine",
    ],
    [
      "in .claude/skills/factory-build/SKILL.md",
      "in .claude/skills/factory-build/SKILL.md",
    ],
    ["see https://a.example/b#c.", "see {copy:https://a.example/b#c}."],
    ["(https://a.example)", "({copy:https://a.example})"],
    ["with /factory-refine N, then", "with {copy:/factory-refine N}, then"],
    ["type /factory-build 12 there", "type {copy:/factory-build 12} there"],
    [
      "type /factory-build in a session",
      "type {copy:/factory-build} in a session",
    ],
    [
      "It stopped. Run: gh auth refresh -s project",
      "It stopped. Run: {copy:gh auth refresh -s project}",
    ],
    [
      "It stopped. Run: factory init. Then go.",
      "It stopped. Run: {copy:factory init}. Then go.",
    ],
  ])("%s", (given, expected) => {
    const line = say.text(given);
    expect(look(line)).toBe(expected);
    expect(plain(line)).toBe(given);
  });
});

describe("a printer", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("decides by its own stream", () => {
    vi.stubEnv("FORCE_COLOR", undefined);
    vi.stubEnv("NO_COLOR", undefined);
    const terminal = stream(true);
    const file = stream(false);
    say.printer(terminal.stream)(say.mark("ok", "done"));
    say.printer(file.stream)(say.mark("ok", "done"));
    expect(terminal.written.join("")).toContain("\u001b[32m✓");
    expect(file.written).toEqual(["✓ done\n"]);
  });

  it("of a machine's command is plain whatever FORCE_COLOR is", () => {
    vi.stubEnv("FORCE_COLOR", "1");
    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((l) => void out.push(l));
    vi.spyOn(console, "error").mockImplementation((l) => void out.push(l));
    for (const words of [
      "config get",
      "default-branch",
      "plugins",
      "preset changes",
      "specs list",
      "specs new",
      "ticket view",
      "pr open",
    ]) {
      say.printersFor(words).out(say.mark("ok", words));
      say.printersFor(words).err(say.mark("ok", words));
    }
    expect(out).toHaveLength(16);
    expect(out.filter((l) => l.includes("\u001b"))).toEqual([]);
    say.printersFor("doctor").out(say.mark("ok", "doctor"));
    say.printersFor("doctor").err(say.mark("ok", "doctor"));
    expect(out.slice(16).every((l) => l.includes("\u001b"))).toBe(true);
    vi.restoreAllMocks();
  });

  it("is named after each command the list has", () => {
    expect(COMMANDS.every((c) => ["person", "machine"].includes(c.reads))).toBe(
      true,
    );
  });
});

describe("a frame", () => {
  it("overwrites each line and clears what is below", () => {
    expect(say.frame([say.text("a"), say.text("b")], false)).toBe(
      "\u001b[Ha\u001b[K\nb\u001b[K\u001b[J",
    );
  });
});
