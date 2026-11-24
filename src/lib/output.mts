// What every command prints through, and the one table of looks. A command
// says what a line is, such as a heading or a row, and never its color.
// "A command's output" in docs/developing.md says when to use each.
import { styleText } from "node:util";
import { COMMANDS } from "../commands-list.mts";

/** Each look, by what it means. docs/developing.md has the same table. */
export const ROLES = {
  heading: ["bold", "underline"],
  name: ["bold"],
  skip: ["dim"],
  copy: ["cyan"],
  yourTurn: ["yellow"],
  good: ["green"],
  bad: ["red"],
} as const;
export type Role = keyof typeof ROLES;

/** Words with a role, or with none, where nothing in them colors itself. */
export type Part = { role?: Role; text: string; url?: string };
/** A string's marks, commands, and addresses color themselves. */
export type Piece = string | Part;

/** One line to print, made only by the functions below. */
export class Line {
  readonly #parts: readonly Part[];
  readonly #own: boolean;
  constructor(parts: readonly Part[], own = false) {
    this.#parts = parts;
    this.#own = own;
  }
  /** Whether nothing said what the line is, for the tests' printer. */
  static isText(line: Line): boolean {
    return line.#own;
  }
  static parts(line: Line): readonly Part[] {
    return line.#parts;
  }
}

/** Whether output to `stream` is colored, by Node's own rule: a terminal
 * unless NO_COLOR, NODE_DISABLE_COLORS, or TERM=dumb, or wherever
 * FORCE_COLOR says. */
export function colorOn(
  stream: NodeJS.WritableStream = process.stdout,
): boolean {
  return styleText("red", "x", { stream }) !== "x";
}

/** Paints `text` when `color`. The decision is made by `colorOn`, so
 * painting skips Node's own check of standard output. */
export const painted = (role: Role, text: string, color: boolean): string =>
  color ? styleText([...ROLES[role]], text, { validateStream: false }) : text;

const ESC = "\u001b";

/** A line as it is printed, linked and painted when `color`. Parts side by
 * side with one role are painted as one. */
export function render(line: Line, color: boolean): string {
  let out = "";
  let run = "";
  let role: Role | undefined;
  const end = () => {
    out += role && run ? painted(role, run, color) : run;
    run = "";
  };
  for (const part of Line.parts(line)) {
    if (part.role !== role) end();
    role = part.role;
    run +=
      part.url && color
        ? `${ESC}]8;;${part.url}${ESC}\\${part.text}${ESC}]8;;${ESC}\\`
        : part.text;
  }
  end();
  return out;
}

// ------------------------------------------------- What colors itself

const MARKS: Record<string, Role> = {
  "✓": "good",
  "✗": "bad",
  "⚠": "bad",
  "?": "yourTurn",
  "-": "skip",
};
const LEADING_MARK = /^(\s*)([✓✗⚠?-])(?= \S)/;
const FAILURE = /^(\s*)(Could not [^:]*:?)/;
const ADDRESS = /\bhttps?:\/\/[^\s"'`<>]+/g;
const RUN = /\bRun: (?=\S)/g;
const SKILL =
  /(?<![\w./-])\/factory-[a-z][a-z-]*(?: (?:[A-Z][\w-]*|\d+)(?![\w-]))?/g;
const FACTORY = /(?<![\w./@-])factory(?= [a-z])/g;
/** What ends a sentence or a clause, and not a command or an address. */
const ENDING = /[.,:;!?)'"`]+$/;

/** An argument, where the word after a command could also be prose: prose
 * is lowercase letters alone. */
const isArgument = (word: string) => /[^a-z]/.test(word);

/** How long the `factory` command that starts `text` is, or 0 when the
 * words name no command. */
function commandLength(text: string): number {
  const words = text.split(" ");
  const bare = (w: string | undefined) => (w ?? "").replace(ENDING, "");
  const command = COMMANDS.filter((c) =>
    c.words.every((w, i) =>
      i === c.words.length - 1 ? bare(words[i + 1]) === w : words[i + 1] === w,
    ),
  ).sort((a, b) => b.words.length - a.words.length)[0];
  if (!command) return 0;
  const taking = new Set(
    [...command.args.matchAll(/(--[a-z-]+) [^\s\]|-]/g)].map((m) => m[1]),
  );
  let positional = command.args
    .replace(/--[a-z-]+(?: [^\s\]|-][^\s\]]*)?/g, "")
    .split(/[\s|]+/)
    .filter((w) => /[A-Z]|"/.test(w)).length;
  let last = command.words.length;
  // A word that ends a clause ends the command.
  const ended = () => ENDING.test(words[last]!);
  while (!ended() && last + 1 < words.length) {
    const next = bare(words[last + 1]);
    if (next.startsWith("--")) {
      last++;
      if (taking.has(next) && !ended() && last + 1 < words.length) last++;
    } else if (/^\[.*\]?$/.test(next) && words[last + 1] !== "") last++;
    else if (positional > 0 && next !== "" && isArgument(next)) {
      positional--;
      last++;
    } else break;
  }
  const whole = words.slice(0, last + 1).join(" ");
  return bare(whole).length;
}

