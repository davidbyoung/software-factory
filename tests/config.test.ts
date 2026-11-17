import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { load } from "js-yaml";
import {
  main,
  parseSettings,
  patternWarnings,
  reachOf,
  type Deps,
} from "../src/config.mts";
import { matchesGlob } from "../src/lib/glob.mts";
import { BUILT } from "../src/tool-names.mts";
import { builtOf, TOOLS } from "../src/tools.mts";

const MINIMAL = { version: 1, repository: "owner/name" };

const parse = (raw: unknown, exists: (p: string) => boolean = () => true) =>
  parseSettings(raw, exists);

describe("parseSettings", () => {
  it("fills every default for the shortest file", () => {
    expect(parse(MINIMAL)).toEqual({
      version: 1,
      repository: "owner/name",
      tickets: {
        type: "github",
        options: {},
        board: null,
        columns: {
          backlog: "Backlog",
          refining: "In refinement",
          ready: "Ready",
          building: "In progress",
          review: "In review",
          done: "Done",
        },
        fields: { session: "Session", "runs-in": "Runs in", cost: "Cost" },
      },
      codeHost: { type: "github" },
      builds: { trigger: "manual", runner: "github-actions" },
      specs: "none",
      beforeCommit: [],
      buildSetup: [],
      plugins: [],
      autoMerge: { allow: [], deny: [], commands: [] },
      ciReview: null,
      site: null,
      sessionMinutes: {
        build: 230,
        conflicts: 110,
        review: 50,
        dependencies: 50,
      },
    });
  });

  describe("the CI review and the commands it may run", () => {
    it("is on with no commands when ci-review is written with nothing under it", () => {
      expect(parse({ ...MINIMAL, "ci-review": null }).ciReview).toEqual({
        commands: [],
      });
    });

    it("takes a list of command prefixes", () => {
      expect(
        parse({
          ...MINIMAL,
          "ci-review": { commands: ["npx vitest run", "node"] },
        }).ciReview,
      ).toEqual({ commands: ["npx vitest run", "node"] });
    });

    it.each([
      [{ "ci-review": { commands: "npx vitest run" } }, "ci-review.commands:"],
      [{ "ci-review": { commands: [1] } }, "ci-review.commands[0]:"],
      [{ "ci-review": { commands: ["a, b"] } }, "ci-review.commands[0]:"],
      [{ "ci-review": { commands: ["a)"] } }, "ci-review.commands[0]:"],
      [{ "ci-review": { commands: ['a"'] } }, "ci-review.commands[0]:"],
      [{ "ci-review": "npx vitest run" }, "ci-review:"],
    ])("fails on %j, naming the key", (raw, message) => {
      expect(() => parse({ ...MINIMAL, ...raw })).toThrow(message);
    });
  });

  describe("how long each kind of unattended session may run", () => {
    it("takes a value for each kind, and keeps the default for the rest", () => {
      expect(
        parse({ ...MINIMAL, "session-minutes": { build: 300, review: 20 } })
          .sessionMinutes,
      ).toEqual({ build: 300, conflicts: 110, review: 20, dependencies: 50 });
    });

    it("takes a value past the 6 hours GitHub's own runners allow", () => {
      expect(
        parse({ ...MINIMAL, "session-minutes": { build: 2000 } }).sessionMinutes
          .build,
      ).toBe(2000);
    });

    it.each([
      [
        { build: 0 },
        "session-minutes.build: must be a whole number above zero",
      ],
      [
        { review: 1.5 },
        "session-minutes.review: must be a whole number above zero",
      ],
      [
        { conflicts: "60" },
        "session-minutes.conflicts: must be a whole number above zero",
      ],
      [{ builds: 60 }, "session-minutes.builds: unknown key"],
    ])("refuses %j", (value, message) => {
      expect(() => parse({ ...MINIMAL, "session-minutes": value })).toThrow(
        message,
      );
    });
  });

  it("takes a swappable part written as a block or as one word", () => {
    expect(parse({ ...MINIMAL, specs: { type: "openspec" } }).specs).toBe(
      "openspec",
    );
    expect(parse({ ...MINIMAL, specs: "openspec" }).specs).toBe("openspec");
  });

  it.each([
    [{ ...MINIMAL, approvers: ["a"] }, "approvers: unknown key"],
    [{ ...MINIMAL, tickets: { colour: 1 } }, "tickets.colour: unknown key"],
    [{ ...MINIMAL, builds: { queue: "x" } }, "builds.queue: unknown key"],
    [
      { ...MINIMAL, "code-host": { type: "github", url: "u" } },
      "code-host.url: unknown key",
    ],
    [
      { ...MINIMAL, plugins: [{ agent: "a", role: "reviewer", when: 1 }] },
      "plugins[0].when: unknown key",
    ],
  ])("fails on an unknown key", (raw, message) => {
    expect(() => parse(raw)).toThrow(message);
  });

  it.each([
    [{ ...MINIMAL, repository: 7 }, "repository:"],
    [{ ...MINIMAL, repository: "no-slash" }, "repository:"],
    [{ ...MINIMAL, tickets: { board: "one" } }, "tickets.board:"],
    [{ ...MINIMAL, "before-commit": "npm test" }, "before-commit:"],
    [{ ...MINIMAL, "before-commit": [1] }, "before-commit[0]:"],
    [{ ...MINIMAL, "auto-merge": { allow: "src/**" } }, "auto-merge.allow:"],
    [{ ...MINIMAL, plugins: { skill: "a" } }, "plugins:"],
    [{ ...MINIMAL, builds: { trigger: "cron" } }, "builds.trigger:"],
    [{ ...MINIMAL, specs: "markdown" }, "specs:"],
    [{ ...MINIMAL, "build-setup": "npm test" }, "build-setup:"],
    [{ ...MINIMAL, "build-setup": [1] }, "build-setup[0]:"],
  ])("fails on a wrong type, naming the key", (raw, message) => {
    expect(() => parse(raw)).toThrow(message);
  });

  it("fails on a ticket system other than GitHub, naming the one supported", () => {
    expect(() => parse({ ...MINIMAL, tickets: { type: "jira" } })).toThrow(
      '.claude/factory.yaml: tickets.type "jira" is not supported. "github" is the only ticket system built.',
    );
  });

  it("knows the tools by the names the registry builds", () => {
    expect(builtOf(TOOLS)).toEqual(BUILT);
  });

  describe("with a second ticket system built, which adds a site", () => {
    const built = {
      ...BUILT,
      tickets: { ...BUILT.tickets, fake: ["site"] },
    };
    const parseWith = (raw: unknown) => parseSettings(raw, () => true, built);

    it("takes its name and its own key", () => {
      const s = parseWith({
        ...MINIMAL,
        tickets: { type: "fake", site: "https://tickets.example" },
      });
      expect(s.tickets.type).toBe("fake");
      expect(s.tickets.options).toEqual({ site: "https://tickets.example" });
    });

    it("refuses its key under another ticket system", () => {
      expect(() =>
        parseWith({ ...MINIMAL, tickets: { site: "https://tickets.example" } }),
      ).toThrow(".claude/factory.yaml: tickets.site: unknown key");
    });

    it("takes a second code host's name and a second runner's", () => {
      const more = {
        ...BUILT,
        codeHost: [...BUILT.codeHost, "elsewhere"],
        runner: [...BUILT.runner, "fake-runner"],
      };
      const s = parseSettings(
        {
          ...MINIMAL,
          "code-host": "elsewhere",
          builds: { runner: "fake-runner" },
        },
        () => true,
        more,
      );
      expect(s.codeHost.type).toBe("elsewhere");
      expect(s.builds.runner).toBe("fake-runner");
    });

    it("names every one built when refusing a name", () => {
      expect(() =>
        parseWith({ ...MINIMAL, tickets: { type: "jira" } }),
      ).toThrow(
        '.claude/factory.yaml: tickets.type "jira" is not supported. The ticket systems built are "github" and "fake".',
      );
    });
  });

  it("takes the code host written as a block or as one word", () => {
    for (const written of ["github", { type: "github" }])
      expect(parse({ ...MINIMAL, "code-host": written }).codeHost).toEqual({
        type: "github",
      });
  });

  it("fails on a code host other than GitHub, naming the one supported", () => {
    for (const written of ["gitlab", { type: "gitlab" }])
      expect(() => parse({ ...MINIMAL, "code-host": written })).toThrow(
        '.claude/factory.yaml: code-host.type "gitlab" is not supported. "github" is the only code host built.',
      );
  });

  it("takes GitHub Actions as the runner, beside any trigger", () => {
    expect(
      parse({
        ...MINIMAL,
        builds: { trigger: "manual", runner: "github-actions" },
      }).builds,
    ).toEqual({ trigger: "manual", runner: "github-actions" });
  });

  it("fails on a runner other than GitHub Actions, naming the one supported", () => {
    expect(() =>
      parse({ ...MINIMAL, builds: { runner: "buildkite" } }),
    ).toThrow(
      '.claude/factory.yaml: builds.runner "buildkite" is not supported. "github-actions" is the only runner built.',
    );
  });

  it("fails on the github-action trigger, which is planned and not built", () => {
    expect(() =>
      parse({ ...MINIMAL, builds: { trigger: "github-action" } }),
    ).toThrow(
      '.claude/factory.yaml: builds.trigger "github-action" is planned, not built. Use own-server or manual.',
    );
  });

  it.each([2, "1", undefined])("fails on version %s", (version) => {
    expect(() => parse({ ...MINIMAL, version })).toThrow("version:");
  });

  it("fails on a plug-in whose file does not exist", () => {
    const exists = (p: string) => p === ".claude/agents/here.md";
    const plugins = [
      { agent: "here", role: "reviewer" },
      { skill: "gone", role: "builder" },
    ];
    expect(() => parse({ ...MINIMAL, plugins }, exists)).toThrow(
      "plugins[1].skill: .claude/skills/gone/SKILL.md does not exist",
    );
  });

  it("fails on a role other than the three", () => {
    expect(() =>
      parse({ ...MINIMAL, plugins: [{ skill: "a", role: "tester" }] }),
    ).toThrow("plugins[0].role:");
  });
});

