// `factory ticket repositories`, and what the other ticket commands ask of
// a ticket that names more than its own repository.
//
//   factory ticket repositories N
//   factory ticket repositories N --set REPO... [--after LATER=EARLIER]...
//   factory ticket repositories N --add REPO... [--after LATER=EARLIER]...
import {
  confirmedList,
  homeOf,
  progressOf,
  readList,
  repositoriesOf,
  setUpOf,
  type Reach,
  type SetUp,
} from "./across.mts";
import {
  circleFault,
  nextToBuild,
  ownerOf,
  sameList,
  sameRepository,
  unconfirmed,
  withList,
  type Listed,
  type Progress,
} from "./lib/repositories.mts";
import { entryFor, workState, type Columns } from "./lib/work-status.mts";
import type { Key, Ticket, Tickets } from "./tickets/types.mts";

export type RepositoriesDeps = {
  tickets: Tickets;
  /** The repository of the checkout the command runs in. */
  repository: string;
  reach: Reach;
  columns: Columns;
  /** The name of the follow-ups ticket's label. */
  followUp: string;
  out: (line: string) => void;
  /** Who the code host's CLI is signed in as. */
  signedInAs: () => Promise<string>;
  /** Has a pull request's "Merge order" worked out again, in its own
   * repository. */
  startOrder: (repository: string, pull: number) => Promise<void>;
};

const USAGE =
  "Usage: factory ticket repositories N [--set REPO...|--add REPO...] [--after LATER=EARLIER]...";

type Asked = { set: string[] | null; add: string[]; after: [string, string][] };

/** The flags, each value up to the next flag. */
function asked(args: string[]): Asked {
  const found: Asked = { set: null, add: [], after: [] };
  let flag = "";
  for (const word of args) {
    if (word.startsWith("--")) {
      if (!["--set", "--add", "--after"].includes(word)) throw new Error(USAGE);
      flag = word;
      if (flag === "--set") found.set ??= [];
      continue;
    }
    if (flag === "--set") found.set!.push(word);
    else if (flag === "--add") found.add.push(word);
    else if (flag === "--after") {
      const [later, earlier, ...more] = word.split("=");
      if (!later || !earlier || more.length) throw new Error(USAGE);
      found.after.push([later, earlier]);
    } else throw new Error(USAGE);
  }
  const both = found.set !== null && found.add.length > 0;
  const none = found.set === null && found.add.length === 0;
  if (both || (none && args.length > 0) || found.set?.length === 0)
    throw new Error(USAGE);
  for (const name of [...(found.set ?? []), ...found.add])
    if (!/^[\w.-]+(?:\/[\w.-]+)+$/.test(name))
      throw new Error(`${name} is not a repository: write it as owner/name`);
  return found;
}

/** What a repository's line says after its name. */
function said(setUp: SetUp, name: string): string {
  switch (setUp.state) {
    case "ready":
      return "set up";
    case "missing":
      return `not set up: run factory init in ${name} before building`;
    case "old":
      return `on factory ${setUp.version}, which can't build a ticket from another repository: run factory update in ${name}`;
    case "unseen":
      return "not found, or you can't see it";
  }
}

type Row = { name: string; ok: boolean; text: string };

/** The rows, their names padded to one width. */
function printed(ref: string, rows: Row[]): string[] {
  const width = Math.max(...rows.map((r) => r.name.length));
  return [
    `${ref} repositories`,
    ...rows.map(
      (r) => `  ${r.ok ? "✓" : "✗"} ${r.name.padEnd(width)}   ${r.text}`,
    ),
  ];
}

const rowOf = async (name: string, reach: Reach): Promise<Row> => {
  const setUp = await setUpOf(await reach(name));
  return { name, ok: setUp.state === "ready", text: said(setUp, name) };
};

/** The list `--set` or `--add` asks for, or what is wrong with it. */
function listAsked(
  a: Asked,
  had: Listed[] | null,
  home: string,
  ref: string,
): Listed[] | { fault: string } {
  const start: Listed[] = a.set
    ? []
    : (had ?? [{ name: home, after: [] }]).map((r) => ({
        name: r.name,
        after: [...r.after],
      }));
  for (const name of a.set ?? a.add)
    if (!start.some((r) => sameRepository(r.name, name)))
      start.push({ name, after: [] });
  for (const [later, earlier] of a.after) {
    const of = (name: string) =>
      start.find((r) => sameRepository(r.name, name));
    const missing = [later, earlier].find((name) => !of(name));
    if (missing)
      return {
        fault: `--after names ${missing}, which is not one of ${ref}'s repositories`,
      };
    const { after } = of(later)!;
    const name = of(earlier)!.name;
    if (!after.includes(name)) after.push(name);
  }
  const fault = circleFault(start);
  return fault ? { fault } : start;
}

