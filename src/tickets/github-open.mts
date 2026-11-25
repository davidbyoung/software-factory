// GitHub's ticket adapter as the registry opens it: over the GitHub CLI by
// default, or the transport a caller gives, such as the poller's `fetch`.
import { gh, type Gh } from "../lib/gh.mts";
import { githubTickets } from "./github.mts";
import { ghTransport, type Transport } from "./transport.mts";
import { acrossTransport } from "../code-host/across.mts";
import type { Tickets } from "./types.mts";

export type OpenTarget = {
  repository: string;
  board: number | null;
  /** Who owns the board; the repository's owner unless given. */
  boardOwner?: string;
};

export type OpenOptions = {
  transport?: Transport;
  /** The GitHub CLI, where no transport is given. */
  gh?: Gh;
  /** The credential's values, for a ticket system that reads one. */
  credential?: Record<string, string>;
  /** The board's own names for the fields the sync writes. */
  fieldNames?: {
    session: string | null;
    runsIn: string | null;
    cost: string | null;
  };
};

export function openGithubTickets(
  target: OpenTarget,
  opts: OpenOptions = {},
): Tickets {
  const run = opts.gh ?? gh;
  const transport = opts.transport ?? ghTransport(run);
  return githubTickets({
    transport,
    repository: target.repository,
    board: target.board,
    ...(target.boardOwner ? { boardOwner: target.boardOwner } : {}),
    ...(opts.transport ? {} : { cli: run }),
    ...(opts.fieldNames ? { fieldNames: opts.fieldNames } : {}),
    reach: async (repository) =>
      (await acrossTransport(repository, "write")) ?? transport,
  });
}
