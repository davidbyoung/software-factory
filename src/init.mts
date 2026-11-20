// `factory init`: sets a repository up in one run. It says what it found,
// asks which parts to turn on, shows everything it will do, and once told to
// go ahead writes the settings, syncs, makes or connects the board, stores
// every secret through the runner, and changes the repository's settings
// through the code host. It commits nothing.
//
// Tokens are read in a masked prompt and go straight to the runner: none is
// printed, written to a file, or passed in a command's arguments.
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
import { isMap, parseDocument, type Document } from "yaml";
import {
  builtOf,
  secretSteps,
  stepsOf,
  TOOLS,
  type Registry,
} from "./tools.mts";
import { NeedsScopeError } from "./code-host/types.mts";
import {
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
import { checks as doctorChecks, doctorDeps, line } from "./doctor.mts";
import {
  branchDeps,
  needDefaultBranch,
  NoDefaultBranch,
} from "./lib/default-branch.mts";
import { hasCommand, noTerminal } from "./lib/has-command.mts";
import { DEFAULT_RUNNER } from "./runner/index.mts";
import { listed } from "./lib/listed.mts";
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
import { RULE, type Check, type Chosen, type SetupContext } from "./setup.mts";
import { differences, PACKAGE, plan as syncPlan } from "./sync.mts";
import { DEFAULT_COLUMNS, STATE_KEYS, sameName } from "./lib/work-status.mts";
import { askReady, suggestColumns } from "./columns-suggest.mts";
import type { NewField } from "./tickets/types.mts";

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
};

const SIGNING_TITLE = "software factory builds";
/** Where each release's poller image is published. */
const POLLER_IMAGE = "ghcr.io/davidbyoung/software-factory-poller";
/** A month of runs at each interval the scheduled poller allows. */
const RUNS_A_MONTH = (minutes: number) => (30 * 24 * 60) / minutes;
const AGAIN = "Run npx --no-install factory init again to add it.";

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
      settings = parseSettings(
        doc.toJS(),
        (p) => existsSync(at(p)),
        builtOf(d.tools),
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

  d.out(`Setting up the software factory for ${repository}`);
  d.out("");
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
  row("Settings", settingsText === null ? "none yet" : SETTINGS_FILE);
  row(
    "Board",
    settings?.tickets.board != null
      ? `${settings.tickets.board}, from your settings`
      : "none yet",
  );
  d.out("");

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
  const chosen: Chosen = {
    codeHost: found.codeHost,
    tickets: await pick("tickets", "Which ticket system?"),
    runner: await pick("runner", "Where do cloud builds run?"),
    agent: agentName,
  };

  const codeHost = d.tools.codeHost[chosen.codeHost]!.open(repository);
  const runner = d.tools.runner[chosen.runner]!.open(repository);
  const tickets = await d.tools.tickets[chosen.tickets]!.open(
    { repository, board: null },
    settings,
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
  let secrets: string[];
  try {
    secrets = await runner.secretNames();
  } catch (e) {
    d.out(`Could not reach the code host: ${message(e)}`);
    return 1;
  }
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
        "No board to use instead: create one on the code host, then run npx --no-install factory init again.",
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

  // The board's columns: the coding agent suggests them when an existing
  // board lacks one of the factory's and the settings name none, and a
  // ready column is asked for when builds from the board turn on without
  // one.
  let columnLines: [string, string][] = [];
  let readyColumn: string | null | undefined;
  if (parts.has("board") && typeof board === "number" && boardOps) {
    const asksReady =
      parts.has("from-board") &&
      !before.has("from-board") &&
      settings?.tickets.columns.ready === null;
    const suggests = !doc.hasIn(["tickets", "columns"]);
    let names: string[] = [];
    if (suggests || asksReady)
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
    if (suggests && names.length && lacks) {
      const got = await suggestColumns(
        {
          ask: d.ask,
          out: d.out,
          agent: agent.agent,
          label: agent.label,
          hasCommand: d.hasCommand,
        },
        {
          board,
          columns: names,
          fromBoard: parts.has("from-board") && trigger !== "manual",
        },
      );
      if (got === 1) return 1;
      if (got !== "default") columnLines = got;
    } else if (asksReady && settings)
      readyColumn = await askReady(
        { ask: d.ask, out: d.out },
        { columns: names, current: columnsOf(settings) },
      );
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
  if (readyColumn === null) remove(doc, ["tickets", "columns", "ready"]);
  else if (readyColumn !== undefined)
    doc.setIn(["tickets", "columns", "ready"], readyColumn);
  if (!parts.has("board"))
    for (const key of ["board", "columns", "fields"])
      remove(doc, ["tickets", key]);
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
  const alreadySet = [...new Set(needed.flatMap((n) => n.anyOf.filter(isSet)))];
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
      names: step.storeAs.filter((n) => replace || !isSet(n)),
    }))
    .filter((a) => a.names.length > 0);
  const wantsKey = parts.has("signing") && (replace || !isSet(SIGNING_KEY));

  const stillRead = new Set(needed.flatMap((n) => n.anyOf));
  const deletable = [
    ...new Set(
      neededSecrets(new Set(removed), secretSteps(d.tools, context(removed)))
        .flatMap((n) => n.anyOf)
        .filter((n) => isSet(n) && !stillRead.has(n)),
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
  if (parts.has("auto-merge"))
    planRow("Settings", "allow auto-merge on the repository");
  if (parts.has("review"))
    planRow(
      "Rules",
      `Require "${REVIEW_VERDICT}" before a merge to the default branch, as the rule "${RULE}"`,
    );
  for (const part of removed) planRow("Turn off", PART_TEXT[part].name);
  if (!(await d.ask.confirm("Go ahead?", true))) {
    d.out("Nothing changed.");
    return 0;
  }

  // The board first, since the settings name its number.
  if (parts.has("board") && boardOps) {
    while (board === "new") {
      try {
        board = await boardOps.create(name);
        d.out(`Created board ${board}, "${name}".`);
      } catch (e) {
        d.out(`Could not create a board: ${message(e)}`);
        board = await chooseBoard(false);
      }
    }
    if (typeof board === "number") {
      doc.setIn(["tickets", "board"], board);
      try {
        const shape = boardShape(standing());
        const columns = await boardOps.addColumns(board, shape.columns);
        const fields = await boardOps.addFields(board, shape.fields);
        const added = [...columns, ...fields];
        if (added.length)
          d.out(`Added to board ${board}: ${added.join(", ")}.`);
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
  const synced = await d.sync();
  if (synced !== 0) d.out("The sync failed, as above.");

  // Each tool's secrets, in the tools' order.
  let tokenAccount: string | null = null;
  for (const { step, names } of asked) {
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
  const left: string[] = [];
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
  for (const c of found2) d.out(`  ${line(c)}`);
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
    sync: async () => (await import("./sync.mts")).run([]),
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
