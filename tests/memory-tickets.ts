// A second adapter, kept in memory, that every command's tests run against.
// It implements the same interface as the GitHub one (`src/tickets/`), so a
// command that works here works on any adapter that keeps the interface.
// Its keys are numbers, written `#12`, as GitHub's are; with `strict` they
// are keys like `PROJ-12`, written as they are, and comment IDs and authors
// are opaque text, as Jira and Linear give them.
// A test that needs `fake-gh` for a ticket is a sign the command went
// around the interface.
// Plain, it keeps the factory's record in comments, as GitHub does. Strict,
// it keeps the record apart and holds the factory to what Jira and Linear
// allow: a status in place of open or closed, moves only along `moves`, no
// hidden text in a comment, and no label used before it is created.
import { recordOf, renderEntry } from "../src/tickets/record-comments.mts";
import {
  GROUPS,
  KeyError,
  NotFoundError,
  type Key,
  type Links,
  type Blocker,
  type Board,
  type BoardField,
  type Entry,
  type TicketField,
  type BoardItem,
  type Group,
  type Ticket,
  type TicketComment,
  type Tickets,
  type Write,
} from "../src/tickets/types.mts";

/** A ticket to start with, by its key; a number is its key as text. It may
 * say it is closed, and when, as a GitHub issue does. */
export type Seed = Partial<Ticket> & {
  state?: "open" | "closed";
  closedAt?: string | null;
} & ({ key: Key } | { number: number });

const keyOfSeed = (t: Seed): Key =>
  "key" in t && t.key !== undefined
    ? t.key
    : String((t as { number: number }).number);

type Op =
  | "read"
  | "listUnfinished"
  | "record"
  | "finish"
  | "writeBody"
  | "writeTitle"
  | "comment"
  | "editComment"
  | "deleteComment"
  | "open"
  | "addLabel"
  | "removeLabel"
  | "mayDecide"
  | "board"
  | "blockers"
  | "labelHistory"
  | "attachments"
  | "fields";

/** The Status, Session, Runs in, and Cost fields the board sync checks. */
export const BOARD_FIELDS: BoardField[] = [
  {
    id: "F_status",
    name: "Status",
    dataType: "SINGLE_SELECT",
    options: [
      "Backlog",
      "In refinement",
      "Ready",
      "In progress",
      "In review",
      "Done",
    ].map((name) => ({ id: `O_${name}`, name })),
  },
  { id: "F_session", name: "Session", dataType: "TEXT" },
  {
    id: "F_runs",
    name: "Runs in",
    dataType: "SINGLE_SELECT",
    options: ["Local", "Actions"].map((name) => ({ id: `O_${name}`, name })),
  },
  { id: "F_cost", name: "Cost", dataType: "NUMBER" },
];

export type MemoryOptions = {
  /** The optional groups it has; every one unless given. */
  groups?: Group[];
  /** What each operation fails with, to test a command's failure path. */
  fail?: Partial<Record<Op, Error>>;
  /** Comments are numbered from here. */
  firstCommentId?: number;
  /** Keys like Jira's and Linear's, `PROJ-12`, and opaque comment IDs and
   * authors, in place of GitHub's numbers. */
  strict?: boolean;
  /** When a comment is posted, for its createdAt. */
  now?: () => string;
  owner?: string;
  /** The accounts whose comments may decide on a ticket, in any case; only
   * the owner unless given. */
  deciders?: string[];
  /** The board's fields, where a test needs other columns. */
  fields?: BoardField[];
  /** The boards the repository's owner has, each with its columns. */
  boards?: {
    number: number;
    title: string;
    columns: string[];
    fields?: string[];
  }[];
  /** Why creating a board fails, as when the owner's settings refuse it. */
  createRefused?: string;
  /** The fields tickets can have, set on the ticket itself. */
  ticketFields?: TicketField[];
  /** Strict only: the labels that exist before the test, which
   * `ensureLabel` adds to. */
  labels?: string[];
  /** Strict only: the statuses a card can move to from each status; a move
   * goes along them, and one with no path throws. Any move unless given. */
  moves?: Record<string, string[]>;
  /** Whether those fields show their text as typed; true unless given. */
  plainText?: boolean;
};

