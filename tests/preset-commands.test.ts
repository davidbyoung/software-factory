// The `factory preset` commands, run against a repository that follows
// presets, the presets' repositories as local git repositories, and the
// real sync.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load } from "js-yaml";
import { afterEach, describe, expect, it, vi } from "vitest";
import { painter } from "../src/lib/color.mts";
import {
  defaultDeps,
  filesDeps,
  resolveFiles,
  staleOf,
} from "../src/config.mts";
import { fileHash, parseName, pinsOf } from "../src/preset.mts";
import { cachedCommit, runGit, type Git } from "../src/preset-fetch.mts";
import {
  dayOf,
  main,
  presetChecks,
  type PresetDeps,
} from "../src/preset-commands.mts";
import { main as syncMain, PACKAGE } from "../src/sync.mts";
import { POLLER_FILE, pollerWorkflow } from "../src/workflow-files.mts";
import {
  ACME,
  CACHE,
  fetching,
  HOST,
  NODE,
  NODE_SETTINGS,
  own,
  pin,
  publish,
  put,
  read,
  remoteOf,
  repo,
  type PresetFiles,
} from "./preset-fixture.ts";

let root = "";
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

/** The docs' organization preset: it does not set review-rounds. */
const ACME_BASE = [
  "version: 2",
  "rules:",
  "  small-change-lines: 40",
  "plugins:",
  "  build:",
  "    reviewers:",
  "      - agent: acme-security-reviewer",
  "        files: [src/**]",
  "",
].join("\n");

const REPO = "acme/factory-config";
const BAR = "foo/presets//bar";
const LOCK = ".claude/factory.lock";
const DEPS = ".claude/agents/node-deps-reviewer.md";

const REPOS: Record<string, Record<string, PresetFiles>> = {
  [REPO]: {
    "": {
      settings: ACME_BASE,
      agents: { "acme-security-reviewer": "security\n" },
    },
    node: {
      settings: NODE_SETTINGS,
      agents: { "node-deps-reviewer": "deps\n" },
    },
  },
  "acme/web": {
    "": { settings: "version: 2\nrules:\n  review-rounds: 4\n" },
  },
  "acme/empty": { other: { settings: "version: 2\n" } },
  "foo/presets": {
    bar: {
      settings: [
        "version: 2",
        "rules:",
        "  review-rounds: 3",
        "plugins:",
        "  build:",
        "    reviewers:",
        "      - agent: bar-reviewer",
        "        files: [src/**]",
        "pr-review:",
        "  commands: [npm audit]",
        "",
      ].join("\n"),
      agents: { "bar-reviewer": "bar\n" },
    },
  },
};

type Run = {
  code: number;
  out: string[];
  err: string[];
  asked: string[];
  /** Each call to git for a preset's repository. */
  git: string[][];
};

/** The newest commit of each repository this test committed to. */
let commits: Record<string, string> = {};
const short = (repository = REPO) => commits[repository]!.slice(0, 7);

/** A repository already following `presets`, each pinned at its
 * repository's newest commit and synced, with `.claude/factory.yaml` also
 * holding `body`. `also` are further repositories that exist. */
async function setUp(
  presets: string[],
  body: string[] = [],
  also: string[] = [],
) {
  root = repo(own(presets, body));
  commits = {};
  for (const name of [REPO, ...also])
    commits[name] = publish(name, REPOS[name]!);
  for (const name of presets) pin(root, name, commits[parseName(name).repo]!);
  await sync();
}

async function sync(out: (l: string) => void = () => {}) {
  return syncMain([], {
    root,
    pkg: PACKAGE,
    settings: () => resolveFiles(filesDeps(root, {})),
    stale: () => staleOf(defaultDeps(root, {})),
    defaultBranch: async () => "main",
    out,
    err: () => {},
    fetch: (s) => fetching(s.repository),
  });
}

/** One preset command, answering its questions with `answers` in turn. */
async function preset(
  argv: string[],
  answers: string[] = [],
  over: Partial<PresetDeps> = {},
): Promise<Run> {
  const r: Run = { code: 0, out: [], err: [], asked: [], git: [] };
  const fs = filesDeps(root, {});
  const git: Git = (args, o) => {
    r.git.push(args);
    return runGit(args, o);
  };
  const d: PresetDeps = {
    root,
    cwd: root,
    out: (l) => r.out.push(l),
    err: (l) => r.err.push(l),
    terminal: true,
    ask: async (q) => {
      r.asked.push(q);
      const a = answers.shift();
      if (a === undefined) throw new Error(`no answer for: ${q}`);
      r.out.push(`${q}${a}`);
      return a;
    },
    sync: (out) => sync(out),
    show: () => null,
    resolve: (ownText, choices, lock) =>
      resolveFiles({
        ...fs,
        readFile: () => ownText,
        readChoices: () => choices,
        ...(lock === undefined ? {} : { readLock: () => lock }),
      }),
    write: (path, text) =>
      text === null
        ? rmSync(join(root, path), { force: true })
        : put(root, path, text),
    read: (path) => read(root, path),
    fetch: (repository) => ({ ...fetching(repository), git }),
    now: () => new Date("2026-11-23T12:00:00Z"),
    ...over,
  };
  r.code = await main(argv, d);
  return r;
}

/** Everything a preset command may change in the repository. */
const state = () =>
  [".claude/factory.yaml", LOCK, ".claude/factory.choices.yaml", DEPS].map(
    (path) => read(root, path),
  );

