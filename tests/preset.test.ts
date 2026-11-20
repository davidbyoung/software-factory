// Presets combined with the factory's defaults and the repository's own
// settings, the refusals, explain's marks, and reading the settings from
// the lock.
import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  defaultDeps,
  loadSettings,
  main as config,
  pluginsOf,
  type Deps,
} from "../src/config.mts";
import { settingsHash, staleReason, type StaleDeps } from "../src/preset.mts";
import {
  ACME,
  deps,
  install,
  installAcme,
  NODE,
  own,
  put,
  repo,
  resolveAt,
  yaml,
} from "./preset-fixture.ts";

let root = "";
afterEach(() => rmSync(root, { recursive: true, force: true }));

/** A repository with the docs' two presets, listing `presets`. */
const acme = (presets = [ACME, NODE], body: string[] = []) => {
  root = repo(own(presets, body));
  installAcme(root);
  return root;
};

/** What `factory config explain` prints, read from the files. */
const explain = async () => {
  const r = deps(root);
  const code = await config(["explain"], r.d);
  return { code, out: r.out, err: r.err };
};

const lineOf = (lines: string[], start: string) =>
  lines.find((l) => l.trimStart().startsWith(start))?.trim();

describe("combining presets", () => {
  it("applies the defaults, then each preset in the order listed, then .claude/factory.yaml", async () => {
    acme([ACME, NODE], ["rules:", "  review-rounds: 5"]);
    const { settings } = await resolveAt(root);
    expect(settings.rules.smallChangeLines).toBe(30);
    expect(settings.rules.reviewRounds).toBe(5);
    expect(settings.sessionMinutes.build).toBe(230);
  });

  it("takes the later preset's single value, or the earlier one a choice names", async () => {
    acme();
    expect((await resolveAt(root)).settings.rules.smallChangeLines).toBe(30);
    put(
      root,
      ".claude/factory.choices.yaml",
      `rules.small-change-lines: "${ACME}"\n`,
    );
    expect((await resolveAt(root)).settings.rules.smallChangeLines).toBe(40);
  });

  it("takes .claude/factory.yaml's value over every preset's, whatever is chosen", async () => {
    acme([ACME, NODE], ["rules:", "  small-change-lines: 50"]);
    put(
      root,
      ".claude/factory.choices.yaml",
      `rules.small-change-lines: "${ACME}"\n`,
    );
    expect((await resolveAt(root)).settings.rules.smallChangeLines).toBe(50);
  });

  it("takes one layer's whole list of commands", async () => {
    acme();
    install(root, "@acme/more", "1.0.0", {
      "": {
        settings: "version: 2\ncommands:\n  gate: [npm run lint, npm test]\n",
      },
    });
    put(root, ".claude/factory.yaml", own([NODE, "@acme/more"]));
    expect((await resolveAt(root)).settings.commands.gate).toEqual([
      "npm run lint",
      "npm test",
    ]);
    put(root, ".claude/factory.choices.yaml", `commands.gate: "${NODE}"\n`);
    expect((await resolveAt(root)).settings.commands.gate).toEqual([
      "npm test",
    ]);
  });

  it("adds up every layer's plugins in layer order, a plugin named twice taken whole from one layer", async () => {
    acme(
      [ACME, NODE],
      [
        "plugins:",
        "  build:",
        "    reviewers:",
        "      - agent: acme-security-reviewer",
        "        files: [lib/**]",
        "      - agent: own-reviewer",
        "        files: [docs/**]",
      ],
    );
    put(root, ".claude/agents/own-reviewer.md", "own\n");
    const reviewers = (await resolveAt(root)).settings.plugins.filter(
      (p) => p.role === "reviewer",
    );
    expect(reviewers.map((p) => [p.name, p.files])).toEqual([
      ["acme-security-reviewer", ["lib/**"]],
      ["node-deps-reviewer", ["package.json"]],
      ["own-reviewer", ["docs/**"]],
    ]);
  });

  it("leaves out a plugin .claude/factory.yaml marks off, so factory plugins does not list it", async () => {
    acme(
      [ACME, NODE],
      [
        "plugins:",
        "  build:",
        "    reviewers:",
        "      - agent: acme-security-reviewer",
        "        off: true",
      ],
    );
    const r = deps(root);
    expect(await config(["plugins", "reviewer"], r.d)).toBe(0);
    expect(r.out).toEqual(["agent node-deps-reviewer reviewer package.json"]);
  });

  it("gives a role that off leaves empty no built-in plugin", async () => {
    root = repo(
      own(
        [ACME],
        [
          "plugins:",
          "  test:",
          "    reviewers:",
          "      - agent: acme-tester",
          "        off: true",
        ],
      ),
    );
    install(root, ACME, "1.0.0", {
      "": {
        settings:
          "version: 2\nplugins:\n  test:\n    reviewers:\n      - agent: acme-tester\n",
        agents: { "acme-tester": "t\n" },
      },
    });
    const r = await resolveAt(root);
    expect(
      pluginsOf(r.settings, r.exists).filter((p) => p.role === "test-reviewer"),
    ).toEqual([]);
  });

  it("adds up every layer's list of values, each once, in layer order", async () => {
    acme([ACME, NODE], ["pr-review:", "  commands: [node, npm audit]"]);
    expect((await resolveAt(root)).settings.prReview?.commands).toEqual([
      "npm audit",
      "node",
    ]);
  });

  it("takes a later layer's whole block when it names a different type", async () => {
    root = repo(own([ACME], ["specs: none"]));
    install(root, ACME, "1.0.0", {
      "": {
        settings:
          "version: 2\nspecs:\n  type: openspec\n  check: openspec validate\n",
      },
    });
    const { settings } = await resolveAt(root);
    expect(settings.specs).toBe("none");
    expect(settings.specCheck).toBeNull();
  });

  it("applies the keys two layers set of one block, each chosen as a single value is", async () => {
    root = repo(own([ACME, NODE], ["session-minutes:", "  conflicts: 70"]));
    installAcme(
      root,
      "1.0.0",
      "version: 2\nsession-minutes:\n  build: 100\n  review: 20\n",
      "version: 2\nsession-minutes:\n  review: 30\n",
    );
    expect((await resolveAt(root)).settings.sessionMinutes).toEqual({
      build: 100,
      conflicts: 70,
      review: 30,
      dependencies: 50,
    });
  });
});

