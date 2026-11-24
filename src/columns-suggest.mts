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
import * as say from "./lib/output.mts";

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
  if (key === "ready") return "none";
  return `none, shows in ${columnFor(STATE_KEYS[key], toColumns(mapping))}`;
}

/** The table of each state's column, as `factory board check` words it. */
export function table(mapping: Mapping): say.Line[] {
  return [
    say.heads(
      [
        ["State", 11],
        ["Column", 0],
      ],
      { indent: 2 },
    ),
    ...KEYS.map((k) => say.row(k, shown(k, mapping), { width: 10 })),
  ];
}

/** What `Yes` writes under `tickets.columns`: every state, a column init
 * adds by its factory name. */
export function written(mapping: Mapping): [StateKey, string][] {
  return KEYS.map((k) => {
    const c = mapping[k];
    return [k, c === "none" ? "none" : c === "add" ? STATE_KEYS[k] : c.column];
  });
}

/** Every state written with the factory's own name: a board init creates,
 * one with no columns, and the answer No. */
export const FACTORY_LINES: [StateKey, string][] = KEYS.map((k) => [
  k,
  STATE_KEYS[k],
]);

export type SuggestDeps = {
  ask: Ask;
  out: say.Out;
  agent: Agent;
  /** The agent's registered label, which every line names it by. */
  label: string;
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

/** The "No column" choice for `key`, saying where its tickets show with
 * `columns` and no column of its own, or null where it has none. */
function noColumnFor(
  key: StateKey,
  columns: Columns,
  fromBoard: boolean,
): string | null {
  if (key === "backlog" || (key === "ready" && fromBoard)) return null;
  const others = { ...columns, [STATE_KEYS[key]]: null };
  return NO_COLUMN[key]!(columnFor(STATE_KEYS[key], others));
}

/** Asks which column shows `key`, with `current` selected. */
async function pickColumn(
  d: Pick<SuggestDeps, "ask">,
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

/** "Change some": the states you pick, of `keys`, then a column for each,
 * until no two states share one. `written` holds the states the settings
 * already give, by their whole lists, which the mapping shows joined. */
async function changeSome(
  d: Pick<SuggestDeps, "ask" | "out">,
  mapping: Mapping,
  columns: readonly string[],
  fromBoard: boolean,
  keys: readonly StateKey[] = KEYS,
  written: Partial<Record<StateKey, readonly string[] | null>> = {},
): Promise<Mapping> {
  const shownBy = (m: Mapping): Columns => {
    const out = toColumns(m);
    for (const [k, list] of Object.entries(written))
      out[STATE_KEYS[k as StateKey]] = list;
    return out;
  };
  const m = { ...mapping };
  let picked: string[] = [];
  for (;;) {
    picked = await d.ask.checkbox(
      "Which states do you want to change?",
      keys.map((k) => ({
        name: `${k}: ${shown(k, m)}`,
        value: k,
        checked: picked.includes(k),
      })),
    );
    let clash = false;
    for (const key of keys.filter((k) => picked.includes(k))) {
      const noColumn = noColumnFor(key, toColumns(m), fromBoard);
      const choice = choiceOf(
        await pickColumn(d, key, columns, valueOf(m[key]), noColumn),
      );
      const name = nameOf(key, choice);
      const other = name === null ? null : showing(name, key, shownBy(m));
      if (other) {
        d.out(
          say.text(
            `${name} already shows ${other}. Pick another column for ${key}.`,
          ),
        );
        clash = true;
        break;
      }
      m[key] = choice;
    }
    if (!clash) return m;
  }
}

/** The column step by hand: a column asked for each state in turn, then
 * the table to accept or change. The `tickets.columns` lines to write. */
export async function chooseColumns(
  d: Pick<SuggestDeps, "ask" | "out">,
  o: { columns: readonly string[]; fromBoard: boolean },
): Promise<[StateKey, string][]> {
  let mapping = {} as Mapping;
  const now = (): Columns =>
    Object.fromEntries(
      KEYS.map((k) => {
        const name = k in mapping ? nameOf(k, mapping[k]) : null;
        return [STATE_KEYS[k], name === null ? null : [name]];
      }),
    ) as Columns;
  for (const k of KEYS) {
    const own = onBoard(STATE_KEYS[k], o.columns);
    for (;;) {
      const choice = choiceOf(
        await pickColumn(
          d,
          k,
          o.columns,
          own === null ? ADD : `column:${own}`,
          noColumnFor(k, now(), o.fromBoard),
        ),
      );
      const name = nameOf(k, choice);
      const other = name === null ? null : showing(name, k, now());
      if (other === null) {
        mapping[k] = choice;
        break;
      }
      d.out(
        say.text(
          `${name} already shows ${other}. Pick another column for ${k}.`,
        ),
      );
    }
  }
  for (;;) {
    d.out(say.BLANK);
    for (const line of table(mapping)) d.out(line);
    d.out(say.BLANK);
    const use = await d.ask.select(
      "Use these columns?",
      [
        { name: "Yes", value: "yes" },
        { name: "Change some", value: "change" },
      ],
      "yes",
    );
    if (use === "yes") return written(mapping);
    mapping = await changeSome(d, mapping, o.columns, o.fromBoard);
  }
}

/** The column step: the mapping's `tickets.columns` lines to write, or 1
 * when the command stops. An answer that can't be used stops it, or with
 * `byHand` leaves each state's column to be chosen by hand. */
export async function suggestColumns(
  d: SuggestDeps,
  o: {
    board: number;
    columns: readonly string[];
    fromBoard: boolean;
    byHand?: boolean;
  },
): Promise<[StateKey, string][] | 1> {
  d.out(say.BLANK);
  d.out(say.text(boardLine(o.board, o.columns)));
  d.out(
    say.note(
      `Asking ${d.label} which of them shows each of the factory's six states...`,
    ),
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
    d.out(
      say.text(`${d.label}'s answer could not be used: ${checked.reason}.`),
    );
    if (o.byHand) {
      d.out(say.text("Choose the column for each state yourself."));
      return chooseColumns(d, o);
    }
    d.out(say.text(`Run factory init again, or ${AGAIN_OR_WRITE}`));
    d.out(say.text("Nothing changed."));
    return 1;
  }
  let mapping = checked.mapping;
  for (;;) {
    d.out(say.BLANK);
    for (const line of table(mapping)) d.out(line);
    d.out(say.BLANK);
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
    if (use === "no") return FACTORY_LINES;
    mapping = await changeSome(d, mapping, o.columns, o.fromBoard);
  }
}

/** A ready column, asked for when builds from the board turn on and the
 * settings give ready none: one of the board's, or null to add Ready. */
export async function askReady(
  d: Pick<SuggestDeps, "ask" | "out">,
  o: { columns: readonly string[]; current: Columns },
): Promise<string | null> {
  d.out(say.BLANK);
  d.out(
    say.text(
      "Builds from the board start when a ticket moves to the ready column,",
    ),
  );
  d.out(say.text("and your settings give ready no column."));
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
    d.out(
      say.text(
        `${name} already shows ${other}. Pick another column for ready.`,
      ),
    );
  }
}

/** A board with a column of each of the factory's names: init says so,
 * shows them as the board spells them, and writes them. */
export function everyColumn(
  d: Pick<SuggestDeps, "out">,
  o: { board: number; columns: readonly string[] },
): [StateKey, string][] {
  const mapping = Object.fromEntries(
    KEYS.map((k) => [k, { column: onBoard(STATE_KEYS[k], o.columns)! }]),
  ) as Mapping;
  d.out(say.BLANK);
  d.out(
    say.text(
      `Board ${o.board} has a column for each of the factory's six states:`,
    ),
  );
  d.out(say.BLANK);
  for (const line of table(mapping)) d.out(line);
  return written(mapping);
}

/** A re-run's column step for a block that leaves states out. Each state
 * left out takes the board's column of its factory name, when the board
 * has one no written state names, since that is the column the factory
 * read for it; any other is asked for. The lines to write for the states
 * left out. */
export async function fillColumns(
  d: Pick<SuggestDeps, "ask" | "out">,
  o: {
    board: number;
    columns: readonly string[];
    written: Partial<Record<StateKey, readonly string[] | null>>;
    fromBoard: boolean;
  },
): Promise<[StateKey, string][]> {
  const missing = KEYS.filter((k) => !(k in o.written));
  const lists: Partial<Record<StateKey, readonly string[] | null>> = {
    ...o.written,
  };
  const now = (): Columns =>
    Object.fromEntries(
      KEYS.map((k) => [STATE_KEYS[k], lists[k] ?? null]),
    ) as Columns;
  const mapping = {} as Mapping;
  for (const k of KEYS)
    if (k in o.written)
      mapping[k] =
        o.written[k] === null ? "none" : { column: o.written[k]!.join(", ") };
  const asks: [StateKey, string][] = [];
  for (const k of missing) {
    const name = onBoard(STATE_KEYS[k], o.columns);
    const other = name === null ? null : showing(name, k, now());
    if (name !== null && other === null) {
      mapping[k] = { column: name };
      lists[k] = [name];
    } else
      asks.push([
        k,
        name === null
          ? `board ${o.board} has no ${STATE_KEYS[k]} column`
          : `${name} already shows ${other}`,
      ]);
  }
  const lines = (m: Mapping) => written(m).filter(([k]) => missing.includes(k));
  d.out(say.BLANK);
  if (!asks.length) {
    d.out(
      say.text(`Your settings give no column to ${listed(missing, "or")}.`),
    );
    d.out(
      say.text(`Board ${o.board} has a column of the factory's name for each:`),
    );
    d.out(say.BLANK);
    for (const line of table(mapping)) d.out(line);
    return lines(mapping);
  }
  for (const [k, why] of asks) {
    d.out(say.text(`Your settings give no column to ${k}, and ${why}.`));
    for (;;) {
      const choice = choiceOf(
        await pickColumn(
          d,
          k,
          o.columns,
          ADD,
          noColumnFor(k, now(), o.fromBoard),
        ),
      );
      const name = nameOf(k, choice);
      const other = name === null ? null : showing(name, k, now());
      if (other === null) {
        mapping[k] = choice;
        lists[k] = name === null ? null : [name];
        break;
      }
      d.out(
        say.text(
          `${name} already shows ${other}. Pick another column for ${k}.`,
        ),
      );
    }
  }
  let m = mapping;
  for (;;) {
    d.out(say.BLANK);
    for (const line of table(m)) d.out(line);
    d.out(say.BLANK);
    const use = await d.ask.select(
      "Use these columns?",
      [
        { name: "Yes", value: "yes" },
        { name: "Change some", value: "change" },
      ],
      "yes",
    );
    if (use === "yes") return lines(m);
    m = await changeSome(d, m, o.columns, o.fromBoard, missing, o.written);
  }
}
