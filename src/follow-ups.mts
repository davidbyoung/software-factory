// What a session noticed and did not fix, listed in its pull request's
// description for a person to decide about, and the tickets opened from the
// list when the pull request merges:
//
//   lunamill follow-up TITLE TEXT
//   lunamill pr follow-ups --event FILE
//
// The first adds an item, unticked, to the open pull request of the branch
// checked out. The second reads FILE, the event that a pull request closed,
// and opens a ticket for each item ticked when it merged. An item it opened
// one for says so, so a second run opens none twice. It starts no board
// sync: the one the merge starts waits for it.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { CodeHost } from "./code-host/types.mts";
import { refuseBareTags } from "./guard-ticket-text.mts";
import { withoutMarkers } from "./handoff/requests.mts";
import { sameRepository } from "./lib/repositories.mts";
import { ticketsOf } from "./lib/pull-tickets.mts";
import * as say from "./lib/output.mts";
import { recordedTicket } from "./session-publish.mts";
import type { Key, Tickets } from "./tickets/types.mts";

export const START = "<!-- factory: follow-ups -->";
export const END = "<!-- /factory: follow-ups -->";

/** The most a pull request lists. */
export const MOST = 3;

const HEAD = `### Noticed, not fixed

Tick a box, and merging opens a ticket for it. To have one fixed here instead, say so in a review, such as "fix 1".`;

export type Item = {
  n: number;
  ticked: boolean;
  title: string;
  text: string;
  /** The ticket it opened, as its system writes it. */
  opened: string | null;
};
/** An item, or the number of a line that no longer reads as one, with where
 * its last line is. */
type Found = { n: number; item: Item | null; last: number };

const LIST = /^\s*(\d+)[.)]\s/;
const ITEM =
  /^\s*\d+[.)] \[([ xX])\] \*\*((?:(?!\*\*).)+)\*\*\s+(.*?)(?: Opened (\S+)\.)?$/;

/** The description's lines, each with the line break it ends in. */
const linesOf = (body: string) => body.split(/(?<=\n)/);

/** The lines the list is in, from the first after its start to the one that
 * ends it, or null when the description has none. */
function region(lines: string[]): { from: number; to: number } | null {
  const at = lines.findIndex((l) => l.trim() === START);
  if (at === -1) return null;
  const end = lines.findIndex((l, i) => i > at && l.trim() === END);
  return { from: at + 1, to: end === -1 ? lines.length : end };
}

function found(lines: string[]): Found[] {
  const where = region(lines);
  if (!where) return [];
  const all: Found[] = [];
  for (let i = where.from; i < where.to; i++) {
    const n = LIST.exec(lines[i]!)?.[1];
    if (n === undefined) continue;
    // A person may have wrapped it.
    let last = i;
    while (
      last + 1 < where.to &&
      lines[last + 1]!.trim() !== "" &&
      !LIST.test(lines[last + 1]!)
    )
      last++;
    const whole = lines
      .slice(i, last + 1)
      .map((l) => l.trim())
      .join(" ");
    const m = whole.split("**").length % 2 ? ITEM.exec(whole) : null;
    all.push({
      n: Number(n),
      last,
      item: m && {
        n: Number(n),
        ticked: m[1] !== " ",
        title: m[2]!.trim(),
        text: m[3]!.trim(),
        opened: m[4] ?? null,
      },
    });
    i = last;
  }
  return all;
}

/** Whether the description has a list. */
export const hasList = (body: string) => region(linesOf(body)) !== null;

/** The list's items in order, and the number of each line that no longer
 * reads as one. */
export const parse = (body: string): { n: number; item: Item | null }[] =>
  found(linesOf(body)).map(({ n, item }) => ({ n, item }));

const same = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** The words on one line, without what would end the title or pass for one
 * of Lunamill's markers. */
const oneLine = (words: string) =>
  withoutMarkers(words.replaceAll("**", "")).replace(/\s+/g, " ").trim();

export type Added =
  { body: string; n: number } | { already: number } | { full: true };

/** The description with the follow-up at the end of its list, or why it is
 * not added. */
