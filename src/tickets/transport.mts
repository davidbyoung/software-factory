// How the GitHub adapter and `src/code-host/` reach GitHub: one function for a
// REST call and one for a GraphQL query. There are two. `ghTransport` runs
// the GitHub CLI, for sessions and CI. `fetchTransport` calls the API with a
// token, for the poller, which runs with no `gh` and no install. A failed
// call rejects, so a failed read is never mistaken for an empty answer.
//
// Node built-ins only: the poller's image copies this file.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Gh } from "../lib/gh.mts";

export type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
export type Fields = Record<
  string,
  | string
  | number
  | boolean
  | string[]
  // A nested object, as a workflow dispatch's `inputs`.
  | Record<string, string | number | boolean>
>;
export type Variables = Record<string, string | number | boolean | null>;
export type RestOptions = {
  fields?: Fields;
  paginate?: boolean;
  body?: unknown;
};

export type Transport = {
  /** A REST call. `paginate` reads every page of a list and joins them.
   * `body` is sent whole as JSON, in place of `fields`, for a shape fields
   * cannot hold, such as a list of objects. */
  rest<T>(method: Method, path: string, options?: RestOptions): Promise<T>;
  /** A GraphQL query or mutation; resolves to the whole answer, `data` and
   * all, and rejects when GitHub answers with errors. */
  graphql<T>(query: string, variables?: Variables): Promise<T>;
  /** A GET whose answer is plain text, not JSON, such as a job's log. */
  text(path: string): Promise<string>;
};

/** A call GitHub answered with an HTTP error. */
export class HttpError extends Error {
  // A plain field, not a parameter property: the poller runs this file
  // unbuilt, and Node's type stripping refuses parameter properties.
  readonly status: number;
  /** What GitHub said was wrong: the `message` in its answer, or the status
   * text when it gave none. */
  readonly reason: string;
  constructor(status: number, message: string, reason = "") {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.reason = reason;
  }
}

/** The HTTP status in an error a transport threw, or null. */
export function statusOf(error: unknown): number | null {
  if (error instanceof HttpError) return error.status;
  const match = /HTTP (\d{3})\b/.exec(String(error));
  return match ? Number(match[1]) : null;
}

function ghFields(fields: Fields): string[] {
  const args: string[] = [];
  for (const [name, value] of Object.entries(fields)) {
    if (Array.isArray(value))
      for (const item of value) args.push("-f", `${name}[]=${item}`);
    else if (typeof value === "object")
      for (const [key, item] of Object.entries(value))
        args.push("-f", `${name}[${key}]=${item}`);
    else
      args.push(
        typeof value === "string" ? "-f" : "-F",
        `${name}=${String(value)}`,
      );
  }
  return args;
}

function parse<T>(text: string): T {
  return (text.trim() ? JSON.parse(text) : undefined) as T;
}

/** The GitHub CLI as a transport. */
export function ghTransport(run: Gh): Transport {
  return {
    async rest<T>(
      method: Method,
      path: string,
      options: RestOptions = {},
    ): Promise<T> {
      if (options.body !== undefined) {
        const dir = mkdtempSync(join(tmpdir(), "factory-body-"));
        const file = join(dir, "body.json");
        writeFileSync(file, JSON.stringify(options.body));
        try {
          return parse<T>(
            await run(["api", "-X", method, path, "--input", file]),
          );
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      }
      if (options.paginate) {
        const pages = parse<unknown[][]>(
          await run(["api", "--paginate", "--slurp", path]),
        );
        return pages.flat() as T;
      }
      const args =
        method === "GET" ? ["api", path] : ["api", "-X", method, path];
      args.push(...ghFields(options.fields ?? {}));
      return parse<T>(await run(args));
    },
    async graphql<T>(query: string, variables: Variables = {}): Promise<T> {
      const args = ["api", "graphql", "-f", `query=${query}`];
      for (const [name, value] of Object.entries(variables)) {
        if (value === null) continue;
        args.push(typeof value === "string" ? "-f" : "-F", `${name}=${value}`);
      }
      const result = parse<T & { errors?: { message: string }[] }>(
        await run(args),
      );
      if (result.errors?.length)
        throw new Error(result.errors.map((e) => e.message).join("; "));
      return result;
    },
    // Without the flag the CLI refuses to print an answer that holds a
    // terminal's escape sequences, as a job's log does.
    text: (path: string) => run(["api", "--allow-escape-sequences", path]),
  };
}

const API = "https://api.github.com";

/** The `message` in an error answer's JSON body, or "". */
async function answerMessage(response: Response): Promise<string> {
  try {
    const body = JSON.parse(await response.text()) as { message?: unknown };
    return typeof body.message === "string" ? body.message : "";
  } catch {
    return "";
  }
}

/** The next page's address from a Link header, or null. */
export function nextLink(link: string | null): string | null {
  if (!link) return null;
  for (const part of link.split(",")) {
    const match = /<([^>]+)>;\s*rel="next"/.exec(part);
    if (match) return match[1];
  }
  return null;
}

/** The API called with a token, as the poller does. Each call gives up
 * after `timeoutMs`. */
export function fetchTransport(options: {
  token: string;
  fetch: typeof fetch;
  timeoutMs?: number;
  userAgent?: string;
}): Transport {
  const call = async (
    method: Method,
    url: string,
    body?: unknown,
  ): Promise<Response> => {
    const response = await options.fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${options.token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": options.userAgent ?? "software-factory",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
    });
    if (!response.ok) {
      const path = url.startsWith(API) ? url.slice(API.length + 1) : url;
      const said = await answerMessage(response);
      const reason = said || response.statusText;
      throw new HttpError(
        response.status,
        `GitHub ${path} answered ${response.status} (HTTP ${response.status})${said ? `: ${said}` : ""}`,
        reason,
      );
    }
    return response;
  };
  const json = async <T,>(response: Response): Promise<T> =>
    parse<T>(await response.text());
  return {
    async rest<T>(
      method: Method,
      path: string,
      opts: RestOptions = {},
    ): Promise<T> {
      const url = `${API}/${path}`;
      if (opts.paginate) {
        const items: unknown[] = [];
        for (let next: string | null = url; next;) {
          const response = await call("GET", next);
          items.push(...(await json<unknown[]>(response)));
          next = nextLink(response.headers.get("link"));
        }
        return items as T;
      }
      const body = opts.body ?? opts.fields;
      return json<T>(
        await call(
          method,
          url,
          method === "GET" || body === undefined ? undefined : body,
        ),
      );
    },
    async graphql<T>(query: string, variables: Variables = {}): Promise<T> {
      const result = await json<T & { errors?: { message: string }[] }>(
        await call("POST", `${API}/graphql`, { query, variables }),
      );
      if (result.errors?.length)
        throw new Error(
          `GitHub graphql: ${result.errors.map((e) => e.message).join("; ")}`,
        );
      return result;
    },
    text: async (path: string) => (await call("GET", `${API}/${path}`)).text(),
  };
}
