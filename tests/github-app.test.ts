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
  runToken,
  SESSION_PERMISSIONS,
  signIn,
  waitFor,
  type Reply,
} from "../src/code-host/github-app.mts";
import {
  acrossGitEnv,
  acrossTransport,
  reachesOthers,
} from "../src/code-host/across.mts";
import type { NewApp } from "../src/code-host/types.mts";

const STATE = "state-1";
const ORIGIN = "http://127.0.0.1:4100";
const INSTALL = "https://github.com/apps/lunamill-acme/install";
const KEY_LINE = "MIIEowIBAAKCAQEAu1SU1LfVLPHCozMxH2Mo";
const PEM = `-----BEGIN RSA PRIVATE KEY-----\n${KEY_LINE}\n-----END RSA PRIVATE KEY-----`;
const CONVERTED = {
  id: 9,
  slug: "lunamill-acme",
  client_id: "Iv23client",
  pem: PEM,
  webhook_secret: null,
};

type Call = {
  url: string;
  method: string;
  auth: string | null;
  body: string | null;
};

/** A `fetch` that answers by the first route whose pattern matches the
 * method and address, and records each call. */
function github(routes: [RegExp, unknown, number?][]) {
  const calls: Call[] = [];
  const run = (async (input: unknown, init: RequestInit = {}) => {
    const url = String(input);
    const method = init.method ?? "GET";
    const headers = new Headers(init.headers);
    calls.push({
      url,
      method,
      auth: headers.get("authorization"),
      body: typeof init.body === "string" ? init.body : null,
    });
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
    name: "lunamill-acme",
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
      name: "lunamill-acme",
      shortened: false,
    });
  });

  it("is cut to the 34 characters GitHub allows", () => {
    const long = appName("a-very-long-organization-name");
    expect(long).toEqual({
      name: "lunamill-a-very-long-organization-",
      shortened: true,
    });
    expect(long.name).toHaveLength(34);
    expect(appName("thirteen-char").shortened).toBe(false);
  });
});

describe("the manifest", () => {
  it("describes a private app with no webhook and Lunamill's permissions", () => {
    expect(manifestOf("lunamill-acme", `${ORIGIN}/registered`)).toEqual({
      name: "lunamill-acme",
      url: "https://github.com/lunamill-ai/lunamill",
      hook_attributes: {
        url: "https://github.com/lunamill-ai/lunamill",
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
        checks: "read",
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
    expect(manifest.name).toBe("lunamill-acme");
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
      slug: "lunamill-acme",
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
        body: null,
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
    expect((await r.result).slug).toBe("lunamill-acme");
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
      name: "lunamill-acme",
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
    for (const part of ["PRIVATE KEY", KEY_LINE]) {
      expect(String(error)).not.toContain(part);
      expect((await reply).body).not.toContain(part);
    }
  });
});

describe("registering the app, on its real listener", () => {
  /** A registration that listens on 127.0.0.1, with nothing pasted, and
   * the listener's address once it has opened its page. */
  async function listening(routes: [RegExp, unknown, number?][]) {
    const opened: string[] = [];
    const kept: string[] = [];
    const result = register({
      organization: "acme",
      name: "lunamill-acme",
      state: STATE,
      listen: listenLocally,
      fetch: github(routes).fetch,
      open: (page) => opened.push(page),
      pasted: (signal) =>
        new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(new Error("stopped"))),
        ),
      keep: async (app) => {
        kept.push(app.clientId);
      },
      installPage: () => INSTALL,
    });
    // A refusal is read by the test that expects one.
    result.catch(() => {});
    await expect.poll(() => opened.length).toBe(1);
    return { origin: opened[0]!.replace(/\/$/, ""), kept, result };
  }

  it("stays up across a browser's requests, answers GitHub's return with the install page, then closes", async () => {
    const r = await listening([[/conversions$/, CONVERTED]]);
    expect((await fetch(`${r.origin}/`)).status).toBe(200);
    expect((await fetch(`${r.origin}/favicon.ico`)).status).toBe(404);
    expect((await fetch(`${r.origin}/`)).status).toBe(200);
    const back = await fetch(`${r.origin}/registered?code=c1&state=${STATE}`, {
      redirect: "manual",
    });
    expect(back.status).toBe(302);
    expect(back.headers.get("location")).toBe(INSTALL);
    expect((await r.result).clientId).toBe("Iv23client");
    expect(r.kept).toEqual(["Iv23client"]);
    await expect(fetch(`${r.origin}/`)).rejects.toThrow();
  });

  it("answers GitHub's return with a page that says so when the setup could not finish", async () => {
    const r = await listening([
      [/conversions$/, { message: "Not Found" }, 404],
    ]);
    const back = await fetch(`${r.origin}/registered?code=c1&state=${STATE}`);
    expect(back.status).toBe(500);
    expect(await back.text()).toBe(
      "The setup could not finish. The terminal says why.",
    );
    await expect(r.result).rejects.toThrow("GitHub refused the code");
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
    second.repositories[40] = { name: "lunamill-config" };
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
      repository: "lunamill-config",
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
        repository: "lunamill-config",
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
        repository: "lunamill-config",
      }),
    ).rejects.toThrow("Integration not found");
  });
});

