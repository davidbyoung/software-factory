import type { Settings } from "../src/config.mts";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { load } from "js-yaml";
import { parse } from "yaml";
import { resolveFiles, type Resolved } from "../src/config.mts";
import { NoDefaultBranch } from "../src/lib/default-branch.mts";
import {
  factoryHooks,
  hasAnyFactoryHook,
  hasFactoryHooks,
  launcherPath,
  withHooks,
  withoutHooks,
  main,
  PACKAGE,
  partsOn,
  plan,
} from "../src/sync.mts";
import { FACTORY_FILE, REVIEW_FILE } from "../src/workflow-files.mts";
import { FACTORY_COLUMNS } from "./factory-columns";
import { CODE_HOST } from "./settings-fixture";
import { TOOLS } from "../src/tools.mts";
import { fakeCredential } from "./fake-tools";
import { into } from "./printed";

// A made-up package and an empty repository beside it.
let dir: string;
let pkg: string;
let root: string;

const put = (base: string, path: string, text: string) => {
  mkdirSync(dirname(join(base, path)), { recursive: true });
  writeFileSync(join(base, path), text);
};
const read = (path: string) =>
  existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : null;

const settings = (raw: Record<string, unknown> = {}) => ({
  version: 2,
  repository: "o/r",
  "code-host": CODE_HOST,
  ...raw,
});

/** The settings `raw` writes, resolved as `factory sync` resolves them. */
const resolved = (raw: Record<string, unknown>): Promise<Resolved> =>
  resolveFiles({
    readFile: () => JSON.stringify(raw),
    exists: () => true,
    hasPackage: () => true,
    listFiles: () => [],
    loadYaml: async () => load,
    out: () => {},
    err: () => {},
    root,
  });
const FULL = {
  tickets: { board: 3, columns: FACTORY_COLUMNS },
  "auto-merge": { allow: ["docs/**"] },
};

const NO_REMOTE =
  "✗ repository: .claude/factory.yaml says o/r, and no remote here is o/r. Add the remote, or change the line and run factory sync.";

/** A sync of the made-up package into the repository, whose default branch
 * is `branch`, or cannot be told when that is null, for the reason the
 * line NO_REMOTE gives. */
async function sync(
  argv: string[] = [],
  s = settings(FULL),
  branch: string | null = "main",
  extra: { announce?: boolean } = {},
) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, {
    root,
    pkg,
    settings: () => resolved(s),
    stale: async () => null,
    defaultBranch: async () => {
      if (branch === null) throw new NoDefaultBranch(NO_REMOTE);
      return branch;
    },
    out: into(out),
    err: into(err),
    ...extra,
  });
  return { code, out, err };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "factory-sync-"));
  pkg = join(dir, "pkg");
  root = join(dir, "repo");
  mkdirSync(root);
  put(pkg, "package.json", '{"name": "@o/factory", "version": "1.2.3"}');
  put(pkg, "bin/factory.js", "");
  put(pkg, "skills/factory-build/SKILL.md", "work\n");
  put(pkg, "agents/factory-reader.md", "reader\n");
  put(pkg, "rules.md", "rules\n");
  put(pkg, "review.md", "review\n");
  put(pkg, "skills/factory-design/SKILL.md", "design\n");
  put(pkg, "agents/factory-ui-reviewer.md", "ui\n");
  put(pkg, "agents/factory-e2e-reviewer.md", "e2e\n");
  put(pkg, "skills/factory-deps/SKILL.md", "deps\n");
});

type Called = {
  uses: string;
  with: Record<string, unknown>;
  secrets: Record<string, string>;
};
type FactoryFile = {
  "run-name": string;
  on: { push: { branches: string[] }; schedule: { cron: string }[] };
  permissions: Record<string, string>;
  jobs: { factory: Called };
};
type ReviewFile = {
  permissions: Record<string, string>;
  jobs: { review: Called };
};

/** The two workflow files a sync wrote, read as YAML. */
const factoryFile = (text = read(FACTORY_FILE)) => parse(text!) as FactoryFile;
const reviewFile = (text = read(REVIEW_FILE)) => parse(text!) as ReviewFile;
/** The parts that are on, as factory.yml passes them. */
const partsIn = () =>
  String(factoryFile().jobs.factory.with.parts).split(" ").filter(Boolean);
/** What factory.yml passes that sets a session's minutes or its job's
 * limit. */
const minutesIn = () =>
  Object.fromEntries(
    Object.entries(factoryFile().jobs.factory.with).filter(([key]) =>
      /-(minutes|limit)$/.test(key),
    ),
  );
const HOME = "davidbyoung/software-factory/.github/workflows";

