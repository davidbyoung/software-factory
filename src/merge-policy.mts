#!/usr/bin/env node
// Decide whether a pull request can merge without the owner.
//
//   factory merge-policy PR_NUMBER    # prints the labels to set
//
// "merge-automatic" only when no changed file is one of the factory's own,
// none matches auto-merge.deny in .claude/factory.yaml, every one matches
// auto-merge.allow, and every command under auto-merge.commands exits 0;
// "merge-manual" otherwise. The merge-policy workflow runs this from main's copy,
// with main's settings, so a pull request cannot change how it is judged.
import { spawnSync } from "node:child_process";
import { loadSettings } from "./config.mts";
import { openCodeHost } from "./code-host/index.mts";

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

/** The code host's changed files under those names. */
export const inGithubNames = (
  files: { path: string; previousPath?: string; status: string }[],
): ChangedFile[] =>
  files.map(({ path, previousPath, status }) => ({
    filename: path,
    previous_filename: previousPath,
    status,
  }));

/** The keys of the two merge labels. The merge-policy workflow applies one
 * and removes the other; only the automatic one turns auto-merge on. */
export const AUTOMATIC = "merge-automatic";
export const MANUAL = "merge-manual";

export type Risk = {
  risk: typeof AUTOMATIC | typeof MANUAL;
  reasons: string[];
};

/** The factory's own files, held whatever the settings allow: a pull request
 * must not be able to change how pull requests are judged. Every spec tool's
 * process files are among them, whichever the settings name, since a pull
 * request could change that setting too. */
const FACTORY_FILES = /^(\.github|\.claude)\/|(^|\/)(CLAUDE|AGENTS)\.md$/;
const SPEC_TOOL_FILES = new Set(processFiles());

export type Policy = { allow: readonly string[]; deny: readonly string[] };

function classifyPath(path: string, policy: Policy): string | null {
  if (FACTORY_FILES.test(path) || SPEC_TOOL_FILES.has(path))
    return "the factory's own files";
  if (matchesAny(path, policy.deny)) return "held by auto-merge.deny";
  return matchesAny(path, policy.allow) ? null : "not in auto-merge.allow";
}

/** The decision from the changed paths alone: a factory file, then deny,
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
    say.plainError("Usage: factory merge-policy PR");
    process.exit(2);
  }
  const settings = await loadSettings();
  const repo = process.env.GITHUB_REPOSITORY || settings.repository;
  const { autoMerge } = settings;
  const pulls = openCodeHost(repo, settings.codeHost.type);
  const pull = await pulls.get(Number(pr));
  const mergeBase = await pulls.mergeBase(pull.base.sha, pull.head.sha);
  const files = inGithubNames(await pulls.files(Number(pr)));
  const paths = classify(files, autoMerge);
  // A pull request with no files waits for the owner whatever a command says.
  const holds = files.length
    ? commandReasons(
        autoMerge.commands.map((command) =>
          runCommand(command, {
            repository: repo,
            pull: Number(pr),
            base: mergeBase,
            head: pull.head.sha,
            files,
          }),
        ),
      )
    : [];
  // The pull request as it is now, not as the event described it: an event
  // sent just after a push can carry the previous commit and draft state.
  say.plain(
    JSON.stringify({
      ...workflowOutput(decide(paths, holds), settings.codeHost.labels),
      sha: pull.head.sha,
      draft: pull.isDraft,
    }),
  );
}

// Only run as a CLI. Importing this module for tests must not call GitHub.
/** `factory merge-policy N`. */
export async function run(argv: string[]): Promise<number> {
  await main(argv);
  return 0;
}
