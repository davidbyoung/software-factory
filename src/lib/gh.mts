// How the session scripts reach GitHub. Every call goes through a runner that
// can be swapped in tests, and a failed call rejects, so a failed read is
// never mistaken for an empty list.
import { execFile } from "node:child_process";
import type { Runner } from "../runner/types.mts";
import type { Identity } from "./work-status.mts";

export type Gh = (args: string[]) => Promise<string>;

/** The GitHub CLI given `input` on standard input, for a value that must
 * never appear in a command's arguments, such as a secret. */
export type GhIn = (args: string[], input: string) => Promise<string>;

/** What GitHub said was wrong beyond its one line: the `errors` in the
 * answer the CLI printed, such as why a pull request could not be opened.
 * The CLI's own message for those is only "Validation Failed". */
export function refusalsIn(stdout: string): string {
  try {
    const { errors } = JSON.parse(stdout) as { errors?: unknown };
    if (!Array.isArray(errors)) return "";
    return errors
      .map((e) =>
        typeof e === "string" ? e : (e as { message?: unknown })?.message,
      )
      .filter((m): m is string => typeof m === "string")
      .join("; ");
  } catch {
    return "";
  }
}

/** A failed call's error: the call, the CLI's own message, and the reasons
 * in the answer it printed. */
export function failureOf(
  args: string[],
  detail: string,
  stdout: string,
): string {
  const said = refusalsIn(stdout);
  return `gh ${args.slice(0, 4).join(" ")}: ${detail.trim()}${said ? `: ${said}` : ""}`;
}

/** A call the GitHub CLI failed, with the status it exited with: 4 when
 * it is signed in as nobody. */
export class GhError extends Error {
  readonly exitCode: number | null;
  constructor(message: string, exitCode: number | null) {
    super(message);
    this.name = "GhError";
    this.exitCode = exitCode;
  }
}

export const gh: Gh = (args) =>
  new Promise((resolve, reject) => {
    execFile(
      "gh",
      args,
      { maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error)
          reject(
            new GhError(
              failureOf(args, stderr || error.message, stdout),
              typeof error.code === "number" ? error.code : null,
            ),
          );
        else resolve(stdout);
      },
    );
  });

export const ghIn: GhIn = (args, input) =>
  new Promise((resolve, reject) => {
    const child = execFile(
      "gh",
      args,
      { maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error)
          reject(new Error(failureOf(args, stderr || error.message, stdout)));
        else resolve(stdout);
      },
    );
    child.stdin?.end(input);
  });

export async function ghJson<T>(run: Gh, args: string[]): Promise<T> {
  return JSON.parse(await run(["api", ...args])) as T;
}

/** Every page of a REST list. */
export async function ghList<T>(run: Gh, path: string): Promise<T[]> {
  const pages = await ghJson<T[][]>(run, ["--paginate", "--slurp", path]);
  return pages.flat();
}

export async function graphql<T>(
  run: Gh,
  query: string,
  variables: Record<string, string | number | boolean | null> = {},
): Promise<T> {
  const args = ["graphql", "-f", `query=${query}`];
  for (const [name, value] of Object.entries(variables)) {
    if (value === null) continue;
    args.push(typeof value === "string" ? "-f" : "-F", `${name}=${value}`);
  }
  const result = await ghJson<T & { errors?: { message: string }[] }>(
    run,
    args,
  );
  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }
  return result;
}

/** Who this session is, for its marker comments. A session in one of the
 * runner's runs goes by the run: its ID, its page, and the account that
 * started it. A local session run in the desktop app goes by the app's
 * `local_…` ID, which its links need; one run in a terminal has only its
 * own. `unknown` when the environment does not say. */
export function sessionIdentity(
  env: Record<string, string | undefined>,
  runner: Pick<Runner, "thisRun">,
): Identity {
  const run = runner.thisRun(env);
  if (run)
    return {
      where: "actions",
      id: run.id,
      ...(run.page ? { link: run.page } : {}),
      ...(run.startedBy ? { actor: run.startedBy } : {}),
    };
  const app = env.CLAUDE_CODE_HOST_SESSION_ID ?? "";
  if (appSessionLink(app)) return { where: "local", id: app };
  const id = env.CLAUDE_CODE_SESSION_ID?.slice(0, 8);
  return { where: "local", id: id || "unknown" };
}

/** The link that opens a session in the desktop app; null for an ID the app
 * does not know. */
export function appSessionLink(id: string): string | null {
  return /^local_[A-Za-z0-9-]{1,64}$/.test(id)
    ? `claude://claude.ai/epitaxy/${id}`
    : null;
}
