// The boundaries the three interfaces rest on. No skill, agent, rule, or
// workflow in the package talks to GitHub's issues or projects itself: it
// runs a `factory ticket` or `factory pr` command, and no skill, agent, or
// rule names GitHub's CLI at all. No file under src/ but
// the three folders that hold an interface and its implementations
// (`src/tickets/`, `src/code-host/`, `src/runner/`) calls GitHub or holds
// its address, and no file outside the last two but the poller names a
// GitHub implementation of them. The two newer interfaces declare no name
// in GitHub's API's style.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { hostWordsIn } from "./host-names.mts";

const PACKAGE = ".";

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

/** A shell command with its backslash continuations joined. */
function joinContinuations(text: string): string {
  return text.replace(/\\\r?\n\s*/g, " ");
}

/** Each place a skill, agent, rule, or workflow reaches a ticket system
 * around the commands: `gh issue`, `gh project`, a `gh api` call to an
 * issues or projects path, or another ticket system's host. */
export function ticketCallsIn(text: string): string[] {
  const found: string[] = [];
  for (const line of joinContinuations(text).split("\n")) {
    if (/\bgh issue\b/.test(line)) found.push(line.trim());
    else if (/\bgh project\b/.test(line)) found.push(line.trim());
    else if (/\batlassian\.net\b|\bapi\.linear\.app\b/.test(line))
      found.push(line.trim());
    else
      for (const m of line.matchAll(/\bgh api\b(.*)/g))
        if (/\/(issues|projects)\b/.test(m[1])) found.push(line.trim());
  }
  return found;
}

/** Each line that writes a ticket the way only GitHub does: a `Closes #`
 * or `Part of #` link, or "GitHub issue", where the factory's commands give
 * the ticket system's own words. */
