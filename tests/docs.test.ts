// What a reader of the docs is told about what is not built, and how they
// are told to run the command.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PACKAGE = ".";
const CLI = "docs/cli.md";

/** Every page a reader reads, by its path from the package. */
const pages = () => [
  "README.md",
  ...readdirSync(join(PACKAGE, "docs"), { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => `docs/${f}`),
];

const read = (page: string) => readFileSync(join(PACKAGE, page), "utf8");

/** The commands `docs/cli.md`'s tables mark Planned in their last cell, as
 * written there without `npx --no-install` and their arguments, such as
 * `factory poller --once`. */
export function plannedCommands(cli: string): string[] {
  return cli
    .split("\n")
    .filter((line) => /^\| `(?:npx --no-install )?factory/.test(line))
    .filter((line) => {
      const cells = line.split("|").map((c) => c.trim());
      return cells[cells.length - 2] === "Planned";
    })
    .map((line) => /`(?:npx --no-install )?(factory[^`]*)`/.exec(line)![1])
    .map((command) =>
      command
        .split(" ")
        .filter((word) => !/^[A-Z]/.test(word))
        .join(" "),
    );
}

// Emphasis is written with either mark, and Prettier turns `*` into `_`.
const MARK = /[*_]\[?Planned/;

/** For each line of `text` outside a code block, the whole paragraph it
 * sits in: the run of lines between blank lines, where a list item starts a
 * paragraph of its own. */
function paragraphs(lines: string[]): string[] {
  const whole: string[] = new Array(lines.length).fill("");
  let inCode = false;
  let start = -1;
  const close = (end: number) => {
    if (start < 0) return;
    const text = lines.slice(start, end).join(" ");
    for (let i = start; i < end; i++) whole[i] = text;
    start = -1;
  };
  lines.forEach((line, i) => {
    if (line.trim().startsWith("```")) {
      close(i);
      inCode = !inCode;
    } else if (inCode) return;
    else if (!line.trim()) close(i);
    else if (start < 0) start = i;
    else if (/^\s*(?:[-*]|\d+\.) /.test(line)) {
      close(i);
      start = i;
    }
  });
  close(lines.length);
  return whole;
}

/** Each line of `text` that names a planned command without the mark: a
 * line of prose whose paragraph does not hold it, a table row that does not,
 * or a line in a code block whose nearest paragraph above does not. A section
 * whose heading holds the mark is marked whole, its subsections included. A
 * command is named after a backtick,
 * `npx --no-install `, or the start of a line, so prose such as "a factory
 * update" is not one. `docs/cli.md`'s own table rows are marked by their
 * last cell. */
export function unmarked(
  text: string,
  planned: string[],
  isCli = false,
): string[] {
  const names = (line: string) =>
    planned.some((command) =>
      new RegExp(
        `(?:\`|npx --no-install |^\\s*)${command.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}(?![\\w-])`,
      ).test(line),
    );
  const found: string[] = [];
  let inCode = false;
  let paragraph: string[] = [];
  let blank = true;
  // The level of the heading whose mark covers the lines below, or 0.
  let markedLevel = 0;
  const lines = text.split("\n");
  const whole = paragraphs(lines);
  for (const [i, line] of lines.entries()) {
    const heading = inCode ? null : /^(#+) /.exec(line);
    if (heading) {
      const level = heading[1].length;
      if (markedLevel && level <= markedLevel) markedLevel = 0;
      if (!markedLevel && MARK.test(line)) markedLevel = level;
    }
    if (markedLevel) continue;
    if (line.trim().startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      if (names(line) && !MARK.test(paragraph.join(" ")))
        found.push(line.trim());
      continue;
    }
    if (!line.trim()) blank = true;
    else {
      paragraph = blank ? [line] : [...paragraph, line];
      blank = false;
    }
    if (isCli && line.startsWith("|")) continue;
    // A table row with a state column, such as "What is built", is marked by
    // a cell that starts with Planned.
    if (
      line.startsWith("|") &&
      line.split("|").some((c) => /^\s*Planned/.test(c))
    )
      continue;
    const scope = line.startsWith("|") ? line : whole[i];
    if (names(line) && !MARK.test(scope)) found.push(line.trim());
  }
  return found;
}

describe("plannedCommands", () => {
  it("takes the rows whose last cell is Planned, without their arguments", () => {
    const cli = [
      "| Command | What | State |",
      "| `factory init` | Sets up | Planned |",
      "| `factory build N` | Builds | Built |",
      "| `factory poller --once` | A schedule | One pass | Planned |",
      "| `npx --no-install factory doctor` | Checks | Planned |",
    ].join("\n");
    expect(plannedCommands(cli)).toEqual([
      "factory init",
      "factory poller --once",
      "factory doctor",
    ]);
  });
});

describe("unmarked", () => {
  const planned = ["factory init", "factory poller --once"];

  it("finds a line of prose that names a planned command without the mark", () => {
    expect(unmarked("Run `factory init` first.", planned)).toEqual([
      "Run `factory init` first.",
    ]);
  });

  it("lets a line with the mark through", () => {
    expect(
      unmarked("*[Planned](x)*: run `factory init` first.", planned),
    ).toEqual([]);
  });

  it("reads a code block by the whole paragraph above it", () => {
    const text = [
      "_[Planned](x)_: a command that",
      "writes everything.",
      "",
      "```bash",
      "npx --no-install factory init",
      "```",
    ].join("\n");
    expect(unmarked(text, planned)).toEqual([]);
  });

  it("reads a code block by the nearest line of prose above it", () => {
    const block = (above: string) =>
      [above, "", "```bash", "npx --no-install factory init", "```"].join("\n");
    expect(unmarked(block("Then:"), planned)).toEqual([
      "npx --no-install factory init",
    ]);
    expect(unmarked(block("*[Planned](x)*: then:"), planned)).toEqual([]);
  });

  it("reads a line of prose by the paragraph it sits in", () => {
    const wrapped = [
      "Until then, _[Planned](x):_",
      "`factory init` writes it for you.",
    ].join("\n");
    expect(unmarked(wrapped, planned)).toEqual([]);
    const apart = [
      "_[Planned](x):_ one thing.",
      "",
      "Run `factory init`.",
    ].join("\n");
    expect(unmarked(apart, planned)).toEqual(["Run `factory init`."]);
  });

  it("does not read a built command as the planned one it starts", () => {
    expect(unmarked("Run `factory poller` on your server.", planned)).toEqual(
      [],
    );
    expect(unmarked("Run `factory initialize`.", planned)).toEqual([]);
  });

  it("reads a section whose heading holds the mark as marked", () => {
    const text = [
      "## Getting a new version _[Planned](x)_",
      "",
      "Run `factory init` again.",
      "",
      "### Under it",
      "",
      "Run `factory init` then.",
      "",
      "## Something else",
      "",
      "Run `factory init` again.",
    ].join("\n");
    expect(unmarked(text, planned)).toEqual(["Run `factory init` again."]);
  });

  it("does not read words in prose as a command", () => {
    expect(unmarked("It reads a factory init for you.", planned)).toEqual([]);
  });

  it("reads a table row by a cell that starts with Planned", () => {
    expect(
      unmarked(
        "| `factory init` and more | Planned, not yet scheduled |",
        planned,
      ),
    ).toEqual([]);
    expect(unmarked("| `factory init` and more | Working |", planned)).toEqual([
      "| `factory init` and more | Working |",
    ]);
  });

  it("leaves `docs/cli.md`'s own rows to their last cell", () => {
    expect(
      unmarked("| `factory init` | Sets up | Planned |", planned, true),
    ).toEqual([]);
  });
});

describe("the docs", () => {
  const planned = plannedCommands(read(CLI));

  it("take their planned commands from docs/cli.md", () => {
    expect(planned).toEqual(
      expect.arrayContaining(["factory config explain", "factory migrate"]),
    );
  });

  it("mark every use of a planned command", () => {
    const found = pages().flatMap((page) =>
      unmarked(read(page), planned, page === CLI).map(
        (line) => `${page}: ${line}`,
      ),
    );
    expect(found).toEqual([]);
  });

  it("give every table a header row with words in it", () => {
    const found = pages().flatMap((page) => {
      const lines = read(page).split("\n");
      return lines.flatMap((line, i) =>
        /^\|[\s|:-]*-{3}[\s|:-]*\|$/.test(line) &&
        /^\|[\s|]*\|$/.test(lines[i - 1] ?? "")
          ? [`${page}:${i}: ${lines[i - 1]!.trim()}`]
          : [],
      );
    });
    expect(found).toEqual([]);
  });

  it("never show a bare `npx factory`, which can run another package", () => {
    const found = pages().flatMap((page) =>
      read(page)
        .split("\n")
        .filter((line) => /\bnpx factory\b/.test(line))
        .map((line) => `${page}: ${line.trim()}`),
    );
    expect(found).toEqual([]);
  });

  it("ship a review workflow that reads either credential init can store", () => {
    const workflow = read("workflows/factory-claude-review.yml");
    expect(workflow).toContain("secrets.CLAUDE_CODE_OAUTH_TOKEN");
    expect(workflow).toContain("secrets.ANTHROPIC_API_KEY");
  });

  it("carry no banner saying the pages are not built", () => {
    const found = pages().filter((page) =>
      read(page).includes("Not built yet"),
    );
    expect(found).toEqual([]);
  });
});