const SITE = { site: { start: "npm start", url: "http://localhost:$PORT" } };
const DESIGN = ".claude/skills/factory-design/SKILL.md";
const UI = ".claude/agents/factory-ui-reviewer.md";
const E2E = ".claude/agents/factory-e2e-reviewer.md";
const END_TO_END = { commands: { "end-to-end": "npx e2e $FILE" } };
const DEPENDABOT = ".github/dependabot.yml";
const DEPS = ".claude/skills/factory-deps/SKILL.md";
const BOARD = { tickets: { board: 3, columns: FACTORY_COLUMNS } };

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("factory sync", () => {
  it("writes the copies, the hook entries, the import line, and the lock", async () => {
    expect((await sync()).code).toBe(0);

    expect(read(".claude/skills/factory-build/SKILL.md")).toBe("work\n");
    expect(read(".claude/agents/factory-reader.md")).toBe("reader\n");
    expect(read(".claude/factory/rules.md")).toBe("rules\n");
    expect(read(".github/factory-review.md")).toBe("review\n");
    expect(read("CLAUDE.md")).toBe("@.claude/factory/rules.md\n");

    const hooks = JSON.parse(read(".claude/settings.json")!).hooks;
    expect(Object.keys(hooks)).toEqual([
      "SessionStart",
      "PreToolUse",
      "PermissionRequest",
      "SubagentStart",
      "SubagentStop",
    ]);
    expect(hooks.PreToolUse).toEqual([
      expect.objectContaining({
        matcher: "Bash",
        hooks: [
          expect.objectContaining({
            command: `command -v factory >/dev/null 2>&1 || { echo "The factory is not installed on this machine. Install it once: npm install -g @o/factory" >&2; exit 2; }; factory guard`,
          }),
        ],
      }),
      expect.objectContaining({ matcher: "Read|Grep|Glob" }),
    ]);

    expect(hooks.PermissionRequest).toEqual([
      expect.objectContaining({
        matcher: "Write|Edit|MultiEdit",
        hooks: [
          expect.objectContaining({
            command: `command -v factory >/dev/null 2>&1 || exit 0; factory guard permission`,
          }),
        ],
      }),
    ]);

    const lock = read(".claude/factory.lock")!;
    expect(lock).toContain("version: 1.2.3");
    expect(lock).toContain("  - .claude/skills/factory-build/SKILL.md");
  });

  it.each([
    ["no part on", {}],
    [
      "every part on",
      { ...FULL, "pr-review": null, builds: { trigger: "github-action" } },
    ],
  ])("writes both workflow files, and locks them, with %s", async (_, raw) => {
    const r = await sync([], settings(raw));

    expect(r.code).toBe(0);
    expect(r.out).toContain(`wrote ${FACTORY_FILE}`);
    expect(r.out).toContain(`wrote ${REVIEW_FILE}`);
    expect(Object.keys(factoryFile().jobs)).toEqual(["factory"]);
    expect(Object.keys(reviewFile().jobs)).toEqual(["review"]);
    const lock = read(".claude/factory.lock")!;
    expect(lock).toContain(`  - ${FACTORY_FILE}`);
    expect(lock).toContain(`  - ${REVIEW_FILE}`);
  });

  it("writes nothing else under .github/ but the review's instructions", async () => {
    await sync([], settings());

    const { files } = parse(read(".claude/factory.lock")!) as {
      files: string[];
    };
    expect(files.filter((path) => path.startsWith(".github/"))).toEqual([
      ".github/factory-review.md",
      FACTORY_FILE,
      REVIEW_FILE,
    ]);
    expect(existsSync(join(root, ".github/actions"))).toBe(false);
  });

  it("calls the factory's workflows at the package's version", async () => {
    await sync();

    expect(factoryFile().jobs.factory.uses).toBe(`${HOME}/run.yml@v1.2.3`);
    expect(reviewFile().jobs.review.uses).toBe(`${HOME}/review.yml@v1.2.3`);
  });

  it("calls the copies in the same commit where the repository is the package itself", async () => {
    root = pkg;
    await sync();

    expect(factoryFile().jobs.factory.uses).toBe("./.github/workflows/run.yml");
    expect(reviewFile().jobs.review.uses).toBe(
      "./.github/workflows/review.yml",
    );
  });

  it("writes the design skill, and locks it, only where there is a site", async () => {
    expect((await sync([], settings())).code).toBe(0);
    expect(read(DESIGN)).toBeNull();
    expect(read(".claude/factory.lock")).not.toContain(DESIGN);

    expect((await sync([], settings(SITE))).code).toBe(0);
    expect(read(DESIGN)).toBe("design\n");
    expect(read(".claude/factory.lock")).toContain(`  - ${DESIGN}`);
  });

  it("writes the UI reviewer, and locks it, only where there is a site", async () => {
    expect((await sync([], settings())).code).toBe(0);
    expect(read(UI)).toBeNull();
    expect(read(".claude/factory.lock")).not.toContain(UI);

    expect((await sync([], settings(SITE))).code).toBe(0);
    expect(read(UI)).toBe("ui\n");
    expect(read(".claude/factory.lock")).toContain(`  - ${UI}`);
  });

  it("writes the end-to-end reviewer, and locks it, only where commands.end-to-end is set", async () => {
    expect((await sync([], settings())).code).toBe(0);
    expect(read(E2E)).toBeNull();
    expect(read(".claude/factory.lock")).not.toContain(E2E);

    expect((await sync([], settings(END_TO_END))).code).toBe(0);
    expect(read(E2E)).toBe("e2e\n");
    expect(read(".claude/factory.lock")).toContain(`  - ${E2E}`);
  });

  it("removes the end-to-end reviewer when commands.end-to-end is taken out, and the check then passes", async () => {
    await sync([], settings(END_TO_END));
    expect(read(E2E)).toBe("e2e\n");

    const r = await sync([], settings());

    expect(read(E2E)).toBeNull();
    expect(r.out).toContain(`deleted ${E2E}`);
    expect((await sync(["--check"], settings())).code).toBe(0);
  });

  it("fails the check, naming the end-to-end reviewer, while one a sync wrote is still there with commands.end-to-end not set", async () => {
    await sync([], settings(END_TO_END));

    const r = await sync(["--check"], settings());

    expect(r.code).toBe(1);
    expect(r.err).toContain(`  ${E2E}`);
    expect(read(E2E)).toBe("e2e\n");
  });

  it("fails the check, naming the end-to-end reviewer, while commands.end-to-end is set and no sync has written it", async () => {
    await sync([], settings());

    const r = await sync(["--check"], settings(END_TO_END));

    expect(r.code).toBe(1);
    expect(r.err).toContain(`  ${E2E}`);
    expect(read(E2E)).toBeNull();
  });

  it("writes the deps skill, and turns the dependabot part on, only where Dependabot is set up", async () => {
    expect((await sync([], settings())).code).toBe(0);
    expect(read(DEPS)).toBeNull();
    expect(partsIn()).toEqual([]);

    put(root, DEPENDABOT, "version: 2\n");
    expect((await sync([], settings())).code).toBe(0);
    expect(read(DEPS)).toBe("deps\n");
    expect(read(".claude/factory.lock")).toContain(`  - ${DEPS}`);
    expect(partsIn()).toEqual(["dependabot"]);
  });

  it("removes the deps skill, and turns the part off, when Dependabot is taken out, and the check then passes", async () => {
    put(root, DEPENDABOT, "version: 2\n");
    await sync([], settings());
    rmSync(join(root, DEPENDABOT));

    const r = await sync([], settings());

    expect(read(DEPS)).toBeNull();
    expect(r.out).toContain(`deleted ${DEPS}`);
    expect(partsIn()).toEqual([]);
    expect((await sync(["--check"], settings())).code).toBe(0);
  });

  it("removes the design skill when the site is taken out", async () => {
    await sync([], settings(SITE));
    expect(read(DESIGN)).toBe("design\n");

    expect((await sync([], settings())).code).toBe(0);
    expect(read(DESIGN)).toBeNull();
  });

  describe("in a repository a release that copied the workflows synced", () => {
    const COPIED = [
      ".github/workflows/factory-board-sync.yml",
      ".github/workflows/factory-build.yml",
      ".github/workflows/factory-check.yml",
      ".github/workflows/factory-claude-review.yml",
      ".github/workflows/factory-conflicts.yml",
      ".github/workflows/factory-deps-auto-merge.yml",
      ".github/workflows/factory-deps.yml",
      ".github/workflows/factory-merge-policy.yml",
      ".github/workflows/factory-poller.yml",
      ".github/workflows/factory-review-verdict.yml",
      ".github/actions/factory-agent/action.yml",
    ];
    // That release wrote a file at factory-review.yml's path too.
    beforeEach(() => {
      const locked = [...COPIED, REVIEW_FILE];
      for (const path of locked) put(root, path, "copied\n");
      put(
        root,
        ".claude/factory.lock",
        ["version: 1.0.0", "files:", ...locked.map((p) => `  - ${p}`), ""].join(
          "\n",
        ),
      );
    });

    it("deletes each copied workflow, and the agent action, that its lock lists", async () => {
      const r = await sync();

      for (const path of COPIED) {
        expect(r.out).toContain(`deleted ${path}`);
        expect(read(path)).toBeNull();
      }
      expect((await sync(["--check"])).code).toBe(0);
    });

    it("overwrites factory-review.yml, which that lock also lists", async () => {
      const r = await sync();

      expect(r.out).toContain(`wrote ${REVIEW_FILE}`);
      expect(r.out).not.toContain(`deleted ${REVIEW_FILE}`);
      expect(reviewFile().jobs.review.uses).toBe(`${HOME}/review.yml@v1.2.3`);
    });
  });

  it("changes nothing when run again", async () => {
    await sync();
    const again = await sync();

    expect(again.code).toBe(0);
    expect(again.out).toEqual([]);
    expect((await sync(["--check"])).code).toBe(0);
  });

  it("turns off the lines that name an AI in a commit and a pull request", async () => {
    await sync();

    expect(JSON.parse(read(".claude/settings.json")!).attribution).toEqual({
      commit: "",
      pr: "",
      sessionUrl: false,
    });
  });

  it("leaves a repository's own attribution setting as it is", async () => {
    const own = { commit: "Built with help", pr: "" };
    put(root, ".claude/settings.json", JSON.stringify({ attribution: own }));

    await sync();

    expect(JSON.parse(read(".claude/settings.json")!).attribution).toEqual(own);
  });

  it("keeps an entry in .claude/settings.json that is not the factory's, in place", async () => {
    const own = { type: "command", command: "echo own", timeout: 5 };
    put(
      root,
      ".claude/settings.json",
      JSON.stringify({
        model: "x",
        hooks: {
          PreToolUse: [
            { matcher: "Edit", hooks: [own] },
            {
              matcher: "Bash",
              hooks: [
                {
                  type: "command",
                  command: "node old/bin/factory.js guard",
                },
              ],
            },
          ],
        },
      }),
    );

    await sync();

    const written = JSON.parse(read(".claude/settings.json")!);
    expect(written.model).toBe("x");
    expect(written.hooks.PreToolUse).toHaveLength(3);
    expect(written.hooks.PreToolUse[0]).toEqual({
      matcher: "Edit",
      hooks: [own],
    });
    expect(written.hooks.PreToolUse[1].hooks[0].command).toMatch(
      /; factory guard$/,
    );
  });

  it("adds the import line to a CLAUDE.md without it, and leaves the rest", async () => {
    put(root, "CLAUDE.md", "# Ours\n\nSome rules.\n");

    await sync();

    expect(read("CLAUDE.md")).toBe(
      "# Ours\n\nSome rules.\n\n@.claude/factory/rules.md\n",
    );
  });

  it("deletes a file the lock lists that the package no longer has", async () => {
    put(pkg, "agents/factory-gone.md", "gone\n");
    await sync();
    expect(read(".claude/agents/factory-gone.md")).toBe("gone\n");
    put(root, "keep.md", "mine\n");

    rmSync(join(pkg, "agents/factory-gone.md"));
    const r = await sync();

    expect(r.out).toContain("deleted .claude/agents/factory-gone.md");
    expect(read(".claude/agents/factory-gone.md")).toBeNull();
    expect(read("keep.md")).toBe("mine\n");
  });

  it.each([
    ["review", "pr-review is written", { "pr-review": null }],
    ["board", "tickets.board is set", BOARD],
    [
      "auto-merge",
      "auto-merge.allow lists a file",
      { "auto-merge": { allow: ["docs/**"] } },
    ],
    [
      "poller",
      "builds.trigger is github-action",
      { ...BOARD, builds: { trigger: "github-action" } },
    ],
  ])(
    "turns the %s part on only while %s, and changes nothing in factory-review.yml",
    async (part, _, raw) => {
      await sync([], settings());
      expect(partsIn()).not.toContain(part);
      const review = read(REVIEW_FILE);

      await sync([], settings(raw));
      expect(partsIn()).toContain(part);
      expect(read(REVIEW_FILE)).toBe(review);

      await sync([], settings());
      expect(partsIn()).not.toContain(part);
    },
  );

  it("passes every part that is on, in the order the factory's workflows list them", async () => {
    put(root, DEPENDABOT, "version: 2\n");
    await sync(
      [],
      settings({
        builds: { trigger: "github-action" },
        "auto-merge": { allow: ["docs/**"] },
        ...BOARD,
        "pr-review": null,
      }),
    );

    expect(partsIn()).toEqual([
      "review",
      "board",
      "auto-merge",
      "poller",
      "dependabot",
    ]);
  });

  it("schedules the poller only with the github-action trigger, and takes its line out once the trigger changes", async () => {
    const crons = () => factoryFile().on.schedule.map((s) => s.cron);
    await sync([], settings(BOARD));
    expect(crons()).toHaveLength(3);

    await sync(
      [],
      settings({ ...BOARD, builds: { trigger: "github-action" } }),
    );
    expect(crons()).toHaveLength(4);

    await sync([], settings({ ...BOARD, builds: { trigger: "own-server" } }));
    expect(crons()).toHaveLength(3);
  });

  it.each([
    [undefined, "*/5 * * * *"],
    [10, "*/10 * * * *"],
    [15, "*/15 * * * *"],
    [30, "*/30 * * * *"],
    [60, "0 * * * *"],
  ])(
    "schedules the poller for builds.poll-minutes %s",
    async (minutes, cron) => {
      await sync(
        [],
        settings({
          ...BOARD,
          builds: { trigger: "github-action", "poll-minutes": minutes },
        }),
      );

      expect(factoryFile().on.schedule.at(-1)).toEqual({ cron });
    },
  );

  describe("the override's name in factory.yml", () => {
    const named = (name: string) =>
      settings({
        "code-host": { ...CODE_HOST, labels: { "verdict-override": name } },
      });

    it("passes the name code-host.labels gives it", async () => {
      await sync([], named("owner's pass"));

      expect(factoryFile().jobs.factory.with["override-label"]).toBe(
        "owner's pass",
      );
    });

    it("passes none with the default, which the factory's workflow has", async () => {
      await sync([], settings());

      expect(factoryFile().jobs.factory.with).not.toHaveProperty(
        "override-label",
      );
    });

    it("fails the check, naming the file, while it passes another", async () => {
      await sync([], settings());

      const r = await sync(["--check"], named("owner-pass"));

      expect(r.code).toBe(1);
      expect(r.err).toContain(`  ${FACTORY_FILE}`);
      expect(r.err).not.toContain(`  ${REVIEW_FILE}`);
    });
  });
});