type Span = { at: number; end: number; role: Role };

/** The parts of a string that color themselves, in order. `starts` is
 * whether the string starts its line. */
function selfColored(text: string, starts: boolean): Part[] {
  const spans: Span[] = [];
  const add = (at: number, end: number, role: Role) => {
    if (end > at && !spans.some((s) => at < s.end && s.at < end))
      spans.push({ at, end, role });
  };
  if (starts) {
    const mark = LEADING_MARK.exec(text);
    if (mark) {
      const at = mark[1]!.length;
      add(at, at + mark[2]!.length, MARKS[mark[2]!]!);
    }
    const failure = FAILURE.exec(text);
    if (failure) add(failure[1]!.length, failure[0].length, "bad");
  }
  for (const m of text.matchAll(RUN)) {
    const at = m.index + m[0].length;
    const rest = text.slice(at).split(/(?<=\.) (?=[A-Z])/)[0]!;
    add(at, at + rest.replace(ENDING, "").length, "copy");
  }
  for (const m of text.matchAll(FACTORY))
    add(m.index, m.index + commandLength(text.slice(m.index)), "copy");
  for (const m of text.matchAll(ADDRESS))
    add(m.index, m.index + m[0].replace(ENDING, "").length, "copy");
  for (const m of text.matchAll(SKILL))
    add(m.index, m.index + m[0].length, "copy");
  spans.sort((a, b) => a.at - b.at);
  const parts: Part[] = [];
  let from = 0;
  for (const s of spans) {
    if (s.at > from) parts.push({ text: text.slice(from, s.at) });
    parts.push({ role: s.role, text: text.slice(s.at, s.end) });
    from = s.end;
  }
  if (from < text.length) parts.push({ text: text.slice(from) });
  return parts;
}

const partsOf = (pieces: readonly Piece[], starts: boolean): Part[] =>
  pieces.flatMap((p, i) =>
    typeof p === "string" ? selfColored(p, starts && i === 0) : [p],
  );

// ------------------------------------------------------ Words in a line

/** The one name a line is about. */
export const name = (text: string): Part => ({ role: "name", text });
/** Another tool's command, or anything else the person copies. */
export const copy = (text: string): Part => ({ role: "copy", text });
export const skip = (text: string): Part => ({ role: "skip", text });
/** What is never colored: text of the person's own, or another tool's. */
export const asIs = (text: string): Part => ({ text });

// ------------------------------------------------------ Kinds of line

const pad = (n: number) => " ".repeat(Math.max(0, n));
/** A cell's words, and after them the spaces to the next cell. */
const cell = (role: Role, text: string, width: number): Part[] => [
  { role, text },
  { text: pad(width - [...text].length) },
];

export const BLANK = new Line([]);

/** What names a block. */
export const heading = (text: string, o: { indent?: number } = {}): Line =>
  new Line([{ text: pad(o.indent ?? 0) }, { role: "heading", text }]);

/** The names of a table's columns, each but the last padded to its width. */
export const heads = (
  cells: readonly (readonly [text: string, width: number])[],
  o: { indent?: number } = {},
): Line =>
  new Line([
    { text: pad(o.indent ?? 0) },
    ...cells.flatMap(([text, width], i) =>
      i === cells.length - 1
        ? [{ role: "heading", text } as Part]
        : cell("heading", text, width),
    ),
  ]);

export type MarkKind = "ok" | "fail" | "look" | "off" | "flag";
const MARK_OF: Record<MarkKind, string> = {
  ok: "✓",
  fail: "✗",
  look: "?",
  off: "-",
  flag: "⚠",
};
export const markPart = (kind: MarkKind): Part => ({
  role: MARKS[MARK_OF[kind]],
  text: MARK_OF[kind],
});

const valueOf = (value: Piece | readonly Piece[]): Part[] =>
  value === "none yet"
    ? [skip(value)]
    : partsOf(Array.isArray(value) ? value : [value as Piece], false);

/** A label, padded to `width`, then a value. `mark` goes before the label;
 * null leaves its place empty. */
