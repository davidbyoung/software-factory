// The other repositories a ticket names, beside the one a session is in.
//
//   kodor workspace N
//   kodor workspace N --remove
//
// On a machine it clones each of the others from its default branch to
// ~/.local/share/kodor/work/OWNER/NAME-NUMBER/REPOSITORY, on the
// ticket's branch, and says where each is. They are outside the checkout,
// since a tool there, such as a test runner, would take a clone's files for
// its own. `kodor sync` lets a session edit that folder. In the cloud it
// clones nothing, and says what was handed over.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { homeOf, progressOf, repositoriesOf, type Reach } from "./across.mts";
import { defaultDeps, loadSettings } from "./config.mts";
import type { Handoff } from "./handoff/index.mts";
import { SESSION_FILE, sessionFiles } from "./lib/clock.mts";
import {
  lastPart,
  mergeOrder,
  ownerOf,
  sameRepository,
  WORK,
  wordOf,
} from "./lib/repositories.mts";
import { LOCK_FILE } from "./preset.mts";
import * as say from "./lib/output.mts";
import type { Key, Tickets } from "./tickets/types.mts";

export const workFolder = (home = homedir()) =>
  join(home, WORK.slice("~/".length));

export type Deps = {
  tickets: Tickets;
  /** The repository of the checkout, and its root. */
  repository: string;
  root: string;
  /** Where the clones go. */
  work: string;
  reach: Reach;
  /** Where git clones a repository from. */
  remote: (repository: string) => string;
  /** The branch a build of the ticket pushes in the checkout at `root`,
   * where the ticket is typed as `key`, or null in one that is not set
   * up. */
  branch: (key: Key, root: string) => Promise<string | null>;
  /** The checkout's shared git folder. */
  gitDir: () => string;
  handoff: Handoff | null;
  out: say.Out;
  err: say.Out;
};

const USAGE = "Usage: kodor workspace N [--remove]";

function git(cwd: string, ...args: string[]) {
  const r = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  const said = (r.stderr || r.error?.message || "").trim().split("\n").at(-1);
  return { ok: r.status === 0, out: r.stdout ?? "", said: said ?? "" };
}

/** The folder of a ticket's clones, named as no other ticket's is. */
export function folderOf(work: string, full: Key, home: string): string {
  return join(work, ...ownerOf(home).split("/"), wordOf(full));
}

type Row = {
  mark: "ok" | "fail" | "off";
  name: string;
  what: string;
  where: string;
};

function print(ref: string, rows: Row[], d: Deps): void {
  d.out(say.heading(`${ref} workspace`));
  const pad = (of: (r: Row) => string) =>
    Math.max(...rows.map((r) => of(r).length));
  const name = pad((r) => r.name);
  const what = pad((r) => r.what);
  for (const r of rows)
    d.out(
      say.mark(
        r.mark,
        `${r.name.padEnd(name)}   ${r.what.padEnd(what)}   ${r.where}`.trimEnd(),
        { indent: 2 },
      ),
    );
}

const current = (folder: string) =>
  git(folder, "branch", "--show-current").out.trim();

/** Clones a repository and puts it on the ticket's branch, or says why it
 * could not. One already there is left as it is. */
async function clone(
  name: string,
  folder: string,
  key: Key,
  d: Deps,
): Promise<{ branch: string } | { fault: string }> {
  if (!existsSync(join(folder, ".git"))) {
    mkdirSync(dirname(folder), { recursive: true });
    const made = git(dirname(folder), "clone", "-q", d.remote(name), folder);
    if (!made.ok) return { fault: made.said };
    const branch = await d.branch(key, folder);
    if (branch === null) return { branch: current(folder) };
    const remote = git(
      folder,
      "ls-remote",
      "--exit-code",
      "origin",
      `refs/heads/${branch}`,
    );
    const switched = remote.ok
      ? git(folder, "switch", "-q", branch)
      : git(folder, "switch", "-q", "-c", branch);
    if (!switched.ok) return { fault: switched.said };
  }
  return { branch: current(folder) };
}

async function make(key: Key, d: Deps): Promise<number> {
  const ticket = await d.tickets.read(key);
  const ref = d.tickets.ref(key);
  const home = homeOf(d.tickets, key, d.repository);
  const list = repositoriesOf(ticket, d.tickets, home);
  if (!list) {
    d.out(say.text(`${ref} has one repository: nothing to clone.`));
    return 0;
  }
  if (!list.some((r) => sameRepository(r.name, d.repository))) {
    d.err(
      say.text(
        `✗ This checkout, ${d.repository}, is not one of ${ref}'s repositories: ${list.map((r) => r.name).join(", ")}`,
      ),
    );
    return 1;
  }
  const full = d.tickets.keyIn(key, "");
  const folder = folderOf(d.work, full, home);
  const session = sessionFiles(d.gitDir());
  const all = await progressOf(ticket, list, d.tickets, d.reach);
  const built = (name: string) => {
    const pull = all.find((r) => r.name === name)?.pulls.at(-1);
    return pull ? `, built in ${name}#${pull.number}` : "";
  };
  const rows: Row[] = [];
  const read: string[] = [];
  for (const { name } of mergeOrder(list)) {
    if (sameRepository(name, d.repository)) {
      const branch = await d.branch(key, d.root);
      rows.push({
        mark: "ok",
        name,
        what: `branch ${branch ?? current(d.root)}`,
        where: `${d.root}, this checkout${built(name)}`,
      });
      continue;
    }
    const there = join(folder, lastPart(name));
    const here = d.tickets.keyIn(key, name);
    const made = await clone(name, there, here, d);
    if ("fault" in made) {
      rows.push({ mark: "fail", name, what: made.fault, where: "" });
      continue;
    }
    // The session's claim and cost clock stay where it made them.
    writeFileSync(
      join(there, ".git", SESSION_FILE),
      JSON.stringify({ dir: session.dir, there: key, here }),
    );
    rows.push({
      mark: "ok",
      name,
      what: `branch ${made.branch}`,
      where: `${there}${built(name)}`,
    });
    if (existsSync(join(there, "CLAUDE.md")))
      read.push(join(there, "CLAUDE.md"));
  }
  print(ref, rows, d);
  if (read.length) d.out(say.text(`Read first: ${read.join(", ")}`));
  return rows.some((r) => r.mark === "fail") ? 1 : 0;
}