describe("the factory's core", () => {
  // What the factory's own steps call is written to every repository,
  // whatever its settings and files. Anything else is written only when a
  // setting or a file turns it on.
  const CORE = [
    ".claude/skills/factory-refine/SKILL.md",
    ".claude/skills/factory-build/SKILL.md",
    ".claude/skills/factory-address-review/SKILL.md",
    ".claude/skills/factory-resolve-conflicts/SKILL.md",
    ".claude/skills/factory-diagnose/SKILL.md",
    ".claude/skills/factory-mutate/SKILL.md",
    ".claude/skills/factory-trace/SKILL.md",
    ".claude/agents/factory-ticket-readiness.md",
    ".claude/agents/factory-test-reviewer.md",
  ];

  it("is written from the real package to a repository with no settings and no files", async () => {
    const written = [
      ...(
        await plan(PACKAGE, root, await resolved(settings()), "main")
      ).write.keys(),
    ];
    expect(CORE.filter((path) => !written.includes(path))).toEqual([]);
  });
  it("gives the trace skill the change types to read and the pull request to post on", async () => {
    const trace = (
      await plan(PACKAGE, root, await resolved(settings()), "main")
    ).write.get(".claude/skills/factory-trace/SKILL.md");
    expect(trace).toContain(".claude/change-types.md");
    expect(trace).toContain("factory pr comment");
    expect(
      (await plan(PACKAGE, root, await resolved(settings()), "main")).write.get(
        ".claude/factory/rules.md",
      ),
    ).toContain("`factory-trace` skill");
  });
});

