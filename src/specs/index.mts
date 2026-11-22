// The spec tools the factory has built, by the name `specs` gives each.
import { spawnSync } from "node:child_process";
import { openspec } from "./openspec.mts";
import type { Run, SpecTool } from "./types.mts";

export type SpecTools = Record<string, SpecTool>;

export const runCommand: Run = (argv, cwd, env, quiet) =>
  spawnSync(argv[0]!, argv.slice(1), {
    cwd,
    env: { npm_config_loglevel: "warn", ...process.env, ...env },
    stdio: quiet ? "ignore" : ["ignore", "inherit", "inherit"],
  }).status ?? 1;

export function specTools(run: Run = runCommand): SpecTools {
  return { openspec: openspec(run) };
}

/** Every built tool's process files, whichever tool the settings name. */
export function processFiles(tools: SpecTools = specTools()): string[] {
  return Object.values(tools).flatMap((t) => [...t.processFiles]);
}
