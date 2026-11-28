// An organization's own GitHub App: registered from a manifest the person
// sends from a page this command serves, then reached as the app with a
// token signed by its key. The key is held in memory only, and no message
// or page carries it.
import { createSign } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { HttpError } from "../tickets/transport.mts";
import type { NewApp } from "./types.mts";

const API = "https://api.github.com";
const SITE = "https://github.com";
const FACTORY = `${SITE}/kodor-ai/kodor`;
/** The longest name GitHub gives an app. */
const NAME_LIMIT = 34;
/** Where GitHub sends the browser back to, on the listener. */
const RETURN = "/registered";

/** The app's name for an organization, cut to GitHub's limit. */
export function appName(organization: string): {
  name: string;
  shortened: boolean;
} {
  const name = `kodor-${organization.toLowerCase()}`;
  return name.length <= NAME_LIMIT
    ? { name, shortened: false }
    : { name: name.slice(0, NAME_LIMIT).trimEnd(), shortened: true };
}

/** What the form registers: an app only its owner can install, with no
 * webhook, that may do what a build, the board, and the poller do. */
export const manifestOf = (name: string, redirect: string) => ({
  name,
  url: FACTORY,
  hook_attributes: { url: FACTORY, active: false },
  redirect_url: redirect,
  public: false,
  default_permissions: {
    issues: "write",
    pull_requests: "write",
    contents: "write",
    statuses: "write",
    actions: "write",
    repository_custom_properties: "write",
    workflows: "write",
    organization_projects: "write",
    checks: "read",
  },
});

export type Reply = {
  status: number;
  headers?: Record<string, string>;
  body?: string;
};

/** Serves a browser on this machine: `handle` answers each request by its
 * path and query. */
export type Listen = (
  handle: (path: string) => Promise<Reply>,
) => Promise<{ origin: string; close(): Promise<void> }>;

/** A listener on 127.0.0.1, at a port the system picks. Closing it sends
 * each answer already given before it drops the connections: the last
 * answer is the one that sends the browser on. */
export const listenLocally: Listen = (handle) =>
  new Promise((resolve, reject) => {
    const answering = new Set<Promise<void>>();
    const server = createServer((request, response) => {
      const sent = handle(request.url ?? "/")
        .catch((): Reply => ({ status: 500 }))
        .then(
          (reply) =>
            new Promise<void>((done) => {
              response.once("close", done);
              response.writeHead(reply.status, reply.headers);
              response.end(reply.body ?? "");
            }),
        )
        .catch(() => response.destroy())
        .then(() => void answering.delete(sent));
      answering.add(sent);
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: async () => {
          const closed = new Promise<void>((done) =>
            server.close(() => done()),
          );
          await Promise.all(answering);
          server.closeAllConnections();
          await closed;
        },
      });
    });
  });

const escaped = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");

const page = (body: string): Reply => ({
  status: 200,
  headers: { "content-type": "text/html; charset=utf-8" },
  body: `<!doctype html><meta charset="utf-8"><title>kodor</title>${body}`,
});

/** The page that sends the manifest to GitHub's form as soon as it opens. */
const formPage = (organization: string, state: string, manifest: object) =>
  page(
    `<form id="app" action="${SITE}/organizations/${organization}/settings/apps/new?state=${encodeURIComponent(state)}" method="post">` +
      `<input type="hidden" name="manifest" value="${escaped(JSON.stringify(manifest))}">` +
      `<button>Continue to GitHub</button></form>` +
      `<script>document.getElementById("app").submit()</script>`,
  );

/** The code in the address GitHub sent the browser back to, or null for
 * an address that is not this run's. */
function codeIn(address: string, state: string): string | null {
  let url: URL;
  try {
    url = new URL(address.trim(), "http://127.0.0.1");
  } catch {
    return null;
  }
  if (url.searchParams.get("state") !== state) return null;
  return url.searchParams.get("code") || null;
}

