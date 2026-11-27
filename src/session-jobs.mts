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
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as sleep } from "node:timers/promises";
import {
  sandboxSettings,
  sessionCommand,
} from "./agent/claude-code-session.mts";
import { acrossGitEnv } from "./code-host/across.mts";
import { openCodeHost, reachCodeHost } from "./code-host/index.mts";
import { startMarker } from "./poller.mts";
import { linkLines } from "./ticket-repositories.mts";
import { columnsOf, loadSettings, reachOf, repoRoot } from "./config.mts";
import { main as depsMain } from "./deps.mts";
import { BUNDLE_LIMIT, type RunFile } from "./handoff/index.mts";
import type { Kind } from "./handoff/requests.mts";
import { ownLinks } from "./lib/pull-tickets.mts";
import { LOCK_FILE, pinsOf } from "./preset.mts";
import { fetchDeps, fileAt, pinFaults } from "./preset-fetch.mts";
import { conflicting, main as prMain, prDeps } from "./pr.mts";
import { liveOrder } from "./merge-order.mts";
import { openRunner, reachRunner } from "./runner/index.mts";
import { prepare } from "./session-prepare.mts";
import {
  nextAnswer,
  nextRepository,
  postCost,
  publish,
  type PublishDeps,
} from "./session-publish.mts";
import { COMMITS, commitsIn } from "./handoff/links.mts";
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
import * as say from "./lib/output.mts";
import { REFUSAL } from "./agent/claude-code.mts";
import { AGENT_KEY, AGENT_TOKEN } from "./parts.mts";

type Env = Record<string, string | undefined>;

const KINDS: Kind[] = ["build", "review", "answer", "conflict", "dependency"];

