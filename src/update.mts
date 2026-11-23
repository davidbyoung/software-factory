#!/usr/bin/env node
// Raises a repository to the newest release of the factory, and each preset
// it follows to the newest commit that changed that preset's own files.
//
//   factory update                   # in the working tree: commit what it writes
//   factory update --pull-requests   # one pull request for each, as the Updates job runs it
//
// It always starts in the version installed on the machine, since it is
// what changes the version a repository names, and hands the sync to the
// version it raises the repository to. A pull request is named for what it
// updates and to what, so one that was closed is never opened again, and a
// newer one for the same thing closes the older.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CodeHost } from "./code-host/types.mts";
import type { Settings } from "./config.mts";

/** One preset as the lock pins it. */
export type PresetPin = {
  name: string;
  /** The repository that holds it: the name without its folder. */
  repo: string;
  commit: string;
};

export type UpdateDeps = {
  /** Whether the repository has the factory's settings file. */
  hasSettings: () => boolean;
  /** The factory's own repository, which runs its source and names no
   * release. */
  own: boolean;
  /** The version the repository's lock names. */
  version: () => string;
  /** The factory's newest release, as `1.2.3`. */
  newestRelease: () => Promise<string>;
  presets: {
    pins: () => PresetPin[];
    /** The newest commit of a repository's default branch. Rejects with
     * why when the repository cannot be read. */
    newest: (repo: string) => Promise<string>;
    /** Whether a preset's own files differ at `commit` from its pin. */
    differs: (pin: PresetPin, commit: string) => Promise<boolean>;
    /** Moves the lock's entries for these presets to `commit`. */
    move: (names: string[], commit: string) => Promise<void>;
    /** What `factory preset changes REF` prints. */
    changes: (ref: string) => Promise<string[]>;
  };
  /** Runs `factory sync` at a version, or at the one the lock names, and
   * gives what it printed. */
  sync: (version: string | null) => Promise<{ code: number; lines: string[] }>;
  git: (args: string[]) => string;
  defaultBranch: () => Promise<string>;
  pulls: {
    lastForBranch: CodeHost["lastForBranch"];
    create: CodeHost["create"];
    listOpen: () => Promise<{ number: number; head: { branch: string } }[]>;
    comment: CodeHost["comment"];
    close: CodeHost["close"];
  };
  /** The page of a release's notes. */
  releaseNotes: (version: string) => string;
  out: (line: string) => void;
};

const BRANCHES = "factory-update/";
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

/** One thing to update: the factory, or every preset of one repository
 * whose own files changed. */
type Unit = {
  title: string;
  branch: string;
  /** The branch without what it updates to, which an older pull request
   * for the same thing shares. */
  source: string;
  /** The version the sync runs at, or null for the one the lock names. */
  version: string | null;
  move: { names: string[]; commit: string } | null;
  /** What it prints when it is applied by hand. */
  lines: string[];
};

const sourceOf = (branch: string) =>
  branch.replace(/-(\d+\.\d+\.\d+|[0-9a-f]{7})$/, "");

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
    if (older(version, newest))
      units.push({
        title: `Update the factory to ${newest}`,
        branch: `${BRANCHES}factory-${newest}`,
        source: `${BRANCHES}factory`,
        version: newest,
        move: null,
        lines: [`The factory ${version} → ${newest}`],
      });
  }
  const repos = new Map<string, PresetPin[]>();
  for (const pin of d.presets.pins())
    repos.set(pin.repo, [...(repos.get(pin.repo) ?? []), pin]);
  for (const [repo, pins] of repos) {
    let head: string;
    try {
      head = await d.presets.newest(repo);
    } catch (e) {
      for (const pin of pins)
        unread.push(
          `? ${pin.name} could not be read: ${message(e)}. To stop following it: factory preset remove ${pin.name}`,
        );
      continue;
    }
    const moved: PresetPin[] = [];
    for (const pin of pins)
      if (pin.commit !== head && (await d.presets.differs(pin, head)))
        moved.push(pin);
      else current.push(pin.name);
    if (!moved.length) continue;
    const slug = `${BRANCHES}${repo.replaceAll("/", "-")}`;
    units.push({
      title: `Update ${repo} to ${short(head)}`,
      branch: `${slug}-${short(head)}`,
      source: slug,
      version: null,
      move: { names: moved.map((p) => p.name), commit: head },
      lines: moved.map((p) => `${p.name} ${short(p.commit)} → ${short(head)}`),
    });
  }
  return { units, current, unread, version };
}

