// The one interface every ticket system's adapter implements. The factory's
// commands read and write tickets only through it, so a second system is an
// adapter added beside `github.mts`, not a rewrite of the commands. What a
// ticket's state means (the marker comments, costs, and the views) stays
// above it, in `lib/work-status.mts` and the commands.

/** A ticket's identity: the key its ticket system gives it, as text, such
 * as `12` on GitHub or `PROJ-12` in Jira. */
export type Key = string;

export type TicketComment = {
  /** Opaque: never compared as a number. */
  id: string;
  author: string;
  createdAt: string;
  body: string;
};

/** A card's place on the board and its fields. */
export type BoardItem = {
  /** The system's own ID for the card, for the adapter's writes. */
  itemId: string;
  key: Key;
  status: string | null;
  /** When Status last changed. */
  updatedAt: string | null;
  session: string;
  runsIn: string;
  /** The Cost field, which only the sync writes. */
  cost?: number | null;
  /** Its place in the board's own order, as the board shows it unsorted:
   * lower first. Cards the adapter cannot order share one rank. */
  rank?: number;
};

/** One thing the factory recorded on a ticket, such as a claim or a cost:
 * its visible text and the marker lines that say what it means. */
export type Entry = {
  /** Opaque, as a comment's ID is. */
  id: string;
  at: string;
  author: string;
  text: string;
  /** Each a line such as `<!-- work-status: claim local abc -->`. */
  markers: string[];
};

/** An entry to record. `tellsPerson` says a person has to read it, such as
 * a stop that waits on them; an adapter that can keep the record hidden
 * comments only for those. */
export type NewEntry = {
  text: string;
  markers: string[];
  tellsPerson: boolean;
};

/** Where the factory keeps what it did on a ticket. */
export type RecordOps = {
  /** Returns the entry's ID. */
  add(ticket: Key, entry: NewEntry): Promise<string>;
  /** Replaces an entry; NotFoundError when it is gone. */
  update(id: string, entry: NewEntry): Promise<void>;
  /** NotFoundError when the entry is gone. */
  remove(id: string): Promise<void>;
  /** Oldest first. */
  read(ticket: Key): Promise<Entry[]>;
};

export type Ticket = {
  key: Key;
  title: string;
  /** When the ticket system marked it finished, such as GitHub closing it,
   * or null while it has not. */
  finishedAt: string | null;
  labels: string[];
  body: string;
  /** Oldest first, in the order the ticket system keeps them. */
  comments: TicketComment[];
  /** What the factory recorded on it, oldest first. */
  record: Entry[];
  /** The ticket's card, when "Read everything at once" was asked for the
   * board and the adapter has one; null when it is not on the board. */
  card?: BoardItem | null;
};

export type TicketSummary = { key: Key; title: string; labels: string[] };

/** A board field and, for a single select, its options. */
export type BoardField = {
  id: string;
  name: string;
  dataType: string;
  options?: { id: string; name: string }[];
};

export type Board = {
  /** The system's own ID for the board, for the adapter's writes. */
  projectId: string;
  /** The board's own title, for the report `factory board check` prints. */
  title?: string;
  /** The single-select field whose options are the board's columns, as
   * the ticket system names it: Status on GitHub. */
  columnField: string;
  fields: BoardField[];
  /** This repository's tickets on the board, by key. */
  items: Map<Key, BoardItem>;
};

/** One write to a card's field. */
export type Write =
  | { field: string; optionName: string }
  | { field: string; text: string }
  | { field: string; number: number }
  | { field: string; clear: true };

