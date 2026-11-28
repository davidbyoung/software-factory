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
  it("is lunamill in every page, skill, agent, rule, and setting a reader reads", () => {
    const found = READ.flatMap(files)
      .filter((f) => !ALLOWED.has(f))
      .flatMap((f) =>
        oldNames(readFileSync(f, "utf8")).map((name) => `${f}: ${name}`),
      );
    expect(found).toEqual([]);
  });

  it('allows "a software factory", and no other word before it', () => {
    expect(oldNames("lunamill, a software factory")).toEqual([]);
    expect(oldNames("an extra software factory")).toEqual(["software factory"]);
  });

  it("is lunamill in every line a command prints", { timeout: 30_000 }, () => {
    const found = SCRIPTS.flatMap(files)
      .filter((f) => /\.(m?ts|m?js)$/.test(f) && !/\.test\./.test(f))
      // Parsing every script takes longer than a test may, so only one
      // whose text has an old name anywhere is parsed.
      .filter((f) => MENTIONS.test(readFileSync(f, "utf8")))
      .flatMap((f) => oldNames(literals(f)).map((name) => `${f}: ${name}`));
    expect(found).toEqual([]);
  });
});
