// The one interface every ticket system's adapter implements. The factory's
// commands read and write tickets only through it, so a second system is an
// adapter added beside `github.mts`, not a rewrite of the commands. What a
// ticket's state means (the marker comments, costs, and the views) stays
// above it, in `lib/work-status.mts` and the commands.

export type TicketComment = {
  id: number;
  author: string;
  createdAt: string;
  body: string;
};

/** A card's place on the board and its fields. */
export type BoardItem = {
  /** The system's own ID for the card, for the adapter's writes. */
  itemId: string;
  number: number;
  status: string | null;
  /** When Status last changed. */
  updatedAt: string | null;
  session: string;
  runsIn: string;
  /** The Cost field, which only the sync writes. */
  cost?: number | null;
};

export type Ticket = {
  number: number;
  title: string;
  state: "open" | "closed";
  closedAt: string | null;
  labels: string[];
  body: string;
  comments: TicketComment[];
  /** The ticket's card, when "Read everything at once" was asked for the
   * board and the adapter has one; null when it is not on the board. */
  card?: BoardItem | null;
};

export type TicketSummary = { number: number; title: string; labels: string[] };

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
  fields: BoardField[];
  /** This repository's tickets on the board, by number. */
  items: Map<number, BoardItem>;
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
  add(ticket: number): Promise<string>;
  /** Writes the fields of a card already on the board. */
  set(itemId: string, writes: Write[]): Promise<void>;
  /** The open boards the repository's owner has. */
  list(): Promise<{ number: number; title: string }[]>;
  /** Creates a board under the repository's owner, linked to the
   * repository, and returns its number. */
  create(title: string): Promise<number>;
  /** Board `number`'s columns, its Status field's options in the board's
   * order, or none when it has no Status field. */
  columns(number: number): Promise<string[]>;
  /** Gives board `number` each of `columns` it lacks, the columns in that
   * order before any other it has, and returns the ones it added. */
  addColumns(number: number, columns: string[]): Promise<string[]>;
  /** Gives board `number` each of `fields` it lacks, by name, and returns
   * the names of the ones it added. */
  addFields(number: number, fields: NewField[]): Promise<string[]>;
};

/** A board field to add: text, a number, or a single select with its
 * options. */
export type NewField =
  | { name: string; type: "text" | "number" }
  | { name: string; type: "select"; options: string[] };

export type Blocker = { number: number; state: "open" | "closed" };

export type BlockerOps = {
  /** What a ticket waits on, open or closed. */
  list(ticket: number): Promise<Blocker[]>;
  /** Records that `ticket` waits on `by`. */
  add(ticket: number, by: number): Promise<void>;
  remove(ticket: number, by: number): Promise<void>;
};

export type LabelHistoryOps = {
  /** Whether the label was ever removed from the ticket. */
  wasRemoved(ticket: number, label: string): Promise<boolean>;
};

export type AttachmentOps = {
  /** Comments with the images attached; returns the comment's ID. */
  comment(ticket: number, body: string, files: string[]): Promise<number>;
  /** Replaces the body with the images attached. */
  writeBody(ticket: number, body: string, files: string[]): Promise<void>;
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
    ticket: number,
    field: string,
  ): Promise<{ max: number | null } | { reason: string }>;
  /** The ticket's text field values, by field name. */
  read(ticket: number): Promise<Record<string, string>>;
  /** Sets each field by name; null clears it. */
  write(ticket: number, values: Record<string, string | null>): Promise<void>;
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
  /** The ticket, or NotFoundError when there is none. */
  read(ticket: number): Promise<Ticket>;
  /** Every open ticket, however many there are. */
  listOpen(): Promise<TicketSummary[]>;
  /** Every open ticket and the 30 closed ones most recently updated, as
   * `read` returns each, with its card when `board` is asked and the
   * adapter has the board group. Optional: `readAll` in `index.mts` builds
   * it from `listOpen` and `read` when an adapter does not. */
  readAll?(options?: { board?: boolean }): Promise<Ticket[]>;
  writeBody(ticket: number, body: string): Promise<void>;
  writeTitle(ticket: number, title: string): Promise<void>;
  /** Returns the comment's ID. The body is posted as given. */
  comment(ticket: number, body: string): Promise<number>;
  /** NotFoundError when the comment is gone. */
  editComment(id: number, body: string): Promise<void>;
  /** NotFoundError when the comment is gone. */
  deleteComment(id: number): Promise<void>;
  /** Returns the new ticket's number. */
  open(ticket: NewTicket): Promise<number>;
  addLabel(ticket: number, label: string): Promise<void>;
  removeLabel(ticket: number, label: string): Promise<void>;
  /** What makes a merged pull request close the ticket. */
  linkText(ticket: number): string;
  /** The address of the ticket's page. */
  address(ticket: number): string;
  board?: BoardOps;
  blockers?: BlockerOps;
  labelHistory?: LabelHistoryOps;
  attachments?: AttachmentOps;
  fields?: FieldOps;
};

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

/** "Read everything at once" from the list and the single reads, for an
 * adapter that does not override it. It returns the open tickets: a list of
 * open tickets cannot name the closed ones. */
export async function readAll(
  tickets: Tickets,
  options: { board?: boolean } = {},
): Promise<Ticket[]> {
  if (tickets.readAll) return tickets.readAll(options);
  const open = await tickets.listOpen();
  const read = await Promise.all(open.map((t) => tickets.read(t.number)));
  if (!options.board || !tickets.board) return read;
  const board = await tickets.board.read();
  return read.map((t) => ({ ...t, card: board.items.get(t.number) ?? null }));
}

/** The cards `readAll` carried, as a Board, for the code that reads one. */
export function boardOf(tickets: Ticket[]): Board {
  const items = new Map<number, BoardItem>();
  for (const t of tickets) if (t.card) items.set(t.number, t.card);
  return { projectId: "", fields: [], items };
}
