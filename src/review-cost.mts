#!/usr/bin/env node
// Adds what the pull request review cost to its summary comment, after the review
// step of .github/workflows/factory-claude-review.yml:
//
//   Review cost: $0.03 of the subscription ($0.92 at API list prices).
//   <!-- cost: 0.92 -->
//
// The figure is the execution file's total_cost_usd when it has one, and
// otherwise its usage priced with lib/pricing.mts. The board sync
// adds the marker to the card's Cost. Nothing here fails the job: with no
// summary, no figure, or a failed call, it logs why and exits 0.
//
//   EXECUTION_FILE=... PR=N SHA=... GITHUB_REPOSITORY=owner/name \
//     npx --no-install factory review cost
import { readFileSync } from "node:fs";
import { openCodeHost, type CodeHost } from "./code-host/index.mts";
import { CI_BOT, hasCostMarker } from "./lib/work-status.mts";
import { bothPrices, spendIn } from "./lib/usage.mts";

type Message = {
  type?: string;
  total_cost_usd?: number;
  message?: { id?: string; model?: string; usage?: unknown };
};

/** The review's cost in dollars, or why there is none. */
export function reviewCost(
  text: string,
): { dollars: number } | { reason: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { reason: "the execution file is not JSON" };
  }
  const messages = (Array.isArray(parsed) ? parsed : [parsed]) as Message[];
  const total = messages.findLast((m) => m?.type === "result")?.total_cost_usd;
  if (typeof total === "number" && Number.isFinite(total))
    return { dollars: total };
  const lines = messages
    .filter((m) => m?.type === "assistant" && m.message)
    .map((m) =>
      JSON.stringify({
        type: "assistant",
        requestId: m.message!.id,
        message: m.message,
      }),
    );
  const spend = spendIn([lines.join("\n")]);
  if (spend.priced === 0)
    return {
      reason:
        spend.unpriced.size > 0
          ? `its usage is on models with no list price (${[...spend.unpriced.keys()].join(", ")})`
          : "the execution file has no total_cost_usd and no usage",
    };
  return { dollars: spend.dollars };
}

export type Deps = {
  /** The repository's code host. */
  codeHost: (repository: string) => CodeHost;
  env: Record<string, string | undefined>;
  readFile: (path: string) => string;
  log: (line: string) => void;
};

export async function main(d: Deps): Promise<number> {
  const { EXECUTION_FILE: file, PR: pr, SHA: sha } = d.env;
  const repo = d.env.GITHUB_REPOSITORY;
  try {
    if (!file || !pr || !sha || !repo)
      return (
        d.log(
          "No review cost: EXECUTION_FILE, PR, SHA, or GITHUB_REPOSITORY is not set.",
        ),
        0
      );
    let text: string;
    try {
      text = d.readFile(file);
    } catch {
      return (d.log(`No review cost: ${file} could not be read.`), 0);
    }
    const cost = reviewCost(text);
    if ("reason" in cost) return (d.log(`No review cost: ${cost.reason}.`), 0);

    const pulls = d.codeHost(repo);
    const comments = await pulls.comments(Number(pr));
    const summary = comments
      .filter(
        (c) =>
          c.author === CI_BOT &&
          c.body.includes(`<!-- claude-review sha=${sha} -->`),
      )
      .at(-1);
    if (!summary)
      return (d.log(`No review cost: no summary comment for ${sha}.`), 0);
    const { body } = summary;
    // A rerun on a commit whose summary already has a cost adds none.
    if (hasCostMarker(body))
      return (d.log("The summary already has a cost; adding none."), 0);

    const amount = cost.dollars.toFixed(2);
    await pulls.editComment(
      summary.id,
      `${body.trimEnd()}\n\nReview cost: ${bothPrices(cost.dollars)}.\n\n<!-- cost: ${amount} -->`,
    );
    d.log(`Added the review cost, $${amount}, to comment ${summary.id}.`);
    return 0;
  } catch (error) {
    d.log(
      `::warning::No review cost: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 0;
  }
}

/** `factory review cost`. */
export async function run(): Promise<number> {
  return main({
    codeHost: (repository) => openCodeHost(repository),
    env: process.env,
    readFile: (path) => readFileSync(path, "utf8"),
    log: (line) => console.log(line),
  });
}
