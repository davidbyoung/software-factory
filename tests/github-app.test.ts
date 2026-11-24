// Registering an organization's GitHub App from a manifest: the form, the
// code GitHub sends back, the token an app signs, and the wait for its
// installation. GitHub is a stubbed `fetch`, the clock is the test's own,
// and the one real listener is on 127.0.0.1, opened and closed here.
import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  appJwt,
  appName,
  installed,
  listenLocally,
  manifestOf,
  register,
  waitFor,
  type Reply,
} from "../src/code-host/github-app.mts";
import type { NewApp } from "../src/code-host/types.mts";

const STATE = "state-1";
const ORIGIN = "http://127.0.0.1:4100";
const INSTALL = "https://github.com/apps/software-factory-for-acme/install";
const PEM =
  "-----BEGIN RSA PRIVATE KEY-----\nkey\n-----END RSA PRIVATE KEY-----";
const CONVERTED = {
  id: 9,
  slug: "software-factory-for-acme",
  client_id: "Iv23client",
  pem: PEM,
  webhook_secret: null,
};

type Call = { url: string; method: string; auth: string | null };

/** A `fetch` that answers by the first route whose pattern matches the
 * method and address, and records each call. */
function github(routes: [RegExp, unknown, number?][]) {
  const calls: Call[] = [];
  const run = (async (input: unknown, init: RequestInit = {}) => {
    const url = String(input);
    const method = init.method ?? "GET";
    const headers = new Headers(init.headers);
    calls.push({ url, method, auth: headers.get("authorization") });
    const route = routes.find(([p]) => p.test(`${method} ${url}`));
    if (!route) throw new Error(`unexpected call: ${method} ${url}`);
    return new Response(JSON.stringify(route[1]), { status: route[2] ?? 200 });
  }) as typeof fetch;
  return { fetch: run, calls };
}

/** A listener that opens no port: the test plays the browser by calling
 * `visit` with a path. */
function listener() {
  let handle: ((path: string) => Promise<Reply>) | null = null;
  let closed = false;
  return {
    listen: async (h: (path: string) => Promise<Reply>) => {
      handle = h;
      return {
        origin: ORIGIN,
        close: async () => {
          closed = true;
        },
      };
    },
    visit: (path: string) => handle!(path),
    isClosed: () => closed,
  };
}

/** A registration against the stubs. Nothing is pasted unless `pasted`
 * is given: the prompt then waits until it is stopped. */
function registration(
  o: {
    routes?: [RegExp, unknown, number?][];
    pasted?: string[];
    keep?: (app: NewApp) => Promise<void>;
  } = {},
) {
  const l = listener();
  const g = github(
    o.routes ?? [[/POST .*\/app-manifests\/c1\/conversions$/, CONVERTED]],
  );
  const opened: string[] = [];
  const kept: NewApp[] = [];
  const asked: boolean[] = [];
  const queue = [...(o.pasted ?? [])];
  const result = register({
    organization: "acme",
    name: "Software Factory for acme",
    state: STATE,
    listen: l.listen,
    fetch: g.fetch,
    open: (page) => opened.push(page),
    pasted: (signal, again) => {
      asked.push(again);
      if (queue.length) return Promise.resolve(queue.shift()!);
      return new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(new Error("stopped"))),
      );
    },
    keep:
      o.keep ??
      (async (app) => {
        kept.push(app);
      }),
    installPage: () => INSTALL,
  });
  return { ...l, ...g, opened, kept, asked, result };
}

/** Waits until the registration has opened the browser. */
const untilOpen = async (r: { opened: string[] }) => {
  await expect.poll(() => r.opened.length).toBeGreaterThan(0);
};

describe("the app's name", () => {
  it("names the organization", () => {
    expect(appName("acme")).toEqual({
      name: "Software Factory for acme",
      shortened: false,
    });
  });

  it("is cut to the 34 characters GitHub allows", () => {
    const long = appName("a-very-long-organization-name");
    expect(long).toEqual({
      name: "Software Factory for a-very-long-o",
      shortened: true,
    });
    expect(long.name).toHaveLength(34);
    expect(appName("thirteen-char").shortened).toBe(false);
  });
});

describe("the manifest", () => {
  it("describes a private app with no webhook and the factory's permissions", () => {
    expect(
      manifestOf("Software Factory for acme", `${ORIGIN}/registered`),
    ).toEqual({
      name: "Software Factory for acme",
      url: "https://github.com/davidbyoung/software-factory",
      hook_attributes: {
        url: "https://github.com/davidbyoung/software-factory",
        active: false,
      },
      redirect_url: `${ORIGIN}/registered`,
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
      },
    });
  });
});

