// What a pull request of a ticket across repositories tells the others,
// from a run in its own repository:
//
//   kodor across --event FILE
//
// FILE is the event that a pull request was opened, reopened, or closed. One
// closed without merging is noted on its ticket. The last to merge finishes
// the ticket. Each other repository's open pull request has its "Merge
// order" worked out again, by a run there, and the ticket's own repository
// syncs its board. A read that fails fails the run: the nightly sync makes
// up for a ticket left open.
import { readFileSync } from "node:fs";
import {
  confirmedList,
  homeOf,
  progressOf,
  repositoriesOf,
  type Reach,
} from "./across.mts";
import {
  allMerged,
  sameRepository,
  unconfirmed,
  type Progress,
} from "./lib/repositories.mts";
import { entryFor, type Columns } from "./lib/work-status.mts";
import type { Runner } from "./runner/index.mts";
import * as say from "./lib/output.mts";
import { NotFoundError, type Key, type Tickets } from "./tickets/types.mts";

export type Event = {
  action: string;
  pull_request: {
    number: number;
    merged: boolean;
    merged_at: string | null;
    created_at: string;
    draft?: boolean;
    body: string | null;
    head: { ref: string; repo: { full_name: string } | null };
  };
};

export type Deps = {
  tickets: Tickets;
  repository: string;
  columns: Columns;
  reach: Reach;
  /** The runner of any of the ticket's repositories. */
  runner: (
    repository: string,
  ) => Promise<Pick<Runner, "startOn" | "startSync">>;
  now: () => Date;
  out: say.Out;
};

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The repositories with the event's own pull request as the event says it
 * is, which a list read a moment later can still lack. */
function withEvent(all: Progress[], event: Event, repository: string) {
  const { number, merged, merged_at, created_at, head } = event.pull_request;
  if (!merged) return all;
  return all.map((r) =>
    sameRepository(r.name, repository)
      ? {
          ...r,
          pulls: [
            ...r.pulls.filter((p) => p.number !== number),
            {
              number,
              state: "merged" as const,
              createdAt: created_at,
              mergedAt: merged_at,
              branch: head.ref,
              isDraft: false,
              body: event.pull_request.body ?? "",
            },
          ],
        }
      : r,
  );
}

/** Finishes a ticket whose every repository has merged, unless another run
 * has. */
export async function finishIfMerged(
  key: Key,
  all: Progress[],
  d: Pick<Deps, "tickets" | "columns" | "out">,
): Promise<boolean> {
  if (!allMerged(all)) return false;
  const now = await d.tickets.read(key);
  if (now.finishedAt !== null) return false;
  const pulls = all.map((r) => ({
    repository: r.name,
    number: r.pulls.at(-1)!.number,
  }));
  await d.tickets.record.add(
    key,
    entryFor({ kind: "all-merged", pulls }, d.columns),
  );
  await d.tickets.finish(key);
  d.out(say.text(`Every repository of ${d.tickets.ref(key)} merged.`));
  return true;
}

async function tell(key: Key, event: Event, d: Deps): Promise<void> {
  const ref = d.tickets.ref(key);
  const ticket = await d.tickets.read(key).catch((error: unknown) => {
    if (error instanceof NotFoundError) return null;
    throw error;
  });
  if (!ticket) return d.out(say.text(`${ref} was not found.`));
  const home = homeOf(d.tickets, key, d.repository);
  const list = repositoriesOf(ticket, d.tickets, home);
  if (!list?.some((r) => sameRepository(r.name, d.repository)))
    return d.out(say.text(`${ref} does not name ${d.repository}.`));
  const answer = await confirmedList(ticket, list, d.reach);
  if (!answer.counts)
    return d.out(say.text(unconfirmed(ref, key, list, answer)));

  const { number, merged } = event.pull_request;
  if (event.action === "closed" && !merged && ticket.finishedAt === null)
    await d.tickets.record.add(
      key,
      entryFor(
        {
          kind: "pull-closed",
          issue: { key, ref },
          pull: number,
          repository: d.repository,
        },
        d.columns,
      ),
    );
  const all = withEvent(
    await progressOf(ticket, list, d.tickets, d.reach, d.now()),
    event,
    d.repository,
  );
  if (merged) await finishIfMerged(key, all, d);

  for (const r of all) {
    if (sameRepository(r.name, d.repository)) continue;
    for (const p of r.pulls.filter((x) => x.state === "open"))
      try {
        const branch = await (await d.reach(r.name)).defaultBranch();
        await (await d.runner(r.name)).startOn("order", p.number, branch);
        d.out(say.text(`Told ${r.name}#${p.number}.`));
      } catch (error) {
        d.out(
          say.text(`Could not tell ${r.name}#${p.number}: ${message(error)}`),
        );
      }
  }
  try {
    const branch = await (await d.reach(home)).defaultBranch();
    await (await d.runner(home)).startSync(branch);
  } catch (error) {
    d.out(say.text(`Could not start ${home}'s board sync: ${message(error)}`));
  }
}

export async function main(event: Event, d: Deps): Promise<number> {
  const { body, head } = event.pull_request;
  if (!head.repo || !sameRepository(head.repo.full_name, d.repository)) {
    d.out(say.text("It comes from another repository."));
    return 0;
  }
  let code = 0;
  for (const key of d.tickets.linksIn(body ?? "", d.repository).partOf)
    try {
      await tell(key, event, d);
    } catch (error) {
      d.out(say.text(`${d.tickets.ref(key)}: ${message(error)}`));
      code = 1;
    }
  return code;
}

/** `kodor across --event FILE`. */
export async function run(argv: string[]): Promise<number> {
  const { out, err } = say.printersFor("across");
  if (argv[0] !== "--event" || !argv[1]) {
    err(say.text("Usage: kodor across --event FILE"));
    return 2;
  }
  try {
    const { columnsOf, loadSettings } = await import("./config.mts");
    const { openTickets } = await import("./tickets/index.mts");
    const { reachCodeHost } = await import("./code-host/index.mts");
    const { reachesOthers } = await import("./code-host/across.mts");
    const { reachRunner } = await import("./runner/index.mts");
    if (!reachesOthers(process.env)) {
      out(say.text("No token here reaches another repository."));
      return 0;
    }
    const settings = await loadSettings();
    const { repository } = settings;
    const { tickets } = await openTickets(settings, {
      repository,
      board: settings.tickets.board,
    });
    return await main(JSON.parse(readFileSync(argv[1], "utf8")) as Event, {
      tickets,
      repository,
      columns: columnsOf(settings),
      reach: (name) => reachCodeHost(name, settings.codeHost.type, repository),
      runner: (name) => reachRunner(name, settings.builds.runner),
      now: () => new Date(),
      out,
    });
  } catch (error) {
    err(say.text(message(error)));
    return 1;
  }
}
