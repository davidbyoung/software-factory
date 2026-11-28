#!/usr/bin/env node
// Decide whether a pull request can merge without the owner.
//
//   lunamill merge-policy PR_NUMBER    # prints the labels to set
//
// "merge-automatic" only when no changed file is one of lunamill's own,
// none matches auto-merge.deny in .claude/lunamill.yaml, every one matches
// auto-merge.allow, and every command under auto-merge.commands exits 0;
// "merge-manual" otherwise. The merge-policy workflow runs this from main's copy,
// with main's settings, so a pull request cannot change how it is judged.
import { spawnSync } from "node:child_process";
import { loadSettings, repoRoot, type ApprovalPolicy } from "./config.mts";
import { gitIn } from "./lib/default-branch.mts";
import {
  changedFiles,
  checkName,
  checksOf,
  type Git,
  type Check,
  type Outcome,
} from "./approval-policies.mts";
import { homeOf, repositoriesOf } from "./across.mts";
import { openCodeHost } from "./code-host/index.mts";
import { sameRepository } from "./lib/repositories.mts";
import { recordedTicket } from "./session-publish.mts";
import { openTickets } from "./tickets/index.mts";
import { NotFoundError, type Tickets } from "./tickets/types.mts";

import { matchesAny } from "./lib/glob.mts";
import { processFiles } from "./specs/index.mts";
import * as say from "./lib/output.mts";

/** A changed file under GitHub's own field names, which the commands under
 * `auto-merge.commands` have always been handed. */
export type ChangedFile = {
  filename: string;
  previous_filename?: string;
  status?: string;
};

/** The pull request's change at `head`, read from git, since the code host's
 * list of a pull request's files stops at 3000: every changed file, and the
 * merge base they are read against. Null when it can't be read. */
export function readChange(
  git: Git,
  pr: number,
  base: string,
  head: string,
): { mergeBase: string; files: ChangedFile[] } | null {
  const fetched = git([
    "fetch",
    "--no-tags",
    "--quiet",
    "origin",
    `+refs/pull/${pr}/head:refs/factory/head`,
    `+refs/heads/${base}:refs/factory/base`,
  ]);
  if (!fetched.ok) return null;
  const found = git(["merge-base", "refs/factory/base", head]);
  const mergeBase = found.out.trim();
  const files =
    found.ok && mergeBase ? changedFiles(git, mergeBase, head) : null;
  return files && { mergeBase, files };
}

/** The keys of the two merge labels. The merge-policy workflow applies one
 * and removes the other; only the automatic one turns auto-merge on. */
export const AUTOMATIC = "merge-automatic";
export const MANUAL = "merge-manual";

export type Risk = {
  risk: typeof AUTOMATIC | typeof MANUAL;
  reasons: string[];
};

/** lunamill's own files, held whatever the settings allow: a pull request
 * must not be able to change how pull requests are judged. Every spec tool's
 * process files are among them, whichever the settings name, since a pull
 * request could change that setting too. */
const LUNAMILL_FILES = /^(\.github|\.claude)\/|(^|\/)(CLAUDE|AGENTS)\.md$/;
const SPEC_TOOL_FILES = new Set(processFiles());

export type Policy = { allow: readonly string[]; deny: readonly string[] };

function classifyPath(path: string, policy: Policy): string | null {
  if (LUNAMILL_FILES.test(path) || SPEC_TOOL_FILES.has(path))
    return "lunamill's own files";
  if (matchesAny(path, policy.deny)) return "held by auto-merge.deny";
  return matchesAny(path, policy.allow) ? null : "not in auto-merge.allow";
}

/** The decision from the changed paths alone: a lunamill file, then deny,
 * then anything outside allow, holds the pull request. A renamed file is
 * checked under both names. */
export function classify(files: ChangedFile[], policy: Policy): Risk {
  if (files.length === 0) {
    return { risk: MANUAL, reasons: ["no changed files"] };
  }
  const reasons: string[] = [];
  for (const file of files) {
    const paths = [file.filename, file.previous_filename].filter(
      (p): p is string => Boolean(p),
    );
    for (const path of new Set(paths)) {
      const reason = classifyPath(path, policy);
      if (reason) reasons.push(`${path}: ${reason}`);
    }
  }
  return reasons.length
    ? { risk: MANUAL, reasons: [...new Set(reasons)] }
    : { risk: AUTOMATIC, reasons: [] };
}

