// `factory init --org ADDRESS`: sets an organization up once. It reads no
// git remote and needs no repository. It says what it found, asks what
// nothing has decided, shows everything it will do, and once told to go
// ahead makes the board, the repository that holds the organization's
// preset and its one poller, the organization's own app, its secrets, and
// the rule that requires the review's verdict.
//
// Each of those is there or not on the code host, and nothing is kept on
// this machine, so a run that stopped is carried on by running it again.
// The app's key and the coding agent's token go straight to the
// organization's secrets: neither is printed or written to a file.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { load } from "js-yaml";
import { stringify } from "yaml";
import { keyFault, tokenFault } from "./agent/claude-code.mts";
import { organizationHosts } from "./code-host/index.mts";
import type { Organization, OrganizationHost } from "./code-host/types.mts";
import {
  everyColumn,
  FACTORY_LINES,
  suggestColumns,
} from "./columns-suggest.mts";
import { POLL_MINUTES } from "./config.mts";
import {
  askSecret,
  boardShape,
  docsPage,
  giveBoard,
  interactive,
  message,
  openPage,
  terminalAsk,
  type Terminal,
} from "./init-shared.mts";
import { hasCommand } from "./lib/has-command.mts";
import { listed } from "./lib/listed.mts";
import { sameName, STATE_KEYS, type StateKey } from "./lib/work-status.mts";
import { APP_KEY } from "./parts.mts";
import { PRESET_FILE } from "./preset.mts";
import { CONTEXT as REVIEW_VERDICT } from "./review-verdict.mts";
import { RULE, type SecretStep } from "./setup.mts";
import { PACKAGE } from "./sync.mts";
import { TOOLS, type Registry } from "./tools.mts";
import { POLLER_FILE, pollerWorkflow } from "./workflow-files.mts";

export type InitOrgDeps = Terminal & {
  /** Each code host an organization can be on, by the name
   * `code-host.type` gives it. */
  hosts: Record<string, OrganizationHost>;
  tools: Registry;
  hasCommand: (name: string) => boolean;
  /** One line typed at the terminal. Rejects once `signal` stops it. */
  readLine: (signal: AbortSignal) => Promise<string>;
  packageName: string;
  packageVersion: string;
};

/** The variable that holds the app's client ID, which the workflows make a
 * run's token from with the key in the secret `APP_KEY` names. */
export const APP_CLIENT_ID = "FACTORY_APP_CLIENT_ID";
/** The property a repository set up with the factory has `on`, and the
 * repository that holds the organization's preset and poller. */
export const PROPERTY = "software-factory";
export const CONFIG = "factory-config";
const BOARD_TITLE = "Software factory";
/** The two ways to pay for sessions in the cloud, as the question names
 * them. */
const SUBSCRIPTION = "A Claude subscription";
const API_KEY = "An API key";
const README = "README.md";
const FILES = [README, PRESET_FILE, POLLER_FILE];
const NOTHING = "Nothing changed.";
const NO_RULE =
  "- rule      Each repository's own: once its setup merges, an admin of it runs factory init";
/** A month of runs at each interval the scheduled poller allows. */
const RUNS_A_MONTH = (minutes: number) => (30 * 24 * 60) / minutes;

/** The step that installs the app: its first line, then the page's
 * address on a line of its own, what to do there, and that the command
 * waits. Nothing tells the command whether a browser opened the page, so
 * no line says one did. */
const INSTALL_IT =
  "Install it. Your browser should open this address. If it does not, open it yourself:";
const CHOOSE = `Choose all repositories, or a selection that includes ${CONFIG}, and press "Install".`;
const FIND_IT =
  'Press the app\'s name, then "Install App", choose the repositories, and press "Install".';
const installing = (page: string, press: string) => [
  `     ${page}`,
  `   ${press}`,
  "   Waiting up to 10 minutes for the installation to show.",
];

/** A step that failed, as the line that says what could not be done. */
class StepFailed extends Error {}

