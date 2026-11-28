#!/usr/bin/env node
// Raises a repository to the newest release of lunamill, and each preset
// it follows to the newest commit that changed that preset's own files.
//
//   lunamill update                   # in the working tree: commit what it writes
//   lunamill update --pull-requests   # one pull request for each, as the Updates job runs it
//
// In the repository that holds an organization's poller, which has that
// workflow's file and no settings, it raises only the release the file
// names.
//
// It always starts in the version installed on the machine, since it is
// what changes the version a repository names, and hands the sync to the
// version it raises the repository to. A pull request is named for what it
// updates and to what, so one that was closed is never opened again, and a
// newer one for the same thing closes the older.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CodeHost } from "./code-host/types.mts";
import { SETTINGS_FILE, type Settings } from "./config.mts";
import {
  branchDeps,
  needDefaultBranch,
  NoDefaultBranch,
  repositoryRemote,
} from "./lib/default-branch.mts";
import { PresetError } from "./preset.mts";
import type { PinMove } from "./preset-fetch.mts";
import { POLLER_FILE } from "./workflow-files.mts";
import * as say from "./lib/output.mts";

/** One preset as the lock pins it. */
export type PresetPin = {
  name: string;
  /** The repository that holds it: the name without its folder. */
  repo: string;
  commit: string;
};

export type UpdateDeps = {
  /** Whether the repository has lunamill's settings file. */
  hasSettings: () => boolean;
  /** lunamill's own repository, which runs its source and names no
   * release. */
  own: boolean;
  /** The version the repository's lock names. */
  version: () => string;
  /** lunamill's newest release, as `1.2.3`. */
  newestRelease: () => Promise<string>;
  presets: {
    pins: () => PresetPin[];
    /** The newest commit of a repository's default branch. Rejects with
     * why when the repository cannot be read. */
    newest: (repo: string) => Promise<string>;
    /** Whether a preset's own files differ at `commit` from its pin. */
    differs: (pin: PresetPin, commit: string) => Promise<boolean>;
    /** Moves the lock's entries for these presets, or none of them, with
     * a PresetError, when one is not a preset at its commit. */
    move: (moves: PinMove[]) => Promise<void>;
    /** What `lunamill preset changes REF` prints. */
    changes: (ref: string) => Promise<string[]>;
  };
  /** Runs `lunamill sync` at a version, or at the one the lock names, and
   * gives what it printed. */
  sync: (version: string | null) => Promise<{ code: number; lines: string[] }>;
  git: (args: string[]) => string;
  defaultBranch: () => Promise<string>;
  /** The name of the repository's remote in the checkout. */
  remote: () => Promise<string>;
  pulls: {
    lastForBranch: CodeHost["lastForBranch"];
    create: CodeHost["create"];
    listOpen: () => Promise<{ number: number; head: { branch: string } }[]>;
    comment: CodeHost["comment"];
    close: CodeHost["close"];
  };
  /** The page of a release's notes. */
  releaseNotes: (version: string) => string;
  out: say.Out;
};

const BRANCHES = "lunamill-update/";
const short = (commit: string) => commit.slice(0, 7);
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Whether release `a` is older than release `b`, each as `1.2.3`. */
function older(a: string, b: string): boolean {
  const pa = a.split(/[.-]/).map(Number);
  const pb = b.split(/[.-]/).map(Number);
  for (let i = 0; i < 3; i++)
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0);
  return false;
}

/** One thing to update: lunamill, or every preset of one repository
 * whose own files changed. */
type Unit = {
  title: string;
  branch: string;
  /** The branch without what it updates to, which an older pull request
   * for the same thing shares. */
  source: string;
  /** The version the sync runs at, or null for the one the lock names. */
  version: string | null;
  moves: PinMove[];
  /** What it prints when it is applied by hand. */
  lines: string[];
};

const sourceOf = (branch: string) =>
  branch.replace(/-(\d+\.\d+\.\d+|[0-9a-f]{7})$/, "");

