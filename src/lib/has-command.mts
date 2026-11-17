import { spawnSync } from "node:child_process";

/** Whether a command is installed, by running it with `--version`. */
export const hasCommand = (name: string): boolean =>
  !spawnSync(name, ["--version"], { stdio: "ignore" }).error;