export function row(
  label: string,
  value: Piece | readonly Piece[],
  o: {
    width: number;
    indent?: number;
    gap?: number;
    mark?: MarkKind | null;
    /** A label the person types, such as the usage's commands. */
    typed?: boolean;
  },
): Line {
  const before: Part[] =
    o.mark === undefined
      ? []
      : [o.mark === null ? { text: " " } : markPart(o.mark), { text: " " }];
  return new Line([
    { text: pad(o.indent ?? 2) },
    ...before,
    ...cell(o.typed ? "copy" : "name", label, o.width),
    { text: pad(o.gap ?? 1) },
    ...valueOf(value),
  ]);
}

/** One numbered step of what the person does. */
export const step = (
  n: number,
  pieces: Piece | readonly Piece[],
  o: { indent?: number } = {},
): Line =>
  new Line([
    { text: pad(o.indent ?? 2) },
    { role: "yourTurn", text: `${n}.` },
    { text: " " },
    ...partsOf(Array.isArray(pieces) ? pieces : [pieces as Piece], false),
  ]);

/** What heads a list the person does, or asks them for one thing, and what
 * follows on its line. */
export const action = (head: string, ...rest: Piece[]): Line =>
  new Line([{ role: "yourTurn", text: head }, ...partsOf(rest, false)]);

/** A mark and a few words. */
export const mark = (
  kind: MarkKind,
  pieces: Piece | readonly Piece[],
  o: { indent?: number } = {},
): Line =>
  new Line([
    { text: pad(o.indent ?? 0) },
    markPart(kind),
    { text: " " },
    ...partsOf(Array.isArray(pieces) ? pieces : [pieces as Piece], false),
  ]);

/** That work is running, and nothing is asked. */
export const note = (text: string): Line => new Line([skip(text)]);

/** A row of more cells than a label and a value, each part saying its own
 * role or none. */
export const cells = (parts: readonly Part[]): Line => new Line(parts);

/** A line that is none of the others. */
export const text = (...pieces: Piece[]): Line =>
  new Line(partsOf(pieces, true), true);

/** Another tool's line, or a settings file's: nothing in it colors itself.
 * From `skipFrom` on it is dim. */
export const verbatim = (line: string, skipFrom = line.length): Line =>
  new Line(
    [{ text: line.slice(0, skipFrom) }, skip(line.slice(skipFrom))].filter(
      (p) => p.text,
    ),
  );

// ---------------------------------------------------------- Printing

export type Out = (line: Line) => void;

/** Prints `text` and a line break. The console swallows what a closed pipe
 * throws, as in `factory status | head`; a stream's own write would not. */
function printLine(text: string, stream: NodeJS.WritableStream): void {
  if (stream === process.stdout) console.log(text);
  else if (stream === process.stderr) console.error(text);
  else stream.write(`${text}\n`);
}

/** Prints lines to `stream`, in color when that stream takes it. */
export function printer(
  stream: NodeJS.WritableStream = process.stdout,
  color = colorOn(stream),
): Out {
  return (line) => printLine(render(line, color), stream);
}

/** Prints strings to `stream` as they are: a machine's command. */
export function plainPrinter(
  stream: NodeJS.WritableStream = process.stdout,
): (line?: string | Line) => void {
  return (line = "") =>
    printLine(typeof line === "string" ? line : render(line, false), stream);
}

/** One line of a machine's command, on standard output or standard error. */
export const plain = plainPrinter(process.stdout);
export const plainError = plainPrinter(process.stderr);

/** Writes to `stream` with no line break of its own. */
export const write = (
  text: string,
  stream: NodeJS.WritableStream = process.stdout,
): void => void stream.write(text);

/** The two printers of the command named by its words: never in color for
 * one a machine reads. */
export function printersFor(words: string): { out: Out; err: Out } {
  const person = COMMANDS.some(
    (c) => c.reads === "person" && c.words.join(" ") === words,
  );
  return person
    ? { out: printer(process.stdout), err: printer(process.stderr) }
    : { out: plainPrinter(process.stdout), err: plainPrinter(process.stderr) };
}

// ------------------------------------------------------ A whole screen

/** The alternate screen with the cursor hidden, and back. */
export const ENTER_SCREEN = `${ESC}[?1049h${ESC}[?25l`;
export const LEAVE_SCREEN = `${ESC}[?25h${ESC}[?1049l`;

/** A frame that overwrites the one on screen: home, each line erased to its
 * end, then everything below. No newline ends it, which would scroll a
 * frame as tall as the window. */
export function frame(lines: readonly Line[], color: boolean): string {
  return `${ESC}[H${lines.map((l) => `${render(l, color)}${ESC}[K`).join("\n")}${ESC}[J`;
}