describe("factory sync: how long each session may run", () => {
  it("passes no minutes with the defaults, which the factory's workflow has", async () => {
    await sync([], settings());

    expect(minutesIn()).toEqual({});
  });

  it.each(["build", "conflicts", "review", "dependencies"])(
    "passes the minutes the settings give %s, and 10 more for its job",
    async (kind) => {
      await sync([], settings({ "session-minutes": { [kind]: 400 } }));

      expect(minutesIn()).toEqual({
        [`${kind}-minutes`]: 400,
        [`${kind}-limit`]: 410,
      });
    },
  );

  it("fails the check, naming the file, when the setting changed and sync did not run", async () => {
    await sync([], settings());

    const r = await sync(
      ["--check"],
      settings({ "session-minutes": { review: 20 } }),
    );

    expect(r.code).toBe(1);
    expect(r.err).toContain(`  ${FACTORY_FILE}`);
    expect(r.err).not.toContain(`  ${REVIEW_FILE}`);
  });
});

describe("factory sync: the numbers the rules use", () => {
  const RULES = [
    "A change is small when it changes under about 30 lines outside tests.",
    "After two rounds, whatever is still in dispute goes to the user.",
    "",
  ].join("\n");
  const REVIEW = [
    "## 6. Two rounds, then escalate",
    "",
    "Handle **at most two",
    "rounds**. When the third review arrives:",
    "",
  ].join("\n");
  const RULES_COPY = ".claude/factory/rules.md";
  const REVIEW_COPY = ".claude/skills/factory-address-review/SKILL.md";
  beforeEach(() => {
    put(pkg, "rules.md", RULES);
    put(pkg, "skills/factory-address-review/SKILL.md", REVIEW);
  });

  it("writes the copies word for word with the defaults", async () => {
    await sync([], settings());
    expect(read(RULES_COPY)).toBe(RULES);
    expect(read(REVIEW_COPY)).toBe(REVIEW);
  });

  it("writes the small-change number into the rules", async () => {
    await sync([], settings({ rules: { "small-change-lines": 45 } }));
    expect(read(RULES_COPY)).toContain("under about 45 lines outside tests");
    expect(read(REVIEW_COPY)).toBe(REVIEW);
  });

  it("writes the review's rounds into the rules and the review skill, numbering the next review", async () => {
    await sync([], settings({ rules: { "review-rounds": 3 } }));
    expect(read(RULES_COPY)).toContain("After three rounds, whatever");
    expect(read(REVIEW_COPY)).toBe(
      [
        "## 6. Three rounds, then escalate",
        "",
        "Handle **at most three",
        "rounds**. When the fourth review arrives:",
        "",
      ].join("\n"),
    );
  });

  it("writes one round as one, and a count past ten in digits", async () => {
    await sync([], settings({ rules: { "review-rounds": 1 } }));
    expect(read(REVIEW_COPY)).toContain("## 6. One round, then escalate");
    expect(read(REVIEW_COPY)).toContain(
      "at most one\nround**. When the second review arrives",
    );
    await sync([], settings({ rules: { "review-rounds": 12 } }));
    expect(read(RULES_COPY)).toContain("After 12 rounds, whatever");
    expect(read(REVIEW_COPY)).toContain("When the 13th review arrives");
  });

  it("stops, naming the review skill, when the rounds are set and its heading is gone", async () => {
    put(pkg, "skills/factory-address-review/SKILL.md", "review\n");
    await expect(
      sync([], settings({ rules: { "review-rounds": 3 } })),
    ).rejects.toThrow(
      "skills/factory-address-review/SKILL.md: expected one match",
    );
  });

  it("stops, naming the file, when a number is set and its phrase is gone", async () => {
    put(pkg, "rules.md", "rules\n");
    await expect(
      sync([], settings({ rules: { "small-change-lines": 45 } })),
    ).rejects.toThrow("rules.md: expected one match");
  });

  it("fails the check, naming both copies, when the rounds changed and sync did not run", async () => {
    await sync([], settings());
    const r = await sync(
      ["--check"],
      settings({ rules: { "review-rounds": 3 } }),
    );
    expect(r.code).toBe(1);
    expect(r.err).toContain(`  ${RULES_COPY}`);
    expect(r.err).toContain(`  ${REVIEW_COPY}`);
  });

  it("finds every phrase in the real package's rules and review skill", async () => {
    const written = (
      await plan(
        PACKAGE,
        root,
        await resolved(
          settings({ rules: { "small-change-lines": 45, "review-rounds": 3 } }),
        ),
        "main",
      )
    ).write;
    expect(written.get(RULES_COPY)).toContain("under about 45 lines");
    expect(written.get(RULES_COPY)).toContain("After three rounds");
    expect(written.get(REVIEW_COPY)).toContain("Three rounds, then escalate");
    expect(written.get(REVIEW_COPY)).toContain(
      "When the fourth review arrives",
    );
  });
});

