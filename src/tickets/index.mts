// Which adapter the settings' `tickets.type` picks, built for a command in a
// session or CI. `github` is the only one; the settings refuse any other
// value before this runs (`config.mts`).
import { gh, type Gh } from "../lib/gh.mts";
import { fieldNamesOf, type Settings } from "../config.mts";
import { githubTickets } from "./github.mts";
import { ghTransport } from "./transport.mts";
import type { Tickets } from "./types.mts";
import { BUILT, unsupported } from "../tool-names.mts";

export * from "./types.mts";

/** The ticket system's message for a type that is not built. */
export const unsupportedType = (type: string) =>
  unsupported(
    "tickets.type",
    type,
    "ticket system",
    Object.keys(BUILT.tickets),
  );

export type Opened = { tickets: Tickets };

/** The settings' adapter, reaching its system through the GitHub CLI. The
 * repository and board are the caller's, since a workflow can name its own. */
export async function openTickets(
  settings: Settings,
  target: { repository: string; board: number | null },
  run: Gh = gh,
): Promise<Opened> {
  const type: string = settings.tickets.type;
  if (type !== "github") throw new Error(unsupportedType(type));
  const transport = ghTransport(run);
  return {
    tickets: githubTickets({
      transport,
      repository: target.repository,
      board: target.board,
      cli: run,
      fieldNames: fieldNamesOf(settings),
    }),
  };
}
