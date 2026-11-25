// Refinement's factory fields in a ticket's own fields: which heading each
// key names, and how a ticket's document is split into its description and
// its ticket fields and joined back, and `init`'s field step, which asks the
// coding agent where each goes. It names no agent and no ticket system.
import { TICKET_LABELS } from "./labels.mts";
import type { Agent } from "./agent/types.mts";
import type { Ask } from "./init.mts";
import { listed } from "./lib/listed.mts";
import type { Check } from "./setup.mts";
import type { TicketField, Tickets } from "./tickets/types.mts";
import * as say from "./lib/output.mts";

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
      fence = mark;
      return null;
    }
    if (fence !== null) {
      if (mark?.[0] === fence[0] && mark.length >= fence.length) fence = null;
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
    ...Object.keys(mapping),
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
 * its key's heading, before the first later heading the description has.
 * `specLabel` is the name of the label that puts a ticket on the spec
 * track. */
export function join(
  description: string,
  values: Record<string, string>,
  mapping: FieldMapping,
  labels: readonly string[],
  specLabel: string = TICKET_LABELS.spec,
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
    ? labels.includes(specLabel)
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

/** The agent's answer for a factory field no ticket field fits. A token,
 * so a ticket field called "Description" stays usable. */
export const DESCRIPTION = "__description__";
export const TIMEOUT_MS = 60_000;

/** Each factory field's ticket field, or null for the description. */
export type Suggestion = Record<FactoryKey, string | null>;

const KEYS = FACTORY_FIELDS.map((f) => f.key);
const HEADING = Object.fromEntries(
  FACTORY_FIELDS.map((f) => [f.key, f.heading]),
) as Record<FactoryKey, string>;

export function prompt(fields: readonly TicketFieldInfo[]): string {
  return [
    "A software factory refines each ticket into parts, each under its own heading:",
    ...FACTORY_FIELDS.map((f) => `- ${f.key} (${f.heading}): ${f.holds}`),
    "",
    "The tickets have these text fields:",
    ...fields.map(
      (f) => `- ${f.name}${f.description ? `: ${f.description}` : ""}`,
    ),
    "",
    "For each part, say which one of the text fields should hold it.",
    `Answer ${DESCRIPTION} for a part no field clearly fits: it then stays in the ticket's description. Don't pick the nearest field when none fits.`,
    "Give each field to at most one part, except that spec and acceptance-criteria may share one, since a ticket has only one of them.",
    "Answer with a JSON object with each of the four parts as a key.",
  ].join("\n");
}

/** A field as the prompt and the checks need it. */
export type TicketFieldInfo = { name: string; description: string | null };

export function schema(fields: readonly TicketFieldInfo[]): object {
  const one = {
    type: "string",
    enum: [...fields.map((f) => f.name), DESCRIPTION],
  };
  return {
    type: "object",
    properties: Object.fromEntries(KEYS.map((k) => [k, one])),
    required: KEYS,
  };
}

/** Whether two factory fields may hold one ticket field. */
const mayShare = (a: string, b: string) =>
  SHARED.includes(a) && SHARED.includes(b) && a !== b;

/** The suggestion the agent's answer gives, or the reason it can't be
 * used, the first that applies in the order the issue lists them. */
export function check(
  answer: unknown,
  fields: readonly TicketFieldInfo[],
  repository: string,
): { suggestion: Suggestion } | { reason: string } {
  const form = { reason: "it did not answer in the form asked for" };
  if (typeof answer !== "object" || answer === null || Array.isArray(answer))
    return form;
  const raw = answer as Record<string, unknown>;
  const given = KEYS.filter((k) => typeof raw[k] === "string");
  for (const k of given) {
    const v = raw[k] as string;
    if (v !== DESCRIPTION && !fields.some((f) => f.name === v))
      return {
        reason: `it named ${v}, which ${repository}'s tickets don't have`,
      };
  }
  for (const [i, a] of given.entries())
    for (const b of given.slice(i + 1))
      if (raw[a] !== DESCRIPTION && raw[a] === raw[b] && !mayShare(a, b))
        return {
          reason: `it put ${raw[a]} in both ${HEADING[a]} and ${HEADING[b]}`,
        };
  const missing = KEYS.find((k) => raw[k] === undefined);
  if (missing) return { reason: `it left out ${HEADING[missing]}` };
  if (given.length < KEYS.length) return form;
  return {
    suggestion: Object.fromEntries(
      KEYS.map((k) => [k, raw[k] === DESCRIPTION ? null : raw[k]]),
    ) as Suggestion,
  };
}

const shownIn = (field: string | null) => field ?? "the description";

/** The table of each factory field's ticket field. */
export function table(suggestion: Suggestion): say.Line[] {
  return [
    say.heads(
      [
        ["Factory field", 22],
        ["Ticket field", 0],
      ],
      { indent: 2 },
    ),
    ...KEYS.map((k) =>
      say.row(HEADING[k], shownIn(suggestion[k]), { width: 22, gap: 0 }),
    ),
  ];
}

export type FieldStepDeps = {
  ask: Ask;
  out: say.Out;
  agent: Agent;
  /** The agent's registered label, which every line names it by. */
  label: string;
};

/** The factory field that already holds `field`, other than `key` and the
 * one it may share with, or null. */
function holding(
  field: string,
  key: FactoryKey,
  s: Suggestion,
): FactoryKey | null {
  return (
    KEYS.find((k) => k !== key && s[k] === field && !mayShare(k, key)) ?? null
  );
}

/** "Change some": the factory fields you pick, then a ticket field for
 * each, until no two share one they may not. */
async function changeSome(
  d: FieldStepDeps,
  suggestion: Suggestion,
  fields: readonly TicketFieldInfo[],
): Promise<Suggestion> {
  const s = { ...suggestion };
  let picked: string[] = [];
  for (;;) {
    picked = await d.ask.checkbox(
      "Which factory fields do you want to change?",
      KEYS.map((k) => ({
        name: `${HEADING[k]}: ${shownIn(s[k])}`,
        value: k,
        checked: picked.includes(k),
      })),
    );
    let clash = false;
    for (const key of KEYS.filter((k) => picked.includes(k))) {
      const v = await d.ask.select(
        `Where does ${HEADING[key]} go?`,
        [
          { name: "The description", value: DESCRIPTION },
          ...fields.map((f) => ({ name: f.name, value: `field:${f.name}` })),
        ],
        s[key] === null ? DESCRIPTION : `field:${s[key]}`,
      );
      const field = v === DESCRIPTION ? null : v.slice(6);
      const other = field === null ? null : holding(field, key, s);
      if (other) {
        d.out(
          say.text(
            `${field} already holds ${HEADING[other]}. Pick another ticket field for ${HEADING[key]}.`,
          ),
        );
        clash = true;
        break;
      }
      s[key] = field;
    }
    if (!clash) return s;
  }
}

/** The field step: the four factory fields' lines to write under
 * `tickets.fields`, or 1 when init stops. */
export async function suggestFields(
  d: FieldStepDeps,
  o: {
    repository: string;
    fields: readonly TicketFieldInfo[];
    /** The ticket system's label, when its fields show text as typed. */
    plainText: string | null;
  },
): Promise<[FactoryKey, string][] | 1> {
  d.out(say.BLANK);
  d.out(
    say.text(
      `${o.repository}'s tickets have the text fields ${listed(o.fields.map((f) => f.name))}.`,
    ),
  );
  d.out(
    say.note(
      `Asking ${d.label} which of them should hold each of the factory's fields...`,
    ),
  );
  const got = await d.agent.answer({
    prompt: prompt(o.fields),
    schema: schema(o.fields),
    timeoutMs: TIMEOUT_MS,
  });
  const checked =
    "timedOut" in got
      ? { reason: `it took longer than ${TIMEOUT_MS / 1000} seconds` }
      : "failed" in got
        ? {
            reason:
              got.failed.error === null
                ? `it failed with exit code ${got.failed.code}`
                : `it failed: ${got.failed.error}`,
          }
        : check(got.answer, o.fields, o.repository);
  if ("reason" in checked) {
    d.out(
      say.text(`${d.label}'s answer could not be used: ${checked.reason}.`),
    );
    d.out(
      say.text(
        "Run factory init again, or write tickets.fields in .claude/factory.yaml yourself.",
      ),
    );
    d.out(say.text("Nothing changed."));
    return 1;
  }
  let suggestion = checked.suggestion;
  for (;;) {
    d.out(say.BLANK);
    for (const line of table(suggestion)) d.out(line);
    d.out(say.BLANK);
    d.out(say.text("Your own text stays in the description."));
    if (o.plainText)
      d.out(
        say.text(
          `${o.plainText} shows a field's text as typed, without Markdown formatting.`,
        ),
      );
    d.out(say.BLANK);
    const use = await d.ask.select(
      "Use these ticket fields?",
      [
        { name: "Yes", value: "yes" },
        { name: "Change some", value: "change" },
        { name: "No: keep everything in the description", value: "no" },
      ],
      "yes",
    );
    if (use === "no") return KEYS.map((k) => [k, "none"]);
    if (use === "yes") return KEYS.map((k) => [k, suggestion[k] ?? "none"]);
    suggestion = await changeSome(d, suggestion, o.fields);
  }
}

const FIX =
  "Create the field, or change tickets.fields in .claude/factory.yaml";

/** The checks `factory doctor` and `init` end with: that each ticket field
 * the settings name exists and holds text. None when they name none. */
export async function fieldChecks(
  tickets: Tickets,
  mapping: FieldMapping,
  repository: string,
  /** The ticket system's registered label. */
  label: string,
): Promise<Check[]> {
  const wanted = named(mapping);
  if (!wanted.length) return [];
  if (!tickets.fields)
    return [
      {
        state: "fail",
        text: `${label} has no ticket fields, which tickets.fields names`,
        fix: FIX,
      },
    ];
  let known: TicketField[];
  try {
    known = await tickets.fields.list();
  } catch (e) {
    return [
      {
        state: "fail",
        text: `${repository}'s ticket fields can be read`,
        fix: (e instanceof Error ? e.message : String(e)).split("\n")[0],
      },
    ];
  }
  const failed: Check[] = [];
  for (const [key, name] of wanted) {
    const field = known.find((f) => f.name === name);
    if (!field)
      failed.push({
        state: "fail",
        text: `${repository}'s tickets have no field called ${name}, which tickets.fields.${key} names`,
        fix: FIX,
      });
    else if (!field.text)
      failed.push({
        state: "fail",
        text: `${name}, which tickets.fields.${key} names, doesn't hold text`,
        fix: FIX,
      });
  }
  return failed.length
    ? failed
    : [
        {
          state: "pass",
          text: `${repository}'s tickets have every field the settings name`,
        },
      ];
}
