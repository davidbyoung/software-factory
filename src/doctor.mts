// `factory doctor`: whether the repository's setup works, one line per
// check, each failure with what to do about it. `factory init` ends with the
// same checks.
//
// A stored secret cannot be read back, so a secret is checked only for
// being set.
import { listed } from "./lib/listed.mts";
import { existsSync, readFileSync } from "node:fs";
import { load } from "js-yaml";
import type { CodeHost } from "./code-host/index.mts";
import { bareRegistry, npmrcAt, privateRegistries } from "./npmrc.mts";
import type { Runner } from "./runner/index.mts";
import { join } from "node:path";
import {
  defaultDeps,
  filesDeps,
  loadSettings,
  repoRoot,
  resolveFiles,
  staleOf,
  type Settings,
} from "./config.mts";
import { lockedVersion, ownerOf } from "./preset.mts";
import { presetChecks } from "./preset-commands.mts";
import { hasCommand } from "./lib/has-command.mts";
import { colorOn, painter, plain, type Paint } from "./lib/color.mts";
import {
  neededSecrets,
  PART_TEXT,
  PARTS,
  partsOn,
  type Part,
} from "./parts.mts";
import type { Check, Chosen, SetupContext } from "./setup.mts";
import {
  branchDeps,
  CANNOT_TELL,
  needDefaultBranch,
  NoDefaultBranch,
} from "./lib/default-branch.mts";
import { differences, launcherPath, LOCK, PACKAGE, plan } from "./sync.mts";
import { POLLER_FILE } from "./workflow-files.mts";
import { inUse, secretSteps, TOOLS, type Registry } from "./tools.mts";
import { fieldChecks } from "./ticket-fields.mts";
import { machineState, type MachineState } from "./lib/credentials.mts";

export type { Check } from "./setup.mts";

export type DoctorDeps = {
  settings: () => Promise<Settings>;
  /** The paths a sync would change. It rejects with NoDefaultBranch when
   * the default branch, which the sync writes, cannot be told. */
  outOfStep: (s: Settings) => Promise<string[]> | string[];
  /** The version the lock names, or null for none; the factory's newest
   * release, asked for only when it is needed; and whether the repository
   * is the factory's own, which runs its source. */
  factory: () => Promise<{
    named: string | null;
    own: boolean;
    newest: () => Promise<string>;
  }>;
  /** Whether the lock is current, and each preset it records is installed
   * and has a Dependabot group of its own. */
  lockChecks?: () => Promise<Check[]>;
  root: string;
  hasCommand: (name: string) => boolean;
  tools: Registry;
  out: (line: string) => void;
  paint?: Paint;
  /** Where a credential's variables and the credentials file are read. */
  env?: Record<string, string | undefined>;
};

