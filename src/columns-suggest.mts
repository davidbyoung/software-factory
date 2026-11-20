// `init`'s column step: the coding agent suggests which of a board's
// columns shows each of the factory's six states, and you accept, change,
// or refuse the suggestion. It names no agent and no ticket system: the
// agent is the registry's, by its label, and the board's columns are given.
import type { Agent } from "./agent/types.mts";
import type { Ask } from "./init.mts";
import { listed } from "./lib/listed.mts";
import {
  STATE_KEYS,
  columnFor,
  sameName,
  type Columns,
  type StateKey,
} from "./lib/work-status.mts";

/** A state's column: one of the board's, by the board's spelling; the
 * factory's own name, which init adds; or none. */
export type Choice = { column: string } | "add" | "none";
export type Mapping = Record<StateKey, Choice>;

export const NONE = "__none__";
export const ADD = "__add__";
export const TIMEOUT_MS = 60_000;

const KEYS = Object.keys(STATE_KEYS) as StateKey[];

/** What each state means, as `docs/workflow.md` "The six states" says. */
const MEANING: Record<StateKey, string> = {
  backlog: "nothing is happening",
  refining:
    "a session is turning it into a spec, or the spec is written and waits for you",
  ready: "you approved it for a build from the board",
  building:
    "a session has claimed it, or a build ended without a pull request merging",
  review: "a pull request that closes it is open",
  done: "the ticket is closed",
};

/** Where a ticket goes with no column, after "No column: ". */
const NO_COLUMN: Record<StateKey, ((shownIn: string) => string) | null> = {
  backlog: null,
  refining: (c) => `a ticket being refined shows in ${c}`,
  ready: () => "builds start only when you ask",
  building: (c) => `a ticket being built shows in ${c}`,
  review: (c) => `a ticket in review shows in ${c}`,
  done: (c) => `a ticket that is done shows in ${c}`,
};

export function prompt(columns: readonly string[], fromBoard: boolean): string {
  return [
    "A software factory moves each ticket through six states, in this order:",
    ...KEYS.map((k) => `- ${k}: ${MEANING[k]}`),
    "",
    "A kanban board has these columns, in this order:",
    ...columns.map((c) => `- ${c}`),
    "",
    "For each state, say which one of the board's columns shows it. Give each column to at most one state.",
    `Answer ${NONE} for a state no column shows: its tickets then stay in the column of the nearest earlier state. backlog always needs a column.`,
    fromBoard
      ? "ready needs a column, since builds start when a ticket moves there."
      : `ready may be ${NONE}: builds then start only when someone asks.`,
    `Answer ${ADD} for a state that should get a new column of its own.`,
    "Answer with a JSON object with each of the six states as a key.",
  ].join("\n");
}

export function schema(columns: readonly string[]): object {
  const one = { type: "string", enum: [...columns, NONE, ADD] };
  return {
    type: "object",
    properties: Object.fromEntries(KEYS.map((k) => [k, one])),
    required: KEYS,
  };
}

/** The board's spelling of `name`, or null when it has no such column. */
const onBoard = (name: string, columns: readonly string[]) =>
  columns.find((c) => sameName(c, name)) ?? null;

/** The column a choice puts on the board, or null for none. */
const nameOf = (key: StateKey, c: Choice): string | null =>
  c === "none" ? null : c === "add" ? STATE_KEYS[key] : c.column;

/** The mapping the agent's answer gives, or the reason it can't be used,
 * the first that applies in the order the issue lists them. */