describe("registering the app", () => {
  it("opens a page of its own that posts the manifest to the organization's form", async () => {
    const r = registration();
    await untilOpen(r);
    expect(r.opened).toEqual([`${ORIGIN}/`]);
    const page = await r.visit("/");
    expect(page.status).toBe(200);
    expect(page.headers?.["content-type"]).toContain("text/html");
    expect(page.body).toContain(
      `action="https://github.com/organizations/acme/settings/apps/new?state=${STATE}"`,
    );
    expect(page.body).toContain('method="post"');
    const field = /name="manifest" value="([^"]*)"/.exec(page.body!)![1]!;
    const manifest = JSON.parse(
      field.replaceAll("&quot;", '"').replaceAll("&amp;", "&"),
    );
    expect(manifest.redirect_url).toBe(`${ORIGIN}/registered`);
    expect(manifest.name).toBe("Software Factory for acme");
    await r.visit(`/registered?code=c1&state=${STATE}`);
    await r.result;
  });

  it("trades the code GitHub sends back for the app, keeps it, then sends the browser to install it", async () => {
    const order: string[] = [];
    const r = registration({
      keep: async (app) => {
        order.push(`kept ${app.clientId}`);
        expect(app.key).toBe(PEM);
      },
    });
    await untilOpen(r);
    const reply = r.visit(`/registered?code=c1&state=${STATE}`).then((x) => {
      order.push("answered");
      return x;
    });
    expect(await r.result).toEqual({
      id: 9,
      slug: "software-factory-for-acme",
      clientId: "Iv23client",
    });
    expect(await reply).toEqual({
      status: 302,
      headers: { location: INSTALL },
    });
    expect(order).toEqual(["kept Iv23client", "answered"]);
    expect(r.calls).toEqual([
      {
        url: "https://api.github.com/app-manifests/c1/conversions",
        method: "POST",
        auth: null,
      },
    ]);
    // The browser was sent on by the redirect, so no second page opens.
    expect(r.opened).toHaveLength(1);
    expect(r.isClosed()).toBe(true);
  });

  it("refuses a return whose state is not this run's, and keeps waiting", async () => {
    const r = registration();
    await untilOpen(r);
    expect((await r.visit("/registered?code=c1&state=other")).status).toBe(400);
    expect((await r.visit("/registered?state=" + STATE)).status).toBe(400);
    expect(r.calls).toEqual([]);
    expect(r.isClosed()).toBe(false);
    await r.visit(`/registered?code=c1&state=${STATE}`);
    expect((await r.result).clientId).toBe("Iv23client");
  });

  it("takes the code from a pasted address, and opens the install page itself", async () => {
    const r = registration({
      pasted: [`${ORIGIN}/registered?code=c1&state=${STATE}`],
    });
    expect((await r.result).slug).toBe("software-factory-for-acme");
    expect(r.kept.map((a) => a.id)).toEqual([9]);
    expect(r.opened).toEqual([`${ORIGIN}/`, INSTALL]);
    expect(r.isClosed()).toBe(true);
  });

  it("asks for the address again when the pasted one carries another state", async () => {
    const r = registration({
      pasted: [
        `${ORIGIN}/registered?code=c1&state=other`,
        "not an address",
        `${ORIGIN}/registered?code=c1&state=${STATE}`,
      ],
    });
    await r.result;
    expect(r.asked).toEqual([false, true, true]);
    expect(r.calls).toHaveLength(1);
  });

  it("stops reading a pasted address once the browser returns", async () => {
    let stopped = false;
    const l = listener();
    const result = register({
      organization: "acme",
      name: "Software Factory for acme",
      state: STATE,
      listen: l.listen,
      fetch: github([[/conversions$/, CONVERTED]]).fetch,
      open: () => {},
      pasted: (signal) =>
        new Promise((_, reject) =>
          signal.addEventListener("abort", () => {
            stopped = true;
            reject(new Error("stopped"));
          }),
        ),
      keep: async () => {},
      installPage: () => INSTALL,
    });
    await expect.poll(() => l.visit("/").then((p) => p.status)).toBe(200);
    await l.visit(`/registered?code=c1&state=${STATE}`);
    await result;
    expect(stopped).toBe(true);
  });

  it("fails with GitHub's reason when it refuses the code, and tells the browser", async () => {
    const r = registration({
      routes: [[/conversions$/, { message: "Not Found" }, 404]],
    });
    await untilOpen(r);
    const reply = r.visit(`/registered?code=c1&state=${STATE}`);
    await expect(r.result).rejects.toThrow(
      "GitHub refused the code: Not Found",
    );
    expect((await reply).status).toBe(500);
    expect(r.kept).toEqual([]);
    expect(r.isClosed()).toBe(true);
  });

  it("fails, with the key in no message, when the app cannot be kept", async () => {
    const r = registration({
      keep: async () => {
        throw new Error("Could not store the key: HTTP 403");
      },
    });
    await untilOpen(r);
    const reply = r.visit(`/registered?code=c1&state=${STATE}`);
    const error = await r.result.catch((e: Error) => e);
    expect(String(error)).toContain("Could not store the key: HTTP 403");
    expect(String(error)).not.toContain("PRIVATE KEY");
    expect((await reply).body).not.toContain("PRIVATE KEY");
  });
});

