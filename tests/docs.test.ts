// What a reader of the docs is told about what is not built, and how they
// are told to run the command.
import { fencedLines } from "../src/lib/fences.mts";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";
import { BUILT } from "../src/tool-names.mts";
import {
  parseSettings,
  PHASES,
  SETTINGS_KEYS,
  ROLE_SHAPE,
  ROLES,
  SESSION_MINUTES,
} from "../src/config.mts";
import { factoryWorkflow } from "../src/workflow-files.mts";
import { ROLES as LOOKS } from "../src/lib/output.mts";
import { DOCS_PAGES } from "../src/lib/docs-page.mts";

const PACKAGE = ".";
const CLI = "docs/cli.md";
const CONFIGURATION = "docs/configuration.md";

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

/** The settings keys with an entry of their own in docs/configuration.md,
 * as its headings write them, such as `tickets.columns`. */
export function settingsEntries(configuration: string): string[] {
  return [...configuration.matchAll(/^#{3,} `([a-z.-]+)`$/gm)].map((m) => m[1]);
}

// In every settings file, so no reader looks them up.
const IN_EVERY_FILE = ["version", "repository"];

/** Whether a dotted path names a settings key, so `rules.md` is not one. */
function isSetting(path: string): boolean {
  const parts = path.split(".");
  return parts.every((part, i) =>
    SETTINGS_KEYS[parts.slice(0, i).join(".")]?.includes(part),
  );
}

/** Each line that runs the factory through `npx`. The factory is installed
 * once on a machine, so every page, skill, and message names the command
 * `factory`: no copy is left in a repository for `npx` to find, and a bare
 * `npx factory` can run another package of that name. */
export function npxLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .filter((line) => /\bnpx (--no-install )?factory\b/.test(line))
    .map((line) => line.trim());
}

/** Each settings key `text` names in backticks whose first mention is not a
 * link to its entry in docs/configuration.md. A key is named alone, by a
 * path under it, or with a value, as `builds.trigger: manual`, and its entry
 * is the longest of `entries` its path starts with. Code blocks and headings
 * are not read. */
export function unlinkedSettings(text: string, entries: string[]): string[] {
  const prose = text
    .replace(/^\s*```[\s\S]*?^\s*```/gm, "")
    .replace(/^#+ .*$/gm, "");
  const links = [...prose.matchAll(/\[([^\]]*)\]\(([^)\s]+)\)/g)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
    target: m[2],
  }));
  const seen = new Set<string>();
  const found: string[] = [];
  for (const m of prose.matchAll(/`([a-z-]+(?:\.[a-z-]+)*)(?::[^`]*)?`/g)) {
    if (!isSetting(m[1]) || IN_EVERY_FILE.includes(m[1])) continue;
    const entry = entries
      .filter((e) => m[1] === e || m[1].startsWith(`${e}.`))
      .sort((a, b) => b.length - a.length)[0];
    if (!entry || seen.has(entry)) continue;
    seen.add(entry);
    const target = `configuration.md#${entry.replaceAll(".", "")}`;
    const linked = links.some(
      (l) => l.start < m.index && m.index < l.end && l.target.endsWith(target),
    );
    if (!linked) found.push(`${m[0]} does not link to ${target}`);
  }
  return found;
}

/** A heading's anchor, as the code host makes it. An underscore inside a
 * word stays, as in FACTORY_BOARD_TOKEN, and one that marks emphasis goes. */
