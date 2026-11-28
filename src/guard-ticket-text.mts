#!/usr/bin/env node
// PreToolUse hook for Bash, run as `kodor guard ticket-text` or within
// `kodor guard`. Refuses `gh issue create`,
// `gh issue edit`, and `gh issue comment` when the text they post holds a
// bare tag-like `<word>` outside code spans, code fences, and HTML
// comments. GitHub drops an unknown tag, so `/study/guides/<slug>/` shows as
// `/study/guides//`, and keeps a real one, so an unclosed `<code>` turns the
// rest of a list into code. Exit 2 blocks the call and shows stderr to
// Claude, which backticks the line and posts again.
//
// It also reads a `gh api` call to an issue or an issue comment
// (`repos/OWNER/REPO/issues`, `issues/N`, `issues/N/comments`, or
// `issues/comments/ID`) that sends a `body` field, through `-f body=TEXT`,
// `-F body=TEXT`, or `-F body=@FILE` and their `--raw-field` and `--field`
// forms, which is how a session posts without `gh issue`.
// GitHub serves a pull request's conversation comments, and its body, as
// an issue's, so those paths are read too; `gh pr` and `pulls/N` are not.

import { fencedLines } from "./lib/fences.mts";
import {
  APPROVER_LABELS,
  PR_LABELS,
  sameLabel,
  type Labels,
} from "./labels.mts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** The tags GitHub renders on purpose, which issue text may use bare. Not
 * `code` or `pre`: written bare, they are usually a placeholder, and an
 * unclosed one swallows what follows. */
const RENDERED = new Set([
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "dd",
  "del",
  "details",
  "div",
  "dl",
  "dt",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "ins",
  "kbd",
  "li",
  "mark",
  "ol",
  "p",
  "picture",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "source",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "tt",
  "u",
  "ul",
  "var",
]);

export type BareTag = { tag: string; line: string };

/** Blanks code fences, code spans, and HTML comments, keeping line breaks so
 * each remaining tag stays on its own line. */