/** The one line for a repository with nothing behind. */
function nothing(d: UpdateDeps, version: string, pins: PresetPin[]): string {
  const factory = d.own
    ? "the factory runs from its source here"
    : `the factory is ${version}, the newest release`;
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
    .filter(({ path }) => path !== ".claude/factory.lock")
    .map(
      ({ mark, path }) =>
        `- ${path}, ${mark.includes("D") ? "deleted" : mark.includes("?") || mark.includes("A") ? "new" : "rewritten"}`,
    );
}

async function byHand(d: UpdateDeps): Promise<number> {
  const { units, current, unread, version } = await survey(d);
  unread.forEach(d.out);
  if (!units.length) {
    if (!unread.length || current.length || !d.presets.pins().length)
      d.out(nothing(d, version, d.presets.pins()));
    return 0;
  }
  for (const unit of units) unit.lines.forEach(d.out);
  const pins = d.presets.pins();
  for (const name of current) {
    const pin = pins.find((p) => p.name === name)!;
    d.out(`${name} is at its newest commit, ${short(pin.commit)}.`);
  }
  for (const { move } of units)
    if (move) await d.presets.move(move.names, move.commit);
  const synced = await d.sync(units.find((u) => u.version)?.version ?? null);
  if (synced.code !== 0) return synced.code;
  const wrote = synced.lines.filter((l) => l.startsWith("wrote ")).length;
  const deleted = synced.lines.filter((l) => l.startsWith("deleted ")).length;
  d.out(
    `✓ Wrote ${wrote} file${wrote === 1 ? "" : "s"}${deleted ? ` and deleted ${deleted}` : ""}. Commit them on a branch and open a pull request.`,
  );
  return 0;
}

async function asPullRequests(d: UpdateDeps): Promise<number> {
  const { units, unread, version } = await survey(d);
  if (!units.length) {
    unread.forEach(d.out);
    if (!unread.length) d.out(nothing(d, version, d.presets.pins()));
    return 0;
  }
  const base = await d.defaultBranch();
  let fetched = false;
  for (const unit of units) {
    const last = await d.pulls.lastForBranch(unit.branch);
    if (last) {
      d.out(
        last.state === "open"
          ? `- #${last.number}, ${unit.title}, is still open`
          : `- ${unit.title} was closed, so it is not opened again`,
      );
      continue;
    }
    if (!fetched) d.git(["fetch", "origin", base]);
    fetched = true;
    // Each from the default branch, so no update rides on another.
    d.git(["switch", "-C", unit.branch, `origin/${base}`]);
    if (unit.move) await d.presets.move(unit.move.names, unit.move.commit);
    const synced = await d.sync(unit.version);
    if (synced.code !== 0) return synced.code;
    const body = unit.move
      ? (await d.presets.changes(`origin/${base}`)).join("\n")
      : [
          ...unit.lines,
          ...(() => {
            const files = changed(d.git(["status", "--porcelain"]));
            return files.length ? ["", "Changes here:", ...files] : [];
          })(),
          "",
          `Release notes: ${d.releaseNotes(unit.version!)}`,
        ].join("\n");
    d.git(["add", "-A"]);
    d.git(["commit", "-m", unit.title]);
    d.git(["push", "-u", "origin", unit.branch]);
    const number = await d.pulls.create({
      title: unit.title,
      head: unit.branch,
      base,
      body,
      draft: false,
    });
    d.out(`✓ Opened #${number}, ${unit.title}`);
    for (const pull of await d.pulls.listOpen()) {
      const { branch } = pull.head;
      if (branch === unit.branch || sourceOf(branch) !== unit.source) continue;
      await d.pulls.comment(pull.number, `Superseded by #${number}.`);
      await d.pulls.close(pull.number);
    }
    d.git(["switch", "--detach", `origin/${base}`]);
  }
  unread.forEach(d.out);
  return 0;
}

