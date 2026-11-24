// The three jobs of a run that starts a session in the cloud, and the start
// of the next run, with the real code host, git, and agent:
//
//   factory session prepare KIND ID
//   factory session run
//   factory session publish
//   factory session next PULL
//   factory session each conflict|dependency
//
// `session-prepare.mts`, `session-run.mts`, and `session-publish.mts` hold
// what each does. FACTORY_RUN names the folder a job works in.
import { spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as sleep } from "node:timers/promises";
import {
  sandboxSettings,
  sessionCommand,
} from "./agent/claude-code-session.mts";
import { openCodeHost } from "./code-host/index.mts";
import { loadSettings, reachOf, repoRoot } from "./config.mts";
import { main as depsMain } from "./deps.mts";
import type { RunFile } from "./handoff/index.mts";
import type { Kind } from "./handoff/requests.mts";
import { ownLinks } from "./lib/pull-tickets.mts";
import { LOCK_FILE, pinsOf } from "./preset.mts";
import { fetchDeps, fileAt, pinFaults } from "./preset-fetch.mts";
import { conflicting, main as prMain, prDeps } from "./pr.mts";
import { openRunner } from "./runner/index.mts";
import { prepare } from "./session-prepare.mts";
import {
  nextAnswer,
  postCost,
  publish,
  type PublishDeps,
} from "./session-publish.mts";
import { runSession } from "./session-run.mts";
import {
  claimHere,
  claimOutcome,
  main as ticketMain,
  readComments,
  ticketDeps,
  type Deps as TicketDeps,
} from "./ticket.mts";
import { openTickets } from "./tickets/index.mts";

type Env = Record<string, string | undefined>;

const KINDS: Kind[] = ["build", "review", "answer", "conflict", "dependency"];

const out = (line: string) => console.log(line);
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function folder(env: Env): string {
  if (!env.FACTORY_RUN) throw new Error("FACTORY_RUN names no folder.");
  return env.FACTORY_RUN;
}

const need = (env: Env, name: string): string => {
  const value = env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
};

/** Git, with its own words when it fails and no sign-in in them. */
function git(cwd: string, args: string[]): string {
  const r = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 256 << 20,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  if (r.status !== 0) {
    const said = (r.stderr || r.error?.message || "").trim().split("\n").at(-1);
    throw new Error(
      `git ${args[0]}: ${(said ?? "").replace(/\/\/[^@/\s]*@/g, "//")}`,
    );
  }
  return r.stdout;
}

/** The adapters, as the settings name them. */
async function world(env: Env) {
  const settings = await loadSettings();
  const { repository, codeHost: type, runner: name } = await reachOf(env);
  const { tickets } = await openTickets(settings, {
    repository,
    board: settings.tickets.board,
  });
  return {
    settings,
    repository,
    codeHost: openCodeHost(repository, type),
    runner: openRunner(repository, name),
    tickets,
    prDeps: prDeps(repository, type, name),
  };
}

async function runPrepare(argv: string[], env: Env): Promise<number> {
  const { load } = await import("js-yaml");
  const [kind, id] = argv;
  if (!KINDS.includes(kind as Kind) || !id)
    throw new Error("Usage: factory session prepare KIND ID");
  const w = await world(env);
  const lines = async (
    run: (say: (line: string) => void) => Promise<number>,
  ) => {
    const said: string[] = [];
    return { code: await run((line) => said.push(line)), lines: said };
  };
  const run = await prepare(kind as Kind, id, {
    ...w,
    dir: folder(env),
    labels: w.settings.tickets.labels,
    ownLinks: ownLinks(w.settings),
    poster: w.runner.poster,
    ticket: (args, on) =>
      lines((say) =>
        ticketMain(args, {
          ...ticketDeps(),
          open: async () => ({ tickets: on.tickets }),
          out: say,
        }),
      ),
    pr: (args, on) =>
      lines((say) =>
        prMain(args, {
          ...w.prDeps,
          codeHost: on.codeHost,
          runner: on.runner,
          tickets: async () => ({
            tickets: on.tickets,
            own: ownLinks(w.settings),
          }),
          out: say,
        }),
      ),
    deps: (on) =>
      depsMain(
        on.codeHost,
        () => {},
        [],
        () => on.codeHost.defaultBranch(),
      ),
    pinFaults(commit) {
      const at = (ref: string) =>
        pinsOf(fileAt(repoRoot(), ref, LOCK_FILE), load);
      return pinFaults(
        fetchDeps(w.repository, w.settings.codeHost.type),
        at(commit),
        at("HEAD"),
        load,
      );
    },
    git: (args) => git(repoRoot(), args),
    claimOf: claimHere,
    committer: {
      name: need(env, "FACTORY_COMMITTER_NAME"),
      email: need(env, "FACTORY_COMMITTER_EMAIL"),
    },
    out,
  });
  if (env.GITHUB_OUTPUT)
    appendFileSync(env.GITHUB_OUTPUT, `ran=${run !== null}\n`);
  return 0;
}