describe("factory sync: the default branch in the push trigger", () => {
  const pushBranches = () => factoryFile().on.push.branches;

  it("writes the default branch's name into factory.yml's push trigger", async () => {
    expect((await sync([], settings(), "develop")).code).toBe(0);

    expect(pushBranches()).toEqual(["develop"]);
  });

  it("fails the check, naming the one file that holds it, when the default branch differs", async () => {
    await sync([], settings(), "main");

    const r = await sync(["--check"], settings(), "develop");

    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      "✗ 1 of the factory's files doesn't match the settings:",
      `  ${FACTORY_FILE}`,
      "Run factory sync and commit what it writes.",
    ]);
  });

  it("writes nothing, prints the lookup's line, and exits 1 when it cannot tell the default branch", async () => {
    const r = await sync([], settings(), null);

    expect(r.code).toBe(1);
    expect(r.err).toEqual([NO_REMOTE]);
    expect(r.out).toEqual([]);
    expect(read(FACTORY_FILE)).toBeNull();
    expect(read("CLAUDE.md")).toBeNull();
  });

  it("fails the check the same way when it cannot tell the default branch", async () => {
    await sync();

    const r = await sync(["--check"], settings(), null);

    expect(r.code).toBe(1);
    expect(r.err).toEqual([NO_REMOTE]);
  });

  it("quotes a name that YAML would not read as plain text", async () => {
    await sync([], settings(), "feat#1");

    expect(pushBranches()).toEqual(["feat#1"]);
  });

  it("writes a name with a slash in it as it is", async () => {
    await sync([], settings(), "release/2.x");

    expect(read(FACTORY_FILE)).toContain("    branches: [release/2.x]\n");
  });
});

