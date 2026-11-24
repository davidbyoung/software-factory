// The last job of a run that started a session in the cloud: it checks what
// the session left and does it on the code host. It is the only job with a
// sign-in, it holds no AI, and nothing the session made is checked out or
// run here.
//
//   factory session publish    # with FACTORY_PUBLISH naming the folder
//
//   FACTORY_PUBLISH/in/run.json       from Prepare, as the session got it
//   FACTORY_PUBLISH/out/build.bundle  the session's commits
//   FACTORY_PUBLISH/out/request.json  the commands it asked for
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { CodeHost } from "./code-host/index.mts";
import { checkBundle, type BundleAnswer } from "./handoff/bundle.mts";
import type { RunFile } from "./handoff/index.mts";
import {
  allow,
  readRequests,
  withoutMarkers,
  type Asked,
  type ThisRun,
} from "./handoff/requests.mts";
import { costNote } from "./lib/usage.mts";
import { AGENT_MARK, commentBody } from "./lib/work-status.mts";
import {
  main as prMain,
  newestRuns,
  NO_CHECKS_MS,
  PASSED,
  withAgentMark,
  type Deps as PrDeps,
} from "./pr.mts";
import type { Runner } from "./runner/index.mts";
import type { Tickets } from "./tickets/types.mts";

/** Marks a pull request a build in the cloud opened, whose answers start by
 * themselves. No session can write it: its text loses every hidden marker. */
export const CLOUD_MARK = "<!-- factory: cloud-build -->";

/** Marks one the session left for its owner to mark ready. */
export const OWNER_MARK = "<!-- factory: owner-marks-ready -->";

/** The answers a pull request gets, whatever asked for them. */
export const ANSWERS = 4;

const CI_MS = 60 * 60 * 1000;
const POLL_MS = 15 * 1000;

export type PublishDeps = {
  run: RunFile;
  /** The folder the session's job handed over. */
  dir: string;
  codeHost: CodeHost;
  runner: Runner;
  tickets: Tickets;
  /** Runs a `factory ticket` or `factory follow-up` command, its files read
   * through `readFile`. */
  ticket(argv: string[], readFile: (path: string) => string): Promise<number>;
  pr: PrDeps;
  /** A bare clone of the repository, made now. */
  clone(): string;
  /** Pushes a commit from the clone to a branch, forward only, and throws
   * in the code host's words. */
  push(clone: string, commit: string, branch: string): void;
  /** How the session's job ended. */
  session: string;
  /** Whether the claim this run made is still the ticket's. */
  claimed(): Promise<boolean>;
  /** The message of each commit the bundle adds, from the clone. */
  messages(clone: string, tip: string): string[];
  /** The reviews that ask for changes a pull request is answered after. */
  reviewRounds: number;
  now(): number;
  sleep(ms: number): Promise<unknown>;
  /** Makes the sign-in new again, since waiting can outlast it. */
  signIn(): Promise<void>;
  out(line: string): void;
};

/** A request's files, as Publish names them, so no path of the session's
 * is ever opened. */
function filesOf(asked: Asked): {
  argv: string[];
  readFile: (path: string) => string;
} {
  const names = new Map(
    Object.keys(asked.files).map((path, i) => [path, `asked-${i}.md`]),
  );
  const texts = new Map(
    Object.entries(asked.files).map(([path, text]) => [names.get(path)!, text]),
  );
  return {
    argv: asked.argv.map((word) => names.get(word) ?? word),
    readFile: (path) => {
      const text = texts.get(basename(path));
      if (text === undefined) throw new Error(`${path} was not handed over`);
      return text;
    },
  };
}

const marked = (text: string) =>
  text.includes(AGENT_MARK) ? text : withAgentMark(text);

async function tell(d: PublishDeps, text: string): Promise<void> {
  const body = withAgentMark(text);
  if (d.run.pull !== null) await d.codeHost.comment(d.run.pull, body);
  else if (d.run.ticket !== null) await d.tickets.comment(d.run.ticket, body);
}

/** The bundle's answer, with a commit that closes another ticket refused:
 * a squash merge puts each commit's message in its own. */
function checked(d: PublishDeps, clone: string): BundleAnswer {
  const answer = checkBundle({
    repo: clone,
    bundle: join(d.dir, "out/build.bundle"),
    base: d.run.base,
    defaultBranch: d.run.defaultBranch,
    workflows: d.runner.workflowsFolder,
    ...(d.run.pull === null ? {} : { published: d.run.base }),
  });
  if ("refused" in answer) return answer;
  for (const message of d.messages(clone, answer.tip)) {
    const other = othersLinked(d, message);
    if (other)
      return { refused: `a commit's message closes ${d.tickets.ref(other)}` };
  }
  return answer;
}

