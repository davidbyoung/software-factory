// What lunamill reads of a ticket's other repositories: whether each is
// set up, the pull requests that build the ticket in it, and whether
// whoever confirmed the list can write to it. The rules on what it reads
// are `lib/repositories.mts`'s.
import type { CodeHost } from "./code-host/types.mts";
import { load as parseYaml } from "js-yaml";
import { LOCK_FILE } from "./preset.mts";
import {
  confirmed,
  counting,
  countsSince,
  listIn,
  sameRepository,
  SectionError,
  type Confirmed,
  type LinkedPull,
  type Listed,
  type Progress,
} from "./lib/repositories.mts";
import type { Key, Ticket, Tickets } from "./tickets/types.mts";

/** The code host of a repository, however this command reaches it. */
export type Reach = (repository: string) => Promise<CodeHost>;

/** The ticket's list, where it names a repository other than its own.
 * `own` is the ticket's own repository, or this checkout's in a system
 * whose tickets live in none. A section that cannot be read says so with
 * the ticket's name. */
export function repositoriesOf(
  ticket: Pick<Ticket, "key" | "body">,
  tickets: Pick<Tickets, "ref">,
  own: string,
): Listed[] | null {
  const list = readList(ticket, tickets);
  return list && list.some((r) => !sameRepository(r.name, own)) ? list : null;
}

/** The list as the section has it. */
export function readList(
  ticket: Pick<Ticket, "key" | "body">,
  tickets: Pick<Tickets, "ref">,
): Listed[] | null {
  try {
    return listIn(ticket.body);
  } catch (error) {
    if (!(error instanceof SectionError)) throw error;
    throw new Error(
      `${tickets.ref(ticket.key)}'s Repositories section: ${error.message}`,
      { cause: error },
    );
  }
}

/** Whether a build can work in a repository. */
export type SetUp =
  | { state: "ready" }
  | { state: "missing" }
  | { state: "old"; version: string }
  | { state: "unseen" };

/** A lock of a version that can build a ticket from another repository
 * holds the setting this ticket's own came with. */
export async function setUpOf(host: CodeHost): Promise<SetUp> {
  if ((await host.visible()) === null) return { state: "unseen" };
  const text = await host.file(LOCK_FILE);
  if (text === null) return { state: "missing" };
  const lock = parseYaml(text) as {
    version?: unknown;
    settings?: { tickets?: { fields?: Record<string, unknown> } };
  } | null;
  return lock?.settings?.tickets?.fields?.repositories === undefined
    ? { state: "old", version: String(lock?.version ?? "an earlier version") }
    : { state: "ready" };
}

const DAY = 24 * 60 * 60 * 1000;

/** The time before which no pull request can have built the ticket. */
function before(ticket: Pick<Ticket, "record" | "reopened">, now: Date) {
  return (
    countsSince(ticket.record, ticket.reopened ?? false) ??
    [...ticket.record].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0]
      ?.at ??
    new Date(now.getTime() - 90 * DAY).toISOString()
  );
}

/** The pull requests of a repository that build the ticket, and count. One
 * from a fork never does. */
export async function pullsFor(
  ticket: Pick<Ticket, "key" | "record" | "reopened">,
  repository: string,
  host: CodeHost,
  tickets: Pick<Tickets, "linksIn">,
  now: Date = new Date(),
): Promise<LinkedPull[]> {
  const found = await host.recentPulls(before(ticket, now));
  const linked = found.filter(
    (p) =>
      p.head.repository !== null &&
      sameRepository(p.head.repository, repository) &&
      tickets.linksIn(p.body, repository).partOf.includes(ticket.key),
  );
  return counting(
    linked.map((p) => ({
      number: p.number,
      state: p.state === "open" ? "open" : "merged",
      createdAt: p.createdAt ?? "",
      mergedAt: p.mergedAt ?? null,
      branch: p.head.branch,
      isDraft: p.isDraft,
      body: p.body,
    })),
    countsSince(ticket.record, ticket.reopened ?? false),
  );
}

/** Each of the ticket's repositories with its pull requests. */
export const progressOf = (
  ticket: Pick<Ticket, "key" | "record" | "reopened">,
  list: Listed[],
  tickets: Pick<Tickets, "linksIn">,
  reach: Reach,
  now?: Date,
): Promise<Progress[]> =>
  Promise.all(
    list.map(async (r) => ({
      ...r,
      pulls: await pullsFor(ticket, r.name, await reach(r.name), tickets, now),
    })),
  );

/** Whether the list counts: who recorded it, and may. */
export const confirmedList = (
  ticket: Pick<Ticket, "record">,
  list: Listed[],
  reach: Reach,
): Promise<Confirmed> =>
  confirmed(list, ticket.record, async (repository, login) =>
    (await reach(repository)).canWrite(login),
  );

/** The ticket's own repository, or the checkout's in a system whose
 * tickets live in none. */
export const homeOf = (
  tickets: Pick<Tickets, "home">,
  ticket: Key,
  repository: string,
): string => tickets.home(ticket) ?? repository;

/** How far each repository is, for each ticket not finished that names
 * others than its own. A ticket whose repositories could not be read is in
 * `unread`, with why, so one of them keeps nothing else from being shown.
 * `inField` says the list is kept in a ticket field, which reading every
 * ticket at once leaves out. */
export async function acrossOf(
  all: Ticket[],
  o: {
    tickets: Pick<Tickets, "ref" | "home" | "linksIn" | "read">;
    repository: string;
    reach: Reach;
    inField: boolean;
    now?: Date;
  },
): Promise<{ across: Map<Key, Progress[]>; unread: Map<Key, string> }> {
  const across = new Map<Key, Progress[]>();
  const unread = new Map<Key, string>();
  for (const seen of all) {
    if (seen.finishedAt !== null) continue;
    try {
      const ticket = o.inField ? await o.tickets.read(seen.key) : seen;
      const home = homeOf(o.tickets, ticket.key, o.repository);
      const list = repositoriesOf(ticket, o.tickets, home);
      if (list)
        across.set(
          ticket.key,
          await progressOf(ticket, list, o.tickets, o.reach, o.now),
        );
    } catch (error) {
      unread.set(
        seen.key,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  return { across, unread };
}