async function call<T>(
  f: typeof fetch,
  o: {
    method: "GET" | "POST";
    path: string;
    bearer?: string;
    body?: object;
    what: string;
  },
): Promise<T> {
  const response = await f(`${API}/${o.path}`, {
    method: o.method,
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "kodor",
      ...(o.bearer ? { Authorization: `Bearer ${o.bearer}` } : {}),
      ...(o.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(o.body ? { body: JSON.stringify(o.body) } : {}),
  });
  const body = (await response.json().catch(() => ({}))) as T & {
    message?: string;
  };
  if (!response.ok) {
    const reason = body.message ?? response.statusText;
    throw new HttpError(
      response.status,
      `${o.what}: ${reason} (HTTP ${response.status})`,
      reason,
    );
  }
  return body;
}

/** Registers the app: serves the form, opens it, takes the code from
 * GitHub's return to the listener or from a pasted address, whichever
 * comes first, and trades it for the app. `keep` has the app before the
 * browser is sent on to `installPage`. */
export async function register(o: {
  organization: string;
  name: string;
  /** Sent with the form and checked on the way back. */
  state: string;
  listen: Listen;
  fetch: typeof fetch;
  open(page: string): void;
  /** Reads a pasted address, again when the one before was not this
   * run's. Rejects once `signal` stops it. */
  pasted(signal: AbortSignal, again: boolean): Promise<string>;
  keep(app: NewApp): Promise<void>;
  installPage(app: Omit<NewApp, "key">): string;
}): Promise<Omit<NewApp, "key">> {
  let returned!: (got: { code: string; answer(reply: Reply): void }) => void;
  const fromBrowser = new Promise<{
    code: string;
    answer?(reply: Reply): void;
  }>((resolve) => (returned = resolve));
  let taken = false;
  const server = await o.listen(async (path) => {
    const url = new URL(path, "http://127.0.0.1");
    if (url.pathname === "/")
      return formPage(
        o.organization,
        o.state,
        manifestOf(o.name, `${server.origin}${RETURN}`),
      );
    if (url.pathname !== RETURN) return { status: 404 };
    const code = codeIn(path, o.state);
    if (!code || taken)
      return {
        status: 400,
        body: "This page is not for the setup that is running. Go back to the terminal.",
      };
    taken = true;
    return new Promise<Reply>((answer) => returned({ code, answer }));
  });
  const stop = new AbortController();
  try {
    o.open(`${server.origin}/`);
    const typed = (async () => {
      for (let again = false; ; again = true) {
        const code = codeIn(await o.pasted(stop.signal, again), o.state);
        if (code) return { code };
      }
    })();
    // A prompt that ends without an address leaves the browser's return.
    const got = await Promise.race([
      fromBrowser,
      typed.catch(() => fromBrowser),
    ]);
    taken = true;
    stop.abort();
    const answer = "answer" in got ? got.answer : undefined;
    try {
      const made = await call<{
        id: number;
        slug: string;
        client_id: string;
        pem: string;
      }>(o.fetch, {
        method: "POST",
        path: `app-manifests/${got.code}/conversions`,
        what: "GitHub refused the code",
      });
      const app = { id: made.id, slug: made.slug, clientId: made.client_id };
      await o.keep({ ...app, key: made.pem });
      const install = o.installPage(app);
      if (answer) answer({ status: 302, headers: { location: install } });
      else o.open(install);
      return app;
    } catch (e) {
      answer?.({
        status: 500,
        body: "The setup could not finish. The terminal says why.",
      });
      throw e;
    }
  } finally {
    stop.abort();
    await server.close();
  }
}

const part = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

/** A token that says who the app is, signed with its key: GitHub takes it
 * for ten minutes at most, and from a clock up to a minute behind. */
export function appJwt(clientId: string, key: string, now: number): string {
  const at = Math.floor(now / 1000);
  const body = `${part({ alg: "RS256", typ: "JWT" })}.${part({ iss: clientId, iat: at - 60, exp: at + 540 })}`;
  return `${body}.${createSign("RSA-SHA256").update(body).sign(key, "base64url")}`;
}

/** How many repositories an installation covers, and whether one of that
 * name is among them, asked with a token of the installation's. */
export async function installed(o: {
  fetch: typeof fetch;
  now: () => number;
  installation: number;
  app: { clientId: string; key: string };
  repository: string;
}): Promise<{ count: number; covered: boolean }> {
  const { token } = await call<{ token: string }>(o.fetch, {
    method: "POST",
    path: `app/installations/${o.installation}/access_tokens`,
    bearer: appJwt(o.app.clientId, o.app.key, o.now()),
    what: "GitHub gave the app no token",
  });
  for (let page = 1, count = 0; ; page++) {
    const listed = await call<{
      total_count: number;
      repositories: { name: string }[];
    }>(o.fetch, {
      method: "GET",
      path: `installation/repositories?per_page=100&page=${page}`,
      bearer: token,
      what: "GitHub did not list the app's repositories",
    });
    if (page === 1) count = listed.total_count;
    if (listed.repositories.some((r) => r.name === o.repository))
      return { count, covered: true };
    if (listed.repositories.length < 100) return { count, covered: false };
  }
}

/** What the token of a job that prepares or publishes a session may do, of
 * what the app may: push a branch, work pull requests and tickets, start the
 * next run, and read a commit's statuses, its check runs, and a failed run.
 * It may not change a workflow's file, which the session's commits are
 * checked for too, or set a repository's properties, one of which turns on
 * the rule that requires the verdict. */
export const SESSION_PERMISSIONS = {
  contents: "write",
  pull_requests: "write",
  issues: "write",
  actions: "write",
  statuses: "read",
  checks: "read",
} as const;

/** The app's installation on a repository, or an error that says who adds
 * one. */
async function installationOf(
  fetcher: typeof fetch,
  bearer: string,
  repository: string,
): Promise<{ id: number }> {
  const owner = repository.slice(0, repository.lastIndexOf("/"));
  return call<{ id: number }>(fetcher, {
    method: "GET",
    path: `repos/${repository}/installation`,
    bearer,
    what: "GitHub did not say where the app is installed",
  }).catch((e) => {
    if (!(e instanceof HttpError) || e.status !== 404) throw e;
    throw new Error(
      `kodor's app for ${owner} is not installed on ${repository}. An owner of ${owner} adds it: ${SITE}/organizations/${owner}/settings/installations`,
    );
  });
}

/** The app's slug, and a session's token of its installation on the owner
 * of `repository`, an owner/name, for the repositories named, each of
 * that owner. GitHub takes the token for an hour. */
export async function runToken(o: {
  fetch: typeof fetch;
  now: () => number;
  app: { clientId: string; key: string };
  repository: string;
  repositories: string[];
}): Promise<{ token: string; slug: string }> {
  const bearer = appJwt(o.app.clientId, o.app.key, o.now());
  const installation = await installationOf(o.fetch, bearer, o.repository);
  const { slug } = await call<{ slug: string }>(o.fetch, {
    method: "GET",
    path: "app",
    bearer,
    what: "GitHub did not name the app",
  });
  const { token } = await call<{ token: string }>(o.fetch, {
    method: "POST",
    path: `app/installations/${installation.id}/access_tokens`,
    bearer,
    body: { repositories: o.repositories, permissions: SESSION_PERMISSIONS },
    what: "GitHub gave the app no token",
  });
  return { token, slug };
}

/** What a token may do in a repository that is not the run's own. */
export const ACROSS_PERMISSIONS = {
  read: { contents: "read", pull_requests: "read", issues: "read" },
  write: {
    contents: "read",
    pull_requests: "read",
    issues: "write",
    actions: "write",
  },
} as const;

/** A token of the app's for one other repository, and nothing else. */
export async function acrossToken(o: {
  fetch: typeof fetch;
  now: () => number;
  app: { clientId: string; key: string };
  repository: string;
  access: keyof typeof ACROSS_PERMISSIONS;
}): Promise<string> {
  const bearer = appJwt(o.app.clientId, o.app.key, o.now());
  const installation = await installationOf(o.fetch, bearer, o.repository);
  const { token } = await call<{ token: string }>(o.fetch, {
    method: "POST",
    path: `app/installations/${installation.id}/access_tokens`,
    bearer,
    body: {
      repositories: [o.repository.slice(o.repository.lastIndexOf("/") + 1)],
      permissions: ACROSS_PERMISSIONS[o.access],
    },
    what: "GitHub gave the app no token",
  });
  return token;
}

/** Signs the GitHub CLI in with a token, given on standard input so that
 * no list of processes shows it, and with `git` has git ask the CLI for
 * its credential from then on. The CLI refuses while a token is in its
 * environment. */
export async function signIn(
  token: string,
  o: { git: boolean },
  cli: {
    run(args: string[]): Promise<string>;
    runIn(args: string[], input: string): Promise<string>;
  },
): Promise<void> {
  await cli.runIn(
    ["auth", "login", "--with-token", "--insecure-storage"],
    token,
  );
  if (o.git) await cli.run(["auth", "setup-git"]);
}

export type Clock = { now(): number; sleep(ms: number): Promise<void> };

/** Looks every `everyMs` until something shows, for `forMs` at most. */
export async function waitFor<T>(
  look: () => Promise<T | null>,
  clock: Clock,
  everyMs = 3000,
  forMs = 10 * 60 * 1000,
): Promise<T | null> {
  const until = clock.now() + forMs;
  for (;;) {
    const found = await look();
    if (found !== null) return found;
    if (clock.now() >= until) return null;
    await clock.sleep(everyMs);
  }
}