const out = say.plainPrinter();
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
function git(
  cwd: string,
  args: string[],
  extra: Record<string, string> = {},
): string {
  const r = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 256 << 20,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...extra },
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
    reach: (other: string) => reachCodeHost(other, type, repository),
    /** Starts a build of a ticket in another repository. */
    startBuild: async (other: string, key: string) => {
      const branch = await (
        await reachCodeHost(other, type, repository)
      ).defaultBranch();
      await (await reachRunner(other, name)).startBuild(key, branch);
    },
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
    ownLinks: ownLinks(w.settings),
    poster: w.runner.poster,
    reach: w.reach,
    startBuild: w.startBuild,
    archive,
    underApp: Boolean(env.FACTORY_APP_PRIVATE_KEY),
    columns: columnsOf(w.settings),
    ticket: (args, on) =>
      lines((say) =>
        ticketMain(args, {
          ...ticketDeps(),
          open: async () => ({ tickets: on.tickets }),
          reach: on.reach,
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

/** Has the runner take nothing this process prints as a command to it, since
 * what a session wrote is printed here. What it returns holds a line of the
 * factory's own until commands resume, as the process exits. */
export function quietlyWith(o: {
  actions: boolean;
  token: string;
  out: (line: string) => void;
  onExit: (then: () => void) => void;
}): (line: string) => void {
  const held: string[] = [];
  if (o.actions) o.out(`::stop-commands::${o.token}`);
  o.onExit(() => {
    if (o.actions) o.out(`::${o.token}::`);
    for (const line of held) o.out(line);
  });
  return (line) => void held.push(line);
}

const quietly = () =>
  quietlyWith({
    actions: Boolean(process.env.GITHUB_ACTIONS),
    token: randomBytes(16).toString("hex"),
    out,
    onExit: (then) => process.on("exit", then),
  });

/** The error a session's last word gives, as a line the runner shows on the
 * run, in Claude Code's own words, or null for a session that did not end
 * in one. A refusal of the Claude token says who stores a new one. */
export function sessionError(
  e: unknown,
  at: { credential: string | null; ownerKind: string | null; owner: string },
): string | null {
  if (typeof e !== "object" || e === null) return null;
  const r = e as { type?: unknown; is_error?: unknown; result?: unknown };
  if (r.type !== "result" || r.is_error !== true) return null;
  if (typeof r.result !== "string") return null;
  const first = r.result
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
  if (!first) return null;
  // The runner's own escaping, so the words stay data.
  const words = first.replace(/%/g, "%25").replace(/\r/g, "%0D");
  if (!at.credential || !REFUSAL.test(r.result))
    return `::error::Claude Code: ${words}`;
  const refused = `::error::Claude Code refused ${at.credential}: ${words.replace(/\.$/, "")}.`;
  if (at.credential !== AGENT_TOKEN) return refused;
  const who =
    at.ownerKind === "Organization"
      ? `an owner of ${at.owner} runs factory init --org`
      : "run factory init";
  return `${refused} A Claude token lasts a year: ${who} to store a new one.`;
}

/** Who owns the run's repository, `User` or `Organization`, from its
 * event, or null outside a run. */
function ownerKindOf(env: Env): string | null {
  if (!env.GITHUB_EVENT_PATH) return null;
  try {
    const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")) as {
      repository?: { owner?: { type?: unknown } };
    };
    const kind = event.repository?.owner?.type;
    return typeof kind === "string" ? kind : null;
  } catch {
    return null;
  }
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
  const hold = quietly();
  const at = {
    credential: env.CLAUDE_CODE_OAUTH_TOKEN
      ? AGENT_TOKEN
      : env.ANTHROPIC_API_KEY
        ? AGENT_KEY
        : null,
    ownerKind: ownerKindOf(env),
    owner: env.GITHUB_REPOSITORY_OWNER ?? "",
  };
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
    untar(file, to) {
      const r = spawnSync("tar", ["-xf", file, "-C", to], { encoding: "utf8" });
      if (r.status !== 0) throw new Error(`tar: ${r.stderr.trim()}`);
    },
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
          let event: unknown;
          try {
            event = JSON.parse(text);
          } catch {
            return;
          }
          const error = sessionError(event, at);
          if (error) hold(error);
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

async function archive(
  repository: string,
  branch: string | null,
  path: string,
): Promise<boolean> {
  const { repository: own, codeHost: type } = await reachOf(process.env);
  const { url } = openCodeHost(own, type).remote(repository);
  return archiveOf(url, branch, path, await acrossGitEnv(repository));
}

/** A repository's files as plain files with no history, in a tar archive,
 * or false when it is larger than a session may be handed. */
export function archiveOf(
  url: string,
  branch: string | null,
  path: string,
  extra: Record<string, string> = {},
  most = BUNDLE_LIMIT,
): boolean {
  const dir = mkdtempSync(join(tmpdir(), "other-"));
  const run = (...args: string[]) => git(dir, args, extra);
  run("init", "-q", "--bare");
  run("fetch", "-q", "--depth", "1", url, branch ?? "HEAD");
  run("archive", "--format=tar", "-o", path, "FETCH_HEAD");
  rmSync(dir, { recursive: true, force: true });
  if (statSync(path).size <= most) return true;
  rmSync(path);
  return false;
}

/** What a ticket command Publish runs needs, with the claim Prepare made on
 * another machine, which a stop goes by. */
export function publishTicketDeps(
  run: Pick<RunFile, "ticket" | "claim">,
): TicketDeps {
  return {
    ...ticketDeps(),
    fromCloudSession: true,
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
    commits: (clone, tip) =>
      commitsIn(
        git(clone, [
          "log",
          "-z",
          COMMITS,
          tip,
          "--not",
          run.base,
          `refs/heads/${run.defaultBranch}`,
        ]),
      ),
    columns: columnsOf(w.settings),
    async linkLines() {
      if (run.ticket === null) return null;
      return linkLines(await w.tickets.read(run.ticket), w);
    },
    next: async () =>
      run.ticket === null ? null : nextRepository(run.ticket, w),
    startBuild: (other) =>
      w.startBuild(other, w.tickets.keyIn(run.ticket!, other)),
    marker: startMarker,
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
    order: (body) => liveOrder(body, out),
    ...(link ? { link } : {}),
    out,
  });
  await postCost(d, d.run.pull);
  const changes =
    answer !== null &&
    (answer.verdict === "changes" ||
      answer.findings.some((f) => f.severity !== "Low"));
  // A newer commit has a review of its own coming.
  const current =
    changes &&
    d.run.pull !== null &&
    (await d.codeHost.get(d.run.pull)).head.sha === d.run.base;
  if (current && env.GITHUB_OUTPUT)
    appendFileSync(env.GITHUB_OUTPUT, "next=true\n");
  return code;
}

async function runPublish(env: Env): Promise<number> {
  const d = await publishDeps(env);
  quietly();
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
    say.plainError(`::error::${message(error)}`);
    return 1;
  }
}
