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
    if (url.endsWith("/app/installations/52811/access_tokens"))
      return tokens.shift() ?? ok({ token: "ghs_last" });
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
    clock: {
      now: () => now,
      sleep: async (ms) => {
        slept.push(ms);
        now += ms;
      },
    },
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
    err: (line) => err.push(line),
    output: (line) => output.push(line),
    stopped: () => slept.length >= (o.sleeps ?? 0),
  };
  /** Everything the command printed or handed to a later step. */
  const said = () => [...out, ...err, ...output].join("\n");
  return { w, slept, asked, cli, out, err, output, said };
}

/** The tokens the CLI was signed in with, in order. */
const signedIn = (cli: { args: string[]; input: string | null }[]) =>
  cli.filter((c) => c.args[1] === "login").map((c) => c.input);

describe("factory session token", () => {
  it("signs the GitHub CLI and git in with a token for the run's repositories, and names the app's bot for a later step", async () => {
    const t = world();

    expect(await main([], t.w)).toBe(0);

    expect(JSON.parse(t.asked.at(-1)!.body!)).toEqual({
      repositories: ["web", "factory-config"],
    });
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

  it("gives the token to the CLI on standard input alone, and prints neither it nor the key", async () => {
    const t = world();

    await main([], t.w);

    expect(JSON.stringify(t.cli.map((c) => c.args))).not.toContain("ghs_1");
    expect(t.said()).not.toContain("ghs_1");
    expect(t.said()).not.toContain("PRIVATE KEY");
  });

  it("fails with the line that says who installs the app, and signs nobody in, where it is not installed", async () => {
    const t = world({
      installation: { status: 404, body: { message: "Not Found" } },
    });

    expect(await main([], t.w)).toBe(1);

    expect(t.out).toEqual([`::error::${NOT_INSTALLED}`]);
    expect(t.cli).toEqual([]);
    expect(t.output).toEqual([]);
  });

  it("fails with the CLI's reason, and names no bot, when the sign-in is refused", async () => {
    const t = world({ cli: ["gh auth login: a token is in the environment"] });

    expect(await main([], t.w)).toBe(1);

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

    expect(await main([], t.w)).toBe(1);

    expect(t.out).toEqual([
      "::error::FACTORY_APP_CLIENT_ID and FACTORY_APP_PRIVATE_KEY do not both reach this step.",
    ]);
    expect(t.asked).toEqual([]);
  });
});

describe("factory session token --keep", () => {
  it("signs the CLI in again every 45 minutes with a new token, signed for as the app at that time, and leaves git's settings alone", async () => {
    const t = world({
      tokens: [ok({ token: "ghs_2" }), ok({ token: "ghs_3" })],
      sleeps: 3,
    });

    await main(["--keep"], t.w);

    expect(t.slept).toEqual([45 * MINUTE, 45 * MINUTE, 45 * MINUTE]);
    expect(signedIn(t.cli)).toEqual(["ghs_2", "ghs_3"]);
    expect(t.cli.map((c) => c.args[1])).toEqual(["login", "login"]);
    expect(t.asked[0]!.auth).toBe(
      `Bearer ${appJwt("Iv23client", KEY, NOW + 45 * MINUTE)}`,
    );
    expect(t.out).toEqual([
      "2026-11-23T12:45:00.000Z Renewed the app's token.",
      "2026-11-23T13:30:00.000Z Renewed the app's token.",
    ]);
    expect(t.err).toEqual([]);
  });

  it("makes no token before the first 45 minutes are up, since the run already holds one", async () => {
    const t = world({ sleeps: 1 });

    await main(["--keep"], t.w);

    expect(t.slept).toEqual([45 * MINUTE]);
    expect(t.asked).toEqual([]);
    expect(t.cli).toEqual([]);
  });

  it("says why a renewal failed on standard error, tries again each minute, and carries on once one works", async () => {
    const t = world({
      tokens: [
        { status: 502, body: { message: "Bad Gateway" } },
        ok({ token: "ghs_2" }),
        ok({ token: "ghs_3" }),
        ok({ token: "ghs_4" }),
      ],
      cli: ["gh auth login: connection reset"],
      sleeps: 4,
    });

    await main(["--keep"], t.w);

    expect(t.slept).toEqual([45 * MINUTE, MINUTE, MINUTE, 45 * MINUTE]);
    expect(t.err).toEqual([
      "2026-11-23T12:45:00.000Z Could not renew the app's token: GitHub gave the app no token: Bad Gateway (HTTP 502). Trying again in a minute.",
      "2026-11-23T12:46:00.000Z Could not renew the app's token: gh auth login: connection reset. Trying again in a minute.",
    ]);
    expect(t.out).toEqual([
      "2026-11-23T12:47:00.000Z Renewed the app's token.",
    ]);
    expect(signedIn(t.cli)).toEqual(["ghs_2", "ghs_3"]);
  });

  it("prints no token and no key, whether a renewal works or fails", async () => {
    const t = world({
      tokens: [ok({ token: "ghs_2" }), ok({ token: "ghs_3" })],
      cli: ["gh auth login: connection reset"],
      sleeps: 3,
    });

    await main(["--keep"], t.w);

    expect(t.said()).not.toMatch(/ghs_|PRIVATE KEY/);
    expect(JSON.stringify(t.cli.map((c) => c.args))).not.toContain("ghs_");
    expect(t.output).toEqual([]);
  });
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
