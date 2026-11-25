// What a session in the cloud asks for. It has no sign-in, so a `factory`
// command of its that would write is kept, with the files it names, and a
// job with no AI runs it later. That job runs only what is listed here, and
// only on this run's own ticket and pull request: a session that was talked
// into asking for more gets nothing.

/** A command and the text of each file it names. */
export type Asked = { argv: string[]; files: Record<string, string> };

export type Kind = "build" | "review" | "answer" | "conflict" | "dependency";

/** What a run may write to. */
export type ThisRun = {
  kind: Kind;
  ticket: string | null;
  pull: number | null;
  /** The comments that start this pull request's threads, or null in the
   * session itself, which Publish checks again. */
  comments: number[] | null;
  branch: string;
  /** The commit the run started from. */
  base: string;
  /** Open tickets this kind of run opened before for the same pull request,
   * which it comments on in place of opening another. */
  opened: string[];
};

/** The hidden markers a run's comment may carry, for the next run to find:
 * what each kind of run records about its own pull request. */
function markersOf(run: ThisRun): string[] {
  switch (run.kind) {
    case "conflict":
      return [
        "<!-- conflict-fix -->",
        `<!-- conflict-stop head=${run.base} -->`,
      ];
    case "dependency":
      return ["<!-- factory-deps -->"];
    case "answer":
      return ["<!-- session-handoff -->"];
    default:
      return [];
  }
}

const TITLE = 200;
const WORD = 1000;
const BODY = 60_000;
const PULL_BODY = 20_000;
const COMMANDS = 200;

/** The flags whose value is a file the command reads. */
const FILE_FLAGS = new Set(["--body-file", "--before-file"]);

const WRITES: Record<string, (rest: string[]) => boolean> = {
  "ticket label": (rest) => !rest.includes("--was-removed"),
  "ticket refined": (rest) => !rest.includes("--check"),
  "ticket repositories": (rest) =>
    rest.includes("--set") || rest.includes("--add"),
};
for (const c of [
  "ticket claim",
  "ticket refining",
  "ticket waiting",
  "ticket ready",
  "ticket stop",
  "ticket end",
  "ticket cost",
  "ticket adopt",
  "ticket edit",
  "ticket comment",
  "ticket open",
  "ticket block",
  "ticket unblock",
  "pr reply",
  "pr resolve",
  "pr ready",
  "pr cost",
  "pr adopt",
  "pr comment",
  "pr follow-ups",
  "pr label",
  "pr open",
  "pr review-again",
])
  WRITES[c] = () => true;

/** Whether a command would write to the ticket system or the code host. */
export function isWrite(argv: string[]): boolean {
  if (argv[0] === "follow-up") return true;
  return WRITES[`${argv[0]} ${argv[1]}`]?.(argv.slice(2)) ?? false;
}

/** The command as it is handed over. */
export function ask(argv: string[], readFile: (path: string) => string): Asked {
  const files: Record<string, string> = {};
  argv.forEach((word, i) => {
    const path = argv[i + 1];
    if (FILE_FLAGS.has(word) && path !== undefined)
      files[path] = readFile(path);
  });
  return { argv, files };
}

/** The text with the factory's hidden markers, which are HTML comments,
 * taken out, so a session cannot post one that a command takes as a record.
 * One in code stays readable and stops being a comment. */
export function withoutMarkers(text: string): string {
  // A space in place of each, since taking one out could join what is around
  // it into another.
  const without = (part: string) => part.replace(/<!--[\s\S]*?(?:-->|$)/g, " ");
  return text
    .split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/)
    .map((part, i) =>
      i % 2
        ? part.replaceAll("<!--", "&lt;!--").replaceAll("-->", "--&gt;")
        : without(part),
    )
    .join("");
}

type Rule = {
  /** The words after the command's name: a check for each value, and each
   * flag with its own. */
  words: ((word: string, run: ThisRun) => boolean)[];
  flags?: Record<string, "file" | "title" | "alone">;
  /** The flags it cannot do without. */
  needs?: string[];
  when?: (run: ThisRun) => boolean;
};

const any = () => true;
const ownTicket = (word: string, run: ThisRun) => word === run.ticket;
const ownOrOpened = (word: string, run: ThisRun) =>
  word === run.ticket || run.opened.includes(word);
const ownPull = (word: string, run: ThisRun) => word === String(run.pull);
const ownThread = (word: string, run: ThisRun) =>
  run.comments === null || run.comments.some((id) => String(id) === word);
const BODY_FILE = { "--body-file": "file" } as const;
const BODIED = { flags: BODY_FILE, needs: ["--body-file"] };
const TITLED = ["--title", "--body-file"];