describe("the agents and skills presets ship", () => {
  const two = () => {
    root = repo(own([ACME, "@other/preset"]));
    install(root, ACME, "1.0.0", {
      "": { settings: "version: 2\n", agents: { shared: "acme\n" } },
    });
    install(root, "@other/preset", "1.0.0", {
      "": {
        settings: "version: 2\n",
        agents: { shared: "other\n" },
        skills: { tidy: "tidy\n" },
      },
    });
  };

  it("writes the later preset's file of a name two ship, or the one a choice names", async () => {
    two();
    let files = (await resolveAt(root)).resolution.files;
    expect(files.get(".claude/agents/shared.md")?.from).toBe("@other/preset");
    expect(files.get(".claude/skills/tidy/SKILL.md")?.from).toBe(
      "@other/preset",
    );
    put(
      root,
      ".claude/factory.choices.yaml",
      `.claude/agents/shared.md: "${ACME}"\n`,
    );
    files = (await resolveAt(root)).resolution.files;
    expect(files.get(".claude/agents/shared.md")?.from).toBe(ACME);
  });

  it("counts a plugin's file a preset ships as present before any sync", async () => {
    acme();
    const r = deps(root);
    expect(await config(["check"], r.d)).toBe(0);
    expect(r.err.filter((l) => !l.startsWith("warning:"))).toEqual([]);
  });
});

describe("what a preset can't do", () => {
  const refused = async (settings: string, expected: string) => {
    root = repo(own([ACME]));
    install(root, ACME, "1.0.0", { "": { settings } });
    const r = deps(root);
    expect(await config(["check"], r.d)).toBe(1);
    expect(r.err).toEqual([expected]);
  };

  it.each([
    ["repository: a/b", "repository"],
    ["auto-merge:\n  allow: [src/**]", "auto-merge.allow"],
    ["auto-merge:\n  commands: [npm test]", "auto-merge.commands"],
  ])("refuses a preset that sets %s", async (line, key) => {
    await refused(
      `version: 2\n${line}\n`,
      `${ACME}: ${key}: a preset can't set this`,
    );
  });

  it("refuses a preset that names another preset", async () => {
    await refused(
      `version: 2\npresets: ["${NODE}"]\n`,
      `${ACME}: presets: a preset can't name another preset`,
    );
  });

  it("refuses a preset that leaves a plugin out", async () => {
    await refused(
      "version: 2\nplugins:\n  build:\n    reviewers:\n      - agent: x\n        off: true\n",
      `${ACME}: plugins.build.reviewers[0]: off: only .claude/factory.yaml can leave a plugin out`,
    );
  });

  it("refuses a preset with a key the factory doesn't know, as config check words it", async () => {
    await refused(
      "version: 2\nrules:\n  small-change-lnes: 3\n",
      `${ACME}: rules.small-change-lnes: unknown key`,
    );
  });

  it("refuses a preset whose version is not 2", async () => {
    await refused("version: 1\n", `${ACME}: version: must be 2`);
  });

  it("refuses a preset listed twice", async () => {
    root = repo(own([ACME, ACME]));
    install(root, ACME, "1.0.0", { "": { settings: "version: 2\n" } });
    const r = deps(root);
    expect(await config(["check"], r.d)).toBe(1);
    expect(r.err).toEqual([`presets: ${ACME} is listed twice`]);
  });

  it("refuses a listed preset with no factory-preset.yaml in its folder", async () => {
    root = repo(own([`${ACME}/web`]));
    install(root, ACME, "1.0.0", { "": { settings: "version: 2\n" } });
    const r = deps(root);
    expect(await config(["check"], r.d)).toBe(1);
    expect(r.err).toEqual([
      `${ACME}/web: no factory-preset.yaml in node_modules/${ACME}/web`,
    ]);
  });

  it("refuses a listed preset whose package is not installed", async () => {
    root = repo(own([ACME]));
    const r = deps(root);
    expect(await config(["check"], r.d)).toBe(1);
    expect(r.err).toEqual([`${ACME}: not installed. Run: npm ci`]);
  });

  it("refuses off on a plugin no preset names", async () => {
    acme(
      [ACME],
      [
        "plugins:",
        "  build:",
        "    reviewers:",
        "      - agent: nobodys-reviewer",
        "        off: true",
      ],
    );
    const r = deps(root);
    expect(await config(["check"], r.d)).toBe(1);
    expect(r.err).toEqual([
      "plugins.build.reviewers: nobodys-reviewer: off, but no preset names it",
    ]);
  });
});