const addSummary = () => [
  `${NODE} at ${short()}, from November 20, would change these settings here:`,
  "",
  "  added",
  "    plugins.build.reviewers    + node-deps-reviewer",
  "    pr-review.commands         + npm audit",
  "  replaces the default",
  "    rules.review-rounds        2 → 3",
  `  disagrees with ${ACME}`,
  `    rules.small-change-lines   ${ACME}: 40   this preset: 30`,
  "  replaced by your .claude/factory.yaml",
  "    commands.gate              yours: npm run check   this preset's: npm test",
  "",
  "  writes .claude/agents/node-deps-reviewer.md",
  "  runs   npm audit, in the review",
];

const GATE = ["commands:", "  gate: [npm run check]"];

describe("factory preset add", () => {
  it("shows the summary, asks where presets disagree and about your own value, and applies on y", async () => {
    await setUp([ACME], GATE);
    const r = await preset(["add", NODE], ["30", "keep", "y"]);
    expect(r.out).toEqual([
      ...addSummary(),
      "",
      "Choose:",
      `  rules.small-change-lines: 30 from this preset, or 40 from ${ACME}? [30/40] 30`,
      "  commands.gate: keep yours, or drop it and use this preset's? [keep/drop] keep",
      "",
      "Apply? [y/N] y",
      `✓ Added ${NODE} to .claude/factory.yaml, pinned at ${short()} in .claude/factory.lock.`,
      "✓ Wrote .claude/factory.choices.yaml.",
      "✓ Wrote .claude/agents/node-deps-reviewer.md.",
    ]);
    expect(r.code).toBe(0);
    expect(read(root, ".claude/factory.yaml")).toBe(own([ACME, NODE], GATE));
    expect(read(root, ".claude/factory.choices.yaml")).toContain(
      `rules.small-change-lines: ${NODE}`,
    );
    expect(read(root, DEPS)).toBe("deps\n");
  });

  it("pins the newest commit of the repository's default branch, downloaded into the cache, with the preset's settings and hashes", async () => {
    await setUp([ACME]);
    const newest = publish(REPO, {
      ...REPOS[REPO],
      node: {
        settings: "version: 2\nrules:\n  review-rounds: 5\n",
        agents: { "node-deps-reviewer": `${Math.random()}\n` },
      },
    });
    expect(cachedCommit(fetching(), REPO, newest)).toBeNull();
    const r = await preset(["add", NODE], ["y"]);
    expect(r.code).toBe(0);
    expect(r.git.map((args) => args[0])).toEqual([
      "ls-remote",
      "init",
      "fetch",
      "checkout",
      "cat-file",
    ]);
    expect(cachedCommit(fetching(), REPO, newest)).toBe(
      join(CACHE, "presets", HOST, REPO, newest),
    );
    const pins = pinsOf(read(root, LOCK), load);
    expect(pins[0]).toMatchObject({ name: ACME, commit: commits[REPO] });
    expect(pins[1]).toEqual({
      name: NODE,
      commit: newest,
      poller: false,
      settings: { rules: { "review-rounds": 5 } },
      files: { [DEPS]: fileHash(read(root, DEPS)!) },
    });
  });

  it("adds the name to presets as YAML writes it plain, after repository when it is the first", async () => {
    await setUp([]);
    await preset(["add", ACME], ["y"]);
    expect(read(root, ".claude/factory.yaml")).toBe(
      own([]).replace(
        "repository: acme/billing\n",
        `repository: acme/billing\npresets:\n  - ${ACME}\n`,
      ),
    );
  });

  it("records the earlier preset when its value is the answer", async () => {
    await setUp([ACME], GATE);
    await preset(["add", NODE], ["40", "keep", "y"]);
    expect(read(root, ".claude/factory.choices.yaml")).toContain(
      `rules.small-change-lines: ${ACME}`,
    );
  });

  it("deletes your own value on drop", async () => {
    await setUp([ACME], GATE);
    await preset(["add", NODE], ["30", "drop", "y"]);
    expect(read(root, ".claude/factory.yaml")).not.toContain("gate");
  });

  it("asks again on an empty or unrecognized answer", async () => {
    await setUp([ACME], GATE);
    const r = await preset(
      ["add", NODE],
      ["", "35", "30", "maybe", "keep", "y"],
    );
    expect(
      r.asked.filter((q) => q.includes("small-change-lines")),
    ).toHaveLength(3);
    expect(r.asked.filter((q) => q.includes("commands.gate"))).toHaveLength(2);
  });

  it("changes nothing on any answer to Apply but y", async () => {
    await setUp([ACME], [], ["acme/web"]);
    const before = state();
    const r = await preset(["add", "acme/web"], ["yes"]);
    expect(r.code).toBe(0);
    expect(r.out.at(-1)).toBe("Nothing changed.");
    expect(state()).toEqual(before);
  });

  it("prints the summary and stops outside a terminal without --yes", async () => {
    await setUp([ACME], GATE);
    const before = state();
    const r = await preset(["add", NODE], [], { terminal: false });
    expect(r.code).toBe(1);
    expect(r.out).toEqual([
      ...addSummary(),
      "",
      "Run it in a terminal to choose, or add --yes to apply it.",
    ]);
    expect(state()).toEqual(before);
  });

  it("applies with --yes, asking nothing and recording no choice", async () => {
    await setUp([ACME], GATE);
    const r = await preset(["add", NODE, "--yes"], [], { terminal: false });
    expect(r.code).toBe(0);
    expect(r.asked).toEqual([]);
    expect(r.out.slice(-2)).toEqual([
      `✓ Added ${NODE} to .claude/factory.yaml, pinned at ${short()} in .claude/factory.lock.`,
      "✓ Wrote .claude/agents/node-deps-reviewer.md.",
    ]);
    expect(read(root, ".claude/factory.choices.yaml")).toBeNull();
    expect(read(root, LOCK)).toMatch(
      /small-change-lines: 30 +# acme\/factory-config\/\/node, not chosen yet/,
    );
    expect(read(root, ".claude/factory.yaml")).toMatch(
      /gate: \[ ?npm run check ?\]/,
    );
  });

  it("prints the summary and changes nothing with --dry-run", async () => {
    await setUp([ACME], GATE);
    const before = state();
    const r = await preset(["add", NODE, "--dry-run"]);
    expect(r.code).toBe(0);
    expect(r.out).toEqual(addSummary());
    expect(state()).toEqual(before);
  });

  it("colors the summary when it paints, even outside a terminal", async () => {
    await setUp([ACME], GATE);
    const paint = painter(true);
    const r = await preset(["add", NODE, "--dry-run"], [], {
      terminal: false,
      paint,
    });
    expect(r.out).toEqual([
      `${NODE} at ${short()}, from November 20, would change these settings here:`,
      "",
      `  ${paint("bold", "added")}`,
      `    plugins.build.reviewers    ${paint("green", "+ node-deps-reviewer")}`,
      `    pr-review.commands         ${paint("green", "+ npm audit")}`,
      `  ${paint("bold", "replaces the default")}`,
      `    rules.review-rounds        ${paint("dim", "2")} → ${paint("bold", "3")}`,
      `  ${paint("bold", `disagrees with ${ACME}`)}`,
      `    rules.small-change-lines   ${ACME}: 40   this preset: 30`,
      `  ${paint("bold", "replaced by your .claude/factory.yaml")}`,
      "    commands.gate              yours: npm run check   this preset's: npm test",
      "",
      "  writes .claude/agents/node-deps-reviewer.md",
      "  runs   npm audit, in the review",
    ]);
  });

  it("writes the lock without color, even where FORCE_COLOR asks for it", async () => {
    vi.stubEnv("FORCE_COLOR", "1");
    await setUp([ACME, NODE]);
    expect(read(root, LOCK)).toContain("# default");
    expect(read(root, LOCK)).not.toContain("\x1B");
  });

  it("says to run factory init when there are no settings", async () => {
    await setUp([ACME]);
    rmSync(join(root, ".claude/factory.yaml"));

    const r = await preset(["add", NODE]);

    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      ".claude/factory.yaml is missing. Run: factory init",
    ]);
  });

  it("refuses a preset already listed", async () => {
    await setUp([ACME]);
    const r = await preset(["add", ACME]);
    expect(r.code).toBe(1);
    expect(r.err).toEqual([`${ACME} is already in presets`]);
  });

  it.each([
    [
      "@acme/factory-preset",
      '✗ presets: "@acme/factory-preset" is an npm package, and a preset now comes from a repository. Name the repository, such as acme/factory-config.',
    ],
    [
      "factory-config",
      '✗ presets: "factory-config" is not a preset\'s name. Write its repository, as OWNER/NAME or OWNER/NAME//FOLDER',
    ],
  ])("refuses the name %s, reading nothing", async (name, message) => {
    await setUp([ACME]);
    const before = state();
    const r = await preset(["add", name]);
    expect(r).toMatchObject({ code: 1, err: [message], out: [], git: [] });
    expect(state()).toEqual(before);
  });

  it.each([
    ["acme/empty", "acme/empty: no factory-preset.yaml in acme/empty"],
    [
      "acme/empty//node",
      "acme/empty//node: no node/factory-preset.yaml in acme/empty",
    ],
  ])(
    "refuses %s, whose repository has no preset file there",
    async (name, message) => {
      await setUp([ACME], [], ["acme/empty"]);
      const before = state();
      const r = await preset(["add", name]);
      expect(r).toMatchObject({ code: 1, err: [message], out: [] });
      expect(state()).toEqual(before);
    },
  );

  it("says git's last line when a repository of the same owner cannot be read", async () => {
    await setUp([ACME]);
    const before = state();
    const r = await preset(["add", "acme/missing"]);
    expect(r).toMatchObject({
      code: 1,
      err: [
        "acme/missing: acme/missing could not be read: fatal: Could not read from remote repository.",
      ],
      out: [],
    });
    expect(state()).toEqual(before);
  });

  it("stops on a preset whose file a preset can't be, naming the key", async () => {
    await setUp([ACME]);
    publish("acme/newer", {
      "": { settings: "version: 2\nrules:\n  from-a-newer-factory: 1\n" },
    });
    const r = await preset(["add", "acme/newer"]);
    expect(r).toMatchObject({
      code: 1,
      err: ["acme/newer: rules.from-a-newer-factory: unknown key"],
    });
  });
});

