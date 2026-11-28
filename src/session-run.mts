// The middle job of a run that starts a session in the cloud: it lays out
// what Prepare handed over, starts the agent confined to it, and keeps only
// what the session may hand on. It has no sign-in to the code host.
//
//   kodor session run     # with KODOR_SESSION naming the folder
//
//   in/     from Prepare, read-only to the session
//   home/   the default branch, where the session starts, read-only to it
//   work/   the branch it changes
//   out/    what it leaves
//   clean/  what is handed on: named files, if ordinary and not too large
//
// After the agent ends, nothing here runs or opens anything under work/.
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CloudSession, SessionCommand } from "./agent/types.mts";
import {
  AUTHOR,
  BUNDLE_LIMIT,
  HANDOFF,
  type RunFile,
} from "./handoff/index.mts";

type Env = Record<string, string | undefined>;

export type SessionDeps = {
  dir: string;
  env: Env;
  hosts: string[];
  prompt: string;
  model?: string;
  minutes: number;
  schema?: object;
  git(cwd: string, args: string[]): void;
  untar(file: string, to: string): void;
  /** kodor's own install, which the session's commands run. */
  install: string[];
  settings(s: CloudSession): object;
  command(s: CloudSession, file: string): SessionCommand;
  /** Runs the agent to its end, a line to `line` for each it prints. */
  agent(o: {
    command: SessionCommand;
    cwd: string;
    env: Env;
    minutes: number;
    line(text: string): void;
  }): Promise<number>;
  out(line: string): void;
};

const MAX_TURNS = 1000;

/** The environment without anything the session has no use for: the
 * runner's own tokens and paths, and any sign-in to the code host. */
export function sessionEnv(env: Env, run: RunFile, dir: string): Env {
  const kept = Object.entries(env).filter(
    ([name]) =>
      !/^(?:ACTIONS_|GITHUB_|RUNNER_|GH_|KODOR_)/.test(name) &&
      !/PRIVATE_KEY/.test(name),
  );
  return {
    ...Object.fromEntries(kept),
    [HANDOFF]: dir,
    KODOR_VERSION: env.KODOR_VERSION,
    KODOR_LOCK: env.KODOR_LOCK,
    npm_config_cache: join(dir, "cache"),
    XDG_CACHE_HOME: join(dir, "cache"),
    // The browsers a setup command installed are in the cache it had.
    PLAYWRIGHT_BROWSERS_PATH:
      env.PLAYWRIGHT_BROWSERS_PATH ??
      join(env.HOME ?? homedir(), ".cache/ms-playwright"),
    GIT_AUTHOR_NAME: AUTHOR.name,
    GIT_AUTHOR_EMAIL: AUTHOR.email,
    GIT_COMMITTER_NAME: run.committer.name,
    GIT_COMMITTER_EMAIL: run.committer.email,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
  };
}

/** Copies a file the session left, only if it is an ordinary one: a link
 * would be followed by whatever reads it next, outside the sandbox. Gives
 * the names of those it left behind. */
export function collect(
  from: string,
  to: string,
  names: string[],
  out: (line: string) => void,
): string[] {
  const dropped: string[] = [];
  mkdirSync(to, { recursive: true });
  for (const name of names) {
    const path = join(from, name);
    const found = lstatSync(path, { throwIfNoEntry: false });
    if (!found) continue;
    if (!found.isFile()) {
      out(`Left ${name} behind: it is not an ordinary file.`);
      dropped.push(name);
      continue;
    }
    if (found.size > BUNDLE_LIMIT) {
      out(`Left ${name} behind: it is larger than 20 MB.`);
      dropped.push(name);
      continue;
    }
    copyFileSync(path, join(to, name));
    chmodSync(join(to, name), 0o600);
  }
  return dropped;
}

/** Lays out the other repositories the session may read, as plain files
 * with no history, from archives git made of them. */
function layOthers(run: RunFile, d: SessionDeps): void {
  for (const { folder } of run.others ?? []) {
    if (folder === null) continue;
    const to = join(d.dir, "others", folder);
    mkdirSync(to, { recursive: true });
    d.untar(join(d.dir, "in/others", `${folder}.tar`), to);
  }
}

