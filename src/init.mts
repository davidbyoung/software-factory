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
import { openCodeHost, type CodeHost } from "./code-host/index.mts";
import { NeedsScopeError, type TokenNeed } from "./code-host/types.mts";
import {
  columnsOf,
  fieldNamesOf,
  parseSettings,
  repoRoot,
  SETTINGS_FILE,
  SettingsError,
  type Settings,
} from "./config.mts";
import {
  checks as doctorChecks,
  doctorDeps,
  line,
  type Check,
} from "./doctor.mts";
import {
  AGENT_KEY,
  AGENT_TOKEN,
  neededSecrets,
  PART_TEXT,
  PARTS,
  partsOn,
  resolveParts,
  SIGNING_KEY,
  tokenNames,
  tokenNeeds,
  type Part,
} from "./parts.mts";
import { CONTEXT as REVIEW_VERDICT } from "./review-verdict.mts";
import { openRunner, type Runner } from "./runner/index.mts";
import { differences, PACKAGE, plan as syncPlan } from "./sync.mts";
import { githubTickets } from "./tickets/github.mts";
import { ghTransport } from "./tickets/transport.mts";
import { gh } from "./lib/gh.mts";
import { DEFAULT_COLUMNS } from "./lib/work-status.mts";
import type { NewField, Tickets } from "./tickets/types.mts";

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
  open: (repository: string) => {
    codeHost: CodeHost;
    runner: Runner;
    tickets: Tickets;
  };
  sync: () => Promise<number>;
  /** The files a sync with these settings would write or delete. */
  syncChanges: (settingsText: string) => string[];
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

/** Today's one choice of each tool, by the name a setting gives it. */
const TOOLS = {
  codeHost: { github: "GitHub" },
  tickets: { github: "GitHub Issues" },
  runner: { "github-actions": "GitHub Actions" },
  agent: "Claude Code",
};

/** The coding agent's command, and the one that makes its token. */
const AGENT = {
  command: "claude",
  token: ["claude", "setup-token"],
};

/** The rule that requires the review's verdict, by name, so removing it is
 * deleting that one rule. */
const RULE = "Software factory";
const SIGNING_TITLE = "software factory builds";
const AGAIN = "Run npx --no-install factory init again to add it.";

/** The columns and fields the board sync uses: the settings' names where
 * they rename one, and none for one they set to none. */