describe("the heading of factory preset add's summary", () => {
  it.each([
    ["2026-11-20T12:00:00Z", "November 20"],
    ["2025-11-20T12:00:00Z", "November 20, 2025"],
    ["2026-11-20T23:30:00-05:00", "November 21"],
    ["2026-01-01T00:30:00+02:00", "December 31, 2025"],
  ])(
    "names the commit and its committer date in UTC: %s is %s",
    async (date, day) => {
      await setUp([]);
      const commit = publish("acme/web", REPOS["acme/web"]!, date);
      const r = await preset(["add", "acme/web", "--dry-run"]);
      expect(r.out[0]).toBe(
        `acme/web at ${commit.slice(0, 7)}, from ${day}, would change these settings here:`,
      );
    },
  );

  it("leaves the year out only for a commit of this year, in UTC", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(dayOf(new Date("2026-01-01T00:00:00Z"), now)).toBe("January 1");
    expect(dayOf(new Date("2025-12-31T23:59:59Z"), now)).toBe(
      "December 31, 2025",
    );
  });
});

describe("the runs lines of factory preset add's summary", () => {
  const COMMANDS = [
    "version: 2",
    "commands:",
    "  build-setup: [npm ci]",
    "  before-commit: [npm run format]",
    "  gate: [npm run check, npm run lint]",
    "  test-one: npx vitest run {path}",
    "pr-review:",
    "  commands: [npm test, npm audit]",
    "",
  ].join("\n");
  const add = async (body: string[] = []) => {
    await setUp([], body);
    publish("acme/commands", { "": { settings: COMMANDS } });
    const r = await preset(["add", "acme/commands", "--dry-run"]);
    return r.out.filter((l) => l.trimStart().startsWith("runs"));
  };

  it("say each command the preset has the factory run, and when", async () => {
    expect(await add()).toEqual([
      "  runs   npm test, in the review",
      "  runs   npm audit, in the review",
      "  runs   npm run check, at the gate",
      "  runs   npm run lint, at the gate",
      "  runs   npm run format, before each commit",
      "  runs   npm ci, at the start of a cloud build",
      "  runs   npx vitest run {path}, as commands.test-one",
    ]);
  });

  it("leave out a command the repository's own settings replace", async () => {
    expect(
      await add([
        "commands:",
        "  gate: [make check]",
        "  test-one: make test-one",
      ]),
    ).toEqual([
      "  runs   npm test, in the review",
      "  runs   npm audit, in the review",
      "  runs   npm run format, before each commit",
      "  runs   npm ci, at the start of a cloud build",
    ]);
  });

  it("come after the writes lines, each aligned with them", async () => {
    await setUp([ACME], GATE);
    const r = await preset(["add", NODE, "--dry-run"]);
    expect(r.out.slice(-3)).toEqual([
      "",
      "  writes .claude/agents/node-deps-reviewer.md",
      "  runs   npm audit, in the review",
    ]);
  });
});

