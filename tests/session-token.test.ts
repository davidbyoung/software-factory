// The sign-in a session works with under an organization's app: a first
// token, then a new one every 45 minutes for as long as the session runs.
// GitHub is a stubbed `fetch`, the GitHub CLI records what it is given, and
// the clock is the test's own, so nothing waits and nothing leaves the
// machine.
import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appJwt } from "../src/code-host/github-app.mts";
import { main, type World } from "../src/session-token.mts";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const KEY = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
const NOW = Date.UTC(2026, 10, 23, 12, 0, 0);
const MINUTE = 60 * 1000;
const NOT_INSTALLED =
  "The software factory's app for acme is not installed on acme/web. An owner of acme adds it: https://github.com/organizations/acme/settings/installations";

type Answer = { status: number; body: unknown };
const ok = (body: unknown): Answer => ({ status: 200, body });

/** A run of the command in a world of the test's own. GitHub hands out
 * `tokens` in turn, each an answer to the request for a token, and the
 * clock moves only when the command sleeps: after `sleeps` of them it is
 * told to stop. */
function world(
  o: {
    env?: Record<string, string>;
    installation?: Answer;
    tokens?: Answer[];
    /** What the CLI fails its sign-ins with, in turn: null to succeed. */
    cli?: (string | null)[];
    sleeps?: number;
  } = {},
) {
  let now = NOW;
  const slept: number[] = [];
  const tokens = [...(o.tokens ?? [ok({ token: "ghs_1" })])];
  const handed: string[] = [];
  const refusals = [...(o.cli ?? [])];
  const asked: { url: string; auth: string | null; body: string | null }[] = [];
  const cli: { args: string[]; input: string | null }[] = [];
  const out: string[] = [];
  const err: string[] = [];
  const output: string[] = [];
  const answer = (url: string): Answer => {
    if (url.endsWith("/repos/acme/web/installation"))
      return o.installation ?? ok({ id: 52811 });
    if (url.endsWith("/app")) return ok({ slug: "software-factory-for-acme" });
    if (url.endsWith("/app/installations/52811/access_tokens")) {
      const next = tokens.shift() ?? ok({ token: "ghs_last" });
      const { token } = next.body as { token?: string };
      if (token) handed.push(token);
      return next;
    }
    throw new Error(`unexpected call: ${url}`);
  };
  const w: World = {
    env: {
      FACTORY_APP_CLIENT_ID: "Iv23client",
      FACTORY_APP_PRIVATE_KEY: KEY,
      ...o.env,
    },
    fetch: (async (input: unknown, init: RequestInit = {}) => {
      const url = String(input);
      asked.push({
        url,
        auth: new Headers(init.headers).get("authorization"),
        body: typeof init.body === "string" ? init.body : null,
      });
      const { status, body } = answer(url);
      return new Response(JSON.stringify(body), { status });
    }) as typeof fetch,
    clock: { now: () => now },
    cli: {
      run: async (args) => {
        cli.push({ args, input: null });
        return "";
      },
      runIn: async (args, input) => {
        cli.push({ args, input });
        const refusal = refusals.shift();
        if (refusal) throw new Error(refusal);
        return "";
      },
    },
    repository: "acme/web",
    repositories: ["web", "factory-config"],
    out: (line) => out.push(line),
    output: (line) => output.push(line),
  };
  /** Everything the command printed, handed to a later step, or gave the
   * CLI as an argument. */
  const shown = () =>
    [...out, ...output, ...cli.flatMap((c) => c.args)].join("\n");
  /** What must never be shown: each token GitHub handed out, a line of the
   * key, and each token the app signed to say who it is. */
  const secrets = () => [
    ...handed,
    KEY.split("\n")[2]!,
    ...asked.map((call) => call.auth!.replace("Bearer ", "")),
  ];
  return { w, slept, asked, cli, out, err, output, shown, secrets };
}

/** The tokens the CLI was signed in with, in order. */
const signedIn = (cli: { args: string[]; input: string | null }[]) =>
  cli.filter((c) => c.args[1] === "login").map((c) => c.input);

