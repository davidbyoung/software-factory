// What `factory init` and `factory init --org` both do: ask at the
// terminal, read a secret or a credential until it is taken or left empty,
// and give a board the factory's columns and fields.
import { spawn, spawnSync } from "node:child_process";
import { columnsOf, fieldNamesOf, type Settings } from "./config.mts";
import { refusalReason } from "./lib/credentials.mts";
import { DEFAULT_COLUMNS } from "./lib/work-status.mts";
import type { CredentialStep, SecretStep } from "./setup.mts";
import { statusOf } from "./tickets/transport.mts";
import type { BoardOps, NewField } from "./tickets/types.mts";

/** The questions init asks. Each is answered at the terminal, and in tests
 * from a script. */
export type Ask = {
  checkbox(
    message: string,
    choices: {
      name: string;
      value: string;
      checked: boolean;
      /** Shown under the list while this choice is highlighted. */
      description?: string;
    }[],
  ): Promise<string[]>;
  select(
    message: string,
    choices: { name: string; value: string }[],
    /** The value chosen when the person picks nothing else. */
    fallback?: string,
  ): Promise<string>;
  confirm(message: string, fallback: boolean): Promise<boolean>;
  /** Read without echoing what is typed. */
  secret(message: string): Promise<string>;
  input(message: string, fallback: string): Promise<string>;
};

/** What reading a secret takes of a command's dependencies. */
export type Terminal = {
  ask: Ask;
  out: (line: string) => void;
  /** Runs a command attached to the terminal, as `claude setup-token`. */
  interactive: (argv: string[]) => Promise<number>;
  openPage: (url: string) => void;
};

/** A pasted secret, joined where the terminal wrapped it: a token holds
 * no space or line break, and one copied from a wrapped line does. */
export const pasted = (value: string) => value.replace(/\s+/g, "");

export const message = (e: unknown) =>
  e instanceof Error ? e.message : String(e);

/** A credential asked for part by part and checked together; asked again
 * from its first masked part when refused. Null when a part is left
 * empty, after the step's line and `again`. */
export async function askCredential(
  d: Terminal,
  step: CredentialStep,
  site: string,
  again: string,
): Promise<{ values: Record<string, string>; account: string } | null> {
  for (const l of step.intro) d.out(l);
  if (step.get && "page" in step.get) d.openPage(step.get.page);
  if (step.get && "command" in step.get) await d.interactive(step.get.command);
  const values: Record<string, string> = {};
  let from = 0;
  for (;;) {
    for (const part of step.parts.slice(from)) {
      const value = part.masked
        ? pasted(await d.ask.secret(part.prompt))
        : (await d.ask.input(part.prompt, "")).trim();
      if (!value) {
        d.out(`${step.skipped} ${again}`);
        return null;
      }
      values[part.name] = value;
    }
    try {
      const checked = await step.check(values, site);
      for (const l of checked.lines) d.out(l);
      return { values, account: checked.account };
    } catch (e) {
      d.out(statusOf(e) === 401 ? step.refused(refusalReason(e)) : message(e));
      from = Math.max(
        0,
        step.parts.findIndex((p) => p.masked),
      );
    }
  }
}

/** A secret read in a masked prompt, asked again while the tool refuses
 * it. Null when it is left empty, after the step's line and `again`. */
export async function askSecret(
  d: Terminal,
  step: SecretStep,
  again: string,
): Promise<{ value: string; account?: string } | null> {
  for (const l of step.intro) d.out(l);
  if (step.get && "page" in step.get) d.openPage(step.get.page);
  if (step.get && "command" in step.get) await d.interactive(step.get.command);
  for (;;) {
    const value = pasted(await d.ask.secret(step.prompt));
    if (!value) {
      d.out(`${step.skipped} ${again}`);
      return null;
    }
    let checked: { lines: string[]; account?: string } = { lines: [] };
    if (step.verify)
      try {
        checked = await step.verify(value);
      } catch (e) {
        d.out(message(e));
        continue;
      }
    for (const l of checked.lines) d.out(l);
    return { value, account: checked.account };
  }
}

/** The columns and fields the board sync uses: the settings' names where
 * they rename one, and none for one they set to none. */
export function boardShape(s: Settings | null): {
  columns: string[];
  fields: NewField[];
} {
  const columns = Object.values(s ? columnsOf(s) : DEFAULT_COLUMNS).flatMap(
    (c) => c ?? [],
  );
  const names = s
    ? fieldNamesOf(s)
    : { session: "Session", runsIn: "Runs in", cost: "Cost" };
  const fields: NewField[] = [];
  if (names.session) fields.push({ name: names.session, type: "text" });
  if (names.runsIn)
    fields.push({
      name: names.runsIn,
      type: "select",
      options: ["Local", "Actions"],
    });
  if (names.cost) fields.push({ name: names.cost, type: "number" });
  return { columns, fields };
}

/** Gives a board whichever of the columns and fields it lacks, and says
 * which it added, unless `o.added` is false, and which are left to add by
 * hand. */
export async function giveBoard(
  d: Pick<Terminal, "out">,
  boardOps: BoardOps,
  board: number,
  shape: { columns: string[]; fields: NewField[] },
  o: { added?: boolean } = {},
): Promise<void> {
  const { addColumns, addFields } = boardOps;
  const columns = addColumns ? await addColumns(board, shape.columns) : [];
  const fields = addFields ? await addFields(board, shape.fields) : [];
  const added = [...columns, ...fields];
  if (added.length && o.added !== false)
    d.out(`Added to board ${board}: ${added.join(", ")}.`);
  // A ticket system that cannot add them leaves them to the owner.
  if (!addColumns) {
    const has = await boardOps.columns(board);
    const lacking = shape.columns.filter(
      (c) => !has.some((h) => h.toLowerCase() === c.toLowerCase()),
    );
    if (lacking.length)
      d.out(
        `Add these columns to board ${board} by hand: ${lacking.join(", ")}.`,
      );
  }
  if (!addFields && shape.fields.length)
    d.out(
      `Add any of these fields board ${board} lacks, by hand: ${shape.fields.map((f) => f.name).join(", ")}.`,
    );
}

/** The questions, asked at the terminal. */
export async function terminalAsk(): Promise<Ask> {
  const p = await import("@inquirer/prompts");
  return {
    checkbox: (message, choices) => p.checkbox({ message, choices }),
    select: (message, choices, fallback) =>
      p.select({ message, choices, default: fallback }),
    confirm: (message, fallback) => p.confirm({ message, default: fallback }),
    secret: (message) => p.password({ message, mask: "•" }),
    input: (message, fallback) => p.input({ message, default: fallback }),
  };
}

/** Opens a page in the person's browser. */
export function openPage(url: string): void {
  const opener =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "explorer"
        : "xdg-open";
  try {
    spawn(opener, [url], { stdio: "ignore", detached: true })
      .on("error", () => {})
      .unref();
  } catch {
    // The page's address is printed too, to open by hand.
  }
}

export const interactive = async (argv: string[]): Promise<number> =>
  spawnSync(argv[0]!, argv.slice(1), { stdio: "inherit" }).status ?? 1;
