// A session in the cloud works from files: what it may read was read ahead
// for it, and what it would write is asked for. `KODOR_HANDOFF` names the
// folder, and every `kodor` command looks for it, so a skill runs the same
// commands in the cloud as on a person's machine.
//
//   KODOR_HANDOFF/in/run.json       the run, as `RunFile` says
//   KODOR_HANDOFF/in/snapshot.json  each read made ahead, as `Call`s
//   KODOR_HANDOFF/out/request.json  each write asked for, as `Asked`s
//   KODOR_HANDOFF/out/build.bundle  the commits, from `kodor pr push`
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { refuseBareTags } from "../guard-ticket-text.mts";
import { replaying, type Call, type On } from "./replay.mts";
import {
  allow,
  ask,
  isWrite,
  withoutMarkers,
  type Asked,
  type Kind,
} from "./requests.mts";

export const HANDOFF = "KODOR_HANDOFF";

export type RunFile = {
  version: 1;
  kind: Kind;
  repository: string;
  /** Where git reads the repository from. */
  remote: string;
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
  /** The ticket's other repositories, for a ticket that names any. */
  others?: {
    repository: string;
    /** The pull request that builds the ticket there, when one does. */
    pull: number | null;
    /** Its folder under `others/`, or null when it was too large. */
    folder: string | null;
  }[];
  /** Who a session's commits are committed by. */
  committer: { name: string; email: string };
};

/** Who writes a session's commits. */
export const AUTHOR = { name: "Claude", email: "noreply@anthropic.com" };

/** The most bytes of commits a session may hand over. */
export const BUNDLE_LIMIT = 20_000_000;

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

/** The reads made ahead, with the run's ticket as the session last asked for
 * it to be: a skill that edits it a line at a time reads its own edits. */
function withEdits(calls: Call[], asked: Asked[]): Call[] {
  const bodies = new Map<string, string>();
  for (const { argv, files } of asked) {
    if (argv[0] !== "ticket" || argv[1] !== "edit") continue;
    const text = files[argv[argv.indexOf("--body-file") + 1]];
    if (text !== undefined) bodies.set(argv[2], withoutMarkers(text));
  }
  return calls.map((c) => {
    const body = bodies.get(String(c.args[0]));
    return c.on === "tickets" && c.call === "read" && c.value && body
      ? { ...c, value: { ...c.value, body } }
      : c;
  });
}

/** The adapter, reading what was read ahead for this session when there is
 * a folder to read it from. `of` is the repository a code host is of. */
export function handed<K extends On>(
  on: K,
  real: Parameters<typeof replaying<K>>[1],
  env: Env = process.env,
  of?: string,
): ReturnType<typeof replaying<K>> {
  const h = handoffIn(env);
  if (!h) return real;
  const { ticket, repository } = h.run();
  const prefix = of === undefined || of === repository ? "" : `${of}:`;
  return replaying(on, real, withEdits(h.calls(), h.asked()), ticket, prefix);
}

export const ENDS_HERE =
  "This run ends here. The next one starts when CI and the review have finished.";

const waits = (argv: string[]) =>
  argv[0] === "pr" &&
  (argv[1] === "wait-checks" ||
    argv[1] === "watch" ||
    (argv[1] === "state" && argv.includes("--wait")));

const POSTED =
  /^(?:follow-up$|ticket (?:comment|edit|open)$|pr (?:comment|open)$)/;

/** Every word a command posts. */
const wordsOf = ({ argv, files }: Asked) => [
  ...(argv[0] === "follow-up" ? argv.slice(1) : []),
  ...(argv.includes("--title") ? [argv[argv.indexOf("--title") + 1]] : []),
  ...Object.values(files),
];

/** Why Publish would leave out what a command posts, by its text: as it was
 * written, and `may`, as Publish would post it. */
function textRefused(
  asked: Asked,
  may: Asked,
  fault: (text: string) => string | undefined,
): string | null {
  const follows = asked.argv[0] === "follow-up";
  const name = follows ? "follow-up" : asked.argv.slice(0, 2).join(" ");
  if (!POSTED.test(name)) return null;
  try {
    wordsOf(asked).forEach(refuseBareTags);
  } catch (error) {
    return (error as Error).message;
  }
  const found =
    name === "pr open" || follows
      ? fault(wordsOf(may).join("\n\n"))
      : undefined;
  return found ? `kodor ${name}: it ${found}` : null;
}

/** What a session's command does in place of reaching anything: the exit
 * code, or null for one that runs as it does anywhere else. */
export function intercept(
  argv: string[],
  h: Handoff,
  out: (line: string) => void,
  readFile: (path: string) => string = (path) => readFileSync(path, "utf8"),
  fault: (text: string) => string | undefined = () => undefined,
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
  // Publish does these itself, whatever the session asks.
  if (command === "cost" || (group === "pr" && command === "ready")) {
    out(`Asked: kodor ${argv.slice(0, 2).join(" ")}`);
    return 0;
  }
  const asked = ask(argv, readFile);
  const run = h.run();
  // Told now, the session can ask again; Publish would only leave it out.
  const may = allow(asked, { ...run, comments: null, opened: [] });
  const refused =
    "refused" in may ? may.refused : textRefused(asked, may, fault);
  if (refused) {
    out(`✗ Can't ask for this. ${refused}`);
    return 1;
  }
  h.add(asked);
  out(`Asked: kodor ${argv.slice(0, 3).join(" ")}`);
  return 0;
}
