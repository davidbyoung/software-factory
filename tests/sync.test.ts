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
import { resolveFiles, type Resolved } from "../src/config.mts";
import {
  launcherPath,
  main,
  PACKAGE,
  plan,
  withDefaultBranch,
  withRunName,
} from "../src/sync.mts";
import { FACTORY_COLUMNS } from "./factory-columns";
import { CODE_HOST } from "./settings-fixture";

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

/** A sync of the made-up package into the repository, whose default branch
 * is `branch`, or cannot be told when that is null. */
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
    defaultBranch: async () => branch,
    out: (l) => out.push(l),
    err: (l) => err.push(l),
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
  put(pkg, "workflows/factory-board-sync.yml", "board\n");
  put(pkg, "workflows/factory-merge-policy.yml", "merge\n");
  put(pkg, "workflows/factory-check.yml", CHECK);
  put(pkg, "workflows/factory-claude-review.yml", "ci review\n");
  put(pkg, "workflows/factory-build.yml", build(1));
  put(pkg, "actions/factory-agent/action.yml", "agent\n");
  for (const name of ["review", "deps"])
    put(pkg, `workflows/factory-${name}.yml`, workflow(1));
  put(pkg, "workflows/factory-conflicts.yml", conflicts(1));
  put(pkg, "skills/factory-design/SKILL.md", "design\n");
  put(pkg, "agents/factory-ui-reviewer.md", "ui\n");
  put(pkg, "agents/factory-e2e-reviewer.md", "e2e\n");
  put(pkg, "skills/factory-deps/SKILL.md", "deps\n");
  put(pkg, "workflows/factory-deps-auto-merge.yml", "deps merge\n");
  put(
    pkg,
    "workflows/factory-poller.yml",
    'on:\n  schedule:\n    - cron: "*/5 * * * *"\n',
  );
});

/** A session workflow with its two time lines, as the package's are. */
const workflow = (minutes: number) =>
  [
    "jobs:",
    "  run:",
    `    timeout-minutes: ${minutes + 10}`,
    "    steps:",
    "      - uses: ./.github/actions/factory-agent",
    "        with:",
    `          minutes: ${minutes}`,
    "",
  ].join("\n");

/** The build workflow: a session workflow whose run is named for its
 * ticket. */
const RUN_NAME = 'run-name: "Build #${{ inputs.ticket }}"';
const build = (minutes: number) => `${RUN_NAME}\n${workflow(minutes)}`;

/** A push trigger as the package's two workflows that have one write it:
 * the source names main, and the sync writes the default branch's name. */
const pushTo = (branch: string) =>
  ["on:", "  push:", `    branches: [${branch}]`, ""].join("\n");
const CHECK = pushTo("main");
/** The conflicts workflow: a session workflow with a push trigger. */
const conflicts = (minutes: number, branch = "main") =>
  pushTo(branch) + workflow(minutes);

