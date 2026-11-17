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
import { parseSettings, type Settings } from "../src/config.mts";
import { launcherPath, main, PACKAGE, plan } from "../src/sync.mts";

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

const settings = (raw: Record<string, unknown> = {}): Settings =>
  parseSettings({ version: 1, repository: "o/r", ...raw }, () => true);
const FULL = { tickets: { board: 3 }, "auto-merge": { allow: ["docs/**"] } };

async function sync(argv: string[] = [], s = settings(FULL)) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, {
    root,
    pkg,
    settings: async () => s,
    out: (l) => out.push(l),
    err: (l) => err.push(l),
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
  put(pkg, "workflows/factory-check.yml", "check\n");
  put(pkg, "workflows/factory-claude-review.yml", "ci review\n");
  put(pkg, "workflows/factory-build.yml", workflow(1));
  put(pkg, "actions/factory-agent/action.yml", "agent\n");
  for (const name of ["review", "conflicts", "deps"])
    put(pkg, `workflows/factory-${name}.yml`, workflow(1));
  put(pkg, "skills/factory-design/SKILL.md", "design\n");
  put(pkg, "agents/factory-ui-reviewer.md", "ui\n");
  put(pkg, "skills/factory-deps/SKILL.md", "deps\n");
  put(pkg, "workflows/factory-deps-auto-merge.yml", "deps merge\n");
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

const SITE = { site: { start: "npm start", url: "http://localhost:$PORT" } };
const DESIGN = ".claude/skills/factory-design/SKILL.md";
const UI = ".claude/agents/factory-ui-reviewer.md";
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
    expect(read(".github/workflows/factory-check.yml")).toBe("check\n");
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

    expect(read(".github/workflows/factory-build.yml")).toBe(workflow(230));
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
    expect(read(".github/workflows/factory-check.yml")).toBe("check\n");
  });

  it("writes the CI review only while ci-review is written, and deletes it once it is gone", async () => {
    await sync([], settings());
    expect(read(".github/workflows/factory-claude-review.yml")).toBeNull();

    await sync([], settings({ "ci-review": null }));
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
    ".claude/agents/factory-ticket-readiness.md",
    ".claude/agents/factory-test-reviewer.md",
  ];

  it("is written from the real package to a repository with no settings and no files", () => {
    const written = [...plan(PACKAGE, root, settings()).write.keys()];
    expect(CORE.filter((path) => !written.includes(path))).toEqual([]);
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
    async (file, _, minutes) => {
      await sync([], settings());
      expect(read(`.github/workflows/${file}`)).toBe(workflow(minutes));
    },
  );

  it.each(KINDS)(
    "writes %s with the minutes the settings give %s",
    async (file, kind) => {
      await sync([], settings({ "session-minutes": { [kind]: 400 } }));
      expect(read(`.github/workflows/${file}`)).toBe(workflow(400));
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

  it("finds every phrase in the real package's rules and review skill", () => {
    const written = plan(
      PACKAGE,
      root,
      settings({ rules: { "small-change-lines": 45, "review-rounds": 3 } }),
    ).write;
    expect(written.get(RULES_COPY)).toContain("under about 45 lines");
    expect(written.get(RULES_COPY)).toContain("After three rounds");
    expect(written.get(REVIEW_COPY)).toContain("Three rounds, then escalate");
    expect(written.get(REVIEW_COPY)).toContain(
      "When the fourth review arrives",
    );
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
      "the factory's files are out of sync:",
      "  .claude/factory/rules.md",
      "Run `npx --no-install factory sync` and commit the result.",
    ]);
    expect(read(".claude/factory/rules.md")).toBe("rulez\n");
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
