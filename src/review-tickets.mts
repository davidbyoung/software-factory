// Prints the tickets a pull request builds, for its review: each one it
// closes, then each it builds part of, as a `## ` heading with the ticket's
// written form and title, then its body.
//
//   npx --no-install factory review tickets N
//
// The review workflow runs it from the base commit's install and hands the
// reviewer its output, so a pull request cannot change what its own review
// is told the tickets say.
import { reachOf } from "./config.mts";
import { prDeps, pullTickets } from "./pr.mts";
import {
  NotFoundError,
  type Key,
  type Links,
  type Tickets,
} from "./tickets/types.mts";

export type Deps = {
  /** The tickets pull request N builds, as `factory pr closes` reads them. */
  pull: (pr: number) => Promise<{ tickets: Tickets; links: Links }>;
  out: (line: string) => void;
};

const USAGE = "Usage: factory review tickets N";

export async function main(argv: string[], d: Deps): Promise<number> {
  const pr = Number(argv[0]);
  if (argv.length !== 1 || !Number.isInteger(pr) || pr <= 0) {
    console.error(USAGE);
    return 2;
  }
  try {
    const { tickets, links } = await d.pull(pr);
    const keys: Key[] = [
      ...links.closes,
      ...links.partOf.filter((k) => !links.closes.includes(k)),
    ];
    for (const [i, key] of keys.entries()) {
      if (i > 0) d.out("");
      const ref = tickets.ref(key);
      try {
        const ticket = await tickets.read(key);
        d.out(`## ${ref} ${ticket.title}`);
        d.out("");
        d.out(ticket.body.trimEnd());
      } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;
        d.out(`## ${ref}`);
        d.out("");
        d.out("Not found.");
      }
    }
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

/** `factory review tickets N`. */
export async function run(argv: string[]): Promise<number> {
  const { repository, codeHost, runner } = await reachOf(process.env);
  const deps = prDeps(repository, codeHost, runner);
  return main(argv, {
    pull: (n) => pullTickets(deps, n),
    out: (line) => console.log(line),
  });
}
