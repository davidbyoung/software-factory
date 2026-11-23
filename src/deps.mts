#!/usr/bin/env node
// The open Dependabot pull requests, oldest first, and what each needs, for
// the factory-deps skill's steps 0 and 1.
//
//   factory deps
//   factory deps --any   # exits 0 when one is open, 1 when none, 2 when it could not tell
//
// A failed read exits 1 with the error, or 2 with `--any`.
import { reachOf, repoRoot } from "./config.mts";
import { branchDeps, needDefaultBranch } from "./lib/default-branch.mts";
import { openCodeHost, type CodeHost } from "./code-host/index.mts";

const SHEPHERD_MARK = "<!-- factory-deps -->";
const PASSED = ["success", "skipped", "neutral"];

type CheckRun = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
};

export type Bump = {
  number: number;
  title: string;
  head: string;
  sha: string;
  major: boolean;
  mergeableState: string;
  autoMerge: boolean;
  checks: CheckRun[];
  shepherdComments: number;
};

/** A major bump changes the leading number. A grouped bump is minor and
 * patch only. */
export function isMajor(title: string): boolean {
  const match = /from v?(\d+)\S* to v?(\d+)/.exec(title);
  return match !== null && match[1] !== match[2];
}

/** What the skill does with a bump, in the order its steps take them.
 * `branch` is the default branch, which a conflicting bump merges, and
 * `factory` the name a bump of the factory's own workflows carries: such a
 * one is left for the Updates job's pull request, which also holds the
 * files that version writes. */
export function nextStep(bump: Bump, branch: string, factory = ""): string {
  if (factory && bump.title.includes(factory))
    return "leave (step 4): it names the factory";
  if (bump.mergeableState === "unknown") return "leave: state not computed yet";
  if (bump.checks.some((c) => c.status !== "completed"))
    return "leave: checks still running";
  if (bump.shepherdComments >= 2 && failing(bump).length > 0)
    return "stop: two earlier fixes did not turn CI green";
  const steps: string[] = [];
  if (bump.mergeableState === "dirty") steps.push(`merge ${branch} (step 2)`);
  if (failing(bump).length > 0)
    steps.push(`fix ${failing(bump).join(", ")} (step 3)`);
  if (bump.major) steps.push("migrate (step 5)");
  return steps.length > 0 ? steps.join("; ") : "nothing: waits on its merge";
}

/** Each check's newest run, in the order the checks first appear. */
function newest(checks: CheckRun[]): CheckRun[] {
  const byName = new Map<string, CheckRun>();
  for (const c of checks) {
    const seen = byName.get(c.name);
    if (!seen || c.id > seen.id) byName.set(c.name, c);
  }
  return [...byName.values()];
}

function failing(bump: Bump): string[] {
  return newest(bump.checks)
    .filter(
      (c) => c.status === "completed" && !PASSED.includes(c.conclusion ?? ""),
    )
    .map((c) => c.name);
}

/** Every check on the bump's commit, not a fixed list of names: passed, or
 * the names that failed and the names still running. */
export function checksLine(bump: Bump): string {
  const runs = newest(bump.checks);
  if (runs.length === 0) return "checks: none started";
  const failed = failing(bump);
  const running = runs
    .filter((c) => c.status !== "completed")
    .map((c) => c.name);
  if (failed.length === 0 && running.length === 0) return "checks: passed";
  const parts = [
    failed.length ? `failed ${failed.join(", ")}` : "",
    running.length ? `running ${running.join(", ")}` : "",
  ].filter(Boolean);
  return `checks: ${parts.join("; ")}`;
}

export function formatBump(bump: Bump, branch: string, factory = ""): string[] {
  return [
    `#${bump.number} ${bump.title}`,
    `  ${bump.major ? "major" : "minor or patch"}; head ${bump.head} at ${bump.sha.slice(0, 7)}; mergeable ${bump.mergeableState}; auto-merge ${bump.autoMerge ? "on" : "off"}`,
    `  ${checksLine(bump)}`,
    `  earlier shepherd comments: ${bump.shepherdComments}`,
    `  next: ${nextStep(bump, branch, factory)}`,
  ];
}

async function readBump(p: CodeHost, number: number): Promise<Bump> {
  const pull = await p.get(number);
  const [checks, comments] = await Promise.all([
    p.checkRuns(pull.head.sha),
    p.comments(number),
  ]);
  return {
    number,
    title: pull.title,
    head: pull.head.branch,
    sha: pull.head.sha,
    major: isMajor(pull.title),
    mergeableState: pull.mergeableState,
    autoMerge: pull.autoMerge ?? false,
    checks,
    shepherdComments: comments.filter((c) => c.body.includes(SHEPHERD_MARK))
      .length,
  };
}

/** `defaultBranch` gives the default branch's name, and rejects when it
 * cannot be told. It is asked only when a pull request is listed. */
export async function main(
  p: CodeHost,
  out: (line: string) => void,
  argv: string[],
  defaultBranch: () => Promise<string>,
  factory = "",
): Promise<number> {
  try {
    const pulls = (await p.listOpen())
      .filter((pull) => pull.author === "dependabot[bot]")
      .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    if (argv.includes("--any")) {
      out(
        pulls.length > 0
          ? `${pulls.length} open Dependabot pull request${pulls.length === 1 ? "" : "s"}`
          : "no open Dependabot pull requests",
      );
      return pulls.length > 0 ? 0 : 1;
    }
    if (pulls.length === 0) {
      out("no open Dependabot pull requests");
      return 0;
    }
    const branch = await defaultBranch();
    for (const pull of pulls) {
      formatBump(await readBump(p, pull.number), branch, factory).forEach((l) =>
        out(l),
      );
    }
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return argv.includes("--any") ? 2 : 1;
  }
}

/** The factory's own repository, as a bump of its workflows names it. */
async function factoryName(): Promise<string> {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { PACKAGE } = await import("./sync.mts");
  const { name } = JSON.parse(
    readFileSync(join(PACKAGE, "package.json"), "utf8"),
  ) as { name: string };
  return name.replace(/^@/, "");
}

/** `factory deps`. */
export async function run(argv: string[] = []): Promise<number> {
  const { repository, codeHost } = await reachOf(process.env);
  const p = openCodeHost(repository, codeHost);
  // The code host is already open, so it is the one asked where the
  // checkout does not say.
  return main(
    p,
    (line) => console.log(line),
    argv,
    () =>
      needDefaultBranch({
        ...branchDeps(repoRoot()),
        host: () => p.defaultBranch(),
      }),
    await factoryName(),
  );
}