describe("a run's token under the app", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const key = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
  const app = { clientId: "Iv23client", key };
  const NOW = Date.UTC(2026, 10, 23, 12, 0, 0);
  const ask = (
    routes: [RegExp, unknown, number?][],
    repositories = ["web"],
  ) => {
    const g = github(routes);
    const made = runToken({
      fetch: g.fetch,
      now: () => NOW,
      app,
      repository: "acme/web",
      repositories,
    });
    return { made, calls: g.calls };
  };
  const FOUND: [RegExp, unknown, number?][] = [
    [/GET .*\/repos\/acme\/web\/installation$/, { id: 52811 }],
    [/GET .*\/app$/, { slug: "lunamill-acme" }],
  ];

  it("finds the installation on the run's repository as the app, and makes a token for the repositories named", async () => {
    const { made, calls } = ask(
      [
        ...FOUND,
        [
          /POST .*\/app\/installations\/52811\/access_tokens$/,
          { token: "ghs_run" },
        ],
      ],
      ["web", "lunamill-config"],
    );

    expect(await made).toEqual({
      token: "ghs_run",
      slug: "lunamill-acme",
    });
    const signed = `Bearer ${appJwt("Iv23client", key, NOW)}`;
    expect(calls.map((c) => c.auth)).toEqual([signed, signed, signed]);
    const token = calls.find((c) => c.method === "POST")!;
    expect(JSON.parse(token.body!).repositories).toEqual([
      "web",
      "lunamill-config",
    ]);
  });

  it("asks for what a session's jobs do and no more: never a workflow's file, nor a repository's properties, which switch the rule that gates it", async () => {
    const { made, calls } = ask([
      ...FOUND,
      [/access_tokens$/, { token: "ghs_run" }],
    ]);
    await made;

    const { permissions } = JSON.parse(
      calls.find((c) => c.method === "POST")!.body!,
    ) as { permissions: Record<string, string> };
    expect(permissions).toEqual({
      contents: "write",
      pull_requests: "write",
      issues: "write",
      actions: "write",
      statuses: "read",
      checks: "read",
    });
    expect(permissions).not.toHaveProperty("repository_custom_properties");
    expect(SESSION_PERMISSIONS).toEqual(permissions);
  });

  it("asks for nothing the app's registration does not hold", () => {
    const held: Record<string, string> = manifestOf(
      "lunamill-acme",
      "http://127.0.0.1/registered",
    ).default_permissions;

    for (const [name, level] of Object.entries(SESSION_PERMISSIONS)) {
      expect(held, name).toHaveProperty(name);
      if (level === "write") expect(held[name], name).toBe("write");
    }
  });

  it("says who installs the app when it is not installed on the repository, and asks for no token", async () => {
    const { made, calls } = ask([
      [/\/repos\/acme\/web\/installation$/, { message: "Not Found" }, 404],
    ]);

    await expect(made).rejects.toThrow(
      /^Lunamill's app for acme is not installed on acme\/web\. An owner of acme adds it: https:\/\/github\.com\/organizations\/acme\/settings\/installations$/,
    );
    expect(calls.map((c) => c.method)).toEqual(["GET"]);
  });

  it("fails with GitHub's reason when the installation does not cover a repository named", async () => {
    const { made } = ask(
      [
        ...FOUND,
        [
          /access_tokens$/,
          { message: "There is at least one repository that does not exist" },
          422,
        ],
      ],
      ["web", "styles"],
    );

    await expect(made).rejects.toThrow(
      "GitHub gave the app no token: There is at least one repository that does not exist (HTTP 422)",
    );
  });

  it("fails with GitHub's reason, and not as a missing installation, when it refuses the key", async () => {
    const { made } = ask([
      [/installation$/, { message: "Bad credentials" }, 401],
    ]);

    await expect(made).rejects.toThrow("Bad credentials (HTTP 401)");
  });

  it.each<[string, [RegExp, unknown, number?][]]>([
    [
      "the app is not installed",
      [[/installation$/, { message: "Not Found" }, 404]],
    ],
    [
      "GitHub refuses the key",
      [[/installation$/, { message: "Bad credentials" }, 401]],
    ],
    [
      "GitHub gives no token",
      [...FOUND, [/access_tokens$/, { message: "Server Error" }, 500]],
    ],
  ])(
    "names no line of the key, and no signature of the app's, in its failure when %s",
    async (_, routes) => {
      const { made, calls } = ask(routes);

      const error = String(await made.catch((e: Error) => e));
      expect(calls[0]!.auth).toMatch(/^Bearer \S+$/);
      for (const secret of [
        key.split("\n")[2]!,
        ...calls.map((c) => c.auth!.replace("Bearer ", "")),
      ])
        expect(error).not.toContain(secret);
    },
  );
});