/** What a command under auto-merge.commands is given on its standard input. */
export type CommandInput = {
  repository: string;
  pull: number;
  base: string;
  head: string;
  files: ChangedFile[];
};

export type CommandResult = {
  command: string;
  status: number | null;
  output: string;
  ran: boolean;
};

/** Runs one command from the current directory, the root of the checkout
 * the workflow made, with the pull request as JSON on its standard input. */
export function runCommand(
  command: string,
  input: CommandInput,
): CommandResult {
  const r = spawnSync("sh", ["-c", command], {
    input: JSON.stringify(input),
    encoding: "utf8",
  });
  // 126 and 127 are the shell's "cannot execute" and "not found".
  const ran = !r.error && r.status !== 126 && r.status !== 127;
  return { command, status: r.status, output: (r.stdout ?? "").trim(), ran };
}

/** Exit 0 allows the merge. Anything else holds it, with what the command
 * printed as the reason, or the command's name when it printed nothing. */
export function commandReasons(results: CommandResult[]): string[] {
  return results.flatMap(({ command, status, output, ran }) => {
    if (!ran) return [`held by ${command}: it could not be run`];
    if (status === 0) return [];
    const lines = output.split("\n").filter((l) => l.trim());
    return lines.length ? lines : [`held by ${command}`];
  });
}

/** Why a pull request with that body is held for the ticket it is part of:
 * one in another repository, or that names others than its own. Whoever
 * approved it may not be able to write to this one. */
export async function acrossReasons(
  body: string,
  d: {
    tickets: Pick<Tickets, "linksIn" | "read" | "ref" | "home">;
    repository: string;
  },
): Promise<string[]> {
  const recorded = recordedTicket(body);
  const keys = new Set([
    ...d.tickets.linksIn(body, d.repository).partOf,
    ...(recorded === null ? [] : [recorded]),
  ]);
  const reasons: string[] = [];
  for (const key of keys) {
    const ref = d.tickets.ref(key);
    const home = homeOf(d.tickets, key, d.repository);
    const spans = `part of ${ref}, which spans repositories`;
    if (!sameRepository(home, d.repository)) reasons.push(spans);
    else
      try {
        const ticket = await d.tickets.read(key);
        if (repositoriesOf(ticket, d.tickets, home)) reasons.push(spans);
      } catch (error) {
        if (!(error instanceof NotFoundError))
          reasons.push(`part of ${ref}, which could not be read`);
      }
  }
  return reasons;
}

/** Why a pull request waits for a person, for each approval policy with an
 * agent its files set off: an agent can be talked out of a finding by the
 * text it reads, so what only an agent cleared never merges itself. It is
 * decided before any agent runs, since auto-merge goes on within a minute.
 * A policy with a command too holds only when `ran`, its command run here,
 * found something or failed: its agent reads nothing otherwise. */
export async function agentReasons(
  policies: readonly ApprovalPolicy[],
  files: readonly ChangedFile[],
  ran?: (check: Check) => Promise<Outcome>,
): Promise<string[]> {
  const reasons: string[] = [];
  for (const c of checksOf(
    policies.filter((p) => p.agent !== null),
    files,
  )) {
    if (c.policy.run !== null && ran && (await ran(c)).kind === "nothing")
      continue;
    reasons.push(
      `${checkName(c)} is checked by an agent, so a person merges it`,
    );
  }
  return reasons;
}

/** Who merges a pull request: by its files, the ticket it is part of, the
 * approval policies with an agent, and each command's answer. */
