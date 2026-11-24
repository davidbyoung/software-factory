#!/usr/bin/env node
// The sign-in an unattended session works with under an organization's own
// app, for the workflow that runs the session.
//
//   factory session token          # sign in once
//   factory session token --keep   # then again every 45 minutes
//
// A token of the app's lasts an hour, and a session runs for longer. So the
// session holds no token: the code host's CLI is signed in with one, git
// asks the CLI, and a `--keep` left running behind the session signs the
// CLI in again before each token runs out. The first sign-in is the run
// without `--keep`, which fails where the app is not installed and writes
// `slug=` and the app's slug to GITHUB_OUTPUT.
//
// The app's client ID and key are read from FACTORY_APP_CLIENT_ID and
// FACTORY_APP_PRIVATE_KEY. Neither the key nor a token is printed, and a
// token reaches the CLI on standard input alone.
import { appendFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { runToken, signIn } from "./code-host/index.mts";
import { APP_CLIENT_ID } from "./init-org.mts";
import { APP_KEY } from "./parts.mts";
import { gh, ghIn, type Gh, type GhIn } from "./lib/gh.mts";

/** A token is renewed with a quarter of its hour left, and a renewal that
 * fails is tried again each minute of it. */
const RENEW_MS = 45 * 60 * 1000;
const RETRY_MS = 60 * 1000;

export type World = {
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
  clock: { now(): number; sleep(ms: number): Promise<void> };
  cli: { run: Gh; runIn: GhIn };
  /** The run's repository, as owner/name. */
  repository: string;
  /** The repositories each token is for, by name, as the checkout named
   * them when the command started: a session moves the checkout on. */
  repositories: string[];
  out(line: string): void;
  err(line: string): void;
  /** Hands a line to the workflow's later steps. */
  output(line: string): void;
  /** Whether `--keep` stops, asked after each wait: never, outside a test. */
  stopped?: () => boolean;
};

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** `factory session token [--keep]`. */
export async function main(argv: string[], w: World): Promise<number> {
  const clientId = w.env[APP_CLIENT_ID];
  const key = w.env[APP_KEY];
  if (!clientId || !key) {
    w.out(
      `::error::${APP_CLIENT_ID} and ${APP_KEY} do not both reach this step.`,
    );
    return 1;
  }
  const signInAgain = async (git: boolean) => {
    const made = await runToken({
      fetch: w.fetch,
      now: w.clock.now,
      app: { clientId, key },
      repository: w.repository,
      repositories: w.repositories,
    });
    await signIn(made.token, { git }, w.cli);
    return made.slug;
  };

  if (!argv.includes("--keep")) {
    try {
      const slug = await signInAgain(true);
      w.output(`slug=${slug}`);
      w.out(`Signed the GitHub CLI and git in as ${slug}[bot].`);
      return 0;
    } catch (error) {
      w.out(`::error::${message(error)}`);
      return 1;
    }
  }

  const stopped = w.stopped ?? (() => false);
  const at = () => new Date(w.clock.now()).toISOString();
  for (;;) {
    await w.clock.sleep(RENEW_MS);
    for (let renewed = false; !renewed && !stopped();) {
      try {
        await signInAgain(false);
        renewed = true;
        w.out(`${at()} Renewed the app's token.`);
      } catch (error) {
        w.err(
          `${at()} Could not renew the app's token: ${message(error)}. Trying again in a minute.`,
        );
        await w.clock.sleep(RETRY_MS);
      }
    }
    if (stopped()) return 0;
  }
}

/** The command in a workflow's step, with the real clock, network, and
 * CLI. */
export async function run(argv: string[]): Promise<number> {
  const env = process.env;
  const { reachOf } = await import("./config.mts");
  const { repositories } = await import("./session.mts");
  return main(argv, {
    env,
    fetch,
    clock: { now: Date.now, sleep: async (ms) => void (await sleep(ms)) },
    cli: { run: gh, runIn: ghIn },
    repository: (await reachOf(env)).repository,
    repositories: (await repositories(env)).split(","),
    out: (line) => console.log(line),
    err: (line) => console.error(line),
    output: (line) => {
      if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `${line}\n`);
    },
  });
}
