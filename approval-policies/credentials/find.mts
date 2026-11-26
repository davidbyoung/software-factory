// The credentials approval policy's rule: which lines of a change touch a
// credential or widen what a workflow may do. It reads the change as JSON
// on standard input and prints its findings, as any approval policy's
// check does, and imports nothing, so it runs in any repository.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

type ChangedFile = {
  filename: string;
  previous_filename?: string;
  status?: string;
};
type Finding = { file: string; line: number; title: string };

const input = JSON.parse(readFileSync(0, "utf8")) as {
  base: string;
  files: ChangedFile[];
  diff: string;
};

/** Tests, specs, and docs, at any depth, which the rule doesn't read. */
const left = (path: string) =>
  path
    .split("/")
    .slice(0, -1)
    .some((d) => ["test", "tests", "spec", "specs", "docs"].includes(d)) ||
  /\.(test|spec)\.[^/]+$/.test(path);

const workflow = (path: string) => path.startsWith(".github/workflows/");

/** A line with its YAML comment taken off, as far as a text match can. */
const uncommented = (line: string) => line.replace(/(^|\s)#.*$/, "");

/** Each line the diff adds, with its file and its number in the new file. */
function added(diff: string): { file: string; line: number; text: string }[] {
  const out: { file: string; line: number; text: string }[] = [];
  let file = "";
  let n = 0;
  // A file's header runs from its `diff --git` line to its first hunk, so
  // an added line that starts with "++ " is never read as one.
  let header = false;
  for (const l of diff.split("\n")) {
    if (l.startsWith("diff --git ")) {
      header = true;
      continue;
    }
    if (header && l.startsWith("+++ ")) {
      file = l === "+++ /dev/null" ? "" : l.replace(/^\+\+\+ b\//, "");
      continue;
    }
    const hunk = /^@@ -\S+ \+(\d+)/.exec(l);
    if (hunk) {
      header = false;
      n = Number(hunk[1]) - 1;
      continue;
    }
    if (header) continue;
    if (l.startsWith("-") || l.startsWith("\\")) continue;
    n++;
    if (l.startsWith("+") && file)
      out.push({ file, line: n, text: l.slice(1) });
  }
  return out;
}

const git = (args: string[]) =>
  spawnSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

/** Where "the repository had it" is read: the change's base where this
 * checkout has it, as on a person's machine, and the checkout's own tip,
 * the default branch's, where it doesn't. */
const ref =
  input.base && git(["cat-file", "-e", `${input.base}^{commit}`]).status === 0
    ? input.base
    : "HEAD";
const OUTSIDE = [
  ":(exclude,glob)**/docs/**",
  ":(exclude,glob)**/test/**",
  ":(exclude,glob)**/tests/**",
  ":(exclude,glob)**/spec/**",
  ":(exclude,glob)**/specs/**",
  ":(exclude,glob)**/*.test.*",
  ":(exclude,glob)**/*.spec.*",
];
const known = new Map<string, boolean>();
const had = (name: string) => {
  if (!known.has(name))
    known.set(
      name,
      git(["grep", "-qwF", name, ref, "--", ".", ...OUTSIDE]).status === 0,
    );
  return known.get(name)!;
};

const NAME =
  /\b[A-Z][A-Z0-9_]*_(?:TOKEN|SECRET|PASSWORD|KEY|PAT|AUTH|CREDENTIALS?)\b/g;

const findings: Finding[] = [];
const seen = new Set<string>();
const find = (file: string, line: number, title: string) => {
  const key = `${file}:${line}:${title}`;
  if (seen.has(key)) return;
  seen.add(key);
  findings.push({ file, line, title });
};

const named = new Set<string>();
for (const { file, line, text } of added(input.diff)) {
  if (left(file)) continue;
  for (const [name] of text.matchAll(NAME)) {
    if (name === "GITHUB_TOKEN" || named.has(name) || had(name)) continue;
    named.add(name);
    find(file, line, `A new credential: ${name}`);
  }
  if (!workflow(file)) continue;
  const code = uncommented(text);
  for (const [, name] of code.matchAll(/secrets\.([A-Za-z_][\w-]*)/g))
    if (name !== "GITHUB_TOKEN") find(file, line, `Passes a secret: ${name}`);
  for (const [, name] of code.matchAll(/secrets\[\s*['"]([^'"]+)['"]\s*\]/g))
    find(file, line, `Passes a secret: ${name}`);
  if (/toJSON\(\s*secrets\s*\)|secrets:\s*inherit\b/.test(code))
    find(file, line, "Passes every secret");
  for (const [, name] of code.matchAll(
    /['"]?([\w-]+)['"]?\s*:\s*['"]?write['"]?(?=\s*(?:[,}]|$))/g,
  ))
    find(file, line, `Write access: ${name}: write`);
  if (/\bwrite-all\b/.test(code)) find(file, line, "Write access: write-all");
  if (/(^|[\s[,{-])['"]?pull_request_target['"]?\s*(:|,|\]|}|$)/.test(code))
    find(file, line, "A pull_request_target trigger");
}

for (const f of input.files) {
  const moved =
    f.status === "renamed" &&
    f.previous_filename !== undefined &&
    !workflow(f.previous_filename);
  if (workflow(f.filename) && (f.status === "added" || moved))
    find(f.filename, 1, "A workflow new to the repository");
}

console.log(JSON.stringify({ findings }));
