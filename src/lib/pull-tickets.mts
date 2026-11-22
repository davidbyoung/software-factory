// Which tickets a pull request builds. The ticket adapter reads the link
// lines in its body; the code host's own links count only when the tickets
// are the code host's own, as GitHub issues are GitHub pull requests'.
import type { Settings } from "../config.mts";
import type { Links, Tickets } from "../tickets/types.mts";
import type { PullRequest } from "./work-status.mts";

/** Whether the code host keeps the tickets itself, so its own links, such
 * as GitHub's closing references, say which tickets a pull request closes. */
export const ownLinks = (settings: Settings): boolean =>
  settings.tickets.type === "github" && settings.codeHost.type === "github";

/** The tickets a pull request closes and builds part of. `closes` is the
 * code host's list as it read it. */
export function ticketsOf(
  pull: { body: string; closes: Links["closes"] },
  tickets: Pick<Tickets, "linksIn">,
  own: boolean,
): Links {
  const links = tickets.linksIn(pull.body);
  return { closes: own ? pull.closes : links.closes, partOf: links.partOf };
}

/** The pull requests with `closes` and `partOf` read as `ticketsOf` reads
 * them. */
export const linkPulls = <P extends PullRequest>(
  pulls: P[],
  tickets: Pick<Tickets, "linksIn">,
  own: boolean,
): P[] => pulls.map((pull) => ({ ...pull, ...ticketsOf(pull, tickets, own) }));