/** A ticket the text links that is not this run's. */
function othersLinked(d: PublishDeps, text: string): string | undefined {
  const { closes, partOf } = d.tickets.linksIn(text);
  return [...closes, ...partOf].find((key) => key !== d.run.ticket);
}

async function refuse(d: PublishDeps, why: string): Promise<number> {
  const page = d.runner.thisRun(d.pr.env ?? {})?.page;
  const lines = [
    `Not pushed: ${why}${why.includes(" changes ") ? ", which a build in the cloud can't push" : ""}.`,
    `Build this ticket on your computer: tell a session to work it.${page ? ` The commits are in the run: ${page}` : ""}`,
  ];
  lines.forEach((line) => d.out(line));
  await tell(d, lines.join("\n"));
  return 1;
}

/** The open tickets a run of this kind opened for the same pull request, by
 * the titles their skills give them. */
async function openedBefore(d: PublishDeps): Promise<string[]> {
  const { kind, pull } = d.run;
  const title =
    kind === "conflict"
      ? `#${pull}: merge conflict with the default branch needs a decision`
      : kind === "dependency"
        ? `Dependabot #${pull}: `
        : null;
  if (title === null) return [];
  return (await d.tickets.listUnfinished())
    .filter((t) => t.title.startsWith(title))
    .map((t) => t.key);
}

/** Opens the run's pull request from what the session asked for. */
async function open(d: PublishDeps, asked: Asked): Promise<number> {
  const at = (flag: string) => asked.argv[asked.argv.indexOf(flag) + 1];
  const body = asked.files[at("--body-file")];
  const other = othersLinked(d, body);
  if (other)
    throw new Error(
      `the pull request's body links ${d.tickets.ref(other)}, which is not this run's`,
    );
  return d.codeHost.create({
    title: withoutMarkers(at("--title")),
    body: [
      body.trimEnd(),
      "",
      CLOUD_MARK,
      ...(asked.argv.includes("--draft") ? [OWNER_MARK] : []),
      "",
    ].join("\n"),
    head: d.run.branch,
    base: d.run.defaultBranch,
    draft: true,
  });
}

/** Why a pull request gets no further answer, or null when it does. */
async function spent(
  d: PublishDeps,
  pull: number,
  createdAt: string,
): Promise<string | null> {
  const asked = (await d.codeHost.comments(pull)).filter(
    (c) =>
      c.author === d.runner.poster &&
      c.body.includes("<!-- review-verdict: changes -->"),
  ).length;
  if (asked > d.reviewRounds)
    return `${d.reviewRounds} reviews were answered, and the next still asks for changes`;
  return (await d.runner.answersTo(pull, createdAt)) >= ANSWERS
    ? `it has had ${ANSWERS} answers`
    : null;
}

/** Starts the next answer to a pull request a build in the cloud opened, or
 * says on it that it waits for a person. */
export async function nextAnswer(d: PublishDeps, pull: number): Promise<void> {
  const { body, createdAt } = await d.codeHost.get(pull);
  if (!body.includes(CLOUD_MARK)) {
    d.out("No build in the cloud opened it, so a person has it answered.");
    return;
  }
  const why = await spent(d, pull, createdAt ?? "");
  if (why !== null) {
    d.out(`No answer starts: ${why}.`);
    await d.codeHost.comment(
      pull,
      withAgentMark(
        `This waits for a person: ${why}. What is still open is in its checks and threads.`,
      ),
    );
    return;
  }
  await d.runner.startAnswer(pull, d.run.defaultBranch);
  d.out(`Started an answer to #${pull}.`);
}

