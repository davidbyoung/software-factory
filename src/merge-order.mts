// The "Merge order" status: what a pull request of a ticket across
// repositories waits for, by the ticket as it is now. It is worked out with
// the verdict, which waits with it (`review-verdict.mts`).
import {
  confirmedList,
  homeOf,
  progressOf,
  repositoriesOf,
  type Reach,
} from "./across.mts";
import { sameRepository, waitsFor, type Listed } from "./lib/repositories.mts";
import type { Key, Ticket, Tickets } from "./tickets/types.mts";
import { NotFoundError } from "./tickets/types.mts";

export const ORDER = "Merge order";

/** The most a status says. */
const MOST = 140;

export type Order = { state: "success" | "pending"; description: string };

export type OrderDeps = {
  tickets: Pick<Tickets, "linksIn" | "read" | "ref" | "home">;
  /** The pull request's repository. */
  repository: string;
  reach: Reach;
  /** Whether the run has anything to reach another repository with. */
  reaches: boolean;
  log: (line: string) => void;
};

const reason = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const order = (state: Order["state"], text: string): Order => ({
  state,
  description: text.length > MOST ? `${text.slice(0, MOST - 1)}…` : text,
});

/** What the pull request waits for by one ticket it is part of, or null
 * for a ticket that names only its own repository. */
async function orderBy(key: Key, d: OrderDeps): Promise<Order | null> {
  const ref = d.tickets.ref(key);
  const home = homeOf(d.tickets, key, d.repository);
  const unreached = order(
    "success",
    `Can't read ${ref}: no token here reaches it`,
  );
  if (!sameRepository(home, d.repository) && !d.reaches) return unreached;
  let ticket: Ticket;
  let list: Listed[] | null;
  try {
    ticket = await d.tickets.read(key);
    list = repositoriesOf(ticket, d.tickets, home);
  } catch (error) {
    if (error instanceof NotFoundError) {
      d.log(`${ref} was not found.`);
      if (sameRepository(home, d.repository)) return null;
    } else d.log(reason(error));
    return order("pending", `Could not read ${ref}`);
  }
  if (!list) return null;
  if (!d.reaches) return unreached;
  try {
    if (!(await confirmedList(ticket, list, d.reach)).counts)
      return order("pending", `${ref}'s repositories are not confirmed`);
    const all = await progressOf(ticket, list, d.tickets, d.reach);
    const waits = waitsFor(all, d.repository);
    if (!waits) return order("success", "Nothing to wait for");
    return order(
      "pending",
      waits.pull === null
        ? `Waits for ${waits.name}, which has no pull request yet`
        : `Waits for ${waits.name}#${waits.pull} to merge`,
    );
  } catch (error) {
    d.log(reason(error));
    return order("pending", `Could not read ${ref}`);
  }
}

/** What a pull request with that body waits for, or null for one that is
 * part of no ticket across repositories. */
export async function orderOf(
  body: string,
  d: OrderDeps,
): Promise<Order | null> {
  let found: Order | null = null;
  for (const key of d.tickets.linksIn(body, d.repository).partOf) {
    const by = await orderBy(key, d);
    if (by && found?.state !== "pending") found = by;
  }
  return found;
}

/** The same, for the pull request, with the run's own sign-in and whatever
 * reaches the other repositories. */
export async function liveOrder(
  body: string,
  log: (line: string) => void,
  env: Record<string, string | undefined> = process.env,
): Promise<Order | null> {
  const { loadSettings } = await import("./config.mts");
  const { openTickets } = await import("./tickets/index.mts");
  const { reachCodeHost } = await import("./code-host/index.mts");
  const { reachesOthers } = await import("./code-host/across.mts");
  const settings = await loadSettings();
  const { repository } = settings;
  const { tickets } = await openTickets(settings, {
    repository,
    board: settings.tickets.board,
  });
  return orderOf(body, {
    tickets,
    repository,
    reach: (name) =>
      reachCodeHost(name, settings.codeHost.type, repository, "read"),
    reaches: reachesOthers(env),
    log,
  });
}
