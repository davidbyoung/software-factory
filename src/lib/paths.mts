// Where a command of the settings runs, and which files set it off: the
// folders its `in` names, and its `files` read from each of them.
import type { Command } from "../config.mts";
import { matchesAny } from "./glob.mts";

/** A command as it runs once: in one folder, or from the root. */
export type Run = { command: Command; folder: string | null };

/** The folders `in` names. A `*`, always a whole last name, stands for each
 * folder directly under its parent that exists and holds one of `files`
 * (the files git tracks, and the new ones it doesn't ignore), in name
 * order. */
export function foldersOf(
  ins: readonly string[],
  files: readonly string[],
  exists: (path: string) => boolean,
): string[] {
  const out: string[] = [];
  for (const folder of ins) {
    if (!folder.endsWith("*")) {
      out.push(folder);
      continue;
    }
    const parent = folder.slice(0, -1);
    const names = new Set<string>();
    for (const f of files) {
      if (!f.startsWith(parent)) continue;
      const rest = f.slice(parent.length);
      const slash = rest.indexOf("/");
      if (slash > 0) names.add(rest.slice(0, slash));
    }
    for (const name of [...names].sort()) {
      const path = `${parent}${name}`;
      if (exists(path)) out.push(path);
    }
  }
  return [...new Set(out)];
}

/** Each time a command runs: once in each of its folders, or once from the
 * root. */
export function runsOf(
  command: Command,
  files: readonly string[],
  exists: (path: string) => boolean,
): Run[] {
  if (command.in === null) return [{ command, folder: null }];
  return foldersOf(command.in, files, exists).map((folder) => ({
    command,
    folder,
  }));
}

/** A path or pattern the settings wrote, read from `folder` when it starts
 * with `./`, and from the root otherwise. */
export function fromFolder(path: string, folder: string | null): string {
  if (!path.startsWith("./")) return path;
  return folder === null ? path.slice(2) : `${folder}/${path.slice(2)}`;
}

/** The patterns that set a command off in one folder: its `files`, or
 * every file in its folder when it has none. */
export function patternsIn(command: Command, folder: string | null): string[] {
  const written = command.files ?? ["./**"];
  return written.map((p) => fromFolder(p, folder));
}

/** Whether `file` sets the command off in `folder`. */
export const setsOff = (run: Run, file: string): boolean =>
  matchesAny(file, patternsIn(run.command, run.folder));

/** The command as a person would paste it from the root. */
export const commandLine = (run: Run): string =>
  run.folder === null
    ? run.command.run
    : `cd ${run.folder} && ${run.command.run}`;