export function add(body: string, title: string, text: string): Added {
  const lines = linesOf(body);
  const all = found(lines);
  const listed = all.find((f) => f.item && same(f.item.title, title));
  if (listed) return { already: listed.n };
  if (all.length >= MOST) return { full: true };
  const n = Math.max(0, ...all.map((f) => f.n)) + 1;
  const line = `${n}. [ ] **${title}** ${text}`;
  const where = region(lines);
  if (!where)
    return {
      n,
      body: `${[body.trimEnd(), START, HEAD, line, END].filter(Boolean).join("\n\n")}\n`,
    };
  const at = all.length ? all.at(-1)!.last : where.to - 1;
  const before = lines.slice(0, at + 1).join("");
  const gap = all.length ? "" : "\n";
  const broken = before.endsWith("\n") ? before : `${before}\n`;
  return {
    n,
    body: `${broken}${gap}${line}\n${lines.slice(at + 1).join("")}`,
  };
}

/** The description with the item saying which ticket it opened: the one of
 * that title, since a person may have moved it. Null when it has none. */
export function opened(
  body: string,
  title: string,
  ref: string,
): string | null {
  const lines = linesOf(body);
  const at = found(lines).find((f) => f.item && same(f.item.title, title));
  if (!at) return null;
  lines[at.last] = lines[at.last]!.replace(
    /\s*$/,
    (end) => ` Opened ${ref}.${end.replace(/^[ \t]+/, "")}`,
  );
  return lines.join("");
}

/** What a ticket it opens is called. */
export const titleOf = (item: Item) =>
  item.title.replaceAll("`", "").replace(/\.$/, "").trim();

type Adapters = {
  codeHost: Pick<CodeHost, "get" | "setBody" | "closesIn">;
  tickets: Pick<Tickets, "linksIn" | "ref">;
  out: say.Out;
};

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Lists a follow-up in the pull request, and returns the exit code. */
export async function list(
  pull: number,
  given: { title: string; text: string },
  d: Adapters,
): Promise<number> {
  const [title, text] = [oneLine(given.title), oneLine(given.text)];
  const { closes, partOf } = d.tickets.linksIn(`${title}\n${text}`);
  const linked = [
    ...d.codeHost.closesIn(`${title}\n${text}`),
    ...[...closes, ...partOf].map((key) => d.tickets.ref(key)),
  ];
  if (linked.length > 0) {
    d.out(
      say.mark(
        "fail",
        `A follow-up can't link a ticket, and this one links ${linked[0]}.`,
      ),
    );
    return 1;
  }
  refuseBareTags(title);
  refuseBareTags(text);
  const { body } = await d.codeHost.get(pull);
  const answer = add(body, title, text);
  if ("already" in answer) {
    d.out(say.mark("off", `Already listed in #${pull}, as ${answer.already}.`));
    return 0;
  }
  if ("full" in answer) {
    d.out(
      say.mark(
        "fail",
        `#${pull} already lists three. List only what someone would run into.`,
      ),
    );
    return 1;
  }
  await d.codeHost.setBody(pull, answer.body);
  d.out(say.mark("ok", `Listed in #${pull}, as ${answer.n}.`));
  return 0;
}

export type Event = {
  pull_request: {
    number: number;
    merged: boolean;
    body: string | null;
    head: { repo: { full_name: string } | null };
  };
};

export type OpenDeps = {
  codeHost: Pick<CodeHost, "get" | "setBody" | "closes">;
  tickets: Tickets;
  /** Whether the code host's own links say which tickets it closes. */
  own: boolean;
  repository: string;
  /** The name of the lunamill label. */
  label: string;
  out: say.Out;
};

/** Where a ticket says it was noticed. */
async function noticed(event: Event, d: OpenDeps): Promise<string> {
  const { number, body } = event.pull_request;
  const links = ticketsOf(
    { body: body ?? "", closes: d.own ? await d.codeHost.closes(number) : [] },
    d.tickets,
    d.own,
  );
  const key =
    recordedTicket(body ?? "") ?? links.closes[0] ?? links.partOf[0] ?? null;
  return key === null
    ? `Noticed in pull request #${number}.`
    : `Noticed while building ${d.tickets.ref(key)}, in pull request #${number}.`;
}

/** The open ticket an earlier run opened for the item and could not write
 * down, or null. */
async function unrecorded(
  item: Item,
  from: string,
  d: OpenDeps,
): Promise<Key | null> {
  for (const t of await d.tickets.listUnfinished())
    if (
      same(t.title, titleOf(item)) &&
      (await d.tickets.read(t.key)).body.includes(from)
    )
      return t.key;
  return null;
}

