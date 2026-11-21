// Which adapter the settings' `tickets.type` picks, built for a command in a
// session or CI. `github` is the only one; the settings refuse any other
// value before this runs (`config.mts`).
import { gh, type Gh } from "../lib/gh.mts";
import { fieldNamesOf, type Settings } from "../config.mts";
import { githubTickets } from "./github.mts";
import { ghTransport } from "./transport.mts";
import { need, type Tickets } from "./types.mts";
import { join, split, type FieldMapping } from "../ticket-fields.mts";
import { BUILT, unsupported } from "../tool-names.mts";

export * from "./types.mts";

/** The ticket system's message for a type that is not built. */
export const unsupportedType = (type: string) =>
  unsupported(
    "tickets.type",
    type,
    "ticket system",
    Object.keys(BUILT.tickets),
  );

export type Opened = { tickets: Tickets };

/** The settings' adapter, reaching its system through the GitHub CLI. The
 * repository and board are the caller's, since a workflow can name its own. */
export async function openTickets(
  settings: Settings,
  target: { repository: string; board: number | null },
  run: Gh = gh,
): Promise<Opened> {
  const type: string = settings.tickets.type;
  if (type !== "github") throw new Error(unsupportedType(type));
  const transport = ghTransport(run);
  const tickets = githubTickets({
    transport,
    repository: target.repository,
    board: target.board,
    cli: run,
    fieldNames: fieldNamesOf(settings),
  });
  const mapping = settings.tickets.ticketFields;
  return {
    tickets: Object.values(mapping).some((v) => v !== null)
      ? withTicketFields(tickets, mapping, target.repository)
      : tickets,
  };
}

/** The adapter with each ticket read as one document and written back
 * split: the description, and each ticket field `tickets.fields` names.
 * The follow-ups ticket stays whole. `readAll` is the adapter's, since its
 * callers read comments, labels, and cards, never a refined ticket's
 * sections. */
export function withTicketFields(
  inner: Tickets,
  mapping: FieldMapping,
  repository: string,
): Tickets {
  const fields = () => need(inner, "fields");
  const whole = (labels: readonly string[]) => labels.includes("follow-up");

  /** The description to write, once every named field is checked and
   * written. */
  const written = async (n: number, body: string) => {
    const { labels } = await inner.read(n);
    if (whole(labels)) return body;
    const ops = fields();
    const known = await ops.list();
    for (const [key, name] of Object.entries(mapping)) {
      if (name === null) continue;
      const field = known.find((f) => f.name === name);
      if (!field)
        throw new Error(
          `${repository}'s tickets have no field called ${name}, which tickets.fields.${key} names.`,
        );
      if (!field.text)
        throw new Error(
          `${name}, which tickets.fields.${key} names, doesn't hold text.`,
        );
    }
    const parts = split(body, mapping);
    if ("error" in parts) throw new Error(parts.error);
    await ops.write(n, parts.values);
    return parts.description;
  };

  const tickets: Tickets = {
    ...inner,
    async read(n) {
      const ticket = await inner.read(n);
      if (whole(ticket.labels)) return ticket;
      const values = await fields().read(n);
      return {
        ...ticket,
        body: join(ticket.body, values, mapping, ticket.labels),
      };
    },
    async writeBody(n, body) {
      await inner.writeBody(n, await written(n, body));
    },
  };
  if (inner.attachments)
    tickets.attachments = {
      ...inner.attachments,
      writeBody: async (n, body, files) =>
        inner.attachments!.writeBody(n, await written(n, body), files),
    };
  return tickets;
}