/** Whether the ticket is being built and a repository of it has no pull
 * request yet. */
async function beingBuilt(
  ticket: Ticket,
  had: Listed[] | null,
  home: string,
  d: RepositoriesDeps,
): Promise<boolean> {
  const { live, start } = workState(ticket.record);
  if (!live && !start) return false;
  if (had)
    return (
      nextToBuild(await progressOf(ticket, had, d.tickets, d.reach)) !== null
    );
  const open = await (await d.reach(home)).listOpen();
  return !open.some((p) =>
    d.tickets.linksIn(p.body, home).closes.includes(ticket.key),
  );
}

/** Rewrites the line of an open pull request that closes the ticket, which
 * now closes itself. */
async function rewriteLinks(
  ticket: Ticket,
  home: string,
  d: RepositoriesDeps,
): Promise<void> {
  const host = await d.reach(home);
  const key = d.tickets.keyIn(ticket.key, home);
  const closes = d.tickets.linkText(key, "closes");
  for (const pull of await host.listOpen()) {
    if (!d.tickets.linksIn(pull.body, home).closes.includes(ticket.key))
      continue;
    const line = new RegExp(
      `${closes.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\d)`,
      "gi",
    );
    await host.setBody(
      pull.number,
      pull.body.replace(line, d.tickets.linkText(key, "part")),
    );
  }
}

const openPulls = (all: Progress[]) =>
  all.flatMap((r) =>
    r.pulls
      .filter((p) => p.state === "open")
      .map((p) => ({ repository: r.name, number: p.number })),
  );

async function record(
  ticket: Ticket,
  a: Asked,
  d: RepositoriesDeps,
): Promise<number> {
  const ref = d.tickets.ref(ticket.key);
  const home = homeOf(d.tickets, ticket.key, d.repository);
  const refuse = (why: string) => {
    d.out(`✗ ${why}`);
    return 1;
  };
  if (ticket.labels.includes(d.followUp))
    return refuse("The follow-ups ticket is one repository's");
  const had = readList(ticket, d.tickets);
  const list = listAsked(a, had, home, ref);
  if ("fault" in list) return refuse(list.fault);
  if (await beingBuilt(ticket, had, home, d))
    return refuse(
      `${ref} is being built: wait for it, or stop that build first`,
    );

  const me = await d.signedInAs();
  let refused = false;
  const rows: Row[] = [];
  for (const { name } of list) {
    const deny = (text: string) => {
      refused = true;
      rows.push({ name, ok: false, text });
    };
    if (ownerOf(name).toLowerCase() !== ownerOf(home).toLowerCase()) {
      deny(
        `another owner than ${home}: a ticket's repositories have one owner`,
      );
      continue;
    }
    const host = await d.reach(name);
    const row = await rowOf(name, d.reach);
    if ((await host.visible()) === null) deny(row.text);
    else if (!(await host.canWrite(me)))
      deny("you can't write to it, so you can't put it on the list");
    else rows.push(row);
  }
  if (refused) {
    printed(ref, rows).forEach(d.out);
    return 1;
  }

  const alone = list.every((r) => sameRepository(r.name, home));
  if (had && sameList(had, list) && (await counts(ticket, list, d))) {
    printed(ref, rows).forEach(d.out);
    return 0;
  }
  const before = had ? await progressOf(ticket, had, d.tickets, d.reach) : [];
  await d.tickets.writeBody(
    ticket.key,
    withList(ticket.body, alone ? null : list),
  );
  await d.tickets.record.add(
    ticket.key,
    entryFor({ kind: "repositories", list }, d.columns),
  );
  if (alone) {
    d.out(`${ref} builds in ${home}.`);
  } else {
    await rewriteLinks(ticket, home, d);
    printed(ref, rows).forEach(d.out);
    const order = list.flatMap((r) =>
      r.after.map((name) => ` ${r.name} merges after ${name}.`),
    );
    d.out(`Recorded on ${ref}.${order.join("")}`);
  }

  const all = alone ? [] : await progressOf(ticket, list, d.tickets, d.reach);
  const isNew = (name: string) =>
    !(had ?? [{ name: home, after: [] }]).some((r) =>
      sameRepository(r.name, name),
    );
  const added = list.map((r) => r.name).filter(isNew);
  if (added.length && all.some((r) => r.pulls.length > 0))
    await d.tickets.record.add(
      ticket.key,
      entryFor({ kind: "repository-added", added }, d.columns),
    );
  for (const p of openPulls(before))
    if (!list.some((r) => sameRepository(r.name, p.repository)))
      d.out(
        `? ${p.repository}#${p.number} is still open: close it, or merge it knowing that ${ref} does not wait for it`,
      );
  for (const p of openPulls(all))
    try {
      await d.startOrder(p.repository, p.number);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      d.out(
        `? couldn't have ${p.repository}#${p.number}'s "Merge order" worked out again: push to it, or mark it ready, to do it (${reason})`,
      );
    }
  return 0;
}