/** Opens the item's ticket and says so in the list. */
async function openOne(
  item: Item,
  from: string,
  pull: number,
  d: OpenDeps,
): Promise<void> {
  const now = async () => (await d.codeHost.get(pull)).body;
  const live = parse(await now()).find(
    (f) => f.item && same(f.item.title, item.title),
  )?.item;
  if (live?.opened) {
    d.out(say.mark("off", `${item.n} opened ${live.opened} already.`));
    return;
  }
  const earlier = await unrecorded(item, from, d);
  let key = earlier;
  if (key === null) {
    await d.tickets.ensureLabel(d.label);
    key = await d.tickets.open({
      title: titleOf(item),
      body: `${item.text}\n\n${from}\n`,
      labels: [d.label],
    });
  }
  const ref = d.tickets.ref(key);
  const body = opened(await now(), item.title, ref);
  if (body !== null) await d.codeHost.setBody(pull, body);
  d.out(
    earlier === null
      ? say.mark("ok", `Opened ${ref} for ${item.n}, "${titleOf(item)}".`)
      : say.mark("off", `${item.n} opened ${ref} already.`),
  );
}

/** `lunamill pr follow-ups`: the exit code. */
export async function openTicked(event: Event, d: OpenDeps): Promise<number> {
  const { number, merged, body, head } = event.pull_request;
  if (
    !merged ||
    !head.repo ||
    !sameRepository(head.repo.full_name, d.repository)
  )
    return 0;
  const all = parse(body ?? "");
  const from = await noticed(event, d);
  let code = 0;
  for (const { n, item } of all) {
    if (!item) {
      d.out(
        say.mark("look", `${n} can't be read, so nothing was opened for it.`),
      );
      continue;
    }
    if (!item.ticked) {
      d.out(
        say.mark("off", `${n} is not ticked, so nothing was opened for it.`),
      );
      continue;
    }
    try {
      await openOne(item, from, number, d);
    } catch (error) {
      code = 1;
      d.out(
        say.mark(
          "fail",
          `Could not open a ticket for ${n}: ${message(error).replace(/\.$/, "")}. Run this job again.`,
        ),
      );
    }
  }
  return code;
}

/** `lunamill follow-up TITLE TEXT`. */
export async function run(argv: string[]): Promise<number> {
  const { out, err } = say.printersFor("follow-up");
  const [title, text] = argv;
  if (!title?.trim() || !text?.trim() || argv.length > 2) {
    err(say.text('Usage: lunamill follow-up "TITLE" "WHAT IS WRONG"'));
    return 2;
  }
  try {
    const { codeHost, tickets } = await adapters();
    const branch = execFileSync("git", ["branch", "--show-current"], {
      encoding: "utf8",
    }).trim();
    return await listOn(branch, { title, text }, { codeHost, tickets, out });
  } catch (error) {
    err(say.text(message(error)));
    return 1;
  }
}

/** Lists a follow-up in the branch's open pull request. */
export async function listOn(
  branch: string,
  given: { title: string; text: string },
  d: Adapters & { codeHost: Pick<CodeHost, "forBranch"> },
): Promise<number> {
  const pull = branch === "" ? null : await d.codeHost.forBranch(branch);
  if (pull !== null) return list(pull, given, d);
  d.out(
    say.mark(
      "fail",
      `Branch ${branch || "HEAD"} has no open pull request to list it in. Open one first: lunamill pr open`,
    ),
  );
  return 1;
}

async function adapters() {
  const { loadSettings } = await import("./config.mts");
  const { openTickets } = await import("./tickets/index.mts");
  const { openCodeHost } = await import("./code-host/index.mts");
  const settings = await loadSettings();
  const { repository } = settings;
  const { tickets } = await openTickets(settings, {
    repository,
    board: settings.tickets.board,
  });
  const codeHost = openCodeHost(repository, settings.codeHost.type);
  return { settings, repository, tickets, codeHost };
}

/** `lunamill pr follow-ups --event FILE`. */
export async function runOpen(argv: string[]): Promise<number> {
  const { out, err } = say.printersFor("pr follow-ups");
  if (argv[0] !== "--event" || !argv[1]) {
    err(say.text("Usage: lunamill pr follow-ups --event FILE"));
    return 2;
  }
  try {
    const { ownLinks } = await import("./lib/pull-tickets.mts");
    const { settings, ...d } = await adapters();
    return await openTicked(
      JSON.parse(readFileSync(argv[1], "utf8")) as Event,
      {
        ...d,
        own: ownLinks(settings),
        label: settings.tickets.labels.lunamill,
        out,
      },
    );
  } catch (error) {
    err(say.text(message(error)));
    return 1;
  }
}
