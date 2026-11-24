// `factory init`: sets a repository up in one run. It settles which
// repository the checkout is for, follows the owner's presets, says what
// it found, asks only what nothing has decided, shows everything it will
// do, and once told to go ahead writes the settings, syncs, runs the gate,
// makes or connects the board, stores every secret through the runner,
// changes the repository's settings through the code host, and opens a
// pull request with the files it wrote.
//
// Tokens are read in a masked prompt and go straight to the runner, and to
// this machine's credentials file (`lib/credentials.mts`) where a person
// keeps one for their next repository: none is printed, written to any
// other file, or passed in a command's arguments.
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { isMap, parseDocument, Scalar, type Document } from "yaml";
import {
  builtOf,
  keptBy,
  secretSteps,
  TOOLS,
  type Registry,
} from "./tools.mts";
import { NeedsScopeError, NoRulesError } from "./code-host/types.mts";
import { organizationHosts } from "./code-host/index.mts";
import {
  branchPatternFault,
  columnsOf,
  filesDeps,
  parseSettings,
  resolveFiles,
  POLL_MINUTES,
  repoRoot,
  SETTINGS_FILE,
  SettingsError,
  type Settings,
} from "./config.mts";
import { colorOn, painter, type Paint } from "./lib/color.mts";
import {
  checks as doctorChecks,
  doctorDeps,
  JOBS_SETTING,
  printChecks,
} from "./doctor.mts";
import {
  branchDeps,
  needDefaultBranch,
  NoDefaultBranch,
  NoRemote,
  noRemoteLine,
  remoteFor,
} from "./lib/default-branch.mts";
import { hasCommand, noTerminal } from "./lib/has-command.mts";
import { DEFAULT_RUNNER, type Runner } from "./runner/index.mts";
import type { CodeHost } from "./code-host/index.mts";
import {
  addressOf,
  firstRefusal,
  NPMRC,
  npmrcAt,
  type Npmrc,
} from "./npmrc.mts";
import { listed } from "./lib/listed.mts";
import {
  credentialsPath,
  fileProblem,
  machineState,
  readCredential,
  refusedEnvLine,
  rememberedPresets,
  rememberPresets,
  shownPath,
  writeCredential,
  type MachineState,
} from "./lib/credentials.mts";
import { APP_CLIENT_ID, CONFIG, PROPERTY } from "./init-org.mts";
import {
  APP_KEY,
  BOARD_TOKEN,
  BUILD_TOKEN,
  neededSecrets,
  PART_TEXT,
  PARTS,
  partsOn,
  resolveParts,
  SIGNING_KEY,
  type Part,
} from "./parts.mts";
import {
  CHOICES_FILE,
  LOCK_FILE,
  OWN,
  ownerOf,
  parseName,
  PRESET_FILE,
} from "./preset.mts";
import {
  fetchCommit,
  fetchDeps,
  FetchError,
  lastGitLine,
  newestCommit,
  type FetchDeps,
} from "./preset-fetch.mts";
import { CONTEXT as REVIEW_VERDICT } from "./review-verdict.mts";
import {
  FACTORY_EVENTS,
  FACTORY_FILE,
  FACTORY_REPOSITORY,
  HELD_EVENT,
} from "./workflow-files.mts";
import {
  RULE,
  type Check,
  type Chosen,
  type CredentialStep,
  type SecretStep,
  type SetupContext,
} from "./setup.mts";
import { differences, PACKAGE, plan as syncPlan } from "./sync.mts";
import { STATE_KEYS, sameName, type StateKey } from "./lib/work-status.mts";
import {
  askReady,
  everyColumn,
  FACTORY_LINES,
  fillColumns,
  suggestColumns,
} from "./columns-suggest.mts";
import { FACTORY_FIELDS, suggestFields } from "./ticket-fields.mts";
import type { TicketField } from "./tickets/types.mts";
import {
  askCredential as readStepCredential,
  askSecret,
  boardShape,
  giveBoard,
  interactive,
  message,
  openPage,
  pasted,
  terminalAsk,
  type Ask,
  docsPage,
} from "./init-shared.mts";

export type { Ask };

/** The three files that decide the settings, as they read or will read. */
export type Files = {
  settings: string;
  choices: string | null;
  lock: string | null;
};

/** What the presets a repository follows give, combined with its own
 * settings. */
export type FromPresets = {
  /** The combined settings, as one file would write them. */
  raw: Record<string, unknown>;
  /** Whether a preset gives the value in effect at a key, such as
   * `tickets.board`, or any value under it. */
  gives: (key: string) => boolean;
  /** Each agent and skill file the presets ship, by its path here. */
  ships: string[];
};

export type Presets = {
  /** Each preset a repository holds, by its name and the first comment
   * line of its file, read for the repository `from`, which is being set
   * up. Null when the repository cannot be read. */
  held: (
    repository: string,
    codeHost: string,
    from: string,
  ) => Promise<{ name: string; about: string }[] | null>;
  /** Pins a preset as `factory preset add` does, in files that read as
   * `files`, with that command's summary and questions: the files as they
   * then read, or null when it refuses. Nothing is written. */
  add: (
    name: string,
    files: Files,
    io: Pick<InitDeps, "ask" | "out">,
  ) => Promise<Files | null>;
  /** What the presets the files list give, or null when they list none,
   * or cannot be combined. */
  combined: (files: Files) => Promise<FromPresets | null>;
};

export type GitResult = { status: number; stdout: string; stderr: string };

export type InitDeps = {
  root: string;
  ask: Ask;
  out: (line: string) => void;
  /** Each remote of the checkout, by its name and the address it fetches
   * from. */
  remotes: () => { name: string; url: string }[];
  /** Git, run in the checkout. */
  git: (args: string[]) => GitResult;
  /** The repository one was forked from, or null for one that is no fork,
   * or whose parent is gone. Rejects when the code host cannot say. */
  forkOf: (codeHost: string, repository: string) => Promise<string | null>;
  /** Runs one gate command from the root: its status, and everything it
   * printed. */
  gate: (command: string) => Promise<{ status: number; output: string }>;
  presets: Presets;
  tools: Registry;
  paint?: Paint;
  sync: () => Promise<number>;
  /** The files a sync with these files would write or delete. `host` asks
   * the code host for the default branch, where the checkout does not say.
   * It rejects with NoDefaultBranch when nobody can tell. */
  syncChanges: (
    files: Files,
    host: () => Promise<string>,
  ) => Promise<string[]> | string[];
  /** Runs a command attached to the terminal, as `claude setup-token`. */
  interactive: (argv: string[]) => Promise<number>;
  hasCommand: (name: string) => boolean;
  openPage: (url: string) => void;
  /** A new signing key's two halves, its files already deleted. */
  keygen: () => Promise<{ privateKey: string; publicKey: string }>;
  checks: () => Promise<Check[]>;
  packageName: string;
  packageVersion: string;
  /** Runs an install from the root; its status and standard error. */
  install: (argv: string[]) => Promise<{ status: number; stderr: string }>;
  /** Where the credentials file and a credential's variables are read. */
  env?: Record<string, string | undefined>;
};

const SIGNING_TITLE = "software factory builds";
/** Where each release's poller image is published. */
const POLLER_IMAGE = "ghcr.io/davidbyoung/software-factory-poller";
/** A month of runs at each interval the scheduled poller allows. */
const RUNS_A_MONTH = (minutes: number) => (30 * 24 * 60) / minutes;
const AGAIN = "Run factory init again to add it.";
const NOTHING = "Nothing changed.";
const NOTHING_ELSE = "Nothing else changed.";
const NOTHING_TO_COMMIT = "Nothing to commit: the files already match.";
const NOT_COMMITTED = "The files are written, and nothing is committed.";
const USAGE = "Usage: factory init [--preset NAME]... [--org ADDRESS]";
/** The branch the setup's commit is made on. */
const BRANCH = "set-up-factory";
const SET_UP = "Set up the software factory";
/** The message of the commit that gives an empty repository a branch. */
const FIRST_COMMIT = "Start the repository";
const CHANGE = "Change the software factory's settings";

/** Each state `tickets.columns` writes, as its columns or null for none,
 * from the settings as parsed YAML. */
function writtenColumnsOf(
  raw: unknown,
): Partial<Record<StateKey, readonly string[] | null>> {
  const tickets = (raw as { tickets?: unknown } | null)?.tickets;
  const columns = (tickets as { columns?: unknown } | null)?.columns;
  if (typeof columns !== "object" || columns === null) return {};
  return Object.fromEntries(
    Object.entries(columns)
      .filter(([k]) => k in STATE_KEYS)
      .map(([k, v]) => [
        k,
        v === "none" ? null : Array.isArray(v) ? v.map(String) : [String(v)],
      ]),
  );
}

/** The branch name a preset in effect supplies to the settings `text`
 * of the repository at `root`, or null for none. Settings whose presets
 * can't be read get the question: the check that follows says what is
 * wrong with them. */
export const presetBranchNameAt =
  (root: string) =>
  async (text: string): Promise<string | null> => {
    try {
      const r = await resolveFiles(
        { ...filesDeps(root), readFile: () => text },
        { partial: true },
      );
      return r.settings.codeHost.branchName;
    } catch {
      return null;
    }
  };

/** The spec tool a preset in effect names, as `presetBranchNameAt` finds
 * a branch name. */
export const presetSpecsAt =
  (root: string) =>
  async (text: string): Promise<string | null> => {
    try {
      const r = await resolveFiles(
        { ...filesDeps(root), readFile: () => text },
        { partial: true },
      );
      return "specs" in r.resolution.raw ? r.settings.specs : null;
    } catch {
      return null;
    }
  };

const NO_SPEC_TOOL = "None: each ticket holds its own spec";

const BRANCH_QUESTION =
  "How should a build name its branch? Use {ticket}, and {user} for the GitHub account:";

const GATE_QUESTION =
  "Which command checks a change here, such as npm test? (leave empty to add it later)";

/** The pattern a build names its branch by, asked until the answer is one
 * the settings check takes. */
async function askBranchName(d: InitDeps): Promise<string> {
  for (;;) {
    const answer = (await d.ask.input(BRANCH_QUESTION, "{ticket}")).trim();
    const fault = branchPatternFault(answer);
    if (!fault) return answer;
    d.out(fault);
  }
}

/** The repository and code host a remote's address names, or null for one
 * on a code host the factory does not support. */
export function parseRemote(
  url: string,
  tools: Registry = TOOLS,
): { codeHost: string; repository: string } | null {
  for (const [name, host] of Object.entries(tools.codeHost)) {
    const repository = host.repositoryOf(url);
    if (repository) return { codeHost: name, repository };
  }
  return null;
}

/** Deletes a key, then any map the deletion left empty above it. */
function remove(doc: Document, path: string[]) {
  if (!doc.hasIn(path)) return;
  doc.deleteIn(path);
  for (let i = path.length - 1; i > 0; i--) {
    const parent = doc.getIn(path.slice(0, i));
    if (isMap(parent) && parent.items.length === 0)
      doc.deleteIn(path.slice(0, i));
  }
}

const sameRepository = (a: string, b: string) =>
  a.toLowerCase() === b.toLowerCase();

/** The presets `--preset NAME` names, in order, or null when one has no
 * name after it. */
export function presetArgs(argv: string[]): string[] | null {
  const names: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== "--preset") continue;
    const name = argv[++i];
    if (!name || name.startsWith("--")) return null;
    names.push(name);
  }
  return names;
}

/** The repository being set up, its code host, and the remote whose
 * address is the repository. With `url`, the checkout has no such remote
 * yet: `remote` is the name it is to be added under, at that address. */
export type Where = {
  codeHost: string;
  repository: string;
  remote: string;
  url?: string;
};