/** Why a clone is kept, or null when nothing in it would be lost. */
export function worth(folder: string): string | null {
  const status = git(folder, "status", "--porcelain");
  if (!status.ok) return `can't be read: ${folder}`;
  if (status.out.trim()) return `uncommitted changes: ${folder}`;
  if (git(folder, "stash", "list").out.trim())
    return `stashed changes: ${folder}`;
  const ahead = git(
    folder,
    "rev-list",
    "--count",
    "--branches",
    "--not",
    "--remotes",
  );
  const count = Number(ahead.out.trim());
  if (!ahead.ok || Number.isNaN(count)) return `can't be read: ${folder}`;
  if (count === 0) return null;
  return count === 1
    ? `1 commit is not pushed: ${folder}`
    : `${count} commits are not pushed: ${folder}`;
}

const foldersIn = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
    : [];

async function remove(key: Key, d: Deps): Promise<number> {
  const home = homeOf(d.tickets, key, d.repository);
  const folder = folderOf(d.work, d.tickets.keyIn(key, ""), home);
  const names = foldersIn(folder);
  if (!names.length) {
    d.out(say.text(`${d.tickets.ref(key)} has no clone here.`));
    return 0;
  }
  let kept = false;
  for (const last of names) {
    const name = `${ownerOf(home)}/${last}`;
    const there = join(folder, last);
    const why = worth(there);
    if (why) {
      kept = true;
      d.out(say.mark("fail", `${name}   ${why}`));
      continue;
    }
    rmSync(there, { recursive: true, force: true });
    d.out(say.mark("ok", `Removed ${name}`));
  }
  if (!kept) rmdirSync(folder);
  return kept ? 1 : 0;
}

/** What a session in the cloud was handed, in place of clones. */
async function handed(key: Key, h: Handoff, d: Deps): Promise<number> {
  const run = h.run();
  const ref = d.tickets.ref(key);
  if (!run.others?.length) {
    d.out(say.text(`${ref} has one repository: nothing to clone.`));
    return 0;
  }
  const work = join(h.dir, "work");
  const own: Row = {
    mark: "ok",
    name: run.repository,
    what: `branch ${run.branch}`,
    where: `${work}, this run's`,
  };
  const rows = run.others.map((o): Row => ({
    mark: "off",
    name: o.repository,
    what: o.pull === null ? "no pull request yet" : `${o.repository}#${o.pull}`,
    where: o.folder
      ? `${join(h.dir, "others", o.folder)}, to read only`
      : "too large to hand over",
  }));
  print(ref, [own, ...rows], d);
  return 0;
}

export async function main(argv: string[], d: Deps): Promise<number> {
  const [typed, flag, ...more] = argv;
  if (
    !typed ||
    typed.startsWith("--") ||
    (flag !== undefined && flag !== "--remove") ||
    more.length
  ) {
    d.err(say.text(USAGE));
    return 2;
  }
  try {
    const key = d.tickets.key(typed);
    if (d.handoff) return await handed(key, d.handoff, d);
    return flag === "--remove" ? await remove(key, d) : await make(key, d);
  } catch (error) {
    d.err(say.text(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

/** The ticket a folder of clones is for, from its name. */
export const ticketOfWord = (word: string, owner: string): string => {
  const own = /^(.+)-(\d+)$/.exec(word);
  return own && !/^[A-Z][A-Z0-9]*-\d+$/.test(word)
    ? `${owner}/${own[1]}#${own[2]}`
    : word;
};

/** Each clone here, by the ticket it is for. */
export function clonesIn(
  work: string,
  owner: string,
): { word: string; name: string; folder: string }[] {
  const at = join(work, ...owner.split("/"));
  return foldersIn(at).flatMap((word) =>
    foldersIn(join(at, word)).map((name) => ({
      word,
      name: `${owner}/${name}`,
      folder: join(at, word, name),
    })),
  );
}

/** `kodor workspace`. */
export async function run(argv: string[]): Promise<number> {
  const { repoRoot } = await import("./config.mts");
  const { openTickets } = await import("./tickets/index.mts");
  const { openCodeHost, reachCodeHost } = await import("./code-host/index.mts");
  const { handoffIn } = await import("./handoff/index.mts");
  const { commonDir } = await import("./lib/clock.mts");
  const { branchName } = await import("./ticket.mts");
  const settings = await loadSettings();
  const { repository } = settings;
  const { tickets } = await openTickets(settings, {
    repository,
    board: settings.tickets.board,
  });
  const host = openCodeHost(repository, settings.codeHost.type);
  return main(argv, {
    tickets,
    repository,
    root: repoRoot(),
    work: workFolder(),
    reach: (name) => reachCodeHost(name, settings.codeHost.type, repository),
    remote: (name) => host.remote(name).url,
    branch: async (key, root) => {
      if (!existsSync(join(root, LOCK_FILE))) return null;
      const own = await loadSettings(defaultDeps(root, {}));
      return branchName(key, own.codeHost.branchName!, () => host.signedInAs());
    },
    gitDir: () => resolve(commonDir()),
    handoff: handoffIn(),
    ...say.printersFor("workspace"),
  });
}