const SITE = { site: { start: "npm start", url: "http://localhost:$PORT" } };
const DESIGN = ".claude/skills/factory-design/SKILL.md";
const UI = ".claude/agents/factory-ui-reviewer.md";
const E2E = ".claude/agents/factory-e2e-reviewer.md";
const END_TO_END = { commands: { "end-to-end": "npx e2e $FILE" } };
const DEPENDABOT = ".github/dependabot.yml";
const DEPS = [
  ".claude/skills/factory-deps/SKILL.md",
  ".github/workflows/factory-deps.yml",
  ".github/workflows/factory-deps-auto-merge.yml",
];

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("factory sync", () => {
  it("writes the copies, the hook entries, the import line, and the lock", async () => {
    expect((await sync()).code).toBe(0);

    expect(read(".claude/skills/factory-build/SKILL.md")).toBe("work\n");
    expect(read(".claude/agents/factory-reader.md")).toBe("reader\n");
    expect(read(".claude/factory/rules.md")).toBe("rules\n");
    expect(read(".github/factory-review.md")).toBe("review\n");
    expect(read(".github/workflows/factory-check.yml")).toBe(CHECK);
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
            command: `node "$CLAUDE_PROJECT_DIR"/node_modules/@o/factory/bin/factory.js guard`,
          }),
        ],
      }),
    ]);

    expect(hooks.PermissionRequest).toEqual([
      expect.objectContaining({
        matcher: "Write|Edit|MultiEdit",
        hooks: [
          expect.objectContaining({
            command: `node "$CLAUDE_PROJECT_DIR"/node_modules/@o/factory/bin/factory.js guard permission`,
          }),
        ],
      }),
    ]);

    const lock = read(".claude/factory.lock")!;
    expect(lock).toContain("version: 1.2.3");
    expect(lock).toContain("  - .claude/skills/factory-build/SKILL.md");
  });

  it("writes the build workflow and the agent action, always, and locks both", async () => {
    expect((await sync([], settings())).code).toBe(0);

    expect(read(".github/workflows/factory-build.yml")).toBe(build(230));
    expect(read(".github/actions/factory-agent/action.yml")).toBe("agent\n");
    const lock = read(".claude/factory.lock")!;
    expect(lock).toContain("  - .github/workflows/factory-build.yml");
    expect(lock).toContain("  - .github/actions/factory-agent/action.yml");
  });

  it("writes the review and conflict workflows, always, and locks them", async () => {
    expect((await sync([], settings())).code).toBe(0);

    for (const name of ["review", "conflicts"]) {
      expect(read(`.github/workflows/factory-${name}.yml`)).toContain(
        "uses: ./.github/actions/factory-agent",
      );
      expect(read(".claude/factory.lock")).toContain(
        `  - .github/workflows/factory-${name}.yml`,
      );
    }
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

  it("writes the deps skill and both deps workflows only where Dependabot is set up", async () => {
    expect((await sync([], settings())).code).toBe(0);
    for (const path of DEPS) expect(read(path)).toBeNull();

    put(root, DEPENDABOT, "version: 2\n");
    expect((await sync([], settings())).code).toBe(0);
    for (const path of DEPS) {
      expect(read(path)).not.toBeNull();
      expect(read(".claude/factory.lock")).toContain(`  - ${path}`);
    }
  });

  it("removes the deps skill and workflows when Dependabot is taken out, and the check then passes", async () => {
    put(root, DEPENDABOT, "version: 2\n");
    await sync([], settings());
    rmSync(join(root, DEPENDABOT));

    const r = await sync([], settings());

    for (const path of DEPS) {
      expect(read(path)).toBeNull();
      expect(r.out).toContain(`deleted ${path}`);
    }
    expect((await sync(["--check"], settings())).code).toBe(0);
  });

  it("removes the design skill when the site is taken out", async () => {
    await sync([], settings(SITE));
    expect(read(DESIGN)).toBe("design\n");

    expect((await sync([], settings())).code).toBe(0);
    expect(read(DESIGN)).toBeNull();
  });

  it("deletes an action the lock lists that the package no longer has", async () => {
    put(pkg, "actions/factory-gone/action.yml", "gone\n");
    await sync();
    expect(read(".github/actions/factory-gone/action.yml")).toBe("gone\n");

    rmSync(join(pkg, "actions/factory-gone"), { recursive: true });
    const r = await sync();

    expect(r.out).toContain("deleted .github/actions/factory-gone/action.yml");
    expect(read(".github/actions/factory-gone/action.yml")).toBeNull();
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
    expect(written.hooks.PreToolUse).toHaveLength(2);
    expect(written.hooks.PreToolUse[0]).toEqual({
      matcher: "Edit",
      hooks: [own],
    });
    expect(written.hooks.PreToolUse[1].hooks[0].command).toMatch(
      /node_modules\/@o\/factory\/bin\/factory\.js guard$/,
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

  it("writes the board sync only with tickets.board, and the merge policy only with auto-merge", async () => {
    await sync([], settings());

    expect(read(".github/workflows/factory-board-sync.yml")).toBeNull();
    expect(read(".github/workflows/factory-merge-policy.yml")).toBeNull();
    expect(read(".github/workflows/factory-check.yml")).toBe(CHECK);
  });

  it("writes the scheduled poller only with the github-action trigger, and deletes it once the trigger changes", async () => {
    const scheduled = {
      tickets: { board: 3, columns: FACTORY_COLUMNS },
      builds: { trigger: "github-action" },
    };
    await sync([], settings());
    expect(read(".github/workflows/factory-poller.yml")).toBeNull();

    await sync([], settings(scheduled));
    expect(read(".github/workflows/factory-poller.yml")).toContain("cron:");

    await sync(
      [],
      settings({
        tickets: { board: 3, columns: FACTORY_COLUMNS },
        builds: { trigger: "own-server" },
      }),
    );
    expect(read(".github/workflows/factory-poller.yml")).toBeNull();
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
          tickets: { board: 3, columns: FACTORY_COLUMNS },
          builds: { trigger: "github-action", "poll-minutes": minutes },
        }),
      );

      expect(read(".github/workflows/factory-poller.yml")).toBe(
        `on:\n  schedule:\n    - cron: "${cron}"\n`,
      );
    },
  );

  describe("the override's name in the verdict workflow", () => {
    const VERDICT = "        github.event.label.name == 'verdict-override'))\n";
    const COPY = ".github/workflows/factory-review-verdict.yml";
    const named = (name: string) =>
      settings({
        "code-host": { ...CODE_HOST, labels: { "verdict-override": name } },
      });

    it("writes the name code-host.labels gives it, a quote doubled", async () => {
      put(pkg, "workflows/factory-review-verdict.yml", VERDICT);
      await sync([], named("owner's pass"));

      expect(read(COPY)).toBe(
        "        github.event.label.name == 'owner''s pass'))\n",
      );
    });

    it("writes the workflow word for word with the default", async () => {
      put(pkg, "workflows/factory-review-verdict.yml", VERDICT);
      await sync([], settings());

      expect(read(COPY)).toBe(VERDICT);
    });

    it("fails the check while the copy names another", async () => {
      put(pkg, "workflows/factory-review-verdict.yml", VERDICT);
      await sync([], settings());

      const r = await sync(["--check"], named("owner-pass"));

      expect(r.code).toBe(1);
      expect(r.err).toContain(`  ${COPY}`);
    });

    it("stops, naming the workflow, when its label line is gone", async () => {
      put(pkg, "workflows/factory-review-verdict.yml", "verdict\n");
      await expect(sync([], named("owner-pass"))).rejects.toThrow(
        "workflows/factory-review-verdict.yml: expected one match",
      );
    });
  });

  it("writes the CI review only while pr-review is written, and deletes it once it is gone", async () => {
    await sync([], settings());
    expect(read(".github/workflows/factory-claude-review.yml")).toBeNull();

    await sync([], settings({ "pr-review": null }));
    expect(read(".github/workflows/factory-claude-review.yml")).toBe(
      "ci review\n",
    );

    await sync([], settings());
    expect(read(".github/workflows/factory-claude-review.yml")).toBeNull();
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
    expect(trace).toContain("npx --no-install factory pr comment");
    expect(
      (await plan(PACKAGE, root, await resolved(settings()), "main")).write.get(
        ".claude/factory/rules.md",
      ),
    ).toContain("`factory-trace` skill");
  });
});

