// A repository that follows presets, and the presets' own repositories as
// local git repositories the real git reads, for the tests of combining,
// the lock, fetching, and the preset commands.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { devNull, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { dump, load } from "js-yaml";
import { afterAll } from "vitest";
import { filesDeps, resolveFiles, type Deps } from "../src/config.mts";
import {
  LOCK_FILE,
  parseName,
  pinsOf,
  withPins,
  yamlDump,
  type Pinned,
} from "../src/preset.mts";
import { pinAt, runGit, type FetchDeps } from "../src/preset-fetch.mts";
import { CODE_HOST_YAML } from "./settings-fixture";
import { into } from "./printed";

export type PresetFiles = {
  settings: string;
  agents?: Record<string, string>;
  skills?: Record<string, string>;
  /** Any other file beside the preset, by its path from the folder. */
  others?: Record<string, string>;
};

export const put = (root: string, path: string, text: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

export const read = (root: string, path: string) =>
  existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : null;

/** Where this test file's preset repositories and its cache are. */
const WORLD = mkdtempSync(join(tmpdir(), "factory-presets-"));
afterAll(() => rmSync(WORLD, { recursive: true, force: true }));
const REMOTES = join(WORLD, "remotes");
export const CACHE = join(WORLD, "cache");
export const HOST = "code.test";

/** Git with none of this machine's settings, so no test signs a commit or
 * meets a credential helper. */
export const GIT_ENV = {
  PATH: process.env.PATH,
  HOME: WORLD,
  GIT_CONFIG_GLOBAL: devNull,
  GIT_CONFIG_NOSYSTEM: "1",
};

/** The folder a preset's repository is in, which stands in for its
 * address on the code host. */
export const remoteOf = (repo: string) => join(REMOTES, repo);

export const COMMITTED = "2026-11-20T12:00:00Z";

/** Commits `presets` to the repository `repo`, in place of what it held:
 * each folder's preset, "" for the repository's own. Gives the commit. */
export function publish(
  repo: string,
  presets: Record<string, PresetFiles>,
  date = COMMITTED,
): string {
  const dir = remoteOf(repo);
  const git = (...args: string[]) => {
    const r = spawnSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...GIT_ENV,
        GIT_AUTHOR_NAME: "Priya",
        GIT_AUTHOR_EMAIL: "priya@acme.test",
        GIT_AUTHOR_DATE: date,
        GIT_COMMITTER_NAME: "Priya",
        GIT_COMMITTER_EMAIL: "priya@acme.test",
        GIT_COMMITTER_DATE: date,
      },
    });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
    return r.stdout.trim();
  };
  if (existsSync(dir)) git("rm", "-r", "--quiet", "--ignore-unmatch", ".");
  else {
    mkdirSync(dir, { recursive: true });
    git("init", "--quiet", "--initial-branch", "main");
  }
  for (const [folder, p] of Object.entries(presets)) {
    const at = folder ? `${folder}/` : "";
    put(dir, `${at}factory-preset.yaml`, p.settings);
    for (const [name, text] of Object.entries(p.agents ?? {}))
      put(dir, `${at}agents/${name}.md`, text);
    for (const [name, text] of Object.entries(p.skills ?? {}))
      put(dir, `${at}skills/${name}/SKILL.md`, text);
    for (const [path, text] of Object.entries(p.others ?? {}))
      put(dir, `${at}${path}`, text);
  }
  git("add", "--all");
  git("commit", "--quiet", "--allow-empty", "--message", "Change the presets");
  return git("rev-parse", "HEAD");
}

/** What reads the fixture's repositories for `repository`, which follows
 * them. */
export const fetching = (
  repository = "acme/billing",
  env: Record<string, string | undefined> = GIT_ENV,
): FetchDeps => ({
  git: runGit,
  cache: CACHE,
  remote: (repo) => ({ url: remoteOf(repo), host: HOST }),
  repository,
  env,
});

/** The lock at `root` with this pin in it, whatever it records. */
export function lockPin(root: string, pinned: Pinned): Pinned {
  const text = read(root, LOCK_FILE);
  put(
    root,
    LOCK_FILE,
    withPins(
      text,
      [...pinsOf(text, load).filter((p) => p.name !== pinned.name), pinned],
      yamlDump(dump),
    ),
  );
  return pinned;
}

/** The lock at `root` with the preset NAME pinned at `commit`, as
 * `factory preset add` leaves it before it syncs. */
export const pin = (root: string, name: string, commit: string) =>
  lockPin(root, pinAt(fetching(), name, commit, load));

/** The presets committed to `repo`, each pinned in the lock at `root`.
 * Gives the commit. */
export function install(
  root: string,
  repo: string,
  presets: Record<string, PresetFiles>,
  date = COMMITTED,
): string {
  const commit = publish(repo, presets, date);
  for (const folder of Object.keys(presets))
    pin(root, folder ? `${repo}//${folder}` : repo, commit);
  return commit;
}

export const ACME = "acme/factory-config";
export const NODE = "acme/factory-config//node";

export const ACME_SETTINGS = [
  "version: 2",
  "rules:",
  "  small-change-lines: 40",
  "  review-rounds: 2",
  "plugins:",
  "  build:",
  "    reviewers:",
  "      - agent: acme-security-reviewer",
  "        files: [src/**]",
  "",
].join("\n");

export const NODE_SETTINGS = [
  "version: 2",
  "rules:",
  "  small-change-lines: 30",
  "  review-rounds: 3",
  "commands:",
  "  gate: [npm test]",
  "plugins:",
  "  build:",
  "    reviewers:",
  "      - agent: node-deps-reviewer",
  "        files: [package.json]",
  "pr-review:",
  "  commands: [npm audit]",
  "",
].join("\n");

/** The two presets of the docs' example, committed and pinned. */
export const installAcme = (
  root: string,
  acme = ACME_SETTINGS,
  node = NODE_SETTINGS,
) =>
  install(root, parseName(ACME).repo, {
    "": {
      settings: acme,
      agents: { "acme-security-reviewer": "security\n" },
    },
    node: {
      settings: node,
      agents: { "node-deps-reviewer": "deps\n" },
    },
  });

/** `.claude/factory.yaml` naming `presets`, with the rest of `body`. */
export const own = (presets: string[], body: string[] = []) =>
  [
    "version: 2",
    "repository: acme/billing",
    CODE_HOST_YAML,
    ...(presets.length ? ["presets:", ...presets.map((p) => `  - ${p}`)] : []),
    ...body,
    "",
  ].join("\n");

/** An empty repository: a `.git` folder and `.claude/factory.yaml`. No
 * preset's repository an earlier test committed to is left. */
export function repo(settings: string): string {
  rmSync(REMOTES, { recursive: true, force: true });
  const root = mkdtempSync(join(tmpdir(), "factory-preset-"));
  mkdirSync(join(root, ".git"));
  put(root, ".claude/factory.yaml", settings);
  return root;
}

/** Deps that read the files of the repository at `root`, with no lock but
 * for its pins, capturing what is printed. */
export function deps(root: string, over: Partial<Deps> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const d: Deps = {
    ...filesDeps(root, {}),
    listFiles: () => [],
    out: into(out),
    err: into(err),
    ...over,
  };
  return { d, out, err };
}

export const resolveAt = (root: string, over: Partial<Deps> = {}) =>
  resolveFiles(deps(root, over).d);

export const yaml = (text: string) => load(text);