const SYNC = "Run factory sync";
const INIT = "Run factory init";
const SETTINGS = "Settings and files";
const OFF = "Parts that are off";
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** -1, 0, or 1 as version `a` is older than, the same as, or newer than `b`. */
function compareVersions(a: string, b: string): number {
  if (a === b) return 0;
  const pa = a.split(/[.-]/).map(Number);
  const pb = b.split(/[.-]/).map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export async function checks(d: DoctorDeps): Promise<Check[]> {
  const out: Check[] = [];
  let s: Settings;
  try {
    s = await d.settings();
  } catch (e) {
    return [
      {
        state: "fail",
        text: "The settings are valid",
        fix: message(e),
        group: SETTINGS,
      },
    ];
  }
  out.push({ state: "pass", text: "The settings are valid" });

  let differ: string[] | null = null;
  try {
    differ = await d.outOfStep(s);
  } catch (e) {
    if (!(e instanceof NoDefaultBranch)) throw e;
  }
  out.push(
    differ?.length === 0
      ? { state: "pass", text: "The factory's files match the settings" }
      : {
          state: "fail",
          text: "The factory's files match the settings",
          fix: differ ? `${differ.length} differ. ${SYNC}` : CANNOT_TELL,
        },
  );

  const factory = await d.factory();
  if (factory.own)
    out.push({ state: "pass", text: "The factory runs from its source here" });
  else if (factory.named === null)
    out.push({
      state: "fail",
      text: "The repository names a version of the factory",
      fix: SYNC,
    });
  else {
    const { named } = factory;
    try {
      const newest = await factory.newest();
      out.push(
        compareVersions(named, newest) < 0
          ? {
              state: "unknown",
              text: `The factory ${named}. ${newest} is released: merge its pull request, or run factory update`,
            }
          : { state: "pass", text: `The factory ${named}, the newest release` },
      );
    } catch (e) {
      out.push({
        state: "unknown",
        text: `The factory ${named}. The newest release could not be read: ${message(e)}`,
      });
    }
  }
  out.push(...((await d.lockChecks?.()) ?? []));
  for (const c of out) c.group = SETTINGS;
  const under = (group: string, found: Check[]) =>
    found.map((c) => ({ ...c, group }));

  const chosen: Chosen = {
    codeHost: s.codeHost.type,
    tickets: s.tickets.type,
    runner: s.builds.runner,
    agent: Object.keys(d.tools.agent)[0]!,
  };
  // The credential the ticket system keeps on this machine, checked first:
  // the system is opened with it only once it is accepted.
  const step = d.tools.tickets[chosen.tickets]!.setup.credential;
  const machine = step?.machine
    ? await machineState(
        step,
        chosen.tickets,
        String(s.tickets.options[step.machine.under] ?? ""),
        d.env ?? process.env,
      )
    : null;
  const opened = {
    codeHost: d.tools.codeHost[chosen.codeHost]!.open(s.repository),
    runner: d.tools.runner[chosen.runner]!.open(s.repository),
    tickets: await d.tools.tickets[chosen.tickets]!.open(
      { repository: s.repository, board: s.tickets.board },
      s,
      machine?.state === "accepted" ? { credential: machine.values } : {},
    ),
  };
  const context = (parts: Iterable<Part>): SetupContext => ({
    repository: s.repository,
    root: d.root,
    parts: new Set(parts),
    chosen,
    settings: s,
    hasCommand: d.hasCommand,
    opened,
  });
  const [agent, codeHost, tickets, runner] = inUse(d.tools, chosen);
  out.push(
    ...under(
      codeHost!.label,
      (await codeHost!.setup.checks?.({ ...context([]), secrets: null })) ?? [],
    ),
  );

  // A secret the organization shares with the repository counts as set.
  const isOrganization = await opened.codeHost
    .ownerIsOrganization()
    .catch(() => true);
  const shared = isOrganization
    ? await opened.runner.organizationSecretNames().catch(() => [])
    : [];
  let own: string[] | null;
  try {
    own = await opened.runner.secretNames();
  } catch (e) {
    own = null;
    out.push({
      state: "fail",
      text: "The secrets can be listed",
      fix: message(e),
      group: runner!.label,
    });
  }
  const secrets = own === null ? null : [...own, ...shared];
  const cloudNeeds = secretSteps(d.tools, context(["cloud"])).flatMap((x) =>
    x.step.needs.filter((n) => n.part === "cloud"),
  );
  const on = partsOn(s, secrets ?? [], cloudNeeds);
  const needed = neededSecrets(on, secretSteps(d.tools, context(on)));
  const secretLine = (anyOf: string[], forWhat: string): Check => {
    const found = anyOf.find((n) => secrets!.includes(n));
    const by = found && !own!.includes(found) ? " by the organization" : "";
    return found
      ? { state: "pass", text: `${found} is set${by}, for ${forWhat}` }
      : {
          state: "fail",
          text: `${anyOf.join(" or ")} is not set, for ${forWhat}`,
          fix: INIT,
        };
  };
  // One line per secret, naming every part that reads it.
  const reads = new Map<string, { anyOf: string[]; fors: string[] }>();
  const reading = (anyOf: string[], forWhat: string) => {
    // Parts can accept different names for one secret: the one set is the
    // line, or the names asked for when none is.
    const key = anyOf.find((n) => secrets!.includes(n)) ?? anyOf.join(" or ");
    const entry = reads.get(key) ?? { anyOf, fors: [] };
    entry.fors.push(forWhat);
    reads.set(key, entry);
  };
  for (const part of PARTS) {
    if (!on.has(part)) {
      out.push({ state: "off", text: PART_TEXT[part].name, group: OFF });
      continue;
    }
    if (secrets === null) continue;
    const forPart = PART_TEXT[part].name.replace(/^./, (c) => c.toLowerCase());
    for (const need of needed.filter((n) => n.part === part))
      reading(need.anyOf, forPart);
  }
  // A gate is no part and fails no check: it is shown as off, since a
  // build cannot finish without one.
  if (s.commands.gate.length === 0)
    out.push({
      state: "off",
      text: "commands.gate is not set: a build cannot finish until it is",
      group: SETTINGS,
    });
  if (secrets !== null)
    for (const need of needed.filter((n) => n.part === null))
      reading(need.anyOf, need.tool);
  for (const { anyOf, fors } of reads.values())
    out.push({ ...secretLine(anyOf, listed(fors)), group: runner!.label });

  out.push(
    ...under(
      runner!.label,
      await npmChecks(d.root, opened, isOrganization, own, shared),
    ),
  );

  if (machine)
    out.push({
      ...machineCheck(
        machine,
        step!.parts.map((p) => p.name),
        String(s.tickets.options[step!.machine!.under] ?? ""),
      ),
      group: tickets!.label,
    });
  // A ticket system its credential does not open is not checked further.
  const reachable = !machine || machine.state === "accepted";
  for (const tool of reachable ? [tickets, runner, agent] : [runner, agent])
    out.push(
      ...under(
        tool!.label,
        (await tool!.setup.checks?.({ ...context(on), secrets })) ?? [],
      ),
    );
  if (s.builds.pollerIn)
    out.push({
      ...(await pollerCheck(
        d.tools.runner[chosen.runner]!.open(s.builds.pollerIn),
        s.builds.pollerIn,
      )),
      group: runner!.label,
    });
  if (reachable)
    out.push(
      ...under(
        tickets!.label,
        await fieldChecks(
          opened.tickets,
          s.tickets.ticketFields,
          s.repository,
          tickets!.label,
        ),
      ),
    );
  const order = [
    SETTINGS,
    codeHost!.label,
    runner!.label,
    tickets!.label,
    agent!.label,
    OFF,
  ];
  const rank = (c: Check) => order.indexOf(c.group ?? SETTINGS);
  return out
    .map((c, i) => [c, i] as const)
    .sort(([a, i], [b, j]) => rank(a) - rank(b) || i - j)
    .map(([c]) => c);
}

/** Whether an organization's poller, the scheduled workflow in
 * `repository` that starts this repository's builds, is switched on. */
async function pollerCheck(runner: Runner, repository: string): Promise<Check> {
  const file = POLLER_FILE.split("/").at(-1)!;
  let state: Awaited<ReturnType<Runner["workflowState"]>>;
  try {
    state = await runner.workflowState(file);
  } catch (e) {
    return {
      state: "unknown",
      text: `Could not tell whether ${file} is enabled in ${repository}: ${message(e)}`,
    };
  }
  if (state === "active")
    return { state: "pass", text: `${file} is enabled in ${repository}` };
  return state === "disabled"
    ? {
        state: "fail",
        text: `${file} is disabled in ${repository}`,
        fix: `Enable it on the Actions tab of ${repository}`,
      }
    : {
        state: "fail",
        text: `${file} is not on the default branch of ${repository}`,
        fix: `An owner of ${ownerOf(repository)} runs factory init --org again`,
      };
}

/** The one line on the credential this machine holds, with its fix in
 * the words every other line uses. */
function machineCheck(m: MachineState, names: string[], site: string): Check {
  switch (m.state) {
    case "accepted":
      return {
        state: "pass",
        text:
          m.source === "env"
            ? `The credential in ${listed(names)} is accepted, for ${m.account}`
            : `The credential on this machine is accepted, for ${m.account}`,
      };
    case "missing":
      return {
        state: "fail",
        text: `No credential on this machine for ${site}`,
        fix: INIT,
      };
    case "refused":
      return m.source === "env"
        ? {
            state: "fail",
            text: `The credential in ${listed(names)} is refused (${m.reason}). They may have expired: replace them where they are set`,
          }
        : {
            state: "fail",
            text: `The credential on this machine is refused (${m.reason}). It may have expired`,
            fix: INIT,
          };
    case "unchecked":
      return {
        state: "fail",
        text: `The credential on this machine could not be checked (${m.reason}). Check that ${site} can be reached`,
        fix: "Run factory doctor",
      };
    case "unreadable":
      return m.unreadable === "loose"
        ? {
            state: "fail",
            text: `${m.path} can be read by others`,
            fix: `Run chmod 600 ${m.path}`,
          }
        : {
            state: "fail",
            text: `${m.path} is not valid YAML. Fix or delete it`,
            fix: INIT,
          };
  }
}

const DEPENDABOT = ".github/dependabot.yml";
const FOR_NPM = "for installing what .npmrc names";
const FOR_DEPENDABOT = "for installing on Dependabot's pull requests";

/** The checks for the variables `.npmrc`'s sign-in lines read: each one's
 * secret for Actions and for Dependabot, and whether Dependabot's settings
 * use each registry `.npmrc` names. */
async function npmChecks(
  root: string,
  opened: { codeHost: CodeHost; runner: Runner },
  isOrganization: boolean,
  own: string[] | null,
  shared: string[],
): Promise<Check[]> {
  const npmrc = npmrcAt(root);
  if (!npmrc.names.length) return [];
  const out: Check[] = [];
  let dependabot: string[] | null;
  try {
    dependabot = await opened.runner.dependabotSecretNames();
  } catch (e) {
    dependabot = null;
    out.push({
      state: "fail",
      text: "The Dependabot secrets can be listed",
      fix: message(e),
    });
  }
  const tokens = npmrc.names.filter((n) => n !== "GITHUB_TOKEN");
  const organizations =
    isOrganization &&
    dependabot !== null &&
    tokens.some((n) => !dependabot!.includes(n))
      ? await opened.runner.organizationDependabotSecretNames(
          await opened.codeHost.isPrivate(),
        )
      : [];
  for (const name of npmrc.names) {
    if (name === "GITHUB_TOKEN") {
      out.push({
        state: "off",
        text: "GITHUB_TOKEN is the workflow's own token: it installs only the packages that give this repository access",
      });
      continue;
    }
    if (own !== null)
      out.push(
        own.includes(name)
          ? { state: "pass", text: `${name} is set, ${FOR_NPM}` }
          : shared.includes(name)
            ? {
                state: "pass",
                text: `${name} is set by the organization, ${FOR_NPM}`,
              }
            : {
                state: "fail",
                text: `${name} is not set, ${FOR_NPM}`,
                fix: INIT,
              },
      );
    if (dependabot === null) continue;
    out.push(
      dependabot.includes(name)
        ? {
            state: "pass",
            text: `${name} is set for Dependabot, ${FOR_DEPENDABOT}`,
          }
        : organizations === null
          ? {
              state: "unknown",
              text: `${name} is not set for Dependabot on the repository, and only an organization admin can see whether the organization sets it`,
            }
          : organizations.includes(name)
            ? {
                state: "pass",
                text: `${name} is set by the organization for Dependabot, ${FOR_DEPENDABOT}`,
              }
            : {
                state: "fail",
                text: `${name} is not set for Dependabot, ${FOR_DEPENDABOT}`,
                fix: INIT,
              },
    );
  }
  const path = join(root, DEPENDABOT);
  if (existsSync(path)) {
    const settings = readFileSync(path, "utf8");
    for (const url of privateRegistries(npmrc))
      out.push(
        usesRegistry(settings, url)
          ? {
              state: "pass",
              text: `${DEPENDABOT} uses ${url} for its npm updates`,
            }
          : {
              state: "unknown",
              text: `${DEPENDABOT} doesn't use ${url} for its npm updates: unless your organization sets that registry for Dependabot, it never sees a new version of a package from there. Add it under registries, and name it in the npm entry's registries`,
            },
      );
  }
  return out;
}

/** Whether Dependabot's settings name the registry at `url` under their
 * `registries`, and every npm update lists it, or all of them. */
export function usesRegistry(settings: string, url: string): boolean {
  let o: unknown;
  try {
    o = load(settings);
  } catch {
    return false;
  }
  const isObj = (x: unknown): x is Record<string, unknown> =>
    typeof x === "object" && x !== null && !Array.isArray(x);
  if (!isObj(o) || !isObj(o.registries)) return false;
  const names = Object.entries(o.registries)
    .filter(
      ([, r]) =>
        isObj(r) &&
        typeof r.url === "string" &&
        bareRegistry(r.url) === bareRegistry(url),
    )
    .map(([name]) => name);
  const npm = (Array.isArray(o.updates) ? o.updates : []).filter(
    (u) => isObj(u) && u["package-ecosystem"] === "npm",
  ) as Record<string, unknown>[];
  return (
    names.length > 0 &&
    npm.length > 0 &&
    npm.every(
      (u) =>
        u.registries === "*" ||
        (Array.isArray(u.registries) &&
          u.registries.some((r) => names.includes(String(r)))),
    )
  );
}

/** One check as a line: a tick, a cross with what to do, or a dash for a
 * part that is off. */
export function line(c: Check, paint: Paint = plain): string {
  if (c.state === "off") return `${paint("dim", "-")} ${c.text}`;
  if (c.state === "unknown") return `${paint("yellow", "?")} ${c.text}`;
  if (c.state === "pass") return `${paint("green", "✓")} ${c.text}`;
  const fix = c.fix ?? "";
  // An instruction follows as its own sentence; a reason, after a colon.
  return `${paint("red", "✗")} ${c.text}${!fix ? "" : /^Run /.test(fix) ? `. ${fix}` : `: ${fix}`}`;
}

/** The checks under their headings, each group apart from the next, the
 * whole indented by `indent` spaces. */
export function printChecks(
  found: Check[],
  paint: Paint = plain,
  indent = 0,
): string[] {
  const at = " ".repeat(indent);
  const out: string[] = [];
  let heading: string | undefined;
  for (const c of found) {
    if (c.group !== heading || out.length === 0) {
      if (out.length) out.push("");
      heading = c.group;
      if (heading) out.push(`${at}${heading}`);
    }
    out.push(`${at}${heading ? "  " : ""}${line(c, paint)}`);
  }
  return out;
}

export async function main(_argv: string[], d: DoctorDeps): Promise<number> {
  const found = await checks(d);
  for (const l of printChecks(found, d.paint)) d.out(l);
  return found.some((c) => c.state === "fail") ? 1 : 0;
}

/** The checks, run in the repository this command runs in. */
export function doctorDeps(root = repoRoot()): DoctorDeps {
  const resolved = () => resolveFiles(filesDeps(root));
  return {
    settings: async () => (await resolved()).settings,
    outOfStep: async (s) =>
      differences(
        root,
        await plan(
          PACKAGE,
          root,
          await resolved(),
          await needDefaultBranch(branchDeps(root, process.env, async () => s)),
        ),
      ),
    lockChecks: async () =>
      presetChecks(root, await staleOf(defaultDeps(root))),
    factory: async () => {
      const manifest = JSON.parse(
        readFileSync(join(PACKAGE, "package.json"), "utf8"),
      ) as { name: string };
      const named = lockedVersion(
        existsSync(join(root, LOCK))
          ? readFileSync(join(root, LOCK), "utf8")
          : null,
      );
      const home = manifest.name.replace(/^@/, "");
      return {
        named,
        own: launcherPath(PACKAGE, root) === "bin/factory.js",
        newest: async () => {
          const s = await loadSettings();
          const tag = await TOOLS.codeHost[s.codeHost.type]!.open(
            s.repository,
          ).newestRelease(home);
          if (!tag) throw new Error(`${home} has no release`);
          return tag.replace(/^v/, "");
        },
      };
    },
    root,
    hasCommand,
    tools: TOOLS,
    out: (l) => console.log(l),
    paint: painter(colorOn()),
  };
}

export async function run(argv: string[]): Promise<number> {
  return main(argv, doctorDeps());
}