export async function main(argv: string[], d: UpdateDeps): Promise<number> {
  if (!d.hasSettings()) {
    d.out(".claude/factory.yaml is missing. Run: factory init");
    return 1;
  }
  try {
    return argv.includes("--pull-requests")
      ? await asPullRequests(d)
      : await byHand(d);
  } catch (e) {
    if (e instanceof NoRelease) {
      d.out(`✗ The newest release could not be read: ${e.message}`);
      return 1;
    }
    throw e;
  }
}

/** The factory's newest release could not be read. */
export class NoRelease extends Error {}

/** The settings as the files have them now, or null once `err` has said
 * what is wrong with them. The lock is not asked: the sync this command
 * runs writes it from these files. */
export async function settingsNow(
  root: string,
  err: (line: string) => void,
): Promise<Settings | null> {
  const { filesDeps, loadSettings, SettingsError } =
    await import("./config.mts");
  try {
    return await loadSettings(filesDeps(root));
  } catch (e) {
    if (!(e instanceof SettingsError)) throw e;
    err(e.message);
    return null;
  }
}

/** `factory update [--pull-requests]`. */
export async function run(argv: string[]): Promise<number> {
  const { repoRoot, SETTINGS_FILE } = await import("./config.mts");
  const { LOCK, PACKAGE, launcherPath } = await import("./sync.mts");
  const { openCodeHost } = await import("./code-host/index.mts");
  const { branchDeps, needDefaultBranch } =
    await import("./lib/default-branch.mts");
  const root = repoRoot();
  const hasSettings = () => existsSync(join(root, SETTINGS_FILE));
  if (!hasSettings()) {
    console.log(".claude/factory.yaml is missing. Run: factory init");
    return 1;
  }
  const manifest = JSON.parse(
    readFileSync(join(PACKAGE, "package.json"), "utf8"),
  ) as { name: string; version: string };
  const settings = await settingsNow(root, (line) => console.error(line));
  if (!settings) return 1;
  const host = openCodeHost(settings.repository, settings.codeHost.type);
  const home = manifest.name.replace(/^@/, "");
  const lockText = () =>
    existsSync(join(root, LOCK))
      ? readFileSync(join(root, LOCK), "utf8")
      : null;
  const { load } = await import("js-yaml");
  const { lockedVersion, parseName, pinsOf } = await import("./preset.mts");
  const lockVersion = () => lockedVersion(lockText()) ?? manifest.version;
  const { fetchDeps, movePin, newestCommit, presetDiffers, whyUnread } =
    await import("./preset-fetch.mts");
  const { changes, presetDeps } = await import("./preset-commands.mts");
  const fetch = fetchDeps(settings.repository, settings.codeHost.type);
  return main(argv, {
    hasSettings,
    own: launcherPath(PACKAGE, root) === "bin/factory.js",
    version: lockVersion,
    newestRelease: async () => {
      const tag = await host.newestRelease(home);
      if (!tag) throw new Error(`${home} has no release`);
      return tag.replace(/^v/, "");
    },
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
      move: async (names, commit) => {
        for (const name of names) await movePin(root, name, commit, fetch);
      },
      changes: async (ref) => {
        const lines: string[] = [];
        await changes([ref], {
          ...presetDeps(root),
          out: (l) => lines.push(l),
        });
        return lines;
      },
    },
    sync: async (version) => {
      const r = spawnSync(
        process.execPath,
        [join(PACKAGE, "bin", "factory.js"), "sync"],
        {
          cwd: root,
          encoding: "utf8",
          env: {
            ...process.env,
            ...(version ? { FACTORY_VERSION: version } : {}),
          },
        },
      );
      if (r.status !== 0) process.stderr.write(`${r.stdout}${r.stderr}`);
      return { code: r.status ?? 1, lines: r.stdout.split("\n") };
    },
    git: (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }),
    defaultBranch: () =>
      needDefaultBranch({
        ...branchDeps(root),
        host: () => host.defaultBranch(),
      }),
    pulls: host,
    releaseNotes: (version) => host.releasePage(home, `v${version}`),
    out: (line) => console.log(line),
  });
}