export function githubTicketWordsIn(text: string): string[] {
  return text
    .split("\n")
    .filter((line) => /\b(?:closes|part of) #|\bgithub issues?\b/i.test(line))
    .map((line) => line.trim());
}

/** Each place a skill, agent, rule, or workflow runs a spec tool itself
 * rather than through `factory specs`: OpenSpec's command, run with npx or
 * on its own with a subcommand. A path such as `openspec/specs/` is not a
 * run. */
export function specToolCallsIn(text: string): string[] {
  return joinContinuations(text)
    .split("\n")
    .filter(
      (line) =>
        /\bnpx\b[^\n]*\bopenspec\b/.test(line) ||
        /(^\s*|[`$(;&|]\s*)openspec\s+[a-z-]+/.test(line),
    )
    .map((line) => line.trim());
}

/** Each line that names GitHub's CLI, as a command or in a sentence, or
 * GitHub's own name for whether a pull request can merge. */
export function hostToolIn(text: string): string[] {
  return text
    .split("\n")
    .filter((line) => /\bgh\b|\bmergeable_state\b/.test(line))
    .map((line) => line.trim());
}

/** Each line that prints, colors, or asks a question around
 * `src/lib/output.mts` and `src/lib/prompts.mts`. An escape code read, to
 * take it out of a text, prints nothing. */
export function printsIn(text: string): string[] {
  return text
    .split("\n")
    .filter((line) => !/^\s*(?:\/\/|\/?\*)/.test(line))
    .filter(
      (line) =>
        /\bconsole\.\w+\(/.test(line) ||
        /\bprocess\.(?:stdout|stderr)\.write\b/.test(line) ||
        /\bstyleText\b/.test(line) ||
        /@inquirer\//.test(line) ||
        (/\\(?:u001b|x1b|033)/i.test(line) &&
          !/^const ESCAPES = \//.test(line)),
    )
    .map((line) => line.trim());
}

/** Each place a source file calls GitHub itself: its API's address, a REST
 * path, or a GraphQL query or mutation. */
export function githubCallsIn(text: string): string[] {
  const found: string[] = [];
  text.split("\n").forEach((line) => {
    // A comment describes a call; it makes none.
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    if (
      /api\.github\.com/.test(line) ||
      /["'`]repos\//.test(line) ||
      /["'`]\s*(query|mutation)\b\s*\w*\s*[({]/.test(line) ||
      /^\s*(query|mutation)\b\s*\w*\s*[({]/.test(line) ||
      /\.graphql\s*(<[^>]*>)?\s*\(/.test(line)
    )
      found.push(line.trim());
  });
  return found;
}

/** Each line of a source file that holds a github.com address, comments
 * aside. */
export function githubAddressesIn(text: string): string[] {
  return text
    .split("\n")
    .filter(
      (line) => !/^\s*(\/\/|\*|\/\*)/.test(line) && /github\.com/.test(line),
    )
    .map((line) => line.trim());
}

/** Each line that imports a GitHub implementation of the code host or the
 * runner, whatever extension the path is written with. */
export function implementationImportsIn(text: string): string[] {
  return text
    .split("\n")
    .filter((line) =>
      /(code-host\/github|runner\/github-actions)(\.\w+)?["']/.test(line),
    )
    .map((line) => line.trim());
}

/** Each name with an underscore that a file of types declares: a type's,
 * a field's, an operation's, or a parameter's. Text in quotes is a value,
 * not a name, unless a colon follows it: then it is a field's name. */
export function underscoredNamesIn(text: string): string[] {
  const found: string[] = [];
  for (const line of text.split("\n")) {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    const code = line
      .replace(/["'](\w+)["'](?=\??\s*:)/g, "$1")
      .replace(/"[^"]*"|'[^']*'|`[^`]*`/g, "");
    for (const m of code.matchAll(
      /\b(?:type|interface)\s+(\w+)|\b(\w+)\??\s*(?:<[^>]*>\s*)?[:(]/g,
    )) {
      const name = m[1] ?? m[2];
      if (name.includes("_")) found.push(name);
    }
  }
  return found;
}

/** Each command line that runs `factory` after a `cd` in the same command:
 * from another directory it runs for whatever repository that directory is
 * in, at the version that repository names, or for none. */
export function factoryAfterCdIn(text: string): string[] {
  return joinContinuations(text)
    .split("\n")
    .filter((line) => /\bcd\b[^\n]*[;&]\s*factory\b/.test(line))
    .map((line) => line.trim());
}

/** The factory's own workflows, which the two files `factory sync` writes
 * into a repository call, and the one an organization's poller file calls. */
const WORKFLOWS = ["run.yml", "review.yml", "session.yml", "poller.yml"].map(
  (file) => join(PACKAGE, ".github/workflows", file),
);

const instructionFiles = () => [
  ...["skills", "agents"].flatMap((d) => filesUnder(join(PACKAGE, d))),
  ...WORKFLOWS,
  join(PACKAGE, "rules.md"),
  join(PACKAGE, "review.md"),
];

const guidesWithNoHost = () => [
  ...["skills", "agents"].flatMap((d) => filesUnder(join(PACKAGE, d))),
  join(PACKAGE, "rules.md"),
  join(PACKAGE, "review.md"),
];

/** The guides every repository gets: each skill, agent, the rules, and the
 * review instructions, by its path from the package's root. */
const guideFiles = () =>
  [
    ...["skills", "agents"]
      .flatMap((d) => filesUnder(join(PACKAGE, d)))
      .filter((path) => path.endsWith(".md")),
    join(PACKAGE, "rules.md"),
    join(PACKAGE, "review.md"),
  ].map((path) => relative(PACKAGE, path));

/** The source files outside the folders named, with each one's path from
 * src/. */
const sourceFilesOutside = (folders: string[]) =>
  filesUnder(join(PACKAGE, "src"))
    .map((path) => ({ path, rel: relative(join(PACKAGE, "src"), path) }))
    .filter(({ rel }) => !folders.some((folder) => rel.startsWith(folder)));

const INTERFACE_FOLDERS = ["tickets/", "code-host/", "runner/"];

describe("githubTicketWordsIn", () => {
  it("finds a GitHub link line and the words GitHub issue", () => {
    expect(
      githubTicketWordsIn("Start the body with `Closes #N`."),
    ).toHaveLength(1);
    expect(githubTicketWordsIn("It starts with Part of #4.")).toHaveLength(1);
    expect(
      githubTicketWordsIn("Turn a GitHub issue into a spec."),
    ).toHaveLength(1);
  });

  it("lets through the factory's command for the link and a pull request's number", () => {
    expect(
      githubTicketWordsIn(
        "Start the body with the line `factory ticket link N` prints. Each `(#N)` names a pull request.",
      ),
    ).toEqual([]);
  });
});

describe("ticketCallsIn", () => {
  it("finds gh issue, gh project, and gh api calls to issues and projects paths", () => {
    expect(ticketCallsIn("Run `gh issue view 1` first.")).toHaveLength(1);
    expect(ticketCallsIn("gh project item-list 1")).toHaveLength(1);
    expect(
      ticketCallsIn("gh api repos/REPO/issues/N/comments --jq .body"),
    ).toHaveLength(1);
    expect(
      ticketCallsIn("gh api -X POST \\\n  repos/REPO/issues/N"),
    ).toHaveLength(1);
    expect(ticketCallsIn("gh api users/me/projects/1")).toHaveLength(1);
  });

  it("finds a direct call to another ticket system's host", () => {
    expect(
      ticketCallsIn(
        'curl -u "$JIRA" https://acme.atlassian.net/rest/api/3/issue/PROJ-12',
      ),
    ).toHaveLength(1);
    expect(
      ticketCallsIn("curl -X POST https://api.linear.app/graphql"),
    ).toHaveLength(1);
  });

  it("lets through the factory's commands and gh api calls to other paths", () => {
    expect(ticketCallsIn("factory ticket view N")).toEqual([]);
    expect(ticketCallsIn("gh api repos/REPO/pulls/N/files")).toEqual([]);
    expect(ticketCallsIn("See the issues list on GitHub.")).toEqual([]);
  });
});

describe("specToolCallsIn", () => {
  it("finds OpenSpec run with npx, with its environment, and on its own", () => {
    expect(
      specToolCallsIn("DO_NOT_TRACK=1 npx --no-install openspec list --specs"),
    ).toHaveLength(1);
    expect(specToolCallsIn("npx openspec archive NAME --yes")).toHaveLength(1);
    expect(
      specToolCallsIn("Run `openspec validate --all` first."),
    ).toHaveLength(1);
    expect(
      specToolCallsIn("      run: |\n        openspec new change x"),
    ).toHaveLength(1);
  });

  it("lets through the factory's commands, OpenSpec's folders, and its name", () => {
    expect(specToolCallsIn("factory specs new N")).toEqual([]);
    expect(specToolCallsIn("a line of `openspec/specs/` false")).toEqual([]);
    expect(specToolCallsIn("when `openspec/config.yaml` changed")).toEqual([]);
    expect(specToolCallsIn("With OpenSpec, the build folds it in.")).toEqual(
      [],
    );
    expect(specToolCallsIn("Each build writes an openspec change.")).toEqual(
      [],
    );
  });
});

describe("hostToolIn", () => {
  it("finds GitHub's CLI as a command, inside a longer one, and in a sentence", () => {
    expect(hostToolIn("gh pr view 12 --json body")).toHaveLength(1);
    expect(
      hostToolIn("   SHA=$(gh api repos/o/r/pulls/1 --jq .head.sha)"),
    ).toHaveLength(1);
    expect(hostToolIn("Every `gh` command here is REST.")).toHaveLength(1);
    expect(hostToolIn("Read its `mergeable_state` first.")).toHaveLength(1);
  });

  it("lets through the factory's commands and words that only hold the letters", () => {
    expect(hostToolIn("factory pr view 12 --field head")).toEqual([]);
    expect(hostToolIn("A high bar, though.")).toEqual([]);
    expect(hostToolIn("whether it can merge is `dirty`")).toEqual([]);
  });
});

describe("factoryAfterCdIn", () => {
  it("finds a factory command run after a cd, and lets one from the root through", () => {
    expect(
      factoryAfterCdIn(
        'cd "$dir" && factory ticket comment N \\\n  --body-file body.md',
      ),
    ).toHaveLength(1);
    expect(
      factoryAfterCdIn('factory ticket comment N --body-file "$dir/body.md"'),
    ).toEqual([]);
  });
});

describe("printsIn", () => {
  it("finds a console call, a stream's write, Node's colors, an escape code, and the prompt library", () => {
    const lines = [
      "console.log(line);",
      'console.error("no");',
      "process.stdout.write(text);",
      "out: process.stderr.write,",
      'import { styleText } from "node:util";',
      'const RED = "\\u001b[31m";',
      'const { confirm } = await import("@inquirer/prompts");',
    ];
    expect(printsIn(lines.join("\n"))).toEqual(lines);
  });

  it("lets through the printer, a comment, a hushed console, and a code taken out", () => {
    expect(
      printsIn(
        [
          "d.out(say.text(line));",
          "// console.log(line) would lose the color",
          "console.error = () => {};",
          "const ESCAPES = /\\u001b\\[[0-9;?]*[ -/]*[@-~]/g;",
        ].join("\n"),
      ),
    ).toEqual([]);
  });
});

describe("githubCallsIn", () => {
  it("finds GitHub's address, a REST path, and a GraphQL query or mutation", () => {
    expect(githubCallsIn('fetch("https://api.github.com/x")')).toHaveLength(1);
    expect(githubCallsIn("run(`repos/${repo}/issues`)")).toHaveLength(1);
    expect(githubCallsIn("const Q = `query Board($n: Int!) {`;")).toHaveLength(
      1,
    );
    expect(githubCallsIn('  "mutation SetText($id: ID!) {",')).toHaveLength(1);
    expect(githubCallsIn("query Tickets($owner: String!) {")).toHaveLength(1);
    expect(githubCallsIn("await t.graphql<Page>(Q, {})")).toHaveLength(1);
  });

  it("lets through prose that mentions a query", () => {
    expect(githubCallsIn("// the query the sync reads")).toEqual([]);
    expect(githubCallsIn("const repos = 3;")).toEqual([]);
    expect(githubCallsIn("// reads `repos/OWNER/REPO/issues`")).toEqual([]);
  });
});

describe("githubAddressesIn", () => {
  it("finds an address in code, and lets a comment that holds one through", () => {
    expect(
      githubAddressesIn("const u = `https://github.com/${repo}/pull/1`;"),
    ).toHaveLength(1);
    expect(githubAddressesIn('fetch("https://api.github.com/x")')).toHaveLength(
      1,
    );
    expect(githubAddressesIn("// see https://github.com/o/r")).toEqual([]);
    expect(githubAddressesIn(" * as on https://github.com/o/r")).toEqual([]);
    expect(githubAddressesIn('const host = "GitHub";')).toEqual([]);
  });
});

describe("implementationImportsIn", () => {
  it("finds an import of either GitHub implementation, and lets the interfaces through", () => {
    expect(
      implementationImportsIn(
        'import {\n  githubCodeHost,\n} from "./code-host/github.mts";',
      ),
    ).toHaveLength(1);
    expect(
      implementationImportsIn(
        'import { githubActionsRunner } from "../runner/github-actions.mts";',
      ),
    ).toHaveLength(1);
    expect(
      implementationImportsIn('await import("./runner/github-actions.js");'),
    ).toHaveLength(1);
    expect(
      implementationImportsIn('import { x } from "./code-host/github";'),
    ).toHaveLength(1);
    expect(
      implementationImportsIn(
        'import { openCodeHost } from "./code-host/index.mts";\nimport type { Runner } from "./runner/types.mts";\nimport { githubTickets } from "./tickets/github.mts";',
      ),
    ).toEqual([]);
  });
});

describe("underscoredNamesIn", () => {
  it("finds a type, a field, an operation, and a parameter named with an underscore", () => {
    expect(
      underscoredNamesIn(
        [
          "export type Check_Run = {",
          "  html_url?: string;",
          "  head: { head_sha: string };",
          "  for_commit(sha: string): Promise<number[]>;",
          "  files(pull_number: number): Promise<string[]>;",
          '  "node_id": string;',
          "  list_of<T>(path: string): Promise<T[]>;",
          "};",
        ].join("\n"),
      ),
    ).toEqual([
      "Check_Run",
      "html_url",
      "head_sha",
      "for_commit",
      "pull_number",
      "node_id",
      "list_of",
    ]);
  });

  it("lets through a value in quotes and a comment", () => {
    expect(
      underscoredNamesIn(
        [
          '  conclusion: "timed_out" | "success";',
          "  /** GitHub calls this `html_url`. */",
          "  // head_sha: string",
          "  checksId: number;",
        ].join("\n"),
      ),
    ).toEqual([]);
  });
});

/** Each line that names a file, script, or word of the repository the
 * factory is developed in, which a skill for any website must not. */
export function hostNamesIn(text: string): string[] {
  return text
    .split("\n")
    .filter((line) =>
      /src\/app\/|scripts\/|AGENTS\.md|mock-check|screenshot\.sh|design-change|\binstructor\b|\bcheckride\b/.test(
        line,
      ),
    )
    .map((line) => line.trim());
}

describe("hostNamesIn", () => {
  it.each([
    "Read `src/app/CLAUDE.md` first.",
    "Run `node scripts/mock-check.mts` on it.",
    "The audience is in AGENTS.md.",
    "A page about the instructor.",
    "Shoot it with `screenshot.sh`.",
    "As `design-change` did.",
    "Practice for a checkride.",
  ])("finds %j", (line) => {
    expect(hostNamesIn(line)).toHaveLength(1);
  });

  it("lets through what any site has", () => {
    expect(
      hostNamesIn("Read the design guide, then `factory site compare`."),
    ).toEqual([]);
  });
});

/** The words of one stack and one layout. A file every repository gets
 * holds none of them: it reads a command from the settings and a rule from
 * the repository's own guides. */
const STACK_WORDS = [
  "AGENTS.md",
  "next dev",
  "Next.js",
  "vitest",
  "Vitest",
  "Tailwind",
  "React",
  ".tsx",
  ".ts sibling",
  "python",
  "Codecov",
  "visitor",
  "origin/main",
  "After every code change",
  "Playwright",
  "package-lock.json",
  "npm ci",
  "npm install",
];

/** The files written only for a website or an end-to-end suite, which may
 * name Playwright and say "visitor", since a website has visitors. */
const WEBSITE_FILES = [
  "agents/factory-ui-reviewer.md",
  "agents/factory-e2e-reviewer.md",
  "skills/factory-design/",
];

/** The words a file may hold all the same. The factory's own update is an
 * npm package's, so the skill that makes it names npm's files and commands. */
function allowedStackWords(file: string): string[] {
  if (WEBSITE_FILES.some((f) => file.startsWith(f)))
    return ["Playwright", "visitor"];
  if (file.startsWith("skills/factory-deps/"))
    return ["package-lock.json", "npm ci", "npm install"];
  return [];
}

/** A word as a pattern that matches it whole, so `React` does not match
 * "reaction": a phrase's spaces match a line break too, and "visitor"
 * matches its plural. */
function wholeWord(word: string): RegExp {
  const body = word
    .split(" ")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"))
    .join("\\s+");
  return new RegExp(
    (/^\w/.test(word) ? "(?<![A-Za-z0-9])" : "") +
      body +
      (word === "visitor" ? "s?" : "") +
      (/\w$/.test(word) ? "(?![A-Za-z0-9])" : ""),
    "g",
  );
}

/** Each stack word a file holds, with its line, as `WORD (line N)`.
 * Backticks are read through, so a `.ts` sibling is found, and a sentence
 * that starts "If the repository reports to Codecov" may name Codecov. */
export function stackWordsIn(text: string, file = ""): string[] {
  const blank = (m: string) => m.replace(/[^\n]/g, "");
  const read = text.replace(/`/g, "");
  const allowed = allowedStackWords(file);
  const found: { word: string; line: number }[] = [];
  for (const word of STACK_WORDS) {
    if (allowed.includes(word)) continue;
    const searched =
      word === "Codecov"
        ? read.replace(
            /If the repository reports to Codecov[\s\S]*?\.(?=\s|$)/g,
            blank,
          )
        : read;
    for (const m of searched.matchAll(wholeWord(word)))
      found.push({
        word,
        line: searched.slice(0, m.index).split("\n").length,
      });
  }
  return found
    .sort((a, b) => a.line - b.line)
    .map(({ word, line }) => `${word} (line ${line})`);
}

describe("stackWordsIn", () => {
  it.each(STACK_WORDS)("finds %j", (word) => {
    expect(stackWordsIn(`Read it.\nIt says ${word} here.`)).toEqual([
      `${word} (line 2)`,
    ]);
  });

  it("matches a word whole, through backticks, and a phrase across a line break", () => {
    expect(stackWordsIn("A reaction to a Reactive rule.")).toEqual([]);
    expect(stackWordsIn("It runs on micropython.")).toEqual([]);
    expect(stackWordsIn("Its `.ts` sibling holds it.")).toEqual([
      ".ts sibling (line 1)",
    ]);
    expect(
      stackWordsIn('the command "After every code\nchange" gives'),
    ).toEqual(["After every code change (line 1)"]);
    expect(stackWordsIn("In `Search.tsx`, and what visitors see.")).toEqual([
      ".tsx (line 1)",
      "visitor (line 1)",
    ]);
    expect(stackWordsIn("git diff origin/main...HEAD")).toEqual([
      "origin/main (line 1)",
    ]);
  });

  it("lets Codecov through only in the sentence that starts with the repository reporting to it", () => {
    expect(
      stackWordsIn(
        "If the repository reports to Codecov, read\nits checks too. Then read the Codecov comment.",
      ),
    ).toEqual(["Codecov (line 2)"]);
  });

  it("lets a website's files, and no other, name Playwright and visitors, and no other stack word", () => {
    const website = "Drive it with Playwright, as a visitor would.";
    for (const file of [
      "agents/factory-ui-reviewer.md",
      "agents/factory-e2e-reviewer.md",
      "skills/factory-design/SKILL.md",
    ])
      expect(stackWordsIn(website, file)).toEqual([]);
    expect(stackWordsIn(website, "agents/factory-test-reviewer.md")).toEqual([
      "visitor (line 1)",
      "Playwright (line 1)",
    ]);
    expect(
      stackWordsIn("git merge origin/main", "skills/factory-design/SKILL.md"),
    ).toEqual(["origin/main (line 1)"]);
  });

  it("lets the dependency skill, and no other, name npm's lock file and commands, and no other stack word", () => {
    const npm = "Take package-lock.json, then `npm ci` or `npm install`.";
    expect(stackWordsIn(npm, "skills/factory-deps/SKILL.md")).toEqual([]);
    expect(stackWordsIn(npm, "skills/factory-build/SKILL.md")).toHaveLength(3);
    expect(
      stackWordsIn("Read AGENTS.md first.", "skills/factory-deps/SKILL.md"),
    ).toEqual(["AGENTS.md (line 1)"]);
  });
});

describe("the boundaries", () => {
  it("no file the package ships, and none of its source or tests, is Python", () => {
    const shipped = (
      JSON.parse(readFileSync(join(PACKAGE, "package.json"), "utf8")) as {
        files: string[];
      }
    ).files;
    const found = [...shipped, "src", "tests"]
      .map((entry) => join(PACKAGE, entry))
      .filter((path) => existsSync(path) && statSync(path).isDirectory())
      .flatMap(filesUnder)
      .filter((path) => path.endsWith(".py"));
    expect(found).toEqual([]);
  });

  it("no skill, agent, rule, or review instruction asks for Python", () => {
    const pages = [
      ...["skills", "agents"].flatMap((d) => filesUnder(join(PACKAGE, d))),
      join(PACKAGE, "rules.md"),
      join(PACKAGE, "review.md"),
    ].filter((path) => path.endsWith(".md"));
    const found = pages.flatMap((path) =>
      readFileSync(path, "utf8")
        .split("\n")
        .filter((line) => /\bpython3?\b/.test(line))
        .map((line) => `${path}: ${line.trim()}`),
    );
    expect(found).toEqual([]);
  });

  it("the design skill names nothing of the repository the factory is developed in", () => {
    const path = join(PACKAGE, "skills/factory-design/SKILL.md");
    expect(hostNamesIn(readFileSync(path, "utf8"))).toEqual([]);
  });

  it("reads real files: each list below holds a skill, an agent, and the rules it is said to", () => {
    expect(guideFiles()).toEqual(
      expect.arrayContaining([
        "skills/factory-build/SKILL.md",
        "agents/factory-test-reviewer.md",
        "rules.md",
        "review.md",
      ]),
    );
    expect(instructionFiles()).toEqual(
      expect.arrayContaining([
        "skills/factory-build/SKILL.md",
        "agents/factory-test-reviewer.md",
        ".github/workflows/run.yml",
        ".github/workflows/review.yml",
        ".github/workflows/session.yml",
        ".github/workflows/poller.yml",
        "rules.md",
        "review.md",
      ]),
    );
    expect(guidesWithNoHost()).toEqual(
      expect.arrayContaining([
        "skills/factory-build/SKILL.md",
        "agents/factory-test-reviewer.md",
        "rules.md",
      ]),
    );
  });

  it("no skill, agent, rule, or review instruction names one stack or one layout", () => {
    const found = guideFiles().flatMap((file) =>
      stackWordsIn(readFileSync(join(PACKAGE, file), "utf8"), file).map(
        (word) => `${file}: ${word}`,
      ),
    );
    expect(found).toEqual([]);
  });

  it("no skill, agent, rule, review, or workflow in the package calls GitHub's issues or projects", () => {
    const found = instructionFiles().flatMap((path) =>
      ticketCallsIn(readFileSync(path, "utf8")).map((l) => `${path}: ${l}`),
    );
    expect(found).toEqual([]);
  });

  it("no skill, agent, rule, or review instruction writes a ticket as only GitHub does", () => {
    const found = guideFiles().flatMap((file) =>
      githubTicketWordsIn(readFileSync(join(PACKAGE, file), "utf8")).map(
        (line) => `${file}: ${line}`,
      ),
    );
    expect(found).toEqual([]);
  });

  it("no skill, agent, rule, review, or workflow in the package runs a spec tool itself", () => {
    const found = instructionFiles().flatMap((path) =>
      specToolCallsIn(readFileSync(path, "utf8")).map((l) => `${path}: ${l}`),
    );
    expect(found).toEqual([]);
  });

  it("no skill, agent, rule, review, or workflow in the package runs the factory after a cd", () => {
    const found = instructionFiles().flatMap((path) =>
      factoryAfterCdIn(readFileSync(path, "utf8")).map((l) => `${path}: ${l}`),
    );
    expect(found).toEqual([]);
  });

  it("no skill, agent, rule, or review instruction names GitHub's CLI or its word for whether a pull request can merge", () => {
    const found = guidesWithNoHost().flatMap((path) =>
      hostToolIn(readFileSync(path, "utf8")).map((l) => `${path}: ${l}`),
    );
    expect(found).toEqual([]);
  });

  it("no source file but the printer and the prompts prints, colors, or asks a question, and no file under bin/ but the launcher", () => {
    const allowed = [
      "src/lib/output.mts",
      "src/lib/prompts.mts",
      "bin/factory.js",
    ];
    const files = ["src", "bin"]
      .flatMap((dir) => filesUnder(join(PACKAGE, dir)))
      .map((f) => relative(PACKAGE, f));
    expect(files).toEqual(expect.arrayContaining(allowed));
    expect(
      files
        .filter((f) => !allowed.includes(f))
        .flatMap((f) =>
          printsIn(readFileSync(f, "utf8")).map((l) => `${f}: ${l}`),
        ),
    ).toEqual([]);
  });

  it("no test but the stand-in and the printer's own renders a line itself", () => {
    const own = [
      "tests/printed.ts",
      "tests/output.test.ts",
      "tests/boundary.test.ts",
    ];
    expect(
      filesUnder(join(PACKAGE, "tests"))
        .map((f) => relative(PACKAGE, f))
        .filter((f) => /\.m?ts$/.test(f) && !own.includes(f))
        .filter((f) => {
          const text = readFileSync(f, "utf8");
          return (
            /import \{[^}]*\brender\b[^}]*\} from "[^"]*output\.mts"/.test(
              text,
            ) || /\bsay\.render\(/.test(text)
          );
        }),
    ).toEqual([]);
  });

  it("no source file outside src/tickets/, src/code-host/, and src/runner/ calls GitHub", () => {
    const found = sourceFilesOutside(INTERFACE_FOLDERS).flatMap(({ path }) =>
      githubCallsIn(readFileSync(path, "utf8")).map((l) => `${path}: ${l}`),
    );
    expect(found).toEqual([]);
  });

  it("no source file outside those three folders holds a github.com address", () => {
    const found = sourceFilesOutside(INTERFACE_FOLDERS).flatMap(({ path }) =>
      githubAddressesIn(readFileSync(path, "utf8")).map((l) => `${path}: ${l}`),
    );
    expect(found).toEqual([]);
  });

  it("no source file outside src/code-host/ and src/runner/ but the poller imports a GitHub implementation of them", () => {
    const found = sourceFilesOutside(["code-host/", "runner/"])
      .filter(({ rel }) => rel !== "poller.mts")
      .flatMap(({ path }) =>
        implementationImportsIn(readFileSync(path, "utf8")).map(
          (l) => `${path}: ${l}`,
        ),
      );
    expect(found).toEqual([]);
  });

  it("no source file outside src/tickets/ but the registry imports GitHub's ticket adapter", () => {
    const found = sourceFilesOutside(["tickets/"])
      .filter(({ rel }) => rel !== "tools.mts")
      .flatMap(({ path }) =>
        readFileSync(path, "utf8")
          .split("\n")
          .filter((l) => /tickets\/github(-open)?(\.\w+)?["']/.test(l))
          .map((l) => `${path}: ${l.trim()}`),
      );
    expect(found).toEqual([]);
  });

  it.each(["code-host/types.mts", "runner/types.mts"])(
    "src/%s declares no name with an underscore, and imports no implementation",
    (file) => {
      const text = readFileSync(join(PACKAGE, "src", file), "utf8");
      expect(underscoredNamesIn(text)).toEqual([]);
      // Beside it in the folder, or in the other interface's.
      expect(
        text
          .split("\n")
          .filter(
            (l) =>
              /from\s+"\.\/(?!types)/.test(l) ||
              implementationImportsIn(l).length > 0,
          ),
      ).toEqual([]);
    },
  );
});

describe("hostWordsIn", () => {
  it.each([
    "On cfi#174, the change took a 27 minute read.",
    "Clone davidbyoung/cfi first.",
    "Open www.davecfi.com.",
    "Read `src/app/CLAUDE.md`.",
    "Run the dpe-reviewer agent.",
    "The form posts to Formspree.",
    "Flight training in Chicago.",
    "Practice for a checkride.",
    "Conflicted in StudyGuidesMenu.tsx.",
  ])("finds %j", (line) => {
    expect(hostWordsIn(line)).toHaveLength(1);
  });

  it("lets through a line its file exempts, and only in that file", () => {
    const exempt = [
      { file: "docs/a.md", line: "`src/app/`", why: "a generic example" },
    ];
    const line = "Pages live under `src/app/`.";
    expect(hostWordsIn(line, "docs/a.md", exempt)).toEqual([]);
    expect(hostWordsIn(line, "docs/b.md", exempt)).toHaveLength(1);
  });

  it("lets through the package's own name and owner", () => {
    expect(
      hostWordsIn(
        "Install @davidbyoung/software-factory from davidbyoung/software-factory.",
      ),
    ).toEqual([]);
  });
});

/** Every file of the package's own, but the list of words and this test,
 * whose examples have to use them. */
function packageFiles(): string[] {
  const skip = new Set(["node_modules", "dist", ".git", "coverage"]);
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      if (skip.has(name)) return [];
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
  return walk(PACKAGE).filter(
    (path) =>
      !["tests/host-names.mts", "tests/boundary.test.ts"].includes(
        relative(PACKAGE, path),
      ),
  );
}

describe("the package and the repository it was drawn out of", () => {
  it("nothing in the package names that repository, its sites, its paths, or its subject", () => {
    const found = packageFiles().flatMap((path) => {
      const file = relative(PACKAGE, path);
      return hostWordsIn(readFileSync(path, "utf8"), file).map(
        (line) => `${file}: ${line}`,
      );
    });
    expect(found).toEqual([]);
  });
});