export function check(
  answer: unknown,
  columns: readonly string[],
  fromBoard: boolean,
  board: number,
): { mapping: Mapping } | { reason: string } {
  const form = { reason: "it did not answer in the form asked for" };
  if (typeof answer !== "object" || answer === null || Array.isArray(answer))
    return form;
  const raw = answer as Record<string, unknown>;
  const given = KEYS.filter((k) => typeof raw[k] === "string");

  for (const k of given) {
    const v = raw[k] as string;
    if (v !== NONE && v !== ADD && !onBoard(v, columns))
      return { reason: `it named ${v}, which board ${board} doesn't have` };
  }
  const mapping = {} as Mapping;
  for (const k of given) {
    const v = raw[k] as string;
    const existing =
      v === ADD ? onBoard(STATE_KEYS[k], columns) : onBoard(v, columns);
    mapping[k] = v === NONE ? "none" : existing ? { column: existing } : "add";
  }
  for (const [i, a] of given.entries())
    for (const b of given.slice(i + 1)) {
      const x = nameOf(a, mapping[a]);
      const y = nameOf(b, mapping[b]);
      if (x !== null && y !== null && sameName(x, y))
        return { reason: `it put ${x} in both ${a} and ${b}` };
    }
  const missing = KEYS.find((k) => raw[k] === undefined);
  if (missing) return { reason: `it left out ${missing}` };
  if (given.length < KEYS.length) return form;
  if (mapping.backlog === "none")
    return {
      reason: "it gave backlog no column, and every ticket starts there",
    };
  if (mapping.ready === "none" && fromBoard)
    return {
      reason: "it gave ready no column, and builds start from the board",
    };
  return { mapping };
}

/** The columns a mapping gives each state, a column init adds by its
 * factory name. */
export function toColumns(mapping: Mapping): Columns {
  return Object.fromEntries(
    KEYS.map((k) => {
      const name = nameOf(k, mapping[k]);
      return [STATE_KEYS[k], name === null ? null : [name]];
    }),
  ) as Columns;
}

/** A state's column as the table shows it. */
function shown(key: StateKey, mapping: Mapping): string {
  const c = mapping[key];
  if (c === "add") return `${STATE_KEYS[key]}, which init adds`;
  if (c !== "none") return c.column;
  if (key === "ready") return "no column: builds start only when you ask";
  return `no column, shows in ${columnFor(STATE_KEYS[key], toColumns(mapping))}`;
}

/** The table of each state's column, as `factory board check` words it. */
export function table(mapping: Mapping): string[] {
  const pad = (label: string) => `  ${label.padEnd(10)} `;
  return [
    `${pad("State")}Column`,
    ...KEYS.map((k) => pad(k) + shown(k, mapping)),
  ];
}

/** What `Yes` writes under `tickets.columns`: each state whose column is
 * not the factory's own name. */
export function written(mapping: Mapping): [StateKey, string][] {
  return KEYS.flatMap((k): [StateKey, string][] => {
    const c = mapping[k];
    if (c === "add") return [];
    if (c === "none") return [[k, "none"]];
    return sameName(c.column, STATE_KEYS[k]) ? [] : [[k, c.column]];
  });
}

export type SuggestDeps = {
  ask: Ask;
  out: (line: string) => void;
  agent: Agent;
  /** The agent's registered label, which every line names it by. */
  label: string;
  hasCommand: (name: string) => boolean;
};

const AGAIN_OR_WRITE =
  "write tickets.columns in .claude/factory.yaml yourself.";

/** The board's columns, as init's first line about them says. */
export const boardLine = (board: number, columns: readonly string[]) =>
  `Board ${board} has the columns ${listed(columns)}.`;

/** The other state a column already shows, or null. */
function showing(
  name: string,
  key: StateKey,
  current: Columns,
): StateKey | null {
  return (
    KEYS.find(
      (k) =>
        k !== key &&
        (current[STATE_KEYS[k]] ?? []).some((c) => sameName(c, name)),
    ) ?? null
  );
}

/** Asks which column shows `key`, with `current` selected. */
async function pickColumn(
  d: SuggestDeps,
  key: StateKey,
  columns: readonly string[],
  current: string,
  noColumn: string | null,
): Promise<string> {
  const factory = STATE_KEYS[key];
  return d.ask.select(
    `Which column shows ${key}?`,
    [
      ...columns.map((c) => ({ name: c, value: `column:${c}` })),
      ...(noColumn === null
        ? []
        : [{ name: `No column: ${noColumn}`, value: NONE }]),
      ...(onBoard(factory, columns)
        ? []
        : [{ name: `Add a column called "${factory}"`, value: ADD }]),
    ],
    current,
  );
}

const valueOf = (c: Choice) =>
  c === "none" ? NONE : c === "add" ? ADD : `column:${c.column}`;
