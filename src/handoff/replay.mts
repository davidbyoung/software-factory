// What a session in the cloud reads of the code host, the ticket system,
// and the runner. It has no sign-in to any of them, so a job with one reads
// ahead through the real adapters, `recording` each answer, and the session
// gets the same adapters `replaying` those answers. A read nobody made ahead
// fails by name, since an empty answer would be taken for the truth.
import type { CodeHost } from "../code-host/types.mts";
import type { Runner } from "../runner/types.mts";
import { NotFoundError, type Tickets } from "../tickets/types.mts";

type Adapters = { tickets: Tickets; codeHost: CodeHost; runner: Runner };
export type On = keyof Adapters;

/** One read: the method's path, such as `record.read`, and its answer. */
export type Call = {
  on: On;
  call: string;
  args: unknown[];
  value?: unknown;
  error?: { missing: boolean; message: string };
};

/** A read that was not made ahead. */
export class NotHandedError extends Error {
  constructor(on: On, call: string, args: unknown[], ticket: string | null) {
    const words = args.filter((a) => typeof a !== "object").join(" ");
    const what =
      on === "tickets" && call === "read"
        ? `Ticket ${words}`
        : `The ${LABEL[on]}'s ${call}${words ? ` of ${words}` : ""}`;
    const stop = ticket
      ? `, or stop with: factory ticket stop ${ticket} "needs ${what[0].toLowerCase()}${what.slice(1)}"`
      : "";
    super(`✗ ${what} was not handed to this run. Go on without it${stop}`);
    this.name = "NotHandedError";
  }
}

const LABEL: Record<On, string> = {
  tickets: "ticket system",
  codeHost: "code host",
  runner: "runner",
};

/** The methods that read nothing: they answer from their arguments. */
const PURE: { [K in On]: ReadonlySet<string> } = {
  tickets: new Set<keyof Tickets>([
    "key",
    "ref",
    "linkText",
    "linksIn",
    "address",
  ]),
  codeHost: new Set<keyof CodeHost>([
    "address",
    "closesIn",
    "remote",
    "releasePage",
    "scopesFor",
    "newTokenPage",
    "reviewAppPage",
  ]),
  runner: new Set<keyof Runner>(["buildsPage", "runPage", "thisRun"]),
};

/** The arguments without those left out at the end. */
function given(args: unknown[]): unknown[] {
  const end = args.findLastIndex((a) => a !== undefined);
  return args.slice(0, end + 1);
}

const keyOf = (on: On, call: string, args: unknown[]) =>
  JSON.stringify([on, call, args]);

/** A Map does not survive JSON, and a board's cards are one. */
type Packed = { $map: [unknown, unknown][] };
const pack = (value: unknown): unknown =>
  JSON.parse(
    JSON.stringify(value ?? null, (_, v) =>
      v instanceof Map ? { $map: [...v] } : v,
    ),
  );
const unpack = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value ?? null), (_, v) =>
    v && typeof v === "object" && Array.isArray((v as Packed).$map)
      ? new Map((v as Packed).$map)
      : v,
  );

/** `target` with every method, its groups' too, answered by `answer`. */
function wrapped<T extends object>(
  target: T,
  answer: (path: string, method: (...args: never[]) => unknown) => unknown,
  prefix = "",
): T {
  return new Proxy(target, {
    get(object, name) {
      const value = Reflect.get(object, name) as unknown;
      const path = `${prefix}${String(name)}`;
      if (typeof value === "function")
        return answer(path, value.bind(object) as never);
      if (value && typeof value === "object")
        return wrapped(value, answer, `${path}.`);
      return value;
    },
  });
}

/** The adapter, with each answer it gives added to `calls`. */
export function recording<K extends On>(
  on: K,
  real: Adapters[K],
  calls: Call[],
): Adapters[K] {
  return wrapped(real, (call, method) => (...args: never[]) => {
    const answer = method(...args);
    if (!(answer instanceof Promise)) return answer;
    const base = { on, call, args: given(args) };
    return answer.then(
      (value: unknown) => {
        calls.push({ ...base, value: pack(value) });
        return value;
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const missing = error instanceof NotFoundError;
        calls.push({ ...base, error: { missing, message } });
        throw error;
      },
    );
  });
}

/** The adapter as a session has it: what needs no reading answers as it
 * does, and everything else from `calls` alone, so nothing is reached. */
export function replaying<K extends On>(
  on: K,
  real: Adapters[K],
  calls: Call[],
  ticket: string | null = null,
): Adapters[K] {
  const found = new Map<string, Call>();
  for (const c of calls)
    if (c.on === on) found.set(keyOf(on, c.call, c.args), c);
  return wrapped(real, (call, method) => {
    if (PURE[on].has(call)) return method;
    if (on === "codeHost" && call === "gitToken") return () => null;
    return async (...args: unknown[]) => {
      const known = given(args);
      const hit = found.get(keyOf(on, call, known));
      if (!hit) throw new NotHandedError(on, call, known, ticket);
      if (!hit.error) return unpack(hit.value);
      if (!hit.error.missing) throw new Error(hit.error.message);
      const error = new NotFoundError("It");
      error.message = hit.error.message;
      throw error;
    };
  });
}
