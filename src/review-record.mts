// What the last job of a review does with the session's answer: the threads,
// the summary, the status on the commit reviewed, and the verdict. It holds
// no AI, and it takes nothing from the answer but text, a file and line, and
// the thread a reply is for.
import type { CodeHost } from "./code-host/index.mts";
import type { RunFile } from "./handoff/index.mts";
import { withoutMarkers } from "./handoff/requests.mts";
import { fencedLines } from "./lib/fences.mts";
import { apply, REVIEW } from "./review-verdict.mts";

const SEVERITIES = ["High", "Medium", "Low"] as const;
const VERDICTS = ["ready", "changes"] as const;
const MOST = 30;

export type Finding = {
  file: string;
  /** Null for one about no line. */
  line: number | null;
  severity: (typeof SEVERITIES)[number];
  title: string;
  body: string;
};

export type Answer = {
  verdict: (typeof VERDICTS)[number];
  summary: string;
  findings: Finding[];
  /** Replies to threads of earlier reviews, each by its first comment. */
  rejections: { thread: number; body: string }[];
};

const text = { type: "string" };
const objectOf = (properties: object) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const listOf = (properties: object) => ({
  type: "array",
  maxItems: MOST,
  items: objectOf(properties),
});

/** The shape a review's session answers in. */
export const REVIEW_SCHEMA: object = objectOf({
  verdict: { type: "string", enum: VERDICTS },
  summary: text,
  findings: listOf({
    file: text,
    line: { type: ["integer", "null"], minimum: 1 },
    severity: { type: "string", enum: SEVERITIES },
    title: text,
    body: text,
  }),
  rejections: listOf({ thread: { type: "integer" }, body: text }),
});

type Checks = Record<string, (value: unknown) => boolean>;

const isText = (v: unknown) => typeof v === "string";
const isOneOf = (list: readonly unknown[]) => (v: unknown) => list.includes(v);

/** Whether it is an object with those properties, each as its check says,
 * and no other. */
function fits(value: unknown, checks: Checks): boolean {
  if (typeof value !== "object" || value === null) return false;
  const names = Object.keys(checks);
  return (
    Object.keys(value).length === names.length &&
    names.every((name) =>
      checks[name]((value as Record<string, unknown>)[name]),
    )
  );
}

const isList = (checks: Checks) => (v: unknown) =>
  Array.isArray(v) && v.length <= MOST && v.every((item) => fits(item, checks));

const ANSWER: Checks = {
  verdict: isOneOf(VERDICTS),
  summary: isText,
  findings: isList({
    file: isText,
    line: (v) => v === null || (Number.isInteger(v) && (v as number) > 0),
    severity: isOneOf(SEVERITIES),
    title: isText,
    body: isText,
  }),
  rejections: isList({ thread: Number.isInteger, body: isText }),
};

/** The answer in the file the session's job handed over, checked here
 * whatever checked it before. */
export function readAnswer(json: string): Answer {
  let read: unknown;
  try {
    read = JSON.parse(json);
  } catch {
    throw new Error("The review's answer is not JSON.");
  }
  if (!fits(read, ANSWER))
    throw new Error("The review's answer is not in the shape asked for.");
  return read as Answer;
}

// A comment's limit on GitHub is 65,536 characters, and the GitHub CLI takes
// one as an argument of at most 128 KB, which is this many of three bytes.
const COMMENT = 40_000;
const BODY = 30_000;
const TITLE = 200;

const oneLine = (s: string) =>
  withoutMarkers(s).replace(/\s+/g, " ").trim().slice(0, TITLE);

/** The AI's text as it is posted, hiding nothing that is posted after it. */
function posted(s: string): string {
  const whole = withoutMarkers(s).trim();
  const kept = closed(whole.slice(0, BODY));
  return whole.length > BODY
    ? `${kept}\n\n(The rest was too long to post.)`
    : kept;
}

