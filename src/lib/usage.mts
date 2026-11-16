// What a Claude Code session spent, read from its transcripts under
// ~/.claude/projects/. Each assistant entry records the model and the
// request's token counts. The format is internal to Claude Code, not a
// documented contract, so a read that finds no usage says so rather than
// reporting $0. Node built-ins only: the hooks run it before npm ci.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  requestPrice,
  subscriptionDollars,
  totalTokens,
  type Tokens,
} from "./pricing.mts";

export type Spend = {
  /** The priced requests' list price, in dollars. */
  dollars: number;
  /** Requests on a model with a list price. */
  priced: number;
  /** Tokens on models with no list price, by model. */
  unpriced: Map<string, number>;
};

export type Measured =
  { ok: true; spend: Spend } | { ok: false; reason: string };

type RawUsage = {
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;
  cache_creation?: {
    ephemeral_5m_input_tokens?: number;
    ephemeral_1h_input_tokens?: number;
  };
};

type Entry = {
  type?: string;
  timestamp?: string;
  requestId?: string;
  message?: { id?: string; model?: string; usage?: RawUsage };
};

function tokensOf(u: RawUsage): Tokens {
  const split = u.cache_creation;
  const write5m = split?.ephemeral_5m_input_tokens;
  const write1h = split?.ephemeral_1h_input_tokens;
  // Without the split, a write is billed as the default 5-minute one.
  const unsplit =
    write5m === undefined && write1h === undefined
      ? (u.cache_creation_input_tokens ?? 0)
      : 0;
  return {
    input: u.input_tokens ?? 0,
    cacheWrite5m: (write5m ?? 0) + unsplit,
    cacheWrite1h: write1h ?? 0,
    cacheRead: u.cache_read_input_tokens ?? 0,
    output: u.output_tokens ?? 0,
  };
}

/** The usage in JSONL transcripts, from `since` on when it is given. Entries
 * that repeat one API response's usage count once, by request ID, and
 * entries with no tokens, such as Claude Code's `<synthetic>` ones, are
 * skipped rather than reported as unpriced. */
export function spendIn(texts: string[], since: string | null = null): Spend {
  const from = since === null ? -Infinity : Date.parse(since);
  const requests = new Map<string, { model: string; tokens: Tokens }>();
  let anonymous = 0;
  for (const text of texts) {
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      let entry: Entry;
      try {
        entry = JSON.parse(line) as Entry;
      } catch {
        continue;
      }
      const model = entry.message?.model;
      const usage = entry.message?.usage;
      if (entry.type !== "assistant" || !model || !usage) continue;
      if (entry.timestamp && Date.parse(entry.timestamp) < from) continue;
      const key =
        entry.requestId ?? entry.message?.id ?? `anonymous-${anonymous++}`;
      // The last copy of a response carries its final output count.
      requests.set(key, { model, tokens: tokensOf(usage) });
    }
  }
  const spend: Spend = { dollars: 0, priced: 0, unpriced: new Map() };
  for (const { model, tokens } of requests.values()) {
    const price = requestPrice(model, tokens);
    if (price === null) {
      const total = totalTokens(tokens);
      if (total > 0)
        spend.unpriced.set(model, (spend.unpriced.get(model) ?? 0) + total);
    } else {
      spend.dollars += price;
      spend.priced += 1;
    }
  }
  return spend;
}

/** "$3.41" */
export const dollars = (amount: number) => `$${amount.toFixed(2)}`;

/** "$0.10 of the subscription ($3.41 at API list prices)" */
export const bothPrices = (listPrice: number) =>
  `${dollars(subscriptionDollars(listPrice))} of the subscription (${dollars(listPrice)} at API list prices)`;

/** ", plus 120,000 tokens on claude-fable-5-1 with no price" */
function unpricedClause(spend: Spend): string {
  if (spend.unpriced.size === 0) return "";
  const parts = [...spend.unpriced].map(
    ([model, tokens]) =>
      `${tokens.toLocaleString("en-US")} tokens on ${model} with no price`,
  );
  return `, plus ${parts.join(" and ")}`;
}

/** The cost note's visible line and hidden marker, or the line that says
 * why the cost could not be measured. */
export function costNote(
  measured: Measured,
  issue: number,
  session: string,
): string {
  const failed = (reason: string) =>
    `This session's cost could not be measured: ${reason}.`;
  if (!measured.ok) return failed(measured.reason);
  const { spend } = measured;
  if (spend.priced === 0)
    return failed(
      spend.unpriced.size === 0
        ? "its transcript records no usage since its last note"
        : `no token in it is on a model with a list price${unpricedClause(spend).replace(/^, plus/, ":")}`,
    );
  const amount = spend.dollars.toFixed(2);
  return `This session used ${bothPrices(spend.dollars)} on #${issue} since its last note${unpricedClause(spend)}.\n\n<!-- cost: ${amount} session=${session} -->`;
}

/** Where Claude Code keeps its transcripts. */
export function projectsDir(env: Record<string, string | undefined>): string {
  return join(env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "projects");
}

/** The session's own transcript and its subagents', or null when the
 * session's transcript is not there. */
export function sessionTranscripts(
  root: string,
  session: string,
): string[] | null {
  if (!existsSync(root)) return null;
  for (const project of readdirSync(root)) {
    const main = join(root, project, `${session}.jsonl`);
    if (!existsSync(main)) continue;
    const subagents = join(root, project, session, "subagents");
    const extra = existsSync(subagents)
      ? readdirSync(subagents)
          .filter((name) => name.endsWith(".jsonl"))
          .map((name) => join(subagents, name))
      : [];
    return [main, ...extra];
  }
  return null;
}

/** What this session spent since `since`, or since it started. */
export function measureSession(
  root: string,
  session: string,
  since: string | null,
): Measured {
  if (!session) return { ok: false, reason: "the session has no ID" };
  const paths = sessionTranscripts(root, session);
  if (!paths) return { ok: false, reason: `no transcript for ${session}` };
  const spend = spendIn(
    paths.map((p) => readFileSync(p, "utf8")),
    since,
  );
  return { ok: true, spend };
}
