// What the tests of `factory init` share: a checkout in a temporary folder,
// the in-memory code host, runner, and ticket system, scripted answers, and
// stand-ins for git, the gate, and the presets' repositories. No test
// reaches GitHub or runs git.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NoDefaultBranch } from "../src/lib/default-branch.mts";
import { afterEach, expect } from "vitest";
import { load } from "js-yaml";
import { parseDocument } from "yaml";
import {
  main,
  type Ask,
  type FromPresets,
  type GitResult,
  type InitDeps,
} from "../src/init.mts";
import type { Paint } from "../src/lib/color.mts";
import { writeCredential } from "../src/lib/credentials.mts";
import type { Check } from "../src/setup.mts";
import type { Part } from "../src/parts.mts";
import { memoryCodeHost } from "./memory-code-host";
import { memoryRunner } from "./memory-runner";
import { memoryTickets } from "./memory-tickets";
import { memoryTools } from "./memory-tools";
import type { Registry } from "../src/tools.mts";
import type { Agent } from "../src/agent/types.mts";
import type { Group, TicketField, Tickets } from "../src/tickets/types.mts";

export const GOOD = "tok_good";
export const NARROW = "tok_narrow";
export const AGENT = "agent_token";
export const PRIVATE_KEY = "-----BEGIN PRIVATE-----\nsecret key\n-----END-----";
/** Every value a test pastes or makes, none of which may be printed. */
export const VALUES = [GOOD, NARROW, AGENT, PRIVATE_KEY, "secret key"];

export type Answers = {
  checkbox?: (Part | string)[][];
  select?: string[];
  confirm?: boolean[];
  secret?: string[];
  input?: string[];
  /** Answers to the branch name question; unscripted, it takes the
   * pattern offered, as Enter does. */
  branch?: string[];
  /** Answers to the spec tool question; unscripted, it takes the one
   * offered first, as Enter does. */
  specs?: string[];
  /** Answers to the gate question; unscripted, it is left empty, as Enter
   * does. */
  gate?: string[];
};

export const SPEC_QUESTION = "Which spec tool do you use?";

export const BRANCH_QUESTION =
  "How should a build name its branch? Use {ticket}, and {user} for the GitHub account:";

export const GATE_QUESTION =
  "Which command checks a change here, such as npm test? (leave empty to add it later)";

/** Answers each question in turn from the script, and records each one. */
export function scripted(
  answers: Answers,
  log: (line: string) => void = () => {},
) {
  const asked: string[] = [];
  /** The values each select offered, in order. */
  const offered: string[][] = [];
  /** Each select's choices as they read, and the one chosen if none is
   * picked, in order. */
  const selects: { names: string[]; fallback?: string }[] = [];
  /** What each checkbox's choices say under them, by value. */
  const descriptions: Record<string, string | undefined>[] = [];
  /** Each checkbox's choices as they read, and which start picked. */
  const checkboxes: { names: string[]; checked: string[] }[] = [];
  /** What each confirm offers if nothing is typed, by its question. */
  const fallbacks: Record<string, boolean> = {};
  const queue = {
    checkbox: [...(answers.checkbox ?? [])],
    select: [...(answers.select ?? [])],
    confirm: [...(answers.confirm ?? [])],
    secret: [...(answers.secret ?? [])],
    input: [...(answers.input ?? [])],
    branch: [...(answers.branch ?? [])],
    specs: [...(answers.specs ?? [])],
    gate: [...(answers.gate ?? [])],
  };
  /** The spec tool question's choices as they read, and the one chosen if
   * none is picked, each time it is asked. */
  const specChoices: {
    names: string[];
    values: string[];
    fallback?: string;
  }[] = [];
  const next = <K extends keyof typeof queue>(kind: K, message: string) => {
    asked.push(`${kind}: ${message}`);
    log(`? ${kind}: ${message}`);
    if (!queue[kind].length) throw new Error(`no scripted ${kind}: ${message}`);
    return queue[kind].shift()!;
  };
  const ask: Ask = {
    checkbox: async (message, choices) => {
      descriptions.push(
        Object.fromEntries(choices.map((c) => [c.value, c.description])),
      );
      checkboxes.push({
        names: choices.map((c) => c.name),
        checked: choices.filter((c) => c.checked).map((c) => c.value),
      });
      const chosen = next("checkbox", message) as string[];
      for (const c of chosen)
        if (!choices.some((x) => x.value === c))
          throw new Error(`no choice ${c}`);
      return chosen;
    },
    select: async (message, choices, fallback) => {
      if (message === SPEC_QUESTION) {
        specChoices.push({
          names: choices.map((c) => c.name),
          values: choices.map((c) => c.value),
          fallback,
        });
        asked.push(`select: ${message}`);
        log(`? select: ${message}`);
        return queue.specs.shift() ?? fallback!;
      }
      offered.push(choices.map((c) => c.value));
      selects.push({ names: choices.map((c) => c.name), fallback });
      return next("select", message) as string;
    },
    confirm: async (message, fallback) => {
      fallbacks[message] = fallback;
      return next("confirm", message) as boolean;
    },
    secret: async (message) => next("secret", message) as string,
    input: async (message, fallback) => {
      if (message !== BRANCH_QUESTION && message !== GATE_QUESTION)
        return next("input", message) as string;
      asked.push(`input: ${message}`);
      log(`? input: ${message}`);
      return (
        (message === GATE_QUESTION ? queue.gate : queue.branch).shift() ??
        fallback
      );
    },
  };
  return {
    ask,
    asked,
    offered,
    selects,
    descriptions,
    checkboxes,
    fallbacks,
    queue,
    specChoices,
  };
}

