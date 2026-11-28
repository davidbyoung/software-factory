// The lines `kodor pr uncovered` prints, from an lcov report and a diff.
import { describe, expect, it } from "vitest";
import {
  changedLines,
  parseLcov,
  uncovered,
  type FileCoverage,
} from "../src/patch-coverage.mts";

const lines = (...numbers: number[]) => new Set(numbers);
const file = (miss: number[], part: number[] = []): FileCoverage => ({
  miss: lines(...miss),
  part: lines(...part),
});

describe("parseLcov", () => {
  it("takes a line with no hits as never run, and one with hits as run", () => {
    const report = ["SF:src/a.ts", "DA:3,0", "DA:4,2", "end_of_record"];

    expect(parseLcov(report.join("\n"), "/repo")).toEqual(
      new Map([["src/a.ts", file([3])]]),
    );
  });

  it("reads the hits of a line that carries a checksum", () => {
    const report = ["SF:src/a.ts", "DA:3,0,abc123", "DA:4,1,def456"];

    expect(parseLcov(report.join("\n"), "/repo").get("src/a.ts")).toEqual(
      file([3]),
    );
  });

  it("takes a branch never taken, or never reached, as partly covered", () => {
    const report = [
      "SF:src/a.ts",
      "BRDA:7,0,0,0",
      "BRDA:8,0,1,-",
      "BRDA:9,0,0,1",
    ];

    expect(parseLcov(report.join("\n"), "/repo").get("src/a.ts")).toEqual(
      file([], [7, 8]),
    );
  });

  it("names a file by its path from the directory it runs in", () => {
    const report = ["SF:/repo/src/a.ts", "DA:1,0", "SF:./src/../src/b.ts"];

    expect([...parseLcov(report.join("\n"), "/repo").keys()]).toEqual([
      "src/a.ts",
      "src/b.ts",
    ]);
  });

  it("skips every line that is not a file, a line, or a branch", () => {
    const report = ["TN:", "SF:src/a.ts", "FN:1,main", "LF:9", "DA:2,0"];

    expect(parseLcov(report.join("\n"), "/repo")).toEqual(
      new Map([["src/a.ts", file([2])]]),
    );
  });
});

describe("changedLines", () => {
  const diff = (...body: string[]) =>
    ["diff --git a/src/a.ts b/src/a.ts", ...body].join("\n");

  it("takes the one line of a hunk with no count", () => {
    const text = diff("--- a/src/a.ts", "+++ b/src/a.ts", "@@ -3 +3 @@", "+x");

    expect(changedLines(text)).toEqual(new Map([["src/a.ts", lines(3)]]));
  });

  it("takes every line of a hunk with a count", () => {
    const text = diff("+++ b/src/a.ts", "@@ -3,0 +4,3 @@ function f() {");

    expect(changedLines(text).get("src/a.ts")).toEqual(lines(4, 5, 6));
  });

  it("takes no line from a hunk that only deletes", () => {
    const text = diff("+++ b/src/a.ts", "@@ -12,2 +11,0 @@");

    expect(changedLines(text).get("src/a.ts")).toEqual(lines());
  });

  it("starts no file for one the branch deleted", () => {
    const text = diff("--- a/src/a.ts", "+++ /dev/null", "@@ -1,2 +0,0 @@");

    expect(changedLines(text)).toEqual(new Map());
  });

  it("keeps each file's lines apart", () => {
    const text = [
      "+++ b/src/a.ts",
      "@@ -1 +1 @@",
      "+++ b/src/b.ts",
      "@@ -5 +9,2 @@",
    ].join("\n");

    expect(changedLines(text)).toEqual(
      new Map([
        ["src/a.ts", lines(1)],
        ["src/b.ts", lines(9, 10)],
      ]),
    );
  });
});

describe("uncovered", () => {
  const sources: Record<string, string> = {
    "src/a.ts": ["one", "  two  ", "three", "four"].join("\n"),
    "src/b.ts": ["alpha", "beta"].join("\n"),
  };
  const source = (path: string) => sources[path] ?? null;

  it("prints a header for each file, in path order, then its lines never run, in line order", () => {
    const coverage = new Map([
      ["src/b.ts", file([1])],
      ["src/a.ts", file([4, 2])],
    ]);
    const changed = new Map([
      ["src/b.ts", lines(1)],
      ["src/a.ts", lines(2, 4)],
    ]);

    expect(uncovered(coverage, changed, source)).toEqual([
      "=== src/a.ts",
      "MISS 2: two",
      "MISS 4: four",
      "=== src/b.ts",
      "MISS 1: alpha",
    ]);
  });

  it("prints a line with a branch never taken as PART, in the same list", () => {
    const coverage = new Map([["src/a.ts", file([3], [1])]]);
    const changed = new Map([["src/a.ts", lines(1, 3)]]);

    expect(uncovered(coverage, changed, source)).toEqual([
      "=== src/a.ts",
      "PART 1: one",
      "MISS 3: three",
    ]);
  });

  it("prints a line that is both once, as MISS", () => {
    const coverage = new Map([["src/a.ts", file([3], [3])]]);
    const changed = new Map([["src/a.ts", lines(3)]]);

    expect(uncovered(coverage, changed, source)).toEqual([
      "=== src/a.ts",
      "MISS 3: three",
    ]);
  });

  it("prints nothing for an uncovered line the branch did not change", () => {
    const coverage = new Map([["src/a.ts", file([1, 3])]]);
    const changed = new Map([["src/a.ts", lines(3)]]);

    expect(uncovered(coverage, changed, source)).toEqual([
      "=== src/a.ts",
      "MISS 3: three",
    ]);
  });

  it("prints nothing for a changed file the report does not hold", () => {
    const coverage = new Map([["src/a.ts", file([1])]]);
    const changed = new Map([
      ["src/a.ts", lines(1)],
      ["docs/cli.md", lines(1, 2)],
    ]);

    expect(uncovered(coverage, changed, source)).toEqual([
      "=== src/a.ts",
      "MISS 1: one",
    ]);
  });

  it("prints nothing, not even a header, when every changed line is covered", () => {
    const coverage = new Map([["src/a.ts", file([1], [2])]]);
    const changed = new Map([["src/a.ts", lines(3, 4)]]);

    expect(uncovered(coverage, changed, source)).toEqual([]);
  });

  it("trims a source line, then cuts it to 110 characters", () => {
    const long = `    ${"x".repeat(200)}`;
    const coverage = new Map([["src/long.ts", file([1])]]);
    const changed = new Map([["src/long.ts", lines(1)]]);

    expect(uncovered(coverage, changed, () => long)).toEqual([
      "=== src/long.ts",
      `MISS 1: ${"x".repeat(110)}`,
    ]);
  });

  it("prints a line with no text when its source cannot be read", () => {
    const coverage = new Map([["src/gone.ts", file([2], [5])]]);
    const changed = new Map([["src/gone.ts", lines(2, 5)]]);

    expect(uncovered(coverage, changed, source)).toEqual([
      "=== src/gone.ts",
      "MISS 2:",
      "PART 5:",
    ]);
  });
});