export type BoardOps = {
  /** Every card and the board's fields. */
  read(): Promise<Board>;
  /** Puts the ticket on the board, and returns its card's ID. */
  add(ticket: Key): Promise<string>;
  /** Moves a card already on the board to the column of that name. */
  move(itemId: string, column: string): Promise<void>;
  /** Writes the factory's own fields of a card already on the board. */
  set(itemId: string, writes: Write[]): Promise<void>;
  /** The repositories with an unfinished ticket in that column of board
   * `number`, each once, in the board's order. Optional. */
  readyRepositories?(number: number, column: string): Promise<string[]>;
  /** The open boards the repository's owner has. */
  list(): Promise<{ number: number; title: string }[]>;
  /** Creates a board under the repository's owner, linked to the
   * repository, and returns its number. Optional. */
  create?(title: string): Promise<number>;
  /** Board `number`'s columns, its Status field's options in the board's
   * order, or none when it has no Status field. */
  columns(number: number): Promise<string[]>;
  /** The names of every field board `number` has. */
  fieldNames(number: number): Promise<string[]>;
  /** Gives board `number` each of `columns` it lacks, the columns in that
   * order before any other it has, and returns the ones it added. */
  addColumns?(number: number, columns: string[]): Promise<string[]>;
  /** Gives board `number` each of `fields` it lacks, by name, and returns
   * the names of the ones it added. */
  addFields?(number: number, fields: NewField[]): Promise<string[]>;
};

/** A board field to add: text, a number, or a single select with its
 * options. */
export type NewField =
  | { name: string; type: "text" | "number" }
  | { name: string; type: "select"; options: string[] };

/** A ticket another waits on. Its key can name a ticket `key` would refuse,
 * such as one in another repository. */
export type Blocker = { key: Key; state: "open" | "closed" };

export type BlockerOps = {
  /** What a ticket waits on, open or closed. */
  list(ticket: Key): Promise<Blocker[]>;
  /** Records that `ticket` waits on `by`. */
  add(ticket: Key, by: Key): Promise<void>;
  remove(ticket: Key, by: Key): Promise<void>;
};

export type LabelHistoryOps = {
  /** Whether the label was ever removed from the ticket. */
  wasRemoved(ticket: Key, label: string): Promise<boolean>;
};

export type AttachmentOps = {
  /** Comments with the images attached; returns the comment's ID. */
  comment(ticket: Key, body: string, files: string[]): Promise<string>;
  /** Replaces the body with the images attached. */
  writeBody(ticket: Key, body: string, files: string[]): Promise<void>;
};

/** A field tickets can have, set on the ticket itself. */
export type TicketField = {
  name: string;
  /** The field's own description, for the coding agent; null with none. */
  description: string | null;
  /** Whether it holds text, so it can hold a factory field. */
  text: boolean;
};

export type FieldOps = {
  /** Whether a field shows its text as typed, without formatting. */
  plainText: boolean;
  /** The fields tickets can have, in the system's order. */
  list(): Promise<TicketField[]>;
  /** Whether the ticket can hold the field, and how many characters. */
  holds(
    ticket: Key,
    field: string,
  ): Promise<{ max: number | null } | { reason: string }>;
  /** The ticket's text field values, by field name. */
  read(ticket: Key): Promise<Record<string, string>>;
  /** Sets each field by name; null clears it. */
  write(ticket: Key, values: Record<string, string | null>): Promise<void>;
};

export const GROUPS = [
  "board",
  "blockers",
  "label-history",
  "attachments",
  "fields",
] as const;
export type Group = (typeof GROUPS)[number];

export type NewTicket = { title: string; body: string; labels: string[] };

