import { spawnSync } from "node:child_process";

/** The line a command that asks questions prints with no terminal to ask
 * in, or null when there is one. */
export const noTerminal = (command: string): string | null =>
  process.stdin.isTTY
    ? null
    : `factory ${command} asks its questions in a terminal: run it in one.`;

/** Whether a command is installed, by running it with `--version`. */
export const hasCommand = (name: string): boolean =>
  !spawnSync(name, ["--version"], { stdio: "ignore" }).error;