function withoutCode(text: string): string {
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  const uncommented = text.replace(/<!--[\s\S]*?-->/g, blank);
  const fenced = fencedLines(uncommented);
  return uncommented
    .split("\n")
    .map((line, i) => (fenced[i] ? blank(line) : line))
    .join("\n")
    .replace(/(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g, blank);
}

/** Each tag-like `<word>` outside code that GitHub would not render as
 * meant, with the line it is on. */
export function bareTags(text: string): BareTag[] {
  const lines = text.split("\n");
  const found: BareTag[] = [];
  withoutCode(text)
    .split("\n")
    .forEach((line, i) => {
      for (const m of line.matchAll(/<\/?([A-Za-z][\w-]*)(?:\s[^<>]*)?\/?>/g))
        if (!RENDERED.has(m[1].toLowerCase()))
          found.push({ tag: m[0], line: lines[i] });
    });
  return found;
}

type Token = { word: string } | { op: string };

/** The command's words and separators, as a POSIX shell splits them, with
 * each `$(cat <<'X' … X)` heredoc read as the text it passes. */
function tokens(command: string): Token[] {
  const heredocs: string[] = [];
  const src = command.replace(
    /\$\(\s*cat\s+<<-?\s*(['"]?)(\w+)\1[^\n]*\n([\s\S]*?\n)\2[ \t]*\n?\s*\)/g,
    (_, _q, _tag, body: string) => `\u0000${heredocs.push(body) - 1}\u0000`,
  );
  const out: Token[] = [];
  let word: string | null = null;
  const end = () => {
    if (word !== null) out.push({ word });
    word = null;
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "'") {
      const close = src.indexOf("'", i + 1);
      const stop = close === -1 ? src.length : close;
      word = (word ?? "") + src.slice(i + 1, stop);
      i = stop;
    } else if (c === '"') {
      let text = "";
      for (i++; i < src.length && src[i] !== '"'; i++) {
        if (src[i] === "\\" && i + 1 < src.length) text += src[++i];
        else text += src[i];
      }
      word = (word ?? "") + text;
    } else if (c === "\\" && i + 1 < src.length) {
      word = (word ?? "") + src[++i];
    } else if (/\s/.test(c)) {
      if (c === "\n") {
        end();
        out.push({ op: "\n" });
      } else end();
    } else if (/[;&|()]/.test(c)) {
      end();
      out.push({ op: c });
    } else word = (word ?? "") + c;
  }
  end();
  return out.map((t) =>
    "word" in t
      ? { word: t.word.replace(/\u0000(\d+)\u0000/g, (_, n) => heredocs[n]) }
      : t,
  );
}

/** The text each `gh issue create|edit|comment` in the command posts, from
 * `--body`/`-b` or from the file `--body-file`/`-F` names, which `read`
 * returns, or null when it cannot, and the `body` field each `gh api` call
 * sends to an issue or an issue comment. */
export function issueBodies(
  command: string,
  read: (path: string) => string | null,
): string[] {
  const commands: string[][] = [[]];
  for (const t of tokens(command)) {
    if ("op" in t) commands.push([]);
    else commands[commands.length - 1].push(t.word);
  }
  const bodies: string[] = [];
  for (const words of commands) {
    if (words[0] === "gh" && words[1] === "api") {
      const body = apiBody(words.slice(2), read);
      if (body !== null) bodies.push(body);
      continue;
    }
    if (
      words[0] !== "gh" ||
      words[1] !== "issue" ||
      !["create", "edit", "comment"].includes(words[2])
    )
      continue;
    for (let i = 3; i < words.length; i++) {
      const w = words[i];
      const fromFile = (path: string | undefined) => {
        if (path === undefined || path === "-") return;
        const text = read(path);
        if (text !== null) bodies.push(text);
      };
      if (w === "--body" || w === "-b") {
        if (words[i + 1] !== undefined) bodies.push(words[++i]);
      } else if (w.startsWith("--body=")) bodies.push(w.slice(7));
      else if (w === "--body-file" || w === "-F") fromFile(words[++i]);
      else if (w.startsWith("--body-file=")) fromFile(w.slice(12));
    }
  }
  return bodies;
}

/** `gh api`'s options that take a value, so the value is not read as the
 * path. */
const API_VALUE_OPTIONS = new Set([
  "-X",
  "--method",
  "-H",
  "--header",
  "--input",
  "-q",
  "--jq",
  "-t",
  "--template",
  "--cache",
  "-p",
  "--preview",
  "--hostname",
]);

const ISSUE_PATH =
  /^\/?repos\/[^/]+\/[^/]+\/issues(?:\/\d+(?:\/comments)?|\/comments\/\d+)?\/?$/;

/** The `body` field a `gh api` call (its words after `gh api`) sends to an
 * issue or an issue comment, or null when it sends none there. A `-F`
 * value starting with `@` names a file, which `read` returns. */
function apiBody(
  words: string[],
  read: (path: string) => string | null,
): string | null {
  let path: string | undefined;
  let body: string | null = null;
  for (let i = 0; i < words.length; i++) {
    let w = words[i];
    let raw: boolean | undefined;
    if (w === "-f" || w === "--raw-field") raw = true;
    else if (w === "-F" || w === "--field") raw = false;
    else if (w.startsWith("--raw-field=")) [raw, w] = [true, w.slice(12)];
    else if (w.startsWith("--field=")) [raw, w] = [false, w.slice(8)];
    if (raw !== undefined) {
      const field = w.startsWith("-") ? (words[++i] ?? "") : w;
      if (!field.startsWith("body=")) continue;
      const value = field.slice(5);
      body =
        !raw && value.startsWith("@")
          ? value === "@-"
            ? null
            : read(value.slice(1))
          : value;
    } else if (API_VALUE_OPTIONS.has(w)) i++;
    else if (!w.startsWith("-") && path === undefined) path = w;
  }
  return path !== undefined && ISSUE_PATH.test(path) ? body : null;
}

export function refusal(tags: BareTag[]): string {
  const lines = tags.map((t) => `  ${t.tag} in: ${t.line.trim()}`);
  return [
    "Blocked by kodor guard ticket-text: this ticket text has a bare tag-like",
    "<word> that GitHub drops or renders as HTML. Put each placeholder or tag",
    "name in backticks, then post again:",
    ...lines,
  ].join("\n");
}

/** The refusal for this Bash call, or null to let it through. */
export function checkTicketText(input: {
  cwd?: string;
  tool_input?: { command?: string };
}): string | null {
  const cwd = input.cwd ?? ".";
  const read = (path: string) => {
    try {
      return readFileSync(resolve(cwd, path), "utf8");
    } catch {
      return null;
    }
  };
  const tags = issueBodies(input.tool_input?.command ?? "", read).flatMap(
    bareTags,
  );
  return tags.length === 0 ? null : refusal(tags);
}

/** Throws the refusal when a body a command is about to post has a bare
 * tag, so `kodor ticket` and `kodor pr comment` post nothing. */
export function refuseBareTags(text: string): void {
  const tags = bareTags(text);
  if (tags.length > 0) throw new Error(refusal(tags));
}

/** An approver's pass of the review verdict for one commit, which no agent
 * adds ("What merges without the owner" in rules.md), by its key or by
 * `name`, the name the settings give it. */
export function refuseOverride(
  label: string,
  names: Pick<Labels["codeHost"], "verdict-override" | "policy-override">,
): void {
  const given = label.trim();
  const what = {
    "verdict-override": "an approver's pass of the review verdict",
    "policy-override":
      "an approver's acceptance of what an approval policy found",
  };
  for (const key of APPROVER_LABELS)
    if ([PR_LABELS[key], names[key]].some((n) => sameLabel(n, given)))
      throw new Error(
        `Refused: the ${names[key]} label is ${what[key]}, which an agent never adds.`,
      );
}