describe("factory sync --check", () => {
  it("exits 1 naming the copy that differs by one character, and writes nothing", async () => {
    await sync();
    put(root, ".claude/factory/rules.md", "rulez\n");

    const r = await sync(["--check"]);

    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      "✗ 1 of the factory's files doesn't match the settings:",
      "  .claude/factory/rules.md",
      "Run factory sync and commit what it writes.",
    ]);
    expect(read(".claude/factory/rules.md")).toBe("rulez\n");
  });

  it("says the files match when the check passes", async () => {
    await sync();

    const r = await sync(["--check"]);

    expect(r.code).toBe(0);
    expect(r.out).toEqual(["✓ The factory's files match the settings."]);
  });

  it("says nothing changed when a person's sync writes nothing", async () => {
    await sync();

    const again = await sync([], settings(FULL), "main", { announce: true });

    expect(again.out.at(-1)).toBe(
      "The factory's files already match the settings. Nothing changed.",
    );
  });

  it("says nothing of it unless asked to, as init and the preset commands run it", async () => {
    await sync();

    expect((await sync()).out).not.toContain(
      "The factory's files already match the settings. Nothing changed.",
    );
  });

  it("exits 1 naming each workflow file that differs from what the settings write", async () => {
    await sync();
    put(root, FACTORY_FILE, "changed\n");
    put(root, REVIEW_FILE, "changed\n");

    const r = await sync(["--check"]);

    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      "✗ 2 of the factory's files don't match the settings:",
      `  ${FACTORY_FILE}`,
      `  ${REVIEW_FILE}`,
      "Run factory sync and commit what it writes.",
    ]);
  });

  it("exits 1 naming factory.yml, and not factory-review.yml, when a part was turned on and sync did not run", async () => {
    await sync();
    put(root, DEPENDABOT, "version: 2\n");

    const r = await sync(["--check"]);

    expect(r.code).toBe(1);
    expect(r.err).toContain(`  ${FACTORY_FILE}`);
    expect(r.err).not.toContain(`  ${REVIEW_FILE}`);
  });

  it("exits 1 naming both workflow files when the factory's version changed and sync did not run", async () => {
    await sync();
    put(pkg, "package.json", '{"name": "@o/factory", "version": "1.3.0"}');

    const r = await sync(["--check"]);

    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      "✗ 3 of the factory's files don't match the settings:",
      `  ${FACTORY_FILE}`,
      `  ${REVIEW_FILE}`,
      "  .claude/factory.lock",
      "Run factory sync and commit what it writes.",
    ]);
  });

  it("exits 1 before a sync and 0 after it", async () => {
    expect((await sync(["--check"])).code).toBe(1);
    await sync();
    expect((await sync(["--check"])).code).toBe(0);
  });
});

describe("launcherPath", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "factory-launcher-path-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("points at the package's own folder when it sits inside the repository", () => {
    mkdirSync(join(dir, "packages/factory"), { recursive: true });
    expect(launcherPath(join(dir, "packages/factory"), dir)).toBe(
      "packages/factory/bin/factory.js",
    );
  });

  it("points at the root's own launcher when the repository is the package itself", () => {
    expect(launcherPath(dir, dir)).toBe("bin/factory.js");
  });

  it("follows a workspace link to the package's folder inside the repository", () => {
    mkdirSync(join(dir, "packages/factory"), { recursive: true });
    mkdirSync(join(dir, "node_modules/@o"), { recursive: true });
    symlinkSync(
      join(dir, "packages/factory"),
      join(dir, "node_modules/@o/factory"),
    );
    expect(launcherPath(join(dir, "node_modules/@o/factory"), dir)).toBe(
      "packages/factory/bin/factory.js",
    );
  });

  it("is the machine's factory when the package is outside the repository", () => {
    const pkg = mkdtempSync(join(tmpdir(), "factory-elsewhere-"));
    try {
      expect(launcherPath(pkg, dir)).toBeNull();
    } finally {
      rmSync(pkg, { recursive: true, force: true });
    }
  });
});