describe("signing the GitHub CLI in with a token", () => {
  /** A CLI that records each call: its arguments, and what it was given
   * on standard input. */
  const cli = () => {
    const calls: { args: string[]; input: string | null }[] = [];
    return {
      calls,
      run: async (args: string[]) => {
        calls.push({ args, input: null });
        return "";
      },
      runIn: async (args: string[], input: string) => {
        calls.push({ args, input });
        return "";
      },
    };
  };

  it("gives the token on standard input, never as an argument, then has git ask the CLI", async () => {
    const c = cli();

    await signIn("ghs_run", { git: true }, c);

    expect(c.calls).toEqual([
      {
        args: ["auth", "login", "--with-token", "--insecure-storage"],
        input: "ghs_run",
      },
      { args: ["auth", "setup-git"], input: null },
    ]);
  });

  it("leaves git's settings alone when asked to", async () => {
    const c = cli();

    await signIn("ghs_next", { git: false }, c);

    expect(c.calls.map((call) => call.args[1])).toEqual(["login"]);
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

describe("a token for another of a ticket's repositories", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs1", format: "pem" }) as string;
  const APP = {
    LUNAMILL_APP_CLIENT_ID: "Iv23x",
    LUNAMILL_APP_PRIVATE_KEY: pem,
  };
  const routes: Parameters<typeof github>[0] = [
    [/GET .*\/repos\/acme\/\w+\/installation$/, { id: 7 }],
    [/POST .*\/access_tokens$/, { token: "ghs_x" }],
    [/GET .*\/repos\/acme\//, { private: true }],
  ];
  const now = () => Date.parse("2026-11-25T12:00:00Z");
  const asked = (calls: Call[]) =>
    calls
      .filter((c) => c.url.endsWith("/access_tokens"))
      .map((c) => JSON.parse(c.body!));

  it("is for that repository alone, and may write its tickets and start its runs", async () => {
    const g = github(routes);
    await acrossTransport("acme/one", "write", APP, { fetch: g.fetch, now });
    expect(asked(g.calls)).toEqual([
      {
        repositories: ["one"],
        permissions: {
          contents: "read",
          pull_requests: "read",
          issues: "write",
          actions: "write",
        },
      },
    ]);
  });

  it("only reads in a step that only reads, whatever its code asks for", async () => {
    const g = github(routes);
    await acrossTransport(
      "acme/two",
      "write",
      { ...APP, LUNAMILL_ACROSS: "read" },
      { fetch: g.fetch, now },
    );
    expect(asked(g.calls)[0].permissions).toEqual({
      contents: "read",
      pull_requests: "read",
      issues: "read",
    });
  });

  it("is made once, and again before it runs out", async () => {
    const g = github(routes);
    const at = (minutes: number) =>
      acrossTransport("acme/three", "write", APP, {
        fetch: g.fetch,
        now: () => now() + minutes * 60_000,
      });
    await at(0);
    await at(40);
    expect(asked(g.calls)).toHaveLength(1);
    await at(46);
    expect(asked(g.calls)).toHaveLength(2);
  });

  it("is what the repository is reached with", async () => {
    const g = github(routes);
    const t = await acrossTransport("acme/four", "read", APP, {
      fetch: g.fetch,
      now,
    });
    await t!.rest("GET", "repos/acme/four");
    expect(g.calls.at(-1)!.auth).toBe("Bearer ghs_x");
  });

  it("says where the app is not installed", async () => {
    const g = github([[/installation$/, {}, 404]]);
    await expect(
      acrossTransport("acme/five", "read", APP, { fetch: g.fetch, now }),
    ).rejects.toThrow("Lunamill's app for acme is not installed on acme/five");
  });

  it("is the build token where no app's key reaches the run, and none with neither", async () => {
    const g = github(routes);
    const env = { LUNAMILL_BUILD_TOKEN: "ghp_b" };
    const t = await acrossTransport("acme/six", "write", env, {
      fetch: g.fetch,
      now,
    });
    await t!.rest("GET", "repos/acme/six");
    expect(g.calls.map((c) => c.auth)).toEqual(["Bearer ghp_b"]);
    expect(await acrossTransport("acme/six", "write", {})).toBeNull();
    expect(reachesOthers({})).toBe(false);
    expect(reachesOthers(env)).toBe(true);
    expect(reachesOthers(APP)).toBe(true);
    expect(reachesOthers({ LUNAMILL_APP_CLIENT_ID: "x" })).toBe(false);
  });
});

describe("git's sign-in to another repository", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs1", format: "pem" }) as string;

  it("is the token in a header, and no helper that could answer instead", async () => {
    const g = github([
      [/installation$/, { id: 7 }],
      [/access_tokens$/, { token: "ghs_git" }],
    ]);
    const env = await acrossGitEnv(
      "acme/git",
      { LUNAMILL_APP_CLIENT_ID: "I", LUNAMILL_APP_PRIVATE_KEY: pem },
      { fetch: g.fetch, now: () => 0 },
    );
    expect(env).toEqual({
      GIT_CONFIG_COUNT: "2",
      GIT_CONFIG_KEY_0: "credential.helper",
      GIT_CONFIG_VALUE_0: "",
      GIT_CONFIG_KEY_1: "http.https://github.com/.extraheader",
      GIT_CONFIG_VALUE_1: `AUTHORIZATION: basic ${Buffer.from("x-access-token:ghs_git").toString("base64")}`,
    });
    expect(
      Object.values(JSON.parse(g.calls.at(-1)!.body!).permissions),
    ).not.toContain("write");
  });

  it("is the machine's or the job's own where no token is made", async () => {
    expect(await acrossGitEnv("acme/git", {})).toEqual({});
  });
});
