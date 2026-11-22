#!/usr/bin/env node
// Records each reviewer agent's run on the issue its session works, in one
// "Reviewers in this session" comment per session, edited in place. The
// SubagentStart and SubagentStop hooks in .claude/settings.json run it with
// the hook's input on stdin:
//
//   npx --no-install factory reviewers start|stop
//
// It records only reviewers, the agents defined in the repository's
// .claude/agents/ folder, and only while the session's cost clock runs on
// an issue (`factory ticket claim` or `refining`). Recording a
// run never blocks the reviewer: every error exits 0, and a failed GitHub
// call shows the owner one warning line through `systemMessage`. Neither
// event carries the model, so the start reads it from the agent's
// definition, and the finish corrects it from the transcript.
//
// It reads the repository from the factory's settings only when it has a
// run to record, so a hook that fires before npm ci does nothing else.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { loadSettings } from "./config.mts";
import { targetOf } from "./config.mts";
import { openTickets } from "./tickets/index.mts";
import {
  NotFoundError,
  type Key,
  type NewEntry,
  type Tickets,
} from "./tickets/types.mts";
import { renderEntry } from "./tickets/record-comments.mts";
import { commonDir, readClock, type Clock } from "./lib/clock.mts";
import { subscriptionDollars } from "./lib/pricing.mts";
import { dollars, spendIn } from "./lib/usage.mts";
import {
  REVIEWER_RUNS_MARK,
  isStuck,
  runLine,
  utc,
  type ReviewerRun,
} from "./lib/work-status.mts";

export type HookInput = {
  session_id?: string;
  agent_id?: string;
  agent_type?: string;
  agent_transcript_path?: string;
  last_assistant_message?: string;
};

/** What the hook remembers between its runs: the comment it posted, and the
 * rows it shows. */
export type State = { commentId: string | null; runs: ReviewerRun[] };

export type Deps = {
  /** The ticket system the settings name, opened only when there is a run
   * to record. */
  tickets: () => Promise<Tickets>;
  now: () => Date;
  clock: (session: string) => Clock | null;
  /** The text of a file, or null when it cannot be read. */
  readFile: (path: string) => string | null;
  state: {
    read: (session: string, issue: Key) => State;
    write: (session: string, issue: Key, state: State) => void;
  };
  /** Runs `work` while no other hook of this session edits the comment. */
  locked: <T>(session: string, work: () => Promise<T>) => Promise<T>;
  out: (line: string) => void;
};

// The line as the definitions show it, also when a reviewer copies it in
// backticks or bold.
const VERDICT =
  /^[`*]*Verdict: (?:(pass)|fail, (\d+) findings? to fix)\.?[`*]*\s*$/gim;

/** The result a reviewer's report ends with. */
export function verdictOf(
  report: string,
): Pick<ReviewerRun, "result" | "findings"> {
  const last = [...report.matchAll(VERDICT)].at(-1);
  if (!last) return { result: "no verdict" };
  return last[1]
    ? { result: "passed" }
    : { result: "failed", findings: Number(last[2]) };
}

/** The last thing the agent said, from its transcript. */
export function lastAssistantText(transcript: string): string {
  let text = "";
  for (const line of transcript.split("\n")) {
    try {
      const entry = JSON.parse(line) as {
        type?: string;
        message?: { content?: unknown };
      };
      if (entry.type !== "assistant") continue;
      const content = entry.message?.content;
      const said = Array.isArray(content)
        ? content
            .filter(
              (b): b is { type: "text"; text: string } => b?.type === "text",
            )
            .map((b) => b.text)
            .join("\n")
        : typeof content === "string"
          ? content
          : "";
      if (said.trim()) text = said;
    } catch {
      continue;
    }
  }
  return text;
}

/** The report a reviewer handed its caller, which is a tool call's input
 * and so in neither the hook's last message nor the transcript's text. */
