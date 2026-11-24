#!/usr/bin/env node
// Whether a cloud session runs, for the workflow that would run one.
//
//   factory session ready build
//   factory session ready conflicts
//   factory session ready deps
//   factory session ready review PR REVIEW
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
//   factory session token [--keep]
//
// Signs a session in as that app, and keeps it signed in: `session-token.mts`.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { reachOf, repoRoot } from "./config.mts";
import { openCodeHost } from "./code-host/index.mts";
import type { CodeHost } from "./code-host/types.mts";
import { conflicting, reviewPending } from "./pr.mts";

export type Kind = "build" | "review" | "conflicts" | "deps";
const KINDS: Kind[] = ["build", "review", "conflicts", "deps"];

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

/** What a check found, for the notice a run without a token prints. */
export function foundLine(kind: Exclude<Kind, "build">, n: number): string {
  if (kind === "review") return `A review on #${n} waits for an answer`;
  const one = n === 1;
  return kind === "conflicts"
    ? `${n} pull request${one ? " conflicts" : "s conflict"}`
    : `${n} Dependabot pull request${one ? " is" : "s are"} open`;
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
  const missing = !o.buildToken
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
  "Usage: factory session ready build|conflicts|deps|review [PR REVIEW]";

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

/** What a kind's check finds in the repository, through the code host. */
export function workOf(
  kind: Kind,
  p: CodeHost,
  numbers: number[],
  out: (line: string) => void,
): () => Promise<string | null> {
  return async () => {
    if (kind === "conflicts") {
      const found = await conflicting(p, sleep);
      return found.length ? foundLine("conflicts", found.length) : null;
    }
    if (kind === "deps") {
      const open = (await p.listOpen()).filter(
        (pull) => pull.author === "dependabot[bot]",
      );
      return open.length ? foundLine("deps", open.length) : null;
    }
    const [pr, review] = numbers;
    if (!pr || !review) throw new Error(USAGE);
    const answer = await reviewPending(p, pr, review);
    if (!answer.pending) out(`nothing to do: ${answer.why}`);
    return answer.pending ? foundLine("review", pr) : null;
  };
}

/** `factory session ready KIND [PR REVIEW]`, `factory session
 * repositories`, and `factory session token [--keep]`. */
export async function run(argv: string[]): Promise<number> {
  const [step, kind, ...rest] = argv;
  const env = process.env;
  if (step === "token")
    return (await import("./session-token.mts")).run(argv.slice(1));
  if (step === "repositories") {
    try {
      console.log(await repositories(env));
      return 0;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
  }
  if (step !== "ready" || !KINDS.includes(kind as Kind)) {
    console.error(USAGE);
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
        (line) => console.log(line),
      ),
    });
    answer.lines.forEach((line) => console.log(line));
    if (env.GITHUB_OUTPUT)
      appendFileSync(env.GITHUB_OUTPUT, `ran=${answer.run}\n`);
    return answer.code;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