describe("patternWarnings", () => {
  it("warns on a pattern that matches no file, and on nothing else", () => {
    const s = parse({
      ...MINIMAL,
      plugins: [{ agent: "a", role: "reviewer", files: ["db/**"] }],
      "auto-merge": { allow: ["src/**", "docs/**"], deny: ["src/a.ts"] },
    });
    expect(patternWarnings(s, ["src/a.ts", "README.md"])).toEqual([
      "plugins[0].files: db/** matches no file",
      "auto-merge.allow: docs/** matches no file",
    ]);
  });
});

function deps(over: Partial<Deps> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const d: Deps = {
    readFile: () =>
      [
        "version: 1",
        "repository: owner/name",
        "tickets:",
        "  board: 3",
        "plugins:",
        "  - skill: mock",
        "    role: mockups",
        "  - agent: rev",
        "    role: reviewer",
        "    files: [src/**, public/**]",
        "  - skill: build",
        "    role: builder",
        "    labels: [new-thing]",
        "before-commit:",
        "  - npm test",
        "  - npm run lint",
      ].join("\n"),
    exists: () => true,
    hasPackage: () => true,
    listFiles: () => ["src/a.ts", "public/x"],
    loadYaml: async () => load,
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    ...over,
  };
  return { d, out, err };
}