describe("factory preset add for a preset of another owner", () => {
  const SUMMARY = () => [
    `${BAR} is public, and foo is not this repository's owner.`,
    `${BAR} at ${short("foo/presets")}, from November 20, would change these settings here:`,
    "",
    "  added",
    "    plugins.build.reviewers   + bar-reviewer",
    "    pr-review.commands        + npm audit",
    "  replaces the default",
    "    rules.review-rounds       2 → 3",
    "",
    "  writes .claude/agents/bar-reviewer.md",
    "  runs   npm audit, in the review",
  ];

  it("opens the summary by saying whose it is, and adds it on y", async () => {
    await setUp([], [], ["foo/presets"]);
    const r = await preset(["add", BAR], ["y"]);
    expect(r.out).toEqual([
      ...SUMMARY(),
      "",
      "Apply? [y/N] y",
      `✓ Added ${BAR} to .claude/factory.yaml, pinned at ${short("foo/presets")} in .claude/factory.lock.`,
      "✓ Wrote .claude/agents/bar-reviewer.md.",
    ]);
    expect(r.code).toBe(0);
    expect(read(root, ".claude/agents/bar-reviewer.md")).toBe("bar\n");
  });

  it("reads it with no sign-in, on every call to git", async () => {
    await setUp([], [], ["foo/presets"]);
    rmSync(join(CACHE, "presets", HOST, "foo"), { recursive: true });
    const envs: Record<string, string | undefined>[] = [];
    const r = await preset(["add", BAR, "--dry-run"], [], {
      fetch: (repository) => ({
        ...fetching(repository, { PATH: process.env.PATH, GH_TOKEN: "s3cret" }),
        git: (args, o) => {
          envs.push(o.env);
          return runGit(args, o);
        },
      }),
    });
    expect(r.code).toBe(0);
    expect(envs).toHaveLength(5);
    for (const env of envs) {
      expect(env.GIT_TERMINAL_PROMPT).toBe("0");
      expect(env.GIT_CONFIG_NOSYSTEM).toBe("1");
      expect([env.GIT_CONFIG_KEY_0, env.GIT_CONFIG_VALUE_0]).toEqual([
        "credential.helper",
        "",
      ]);
      expect(env.FACTORY_PRESET_TOKEN).toBeUndefined();
    }
  });

  it("reads one of the repository's own owner with the run's token", async () => {
    await setUp([ACME]);
    const envs: Record<string, string | undefined>[] = [];
    await preset(["add", NODE, "--dry-run"], [], {
      fetch: (repository) => ({
        ...fetching(repository, { PATH: process.env.PATH, GH_TOKEN: "s3cret" }),
        git: (args, o) => {
          envs.push(o.env);
          return runGit(args, o);
        },
      }),
    });
    expect(envs.length).toBeGreaterThan(0);
    for (const env of envs) expect(env.FACTORY_PRESET_TOKEN).toBe("s3cret");
  });

  it("is refused with --yes, before anything is read", async () => {
    await setUp([], [], ["foo/presets"]);
    const before = state();
    const r = await preset(["add", BAR, "--yes"], [], { terminal: false });
    expect(r).toMatchObject({
      code: 1,
      err: [
        `✗ ${BAR} belongs to another owner, so a person adds it, at a terminal. Run it without --yes.`,
      ],
      out: [],
      git: [],
    });
    expect(state()).toEqual(before);
  });

  it("says a terminal applies it, not --yes, outside one", async () => {
    await setUp([], [], ["foo/presets"]);
    const before = state();
    const r = await preset(["add", BAR], [], { terminal: false });
    expect(r.code).toBe(1);
    expect(r.out).toEqual([
      ...SUMMARY(),
      "",
      "Run it in a terminal to apply it.",
    ]);
    expect(state()).toEqual(before);
  });

  it("says it has to be public when it cannot be read with no sign-in, naming this repository's owner", async () => {
    await setUp([]);
    const before = state();
    const r = await preset(["add", "foo/private-presets"]);
    expect(r).toMatchObject({
      code: 1,
      err: [
        "✗ foo/private-presets: not found, or private. A preset of another owner has to be public. To follow a private one, keep a copy under acme and add the copy.",
      ],
      out: [],
    });
    expect(state()).toEqual(before);
  });
});

