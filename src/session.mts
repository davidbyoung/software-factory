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
// FACTORY_CLAUDE_SET, each `true` or not). With work and a token missing, a
// run that a push, a schedule, or a review started says so and passes; a
// run someone started by hand, or the poller did, fails. It writes
// `ran=true` or `ran=false` to GITHUB_OUTPUT.
import { appendFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { reachOf } from "./config.mts";
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

/** What a kind's check finds in the repository, through the code host. */
function workOf(
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

/** `factory session ready KIND [PR REVIEW]`. */
export async function run(argv: string[]): Promise<number> {
  const [step, kind, ...rest] = argv;
  if (step !== "ready" || !KINDS.includes(kind as Kind)) {
    console.error(USAGE);
    return 2;
  }
  const env = process.env;
  try {
    const { repository, codeHost } = await reachOf(env);
    const answer = await ready({
      kind: kind as Kind,
      byHand: env.GITHUB_EVENT_NAME === "workflow_dispatch",
      buildToken: env.FACTORY_BUILD_TOKEN_SET === "true",
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
