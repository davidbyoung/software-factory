import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { load } from "js-yaml";
import {
  main,
  NO_DEPENDENCIES,
  parseSettings,
  SETTINGS_KEYS,
  SettingsError,
  ROLES,
  patternWarnings,
  pluginsOf,
  reachOf,
  type Deps,
} from "../src/config.mts";
import { matchesGlob } from "../src/lib/glob.mts";
import { explainedLines } from "../src/explain.mts";
import { BUILT } from "../src/tool-names.mts";
import { builtOf, TOOLS } from "../src/tools.mts";
import { FACTORY_COLUMNS_YAML } from "./factory-columns";
import { CODE_HOST, CODE_HOST_YAML } from "./settings-fixture";
import { into, look } from "./printed";

const MINIMAL = {
  version: 2,
  repository: "owner/name",
  "code-host": CODE_HOST,
};

const parse = (raw: unknown, exists: (p: string) => boolean = () => true) =>
  parseSettings(raw, exists);

describe("parseSettings", () => {
  it("fills every default for the shortest file", () => {
    expect(parse(MINIMAL)).toEqual({
      version: 2,
      repository: "owner/name",
      tickets: {
        type: "github",
        options: {},
        board: null,
        statuses: false,
        columns: {
          backlog: ["Backlog"],
          refining: ["In refinement"],
          ready: ["Ready"],
          building: ["In progress"],
          review: ["In review"],
          done: ["Done"],
        },
        fields: { session: "Session", "runs-in": "Runs in", cost: "Cost" },
        ticketFields: {
          decisions: null,
          spec: null,
          "acceptance-criteria": null,
          "for-the-builder": null,
          repositories: null,
        },
        labels: { spec: "spec", "follow-up": "follow-up", factory: "factory" },
      },
      codeHost: {
        type: "github",
        branchName: "{ticket}",
        labels: {
          "merge-automatic": "merge-automatic",
          "merge-manual": "merge-manual",
          "verdict-override": "verdict-override",
        },
      },
      builds: {
        trigger: "manual",
        runner: "github-actions",
        pollMinutes: 5,
        maxPerHour: 20,
        hosts: [],
      },
      specs: "none",
      specCheck: null,
      commands: {
        buildSetup: [],
        beforeCommit: [],
        gate: [],
        testOne: null,
        endToEnd: null,
        coverage: null,
        relock: "npm install",
      },
      plugins: [],
      testReviewersWritten: false,
      autoMerge: { allow: [], deny: [], commands: [] },
      prReview: null,
      site: null,
      sessionMinutes: {
        build: 230,
        conflicts: 110,
        review: 50,
        dependencies: 50,
      },
      rules: { smallChangeLines: 30, reviewRounds: 2 },
    });
  });

  describe("the CI review and the commands it may run", () => {
    it("is on with no commands when pr-review is written with nothing under it", () => {
      expect(parse({ ...MINIMAL, "pr-review": null }).prReview).toEqual({
        commands: [],
      });
    });

    it("takes a list of command prefixes", () => {
      expect(
        parse({
          ...MINIMAL,
          "pr-review": { commands: ["npx vitest run", "node"] },
        }).prReview,
      ).toEqual({ commands: ["npx vitest run", "node"] });
    });

    it.each([
      [{ "pr-review": { commands: "npx vitest run" } }, "pr-review.commands:"],
      [{ "pr-review": { commands: [1] } }, "pr-review.commands[0]:"],
      [{ "pr-review": { commands: ["a, b"] } }, "pr-review.commands[0]:"],
      [{ "pr-review": { commands: ["a)"] } }, "pr-review.commands[0]:"],
      [{ "pr-review": { commands: ['a"'] } }, "pr-review.commands[0]:"],
      [{ "pr-review": "npx vitest run" }, "pr-review:"],
    ])("fails on %j, naming the key", (raw, message) => {
      expect(() => parse({ ...MINIMAL, ...raw })).toThrow(message);
    });
  });

  describe("the numbers the rules use", () => {
    it("takes each number, and keeps the default for the other", () => {
      expect(
        parse({ ...MINIMAL, rules: { "small-change-lines": 50 } }).rules,
      ).toEqual({ smallChangeLines: 50, reviewRounds: 2 });
      expect(
        parse({ ...MINIMAL, rules: { "review-rounds": 3 } }).rules,
      ).toEqual({ smallChangeLines: 30, reviewRounds: 3 });
    });

    it("takes an empty block as the defaults", () => {
      expect(parse({ ...MINIMAL, rules: {} }).rules).toEqual({
        smallChangeLines: 30,
        reviewRounds: 2,
      });
    });

    it.each([0, -1, 2.5, "3"])("fails on %j, naming the key", (value) => {
      expect(() =>
        parse({ ...MINIMAL, rules: { "review-rounds": value } }),
      ).toThrow(
        ".claude/factory.yaml: rules.review-rounds: must be a whole number above zero",
      );
      expect(() =>
        parse({ ...MINIMAL, rules: { "small-change-lines": value } }),
      ).toThrow(
        ".claude/factory.yaml: rules.small-change-lines: must be a whole number above zero",
      );
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
    [{ ...MINIMAL, commands: { lint: "x" } }, "commands.lint: unknown key"],
    [
      { ...MINIMAL, commands: { coverage: { run: "a", report: "b", at: 1 } } },
      "commands.coverage.at: unknown key",
    ],
    [
      { ...MINIMAL, specs: { type: "openspec", strict: true } },
      "specs.strict: unknown key",
    ],
    [{ ...MINIMAL, plugins: { deploy: {} } }, "plugins.deploy: unknown key"],
    [
      { ...MINIMAL, plugins: { build: { testers: [] } } },
      "plugins.build.testers: unknown key",
    ],
    [
      {
        ...MINIMAL,
        plugins: {
          build: { reviewers: [{ agent: "a", files: ["x"], when: 1 }] },
        },
      },
      "plugins.build.reviewers[0].when: unknown key",
    ],
  ])("fails on an unknown key", (raw, message) => {
    expect(() => parse(raw)).toThrow(message);
  });

  it.each([
    [{ ...MINIMAL, repository: 7 }, "repository:"],
    [{ ...MINIMAL, repository: "no-slash" }, "repository:"],
    [{ ...MINIMAL, tickets: { board: "one" } }, "tickets.board:"],
    [{ ...MINIMAL, "auto-merge": { allow: "src/**" } }, "auto-merge.allow:"],
    [{ ...MINIMAL, plugins: "mine" }, "plugins: must be a block of settings"],
    [{ ...MINIMAL, plugins: { build: [] } }, "plugins.build:"],
    [
      { ...MINIMAL, plugins: { build: { reviewers: {} } } },
      "plugins.build.reviewers: must be a list",
    ],
    [
      { ...MINIMAL, plugins: { test: { prover: [{ skill: "a" }] } } },
      "plugins.test.prover: must be a block of settings",
    ],
    [{ ...MINIMAL, commands: ["npm test"] }, "commands:"],
    [{ ...MINIMAL, builds: { trigger: "cron" } }, "builds.trigger:"],
    [{ ...MINIMAL, specs: "markdown" }, "specs:"],
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
          "code-host": { type: "elsewhere", "branch-name": "{ticket}" },
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

  describe("code-host.branch-name", () => {
    const named = (branchName: unknown) => ({
      ...MINIMAL,
      "code-host": { type: "github", "branch-name": branchName },
    });
    const refusal = (branchName: unknown) => {
      try {
        parse(named(branchName));
      } catch (e) {
        return (e as Error).message;
      }
      return "accepted";
    };
    const REQUIRED =
      '.claude/factory.yaml: code-host.branch-name: is required. Run factory init to set it, or add it, such as branch-name: "{ticket}"';

    it("is required", () => {
      expect(() => parse({ ...MINIMAL, "code-host": undefined })).toThrow(
        REQUIRED,
      );
    });

    it("is required of a code host written on one line", () => {
      expect(() => parse({ ...MINIMAL, "code-host": "github" })).toThrow(
        REQUIRED,
      );
    });

    it("is left out only for init, which asks for it", () => {
      const s = parseSettings(
        { ...MINIMAL, "code-host": "github" },
        () => true,
        BUILT,
        { partial: true },
      );
      expect(s.codeHost.branchName).toBeNull();
    });

    it("takes a pattern with the ticket and the user", () => {
      expect(parse(named("feature/{user}/{ticket}")).codeHost.branchName).toBe(
        "feature/{user}/{ticket}",
      );
    });

    it("says to quote a pattern YAML read as a map", () => {
      expect(refusal(load("{ticket}"))).toBe(
        '.claude/factory.yaml: code-host.branch-name: is a map, not a pattern. Quote it: branch-name: "{ticket}"',
      );
    });

    it.each([[12], [["{ticket}"]], [true]])(
      "refuses %j, which is not text",
      (value) => {
        expect(refusal(value)).toBe(
          '.claude/factory.yaml: code-host.branch-name: must be a pattern, such as branch-name: "{ticket}"',
        );
      },
    );

    it("names the first placeholder it doesn't know", () => {
      expect(refusal("{slug}/{ticket}-{type}")).toBe(
        ".claude/factory.yaml: code-host.branch-name: {slug} is not a placeholder. The placeholders are {ticket} and {user}",
      );
    });

    it.each([[""], ["feature/{user}"], ["{ticket"]])(
      "refuses %j, which has no {ticket}",
      (value) => {
        expect(refusal(value)).toBe(
          ".claude/factory.yaml: code-host.branch-name: needs {ticket}, or every build gets the same branch",
        );
      },
    );

    it.each([
      ["a b/{ticket}", "it has a space"],
      ["a\tb/{ticket}", "it has a control character"],
      ["a\u007fb/{ticket}", "it has a control character"],
      ["a..b/{ticket}", "it has .."],
      ["feature//{ticket}", "it has //"],
      ["a@{b/{ticket}", "it has @{"],
      ["a~b/{ticket}", "it has ~"],
      ["a^b/{ticket}", "it has ^"],
      ["a:b/{ticket}", "it has :"],
      ["a?b/{ticket}", "it has ?"],
      ["a*b/{ticket}", "it has *"],
      ["a[b/{ticket}", "it has ["],
      ["a\\b/{ticket}", "it has \\"],
      ["-{ticket}", "it starts with -"],
      ["/{ticket}", "it starts with /"],
      ["{ticket}/", "it ends with /"],
      ["{ticket}.lock", "it ends with .lock"],
      ["{ticket}.", "it ends with ."],
      [".a/{ticket}", "a part starts with ."],
      ["a.lock/{ticket}", "a part ends with .lock"],
    ])("refuses %j, which git refuses: %s", (pattern, reason) => {
      expect(refusal(pattern)).toBe(
        `.claude/factory.yaml: code-host.branch-name: ${pattern} can't be a git branch name: ${reason}`,
      );
      const filled = pattern.replace("{ticket}", "1");
      expect(
        spawnSync("git", ["check-ref-format", "--branch", filled]).status,
      ).not.toBe(0);
    });

    it("names the first of several faults: an unknown placeholder before git's rules", () => {
      expect(refusal("a b/{slug}")).toBe(
        ".claude/factory.yaml: code-host.branch-name: {slug} is not a placeholder. The placeholders are {ticket} and {user}",
      );
    });

    it("names a missing {ticket} before git's rules", () => {
      expect(refusal("a b")).toBe(
        ".claude/factory.yaml: code-host.branch-name: needs {ticket}, or every build gets the same branch",
      );
    });

    it.each([
      ["{ticket}"],
      ["issue-{ticket}"],
      ["feature/{user}/{ticket}"],
      ["{}{ticket}"],
    ])("accepts %j, as git does", (pattern) => {
      expect(refusal(pattern)).toBe("accepted");
      const filled = pattern.replace("{ticket}", "1").replace("{user}", "u");
      expect(
        spawnSync("git", ["check-ref-format", "--branch", filled]).status,
      ).toBe(0);
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
    ).toEqual({
      trigger: "manual",
      runner: "github-actions",
      pollMinutes: 5,
      maxPerHour: 20,
      hosts: [],
    });
  });

  it("fails on a runner other than GitHub Actions, naming the one supported", () => {
    expect(() =>
      parse({ ...MINIMAL, builds: { runner: "buildkite" } }),
    ).toThrow(
      '.claude/factory.yaml: builds.runner "buildkite" is not supported. "github-actions" is the only runner built.',
    );
  });

  it("accepts the github-action trigger", () => {
    expect(
      parse({ ...MINIMAL, builds: { trigger: "github-action" } }).builds
        .trigger,
    ).toBe("github-action");
  });

  it("caps builds at 20 an hour when builds.max-per-hour is not set", () => {
    expect(parse(MINIMAL).builds.maxPerHour).toBe(20);
  });

  it.each(["manual", "own-server", "github-action"])(
    "takes builds.max-per-hour with the %s trigger",
    (trigger) => {
      expect(
        parse({ ...MINIMAL, builds: { trigger, "max-per-hour": 5 } }).builds
          .maxPerHour,
      ).toBe(5);
    },
  );

  it.each([0, -1, 2.5, "20"])("fails on builds.max-per-hour %s", (max) => {
    expect(() =>
      parse({ ...MINIMAL, builds: { "max-per-hour": max } }),
    ).toThrow(
      ".claude/factory.yaml: builds.max-per-hour: must be a whole number, 1 or more",
    );
  });

  describe("builds.hosts", () => {
    const hosts = (v: unknown) =>
      parse({ ...MINIMAL, builds: { hosts: v } }).builds.hosts;

    it.each([
      "repo.packagist.org",
      "Repo.Packagist.org",
      "a-b.1c.xn--p1ai",
      "*.example.com",
      "notgithub.com",
      "github.com.example.org",
      `${"a".repeat(63)}.example`,
    ])("takes %s as written", (host) => {
      expect(hosts([host])).toEqual([host]);
    });

    it.each([
      "https://repo.packagist.org",
      "repo.packagist.org/packages",
      "repo.packagist.org:443",
      "repo packagist.org",
      " repo.packagist.org",
      "repo.packagist.org\n",
      "repo.packagist.org.",
      "github.com.",
      "repo..org",
      "-repo.org",
      "repo-.org",
      "repo_one.org",
      "localhost",
      "runner",
      "*.com",
      "10.0.0.1",
      "2130706433",
      "127.0.0.0x1",
      "::1",
      "[::1]",
      "*",
      "*.",
      "*.*.example.com",
      "repo.*.org",
      "*repo.org",
      `${"a".repeat(64)}.example`,
      `${"a.".repeat(126)}ab`,
    ])("fails on %j, which is not a host name", (host) => {
      expect(() => hosts(["repo.packagist.org", host])).toThrow(
        new SettingsError(
          ".claude/factory.yaml: builds.hosts[1]: must be a host name",
        ),
      );
    });

    it.each([
      ["repo.packagist.org", "builds.hosts: must be a list"],
      [[""], "builds.hosts[0]: must be text"],
      [[443], "builds.hosts[0]: must be text"],
    ])("fails on %j as any list of text does", (v, message) => {
      expect(() => hosts(v)).toThrow(
        new SettingsError(`.claude/factory.yaml: ${message}`),
      );
    });

    it.each([
      "github.com",
      "GitHub.com",
      "api.github.com",
      "npm.pkg.github.com",
      "githubusercontent.com",
      "raw.githubusercontent.com",
      "*.github.com",
      "*.pkg.github.com",
      "*.githubusercontent.com",
    ])("fails on %s, which is GitHub", (host) => {
      expect(() => hosts(["repo.packagist.org", host])).toThrow(
        new SettingsError(
          ".claude/factory.yaml: builds.hosts can't name GitHub: a build has no GitHub access",
        ),
      );
    });
  });

  it("checks the board every 5 minutes when builds.poll-minutes is not set", () => {
    expect(
      parse({ ...MINIMAL, builds: { trigger: "github-action" } }).builds
        .pollMinutes,
    ).toBe(5);
  });

  it.each([5, 10, 15, 30, 60])("takes builds.poll-minutes %i", (minutes) => {
    expect(
      parse({
        ...MINIMAL,
        builds: { trigger: "github-action", "poll-minutes": minutes },
      }).builds.pollMinutes,
    ).toBe(minutes);
  });

  it.each([0, 1, 7, 45, 120, "15"])(
    "fails on builds.poll-minutes %s, naming the values allowed",
    (minutes) => {
      expect(() =>
        parse({
          ...MINIMAL,
          builds: { trigger: "github-action", "poll-minutes": minutes },
        }),
      ).toThrow("builds.poll-minutes: must be one of 5, 10, 15, 30, 60");
    },
  );

  it.each(["own-server", "manual", undefined])(
    "fails on builds.poll-minutes with the %s trigger",
    (trigger) => {
      expect(() =>
        parse({ ...MINIMAL, builds: { trigger, "poll-minutes": 15 } }),
      ).toThrow(
        ".claude/factory.yaml: builds.poll-minutes needs builds.trigger: github-action",
      );
    },
  );

  it.each([3, "2", undefined])("fails on version %s", (version) => {
    expect(() => parse({ ...MINIMAL, version })).toThrow(
      ".claude/factory.yaml: version: must be 2",
    );
  });

  it("fails on version 1, saying where to read how to move the file", () => {
    expect(() => parse({ ...MINIMAL, version: 1 })).toThrow(
      '.claude/factory.yaml: version: must be 2: this file is version 1, see "Moving to settings version 2" in docs/updating.md',
    );
  });

  it("checks the version before any other key", () => {
    expect(() =>
      parse({
        version: 1,
        repository: "owner/name",
        "before-commit": ["npm test"],
        plugins: [{ agent: "a", role: "reviewer" }],
        colour: "red",
      }),
    ).toThrow("version: must be 2: this file is version 1");
  });

  describe("label names", () => {
    const labeled = (tickets: unknown, codeHost: unknown = undefined) => ({
      ...MINIMAL,
      ...(tickets === undefined ? {} : { tickets: { labels: tickets } }),
      "code-host": { ...CODE_HOST, labels: codeHost },
    });

    it("uses each key as its name when nothing is set", () => {
      const s = parse(MINIMAL);
      expect(s.tickets.labels).toEqual({
        spec: "spec",
        "follow-up": "follow-up",
        factory: "factory",
      });
      expect(s.codeHost.labels).toEqual({
        "merge-automatic": "merge-automatic",
        "merge-manual": "merge-manual",
        "verdict-override": "verdict-override",
      });
    });

    it("takes a name for some keys and keeps the default for the rest", () => {
      const s = parse(
        labeled({ spec: "needs-spec" }, { "merge-manual": "needs owner" }),
      );
      expect(s.tickets.labels).toEqual({
        spec: "needs-spec",
        "follow-up": "follow-up",
        factory: "factory",
      });
      expect(s.codeHost.labels["merge-manual"]).toBe("needs owner");
      expect(s.codeHost.labels["merge-automatic"]).toBe("merge-automatic");
    });

    it.each([
      [
        labeled({ "merge-manual": "x" }),
        ".claude/factory.yaml: tickets.labels.merge-manual: unknown key",
      ],
      [
        labeled(undefined, { spec: "x" }),
        ".claude/factory.yaml: code-host.labels.spec: unknown key",
      ],
    ])("refuses a key that is not one of its side's", (raw, message) => {
      expect(() => parse(raw)).toThrow(message);
    });

    it.each(["", "   "])("refuses an empty name, %j", (name) => {
      expect(() => parse(labeled({ "follow-up": name }))).toThrow(
        ".claude/factory.yaml: tickets.labels.follow-up: must not be empty",
      );
    });

    it("refuses two names equal but for capitals, on the key the file sets", () => {
      expect(() =>
        parse(labeled({ spec: "Spec" }, { "merge-manual": "spec" })),
      ).toThrow(
        '.claude/factory.yaml: code-host.labels.merge-manual: "spec" is already tickets.labels.spec. Give each label its own name',
      );
    });

    it("counts a default name, and names the key the file sets", () => {
      expect(() => parse(labeled({ spec: "follow-up" }))).toThrow(
        '.claude/factory.yaml: tickets.labels.spec: "follow-up" is already tickets.labels.follow-up. Give each label its own name',
      );
    });

    it("takes the factory label's name", () => {
      expect(
        parse(labeled({ factory: "built-by-factory" })).tickets.labels.factory,
      ).toBe("built-by-factory");
    });

    it("puts the factory label after follow-up in the order a clash names", () => {
      expect(() => parse(labeled({ factory: "spec" }))).toThrow(
        '.claude/factory.yaml: tickets.labels.factory: "spec" is already tickets.labels.spec. Give each label its own name',
      );
      expect(() =>
        parse(labeled({ "follow-up": "x" }, { "merge-manual": "X" })),
      ).toThrow("code-host.labels.merge-manual");
      expect(() => parse(labeled({ "follow-up": "x", factory: "X" }))).toThrow(
        '.claude/factory.yaml: tickets.labels.factory: "X" is already tickets.labels.follow-up. Give each label its own name',
      );
    });

    it("names the later of two keys the file sets", () => {
      expect(() =>
        parse(labeled({ spec: "kind", "follow-up": "Kind" })),
      ).toThrow(
        '.claude/factory.yaml: tickets.labels.follow-up: "Kind" is already tickets.labels.spec. Give each label its own name',
      );
    });

    describe("with tickets and pull requests in different tools", () => {
      const built = {
        ...BUILT,
        tickets: { ...BUILT.tickets, fake: [] },
        labelFaults: {
          tickets: {
            fake: (name: string) =>
              name.includes(" ")
                ? "Fake Tickets doesn't allow a space in a label"
                : null,
          },
          codeHost: {},
        },
      };
      const parseWith = (raw: unknown) => parseSettings(raw, () => true, built);
      const fake = (labels: unknown, codeHost: unknown = undefined) => ({
        ...MINIMAL,
        tickets: { type: "fake", labels },
        "code-host": { ...CODE_HOST, labels: codeHost },
      });

      it("lets a ticket label and a pull request label share a name", () => {
        const s = parseWith(
          fake({ spec: "review" }, { "merge-manual": "review" }),
        );
        expect(s.tickets.labels.spec).toBe("review");
        expect(s.codeHost.labels["merge-manual"]).toBe("review");
      });

      it("still refuses two ticket labels with one name", () => {
        expect(() => parseWith(fake({ spec: "x", "follow-up": "x" }))).toThrow(
          'tickets.labels.follow-up: "x" is already tickets.labels.spec',
        );
      });

      it("gives the ticket system's reason for a name it refuses", () => {
        expect(() => parseWith(fake({ spec: "needs spec" }))).toThrow(
          ".claude/factory.yaml: tickets.labels.spec: Fake Tickets doesn't allow a space in a label",
        );
      });
    });
  });

  describe("a ticket system with statuses of its own", () => {
    const built = {
      ...BUILT,
      tickets: { ...BUILT.tickets, fake: [] },
      statuses: ["fake"],
    };
    const parseWith = (raw: unknown) => parseSettings(raw, () => true, built);
    const COLUMNS = {
      backlog: "To Do",
      refining: "none",
      ready: "Selected",
      building: "In Progress",
      review: "none",
      done: ["Done", "Released"],
    };

    it("needs tickets.columns with no board", () => {
      expect(() =>
        parseWith({ ...MINIMAL, tickets: { type: "fake" } }),
      ).toThrow(
        ".claude/factory.yaml: tickets.columns: is required with tickets.type: fake: run factory init to choose which status shows each state",
      );
    });

    it("takes tickets.columns with no board", () => {
      const s = parseWith({
        ...MINIMAL,
        tickets: { type: "fake", columns: COLUMNS },
      });
      expect(s.tickets.statuses).toBe(true);
      expect(s.tickets.columns.done).toEqual(["Done", "Released"]);
    });

    it("names each state left out, as with a board", () => {
      expect(() =>
        parseWith({
          ...MINIMAL,
          tickets: { type: "fake", columns: { ...COLUMNS, done: undefined } },
        }),
      ).toThrow("tickets.columns: done has no column");
    });

    it("leaves GitHub Issues without statuses, so no board needs no columns", () => {
      expect(parse(MINIMAL).tickets.statuses).toBe(false);
    });
  });

  describe("a file in the older shape", () => {
    it.each(["before-commit", "build-setup"])(
      "says where a top-level %s moved to",
      (key) => {
        expect(() => parse({ ...MINIMAL, [key]: ["npm test"] })).toThrow(
          `.claude/factory.yaml: ${key}: moved to commands.${key}`,
        );
      },
    );

    it("says how plugins are grouped when they are written as a list", () => {
      expect(() =>
        parse({ ...MINIMAL, plugins: [{ agent: "a", role: "reviewer" }] }),
      ).toThrow(
        ".claude/factory.yaml: plugins: must be grouped by phase: refine, build, test, conflicts",
      );
    });
  });

  describe("specs", () => {
    it("takes a block with a type and a check", () => {
      const s = parse({
        ...MINIMAL,
        specs: { type: "openspec", check: "make specs" },
      });
      expect([s.specs, s.specCheck]).toEqual(["openspec", "make specs"]);
    });

    it("takes a block whose type is none", () => {
      const s = parse({ ...MINIMAL, specs: { type: "none" } });
      expect([s.specs, s.specCheck]).toEqual(["none", null]);
    });

    it("fails on a type in a block that is neither openspec nor none", () => {
      expect(() => parse({ ...MINIMAL, specs: { type: "markdown" } })).toThrow(
        "specs: must be one of none, openspec",
      );
    });

    it.each(["openspec", { type: "openspec" }])(
      "checks OpenSpec's specs with its own command when %j sets no check",
      (specs) => {
        expect(parse({ ...MINIMAL, specs }).specCheck).toBe(
          "npx --no-install openspec validate --all --strict --no-interactive",
        );
      },
    );

    it.each([{ type: "none", check: "make specs" }, { check: "make specs" }])(
      "fails on %j, a check with no specs to check",
      (specs) => {
        expect(() => parse({ ...MINIMAL, specs })).toThrow(
          ".claude/factory.yaml: specs.check needs specs.type: openspec",
        );
      },
    );

    it.each(["", 7, ["make specs"]])(
      "fails on the check %j, which is not text",
      (check) => {
        expect(() =>
          parse({ ...MINIMAL, specs: { type: "openspec", check } }),
        ).toThrow(".claude/factory.yaml: specs.check: must be text");
      },
    );
  });

  describe("commands", () => {
    const commands = (written: unknown) =>
      parse({ ...MINIMAL, commands: written }).commands;

    it("takes every command", () => {
      expect(
        commands({
          "build-setup": ["make tools"],
          "before-commit": ["make lint", "make types"],
          gate: ["make check"],
          "test-one": "make test FILE=$FILE",
          "end-to-end": "make e2e FILE=$FILE",
          coverage: { run: "make coverage", report: "out/lcov.info" },
          relock: "make lock",
        }),
      ).toEqual({
        buildSetup: ["make tools"],
        beforeCommit: ["make lint", "make types"],
        gate: ["make check"],
        testOne: "make test FILE=$FILE",
        endToEnd: "make e2e FILE=$FILE",
        coverage: { run: "make coverage", report: "out/lcov.info" },
        relock: "make lock",
      });
    });

    it("relocks with npm install, and leaves the rest empty or unset, when the block is empty", () => {
      expect(commands({})).toEqual(parse(MINIMAL).commands);
      expect(parse(MINIMAL).commands.relock).toBe("npm install");
    });

    it.each(["build-setup", "before-commit", "gate"])(
      "fails on %s that is not a list of text, naming the key",
      (key) => {
        expect(() => commands({ [key]: "npm test" })).toThrow(
          `.claude/factory.yaml: commands.${key}: must be a list`,
        );
        expect(() => commands({ [key]: ["npm test", 1] })).toThrow(
          `.claude/factory.yaml: commands.${key}[1]: must be text`,
        );
      },
    );

    it.each(["test-one", "end-to-end", "relock"])(
      "fails on %s that is not text, or is empty",
      (key) => {
        for (const value of ["", 7, ["npm test"], null])
          expect(() => commands({ [key]: value })).toThrow(
            `.claude/factory.yaml: commands.${key}: must be text`,
          );
      },
    );

    it.each([
      ["run", { report: "coverage/lcov.info" }],
      ["report", { run: "npm run coverage" }],
      ["run", null],
      ["report", { run: "npm run coverage", report: "" }],
    ])("fails on coverage without %s: %j", (key, coverage) => {
      expect(() => commands({ coverage })).toThrow(
        `.claude/factory.yaml: commands.coverage.${key}: is required when commands.coverage is written`,
      );
    });
  });

  describe("plugins, grouped by phase", () => {
    const plugins = (written: unknown, exists?: (p: string) => boolean) =>
      parse({ ...MINIMAL, plugins: written }, exists).plugins;
    const none = { files: [], labels: [] };

    it.each([
      ["refiner", { refine: { refiner: { skill: "mine" } } }],
      ["mockups", { refine: { mockups: { skill: "mine" } } }],
      ["prover", { test: { prover: { skill: "mine" } } }],
    ] as const)("takes one skill as the %s", (role, written) => {
      expect(plugins(written)).toEqual([
        { kind: "skill", name: "mine", role, ...none },
      ]);
    });

    it("takes builders, each a skill with its labels", () => {
      expect(
        plugins({
          build: {
            builders: [
              { skill: "a", labels: ["x"] },
              { skill: "b", labels: ["y", "z"] },
            ],
          },
        }),
      ).toEqual([
        { kind: "skill", name: "a", role: "builder", files: [], labels: ["x"] },
        {
          kind: "skill",
          name: "b",
          role: "builder",
          files: [],
          labels: ["y", "z"],
        },
      ]);
    });

    it("takes build reviewers, each an agent with its files", () => {
      expect(
        plugins({ build: { reviewers: [{ agent: "a", files: ["db/**"] }] } }),
      ).toEqual([
        {
          kind: "agent",
          name: "a",
          role: "reviewer",
          files: ["db/**"],
          labels: [],
        },
      ]);
    });

    it("takes test reviewers, each an agent with or without files", () => {
      expect(
        plugins({
          test: {
            reviewers: [{ agent: "a" }, { agent: "b", files: ["e/**"] }],
          },
        }),
      ).toEqual([
        { kind: "agent", name: "a", role: "test-reviewer", ...none },
        {
          kind: "agent",
          name: "b",
          role: "test-reviewer",
          files: ["e/**"],
          labels: [],
        },
      ]);
    });

    it("takes resolvers, each a skill with its files", () => {
      expect(
        plugins({
          conflicts: { resolvers: [{ skill: "a", files: ["gen/**"] }] },
        }),
      ).toEqual([
        {
          kind: "skill",
          name: "a",
          role: "resolver",
          files: ["gen/**"],
          labels: [],
        },
      ]);
    });

    it.each([{}, null, { build: {} }, { refine: null, test: {} }])(
      "takes %j as no plugin of your own",
      (written) => {
        expect(plugins(written)).toEqual([]);
      },
    );

    it.each([
      [{ refine: { refiner: { agent: "a" } } }, "plugins.refine.refiner"],
      [{ refine: { mockups: { agent: "a" } } }, "plugins.refine.mockups"],
      [{ test: { prover: { agent: "a" } } }, "plugins.test.prover"],
      [
        { build: { builders: [{ agent: "a", labels: ["x"] }] } },
        "plugins.build.builders[0]",
      ],
      [
        {
          conflicts: {
            resolvers: [
              { skill: "a", files: ["x"] },
              { agent: "b", files: ["y"] },
            ],
          },
        },
        "plugins.conflicts.resolvers[1]",
      ],
    ])("fails on an agent where a skill goes: %j", (written, key) => {
      expect(() => plugins(written)).toThrow(
        `.claude/factory.yaml: ${key}: names a skill`,
      );
    });

    it.each([
      [
        { build: { reviewers: [{ skill: "a", files: ["x"] }] } },
        "plugins.build.reviewers[0]",
      ],
      [{ test: { reviewers: [{ skill: "a" }] } }, "plugins.test.reviewers[0]"],
    ])("fails on a skill where an agent goes: %j", (written, key) => {
      expect(() => plugins(written)).toThrow(
        `.claude/factory.yaml: ${key}: names an agent`,
      );
    });

    it.each([
      [
        { build: { builders: [{ skill: "a" }] } },
        "plugins.build.builders[0].labels",
      ],
      [
        { build: { builders: [{ skill: "a", labels: [] }] } },
        "plugins.build.builders[0].labels",
      ],
      [
        { build: { reviewers: [{ agent: "a" }] } },
        "plugins.build.reviewers[0].files",
      ],
      [
        { conflicts: { resolvers: [{ skill: "a" }] } },
        "plugins.conflicts.resolvers[0].files",
      ],
    ])("fails on %j, which leaves out what its role needs", (written, key) => {
      expect(() => plugins(written)).toThrow(
        `.claude/factory.yaml: ${key}: is required`,
      );
    });

    it.each([
      [
        { refine: { refiner: { skill: "a", files: ["x"] } } },
        "plugins.refine.refiner.files",
      ],
      [
        { refine: { refiner: { skill: "a", labels: ["x"] } } },
        "plugins.refine.refiner.labels",
      ],
      [
        { refine: { mockups: { skill: "a", files: ["x"] } } },
        "plugins.refine.mockups.files",
      ],
      [
        { test: { prover: { skill: "a", labels: ["x"] } } },
        "plugins.test.prover.labels",
      ],
      [
        { build: { builders: [{ skill: "a", labels: ["x"], files: ["y"] }] } },
        "plugins.build.builders[0].files",
      ],
      [
        { build: { reviewers: [{ agent: "a", files: ["x"], labels: ["y"] }] } },
        "plugins.build.reviewers[0].labels",
      ],
      [
        { test: { reviewers: [{ agent: "a", labels: ["y"] }] } },
        "plugins.test.reviewers[0].labels",
      ],
      [
        {
          conflicts: {
            resolvers: [{ skill: "a", files: ["x"], labels: ["y"] }],
          },
        },
        "plugins.conflicts.resolvers[0].labels",
      ],
    ])("fails on %j, naming the key its role does not take", (written, key) => {
      expect(() => plugins(written)).toThrow(`.claude/factory.yaml: ${key}:`);
    });

    it("fails on a plugin whose file does not exist, naming its role and the file", () => {
      const exists = (p: string) => p === ".claude/agents/here.md";
      const written = {
        build: {
          builders: [{ skill: "gone", labels: ["x"] }],
          reviewers: [{ agent: "here", files: ["src/**"] }],
        },
      };
      expect(() => plugins(written, exists)).toThrow(
        ".claude/factory.yaml: plugins.build.builders[0].skill: .claude/skills/gone/SKILL.md does not exist",
      );
      expect(() =>
        plugins({ test: { reviewers: [{ agent: "gone" }] } }, exists),
      ).toThrow(
        ".claude/factory.yaml: plugins.test.reviewers[0].agent: .claude/agents/gone.md does not exist",
      );
    });

    it("fails on a name that is not one", () => {
      expect(() =>
        plugins({ refine: { refiner: { skill: "../mine" } } }),
      ).toThrow("plugins.refine.refiner.skill: must be a name");
    });

    it("says whether the test reviewers are written, even as an empty list", () => {
      const written = (p: unknown) =>
        parse({ ...MINIMAL, plugins: p }).testReviewersWritten;
      expect(written({ test: { reviewers: [] } })).toBe(true);
      expect(written({ test: { prover: { skill: "a" } } })).toBe(false);
    });

    describe("the end-to-end reviewer", () => {
      const e2e = { test: { reviewers: [{ agent: "factory-e2e-reviewer" }] } };

      it("needs commands.end-to-end", () => {
        expect(() => parse({ ...MINIMAL, plugins: e2e })).toThrow(
          ".claude/factory.yaml: commands.end-to-end: is required to list factory-e2e-reviewer",
        );
      });

      it("is taken with it", () => {
        expect(
          parse({
            ...MINIMAL,
            commands: { "end-to-end": "make e2e" },
            plugins: e2e,
          }).plugins.map((p) => p.name),
        ).toEqual(["factory-e2e-reviewer"]);
      });

      it("is asked for its command before its file, which no sync writes without the command", () => {
        expect(() => parse({ ...MINIMAL, plugins: e2e }, () => false)).toThrow(
          "commands.end-to-end: is required to list factory-e2e-reviewer",
        );
      });
    });
  });
});

describe("pluginsOf", () => {
  const SKILL = ".claude/skills/factory-design/SKILL.md";
  const site = { start: "npm start", url: "http://localhost:$PORT" };
  const lines = (raw: object, exists: (p: string) => boolean = () => true) =>
    pluginsOf(parse({ ...MINIMAL, ...raw }), exists).map(
      (p) => `${p.kind} ${p.name} ${p.role}`,
    );

  it("gives the factory's refiner, prover, and test reviewer to a file that names none", () => {
    expect(lines({})).toEqual([
      "skill factory-refine refiner",
      "skill factory-mutate prover",
      "agent factory-test-reviewer test-reviewer",
    ]);
  });

  it("lists every plugin in the roles' order, yours in place of the factory's", () => {
    const plugins = {
      conflicts: { resolvers: [{ skill: "regen", files: ["gen/**"] }] },
      test: {
        reviewers: [{ agent: "ours" }],
        prover: { skill: "our-prover" },
      },
      build: {
        reviewers: [{ agent: "rev", files: ["src/**"] }],
        builders: [{ skill: "build", labels: ["x"] }],
      },
      refine: {
        mockups: { skill: "our-mockups" },
        refiner: { skill: "our-refiner" },
      },
    };
    expect(lines({ plugins, site })).toEqual([
      "skill our-refiner refiner",
      "skill our-mockups mockups",
      "skill build builder",
      "agent rev reviewer",
      "skill our-prover prover",
      "agent ours test-reviewer",
      "skill regen resolver",
    ]);
    expect(lines({ plugins, site }).map((l) => l.split(" ")[2])).toEqual([
      ...ROLES,
    ]);
  });

  it("adds the design skill as a site's mockups, once it is synced", () => {
    expect(lines({ site })).toContain("skill factory-design mockups");
    expect(lines({ site }, (p) => p !== SKILL)).not.toContain(
      "skill factory-design mockups",
    );
    expect(lines({})).not.toContain("skill factory-design mockups");
  });
});

describe("patternWarnings", () => {
  it("warns on a pattern that matches no file, and on nothing else", () => {
    const s = parse({
      ...MINIMAL,
      plugins: {
        build: {
          reviewers: [
            { agent: "a", files: ["src/**"] },
            { agent: "b", files: ["db/**"] },
          ],
        },
        test: { reviewers: [{ agent: "c", files: ["e2e/**", "src/**"] }] },
        conflicts: { resolvers: [{ skill: "d", files: ["gen/**"] }] },
      },
      "auto-merge": { allow: ["src/**", "docs/**"], deny: ["src/a.ts"] },
    });
    expect(patternWarnings(s, ["src/a.ts", "README.md"])).toEqual([
      "plugins.build.reviewers[1].files: db/** matches no file",
      "plugins.test.reviewers[0].files: e2e/** matches no file",
      "plugins.conflicts.resolvers[0].files: gen/** matches no file",
      "auto-merge.allow: docs/** matches no file",
    ]);
  });
});

function deps(over: Partial<Deps> = {}) {
  const out: string[] = [];
  /** Every line printed, in color. */
  const looks: string[] = [];
  const err: string[] = [];
  const d: Deps = {
    readFile: () =>
      [
        "version: 2",
        "repository: owner/name",
        CODE_HOST_YAML,
        "tickets:",
        "  board: 3",
        FACTORY_COLUMNS_YAML,
        "plugins:",
        "  refine:",
        "    mockups:",
        "      skill: mock",
        "  build:",
        "    builders:",
        "      - skill: build",
        "        labels: [new-thing]",
        "    reviewers:",
        "      - agent: rev",
        "        files: [src/**, public/**]",
        "commands:",
        "  before-commit:",
        "    - npm test",
        "    - npm run lint",
      ].join("\n"),
    exists: () => true,
    hasPackage: () => true,
    listFiles: () => ["src/a.ts", "public/x"],
    loadYaml: async () => load,
    out: into(out, looks),
    err: into(err),
    ...over,
  };
  return { d, out, err, looks };
}

describe("factory config explain", () => {
  const explain = async (file: string[]) => {
    const r = deps({ readFile: () => file.join("\n") });
    const code = await main(["explain"], r.d);
    return { code, out: r.out, err: r.err };
  };
  const SMALL = [
    "version: 2",
    "repository: owner/name",
    CODE_HOST_YAML,
    "tickets:",
    "  board: 3",
    "  columns:",
    "    backlog: Todo",
    "    refining: In refinement",
    "    ready: Ready",
    "    building: In progress",
    "    review: In review",
    "    done: Done",
    "specs: openspec",
    "commands:",
    "  before-commit:",
    "    - npm test",
    "pr-review:",
    "  commands: [npm test]",
    "rules:",
    "  review-rounds: 3",
  ];

  it("prints a state's list of columns as a list, and one name as a string", async () => {
    const r = await explain([
      "version: 2",
      "repository: owner/name",
      CODE_HOST_YAML,
      "tickets:",
      "  board: 3",
      "  columns:",
      "    backlog: Todo",
      "    refining: In refinement",
      "    ready: Ready",
      "    building: In progress",
      "    review: [Code review, QA]",
      "    done: Done",
    ]);
    expect(r.code).toBe(0);
    const at = r.out.findIndex((l) => l.trim() === "review:");
    expect(r.out.slice(at, at + 3).map((l) => l.trimEnd())).toEqual([
      "    review:",
      "      - Code review",
      "      - QA",
    ]);
    expect(r.out.map((l) => l.trimEnd())).toContain("    backlog: Todo");
  });

  it("prints a renamed label unmarked, in YAML the lock reads back", async () => {
    const r = await explain(
      SMALL.map((l) =>
        l === CODE_HOST_YAML
          ? `${l}\n  labels:\n    verdict-override: "owner: pass"`
          : l,
      ),
    );
    expect(r.code).toBe(0);
    const line = r.out.find((l) => l.includes("verdict-override:"))!;
    expect(line.trimEnd()).toBe('    verdict-override: "owner: pass"');
    const read = parse(load(r.out.join("\n")));
    expect(read.codeHost.labels["verdict-override"]).toBe("owner: pass");
  });

  it("prints every setting in the file's order, defaults filled in and their marks lined up", async () => {
    const r = await explain(SMALL);
    expect(r.code).toBe(0);
    expect(r.out.join("\n")).toMatchInlineSnapshot(`
      "# The settings in effect. "# default" marks the factory's own value,
      # a preset's name marks that preset's, and an unmarked line is yours.
      version: 2
      repository: owner/name
      tickets:
        type: github                                                               # default
        board: 3
        columns:
          backlog: Todo
          refining: In refinement
          ready: Ready
          building: In progress
          review: In review
          done: Done
        fields:
          session: Session                                                         # default
          runs-in: Runs in                                                         # default
          cost: Cost                                                               # default
          decisions: none                                                          # default
          spec: none                                                               # default
          acceptance-criteria: none                                                # default
          for-the-builder: none                                                    # default
          repositories: none                                                       # default
        labels:
          spec: spec                                                               # default
          follow-up: follow-up                                                     # default
          factory: factory                                                         # default
      code-host:
        type: github
        branch-name: "{ticket}"
        labels:
          merge-automatic: merge-automatic                                         # default
          merge-manual: merge-manual                                               # default
          verdict-override: verdict-override                                       # default
      builds:
        trigger: manual                                                            # default
        runner: github-actions                                                     # default
        # poll-minutes: only with trigger github-action
        max-per-hour: 20                                                           # default
        hosts: []                                                                  # default
      specs:
        type: openspec
        check: npx --no-install openspec validate --all --strict --no-interactive  # default
      commands:
        build-setup: []                                                            # default
        before-commit:
          - npm test
        gate: []                                                                   # default
        # test-one: none (default)
        # end-to-end: none (default)
        # coverage: none (default)
        relock: npm install                                                        # default
      plugins:
        refine:
          refiner:                                                                 # default
            skill: factory-refine                                                  # default
          # mockups: none (default)
        build:
          builders: []                                                             # default
          reviewers: []                                                            # default
        test:
          prover:                                                                  # default
            skill: factory-mutate                                                  # default
          reviewers:                                                               # default
            - agent: factory-test-reviewer                                         # default
        conflicts:
          resolvers: []                                                            # default
      auto-merge:
        allow: []                                                                  # default
        deny: []                                                                   # default
        commands: []                                                               # default
      pr-review:
        commands:
          - npm test
      # site: off
      session-minutes:
        build: 230                                                                 # default
        conflicts: 110                                                             # default
        review: 50                                                                 # default
        dependencies: 50                                                           # default
      rules:
        small-change-lines: 30                                                     # default
        review-rounds: 3"
    `);
  });

  it("marks as yours a value the file sets, even to its default", async () => {
    const r = await explain([
      "version: 2",
      "repository: owner/name",
      CODE_HOST_YAML,
      "session-minutes:",
      "  build: 230",
      "rules:",
      "  review-rounds: 2",
    ]);
    expect(r.out).toContain("  build: 230");
    expect(r.out).toContain("  review-rounds: 2");
    expect(r.out).toContainEqual(
      expect.stringMatching(/^ {2}conflicts: 110 +# default$/),
    );
    expect(r.out).toContainEqual(
      expect.stringMatching(/^ {2}small-change-lines: 30 +# default$/),
    );
  });

  it("marks as yours a part written as one word", async () => {
    const r = await explain([
      "version: 2",
      "repository: owner/name",
      CODE_HOST_YAML,
      "tickets: github",
    ]);
    expect(r.out).toContain("tickets:");
    expect(r.out).toContain("  type: github");
  });

  it("prints a part that is off, and a default that is no value, as a comment", async () => {
    const r = await explain([
      "version: 2",
      "repository: owner/name",
      CODE_HOST_YAML,
    ]);
    expect(r.out).toContain("# pr-review: off");
    expect(r.out).toContain("# site: off");
    expect(r.out).toContainEqual(
      expect.stringMatching(/^ {2}# board: none \(default\)$/),
    );
  });

  it("prints site's defaults that are no value as comments", async () => {
    const r = await explain([
      "version: 2",
      "repository: owner/name",
      CODE_HOST_YAML,
      "site:",
      "  start: npm start",
      "  url: http://localhost:$PORT",
    ]);
    expect(r.out).toContain("  # design-guide: none (default)");
    expect(r.out).toContain("  # pages: found by the factory (default)");
  });

  it("prints the ticket-side fields without a board, and no columns or board fields", async () => {
    const r = await explain([
      "version: 2",
      "repository: owner/name",
      CODE_HOST_YAML,
      "tickets:",
      "  fields:",
      "    spec: Acceptance criteria",
      "    proposed-docs: Docs draft",
    ]);
    const text = r.out.join("\n");
    expect(text).not.toMatch(/columns:|session:|runs-in:|cost:/);
    expect(text).toMatch(/^    decisions: none +# default$/m);
    expect(text).toMatch(/^    spec: Acceptance criteria$/m);
    expect(text).toMatch(/^    proposed-docs: Docs draft$/m);
  });

  const RICH = [
    "version: 2",
    "repository: owner/name",
    CODE_HOST_YAML,
    "specs:",
    "  type: openspec",
    "  check: make specs",
    "commands:",
    "  gate: [make check]",
    '  test-one: make test FILE=$FILE NAME="$NAME"',
    "  end-to-end: 'make e2e FILE=$FILE # one spec'",
    "  coverage:",
    "    run: make coverage",
    "    report: out/lcov.info",
    "plugins:",
    "  refine:",
    "    refiner:",
    "      skill: our-refiner",
    "  build:",
    "    builders:",
    "      - skill: build",
    "        labels: [new-thing]",
    "    reviewers:",
    "      - agent: rev",
    "        files: [src/**, 'db/*.sql']",
    "  test:",
    "    prover:",
    "      skill: our-prover",
    "    reviewers:",
    "      - agent: ours",
    "      - agent: factory-e2e-reviewer",
    "        files: [e2e/**]",
    "  conflicts:",
    "    resolvers:",
    "      - skill: regen",
    "        files: [gen/**]",
    "auto-merge:",
    "  allow: [docs/**, '**/*.md']",
    "site:",
    "  start: npm start -- --port $PORT",
    "  url: http://localhost:$PORT",
    "  hide: ['.clock', '#ads']",
    "  widths: [375, 1440]",
  ];

  it.each([
    ["a small file", SMALL],
    [
      "the shortest file",
      ["version: 2", "repository: owner/name", CODE_HOST_YAML],
    ],
    ["plugins, lists, and a site", RICH],
  ])("prints %s so it reads as the same settings", async (_, file) => {
    const r = await explain(file);
    // The settings in effect: the output writes out the factory's own
    // plugins, which the file leaves to their defaults.
    const inEffect = (text: string) => {
      const s = parse(load(text));
      return {
        ...s,
        plugins: pluginsOf(s, () => true),
        testReviewersWritten: true,
      };
    };
    expect(inEffect(r.out.join("\n"))).toEqual(inEffect(file.join("\n")));
  });

  describe("the commands", () => {
    it("prints the block, with a comment for each command that is not set", async () => {
      const r = await explain([
        "version: 2",
        "repository: owner/name",
        CODE_HOST_YAML,
      ]);
      const at = r.out.indexOf("commands:");
      expect(
        r.out
          .slice(at, at + 8)
          .map((l) => l.replace(/ +# default$/, " # default")),
      ).toEqual([
        "commands:",
        "  build-setup: [] # default",
        "  before-commit: [] # default",
        "  gate: [] # default",
        "  # test-one: none (default)",
        "  # end-to-end: none (default)",
        "  # coverage: none (default)",
        "  relock: npm install # default",
      ]);
    });

    it("prints each command the file sets, unmarked, and coverage as a block", async () => {
      const r = await explain(RICH);
      const at = r.out.indexOf("commands:");
      expect(
        r.out
          .slice(at, at + 11)
          .map((l) => l.replace(/ +# default$/, " # default")),
      ).toEqual([
        "commands:",
        "  build-setup: [] # default",
        "  before-commit: [] # default",
        "  gate:",
        "    - make check",
        '  test-one: make test FILE=$FILE NAME="$NAME"',
        '  end-to-end: "make e2e FILE=$FILE # one spec"',
        "  coverage:",
        "    run: make coverage",
        "    report: out/lcov.info",
        "  relock: npm install # default",
      ]);
    });
  });

  describe("the specs", () => {
    const after = (out: string[], line: string, count: number) =>
      out.slice(out.indexOf(line), out.indexOf(line) + count);

    it("prints a block with the type and the default check for OpenSpec written as one word", async () => {
      const r = await explain([
        "version: 2",
        "repository: owner/name",
        CODE_HOST_YAML,
        "specs: openspec",
      ]);
      expect(after(r.out, "specs:", 3)).toEqual([
        "specs:",
        "  type: openspec",
        "  check: npx --no-install openspec validate --all --strict --no-interactive  # default",
      ]);
    });

    it("prints the check the file sets, unmarked", async () => {
      const r = await explain(RICH);
      expect(after(r.out, "specs:", 3)).toEqual([
        "specs:",
        "  type: openspec",
        "  check: make specs",
      ]);
    });

    it("prints one word when there are no specs", async () => {
      const r = await explain([
        "version: 2",
        "repository: owner/name",
        CODE_HOST_YAML,
      ]);
      expect(r.out).toContainEqual(
        expect.stringMatching(/^specs: none +# default$/),
      );
      expect(r.out.join("\n")).not.toMatch(/^ {2}check:/m);
    });
  });

  describe("the plugins", () => {
    const plugins = (out: string[]) =>
      out
        .slice(out.indexOf("plugins:"), out.indexOf("auto-merge:"))
        .map((l) => l.replace(/ +# default$/, " # default"));

    it("prints them by phase, the factory's own marked as defaults and the empty lists written out", async () => {
      const r = await explain([
        "version: 2",
        "repository: owner/name",
        CODE_HOST_YAML,
      ]);
      expect(plugins(r.out)).toEqual([
        "plugins:",
        "  refine:",
        "    refiner: # default",
        "      skill: factory-refine # default",
        "    # mockups: none (default)",
        "  build:",
        "    builders: [] # default",
        "    reviewers: [] # default",
        "  test:",
        "    prover: # default",
        "      skill: factory-mutate # default",
        "    reviewers: # default",
        "      - agent: factory-test-reviewer # default",
        "  conflicts:",
        "    resolvers: [] # default",
      ]);
    });

    it("prints yours unmarked, each with its files or labels", async () => {
      const r = await explain(RICH);
      expect(plugins(r.out)).toEqual([
        "plugins:",
        "  refine:",
        "    refiner:",
        "      skill: our-refiner",
        "    mockups: # default",
        "      skill: factory-design # default",
        "  build:",
        "    builders:",
        "      - skill: build",
        "        labels:",
        "          - new-thing",
        "    reviewers:",
        "      - agent: rev",
        "        files:",
        "          - src/**",
        "          - db/*.sql",
        "  test:",
        "    prover:",
        "      skill: our-prover",
        "    reviewers:",
        "      - agent: ours",
        "      - agent: factory-e2e-reviewer",
        "        files:",
        "          - e2e/**",
        "  conflicts:",
        "    resolvers:",
        "      - skill: regen",
        "        files:",
        "          - gen/**",
      ]);
    });

    it("prints a site's design skill as its mockups only once it is synced", async () => {
      const file = [
        "version: 2",
        "repository: owner/name",
        CODE_HOST_YAML,
        "site:",
        "  start: npm start",
        "  url: http://localhost:$PORT",
      ];
      const r = deps({
        readFile: () => file.join("\n"),
        exists: (path) => path !== ".claude/skills/factory-design/SKILL.md",
      });
      await main(["explain"], r.d);
      expect(r.out).toContain("    # mockups: none (default)");
      expect((await explain(file)).out).toContainEqual(
        expect.stringMatching(/^ {6}skill: factory-design +# default$/),
      );
    });

    it("prints a list of test reviewers the file writes empty as yours", async () => {
      const r = await explain([
        "version: 2",
        "repository: owner/name",
        CODE_HOST_YAML,
        "plugins:",
        "  test:",
        "    reviewers: []",
      ]);
      expect(plugins(r.out)).toContain("    reviewers: []");
      expect(plugins(r.out)).not.toContain(
        "      - agent: factory-test-reviewer # default",
      );
    });
  });

  it("prints every key the settings take, so a new one cannot be left out", async () => {
    const r = await explain(
      RICH.concat([
        "tickets:",
        "  board: 3",
        FACTORY_COLUMNS_YAML,
        "pr-review:",
      ]),
    );
    const text = r.out.join("\n");
    // A key is printed under its block, two spaces deeper for each step of
    // the block's path, and a list's item starts with a dash.
    const printed = (block: string, key: string) => {
      const depth = block === "" ? 0 : block.split(".").length;
      const indent = block.endsWith("[]")
        ? `${" ".repeat(depth * 2)}(- |  )`
        : " ".repeat(depth * 2);
      return new RegExp(`^${indent}(# )?${key}:`, "m").test(text);
    };
    // `presets` and `off` say how the settings are made, not a setting in
    // effect.
    const missing = Object.entries(SETTINGS_KEYS).flatMap(([block, keys]) =>
      keys
        .filter((k) => !printed(block, k) && k !== "presets" && k !== "off")
        .map((k) => `${block}.${k}`),
    );
    expect(missing).toEqual([]);
  });

  it("fails as config check does on settings it cannot read", async () => {
    const r = await explain(["version: 3"]);
    expect(r.code).toBe(1);
    expect(r.err).toEqual([".claude/factory.yaml: version: must be 2"]);
    const missing = deps({
      loadYaml: () => Promise.reject(new Error("Cannot find package")),
    });
    expect(await main(["explain"], missing.d)).toBe(1);
    expect(missing.err).toEqual([NO_DEPENDENCIES]);
  });
});

describe("main", () => {
  it("prints a setting, a list one item per line", async () => {
    const { d, out } = deps();
    expect(await main(["repository"], d)).toBe(0);
    expect(await main(["tickets.board"], d)).toBe(0);
    expect(await main(["commands.before-commit"], d)).toBe(0);
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
      'code-host:\n  type: gitlab\n  branch-name: "{ticket}"',
      '.claude/factory.yaml: code-host.type "gitlab" is not supported. "github" is the only code host built.',
    ],
    [
      `${CODE_HOST_YAML}\nbuilds:\n  runner: buildkite`,
      '.claude/factory.yaml: builds.runner "buildkite" is not supported. "github-actions" is the only runner built.',
    ],
  ])("fails the check on %s", async (written, message) => {
    const { d, err } = deps({
      readFile: () => `version: 2\nrepository: a/b\n${written}\n`,
    });
    expect(await main(["check"], d)).toBe(1);
    expect(err).toEqual([message]);
  });

  it("says a value with an unquoted colon needs quotes", async () => {
    const { d, err } = deps({
      readFile: () =>
        `version: 2\nrepository: a/b\n${CODE_HOST_YAML}\n  labels:\n    verdict-override: owner: pass\n`,
    });
    expect(await main(["check"], d)).toBe(1);
    expect(err).toEqual([
      '.claude/factory.yaml: line 7: verdict-override: owner: pass needs quotes around the name, such as verdict-override: "owner: pass"',
    ]);
  });

  it("reports any other YAML fault as js-yaml words it", async () => {
    const { d, err } = deps({
      readFile: () => `version: 2\nrepository: [a/b\n`,
    });
    expect(await main(["check"], d)).toBe(1);
    expect(err[0]).toMatch(
      /^\.claude\/factory\.yaml: deficient indentation \(3:1\)/,
    );
  });

  describe("config get, for the commands and the spec check", () => {
    const BARE = `version: 2\nrepository: a/b\n${CODE_HOST_YAML}\n`;
    const get = async (file: string, key: string) => {
      const r = deps({ readFile: () => file });
      const code = await main([key], r.d);
      return { code, out: r.out, err: r.err };
    };
    const FULL = [
      "version: 2",
      "repository: a/b",
      CODE_HOST_YAML,
      "specs:",
      "  type: openspec",
      "  check: make specs",
      "commands:",
      "  build-setup: [make tools, make data]",
      "  before-commit: [make lint]",
      "  gate: [make check, make e2e]",
      "  test-one: make test FILE=$FILE",
      "  end-to-end: make e2e FILE=$FILE",
      "  relock: make lock",
      "  coverage:",
      "    run: make coverage",
      "    report: out/lcov.info",
    ].join("\n");

    it.each([
      ["commands.build-setup", ["make tools", "make data"]],
      ["commands.before-commit", ["make lint"]],
      ["commands.gate", ["make check", "make e2e"]],
      ["commands.test-one", ["make test FILE=$FILE"]],
      ["commands.end-to-end", ["make e2e FILE=$FILE"]],
      ["commands.relock", ["make lock"]],
      ["commands.coverage.run", ["make coverage"]],
      ["commands.coverage.report", ["out/lcov.info"]],
    ])("prints %s as written, a list one item per line", async (key, lines) => {
      expect(await get(FULL, key)).toEqual({ code: 0, out: lines, err: [] });
    });

    it.each([
      "commands.build-setup",
      "commands.before-commit",
      "commands.gate",
    ])("prints nothing for %s when it is an empty list", async (key) => {
      expect(await get(BARE, key)).toEqual({ code: 0, out: [], err: [] });
    });

    it.each([
      "commands.test-one",
      "commands.end-to-end",
      "commands.coverage.run",
      "commands.coverage.report",
    ])("prints none for %s when it is not set", async (key) => {
      expect(await get(BARE, key)).toEqual({ code: 0, out: ["none"], err: [] });
    });

    it("prints builds.hosts one host per line, and nothing when it is not set", async () => {
      const key = "builds.hosts";
      const written =
        "builds:\n  hosts: [repo.packagist.org, '*.example.org']\n";
      expect(await get(`${BARE}${written}`, key)).toEqual({
        code: 0,
        out: ["repo.packagist.org", "*.example.org"],
        err: [],
      });
      expect(await get(BARE, key)).toEqual({ code: 0, out: [], err: [] });
    });

    it("prints whether the automated review is on, for pr-review", async () => {
      expect(await get(BARE, "pr-review")).toEqual({
        code: 0,
        out: ["off"],
        err: [],
      });
      expect(await get(`${BARE}pr-review:\n`, "pr-review")).toEqual({
        code: 0,
        out: ["on"],
        err: [],
      });
    });

    it("prints npm install for commands.relock when it is not set", async () => {
      expect((await get(BARE, "commands.relock")).out).toEqual(["npm install"]);
    });

    it.each([
      [BARE, "commands.coverage"],
      [FULL, "commands.coverage"],
      [FULL, "commands"],
      [FULL, "before-commit"],
      [FULL, "build-setup"],
      [BARE, "commands.coverage.lines"],
    ])("fails on a block, or a key that is not one: %#", async (file, key) => {
      expect(await get(file, key)).toEqual({
        code: 1,
        out: [],
        err: [`.claude/factory.yaml: ${key}: not a setting that prints`],
      });
    });

    it.each([
      ["specs: openspec", "openspec"],
      ["specs:\n  type: openspec", "openspec"],
      ["specs:\n  type: openspec\n  check: make specs", "openspec"],
      ["specs: none", "none"],
      ["specs:\n  type: none", "none"],
      ["", "none"],
    ])("prints specs as one word for %j", async (written, word) => {
      expect((await get(`${BARE}${written}\n`, "specs")).out).toEqual([word]);
    });

    it.each([
      ["specs:\n  type: openspec\n  check: make specs", "make specs"],
      [
        "specs: openspec",
        "npx --no-install openspec validate --all --strict --no-interactive",
      ],
      ["specs: none", "none"],
      ["", "none"],
    ])("prints the spec check for %j", async (written, check) => {
      expect(await get(`${BARE}${written}\n`, "specs.check")).toEqual({
        code: 0,
        out: [check],
        err: [],
      });
    });
  });

  it("fails the check, naming the key, when a command list is not a list of text", async () => {
    const { d, err } = deps({
      readFile: () =>
        `version: 2\nrepository: a/b\n${CODE_HOST_YAML}\ncommands:\n  build-setup: make tools\n`,
    });
    expect(await main(["check"], d)).toBe(1);
    expect(err).toEqual([
      ".claude/factory.yaml: commands.build-setup: must be a list",
    ]);
  });

  describe("factory plugins", () => {
    const BARE = `version: 2\nrepository: owner/name\n${CODE_HOST_YAML}\n`;
    const run = async (argv: string[], file?: string) => {
      const r = deps(file === undefined ? {} : { readFile: () => file });
      const code = await main(["plugins", ...argv], r.d);
      return { code, out: r.out, err: r.err };
    };

    it("prints each plugin the factory will use: its kind, name, and role, then its files or labels", async () => {
      expect((await run([])).out).toEqual([
        "skill factory-refine refiner",
        "skill mock mockups",
        "skill build builder new-thing",
        "agent rev reviewer src/** public/**",
        "skill factory-mutate prover",
        "agent factory-test-reviewer test-reviewer",
      ]);
    });

    it.each([
      ["reviewer", ["agent rev reviewer src/** public/**"]],
      ["builder", ["skill build builder new-thing"]],
      ["mockups", ["skill mock mockups"]],
      ["resolver", []],
    ])("prints only the lines of the role %s", async (role, lines) => {
      expect(await run([role])).toEqual({ code: 0, out: lines, err: [] });
    });

    it.each(["tester", "reviewers", "refine"])(
      "fails on %s, a word that is no role, naming the seven",
      async (word) => {
        expect(await run([word])).toEqual({
          code: 1,
          out: [],
          err: [
            `${word}: must be one of refiner, mockups, builder, reviewer, prover, test-reviewer, resolver`,
          ],
        });
      },
    );

    it("prints the factory's refiner when the settings name none", async () => {
      expect((await run(["refiner"], BARE)).out).toEqual([
        "skill factory-refine refiner",
      ]);
    });

    it("prints your refiner in its place", async () => {
      const file = `${BARE}plugins:\n  refine:\n    refiner:\n      skill: ours\n`;
      expect((await run(["refiner"], file)).out).toEqual([
        "skill ours refiner",
      ]);
    });

    it("prints the factory's prover when the settings name none", async () => {
      expect((await run(["prover"], BARE)).out).toEqual([
        "skill factory-mutate prover",
      ]);
    });

    it("prints your prover in its place", async () => {
      const file = `${BARE}plugins:\n  test:\n    prover:\n      skill: ours\n`;
      expect((await run(["prover"], file)).out).toEqual(["skill ours prover"]);
    });

    it("prints the factory's test reviewer when the list is not written", async () => {
      expect((await run(["test-reviewer"], BARE)).out).toEqual([
        "agent factory-test-reviewer test-reviewer",
      ]);
    });

    it("prints exactly the test reviewers a written list names, with their files", async () => {
      const file = `${BARE}plugins:\n  test:\n    reviewers:\n      - agent: ours\n      - agent: theirs\n        files: [e2e/**]\n`;
      expect((await run(["test-reviewer"], file)).out).toEqual([
        "agent ours test-reviewer",
        "agent theirs test-reviewer e2e/**",
      ]);
    });

    it("prints the factory's test reviewer when a written list names it", async () => {
      const file = `${BARE}plugins:\n  test:\n    reviewers:\n      - agent: factory-test-reviewer\n      - agent: ours\n`;
      expect((await run(["test-reviewer"], file)).out).toEqual([
        "agent factory-test-reviewer test-reviewer",
        "agent ours test-reviewer",
      ]);
    });

    it("prints no test reviewer for a list written empty", async () => {
      const file = `${BARE}plugins:\n  test:\n    reviewers: []\n`;
      expect(await run(["test-reviewer"], file)).toEqual({
        code: 0,
        out: [],
        err: [],
      });
    });
  });

  describe("the design skill as a website's mockups plugin", () => {
    const SKILL = ".claude/skills/factory-design/SKILL.md";
    const WARNING = `warning: ${SKILL} is missing: run \`factory sync\` to give the site its design skill`;
    const settings = (plugins: string[]) =>
      [
        "version: 2",
        "repository: owner/name",
        CODE_HOST_YAML,
        "site:",
        "  start: npm start",
        "  url: http://localhost:$PORT",
        ...plugins,
      ].join("\n");
    const OWN = ["plugins:", "  refine:", "    mockups:", "      skill: mine"];
    const synced = () => true;
    const unsynced = (path: string) => path !== SKILL;

    it("is listed by its role for a site that lists none, once it is synced", async () => {
      const { d, out } = deps({
        readFile: () => settings([]),
        exists: synced,
      });

      await main(["plugins", "mockups"], d);
      expect(out).toEqual(["skill factory-design mockups"]);
    });

    it("is listed among every plugin, after the refiner", async () => {
      const { d, out } = deps({
        readFile: () => settings([]),
        exists: synced,
      });

      await main(["plugins"], d);
      expect(out.slice(0, 2)).toEqual([
        "skill factory-refine refiner",
        "skill factory-design mockups",
      ]);
    });

    it("gives way to a mockups plugin the settings list", async () => {
      const { d, out } = deps({
        readFile: () => settings(OWN),
        exists: synced,
      });

      await main(["plugins", "mockups"], d);
      expect(out).toEqual(["skill mine mockups"]);
    });

    it("is no plugin where there is no site", async () => {
      const { d, out } = deps({
        readFile: () =>
          `version: 2\nrepository: owner/name\n${CODE_HOST_YAML}\n`,
        exists: synced,
      });

      await main(["plugins", "mockups"], d);
      expect(out).toEqual([]);
    });

    it("is no plugin before it is synced", async () => {
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

  it("says a sound file is valid", async () => {
    const { d, out, err } = deps();
    expect(await main(["check"], d)).toBe(0);
    expect(out).toEqual(["✓ The settings are valid."]);
    expect(err).toEqual([]);
  });

  it("warns without failing when a pattern matches nothing", async () => {
    const { d, out, err } = deps({ listFiles: () => ["src/a.ts"] });
    expect(await main(["check"], d)).toBe(0);
    expect(err).toEqual([
      "warning: plugins.build.reviewers[0].files: public/** matches no file",
    ]);
    expect(out).toEqual(["✓ The settings are valid."]);
  });

  it("fails, naming the key, on an unsound file", async () => {
    const { d, err } = deps({ readFile: () => "version: 3\nrepository: a/b" });
    expect(await main(["check"], d)).toBe(1);
    expect(err.join("\n")).toContain("version:");
  });

  it("accepts version 2", async () => {
    const { d, err } = deps({
      readFile: () => `version: 2\nrepository: a/b\n${CODE_HOST_YAML}`,
    });
    expect(await main(["check"], d)).toBe(0);
    expect(err).toEqual([]);
  });

  it("fails the check on a version 1 file, with the page that says how to move it", async () => {
    const { d, err } = deps({ readFile: () => "version: 1\nrepository: a/b" });
    expect(await main(["check"], d)).toBe(1);
    expect(err).toEqual([
      '.claude/factory.yaml: version: must be 2: this file is version 1, see "Moving to settings version 2" in docs/updating.md',
    ]);
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
    `version: 2\nrepository: a/b\n${CODE_HOST_YAML}\nsite: ${JSON.stringify({ ...site, ...extra })}\n`;

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
      {
        plugins: {
          build: {
            reviewers: [{ agent: "factory-ui-reviewer", files: ["src/**"] }],
          },
        },
      },
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

describe("factory config explain, in color", () => {
  const dim = (t: string) => `{skip:${t}}`;
  const at = (text: string, mark: string) => `${text.padEnd(26)}# ${mark}`;

  it("dims a default's whole line and a comment line, and only a preset's mark", () => {
    const lines = [
      "version: 2",
      "tickets:",
      "  columns:",
      at("    backlog: Todo", "default"),
      "    building: Doing",
      "  # coverage: none (default)",
      "rules:",
      at("  review-rounds: 3", "@acme/factory-preset/node"),
    ];
    expect(explainedLines(lines).map(look)).toEqual([
      "version: 2",
      "tickets:",
      "  columns:",
      dim(at("    backlog: Todo", "default")),
      "    building: Doing",
      dim("  # coverage: none (default)"),
      "rules:",
      `${"  review-rounds: 3".padEnd(26)}${dim("# @acme/factory-preset/node")}`,
    ]);
  });

  it("leaves a list's item and an address in the settings as they are", () => {
    const lines = ["  gate:", "    - npm test", "  url: https://a.example"];
    expect(explainedLines(lines).map(look)).toEqual(lines);
    expect(explainedLines(["- npm test"]).map(look)).toEqual(["- npm test"]);
  });

  it("leaves a quoted value holding a comment's spacing alone", () => {
    const lines = [
      at("  board: 3", "default"),
      at("  poll-minutes: 5", "default"),
      '  gate: "npm run x  # note"',
    ];
    expect(explainedLines(lines).map(look)[2]).toBe(
      '  gate: "npm run x  # note"',
    );
  });

  it("finds the marks where comment lines outnumber them", () => {
    const lines = [
      "commands:",
      "  # test-one: none (default)",
      "  # end-to-end: none (default)",
      "  # coverage: none (default)",
      at("  gate: npm test", "default"),
    ];
    expect(explainedLines(lines).map(look)[4]).toBe(
      dim(at("  gate: npm test", "default")),
    );
  });

  it("prints its lines with their looks", async () => {
    const r = deps({
      readFile: () => `version: 2\nrepository: owner/name\n${CODE_HOST_YAML}\n`,
    });
    expect(await main(["explain"], r.d)).toBe(0);
    expect(r.looks).toContainEqual(
      expect.stringMatching(/^\{skip: {2}type: github +# default\}$/),
    );
    expect(r.looks.slice(0, 3)).toEqual([
      dim(
        '# The settings in effect. "# default" marks the factory\'s own value,',
      ),
      dim(
        "# a preset's name marks that preset's, and an unmarked line is yours.",
      ),
      "version: 2",
    ]);
  });
});
