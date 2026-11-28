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

const kept = new Map<string, { at: number; token: string }>();

/** Whether a run has anything to reach another repository with. */
export const reachesOthers = (env: Env): boolean =>
  Boolean(
    (env.LUNAMILL_APP_CLIENT_ID && env.LUNAMILL_APP_PRIVATE_KEY) ||
    env.LUNAMILL_BUILD_TOKEN,
  );

type Clock = { fetch: typeof fetch; now: () => number };
const LIVE: Clock = { fetch: (...a) => fetch(...a), now: Date.now };

/** A token for `repository`, or null with nothing to make one from. */
async function tokenFor(
  repository: string,
  access: Access,
  env: Env,
  o: Clock,
): Promise<string | null> {
  // A step that only reads says so, whatever its code asks for.
  const may = env.LUNAMILL_ACROSS === "read" ? "read" : access;
  const clientId = env.LUNAMILL_APP_CLIENT_ID;
  const key = env.LUNAMILL_APP_PRIVATE_KEY;
  if (!clientId || !key) return env.LUNAMILL_BUILD_TOKEN ?? null;
  const name = `${may} ${repository}`;
  const had = kept.get(name);
  if (had && o.now() - had.at < KEPT_MS) return had.token;
  const token = await acrossToken({
    ...o,
    app: { clientId, key },
    repository,
    access: may,
  });
  kept.set(name, { at: o.now(), token });
  return token;
}

/** How `repository` is reached, or null with nothing to reach it with. */
export async function acrossTransport(
  repository: string,
  access: Access,
  env: Env = process.env,
  o: Clock = LIVE,
): Promise<Transport | null> {
  const token = await tokenFor(repository, access, env, o);
  return token ? fetchTransport({ token, fetch: o.fetch }) : null;
}

/** What git's environment takes to read `repository`: nothing where the
 * sign-in of the machine or the job does. */
export async function acrossGitEnv(
  repository: string,
  env: Env = process.env,
  o: Clock = LIVE,
): Promise<Record<string, string>> {
  const token = await tokenFor(repository, "read", env, o);
  if (!token) return {};
  const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
  return {
    GIT_CONFIG_COUNT: "2",
    GIT_CONFIG_KEY_0: "credential.helper",
    GIT_CONFIG_VALUE_0: "",
    GIT_CONFIG_KEY_1: "http.https://github.com/.extraheader",
    GIT_CONFIG_VALUE_1: `AUTHORIZATION: basic ${basic}`,
  };
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
