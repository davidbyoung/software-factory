// The boundaries the three interfaces rest on. No skill, agent, rule, or
// workflow in the package talks to GitHub's issues or projects itself: it
// runs a `factory ticket` or `factory pr` command, and no skill, agent, or
// rule names GitHub's CLI at all. No file under src/ but
// the three folders that hold an interface and its implementations
// (`src/tickets/`, `src/code-host/`, `src/runner/`) calls GitHub or holds
// its address, and no file outside the last two but the poller names a
// GitHub implementation of them. The two newer interfaces declare no name
// in GitHub's API's style.
import { readFileSync, readdirSync, statSync } from "node:fs";
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
 * around the commands: `gh issue`, `gh project`, or a `gh api` call to an
 * issues or projects path. */
export function ticketCallsIn(text: string): string[] {
  const found: string[] = [];
  for (const line of joinContinuations(text).split("\n")) {
    if (/\bgh issue\b/.test(line)) found.push(line.trim());
    else if (/\bgh project\b/.test(line)) found.push(line.trim());
    else
      for (const m of line.matchAll(/\bgh api\b(.*)/g))
        if (/\/(issues|projects)\b/.test(m[1])) found.push(line.trim());
  }
  return found;
}

/** Each line that names GitHub's CLI, as a command or in a sentence, or
 * GitHub's own name for whether a pull request can merge. */
export function hostToolIn(text: string): string[] {
  return text
    .split("\n")
    .filter((line) => /\bgh\b|\bmergeable_state\b/.test(line))
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

/** Each command line that runs `npx --no-install factory` after a `cd` in
 * the same command: from another directory, npx cannot find the factory,
 * which is installed only in the repository. */
export function factoryAfterCdIn(text: string): string[] {
  return joinContinuations(text)
    .split("\n")
    .filter((line) => /\bcd\b[^\n]*\bnpx --no-install factory\b/.test(line))
    .map((line) => line.trim());
}

const instructionFiles = () => [
  ...["skills", "agents", "workflows"].flatMap((d) =>
    filesUnder(join(PACKAGE, d)),
  ),
  join(PACKAGE, "rules.md"),
  join(PACKAGE, "review.md"),
];

const skillsAgentsAndRules = () => [
  ...["skills", "agents"].flatMap((d) => filesUnder(join(PACKAGE, d))),
  // Not `review.md`: the review's checkout is the pull request's head, so
  // the factory's commands there are the code under review, and its reads
  // go through GitHub's CLI on purpose.
  join(PACKAGE, "rules.md"),
];

/** The source files outside the folders named, with each one's path from
 * src/. */
const sourceFilesOutside = (folders: string[]) =>
  filesUnder(join(PACKAGE, "src"))
    .map((path) => ({ path, rel: relative(join(PACKAGE, "src"), path) }))
    .filter(({ rel }) => !folders.some((folder) => rel.startsWith(folder)));

const INTERFACE_FOLDERS = ["tickets/", "code-host/", "runner/"];

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

  it("lets through the factory's commands and gh api calls to other paths", () => {
    expect(ticketCallsIn("npx --no-install factory ticket view N")).toEqual([]);
    expect(ticketCallsIn("gh api repos/REPO/pulls/N/files")).toEqual([]);
    expect(ticketCallsIn("See the issues list on GitHub.")).toEqual([]);
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
    expect(
      hostToolIn("npx --no-install factory pr view 12 --field head"),
    ).toEqual([]);
    expect(hostToolIn("A high bar, though.")).toEqual([]);
    expect(hostToolIn("whether it can merge is `dirty`")).toEqual([]);
  });
});

describe("factoryAfterCdIn", () => {
  it("finds a factory command run after a cd, and lets one from the root through", () => {
    expect(
      factoryAfterCdIn(
        'cd "$dir" && npx --no-install factory ticket comment N \\\n  --body-file body.md',
      ),
    ).toHaveLength(1);
    expect(
      factoryAfterCdIn(
        'npx --no-install factory ticket comment N --body-file "$dir/body.md"',
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

describe("the boundaries", () => {
  it("the design skill names nothing of the repository the factory is developed in", () => {
    const path = join(PACKAGE, "skills/factory-design/SKILL.md");
    expect(hostNamesIn(readFileSync(path, "utf8"))).toEqual([]);
  });

  it("no skill, agent, rule, review, or workflow in the package calls GitHub's issues or projects", () => {
    const found = instructionFiles().flatMap((path) =>
      ticketCallsIn(readFileSync(path, "utf8")).map((l) => `${path}: ${l}`),
    );
    expect(found).toEqual([]);
  });

  it("no skill, agent, rule, review, or workflow in the package runs the factory after a cd", () => {
    const found = instructionFiles().flatMap((path) =>
      factoryAfterCdIn(readFileSync(path, "utf8")).map((l) => `${path}: ${l}`),
    );
    expect(found).toEqual([]);
  });

  it("no skill, agent, or rule names GitHub's CLI or its word for whether a pull request can merge", () => {
    const found = skillsAgentsAndRules().flatMap((path) =>
      hostToolIn(readFileSync(path, "utf8")).map((l) => `${path}: ${l}`),
    );
    expect(found).toEqual([]);
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