describe("factory preset remove", () => {
  /** The docs' repository: both presets, 30 chosen over 40. */
  const both = async () => {
    await setUp([ACME, NODE]);
    put(
      root,
      ".claude/factory.choices.yaml",
      `rules.small-change-lines: ${NODE}\n`,
    );
    await sync();
  };
  const SUMMARY = [
    `Removing ${NODE} would change these settings here:`,
    "",
    "  removed",
    "    plugins.build.reviewers    − node-deps-reviewer",
    "    pr-review.commands         − npm audit",
    "  back to the default",
    "    rules.review-rounds        3 → 2",
    "    commands.gate              npm test → none",
    "  back to a value you chose against",
    `    rules.small-change-lines   30 → 40, from ${ACME}`,
    "",
    "  deletes .claude/agents/node-deps-reviewer.md",
  ];

  it("shows the summary, asks about a value you chose against, and applies on y", async () => {
    await both();
    const r = await preset(["remove", NODE], ["40", "y"]);
    expect(r.out).toEqual([
      ...SUMMARY,
      "",
      "Choose:",
      `  rules.small-change-lines: use 40 from ${ACME}, or keep 30 in your .claude/factory.yaml? [40/30] 40`,
      "",
      "Apply? [y/N] y",
      `✓ Removed ${NODE} from .claude/factory.yaml and .claude/factory.lock.`,
      "✓ Removed 1 choice from .claude/factory.choices.yaml.",
      "✓ Deleted .claude/agents/node-deps-reviewer.md.",
    ]);
    expect(read(root, ".claude/factory.yaml")).toBe(own([ACME]));
    expect(read(root, ".claude/factory.choices.yaml")).toBeNull();
    expect(read(root, DEPS)).toBeNull();
    expect(pinsOf(read(root, LOCK), load).map((p) => p.name)).toEqual([ACME]);
  });

  it("reads only the repository's own files: no preset's repository, and not the cache", async () => {
    await both();
    rmSync(join(CACHE, "presets"), { recursive: true });
    rmSync(remoteOf(REPO), { recursive: true });
    const r = await preset(["remove", NODE, "--yes"]);
    expect(r).toMatchObject({ code: 0, err: [], git: [] });
    expect(r.out.slice(-3)).toEqual([
      `✓ Removed ${NODE} from .claude/factory.yaml and .claude/factory.lock.`,
      "✓ Removed 1 choice from .claude/factory.choices.yaml.",
      "✓ Deleted .claude/agents/node-deps-reviewer.md.",
    ]);
  });

  it("says how many choices it dropped, and nothing of choices when it dropped none", async () => {
    await setUp([ACME, NODE]);
    put(
      root,
      ".claude/factory.choices.yaml",
      `rules.small-change-lines: ${NODE}\nplugins.build.reviewers.x: ${NODE}\n`,
    );
    let r = await preset(["remove", NODE, "--yes"]);
    expect(r.out).toContain(
      "✓ Removed 2 choices from .claude/factory.choices.yaml.",
    );
    r = await preset(["remove", ACME, "--yes"]);
    expect(r.out.filter((l) => l.startsWith("✓"))).toEqual([
      `✓ Removed ${ACME} from .claude/factory.yaml and .claude/factory.lock.`,
      "✓ Deleted .claude/agents/acme-security-reviewer.md.",
    ]);
  });

  it("takes out a name the lock never pinned, whatever its shape, changing no setting", async () => {
    await setUp([ACME]);
    put(root, ".claude/factory.yaml", own([ACME, '"@acme/factory-preset"']));
    const r = await preset(["remove", "@acme/factory-preset", "--yes"]);
    expect(r).toMatchObject({ code: 0, err: [] });
    expect(r.out).toEqual([
      "Removing @acme/factory-preset would change these settings here:",
      "",
      "✓ Removed @acme/factory-preset from .claude/factory.yaml and .claude/factory.lock.",
    ]);
    expect(read(root, ".claude/factory.yaml")).toBe(own([ACME]));
  });

  it("colors the summary when it paints", async () => {
    await both();
    const paint = painter(true);
    const r = await preset(["remove", NODE, "--dry-run"], [], { paint });
    expect(r.out).toEqual([
      `Removing ${NODE} would change these settings here:`,
      "",
      `  ${paint("bold", "removed")}`,
      `    plugins.build.reviewers    ${paint("red", "− node-deps-reviewer")}`,
      `    pr-review.commands         ${paint("red", "− npm audit")}`,
      `  ${paint("bold", "back to the default")}`,
      `    rules.review-rounds        ${paint("dim", "3")} → ${paint("bold", "2")}`,
      `    commands.gate              ${paint("dim", "npm test")} → ${paint("bold", "none")}`,
      `  ${paint("bold", "back to a value you chose against")}`,
      `    rules.small-change-lines   ${paint("dim", "30")} → ${paint("bold", "40")}, from ${ACME}`,
      "",
      "  deletes .claude/agents/node-deps-reviewer.md",
    ]);
  });

  it("writes the kept value into .claude/factory.yaml", async () => {
    await both();
    await preset(["remove", NODE], ["30", "y"]);
    expect(read(root, ".claude/factory.yaml")).toMatch(
      /small-change-lines: 30/,
    );
  });

  it("takes the remaining preset's value with --yes, writing nothing into .claude/factory.yaml", async () => {
    await both();
    const r = await preset(["remove", NODE, "--yes"], [], { terminal: false });
    expect(r.code).toBe(0);
    expect(read(root, ".claude/factory.yaml")).not.toContain(
      "small-change-lines",
    );
    expect(read(root, LOCK)).toMatch(
      /small-change-lines: 40 +# acme\/factory-config\n/,
    );
  });

  it("changes nothing on no, outside a terminal, or with --dry-run", async () => {
    await both();
    const before = state();
    expect((await preset(["remove", NODE], ["40", "n"])).out.at(-1)).toBe(
      "Nothing changed.",
    );
    const outside = await preset(["remove", NODE], [], { terminal: false });
    expect(outside.code).toBe(1);
    expect(outside.out.at(-1)).toBe(
      "Run it in a terminal to choose, or add --yes to apply it.",
    );
    const dry = await preset(["remove", NODE, "--dry-run"]);
    expect(dry.out).toEqual(SUMMARY);
    expect(state()).toEqual(before);
  });

  it("refuses a preset not listed", async () => {
    await setUp([ACME]);
    const r = await preset(["remove", NODE]);
    expect(r.code).toBe(1);
    expect(r.err).toEqual([`${NODE} is not in presets`]);
  });
});

