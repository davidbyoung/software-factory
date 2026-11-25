// `factory sync` with presets: the lock it writes, the agents and skills
// it copies and restores, the pins it checks, the files it keeps back, and
// the choices it drops.
import { rmSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";
import {
  defaultDeps,
  filesDeps,
  loadSettings,
  main as config,
  pluginsOf,
  resolveFiles,
  targetOf,
  type Settings,
} from "../src/config.mts";
import { fileHash, pinsOf, settingsHash } from "../src/preset.mts";
import { runGit, type Git } from "../src/preset-fetch.mts";
import { lockedFiles, main, PACKAGE } from "../src/sync.mts";
import { POLLER_FILE, pollerWorkflow } from "../src/workflow-files.mts";
import { staleOf } from "../src/config.mts";
import {
  ACME,
  ACME_SETTINGS,
  CACHE,
  deps,
  fetching,
  HOST,
  install,
  installAcme,
  lockPin,
  NODE,
  NODE_SETTINGS,
  own,
  publish,
  put,
  read,
  remoteOf,
  repo,
} from "./preset-fixture.ts";
import { into } from "./printed";

let root = "";
afterEach(() => rmSync(root, { recursive: true, force: true }));

/** One sync, recording each call it makes to git for a preset. `base` is
 * the lock at the commit `--against` names. */
async function sync(argv: string[] = [], base: string | null = null) {
  const out: string[] = [];
  const err: string[] = [];
  const git: string[][] = [];
  const recording: Git = (args, o) => {
    git.push(args);
    return runGit(args, o);
  };
  const code = await main(argv, {
    root,
    pkg: PACKAGE,
    settings: () => resolveFiles({ ...filesDeps(root, {}) }),
    stale: () => staleOf(defaultDeps(root, {})),
    defaultBranch: async () => "main",
    out: into(out),
    err: into(err),
    fetch: (s) => ({ ...fetching(s.repository), git: recording }),
    show: (ref, path) => (ref === "BASE" && path === LOCK ? base : null),
  });
  return { code, out, err, git };
}

const LOCK = ".claude/factory.lock";
const DEPS = ".claude/agents/node-deps-reviewer.md";
const REPO = "acme/factory-config";
let commit = "";
const acme = (body: string[] = []) => {
  root = repo(own([ACME, NODE], body));
  commit = installAcme(root);
};
const short = () => commit.slice(0, 7);

/** This machine without the commit, and the preset's repository gone. */
const unreachable = () => {
  rmSync(join(CACHE, "presets", HOST, REPO), { recursive: true, force: true });
  rmSync(remoteOf(REPO), { recursive: true, force: true });
};

describe("the lock factory sync writes", () => {
  it("holds the version, the presets, the settings' hash, .npmrc's variables, the settings, what they replaced, and the files, in that order", async () => {
    acme();
    expect((await sync()).code).toBe(0);
    const text = read(root, LOCK)!;
    const keys = text
      .split("\n")
      .filter((l) => /^[a-z-]+:/.test(l))
      .map((l) => l.split(":")[0]);
    expect(keys).toEqual([
      "version",
      "presets",
      "settings-hash",
      "npmrc-variables",
      "settings",
      "overridden",
      "files",
    ]);
    const lock = load(text) as Record<string, unknown>;
    expect(lock["settings-hash"]).toBe(
      settingsHash(read(root, ".claude/factory.yaml"), null),
    );
    expect(lock["npmrc-variables"]).toEqual([]);
    expect(
      (lock.overridden as Record<string, unknown>)["rules.small-change-lines"],
    ).toEqual([{ from: ACME, value: 40 }]);
  });

  it("holds for each preset its name, its commit in full, its settings as its file had them without the version, and a hash of each file it ships", async () => {
    acme();
    await sync();
    expect(
      (load(read(root, LOCK)!) as Record<string, unknown>).presets,
    ).toEqual([
      {
        name: ACME,
        commit,
        poller: false,
        settings: (({ version: _, ...rest }) => rest)(
          load(ACME_SETTINGS) as Record<string, unknown>,
        ),
        files: {
          ".claude/agents/acme-security-reviewer.md": fileHash("security\n"),
        },
      },
      {
        name: NODE,
        commit,
        poller: false,
        settings: (({ version: _, ...rest }) => rest)(
          load(NODE_SETTINGS) as Record<string, unknown>,
        ),
        files: { [DEPS]: fileHash("deps\n") },
      },
    ]);
    expect(commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it("writes each pin as the name, the commit, whether its repository holds a poller, the settings, and each file with sha256: and its hash", async () => {
    root = repo(own(["foo/presets//bar"]));
    const at = install(root, "foo/presets", {
      bar: {
        settings: "version: 2\nrules:\n  review-rounds: 3\n",
        agents: { "bar-reviewer": "bar\n" },
      },
    });
    await sync();
    const lines = read(root, LOCK)!.split("\n");
    const start = lines.indexOf("presets:");
    expect(lines.slice(start, start + 9)).toEqual([
      "presets:",
      "  - name: foo/presets//bar",
      `    commit: ${at}`,
      "    poller: false",
      "    settings:",
      "      rules:",
      "        review-rounds: 3",
      "    files:",
      `      .claude/agents/bar-reviewer.md: ${fileHash("bar\n")}`,
    ]);
    expect(fileHash("bar\n")).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("records that a preset's repository holds an organization's poller at the pinned commit, and reads it back with no network", async () => {
    root = repo(own([ACME]));
    install(root, REPO, {
      "": {
        settings: "version: 2\n",
        others: { [POLLER_FILE]: "name: Factory poller\n" },
      },
    });
    unreachable();
    const r = await sync();
    expect(r.code).toBe(0);
    expect(r.git).toEqual([]);
    expect(read(root, LOCK)!.split("\n")).toContain("    poller: true");
    expect(pinsOf(read(root, LOCK), load)[0]!.poller).toBe(true);
  });

  it("hashes a file a preset ships that loses to the repository's own", async () => {
    acme();
    put(root, DEPS, "mine\n");
    await sync();
    expect(pinsOf(read(root, LOCK), load)[1]!.files).toEqual({
      [DEPS]: fileHash("deps\n"),
    });
    expect(lockedFiles(read(root, LOCK), load)).not.toContain(DEPS);
  });

  it("writes an empty list of presets where there are none", async () => {
    root = repo(own([]));
    await sync();
    expect(read(root, LOCK)).toContain("\npresets: []\n");
  });

  it("holds the settings as config explain prints them, and config explain then prints the lock's", async () => {
    acme();
    await sync();
    const fromFiles = deps(root);
    await config(["explain"], fromFiles.d);
    // The two comment lines that open the output say how to read it; the
    // lock holds only the settings.
    const printed = fromFiles.out.slice(2);
    const lines = read(root, LOCK)!.split("\n");
    const start = lines.indexOf("settings:") + 1;
    const settings = lines
      .slice(start, start + printed.length)
      .map((l) => l.slice(2));
    expect(settings).toEqual(printed);
    const fromLock = deps(root, { lock: defaultDeps(root, {}).lock });
    expect(await config(["explain"], fromLock.d)).toBe(0);
    expect(fromLock.out).toEqual(fromFiles.out);
  });

  it("reads back as the same settings as resolving the files", async () => {
    acme();
    await sync();
    const resolved = await resolveFiles(filesDeps(root, {}));
    const locked = await loadSettings(defaultDeps(root, {}));
    const used = (s: Settings) => {
      const { plugins: _p, testReviewersWritten: _t, ...rest } = s;
      return { ...rest, plugins: pluginsOf(s, () => true) };
    };
    expect(used(locked)).toEqual(used(resolved.settings));
  });

  it("lists only files under files, not what a preset's pin holds", async () => {
    acme();
    await sync();
    const files = lockedFiles(read(root, LOCK), load);
    expect(
      files.every((f) => f.startsWith(".claude/") || f.startsWith(".github/")),
    ).toBe(true);
    expect(files.filter((f) => f === DEPS)).toEqual([DEPS]);
  });

  it("reads the pins and the files of a lock with conflict markers, so it still deletes what no preset ships", async () => {
    acme();
    await sync();
    const text = read(root, LOCK)!.replace(
      /^settings-hash: .*$/m,
      "<<<<<<< HEAD\nsettings-hash: sha256:a\n=======\nsettings-hash: sha256:b\n>>>>>>> other",
    );
    put(root, LOCK, text);
    put(root, ".claude/factory.yaml", own([ACME]));
    const r = await sync();
    expect(r.code).toBe(0);
    expect(r.out).toContain(`deleted ${DEPS}`);
    expect(pinsOf(read(root, LOCK), load).map((p) => p.commit)).toEqual([
      commit,
    ]);
  });

  it("fails the check, naming the fix, when the lock is stale", async () => {
    acme();
    await sync();
    put(root, ".claude/factory.yaml", own([ACME]));
    const r = await sync(["--check"]);
    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      ".claude/factory.yaml changed since the last sync. Run: factory sync",
    ]);
  });
});

describe("a name under presets, at factory sync", () => {
  it("stops the sync, with its mark, when it is an npm package's", async () => {
    root = repo(own(['"@acme/factory-preset"']));
    const r = await sync();
    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      '✗ presets: "@acme/factory-preset" is an npm package, and a preset now comes from a repository. Name the repository, such as acme/factory-config.',
    ]);
    expect(read(root, LOCK)).toBeNull();
  });

  it("stops the sync, naming preset add, when the lock has no pin for it", async () => {
    root = repo(own(["foo/presets//bar"]));
    const r = await sync();
    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      "✗ presets: foo/presets//bar is not pinned yet. Run: factory preset add foo/presets//bar",
    ]);
    expect(read(root, LOCK)).toBeNull();
  });

  it("drops a pin whose name left presets, with the files only it shipped", async () => {
    acme();
    await sync();
    put(root, ".claude/factory.yaml", own([ACME]));
    const r = await sync();
    expect(r.out).toContain(`deleted ${DEPS}`);
    expect(read(root, DEPS)).toBeNull();
    expect(pinsOf(read(root, LOCK), load).map((p) => p.name)).toEqual([ACME]);
    expect(read(root, ".claude/agents/acme-security-reviewer.md")).toBe(
      "security\n",
    );
  });
});