/** Which repository the checkout is for, from its remotes: the one
 * repository they name when it is no fork, and otherwise the one chosen
 * from them and from what each fork was made from. A repository chosen
 * that is no remote yet comes with the name and address to add it at. An
 * exit status when it stops. The checkout is left as it was. */
export async function whichRepository(
  d: Pick<InitDeps, "remotes" | "tools" | "ask" | "out" | "forkOf">,
): Promise<Where | number> {
  const remotes = d.remotes();
  type Candidate = {
    codeHost: string;
    repository: string;
    remotes: { name: string; url: string }[];
    /** The repository it was forked from; undefined when nobody can say. */
    parent?: string | null;
  };
  const found: Candidate[] = [];
  for (const remote of remotes) {
    const at = parseRemote(remote.url, d.tools);
    if (!at) continue;
    const same = found.find((c) => sameRepository(c.repository, at.repository));
    if (same) same.remotes.push(remote);
    else found.push({ ...at, remotes: [remote] });
  }
  if (!found.length) {
    const hosts = listed(Object.values(d.tools.codeHost).map((t) => t.label));
    d.out(
      remotes.length === 1
        ? `The ${remotes[0]!.name} remote, ${remotes[0]!.url}, is not on a code host the factory supports: ${hosts}.`
        : remotes.length
          ? `No remote here is on a code host the factory supports: ${hosts}.`
          : "This is not a git repository with a remote. Run it in your repository's checkout.",
    );
    return 1;
  }
  for (const c of found)
    c.parent = await d.forkOf(c.codeHost, c.repository).catch(() => undefined);
  const only = found.length === 1 ? found[0]! : null;
  const at = (c: Candidate, remote: string, url?: string): Where => ({
    codeHost: c.codeHost,
    repository: c.repository,
    remote,
    ...(url === undefined ? {} : { url }),
  });
  if (only && only.parent === null) return at(only, remoteName(only.remotes));

  // What a fork was made from is offered whether or not it is a remote.
  const parents: Candidate[] = [];
  for (const c of found) {
    if (!c.parent) continue;
    const known = [...found, ...parents].some((o) =>
      sameRepository(o.repository, c.parent!),
    );
    if (!known)
      parents.push({
        codeHost: c.codeHost,
        repository: c.parent,
        remotes: [],
        parent: null,
      });
  }
  const offered = [
    ...parents,
    ...found.filter((c) => !c.parent),
    ...found.filter((c) => c.parent),
  ];
  const width = Math.max(...offered.map((c) => c.repository.length));
  const about = (c: Candidate) =>
    c.remotes.length
      ? `the remote${c.remotes.length === 1 ? "" : "s"} ${listed(c.remotes.map((r) => r.name))}${c.parent ? `, a fork of ${c.parent}` : ""}`
      : "no remote here yet";
  const picked = await d.ask.select(
    "Which repository are you setting up?",
    offered.map((c) => ({
      name: `${c.repository.padEnd(width)}   ${about(c)}`,
      value: c.repository,
    })),
  );
  const chosen = offered.find((c) => c.repository === picked)!;
  if (chosen.remotes.length) return at(chosen, remoteName(chosen.remotes));

  const taken = remotes.map((r) => r.name);
  let name = "upstream";
  for (let n = 2; taken.includes(name); n++) name = `upstream-${n}`;
  // The fork's own address with the repository swapped, so the new remote
  // is reached the same way, over SSH or HTTPS.
  const fork = found.find((c) => c.parent === chosen.repository)!;
  const start = fork.remotes[0]!.url.lastIndexOf(fork.repository);
  const swapped =
    fork.remotes[0]!.url.slice(0, start) +
    chosen.repository +
    fork.remotes[0]!.url.slice(start + fork.repository.length);
  const url =
    start >= 0 &&
    parseRemote(swapped, d.tools)?.repository === chosen.repository
      ? swapped
      : d.tools.codeHost[chosen.codeHost]!.open(chosen.repository).remote(
          chosen.repository,
        ).url;
  return at(chosen, name, url);
}

/** Adds the remote a repository chosen is to have, and says so, or says
 * why git would not. Whether it was added. */
export function addRemote(
  d: Pick<InitDeps, "git" | "out">,
  where: Where,
): boolean {
  const added = d.git(["remote", "add", where.remote, where.url!]);
  if (added.status !== 0) {
    d.out(
      `✗ Could not add the remote ${where.remote}: ${lastGitLine(added.stderr)}`,
    );
    d.out(NOTHING);
    return false;
  }
  d.out(`Added the remote ${where.remote}, ${where.repository}.`);
  return true;
}

/** The remote to use of several with one repository: `origin` when it is
 * among them, and otherwise the first. */
const remoteName = (remotes: { name: string }[]) =>
  (remotes.find((r) => r.name === "origin") ?? remotes[0]!).name;

/** A repository with no branch yet has nothing for a pull request to merge
 * into, so its first branch is pushed here, once the person says so: the
 * branch checked out, with a first, empty commit when the checkout has
 * none. The branch pushed, null for a repository that has a branch, or
 * that cannot be asked, and an exit status when it stops. */
export async function startRepository(
  d: Pick<InitDeps, "git" | "ask" | "out">,
  o: { repository: string; remote: string },
): Promise<{ branch: string } | null | number> {
  const heads = d.git(["ls-remote", "--heads", o.remote]);
  if (heads.status !== 0 || heads.stdout.trim() !== "") return null;
  const stop = (...lines: string[]) => {
    for (const line of lines) d.out(line);
    return 1;
  };
  const branch = d.git(["symbolic-ref", "--short", "HEAD"]).stdout.trim();
  if (!branch)
    return stop(
      `✗ ${o.repository} has no commits yet, and this checkout is on no branch. Switch to one, then run factory init again.`,
      NOTHING,
    );
  const unborn =
    d.git(["rev-parse", "--verify", "--quiet", "HEAD"]).status !== 0;
  const nothing = `${o.repository} has no commits yet, so a pull request has nothing to merge into.`;
  const push = `git push -u ${o.remote} ${branch}`;
  if (unborn) {
    const make = await d.ask.confirm(
      `${nothing} Make a first, empty commit on ${branch} and push it?`,
      true,
    );
    if (!make)
      return stop(
        `Push a first commit, then run factory init again: git commit --allow-empty -m "${FIRST_COMMIT}" && ${push}`,
        NOTHING,
      );
    // Only: whatever is staged stays staged, and out of the commit.
    const made = d.git([
      "commit",
      "--quiet",
      "--only",
      "--allow-empty",
      "--message",
      FIRST_COMMIT,
    ]);
    if (made.status !== 0)
      return stop(`✗ Could not commit: ${lastGitLine(made.stderr)}`, NOTHING);
  } else {
    const count = Number(d.git(["rev-list", "--count", "HEAD"]).stdout.trim());
    const go = await d.ask.confirm(
      `${nothing} Push ${branch}, which has ${count} commit${count === 1 ? "" : "s"} here?`,
      true,
    );
    if (!go)
      return stop(
        `Push ${branch}, then run factory init again: ${push}`,
        NOTHING,
      );
  }
  const pushed = d.git(["push", "--quiet", "--set-upstream", o.remote, branch]);
  if (pushed.status !== 0)
    return stop(
      `✗ Could not push ${branch} to ${o.repository}: ${pushRefusal(pushed.stderr)}`,
      unborn ? "The first commit is made here and not pushed." : NOTHING,
    );
  d.out(
    unborn ? `✓ Pushed a first commit to ${branch}.` : `✓ Pushed ${branch}.`,
  );
  return { branch };
}

/** Fetches the default branch from the repository's remote, and says
 * whether the commit checked out can hold the setup's commit: the commit
 * fetched, or an exit status when the checkout has commits that branch
 * lacks, or the fetch fails. */