describe("factory preset choices and choose", () => {
  const LISTED = [
    "rules.review-rounds                    not chosen yet",
    `  1) 2   ${ACME}`,
    `  2) 3   ${NODE}     ← applies now`,
  ];
  const disagree = async () => {
    await setUp([ACME, NODE]);
    const commit = publish(REPO, {
      ...REPOS[REPO],
      "": {
        ...REPOS[REPO]![""]!,
        settings: ACME_BASE.replace(
          "  small-change-lines: 40",
          "  small-change-lines: 40\n  review-rounds: 2",
        ),
      },
    });
    for (const name of [ACME, NODE]) pin(root, name, commit);
    put(
      root,
      ".claude/factory.choices.yaml",
      `rules.small-change-lines: ${NODE}\n`,
    );
    await sync();
  };

  it("lists each disagreement and asks which preset to follow, writing what changed", async () => {
    await disagree();
    const r = await preset(["choices"], ["2", ""]);
    expect(r.out).toEqual([
      ...LISTED,
      "  choose [1/2, Enter keeps it]: 2",
      "",
      "rules.small-change-lines               chosen",
      `  1) 40  ${ACME}`,
      `  2) 30  ${NODE}     ← applies now`,
      "  choose [1/2, Enter keeps it]: ",
      "",
      "wrote .claude/factory.choices.yaml",
      "wrote .claude/factory.lock",
    ]);
    expect(read(root, ".claude/factory.choices.yaml")).toContain(
      `rules.review-rounds: ${NODE}`,
    );
  });

  it("says Nothing changed. when every answer keeps it", async () => {
    await disagree();
    const r = await preset(["choices"], ["", ""]);
    expect(r.out.at(-1)).toBe("Nothing changed.");
  });

  it("prints the list without asking outside a terminal", async () => {
    await disagree();
    const r = await preset(["choices"], [], { terminal: false });
    expect(r.code).toBe(0);
    expect(r.asked).toEqual([]);
    expect(r.out.slice(0, 3)).toEqual(LISTED);
  });

  it("says when no two presets disagree", async () => {
    await setUp([ACME]);
    const r = await preset(["choices"]);
    expect(r.out).toEqual(["No two presets disagree here."]);
  });

  it("lists a file two presets both ship by its path in each one's repository", async () => {
    await setUp([]);
    const commit = publish("acme/two", {
      "": { settings: "version: 2\n", agents: { shared: "root\n" } },
      node: { settings: "version: 2\n", agents: { shared: "node\n" } },
    });
    put(root, ".claude/factory.yaml", own(["acme/two", "acme/two//node"]));
    for (const name of ["acme/two", "acme/two//node"]) pin(root, name, commit);
    await sync();
    const r = await preset(["choices"], [], { terminal: false });
    expect(r.out).toEqual([
      ".claude/agents/shared.md                       not chosen yet",
      "  1) agents/shared.md       acme/two",
      "  2) node/agents/shared.md  acme/two//node     ← applies now",
    ]);
    expect(read(root, ".claude/agents/shared.md")).toBe("node\n");
  });

  it("records one choice without asking", async () => {
    await disagree();
    const r = await preset(["choose", "rules.review-rounds", ACME]);
    expect(r.code).toBe(0);
    expect(read(root, LOCK)).toMatch(
      /review-rounds: 2 +# acme\/factory-config, chosen over acme\/factory-config\/\/node/,
    );
  });

  it("refuses a key no two presets disagree on, and a preset that doesn't set it", async () => {
    await disagree();
    let r = await preset(["choose", "rules.relock", ACME]);
    expect(r.err).toEqual(["rules.relock: no two presets disagree on this"]);
    expect(r.code).toBe(1);
    r = await preset(["choose", "rules.review-rounds", "acme/web"]);
    expect(r.err).toEqual(["rules.review-rounds: acme/web doesn't set this"]);
    expect(r.code).toBe(1);
  });

  it("writes the choices file as one line a choice, under its comment", async () => {
    await disagree();
    await preset(["choose", "rules.review-rounds", ACME]);
    expect(read(root, ".claude/factory.choices.yaml")).toBe(
      [
        "# Written by `factory preset add`, `remove`, and `choices`: which preset",
        "# wins where two presets set the same thing. Change it with",
        "# `factory preset choices`.",
        `rules.small-change-lines: ${NODE}`,
        `rules.review-rounds: ${ACME}`,
        "",
      ].join("\n"),
    );
  });
});

