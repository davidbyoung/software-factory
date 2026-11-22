// The labels the factory adds to tickets and pull requests. Each has a key,
// which the skills, rules, and commands use, and a name, which the ticket
// system or code host shows: the key unless `tickets.labels` or
// `code-host.labels` sets another. It imports nothing that imports the
// settings, so the hooks can read it without them.

/** The labels on tickets, each key with its default name. */
export const TICKET_LABELS = {
  spec: "spec",
  "follow-up": "follow-up",
} as const;

/** The labels on pull requests, each key with its default name. */
export const PR_LABELS = {
  "merge-automatic": "merge-automatic",
  "merge-manual": "merge-manual",
  "verdict-override": "verdict-override",
} as const;

export type TicketLabel = keyof typeof TICKET_LABELS;
export type PrLabel = keyof typeof PR_LABELS;

/** The name in effect for each key. */
export type Labels = {
  tickets: Record<TicketLabel, string>;
  codeHost: Record<PrLabel, string>;
};

export const DEFAULT_LABELS: Labels = {
  tickets: { ...TICKET_LABELS },
  codeHost: { ...PR_LABELS },
};

/** A key's name on one side, or `word` unchanged when it is not one of
 * that side's keys, so a label of the repository's own passes through. */
export function labelOf(
  names: Readonly<Record<string, string>>,
  word: string,
): string {
  return Object.hasOwn(names, word) ? names[word]! : word;
}

/** Two names that differ only in capitals count as one label. */
export const sameLabel = (a: string, b: string) =>
  a.toLowerCase() === b.toLowerCase();

/** Labels as a person or a session reads them: one whose name is not its
 * key carries the key after it, as `needs-spec (spec)`, so a session that
 * knows only the key can tell which it is. */
export function shownLabels(
  labels: readonly string[],
  names: Readonly<Record<string, string>>,
): string[] {
  const keyOf = new Map(
    Object.entries(names)
      .filter(([key, name]) => key !== name)
      .map(([key, name]) => [name, key]),
  );
  return labels.map((l) => (keyOf.has(l) ? `${l} (${keyOf.get(l)})` : l));
}
