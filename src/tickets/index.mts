// Which adapter the settings' `tickets.type` picks, opened through the
// registry (`tools.mts`) for a command in a session or CI, with the
// credential it reads, when it reads one, from the environment or this
// machine's file (`lib/credentials.mts`).
import { TICKET_LABELS, type Labels } from "../labels.mts";
import { fieldNamesOf, type Settings } from "../config.mts";
import {
  readCredential,
  refusedEnvLine,
  refusedFileLine,
  missingLine,
} from "../lib/credentials.mts";
import type { Registry } from "../tools.mts";
import { githubKey, githubRef, toBoard, type BoardPage } from "./github.mts";
import type { OpenOptions, OpenTarget } from "./github-open.mts";
import { statusOf } from "./transport.mts";
import { CredentialError, need, type Key, type Tickets } from "./types.mts";
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

/** The ticket system a poller someone hosts opens, having no settings. */
export const DEFAULT_TICKETS = "github";

/** A board read from GitHub's recorded pages, for the board sync's
 * fixture. */
export const fixtureBoard = (pages: unknown, repository: string) =>
  toBoard(pages as BoardPage[], repository);

/** How a ticket system of this type writes a ticket, without opening its
 * adapter, for text written ahead of time, such as a workflow's run name. */
export function refOf(type: string): (key: Key) => string {
  if (type !== "github") throw new Error(unsupportedType(type));
  return githubRef;
}

/** How a ticket system of this type reads a typed key, as `Tickets.key`
 * does, without opening its adapter. */
export function keyOf(type: string): (typed: string) => Key {
  if (type !== "github") throw new Error(unsupportedType(type));
  return githubKey;
}

/** The credential the ticket system `type` reads on this machine, for the
 * site the settings give it: null when it reads none, or CredentialError
 * when it is missing or its file cannot be read. */
export function machineCredentialOf(
  systems: Registry["tickets"],
  type: string,
  options: Record<string, unknown>,
  env: Record<string, string | undefined> = process.env,
): {
  label: string;
  site: string;
  names: string[];
  source: "env" | "file";
  values: Record<string, string>;
} | null {
  const tool = systems[type];
  const step = tool?.setup.credential;
  if (!tool || !step?.machine) return null;
  const site = String(options[step.machine.under] ?? "");
  const names = step.parts.map((p) => p.name);
  const found = readCredential({ tool: type, site, names, env });
  if (found.state === "missing")
    throw new CredentialError(missingLine(tool.label, site, names));
  return { label: tool.label, site, names, ...found };
}

/** The adapter with every call's `401` turned into CredentialError, worded
 * by where the credential came from. Each group is wrapped the same way. */
function withRefusals<T extends object>(
  inner: T,
  line: (reason: string) => string,
): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(inner)) {
    if (typeof v === "function") {
      const refused = (e: unknown) => {
        if (statusOf(e) === 401) {
          const r = e as { status: number; reason?: string };
          throw new CredentialError(
            line(`${r.status}${r.reason ? ` ${r.reason}` : ""}`),
          );
        }
        throw e;
      };
      out[k] = (...args: unknown[]) => {
        let result: unknown;
        try {
          result = (v as (...a: unknown[]) => unknown).apply(inner, args);
        } catch (e) {
          refused(e);
        }
        return result instanceof Promise ? result.catch(refused) : result;
      };
    } else if (v && typeof v === "object" && !Array.isArray(v))
      out[k] = withRefusals(v as object, line);
    else out[k] = v;
  }
  return out as T;
}

/** The ticket system `type` opened through the registry with the
 * credential it reads, if any, and every `401` it then meets worded as a
 * refusal of that credential. */
export async function openSystem(
  systems: Registry["tickets"],
  type: string,
  options: Record<string, unknown>,
  target: OpenTarget,
  settings: Settings | null,
  opts: OpenOptions = {},
  env: Record<string, string | undefined> = process.env,
): Promise<Tickets> {
  const tool = systems[type];
  if (!tool) throw new Error(unsupportedType(type));
  const credential = machineCredentialOf(systems, type, options, env);
  const opened = await tool.open(target, settings, {
    ...opts,
    ...(credential ? { credential: credential.values } : {}),
  });
  return credential
    ? withRefusals(opened, (reason) =>
        credential.source === "file"
          ? refusedFileLine(credential.label, credential.site, reason)
          : refusedEnvLine(
              credential.label,
              credential.names,
              credential.site,
              reason,
              env,
            ),
      )
    : opened;
}

/** The settings' adapter, opened through the registry: GitHub's reaches
 * its system through the GitHub CLI unless `opts` gives a transport. The
 * repository and board are the caller's, since a workflow can name its
 * own. */
export async function openTickets(
  settings: Settings,
  target: OpenTarget,
  opts: OpenOptions & { env?: Record<string, string | undefined> } = {},
  systems?: Registry["tickets"],
): Promise<Opened> {
  const { env, ...rest } = opts;
  const tickets = await openSystem(
    systems ?? (await import("../tools.mts")).TOOLS.tickets,
    settings.tickets.type,
    settings.tickets.options,
    target,
    settings,
    { ...rest, fieldNames: fieldNamesOf(settings) },
    env,
  );
  const mapping = settings.tickets.ticketFields;
  return {
    tickets: Object.values(mapping).some((v) => v !== null)
      ? withTicketFields(
          tickets,
          mapping,
          target.repository,
          settings.tickets.labels,
        )
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
  names: Labels["tickets"] = TICKET_LABELS,
): Tickets {
  const fields = () => need(inner, "fields");
  const whole = (labels: readonly string[]) =>
    labels.includes(names["follow-up"]);

  /** The description to write, once every named field is checked and
   * written. */
  const written = async (n: Key, body: string) => {
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
        body: join(ticket.body, values, mapping, ticket.labels, names.spec),
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