export async function runSession(d: SessionDeps): Promise<number> {
  const at = (...path: string[]) => join(d.dir, ...path);
  const run = JSON.parse(readFileSync(at("in/run.json"), "utf8")) as RunFile;
  for (const name of ["out", "cache"]) mkdirSync(at(name), { recursive: true });
  // Prepare's bundles hold no branch, so each is fetched into an empty
  // repository.
  if (!existsSync(at("home"))) {
    d.git(d.dir, ["init", "-q", at("home")]);
    d.git(at("home"), [
      "fetch",
      "-q",
      at("in/home.bundle"),
      "refs/handoff/home:refs/handoff/home",
    ]);
    d.git(at("home"), [
      "checkout",
      "-q",
      "-B",
      run.defaultBranch,
      "refs/handoff/home",
    ]);
  }
  d.git(d.dir, ["init", "-q", at("work")]);
  d.git(at("work"), [
    "fetch",
    "-q",
    at("in/work.bundle"),
    `refs/handoff/home:refs/remotes/origin/${run.defaultBranch}`,
    "refs/handoff/work:refs/handoff/work",
  ]);
  // Commands tell the repository by its remote. Nothing can be read from it
  // here.
  for (const copy of ["home", "work"])
    d.git(at(copy), ["remote", "add", "origin", run.remote]);
  d.git(at("work"), [
    "symbolic-ref",
    "refs/remotes/origin/HEAD",
    `refs/remotes/origin/${run.defaultBranch}`,
  ]);
  d.git(at("work"), ["checkout", "-q", "-B", run.branch, "refs/handoff/work"]);

  // The default branch's dependencies, to start from: the session installs
  // its own where they differ.
  if (
    existsSync(at("home/node_modules")) &&
    !existsSync(at("work/node_modules"))
  )
    cpSync(at("home/node_modules"), at("work/node_modules"), {
      recursive: true,
      verbatimSymlinks: true,
    });

  layOthers(run, d);

  const s: CloudSession = {
    prompt: d.prompt,
    work: at("work"),
    out: at("out"),
    cache: at("cache"),
    readOnly: [at("in"), at("home"), at("others"), ...d.install],
    hosts: d.hosts,
    maxTurns: MAX_TURNS,
    ...(d.model ? { model: d.model } : {}),
    ...(d.schema ? { schema: d.schema } : {}),
  };
  const file = at("settings.json");
  writeFileSync(file, JSON.stringify(d.settings(s), null, 2));

  const lines: string[] = [];
  const code = await d.agent({
    command: d.command(s, file),
    cwd: at("home"),
    env: sessionEnv(d.env, run, d.dir),
    minutes: d.minutes,
    line: (text) => lines.push(text),
  });
  const cost = costIn(lines);
  mkdirSync(at("clean"), { recursive: true });
  if (cost) writeFileSync(at("clean/cost.json"), JSON.stringify(cost));
  const dropped = collect(
    at("out"),
    at("clean"),
    ["build.bundle", "request.json"],
    d.out,
  );
  // There whatever the session did, so Publish can tell nothing left from
  // nothing that arrived.
  writeFileSync(at("clean/ended.json"), JSON.stringify({ dropped }));
  const answer = d.schema ? answerIn(lines) : undefined;
  if (d.schema && answer === undefined) {
    d.out("The session gave no answer in the shape it was asked for.");
    return 1;
  }
  if (answer !== undefined)
    writeFileSync(at("clean/answer.json"), JSON.stringify(answer));
  return code;
}

type Result = {
  type?: string;
  is_error?: boolean;
  structured_output?: unknown;
  total_cost_usd?: number;
  session_id?: string;
};

/** The agent's own last word in what it printed, which no command of the
 * session can write. */
function resultIn(lines: string[]): Result | undefined {
  for (const line of lines.toReversed())
    try {
      const read = JSON.parse(line) as Result;
      if (read.type === "result") return read;
    } catch {
      continue;
    }
  return undefined;
}

function answerIn(lines: string[]): unknown {
  const result = resultIn(lines);
  return result?.is_error ? undefined : result?.structured_output;
}

function costIn(lines: string[]) {
  const result = resultIn(lines);
  return result?.total_cost_usd === undefined
    ? undefined
    : { dollars: result.total_cost_usd, session: result.session_id ?? "" };
}