describe("factory sync: how long each session may run", () => {
  // The deps workflow is written only where Dependabot is set up.
  beforeEach(() => put(root, DEPENDABOT, "version: 2\n"));

  const KINDS: [string, string, number][] = [
    ["factory-build.yml", "build", 230],
    ["factory-conflicts.yml", "conflicts", 110],
    ["factory-review.yml", "review", 50],
    ["factory-deps.yml", "dependencies", 50],
  ];
  it.each(KINDS)(
    "writes %s with the %s default, and 10 more for its job",
    async (file, kind, minutes) => {
      await sync([], settings());
      expect(read(`.github/workflows/${file}`)).toBe(
        kind === "conflicts"
          ? conflicts(minutes)
          : kind === "build"
            ? build(minutes)
            : workflow(minutes),
      );
    },
  );

  it.each(KINDS)(
    "writes %s with the minutes the settings give %s",
    async (file, kind) => {
      await sync([], settings({ "session-minutes": { [kind]: 400 } }));
      expect(read(`.github/workflows/${file}`)).toBe(
        kind === "conflicts"
          ? conflicts(400)
          : kind === "build"
            ? build(400)
            : workflow(400),
      );
    },
  );

  it("stops, naming the workflow, when a session workflow has no line to set", async () => {
    put(pkg, "workflows/factory-review.yml", "jobs: {}\n");

    await expect(sync([], settings())).rejects.toThrow(
      "workflows/factory-review.yml: expected one line matching",
    );
  });

  it("fails the check, naming the workflow, when the setting changed and sync did not run", async () => {
    await sync([], settings());

    const r = await sync(
      ["--check"],
      settings({ "session-minutes": { review: 20 } }),
    );

    expect(r.code).toBe(1);
    expect(r.err).toContain("  .github/workflows/factory-review.yml");
    expect(r.err).not.toContain("  .github/workflows/factory-build.yml");
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

describe("factory sync: the default branch in the push triggers", () => {
  const CHECK_COPY = ".github/workflows/factory-check.yml";
  const CONFLICTS_COPY = ".github/workflows/factory-conflicts.yml";
  const pushBranches = (text: string | null | undefined) =>
    (load(text ?? "") as { on: { push: { branches: string[] } } }).on.push
      .branches;

  it("writes the default branch's name, and nothing else, into both push triggers", async () => {
    expect((await sync([], settings(), "develop")).code).toBe(0);

    expect(read(CHECK_COPY)).toBe(pushTo("develop"));
    expect(read(CONFLICTS_COPY)).toBe(conflicts(110, "develop"));
  });

  it("finds the one push trigger in each of the real package's two workflows", async () => {
    const written = (
      await plan(PACKAGE, root, await resolved(settings()), "develop")
    ).write;

    expect(pushBranches(written.get(CHECK_COPY))).toEqual(["develop"]);
    expect(pushBranches(written.get(CONFLICTS_COPY))).toEqual(["develop"]);
  });

  it("fails the check, naming both copies, when the default branch differs from what they hold", async () => {
    await sync([], settings(), "main");

    const r = await sync(["--check"], settings(), "develop");

    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      "✗ 2 of the factory's files don't match the settings:",
      `  ${CHECK_COPY}`,
      `  ${CONFLICTS_COPY}`,
      "Run factory sync and commit what it writes.",
    ]);
  });

  it("writes nothing, names the fix, and exits 1 when it cannot tell the default branch", async () => {
    const r = await sync([], settings(), null);

    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      "Could not tell the default branch. Run: git remote set-head origin --auto",
    ]);
    expect(r.out).toEqual([]);
    expect(read(CHECK_COPY)).toBeNull();
    expect(read("CLAUDE.md")).toBeNull();
  });

  it("fails the check the same way when it cannot tell the default branch", async () => {
    await sync();

    const r = await sync(["--check"], settings(), null);

    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      "Could not tell the default branch. Run: git remote set-head origin --auto",
    ]);
  });

  it("stops, naming the workflow, when it has no push trigger to set", async () => {
    put(pkg, "workflows/factory-check.yml", "on:\n  pull_request:\n");

    await expect(sync([], settings())).rejects.toThrow(
      "workflows/factory-check.yml: expected one branches line, to set the push trigger's branch",
    );
  });

  it("names the build's run without # for a ticket system that writes a key as it is", () => {
    expect(withRunName(build(1), (key) => key, "w.yml")).toBe(
      `run-name: "Build \${{ inputs.ticket }}"\n${workflow(1)}`,
    );
  });

  it("stops when the build workflow has no run-name line", () => {
    expect(() => withRunName(workflow(1), (key) => key, "w.yml")).toThrow(
      "w.yml: expected one run-name line, to name the build",
    );
  });

  it("stops when a workflow has more than one branches line", () => {
    expect(() =>
      withDefaultBranch(pushTo("main") + pushTo("main"), "develop", "w.yml"),
    ).toThrow("w.yml: expected one branches line");
  });

  it("quotes a name that YAML would not read as plain text", () => {
    expect(
      pushBranches(withDefaultBranch(pushTo("main"), "feat#1", "w.yml")),
    ).toEqual(["feat#1"]);
  });

  it("writes a name with a slash in it as it is", () => {
    expect(withDefaultBranch(pushTo("main"), "release/2.x", "w.yml")).toBe(
      pushTo("release/2.x"),
    );
  });

  it("leaves the other workflows as the package has them", async () => {
    await sync([], settings(), "develop");

    expect(read(".github/workflows/factory-build.yml")).toBe(build(230));
  });
});

