#!/usr/bin/env node
// The sign-in of a job under an organization's own app: the code host's CLI
// is signed in with a token of the app's, and git asks the CLI. No session
// runs in a job that does this.
//
//   factory session token
//
// It fails where the app is not installed, and writes `slug=` and the app's
// slug to GITHUB_OUTPUT. A token lasts an hour, so a job that waits for
// longer does this again.
//
// The app's client ID and key are read from FACTORY_APP_CLIENT_ID and
// FACTORY_APP_PRIVATE_KEY. Neither the key nor a token is printed, and a
// token reaches the CLI on standard input alone.
import { appendFileSync } from "node:fs";
import { runToken, signIn } from "./code-host/index.mts";
import { APP_CLIENT_ID } from "./init-org.mts";
import { APP_KEY } from "./parts.mts";
import { gh, ghIn, type Gh, type GhIn } from "./lib/gh.mts";
import * as say from "./lib/output.mts";

export type World = {
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
  clock: { now(): number };
  cli: { run: Gh; runIn: GhIn };
  /** The run's repository, as owner/name. */
  repository: string;
  /** The repositories each token is for, by name, as the checkout named
   * them when the command started: a session moves the checkout on. */
  repositories: string[];
  out(line: string): void;
  /** Hands a line to the workflow's later steps. */
  output(line: string): void;
};

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** `factory session token`. */
export async function main(w: World): Promise<number> {
  const clientId = w.env[APP_CLIENT_ID];
  const key = w.env[APP_KEY];
  if (!clientId || !key) {
    w.out(
      `::error::${APP_CLIENT_ID} and ${APP_KEY} do not both reach this step.`,
    );
    return 1;
  }
  try {
    const made = await runToken({
      fetch: w.fetch,
      now: w.clock.now,
      app: { clientId, key },
      repository: w.repository,
      repositories: w.repositories,
    });
    await signIn(made.token, { git: true }, w.cli);
    w.output(`slug=${made.slug}`);
    w.out(`Signed the GitHub CLI and git in as ${made.slug}[bot].`);
    return 0;
  } catch (error) {
    w.out(`::error::${message(error)}`);
    return 1;
  }
}

/** The command in a workflow's step, with the real clock, network, and
 * CLI. */
export async function run(): Promise<number> {
  const env = process.env;
  const { reachOf } = await import("./config.mts");
  const { repositories } = await import("./session.mts");
  return main({
    env,
    fetch,
    clock: { now: Date.now },
    cli: { run: gh, runIn: ghIn },
    repository: (await reachOf(env)).repository,
    repositories: (await repositories(env)).split(","),
    out: say.plainPrinter(),
    output: (line) => {
      if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `${line}\n`);
    },
  });
}
