// `factory remove`: takes the factory out of a repository. It shows every
// file it will delete or change, and once told to go ahead deletes the
// factory's files, takes its part out of the files it shares with the
// coding agent, and prints what is left outside the repository for you to
// remove by hand. It commits nothing.
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  parseSettings,
  repoRoot,
  SETTINGS_FILE,
  type Settings,
} from "./config.mts";
import { hasCommand, noTerminal } from "./lib/has-command.mts";
import { listed } from "./lib/listed.mts";
import { credentialsPath, hasEntry, shownPath } from "./lib/credentials.mts";
import type {
  Chosen,
  CredentialStep,
  SetupContext,
  Unconfigured,
} from "./setup.mts";
import { LOCK } from "./sync.mts";
import { CHOICES_FILE } from "./preset.mts";
import { builtOf, inUse, TOOLS, type Registry } from "./tools.mts";

export type RemoveDeps = {
  root: string;
  confirm: (message: string, fallback: boolean) => Promise<boolean>;
  out: (line: string) => void;
  tools: Registry;
  hasCommand: (name: string) => boolean;
  /** Where the credentials file is read. */
  env?: Record<string, string | undefined>;
};

/** The agents and skills the lock lists that presets shipped, a skill as
 * its folder. */
async function presetFiles(root: string): Promise<string[]> {
  const at = join(root, LOCK);
  if (!existsSync(at)) return [];
  const { load } = await import("js-yaml");
  const { readLock } = await import("./preset.mts");
  let lock: ReturnType<typeof readLock>;
  try {
    lock = readLock(readFileSync(at, "utf8"), load);
  } catch {
    return [];
  }
  const files = new Set<string>();
  for (const f of lock.files) {
    const agent = /^\.claude\/agents\/(?!factory-)[^/]+\.md$/.test(f);
    const skill = /^\.claude\/skills\/(?!factory-)([^/]+)\//.exec(f);
    if (agent) files.add(f);
    else if (skill) files.add(`.claude/skills/${skill[1]}`);
  }
  return [...files].filter((p) => existsSync(join(root, p)));
}

/** What is left of a credential kept on the machine: its secrets, among
 * those set, and the file's entry for the site, which only the settings
 * name. The file's keys are read; the ticket system is never called. */
function credentialLeftovers(
  step: CredentialStep,
  tool: string,
  settings: Settings | null,
  secrets: string[] | null,
  env: Record<string, string | undefined>,
): string[] {
  const lines: string[] = [];
  const names = step.parts
    .map((p) => p.name)
    .filter((n) => secrets === null || secrets.includes(n));
  if (names.length)
    lines.push(
      `Delete the secret${names.length === 1 ? "" : "s"} ${listed(names)}${secrets === null ? " if set" : ""}`,
    );
  if (!settings || !step.machine) return lines;
  const site = String(settings.tickets.options[step.machine.under] ?? "");
  const held = hasEntry(tool, site, env);
  if (held === false) return lines;
  lines.push(
    `Delete ${site} from ${shownPath(credentialsPath(env))}, unless another repository on that site uses it${step.revoke ? `, and revoke the token at ${step.revoke.page}` : ""}${held === null ? ", if it is there" : ""}`,
  );
  return lines;
}

