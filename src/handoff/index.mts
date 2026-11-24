// A session in the cloud works from files: what it may read was read ahead
// for it, and what it would write is asked for. `FACTORY_HANDOFF` names the
// folder, and every `factory` command looks for it, so a skill runs the same
// commands in the cloud as on a person's machine.
//
//   FACTORY_HANDOFF/in/run.json       the run, as `RunFile` says
//   FACTORY_HANDOFF/in/snapshot.json  each read made ahead, as `Call`s
//   FACTORY_HANDOFF/out/request.json  each write asked for, as `Asked`s
//   FACTORY_HANDOFF/out/build.bundle  the commits, from `factory pr push`
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { replaying, type Call, type On } from "./replay.mts";
import { ask, isWrite, type Asked, type Kind } from "./requests.mts";

export const HANDOFF = "FACTORY_HANDOFF";

export type RunFile = {
  version: 1;
  kind: Kind;
  repository: string;
  defaultBranch: string;
  /** The commit the work copy starts at. */
  base: string;
  /** The branch Publish pushes. */
  branch: string;
  ticket: string | null;
  /** The ticket as its system writes it. */
  ref: string | null;
  pull: number | null;
  /** Which answer this is, from 1; 0 for any other run. */
  round: number;
  /** The claim a build's Prepare made, by its record's ID. */
  claim: string | null;
  /** Who a session's commits are committed by. */
  committer: { name: string; email: string };
};

type Env = Record<string, string | undefined>;

export type Handoff = {
  dir: string;
  /** Where a session's commits go. */
  bundle: string;
  run(): RunFile;
  calls(): Call[];
  asked(): Asked[];
  add(asked: Asked): void;
};

/** The folder this session works from, or null on a person's machine and
 * in a job that has a sign-in of its own. */
export function handoffIn(env: Env = process.env): Handoff | null {
  const dir = env[HANDOFF];
  if (!dir) return null;
  const read = (path: string) =>
    JSON.parse(readFileSync(join(dir, path), "utf8"));
  const requests = join(dir, "out/request.json");
  const asked = (): Asked[] =>
    existsSync(requests)
      ? JSON.parse(readFileSync(requests, "utf8")).commands
      : [];
  return {
    dir,
    bundle: join(dir, "out/build.bundle"),
    run: () => read("in/run.json"),
    calls: () => read("in/snapshot.json"),
    asked,
    add: (one) =>
      writeFileSync(
        requests,
        `${JSON.stringify({ version: 1, commands: [...asked(), one] }, null, 2)}\n`,
      ),
  };
}

/** The adapter, reading what was read ahead for this session when there is
 * a folder to read it from. */
export function handed<K extends On>(
  on: K,
  real: Parameters<typeof replaying<K>>[1],
  env: Env = process.env,
): ReturnType<typeof replaying<K>> {
  const h = handoffIn(env);
  if (!h) return real;
  const { ticket } = h.run();
  return replaying(on, real, h.calls(), ticket);
}

export const ENDS_HERE =
  "This run ends here. The next one starts when CI and the review have finished.";

const waits = (argv: string[]) =>
  argv[0] === "pr" &&
  (argv[1] === "wait-checks" ||
    argv[1] === "watch" ||
    (argv[1] === "state" && argv.includes("--wait")));

/** What a session's command does in place of reaching anything: the exit
 * code, or null for one that runs as it does anywhere else. */
export function intercept(
  argv: string[],
  h: Handoff,
  out: (line: string) => void,
  readFile: (path: string) => string = (path) => readFileSync(path, "utf8"),
): number | null {
  if (waits(argv)) {
    out(ENDS_HERE);
    return 0;
  }
  const [group, command, key] = argv;
  // The claim was made before the session started, and is checked again
  // before anything is pushed.
  if (group === "ticket" && (command === "claim" || command === "still-live")) {
    if (key !== h.run().ticket) {
      out(`This run is for ticket ${h.run().ticket}, not ${key}.`);
      return 1;
    }
    out(command === "claim" ? "claimed" : "live");
    return 0;
  }
  if (!isWrite(argv)) return null;
  h.add(ask(argv, readFile));
  out(`Asked: factory ${argv.slice(0, 3).join(" ")}`);
  return 0;
}