/** The text with the code block it leaves open, if any, closed. */
function closed(s: string): string {
  const open = (t: string) => fencedLines(`${t}\n`).at(-1);
  if (!open(s)) return s;
  const fences = [...s.matchAll(/^\s*(`{3,}|~{3,})/gm)].map((m) => m[1]);
  return `${s}\n${fences.find((fence) => !open(`${s}\n${fence}`))}`;
}

const thread = (f: Finding) =>
  `**${f.severity}:** ${oneLine(f.title)}\n\n${posted(f.body)}`;

function listed(f: Finding): string {
  const file = oneLine(f.file.replaceAll("`", " "));
  const at = !file
    ? ""
    : f.line === null
      ? ` (\`${file}\`)`
      : ` (\`${file}:${f.line}\`)`;
  return `**${f.severity}:** ${oneLine(f.title)}${at}\n\n${posted(f.body)}`;
}

/** The pieces in order, in as few comments as hold them. */
function packed(pieces: string[]): string[] {
  const comments: string[] = [];
  for (const piece of pieces.filter(Boolean)) {
    const last = comments.at(-1);
    if (last !== undefined && last.length + piece.length < COMMENT)
      comments[comments.length - 1] = `${last}\n\n${piece}`;
    else comments.push(piece);
  }
  return comments;
}

export type RecordDeps = {
  run: RunFile;
  codeHost: CodeHost;
  /** Null when the session gave none. */
  answer: Answer | null;
  /** How the session's job ended: success, failure, cancelled, or skipped. */
  conclusion: string;
  /** The page of this run. */
  link?: string;
  /** The override's name, as `code-host.labels` gives it. */
  override?: string;
  /** False where the settings turn the automated review off. */
  reviewOn?: boolean;
  out(line: string): void;
};

const reason = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Posts the answer's threads, replies, and summary. Whatever the code host
 * takes nowhere else goes in the summary, so none of it is lost. */
async function post(
  d: RecordDeps,
  answer: Answer,
  pull: number,
  o: { ready: boolean; finished: boolean },
): Promise<void> {
  const { codeHost, out } = d;
  const sha = d.run.base;
  const done = async (what: string, act: () => Promise<unknown>) => {
    try {
      return (await act()) !== false;
    } catch (error) {
      out(`Could not post ${what}: ${reason(error)}`);
      return false;
    }
  };

  const open = answer.rejections.length
    ? (await codeHost.threads(pull)).filter((t) => !t.isResolved)
    : [];
  const unsaid: string[] = [];
  for (const { thread: id, body } of answer.rejections) {
    const said =
      open.some((t) => t.commentId === id) &&
      (await done(`a reply on thread ${id}`, () =>
        codeHost.reply(pull, id, posted(body)),
      ));
    if (!said) unsaid.push(`On thread ${id}:\n\n${posted(body)}`);
  }

  const unplaced: Finding[] = [];
  for (const f of answer.findings) {
    const { file: path, line, severity } = f;
    const placed =
      severity !== "Low" &&
      line !== null &&
      (await done(`a finding on ${path}:${line}`, () =>
        codeHost.commentOn(pull, { sha, path, line, body: thread(f) }),
      ));
    if (!placed) unplaced.push(f);
  }

  const verdict = o.ready
    ? "Ready to merge."
    : o.finished
      ? "Not ready to merge."
      : "Not ready to merge: the review did not finish.";
  const comments = packed([
    verdict,
    posted(answer.summary),
    ...unplaced.map(listed),
    ...unsaid,
  ]);
  const marks = `<!-- review-verdict: ${o.ready ? "ready" : "changes"} -->\n<!-- claude-review sha=${sha} -->`;
  for (const [i, body] of comments.entries())
    await codeHost.comment(
      pull,
      i === comments.length - 1 ? `${body}\n\n${marks}` : body,
    );
  out(
    `Posted the review: ${answer.findings.length} findings, ${unplaced.length} of them in the summary.`,
  );
}

/** Records a review, and gives the exit code of the job that does. */
export async function recordReview(d: RecordDeps): Promise<number> {
  const { run, codeHost, answer, out } = d;
  const { pull, base: sha } = run;
  if (run.kind !== "review" || pull === null)
    throw new Error("This run reviews no pull request.");
  if ((await codeHost.get(pull)).head.sha !== sha) {
    out(
      `#${pull} has a newer commit than the one reviewed, ${sha}, so nothing is posted.`,
    );
    return 0;
  }

  const skipped = answer === null && d.conclusion === "skipped";
  let finished = answer !== null && d.conclusion === "success";
  let ready =
    finished &&
    answer?.verdict === "ready" &&
    answer.findings.every((f) => f.severity === "Low");
  let code = 0;
  if (answer)
    try {
      await post(d, answer, pull, { ready, finished });
    } catch (error) {
      out(`Could not post the review: ${reason(error)}`);
      finished = ready = false;
      code = 1;
    }
  if (!skipped)
    await codeHost.setStatus(sha, {
      name: REVIEW,
      state: ready ? "success" : "failure",
      description: ready
        ? "Ready to merge"
        : finished
          ? "Asked for changes"
          : "Did not finish",
      ...(d.link === undefined ? {} : { link: d.link }),
    });
  await apply({
    eventName: "review",
    event: {
      pull,
      sha,
      conclusion: skipped ? "skipped" : finished ? "success" : "failure",
      verdict: ready ? "ready" : "changes",
    },
    pulls: codeHost,
    log: out,
    ...(d.link === undefined ? {} : { link: d.link }),
    ...(d.override === undefined ? {} : { override: d.override }),
    ...(d.reviewOn === undefined ? {} : { reviewOn: d.reviewOn }),
  });
  return code;
}
