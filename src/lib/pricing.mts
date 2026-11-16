// What the same tokens would cost on the Claude API, at list price, and the
// share of the owner's subscription they used. The owner pays a flat fee, so
// the list price is a measure of tokens, not a charge. Node built-ins only:
// the hooks run it before npm ci.
//
// Prices per million tokens, from
// https://platform.claude.com/docs/en/about-claude/pricing (read 2026-11-11).

/** One request's tokens, by how they are billed. */
export type Tokens = {
  input: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  cacheRead: number;
  output: number;
};

type Rates = Tokens;

/** Haiku 5.5 bills a request whose prompt is over this many tokens at its
 * higher rates. */
const HAIKU_LONG_PROMPT = 100_000;

export const PRICES: Record<string, Rates | { short: Rates; long: Rates }> = {
  "claude-fable-5-2": {
    input: 8,
    cacheWrite5m: 10,
    cacheWrite1h: 16,
    cacheRead: 0.2,
    output: 40,
  },
  "claude-opus-5-5": {
    input: 4,
    cacheWrite5m: 5,
    cacheWrite1h: 8,
    cacheRead: 0.2,
    output: 20,
  },
  "claude-sonnet-5-5": {
    input: 2,
    cacheWrite5m: 2.5,
    cacheWrite1h: 4,
    cacheRead: 0.1,
    output: 10,
  },
  "claude-haiku-5-5": {
    short: {
      input: 0.1,
      cacheWrite5m: 0.125,
      cacheWrite1h: 0.2,
      cacheRead: 0.01,
      output: 0.5,
    },
    long: {
      input: 0.5,
      cacheWrite5m: 0.625,
      cacheWrite1h: 1,
      cacheRead: 0.05,
      output: 2.5,
    },
  },
};

/** Subscription dollars per list-price dollar. An estimate from one week:
 * $276.32 of list price used 35% of the Max plan's weekly allowance
 * (2026-11-12), and a week is 12/52 of the $100 monthly fee. No script can
 * read the allowance, so this is recalibrated by hand, and a change to it
 * reprices every card on the board at the next sync. */
export const SUBSCRIPTION_RATE = 0.03;

/** A list price as its share of the subscription, in dollars. */
export const subscriptionDollars = (listPrice: number) =>
  listPrice * SUBSCRIPTION_RATE;

export const totalTokens = (t: Tokens) =>
  t.input + t.cacheWrite5m + t.cacheWrite1h + t.cacheRead + t.output;

/** The prompt, as the long-prompt rule counts it: everything sent. */
const promptTokens = (t: Tokens) =>
  t.input + t.cacheWrite5m + t.cacheWrite1h + t.cacheRead;

/** One request's list price in dollars, or null for a model with no price. */
export function requestPrice(model: string, t: Tokens): number | null {
  const entry = PRICES[model];
  if (!entry) return null;
  const rates =
    "short" in entry
      ? promptTokens(t) > HAIKU_LONG_PROMPT
        ? entry.long
        : entry.short
      : entry;
  return (
    (t.input * rates.input +
      t.cacheWrite5m * rates.cacheWrite5m +
      t.cacheWrite1h * rates.cacheWrite1h +
      t.cacheRead * rates.cacheRead +
      t.output * rates.output) /
    1_000_000
  );
}