/** The factory's own files and folders, each a path from the root. */
function factoryFiles(root: string): string[] {
  const named = (dir: string, match: RegExp) =>
    existsSync(join(root, dir))
      ? readdirSync(join(root, dir))
          .filter((f) => match.test(f))
          .sort()
          .map((f) => `${dir}/${f}`)
      : [];
  return [
    SETTINGS_FILE,
    LOCK,
    CHOICES_FILE,
    ".claude/factory",
    ...named(".claude/skills", /^factory-/),
    ...named(".claude/agents", /^factory-.*\.md$/),
    ...named(".github/workflows", /^factory(-.*)?\.yml$/),
    ".github/factory-review.md",
    ...named(".github/actions", /^factory-/),
  ].filter((p) => existsSync(join(root, p)));
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function main(_argv: string[], d: RemoveDeps): Promise<number> {
  const first = (r: Record<string, unknown>) => Object.keys(r)[0]!;
  let settings: Settings | null = null;
  let unread: string | null = null;
  const path = join(d.root, SETTINGS_FILE);
  if (!existsSync(path)) unread = "there is none";
  else
    try {
      const { parse } = await import("yaml");
      settings = parseSettings(
        parse(readFileSync(path, "utf8")),
        (p) => existsSync(join(d.root, p)),
        builtOf(d.tools),
      );
    } catch (e) {
      unread = message(e);
    }

  const chosen: Chosen = {
    codeHost: settings?.codeHost.type ?? first(d.tools.codeHost),
    tickets: settings?.tickets.type ?? first(d.tools.tickets),
    runner: settings?.builds.runner ?? first(d.tools.runner),
    agent: first(d.tools.agent),
  };
  const repository = settings?.repository ?? "";
  const context: SetupContext = {
    repository,
    root: d.root,
    parts: new Set(),
    chosen,
    settings,
    hasCommand: d.hasCommand,
    opened: {
      codeHost: d.tools.codeHost[chosen.codeHost]!.open(repository),
      runner: d.tools.runner[chosen.runner]!.open(repository),
      tickets: await d.tools.tickets[chosen.tickets]!.open(
        { repository, board: settings?.tickets.board ?? null },
        settings,
      ),
    },
  };
  const tools = inUse(d.tools, chosen);

  const deletes = [...factoryFiles(d.root), ...(await presetFiles(d.root))];
  const changes: Unconfigured[] = tools.flatMap(
    (t) => t.setup.unconfigure?.(context) ?? [],
  );
  if (deletes.length === 0 && changes.length === 0) {
    d.out("Nothing of the factory's is here.");
    return 0;
  }
  if (unread !== null)
    d.out(
      `Could not read ${SETTINGS_FILE}: ${unread}. Naming what ${listed(tools.map((t) => t.label))} leave behind.`,
    );

  d.out("This is everything remove will do:");
  for (const p of deletes) d.out(`  Delete   ${p}`);
  for (const c of changes)
    d.out(`  ${c.text === null ? "Delete " : "Change "}  ${c.path}`);
  if (!(await d.confirm("Go ahead?", true))) {
    d.out("Nothing changed.");
    return 0;
  }

  for (const p of deletes)
    rmSync(join(d.root, p), { recursive: true, force: true });

  for (const c of changes)
    if (c.text === null) rmSync(join(d.root, c.path), { force: true });
    else writeFileSync(join(d.root, c.path), c.text);
  // A folder the deletions emptied goes too, up to the root.
  for (const p of [
    ...deletes,
    ...changes.filter((c) => c.text === null).map((c) => c.path),
  ])
    for (let dir = dirname(p); dir !== "."; dir = dirname(dir)) {
      const at = join(d.root, dir);
      if (!existsSync(at) || readdirSync(at).length) break;
      rmdirSync(at);
    }

  let secrets: string[] | null = null;
  if (settings)
    secrets = await context.opened.runner.secretNames().catch(() => null);
  const withSecrets = { ...context, secrets };
  const ticketTool = d.tools.tickets[chosen.tickets]!;
  // Each tool's lines under its name, numbered straight through.
  const groups: [string, string[]][] = [
    ...[tools[1]!, tools[2]!, tools[3]!, tools[0]!].map(
      (t): [string, string[]] => [
        t.label,
        [
          ...(t.setup.leftovers?.(withSecrets) ?? []),
          ...(t === ticketTool && t.setup.credential
            ? credentialLeftovers(
                t.setup.credential,
                chosen.tickets,
                settings,
                secrets,
                d.env ?? process.env,
              )
            : []),
        ],
      ],
    ),
    ["Then", ["Commit this on a branch, open a pull request, and merge it"]],
  ];
  d.out("");
  d.out("Nothing is committed. Left for you to do by hand:");
  let n = 0;
  for (const [label, lines] of groups) {
    if (!lines.length) continue;
    d.out("");
    d.out(`  ${label}`);
    for (const step of lines) d.out(`  ${++n}. ${step}.`);
  }
  return 0;
}

export async function run(argv: string[]): Promise<number> {
  const terminal = noTerminal("remove");
  if (terminal) {
    console.log(terminal);
    return 1;
  }
  const { confirm } = await import("@inquirer/prompts");
  try {
    return await main(argv, {
      root: repoRoot(),
      confirm: (message, fallback) => confirm({ message, default: fallback }),
      out: (l) => console.log(l),
      tools: TOOLS,
      hasCommand,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "ExitPromptError") {
      console.log("Stopped. Nothing changed.");
      return 130;
    }
    throw e;
  }
}
