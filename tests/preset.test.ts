// Presets combined with the factory's defaults and the repository's own
// settings, the refusals, explain's marks, and reading the settings from
// the lock.
import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { painter } from "../src/lib/color.mts";
import {
  defaultDeps,
  loadSettings,
  main as config,
  pluginsOf,
  type Deps,
} from "../src/config.mts";
import {
  parseName,
  PresetNameError,
  settingsHash,
  staleReason,
  type StaleDeps,
} from "../src/preset.mts";
import {
  ACME,
  deps,
  install,
  installAcme,
  lockPin,
  NODE,
  own,
  put,
  repo,
  resolveAt,
  yaml,
} from "./preset-fixture.ts";
import { CODE_HOST_YAML } from "./settings-fixture";
import { presetBranchNameAt, presetSpecsAt } from "../src/init.mts";

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
    install(root, "acme/more", {
      "": {
        settings: "version: 2\ncommands:\n  gate: [npm run lint, npm test]\n",
      },
    });
    put(root, ".claude/factory.yaml", own([NODE, "acme/more"]));
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
    install(root, ACME, {
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
    install(root, ACME, {
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
    root = repo(own([ACME, "other/preset"]));
    install(root, ACME, {
      "": { settings: "version: 2\n", agents: { shared: "acme\n" } },
    });
    install(root, "other/preset", {
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
    expect(files.get(".claude/agents/shared.md")?.from).toBe("other/preset");
    expect(files.get(".claude/skills/tidy/SKILL.md")?.from).toBe(
      "other/preset",
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

describe("a name under presets", () => {
  it.each([
    ["acme/factory-config", "acme/factory-config", ""],
    ["acme/factory-config//node", "acme/factory-config", "node"],
    ["acme/factory-config//stacks/node", "acme/factory-config", "stacks/node"],
    ["acme/platform/factory-config//go", "acme/platform/factory-config", "go"],
  ])("%s is the repository %s and the folder %j", (name, repo, folder) => {
    expect(parseName(name)).toEqual({ repo, folder });
  });

  it("is told it is an npm package when it starts with @", () => {
    expect(() => parseName("@acme/factory-preset")).toThrow(
      new PresetNameError(
        'presets: "@acme/factory-preset" is an npm package, and a preset now comes from a repository. Name the repository, such as acme/factory-config.',
      ),
    );
  });

  it.each([
    "factory-config",
    "acme/",
    "/factory-config",
    "acme/factory-config//",
    "acme/factory-config/node//",
    "acme/../factory-config",
    "acme/factory-config//../node",
    "acme/factory config",
    "https://github.com/acme/factory-config",
  ])("is refused as %j, which names no repository", (name) => {
    expect(() => parseName(name)).toThrow(
      new PresetNameError(
        `presets: ${JSON.stringify(name)} is not a preset's name. Write its repository, as OWNER/NAME or OWNER/NAME//FOLDER`,
      ),
    );
  });

  it.each([
    [
      '"@acme/factory-preset"',
      'presets: "@acme/factory-preset" is an npm package, and a preset now comes from a repository. Name the repository, such as acme/factory-config.',
    ],
    [
      "factory-config",
      'presets: "factory-config" is not a preset\'s name. Write its repository, as OWNER/NAME or OWNER/NAME//FOLDER',
    ],
  ])("stops config check when it is %s", async (name, message) => {
    root = repo(own([name]));
    const r = deps(root);
    expect(await config(["check"], r.d)).toBe(1);
    expect(r.err).toEqual([message]);
  });

  it("stops config check, naming preset add, when the lock does not pin it", async () => {
    root = repo(own([ACME, NODE]));
    install(root, ACME, { "": { settings: "version: 2\n" } });
    const r = deps(root);
    expect(await config(["check"], r.d)).toBe(1);
    expect(r.err).toEqual([
      `presets: ${NODE} is not pinned yet. Run: factory preset add ${NODE}`,
    ]);
  });
});

describe("what a preset can't do", () => {
  /** A lock that pins the preset with these settings, as no command
   * writes it: `preset add` refuses the same file before it pins it. */
  const refused = async (
    settings: Record<string, unknown>,
    expected: string,
    files: Record<string, string> = {},
  ) => {
    root = repo(own([ACME]));
    lockPin(root, { name: ACME, commit: "1".repeat(40), settings, files });
    const r = deps(root);
    expect(await config(["check"], r.d)).toBe(1);
    expect(r.err).toEqual([expected]);
  };

  it.each([
    [{ repository: "a/b" }, "repository"],
    [{ "auto-merge": { allow: ["src/**"] } }, "auto-merge.allow"],
    [{ "auto-merge": { commands: ["npm test"] } }, "auto-merge.commands"],
  ])("refuses a preset that sets %o", async (settings, key) => {
    await refused(settings, `${ACME}: ${key}: a preset can't set this`);
  });

  it("refuses a preset that names another preset", async () => {
    await refused(
      { presets: [NODE] },
      `${ACME}: presets: a preset can't name another preset`,
    );
  });

  it("refuses a preset that leaves a plugin out", async () => {
    await refused(
      { plugins: { build: { reviewers: [{ agent: "x", off: true }] } } },
      `${ACME}: plugins.build.reviewers[0]: off: only .claude/factory.yaml can leave a plugin out`,
    );
  });

  it("refuses a preset with a key the factory doesn't know, as config check words it", async () => {
    await refused(
      { rules: { "small-change-lnes": 3 } },
      `${ACME}: rules.small-change-lnes: unknown key`,
    );
  });

  it.each([
    ".github/workflows/own.yml",
    ".claude/settings.json",
    ".claude/skills/../../.github/workflows/own.yml",
    ".claude/agents/nested/x.md",
  ])(
    "refuses a lock that has it ship %s, which is no agent's or skill's path",
    async (path) => {
      await refused(
        {},
        `.claude/factory.lock: ${ACME}: ${path} is not an agent's or a skill's path`,
        { [path]: "sha256:0" },
      );
    },
  );

  it("takes a preset that names a ticket field for a heading of the repository's own", async () => {
    root = repo(own([ACME]));
    install(root, ACME, {
      "": {
        settings:
          "version: 2\ntickets:\n  fields:\n    proposed-docs: Docs draft\n",
      },
    });
    const r = deps(root);
    expect(await config(["check"], r.d)).toBe(0);
    expect(r.err).toEqual([]);
  });

  it("refuses a preset listed twice", async () => {
    root = repo(own([ACME, ACME]));
    install(root, ACME, { "": { settings: "version: 2\n" } });
    const r = deps(root);
    expect(await config(["check"], r.d)).toBe(1);
    expect(r.err).toEqual([`presets: ${ACME} is listed twice`]);
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

describe("a spec tool a preset names", () => {
  const installPreset = (specs: string) => {
    root = repo(
      [
        "version: 2",
        "repository: acme/billing",
        "presets:",
        `  - "${ACME}"`,
        "",
      ].join("\n"),
    );
    installAcme(root, `version: 2\n${specs}`);
  };
  const text = `version: 2\nrepository: acme/billing\npresets:\n  - "${ACME}"\n`;

  it("is what init finds, none included, so it asks nothing", async () => {
    installPreset("specs: none\n");
    expect(await presetSpecsAt(root)(text)).toBe("none");
  });

  it("is the tool a preset names", async () => {
    installPreset("specs: openspec\n");
    expect(await presetSpecsAt(root)(text)).toBe("openspec");
  });

  it("is null when the presets listed name no spec tool", async () => {
    installPreset("commands:\n  gate: [npm test]\n");
    expect(await presetSpecsAt(root)(text)).toBeNull();
  });
});

describe("a branch name a preset supplies", () => {
  const preset = [
    "version: 2",
    "code-host:",
    "  type: github",
    '  branch-name: "feature/{user}/{ticket}"',
    "",
  ].join("\n");
  const withoutOwn = () => {
    root = repo(
      [
        "version: 2",
        "repository: acme/billing",
        "presets:",
        `  - "${ACME}"`,
        "",
      ].join("\n"),
    );
    installAcme(root, preset);
  };

  it("is the pattern of a repository whose own file has none", async () => {
    withoutOwn();
    const { settings } = await resolveAt(root);
    expect(settings.codeHost.branchName).toBe("feature/{user}/{ticket}");
  });

  it("is what init finds, so it asks nothing", async () => {
    withoutOwn();
    const text =
      "version: 2\nrepository: acme/billing\npresets:\n" + `  - "${ACME}"\n`;
    expect(await presetBranchNameAt(root)(text)).toBe(
      "feature/{user}/{ticket}",
    );
  });

  it("is none to init when the presets listed set none", async () => {
    acme([ACME]);
    const text = `version: 2\nrepository: acme/billing\npresets:\n  - "${ACME}"\n`;
    expect(await presetBranchNameAt(root)(text)).toBeNull();
  });

  it("is none to init when a preset listed can't be read", async () => {
    withoutOwn();
    expect(
      await presetBranchNameAt(root)(
        "version: 2\nrepository: acme/billing\npresets:\n  - acme/missing\n",
      ),
    ).toBeNull();
  });

  it("is printed by config explain, marked with the preset's name", async () => {
    withoutOwn();
    const { out } = await explain();
    expect(lineOf(out, "branch-name:")).toMatch(
      /^branch-name: "feature\/\{user\}\/\{ticket\}" +# acme\/factory-config$/,
    );
  });
});

describe("factory config explain with presets", () => {
  it("marks a value from a preset with its name, and a disagreement with whether it is chosen", async () => {
    acme();
    let { out } = await explain();
    expect(lineOf(out, "review-rounds:")).toMatch(
      /^review-rounds: 3 +# acme\/factory-config\/\/node, not chosen yet$/,
    );
    put(
      root,
      ".claude/factory.choices.yaml",
      `rules.small-change-lines: "${NODE}"\n`,
    );
    ({ out } = await explain());
    expect(lineOf(out, "small-change-lines:")).toMatch(
      /^small-change-lines: 30 +# acme\/factory-config\/\/node, chosen over acme\/factory-config$/,
    );
    expect(lineOf(out, "relock:")).toMatch(/^relock: npm install +# default$/);
  });

  it("marks a value of .claude/factory.yaml that replaces a preset's, and leaves its own unmarked", async () => {
    acme([ACME, NODE], ["rules:", "  small-change-lines: 50"]);
    const { out } = await explain();
    expect(lineOf(out, "small-change-lines:")).toMatch(
      /^small-change-lines: 50 +# over acme\/factory-config and acme\/factory-config\/\/node$/,
    );
    expect(lineOf(out, "repository:")).toBe("repository: acme/billing");
  });

  it("marks each item of a list that adds up with the layer it came from", async () => {
    acme([ACME, NODE], ["pr-review:", "  commands: [node]"]);
    const { out } = await explain();
    expect(lineOf(out, "- npm audit")).toMatch(
      /^- npm audit +# acme\/factory-config\/\/node$/,
    );
    expect(lineOf(out, "- node")).toBe("- node");
    expect(lineOf(out, "- agent: acme-security-reviewer")).toMatch(
      /# acme\/factory-config$/,
    );
  });
});

describe("reading the settings from the lock", () => {
  const settings = `version: 2\nrepository: o/r\n${CODE_HOST_YAML}\n`;
  const lock = (over: Record<string, string> = {}) =>
    [
      "version: 1.0.0",
      over.presets ?? "presets: []",
      `settings-hash: ${over.hash ?? settingsHash(settings, null)}`,
      over.settings ??
        'settings:\n  version: 2\n  repository: o/r\n  code-host:\n    type: github\n    branch-name: "{ticket}"\n  rules:\n    review-rounds: 7  # @x/y',
      "overridden: {}",
      "files: []",
      "",
    ].join("\n");
  const lockDeps = (text: string | null, over: Partial<Deps> = {}) => {
    root = repo(settings);
    return deps(root, {
      lock: { read: () => text, check: true },
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
      '# The settings in effect. "# default" marks the factory\'s own value,',
      "# a preset's name marks that preset's, and an unmarked line is yours.",
      "version: 2",
      "repository: o/r",
      ...CODE_HOST_YAML.split("\n"),
      "rules:",
      "  review-rounds: 7  # @x/y",
    ]);
  });

  it("colors the lock's settings lines as it colors resolved ones", async () => {
    const paint = painter(true);
    const r = lockDeps(lock(), { paint });
    expect(await config(["explain"], r.d)).toBe(0);
    expect(r.out.at(-1)).toBe(`  review-rounds: 7  ${paint("dim", "# @x/y")}`);
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
      ".claude/factory.yaml changed since the last sync. Run: factory sync",
    );
  });

  it("names the choices file when it is the one that changed", async () => {
    const { d } = lockDeps(lock(), {
      readChoices: () => 'a: "b"\n',
      changed: () => [".claude/factory.choices.yaml"],
    });
    await stops(
      d,
      ".claude/factory.choices.yaml changed since the last sync. Run: factory sync",
    );
  });

  it("stops with one line naming sync when the lock can't be read", async () => {
    const { d } = lockDeps(
      "settings:\n<<<<<<< HEAD\n  a: 1\n=======\n  a: 2\n>>>>>>> b\n",
    );
    await stops(d, ".claude/factory.lock can't be read. Run: factory sync");
  });

  it("stops on a lock from an earlier release, which has no settings", async () => {
    const { d } = lockDeps("# old\nversion: 0.4.0\nfiles:\n  - a\n");
    await stops(
      d,
      ".claude/factory.lock is from an earlier version of the factory. Run: factory sync",
    );
  });

  it("stops when there is no lock", async () => {
    const { d } = lockDeps(null);
    await stops(d, ".claude/factory.lock is missing. Run: factory sync");
  });

  it("names the first reason in order: missing, earlier, changed", () => {
    const at = (over: Partial<StaleDeps>) =>
      staleReason({
        lock: lock(),
        own: settings,
        choices: null,
        changed: () => [],
        load: yaml,
        ...over,
      });
    const stale = settingsHash("old", null);
    expect(at({ lock: null })).toContain("is missing");
    expect(
      at({ lock: `version: 0.4.0\nsettings-hash: ${stale}\nfiles: []\n` }),
    ).toContain("earlier version");
    expect(at({ lock: lock({ hash: stale }) })).toContain(
      "changed since the last sync",
    );
    expect(at({})).toBeNull();
  });

  it("is current whatever commit a preset is pinned at, with nothing of it on this machine", () => {
    expect(
      staleReason({
        lock: lock({
          presets: `presets:\n  - name: ${ACME}\n    commit: ${"1".repeat(40)}\n    settings: {}\n    files: {}`,
        }),
        own: settings,
        choices: null,
        changed: () => [],
        load: yaml,
      }),
    ).toBeNull();
  });

  it("reads the lock FACTORY_LOCK names without checking it is current", async () => {
    root = repo(settings);
    put(root, "base.lock", lock({ hash: settingsHash("anything else", null) }));
    const d = defaultDeps(root, { FACTORY_LOCK: join(root, "base.lock") });
    expect((await loadSettings(d)).rules.reviewRounds).toBe(7);
  });

  it("reads the file FACTORY_SETTINGS names, with no lock", async () => {
    root = repo(settings);
    put(root, "try.yaml", own([], ["rules:", "  review-rounds: 6"]));
    const d = defaultDeps(root, { FACTORY_SETTINGS: join(root, "try.yaml") });
    expect((await loadSettings(d)).rules.reviewRounds).toBe(6);
  });

  it("stops on a file FACTORY_SETTINGS names that lists presets, even ones the lock pins", async () => {
    root = repo(settings);
    installAcme(root);
    put(root, "try.yaml", own([NODE]));
    const d = defaultDeps(root, { FACTORY_SETTINGS: join(root, "try.yaml") });
    await expect(loadSettings(d)).rejects.toThrow(
      "FACTORY_SETTINGS: presets are read through the lock. Use FACTORY_LOCK",
    );
    const err: string[] = [];
    expect(
      await config(["get", "repository"], { ...d, err: (l) => err.push(l) }),
    ).toBe(1);
    expect(err).toEqual([
      "FACTORY_SETTINGS: presets are read through the lock. Use FACTORY_LOCK",
    ]);
  });
});
