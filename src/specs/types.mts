// What a spec tool gives kodor. Each tool is one adapter in this
// folder; `kodor specs`, `kodor init`, the settings check, and the merge
// policy reach a tool only through this type.

/** Runs a command from `cwd` with `env` added to the environment, and
 * returns its exit status. A quiet run prints nothing; any other passes
 * the command's output through. */
export type Run = (
  argv: string[],
  cwd: string,
  env: Record<string, string>,
  quiet: boolean,
) => number;

/** A file a build writes or updates from a ticket's body, and what goes in
 * it. */
export type SpecFile = { kind: "new" | "update"; path: string; what: string };

export type SpecTool = {
  /** Its name in init's messages, such as `OpenSpec`. */
  name: string;
  /** Its option in init's question. */
  label: string;
  install: {
    /** What is installed, such as `@fission-ai/openspec`. */
    package: string;
    /** The command that installs it, without the package. */
    via: string;
    installed(root: string): boolean;
  };
  /** The check `specs.check` defaults to. */
  defaultCheck: string;
  /** Added to the environment of every command the tool runs. */
  env: Record<string, string>;
  /** Its files that never merge without the owner, from the root. */
  processFiles: readonly string[];
  /** Whether its command runs at the repository's root. */
  runs(root: string): boolean;
  /** Each spec it keeps, by name, with its file from the root. */
  list(root: string): { name: string; path: string }[];
  /** The folder ticket `id`'s spec is written in, ending in `/`. */
  folder(id: string): string;
  started(root: string, id: string): boolean;
  /** Starts ticket `id`'s spec; its exit status. */
  start(root: string, id: string): number;
  /** The files to write, for a ticket with the `spec` label or without. */
  files(id: string, spec: boolean): SpecFile[];
  /** What to run once the files are written. */
  then: string;
  /** Whether ticket `id`'s spec is already folded in. */
  finished(root: string, id: string): boolean;
  /** Folds ticket `id`'s spec in, passing the tool's output through; its
   * exit status. */
  finish(root: string, id: string): number;
  /** Where `finish` folds a spec, ending in `/`. */
  foldsInto: string;
};