describe("factory preset check", () => {
  /** The command run in a checkout of a preset's repository. */
  const checkIn = async (presets: Record<string, PresetFiles>) => {
    root = repo(own([]));
    publish("acme/checked", presets);
    return preset(["check"], [], { cwd: remoteOf("acme/checked") });
  };

  it("lists each preset by its file's path, with what it ships, and needs no package.json", async () => {
    const r = await checkIn({
      "": {
        settings: ACME_BASE,
        agents: { "acme-security-reviewer": "s\n" },
        skills: { "acme-refine": "r\n" },
      },
      node: { settings: "version: 2\n" },
    });
    expect(r.code).toBe(0);
    expect(r.out).toEqual([
      "factory-preset.yaml        1 agent, 1 skill",
      "node/factory-preset.yaml   no agents or skills",
    ]);
    expect(read(remoteOf("acme/checked"), "package.json")).toBeNull();
  });

  it("finds a preset in a folder below the one it runs in, when that folder has none", async () => {
    const r = await checkIn({
      "stacks/go": { settings: "version: 2\n", agents: { g: "go\n" } },
    });
    expect(r.code).toBe(0);
    expect(r.out).toEqual([
      "stacks/go/factory-preset.yaml   1 agent, 0 skills",
    ]);
  });

  it("names each problem with what to change, and fails", async () => {
    const r = await checkIn({
      "": { settings: "version: 2\n", agents: {} },
      node: {
        settings: "version: 2\nauto-merge:\n  allow: [src/**]\npresets: [x]\n",
      },
    });
    expect(r.code).toBe(1);
    expect(r.out).toEqual([
      "node/factory-preset.yaml: auto-merge.allow: a preset can't set this. Remove it, and set it in each repository that wants it",
      "node/factory-preset.yaml: presets: a preset can't name another preset. Remove it, and list each preset in the repositories that use this one",
    ]);
  });

  it("notes a plugin the repository doesn't ship without failing, and says nothing of the factory's own", async () => {
    const r = await checkIn({
      "": {
        settings:
          "version: 2\nplugins:\n  build:\n    reviewers:\n      - agent: acme-docs-reader\n        files: [docs/**]\n  test:\n    reviewers:\n      - agent: factory-test-reviewer\n",
      },
    });
    expect(r.code).toBe(0);
    expect(r.out.at(-1)).toBe(
      "factory-preset.yaml: plugins.build.reviewers: acme-docs-reader: not shipped here, so each repository that uses this preset must provide it",
    );
    expect(r.out.join("\n")).not.toContain("factory-test-reviewer");
  });

  describe("beside an organization's poller", () => {
    const withPoller = (builds: string[], pollMinutes: number) =>
      checkIn({
        "": {
          settings: ["version: 2", ...builds, ""].join("\n"),
          others: {
            [POLLER_FILE]: pollerWorkflow({
              owner: "acme",
              version: "0.4.0",
              pollMinutes,
            }),
          },
        },
      });
    const EVERY_30 = [
      "builds:",
      "  trigger: github-action",
      "  poll-minutes: 30",
    ];

    it("fails when the file's first cron line is not the one builds.poll-minutes gives, saying what to write", async () => {
      const r = await withPoller(EVERY_30, 5);
      expect(r.out).toEqual([
        '✗ .github/workflows/factory-poller.yml runs on "*/5 * * * *", and builds.poll-minutes is 30. Write "*/30 * * * *" there.',
      ]);
      expect(r.code).toBe(1);
    });

    it("reads a preset that sets no interval as every 5 minutes", async () => {
      const r = await withPoller([], 30);
      expect(r.out).toEqual([
        '✗ .github/workflows/factory-poller.yml runs on "*/30 * * * *", and builds.poll-minutes is 5. Write "*/5 * * * *" there.',
      ]);
      expect(r.code).toBe(1);
    });

    it.each<[string, string[], number]>([
      ["the interval the preset sets", EVERY_30, 30],
      ["every 5 minutes, with none set", [], 5],
      [
        "the hour, for 60",
        ["builds:", "  trigger: github-action", "  poll-minutes: 60"],
        60,
      ],
    ])(
      "passes when the file runs on %s, whatever its later cron lines",
      async (_, builds, minutes) => {
        const r = await withPoller(builds, minutes);
        expect(r.out).toEqual(["factory-preset.yaml   no agents or skills"]);
        expect(r.code).toBe(0);
      },
    );

    it("fails for a file with no cron line", async () => {
      const r = await checkIn({
        "": {
          settings: "version: 2\n",
          others: {
            [POLLER_FILE]: "name: Factory poller\non:\n  workflow_dispatch:\n",
          },
        },
      });
      expect(r.out).toEqual([
        '✗ .github/workflows/factory-poller.yml has no cron line, and builds.poll-minutes is 5. Write - cron: "*/5 * * * *" under schedule there.',
      ]);
      expect(r.code).toBe(1);
    });
  });

  it("says there is no preset where no folder here or below has a preset file", async () => {
    root = mkdtempSync(join(tmpdir(), "factory-preset-none-"));
    put(root, "docs/readme.md", "nothing\n");
    const r = await preset(["check"]);
    expect(r.err).toEqual([
      "No preset here: no factory-preset.yaml in this folder or below it",
    ]);
    expect(r.code).toBe(1);
  });
});