/** One line for each thing the agent says and each tool it runs, then how
 * it ended. */
export function shown(line: string): string[] {
  let e;
  try {
    e = JSON.parse(line);
  } catch {
    return [];
  }
  const flat = (v: unknown) =>
    (typeof v === "string" ? v : JSON.stringify(v ?? "")).replace(
      /\s*\n\s*/g,
      " ",
    );
  if (typeof e !== "object" || e === null) return [];
  if (e.type === "assistant")
    return (e.message?.content ?? []).flatMap(
      (c: { type: string; text?: string; name?: string; input?: object }) =>
        c.type === "text"
          ? [flat(c.text)]
          : c.type === "tool_use"
            ? [
                `> ${c.name}: ${flat(Object.values(c.input ?? {})[0]).slice(0, 200)}`,
              ]
            : [],
    );
  if (e.type === "result")
    return [
      `Finished (${e.subtype}): ${e.num_turns} turns, ${Math.floor(e.duration_ms / 60000)} minutes, $${e.total_cost_usd} at API list prices.`,
      ...(e.permission_denials ?? []).map(
        (d: { tool_name: string; tool_input?: object }) =>
          `Denied: ${d.tool_name}: ${flat(Object.values(d.tool_input ?? {})[0]).slice(0, 200)}`,
      ),
    ];
  return [];
}

async function runTheSession(env: Env): Promise<number> {
  const dir = folder(env);
  const settings = await loadSettings();
  const run = JSON.parse(
    readFileSync(join(dir, "in/run.json"), "utf8"),
  ) as RunFile;
  if (existsSync(join(dir, "in/cache")))
    cpSync(join(dir, "in/cache"), join(dir, "cache"), { recursive: true });
  const schema =
    run.kind === "review"
      ? (await import("./review-record.mts")).REVIEW_SCHEMA
      : undefined;
  return runSession({
    dir,
    env,
    hosts: settings.builds.hosts,
    prompt: need(env, "PROMPT"),
    ...(env.MODEL ? { model: env.MODEL } : {}),
    minutes: Number(need(env, "MINUTES")),
    ...(schema ? { schema } : {}),
    git: (cwd, args) => void git(cwd, args),
    install: (env.FACTORY_INSTALL ?? "").split(":").filter(Boolean),
    settings: sandboxSettings,
    command: sessionCommand,
    agent: ({ command, cwd, env: its, minutes, line }) =>
      new Promise((done, fail) => {
        const child = spawn(command.command, command.args, {
          cwd,
          env: its as NodeJS.ProcessEnv,
          stdio: ["ignore", "pipe", "inherit"],
        });
        const stop = setTimeout(() => child.kill("SIGTERM"), minutes * 60_000);
        createInterface({ input: child.stdout }).on("line", (text) => {
          line(text);
          shown(text).forEach(out);
        });
        child.on("error", fail);
        child.on("close", (code) => {
          clearTimeout(stop);
          done(code ?? 1);
        });
      }),
    out,
  });
}

/** What a ticket command Publish runs needs, with the claim Prepare made on
 * another machine, which a stop goes by. */
export function publishTicketDeps(
  run: Pick<RunFile, "ticket" | "claim">,
): TicketDeps {
  return {
    ...ticketDeps(),
    claimStore: {
      read: (key) => (key === run.ticket ? run.claim : null),
      write: () => {},
    },
  };
}