export function checkedOut(
  d: Pick<InitDeps, "git" | "out">,
  o: { repository: string; remote: string; base: string },
): { sha: string } | number {
  const stop = (line: string) => {
    d.out(line);
    d.out(NOTHING);
    return 1;
  };
  const fetched = d.git(["fetch", "--quiet", o.remote, o.base]);
  if (fetched.status !== 0)
    return stop(
      `✗ Could not fetch ${o.base} from ${o.repository}: ${lastGitLine(fetched.stderr)}`,
    );
  const sha = d.git(["rev-parse", "FETCH_HEAD"]).stdout.trim();
  const ahead = Number(
    d.git(["rev-list", "--count", `${sha}..HEAD`]).stdout.trim(),
  );
  if (!(ahead > 0)) return { sha };
  const branch = d.git(["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
  const again = `Switch to ${o.base}, then run factory init again.`;
  return stop(
    branch && branch !== "HEAD"
      ? `✗ This checkout is on the branch ${branch}, which has commits ${o.base} does not. ${again}`
      : `✗ This checkout has commits ${o.base} does not. ${again}`,
  );
}

/** The presets a repository is to follow, pinned: those `--preset` names,
 * or those chosen from the ones the owner's `factory-config` holds, or
 * those this machine last used for the owner, when the person says so.
 * Settings that list presets already look for no other. The files as they
 * then read, or an exit status when a preset is refused. */
export async function followPresets(
  d: Pick<InitDeps, "ask" | "out" | "presets">,
  o: {
    owner: string;
    files: Files;
    /** The presets the settings list. */
    listed: string[];
    flags: string[];
    /** What the owner's `factory-config` holds, or null without one. */
    held: { name: string; about: string }[] | null;
    remembered: string[];
  },
): Promise<{ files: Files; added: string[]; asked: boolean } | number> {
  let names = o.flags;
  let asked = false;
  if (!o.flags.length && !o.listed.length) {
    if (o.held?.length) {
      const width = Math.max(...o.held.map((p) => p.name.length));
      asked = true;
      names = await d.ask.checkbox(
        `Which of ${o.owner}'s presets does this repository follow?`,
        o.held.map((p) => ({
          name: p.about ? `${p.name.padEnd(width)}  ${p.about}` : p.name,
          value: p.name,
          checked: !p.name.includes("//"),
        })),
      );
    } else if (!o.held && o.remembered.length) {
      asked = true;
      const one = o.remembered.length === 1;
      names = (await d.ask.confirm(
        `${o.owner}'s other repositories on this machine follow ${listed(o.remembered)}. Follow ${one ? "it" : "them"} here?`,
        true,
      ))
        ? o.remembered
        : [];
    }
  }
  let files = o.files;
  const added: string[] = [];
  for (const name of names) {
    if (o.listed.includes(name) || added.includes(name)) continue;
    const next = await d.presets.add(name, files, d);
    if (!next) {
      d.out(NOTHING);
      return 1;
    }
    files = next;
    added.push(name);
  }
  return { files, added, asked };
}

/** The value at a dotted path of settings as parsed YAML. */
function valueAt(raw: unknown, path: string[]): unknown {
  let at = raw;
  for (const key of path) {
    if (typeof at !== "object" || at === null || Array.isArray(at))
      return undefined;
    at = (at as Record<string, unknown>)[key];
  }
  return at;
}

/** A part the presets turn on, as the row that lists them names it. */
const PRESET_PARTS: [Part, string][] = [
  ["board", "a board"],
  ["review", "the review"],
  ["from-board", "builds that start from the board"],
];

/** The rows under "From the presets, so not asked": each answer the
 * presets give to a question setup would ask. */
export function presetRows(
  from: FromPresets,
  o: { tools: Registry; parts: (part: Part) => boolean },
): [string, string][] {
  const rows: [string, string][] = [];
  const at = (key: string) => valueAt(from.raw, key.split("."));
  if (from.gives("tickets.type") || from.gives("tickets.board")) {
    const type = String(at("tickets.type") ?? "github");
    const board = from.gives("tickets.board") ? at("tickets.board") : null;
    rows.push([
      "Tickets",
      `${o.tools.tickets[type]?.label ?? type}${board == null ? "" : ` on board ${board}`}`,
    ]);
  }
  if (from.gives("code-host.branch-name"))
    rows.push(["Branch names", String(at("code-host.branch-name"))]);
  if (from.gives("specs")) {
    const specs = at("specs");
    rows.push([
      "Spec tool",
      String(
        typeof specs === "object" && specs !== null
          ? ((specs as { type?: unknown }).type ?? "none")
          : specs,
      ),
    ]);
  }
  const gate = at("commands.gate");
  if (from.gives("commands.gate") && Array.isArray(gate) && gate.length)
    rows.push(["Gate", listed(gate.map(String))]);
  const parts = PRESET_PARTS.filter(([part]) => o.parts(part));
  if (parts.length) rows.push(["Parts", listed(parts.map(([, name]) => name))]);
  return rows;
}

/** What the presets ship that a sync would write, as the plan's `files`
 * row says it: `acme's own reviewer and skill`, with a count where there
 * is more than one of a kind. Null when they ship nothing. */
export function shipsText(
  paths: string[],
  o: { owner: string; ownPresets: boolean; reviewers: string[] },
): string | null {
  const agents = paths
    .map((p) => /^\.claude\/agents\/([^/]+)\.md$/.exec(p)?.[1])
    .filter((n): n is string => n !== undefined);
  const skills = new Set(
    paths
      .map((p) => /^\.claude\/skills\/([^/]+)\//.exec(p)?.[1])
      .filter((n): n is string => n !== undefined),
  ).size;
  const reviewers = agents.filter((a) => o.reviewers.includes(a)).length;
  const kinds: [number, string][] = [
    [reviewers, "reviewer"],
    [agents.length - reviewers, "agent"],
    [skills, "skill"],
  ];
  const shipped = kinds.filter(([n]) => n > 0);
  if (!shipped.length) return null;
  const counted = shipped.some(([n]) => n > 1);
  const words = shipped.map(([n, kind]) =>
    n > 1
      ? `${n} ${kind}s`
      : counted
        ? `${/^[aeiou]/.test(kind) ? "an" : "a"} ${kind}`
        : kind,
  );
  return `${o.ownPresets ? `${o.owner}'s` : "the presets'"} own ${listed(words)}`;
}

/** The plan's rows for the files setup writes: the settings, the copies,
 * and the workflows, in place of a row for each file. */
export function fileRows(
  paths: string[],
  ships: string | null,
): [string, string][] {
  const SETTINGS = [
    SETTINGS_FILE,
    LOCK_FILE,
    CHOICES_FILE,
    "package.json",
    ".gitignore",
  ];
  const settings = SETTINGS.filter((p) => paths.includes(p));
  const workflows = paths.filter((p) => p.startsWith(".github/workflows/"));
  const copies = paths.filter(
    (p) => !settings.includes(p) && !workflows.includes(p),
  );
  const rows: [string, string][] = [];
  if (settings.length) rows.push(["settings", `Write ${listed(settings)}`]);
  if (copies.length)
    rows.push([
      "files",
      `Copy the factory's skills, agents, rules, and guards${ships ? `, and ${ships}` : ""}`,
    ]);
  if (workflows.length)
    rows.push([
      "workflows",
      `Write ${listed([workflows[0]!, ...workflows.slice(1).map((p) => p.split("/").at(-1)!)])}`,
    ]);
  return rows;
}

/** Runs each gate command in turn, and says they pass, or which fails,
 * with the last five lines it printed. Whether they passed. */
export async function runGate(
  d: Pick<InitDeps, "gate" | "out">,
  commands: string[],
): Promise<boolean> {
  for (const command of commands) {
    const ran = await d.gate(command);
    if (ran.status === 0) continue;
    d.out(`✗ ${command} fails here, so a build could not finish:`);
    for (const line of ran.output.trimEnd().split("\n").slice(-5))
      d.out(`    ${line}`);
    d.out(
      `Fix it, or change commands.gate in ${SETTINGS_FILE}, then run factory init again. Nothing is committed.`,
    );
    return false;
  }
  d.out(
    `✓ ${listed(commands)} ${commands.length === 1 ? "passes" : "pass"} here.`,
  );
  return true;
}

/** The first name of the setup's branch that is taken neither here nor on
 * the remote: `set-up-factory`, then `set-up-factory-2`, and so on. */
export function freeBranch(d: Pick<InitDeps, "git">, remote: string): string {
  for (let n = 1; ; n++) {
    const name = n === 1 ? BRANCH : `${BRANCH}-${n}`;
    const here =
      d.git(["show-ref", "--verify", "--quiet", `refs/heads/${name}`])
        .status === 0;
    const there =
      d.git(["ls-remote", "--exit-code", "--heads", remote, name]).status === 0;
    if (!here && !there) return name;
  }
}

/** Why a push failed: what the remote said, or git's own last line. */
const pushRefusal = (stderr: string) =>
  stderr
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("remote:") && l.length > "remote:".length) ??
  lastGitLine(stderr);

/** Commits the paths setup wrote or deleted on a new branch, pushes it to
 * the repository's remote, and opens a pull request into the default
 * branch. Anything else changed or staged stays as it was. `opened` with
 * the pull request's number, `nothing` when no path changed, or `failed`
 * after the lines that say which step did and where the work is. */
export async function openPull(
  d: Pick<InitDeps, "git" | "out">,
  o: {
    codeHost: Pick<CodeHost, "create">;
    repository: string;
    remote: string;
    base: string;
    branch: string;
    paths: string[];
    title: string;
    body: string;
  },
): Promise<
  { state: "opened"; number: number } | { state: "nothing" | "failed" }
> {
  const status = d.git([
    "status",
    "--porcelain",
    "-z",
    "--no-renames",
    "--untracked-files=all",
    "--",
    ...o.paths,
  ]);
  const changed = status.stdout
    .split("\0")
    .filter(Boolean)
    .map((entry) => entry.slice(3));
  if (status.status === 0 && !changed.length) {
    d.out(NOTHING_TO_COMMIT);
    return { state: "nothing" };
  }
  for (const args of [
    ...(status.status === 0 ? [] : [null]),
    ["switch", "--quiet", "-c", o.branch],
    ["add", "--all", "--", ...changed],
    ["commit", "--quiet", "--message", o.title, "--", ...changed],
  ]) {
    const ran = args ? d.git(args) : status;
    if (ran.status === 0) continue;
    d.out(`✗ Could not commit: ${lastGitLine(ran.stderr)}`);
    d.out(NOT_COMMITTED);
    return { state: "failed" };
  }
  const pushed = d.git([
    "push",
    "--quiet",
    "--set-upstream",
    o.remote,
    o.branch,
  ]);
  if (pushed.status !== 0) {
    d.out(
      `✗ Could not push ${o.branch} to ${o.repository}: ${pushRefusal(pushed.stderr)}`,
    );
    d.out(
      `The commit is on the branch ${o.branch} here. Push it and open a pull request.`,
    );
    return { state: "failed" };
  }
  let number: number;
  try {
    number = await o.codeHost.create({
      title: o.title,
      head: o.branch,
      base: o.base,
      body: o.body,
      draft: false,
    });
  } catch (e) {
    d.out(`✗ Could not open a pull request in ${o.repository}: ${message(e)}`);
    d.out(`The branch ${o.branch} is pushed. Open a pull request from it.`);
    return { state: "failed" };
  }
  d.out(`✓ Opened ${o.repository}#${number}, "${o.title}".`);
  return { state: "opened", number };
}

/** What a person does once the pull request merges: after a first setup,
 * each step to a first ticket, and after a later one, only bringing the
 * default branch up to date. */
export function afterMerge(
  branch: string,
  first: boolean,
  version: string,
): string[] {
  const update = `git switch ${branch} && git pull`;
  if (!first)
    return [
      `After it merges, come back to ${branch} and bring it up to date: ${update}`,
    ];
  return [
    "After it merges:",
    `  1. Come back to ${branch} and bring it up to date:`,
    `       ${update}`,
    "  2. Start a new session of your coding agent here. It loads the factory from the files now in your repository.",
    "  3. Refine a ticket with /factory-refine N, then build it with /factory-build N.",
    "The steps in full:",
    `     ${docsPage(version, "quick-start.md#4-open-a-ticket")}`,
  ];
}

/** An organization's setup as one of its repositories sees it: whether the
 * app's client ID, its key, and a credential of the coding agent's reach
 * the repository, and which of the agent's is the one that does. */
export function organizationState(o: {
  variables: string[];
  secrets: string[];
  /** The names the coding agent's credential is read under. */
  agent: string[];
}): { setUp: boolean; stored: string[] } {
  const credential = o.agent.find((n) => o.secrets.includes(n));
  const setUp =
    o.variables.includes(APP_CLIENT_ID) &&
    o.secrets.includes(APP_KEY) &&
    credential !== undefined;
  return { setUp, stored: setUp ? [credential!, APP_KEY] : [] };
}

export async function main(argv: string[], deps: InitDeps): Promise<number> {
  // Every line and every question goes through here, so a blank line is
  // put only after a line or a question, and a stop says that nothing
  // changed only while nothing has.
  let printed = 0;
  let last = "";
  let changed = false;
  const noted =
    <A extends unknown[], R>(question: (...args: A) => Promise<R>) =>
    (...args: A) => {
      last = "?";
      return question(...args);
    };
  const d: InitDeps = {
    ...deps,
    out: (line) => {
      printed++;
      last = line;
      deps.out(line === NOTHING && changed ? NOTHING_ELSE : line);
    },
    ask: {
      checkbox: noted(deps.ask.checkbox),
      select: noted(deps.ask.select),
      confirm: noted(deps.ask.confirm),
      secret: noted(deps.ask.secret),
      input: noted(deps.ask.input),
    },
  };
  const gap = () => {
    if (last !== "") d.out("");
  };
  const at = (path: string) => join(d.root, path);
  const read = (path: string) =>
    existsSync(at(path)) ? readFileSync(at(path), "utf8") : null;
  const write = (path: string, text: string) => {
    mkdirSync(dirname(at(path)), { recursive: true });
    writeFileSync(at(path), text);
  };

  const flags = presetArgs(argv);
  if (!flags) {
    d.out(USAGE);
    return 2;
  }
  const settingsText = read(SETTINGS_FILE);
  let doc = parseDocument(settingsText ?? "");

  // The repository: the settings' line, or the one the remotes name.
  const line = doc.get("repository");
  let where: Where;
  if (typeof line === "string" && line) {
    const type = doc.getIn(["code-host", "type"]);
    const codeHost =
      typeof type === "string" && type in d.tools.codeHost
        ? type
        : Object.keys(d.tools.codeHost)[0]!;
    const remotes = d.remotes().map((r) => ({
      name: r.name,
      repository: parseRemote(r.url, d.tools)?.repository ?? null,
    }));
    const remote = remoteFor(line, remotes);
    if (remote === null) {
      d.out(noRemoteLine(line, remotes));
      return 1;
    }
    where = { codeHost, repository: line, remote };
  } else {
    const found = await whichRepository(d);
    if (typeof found === "number") return found;
    where = found;
  }
  const { repository } = where;
  const [owner, name] = repository.split("/") as [string, string];
  const built = builtOf(d.tools);

  let files: Files = {
    settings: settingsText ?? "",
    choices: read(CHOICES_FILE),
    lock: read(LOCK_FILE),
  };
  /** What the presets give, as the files stand. */
  let from: FromPresets | null = await d.presets.combined(files);
  /** The settings in effect: the presets', under the repository's own. */
  let settings: Settings | null = null;
  const parse = () =>
    parseSettings(
      from?.raw ?? doc.toJS(),
      // A file a preset ships is there once the sync has run.
      (p) => existsSync(at(p)) || (from?.ships.includes(p) ?? false),
      built,
      // A block that leaves states out is what the column step fills in.
      { partial: true },
    );
  if (settingsText !== null) {
    try {
      settings = parse();
    } catch (e) {
      d.out(`${SETTINGS_FILE}: ${message(e)}`);
      d.out("Fix it, then run init again.");
      return 1;
    }
  }
  /** Whether the repository's own settings or a preset give a value. */
  const given = (...path: string[]) =>
    doc.hasIn(path) || (from?.gives(path.join(".")) ?? false);
  /** A value as the settings in effect have it. */
  const inEffect = (...path: string[]) =>
    doc.getIn(path) ?? valueAt(from?.raw, path);
  /** The files as they will read, with the settings as they now stand. */
  const standingFiles = (): Files => ({ ...files, settings: String(doc) });
  /** The settings as the file will stand, for the board's columns and
   * fields and the gate; files the sync has yet to write don't matter to
   * those. */
  const standing = async (): Promise<Settings | null> => {
    try {
      const combined = from ? await d.presets.combined(standingFiles()) : null;
      return parseSettings(combined?.raw ?? doc.toJS(), () => true, built);
    } catch {
      return settings;
    }
  };
  const hasPackage = existsSync(at("package.json"));

  const codeHost = d.tools.codeHost[where.codeHost]!.open(repository);
  let base: string;
  try {
    base = await codeHost.defaultBranch();
  } catch (e) {
    d.out(`Could not reach the code host: ${message(e)}`);
    return 1;
  }
  // A remote that is yet to be added is read by its address: nothing in
  // the checkout changes before setup is told to go ahead.
  const reach = where.url ?? where.remote;
  // The one commit made on the default branch: an empty repository has no
  // other branch for the setup's pull request to merge into.
  const started = await startRepository(d, { repository, remote: reach });
  if (typeof started === "number") return started;
  if (started) {
    base = started.branch;
    changed = true;
  }
  const checkout = checkedOut(d, { repository, remote: reach, base });
  if (typeof checkout === "number") return checkout;

  // A kind with one tool is that tool; with several, the settings' choice,
  // or one asked for below.
  const only = (r: Record<string, unknown>) => {
    const names = Object.keys(r);
    return names.length === 1 ? names[0]! : null;
  };
  const named = () => ({
    tickets: settings?.tickets.type ?? null,
    runner: settings?.builds.runner ?? null,
  });
  const agentName = Object.keys(d.tools.agent)[0]!;
  const agent = d.tools.agent[agentName]!;
  const shown = (kind: "tickets" | "runner") => {
    const tools = d.tools[kind];
    if (only(tools)) return tools[only(tools)!]!.label;
    const choice = named()[kind];
    return choice
      ? `${tools[choice]!.label}, from your settings`
      : "chosen below";
  };

  const npmrc = npmrcAt(d.root);
  const env = d.env ?? process.env;
  // On a re-run, the credential the settings' ticket system keeps on this
  // machine, checked before anything is asked.
  const settingsTool = settings
    ? d.tools.tickets[settings.tickets.type]
    : undefined;
  const machineStep = settingsTool?.setup.credential?.machine
    ? settingsTool.setup.credential
    : null;
  const machineSite =
    settings && machineStep
      ? String(settings.tickets.options[machineStep.machine!.under] ?? "")
      : "";
  const machine: MachineState | null =
    settings && machineStep
      ? await machineState(machineStep, settings.tickets.type, machineSite, env)
      : null;
  /** A credential the ticket system accepted, to store from without
   * asking. */
  let fromMachine: { values: Record<string, string>; account: string } | null =
    machine?.state === "accepted" ? machine : null;

  // An owner the code host cannot tell is read as an organization, which
  // is asked for no token of a person's.
  const isOrganization = await codeHost.ownerIsOrganization().catch(() => true);
  const runnerName = only(d.tools.runner) ?? named().runner;
  // A plan may keep an organization's secrets from a private repository
  // while the runner still lists them for it: those reach no job.
  const withheld = isOrganization
    ? await codeHost.secretsWithheldBy().catch(() => null)
    : null;
  let organization = { setUp: false, stored: [] as string[] };
  /** Whether the organization is set up, though not for this repository. */
  let elsewhere = false;
  if (isOrganization && runnerName) {
    const early = d.tools.runner[runnerName]!.open(repository);
    const [shared, variables, own] = await Promise.all([
      early.organizationSecretNames().catch(() => []),
      early.organizationVariableNames().catch(() => []),
      early.secretNames().catch(() => []),
    ]);
    const state = (secrets: string[]) =>
      organizationState({
        variables,
        secrets,
        agent: agent.setup.kept?.secrets ?? [],
      });
    organization = state(withheld ? own : [...own, ...shared]);
    elsewhere = !organization.setUp && state([...own, ...shared]).setUp;
  }
  // What a person keeps on this machine for their next repository, filed
  // under the code host's name for the account.
  const site = `${codeHost.remote(repository).host}/${owner}`;
  const everyKept = keptBy(d.tools, {
    agent: agentName,
    codeHost: where.codeHost,
  });
  const keeps = isOrganization ? [] : everyKept;
  const keptProblem = keeps.length ? fileProblem(env) : null;
  const heldOn = (tool: string, entry: string): string | null => {
    if (keptProblem) return null;
    const found = readCredential({
      tool,
      site,
      names: [entry],
      env,
      fileOnly: true,
    });
    return found.state === "found" ? found.values[entry]! : null;
  };

  // The owner's presets, looked for by name unless something names them.
  const listedPresets = (): string[] => {
    const names = doc.toJS()?.presets;
    return Array.isArray(names) ? names.map(String) : [];
  };
  const config = `${owner}/${CONFIG}`;
  const looks = !flags.length && !listedPresets().length;
  const held =
    looks || (isOrganization && !organization.setUp)
      ? await d.presets.held(config, where.codeHost, repository)
      : null;
  const choosing = flags.length > 0 || (looks && (held?.length ?? 0) > 0);

  d.out(`Setting up the software factory for ${repository}`);
  d.out("");
  if (!agent.agent.installed(d.hasCommand)) {
    d.out(
      `The factory runs in a coding agent, and ${agent.label} is not installed.`,
    );
    d.out("Install it and run factory init again.");
    d.out(NOTHING);
    return 1;
  }
  d.out("Found");
  const width = isOrganization ? 16 : 14;
  const row = (label: string, text: string) =>
    d.out(`  ${label.padEnd(width)} ${text}`);
  row(
    "Code host",
    `${d.tools.codeHost[where.codeHost]!.label} (from your git remote)`,
  );
  if (!isOrganization) row("Account", `${owner}, a personal account`);
  else if (organization.setUp)
    row(
      "Organization",
      `${owner}, set up: its app's key and its ${agent.setup.kept?.what ?? "coding agent's token"} are stored`,
    );
  else
    row(
      "Organization",
      held || elsewhere
        ? `${owner}, set up, but its secrets do not reach this repository: GitHub Free shares them only with public repositories, or an owner narrowed them`
        : `${owner}, not set up: an owner runs factory init --org ${organizationHosts()[where.codeHost]?.addressOf(owner) ?? owner}`,
    );
  if (looks && held) row("Presets", `${config} holds ${held.length}`);
  // The presets chosen below say which ticket system and board.
  if (!choosing) row("Tickets", shown("tickets"));
  row(
    "Coding agent",
    agent.setup.found?.({ hasCommand: d.hasCommand }) ?? agent.label,
  );
  row("Cloud builds", shown("runner"));
  if (npmrc.names.length) row(NPMRC, `reads ${npmrc.names.join(", ")}`);
  row("Settings", settingsText === null ? "none yet" : SETTINGS_FILE);
  if (!choosing)
    row(
      "Board",
      settings?.tickets.board != null
        ? `${settings.tickets.board}, from your settings`
        : "none yet",
    );
  if (machine && machine.state !== "unreadable")
    row(
      "This machine",
      machine.state === "missing"
        ? `no ${settingsTool!.label} credential for ${machineSite}`
        : machine.state === "refused"
          ? `${settingsTool!.label} refused the credential for ${machineSite}`
          : `${settingsTool!.label} credential for ${machineSite}`,
    );
  if (keeps.length && !keptProblem) {
    // The code host's token first, which every cloud run needs.
    const [token, ...others] = keeps;
    row(
      "This machine",
      [
        heldOn(token!.name, token!.kept.name)
          ? `a ${token!.kept.what} for ${owner}`
          : `no ${token!.kept.what} for cloud runs`,
        ...others
          .filter((k) => heldOn(k.name, k.kept.name))
          .map((k) => `a ${k.kept.what}`),
      ].join(", and "),
    );
  }
  d.out("");
  if (isOrganization && !organization.setUp) {
    d.out(
      `Builds on your machine work now. The review and builds in the cloud stay off until ${owner} is set up.`,
    );
    d.out("");
  }
  if (machine?.state === "unreadable") {
    d.out(machine.line);
    return 1;
  }
  if (keptProblem) {
    d.out(keptProblem.line);
    return 1;
  }
  // Variables the system refuses still win over the file, so what fixes
  // them is replacing them where they are set.
  if (machine?.state === "refused" && machine.source === "env") {
    d.out(
      refusedEnvLine(
        settingsTool!.label,
        machineStep!.parts.map((p) => p.name),
        machineSite,
        machine.reason,
        env,
      ),
    );
    d.out("");
  }
  const refused = firstRefusal(npmrc);
  if (refused) {
    d.out(refused);
    return 1;
  }

  const askCredential = (step: CredentialStep, at: string) =>
    readStepCredential(d, step, at, AGAIN);

  // This machine's credential, missing or refused: asked for first, since
  // a teammate may not be allowed to list the repository's secrets.
  if (
    settings &&
    machineStep &&
    (machine?.state === "missing" ||
      (machine?.state === "refused" && machine.source === "file"))
  ) {
    const got = await askCredential(machineStep, machineSite);
    if (got) {
      writeCredential({
        tool: settings.tickets.type,
        site: machineSite,
        values: got.values,
        env,
      });
      d.out(`It belongs to ${got.account}. Stored on this machine.`);
      fromMachine = got;
      changed = true;
    }
    d.out("");
    try {
      await d.tools.runner[settings.builds.runner]!.open(
        repository,
      ).secretNames();
    } catch (e) {
      d.out(
        `Could not list the repository's secrets, so the parts are left as they are: ${message(e)}`,
      );
      return 0;
    }
    if (!(await d.ask.confirm("Change which parts are on?", false))) {
      d.out(NOTHING);
      return 0;
    }
  }

  // The presets, pinned in files that are written only once told to go
  // ahead. A first run's settings start as the two lines every file has.
  const followed = await followPresets(d, {
    owner,
    files:
      settingsText === null
        ? { ...files, settings: `version: 2\nrepository: ${repository}\n` }
        : files,
    listed: listedPresets(),
    flags,
    held: looks ? held : null,
    remembered: looks && !held ? rememberedPresets(site, env) : [],
  });
  if (typeof followed === "number") return followed;
  if (followed.added.length) {
    files = followed.files;
    doc = parseDocument(files.settings);
    from = await d.presets.combined(files);
    try {
      settings = parse();
    } catch (e) {
      d.out(`The settings would not be valid: ${message(e)}`);
      d.out(NOTHING);
      return 1;
    }
  }
  /** Whether a preset turns a part on. */
  const presetOn = (part: Part): boolean =>
    from !== null &&
    settings !== null &&
    (part === "review"
      ? from.gives("pr-review")
      : part === "board"
        ? from.gives("tickets.board") && settings.tickets.board !== null
        : part === "from-board"
          ? from.gives("builds.trigger") && settings.builds.trigger !== "manual"
          : false);
  const notAsked: string[] = [];
  if (from) {
    const rows = presetRows(from, { tools: d.tools, parts: presetOn });
    if (rows.length) notAsked.push("From the presets, so not asked");
    for (const [label, text] of rows)
      notAsked.push(`  ${label.padEnd(width)} ${text}`);
  }
  if (organization.setUp)
    notAsked.push(
      `Stored for ${owner}, so not asked`,
      `  ${listed(organization.stored)}, which turn on builds in the cloud`,
    );
  if (notAsked.length) {
    gap();
    for (const l of notAsked) d.out(l);
    d.out("");
  }

  const pick = async (kind: "tickets" | "runner", question: string) => {
    const tools = d.tools[kind];
    if (only(tools)) return only(tools)!;
    const first = named()[kind];
    if (
      first &&
      from?.gives(kind === "tickets" ? "tickets.type" : "builds.runner")
    )
      return first;
    const names = Object.keys(tools).sort((a, b) =>
      a === first ? -1 : b === first ? 1 : 0,
    );
    return d.ask.select(
      question,
      names.map((n) => ({ name: tools[n]!.label, value: n })),
    );
  };
  const chosenTickets = await pick("tickets", "Which ticket system?");
  // A credentials file that cannot be read stops a first setup once the
  // ticket system that would read it is chosen.
  if (
    settingsText === null &&
    d.tools.tickets[chosenTickets]!.setup.credential?.machine
  ) {
    const problem = fileProblem(env);
    if (problem) {
      d.out(problem.line);
      return 1;
    }
  }
  const chosen: Chosen = {
    codeHost: where.codeHost,
    tickets: chosenTickets,
    runner: await pick("runner", "Where do cloud builds run?"),
    agent: agentName,
  };
  const branchName = given("code-host", "branch-name")
    ? null
    : await askBranchName(d);
  const ownSpecs = inEffect("specs");
  const writtenSpecs = isMap(ownSpecs)
    ? String(ownSpecs.get("type") ?? "none")
    : typeof ownSpecs === "object" && ownSpecs !== null
      ? String((ownSpecs as { type?: unknown }).type ?? "none")
      : ownSpecs === undefined
        ? null
        : String(ownSpecs);
  const specsAnswer =
    writtenSpecs === null
      ? await d.ask.select(
          "Which spec tool do you use?",
          [
            { name: NO_SPEC_TOOL, value: "none" },
            ...Object.entries(d.tools.specs).map(([value, t]) => ({
              name: t.label,
              value,
            })),
          ],
          "none",
        )
      : null;
  const specTool = d.tools.specs[specsAnswer ?? writtenSpecs ?? "none"];
  const installing =
    specTool && !specTool.install.installed(d.root) ? specTool : null;
  // npm installs into the nearest folder above that has a package.json, so
  // a spec tool it installs gets a private one here first, and its
  // node_modules stays out of git.
  const withNpm = installing?.install.via.startsWith("npm ") ?? false;
  const ignored = /^\/?node_modules\/?$/m.test(read(".gitignore") ?? "");

  const runner = d.tools.runner[chosen.runner]!.open(repository);
  const tickets = await d.tools.tickets[chosen.tickets]!.open(
    { repository, board: null },
    settings,
    fromMachine ? { credential: fromMachine.values } : {},
  );
  const context = (parts: Iterable<Part>): SetupContext => ({
    repository,
    root: d.root,
    parts: new Set(parts),
    chosen,
    settings,
    hasCommand: d.hasCommand,
    opened: { codeHost, runner, tickets },
  });
  let own: string[];
  let npm: NpmSecrets;
  // A secret the organization shares with the repository counts as set.
  let shared: string[] = [];
  try {
    own = await runner.secretNames();
    if (isOrganization && !withheld)
      shared = await runner.organizationSecretNames().catch(() => []);
    npm = await npmSecrets(npmrc, runner, codeHost, isOrganization);
  } catch (e) {
    d.out(`Could not reach the code host: ${message(e)}`);
    return 1;
  }
  const secrets = [...own, ...shared];
  const isSet = (n: string) => secrets.includes(n);
  /** A secret a person keeps on their machine too, which an organization
   * stores once for all its repositories. */
  const isKept = (s: { step: SecretStep | CredentialStep }) =>
    s.step.kind === "secret" && s.step.machine !== undefined;

  const cloudNeeds = secretSteps(d.tools, context(["cloud"])).flatMap((s) =>
    s.step.needs.filter((n) => n.part === "cloud"),
  );
  const before = partsOn(settings, secrets, cloudNeeds);
  const first = settingsText === null;
  // In an organization's repository no token of a person's is asked for,
  // so a part is offered only when the secrets it reads are there.
  const met = (part: Part) =>
    secretSteps(d.tools, context([part]))
      .filter(isKept)
      .flatMap((s) => s.step.needs.filter((n) => n.part === part))
      .every((n) => n.anyOf.some(isSet));
  const reachable = (part: Part) =>
    met(part) &&
    (part !== "from-board" || (met("cloud") && met("board"))) &&
    (part !== "signing" || met("cloud"));
  const offered = PARTS.filter(
    (part) =>
      !presetOn(part) &&
      (!isOrganization ||
        (organization.setUp
          ? part !== "cloud" && part !== "signing"
          : reachable(part))),
  );
  const chosenParts = offered.length
    ? await d.ask.checkbox(
        isOrganization ? "Also turn on here?" : "Which parts do you want?",
        offered.map((part) => ({
          name: PART_TEXT[part].name,
          description: PART_TEXT[part].gives,
          value: part,
          checked: first
            ? part === "review" || part === "board" || part === "cloud"
            : before.has(part),
        })),
      )
    : [];
  const resolved = resolveParts(
    before,
    new Set([
      ...(chosenParts as Part[]),
      ...PARTS.filter((p) => before.has(p) && !offered.includes(p)),
    ]),
    // In an organization's repository a part that is not offered reads a
    // secret that is not there, and no token is asked for to turn it on.
    (part) => !isOrganization || offered.includes(part),
  );
  const parts = resolved.parts;
  for (const note of resolved.notes) d.out(note);
  const removed = PARTS.filter((p) => before.has(p) && !parts.has(p));

  // The board: the one in the settings, or one chosen now.
  const boardOps = tickets.board;
  let board: number | "new" | null = parts.has("board")
    ? (settings?.tickets.board ?? null)
    : null;
  /** A board a preset names is its owner's to shape. */
  const ownBoard = !(from?.gives("tickets.board") ?? false);
  const chooseBoard = async (
    offerNew: boolean,
  ): Promise<number | "new" | null> => {
    const existing = boardOps ? await boardOps.list() : [];
    if (!offerNew && existing.length === 0) {
      d.out(
        "No board to use instead: create one on the code host, then run factory init again.",
      );
      return null;
    }
    const choice = await d.ask.select("Which board?", [
      ...(offerNew
        ? [
            {
              name: `Create "${name}", with the factory's columns`,
              value: "new",
            },
          ]
        : []),
      ...existing.map((b) => ({
        name: `Use an existing one: ${b.title} (#${b.number})`,
        value: String(b.number),
      })),
    ]);
    return choice === "new" ? "new" : Number(choice);
  };
  if (parts.has("board") && board === null) board = await chooseBoard(true);

  let allow = settings?.autoMerge.allow ?? [];
  if (parts.has("auto-merge") && allow.length === 0)
    allow = (
      await d.ask.input(
        "Which files may merge without you? (comma-separated)",
        "docs/**, **/*.md",
      )
    )
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  // Where the poller runs, asked only when the part is new: a re-run keeps
  // what the settings say, as it does every value already set.
  let trigger = settings?.builds.trigger ?? "manual";
  let pollMinutes: number | null = null;
  if (parts.has("from-board") && !before.has("from-board")) {
    trigger = (await d.ask.select("Where does the poller run?", [
      {
        name: "A schedule on GitHub Actions, every 5 minutes, nothing to host",
        value: "github-action",
      },
      { name: "A server you host, within a minute", value: "own-server" },
    ])) as typeof trigger;
    if (
      trigger === "github-action" &&
      (await codeHost.isPrivate().catch(() => true))
    ) {
      d.out(
        "Each run bills at least one Actions minute on a private repository.",
      );
      pollMinutes = Number(
        await d.ask.select(
          "How often?",
          POLL_MINUTES.map((m) => ({
            name: `Every ${m} minutes, ${RUNS_A_MONTH(m).toLocaleString("en-US")} runs a month`,
            value: String(m),
          })),
          "30",
        ),
      );
    }
  }

  // The board's columns, all six written: the coding agent suggests them
  // when an existing board lacks one of the factory's and the settings
  // name none, a block that leaves states out is filled in, and a ready
  // column is asked for when builds from the board turn on without one.
  let columnLines: [string, string][] = [];
  let readyColumn: string | null | undefined;
  const writtenColumns = writtenColumnsOf(from?.raw ?? doc.toJS());
  const missing = (Object.keys(STATE_KEYS) as StateKey[]).filter(
    (k) => !(k in writtenColumns),
  );
  if (parts.has("board") && typeof board === "number" && boardOps) {
    const asksReady =
      parts.has("from-board") &&
      !before.has("from-board") &&
      settings?.tickets.columns.ready === null;
    const suggests = missing.length === Object.keys(STATE_KEYS).length;
    let names: string[] = [];
    if (missing.length || asksReady)
      try {
        names = await boardOps.columns(board);
      } catch (e) {
        d.out(`Could not read board ${board}'s columns: ${message(e)}`);
        d.out(NOTHING);
        return 1;
      }
    const lacks = Object.values(STATE_KEYS).some(
      (f) => !names.some((n) => sameName(n, f)),
    );
    const fromBoard = parts.has("from-board") && trigger !== "manual";
    if (suggests && names.length && lacks) {
      const got = await suggestColumns(
        {
          ask: d.ask,
          out: d.out,
          agent: agent.agent,
          label: agent.label,
        },
        { board, columns: names, fromBoard, byHand: true },
      );
      if (got === 1) return 1;
      columnLines = got;
    } else if (suggests && names.length)
      columnLines = everyColumn(d, { board, columns: names });
    else if (suggests) columnLines = FACTORY_LINES;
    else if (missing.length)
      columnLines = await fillColumns(
        { ask: d.ask, out: d.out },
        { board, columns: names, written: writtenColumns, fromBoard },
      );
    else if (asksReady && settings)
      readyColumn = await askReady(
        { ask: d.ask, out: d.out },
        { columns: names, current: columnsOf(settings) },
      );
  }

  // The factory fields a refined ticket has: the coding agent suggests
  // which of the tickets' text fields holds each, when the settings name
  // none of the four.
  let fieldLines: [string, string][] = [];
  if (
    tickets.fields &&
    !FACTORY_FIELDS.some((f) => given("tickets", "fields", f.key))
  ) {
    let text: TicketField[];
    try {
      text = (await tickets.fields.list()).filter((f) => f.text);
    } catch (e) {
      d.out(`Could not read ${repository}'s ticket fields: ${message(e)}`);
      d.out(NOTHING);
      return 1;
    }
    if (text.length) {
      const got = await suggestFields(
        { ask: d.ask, out: d.out, agent: agent.agent, label: agent.label },
        {
          repository,
          fields: text,
          plainText: tickets.fields.plainText
            ? d.tools.tickets[chosen.tickets]!.label
            : null,
        },
      );
      if (got === 1) return 1;
      fieldLines = got;
    }
  }

  // The settings as they will stand, keeping every other key and comment.
  // A value a preset gives is not written again.
  if (!doc.has("version")) doc.set("version", 2);
  if (!doc.has("repository")) doc.set("repository", repository);
  // A tool other than the one a setting defaults to is written down.
  if ((inEffect("tickets", "type") ?? "github") !== chosen.tickets)
    doc.setIn(["tickets", "type"], chosen.tickets);
  if ((inEffect("builds", "runner") ?? DEFAULT_RUNNER) !== chosen.runner)
    doc.setIn(["builds", "runner"], chosen.runner);
  if (parts.has("board") && typeof board === "number" && ownBoard)
    doc.setIn(["tickets", "board"], board);
  for (const [key, name] of columnLines)
    doc.setIn(["tickets", "columns", key], name);
  for (const [key, name] of fieldLines)
    doc.setIn(["tickets", "fields", key], name);
  if (readyColumn !== undefined)
    doc.setIn(["tickets", "columns", "ready"], readyColumn ?? "Ready");
  if (!parts.has("board")) {
    for (const key of ["board", "columns"]) remove(doc, ["tickets", key]);
    for (const key of ["session", "runs-in", "cost"])
      remove(doc, ["tickets", "fields", key]);
  }
  if (branchName !== null) {
    if (!isMap(doc.get("code-host")))
      doc.set("code-host", doc.createNode({ type: chosen.codeHost }));
    // Quoted: YAML reads a pattern that starts with `{` as a map.
    const quoted = new Scalar(branchName);
    quoted.type = Scalar.QUOTE_DOUBLE;
    doc.setIn(["code-host", "branch-name"], quoted);
  }
  if (specsAnswer !== null) doc.set("specs", specsAnswer);
  if (parts.has("from-board")) {
    if (!presetOn("from-board")) doc.setIn(["builds", "trigger"], trigger);
  } else if (before.has("from-board")) remove(doc, ["builds", "trigger"]);
  if (pollMinutes !== null && pollMinutes !== 5)
    doc.setIn(["builds", "poll-minutes"], pollMinutes);
  if (!parts.has("from-board") || trigger !== "github-action")
    remove(doc, ["builds", "poll-minutes"]);
  if (parts.has("auto-merge")) doc.setIn(["auto-merge", "allow"], allow);
  else remove(doc, ["auto-merge", "allow"]);
  // The review is on while its setting is written; the sync writes its
  // workflow then, and removes it once the setting is gone.
  if (parts.has("review") && !given("pr-review"))
    doc.setIn(["pr-review", "commands"], []);
  if (!parts.has("review")) doc.delete("pr-review");

  // The ticket system's own values: asked for once, and taken out with
  // the part that needed them.
  const values = (ps: Iterable<Part>) =>
    (d.tools.tickets[chosen.tickets]!.setup.steps?.(context(ps)) ?? []).filter(
      (s) => s.kind === "value",
    );
  for (const step of values(parts)) {
    if (step.part !== null && !parts.has(step.part)) continue;
    if (given("tickets", step.key)) continue;
    doc.setIn(
      ["tickets", step.key],
      await d.ask.input(step.ask, step.fallback ?? ""),
    );
  }
  for (const step of values(removed))
    if (step.part !== null && removed.includes(step.part))
      remove(doc, ["tickets", step.key]);

  // The one command that checks a change, when nothing names any.
  if (!settings?.commands.gate.length) {
    const command = (await d.ask.input(GATE_QUESTION, "")).trim();
    if (command) doc.setIn(["commands", "gate"], [command]);
  }

  // The secrets: those the parts read that are not set, or all of them when
  // you choose to replace them.
  const every = secretSteps(d.tools, context(parts));
  const steps = isOrganization ? every.filter((s) => !isKept(s)) : every;
  const needed = neededSecrets(parts, steps);
  const npmBothSet = npm.tokens.filter(
    (n) => isSet(n) && npm.dependabot(n) === "set",
  );
  const alreadySet = [
    ...new Set([
      ...needed.flatMap((n) => n.anyOf.filter(isSet)),
      ...npmBothSet,
    ]),
  ];
  let replace = false;
  if (alreadySet.length)
    replace = await d.ask.confirm(
      alreadySet.length === 1
        ? "1 secret these parts read is already set. Replace it?"
        : `${alreadySet.length} secrets these parts read are already set. Replace them?`,
      false,
    );
  const unmet = (step: { needs: { part: Part | null; anyOf: string[] }[] }) =>
    step.needs.some(
      (n) => (n.part === null || parts.has(n.part)) && !n.anyOf.some(isSet),
    );
  const asked = steps
    .filter(({ step }) => replace || unmet(step))
    .map(({ step, name: tool }) => ({
      step,
      tool,
      // A credential's parts are checked together, so all are stored.
      names:
        step.kind === "secret"
          ? step.storeAs.filter((n) => replace || !isSet(n))
          : step.parts.some((p) => replace || !isSet(p.name))
            ? step.parts.map((p) => p.name)
            : [],
    }))
    .filter((a) => a.names.length > 0);
  // A credential kept on the machine: the site it is filed under, and on
  // a first setup the one the file already holds for it, when accepted.
  const siteOf = (step: CredentialStep) =>
    step.machine ? String(inEffect("tickets", step.machine.under) ?? "") : "";
  const machineAsked = asked.find(
    (a): a is { step: CredentialStep; tool: string; names: string[] } =>
      a.step.kind === "credential" && a.step.machine !== null,
  );
  if (machineAsked && !fromMachine) {
    const found = await machineState(
      machineAsked.step,
      chosen.tickets,
      siteOf(machineAsked.step),
      env,
    );
    if (found.state === "accepted") fromMachine = found;
  }
  const storesOnMachine = machineAsked !== undefined && !fromMachine;
  // A person's own tokens: each one this machine holds that still serves
  // is stored from here, and each other is asked for and kept here.
  const keptAsked = asked.flatMap((a) => {
    const kept = keeps.find((k) => k.name === a.tool)?.kept;
    return a.step.kind === "secret" && a.step.machine && kept
      ? [{ ...a, step: a.step, kept }]
      : [];
  });
  const servedFrom = new Map<SecretStep, { value: string; account?: string }>();
  const stale = new Map<SecretStep, string>();
  for (const a of keptAsked) {
    const value = heldOn(a.tool, a.kept.name);
    if (value === null) continue;
    try {
      const served = (await a.step.machine!.serves?.(value, owner)) ?? {};
      servedFrom.set(a.step, { value, account: served.account });
    } catch (e) {
      stale.set(a.step, message(e));
    }
  }
  const keeping = keptAsked.filter((a) => !servedFrom.has(a.step));
  const wantsKey = parts.has("signing") && (replace || !isSet(SIGNING_KEY));
  const npmAsked = npm.tokens
    .map((name) => {
      const again = replace && npmBothSet.includes(name);
      return {
        name,
        actions: again || !isSet(name),
        dependabot: again || npm.dependabot(name) !== "set",
        unseen: !again && npm.dependabot(name) === "unknown",
      };
    })
    .filter((a) => a.actions || a.dependabot);

  // A secret a part that went read is the repository's to delete, and so
  // is its own copy of one the organization now stores for it.
  const stillRead = new Set(
    neededSecrets(parts, every).flatMap((n) => n.anyOf),
  );
  const covered = organization.setUp
    ? [...everyKept.flatMap((k) => k.kept.secrets), SIGNING_KEY].filter((n) =>
        own.includes(n),
      )
    : [];
  const deletable = [
    ...new Set([
      ...neededSecrets(new Set(removed), secretSteps(d.tools, context(removed)))
        .flatMap((n) => n.anyOf)
        .filter((n) => own.includes(n) && !stillRead.has(n)),
      ...covered,
    ]),
  ];

  // The rule that requires the review's verdict. An organization's own
  // rule covers each repository once the first run sets the property the
  // organization defines, and a repository's rule waits for the workflow
  // that posts the verdict to be on the default branch: a pull request
  // that adds the workflow would wait forever. An organization that will
  // not say whether it defines the property is taken to define none,
  // which leaves the rule to an admin.
  const ownerRule =
    isOrganization &&
    (await codeHost.ownerDefines(PROPERTY).catch(() => false));
  // Where the plan has no branch rules for the repository, none is
  // planned and nobody is left to make one.
  const noRules =
    parts.has("review") &&
    !ownerRule &&
    (await codeHost.requiresStatus(base, REVIEW_VERDICT).then(
      () => false,
      (e) => e instanceof NoRulesError,
    ));
  const rule = parts.has("review") && !ownerRule && !noRules;
  const posts =
    rule &&
    (await runner
      .workflowState(FACTORY_FILE.split("/").at(-1)!)
      .catch(() => "missing")) !== "missing";

  // The plan.
  const newText = String(doc);
  const writes = [
    ...(newText !== settingsText ? [SETTINGS_FILE] : []),
    ...(files.lock !== null && files.lock !== read(LOCK_FILE)
      ? [LOCK_FILE]
      : []),
    ...(files.choices !== null && files.choices !== read(CHOICES_FILE)
      ? [CHOICES_FILE]
      : []),
    ...(withNpm && !hasPackage ? ["package.json"] : []),
    ...(withNpm && !ignored ? [".gitignore"] : []),
  ];
  let syncs: string[];
  try {
    syncs = await d.syncChanges(standingFiles(), async () => base);
  } catch (e) {
    d.out(
      e instanceof NoDefaultBranch
        ? e.message
        : `The settings would not be valid: ${message(e)}`,
    );
    return 1;
  }
  const paths = [...new Set([...writes, ...syncs])];
  const branch = paths.length ? freeBranch(d, reach) : null;
  const toStore = [
    ...asked.flatMap((a) => a.names),
    ...(wantsKey ? [SIGNING_KEY] : []),
  ];
  const planned: string[] = [];
  const planRow = (label: string, text: string) =>
    planned.push(`${label.padEnd(12)}  ${text}`);
  if (where.url)
    planRow("remote", `Add the remote ${where.remote}, ${repository}`);
  const reviewers = (await standing())?.plugins
    .filter((p) => p.kind === "agent" && /reviewer$/.test(p.role))
    .map((p) => p.name);
  for (const [label, text] of fileRows(
    paths,
    shipsText(
      syncs.filter((p) => from?.ships.includes(p)),
      {
        owner,
        ownPresets: listedPresets().every(
          (p) =>
            ownerOf(parseName(p).repo).toLowerCase() === owner.toLowerCase(),
        ),
        reviewers: reviewers ?? [],
      },
    ),
  ))
    planRow(label, text);
  if (board === "new")
    planRow(
      "create",
      `board "${name}" under ${owner}, linked to the repository, with the factory's columns and fields`,
    );
  else if (parts.has("board") && typeof board === "number" && ownBoard)
    planRow(
      "board",
      `give board ${board} any of the factory's columns and fields it lacks`,
    );
  if (toStore.length) planRow("secrets", toStore.join(", "));
  if (storesOnMachine || keeping.length)
    planRow(
      "store",
      `${listed([
        ...keeps
          .filter((k) => keeping.some((a) => a.tool === k.name))
          .map((k) => `your ${k.kept.what}`),
        ...(storesOnMachine
          ? [`your ${d.tools.tickets[chosen.tickets]!.label} credential`]
          : []),
      ])} on this machine, in ${shownPath(credentialsPath(env))}`,
    );
  for (const a of npmAsked) planRow("secrets", `${a.name} ${forWhich(a)}`);
  if (parts.has("auto-merge"))
    planRow("repository", "allow auto-merge on the repository");
  if (rule)
    planRow(
      "rules",
      `Require "${REVIEW_VERDICT}" before a merge to the default branch, as the rule "${RULE}"${posts ? "" : ", once this pull request merges"}`,
    );
  // A code host may hold a workflow's events back in a repository anyone
  // can read. One that cannot say gets no row, and doctor's line instead.
  const eventsHeld =
    (await codeHost
      .eventAllowed(FACTORY_FILE, HELD_EVENT)
      .catch(() => null)) === "blocked";
  if (eventsHeld)
    planRow(
      "policy",
      `Let ${FACTORY_FILE} run on ${HELD_EVENT}, as the policy "${RULE}"`,
    );
  if (installing)
    planRow(
      "install",
      `${installing.install.package}, with ${installing.install.via}`,
    );
  for (const part of removed) planRow("turn off", PART_TEXT[part].name);
  if (branch)
    planRow(
      "pull request",
      `Push the branch ${branch} and open a pull request`,
    );
  gap();
  d.out("This is everything setup will do:");
  for (const l of planned) d.out(`  ${l}`);
  if (!(await d.ask.confirm("Go ahead?", false))) {
    d.out(NOTHING);
    return 0;
  }

  if (where.url && !addRemote(d, where)) return 1;

  // The board first, since the settings name its number.
  if (parts.has("board") && boardOps && ownBoard) {
    const { create } = boardOps;
    const creating = board === "new";
    while (board === "new") {
      try {
        if (!create)
          throw new Error("this ticket system cannot create a board");
        board = await create(name);
        d.out(`Created board ${board}, "${name}".`);
      } catch (e) {
        d.out(`Could not create a board: ${message(e)}`);
        board = await chooseBoard(false);
      }
    }
    if (typeof board === "number") {
      doc.setIn(["tickets", "board"], board);
      // A block needs a board, so one init creates has none written yet.
      if (creating)
        for (const [key, name] of FACTORY_LINES)
          doc.setIn(["tickets", "columns", key], name);
      try {
        await giveBoard(d, boardOps, board, boardShape(await standing()));
      } catch (e) {
        d.out(
          `Could not give board ${board} its columns and fields: ${message(e)}`,
        );
      }
    }
  }

  if (withNpm && !hasPackage)
    write(
      "package.json",
      `${JSON.stringify(
        {
          name: name.toLowerCase().replace(/[^a-z0-9._-]/g, "-"),
          private: true,
        },
        null,
        2,
      )}\n`,
    );
  if (withNpm && !ignored) {
    const ignore = read(".gitignore");
    write(
      ".gitignore",
      `${ignore ?? ""}${ignore && !ignore.endsWith("\n") ? "\n" : ""}node_modules/\n`,
    );
  }
  write(SETTINGS_FILE, String(doc));
  if (followed.added.length) {
    if (files.lock !== null) write(LOCK_FILE, files.lock);
    if (files.choices !== null) write(CHOICES_FILE, files.choices);
    rememberPresets(site, listedPresets(), env);
  }
  let installFailed: string | null = null;
  if (installing) {
    const { package: pkg, via } = installing.install;
    const r = await d.install([...via.split(" "), pkg]);
    if (r.status === 0) d.out(`Installed ${pkg}.`);
    else {
      d.out(`Could not install ${pkg}:`);
      for (const l of r.stderr.trimEnd().split("\n").slice(-5)) d.out(`  ${l}`);
      installFailed = `Install ${installing.name}, which a build writes specs with: ${via} ${pkg}`;
    }
  }
  const synced = await d.sync();
  if (synced !== 0) d.out("The sync failed, as above.");

  // The gate, before anything is committed: a build could not finish in a
  // repository whose own check fails.
  const standingNow = await standing();
  const gate = standingNow?.commands.gate ?? [];
  let afterGate = -1;
  if (gate.length && synced === 0) {
    gap();
    if (!(await runGate(d, gate))) return 1;
    afterGate = printed;
  }

  // Each tool's secrets, in the tools' order.
  let tokenAccount: string | null = null;
  const stored = new Set<string>();
  let fromThisMachine = 0;
  for (const { step, names, tool } of asked) {
    if (step.kind === "credential") {
      const at = siteOf(step);
      if (step.machine && fromMachine) {
        for (const n of names)
          await runner.setSecret(n, fromMachine.values[n]!);
        d.out(
          `It belongs to ${fromMachine.account}. Stored as ${listed(names)}, from this machine.`,
        );
        continue;
      }
      const got = await askCredential(step, at);
      if (!got) continue;
      for (const n of names) await runner.setSecret(n, got.values[n]!);
      if (step.machine)
        writeCredential({
          tool: chosen.tickets,
          site: at,
          values: got.values,
          env,
        });
      d.out(
        `It belongs to ${got.account}. Stored as ${listed(names)}${step.machine ? ", and on this machine" : ""}.`,
      );
      continue;
    }
    const served = servedFrom.get(step);
    if (served) {
      for (const n of names) await runner.setSecret(n, served.value);
      for (const n of names) stored.add(n);
      fromThisMachine += names.length;
      if (served.account !== undefined) tokenAccount = served.account;
      continue;
    }
    if (stale.has(step)) {
      d.out("");
      d.out(stale.get(step)!);
    }
    const got = await askSecret(d, step, AGAIN);
    if (!got) continue;
    for (const n of names) await runner.setSecret(n, got.value);
    for (const n of names) stored.add(n);
    if (got.account !== undefined) tokenAccount = got.account;
    const kept = keeping.find((a) => a.step === step)?.kept;
    if (!kept) {
      d.out(step.stored(names, got.account));
      continue;
    }
    writeCredential({
      tool,
      site,
      values: { [kept.name]: got.value },
      env,
    });
    d.out(
      `${got.account === undefined ? "" : `It belongs to ${got.account}. `}Stored for ${repository}, and on this machine for your next repository.`,
    );
  }
  if (fromThisMachine)
    d.out(
      `✓ Stored ${fromThisMachine} secret${fromThisMachine === 1 ? "" : "s"} for ${repository} from this machine.`,
    );

  // The tokens .npmrc reads, each stored where it is missing.
  for (const a of npmAsked) {
    d.out("");
    let prompt = "Paste the same token again (leave empty to do this later):";
    if (a.actions && a.dependabot) {
      d.out(`${NPMRC} reads ${a.name} for ${addressOf(npmrc, a.name)}.`);
      d.out(
        "The factory's workflows install with it. Use a token that can only read.",
      );
      prompt = "Paste it (leave empty to do this later):";
    } else if (!a.unseen)
      d.out(
        a.actions
          ? `${a.name} is set for Dependabot but not for Actions, and GitHub never shows a secret's value.`
          : `${a.name} is set for Actions but not for Dependabot, and GitHub never shows a secret's value.`,
      );
    if (a.unseen)
      d.out(
        `${a.name} isn't set for Dependabot on this repository, and only an organization admin can see whether your organization sets it. If it does, leave this empty.`,
      );
    const value = pasted(await d.ask.secret(prompt));
    if (!value) {
      d.out(
        `No ${a.name} stored. The factory's workflows fail at npm ci until it is. ${AGAIN}`,
      );
      continue;
    }
    if (a.actions) await runner.setSecret(a.name, value);
    if (a.dependabot) await runner.setDependabotSecret(a.name, value);
    d.out(`Stored ${a.name} ${forWhich(a)}.`);
  }

  /** The account the code host's own tool is signed in as, asked once:
   * null when nobody can say. */
  let who: Promise<string | null> | undefined;
  const signedInAs = () => (who ??= codeHost.signedInAs().catch(() => null));

  // The signing key.
  if (wantsKey) {
    const key = await d.keygen();
    await runner.setSecret(SIGNING_KEY, key.privateKey);
    d.out("");
    d.out(`Made a signing key and stored it as ${SIGNING_KEY}.`);
    const signedIn = await signedInAs();
    let added = false;
    if (tokenAccount !== null && tokenAccount === signedIn) {
      for (let tries = 0; tries < 2 && !added; tries++) {
        try {
          await codeHost.addSigningKey(SIGNING_TITLE, key.publicKey);
          added = true;
          d.out(`Added its public half to ${signedIn} as a signing key.`);
        } catch (e) {
          if (!(e instanceof NeedsScopeError) || tries > 0) {
            d.out(`Could not add the key: ${message(e)}`);
            break;
          }
          const grant = await d.ask.confirm(
            `Adding it to ${signedIn} needs the ${e.scope} permission. Open your browser to grant it?`,
            true,
          );
          if (!grant) break;
          await d.interactive(e.fix);
        }
      }
    }
    if (!added) {
      d.out(
        `Add this public key to ${tokenAccount ?? "the account whose token builds use"}, as a signing key under Settings, "SSH and GPG keys":`,
      );
      d.out(`  ${key.publicKey}`);
    }
  }

  // The repository's settings.
  let autoMergeLeft: string | null = null;
  if (parts.has("auto-merge"))
    await codeHost.allowAutoMerge().catch((e) => {
      d.out(`Could not allow auto-merge: ${message(e)}`);
      autoMergeLeft = `An admin of ${repository} allows auto-merge: Settings, General, "Allow auto-merge"`;
    });
  if (posts)
    await codeHost
      .requireCheck(RULE, REVIEW_VERDICT, "runner")
      .catch((e) =>
        d.out(
          `Could not require "${REVIEW_VERDICT}": ${message(e)}. Carrying on.`,
        ),
      );

  let eventsLeft: string | null = null;
  if (eventsHeld)
    await codeHost.allowEvents(RULE, FACTORY_FILE, FACTORY_EVENTS).then(
      () => d.out(`✓ Allowed ${HELD_EVENT} for ${FACTORY_FILE}.`),
      (e) => {
        d.out(`Could not allow ${HELD_EVENT}: ${message(e)}. Carrying on.`);
        eventsLeft = `Let ${FACTORY_FILE} run on ${HELD_EVENT}: your repository's Settings, Actions, Policies`;
      },
    );

  // The pull request, and what is left for you.
  const title =
    d.git(["cat-file", "-e", `${checkout.sha}:${SETTINGS_FILE}`]).status === 0
      ? CHANGE
      : SET_UP;
  if (afterGate !== printed) gap();
  if (deletable.length)
    d.out(`You can now delete these secrets: ${deletable.join(", ")}`);
  const pull =
    branch && synced === 0
      ? await openPull(d, {
          codeHost,
          repository,
          remote: where.remote,
          base,
          branch,
          paths: [
            ...new Set([
              ...paths,
              ...(installing && withNpm
                ? ["package.json", "package-lock.json"]
                : []),
            ]),
          ],
          title,
          body: ["```text", ...planned, "```", ""].join("\n"),
        })
      : null;
  if (pull?.state === "failed") return 1;
  if (!branch) d.out(NOTHING_TO_COMMIT);
  else if (!pull) d.out(NOT_COMMITTED);
  const left: string[] = installFailed ? [installFailed] : [];
  if (eventsLeft) left.push(eventsLeft);
  if (parts.has("review") && (await codeHost.jobsMayWrite().catch(() => false)))
    left.push(
      `Set CI's own token to read, since code in a pull request could pass "${REVIEW_VERDICT}" with it: ${JOBS_SETTING}. A workflow of yours that writes then says so under its own permissions`,
    );
  if (autoMergeLeft) left.push(autoMergeLeft);
  if (
    parts.has("from-board") &&
    trigger === "own-server" &&
    typeof board === "number"
  )
    left.push(
      [
        `Run the poller's image, ${POLLER_IMAGE}:${d.packageVersion}, where you host it, with:`,
        `       FACTORY_REPOSITORY=${repository}`,
        `       FACTORY_BOARD_OWNER=${owner}`,
        `       FACTORY_BOARD_NUMBER=${board}`,
        "       FACTORY_BOARD_TOKEN=the access token you just made",
        `       FACTORY_READY_COLUMN=${columnsOf(standingNow!).Ready?.[0]}`,
      ].join("\n"),
    );
  // Without a gate `factory gate` fails, and a build cannot finish.
  if (!gate.length)
    left.push(
      `Add the commands that check a change, under commands.gate in ${SETTINGS_FILE}`,
    );
  // The first run on the default branch requires the verdict, with the
  // organization's app or a person's build token. With neither, an admin
  // does, and so one does when the token stored is another account's than
  // the one signed in, which may be no admin's.
  const enrolls =
    (organization.setUp && ownerRule) ||
    [BUILD_TOKEN, BOARD_TOKEN].some((n) => isSet(n) || stored.has(n));
  const waits = rule && !posts;
  const person = waits && tokenAccount !== null ? await signedInAs() : null;
  const anothers =
    person !== null && person.toLowerCase() !== tokenAccount!.toLowerCase();
  if (waits && (!enrolls || anothers))
    left.push(
      `Once it merges, an admin of ${repository} runs factory init, to require "${REVIEW_VERDICT}"`,
    );
  if (pull?.state === "opened")
    d.out(
      left.length
        ? "Merge it to finish. Left to do:"
        : "Merge it to finish. Nothing else is left to do.",
    );
  else if (left.length) d.out("Left to do:");
  left.forEach((step, i) => d.out(`  ${i + 1}. ${step}`));
  if (pull?.state === "opened") {
    d.out("");
    for (const l of afterMerge(base, title === SET_UP, d.packageVersion))
      d.out(l);
  }

  d.out("");
  d.out("Checks");
  const found2 = await d.checks();
  for (const l of printChecks(found2, d.paint, 2)) d.out(l);
  return found2.some((c) => c.state === "fail") ? 1 : 0;
}

/** The folders of a checkout that hold a preset, "" for its root first. */
function presetFolders(dir: string, under = ""): string[] {
  const here = join(dir, under);
  return [
    ...(existsSync(join(here, PRESET_FILE)) ? [under] : []),
    ...readdirSync(here, { withFileTypes: true })
      .filter(
        (e) =>
          e.isDirectory() && e.name !== ".git" && e.name !== "node_modules",
      )
      .map((e) => e.name)
      .sort()
      .flatMap((sub) => presetFolders(dir, under ? `${under}/${sub}` : sub)),
  ];
}

/** The first comment line of a preset's file, without its mark. */
const firstComment = (text: string) =>
  /^#\s*(.*)$/m.exec(text)?.[1]?.trim() ?? "";

/** The presets as `init` reads and pins them, for the repository at
 * `root`. `fetch` gives what reads a preset's repository. */
export function presetSource(
  root: string,
  o: {
    fetch?: (repository: string, codeHost: string) => FetchDeps;
    now?: () => Date;
    paint?: Paint;
  } = {},
): Presets {
  const fetch =
    o.fetch ?? ((repository, codeHost) => fetchDeps(repository, codeHost));
  const resolve = (files: Files, partial: boolean) =>
    resolveFiles(
      {
        ...filesDeps(root),
        readFile: () => files.settings,
        readChoices: () => files.choices,
        readLock: () => files.lock,
      },
      { partial },
    );
  return {
    held: async (repository, codeHost, from) => {
      const f = fetch(from, codeHost);
      let dir: string;
      try {
        dir = fetchCommit(f, repository, newestCommit(f, repository));
      } catch (e) {
        if (e instanceof FetchError) return null;
        throw e;
      }
      return presetFolders(dir).map((folder) => ({
        name: folder ? `${repository}//${folder}` : repository,
        about: firstComment(
          readFileSync(join(dir, folder, PRESET_FILE), "utf8"),
        ),
      }));
    },

    add: async (name, files, io) => {
      const { add } = await import("./preset-commands.mts");
      const next: Record<string, string | null> = {
        [SETTINGS_FILE]: files.settings,
        [CHOICES_FILE]: files.choices,
        [LOCK_FILE]: files.lock,
      };
      // The command's own lines, up to its last question: what it says
      // once it has applied is said by the plan here, and nothing is
      // written until that is approved.
      let lines: string[] = [];
      let applied = false;
      const flush = () => {
        for (const l of lines) io.out(l);
        lines = [];
      };
      const code = await add([name], {
        root,
        cwd: root,
        out: (l) => {
          if (!applied) lines.push(l);
        },
        err: (l) => lines.push(l),
        terminal: true,
        ask: async (question) => {
          if (question.startsWith("Apply?")) {
            if (lines.at(-1) === "") lines.pop();
            flush();
            applied = true;
            return "y";
          }
          flush();
          return io.ask.input(question.trim(), "");
        },
        sync: async () => 0,
        show: () => null,
        resolve: (own, choices, lock) =>
          resolve(
            {
              settings: own,
              choices,
              lock: lock === undefined ? next[LOCK_FILE]! : lock,
            },
            true,
          ),
        write: (path, text) => {
          next[path] = text;
        },
        read: (path) =>
          path in next
            ? next[path]!
            : existsSync(join(root, path))
              ? readFileSync(join(root, path), "utf8")
              : null,
        fetch,
        now: o.now ?? (() => new Date()),
        paint: o.paint,
      });
      flush();
      return code === 0
        ? {
            settings: next[SETTINGS_FILE]!,
            choices: next[CHOICES_FILE]!,
            lock: next[LOCK_FILE]!,
          }
        : null;
    },

    combined: async (files) => {
      try {
        const r = await resolve(files, true);
        if (!r.presets.length) return null;
        const sources = [...r.resolution.sources];
        return {
          raw: r.resolution.raw,
          gives: (key) =>
            sources.some(
              ([k, source]) =>
                source.from !== OWN &&
                (k === key ||
                  k.startsWith(`${key}.`) ||
                  k.startsWith(`${key}[`)),
            ),
          ships: [...r.resolution.files.keys()],
        };
      } catch {
        return null;
      }
    },
  };
}

/** The dependencies `run` gives `main`, for the repository at `root`. Its
 * colors follow `stream`, the terminal init prints to. */
export async function initDeps(
  root: string,
  stream: NodeJS.WritableStream = process.stdout,
): Promise<InitDeps> {
  const manifest = JSON.parse(
    readFileSync(join(PACKAGE, "package.json"), "utf8"),
  ) as { name: string; version: string };
  const git: InitDeps["git"] = (args) => {
    // Its input is the terminal's, for a signing key that asks for a
    // passphrase.
    const r = spawnSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["inherit", "pipe", "pipe"],
    });
    return {
      status: r.status ?? 1,
      stdout: r.stdout ?? "",
      stderr: r.stderr || (r.error?.message ?? ""),
    };
  };
  const paint = painter(colorOn(stream));
  return {
    root,
    ask: await terminalAsk(),
    out: (l) => console.log(l),
    remotes: () =>
      git(["remote", "-v"])
        .stdout.split("\n")
        .flatMap((line) => {
          const match = /^(\S+)\t(.+) \(fetch\)$/.exec(line);
          return match ? [{ name: match[1]!, url: match[2]! }] : [];
        }),
    git,
    forkOf: (codeHost, repository) =>
      TOOLS.codeHost[codeHost]!.forkOf(repository),
    gate: async (command) => {
      const r = spawnSync("bash", ["-c", `exec 2>&1\n${command}`], {
        cwd: root,
        encoding: "utf8",
        // npm 11 prints a notice line for every script and npx it runs.
        env: { npm_config_loglevel: "warn", ...process.env },
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 64 * 1024 * 1024,
      });
      return {
        status: r.status ?? 1,
        output: r.stdout || (r.error?.message ?? ""),
      };
    },
    presets: presetSource(root, { paint }),
    tools: TOOLS,
    sync: async () => (await import("./sync.mts")).run([], false),
    // The settings are not written yet, so the code host asked is the one
    // setup has just opened, and the remote read is the one of the
    // repository it chose.
    syncChanges: async (files, host) => {
      const r = await resolveFiles({
        ...filesDeps(root),
        readFile: () => files.settings,
        readChoices: () => files.choices,
        readLock: () => files.lock,
      });
      // A repository that is no remote yet has only the code host to ask.
      const branch = await needDefaultBranch({
        ...branchDeps(root),
        host,
        repository: async () => r.settings.repository,
      }).catch((e) => {
        if (e instanceof NoRemote) return host();
        throw e;
      });
      return differences(root, await syncPlan(PACKAGE, root, r, branch));
    },
    install: async (argv2) => {
      const r = spawnSync(argv2[0]!, argv2.slice(1), {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "ignore", "pipe"],
      });
      return { status: r.status ?? 1, stderr: r.stderr ?? "" };
    },
    interactive,
    hasCommand,
    openPage,
    keygen: async () => {
      const dir = mkdtempSync(join(tmpdir(), "factory-key-"));
      try {
        const file = join(dir, "key");
        execFileSync(
          "ssh-keygen",
          ["-q", "-t", "ed25519", "-N", "", "-C", SIGNING_TITLE, "-f", file],
          { stdio: "ignore" },
        );
        return {
          privateKey: readFileSync(file, "utf8"),
          publicKey: readFileSync(`${file}.pub`, "utf8").trim(),
        };
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    checks: () => doctorChecks(doctorDeps(root)),
    paint,
    packageName: manifest.name,
    packageVersion: manifest.version,
  };
}

export async function run(argv: string[]): Promise<number> {
  const terminal = noTerminal("init");
  if (terminal) {
    console.log(terminal);
    return 1;
  }
  if (argv.includes("--org")) return (await import("./init-org.mts")).run(argv);
  let root: string;
  try {
    root = repoRoot();
  } catch {
    console.log(
      "This is not a git repository. Run it in your repository's checkout.",
    );
    return 1;
  }
  const d = await initDeps(root);
  try {
    return await main(argv, d);
  } catch (e) {
    if (e instanceof Error && e.name === "ExitPromptError") {
      console.log("Stopped. Nothing after the last step shown was changed.");
      return 130;
    }
    if (e instanceof SettingsError) {
      console.log(e.message);
      return 1;
    }
    throw e;
  }
}

/** Where a token .npmrc reads is set for Dependabot: on the repository or
 * by the organization, not set, or unknown, when the organization's
 * Dependabot secrets can't be listed. */
type DependabotState = "set" | "missing" | "unknown";
type NpmSecrets = {
  /** The variables `.npmrc` reads that come from secrets. */
  tokens: string[];
  dependabot: (name: string) => DependabotState;
};

/** The tokens `.npmrc` reads, and whether each is set for Dependabot. */
async function npmSecrets(
  npmrc: Npmrc,
  runner: Runner,
  codeHost: CodeHost,
  isOrganization: boolean,
): Promise<NpmSecrets> {
  const tokens = npmrc.names.filter((n) => n !== "GITHUB_TOKEN");
  if (!tokens.length) return { tokens, dependabot: () => "set" };
  const own = await runner.dependabotSecretNames();
  const organization =
    isOrganization && tokens.some((n) => !own.includes(n))
      ? await runner.organizationDependabotSecretNames(
          await codeHost.isPrivate(),
        )
      : [];
  return {
    tokens,
    dependabot: (name) =>
      own.includes(name)
        ? "set"
        : organization === null
          ? isOrganization
            ? "unknown"
            : "missing"
          : organization.includes(name)
            ? "set"
            : "missing",
  };
}

const forWhich = (a: { actions: boolean; dependabot: boolean }) =>
  a.actions && a.dependabot
    ? "for Actions and for Dependabot"
    : a.actions
      ? "for Actions"
      : "for Dependabot";