describe("the agents and skills factory sync copies from presets", () => {
  it("writes each and lists it in the lock", async () => {
    acme();
    const r = await sync();
    expect(r.out).toContain(`wrote ${DEPS}`);
    expect(read(root, DEPS)).toBe("deps\n");
    expect(read(root, LOCK)).toContain(`  - ${DEPS}`);
  });

  it("reads no preset's repository, nor the cache, while each copy is what the lock records", async () => {
    acme();
    await sync();
    unreachable();
    put(root, ".claude/factory.yaml", own([ACME, NODE], ["specs: none"]));
    const r = await sync();
    expect(r.code).toBe(0);
    expect(r.git).toEqual([]);
    expect(r.out).toEqual([`wrote ${LOCK}`]);
  });

  it("copies an edited or deleted file again from the cache, with no download", async () => {
    acme();
    await sync();
    put(root, DEPS, "edited by hand\n");
    rmSync(join(root, ".claude/agents/acme-security-reviewer.md"));
    const r = await sync();
    expect(r.code).toBe(0);
    expect(r.out).toEqual([
      "wrote .claude/agents/acme-security-reviewer.md",
      `wrote ${DEPS}`,
    ]);
    expect(read(root, DEPS)).toBe("deps\n");
    expect(r.git).toEqual([]);
  });

  it("downloads the pinned commit again when this machine has never fetched it", async () => {
    acme();
    await sync();
    rmSync(join(CACHE, "presets", HOST, REPO), { recursive: true });
    publish(REPO, { "": { settings: "version: 2\n" } });
    put(root, DEPS, "edited by hand\n");
    const r = await sync();
    expect(r.code).toBe(0);
    expect(read(root, DEPS)).toBe("deps\n");
    expect(r.git.map((args) => args[0])).toEqual(["init", "fetch", "checkout"]);
    expect(r.git[1]!.at(-1)).toBe(commit);
  });

  it("stops, naming the file, the preset, and the way back, when the copy cannot be restored", async () => {
    acme();
    await sync();
    unreachable();
    put(root, DEPS, "edited by hand\n");
    put(root, ".claude/factory.yaml", own([ACME, NODE], ["specs: none"]));
    const before = read(root, LOCK);
    const r = await sync();
    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      `✗ ${DEPS} was edited or deleted, and ${NODE} could not be read to restore it. Restore it with: git checkout -- ${DEPS}`,
    ]);
    expect(r.out).toEqual([]);
    expect(read(root, LOCK)).toBe(before);
    expect(read(root, DEPS)).toBe("edited by hand\n");
  });

  it("does not restore a copy from a commit that holds another text than the lock records", async () => {
    acme();
    await sync();
    const pins = pinsOf(read(root, LOCK), load);
    lockPin(root, { ...pins[1]!, files: { [DEPS]: fileHash("other\n") } });
    const r = await sync();
    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      `✗ ${DEPS} was edited or deleted, and ${NODE} could not be read to restore it. Restore it with: git checkout -- ${DEPS}`,
    ]);
  });

  it("keeps a file the repository wrote itself, saying so", async () => {
    acme();
    put(root, DEPS, "mine\n");
    const r = await sync();
    expect(r.out).toContain(
      `kept ${DEPS}, this repository's own, over ${NODE}`,
    );
    expect(read(root, DEPS)).toBe("mine\n");
  });

  it("keeps the factory's own file at a path a preset ships, saying so", async () => {
    root = repo(own([ACME]));
    install(root, ACME, {
      "": {
        settings: "version: 2\n",
        agents: { "factory-test-reviewer": "imposter\n" },
      },
    });
    const r = await sync();
    expect(r.out).toContain(
      `kept .claude/agents/factory-test-reviewer.md, the factory's own, over ${ACME}`,
    );
    expect(read(root, ".claude/agents/factory-test-reviewer.md")).not.toBe(
      "imposter\n",
    );
  });
});