/** A preset a test's world holds: the settings its file gives, the files
 * it ships, the lines `factory preset add` would print for it, and why it
 * is refused, when it is. */
export type FakePreset = {
  about?: string;
  settings?: Record<string, unknown>;
  ships?: string[];
  summary?: string[];
  refuses?: string;
};

export type Setup = {
  answers: Answers;
  /** What `factory init` is given after its name. */
  argv?: string[];
  settings?: string;
  secrets?: Record<string, string>;
  remote?: string | null;
  /** Every remote of the checkout, in place of the one `remote` names
   * `origin`. */
  remotes?: { name: string; url: string }[];
  /** The repository each fork was made from, by the fork's name; `false`
   * when the code host cannot say. No repository is a fork unless given. */
  forks?: Record<string, string> | false;
  /** A repository with no branch on the code host yet: the branch the
   * checkout is on, and how many commits it has. */
  empty?: { branch: string; commits: number };
  /** What git answers a command, in place of the checkout's own answer:
   * undefined to leave it be. */
  git?: (args: string[]) => Partial<GitResult> | undefined;
  /** How each gate command ends; one not named passes, printing nothing. */
  gate?: Record<string, { status: number; output: string }>;
  /** The presets that exist, by name. */
  presets?: Record<string, FakePreset>;
  /** The presets the owner's `factory-config` holds, by name; there is no
   * such repository unless given. */
  config?: string[];
  /** The paths a sync would write. */
  syncs?: string[];
  /** Whether the sync fails; it works unless given. */
  syncFails?: boolean;
  packageJson?: boolean;
  boards?: { number: number; title: string; columns: string[] }[];
  signingNeedsScope?: boolean;
  rulesRefused?: string;
  eventsHeld?: boolean;
  eventsRefused?: string;
  createRefused?: string;
  files?: Record<string, string>;
  tokens?: Record<string, { account: string; scopes: string[] | null }>;
  tools?: (base: Registry, tickets: Tickets) => Registry;
  /** Whether the repository is private; public unless given. */
  private?: boolean;
  /** The code host's default branch; null when nobody can tell it. */
  defaultBranch?: string | null;
  /** The coding agent's answers. */
  agent?: Agent;
  /** The fields tickets can have, set on the ticket itself. */
  ticketFields?: TicketField[];
  /** The ticket system's optional groups; every one unless given. */
  ticketGroups?: Group[];
  ticketsFail?: NonNullable<Parameters<typeof memoryTickets>[1]>["fail"];
  dependabotSecrets?: Record<string, string>;
  /** Whether an organization owns the repository; a person unless given. */
  organization?: boolean;
  organizationSecrets?: string[];
  organizationVariables?: string[];
  organizationDependabotSecrets?: string[] | null;
  /** The repository's value for each property its owner defines. */
  properties?: Record<string, string | string[] | null>;
  /** Each workflow on the default branch; none unless given. */
  workflows?: Record<string, "active" | "disabled">;
  runnerFails?: NonNullable<Parameters<typeof memoryRunner>[0]>["fail"];
  codeHostFails?: NonNullable<Parameters<typeof memoryCodeHost>[1]>["fail"];
  paint?: Paint;
  checks?: Check[];
  /** The branch name a preset in effect supplies, if any. */
  presetBranchName?: string;
  /** The spec tool a preset in effect names, if any. */
  presetSpecs?: string;
  /** The install's status and standard error; it succeeds unless given. */
  install?: { status: number; stderr: string };
  /** The environment, beside a config folder of the test's own. */
  env?: Record<string, string>;
  /** Credentials on this machine before init runs, by site. */
  machine?: Record<string, Record<string, string>>;
};

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

