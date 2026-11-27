// What `factory init` and `factory init --org` both do: ask at the
// terminal, read a secret or a credential until it is taken or left empty,
// and give a board the factory's columns and fields.
import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants, statSync } from "node:fs";
import { delimiter, join } from "node:path";
import {
  branchPatternFault,
  columnsOf,
  fieldNamesOf,
  type Settings,
} from "./config.mts";
import { refusalReason } from "./lib/credentials.mts";
import type { Ask } from "./lib/prompts.mts";
import { DEFAULT_COLUMNS } from "./lib/work-status.mts";
import type { CredentialStep, SecretStep } from "./setup.mts";
import { statusOf } from "./tickets/transport.mts";
import type { BoardOps, NewField } from "./tickets/types.mts";
import * as say from "./lib/output.mts";

/** What reading a secret takes of a command's dependencies. */
export type Terminal = {
  ask: Ask;
  out: say.Out;
  /** Runs a command attached to the terminal, as `claude setup-token`. */
  interactive: (argv: string[]) => Promise<number>;
  openPage: (url: string) => void;
};

/** A pasted secret, joined where the terminal wrapped it: a token holds
 * no space or line break, and one copied from a wrapped line does. */
export const pasted = (value: string) => value.replace(/\s+/g, "");

/** Says what is wrong with a settings file or a preset that setup reads,
 * and ends it. */
export function notValid(d: Pick<Terminal, "out">, said: string): number {
  d.out(say.text(said));
  d.out(say.text("Fix it, then run init again."));
  return 1;
}

export const message = (e: unknown) =>
  e instanceof Error ? e.message : String(e);

/** A line before a credential is asked for, with the command init runs for
 * it as one to copy. */
function introLine(line: string, get: CredentialStep["get"]): say.Line {
  const command = get && "command" in get ? get.command.join(" ") : null;
  const at = command ? line.indexOf(command) : -1;
  return line === ""
    ? say.BLANK
    : at < 0
      ? say.text(line)
      : say.text(
          line.slice(0, at),
          say.copy(command!),
          say.asIs(line.slice(at + command!.length)),
        );
}

/** A line a check prints as it runs: that it has started, or a result. */
const progress = (line: string): say.Line =>
  line.endsWith("...") ? say.note(line) : say.text(line);

const BRANCH_QUESTION =
  "How should a build name its branch? Use {ticket}, and {user} for the GitHub account:";

/** The pattern a build names its branch by, asked until the answer is one
 * the settings check takes. */
export async function askBranchName(
  d: Pick<Terminal, "ask" | "out">,
): Promise<string> {
  for (;;) {
    const answer = (await d.ask.input(BRANCH_QUESTION, "{ticket}")).trim();
    const fault = branchPatternFault(answer);
    if (!fault) return answer;
    d.out(say.text(fault));
  }
}

/** A credential asked for part by part and checked together; asked again
 * from its first masked part when refused. Null when a part is left
 * empty, after the step's line and `again`. */
export async function askCredential(
  d: Terminal,
  step: CredentialStep,
  site: string,
  again: string,
): Promise<{ values: Record<string, string>; account: string } | null> {
  for (const l of step.intro) d.out(introLine(l, step.get));
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
        d.out(say.text(`${step.skipped} ${again}`));
        return null;
      }
      values[part.name] = value;
    }
    try {
      const checked = await step.check(values, site);
      for (const l of checked.lines) d.out(say.text(l));
      return { values, account: checked.account };
    } catch (e) {
      d.out(
        say.text(
          statusOf(e) === 401 ? step.refused(refusalReason(e)) : message(e),
        ),
      );
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
): Promise<{
  value: string;
  account?: string;
  kept?: Record<string, string>;
} | null> {
  for (const l of step.intro) d.out(introLine(l, step.get));
  if (step.get && "page" in step.get) d.openPage(step.get.page);
  if (step.get && "command" in step.get) await d.interactive(step.get.command);
  for (;;) {
    const value = pasted(await d.ask.secret(step.prompt));
    if (!value) {
      d.out(say.text(`${step.skipped} ${again}`));
      return null;
    }
    let checked: {
      lines: string[];
      account?: string;
      kept?: Record<string, string>;
    } = { lines: [] };
    if (step.verify)
      try {
        checked = await step.verify(value, (l) => d.out(progress(l)));
      } catch (e) {
        d.out(say.text(message(e)));
        continue;
      }
    for (const l of checked.lines) d.out(say.text(l));
    return { value, account: checked.account, kept: checked.kept };
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
    d.out(say.text(`Added to board ${board}: ${added.join(", ")}.`));
  // A ticket system that cannot add them leaves them to the owner.
  if (!addColumns) {
    const has = await boardOps.columns(board);
    const lacking = shape.columns.filter(
      (c) => !has.some((h) => h.toLowerCase() === c.toLowerCase()),
    );
    if (lacking.length)
      d.out(
        say.action(
          `Add these columns to board ${board} by hand:`,
          say.asIs(` ${lacking.join(", ")}.`),
        ),
      );
  }
  if (!addFields && shape.fields.length)
    d.out(
      say.action(
        `Add any of these fields board ${board} lacks, by hand:`,
        say.asIs(` ${shape.fields.map((f) => f.name).join(", ")}.`),
      ),
    );
}

export { DOCS_PAGES, docsPage } from "./lib/docs-page.mts";

type Env = Record<string, string | undefined>;

/** Whether a command's file is in a folder of the PATH. It is found, not
 * run: `explorer.exe` opens a window whatever it is given. */
export function onPath(name: string, env: Env): boolean {
  return (env.PATH ?? "").split(delimiter).some((folder) => {
    if (!folder) return false;
    try {
      accessSync(join(folder, name), constants.X_OK);
      return statSync(join(folder, name)).isFile();
    } catch {
      return false;
    }
  });
}

/** The command that opens a page in the person's browser. In WSL that is
 * one of Windows' own, since `xdg-open` has no browser to hand it to. */
export function pageOpener(
  platform: string,
  env: Env,
  has: (name: string) => boolean,
): string {
  if (platform === "darwin") return "open";
  if (platform === "win32") return "explorer";
  if (env.WSL_DISTRO_NAME)
    return ["wslview", "explorer.exe"].find(has) ?? "xdg-open";
  return "xdg-open";
}

/** Opens a page in the person's browser, when there is one to open it:
 * the caller prints the address too. */
export function openPage(url: string): void {
  const opener = pageOpener(process.platform, process.env, (name) =>
    onPath(name, process.env),
  );
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