async function publishDeps(env: Env): Promise<PublishDeps> {
  const w = await world(env);
  const dir = folder(env);
  const run = JSON.parse(
    readFileSync(join(dir, "in/run.json"), "utf8"),
  ) as RunFile;
  return {
    ...w,
    run,
    dir,
    ticket: (argv, readFile) =>
      ticketMain(argv, {
        ...publishTicketDeps(run),
        readFile,
        out: (l) => out(`  ${l}`),
      }),
    pr: w.prDeps,
    clone() {
      const clone = mkdtempSync(join(tmpdir(), "publish-"));
      git(clone, [
        "clone",
        "-q",
        "--bare",
        w.codeHost.remote(w.repository).url,
        clone,
      ]);
      return clone;
    },
    push: (clone, commit, branch) =>
      void git(clone, [
        "-c",
        "core.hooksPath=/dev/null",
        "push",
        "-q",
        w.codeHost.remote(w.repository).url,
        `${commit}:refs/heads/${branch}`,
      ]),
    claimed: async () =>
      run.ticket !== null &&
      run.claim !== null &&
      claimOutcome(
        await readComments({ tickets: w.tickets }, run.ticket),
        run.claim,
      ) === "claimed",
    messages: (clone, tip) =>
      git(clone, [
        "log",
        "--format=%B%x00",
        tip,
        "--not",
        run.base,
        `refs/heads/${run.defaultBranch}`,
      ]).split("\0"),
    session: env.CONCLUSION ?? "failure",
    reviewRounds: w.settings.rules.reviewRounds,
    now: Date.now,
    sleep,
    async signIn() {
      if (!env.FACTORY_APP_PRIVATE_KEY) return;
      const { run: token } = await import("./session-token.mts");
      if ((await token()) !== 0) throw new Error("Could not sign in again.");
    },
    out,
  };
}

/** Releases the claim of a build that opened no pull request. */
async function release(d: PublishDeps): Promise<void> {
  if (d.run.kind !== "build" || d.run.ticket === null) return;
  await d.ticket(["end", d.run.ticket], () => "");
}

/** Records a review, and tells the workflow whether an answer may follow. */
async function record(d: PublishDeps, env: Env): Promise<number> {
  const { readAnswer, recordReview } = await import("./review-record.mts");
  const file = join(d.dir, "out/answer.json");
  let answer = null;
  if (existsSync(file))
    try {
      answer = readAnswer(readFileSync(file, "utf8"));
    } catch (error) {
      out(`The session's answer can't be read: ${message(error)}`);
    }
  const settings = await loadSettings();
  const link = d.runner.thisRun(env)?.page;
  const code = await recordReview({
    run: d.run,
    codeHost: d.codeHost,
    answer,
    conclusion: env.CONCLUSION ?? "failure",
    override: settings.codeHost.labels["verdict-override"],
    reviewOn: settings.prReview !== null,
    ...(link ? { link } : {}),
    out,
  });
  await postCost(d, d.run.pull);
  const changes =
    answer !== null &&
    (answer.verdict === "changes" ||
      answer.findings.some((f) => f.severity !== "Low"));
  if (changes && env.GITHUB_OUTPUT)
    appendFileSync(env.GITHUB_OUTPUT, "next=true\n");
  return code;
}

async function runPublish(env: Env): Promise<number> {
  const d = await publishDeps(env);
  if (d.run.kind === "review") return record(d, env);
  try {
    return await publish(d);
  } finally {
    await release(d);
  }
}

async function runNext(argv: string[], env: Env): Promise<number> {
  const pull = Number(argv[0]);
  if (!Number.isInteger(pull) || pull <= 0)
    throw new Error("Usage: factory session next PULL");
  const d = await publishDeps(env);
  await nextAnswer(d, pull);
  return 0;
}

/** Starts one run for each pull request that conflicts, or that Dependabot
 * has open. */
async function runEach(argv: string[], env: Env): Promise<number> {
  const [kind] = argv;
  if (kind !== "conflict" && kind !== "dependency")
    throw new Error("Usage: factory session each conflict|dependency");
  const { codeHost, runner } = await world(env);
  const pulls =
    kind === "conflict"
      ? await conflicting(codeHost, sleep)
      : (await codeHost.listOpen())
          .filter((p) => p.author === "dependabot[bot]")
          .map((p) => p.number);
  if (pulls.length === 0) out("Nothing to do.");
  const branch = await codeHost.defaultBranch();
  for (const pull of pulls) {
    await runner.startOn(kind, pull, branch);
    out(`Started a ${kind} run for #${pull}.`);
  }
  return 0;
}

const JOBS: Record<string, (argv: string[], env: Env) => Promise<number>> = {
  prepare: runPrepare,
  run: (_, env) => runTheSession(env),
  publish: (_, env) => runPublish(env),
  next: runNext,
  each: runEach,
};

export const isJob = (step: string | undefined): step is string =>
  step !== undefined && Object.hasOwn(JOBS, step);

/** `factory session prepare|run|publish|next|each`. */
export async function run(step: string, argv: string[]): Promise<number> {
  try {
    return await JOBS[step](argv, process.env);
  } catch (error) {
    console.error(`::error::${message(error)}`);
    return 1;
  }
}
