// Which runner a name picks, built for a command in a session or CI.
// `github-actions` is the only one, and the settings refuse any other value
// of `builds.runner` before this runs (`config.mts`). A command that has not
// read the settings asks for the default.
import { gh, ghIn, type Gh, type GhIn } from "../lib/gh.mts";
import { ghTransport } from "../tickets/transport.mts";
import { githubActionsRunner } from "./github-actions.mts";
import type { Runner } from "./types.mts";
import { BUILT, unsupported } from "../tool-names.mts";

export * from "./types.mts";

export const DEFAULT_RUNNER = "github-actions" as const;

/** The message for a runner that is not built. */
export const unsupportedRunner = (
  name: string,
  built: readonly string[] = BUILT.runner,
) => unsupported("builds.runner", name, "runner", built);

/** The runner of that name for the repository, reached through the GitHub
 * CLI. */
export function openRunner(
  repository: string,
  name: string = DEFAULT_RUNNER,
  run: Gh = gh,
  runIn: GhIn = ghIn,
): Runner {
  if (name !== "github-actions") throw new Error(unsupportedRunner(name));
  return githubActionsRunner({
    transport: ghTransport(run),
    repository,
    cli: runIn,
  });
}