export function handedBack(transcript: string): string | null {
  let report: string | null = null;
  for (const line of transcript.split("\n")) {
    try {
      const entry = JSON.parse(line) as {
        type?: string;
        message?: { content?: unknown };
      };
      const content = entry.message?.content;
      if (entry.type !== "assistant" || !Array.isArray(content)) continue;
      for (const block of content) {
        const message =
          block?.type === "tool_use" && block.name === "SubagentHandback"
            ? block.input?.message
            : null;
        if (typeof message === "string") report = message;
      }
    } catch {
      continue;
    }
  }
  return report;
}

/** The model an agent's definition declares, as the row shows it. */
export function modelName(definition: string | null): string {
  const frontmatter = /^---\s*\n([\s\S]*?)\n---/.exec(definition ?? "")?.[1];
  const declared = /^model:\s*(\S+)/m.exec(frontmatter ?? "")?.[1];
  return declared ? familyName(declared) : "unknown";
}

/** "Sonnet" for `sonnet` or `claude-sonnet-5-5`. */
function familyName(model: string): string {
  const family = /(fable|opus|sonnet|haiku)/i.exec(model)?.[1] ?? model;
  return family[0].toUpperCase() + family.slice(1).toLowerCase();
}

/** The model the agent's transcript says it ran on, which can differ from
 * its definition: a session keeps the definition it loaded at its start. */
export function ranOn(transcript: string): string | null {
  let model: string | null = null;
  for (const line of transcript.split("\n")) {
    try {
      const entry = JSON.parse(line) as {
        type?: string;
        message?: { model?: string };
      };
      const said = entry.message?.model;
      if (entry.type === "assistant" && said && said !== "<synthetic>")
        model = said;
    } catch {
      continue;
    }
  }
  return model && familyName(model);
}

export const minutes = (from: string, to: string) =>
  `${Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60_000))} min`;

export function resultText(run: ReviewerRun, now: Date): string {
  if (isStuck(run, now)) return "no finish recorded";
  switch (run.result) {
    case "running":
      return "running";
    case "passed":
      return "passed";
    case "failed":
      return `${run.findings} finding${run.findings === 1 ? "" : "s"} to fix`;
    case "no verdict":
      return "finished, no verdict";
  }
}

/** The comment: a table for the owner, then each row's hidden copy for
 * `npx --no-install factory status`. It carries no cost marker: the session's next cost
 * note already includes what the reviewers spent. */
export function entryForRuns(
  session: string,
  runs: ReviewerRun[],
  now: Date,
): NewEntry {
  const rows = runs.map((run) => {
    const finished = run.result !== "running";
    return `| ${run.reviewer} | ${run.model} | ${utc(run.start)} | ${resultText(run, now)} | ${finished && run.end ? minutes(run.start, run.end) : ""} | ${finished && run.cost !== undefined ? `${dollars(subscriptionDollars(run.cost))} (${dollars(run.cost)})` : ""} |`;
  });
  return {
    text: [
      "Reviewers in this session, each cost as a share of the subscription and, in parentheses, at API list prices:",
      "",
      "| Reviewer | Model | Started | Result | Ran for | Cost |",
      "| --- | --- | --- | --- | --- | --- |",
      ...rows,
    ].join("\n"),
    markers: [`${REVIEWER_RUNS_MARK}${session} -->`, ...runs.map(runLine)],
    tellsPerson: false,
  };
}

/** The entry as GitHub posts it, as a comment. */
export const commentFor = (
  session: string,
  runs: ReviewerRun[],
  now: Date,
): string => renderEntry(entryForRuns(session, runs, now));

async function publish(
  issue: Key,
  session: string,
  state: State,
  d: Deps,
): Promise<string> {
  const entry = entryForRuns(session, state.runs, d.now());
  const tickets = await d.tickets();
  if (state.commentId !== null) {
    try {
      await tickets.record.update(state.commentId, entry);
      return state.commentId;
    } catch (error) {
      // A deleted comment is posted again; anything else is a failure.
      if (!(error instanceof NotFoundError)) throw error;
    }
  }
  return tickets.record.add(issue, entry);
}