describe("acting as the app", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const key = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
  const decode = (part: string) =>
    JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

  it("signs a token for the app that its public key verifies", () => {
    const now = Date.UTC(2026, 10, 23, 12, 0, 0);
    const [header, payload, signature] = appJwt("Iv23client", key, now).split(
      ".",
    ) as [string, string, string];
    expect(decode(header)).toEqual({ alg: "RS256", typ: "JWT" });
    expect(decode(payload)).toEqual({
      iss: "Iv23client",
      iat: now / 1000 - 60,
      exp: now / 1000 + 540,
    });
    expect(
      createVerify("RSA-SHA256")
        .update(`${header}.${payload}`)
        .verify(publicKey, signature, "base64url"),
    ).toBe(true);
  });

  it("counts an installation's repositories with a token made from the key", async () => {
    const page = (from: number, n: number) => ({
      total_count: 212,
      repositories: Array.from({ length: n }, (_, i) => ({
        name: `repo-${from + i}`,
      })),
    });
    const second = page(100, 100);
    second.repositories[40] = { name: "factory-config" };
    const g = github([
      [
        /POST .*\/app\/installations\/52811\/access_tokens$/,
        { token: "ghs_1" },
      ],
      [/installation\/repositories\?per_page=100&page=1$/, page(0, 100)],
      [/installation\/repositories\?per_page=100&page=2$/, second],
    ]);
    const answer = await installed({
      fetch: g.fetch,
      now: () => 0,
      installation: 52811,
      app: { clientId: "Iv23client", key },
      repository: "factory-config",
    });
    expect(answer).toEqual({ count: 212, covered: true });
    expect(g.calls[0]!.auth).toBe(`Bearer ${appJwt("Iv23client", key, 0)}`);
    expect(g.calls.slice(1).map((c) => c.auth)).toEqual([
      "Bearer ghs_1",
      "Bearer ghs_1",
    ]);
  });

  it("says a repository no page lists is not covered", async () => {
    const g = github([
      [/access_tokens$/, { token: "ghs_1" }],
      [
        /installation\/repositories/,
        { total_count: 2, repositories: [{ name: "web" }, { name: "api" }] },
      ],
    ]);
    expect(
      await installed({
        fetch: g.fetch,
        now: () => 0,
        installation: 1,
        app: { clientId: "Iv23client", key },
        repository: "factory-config",
      }),
    ).toEqual({ count: 2, covered: false });
  });

  it("fails with GitHub's reason when it refuses the app's token", async () => {
    const g = github([
      [/access_tokens$/, { message: "Integration not found" }, 404],
    ]);
    await expect(
      installed({
        fetch: g.fetch,
        now: () => 0,
        installation: 1,
        app: { clientId: "Iv23client", key },
        repository: "factory-config",
      }),
    ).rejects.toThrow("Integration not found");
  });
});

describe("waiting for an installation", () => {
  /** A clock that moves only when something sleeps. */
  const clock = () => {
    let at = 0;
    const slept: number[] = [];
    return {
      slept,
      now: () => at,
      sleep: async (ms: number) => {
        slept.push(ms);
        at += ms;
      },
    };
  };

  it("looks every 3 seconds until it shows", async () => {
    const c = clock();
    let looks = 0;
    const found = await waitFor(
      async () => (++looks === 3 ? "there" : null),
      c,
    );
    expect(found).toBe("there");
    expect(c.slept).toEqual([3000, 3000]);
  });

  it("gives up after 10 minutes", async () => {
    const c = clock();
    let looks = 0;
    const found = await waitFor(async () => {
      looks++;
      return null;
    }, c);
    expect(found).toBeNull();
    expect(c.now()).toBe(600_000);
    expect(looks).toBe(201);
  });
});

describe("the listener", () => {
  it("answers on 127.0.0.1 at a port of its own, until it is closed", async () => {
    const seen: string[] = [];
    const server = await listenLocally(async (path): Promise<Reply> => {
      seen.push(path);
      return path === "/go"
        ? { status: 302, headers: { location: "https://example.test/" } }
        : {
            status: 200,
            headers: { "content-type": "text/plain" },
            body: "hi",
          };
    });
    try {
      expect(server.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      const page = await fetch(`${server.origin}/registered?code=1`);
      expect(await page.text()).toBe("hi");
      const moved = await fetch(`${server.origin}/go`, { redirect: "manual" });
      expect(moved.status).toBe(302);
      expect(moved.headers.get("location")).toBe("https://example.test/");
      expect(seen).toEqual(["/registered?code=1", "/go"]);
    } finally {
      await server.close();
    }
    await expect(fetch(`${server.origin}/`)).rejects.toThrow();
  });
});