describe("factory session token", () => {
  it("signs the GitHub CLI and git in with a token for the run's repositories, and names the app's bot for a later step", async () => {
    const t = world();

    expect(await main(t.w)).toBe(0);

    const asked = JSON.parse(t.asked.at(-1)!.body!) as {
      repositories: string[];
      permissions: Record<string, string>;
    };
    expect(asked.repositories).toEqual(["web", "factory-config"]);
    expect(asked.permissions).toMatchObject({ contents: "write" });
    expect(asked.permissions).not.toHaveProperty(
      "repository_custom_properties",
    );
    expect(t.cli.map((c) => c.args.slice(0, 2).join(" "))).toEqual([
      "auth login",
      "auth setup-git",
    ]);
    expect(signedIn(t.cli)).toEqual(["ghs_1"]);
    expect(t.output).toEqual(["slug=software-factory-for-acme"]);
    expect(t.out).toEqual([
      "Signed the GitHub CLI and git in as software-factory-for-acme[bot].",
    ]);
    expect(t.slept).toEqual([]);
  });

  it("fails with the line that says who installs the app, and signs nobody in, where it is not installed", async () => {
    const t = world({
      installation: { status: 404, body: { message: "Not Found" } },
    });

    expect(await main(t.w)).toBe(1);

    expect(t.out).toEqual([`::error::${NOT_INSTALLED}`]);
    expect(t.cli).toEqual([]);
    expect(t.output).toEqual([]);
  });

  it("fails with the CLI's reason, and names no bot, when the sign-in is refused", async () => {
    const t = world({ cli: ["gh auth login: a token is in the environment"] });

    expect(await main(t.w)).toBe(1);

    expect(t.out).toEqual([
      "::error::gh auth login: a token is in the environment",
    ]);
    expect(t.output).toEqual([]);
  });

  it.each([
    ["the client ID", { FACTORY_APP_CLIENT_ID: "" }],
    ["the key", { FACTORY_APP_PRIVATE_KEY: "" }],
  ])("fails, asking GitHub nothing, without %s", async (_, env) => {
    const t = world({ env });

    expect(await main(t.w)).toBe(1);

    expect(t.out).toEqual([
      "::error::FACTORY_APP_CLIENT_ID and FACTORY_APP_PRIVATE_KEY do not both reach this step.",
    ]);
    expect(t.asked).toEqual([]);
  });
});

describe("what the command prints, hands to a later step, and gives the CLI as arguments", () => {
  it.each<[string, Parameters<typeof world>[0]]>([
    ["signs in", {}],
    [
      "finds the app not installed",
      { installation: { status: 404, body: { message: "Not Found" } } },
    ],
    [
      "is refused by GitHub",
      { installation: { status: 401, body: { message: "Bad credentials" } } },
    ],
    ["is refused by the CLI", { cli: ["gh auth login: refused"] }],
  ])(
    "holds no token, no line of the key, and no signature of the app's when it %s",
    async (_, o) => {
      const t = world(o);

      await main(t.w);

      expect(t.secrets().length).toBeGreaterThan(1);
      for (const secret of t.secrets()) expect(t.shown()).not.toContain(secret);
    },
  );
});

// The command itself: with no key in its environment it stops before it
// asks GitHub anything, so it runs with no network.
describe("factory session token, as the workflow's step runs it", () => {
  const CLI = join(import.meta.dirname, "..", "bin", "factory.js");

  it("fails with one line when the app's key does not reach it", () => {
    const r = spawnSync("node", [CLI, "session", "token"], {
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_REPOSITORY: "acme/web",
        FACTORY_APP_CLIENT_ID: "Iv23client",
        FACTORY_APP_PRIVATE_KEY: "",
      },
    });

    expect({ code: r.status, out: r.stdout, err: r.stderr }).toEqual({
      code: 1,
      out: "::error::FACTORY_APP_CLIENT_ID and FACTORY_APP_PRIVATE_KEY do not both reach this step.\n",
      err: "",
    });
  });
});
