// What every reader is told the product is called: lunamill, never the
// factory or the software factory.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/** The upgrade notes name the old package and the releases before lunamill,
 * which a repository on an old release follows with the old command. */
const ALLOWED = new Set(["docs/maintain/upgrade-notes.md"]);

const OLD = /\bthe\s+factory\b|\bsoftware\s+factory\b|\bkodor\b/gi;
const MENTIONS = new RegExp(OLD.source, "i");

/** Each old name in a text, other than "a software factory", which
 * describes what lunamill is. */
const oldNames = (text: string) =>
  [...text.matchAll(OLD)]
    .filter(
      (m) =>
        !/(?<!\w)a\s$/i.test(text.slice(Math.max(0, m.index - 3), m.index)),
    )
    .map((m) => m[0]);

const files = (path: string): string[] =>
  statSync(path).isDirectory()
    ? readdirSync(path, { recursive: true })
        .map((f) => join(path, String(f)))
        .filter((f) => statSync(f).isFile())
    : [path];

/** The string and template literals of a script, without its comments
 * and identifiers, which no reader of a command's output sees. */
const literals = (path: string) => {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    )
      found.push(node.text);
    node.forEachChild(visit);
  };
  visit(source);
  return found.join("\n");
};

const READ = [
  "README.md",
  "docs",
  "skills",
  "agents",
  "rules.md",
  "review.md",
  "approval-policies",
  "settings.schema.json",
  ".claude-plugin/plugin.json",
];

const SCRIPTS = ["src", "bin"];

describe("the package", () => {
  it("is @lunamill-ai/lunamill, from lunamill-ai/lunamill, with the one command lunamill", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      name: string;
      bin: Record<string, string>;
      repository: { url: string };
    };
    expect(pkg.name).toBe("@lunamill-ai/lunamill");
    expect(pkg.bin).toEqual({ lunamill: "bin/lunamill.js" });
    expect(pkg.repository.url).toBe(
      "git+https://github.com/lunamill-ai/lunamill.git",
    );
  });
});

describe("the product's name", () => {
  it("is Lunamill in every page, skill, agent, rule, and setting a reader reads", () => {
    const found = READ.flatMap(files)
      .filter((f) => !ALLOWED.has(f))
      .flatMap((f) =>
        oldNames(readFileSync(f, "utf8")).map((name) => `${f}: ${name}`),
      );
    expect(found).toEqual([]);
  });

  it('allows "a software factory", and no other word before it', () => {
    expect(oldNames("Lunamill, a software factory")).toEqual([]);
    expect(oldNames("an extra software factory")).toEqual(["software factory"]);
  });

  it("is Lunamill in every line a command prints", { timeout: 30_000 }, () => {
    const found = SCRIPTS.flatMap(files)
      .filter((f) => /\.(m?ts|m?js)$/.test(f) && !/\.test\./.test(f))
      // Parsing every script takes longer than a test may, so only one
      // whose text has an old name anywhere is parsed.
      .filter((f) => MENTIONS.test(readFileSync(f, "utf8")))
      .flatMap((f) => oldNames(literals(f)).map((name) => `${f}: ${name}`));
    expect(found).toEqual([]);
  });

  it(
    "is quoted in the specs and the docs as each command prints it",
    { timeout: 30_000 },
    () => {
      const printed = SCRIPTS.flatMap(files)
        .filter((f) => /\.(m?ts|m?js)$/.test(f) && !/\.test\./.test(f))
        .filter((f) => readFileSync(f, "utf8").includes("Lunamill"))
        .flatMap((f) => literals(f).split("\n"))
        .map((piece) => piece.trim())
        .filter((piece) => piece.includes("Lunamill") && piece.length >= 16);
      const quotes = ["README.md", "docs", "openspec"]
        .flatMap(files)
        .filter((f) => f.endsWith(".md"));
      const found = quotes.flatMap((f) => {
        const text = readFileSync(f, "utf8");
        return [...new Set(printed)]
          .filter((piece) =>
            text.includes(piece.replaceAll("Lunamill", "lunamill")),
          )
          .map((piece) => `${f}: ${piece}`);
      });
      expect(found).toEqual([]);
    },
  );

  it("is capitalized in the prose of every page, skill, agent, and rule", () => {
    const found = READ.flatMap(files)
      .filter((f) => f.endsWith(".md"))
      .flatMap((f) =>
        lowercaseNames(readFileSync(f, "utf8")).map((line) => `${f}: ${line}`),
      );
    expect(found).toEqual([]);
  });

  it("leaves the command, its files, and quoted names lowercase", () => {
    expect(
      lowercaseNames(
        [
          "Run lunamill init, then lunamill sync --check.",
          "It reads `.claude/lunamill.yaml` and the label `lunamill`.",
          'The skill /lunamill-build, from lunamill.ai, on lunamill-ai/lunamill, labeled "lunamill".',
          "```bash\nlunamill doctor\n```",
        ].join("\n"),
      ),
    ).toEqual([]);
    expect(
      lowercaseNames("Install lunamill once, and lunamill's hooks run."),
    ).toEqual(["Install lunamill once, and lunamill's hooks run."]);
  });
});

/** The commands that follow the name where it is typed, not said. */
const COMMANDS = new Set(
  `init ticket sync pr config doctor preset specs gate update status plugins
  session build default-branch site poller workspace remove test-one guard board
  coverage approval-policies end-to-end relock follow-up build-setup enroll
  session-start reviewers label across merge-policy review-verdict review deps
  handoff`.split(/\s+/),
);

/** Each line of a Markdown text whose prose writes the product's name in
 * lowercase: outside code blocks and inline code, and where neither a
 * command, a path, nor a quote makes it a name a person types. */
const lowercaseNames = (text: string) => {
  const found: string[] = [];
  let fenced = false;
  for (const line of text.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const prose = line.replace(/`[^`]*`/g, "``");
    for (const m of prose.matchAll(
      /(?<![\w./@$"'/-])lunamill(?![\w./@:"-])(?!'(?!s\b))/g,
    )) {
      const rest = prose.slice(m.index + "lunamill".length);
      const next = /^ ([a-z][a-z-]*)/.exec(rest)?.[1];
      if (next && COMMANDS.has(next)) continue;
      if (/^ (--|[A-Z]{2,}\b)/.test(rest)) continue;
      if (rest.startsWith(" /") || prose.slice(0, m.index).endsWith("/ "))
        continue;
      found.push(line);
      break;
    }
  }
  return found;
};
