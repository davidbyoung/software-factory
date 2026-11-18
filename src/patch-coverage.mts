// What `factory pr uncovered` prints: the lines a branch added or changed
// that its coverage report shows no test ran, or a branch never taken.
import { relative, resolve } from "node:path";

/** One file's uncovered lines: never run, and run with a branch not taken. */
export type FileCoverage = { miss: Set<number>; part: Set<number> };

/** An lcov report's uncovered lines, by each file's path from `cwd`. */
export function parseLcov(
  text: string,
  cwd: string,
): Map<string, FileCoverage> {
  const files = new Map<string, FileCoverage>();
  let current: FileCoverage | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("SF:")) {
      current = { miss: new Set(), part: new Set() };
      files.set(relative(cwd, resolve(cwd, line.slice(3))), current);
    } else if (current && line.startsWith("DA:")) {
      const [number, hits] = line.slice(3).split(",");
      if (hits === "0") current.miss.add(Number(number));
    } else if (current && line.startsWith("BRDA:")) {
      const [number, , , taken] = line.slice(5).split(",");
      if (taken === "0" || taken === "-") current.part.add(Number(number));
    }
  }
  return files;
}

/** The line numbers a `git diff -U0` adds or changes, by file. */
export function changedLines(diff: string): Map<string, Set<number>> {
  const files = new Map<string, Set<number>>();
  let current: Set<number> | null = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      // A deleted file's new side is /dev/null, and adds nothing.
      current = line.startsWith("+++ b/") ? new Set() : null;
      if (current) files.set(line.slice(6), current);
      continue;
    }
    const hunk = /^@@ .* \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!hunk || !current) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    for (let n = start; n < start + count; n++) current.add(n);
  }
  return files;
}

/** The lines to print: a header for each file with a changed line the
 * report shows uncovered, then each such line. `source` gives a file's
 * text, or null when it cannot be read. */
export function uncovered(
  coverage: Map<string, FileCoverage>,
  changed: Map<string, Set<number>>,
  source: (path: string) => string | null,
): string[] {
  const out: string[] = [];
  for (const path of [...changed.keys()].sort()) {
    const report = coverage.get(path);
    if (!report) continue;
    const lines = changed.get(path)!;
    const found = [...new Set([...report.miss, ...report.part])]
      .filter((n) => lines.has(n))
      .sort((a, b) => a - b);
    if (!found.length) continue;
    const text = source(path)?.split(/\r?\n/);
    out.push(`=== ${path}`);
    for (const n of found) {
      const kind = report.miss.has(n) ? "MISS" : "PART";
      const shown = text?.[n - 1]?.trim().slice(0, 110);
      out.push(
        shown === undefined ? `${kind} ${n}:` : `${kind} ${n}: ${shown}`,
      );
    }
  }
  return out;
}