describe("factory sync --check with presets", () => {
  const MATCH = "✓ The factory's files match the settings.";

  it("passes with no repository to read while each copy is what the lock records", async () => {
    acme();
    await sync();
    unreachable();
    const r = await sync(["--check"]);
    expect(r).toEqual({ code: 0, out: [MATCH], err: [], git: [] });
  });

  it.each([
    ["edited", () => put(root, DEPS, "edited by hand\n")],
    ["deleted", () => rmSync(join(root, DEPS))],
  ])(
    "fails on a copy that was %s, downloading nothing to compare it with",
    async (_how, change) => {
      acme();
      await sync();
      rmSync(join(CACHE, "presets", HOST, REPO), { recursive: true });
      change();
      const r = await sync(["--check"]);
      expect(r.code).toBe(1);
      expect(r.err).toEqual([
        "✗ 1 of the factory's files doesn't match the settings:",
        `  ${DEPS}`,
        "Run factory sync and commit what it writes.",
      ]);
      expect(r.git).toEqual([]);
    },
  );

  it("takes --against only with --check and a commit", async () => {
    acme();
    for (const argv of [
      ["--against", "BASE"],
      ["--check", "--against"],
    ]) {
      const r = await sync(argv);
      expect(r.code).toBe(2);
      expect(r.err).toEqual([
        "Usage: factory sync [--check [--against COMMIT [--public]]]",
      ]);
    }
  });
});