describe("factory sync --check", () => {
  // The deps workflow is written only where Dependabot is set up.
  beforeEach(() => put(root, DEPENDABOT, "version: 2\n"));

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

  it("exits 1 naming the agent action or the build workflow when either differs", async () => {
    await sync();
    put(root, ".github/actions/factory-agent/action.yml", "agentt\n");
    put(root, ".github/workflows/factory-build.yml", "buildd\n");

    const r = await sync(["--check"]);

    expect(r.code).toBe(1);
    expect(r.err).toContain("  .github/actions/factory-agent/action.yml");
    expect(r.err).toContain("  .github/workflows/factory-build.yml");
  });

  it("exits 1 naming each of the review, conflict, and dependency workflows that differs", async () => {
    await sync();
    for (const name of ["review", "conflicts", "deps"])
      put(root, `.github/workflows/factory-${name}.yml`, "changed\n");

    const r = await sync(["--check"]);

    expect(r.code).toBe(1);
    for (const name of ["review", "conflicts", "deps"])
      expect(r.err).toContain(`  .github/workflows/factory-${name}.yml`);
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
    expect(launcherPath(join(dir, "packages/factory"), dir, "@o/factory")).toBe(
      "packages/factory/bin/factory.js",
    );
  });

  it("points at the root's own launcher when the repository is the package itself", () => {
    expect(launcherPath(dir, dir, "@o/factory")).toBe("bin/factory.js");
  });

  it("follows a workspace link to the package's folder inside the repository", () => {
    mkdirSync(join(dir, "packages/factory"), { recursive: true });
    mkdirSync(join(dir, "node_modules/@o"), { recursive: true });
    symlinkSync(
      join(dir, "packages/factory"),
      join(dir, "node_modules/@o/factory"),
    );
    expect(
      launcherPath(join(dir, "node_modules/@o/factory"), dir, "@o/factory"),
    ).toBe("packages/factory/bin/factory.js");
  });

  it("points into node_modules when the package is outside the repository", () => {
    const pkg = mkdtempSync(join(tmpdir(), "factory-elsewhere-"));
    try {
      expect(launcherPath(pkg, dir, "@o/factory")).toBe(
        "node_modules/@o/factory/bin/factory.js",
      );
    } finally {
      rmSync(pkg, { recursive: true, force: true });
    }
  });
});