export async function judge(d: {
  /** Null when they could not be read. */
  files: ChangedFile[] | null;
  body: string;
  policy: Policy;
  across: Parameters<typeof acrossReasons>[1];
  /** What the commands said, for a pull request with files. */
  held: () => string[];
  approvalPolicies?: readonly ApprovalPolicy[];
  /** Runs an approval policy's command, for its agent's hold. */
  ran?: (check: Check) => Promise<Outcome>;
}): Promise<Risk> {
  if (d.files === null)
    return { risk: MANUAL, reasons: ["the changed files could not be read"] };
  const paths = classify(d.files, d.policy);
  const spans = await acrossReasons(d.body, d.across);
  const agents = await agentReasons(d.approvalPolicies ?? [], d.files, d.ran);
  // A pull request with no files waits for the owner whatever a command says.
  return decide(paths, [
    ...spans,
    ...agents,
    ...(d.files.length ? d.held() : []),
  ]);
}

/** The path decision, then each command's, as one. */
export function decide(paths: Risk, commandHolds: string[]): Risk {
  const reasons = [...paths.reasons, ...commandHolds];
  return reasons.length
    ? { risk: MANUAL, reasons: [...new Set(reasons)] }
    : { risk: AUTOMATIC, reasons: [] };
}

/** The description of the "Who merges" commit status: what happens, and why,
 * on one line. GitHub cuts a status description at 140 characters. */
export function statusLine({ risk, reasons }: Risk): string {
  if (risk === AUTOMATIC) {
    return "Merges itself once every gate passes: every file is on the allowlist";
  }
  const more = reasons.length > 1 ? `, and ${reasons.length - 1} more` : "";
  // A path can hold a newline, which would write extra keys into the
  // merge-policy workflow's outputs, such as automatic=true. Keep it to one line.
  const first = reasons[0].replace(/[\u0000-\u001f\u007f]+/g, " ");
  const line = `Waits for the owner: ${first}${more}`;
  return line.length > 140 ? `${line.slice(0, 139)}…` : line;
}

/** What the merge-policy workflow needs: the label to set and the one to
 * remove, each by the name `names` gives it, whether auto-merge goes on,
 * and the status line. */
export function workflowOutput(
  result: Risk,
  names: Readonly<Record<typeof AUTOMATIC | typeof MANUAL, string>>,
) {
  const automatic = result.risk === AUTOMATIC;
  return {
    ...result,
    label: names[result.risk],
    other: names[automatic ? MANUAL : AUTOMATIC],
    automatic,
    status: statusLine(result),
  };
}

async function main(argv: string[]) {
  const pr = argv[0];
  if (!pr) {
    say.plainError("Usage: lunamill merge-policy PR");
    process.exit(2);
  }
  const settings = await loadSettings();
  const { repository: repo } = settings;
  const { autoMerge } = settings;
  const pulls = openCodeHost(repo, settings.codeHost.type);
  const pull = await pulls.get(Number(pr));
  const git = gitIn(repoRoot());
  const change = readChange(git, Number(pr), pull.base.branch, pull.head.sha);
  const { tickets } = await openTickets(settings, {
    repository: repo,
    board: settings.tickets.board,
  });
  const risk = await judge({
    files: change?.files ?? null,
    body: pull.body,
    policy: autoMerge,
    across: { tickets, repository: repo },
    approvalPolicies: settings.approvalPolicies,
    ran: async (check) => {
      const { policyRun } = await import("./approval-job.mts");
      return policyRun(check, {
        git,
        pr: Number(pr),
        base: pull.base.branch,
        head: pull.head.sha,
        repository: repo,
        body: pull.body,
        tickets,
        root: repoRoot(),
      });
    },
    held: () =>
      commandReasons(
        autoMerge.commands.map((command) =>
          runCommand(command, {
            repository: repo,
            pull: Number(pr),
            base: change!.mergeBase,
            head: pull.head.sha,
            files: change!.files,
          }),
        ),
      ),
  });
  // The pull request as it is now, not as the event described it: an event
  // sent just after a push can carry the previous commit and draft state.
  say.plain(
    JSON.stringify({
      ...workflowOutput(risk, settings.codeHost.labels),
      sha: pull.head.sha,
      draft: pull.isDraft,
    }),
  );
}

// Only run as a CLI. Importing this module for tests must not call GitHub.
/** `lunamill merge-policy N`. */
export async function run(argv: string[]): Promise<number> {
  await main(argv);
  return 0;
}
