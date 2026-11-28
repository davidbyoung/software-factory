// The printer every command prints through: what each kind of line looks
// like in color, what colors itself, and that color adds only codes.
import { Writable } from "node:stream";
import { stripVTControlCharacters, styleText } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as say from "../src/lib/output.mts";
import { into, look, marked, undressed } from "./printed";

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
        "acme, not set up: an owner runs lunamill init --org https://github.com/acme",
        { width: 12 },
      ),
      "  {name:Organization} acme, not set up: an owner runs {copy:lunamill init --org https://github.com/acme}",
    ],
    [
      "a step",
      say.step(2, "Run lunamill init there"),
      "  {yourTurn:2.} Run {copy:lunamill init} there",
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
      say.verbatim("✗ Run: lunamill init at https://a.example"),
      "✗ Run: lunamill init at https://a.example",
    ],
    [
      "a line dim from a place on",
      say.verbatim("a: b  # default", 6),
      "a: b  {skip:# default}",
    ],
    [
      "a person's own words",
      say.text(say.asIs("Have lunamill doctor warn")),
      "Have lunamill doctor warn",
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
    ["Run lunamill init again.", "Run {copy:lunamill init} again."],
    [
      "Run lunamill sync and commit what it writes.",
      "Run {copy:lunamill sync} and commit what it writes.",
    ],
    ["or run lunamill update", "or run {copy:lunamill update}"],
    [
      "first run lunamill specs new 12 here",
      "first run {copy:lunamill specs new 12} here",
    ],
    [
      "lunamill preset add acme/config//node now",
      "{copy:lunamill preset add acme/config//node} now",
    ],
    [
      "lunamill preset choose KEY PRESET is it",
      "{copy:lunamill preset choose KEY PRESET} is it",
    ],
    [
      "Run lunamill init --org https://github.com/acme again: on",
      "Run {copy:lunamill init --org https://github.com/acme} again: on",
    ],
    ["run lunamill init, then wait", "run {copy:lunamill init}, then wait"],
    [
      "Usage: lunamill preset add NAME [--yes] [--dry-run]",
      "Usage: {copy:lunamill preset add NAME [--yes] [--dry-run]}",
    ],
    ["Setting up lunamill for acme", "Setting up lunamill for acme"],
    [
      "lunamill is not installed on this machine",
      "lunamill is not installed on this machine",
    ],
    [
      "in .claude/skills/lunamill-build/SKILL.md",
      "in .claude/skills/lunamill-build/SKILL.md",
    ],
    ["see https://a.example/b#c.", "see {copy:https://a.example/b#c}."],
    ["(https://a.example)", "({copy:https://a.example})"],
    ["with /lunamill-refine N, then", "with {copy:/lunamill-refine N}, then"],
    ["type /lunamill-build 12 there", "type {copy:/lunamill-build 12} there"],
    [
      "type /lunamill-build in a session",
      "type {copy:/lunamill-build} in a session",
    ],
    [
      "It stopped. Run: gh auth refresh -s project",
      "It stopped. Run: {copy:gh auth refresh -s project}",
    ],
    [
      "site needs Playwright: npm install -D playwright",
      "site needs Playwright: {copy:npm install -D playwright}",
    ],
    [
      "Restore it with: git checkout -- .claude/a.md",
      "Restore it with: {copy:git checkout -- .claude/a.md}",
    ],
    [
      "The workflows fail at npm ci until it is.",
      "The workflows fail at npm ci until it is.",
    ],
    ["run `lunamill sync` to fix it", "run `{copy:lunamill sync}` to fix it"],
    [
      "It stopped. Run: lunamill init. Then go.",
      "It stopped. Run: {copy:lunamill init}. Then go.",
    ],
  ])("%s", (given, expected) => {
    const line = say.text(given);
    expect(look(line)).toBe(expected);
    expect(plain(line)).toBe(given);
  });
});

describe("a printer", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

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

  /** What printing a mark on each of a command's streams wrote. */
  const printedBy = (words: string) => {
    const lines: string[] = [];
    const keep = (line: string) => void lines.push(line);
    vi.spyOn(console, "log").mockImplementation(keep);
    vi.spyOn(console, "error").mockImplementation(keep);
    const { out, err } = say.printersFor(words);
    out(say.mark("ok", words));
    err(say.mark("ok", words));
    return lines;
  };

  it.each([
    "config get",
    "default-branch",
    "plugins",
    "preset changes",
    "specs list",
    "specs new",
    "ticket view",
    "pr open",
  ])(
    "of %s, which a machine reads, is plain whatever FORCE_COLOR is",
    (words) => {
      vi.stubEnv("FORCE_COLOR", "1");
      expect(printedBy(words)).toEqual([`✓ ${words}`, `✓ ${words}`]);
    },
  );

  it("of a person's command is in color on both streams where FORCE_COLOR says", () => {
    vi.stubEnv("FORCE_COLOR", "1");
    expect(printedBy("doctor").map(marked)).toEqual([
      "{good:✓} doctor",
      "{good:✓} doctor",
    ]);
  });
});

describe("a frame", () => {
  it("overwrites each line and clears what is below", () => {
    expect(say.frame([say.text("a"), say.text("b")], false)).toBe(
      "\u001b[Ha\u001b[K\nb\u001b[K\u001b[J",
    );
  });
});

describe("the tests' own printer", () => {
  it.each([
    ["  Code host        GitHub", "a row printed as text"],
    ["  ✓ review     In review", "a row printed as text"],
    ["  1. Merge it", "a step printed as text"],
    ["1. Merge it", "a step printed as text"],
  ])("fails on %s printed as text", (line, fault) => {
    expect(undressed(say.text(line))).toContain(fault);
    expect(() => into([])(say.text(line))).toThrow(fault);
  });

  it("takes each of them once the line says what it is, and prose as text", () => {
    const out: string[] = [];
    const print = into(out);
    print(say.row("Code host", "GitHub", { width: 16 }));
    print(say.step(1, "Merge it"));
    print(say.verbatim("  a   b"));
    print(say.text("  Choose all repositories. Then press it."));
    expect(out).toHaveLength(4);
  });

  it("fails on codes that are no look's", () => {
    expect(() => marked("\u001b[35mx\u001b[39m")).toThrow("no look");
  });
});