/** lunamill from one release to a newer one. */
const factoryUnit = (version: string, newest: string): Unit => ({
  title: `Update lunamill to ${newest}`,
  branch: `${BRANCHES}lunamill-${newest}`,
  source: `${BRANCHES}lunamill`,
  version: newest,
  moves: [],
  lines: [`lunamill ${version} → ${newest}`],
});

/** What is behind, what is not, and what could not be read. */
async function survey(d: UpdateDeps) {
  const units: Unit[] = [];
  const current: string[] = [];
  const unread: string[] = [];
  const version = d.version();
  if (!d.own) {
    const newest = await d.newestRelease().catch((e) => {
      throw new NoRelease(message(e));
    });
    if (older(version, newest)) units.push(factoryUnit(version, newest));
  }
  const repos = new Map<string, PresetPin[]>();
  for (const pin of d.presets.pins())
    repos.set(pin.repo, [...(repos.get(pin.repo) ?? []), pin]);
  for (const [repo, pins] of repos) {
    let head: string;
    const unreadable = (pin: PresetPin, e: unknown) =>
      unread.push(
        `? ${pin.name} could not be read: ${message(e).replace(/\.+$/, "")}. To stop following it: lunamill preset remove ${pin.name}`,
      );
    try {
      head = await d.presets.newest(repo);
    } catch (e) {
      for (const pin of pins) unreadable(pin, e);
      continue;
    }
    const moved: PresetPin[] = [];
    for (const pin of pins)
      try {
        if (pin.commit !== head && (await d.presets.differs(pin, head)))
          moved.push(pin);
        else current.push(pin.name);
      } catch (e) {
        unreadable(pin, e);
      }
    if (!moved.length) continue;
    const slug = `${BRANCHES}${repo.replaceAll("/", "-")}`;
    units.push({
      title: `Update ${repo} to ${short(head)}`,
      branch: `${slug}-${short(head)}`,
      source: slug,
      version: null,
      moves: moved.map(({ name }) => ({ name, commit: head })),
      lines: moved.map((p) => `${p.name} ${short(p.commit)} → ${short(head)}`),
    });
  }
  return { units, current, unread, version };
}

/** The one line for a repository with nothing behind. */
function nothing(own: boolean, version: string, pins: PresetPin[]): string {
  const factory = own
    ? "lunamill runs from its source here"
    : `lunamill is ${version}, the newest release`;
  const presets =
    pins.length === 0
      ? "."
      : pins.length === 1
        ? `, and ${pins[0]!.name} is at its newest commit.`
        : pins.length === 2
          ? ", and both presets are at their newest commits."
          : `, and all ${pins.length} presets are at their newest commits.`;
  return `✓ Nothing to update: ${factory}${presets}`;
}

/** The files a sync changed, but the lock, as `git status` lists them. */
function changed(status: string): string[] {
  return status
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => ({ mark: line.slice(0, 2), path: line.slice(3) }))
    .filter(({ path }) => path !== ".claude/lunamill.lock")
    .map(
      ({ mark, path }) =>
        `- ${path}, ${mark.includes("D") ? "deleted" : mark.includes("?") || mark.includes("A") ? "new" : "rewritten"}`,
    );
}

/** A line of what moved, from its old value to its new one. */
function moved(line: string): say.Line {
  const [, what, was, now] = /^(.*) (\S+) → (\S+)$/.exec(line) ?? [];
  return what === undefined
    ? say.text(line)
    : say.text(`${what} `, say.skip(was!), " → ", say.name(now!));
}

async function byHand(d: UpdateDeps): Promise<number> {
  const { units, current, unread, version } = await survey(d);
  for (const l of unread) d.out(say.text(l));
  if (!units.length) {
    if (!unread.length || current.length || !d.presets.pins().length)
      d.out(say.text(nothing(d.own, version, d.presets.pins())));
    return 0;
  }
  for (const unit of units) for (const l of unit.lines) d.out(moved(l));
  const pins = d.presets.pins();
  for (const name of current) {
    const pin = pins.find((p) => p.name === name)!;
    d.out(say.text(`${name} is at its newest commit, ${short(pin.commit)}.`));
  }
  const moves = units.flatMap((u) => u.moves);
  if (moves.length) await d.presets.move(moves);
  const synced = await d.sync(units.find((u) => u.version)?.version ?? null);
  if (synced.code !== 0) return synced.code;
  const wrote = synced.lines.filter((l) => l.startsWith("wrote ")).length;
  const deleted = synced.lines.filter((l) => l.startsWith("deleted ")).length;
  d.out(
    say.text(
      `✓ Wrote ${wrote} file${wrote === 1 ? "" : "s"}${deleted ? ` and deleted ${deleted}` : ""}. Commit them on a branch and open a pull request.`,
    ),
  );
  return 0;
}

