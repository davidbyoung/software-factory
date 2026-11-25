// How a run reaches another repository than its own. Under an
// organization's app it makes a token for that repository alone, in the
// process that uses it, which is never printed, stored, or handed to a
// later step. With no app's key it uses the build token, and with neither
// it has none.
import { acrossToken } from "./github-app.mts";
import { fetchTransport, type Transport } from "../tickets/transport.mts";
import { githubCodeHost } from "./github.mts";
import type { CodeHost } from "./types.mts";

/** What the token may do there: only read, or write its tickets and start
 * its runs as well. It may never push. */
export type Access = "read" | "write";

type Env = Record<string, string | undefined>;

/** A token of the app's lasts an hour. */
const KEPT_MS = 45 * 60 * 1000;

const kept = new Map<string, { at: number; transport: Transport }>();

/** Whether a run has anything to reach another repository with. */
export const reachesOthers = (env: Env): boolean =>
  Boolean(
    (env.FACTORY_APP_CLIENT_ID && env.FACTORY_APP_PRIVATE_KEY) ||
    env.FACTORY_BUILD_TOKEN,
  );

/** How `repository` is reached, or null with nothing to reach it with. */
export async function acrossTransport(
  repository: string,
  access: Access,
  env: Env = process.env,
  o: { fetch: typeof fetch; now: () => number } = { fetch, now: Date.now },
): Promise<Transport | null> {
  // A step that only reads says so, whatever its code asks for.
  const may = env.FACTORY_ACROSS === "read" ? "read" : access;
  const over = (token: string) => fetchTransport({ token, fetch: o.fetch });
  const clientId = env.FACTORY_APP_CLIENT_ID;
  const key = env.FACTORY_APP_PRIVATE_KEY;
  if (clientId && key) {
    const name = `${may} ${repository}`;
    const had = kept.get(name);
    if (had && o.now() - had.at < KEPT_MS) return had.transport;
    const token = await acrossToken({
      ...o,
      app: { clientId, key },
      repository,
      access: may,
    });
    const transport = over(token);
    kept.set(name, { at: o.now(), transport });
    return transport;
  }
  return env.FACTORY_BUILD_TOKEN ? over(env.FACTORY_BUILD_TOKEN) : null;
}

/** The code host there, or null with nothing to reach it with. */
export async function acrossCodeHost(
  repository: string,
  access: Access,
  env: Env = process.env,
): Promise<CodeHost | null> {
  const transport = await acrossTransport(repository, access, env);
  return transport && githubCodeHost({ transport, repository });
}
