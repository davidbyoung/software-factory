// Refinement's factory fields in a ticket's own fields: which heading each
// key names, and how a ticket's document is split into its description and
// its ticket fields and joined back. It names no ticket system.

/** The factory fields a refined ticket has, in the order its body has them. */
export const FACTORY_FIELDS = [
  {
    key: "decisions",
    heading: "Decisions",
    holds: "the questions refinement settled, and what was chosen",
  },
  {
    key: "spec",
    heading: "Spec",
    holds: "what a change users will notice must do, line by line",
  },
  {
    key: "acceptance-criteria",
    heading: "Acceptance criteria",
    holds: "what must be true for any other ticket to be done",
  },
  {
    key: "for-the-builder",
    heading: "For the builder",
    holds: "how to build it, as a design and a list of tasks",
  },
] as const;

export type FactoryKey = (typeof FACTORY_FIELDS)[number]["key"];

/** Each ticket-side key under `tickets.fields`, in settings order, with
 * the ticket field that holds it, or null for the description. */
export type FieldMapping = Record<string, string | null>;

const MOCKUPS = "mockups";
/** Spec and Acceptance criteria may share a ticket field: a ticket has one. */
const SHARED = ["spec", "acceptance-criteria"];

/** The heading a key stands for: the factory's own, or the key with its
 * hyphens as spaces and its first letter capitalized. */
export function headingOf(key: string): string {
  const own = FACTORY_FIELDS.find((f) => f.key === key);
  if (own) return own.heading;
  const words = key.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The key a heading stands for: lowercase, with hyphens for spaces. */
export const keyOf = (heading: string) =>
  heading.trim().toLowerCase().replace(/\s+/g, "-");

/** Each line, with the key of the level-two heading it is, outside fenced
 * code, or null. */
function headings(lines: string[]): (string | null)[] {
  let fence: string | null = null;
  return lines.map((line) => {
    const mark = /^\s*(```+|~~~+)/.exec(line)?.[1];
    if (fence === null && mark) {
      fence = mark[0]!;
      return null;
    }
    if (fence !== null) {
      if (mark?.[0] === fence) fence = null;
      return null;
    }
    const h = /^## (.+?)\s*$/.exec(line);
    return h ? keyOf(h[1]!) : null;
  });
}

/** Lines with the blank ones at either end taken off. */
function trimmed(lines: string[]): string[] {
  let a = 0;
  let b = lines.length;
  while (a < b && !lines[a]!.trim()) a++;
  while (b > a && !lines[b - 1]!.trim()) b--;
  return lines.slice(a, b);
}

/** Pieces of text as a document: separated by one blank line, ending in
 * a newline. */
const document = (pieces: string[][]) =>
  pieces
    .map(trimmed)
    .filter((p) => p.length)
    .map((p) => p.join("\n"))
    .join("\n\n") + "\n";

const named = (mapping: FieldMapping) =>
  Object.entries(mapping).filter(
    (e): e is [string, string] => e[1] !== null && e[1] !== undefined,
  );

/** A ticket's document taken apart: the description, and each named ticket
 * field's text, or null to clear it. */
export function split(
  body: string,
  mapping: FieldMapping,
):
  | { description: string; values: Record<string, string | null> }
  | {
      error: string;
    } {
  const lines = body.split(/\r?\n/);
  const keys = headings(lines);
  const fieldOf = new Map(named(mapping));
  const enders = new Set([
    ...FACTORY_FIELDS.map((f) => f.key as string),
    MOCKUPS,
    ...fieldOf.keys(),
  ]);

  const kept: string[][] = [[]];
  const sections = new Map<string, string[]>();
  let into: string | null = null;
  for (const [i, line] of lines.entries()) {
    const key = keys[i];
    if (key !== null && key !== undefined && enders.has(key)) {
      if (fieldOf.has(key)) {
        into = key;
        sections.set(key, [...(sections.get(key) ?? []), ""]);
        continue;
      }
      into = null;
      kept.push([]);
    }
    if (into === null) kept.at(-1)!.push(line);
    else sections.get(into)!.push(line);
  }

  const shared = fieldOf.get(SHARED[0]!);
  if (
    shared !== undefined &&
    shared === fieldOf.get(SHARED[1]!) &&
    SHARED.every((k) => sections.has(k))
  )
    return {
      error: `Spec and Acceptance criteria both go in ${shared}, and the file has both: keep one.`,
    };
  const values: Record<string, string | null> = {};
  for (const [key, field] of fieldOf) {
    const text = sections.get(key);
    if (text !== undefined) values[field] = trimmed(text).join("\n");
    else if (!(field in values)) values[field] = null;
  }
  const description = document(kept);
  return { description: body.trim() ? description : body, values };
}

/** The order of the sections a body has: a heading of the repository's own
 * first, in settings order, then the factory's. */
const ORDER = [
  "decisions",
  "spec",
  "acceptance-criteria",
  MOCKUPS,
  "for-the-builder",
];

/** A ticket's document: its description with each ticket field's text under
 * its key's heading, before the first later heading the description has. */
export function join(
  description: string,
  values: Record<string, string>,
  mapping: FieldMapping,
  labels: readonly string[],
): string {
  const order = [
    ...Object.keys(mapping).filter((k) => !ORDER.includes(k)),
    ...ORDER,
  ];
  const pairs = named(mapping);
  const shared =
    pairs.filter(([k]) => SHARED.includes(k)).length === 2 &&
    mapping.spec === mapping["acceptance-criteria"];
  const reads = shared
    ? labels.includes("spec")
      ? "spec"
      : "acceptance-criteria"
    : null;

  let lines = description.replace(/\n+$/, "").split("\n");
  const add = pairs
    .filter(([k]) => !(shared && SHARED.includes(k) && k !== reads))
    .map(([k, field]) => [k, values[field] ?? ""] as const)
    .filter(([, text]) => text.trim())
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));
  for (const [key, text] of add) {
    const rank = order.indexOf(key);
    const at = headings(lines).findIndex(
      (k) => k !== null && order.indexOf(k) > rank,
    );
    const section = [`## ${headingOf(key)}`, "", ...trimmed(text.split("\n"))];
    lines =
      at === -1
        ? [...lines, "", ...section]
        : [...lines.slice(0, at), ...section, "", ...lines.slice(at)];
  }
  return document([lines]);
}