type Opening = Pick<UpdateDeps, "git" | "pulls" | "releaseNotes" | "out">;

/** Whether the unit's branch had a pull request before, which it says. */
async function openedBefore(d: Opening, unit: Unit): Promise<boolean> {
  const last = await d.pulls.lastForBranch(unit.branch);
  if (last)
    d.out(
      say.text(
        last.state === "open"
          ? `- #${last.number}, ${unit.title}, is still open`
          : `- ${unit.title} was closed, so it is not opened again`,
      ),
    );
  return last !== null;
}

/** The description of lunamill's own pull request. */
const factoryBody = (d: Opening, unit: Unit) =>
  [
    ...unit.lines,
    ...(() => {
      const files = changed(d.git(["status", "--porcelain"]));
      return files.length ? ["", "Changes here:", ...files] : [];
    })(),
    "",
    `Release notes: ${d.releaseNotes(unit.version!)}`,
  ].join("\n");

/** The default branch, and the repository's remote that has it. */
type Base = { remote: string; branch: string };

const baseOf = async (
  d: Pick<UpdateDeps, "defaultBranch" | "remote">,
): Promise<Base> => ({
  branch: await d.defaultBranch(),
  remote: await d.remote(),
});

/** Commits the working tree on the unit's branch, pushes it, opens its
 * pull request into `base`, closes an older one for the same thing, and
 * leaves the checkout off the branch. */
async function open(d: Opening, unit: Unit, base: Base, body: string) {
  d.git(["add", "-A"]);
  d.git(["commit", "-m", unit.title]);
  d.git(["push", "-u", base.remote, unit.branch]);
  const number = await d.pulls.create({
    title: unit.title,
    head: unit.branch,
    base: base.branch,
    body,
    draft: false,
  });
  d.out(say.text(`✓ Opened #${number}, ${unit.title}`));
  for (const pull of await d.pulls.listOpen()) {
    const { branch } = pull.head;
    if (branch === unit.branch || sourceOf(branch) !== unit.source) continue;
    await d.pulls.comment(pull.number, `Superseded by #${number}.`);
    await d.pulls.close(pull.number);
  }
  d.git(["switch", "--detach", `${base.remote}/${base.branch}`]);
}

async function asPullRequests(d: UpdateDeps): Promise<number> {
  const { units, unread, version } = await survey(d);
  if (!units.length) {
    for (const l of unread) d.out(say.text(l));
    if (!unread.length)
      d.out(say.text(nothing(d.own, version, d.presets.pins())));
    return 0;
  }
  const base = await baseOf(d);
  const ref = `${base.remote}/${base.branch}`;
  let fetched = false;
  let refused = false;
  for (const unit of units) {
    if (await openedBefore(d, unit)) continue;
    if (!fetched) d.git(["fetch", base.remote, base.branch]);
    fetched = true;
    // Each from the default branch, so no update rides on another.
    d.git(["switch", "-C", unit.branch, ref]);
    try {
      if (unit.moves.length) await d.presets.move(unit.moves);
    } catch (e) {
      if (!(e instanceof PresetError)) throw e;
      d.out(say.text(e.message));
      d.git(["switch", "--detach", ref]);
      refused = true;
      continue;
    }
    const synced = await d.sync(unit.version);
    if (synced.code !== 0) return synced.code;
    const body = unit.moves.length
      ? (await d.presets.changes(ref)).join("\n")
      : factoryBody(d, unit);
    await open(d, unit, base, body);
  }
  for (const l of unread) d.out(say.text(l));
  return refused ? 1 : 0;
}

