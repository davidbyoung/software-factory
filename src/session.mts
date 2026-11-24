#!/usr/bin/env node
// Whether a cloud session runs, for the workflow that would run one.
//
//   factory session ready build TICKET
//   factory session ready review|answer|conflict|dependency PR [REVIEW]
//
// It asks whether there is work first, with whatever token the step gives
// it as GH_TOKEN, the workflow's own, and only then whether the build token
// and Claude's credential are set (FACTORY_BUILD_TOKEN_SET and
// FACTORY_CLAUDE_SET, each `true` or not). The key of the organization's
// app counts as the build token (FACTORY_APP_KEY_SET). With work and a
// token missing, a run that a push, a schedule, or a review started says so
// and passes; a run someone started by hand, or the poller did, fails. It
// writes `ran=true` or `ran=false` to GITHUB_OUTPUT.
//
//   factory session repositories
//
// The repositories a run's token of the organization's app is made for, by
// name and separated by commas: the run's own, and each of the same owner
// that holds a preset the lock names.
//
//   factory session token
//
// Signs a job in as that app: `session-token.mts`.
//
//   factory session prepare|run|publish|next|each
//
// The jobs of a run that starts a session: `session-jobs.mts`.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { reachOf, repoRoot } from "./config.mts";
import { openCodeHost } from "./code-host/index.mts";
import type { CodeHost } from "./code-host/types.mts";
import { reviewPending, stoppedOn } from "./pr.mts";
import * as say from "./lib/output.mts";

/** A run on a pull request with no review's number has its work named by
 * what started it, so only a person's review is asked about. */
export type Kind = "build" | "review" | "answer" | "conflict" | "dependency";
const KINDS: Kind[] = ["build", "review", "answer", "conflict", "dependency"];

export type Ready = {
  kind: Kind;
  /** Someone asked for this run, or the poller did. */
  byHand: boolean;
  buildToken: boolean;
  claude: boolean;
  /** What the kind's check found, as `foundLine` words it, or null when
   * there is nothing to do. */
  work: () => Promise<string | null>;
};

/** What a kind's run is for, for the notice a run without a token prints. */
export function foundLine(kind: Exclude<Kind, "build">, pull: number): string {
  switch (kind) {
    case "review":
      return `#${pull} waits for a review`;
    case "answer":
      return `#${pull} waits for an answer`;
    case "conflict":
      return `#${pull} conflicts`;
    case "dependency":
      return `#${pull} is Dependabot's`;
  }
}

const MISSING = {
  build: {
    notice: "no build token",
    error:
      "No build token: set the secret FACTORY_BUILD_TOKEN, or FACTORY_BOARD_TOKEN.",
  },
  claude: {
    notice: "no Claude credential",
    error:
      "No Claude credential: set the secret CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY.",
  },
};

export async function ready(
  o: Ready,
): Promise<{ run: boolean; code: number; lines: string[] }> {
  const found = o.kind === "build" ? "" : await o.work();
  if (found === null) return { run: false, code: 0, lines: ["Nothing to do."] };
  // A review is recorded with the workflow's own token.
  const missing =
    !o.buildToken && o.kind !== "review"
      ? MISSING.build
      : !o.claude
        ? MISSING.claude
        : null;
  if (!missing) return { run: true, code: 0, lines: [] };
  if (o.byHand || o.kind === "build")
    return { run: false, code: 1, lines: [`::error::${missing.error}`] };
  return {
    run: false,
    code: 0,
    lines: [
      `${found}, and ${missing.notice} is set, so no session ran. Builds in the cloud are off: factory init turns them on.`,
    ],
  };
}

const USAGE =
  "Usage: factory session ready build|review|answer|conflict|dependency ID [REVIEW]";

/** All of a repository's name but its last part, and that part. */
const split = (repository: string) => {
  const at = repository.lastIndexOf("/");
  return { owner: repository.slice(0, at), name: repository.slice(at + 1) };
};

/** The repository's name, then each of `presets`, the repositories that
 * hold a preset, that has the same owner, once each. */
export function repositoriesOf(repository: string, presets: string[]): string {
  const own = split(repository);
  const names = presets
    .map(split)
    .filter((p) => p.owner.toLowerCase() === own.owner.toLowerCase())
    .map((p) => p.name);
  return [...new Set([own.name, ...names])].join(",");
}

/** Those names for this checkout: the run's repository, and the presets
 * its lock names. */
export async function repositories(
  env: Record<string, string | undefined>,
): Promise<string> {
  const { load } = await import("js-yaml");
  const { LOCK_FILE, parseName, pinsOf } = await import("./preset.mts");
  const lock = join(repoRoot(), LOCK_FILE);
  const pins = pinsOf(
    existsSync(lock) ? readFileSync(lock, "utf8") : null,
    load,
  );
  return repositoriesOf(
    (await reachOf(env)).repository,
    pins.map((pin) => parseName(pin.name).repo),
  );
}

/** What a kind's check finds on the pull request: a person's review may
 * have been answered since, and anything else is work. */
export function workOf(
  kind: Kind,
  p: CodeHost,
  numbers: number[],
  out: (line: string) => void,
): () => Promise<string | null> {
  return async () => {
    if (kind === "build") return "";
    const [pr, review] = numbers;
    if (!pr) throw new Error(USAGE);
    // It may have waited for another run on the same pull request.
    if (kind === "conflict") {
      const pull = await p.get(pr);
      const gone = !["dirty", "unknown"].includes(pull.mergeableState);
      if (gone || (await stoppedOn(p, pull))) {
        out(
          `nothing to do: ${gone ? `#${pr} does not conflict` : `a run stopped on #${pr}`}`,
        );
        return null;
      }
    }
    if (kind !== "answer" || !review) return foundLine(kind, pr);
    const answer = await reviewPending(p, pr, review);
    if (!answer.pending) out(`nothing to do: ${answer.why}`);
    return answer.pending ? foundLine(kind, pr) : null;
  };
}

/** `factory session ready KIND ID [REVIEW]`, `factory session
 * repositories`, and `factory session token`. */
export async function run(argv: string[]): Promise<number> {
  const [step, kind, ...rest] = argv;
  const env = process.env;
  if (step !== "ready" && step !== "repositories" && step !== "token") {
    const jobs = await import("./session-jobs.mts");
    if (jobs.isJob(step)) return jobs.run(step, argv.slice(1));
  }
  if (step === "token") return (await import("./session-token.mts")).run();
  if (step === "repositories") {
    try {
      say.plain(await repositories(env));
      return 0;
    } catch (error) {
      say.plainError(error instanceof Error ? error.message : String(error));
      return 1;
    }
  }
  if (step !== "ready" || !KINDS.includes(kind as Kind)) {
    say.plainError(USAGE);
    return 2;
  }
  try {
    const { repository, codeHost } = await reachOf(env);
    const answer = await ready({
      kind: kind as Kind,
      byHand: env.GITHUB_EVENT_NAME === "workflow_dispatch",
      buildToken:
        env.FACTORY_BUILD_TOKEN_SET === "true" ||
        env.FACTORY_APP_KEY_SET === "true",
      claude: env.FACTORY_CLAUDE_SET === "true",
      work: workOf(
        kind as Kind,
        openCodeHost(repository, codeHost),
        rest.map(Number),
        say.plainPrinter(),
      ),
    });
    for (const line of answer.lines) say.plain(line);
    if (env.GITHUB_OUTPUT)
      appendFileSync(env.GITHUB_OUTPUT, `ran=${answer.run}\n`);
    return answer.code;
  } catch (error) {
    say.plainError(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