describe("main", () => {
  it("prints a setting, a list one item per line", async () => {
    const { d, out } = deps();
    expect(await main(["repository"], d)).toBe(0);
    expect(await main(["tickets.board"], d)).toBe(0);
    expect(await main(["before-commit"], d)).toBe(0);
    expect(out).toEqual(["owner/name", "3", "npm test", "npm run lint"]);
  });

  it("prints the code host and the runner a file leaves out", async () => {
    const { d, out } = deps();
    expect(await main(["code-host.type"], d)).toBe(0);
    expect(await main(["builds.runner"], d)).toBe(0);
    expect(out).toEqual(["github", "github-actions"]);
  });

  it.each([
    [
      "code-host: gitlab",
      '.claude/factory.yaml: code-host.type "gitlab" is not supported. "github" is the only code host built.',
    ],
    [
      "builds:\n  runner: buildkite",
      '.claude/factory.yaml: builds.runner "buildkite" is not supported. "github-actions" is the only runner built.',
    ],
  ])("fails the check on %s", async (written, message) => {
    const { d, err } = deps({
      readFile: () => `version: 1\nrepository: a/b\n${written}\n`,
    });
    expect(await main(["check"], d)).toBe(1);
    expect(err).toEqual([message]);
  });

  it("prints the build's setup commands one per line, and nothing when there are none", async () => {
    const { d, out } = deps();
    expect(await main(["build-setup"], d)).toBe(0);
    expect(out).toEqual([]);
    const set = deps({
      readFile: () =>
        "version: 1\nrepository: a/b\nbuild-setup:\n  - make tools\n  - make data\n",
    });
    expect(await main(["build-setup"], set.d)).toBe(0);
    expect(set.out).toEqual(["make tools", "make data"]);
  });

  it("fails the check, naming the key, when build-setup is not a list of text", async () => {
    const { d, err } = deps({
      readFile: () => "version: 1\nrepository: a/b\nbuild-setup: make tools\n",
    });
    expect(await main(["check"], d)).toBe(1);
    expect(err.join("\n")).toContain("build-setup:");
  });

  it("prints each plug-in, or those with one role", async () => {
    const { d, out } = deps();
    await main(["plugins", "reviewer"], d);
    expect(out).toEqual(["agent rev reviewer src/** public/**"]);
    out.length = 0;
    await main(["plugins"], d);
    expect(out).toEqual([
      "skill mock mockups",
      "agent rev reviewer src/** public/**",
      "skill build builder new-thing",
    ]);
  });

  describe("the design skill as a website's mockups plug-in", () => {
    const SKILL = ".claude/skills/factory-design/SKILL.md";
    const WARNING = `warning: ${SKILL} is missing: run \`npx --no-install factory sync\` to give the site its design skill`;
    const settings = (plugins: string[]) =>
      [
        "version: 1",
        "repository: owner/name",
        "site:",
        "  start: npm start",
        "  url: http://localhost:$PORT",
        ...plugins,
      ].join("\n");
    const OWN = ["plugins:", "  - skill: mine", "    role: mockups"];
    const synced = () => true;
    const unsynced = (path: string) => path !== SKILL;

    it.each([[["plugins", "mockups"]], [["plugins"]]])(
      "is listed by %j for a site that lists none, once it is synced",
      async (argv) => {
        const { d, out } = deps({
          readFile: () => settings([]),
          exists: synced,
        });

        await main(argv, d);
        expect(out).toEqual(["skill factory-design mockups"]);
      },
    );

    it("gives way to a mockups plug-in the settings list", async () => {
      const { d, out } = deps({
        readFile: () => settings(OWN),
        exists: synced,
      });

      await main(["plugins", "mockups"], d);
      expect(out).toEqual(["skill mine mockups"]);
    });

    it("is no plug-in where there is no site", async () => {
      const { d, out } = deps({
        readFile: () => "version: 1\nrepository: owner/name\n",
        exists: synced,
      });

      await main(["plugins", "mockups"], d);
      expect(out).toEqual([]);
    });

    it("is no plug-in before it is synced", async () => {
      const { d, out } = deps({
        readFile: () => settings([]),
        exists: unsynced,
      });

      await main(["plugins", "mockups"], d);
      expect(out).toEqual([]);
    });

    it("has the check say to sync before it is synced", async () => {
      const { d, err } = deps({
        readFile: () => settings([]),
        exists: unsynced,
      });

      expect(await main(["check"], d)).toBe(0);
      expect(err).toEqual([WARNING]);
    });

    it.each([
      ["once it is synced", [] as string[], synced],
      ["where the site lists its own", OWN, unsynced],
    ])("leaves the check silent %s", async (_, plugins, exists) => {
      const { d, err } = deps({ readFile: () => settings(plugins), exists });

      expect(await main(["check"], d)).toBe(0);
      expect(err).toEqual([]);
    });
  });

  it("checks a sound file silently", async () => {
    const { d, out, err } = deps();
    expect(await main(["check"], d)).toBe(0);
    expect([...out, ...err]).toEqual([]);
  });

  it("warns without failing when a pattern matches nothing", async () => {
    const { d, err } = deps({ listFiles: () => ["src/a.ts"] });
    expect(await main(["check"], d)).toBe(0);
    expect(err).toEqual([
      "warning: plugins[1].files: public/** matches no file",
    ]);
  });

  it("fails, naming the key, on an unsound file", async () => {
    const { d, err } = deps({ readFile: () => "version: 2\nrepository: a/b" });
    expect(await main(["check"], d)).toBe(1);
    expect(err.join("\n")).toContain("version:");
  });

  it("says to run npm ci when js-yaml cannot be loaded", async () => {
    const { d, out, err } = deps({
      loadYaml: () => Promise.reject(new Error("Cannot find package")),
    });
    expect(await main(["repository"], d)).toBe(1);
    expect(out).toEqual([]);
    expect(err).toEqual([
      "The factory's settings cannot be read until dependencies are installed: run npm ci.",
    ]);
  });
});