describe("factory config explain with presets", () => {
  it("marks a value from a preset with its name, and a disagreement with whether it is chosen", async () => {
    acme();
    let { out } = await explain();
    expect(lineOf(out, "review-rounds:")).toMatch(
      /^review-rounds: 3 +# @acme\/factory-preset\/node, not chosen yet$/,
    );
    put(
      root,
      ".claude/factory.choices.yaml",
      `rules.small-change-lines: "${NODE}"\n`,
    );
    ({ out } = await explain());
    expect(lineOf(out, "small-change-lines:")).toMatch(
      /^small-change-lines: 30 +# @acme\/factory-preset\/node, chosen over @acme\/factory-preset$/,
    );
    expect(lineOf(out, "relock:")).toMatch(/^relock: npm install +# default$/);
  });

  it("marks a value of .claude/factory.yaml that replaces a preset's, and leaves its own unmarked", async () => {
    acme([ACME, NODE], ["rules:", "  small-change-lines: 50"]);
    const { out } = await explain();
    expect(lineOf(out, "small-change-lines:")).toMatch(
      /^small-change-lines: 50 +# over @acme\/factory-preset and @acme\/factory-preset\/node$/,
    );
    expect(lineOf(out, "repository:")).toBe("repository: acme/billing");
  });

  it("marks each item of a list that adds up with the layer it came from", async () => {
    acme([ACME, NODE], ["pr-review:", "  commands: [node]"]);
    const { out } = await explain();
    expect(lineOf(out, "- npm audit")).toMatch(
      /^- npm audit +# @acme\/factory-preset\/node$/,
    );
    expect(lineOf(out, "- node")).toBe("- node");
    expect(lineOf(out, "- agent: acme-security-reviewer")).toMatch(
      /# @acme\/factory-preset$/,
    );
  });
});

describe("reading the settings from the lock", () => {
  const settings = "version: 2\nrepository: o/r\n";
  const lock = (over: Record<string, string> = {}) =>
    [
      "version: 1.0.0",
      over.presets ?? "presets: []",
      `settings-hash: ${over.hash ?? settingsHash(settings, null)}`,
      over.settings ??
        "settings:\n  version: 2\n  repository: o/r\n  rules:\n    review-rounds: 7  # @x/y",
      "overridden: {}",
      "files: []",
      "",
    ].join("\n");
  const lockDeps = (text: string | null, over: Partial<Deps> = {}) => {
    root = repo(settings);
    return deps(root, {
      lock: { read: () => text, check: true },
      installed: () => undefined,
      ...over,
    });
  };

  it("reads every setting from the lock's settings, not .claude/factory.yaml", async () => {
    const { d } = lockDeps(lock());
    expect((await loadSettings(d)).rules.reviewRounds).toBe(7);
  });

  it("prints the lock's settings lines for config explain", async () => {
    const r = lockDeps(lock());
    expect(await config(["explain"], r.d)).toBe(0);
    expect(r.out).toEqual([
      "version: 2",
      "repository: o/r",
      "rules:",
      "  review-rounds: 7  # @x/y",
    ]);
  });

  const stops = async (d: Deps, message: string) => {
    await expect(loadSettings(d)).rejects.toThrow(message);
    const err: string[] = [];
    expect(
      await config(["get", "repository"], { ...d, err: (l) => err.push(l) }),
    ).toBe(1);
    expect(err).toEqual([message]);
  };

  it("stops, naming sync, when .claude/factory.yaml changed since the last sync", async () => {
    const { d } = lockDeps(lock({ hash: settingsHash("old", null) }));
    await stops(
      d,
      ".claude/factory.yaml changed since the last sync. Run: npx --no-install factory sync",
    );
  });

  it("names the choices file when it is the one that changed", async () => {
    const { d } = lockDeps(lock(), {
      readChoices: () => 'a: "b"\n',
      changed: () => [".claude/factory.choices.yaml"],
    });
    await stops(
      d,
      ".claude/factory.choices.yaml changed since the last sync. Run: npx --no-install factory sync",
    );
  });

  const withPreset = `presets:\n  - name: "${ACME}"\n    version: 1.4.0`;

  it("stops, naming sync, when a preset's installed version differs from the lock's", async () => {
    const { d } = lockDeps(lock({ presets: withPreset }), {
      installed: () => "1.5.0",
    });
    await stops(
      d,
      `${ACME} is 1.5.0 in node_modules but 1.4.0 in .claude/factory.lock. Run: npx --no-install factory sync`,
    );
  });

  it("names npm ci, not sync, when the installed preset is older than the lock's", async () => {
    const { d } = lockDeps(lock({ presets: withPreset }), {
      installed: () => "1.3.0",
    });
    await stops(
      d,
      `${ACME} is 1.3.0 in node_modules but 1.4.0 in .claude/factory.lock. Run: npm ci`,
    );
  });

  it("stops with one line naming sync when the lock can't be read", async () => {
    const { d } = lockDeps(
      "settings:\n<<<<<<< HEAD\n  a: 1\n=======\n  a: 2\n>>>>>>> b\n",
    );
    await stops(
      d,
      ".claude/factory.lock can't be read. Run: npx --no-install factory sync",
    );
  });

  it("stops, naming npm ci, when a preset the lock lists is not installed", async () => {
    const { d } = lockDeps(lock({ presets: withPreset }), {
      installed: () => null,
    });
    await stops(
      d,
      `${ACME} is in .claude/factory.lock but not installed. Run: npm ci`,
    );
  });

  it("stops on a lock from an earlier release, which has no settings", async () => {
    const { d } = lockDeps("# old\nversion: 0.4.0\nfiles:\n  - a\n");
    await stops(
      d,
      ".claude/factory.lock is from an earlier version of the factory. Run: npx --no-install factory sync",
    );
  });

  it("stops when there is no lock", async () => {
    const { d } = lockDeps(null);
    await stops(
      d,
      ".claude/factory.lock is missing. Run: npx --no-install factory sync",
    );
  });

  it("names the first reason in order: missing, earlier, changed, not installed, another version", () => {
    const two = `presets:\n  - name: "${ACME}"\n    version: 1.4.0\n  - name: "@b/p"\n    version: 1.0.0`;
    const at = (over: Partial<StaleDeps>) =>
      staleReason({
        lock: lock({ presets: two }),
        own: settings,
        choices: null,
        changed: () => [],
        installed: (pkg) => (pkg === ACME ? "9.9.9" : null),
        load: yaml,
        ...over,
      });
    const stale = settingsHash("old", null);
    expect(at({ lock: null })).toContain("is missing");
    expect(
      at({ lock: `version: 0.4.0\nsettings-hash: ${stale}\nfiles: []\n` }),
    ).toContain("earlier version");
    expect(at({ lock: lock({ presets: two, hash: stale }) })).toContain(
      "changed since the last sync",
    );
    expect(at({})).toBe(
      "@b/p is in .claude/factory.lock but not installed. Run: npm ci",
    );
    expect(at({ installed: () => "9.9.9" })).toContain(
      `${ACME} is 9.9.9 in node_modules`,
    );
  });

  it("reads the lock FACTORY_LOCK names without checking it is current", async () => {
    root = repo(settings);
    put(root, "base.lock", lock({ hash: settingsHash("anything else", null) }));
    const d = defaultDeps(root, { FACTORY_LOCK: join(root, "base.lock") });
    expect((await loadSettings(d)).rules.reviewRounds).toBe(7);
  });

  it("reads the file FACTORY_SETTINGS names, its presets from node_modules, with no lock", async () => {
    root = repo(settings);
    installAcme(root);
    put(root, "try.yaml", own([NODE]));
    const d = defaultDeps(root, { FACTORY_SETTINGS: join(root, "try.yaml") });
    expect((await loadSettings(d)).rules.reviewRounds).toBe(3);
  });
});