const counts = async (ticket: Ticket, list: Listed[], d: { reach: Reach }) =>
  (await confirmedList(ticket, list, d.reach)).counts;

/** `factory ticket repositories`. */
export async function repositories(
  key: Key,
  args: string[],
  d: RepositoriesDeps,
): Promise<number> {
  const a = asked(args);
  const ticket = await d.tickets.read(key);
  if (a.set !== null || a.add.length) return record(ticket, a, d);
  const ref = d.tickets.ref(key);
  const home = homeOf(d.tickets, key, d.repository);
  const list = repositoriesOf(ticket, d.tickets, home);
  if (!list) {
    d.out(`${ref} builds in ${home}.`);
    return 0;
  }
  const rows = await Promise.all(list.map((r) => rowOf(r.name, d.reach)));
  printed(ref, rows).forEach(d.out);
  const answer = await confirmedList(ticket, list, d.reach);
  if (!answer.counts) d.out(`✗ ${unconfirmed(ref, key, list, answer)}`);
  return answer.counts && rows.every((r) => r.ok) ? 0 : 1;
}

/** Why a build of the ticket can't start here, or null. The checks need no
 * claim. */
export async function notBuildable(
  ticket: Ticket,
  d: { tickets: Tickets; repository: string; reach: Reach },
): Promise<string | null> {
  const ref = d.tickets.ref(ticket.key);
  const home = homeOf(d.tickets, ticket.key, d.repository);
  const list = repositoriesOf(ticket, d.tickets, home);
  const names = list?.map((r) => r.name) ?? [home];
  if (!names.some((name) => sameRepository(name, d.repository)))
    return `This checkout, ${d.repository}, is not one of ${ref}'s repositories: ${names.join(", ")}`;
  if (!list) return null;
  const answer = await confirmedList(ticket, list, d.reach);
  if (!answer.counts) return unconfirmed(ref, ticket.key, list, answer);
  for (const { name } of list) {
    const setUp = await setUpOf(await d.reach(name));
    if (setUp.state === "missing")
      return `${ref} names ${name}, which is not set up: run factory init in ${name}`;
    if (setUp.state === "old")
      return `${ref} names ${name}, whose factory is too old: run factory update in ${name}`;
    if (setUp.state === "unseen")
      return `${ref} names ${name}, which was not found, or you can't see it`;
  }
  return null;
}

/** The lines a pull request in this checkout's repository starts with, for
 * a ticket that names others, or null for any other ticket. */
export async function linkLines(
  ticket: Ticket,
  d: { tickets: Tickets; repository: string; reach: Reach },
): Promise<string[] | null> {
  const home = homeOf(d.tickets, ticket.key, d.repository);
  const list = repositoriesOf(ticket, d.tickets, home);
  if (!list) return null;
  const all = await progressOf(ticket, list, d.tickets, d.reach);
  const own = all.find((r) => sameRepository(r.name, d.repository));
  const pull = (name: string) =>
    all
      .find((r) => sameRepository(r.name, name))
      ?.pulls.toSorted((x, y) => y.number - x.number)[0];
  return [
    d.tickets.linkText(ticket.key, "part"),
    ...(own?.after ?? []).flatMap((name) => {
      const found = pull(name);
      return found ? [`Depends-On: ${name}#${found.number}`] : [];
    }),
  ];
}

/** Whether a pull request of this checkout's repository builds the ticket,
 * for one that names others; null for any other ticket. */
export async function builtHere(
  ticket: Ticket,
  d: { tickets: Tickets; repository: string; reach: Reach },
): Promise<boolean | null> {
  const home = homeOf(d.tickets, ticket.key, d.repository);
  const list = repositoriesOf(ticket, d.tickets, home);
  if (!list) return null;
  const all = await progressOf(
    ticket,
    list.filter((r) => sameRepository(r.name, d.repository)),
    d.tickets,
    d.reach,
  );
  return all.some((r) => r.pulls.length > 0);
}