export type Tickets = {
  /** The key a person typed, or KeyError saying what a key looks like in
   * this system. It checks only typed input: keys the adapter returned, such
   * as a blocker's, are used as they are. */
  key(typed: string): Key;
  /** How the ticket is written in prose and output, such as `#12`. */
  ref(ticket: Key): string;
  /** The ticket, or NotFoundError when there is none. */
  read(ticket: Key): Promise<Ticket>;
  /** Every ticket not finished, whatever its labels, however many. */
  listUnfinished(): Promise<TicketSummary[]>;
  /** Every ticket with the label `label`, when given, that is not finished,
   * and the 30 with it finished most recently, as `read` returns each, with
   * its card when `board` is asked and the adapter has the board group. */
  readAll(options?: { board?: boolean; label?: string }): Promise<Ticket[]>;
  writeBody(ticket: Key, body: string): Promise<void>;
  writeTitle(ticket: Key, title: string): Promise<void>;
  /** Returns the comment's ID. The body is posted as given. */
  comment(ticket: Key, body: string): Promise<string>;
  /** NotFoundError when the comment is gone. */
  editComment(id: string, body: string): Promise<void>;
  /** NotFoundError when the comment is gone. */
  deleteComment(id: string): Promise<void>;
  /** Returns the new ticket's key. */
  open(ticket: NewTicket): Promise<Key>;
  /** Creates the label where the ticket system needs one to exist before
   * it is used; nothing where it does not. */
  ensureLabel(label: string): Promise<void>;
  addLabel(ticket: Key, label: string): Promise<void>;
  removeLabel(ticket: Key, label: string): Promise<void>;
  /** Whether a comment by `author` may decide on a ticket: an answer to a
   * question, taken as an instruction. Rejects when the system cannot
   * say. */
  mayDecide(author: string): Promise<boolean>;
  /** The line in a pull request's body that closes the ticket when it
   * merges, or that says it builds part of it. */
  linkText(ticket: Key, kind: LinkKind): string;
  /** The tickets a pull request's body closes and builds part of, each in
   * the order the body links them, once. */
  linksIn(body: string): Links;
  /** The address of the ticket's page. */
  address(ticket: Key): string;
  /** Marks the ticket finished in the ticket system, once the pull request
   * that closes it merged: GitHub closes it if it is open. */
  finish(ticket: Key): Promise<void>;
  /** Whether the ticket system has statuses of its own, which
   * `tickets.columns` then maps whatever `tickets.board` says. */
  statuses: boolean;
  record: RecordOps;
  board?: BoardOps;
  blockers?: BlockerOps;
  labelHistory?: LabelHistoryOps;
  attachments?: AttachmentOps;
  fields?: FieldOps;
};

export type LinkKind = "closes" | "part";
export type Links = { closes: Key[]; partOf: Key[] };

/** Typed text that is not a key this ticket system uses. */
export class KeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyError";
  }
}

/** The order tickets are listed in: by key, letters first, then the number
 * as a number, so PROJ-9 comes before PROJ-12. */
export const compareKeys = (a: Key, b: Key): number =>
  a.localeCompare(b, "en", { numeric: true });

/** A ticket or comment that does not exist, told apart from any other
 * failure. Every adapter throws this one. */
export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} was not found`);
    this.name = "NotFoundError";
  }
}

/** A command that needs an optional group its adapter lacks. */
export class UnsupportedError extends Error {
  constructor(group: Group) {
    super(
      `This ticket system does not support ${group}; check with \`factory ticket supports ${group}\` first.`,
    );
    this.name = "UnsupportedError";
  }
}

/** Whether the adapter has the optional group. */
export function supports(tickets: Tickets, group: Group): boolean {
  switch (group) {
    case "board":
      return tickets.board !== undefined;
    case "blockers":
      return tickets.blockers !== undefined;
    case "label-history":
      return tickets.labelHistory !== undefined;
    case "attachments":
      return tickets.attachments !== undefined;
    case "fields":
      return tickets.fields !== undefined;
  }
}

/** The group's operations, or UnsupportedError naming it. */
export function need<G extends Group>(
  tickets: Tickets,
  group: G,
): NonNullable<Tickets[GroupKey<G>]> {
  const key = GROUP_KEYS[group] as GroupKey<G>;
  const ops = tickets[key];
  if (ops === undefined) throw new UnsupportedError(group);
  return ops as NonNullable<Tickets[GroupKey<G>]>;
}

const GROUP_KEYS = {
  board: "board",
  blockers: "blockers",
  "label-history": "labelHistory",
  attachments: "attachments",
  fields: "fields",
} as const;
type GroupKey<G extends Group> = (typeof GROUP_KEYS)[G];

/** "Read everything at once": the adapter's own. */
export const readAll = (
  tickets: Tickets,
  options: { board?: boolean; label?: string } = {},
): Promise<Ticket[]> => tickets.readAll(options);

/** The cards `readAll` carried, as a Board, for the code that reads one. */
export function boardOf(tickets: Ticket[]): Board {
  const items = new Map<Key, BoardItem>();
  for (const t of tickets) if (t.card) items.set(t.key, t.card);
  return { projectId: "", columnField: "", fields: [], items };
}

/** A ticket system's credential is missing, refused, or in a file that
 * cannot be read: the message is the one line to print, with its fix. */
export class CredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialError";
  }
}