export async function main(argv: string[], d: UpdateDeps): Promise<number> {
  if (!d.hasSettings()) {
    d.out(say.text(".claude/lunamill.yaml is missing. Run: lunamill init"));
    return 1;
  }
  try {
    return argv.includes("--pull-requests")
      ? await asPullRequests(d)
      : await byHand(d);
  } catch (e) {
    if (e instanceof NoRelease) {
      d.out(say.text(`✗ The newest release could not be read: ${e.message}`));
      return 1;
    }
    if (e instanceof NoDefaultBranch || e instanceof PresetError) {
      d.out(say.text(e.message));
      return 1;
    }
    throw e;
  }
}

/** Which update a checkout gets: a repository's, the one of an
 * organization's poller, or none, where lunamill is not set up. */
export function checkoutKind(
  has: (path: string) => boolean,
): "repository" | "poller" | null {
  if (has(SETTINGS_FILE)) return "repository";
  return has(POLLER_FILE) ? "poller" : null;
}

export type PollerDeps = Opening &
  Pick<UpdateDeps, "newestRelease" | "defaultBranch" | "remote"> & {
    /** The text of the poller's file in the checkout. */
    read: () => string;
    write: (text: string) => void;
  };

const POLLER_VERSION = /(poller\.yml@v)(\d+\.\d+\.\d+)/;

/** `lunamill update` where an organization's poller is: the release its
 * file names is raised to the newest, in the working tree or, with
 * `--pull-requests`, as the pull request an update of lunamill is. */
export async function updatePoller(
  argv: string[],
  d: PollerDeps,
): Promise<number> {
  const version = POLLER_VERSION.exec(d.read())?.[2];
  if (!version) {
    d.out(
      say.text(
        `✗ ${POLLER_FILE} names no release of lunamill after poller.yml@v. Write one there, such as poller.yml@v1.2.3.`,
      ),
    );
    return 1;
  }
  let newest: string;
  try {
    newest = await d.newestRelease();
  } catch (e) {
    d.out(say.text(`✗ The newest release could not be read: ${message(e)}`));
    return 1;
  }
  if (!older(version, newest)) {
    d.out(say.text(nothing(false, version, [])));
    return 0;
  }
  const unit = factoryUnit(version, newest);
  const rewrite = () =>
    d.write(d.read().replace(POLLER_VERSION, `$1${newest}`));
  if (!argv.includes("--pull-requests")) {
    for (const l of unit.lines) d.out(moved(l));
    rewrite();
    return 0;
  }
  if (await openedBefore(d, unit)) return 0;
  const base = await baseOf(d);
  d.git(["fetch", base.remote, base.branch]);
  d.git(["switch", "-C", unit.branch, `${base.remote}/${base.branch}`]);
  rewrite();
  await open(d, unit, base, factoryBody(d, unit));
  return 0;
}

/** The repository an organization's poller is in: the one a workflow's run
 * names, or the one the `origin` remote's address names, null when it
 * names none on the code host. */
export function pollerRepository(
  env: Record<string, string | undefined>,
  remote: () => string | null,
  repositoryOf: (address: string) => string | null,
): string | null {
  if (env.GITHUB_REPOSITORY) return env.GITHUB_REPOSITORY;
  const address = remote();
  return address ? repositoryOf(address) : null;
}

/** lunamill's newest release could not be read. */
export class NoRelease extends Error {}

/** The settings as the files have them now, or null once `err` has said
 * what is wrong with them. The lock is not asked: the sync this command
 * runs writes it from these files. */
export async function settingsNow(
  root: string,
  err: say.Out,
): Promise<Settings | null> {
  const { filesDeps, loadSettings, SettingsError } =
    await import("./config.mts");
  try {
    return await loadSettings(filesDeps(root));
  } catch (e) {
    if (!(e instanceof SettingsError)) throw e;
    err(say.text(e.message));
    return null;
  }
}