function boardShape(s: Settings | null): {
  columns: string[];
  fields: NewField[];
} {
  const columns = Object.values(s ? columnsOf(s) : DEFAULT_COLUMNS).filter(
    (c): c is string => c !== null,
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
): { codeHost: "github"; repository: string } | null {
  const match =
    /^(?:git@github\.com:|(?:https|ssh):\/\/(?:git@)?github\.com\/)([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(
      url.trim(),
    );
  return match
    ? { codeHost: "github", repository: `${match[1]}/${match[2]}` }
    : null;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Items as a sentence lists them: "a", "a and b", "a, b, and c". */
const listed = (items: string[]) =>
  items.length < 3
    ? items.join(" and ")
    : `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;

/** What a token must be able to do, in words. */
const NEED_TEXT: Record<TokenNeed, string> = {
  push: "push a branch",
  workflows: "change a workflow's file",
  board: "write the board",
};

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
  const found = remote ? parseRemote(remote) : null;
  if (!found) {
    d.out(
      remote
        ? `The origin remote, ${remote}, is not on a code host the factory supports: ${Object.values(TOOLS.codeHost).join(", ")}.`
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
      settings = parseSettings(doc.toJS(), (p) => existsSync(at(p)));
    } catch (e) {
      d.out(`${SETTINGS_FILE}: ${message(e)}`);
      d.out("Fix it, then run init again.");
      return 1;
    }
  }
  const hasPackage = existsSync(at("package.json"));
  const agentInstalled = d.hasCommand(AGENT.command);

  d.out(`Setting up the software factory for ${repository}`);
  d.out("");
  d.out("Found");
  const row = (label: string, text: string) =>
    d.out(`  ${label.padEnd(14)} ${text}`);
  row("Code host", `${TOOLS.codeHost.github} (from your git remote)`);
  row("Tickets", TOOLS.tickets.github);
  row(
    "Coding agent",
    agentInstalled
      ? TOOLS.agent
      : `${TOOLS.agent}, which is not installed: sessions and its token need it`,
  );
  row("Cloud builds", TOOLS.runner["github-actions"]);
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

  const { codeHost, runner, tickets } = d.open(repository);
  let secrets: string[];
  try {
    secrets = await runner.secretNames();
  } catch (e) {
    d.out(`Could not reach the code host: ${message(e)}`);
    return 1;
  }

  const before = partsOn(settings, secrets);
  const first = settingsText === null;
  const chosen = await d.ask.checkbox(
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
  const resolved = resolveParts(before, new Set(chosen as Part[]));
  const parts = resolved.parts;
  for (const note of resolved.notes) d.out(note);

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

  // The settings as they will stand, keeping every other key and comment.
  if (!doc.has("version")) doc.set("version", 1);
  if (!doc.has("repository")) doc.set("repository", repository);
  if (parts.has("board") && typeof board === "number")
    doc.setIn(["tickets", "board"], board);
  if (!parts.has("board"))
    for (const key of ["board", "columns", "fields"])
      remove(doc, ["tickets", key]);
  if (parts.has("from-board")) doc.setIn(["builds", "trigger"], "own-server");
  else if (before.has("from-board")) remove(doc, ["builds", "trigger"]);
  if (parts.has("auto-merge")) doc.setIn(["auto-merge", "allow"], allow);
  else remove(doc, ["auto-merge", "allow"]);
  // The review is on while its setting is written; the sync writes its
  // workflow then, and removes it once the setting is gone.
  if (parts.has("review") && !doc.has("ci-review"))
    doc.setIn(["ci-review", "commands"], []);
  if (!parts.has("review")) doc.delete("ci-review");

  // The secrets: those the parts read that are not set, or all of them when
  // you choose to replace them.
  const needed = neededSecrets(parts);
  const alreadySet = [
    ...new Set(
      needed.flatMap((n) => n.anyOf.filter((x) => secrets.includes(x))),
    ),
  ];
  let replace = false;
  if (alreadySet.length)
    replace = await d.ask.confirm(
      alreadySet.length === 1
        ? "1 secret these parts read is already set. Replace it?"
        : `${alreadySet.length} secrets these parts read are already set. Replace them?`,
      false,
    );
  const missing = (names: string[]) =>
    replace || !names.some((n) => secrets.includes(n));
  const wantsAgent =
    (parts.has("review") || parts.has("cloud")) &&
    missing([AGENT_TOKEN, AGENT_KEY]);
  const tokenTo = tokenNames(parts).filter((n) => missing([n]));
  const wantsKey = parts.has("signing") && missing([SIGNING_KEY]);

  const removed = PARTS.filter((p) => before.has(p) && !parts.has(p));
  const stillRead = new Set(neededSecrets(parts).flatMap((n) => n.anyOf));
  const deletable = [
    ...new Set(
      neededSecrets(new Set(removed))
        .flatMap((n) => n.anyOf)
        .filter((n) => secrets.includes(n) && !stillRead.has(n)),
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
    syncs = d.syncChanges(newText);
  } catch (e) {
    d.out(`The settings would not be valid: ${message(e)}`);
    return 1;
  }
  const toStore = [
    ...(wantsAgent ? [agentInstalled ? AGENT_TOKEN : AGENT_KEY] : []),
    ...tokenTo,
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
        const shape = boardShape(settings);
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

  // The coding agent's token.
  if (wantsAgent) {
    let value = "";
    if (agentInstalled) {
      d.out("");
      d.out(`The coding agent's token: running ${AGENT.token.join(" ")}...`);
      await d.interactive(AGENT.token);
      value = await d.ask.secret(
        "Paste the token it printed (leave empty to do this later):",
      );
    } else {
      value = await d.ask.secret(
        "Paste an API key from the Claude Console (leave empty to do this later):",
      );
    }
    const secret = agentInstalled ? AGENT_TOKEN : AGENT_KEY;
    if (value) {
      await runner.setSecret(secret, value);
      d.out(`Stored as ${secret}.`);
    } else d.out(`No ${secret} stored. ${AGAIN}`);
  }

  // The one access token.
  let tokenAccount: string | null = null;
  if (tokenTo.length) {
    const scopes = codeHost.scopesFor(tokenNeeds(parts));
    const page = codeHost.newTokenPage(
      scopes,
      `software factory: ${repository}`,
    );
    d.out("");
    d.out(`An access token: opening ${page}`);
    d.out(
      `Check that ${listed(scopes)} ${scopes.length === 1 ? "is" : "are"} ticked, choose an expiry, and generate it.`,
    );
    d.openPage(page);
    for (;;) {
      const value = await d.ask.secret(
        "Paste it (leave empty to do this later):",
      );
      if (!value) {
        d.out(`No token stored. ${AGAIN}`);
        break;
      }
      let owned: { account: string; scopes: string[] | null };
      try {
        owned = await codeHost.tokenOwner(value);
      } catch (e) {
        d.out(`${message(e)}. Paste another.`);
        continue;
      }
      const lacking = owned.scopes
        ? scopes.filter((x) => !owned.scopes!.includes(x))
        : [];
      if (lacking.length) {
        d.out(
          `That token lacks ${listed(lacking)}. Make one with every scope checked, and paste it.`,
        );
        continue;
      }
      if (owned.scopes === null)
        d.out(
          `The code host does not say what this token may do: make sure it can ${listed(tokenNeeds(parts).map((n) => NEED_TEXT[n]))}.`,
        );
      for (const n of tokenTo) await runner.setSecret(n, value);
      tokenAccount = owned.account;
      d.out(`It belongs to ${owned.account}. Stored as ${tokenTo.join(", ")}.`);
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
  if (parts.has("from-board") && typeof board === "number")
    left.push(
      [
        "Host the poller, which starts a build when a card moves to Ready, with:",
        `       FACTORY_REPOSITORY=${repository}`,
        `       FACTORY_BOARD_OWNER=${owner}`,
        `       FACTORY_BOARD_NUMBER=${board}`,
        "       FACTORY_BOARD_TOKEN=the access token you just made",
      ].join("\n"),
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
    select: (message, choices) => p.select({ message, choices }),
    confirm: (message, fallback) => p.confirm({ message, default: fallback }),
    secret: (message) => p.password({ message, mask: "•" }),
    input: (message, fallback) => p.input({ message, default: fallback }),
  };
}

export async function run(argv: string[]): Promise<number> {
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
    open: (repository) => ({
      codeHost: openCodeHost(repository),
      runner: openRunner(repository),
      tickets: githubTickets({
        transport: ghTransport(gh),
        repository,
        board: null,
      }),
    }),
    sync: async () => (await import("./sync.mts")).run([]),
    syncChanges: (text) => {
      const raw = parseDocument(text).toJS();
      const s = parseSettings(raw, (p) => existsSync(join(root, p)));
      return differences(root, syncPlan(PACKAGE, root, s));
    },
    interactive: async (argv2) =>
      spawnSync(argv2[0], argv2.slice(1), { stdio: "inherit" }).status ?? 1,
    hasCommand: (name) =>
      !spawnSync(name, ["--version"], { stdio: "ignore" }).error,
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