const readme = (org: string) =>
  [
    `# ${CONFIG}`,
    "",
    `The software factory's settings for every ${org} repository, written by`,
    "`factory init --org`. Both files are yours to edit.",
    "",
    `- \`${PRESET_FILE}\` is ${org}'s preset: the ticket system, the board, and`,
    "  its columns. A repository follows it once a developer runs",
    "  `factory init` there.",
    `- \`${POLLER_FILE}\` is the one poller for ${org}'s`,
    "  board. It starts a build in each repository with a ticket in the ready",
    "  column.",
    "",
  ].join("\n");

const presetText = (o: {
  org: string;
  tickets: string;
  board: number;
  /** Each state's column, as `tickets.columns` writes it. */
  columns: [StateKey, string][];
  pollMinutes: number;
}) =>
  `${[
    `# The preset for every ${o.org} repository.`,
    `# ${PRESET_FILE}, written by factory init --org. It is yours to edit.`,
    "version: 2",
    "tickets:",
    `  type: ${o.tickets}`,
    `  board: ${o.board}`,
    "  columns:",
    ...o.columns.map(
      ([key, name]) => `    ${stringify({ [key]: name }).trimEnd()}`,
    ),
    "pr-review:",
    "  commands: []",
    "builds:",
    "  trigger: github-action",
    ...(o.pollMinutes === 5 ? [] : [`  poll-minutes: ${o.pollMinutes}`]),
  ].join("\n")}\n`;

/** The interval a preset's text gives the poller: 5 where it names none. */
function pollMinutesIn(preset: string): number {
  try {
    const raw = load(preset) as { builds?: { "poll-minutes"?: unknown } };
    const minutes = raw?.builds?.["poll-minutes"];
    return typeof minutes === "number" ? minutes : 5;
  } catch {
    return 5;
  }
}

/** The columns `tickets.columns` lines name, less a state given none. */
const columnsOf = (lines: [StateKey, string][]) =>
  lines.map(([, name]) => name).filter((name) => name !== "none");

const counted = (n: number, what: string) =>
  `${n} ${what}${n === 1 ? "" : "s"}`;

export async function main(argv: string[], d: InitOrgDeps): Promise<number> {
  const stop = (...lines: string[]) => {
    for (const l of lines) d.out(l);
    return 1;
  };
  const address = (argv[argv.indexOf("--org") + 1] ?? "")
    .trim()
    .replace(/\/+$/, "");
  const firstHost = Object.values(d.hosts)[0]!;
  let url: URL | null = null;
  try {
    url = new URL(address);
  } catch {
    // Not an address: a word, or nothing.
  }
  if (!url || !/^https?:$/.test(url.protocol)) {
    const word = address.split("/").filter(Boolean).at(-1);
    return stop(
      word
        ? `✗ Which code host is ${address} on? Give its address, such as ${firstHost.addressOf(word)}.`
        : `✗ factory init --org takes an organization's address, such as ${firstHost.addressOf("acme")}.`,
      NOTHING,
    );
  }
  const hostName = Object.keys(d.hosts).find((n) =>
    d.hosts[n]!.serves(address),
  );
  if (!hostName)
    return stop(
      `✗ ${url.host} is not a code host the factory supports: ${listed(Object.values(d.hosts).map((h) => h.label))}.`,
      NOTHING,
    );
  const host = d.hosts[hostName]!;
  const org = host.ownerOf(address);
  if (!org) {
    const first = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return stop(
      `✗ ${address} is not an organization's address. Give one such as ${host.addressOf(/^[A-Za-z0-9-]+$/.test(first) ? first : "acme")}.`,
      NOTHING,
    );
  }
  const command = `factory init --org ${host.addressOf(org)}`;
  const carryOn = `Run ${command} again: it carries on from here.`;

  const agentName = Object.keys(d.tools.agent)[0]!;
  const agent = d.tools.agent[agentName]!;
  if (!agent.agent.installed(d.hasCommand))
    return stop(
      `The factory runs in a coding agent, and ${agent.label} is not installed.`,
      `Install it and run ${command} again.`,
      NOTHING,
    );

  const organization = host.organization(org);
  let lacks: Awaited<ReturnType<Organization["signInLacks"]>>;
  try {
    const kind = await organization.kind();
    if (kind === null)
      return stop(
        `✗ ${host.addressOf(org)}: ${host.label} has no organization of that name.`,
        NOTHING,
      );
    if (kind === "person")
      return stop(
        `✗ ${org} is a personal account, which has nothing to set up once: no shared secrets, and a board that refuses an app's token.`,
        `Run factory init in each repository. ${NOTHING}`,
      );
    if ((await organization.role()) !== "owner")
      return stop(
        `✗ You are not an owner of ${org}, and registering an app and storing its secrets need one.`,
        NOTHING,
      );
    lacks = await organization.signInLacks();
  } catch (e) {
    return stop(`Could not reach the code host: ${message(e)}`);
  }
  if (lacks) {
    const one = lacks.scopes.length === 1;
    const grant = await d.ask.confirm(
      `Setting ${org} up needs the ${listed(lacks.scopes)} permission${one ? "" : "s"} for ${lacks.tool}. Open your browser to grant ${one ? "it" : "them"}?`,
      true,
    );
    if (!grant) {
      d.out(NOTHING);
      return 0;
    }
    await d.interactive(lacks.fix);
  }

  d.out(`Setting up the software factory for the organization ${org}`);
  d.out("");

  const ticketNames = Object.keys(d.tools.tickets);
  const repository = `${org}/${CONFIG}`;
  const chosen = {
    codeHost:
      hostName in d.tools.codeHost
        ? hostName
        : Object.keys(d.tools.codeHost)[0]!,
    tickets: ticketNames[0]!,
    runner: Object.keys(d.tools.runner)[0]!,
    agent: agentName,
  };
  const open = async (ticketsName: string) =>
    d.tools.tickets[ticketsName]!.open(
      { repository, board: null, boardOwner: org },
      null,
    );
  // The coding agent's credential: the names its step stores, and any
  // other secret that meets the same need.
  const credential =
    (
      agent.setup.steps?.({
        repository,
        root: ".",
        parts: new Set(["review", "cloud"]),
        chosen,
        settings: null,
        hasCommand: d.hasCommand,
        opened: {
          codeHost: d.tools.codeHost[chosen.codeHost]!.open(repository),
          runner: d.tools.runner[chosen.runner]!.open(repository),
          tickets: await open(chosen.tickets),
        },
      }) ?? []
    ).find((s): s is SecretStep => s.kind === "secret") ?? null;
  const credentialNames = credential?.storeAs ?? [];
  const meets = credential
    ? [
        ...new Set([
          ...credentialNames,
          ...credential.needs.flatMap((n) => n.anyOf),
        ]),
      ]
    : [];

  let plan, config, secrets, clientId, installation, ruled, known;
  const files: Record<string, string | null> = {};
  try {
    plan = await organization.plan();
    config = await organization.repository(CONFIG);
    for (const path of FILES)
      files[path] = config ? await organization.file(CONFIG, path) : null;
    secrets = await organization.secretNames();
    clientId = await organization.variable(APP_CLIENT_ID);
    installation = clientId ? await organization.installation(clientId) : null;
    // The app as the code host finds it before it is installed, if it can.
    known =
      clientId && !installation
        ? await organization.registeredApp(clientId).catch(() => null)
        : null;
    ruled = plan.rules && (await organization.ruleNames()).includes(RULE);
  } catch (e) {
    return stop(`Could not reach the code host: ${message(e)}`);
  }
  const needsPreset = files[PRESET_FILE] === null;
  const missing = FILES.filter((path) => files[path] === null);
  const isPrivate = config ? config.isPrivate : plan.privateSecrets;
  const agentStored = meets.filter((n) => secrets.includes(n));
  const oneTickets = ticketNames.length === 1;

  d.out("Found");
  const row = (label: string, text: string) =>
    d.out(`  ${label.padEnd(16)} ${text}`);
  row("Code host", `${host.label} (from the address)`);
  row("You", `an owner of ${org}`);
  if (!plan.rules || !plan.privateSecrets)
    row(
      "Plan",
      `${plan.name}: ${org}'s secrets reach only its public repositories, and it has no organization-wide rules`,
    );
  if (needsPreset && oneTickets)
    row("Tickets", d.tools.tickets[ticketNames[0]!]!.label);
  if (credential && !agentStored.length)
    row("Coding agent", `${agent.label} (on this machine)`);
  if (clientId)
    row(
      "App",
      installation
        ? `${installation.app}, installed on ${installation.all ? "all repositories" : "the repositories you chose"}`
        : "registered, and not installed yet",
    );
  const stored = [APP_KEY, ...meets].filter((n) => secrets.includes(n));
  if (stored.length) row("Secrets", `${listed(stored)}, stored`);
  row("Preset", config ? repository : "none yet");
  if (ruled)
    row("Rule", `"${REVIEW_VERDICT}" is required where ${PROPERTY} is "on"`);
  d.out("");

  // The questions: only what is not there yet.
  let ticketsName = ticketNames[0]!;
  let board: number | "new" | null = null;
  let tickets = null;
  if (needsPreset) {
    if (!oneTickets)
      ticketsName = await d.ask.select(
        "Which ticket system?",
        ticketNames.map((n) => ({
          name: d.tools.tickets[n]!.label,
          value: n,
        })),
      );
    tickets = await open(ticketsName);
    let existing: { number: number; title: string }[];
    try {
      existing = (await tickets.board?.list()) ?? [];
    } catch (e) {
      return stop(`Could not reach the code host: ${message(e)}`);
    }
    const choice = await d.ask.select("Which board?", [
      { name: "A new one, made with the factory's columns", value: "new" },
      ...existing.map((b) => ({
        name: `${b.number}  ${b.title}`,
        value: String(b.number),
      })),
    ]);
    board = choice === "new" ? "new" : Number(choice);
  }

  // An existing board keeps its own columns: the coding agent suggests
  // which shows each state, and only what is still missing is added.
  let columnLines = FACTORY_LINES;
  let adds: string[] = [];
  if (typeof board === "number" && tickets?.board) {
    let names: string[];
    let fields: string[];
    try {
      names = await tickets.board.columns(board);
      fields = await tickets.board.fieldNames(board);
    } catch (e) {
      return stop(
        `Could not read board ${board}'s columns: ${message(e)}`,
        NOTHING,
      );
    }
    const lacks = Object.values(STATE_KEYS).some(
      (f) => !names.some((n) => sameName(n, f)),
    );
    if (names.length && lacks) {
      const got = await suggestColumns(
        { ask: d.ask, out: d.out, agent: agent.agent, label: agent.label },
        { board, columns: names, fromBoard: true, byHand: true },
      );
      // By hand, the step ends only with the columns chosen.
      if (got === 1) return 1;
      columnLines = got;
    } else if (names.length)
      columnLines = everyColumn(d, { board, columns: names });
    const has = (list: string[]) => (name: string) =>
      list.some((x) => sameName(x, name));
    adds = [
      ...columnsOf(columnLines).filter((c) => !has(names)(c)),
      ...boardShape(null)
        .fields.map((f) => f.name)
        .filter((f) => !has(fields)(f)),
    ];
  }

  // Which secret the coding agent's credential is stored as this run, or
  // null to store none.
  let storeAs: string | null = null;
  if (credential && agentStored.length) {
    if (
      await d.ask.confirm(
        `${agentStored[0]} is already stored for ${org}. Replace it? Only if it has expired or been revoked.`,
        false,
      )
    )
      storeAs = agentStored[0]!;
  } else if (credential) {
    const getCommand =
      credential.get && "command" in credential.get
        ? credential.get.command
        : null;
    storeAs =
      getCommand && credential.or
        ? await d.ask.select("What pays for sessions in the cloud?", [
            {
              name: `${SUBSCRIPTION} (it runs ${getCommand.join(" ")} for you)`,
              value: credentialNames[0]!,
            },
            { name: API_KEY, value: credential.or.storeAs[0]! },
          ])
        : credentialNames[0]!;
  }

  let pollMinutes = 5;
  if (!needsPreset) pollMinutes = pollMinutesIn(files[PRESET_FILE]!);
  else if (isPrivate) {
    d.out(
      "Each run of the poller bills at least one Actions minute in a private repository.",
    );
    pollMinutes = Number(
      await d.ask.select(
        "How often does the poller read the board?",
        [30, ...POLL_MINUTES.filter((m) => m !== 30)].map((m) => ({
          name: `Every ${m} minutes, ${RUNS_A_MONTH(m).toLocaleString("en-US")} runs a month`,
          value: String(m),
        })),
        "30",
      ),
    );
  }

  // The plan: a row for each thing that is not there yet.
  const app = organization.appName();
  const rows: [label: string, text: string][] = [];
  if (!installation)
    rows.push([
      "app",
      clientId
        ? `Install the ${host.label} App, which is registered`
        : `Register the ${host.label} App "${app.name}"${app.shortened ? `, its name cut to the ${app.name.length} characters ${host.label} allows,` : ""} and install it`,
    ]);
  const toStore = [
    ...(clientId ? [] : [APP_KEY]),
    ...(storeAs ? [storeAs] : []),
    ...(clientId ? [] : [`the variable ${APP_CLIENT_ID}`]),
  ];
  if (toStore.length)
    rows.push(["secrets", `Store ${listed(toStore)} for ${org}`]);
  if (!config)
    rows.push([
      "preset",
      `Create ${repository}, a ${isPrivate ? "private" : "public"} repository, with the organization's preset and the poller`,
    ]);
  else if (missing.length)
    rows.push(["preset", `Write ${listed(missing)} in ${repository}`]);
  const ruleAt = rows.length;
  if (plan.rules && !ruled)
    rows.push([
      "rule",
      `Require "${REVIEW_VERDICT}" on repositories set up with the factory`,
    ]);
  if (board === "new")
    rows.push([
      "board",
      "Create a board with the factory's columns and fields",
    ]);
  else if (board !== null)
    rows.push([
      "board",
      adds.length
        ? `Add ${listed(adds)} to board ${board}`
        : `Use board ${board} as it is`,
    ]);
  const addresses = [
    "The settings every repository shares are yours to edit:",
    `     ${organization.filePage(CONFIG, PRESET_FILE)}`,
    "The steps in full:",
    `     ${docsPage(d.packageVersion, "github/setup.md#in-an-organization")}`,
  ];
  if (!rows.length) {
    d.out(`✓ ${org} is set up. Nothing to do.`);
    d.out("");
    for (const l of addresses) d.out(l);
    return 0;
  }
  d.out("");
  d.out("This is everything setup will do:");
  const lines = rows.map(([label, text]) => `  ${label.padEnd(9)} ${text}`);
  if (!plan.rules) lines.splice(ruleAt, 0, NO_RULE);
  for (const l of lines) d.out(l);
  if (!(await d.ask.confirm("Go ahead?", false))) {
    d.out(NOTHING);
    return 0;
  }
  d.out("");

  const step = async <T,>(what: string, run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (e) {
      if (e instanceof StepFailed) throw e;
      throw new StepFailed(`✗ Could not ${what}: ${message(e)}`);
    }
  };
  const counts = { secrets: 0, variables: 0 };
  try {
    // The repository before the board, which the ticket system links to
    // one, and its files after, since the preset names the board.
    if (!config)
      await step(`create ${repository}`, () =>
        organization.createRepository(CONFIG, {
          isPrivate,
          description: `The software factory's settings for every ${org} repository`,
        }),
      );
    if (board !== null) {
      const ops = tickets?.board;
      const made = board === "new";
      if (made) {
        board = await step("create a board", async () => {
          if (!ops?.create)
            throw new Error("this ticket system cannot create a board");
          return ops.create(BOARD_TITLE);
        });
        d.out(`✓ Created board ${board}, "${BOARD_TITLE}".`);
      }
      const number = board as number;
      await step(`give board ${number} its columns and fields`, async () => {
        if (!ops) throw new Error("this ticket system has no board");
        await giveBoard(
          d,
          ops,
          number,
          {
            columns: columnsOf(columnLines),
            fields: boardShape(null).fields,
          },
          { added: !made },
        );
      });
    }
    if (missing.length) {
      const texts: Record<string, () => string> = {
        [README]: () => readme(org),
        [PRESET_FILE]: () =>
          presetText({
            org,
            tickets: ticketsName,
            board: board as number,
            columns: columnLines,
            pollMinutes,
          }),
        [POLLER_FILE]: () =>
          pollerWorkflow({
            owner: org,
            version: d.packageVersion,
            pollMinutes,
          }),
      };
      await step(
        config
          ? `write ${listed(missing)} in ${repository}`
          : `write ${repository}'s files`,
        () =>
          organization.putFiles(
            CONFIG,
            Object.fromEntries(missing.map((path) => [path, texts[path]!()])),
          ),
      );
      d.out(
        config
          ? `✓ Wrote ${listed(missing)} in ${repository}.`
          : `✓ Created ${repository}.`,
      );
    }

    let shown = installation;
    if (!installation) {
      let id = clientId;
      let key: string | null = null;
      if (id === null) {
        d.out("");
        d.out(
          `Registering the ${host.label} App "${app.name}". Two steps, both in your browser.`,
        );
        if (await organization.appNamed(app.name).catch(() => null))
          d.out(
            `An app named "${app.name}" is already registered. Delete it under ${org}'s Settings, Developer settings, or type another name in the form.`,
          );
        d.out("");
        let shown = false;
        const made = await step("register the app", () =>
          organization.registerApp({
            name: app.name,
            open: (page) => {
              if (!shown) {
                d.out(
                  "1. Create the app. Your browser should open this address. If it does not, open it yourself:",
                );
                d.out(`     ${page}`);
                d.out(`   Then press "Create ${host.label} App".`);
                d.out(
                  `   Waiting for ${host.label} to send your browser back. If that page does not load, paste its address here:`,
                );
              }
              shown = true;
              d.openPage(page);
            },
            pasted: (signal, again) => {
              if (again)
                d.out(
                  "That address is not from this run. Paste the address of the page that did not load:",
                );
              return d.readLine(signal);
            },
            keep: async (registered) => {
              key = registered.key;
              await step(`store ${APP_KEY}`, () =>
                organization.setSecret(APP_KEY, registered.key),
              );
              counts.secrets++;
              await step(`store ${APP_CLIENT_ID}`, () =>
                organization.setVariable(APP_CLIENT_ID, registered.clientId),
              );
              counts.variables++;
              d.out(`✓ Created the app, and stored its key for ${org}.`);
            },
          }),
        );
        id = made.clientId;
        d.out("");
        d.out(`2. ${INSTALL_IT}`);
        for (const l of installing(made.installPage, CHOOSE)) d.out(l);
      } else {
        d.out(
          `The ${host.label} App${known ? ` "${known.name}"` : ""} is registered and not installed yet.`,
        );
        d.out("");
        d.out(INSTALL_IT);
        const page = known?.installPage ?? organization.appsPage();
        for (const l of installing(page, known ? CHOOSE : FIND_IT)) d.out(l);
        d.openPage(page);
      }
      const appId = id;
      const found = await step("look for the app's installation", () =>
        organization.awaitInstallation(appId),
      );
      if (!found)
        throw new StepFailed(
          "✗ Could not see the app installed after 10 minutes.",
        );
      shown = found;
      if (key === null) d.out("✓ Installed the app.");
      else {
        const appKey: string = key;
        const on = await step("count the app's repositories", () =>
          organization.installedOn(
            found.id,
            { clientId: appId, key: appKey },
            CONFIG,
          ),
        );
        if (!found.all && !on.covered)
          throw new StepFailed(
            `✗ The app is not installed on ${repository}, which every repository's runs read. Add it: ${found.page}`,
          );
        d.out(
          `✓ Installed the app on ${on.count} ${on.count === 1 ? "repository" : "repositories"}.`,
        );
      }
    }

    if (credential && storeAs) {
      const name = storeAs;
      // Each prompt names the other choice to a value that belongs to it,
      // then checks the value as the coding agent's own step does.
      const keyStep = credentialNames.includes(name) ? null : credential.or;
      const taken = keyStep ?? credential;
      const got = await askSecret(
        d,
        {
          ...taken,
          verify: async (value, say) => {
            const fault = keyStep
              ? keyFault(value, SUBSCRIPTION)
              : tokenFault(value, API_KEY);
            if (fault) throw new Error(fault);
            return (await taken.verify?.(value, say)) ?? { lines: [] };
          },
        },
        `Run ${command} again to add it.`,
      );
      if (got) {
        await step(`store ${name}`, () =>
          organization.setSecret(name, got.value),
        );
        counts.secrets++;
      }
    }
    const kept = [
      ...(counts.secrets ? [counted(counts.secrets, "secret")] : []),
      ...(counts.variables ? [counted(counts.variables, "variable")] : []),
    ];
    if (kept.length) d.out(`✓ Stored ${listed(kept)} for ${org}.`);
  } catch (e) {
    if (!(e instanceof StepFailed)) throw e;
    return stop(e.message, carryOn);
  }

  // The app cannot make a repository's own rule, so where the organization
  // has none an admin of each repository does: `unruled` is why.
  let unruled = plan.rules
    ? null
    : `${plan.name} has no organization-wide rules.`;
  if (plan.rules && !ruled)
    try {
      await organization.defineProperty(PROPERTY, ["on", "off"]);
      await organization.requireCheckWhere(RULE, REVIEW_VERDICT, {
        property: PROPERTY,
        value: "on",
        source: "runner",
      });
      d.out(
        `✓ Required "${REVIEW_VERDICT}" where the property ${PROPERTY} is "on".`,
      );
    } catch {
      unruled = `${host.label} refused the organization's rule.`;
    }

  d.out("");
  d.out(`✓ ${org} is set up.`);
  d.out("");
  d.out("Next, in each repository you want the factory in:");
  d.out("  1. A developer installs the factory once on their machine:");
  d.out(`       npm install -g ${d.packageName}`);
  d.out("  2. In the repository's checkout, they run:");
  d.out("       factory init");
  d.out(
    "     It asks them for no token, and opens the pull request that sets the repository up.",
  );
  if (unruled) {
    d.out(
      "  3. Once that pull request merges, an admin of the repository runs factory init there",
    );
    d.out(`     again, to require "${REVIEW_VERDICT}". ${unruled}`);
  }
  d.out("");
  for (const l of addresses) d.out(l);
  return 0;
}