const RULES: Record<string, Rule> = {
  "ticket comment": { words: [ownOrOpened], ...BODIED },
  "ticket edit": { words: [ownTicket], ...BODIED },
  "ticket stop": { words: [ownTicket, any] },
  "ticket end": { words: [ownTicket] },
  "ticket open": {
    words: [],
    flags: { "--title": "title", ...BODY_FILE },
    needs: TITLED,
    when: (run) => run.kind === "conflict" || run.kind === "dependency",
  },
  // What a review finds is a finding, and a dependency's pull request is its
  // bot's to describe.
  "follow-up": {
    words: [any, any],
    when: (run) => run.kind === "build" || run.kind === "answer",
  },
  "pr open": {
    words: [],
    flags: { "--title": "title", ...BODY_FILE, "--draft": "alone" },
    needs: TITLED,
    when: (run) => run.kind === "build" && run.pull === null,
  },
  "pr reply": { words: [ownPull, ownThread], ...BODIED },
  "pr resolve": { words: [ownPull, ownThread] },
  "pr comment": { words: [ownPull], ...BODIED },
  "pr review-again": { words: [ownPull] },
};

/** A word as one line, so it cannot pass for a line of its own. */
const oneLine = (word: string, most = WORD) =>
  withoutMarkers(word).replace(/\s+/g, " ").trim().slice(0, most);

/** The command as Publish may run it, or why it may not. */
export function allow(asked: Asked, run: ThisRun): Asked | { refused: string } {
  const shown = asked.argv.slice(0, 3).join(" ");
  const refuse = (why: string) => ({ refused: `factory ${shown}: ${why}` });
  const name =
    asked.argv[0] === "follow-up"
      ? "follow-up"
      : asked.argv.slice(0, 2).join(" ");
  const rule = Object.hasOwn(RULES, name) ? RULES[name] : undefined;
  if (!rule) return refuse("a session can't ask for this");
  if (rule.when && !rule.when(run)) return refuse("not in this run");

  const argv = name.split(" ");
  const files: Record<string, string> = {};
  const rest = asked.argv.slice(argv.length);
  let at = 0;
  for (let i = 0; i < rest.length; i++) {
    const word = rest[i];
    const takes = Object.hasOwn(rule.flags ?? {}, word)
      ? rule.flags![word]
      : undefined;
    if (takes === "alone") {
      argv.push(word);
      continue;
    }
    if (takes) {
      const value = rest[++i];
      if (value === undefined) return refuse(`${word} has no value`);
      if (takes === "title") argv.push(word, oneLine(value, TITLE));
      else {
        if (!Object.hasOwn(asked.files, value))
          return refuse(`${value} was not handed over`);
        const text = asked.files[value];
        const kept =
          name === "pr comment"
            ? markersOf(run).filter((marker) => text.includes(marker))
            : [];
        const most = name === "pr open" ? PULL_BODY : BODY;
        files[value] = [withoutMarkers(text).slice(0, most), ...kept].join(
          "\n",
        );
        argv.push(word, value);
      }
      continue;
    }
    if (word.startsWith("-")) return refuse(`it can't take ${word}`);
    const check = rule.words[at++];
    if (!check) return refuse("it takes fewer words");
    if (!check(word, run)) return refuse(`${word} is not this run's`);
    argv.push(oneLine(word));
  }
  if (at < rule.words.length) return refuse("it takes more words");
  for (const flag of rule.needs ?? [])
    if (!argv.includes(flag)) return refuse(`it needs ${flag}`);
  return { argv, files };
}

const only = (o: object, keys: string[]) =>
  Object.keys(o).every((k) => keys.includes(k));
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** The commands in the file a session handed over. */
export function readRequests(text: string): Asked[] {
  const bad = (why: string) => new Error(`request.json ${why}`);
  const read: unknown = JSON.parse(text);
  if (!isRecord(read) || read.version !== 1 || !Array.isArray(read.commands))
    throw bad("is not one this version reads");
  if (!only(read, ["version", "commands"])) throw bad("has an unknown key");
  if (read.commands.length > COMMANDS)
    throw bad(`asks for more than ${COMMANDS} commands`);
  return read.commands.map((c: unknown) => {
    if (!isRecord(c) || !only(c, ["argv", "files"]))
      throw bad("has a command with an unknown key");
    if (
      !Array.isArray(c.argv) ||
      !c.argv.every((w) => typeof w === "string") ||
      !isRecord(c.files) ||
      !Object.values(c.files).every((f) => typeof f === "string")
    )
      throw bad("has a command that is not text");
    return { argv: c.argv as string[], files: c.files as Asked["files"] };
  });
}
