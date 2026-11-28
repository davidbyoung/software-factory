// Starts a build of a ticket on the runner, on the default branch, and
// prints the run's link.
//
//   lunamill build N
//
// The runner may answer the start with no run, so the command looks for it.
// When none appears within 15 seconds it prints the link to the page that
// lists builds instead. A refused start exits 1 with the runner's error.
import { setTimeout as sleep } from "node:timers/promises";
import { loadSettings, targetOf, type Settings } from "./config.mts";
import { openCodeHost, type CodeHost } from "./code-host/index.mts";
import { openRunner, type Runner } from "./runner/index.mts";
import { keyOf, refOf } from "./tickets/index.mts";
import type { Key } from "./tickets/types.mts";
import * as say from "./lib/output.mts";

const USAGE = "Usage: lunamill build N";
/** How long to look for the run, and how often. */
const FIND_FOR_MS = 15_000;
const EVERY_MS = 3_000;

export type Deps = {
  settings: () => Promise<Settings>;
  env: Record<string, string | undefined>;
  /** The code host of that name, whose default branch a build runs on. */
  codeHost: (repository: string, type: string) => CodeHost;
  /** The runner of that name. */
  runner: (repository: string, name: string) => Runner;
  /** How the settings' ticket system reads a key and writes a ticket. */
  keyOf: (type: string) => (typed: string, repository?: string) => Key;
  refOf: (type: string) => (key: Key) => string;
  now: () => Date;
  sleep: (ms: number) => Promise<unknown>;
  out: say.Out;
  err: say.Out;
};

export async function main(argv: string[], d: Deps): Promise<number> {
  if (argv.length !== 1 || !argv[0] || argv[0].startsWith("-")) {
    d.err(say.text(USAGE));
    return 2;
  }
  try {
    const settings = await d.settings();
    const { repository } = targetOf(settings, d.env);
    const ticket = d.keyOf(settings.tickets.type)(argv[0], repository);
    const ref = d.refOf(settings.tickets.type)(ticket);
    const runName = `Build ${ref}`;
    const runner = d.runner(repository, settings.builds.runner);
    const branch = await d
      .codeHost(repository, settings.codeHost.type)
      .defaultBranch();
    const since = d.now().getTime();
    await runner.startBuild(ticket, branch);
    let link: string | null = null;
    for (;;) {
      link = await runner.findBuild(runName, since);
      if (link || d.now().getTime() - since >= FIND_FOR_MS) break;
      await d.sleep(EVERY_MS);
    }
    d.out(say.text(`Started a build of ${ref} in GitHub Actions:`));
    d.out(say.text(link ?? runner.buildsPage()));
    return 0;
  } catch (error) {
    d.err(say.text(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

/** `lunamill build N`. */
export async function run(argv: string[]): Promise<number> {
  return main(argv, {
    settings: () => loadSettings(),
    env: process.env,
    codeHost: (repository, type) => openCodeHost(repository, type),
    runner: (repository, name) => openRunner(repository, name),
    keyOf,
    refOf,
    now: () => new Date(),
    sleep,
    ...say.printersFor("build"),
  });
}