export async function main(
  event: string,
  input: HookInput,
  agentsDir: string,
  d: Deps,
): Promise<number> {
  const session = input.session_id ?? "";
  const reviewer = input.agent_type ?? "";
  if (!session || !/^[\w-]+$/.test(reviewer)) return 0;
  if (event !== "start" && event !== "stop") return 0;
  // A reviewer is an agent the repository defines; a built-in one, such as
  // Explore, has no file there.
  const definition = d.readFile(join(agentsDir, `${reviewer}.md`));
  if (definition === null) return 0;
  let issue: Key | null = null;
  try {
    const clock = d.clock(session);
    if (!clock || clock.issue === null) return 0;
    issue = clock.issue;
    const on: Key = clock.issue;
    await d.locked(session, async () => {
      const state = d.state.read(session, on);
      const now = d.now().toISOString();
      const id = input.agent_id ?? `${reviewer}-${now}`;
      if (event === "start") {
        state.runs.push({
          id,
          reviewer,
          model: modelName(definition),
          start: now,
          result: "running",
        });
      } else {
        let run = state.runs.find((r) => r.id === id);
        if (!run) {
          // The start went unrecorded; keep the finish.
          run = {
            id,
            reviewer,
            model: modelName(definition),
            start: now,
            result: "running",
          };
          state.runs.push(run);
        }
        const transcript = input.agent_transcript_path
          ? d.readFile(input.agent_transcript_path)
          : null;
        const report =
          (transcript ? handedBack(transcript) : null) ??
          input.last_assistant_message ??
          (transcript ? lastAssistantText(transcript) : "");
        Object.assign(run, verdictOf(report), { end: now });
        if (transcript !== null) {
          run.model = ranOn(transcript) ?? run.model;
          const spend = spendIn([transcript]);
          if (spend.priced > 0) run.cost = spend.dollars;
        }
      }
      d.state.write(session, on, state);
      state.commentId = await publish(on, session, state, d);
      d.state.write(session, on, state);
    });
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    d.out(
      JSON.stringify({
        systemMessage: `The ${reviewer} run was not recorded${issue === null ? "" : ` on ticket ${issue}`}: ${why.split("\n")[0].slice(0, 200)}`,
      }),
    );
  }
  return 0;
}

/** A state file's text as the state; none when there is no file or it
 * cannot be read. */
export function parseState(text: string | null): State {
  try {
    if (!text) return { commentId: null, runs: [] };
    const state = JSON.parse(text) as Omit<State, "commentId"> & {
      commentId: string | number | null;
    };
    // State written before comment IDs were text holds a number.
    return {
      ...state,
      commentId: state.commentId === null ? null : String(state.commentId),
    };
  } catch {
    return { commentId: null, runs: [] };
  }
}

const statePath = (session: string, issue: Key) =>
  join(commonDir(), `reviewer-runs-${session}-${issue}.json`);

/** A lock directory beside the state, since reviewers run in parallel. One
 * older than a minute was left by a hook that died, and is taken over. */
async function locked<T>(session: string, work: () => Promise<T>) {
  const lock = join(commonDir(), `reviewer-runs-${session}.lock`);
  for (let tries = 0; ; tries++) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      if (existsSync(lock) && Date.now() - statSync(lock).mtimeMs > 60_000)
        rmSync(lock, { recursive: true, force: true });
      else if (tries > 100) throw new Error("another hook holds the lock");
      else await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  try {
    return await work();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

const read = (path: string) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};

/** `factory reviewers start|stop`, with the hook's input on stdin. */
export async function run(argv: string[]): Promise<number> {
  let input: HookInput = {};
  try {
    input = JSON.parse(readFileSync(0, "utf8")) as HookInput;
  } catch {
    // No input: nothing to record.
  }
  const project = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  return main(argv[0] ?? "", input, join(project, ".claude", "agents"), {
    tickets: async () => {
      const settings = await loadSettings();
      return (await openTickets(settings, targetOf(settings, process.env)))
        .tickets;
    },
    now: () => new Date(),
    clock: readClock,
    readFile: read,
    state: {
      read: (session, issue) => parseState(read(statePath(session, issue))),
      write: (session, issue, state) =>
        writeFileSync(statePath(session, issue), JSON.stringify(state)),
    },
    locked,
    out: (line) => console.log(line),
  }).catch(() => 0);
}
