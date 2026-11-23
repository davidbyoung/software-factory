// `factory init`: sets a repository up in one run. It says what it found,
// asks which parts to turn on, shows everything it will do, and once told to
// go ahead writes the settings, syncs, makes or connects the board, stores
// every secret through the runner, and changes the repository's settings
// through the code host. It commits nothing.
//
// Tokens are read in a masked prompt and go straight to the runner, and a
// ticket system's credential also to this machine's credentials file
// (`lib/credentials.mts`): none is printed, written to any other file, or
// passed in a command's arguments.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { isMap, parseDocument, Scalar, type Document } from "yaml";
import {
  builtOf,
  secretSteps,
  stepsOf,
  TOOLS,
  type Registry,
} from "./tools.mts";
import { NeedsScopeError } from "./code-host/types.mts";
import {
  branchPatternFault,
  columnsOf,
  fieldNamesOf,
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
import { checks as doctorChecks, doctorDeps, printChecks } from "./doctor.mts";
import {
  branchDeps,
  needDefaultBranch,
  NoDefaultBranch,
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
  refusalReason,
  refusedEnvLine,
  shownPath,
  writeCredential,
  type MachineState,
} from "./lib/credentials.mts";
import { statusOf } from "./tickets/transport.mts";
import {
  neededSecrets,
  PART_TEXT,
  PARTS,
  partsOn,
  resolveParts,
  SIGNING_KEY,
  type Part,
} from "./parts.mts";
import { CONTEXT as REVIEW_VERDICT } from "./review-verdict.mts";
import {
  RULE,
  type Check,
  type Chosen,
  type CredentialStep,
  type SetupContext,
} from "./setup.mts";
import { differences, PACKAGE, plan as syncPlan } from "./sync.mts";
import {
  DEFAULT_COLUMNS,
  STATE_KEYS,
  sameName,
  type StateKey,
} from "./lib/work-status.mts";
import {
  askReady,
  everyColumn,
  FACTORY_LINES,
  fillColumns,
  suggestColumns,
} from "./columns-suggest.mts";
import { FACTORY_FIELDS, suggestFields } from "./ticket-fields.mts";
import type { NewField, TicketField } from "./tickets/types.mts";

/** The questions init asks. Each is answered at the terminal, and in tests
 * from a script. */
export type Ask = {
  checkbox(
    message: string,
    choices: {
      name: string;
      value: string;
      checked: boolean;
      /** Shown under the list while this choice is highlighted. */
      description?: string;
    }[],
  ): Promise<string[]>;
  select(
    message: string,
    choices: { name: string; value: string }[],
    /** The value chosen when the person picks nothing else. */
    fallback?: string,
  ): Promise<string>;
  confirm(message: string, fallback: boolean): Promise<boolean>;
  /** Read without echoing what is typed. */
  secret(message: string): Promise<string>;
  input(message: string, fallback: string): Promise<string>;
};

export type InitDeps = {
  root: string;
  ask: Ask;
  out: (line: string) => void;
  /** The `origin` remote's address, or null without one. */
  remote: () => string | null;
  tools: Registry;
  paint?: Paint;
  sync: () => Promise<number>;
  /** The files a sync with these settings would write or delete. `host`
   * asks the code host for the default branch, where the checkout does not
   * say. It rejects with NoDefaultBranch when nobody can tell. */
  syncChanges: (
    settingsText: string,
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
  /** The branch name a preset in effect supplies to settings that read
   * as `settingsText`, or null for none. */
  presetBranchName: (settingsText: string) => Promise<string | null>;
  /** The spec tool a preset in effect names for settings that read as
   * `settingsText`, \`none\` included, or null when none names one. */
  presetSpecs: (settingsText: string) => Promise<string | null>;
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

/** The columns and fields the board sync uses: the settings' names where
 * they rename one, and none for one they set to none. */
function boardShape(s: Settings | null): {
  columns: string[];
  fields: NewField[];
} {
  const columns = Object.values(s ? columnsOf(s) : DEFAULT_COLUMNS).flatMap(
    (c) => c ?? [],
  );
  const names = s
    ? fieldNamesOf(s)
    : { session: "Session", runsIn: "Runs in", cost: "Cost" };
  const fields: NewField[] = [];
  if (names.session) fields.push({ name: names.session, type: "text" });
  if (names.runsIn)
    fields.push({
      name: names.runsIn,
      type: "select",
      options: ["Local", "Actions"],
    });
  if (names.cost) fields.push({ name: names.cost, type: "number" });
  return { columns, fields };
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

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

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

export async function main(_argv: string[], d: InitDeps): Promise<number> {
  const at = (path: string) => join(d.root, path);
  const read = (path: string) =>
    existsSync(at(path)) ? readFileSync(at(path), "utf8") : null;
  const write = (path: string, text: string) => {
    mkdirSync(dirname(at(path)), { recursive: true });
    writeFileSync(at(path), text);
  };

  const remote = d.remote();
  const found = remote ? parseRemote(remote, d.tools) : null;
  if (!found) {
    d.out(
      remote
        ? `The origin remote, ${remote}, is not on a code host the factory supports: ${listed(Object.values(d.tools.codeHost).map((t) => t.label))}.`
        : "This is not a git repository with an origin remote. Run it in your repository's checkout.",
    );
    return 1;
  }
  const { repository } = found;
  const [owner, name] = repository.split("/");

  const settingsText = read(SETTINGS_FILE);
  const doc = parseDocument(settingsText ?? "");
  let settings: Settings | null = null;
  if (settingsText !== null) {
    try {
      // A block that leaves states out is what the column step fills in.
      settings = parseSettings(
        doc.toJS(),
        (p) => existsSync(at(p)),
        builtOf(d.tools),
        { partial: true },
      );
    } catch (e) {
      d.out(`${SETTINGS_FILE}: ${message(e)}`);
      d.out("Fix it, then run init again.");
      return 1;
    }
  }
  /** The settings as the file will stand, for the board's columns and
   * fields; files the sync has yet to write don't matter to those. */
  const standing = (): Settings | null => {
    try {
      return parseSettings(doc.toJS(), () => true, builtOf(d.tools));
    } catch {
      return settings;
    }
  };
  const hasPackage = existsSync(at("package.json"));

  // A kind with one tool is that tool; with several, the settings' choice,
  // or one asked for below.
  const only = (r: Record<string, unknown>) => {
    const names = Object.keys(r);
    return names.length === 1 ? names[0]! : null;
  };
  const named = {
    tickets: settings?.tickets.type ?? null,
    runner: settings?.builds.runner ?? null,
  };
  const choice = {
    tickets: only(d.tools.tickets) ?? named.tickets,
    runner: only(d.tools.runner) ?? named.runner,
  };
  const agentName = Object.keys(d.tools.agent)[0]!;
  const agent = d.tools.agent[agentName]!;
  const shown = (kind: "tickets" | "runner") => {
    const tools = d.tools[kind];
    if (only(tools)) return tools[only(tools)!]!.label;
    return choice[kind]
      ? `${tools[choice[kind]!]!.label}, from your settings`
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
  d.out(`Setting up the software factory for ${repository}`);
  d.out("");
  if (!agent.agent.installed(d.hasCommand)) {
    d.out(
      `The factory runs in a coding agent, and ${agent.label} is not installed.`,
    );
    d.out("Install it and run factory init again.");
    d.out("Nothing changed.");
    return 1;
  }
  d.out("Found");
  const row = (label: string, text: string) =>
    d.out(`  ${label.padEnd(14)} ${text}`);
  row(
    "Code host",
    `${d.tools.codeHost[found.codeHost]!.label} (from your git remote)`,
  );
  row("Tickets", shown("tickets"));
  row(
    "Coding agent",
    agent.setup.found?.({ hasCommand: d.hasCommand }) ?? agent.label,
  );
  row("Cloud builds", shown("runner"));
  row(
    "package.json",
    hasPackage ? "yes" : "none, so a private one will be created",
  );
  if (npmrc.names.length) row(NPMRC, `reads ${npmrc.names.join(", ")}`);
  row("Settings", settingsText === null ? "none yet" : SETTINGS_FILE);
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
  d.out("");
  if (machine?.state === "unreadable") {
    d.out(machine.line);
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

  /** A credential asked for part by part and checked together; asked
   * again from its first masked part when refused. Null when a part is
   * left empty. */
  const askCredential = async (
    step: CredentialStep,
    site: string,
  ): Promise<{ values: Record<string, string>; account: string } | null> => {
    for (const l of step.intro) d.out(l);
    if (step.get && "page" in step.get) d.openPage(step.get.page);
    if (step.get && "command" in step.get)
      await d.interactive(step.get.command);
    const values: Record<string, string> = {};
    let from = 0;
    for (;;) {
      for (const part of step.parts.slice(from)) {
        const value = part.masked
          ? await d.ask.secret(part.prompt)
          : (await d.ask.input(part.prompt, "")).trim();
        if (!value) {
          d.out(`${step.skipped} ${AGAIN}`);
          return null;
        }
        values[part.name] = value;
      }
      try {
        const checked = await step.check(values, site);
        for (const l of checked.lines) d.out(l);
        return { values, account: checked.account };
      } catch (e) {
        d.out(
          statusOf(e) === 401 ? step.refused(refusalReason(e)) : message(e),
        );
        from = Math.max(
          0,
          step.parts.findIndex((p) => p.masked),
        );
      }
    }
  };

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
      d.out("Nothing else changed.");
      return 0;
    }
  }

  const pick = async (kind: "tickets" | "runner", question: string) => {
    const tools = d.tools[kind];
    if (only(tools)) return only(tools)!;
    const first = named[kind];
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
  if (!settings && d.tools.tickets[chosenTickets]!.setup.credential?.machine) {
    const problem = fileProblem(env);
    if (problem) {
      d.out(problem.line);
      return 1;
    }
  }
  const chosen: Chosen = {
    codeHost: found.codeHost,
    tickets: chosenTickets,
    runner: await pick("runner", "Where do cloud builds run?"),
    agent: agentName,
  };
  const branchName =
    doc.hasIn(["code-host", "branch-name"]) ||
    (await d.presetBranchName(String(doc))) !== null
      ? null
      : await askBranchName(d);
  const ownSpecs = doc.get("specs");
  const writtenSpecs = isMap(ownSpecs)
    ? String(ownSpecs.get("type") ?? "none")
    : ownSpecs === undefined
      ? await d.presetSpecs(String(doc))
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

  const codeHost = d.tools.codeHost[chosen.codeHost]!.open(repository);
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
  const isOrganization = await codeHost.ownerIsOrganization().catch(() => true);
  let shared: string[] = [];
  try {
    own = await runner.secretNames();
    if (isOrganization)
      shared = await runner.organizationSecretNames().catch(() => []);
    npm = await npmSecrets(npmrc, runner, codeHost, isOrganization);
  } catch (e) {
    d.out(`Could not reach the code host: ${message(e)}`);
    return 1;
  }
  const secrets = [...own, ...shared];
  const isSet = (n: string) => secrets.includes(n);

  const cloudNeeds = secretSteps(d.tools, context(["cloud"])).flatMap((s) =>
    s.step.needs.filter((n) => n.part === "cloud"),
  );
  const before = partsOn(settings, secrets, cloudNeeds);
  const first = settingsText === null;
  const chosenParts = await d.ask.checkbox(
    "Which parts do you want?",
    PARTS.map((part) => ({
      name: PART_TEXT[part].name,
      description: PART_TEXT[part].gives,
      value: part,
      checked: first
        ? part === "review" || part === "board" || part === "cloud"
        : before.has(part),
    })),
  );
  const resolved = resolveParts(before, new Set(chosenParts as Part[]));
  const parts = resolved.parts;
  for (const note of resolved.notes) d.out(note);
  const removed = PARTS.filter((p) => before.has(p) && !parts.has(p));

  // The board: the one in the settings, or one chosen now.
  const boardOps = tickets.board;
  let board: number | "new" | null = parts.has("board")
    ? (settings?.tickets.board ?? null)
    : null;
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
  const writtenColumns = writtenColumnsOf(doc.toJS());
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
        d.out("Nothing changed.");
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
        { board, columns: names, fromBoard },
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
    !FACTORY_FIELDS.some((f) => doc.hasIn(["tickets", "fields", f.key]))
  ) {
    let text: TicketField[];
    try {
      text = (await tickets.fields.list()).filter((f) => f.text);
    } catch (e) {
      d.out(`Could not read ${repository}'s ticket fields: ${message(e)}`);
      d.out("Nothing changed.");
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
  if (!doc.has("version")) doc.set("version", 2);
  if (!doc.has("repository")) doc.set("repository", repository);
  // A tool other than the one a setting defaults to is written down.
  if ((doc.getIn(["tickets", "type"]) ?? "github") !== chosen.tickets)
    doc.setIn(["tickets", "type"], chosen.tickets);
  if ((doc.getIn(["builds", "runner"]) ?? DEFAULT_RUNNER) !== chosen.runner)
    doc.setIn(["builds", "runner"], chosen.runner);
  if (parts.has("board") && typeof board === "number")
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
  if (parts.has("from-board")) doc.setIn(["builds", "trigger"], trigger);
  else if (before.has("from-board")) remove(doc, ["builds", "trigger"]);
  if (pollMinutes !== null && pollMinutes !== 5)
    doc.setIn(["builds", "poll-minutes"], pollMinutes);
  if (!parts.has("from-board") || trigger !== "github-action")
    remove(doc, ["builds", "poll-minutes"]);
  if (parts.has("auto-merge")) doc.setIn(["auto-merge", "allow"], allow);
  else remove(doc, ["auto-merge", "allow"]);
  // The review is on while its setting is written; the sync writes its
  // workflow then, and removes it once the setting is gone.
  if (parts.has("review") && !doc.has("pr-review"))
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
    if (doc.hasIn(["tickets", step.key])) continue;
    doc.setIn(
      ["tickets", step.key],
      await d.ask.input(step.ask, step.fallback ?? ""),
    );
  }
  for (const step of values(removed))
    if (step.part !== null && removed.includes(step.part))
      remove(doc, ["tickets", step.key]);

  // The secrets: those the parts read that are not set, or all of them when
  // you choose to replace them.
  const steps = secretSteps(d.tools, context(parts));
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
    .map(({ step }) => ({
      step,
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
    step.machine
      ? String(doc.getIn(["tickets", step.machine.under]) ?? "")
      : "";
  const machineAsked = asked.find(
    (a): a is { step: CredentialStep; names: string[] } =>
      a.step.kind === "credential" && a.step.machine !== null,
  );
  if (machineAsked && !fromMachine) {
    const held = await machineState(
      machineAsked.step,
      chosen.tickets,
      siteOf(machineAsked.step),
      env,
    );
    if (held.state === "accepted") fromMachine = held;
  }
  const storesOnMachine = machineAsked !== undefined && !fromMachine;
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

  const stillRead = new Set(needed.flatMap((n) => n.anyOf));
  const deletable = [
    ...new Set(
      neededSecrets(new Set(removed), secretSteps(d.tools, context(removed)))
        .flatMap((n) => n.anyOf)
        .filter((n) => own.includes(n) && !stillRead.has(n)),
    ),
  ];

  // The plan.
  const newText = String(doc);
  const writes = [
    ...(newText !== settingsText ? [SETTINGS_FILE] : []),
    ...(hasPackage ? [] : ["package.json"]),
    ...(/^\/?node_modules\/?$/m.test(read(".gitignore") ?? "")
      ? []
      : [".gitignore"]),
  ];
  let syncs: string[];
  try {
    syncs = await d.syncChanges(newText, () => codeHost.defaultBranch());
  } catch (e) {
    d.out(
      e instanceof NoDefaultBranch
        ? e.message
        : `The settings would not be valid: ${message(e)}`,
    );
    return 1;
  }
  const toStore = [
    ...asked.flatMap((a) => a.names),
    ...(wantsKey ? [SIGNING_KEY] : []),
  ];
  d.out("");
  d.out("This is everything setup will do:");
  const planRow = (label: string, text: string) =>
    d.out(`  ${label.padEnd(8)} ${text}`);
  for (const path of [...writes, ...syncs]) planRow("Write", path);
  if (board === "new")
    planRow(
      "Create",
      `board "${name}" under ${owner}, linked to the repository, with the factory's columns and fields`,
    );
  else if (parts.has("board") && typeof board === "number")
    planRow(
      "Board",
      `give board ${board} any of the factory's columns and fields it lacks`,
    );
  if (toStore.length) planRow("Secrets", toStore.join(", "));
  if (storesOnMachine)
    planRow(
      "Store",
      `your ${d.tools.tickets[chosen.tickets]!.label} credential on this machine, in ${shownPath(credentialsPath(env))}`,
    );
  for (const a of npmAsked) planRow("Secrets", `${a.name} ${forWhich(a)}`);
  if (parts.has("auto-merge"))
    planRow("Settings", "allow auto-merge on the repository");
  if (parts.has("review"))
    planRow(
      "Rules",
      `Require "${REVIEW_VERDICT}" before a merge to the default branch, as the rule "${RULE}"`,
    );
  if (installing)
    planRow(
      "Install",
      `${installing.install.package}, with ${installing.install.via}`,
    );
  for (const part of removed) planRow("Turn off", PART_TEXT[part].name);
  if (!(await d.ask.confirm("Go ahead?", true))) {
    d.out("Nothing changed.");
    return 0;
  }

  // The board first, since the settings name its number.
  if (parts.has("board") && boardOps) {
    const { create, addColumns, addFields } = boardOps;
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
        const shape = boardShape(standing());
        const columns = addColumns
          ? await addColumns(board, shape.columns)
          : [];
        const fields = addFields ? await addFields(board, shape.fields) : [];
        const added = [...columns, ...fields];
        if (added.length)
          d.out(`Added to board ${board}: ${added.join(", ")}.`);
        // A ticket system that cannot add them leaves them to the owner.
        if (!addColumns) {
          const has = await boardOps.columns(board);
          const lacking = shape.columns.filter(
            (c) => !has.some((h) => h.toLowerCase() === c.toLowerCase()),
          );
          if (lacking.length)
            d.out(
              `Add these columns to board ${board} by hand: ${lacking.join(", ")}.`,
            );
        }
        if (!addFields && shape.fields.length)
          d.out(
            `Add any of these fields board ${board} lacks, by hand: ${shape.fields.map((f) => f.name).join(", ")}.`,
          );
      } catch (e) {
        d.out(
          `Could not give board ${board} its columns and fields: ${message(e)}`,
        );
      }
    }
  }

  if (!hasPackage)
    write(
      "package.json",
      `${JSON.stringify(
        {
          name: name.toLowerCase().replace(/[^a-z0-9._-]/g, "-"),
          private: true,
          devDependencies: { [d.packageName]: `^${d.packageVersion}` },
        },
        null,
        2,
      )}\n`,
    );
  const ignore = read(".gitignore");
  if (!/^\/?node_modules\/?$/m.test(ignore ?? ""))
    write(
      ".gitignore",
      `${ignore ?? ""}${ignore && !ignore.endsWith("\n") ? "\n" : ""}node_modules/\n`,
    );
  write(SETTINGS_FILE, String(doc));
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

  // Each tool's secrets, in the tools' order.
  let tokenAccount: string | null = null;
  for (const { step, names } of asked) {
    if (step.kind === "credential") {
      const site = siteOf(step);
      if (step.machine && fromMachine) {
        for (const n of names)
          await runner.setSecret(n, fromMachine.values[n]!);
        d.out(
          `It belongs to ${fromMachine.account}. Stored as ${listed(names)}, from this machine.`,
        );
        continue;
      }
      const got = await askCredential(step, site);
      if (!got) continue;
      for (const n of names) await runner.setSecret(n, got.values[n]!);
      if (step.machine)
        writeCredential({
          tool: chosen.tickets,
          site,
          values: got.values,
          env,
        });
      d.out(
        `It belongs to ${got.account}. Stored as ${listed(names)}${step.machine ? ", and on this machine" : ""}.`,
      );
      continue;
    }
    for (const l of step.intro) d.out(l);
    if (step.get && "page" in step.get) d.openPage(step.get.page);
    if (step.get && "command" in step.get)
      await d.interactive(step.get.command);
    for (;;) {
      const value = await d.ask.secret(step.prompt);
      if (!value) {
        d.out(`${step.skipped} ${AGAIN}`);
        break;
      }
      let checked: { lines: string[]; account?: string } = { lines: [] };
      if (step.verify)
        try {
          checked = await step.verify(value);
        } catch (e) {
          d.out(message(e));
          continue;
        }
      for (const l of checked.lines) d.out(l);
      for (const n of names) await runner.setSecret(n, value);
      if (checked.account !== undefined) tokenAccount = checked.account;
      d.out(step.stored(names, checked.account));
      break;
    }
  }

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
    const value = await d.ask.secret(prompt);
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

  // The signing key.
  if (wantsKey) {
    const key = await d.keygen();
    await runner.setSecret(SIGNING_KEY, key.privateKey);
    d.out("");
    d.out(`Made a signing key and stored it as ${SIGNING_KEY}.`);
    const signedIn = await codeHost.signedInAs().catch(() => null);
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
  if (parts.has("auto-merge"))
    await codeHost
      .allowAutoMerge()
      .catch((e) => d.out(`Could not allow auto-merge: ${message(e)}`));
  if (parts.has("review"))
    await codeHost
      .requireCheck(RULE, REVIEW_VERDICT)
      .catch((e) =>
        d.out(
          `Could not require "${REVIEW_VERDICT}": ${message(e)}. Carrying on.`,
        ),
      );

  // What is left for you.
  d.out("");
  if (deletable.length)
    d.out(`You can now delete these secrets: ${deletable.join(", ")}`);
  const left: string[] = installFailed ? [installFailed] : [];
  const app = codeHost.reviewAppPage();
  if (parts.has("review") && app)
    left.push(`Install the app the review posts through: ${app}`);
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
        `       FACTORY_READY_COLUMN=${columnsOf(standing()!).Ready?.[0]}`,
      ].join("\n"),
    );
  // Init asks for no command, so a gate is the owner's to add: without one
  // `factory gate` fails, and a build cannot finish.
  if (!settings?.commands.gate.length)
    left.push(
      `Add the commands that check a change, under commands.gate in ${SETTINGS_FILE}`,
    );
  left.push("Commit this on a branch, open a pull request, and merge it.");
  d.out("Nothing is committed. Left to do:");
  left.forEach((step, i) => d.out(`  ${i + 1}. ${step}`));

  d.out("");
  d.out("Checks");
  const found2 = await d.checks();
  for (const l of printChecks(found2, d.paint, 2)) d.out(l);
  return found2.some((c) => c.state === "fail") ? 1 : 0;
}

/** The questions, asked at the terminal. */
async function terminalAsk(): Promise<Ask> {
  const p = await import("@inquirer/prompts");
  return {
    checkbox: (message, choices) => p.checkbox({ message, choices }),
    select: (message, choices, fallback) =>
      p.select({ message, choices, default: fallback }),
    confirm: (message, fallback) => p.confirm({ message, default: fallback }),
    secret: (message) => p.password({ message, mask: "•" }),
    input: (message, fallback) => p.input({ message, default: fallback }),
  };
}

export async function run(argv: string[]): Promise<number> {
  const terminal = noTerminal("init");
  if (terminal) {
    console.log(terminal);
    return 1;
  }
  let root: string;
  try {
    root = repoRoot();
  } catch {
    console.log(
      "This is not a git repository. Run it in your repository's checkout.",
    );
    return 1;
  }
  const manifest = JSON.parse(
    readFileSync(join(PACKAGE, "package.json"), "utf8"),
  ) as { name: string; version: string };
  const d: InitDeps = {
    root,
    ask: await terminalAsk(),
    out: (l) => console.log(l),
    remote: () => {
      try {
        return execFileSync("git", ["remote", "get-url", "origin"], {
          cwd: root,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
      } catch {
        return null;
      }
    },
    tools: TOOLS,
    sync: async () => (await import("./sync.mts")).run([], false),
    // The settings are not written yet, so the code host asked is the one
    // setup has just opened, not the one a settings file names.
    syncChanges: async (text, host) => {
      const r = await resolveFiles({
        ...filesDeps(root),
        readFile: () => text,
      });
      const branch = await needDefaultBranch({ ...branchDeps(root), host });
      return differences(root, await syncPlan(PACKAGE, root, r, branch));
    },
    presetBranchName: presetBranchNameAt(root),
    presetSpecs: presetSpecsAt(root),
    install: async (argv2) => {
      const r = spawnSync(argv2[0]!, argv2.slice(1), {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "ignore", "pipe"],
      });
      return { status: r.status ?? 1, stderr: r.stderr ?? "" };
    },
    interactive: async (argv2) =>
      spawnSync(argv2[0], argv2.slice(1), { stdio: "inherit" }).status ?? 1,
    hasCommand,
    openPage: (url) => {
      const opener =
        process.platform === "darwin"
          ? "open"
          : process.platform === "win32"
            ? "explorer"
            : "xdg-open";
      try {
        spawn(opener, [url], { stdio: "ignore", detached: true })
          .on("error", () => {})
          .unref();
      } catch {
        // The page's address is printed too, to open by hand.
      }
    },
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
    paint: painter(colorOn()),
    packageName: manifest.name,
    packageVersion: manifest.version,
  };
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