describe("factory sync --check --against the base branch's commit", () => {
  const MATCH = "✓ The factory's files match the settings.";
  const AGAINST = ["--check", "--against", "BASE"];
  /** The lock on the base branch, then both pins moved to a newer commit
   * in the working tree, synced. */
  const moved = async () => {
    acme();
    await sync();
    const base = read(root, LOCK)!;
    commit = installAcme(
      root,
      ACME_SETTINGS.replace("small-change-lines: 40", "small-change-lines: 35"),
    );
    await sync();
    return base;
  };

  it("reads no repository when no pin's commit differs from the base lock's", async () => {
    acme();
    await sync();
    unreachable();
    const r = await sync(AGAINST, read(root, LOCK));
    expect(r).toEqual({ code: 0, out: [MATCH], err: [], git: [] });
  });

  it("passes a moved pin that holds what its commit holds, reading that commit alone", async () => {
    const base = await moved();
    rmSync(join(CACHE, "presets", HOST, REPO), { recursive: true });
    const r = await sync(AGAINST, base);
    expect(r).toMatchObject({ code: 0, out: [MATCH], err: [] });
    expect(r.git.filter((args) => args[0] === "fetch")).toHaveLength(1);
    expect(r.git.find((args) => args[0] === "fetch")!.at(-1)).toBe(commit);
  });

  it("reads only the preset whose commit moved", async () => {
    acme();
    await sync();
    const base = read(root, LOCK)!;
    const other = install(root, "foo/presets", {
      bar: { settings: "version: 2\n" },
    });
    put(root, ".claude/factory.yaml", own([ACME, NODE, "foo/presets//bar"]));
    await sync();
    rmSync(join(CACHE, "presets", HOST), { recursive: true });
    rmSync(remoteOf(REPO), { recursive: true });
    const r = await sync(AGAINST, base);
    expect(r).toMatchObject({ code: 0, err: [] });
    expect(
      r.git.filter((args) => args[0] === "fetch").map((args) => args.at(-1)),
    ).toEqual([other]);
  });

  it("takes every pin as new when the base commit has no lock", async () => {
    acme();
    await sync();
    rmSync(join(CACHE, "presets", HOST, REPO), { recursive: true });
    const r = await sync(AGAINST, null);
    expect(r).toMatchObject({ code: 0, err: [] });
    expect(r.git.filter((args) => args[0] === "fetch")).toHaveLength(1);
  });

  it("fails on moved pins it cannot read", async () => {
    const base = await moved();
    unreachable();
    const r = await sync(AGAINST, base);
    expect(r.code).toBe(1);
    expect(r.err).toEqual(
      [ACME, NODE].map((name) =>
        expect.stringContaining(`${name} at ${short()} could not be read`),
      ),
    );
  });

  it("says so and passes with --public, in a run with no sign-in, on moved pins it cannot read", async () => {
    const base = await moved();
    unreachable();
    const r = await sync([...AGAINST, "--public"], base);
    expect(r).toMatchObject({
      code: 0,
      out: [
        ...[ACME, NODE].map(
          (name) =>
            `- ${name} can't be read here without a sign-in: the review's run checks it.`,
        ),
        MATCH,
      ],
      err: [],
    });
  });

  it("fails with --public on a moved pin it can read that is not what its commit holds", async () => {
    const base = await moved();
    put(
      root,
      LOCK,
      read(root, LOCK)!.replace(
        "small-change-lines: 35",
        "small-change-lines: 99",
      ),
    );
    const r = await sync([...AGAINST, "--public"], base);
    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      `✗ .claude/factory.lock: ${ACME} at ${short()} does not match what that commit holds. Run: factory update`,
    ]);
  });

  it("fails with --public when a pin's hashes changed and its commit did not, though it can read no repository", async () => {
    acme();
    await sync();
    const base = read(root, LOCK)!;
    put(root, LOCK, base.replace(fileHash("deps\n"), fileHash("mine\n")));
    unreachable();
    const r = await sync([...AGAINST, "--public"], base);
    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      expect.stringContaining(`recorded for ${NODE} changed`),
    ]);
  });

  it.each([
    [
      "settings",
      (text: string) =>
        text.replace("small-change-lines: 35", "small-change-lines: 99"),
    ],
    [
      "hashes",
      (text: string) =>
        text.replace(fileHash("security\n"), fileHash("mine\n")),
    ],
  ])(
    "fails when a moved pin's %s are not what its commit holds",
    async (_what, change) => {
      const base = await moved();
      put(root, LOCK, change(read(root, LOCK)!));
      const r = await sync(AGAINST, base);
      expect(r.code).toBe(1);
      expect(r.err).toEqual([
        `✗ .claude/factory.lock: ${ACME} at ${short()} does not match what that commit holds. Run: factory update`,
      ]);
      expect(r.out).toEqual([]);
    },
  );

  it.each([
    [
      "settings",
      (text: string) =>
        text.replace(
          "    settings:\n      rules:\n        small-change-lines: 30",
          "    settings:\n      rules:\n        small-change-lines: 31",
        ),
    ],
    [
      "hashes",
      (text: string) => text.replace(fileHash("deps\n"), fileHash("mine\n")),
    ],
  ])(
    "fails when a pin's %s changed and its commit did not, reading no repository",
    async (_what, change) => {
      acme();
      await sync();
      const base = read(root, LOCK)!;
      const changed = change(base);
      expect(changed).not.toBe(base);
      put(root, LOCK, changed);
      const r = await sync(AGAINST, base);
      expect(r.code).toBe(1);
      expect(r.err).toEqual([
        `✗ .claude/factory.lock: the settings or files recorded for ${NODE} changed, and its commit did not. Restore the lock from the default branch, then run: factory sync`,
      ]);
      expect(r.git).toEqual([]);
    },
  );
});

