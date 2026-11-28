// Which commands of a setting run for a change, and why: the one place the
// rule lives that a file nothing covers runs every command.
import { hasPaths, type Command } from "../config.mts";
import { matchesAny } from "./glob.mts";
import { runsOf, setsOff, type Run } from "./paths.mts";

/** The settings files: a change to one can add or change any command. */
export const SETTINGS_PATHS = [
  ".claude/lunamill.yaml",
  ".claude/lunamill.lock",
  ".claude/lunamill.choices.yaml",
];

/** Why every command runs, when they all do. */
export type Everything =
  | { kind: "asked" }
  | { kind: "unknown" }
  | { kind: "settings"; path: string }
  | { kind: "uncovered"; files: string[] };

export type Plan = {
  /** Every time a command of the setting could run, in order. */
  all: Run[];
  /** The ones that run, each with the changed files that set it off:
   * none for one that runs on every change. */
  runs: { run: Run; files: string[] }[];
  /** Whether any command says where it runs or what sets it off. */
  paths: boolean;
  everything: Everything | null;
  /** Whether every changed file is in `commands.ignore`. */
  ignoredOnly: boolean;
  /** Whether nothing changed. */
  nothing: boolean;
};

export type PlanInput = {
  commands: Command[];
  /** The changed files, or null when they can't be told. */
  change: string[] | null;
  /** The gate's commands, which say which files are covered. */
  gate: Command[];
  ignore: string[];
  /** The files git tracks, and the new ones it doesn't ignore. */
  files: string[];
  exists: (path: string) => boolean;
  /** Whether a file nothing covers, or a change to the settings, runs every
   * command of this setting. */
  everyCommand: boolean;
  /** `--all`. */
  all?: boolean;
};

/** The changed files nothing covers: no gate command's `files` match it,
 * and `commands.ignore` doesn't. None while the gate has no item. */
export function uncovered(
  change: readonly string[],
  i: Pick<PlanInput, "gate" | "ignore" | "files" | "exists">,
): string[] {
  const gate = i.gate
    .filter(hasPaths)
    .flatMap((c) => runsOf(c, i.files, i.exists));
  if (!i.gate.some(hasPaths)) return [];
  return change.filter(
    (f) => !matchesAny(f, i.ignore) && !gate.some((run) => setsOff(run, f)),
  );
}

export function planOf(i: PlanInput): Plan {
  const all = i.commands.flatMap((c) => runsOf(c, i.files, i.exists));
  const paths = i.commands.some(hasPaths);
  const every = (everything: Everything | null): Plan => ({
    all,
    runs: all.map((run) => ({ run, files: [] })),
    paths,
    everything,
    ignoredOnly: false,
    nothing: false,
  });
  if (!paths) return every(i.all ? { kind: "asked" } : null);
  if (i.all) return every({ kind: "asked" });
  if (i.change === null) return every({ kind: "unknown" });
  const change = i.change;
  if (i.everyCommand) {
    const path = SETTINGS_PATHS.find((p) => change.includes(p));
    if (path) return every({ kind: "settings", path });
    const files = uncovered(change, i);
    if (files.length) return every({ kind: "uncovered", files });
  }
  const live = change.filter((f) => !matchesAny(f, i.ignore));
  const runs: Plan["runs"] = [];
  for (const run of all) {
    if (!hasPaths(run.command)) {
      if (change.length) runs.push({ run, files: [] });
      continue;
    }
    const hits = live.filter((f) => setsOff(run, f));
    if (hits.length) runs.push({ run, files: hits });
  }
  return {
    all,
    runs,
    paths,
    everything: null,
    ignoredOnly: change.length > 0 && live.length === 0,
    nothing: change.length === 0,
  };
}

/** Why an item would not run, for `--dry-run`: its patterns as written. */
export const waitsOn = (run: Run): string[] => run.command.files ?? ["./**"];
