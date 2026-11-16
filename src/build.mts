// Starts a build of a ticket on the runner, on the default branch, and
// prints the run's link.
//
//   npx --no-install factory build N
//
// The runner may answer the start with no run, so the command looks for it.
// When none appears within 15 seconds it prints the link to the page that
// lists builds instead. A refused start exits 1 with the runner's error.
import { setTimeout as sleep } from "node:timers/promises";
import { loadSettings, targetOf, type Settings } from "./config.mts";
import { openCodeHost, type CodeHost } from "./code-host/index.mts";
import { openRunner, type Runner } from "./runner/index.mts";

const USAGE = "Usage: factory build N";
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
  now: () => Date;
  sleep: (ms: number) => Promise<unknown>;
  out: (line: string) => void;
  err: (line: string) => void;
};

export async function main(argv: string[], d: Deps): Promise<number> {
  const ticket = Number(argv[0]);
  if (argv.length !== 1 || !Number.isInteger(ticket) || ticket <= 0) {
    d.err(USAGE);
    return 2;
  }
  try {
    const settings = await d.settings();
    const { repository } = targetOf(settings, d.env);
    const runner = d.runner(repository, settings.builds.runner);
    const branch = await d
      .codeHost(repository, settings.codeHost.type)
      .defaultBranch();
    const since = d.now().getTime();
    await runner.startBuild(ticket, branch);
    let link: string | null = null;
    for (;;) {
      link = await runner.findBuild(ticket, since);
      if (link || d.now().getTime() - since >= FIND_FOR_MS) break;
      await d.sleep(EVERY_MS);
    }
    d.out(`Started a build of #${ticket} in GitHub Actions:`);
    d.out(link ?? runner.buildsPage());
    return 0;
  } catch (error) {
    d.err(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

/** `factory build N`. */
export async function run(argv: string[]): Promise<number> {
  return main(argv, {
    settings: () => loadSettings(),
    env: process.env,
    codeHost: (repository, type) => openCodeHost(repository, type),
    runner: (repository, name) => openRunner(repository, name),
    now: () => new Date(),
    sleep,
    out: (line) => console.log(line),
    err: (line) => console.error(line),
  });
}