describe("factory preset changes", () => {
  let before = "";
  /** The lock at REF, then the working tree's after ACME's pin moved to a
   * newer commit of its repository. NODE's stays where it was. */
  const update = async (
    settings: string,
    agents: Record<string, string> = {
      "acme-security-reviewer": "security\n",
      "acme-a11y-reviewer": "a11y\n",
    },
  ) => {
    await setUp([ACME, NODE], GATE);
    put(
      root,
      ".claude/factory.choices.yaml",
      `rules.small-change-lines: ${NODE}\n`,
    );
    await sync();
    before = read(root, LOCK)!;
    const commit = publish(REPO, {
      ...REPOS[REPO],
      "": { settings, agents },
    });
    pin(root, ACME, commit);
    await sync();
    const r = await preset(["changes", "main"], [], {
      show: (ref, path) => (ref === "main" && path === LOCK ? before : null),
    });
    return { r, heading: `${ACME} ${short()} → ${commit.slice(0, 7)}` };
  };

  it("heads its text with each preset whose commit moved, then says what changed here, what needs a choice, and what doesn't apply", async () => {
    const { r, heading } = await update(
      [
        "version: 2",
        "rules:",
        "  small-change-lines: 35",
        "  review-rounds: 2",
        "commands:",
        "  gate: [npm run lint]",
        "plugins:",
        "  build:",
        "    reviewers:",
        "      - agent: acme-security-reviewer",
        "        files: [src/**]",
        "      - agent: acme-a11y-reviewer",
        "        files: [src/**]",
        "",
      ].join("\n"),
    );
    expect(r.out).toEqual([
      heading,
      "",
      "Changes here:",
      "- plugins.build.reviewers: + acme-a11y-reviewer,",
      "  which wrote .claude/agents/acme-a11y-reviewer.md",
      "",
      "Needs a choice:",
      `- rules.review-rounds: ${ACME} now sets 2, and ${NODE} sets 3. 3 applies, from the later preset, until you choose.`,
      "",
      "Doesn't apply here:",
      `- rules.small-change-lines: 40 → 35, but you chose ${NODE}'s 30`,
      "- commands.gate, which your .claude/factory.yaml sets",
      "",
      "To choose, on this branch:",
      "  factory preset choices",
    ]);
    expect(heading).toMatch(/^acme\/factory-config [0-9a-f]{7} → [0-9a-f]{7}$/);
  });

  it("says which of builds.hosts an update adds and takes away", async () => {
    const hosts = (list: string) => `version: 2\nbuilds:\n  hosts: [${list}]\n`;
    const move = async (settings: string) => {
      pin(root, ACME, publish(REPO, { ...REPOS[REPO], "": { settings } }));
      await sync();
    };
    await setUp([ACME, NODE], GATE);
    await move(hosts("a.example, b.example"));
    const lock = read(root, LOCK)!;
    await move(hosts("b.example, c.example"));
    const r = await preset(["changes", "main"], [], { show: () => lock });
    expect(r.out.filter((l) => l.includes("builds.hosts"))).toEqual([
      "- builds.hosts: + c.example",
      "- builds.hosts: − a.example",
    ]);
  });

  it("says a file is rewritten when its hash changed between the two locks", async () => {
    const { r, heading } = await update(ACME_BASE, {
      "acme-security-reviewer": "security, rewritten\n",
    });
    expect(r.out).toEqual([
      heading,
      "",
      "Changes here:",
      "- .claude/agents/acme-security-reviewer.md, rewritten",
    ]);
  });

  it("says Nothing changes here. when an update changes nothing in effect", async () => {
    const { r, heading } = await update(`${ACME_BASE}# A comment.\n`, {
      "acme-security-reviewer": "security\n",
    });
    expect(r.out).toEqual([heading, "", "Nothing changes here."]);
  });

  it("names no preset whose commit stayed", async () => {
    await setUp([ACME, NODE]);
    const lock = read(root, LOCK)!;
    const r = await preset(["changes", "main"], [], { show: () => lock });
    expect(r.out).toEqual(["Nothing changes here."]);
  });
});

describe("factory doctor's preset lines", () => {
  it("says the commit each preset is pinned at, and nothing of Dependabot or an installed version", async () => {
    await setUp([ACME, NODE]);
    put(root, ".github/dependabot.yml", "version: 2\nupdates: []\n");
    expect(await presetChecks(root, null)).toEqual([
      { state: "pass", text: `${ACME} is pinned at ${short()}` },
      { state: "pass", text: `${NODE} is pinned at ${short()}` },
    ]);
  });

  it("gives a stale lock its line first", async () => {
    await setUp([ACME]);
    put(
      root,
      ".claude/factory.yaml",
      own([ACME], ["rules:", "  review-rounds: 4"]),
    );
    expect(
      await presetChecks(root, await staleOf(defaultDeps(root, {}))),
    ).toEqual([
      {
        state: "fail",
        text: ".claude/factory.yaml changed since the last sync. Run: factory sync",
      },
      { state: "pass", text: `${ACME} is pinned at ${short()}` },
    ]);
  });

  it("has no line where there is no lock", async () => {
    root = repo(own([]));
    expect(await presetChecks(root, null)).toEqual([]);
  });
});