describe("the choices factory sync drops", () => {
  it("drops a choice whose preset is no longer listed, deleting the emptied file", async () => {
    acme();
    put(root, ".claude/factory.yaml", own([NODE]));
    put(
      root,
      ".claude/factory.choices.yaml",
      `rules.small-change-lines: ${ACME}\n`,
    );
    const r = await sync();
    expect(r.out).toContain(
      `dropped the choice for rules.small-change-lines: ${ACME} is no longer in presets`,
    );
    expect(read(root, ".claude/factory.choices.yaml")).toBeNull();
  });

  it("drops a choice whose preset no longer sets its key", async () => {
    acme();
    put(
      root,
      ".claude/factory.choices.yaml",
      `rules.small-change-lines: ${NODE}\ncommands.gate: ${ACME}\n`,
    );
    const r = await sync();
    expect(r.out).toContain(
      `dropped the choice for commands.gate: ${ACME} no longer sets it`,
    );
    expect(read(root, ".claude/factory.choices.yaml")).toContain(
      `rules.small-change-lines: ${NODE}`,
    );
  });
});

describe("a repository whose preset's repository runs the organization's poller", () => {
  const EVERY_30 =
    "version: 2\nbuilds:\n  trigger: github-action\n  poll-minutes: 30\n";
  const FILE = pollerWorkflow({
    owner: "acme",
    version: "0.4.0",
    pollMinutes: 30,
  });
  /** A repository that follows acme's preset, with or without the
   * poller's file beside it, synced. */
  const following = async (
    poller: boolean,
    body: string[] = [],
    settings = EVERY_30,
  ) => {
    root = repo(own([ACME], body));
    install(root, REPO, {
      "": {
        settings,
        ...(poller ? { others: { [POLLER_FILE]: FILE } } : {}),
      },
    });
    expect((await sync()).code).toBe(0);
    const file = load(read(root, ".github/workflows/factory.yml")!) as {
      on: { schedule: { cron: string }[] };
      jobs: { factory: { with: { parts: string } } };
    };
    return {
      crons: file.on.schedule.map((s) => s.cron),
      parts: file.jobs.factory.with.parts.split(" "),
      settings: await loadSettings(defaultDeps(root, {})),
    };
  };

  it("gets no poller schedule of its own, and no poller among its parts", async () => {
    const { crons, parts } = await following(true);
    expect(crons).not.toContain("*/30 * * * *");
    expect(crons).toHaveLength(3);
    expect(parts).not.toContain("poller");
  });

  it("keeps its own schedule and part when that repository holds no poller", async () => {
    const { crons, parts, settings } = await following(false);
    expect(crons).toHaveLength(4);
    expect(crons).toContain("*/30 * * * *");
    expect(parts).toContain("poller");
    expect(settings.builds.pollerIn).toBeUndefined();
  });

  it("reads that repository from the lock, and flags an unstarted ticket by asking after its poller", async () => {
    const { settings } = await following(true);
    expect(settings.builds.pollerIn).toBe(REPO);
    expect(
      targetOf(settings, { GITHUB_REPOSITORY: "acme/elsewhere" }).repository,
    ).toBe(settings.repository);
    expect(targetOf(settings, {}).watch).toEqual({
      minutes: 45,
      flag: "not started, is the poller in acme/factory-config running?",
    });
    expect(
      (await resolveFiles(filesDeps(root, {}))).settings.builds.pollerIn,
    ).toBe(REPO);
  });

  it("names no such repository once the settings here start builds another way", async () => {
    const { crons, settings } = await following(
      true,
      ["builds:", "  trigger: own-server"],
      "version: 2\nbuilds:\n  trigger: github-action\n",
    );
    expect(crons).toHaveLength(3);
    expect(settings.builds.pollerIn).toBeUndefined();
    expect(targetOf(settings, {}).watch?.flag).toBe(
      "not started, is the poller running?",
    );
  });
});