type Raw = Record<string, unknown>;
const isRaw = (v: unknown): v is Raw =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Two settings as one, the later's values over the earlier's. */
const merged = (under: Raw, over: Raw): Raw => {
  const out: Raw = { ...under };
  for (const [key, value] of Object.entries(over))
    out[key] =
      isRaw(value) && isRaw(out[key]) ? merged(out[key] as Raw, value) : value;
  return out;
};

const has = (raw: unknown, key: string) => {
  let at = raw;
  for (const part of key.split(".")) {
    if (!isRaw(at) || !(part in at)) return false;
    at = at[part];
  }
  return true;
};

export function init(setup: Setup) {
  const root = mkdtempSync(join(tmpdir(), "init-"));
  roots.push(root);
  if (setup.packageJson !== false)
    writeFileSync(join(root, "package.json"), '{"name":"site"}\n');
  if (setup.settings !== undefined) {
    mkdirSync(join(root, ".claude"), { recursive: true });
    writeFileSync(join(root, ".claude/factory.yaml"), setup.settings);
  }
  for (const [path, text] of Object.entries(setup.files ?? {})) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  const env = {
    XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), "init-config-")),
    ...setup.env,
  };
  roots.push(env.XDG_CONFIG_HOME);
  for (const [site, values] of Object.entries(setup.machine ?? {}))
    writeCredential({ tool: "fake", site, values, env });
  const out: string[] = [];
  /** Every line printed and every question asked, in the order they came. */
  const transcript: string[] = [];
  /** Each question asked and each git command run, as `git fetch`, in the
   * order they came. */
  const events: string[] = [];
  const ran: string[][] = [];
  const opened: string[] = [];
  let synced = 0;
  /** Each gate command init ran, and the sync count when it ran. */
  const gates: { command: string; syncedBefore: number }[] = [];
  const {
    ask,
    asked,
    offered,
    selects,
    descriptions,
    checkboxes,
    fallbacks,
    queue,
    specChoices,
  } = scripted(setup.answers, (line) => {
    transcript.push(line);
    events.push(line);
  });
  /** Each install init ran, and the sync count when it ran. */
  const installs: {
    argv: string[];
    syncedBefore: number;
    /** \`package.json\` and the settings as they stood when it ran. */
    packageJson: string | null;
    settings: string | null;
  }[] = [];
  const host = memoryCodeHost([], {
    owner: "dave",
    tokens: {
      [GOOD]: { account: "dave", scopes: ["push", "workflows", "board"] },
      [NARROW]: { account: "dave", scopes: ["push"] },
      ...setup.tokens,
    },
    signingNeedsScope: setup.signingNeedsScope,
    rulesRefused: setup.rulesRefused,
    eventsHeld: setup.eventsHeld,
    eventsRefused: setup.eventsRefused,
    isPrivate: setup.private,
    defaultBranch: setup.defaultBranch ?? undefined,
    ownerIsOrganization: setup.organization,
    properties: setup.properties,
    fail: setup.codeHostFails,
  });
  /** What the code host answered each time the sync's plan asked it. */
  const branchAsked: string[] = [];
  const runner = memoryRunner({
    secrets: setup.secrets ?? {},
    dependabotSecrets: setup.dependabotSecrets,
    organizationSecrets: setup.organizationSecrets,
    organizationVariables: setup.organizationVariables,
    organizationDependabotSecrets: setup.organizationDependabotSecrets,
    workflows: setup.workflows,
    fail: setup.runnerFails,
  });
  const tickets = memoryTickets([], {
    boards: setup.boards ?? [],
    createRefused: setup.createRefused,
    ticketFields: setup.ticketFields,
    groups: setup.ticketGroups,
    fail: setup.ticketsFail,
  });
  /** Every git command init ran, and the remotes it read, in order. */
  const git: string[][] = [];
  let remotesRead = 0;
  /** Each repository the code host was asked about being a fork, and each
   * repository looked in for presets. */
  const forksAsked: string[] = [];
  const looked: string[] = [];
  /** The checkout as git answers for it: on the default branch with
   * nothing of its own, and every path asked about changed. */
  const branch = setup.empty?.branch ?? "main";
  /** Whether the checkout has a commit, and the code host a branch. */
  let committed = (setup.empty?.commits ?? 1) > 0;
  let pushed = setup.empty === undefined;
  const answer = (args: string[]): Partial<GitResult> => {
    const [command] = args;
    if (command === "commit") committed = true;
    if (command === "push") pushed = true;
    if (command === "symbolic-ref") return { stdout: `${branch}\n` };
    if (command === "rev-parse" && args.includes("--verify"))
      return { status: committed ? 0 : 1 };
    if (command === "rev-parse")
      return {
        stdout: args[1] === "FETCH_HEAD" ? "base000\n" : `${branch}\n`,
      };
    if (command === "rev-list")
      return {
        stdout:
          args.at(-1) === "HEAD" ? `${setup.empty?.commits ?? 1}\n` : "0\n",
      };
    if (command === "show-ref") return { status: 1 };
    // Asked for one branch by name, the remote has none of the setup's;
    // asked for every branch, it has the default one once anything is
    // pushed.
    if (command === "ls-remote")
      return args.includes("--exit-code")
        ? { status: 2 }
        : { stdout: pushed ? `base000\trefs/heads/${branch}\n` : "" };
    if (command === "cat-file")
      return { status: setup.settings === undefined ? 1 : 0 };
    if (command === "status")
      return {
        stdout: args
          .slice(args.indexOf("--") + 1)
          .map((path) => `?? ${path}\0`)
          .join(""),
      };
    return {};
  };
  /** A preset in effect that the settings do not list, as the tests of
   * the branch name and the spec tool give one. */
  const unlisted: Raw | null =
    setup.presetBranchName !== undefined || setup.presetSpecs !== undefined
      ? {
          ...(setup.presetBranchName === undefined
            ? {}
            : { "code-host": { "branch-name": setup.presetBranchName } }),
          ...(setup.presetSpecs === undefined
            ? {}
            : { specs: setup.presetSpecs }),
        }
      : null;
  const d: InitDeps = {
    root,
    ask,
    out: (line) => {
      out.push(line);
      transcript.push(line);
    },
    remotes: () => {
      remotesRead++;
      if (setup.remotes) return setup.remotes;
      if (setup.remote === null) return [];
      return [
        { name: "origin", url: setup.remote ?? "git@github.com:acme/site.git" },
      ];
    },
    git: (args) => {
      git.push(args);
      events.push(`git ${args[0]}`);
      return {
        status: 0,
        stdout: "",
        stderr: "",
        ...answer(args),
        ...setup.git?.(args),
      };
    },
    forkOf: async (_codeHost, repository) => {
      forksAsked.push(repository);
      if (setup.forks === false) throw new Error("not signed in");
      return setup.forks?.[repository] ?? null;
    },
    gate: async (command) => {
      ran.push(["gate", command]);
      gates.push({ command, syncedBefore: synced });
      return setup.gate?.[command] ?? { status: 0, output: "" };
    },
    presets: {
      held: async (repository) => {
        looked.push(repository);
        return setup.config && repository.endsWith("/factory-config")
          ? setup.config.map((name) => ({
              name,
              about: setup.presets?.[name]?.about ?? "",
            }))
          : null;
      },
      add: async (name, files, io) => {
        const preset = setup.presets?.[name];
        if (!preset || preset.refuses) {
          io.out(preset?.refuses ?? `${name}: not found, or private.`);
          return null;
        }
        for (const line of preset.summary ?? []) io.out(line);
        const doc = parseDocument(files.settings);
        doc.set("presets", [
          ...((doc.toJS()?.presets as string[] | undefined) ?? []),
          name,
        ]);
        return {
          ...files,
          settings: String(doc),
          lock: `${files.lock ?? ""}# pins ${name}\n`,
        };
      },
      combined: async (files): Promise<FromPresets | null> => {
        const own = (parseDocument(files.settings).toJS() ?? {}) as Raw;
        const names = (own.presets as string[] | undefined) ?? [];
        const layers = [
          ...(unlisted ? [unlisted] : []),
          ...names.map((n) => setup.presets?.[n]?.settings ?? {}),
        ];
        if (!layers.length) return null;
        const theirs = layers.reduce(merged, {});
        return {
          raw: merged(theirs, own),
          gives: (key) => has(theirs, key) && !has(own, key),
          ships: names.flatMap((n) => setup.presets?.[n]?.ships ?? []),
        };
      },
    },
    tools: (setup.tools ?? ((b) => b))(
      memoryTools({
        codeHost: host.codeHost,
        runner: runner.runner,
        tickets: tickets.tickets,
        agent: setup.agent,
      }),
      tickets.tickets,
    ),
    sync: async () => {
      synced++;
      return setup.syncFails ? 1 : 0;
    },
    syncChanges: async (_files, askHost) => {
      if (setup.defaultBranch === null)
        throw new NoDefaultBranch(
          "Could not tell the default branch. Run: git remote set-head origin --auto",
        );
      branchAsked.push(await askHost());
      return setup.syncs ?? [".claude/skills/factory-build/SKILL.md"];
    },
    interactive: async (argv) => {
      ran.push(argv);
      if (argv[0] === "grant") host.grantScope();
      return 0;
    },
    hasCommand: () => true,
    openPage: (url) => opened.push(url),
    keygen: async () => ({
      privateKey: PRIVATE_KEY,
      publicKey: "ssh-ed25519 PUBLIC",
    }),
    checks: async () =>
      setup.checks ?? [{ state: "pass", text: "Every check passed" }],
    packageName: "@davidbyoung/software-factory",
    packageVersion: "0.2.0",
    paint: setup.paint,
    install: async (argv) => {
      const at = (path: string) =>
        existsSync(join(root, path))
          ? readFileSync(join(root, path), "utf8")
          : null;
      installs.push({
        argv,
        syncedBefore: synced,
        packageJson: at("package.json"),
        settings: at(".claude/factory.yaml"),
      });
      return setup.install ?? { status: 0, stderr: "" };
    },
    env,
  };
  const read = (path: string) =>
    existsSync(join(root, path))
      ? readFileSync(join(root, path), "utf8")
      : null;
  return {
    run: () => main(setup.argv ?? [], d),
    d,
    env,
    out,
    transcript,
    asked,
    offered,
    selects,
    descriptions,
    checkboxes,
    fallbacks,
    queue,
    specChoices,
    installs,
    gates,
    ran,
    opened,
    git,
    events,
    remotesRead: () => remotesRead,
    forksAsked,
    looked,
    synced: () => synced,
    branchAsked,
    read,
    yaml: () =>
      load(read(".claude/factory.yaml") ?? "") as Record<string, unknown>,
    /** `tickets.columns` as the settings file stands. */
    columns: () =>
      (
        load(read(".claude/factory.yaml") ?? "") as {
          tickets?: { columns?: unknown };
        }
      ).tickets?.columns,
    host,
    runner,
    tickets,
  };
}

export const EVERY: Part[] = [
  "review",
  "board",
  "cloud",
  "auto-merge",
  "signing",
  "from-board",
];

export const SIX_COLUMNS = [
  "Backlog",
  "In refinement",
  "Ready",
  "In progress",
  "In review",
  "Done",
];

/** No pasted or made value reaches anything printed. */
export function printsNoSecret(out: string[]) {
  const text = out.join("\n");
  for (const v of VALUES) expect(text).not.toContain(v);
}
