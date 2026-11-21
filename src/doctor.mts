// `factory doctor`: whether the repository's setup works, one line per
// check, each failure with what to do about it. `factory init` ends with the
// same checks.
//
// A stored secret cannot be read back, so a secret is checked only for
// being set.
import { existsSync, readFileSync } from "node:fs";
import { load } from "js-yaml";
import type { CodeHost } from "./code-host/index.mts";
import { bareRegistry, npmrcAt, privateRegistries } from "./npmrc.mts";
import type { Runner } from "./runner/index.mts";
import { join } from "node:path";
import {
  defaultDeps,
  filesDeps,
  repoRoot,
  resolveFiles,
  staleOf,
  type Settings,
} from "./config.mts";
import { presetChecks } from "./preset-commands.mts";
import { hasCommand } from "./lib/has-command.mts";
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
import { differences, LOCK, PACKAGE, plan } from "./sync.mts";
import { inUse, secretSteps, TOOLS, type Registry } from "./tools.mts";
import { fieldChecks } from "./ticket-fields.mts";

export type { Check } from "./setup.mts";

export type DoctorDeps = {
  settings: () => Promise<Settings>;
  /** The paths a sync would change. It rejects with NoDefaultBranch when
   * the default branch, which the sync writes, cannot be told. */
  outOfStep: (s: Settings) => Promise<string[]> | string[];
  /** The version installed, and the one the repository's lock records. */
  versions: () => { installed: string; locked: string | null };
  /** Whether the lock is current, and each preset it records is installed
   * and has a Dependabot group of its own. */
  lockChecks?: () => Promise<Check[]>;
  root: string;
  hasCommand: (name: string) => boolean;
  tools: Registry;
  out: (line: string) => void;
};

const SYNC = "Run npx --no-install factory sync";
const INIT = "Run npx --no-install factory init";
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
    return [{ state: "fail", text: "The settings are valid", fix: message(e) }];
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

  const { installed, locked } = d.versions();
  if (locked === null)
    out.push({
      state: "fail",
      text: `Version ${installed} is installed, but the repository records none`,
      fix: SYNC,
    });
  else if (compareVersions(installed, locked) === 0)
    out.push({
      state: "pass",
      text: `Version ${installed} is installed, as the repository records`,
    });
  else
    out.push({
      state: "fail",
      text: `Version ${installed} is installed, but the repository records ${locked}`,
      fix: compareVersions(installed, locked) < 0 ? "Run npm ci" : SYNC,
    });
  out.push(...((await d.lockChecks?.()) ?? []));

  const chosen: Chosen = {
    codeHost: s.codeHost.type,
    tickets: s.tickets.type,
    runner: s.builds.runner,
    agent: Object.keys(d.tools.agent)[0]!,
  };
  const opened = {
    codeHost: d.tools.codeHost[chosen.codeHost]!.open(s.repository),
    runner: d.tools.runner[chosen.runner]!.open(s.repository),
    tickets: await d.tools.tickets[chosen.tickets]!.open(
      { repository: s.repository, board: s.tickets.board },
      s,
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
    ...((await codeHost!.setup.checks?.({ ...context([]), secrets: null })) ??
      []),
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
  for (const part of PARTS) {
    if (!on.has(part)) {
      out.push({ state: "off", text: `${PART_TEXT[part].name}: off` });
      continue;
    }
    if (secrets === null) continue;
    const forPart = PART_TEXT[part].name.replace(/^./, (c) => c.toLowerCase());
    for (const need of needed.filter((n) => n.part === part))
      out.push(secretLine(need.anyOf, forPart));
  }
  // A gate is no part and fails no check: it is shown as off, since a
  // build cannot finish without one.
  if (s.commands.gate.length === 0)
    out.push({
      state: "off",
      text: "commands.gate is not set: a build cannot finish until it is",
    });
  if (secrets !== null)
    for (const need of needed.filter((n) => n.part === null))
      out.push(secretLine(need.anyOf, need.tool));

  out.push(...(await npmChecks(d.root, opened, isOrganization, own, shared)));

  for (const tool of [tickets, runner, agent])
    out.push(
      ...((await tool!.setup.checks?.({ ...context(on), secrets })) ?? []),
    );
  out.push(
    ...(await fieldChecks(
      opened.tickets,
      s.tickets.ticketFields,
      s.repository,
      tickets!.label,
    )),
  );
  return out;
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
export function line(c: Check): string {
  if (c.state === "off") return `- ${c.text}`;
  if (c.state === "unknown") return `? ${c.text}`;
  if (c.state === "pass") return `✓ ${c.text}`;
  const fix = c.fix ?? "";
  // An instruction follows as its own sentence; a reason, after a colon.
  return `✗ ${c.text}${!fix ? "" : /^Run /.test(fix) ? `. ${fix}` : `: ${fix}`}`;
}

export async function main(_argv: string[], d: DoctorDeps): Promise<number> {
  const found = await checks(d);
  for (const c of found) d.out(line(c));
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
    versions: () => {
      const installed = JSON.parse(
        readFileSync(join(PACKAGE, "package.json"), "utf8"),
      ).version as string;
      let locked: string | null = null;
      try {
        locked =
          /^version: (.+)$/m.exec(
            readFileSync(join(root, LOCK), "utf8"),
          )?.[1] ?? null;
      } catch {
        locked = null;
      }
      return { installed, locked };
    },
    root,
    hasCommand,
    tools: TOOLS,
    out: (l) => console.log(l),
  };
}

export async function run(argv: string[]): Promise<number> {
  return main(argv, doctorDeps());
}