export function headingSlug(text: string): string {
  return text
    .replace(/[`*]|(?<![\p{L}\p{N}_])_|_(?![\p{L}\p{N}_])/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[^\p{L}\p{N}_\- ]/gu, "")
    .replaceAll(" ", "-");
}

/** The anchors a page's headings give. A heading that repeats gets `-1`,
 * then `-2`, and a line in a fenced block is no heading. */
export function anchorsOf(text: string): Set<string> {
  const anchors = new Set<string>();
  const seen = new Map<string, number>();
  let inCode = false;
  for (const line of text.split("\n")) {
    if (line.trim().startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    const heading = inCode ? null : /^#+ (.*)/.exec(line);
    if (!heading) continue;
    const slug = headingSlug(heading[1]);
    const count = seen.get(slug) ?? 0;
    anchors.add(count === 0 ? slug : `${slug}-${count}`);
    seen.set(slug, count + 1);
  }
  return anchors;
}

/** Each relative link in `text`, the text of `page`, that does not resolve:
 * to a file that `exists`, or to a heading among `anchorsFor` a page. */
export function brokenLinks(
  page: string,
  text: string,
  exists: (path: string) => boolean,
  anchorsFor: (path: string) => Set<string>,
): string[] {
  const found: string[] = [];
  for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|mailto:)/.test(target)) continue;
    const hash = target.indexOf("#");
    const path = hash < 0 ? target : target.slice(0, hash);
    const anchor = hash < 0 ? "" : target.slice(hash + 1);
    const file = path ? posix.normalize(posix.join(dirname(page), path)) : page;
    if (!exists(file)) found.push(`${page}: ${target}: no such file`);
    else if (anchor && file.endsWith(".md") && !anchorsFor(file).has(anchor))
      found.push(`${page}: ${target}: no such heading`);
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
      "| `factory doctor` | Checks | Planned |",
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
      "factory init",
      "```",
    ].join("\n");
    expect(unmarked(text, planned)).toEqual([]);
  });

  it("reads a code block by the nearest line of prose above it", () => {
    const block = (above: string) =>
      [above, "", "```bash", "factory init", "```"].join("\n");
    expect(unmarked(block("Then:"), planned)).toEqual(["factory init"]);
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

describe("npxLines", () => {
  it("finds the factory run through npx, in prose and in a code block", () => {
    const page = [
      "Run `npx --no-" + "install factory sync` in prose.",
      "```bash",
      "npx factory status",
      "factory doctor",
      "npx --no-install openspec validate",
      "```",
    ].join("\n");
    expect(npxLines(page)).toEqual([
      "Run `npx --no-" + "install factory sync` in prose.",
      "npx factory status",
    ]);
  });
});

describe("unlinkedSettings", () => {
  const entries = ["tickets", "tickets.columns", "pr-review", "rules"];

  it("finds a key named without a link to its entry", () => {
    expect(unlinkedSettings("Write `pr-review` there.", entries)).toEqual([
      "`pr-review` does not link to configuration.md#pr-review",
    ]);
  });

  it("asks for the link at the first mention only", () => {
    const linked = "[`pr-review`](../configuration.md#pr-review) turns it on.";
    expect(
      unlinkedSettings(`${linked}\n\nDelete \`pr-review\` later.`, entries),
    ).toEqual([]);
    expect(
      unlinkedSettings(`Delete \`pr-review\` later.\n\n${linked}`, entries),
    ).toHaveLength(1);
  });

  it("takes a link whose words wrap around the key", () => {
    const text =
      "See [the commands under\n`pr-review`](configuration.md#pr-review).";
    expect(unlinkedSettings(text, entries)).toEqual([]);
  });

  it("finds a link to another key's entry", () => {
    expect(
      unlinkedSettings("[`pr-review`](configuration.md#tickets)", entries),
    ).toHaveLength(1);
  });

  it("sends a path under a key to the longest entry it starts with", () => {
    const text = [
      "[`tickets.board: 7`](configuration.md#tickets) and",
      "[`tickets.columns.ready`](configuration.md#ticketscolumns).",
    ].join("\n");
    expect(unlinkedSettings(text, entries)).toEqual([]);
    expect(
      unlinkedSettings(
        "[`tickets.columns`](configuration.md#tickets)",
        entries,
      ),
    ).toHaveLength(1);
  });

  it("does not read a code block, a heading, or a name that is not a key", () => {
    const text = [
      "## Turning off `pr-review`",
      "",
      "```bash",
      "echo 'Write `pr-review` below.'",
      "```",
      "",
      "The label `spec`, and the file `rules.md`.",
    ].join("\n");
    expect(unlinkedSettings(text, entries)).toEqual([]);
  });
});

describe("headingSlug", () => {
  it("drops backticks and asterisks", () => {
    expect(headingSlug("Run `factory init` **once**")).toBe(
      "run-factory-init-once",
    );
  });

  it("keeps an underscore inside a word, and drops one that marks emphasis", () => {
    expect(headingSlug("`FACTORY_BOARD_TOKEN` _Planned_")).toBe(
      "factory_board_token-planned",
    );
  });

  it("keeps a link's words without its target", () => {
    expect(headingSlug("See [the board](workflow.md#the-board)")).toBe(
      "see-the-board",
    );
  });

  it("drops punctuation, and turns each space into a hyphen", () => {
    expect(headingSlug("1. Install: what's next?")).toBe(
      "1-install-whats-next",
    );
  });

  it("keeps a letter that is not ASCII", () => {
    expect(headingSlug("Café prices")).toBe("café-prices");
  });
});

describe("anchorsOf", () => {
  it("gives every heading's slug, at any level", () => {
    expect(anchorsOf("# One\n\ntext\n\n### Two three\n")).toEqual(
      new Set(["one", "two-three"]),
    );
  });

  it("takes no anchor from a line in a fenced block", () => {
    const text = ["# Real", "```yaml", "# a comment", "```", "## Also real"];

    expect(anchorsOf(text.join("\n"))).toEqual(new Set(["real", "also-real"]));
  });

  it("numbers a heading that repeats", () => {
    expect(anchorsOf("## Setup\n## Setup\n## Setup\n")).toEqual(
      new Set(["setup", "setup-1", "setup-2"]),
    );
  });
});

describe("brokenLinks", () => {
  const files: Record<string, string> = {
    "README.md": "# Readme\n",
    "docs/a.md": "# A\n## Part one\n",
    "docs/github/b.md": "# B\n",
    "settings.schema.json": "{}",
  };
  const broken = (page: string, text: string) =>
    brokenLinks(
      page,
      text,
      (path) => path in files,
      (path) => anchorsOf(files[path]!),
    );

  it("finds a link to a file that is not there, from the page's own folder", () => {
    expect(broken("docs/github/b.md", "[a](../a.md) and [c](c.md)")).toEqual([
      "docs/github/b.md: c.md: no such file",
    ]);
  });

  it("finds a link to a heading its page does not have", () => {
    expect(
      broken(
        "README.md",
        "[one](docs/a.md#part-one) [two](docs/a.md#part-two)",
      ),
    ).toEqual(["README.md: docs/a.md#part-two: no such heading"]);
  });

  it("reads a link that is an anchor alone against its own page", () => {
    expect(broken("docs/a.md", "[up](#a) and [down](#nowhere)")).toEqual([
      "docs/a.md: #nowhere: no such heading",
    ]);
  });

  it("skips a link to another site, and a mail address", () => {
    const text = "[x](https://example.com/a.md#b) [y](mailto:a@example.com)";

    expect(broken("README.md", text)).toEqual([]);
  });

  it("checks no anchor on a file that is not a page", () => {
    expect(broken("README.md", "[s](settings.schema.json#nowhere)")).toEqual(
      [],
    );
  });
});

describe("the docs", () => {
  const planned = plannedCommands(read(CLI));

  it("read docs/cli.md's tables, so a row marked Planned there would be found", () => {
    const text = read(CLI);
    const row = text
      .split("\n")
      .find((line) => line.startsWith("| `factory poller --once`"))!;
    const marked = text.replace(
      row,
      row.replace(/Built(\s*)\|$/, "Planned$1|"),
    );

    expect(plannedCommands(marked)).toEqual(
      expect.arrayContaining(["factory poller --once"]),
    );
  });

  it("say how the workflows install a private npm package, and no longer mark it Planned", () => {
    expect(anchorsOf(read("docs/github/setup.md"))).toContain(
      "private-npm-packages",
    );
    for (const page of ["docs/presets.md", "docs/limitations.md"]) {
      const lines = read(page).split("\n");
      const near = lines.filter(
        (l, i) =>
          /Planned/.test(l) &&
          lines
            .slice(Math.max(0, i - 3), i + 4)
            .some((x) => /private/i.test(x)),
      );
      expect(near, page).toEqual([]);
    }
  });

  it("mark every use of a planned command", () => {
    const found = pages().flatMap((page) =>
      unmarked(read(page), planned, page === CLI).map(
        (line) => `${page}: ${line}`,
      ),
    );
    expect(found).toEqual([]);
  });

  it("give every settings key but the two in every file an entry", () => {
    expect(settingsEntries(read(CONFIGURATION))).toEqual(
      expect.arrayContaining(
        SETTINGS_KEYS[""].filter((key) => !IN_EVERY_FILE.includes(key)),
      ),
    );
  });

  it("link a settings key to its entry where a page first names it", () => {
    const entries = settingsEntries(read(CONFIGURATION));
    const found = pages()
      .filter((page) => page !== CONFIGURATION)
      .flatMap((page) =>
        unlinkedSettings(read(page), entries).map((line) => `${page}: ${line}`),
      );
    expect(found).toEqual([]);
  });

  it("list each look of the printer's table, in its order, and what it is drawn as", () => {
    const text = readFileSync("docs/developing.md", "utf8");
    const rows = [
      ...text.matchAll(/^ {2}\| `(\w+)` +\| ([A-Z][a-z ]+?) +\|/gm),
    ].map((m) => [m[1], m[2]!.toLowerCase().split(" ")]);
    const drawn = { underline: "underlined" } as Record<string, string>;
    expect(rows).toEqual(
      Object.entries(LOOKS).map(([role, codes]) => [
        role,
        codes.map((c) => drawn[c] ?? c),
      ]),
    );
  });

  it("name the command factory, never through npx", () => {
    const found = pages().flatMap((page) =>
      npxLines(read(page)).map((line) => `${page}: ${line}`),
    );
    expect(found).toEqual([]);
  });

  it("link only to files and headings that are there", () => {
    const exists = (path: string) => existsSync(join(PACKAGE, path));
    const found = pages().flatMap((page) =>
      brokenLinks(page, read(page), exists, (path) => anchorsOf(read(path))),
    );
    expect(found).toEqual([]);
  });

  it("list pr uncovered under Pull requests, with what it prints and both defaults", () => {
    const section = read(CLI)
      .split(/^### /m)
      .find((part) => part.startsWith("Pull requests"));
    const row = section
      ?.split("\n")
      .find((line) =>
        line.startsWith("| `factory pr uncovered [BASE] [LCOV]`"),
      );

    for (const said of [
      "`MISS`",
      "`PART`",
      "default branch",
      "`coverage/lcov.info`",
    ])
      expect(row).toContain(said);
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

  it("ship the workflows a session runs in, which read either credential init can store", () => {
    const written = load(
      factoryWorkflow({
        version: "1.0.0",
        branch: "main",
        parts: ["review"],
        pollMinutes: null,
        ref: (key) => key,
        minutes: { ...SESSION_MINUTES },
        overrideLabel: "verdict-override",
        policyLabel: "policy-override",
        secrets: [],
      }),
    ) as { jobs: { factory: { secrets: Record<string, string> } } };
    expect(written.jobs.factory.secrets).toMatchObject({
      "claude-token": "${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}",
      "claude-api-key": "${{ secrets.ANTHROPIC_API_KEY }}",
    });
    for (const file of ["run.yml", "session.yml"]) {
      const text = read(`.github/workflows/${file}`);
      expect(text, file).toContain("secrets.claude-token");
      expect(text, file).toContain("secrets.claude-api-key");
    }
  });

  it("carry no banner saying the pages are not built", () => {
    const found = pages().filter((page) =>
      read(page).includes("Not built yet"),
    );
    expect(found).toEqual([]);
  });
});

/** The part of a page under `heading`, written as its line is, up to the
 * next heading at its level or above. A line in a fenced block is no
 * heading. Empty when the page has no such heading. */
function sectionOf(text: string, heading: string): string {
  const level = /^#+/.exec(heading)![0].length;
  const kept: string[] = [];
  let inCode = false;
  let inside = false;
  for (const line of text.split("\n")) {
    if (line.trim().startsWith("```")) inCode = !inCode;
    const at = inCode ? null : /^(#+) /.exec(line);
    if (at && inside && at[1].length <= level) break;
    if (inside) kept.push(line);
    if (at && line === heading) inside = true;
  }
  return kept.join("\n");
}

/** Text with each run of white space made one space, so a phrase is found
 * across the end of a line. */
const flat = (text: string) => text.replace(/\s+/g, " ");

/** The cells of each table row in `text`. */
const rows = (text: string) =>
  text
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );

describe("the docs on label names", () => {
  it("name no pull request label by its old name", () => {
    const old = /merge: automatic|merge: manual|verdict: override/;
    const found = pages().filter((page) => old.test(read(page)));
    expect(found).toEqual([]);
  });

  it("give tickets.labels and code-host.labels an entry each", () => {
    expect([...anchorsOf(read("docs/configuration.md"))]).toEqual(
      expect.arrayContaining(["ticketslabels", "code-hostlabels"]),
    );
  });
});

describe("the shortest file in docs/configuration.md", () => {
  it("shows every required setting, a board's among them", () => {
    const text = read("docs/configuration.md");
    const shortest = text.slice(
      text.indexOf("## The shortest file"),
      text.indexOf("## The settings most repositories change"),
    );
    for (const key of [
      "version: 2",
      "repository:",
      'branch-name: "{ticket}"',
      "gate:",
      "board:",
      "backlog:",
      "refining:",
      "ready:",
      "building:",
      "review:",
      "done:",
    ])
      expect(shortest).toContain(key);
  });
});

// What the docs say about settings version 2: its commands, its spec check,
// its plugins by phase, and the commands that came with it.
describe("the docs, for settings version 2", () => {
  const configuration = read(CONFIGURATION);
  const entries = settingsEntries(configuration);
  const plugins = read("docs/plugins.md");
  const updating = read("docs/updating.md");
  const MOVING = "Moving to settings version 2";

  it.each(SETTINGS_KEYS.commands)(
    "give commands.%s an entry in docs/configuration.md",
    (key) => {
      expect(entries).toContain(`commands.${key}`);
    },
  );

  it("give specs.check an entry in docs/configuration.md that states its default", () => {
    const entry = sectionOf(configuration, "#### `specs.check`");

    expect(entry).toContain("**Default:**");
    expect(entry).toContain(BUILT.specs.openspec!);
  });

  it.each(PHASES)(
    "give the plugins of the %s phase an entry in docs/configuration.md",
    (phase) => {
      expect(entries).toContain(`plugins.${phase}`);
    },
  );

  it.each(ROLES)(
    "say in docs/configuration.md what the %s role takes, one or a list, with files or labels, and what is used when it is left out",
    (role) => {
      const shape = ROLE_SHAPE[role];
      const row = rows(sectionOf(configuration, "### `plugins`")).find(
        ([key]) => key === `\`${shape.phase}.${shape.key}\``,
      );

      expect(row).toBeDefined();
      const [, takes, count, filter, leftOut] = row!;
      expect(takes.toLowerCase()).toContain(shape.kind);
      expect(/list/i.test(count)).toBe(shape.list);
      expect(filter.includes("`files`")).toBe(shape.files !== "none");
      expect(filter.includes("`labels`")).toBe(shape.labels !== "none");
      expect(leftOut).not.toBe("");
    },
  );

  it("show whole settings files in docs/configuration.md that are version 2", () => {
    const whole = [...configuration.matchAll(/^```yaml\n([\s\S]*?)^```/gm)]
      .map((m) => m[1])
      .filter((file) => /^repository:/m.test(file));

    expect(whole.length).toBeGreaterThanOrEqual(4);
    for (const file of whole)
      expect(parseSettings(load(file), () => true).version).toBe(2);
  });

  it.each(ROLES)(
    "give the %s role a table in docs/plugins.md of when it is called, what it is handed, what it returns, and what happens next",
    (role) => {
      const steps = rows(sectionOf(plugins, `### \`${role}\``)).map(
        ([step]) => step,
      );

      expect(steps).toEqual(
        expect.arrayContaining([
          "**Called**",
          "**Handed**",
          "**Returns**",
          "**Then**",
        ]),
      );
    },
  );

  it.each([
    ["refiner", "What a refiner must deliver"],
    ["refiner", '"Refining: this repository" in `CLAUDE.md`'],
    ["prover", "What a prover must report"],
    ["test-reviewer", "is the whole list"],
    ["resolver", "from your default branch's copy"],
    ["builder", "Reviewers still run after a builder"],
  ])("say in docs/plugins.md, under the %s role: %s", (role, said) => {
    expect(flat(sectionOf(plugins, `### \`${role}\``))).toContain(said);
  });

  it("have the section the refusal of a version 1 file names, in the page it names", () => {
    let refusal = "";
    try {
      parseSettings({ version: 1, repository: "o/r" }, () => true);
    } catch (e) {
      refusal = (e as Error).message;
    }
    const [, heading, page] = /see "([^"]+)" in (docs\/\S+\.md)$/.exec(
      refusal,
    )!;

    expect([page, heading]).toEqual(["docs/updating.md", MOVING]);
    expect(read(page).split("\n")).toContain(`## ${heading}`);
  });

  it.each([
    ["`version: 1`", "`version: 2`"],
    ["`before-commit`", "`commands.before-commit`"],
    ["`build-setup`", "`commands.build-setup`"],
    ["`plugins`", "grouped by phase"],
    ["`specs`", "`check`"],
  ])(
    "show in docs/updating.md, under moving to version 2, %s before and %s after",
    (before, after) => {
      const table = rows(sectionOf(updating, `## ${MOVING}`));

      expect(table[0]).toEqual(["Version 1", "Version 2"]);
      expect(
        table.filter(([was, is]) => was.includes(before) && is.includes(after)),
      ).toHaveLength(1);
    },
  );

  it.each([
    "factory gate",
    "factory test-one",
    "factory end-to-end",
    "factory specs check",
    "factory default-branch",
    "factory preset add",
    "factory preset remove",
    "factory preset choices",
    "factory preset choose",
    "factory preset check",
    "factory preset changes",
  ])("give %s a row in docs/cli.md", (command) => {
    const named = read(CLI)
      .split("\n")
      .filter(
        (line) =>
          line.startsWith(`| \`${command}\``) ||
          line.startsWith(`| \`${command} `),
      );

    expect(named).toHaveLength(1);
  });

  it("name --check in docs/cli.md's row for factory ticket refined", () => {
    const row = read(CLI)
      .split("\n")
      .find((line) => line.startsWith("| `factory ticket refined N`"));

    expect(row).toContain("`--check`");
  });

  it("list no factory migrate under What is built in docs/developing.md", () => {
    const built = sectionOf(read("docs/developing.md"), "## What is built");

    expect(built).toContain("| Part ");
    expect(built).not.toContain("factory migrate");
  });

  const ORDER = "The order of the workflow is fixed";
  it.each([
    [
      "docs/design.md's section on the fixed order",
      () => flat(sectionOf(read("docs/design.md"), `## ${ORDER}`)),
    ],
    [
      "docs/limitations.md's line on the fixed order",
      () => {
        const lines = read("docs/limitations.md").split("\n");
        const at = lines.findIndex((l) => l.startsWith(`- **${ORDER}.**`));
        return flat(paragraphs(lines)[at] ?? "");
      },
    ],
  ])(
    "say in %s which steps a plugin can replace, and that the states and their order cannot change",
    (_, text) => {
      const said = text();

      for (const step of ["refined", "built", "proved", "conflict"])
        expect(said).toMatch(new RegExp(`plugin.* ${step}\\b`));
      expect(said).toContain("six states");
      expect(said).toMatch(/cannot (reorder|change)/);
    },
  );

  it("do not say in docs/limitations.md that a build assumes main", () => {
    expect(flat(read("docs/limitations.md"))).not.toMatch(
      /\bassum\w*\b[^.]*\bmain\b/i,
    );
  });

  it("tell a new user in docs/quick-start.md to set commands.gate before the first build", () => {
    const page = read("docs/quick-start.md");
    const gate = page.indexOf(
      "[`commands.gate`](configuration.md#commandsgate)",
    );
    const build = page.search(/^## \d+\. Build it$/m);

    expect(gate).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(gate);
  });
});

describe("the docs on spec tools", () => {
  /** A section with its line breaks read as spaces, so a re-wrap of the
   * prose changes nothing. */
  const flat = (page: string, heading: string) =>
    sectionOf(read(page), heading).replace(/\s+/g, " ");

  it("list the four spec commands on the CLI page, and not change-name", () => {
    const cli = flat("docs/cli.md", "### Your repository's commands");
    for (const command of ["list", "new N", "check", "finish N"])
      expect(cli).toContain(`| \`factory specs ${command}\``);
    expect(cli).toContain(
      "`- No spec tool (specs: none): each ticket holds its own spec.`",
    );
    expect(read("docs/cli.md")).not.toContain("change-name");
  });

  it("say on the configuration page that init asks, and installs OpenSpec", () => {
    const specs = flat(CONFIGURATION, "### `specs`");
    expect(specs).toContain('"Which spec tool do you use?"');
    expect(specs).toContain("`npm install --save-dev @fission-ai/openspec`");
    expect(specs).toContain("specs: none");
  });

  it("give every visible change a Spec, a design, and tasks, whatever the tool", () => {
    const workflow = flat(
      "docs/workflow.md",
      "## A change your users will see",
    );
    for (const part of ["- **Spec:**", "- **Design:**", "- **Tasks:**"])
      expect(workflow).toContain(part);
    expect(workflow).not.toContain("acceptance criteria are the whole spec");
  });

  it("say on the setup page what to answer init's spec tool question, and when it is skipped", () => {
    const setup = sectionOf(
      read("docs/github/setup.md"),
      "## Run `factory init`",
    );
    const row = rows(setup).find(
      ([question]) => question === "Which spec tool you use",
    );
    expect(row?.[2]).toContain("Choose None");
    expect(row?.[2]).toContain("[`specs`](../configuration.md#specs)");
    expect(setup.replace(/\s+/g, " ")).toContain(
      "skips any that a preset or your settings already answer",
    );
  });

  it("say what another spec tool takes, and how the glossary reads Spec", () => {
    const developing = read("docs/developing.md");
    expect(developing).toContain("## Adding a spec tool");
    expect(developing).toMatch(
      /\| Another spec tool, such as Spec Kit +\| Not planned\. An adapter under `src\/specs\/` adds one/,
    );
    expect(read("docs/glossary.md").replace(/\s+/g, " ")).toContain(
      'gets a Spec section of "When this, then that" lines in its ticket',
    );
  });
});

describe("the docs on an organization's branch names", () => {
  const flatly = (page: string, heading: string) =>
    flat(sectionOf(read(page), heading));

  it("say that init --org asks for the pattern, where it is kept, and that a repository's setup does not ask", () => {
    const setup = flatly(
      "docs/github/setup.md",
      "## Set an organization up, once",
    );
    expect(setup).toContain(
      "The answer goes in the preset, as [`code-host.branch-name`](../configuration.md#code-host), so a developer setting up a repository is not asked.",
    );
    expect(setup).toContain(
      "Under [`code-host`](../configuration.md#code-host) it holds the pattern builds name their branches by.",
    );
    expect(flatly("docs/configuration.md", "### `code-host`")).toContain(
      "in an organization `factory init --org` asks for it once and writes it in the preset.",
    );
  });

  it("say what an organization set up earlier adds to its preset, and that a repository's own pattern wins", () => {
    const updating = flatly("docs/updating.md", "## Naming build branches");
    expect(updating).toContain(
      "add the lines above to `factory-preset.yaml` in your `factory-config`",
    );
    expect(updating).toContain(
      "A repository that has its own `branch-name` keeps it",
    );
  });
});

describe("the docs on the factory's own approval policy", () => {
  const flatly = (page: string, heading: string) =>
    flat(sectionOf(read(page), heading));

  it("name the example of a script and an agent together raw-sql, so copying it can't replace credentials", () => {
    const agent = sectionOf(
      read("docs/approval-policies.md"),
      "## Checking with an agent",
    );
    expect(agent).toContain("  - name: raw-sql\n");
    expect(agent).not.toContain("name: credentials");
  });

  it("say in the settings that the factory adds credentials, which off: true turns off", () => {
    expect(
      flatly("docs/configuration.md", "### `approval-policies`"),
    ).toContain(
      "The factory adds one policy of its own, `credentials` ([The factory's own policy](approval-policies.md#the-factorys-own-policy)), which `off: true` turns off.",
    );
  });

  it("say what factory-refine writes for a ticket that names a new credential", () => {
    expect(flatly("docs/skills.md", "## `factory-refine`")).toContain(
      "`missing: ## Threats, since the ticket names a credential this repository does not have: DEPLOY_TOKEN`",
    );
  });

  it("give the rule's measured counts", () => {
    expect(flatly("docs/approval-policies.md", "### What it reads")).toContain(
      "In two repositories that use the factory, it picked 31 of 259 merged changes, about 1 in 8.",
    );
  });
});

describe("the docs on run.yml's groups", () => {
  const workflow = (file: string) =>
    load(read(`.github/workflows/${file}`)) as {
      jobs: Record<string, { name: string; uses?: string }>;
    };
  const run = workflow("run.yml");
  /** The reference page's table of groups, by its first cell. */
  const table = Object.fromEntries(
    rows(sectionOf(read("docs/github/reference.md"), "### The jobs"))
      .filter(([group]) => group === "None" || group?.startsWith("`"))
      .map(([group, jobs]) => [group!.replaceAll("`", ""), flat(jobs!)]),
  );

  it("name each job of a group in its row, by the name its row in the checks shows", () => {
    const called = Object.values(run.jobs).filter((job) =>
      job.uses?.startsWith("./.github/workflows/run-"),
    );
    expect(Object.keys(table)).toEqual([
      "None",
      ...called.map((job) => job.name),
    ]);
    for (const call of called)
      for (const job of Object.values(
        workflow(call.uses!.slice("./.github/workflows/".length)).jobs,
      ))
        expect(table[call.name], call.name).toContain(job.name);
    for (const job of Object.values(run.jobs).filter(
      (j) => !called.includes(j),
    ))
      expect(table.None).toContain(job.name);
  });
});

describe("the pages the commands print", () => {
  it.each(Object.entries(DOCS_PAGES))(
    "has the page and the heading %s names",
    (_, address) => {
      const [page, anchor] = address.split("#") as [string, string?];
      expect(existsSync(join(PACKAGE, "docs", page))).toBe(true);
      if (anchor)
        expect([...anchorsOf(read(`docs/${page}`))]).toContain(anchor);
    },
  );
});