/** `lunamill update [--pull-requests]`. */
export async function run(argv: string[]): Promise<number> {
  const { repoRoot } = await import("./config.mts");
  const { LOCK, PACKAGE, launcherPath } = await import("./sync.mts");
  const { DEFAULT_CODE_HOST, openCodeHost } =
    await import("./code-host/index.mts");
  const { out, err } = say.printersFor("update");
  const root = repoRoot();
  const has = (path: string) => existsSync(join(root, path));
  const kind = checkoutKind(has);
  if (kind === null) {
    out(say.text(".claude/lunamill.yaml is missing. Run: lunamill init"));
    return 1;
  }
  const manifest = JSON.parse(
    readFileSync(join(PACKAGE, "package.json"), "utf8"),
  ) as { name: string; version: string };
  const home = manifest.name.replace(/^@/, "");
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" });
  const reach = (host: CodeHost) => ({
    newestRelease: async () => {
      const tag = await host.newestRelease(home);
      if (!tag) throw new Error(`${home} has no release`);
      return tag.replace(/^v/, "");
    },
    git,
    defaultBranch: () =>
      needDefaultBranch({
        ...branchDeps(root),
        host: () => host.defaultBranch(),
      }),
    remote: () => repositoryRemote(branchDeps(root)),
    pulls: host,
    releaseNotes: (version: string) => host.releasePage(home, `v${version}`),
    out,
  });
  if (kind === "poller") {
    const { TOOLS } = await import("./tools.mts");
    const repository = pollerRepository(
      process.env,
      () => {
        try {
          return git(["remote", "get-url", "origin"]).trim();
        } catch {
          return null;
        }
      },
      TOOLS.codeHost[DEFAULT_CODE_HOST]!.repositoryOf,
    );
    if (!repository) {
      out(
        say.text(
          `✗ This checkout's origin remote names no repository on the code host, so ${POLLER_FILE} is not updated.`,
        ),
      );
      return 1;
    }
    return updatePoller(argv, {
      ...reach(openCodeHost(repository)),
      read: () => readFileSync(join(root, POLLER_FILE), "utf8"),
      write: (text) => writeFileSync(join(root, POLLER_FILE), text),
    });
  }
  const settings = await settingsNow(root, err);
  if (!settings) return 1;
  const host = openCodeHost(settings.repository, settings.codeHost.type);
  const lockText = () =>
    has(LOCK) ? readFileSync(join(root, LOCK), "utf8") : null;
  const { load } = await import("js-yaml");
  const { lockedVersion, parseName, pinsOf } = await import("./preset.mts");
  const lockVersion = () => lockedVersion(lockText()) ?? manifest.version;
  const { fetchDeps, movePins, newestCommit, presetDiffers, whyUnread } =
    await import("./preset-fetch.mts");
  const { changes, presetDeps } = await import("./preset-commands.mts");
  const fetch = fetchDeps(settings.repository, settings.codeHost.type);
  return main(argv, {
    ...reach(host),
    hasSettings: () => has(SETTINGS_FILE),
    own: launcherPath(PACKAGE, root) === "bin/lunamill.js",
    version: lockVersion,
    presets: {
      pins: () =>
        pinsOf(lockText(), load).map(({ name, commit }) => ({
          name,
          repo: parseName(name).repo,
          commit,
        })),
      newest: async (repo) => {
        try {
          return newestCommit(fetch, repo);
        } catch (e) {
          throw new Error(whyUnread(e, repo, settings.repository));
        }
      },
      differs: async (pin, commit) =>
        presetDiffers(fetch, pin.name, pin.commit, commit),
      move: async (moves) => {
        await movePins(root, moves, fetch);
      },
      changes: async (ref) => {
        const lines: string[] = [];
        await changes([ref], {
          ...presetDeps(root),
          out: (l) => void lines.push(say.render(l, false)),
        });
        return lines;
      },
    },
    sync: async (version) => {
      const r = spawnSync(
        process.execPath,
        [join(PACKAGE, "bin", "lunamill.js"), "sync"],
        {
          cwd: root,
          encoding: "utf8",
          env: {
            ...process.env,
            ...(version ? { LUNAMILL_VERSION: version } : {}),
          },
        },
      );
      if (r.status !== 0) say.write(`${r.stdout}${r.stderr}`, process.stderr);
      return { code: r.status ?? 1, lines: r.stdout.split("\n") };
    },
  });
}