/** One line typed at `input`. An input that ends first leaves it waiting,
 * so the browser's return can still end the wait. */
export const readLineFrom =
  (input: NodeJS.ReadableStream) =>
  (signal: AbortSignal): Promise<string> =>
    new Promise((resolve, reject) => {
      const lines = createInterface({ input });
      signal.addEventListener(
        "abort",
        () => {
          lines.close();
          reject(new Error("stopped"));
        },
        { once: true },
      );
      lines.once("line", (line) => {
        lines.close();
        resolve(line);
      });
    });

export async function initOrgDeps(): Promise<InitOrgDeps> {
  const manifest = JSON.parse(
    readFileSync(join(PACKAGE, "package.json"), "utf8"),
  ) as { name: string; version: string };
  return {
    ask: await terminalAsk(),
    out: (l) => console.log(l),
    interactive,
    openPage,
    hasCommand,
    hosts: organizationHosts(),
    tools: TOOLS,
    readLine: readLineFrom(process.stdin),
    packageName: manifest.name,
    packageVersion: manifest.version,
  };
}

export async function run(argv: string[]): Promise<number> {
  try {
    return await main(argv, await initOrgDeps());
  } catch (e) {
    if (e instanceof Error && e.name === "ExitPromptError") {
      console.log("Stopped. Nothing after the last step shown was changed.");
      return 130;
    }
    throw e;
  }
}