export async function publish(d: PublishDeps): Promise<number> {
  const { run } = d;
  const requests = join(d.dir, "out/request.json");
  let asked: Asked[];
  try {
    asked = existsSync(requests)
      ? readRequests(readFileSync(requests, "utf8"))
      : [];
  } catch (error) {
    d.out(`Refused every request: ${(error as Error).message}`);
    asked = [];
  }
  if (run.kind === "build" && !(await d.claimed())) {
    d.out("The claim ended before this run did, so nothing is published.");
    return 1;
  }

  let pull = run.pull;
  let tip: string | null = null;
  if (existsSync(join(d.dir, "out/build.bundle"))) {
    const clone = d.clone();
    const answer = checked(d, clone);
    if ("refused" in answer) return refuse(d, answer.refused);
    try {
      d.push(clone, answer.tip, run.branch);
    } catch (error) {
      return refuse(d, `the code host refused it: ${(error as Error).message}`);
    }
    tip = answer.tip;
    d.out(`Pushed ${answer.commits} commits to ${run.branch}.`);
  }

  const threads = pull === null ? [] : await d.codeHost.threads(pull);
  const mine: ThisRun = {
    kind: run.kind,
    ticket: run.ticket,
    pull,
    comments: threads.map((t) => t.commentId),
    branch: run.branch,
    base: run.base,
    opened: await openedBefore(d),
  };
  let failed = false;
  for (const one of asked) {
    const may = allow(one, { ...mine, pull });
    if ("refused" in may) {
      d.out(`Refused: ${may.refused}`);
      continue;
    }
    try {
      if (may.argv[0] === "pr" && may.argv[1] === "open") {
        if (tip === null) throw new Error("there is no commit to open it for");
        pull = await open(d, may);
        d.out(`Opened #${pull}.`);
        continue;
      }
      const { argv, readFile } = filesOf(may);
      const says = /^(?:pr|ticket) comment$/.test(argv.slice(0, 2).join(" "));
      const read = (path: string) =>
        says ? marked(readFile(path)) : readFile(path);
      const code =
        argv[0] === "pr"
          ? await prMain(argv.slice(1), {
              ...d.pr,
              readFile: read,
              out: (line) => d.out(`  ${line}`),
            })
          : await d.ticket(argv[0] === "ticket" ? argv.slice(1) : argv, read);
      if (code !== 0) throw new Error(`exit ${code}`);
    } catch (error) {
      failed = true;
      d.out(
        `Failed: factory ${one.argv.slice(0, 3).join(" ")}: ${(error as Error).message}`,
      );
    }
  }
  await postCost(d, pull);
  if (d.session !== "success" && tip === null) {
    const page = d.runner.thisRun(d.pr.env ?? {})?.page;
    d.out("The session did not finish.");
    await tell(
      d,
      `The session did not finish, and nothing of its was pushed.${page ? ` Its run: ${page}` : ""}`,
    );
  }
  if (pull !== null && tip !== null) await settle(d, pull, tip);
  return failed ? 1 : 0;
}

/** Notes what the session cost, for the board, as its job counted it. */
export async function postCost(
  d: Pick<PublishDeps, "dir" | "run" | "codeHost" | "tickets" | "out">,
  pull: number | null,
): Promise<void> {
  const file = join(d.dir, "out/cost.json");
  if (!existsSync(file)) return;
  const { dollars, session } = JSON.parse(readFileSync(file, "utf8")) as {
    dollars: unknown;
    session: unknown;
  };
  if (typeof dollars !== "number" || !/^[\w-]{1,64}$/.test(String(session)))
    return;
  const on = pull !== null ? `#${pull}` : d.run.ref;
  if (on === null) return;
  const cost = costNote(
    { ok: true, spend: { dollars, priced: 1, unpriced: new Map() } },
    on,
    String(session),
  );
  const body = commentBody({ kind: "cost", cost });
  if (pull !== null) await d.codeHost.comment(pull, body);
  else if (d.run.ticket !== null) await d.tickets.comment(d.run.ticket, body);
}

type Ci = "passed" | "failed" | "not finished";

/** How CI ended on the commit, waited for up to `CI_MS`. A commit that no
 * run has started on after a few minutes has no CI. */
async function ciOn(d: PublishDeps, tip: string): Promise<Ci> {
  const start = d.now();
  for (;;) {
    const runs = newestRuns(await d.runner.runs(tip));
    const waited = d.now() - start;
    if (runs.length === 0 && waited >= NO_CHECKS_MS) return "passed";
    if (runs.length > 0 && runs.every((r) => r.status === "completed"))
      return runs.every((r) => PASSED.includes(r.conclusion ?? ""))
        ? "passed"
        : "failed";
    if (waited >= CI_MS) return "not finished";
    await d.sleep(POLL_MS);
  }
}

/** Waits for CI on the commit, then marks the pull request ready or starts
 * the next answer. */
async function settle(
  d: PublishDeps,
  pull: number,
  tip: string,
): Promise<void> {
  const ci = await ciOn(d, tip);
  await d.signIn();
  d.out(`CI ${ci}.`);
  if (ci === "failed") return nextAnswer(d, pull);
  if (ci === "not finished") {
    await d.codeHost.comment(
      pull,
      withAgentMark(
        "CI has not finished after an hour, so this stays as it is until a person looks.",
      ),
    );
    return;
  }
  const now = await d.codeHost.get(pull);
  if (!now.isDraft) return;
  if (now.body.includes(OWNER_MARK)) {
    d.out("It stays a draft for its owner to mark ready.");
    return;
  }
  // A person may have pushed while this waited, and that commit's CI is not
  // the one that passed.
  if (now.head.sha !== tip) {
    d.out("The pull request has a newer commit, so it is not marked ready.");
    return;
  }
  await d.codeHost.ready(pull);
  d.out(`Marked #${pull} ready.`);
}
