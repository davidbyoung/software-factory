// `factory sync` with presets: the lock it writes, the agents and skills
// it copies, the files it keeps back, and the choices it drops.
import { rmSync } from "node:fs";
import { load } from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";
import {
  defaultDeps,
  filesDeps,
  loadSettings,
  main as config,
  pluginsOf,
  resolveFiles,
  type Settings,
} from "../src/config.mts";
import { settingsHash } from "../src/preset.mts";
import { lockedFiles, main, PACKAGE } from "../src/sync.mts";
import { staleOf } from "../src/config.mts";
import {
  ACME,
  deps,
  install,
  installAcme,
  NODE,
  own,
  put,
  read,
  repo,
} from "./preset-fixture.ts";

let root = "";
afterEach(() => rmSync(root, { recursive: true, force: true }));

async function sync(argv: string[] = []) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, {
    root,
    pkg: PACKAGE,
    settings: () => resolveFiles({ ...filesDeps(root, {}) }),
    stale: () => staleOf(defaultDeps(root, {})),
    defaultBranch: async () => "main",
    out: (l) => out.push(l),
    err: (l) => err.push(l),
  });
  return { code, out, err };
}

const LOCK = ".claude/factory.lock";
const acme = (body: string[] = []) => {
  root = repo(own([ACME, NODE], body));
  installAcme(root);
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
    expect(lock.presets).toEqual([
      { name: ACME, version: "1.4.0" },
      { name: NODE, version: "1.4.0" },
    ]);
    expect(lock["settings-hash"]).toBe(
      settingsHash(read(root, ".claude/factory.yaml"), null),
    );
    expect(lock["npmrc-variables"]).toEqual([]);
    expect(
      (lock.overridden as Record<string, unknown>)["rules.small-change-lines"],
    ).toEqual([{ from: ACME, value: 40 }]);
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

  it("lists only files under files, not the presets' names", async () => {
    acme();
    await sync();
    const files = lockedFiles(read(root, LOCK), load);
    expect(files).not.toContain(`name: "${ACME}"`);
    expect(
      files.every((f) => f.startsWith(".claude/") || f.startsWith(".github/")),
    ).toBe(true);
  });

  it("reads the files of a lock with conflict markers, so it still deletes what no preset ships", async () => {
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
    expect(r.out).toContain("deleted .claude/agents/node-deps-reviewer.md");
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

describe("the agents and skills factory sync copies from presets", () => {
  it("writes each, lists it in the lock, and deletes it once no preset ships it", async () => {
    acme();
    const r = await sync();
    expect(r.out).toContain("wrote .claude/agents/node-deps-reviewer.md");
    expect(read(root, ".claude/agents/node-deps-reviewer.md")).toBe("deps\n");
    expect(read(root, LOCK)).toContain(
      "  - .claude/agents/node-deps-reviewer.md",
    );
    put(root, ".claude/factory.yaml", own([ACME]));
    const again = await sync();
    expect(again.out).toContain("deleted .claude/agents/node-deps-reviewer.md");
    expect(read(root, ".claude/agents/node-deps-reviewer.md")).toBeNull();
  });

  it("keeps a file the repository wrote itself, saying so", async () => {
    acme();
    put(root, ".claude/agents/node-deps-reviewer.md", "mine\n");
    const r = await sync();
    expect(r.out).toContain(
      `kept .claude/agents/node-deps-reviewer.md, this repository's own, over ${NODE}`,
    );
    expect(read(root, ".claude/agents/node-deps-reviewer.md")).toBe("mine\n");
  });

  it("keeps the factory's own file at a path a preset ships, saying so", async () => {
    root = repo(own([ACME]));
    install(root, ACME, "1.0.0", {
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

describe("the choices factory sync drops", () => {
  it("drops a choice whose preset is no longer listed, deleting the emptied file", async () => {
    acme();
    put(root, ".claude/factory.yaml", own([NODE]));
    put(
      root,
      ".claude/factory.choices.yaml",
      `rules.small-change-lines: "${ACME}"\n`,
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
      `rules.small-change-lines: "${NODE}"\ncommands.gate: "${ACME}"\n`,
    );
    const r = await sync();
    expect(r.out).toContain(
      `dropped the choice for commands.gate: ${ACME} no longer sets it`,
    );
    expect(read(root, ".claude/factory.choices.yaml")).toContain(
      `rules.small-change-lines: "${NODE}"`,
    );
  });
});

describe("the dependency auto-merge workflow factory sync writes", () => {
  it("holds back an update of each preset's package, as it does the factory's", async () => {
    acme();
    put(root, ".github/dependabot.yml", "version: 2\nupdates: []\n");
    await sync();
    const workflow = load(
      read(root, ".github/workflows/factory-deps-auto-merge.yml")!,
    ) as { jobs: { enable: { steps: { name: string; if?: string }[] } } };
    const step = workflow.jobs.enable.steps.find(
      (s) => s.name === "Enable auto-merge",
    )!;
    const held = [
      ...step.if!.matchAll(
        /!contains\(steps\.meta\.outputs\.dependency-names, '([^']+)'\)/g,
      ),
    ].map((m) => m[1]);
    expect(held).toEqual(["davidbyoung/software-factory", ACME]);
  });
});