const choiceOf = (v: string): Choice =>
  v === NONE ? "none" : v === ADD ? "add" : { column: v.slice(7) };

/** "Change some": the states you pick, then a column for each, until no
 * two states share one. */
async function changeSome(
  d: SuggestDeps,
  mapping: Mapping,
  columns: readonly string[],
  fromBoard: boolean,
): Promise<Mapping> {
  const m = { ...mapping };
  let picked: string[] = [];
  for (;;) {
    picked = await d.ask.checkbox(
      "Which states do you want to change?",
      KEYS.map((k) => ({
        name: `${k}: ${shown(k, m)}`,
        value: k,
        checked: picked.includes(k),
      })),
    );
    let clash = false;
    for (const key of KEYS.filter((k) => picked.includes(k))) {
      const others = { ...m, [key]: "none" } as Mapping;
      const noColumn =
        key === "backlog" || (key === "ready" && fromBoard)
          ? null
          : NO_COLUMN[key]!(columnFor(STATE_KEYS[key], toColumns(others)));
      const choice = choiceOf(
        await pickColumn(d, key, columns, valueOf(m[key]), noColumn),
      );
      const name = nameOf(key, choice);
      const other = name === null ? null : showing(name, key, toColumns(m));
      if (other) {
        d.out(
          `${name} already shows ${other}. Pick another column for ${key}.`,
        );
        clash = true;
        break;
      }
      m[key] = choice;
    }
    if (!clash) return m;
  }
}

/** The column step: the mapping's `tickets.columns` lines to write, none
 * for the factory's own columns, or 1 when init stops. */
export async function suggestColumns(
  d: SuggestDeps,
  o: { board: number; columns: readonly string[]; fromBoard: boolean },
): Promise<[StateKey, string][] | "default" | 1> {
  d.out("");
  d.out(boardLine(o.board, o.columns));
  if (!d.agent.installed(d.hasCommand)) {
    d.out(
      `Matching them to the factory's six states needs ${d.label}, which is not installed.`,
    );
    d.out(`Install it and run factory init again, or ${AGAIN_OR_WRITE}`);
    d.out("Nothing changed.");
    return 1;
  }
  d.out(
    `Asking ${d.label} which of them shows each of the factory's six states...`,
  );
  const got = await d.agent.answer({
    prompt: prompt(o.columns, o.fromBoard),
    schema: schema(o.columns),
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
        : check(got.answer, o.columns, o.fromBoard, o.board);
  if ("reason" in checked) {
    d.out(`${d.label}'s answer could not be used: ${checked.reason}.`);
    d.out(`Run factory init again, or ${AGAIN_OR_WRITE}`);
    d.out("Nothing changed.");
    return 1;
  }
  let mapping = checked.mapping;
  for (;;) {
    d.out("");
    for (const line of table(mapping)) d.out(line);
    d.out("");
    const use = await d.ask.select(
      "Use these columns?",
      [
        { name: "Yes", value: "yes" },
        { name: "Change some", value: "change" },
        { name: "No: add the factory's columns instead", value: "no" },
      ],
      "yes",
    );
    if (use === "yes") return written(mapping);
    if (use === "no") return "default";
    mapping = await changeSome(d, mapping, o.columns, o.fromBoard);
  }
}

/** A ready column, asked for when builds from the board turn on and the
 * settings give ready none: one of the board's, or null to add Ready. */
export async function askReady(
  d: Pick<SuggestDeps, "ask" | "out">,
  o: { columns: readonly string[]; current: Columns },
): Promise<string | null> {
  d.out("");
  d.out("Builds from the board start when a ticket moves to the ready column,");
  d.out("and your settings give ready no column.");
  for (;;) {
    const v = await d.ask.select("Which column shows ready?", [
      ...o.columns.map((c) => ({ name: c, value: `column:${c}` })),
      ...(onBoard("Ready", o.columns)
        ? []
        : [{ name: 'Add a column called "Ready"', value: ADD }]),
    ]);
    if (v === ADD) return null;
    const name = v.slice(7);
    const other = showing(name, "ready", o.current);
    if (!other) return name;
    d.out(`${name} already shows ${other}. Pick another column for ready.`);
  }
}