describe("factoryHooks", () => {
  const MISSING =
    "The factory is not installed on this machine. Install it once: npm install -g @o/factory";
  const commands = (launcher: string | null) =>
    factoryHooks(launcher, "@o/factory").map(
      ([event, group]) => `${event}: ${group.hooks[0].command}`,
    );
  /** What the hook on the credentials file runs before the guard: nothing
   * more is started for a call whose input does not name the file. */
  const NAMED =
    'input=$(cat); case "$input" in *software-factory/credentials*) ;; *) exit 0 ;; esac; printf \'%s\' "$input" |';

  it("runs the machine's factory, and stops a command or a file read where there is none", () => {
    const installed = `command -v factory >/dev/null 2>&1 || { echo "${MISSING}" >&2; exit 2; };`;
    expect(commands(null)).toEqual([
      `SessionStart: command -v factory >/dev/null 2>&1 || { echo "${MISSING}"; exit 0; }; factory session-start`,
      `PreToolUse: ${installed} factory guard`,
      `PreToolUse: ${installed} ${NAMED} factory guard credentials`,
      "PermissionRequest: command -v factory >/dev/null 2>&1 || exit 0; factory guard permission",
      "SubagentStart: factory reviewers start 2>/dev/null || true",
      "SubagentStop: factory reviewers stop 2>/dev/null || true",
    ]);
  });

  it("runs the launcher by its path where the package is in the repository", () => {
    expect(commands("bin/factory.js")).toEqual([
      'SessionStart: node "$CLAUDE_PROJECT_DIR"/bin/factory.js session-start',
      'PreToolUse: node "$CLAUDE_PROJECT_DIR"/bin/factory.js guard',
      `PreToolUse: ${NAMED} node "$CLAUDE_PROJECT_DIR"/bin/factory.js guard credentials`,
      'PermissionRequest: node "$CLAUDE_PROJECT_DIR"/bin/factory.js guard permission',
      'SubagentStart: node "$CLAUDE_PROJECT_DIR"/bin/factory.js reviewers start 2>/dev/null || true',
      'SubagentStop: node "$CLAUDE_PROJECT_DIR"/bin/factory.js reviewers stop 2>/dev/null || true',
    ]);
  });

  describe("the hook on the credentials file, run by sh", () => {
    const [, group] = factoryHooks(null, "@o/factory").find(
      ([, g]) => g.matcher === "Read|Grep|Glob",
    ) ?? [null, { hooks: [{ command: "exit 99" }] }];
    const FILE = "/home/dana/.config/software-factory/credentials.yaml";
    let box = "";
    afterEach(() => rmSync(box, { recursive: true, force: true }));

    /** The command run on a hook's input. With `installed`, the `factory`
     * on the PATH notes that it was started, then runs the real one. */
    const run = (
      tool_name: string,
      tool_input: Record<string, string>,
      installed = true,
    ) => {
      box = mkdtempSync(join(tmpdir(), "factory-hook-"));
      const started = join(box, "started");
      if (installed)
        writeFileSync(
          join(box, "factory"),
          `#!/bin/sh\necho "$*" >> "${started}"\nexec "${process.execPath}" "${join(import.meta.dirname, "..", "bin", "factory.js")}" "$@"\n`,
          { mode: 0o755 },
        );
      const r = spawnSync("/bin/sh", ["-c", group.hooks[0]!.command], {
        input: JSON.stringify({ tool_name, tool_input }),
        encoding: "utf8",
        env: { PATH: installed ? `${box}:${process.env.PATH}` : box },
      });
      return {
        status: r.status,
        stderr: r.stderr.trim(),
        started: existsSync(started)
          ? readFileSync(started, "utf8").trim().split("\n")
          : [],
      };
    };

    it("reaches the guard, which refuses the call, when the input opens the file", () => {
      expect(run("Read", { file_path: FILE })).toEqual({
        status: 2,
        stderr:
          "The factory's credentials file is not for sessions to read. Its commands read it themselves: run the factory command you need, such as factory ticket view.",
        started: ["guard credentials"],
      });
    });

    it("starts no factory for a call that does not name the file", () => {
      expect(run("Read", { file_path: "/home/dana/site/README.md" })).toEqual({
        status: 0,
        stderr: "",
        started: [],
      });
    });

    it("reaches the guard, which lets the call through, when a search only mentions the path in its pattern", () => {
      expect(run("Grep", { pattern: FILE, path: "docs" })).toEqual({
        status: 0,
        stderr: "",
        started: ["guard credentials"],
      });
    });

    it("stops every call, saying how to install the factory, on a machine without it", () => {
      expect(
        run("Read", { file_path: "/home/dana/site/README.md" }, false),
      ).toEqual({ status: 2, stderr: MISSING, started: [] });
    });
  });

  it("replaces an entry an earlier release wrote, which ran a copy in node_modules", () => {
    const old = withHooks(null, "node_modules/@o/factory/bin/factory.js");
    const now = JSON.parse(withHooks(old, null, "@o/factory"));
    expect(now.hooks.PreToolUse).toHaveLength(2);
    expect(now.hooks.PreToolUse[0].hooks[0].command).toMatch(
      /; factory guard$/,
    );
    expect(hasFactoryHooks(JSON.stringify(now))).toBe(true);
    expect(withoutHooks(JSON.stringify(now))).toBe(
      `${JSON.stringify({ attribution: now.attribution }, null, 2)}\n`,
    );
  });

  it("replaces the guard on the credentials file as an earlier release wrote it, and writes it once", () => {
    const earlier = {
      matcher: "Read|Grep|Glob",
      hooks: [
        {
          type: "command",
          command: `command -v factory >/dev/null 2>&1 || { echo "${MISSING}" >&2; exit 2; }; factory guard credentials`,
        },
      ],
    };
    const once = withHooks(
      JSON.stringify({ hooks: { PreToolUse: [earlier] } }),
      null,
      "@o/factory",
    );
    const guards = (text: string) =>
      (JSON.parse(text).hooks.PreToolUse as (typeof earlier)[])
        .filter((g) => g.matcher === "Read|Grep|Glob")
        .map((g) => g.hooks[0]!.command);
    expect(guards(once)).toEqual([
      expect.stringMatching(/\| factory guard credentials$/),
    ]);
    expect(withHooks(once, null, "@o/factory")).toBe(once);
  });

  describe("the folder other repositories are cloned into", () => {
    const WORK = "~/.local/share/software-factory/work";
    const permissions = (text: string) => JSON.parse(text).permissions;

    it("may be edited by a session, beside any other folder, listed once", () => {
      const own = JSON.stringify({
        permissions: { allow: ["Bash"], additionalDirectories: ["../docs"] },
      });
      const once = withHooks(own, null, "@o/factory");
      expect(permissions(once)).toEqual({
        allow: ["Bash"],
        additionalDirectories: ["../docs", WORK],
      });
      expect(withHooks(once, null, "@o/factory")).toBe(once);
      expect(permissions(withHooks(null, null, "@o/factory"))).toEqual({
        additionalDirectories: [WORK],
      });
    });

    it("is taken out again, and nothing else with it", () => {
      const own = {
        permissions: { allow: ["Bash"], additionalDirectories: ["../docs"] },
      };
      const text = withHooks(JSON.stringify(own), null, "@o/factory");
      expect(permissions(withoutHooks(text)!)).toEqual(own.permissions);
      const alone = withHooks(null, null, "@o/factory");
      expect(permissions(withoutHooks(alone)!)).toBeUndefined();
    });
  });

  it("leaves a hook of the repository's own that only mentions a factory", () => {
    const own = { type: "command", command: "my-factory guard --all" };
    const text = JSON.stringify({ hooks: { PreToolUse: [{ hooks: [own] }] } });
    expect(hasAnyFactoryHook(text)).toBe(false);
  });
});