// The settings' patterns, matched by lib/glob.mts.
describe("matchesGlob", () => {
  it.each([
    ["src/pages/**/*.tsx", "src/pages/page.tsx", true],
    ["src/pages/**/*.tsx", "src/pages/a/b/c.tsx", true],
    ["public/**", "public/.well-known/x", true],
    ["public/*", "public/.htaccess", true],
    ["package.json", "package.json", true],
    ["package.json", "tools/package.json", false],
    ["docs/**", "docs", false],
    ["src/pages/*.tsx", "src/pages/a/b.tsx", false],
  ])("%s against %s is %s", (pattern, path, expected) => {
    expect(matchesGlob(path, pattern)).toBe(expected);
  });
});

describe("site settings", () => {
  it("takes accessibility none and new-values false", () => {
    const s = parse({
      ...MINIMAL,
      site: {
        start: "s",
        url: "u",
        accessibility: "none",
        "new-values": false,
      },
    }).site;
    expect(s?.accessibility).toBe("none");
    expect(s?.newValues).toBe(false);
  });

  const site = { start: "npm start", url: "http://localhost:$PORT" };
  const withSite = (extra: object = {}) =>
    `version: 1\nrepository: a/b\nsite: ${JSON.stringify({ ...site, ...extra })}\n`;

  it("fills the defaults", () => {
    expect(parse({ ...MINIMAL, site }).site).toEqual({
      ...site,
      designGuide: null,
      pages: null,
      widths: [390, 1280],
      hide: [],
      checks: [],
      maxPages: 4,
      startMinutes: 5,
      accessibility: "wcag22aa",
      newValues: true,
    });
  });

  it("is null when no site is written", () => {
    expect(parse(MINIMAL).site).toBeNull();
  });

  it.each([
    [{ site: { url: "u" } }, "site.start: is required"],
    [{ site: { start: "s" } }, "site.url: is required"],
    [{ site: { ...site, nope: 1 } }, "site.nope: unknown key"],
    [{ site: { ...site, "max-pages": 0 } }, "site.max-pages"],
    [
      { site: { ...site, accessibility: "wcag3" } },
      "site.accessibility: must be one of wcag22aa, wcag21aa, wcag2aa, none",
    ],
    [{ site: { ...site, "new-values": "yes" } }, "site.new-values"],
    [
      { plugins: [{ agent: "factory-ui-reviewer", role: "reviewer" }] },
      "site: is required to list factory-ui-reviewer",
    ],
  ])("rejects an unsound site", (raw, message) => {
    expect(() => parse({ ...MINIMAL, ...raw })).toThrow(message);
  });

  it("rejects a design guide that is not a file", () => {
    expect(() =>
      parse(
        { ...MINIMAL, site: { ...site, "design-guide": "x.md" } },
        () => false,
      ),
    ).toThrow("site.design-guide");
  });

  it.each([
    ["session-minutes.build", "230"],
    ["session-minutes.conflicts", "110"],
    ["session-minutes.review", "50"],
    ["session-minutes.dependencies", "50"],
  ])("prints %s, the value in effect", async (key, value) => {
    const { d, out } = deps();
    expect(await main([key], d)).toBe(0);
    expect(out).toEqual([value]);
  });

  it("prints every key in order, defaults included, and one key as other settings print", async () => {
    const { d, out } = deps({
      readFile: () => withSite({ widths: [390, 768], hide: [".a", ".b"] }),
    });
    expect(await main(["site"], d)).toBe(0);
    expect(out).toEqual([
      "start: npm start",
      "url: http://localhost:$PORT",
      "design-guide: none",
      "pages: found",
      "widths: 390, 768",
      "hide: .a, .b",
      "checks: none",
      "max-pages: 4",
      "start-minutes: 5",
      "accessibility: wcag22aa",
      "new-values: true",
    ]);
    out.length = 0;
    await main(["site.widths"], d);
    await main(["site.pages"], d);
    await main(["site.checks"], d);
    await main(["site.design-guide"], d);
    expect(out).toEqual(["390", "768", "found", "none", "none"]);
  });

  it("fails `config get site` when no site is written", async () => {
    const { d, err } = deps();
    expect(await main(["site"], d)).toBe(1);
    expect(err[0]).toContain("not a setting that prints");
  });

  it("fails the check without the playwright package, and passes with it", async () => {
    const missing = deps({
      readFile: () => withSite(),
      hasPackage: () => false,
    });
    expect(await main(["check"], missing.d)).toBe(1);
    expect(missing.err).toEqual([
      "site needs Playwright: npm install -D playwright",
    ]);
    const present = deps({
      readFile: () => withSite(),
      hasPackage: () => true,
    });
    expect(await main(["check"], present.d)).toBe(0);
  });
});

describe("reachOf", () => {
  it("takes the repository from GITHUB_REPOSITORY and the defaults, without reading the settings", async () => {
    const settings = async () => {
      throw new Error("the settings were read");
    };
    expect(await reachOf({ GITHUB_REPOSITORY: "o/r" }, settings)).toEqual({
      repository: "o/r",
      codeHost: "github",
      runner: "github-actions",
    });
  });

  it("takes all three from the settings otherwise", async () => {
    expect(await reachOf({}, async () => parse(MINIMAL))).toEqual({
      repository: "owner/name",
      codeHost: "github",
      runner: "github-actions",
    });
  });
});