/** The statuses a move from `from` to `to` passes through, along the
 * allowed moves, or a thrown error when there is no path. */
function pathTo(
  from: string,
  to: string,
  moves: Record<string, string[]>,
): string[] {
  const seen = new Map<string, string[]>([[from, []]]);
  const queue = [from];
  while (queue.length) {
    const at = queue.shift()!;
    if (at === to) return seen.get(at)!;
    for (const next of moves[at] ?? [])
      if (!seen.has(next)) {
        seen.set(next, [...seen.get(at)!, next]);
        queue.push(next);
      }
  }
  throw new Error(`No move from ${from} to ${to}.`);
}

export function memoryTickets(seed: Seed[] = [], options: MemoryOptions = {}) {
  const groups = new Set(options.groups ?? GROUPS);
  const fail = options.fail ?? {};
  const strict = options.strict ?? false;
  const owner = options.owner ?? (strict ? "557058:9a1b-acme" : "acme");
  const now = options.now ?? (() => "2026-11-09T12:59:00Z");
  let nextComment = options.firstCommentId ?? 1000;
  const commentId = (n: number) =>
    strict ? `c-${n.toString(36)}z` : String(n);
  const tickets = new Map<Key, Ticket>();
  for (const t of seed) {
    const key = keyOfSeed(t);
    const {
      number: _,
      state,
      closedAt,
      ...rest
    } = t as Seed & { number?: number };
    tickets.set(key, {
      title: `Ticket ${key}`,
      finishedAt: state === "closed" ? (closedAt ?? now()) : null,
      body: "",
      ...rest,
      key,
      // Copied, so one test's writes never reach a seed another test shares.
      labels: [...(t.labels ?? [])],
      comments: (t.comments ?? []).map((c) => ({ ...c, id: String(c.id) })),
      record: (t.record ?? []).map((e) => ({ ...e, markers: [...e.markers] })),
    });
  }
  const knownLabels = new Set(options.labels ?? []);
  let nextEntry = 1;
  const board = new Map<Key, BoardItem>();
  const blockers = new Map<Key, Key[]>();
  const removedLabels = new Map<Key, string[]>();
  const attached: { ticket: Key; files: string[] }[] = [];
  const fieldValues = new Map<Key, Record<string, string>>();

  const ref = (key: Key) => (strict || key.includes("/") ? key : `#${key}`);
  const keyPattern = strict ? /^[A-Z][A-Z0-9]*-[1-9]\d*$/ : /^[1-9]\d*$/;
  const linkPattern = strict
    ? /\b(closes|part of) ([A-Z][A-Z0-9]*-[1-9]\d*)(?![\d])/gi
    : /\b(closes|part of) #(\d+)(?!\d)/gi;
  const writes: { itemId: string; writes: Write[] }[] = [];
  const boards = (options.boards ?? []).map((b) => ({
    ...b,
    columns: [...b.columns],
  }));

  const check = (op: Op) => {
    const error = fail[op];
    if (error) throw error;
  };
  const get = (n: Key) => {
    const t = tickets.get(n);
    if (!t) throw new NotFoundError(ref(n));
    return t;
  };
  const findComment = (id: string): [Ticket, number] => {
    for (const t of tickets.values()) {
      const at = t.comments.findIndex((c) => c.id === id);
      if (at !== -1) return [t, at];
    }
    throw new NotFoundError(`comment ${id}`);
  };
  // Plain, the record is the comments that carry a marker, as on GitHub.
  const recordIn = (t: Ticket): Entry[] =>
    strict ? t.record.map((e) => ({ ...e })) : recordOf(t.comments);
  const copy = (t: Ticket): Ticket => ({
    ...t,
    labels: [...t.labels],
    comments: t.comments.map((c) => ({ ...c })),
    record: recordIn(t),
  });
  const findEntry = (id: string): [Ticket, number] => {
    for (const t of tickets.values()) {
      const at = t.record.findIndex((e) => e.id === id);
      if (at !== -1) return [t, at];
    }
    throw new NotFoundError(`entry ${id}`);
  };
  const addComment = (n: Key, body: string): string => {
    if (strict && body.includes("<!--"))
      throw new Error("A comment here shows hidden text as it is typed.");
    const t = get(n);
    const id = commentId(nextComment++);
    const c: TicketComment = { id, author: owner, createdAt: now(), body };
    t.comments.push(c);
    return id;
  };

  const adapter: Tickets = {
    key(typed) {
      if (keyPattern.test(typed)) return typed;
      if (!strict && /^[\w.-]+\/[\w.-]+#\d+$/.test(typed))
        throw new KeyError(
          `${typed} is in another repository: the factory reads only its state as a blocker`,
        );
      throw new KeyError(
        strict
          ? `${typed} is not a ticket here: a key is a project and a number, such as PROJ-12`
          : `${typed} is not a ticket here: a GitHub ticket is its number, such as 12`,
      );
    },
    ref,
    async read(n) {
      check("read");
      return copy(get(n));
    },
    async readAll(opts = {}) {
      check("read");
      const label = opts.label;
      const read = [...tickets.values()]
        .filter((t) => label === undefined || t.labels.includes(label))
        .map(copy);
      if (!opts.board || !groups.has("board")) return read;
      return read.map((t) => ({ ...t, card: board.get(t.key) ?? null }));
    },
    async listUnfinished() {
      check("listUnfinished");
      return [...tickets.values()]
        .filter((t) => t.finishedAt === null)
        .map((t) => ({
          key: t.key,
          title: t.title,
          labels: [...t.labels],
        }));
    },
    async writeBody(n, body) {
      check("writeBody");
      get(n).body = body;
    },
    async writeTitle(n, title) {
      check("writeTitle");
      get(n).title = title;
    },
    async comment(n, body) {
      check("comment");
      return addComment(n, body);
    },
    async editComment(id, body) {
      check("editComment");
      const [t, at] = findComment(id);
      t.comments[at] = { ...t.comments[at], body };
    },
    async deleteComment(id) {
      check("deleteComment");
      const [t, at] = findComment(id);
      t.comments.splice(at, 1);
    },
    async open({ title, body, labels }) {
      check("open");
      const number =
        Math.max(
          0,
          ...[...tickets.keys()].map((k) => Number(/\d+$/.exec(k)?.[0] ?? 0)),
        ) + 1;
      const key = strict ? `PROJ-${number}` : String(number);
      tickets.set(key, {
        key,
        title,
        body,
        labels: [...labels],
        finishedAt: null,
        comments: [],
        record: [],
      });
      return key;
    },
    async ensureLabel(label) {
      knownLabels.add(label);
    },
    async finish(n) {
      check("finish");
      const t = get(n);
      // A system with statuses finishes a ticket by its status.
      if (!strict && t.finishedAt === null) t.finishedAt = now();
    },
    statuses: strict,
    record: {
      async add(n, entry) {
        // Plain, through the adapter's own comment, as GitHub's does.
        if (!strict) {
          if (entry.markers.some((m) => m.includes("work-status: merged")))
            return "";
          return adapter.comment(n, renderEntry(entry));
        }
        check("record");
        const t = get(n);
        const id = `e-${nextEntry++}`;
        t.record.push({
          id,
          at: now(),
          author: owner,
          text: entry.text,
          markers: [...entry.markers],
        });
        if (entry.tellsPerson) addComment(n, entry.text);
        return id;
      },
      async update(id, entry) {
        if (!strict) return adapter.editComment(id, renderEntry(entry));
        check("record");
        const [t, at] = findEntry(id);
        t.record[at] = {
          ...t.record[at],
          text: entry.text,
          markers: [...entry.markers],
        };
      },
      async remove(id) {
        if (!strict) return adapter.deleteComment(id);
        check("record");
        const [t, at] = findEntry(id);
        t.record.splice(at, 1);
      },
      async read(n) {
        if (!strict) return (await adapter.read(n)).record;
        check("record");
        return recordIn(get(n));
      },
    },
    async addLabel(n, label) {
      check("addLabel");
      if (strict && !knownLabels.has(label))
        throw new Error(`No label called ${label}: create it first.`);
      const t = get(n);
      if (!t.labels.includes(label)) t.labels.push(label);
    },
    async removeLabel(n, label) {
      check("removeLabel");
      const t = get(n);
      if (!t.labels.includes(label)) return;
      t.labels = t.labels.filter((l) => l !== label);
      removedLabels.set(n, [...(removedLabels.get(n) ?? []), label]);
    },
    async mayDecide(author) {
      check("mayDecide");
      const deciders = options.deciders ?? [owner];
      return deciders.some((d) => d.toLowerCase() === author.toLowerCase());
    },
    linkText: (n, kind) =>
      `${kind === "closes" ? "Closes" : "Part of"} ${ref(n)}`,
    linksIn(body) {
      const links: Links = { closes: [], partOf: [] };
      for (const m of body.matchAll(linkPattern)) {
        const list =
          m[1].toLowerCase() === "closes" ? links.closes : links.partOf;
        if (!list.includes(m[2])) list.push(m[2]);
      }
      return links;
    },
    address: (n) => `https://tickets.example/${n}`,
  };

  const readBoard = (): Board => ({
    projectId: "P_memory",
    fields: options.fields ?? BOARD_FIELDS,
    items: new Map([...board].map(([n, item]) => [n, { ...item }])),
  });
  if (groups.has("board"))
    adapter.board = {
      async read() {
        check("board");
        return readBoard();
      },
      async add(n) {
        check("board");
        get(n);
        const itemId = `I_${n}`;
        board.set(n, {
          itemId,
          key: n,
          status: null,
          updatedAt: null,
          session: "",
          runsIn: "",
          cost: null,
        });
        return itemId;
      },
      async set(itemId, ws) {
        check("board");
        const item = [...board.values()].find((i) => i.itemId === itemId);
        if (!item) throw new NotFoundError(`card ${itemId}`);
        if (ws.some((w) => w.field === "Status"))
          throw new Error("A card's column is set by move, not set.");
        writes.push({ itemId, writes: ws });
        for (const w of ws) {
          if ("clear" in w) {
            if (w.field === "Session") item.session = "";
            else if (w.field === "Runs in") item.runsIn = "";
            else item.cost = null;
          } else if ("text" in w) item.session = w.text;
          else if ("number" in w) item.cost = w.number;
          else item.runsIn = w.optionName;
        }
      },
      async move(itemId, column) {
        check("board");
        const item = [...board.values()].find((i) => i.itemId === itemId);
        if (!item) throw new NotFoundError(`card ${itemId}`);
        if (strict && options.moves && item.status !== null)
          pathTo(item.status, column, options.moves);
        writes.push({
          itemId,
          writes: [{ field: "Status", optionName: column }],
        });
        item.status = column;
        item.updatedAt = now();
      },
      async list() {
        check("board");
        return boards.map(({ number, title }) => ({ number, title }));
      },
      async create(title) {
        check("board");
        if (options.createRefused) throw new Error(options.createRefused);
        const number = Math.max(0, ...boards.map((b) => b.number)) + 1;
        boards.push({
          number,
          title,
          columns: ["Todo", "In Progress", "Done"],
          fields: [],
        });
        return number;
      },
      async addFields(number, fields) {
        check("board");
        const b = boards.find((x) => x.number === number);
        if (!b) throw new NotFoundError(`board ${number}`);
        const added = fields
          .map((f) => f.name)
          .filter((n) => !(b.fields ?? []).includes(n));
        b.fields = [...(b.fields ?? []), ...added];
        return added;
      },
      async columns(number) {
        check("board");
        const b = boards.find((x) => x.number === number);
        if (!b) throw new NotFoundError(`board ${number}`);
        return [...b.columns];
      },
      async addColumns(number, columns) {
        check("board");
        const b = boards.find((x) => x.number === number);
        if (!b) throw new NotFoundError(`board ${number}`);
        const has = (c: string) =>
          b.columns.some((x) => x.toLowerCase() === c.toLowerCase());
        const added = columns.filter((c) => !has(c));
        if (added.length)
          b.columns = [
            ...columns.map(
              (c) =>
                b.columns.find((x) => x.toLowerCase() === c.toLowerCase()) ?? c,
            ),
            ...b.columns.filter(
              (x) => !columns.some((c) => c.toLowerCase() === x.toLowerCase()),
            ),
          ];
        return added;
      },
    };
  if (groups.has("blockers"))
    adapter.blockers = {
      async list(n): Promise<Blocker[]> {
        check("blockers");
        get(n);
        return (blockers.get(n) ?? []).map((b) => ({
          key: b,
          state: tickets.get(b)?.finishedAt ? "closed" : "open",
        }));
      },
      async add(n, by) {
        check("blockers");
        get(n);
        get(by);
        blockers.set(n, [...new Set([...(blockers.get(n) ?? []), by])]);
      },
      async remove(n, by) {
        check("blockers");
        const list = blockers.get(n) ?? [];
        if (!list.includes(by))
          throw new NotFoundError(`${ref(n)} waiting on ${ref(by)}`);
        blockers.set(
          n,
          list.filter((b) => b !== by),
        );
      },
    };
  if (groups.has("label-history"))
    adapter.labelHistory = {
      async wasRemoved(n, label) {
        check("labelHistory");
        get(n);
        return (removedLabels.get(n) ?? []).includes(label);
      },
    };
  if (groups.has("fields"))
    adapter.fields = {
      plainText: options.plainText ?? true,
      async list() {
        check("fields");
        return (options.ticketFields ?? []).map((f) => ({ ...f }));
      },
      async holds() {
        check("fields");
        return { max: null };
      },
      async read(n) {
        check("fields");
        get(n);
        return { ...(fieldValues.get(n) ?? {}) };
      },
      async write(n, values) {
        check("fields");
        get(n);
        const known = options.ticketFields ?? [];
        const now = { ...(fieldValues.get(n) ?? {}) };
        for (const [name, value] of Object.entries(values)) {
          if (!known.some((f) => f.name === name))
            throw new Error(`No field called ${name}.`);
          if (value === null) delete now[name];
          else now[name] = value;
        }
        fieldValues.set(n, now);
      },
    };
  if (groups.has("attachments"))
    adapter.attachments = {
      async comment(n, body, files) {
        check("attachments");
        attached.push({ ticket: n, files });
        return addComment(n, body);
      },
      async writeBody(n, body, files) {
        check("attachments");
        attached.push({ ticket: n, files });
        get(n).body = body;
      },
    };

  return {
    tickets: adapter,
    /** The tickets as they stand, for assertions. */
    state: tickets,
    board,
    /** The owner's boards and their columns, as they stand. */
    boards,
    blockers,
    removedLabels,
    attached,
    writes,
    /** Each ticket's field values, by field name, as they stand. */
    fieldValues,
    /** Puts a card on the board, as the owner would. */
    card(n: Key | number, item: Partial<BoardItem> = {}) {
      const key = String(n);
      board.set(key, {
        itemId: `I_${key}`,
        key,
        status: null,
        updatedAt: null,
        session: "",
        runsIn: "",
        cost: null,
        ...item,
      });
    },
    /** Every comment posted on ticket N, oldest first. */
    comments: (n: Key | number) => tickets.get(String(n))?.comments ?? [],
  };
}