describe("factory sync: the ticket system in the workflow files", () => {
  const NAMES = ["FAKE_TICKETS_EMAIL", "FAKE_TICKETS_TOKEN"];
  /** The registry with a ticket system that reads a credential, under
   * GitHub's name so the settings take it as they stand. */
  const withCredential = {
    github: {
      ...TOOLS.tickets.github!,
      setup: { ...TOOLS.tickets.github!.setup, credential: fakeCredential },
    },
  };
  const EVERY = settings({
    ...FULL,
    "pr-review": { commands: [] },
    builds: { trigger: "github-action" },
  });
  /** The text of the two workflow files, by path. */
  const workflows = async (systems?: typeof withCredential) => {
    const p = await plan(PACKAGE, root, await resolved(EVERY), "main", systems);
    return new Map(
      [FACTORY_FILE, REVIEW_FILE].map((path) => [path, p.write.get(path)!]),
    );
  };
  /** The one secret that carries the repository's own, by name. */
  const extra = (names: string[]) =>
    `\${{ format('{{${names.map((n, i) => `"${n}":{${i}}`).join(",")}}}', ${names.map((n) => `toJSON(secrets.${n})`).join(", ")}) }}`;

  it("names a build's run by the ticket as GitHub writes it", async () => {
    await sync();

    expect(factoryFile()["run-name"]).toContain(
      "inputs.ticket && format('Build #{0}', inputs.ticket) ||",
    );
  });

  it("passes each of the ticket system's secrets, by name, from factory.yml alone", async () => {
    const written = await workflows(withCredential);

    expect(
      factoryFile(written.get(FACTORY_FILE)).jobs.factory.secrets.extra,
    ).toBe(extra(NAMES));
    for (const name of NAMES)
      expect(written.get(REVIEW_FILE)).not.toContain(name);
  });

  it("passes none for GitHub's tickets, which read the workflow's own token", async () => {
    const written = await workflows();

    expect(
      factoryFile(written.get(FACTORY_FILE)).jobs.factory.secrets,
    ).not.toHaveProperty("extra");
  });

  it("adds one line to factory.yml, and changes no other", async () => {
    const before = await workflows();
    for (const [path, text] of await workflows(withCredential)) {
      const was = before.get(path)!.split("\n");
      const added = text.split("\n").filter((line) => !was.includes(line));
      expect(added, path).toEqual(
        path === FACTORY_FILE ? [`      extra: ${extra(NAMES)}`] : [],
      );
      expect(text.split("\n").filter((line) => !added.includes(line))).toEqual(
        was,
      );
    }
  });

  it("writes a name the .npmrc also reads once, after .npmrc's own", async () => {
    put(root, ".npmrc", "//npm.example/:_authToken=${FAKE_TICKETS_TOKEN}\n");
    const written = await workflows(withCredential);

    expect(
      factoryFile(written.get(FACTORY_FILE)).jobs.factory.secrets.extra,
    ).toBe(extra(["FAKE_TICKETS_TOKEN", "FAKE_TICKETS_EMAIL"]));
  });

  const settingsJson = async (systems?: typeof withCredential) =>
    JSON.parse(
      (
        await plan(PACKAGE, root, await resolved(EVERY), "main", systems)
      ).write.get(".claude/settings.json")!,
    ) as {
      hooks: Record<
        string,
        { matcher?: string; hooks: { command: string }[] }[]
      >;
    };

  it.each<[string, typeof withCredential | undefined]>([
    ["GitHub's tickets", undefined],
    ["a ticket system that keeps a credential on the machine", withCredential],
  ])(
    "guards the credentials file for reading, searching, and listing files with %s",
    async (_, systems) => {
      const groups = (await settingsJson(systems)).hooks.PreToolUse!;
      expect(groups.map((g) => g.matcher)).toEqual(["Bash", "Read|Grep|Glob"]);
      expect(groups[1]!.hooks[0]!.command).toMatch(/ guard credentials$/);
    },
  );
});

describe("the board part", () => {
  const with_ = (board: number | null, statuses: boolean) =>
    ({
      prReview: null,
      tickets: { board, statuses },
      autoMerge: { allow: [] },
      builds: { trigger: "manual" },
    }) as unknown as Settings;

  it("is on with a board, or with a ticket system that has statuses of its own", () => {
    expect(partsOn(with_(1, false), () => false)).toEqual(["board"]);
    expect(partsOn(with_(null, true), () => false)).toEqual(["board"]);
    expect(partsOn(with_(null, false), () => false)).toEqual([]);
  });
});
