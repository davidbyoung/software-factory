// `factory remove`: what it deletes, what it changes and keeps, and what it
// leaves for you to remove by hand, run against a checkout laid out as
// `factory sync` leaves one and the in-memory tools.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { main } from "../src/remove.mts";
import { IMPORT_LINE, withHooks } from "../src/sync.mts";
import type { Tickets } from "../src/tickets/types.mts";
import type { Registry } from "../src/tools.mts";
import { withFakeTickets } from "./fake-tools";
import { memoryCodeHost } from "./memory-code-host";
import { memoryRunner } from "./memory-runner";
import { memoryTickets } from "./memory-tickets";
import { memoryTools } from "./memory-tools";
import { FACTORY_COLUMNS_YAML } from "./factory-columns";
import { CODE_HOST_YAML } from "./settings-fixture";

const LAUNCHER = "node_modules/@davidbyoung/software-factory/bin/factory.js";
const SETTINGS = [
  "version: 2",
  "repository: acme/site",
  CODE_HOST_YAML,
  "tickets:",
  "  board: 3",
  FACTORY_COLUMNS_YAML,
  "pr-review:",
  "  commands: []",
  "",
].join("\n");

/** A user's own hook, beside the factory's. */
const OWN_HOOK = {
  matcher: "Bash",
  hooks: [{ type: "command", command: "echo mine" }],
};

/** A checkout as `factory sync` leaves one with every part on, with the
 * user's own files beside the factory's. */
const SYNCED: Record<string, string> = {
  ".claude/factory.yaml": SETTINGS,
  ".claude/factory.lock": "version: 0.2.0\nfiles:\n",
  ".claude/factory/rules.md": "# Rules\n",
  ".claude/skills/factory-build/SKILL.md": "build\n",
  ".claude/skills/mine/SKILL.md": "mine\n",
  ".claude/agents/factory-ui-reviewer.md": "reviewer\n",
  ".claude/agents/mine.md": "mine\n",
  ".github/workflows/factory-check.yml": "on: push\n",
  ".github/workflows/factory-claude-review.yml": "on: pull_request\n",
  ".github/workflows/ci.yml": "on: push\n",
  ".github/factory-review.md": "review\n",
  ".github/actions/factory-agent/action.yml": "runs:\n",
  ".github/review-notes.md": "notes\n",
  "CLAUDE.md": `# Our project\n\nUse tabs.\n\n${IMPORT_LINE}\n`,
  ".claude/settings.json": (() => {
    const s = JSON.parse(withHooks(null, LAUNCHER));
    s.hooks.PreToolUse.unshift(OWN_HOOK);
    s.permissions = { allow: ["Bash(ls:*)"] };
    return `${JSON.stringify(s, null, 2)}\n`;
  })(),
  "package.json": '{"name":"site"}\n',
  "package-lock.json": "{}\n",
  ".gitignore": "node_modules/\n",
};

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function remove(o: {
  files?: Record<string, string>;
  secrets?: Record<string, string>;
  go?: boolean;
  tools?: (base: Registry, tickets: Tickets) => Registry;
}) {
  const root = mkdtempSync(join(tmpdir(), "remove-"));
  roots.push(root);
  for (const [path, text] of Object.entries(o.files ?? SYNCED)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  const out: string[] = [];
  const asked: string[] = [];
  const tickets = memoryTickets([]).tickets;
  const run = () =>
    main([], {
      root,
      confirm: async (message) => {
        asked.push(message);
        return o.go ?? true;
      },
      out: (line) => out.push(line),
      tools: (o.tools ?? ((b) => b))(
        memoryTools({
          codeHost: memoryCodeHost([], { owner: "dave" }).codeHost,
          runner: memoryRunner({ secrets: o.secrets ?? {} }).runner,
          tickets,
        }),
        tickets,
      ),
      hasCommand: () => true,
      packageName: "@davidbyoung/software-factory",
    });
  const has = (path: string) => existsSync(join(root, path));
  const read = (path: string) => readFileSync(join(root, path), "utf8");
  return { run, out, asked, has, read };
}

const DELETED = [
  ".claude/factory.yaml",
  ".claude/factory.lock",
  ".claude/factory",
  ".claude/skills/factory-build",
  ".claude/agents/factory-ui-reviewer.md",
  ".github/workflows/factory-check.yml",
  ".github/workflows/factory-claude-review.yml",
  ".github/factory-review.md",
  ".github/actions/factory-agent",
];

describe("factory remove with presets", () => {
  const LOCK = [
    "version: 0.5.0",
    "presets:",
    '  - name: "@acme/factory-preset"',
    "    version: 1.4.0",
    '  - name: "@acme/factory-preset/node"',
    "    version: 1.4.0",
    "settings-hash: sha256:0",
    "settings:",
    "  version: 2",
    "overridden: {}",
    "files:",
    "  - .claude/skills/factory-build/SKILL.md",
    "  - .claude/agents/acme-security-reviewer.md",
    "  - .claude/skills/acme-refine/SKILL.md",
    "",
  ].join("\n");
  const withPresets = () =>
    remove({
      files: {
        ...SYNCED,
        ".claude/factory.lock": LOCK,
        ".claude/factory.choices.yaml":
          'rules.review-rounds: "@acme/factory-preset"\n',
        ".claude/agents/acme-security-reviewer.md": "security\n",
        ".claude/skills/acme-refine/SKILL.md": "refine\n",
      },
    });

  it("deletes the choices file and every agent and skill a preset shipped, as the lock lists them", async () => {
    const r = withPresets();
    await r.run();
    for (const path of [
      ".claude/factory.choices.yaml",
      ".claude/agents/acme-security-reviewer.md",
      ".claude/skills/acme-refine",
    ])
      expect(r.has(path)).toBe(false);
    expect(r.has(".claude/agents/mine.md")).toBe(true);
  });

  it("adds uninstalling each preset's package to what is left by hand", async () => {
    const r = withPresets();
    await r.run();
    const steps = r.out.filter((l) => /^ {2}\d+\. /.test(l));
    expect(
      steps.filter((l) => l.includes("npm uninstall @acme/factory-preset.")),
    ).toHaveLength(1);
  });
});

describe("factory remove", () => {
  it("shows every file it will delete or change, then asks", async () => {
    const r = remove({ go: false });
    expect(await r.run()).toBe(0);
    expect(r.out).toEqual([
      "This is everything remove will do:",
      "  Delete   .claude/factory.yaml",
      "  Delete   .claude/factory.lock",
      "  Delete   .claude/factory",
      "  Delete   .claude/skills/factory-build",
      "  Delete   .claude/agents/factory-ui-reviewer.md",
      "  Delete   .github/workflows/factory-check.yml",
      "  Delete   .github/workflows/factory-claude-review.yml",
      "  Delete   .github/factory-review.md",
      "  Delete   .github/actions/factory-agent",
      "  Change   .claude/settings.json",
      "  Change   CLAUDE.md",
      "Nothing changed.",
    ]);
    expect(r.asked).toEqual(["Go ahead?"]);
    for (const path of DELETED) expect(r.has(path)).toBe(true);
    expect(r.read("CLAUDE.md")).toBe(SYNCED["CLAUDE.md"]);
    expect(r.read(".claude/settings.json")).toBe(
      SYNCED[".claude/settings.json"],
    );
  });

  it("deletes the factory's files", async () => {
    const r = remove({});
    await r.run();
    for (const path of DELETED) expect(r.has(path)).toBe(false);
  });

  it("takes out the factory's hooks and import, keeping everything else", async () => {
    const r = remove({});
    await r.run();
    expect(JSON.parse(r.read(".claude/settings.json"))).toEqual({
      attribution: { commit: "", pr: "", sessionUrl: false },
      permissions: { allow: ["Bash(ls:*)"] },
      hooks: { PreToolUse: [OWN_HOOK] },
    });
    expect(r.read("CLAUDE.md")).toBe("# Our project\n\nUse tabs.\n");
  });

  it("deletes a folder its deletions emptied, and keeps one that holds yours", async () => {
    const r = remove({});
    await r.run();
    for (const path of [".github/actions", ".claude/factory"])
      expect(r.has(path)).toBe(false);
    for (const path of [
      ".claude/skills",
      ".claude/agents",
      ".github/workflows",
    ])
      expect(r.has(path)).toBe(true);
  });

  it("leaves what is yours", async () => {
    const r = remove({});
    await r.run();
    for (const path of [
      ".github/review-notes.md",
      ".claude/skills/mine/SKILL.md",
      ".claude/agents/mine.md",
      ".github/workflows/ci.yml",
      "package.json",
      "package-lock.json",
      ".gitignore",
    ])
      expect(r.read(path)).toBe(SYNCED[path]);
  });

  it("prints what is left by hand, from each tool", async () => {
    const r = remove({
      secrets: {
        CLAUDE_CODE_OAUTH_TOKEN: "x",
        FACTORY_BOARD_TOKEN: "x",
        FACTORY_AUTOMERGE_TOKEN: "x",
        FACTORY_SIGNING_KEY: "x",
      },
    });
    expect(await r.run()).toBe(0);
    expect(r.out.slice(r.out.indexOf(""))).toEqual([
      "",
      "Nothing is committed. Left for you to do by hand:",
      '  1. Delete the "Software factory" ruleset first, under Settings, Rules: until then every pull request waits on its "Review verdict" check.',
      "  2. Delete the secrets FACTORY_BOARD_TOKEN and FACTORY_AUTOMERGE_TOKEN.",
      "  3. Delete the Session, Runs in, and Cost fields from board 3, if you do not want them.",
      "  4. Delete the secret CLAUDE_CODE_OAUTH_TOKEN, unless another workflow uses it.",
      "  5. Delete the secret FACTORY_SIGNING_KEY.",
      "  6. Delete whichever of the labels merge: automatic, merge: manual, verdict: override, follow-up, and spec exist, if you do not want their history: deleting one takes it off every ticket.",
      "  7. Run npm uninstall @davidbyoung/software-factory.",
      "  8. Commit this on a branch, open a pull request, and merge it.",
    ]);
  });

  it("names no board's fields when the settings name no board", async () => {
    const r = remove({
      files: {
        ...SYNCED,
        ".claude/factory.yaml": `version: 2\nrepository: acme/site\n${CODE_HOST_YAML}\n`,
      },
    });
    await r.run();
    expect(r.out.join("\n")).not.toContain("field");
  });

  it("names the ruleset, if there is one, when the review is off", async () => {
    const r = remove({
      files: {
        ...SYNCED,
        ".claude/factory.yaml": `version: 2\nrepository: acme/site\n${CODE_HOST_YAML}\n`,
      },
    });
    await r.run();
    expect(r.out).toContain(
      '  1. Delete the "Software factory" ruleset first, if there is one, under Settings, Rules: until then every pull request waits on its "Review verdict" check.',
    );
  });

  it("prints another ticket system's own leftovers", async () => {
    const r = remove({
      files: {
        ...SYNCED,
        ".claude/factory.yaml": `version: 2\nrepository: acme/site\n${CODE_HOST_YAML}\ntickets:\n  type: fake\n  site: https://tickets.example\n`,
      },
      tools: (b, t) => withFakeTickets(b, t),
    });
    await r.run();
    expect(r.out).toContainEqual(
      expect.stringMatching(/^ {2}\d\. Delete your Fake Tickets token\.$/),
    );
  });

  it("says so when nothing of the factory's is here", async () => {
    const r = remove({
      files: { "package.json": "{}\n", "CLAUDE.md": "# Ours\n" },
    });
    expect(await r.run()).toBe(0);
    expect(r.out).toEqual(["Nothing of the factory's is here."]);
    expect(r.asked).toEqual([]);
  });

  it("removes what is left of a removal half done by hand", async () => {
    const r = remove({
      files: {
        ".claude/factory/rules.md": "# Rules\n",
        "CLAUDE.md": `# Ours\n\n${IMPORT_LINE}\n`,
      },
    });
    expect(await r.run()).toBe(0);
    expect(r.out.slice(0, 4)).toEqual([
      "Could not read .claude/factory.yaml: there is none. Naming what Claude Code, GitHub, GitHub Issues, and GitHub Actions leave behind.",
      "This is everything remove will do:",
      "  Delete   .claude/factory",
      "  Change   CLAUDE.md",
    ]);
    expect(r.has(".claude/factory")).toBe(false);
    expect(r.read("CLAUDE.md")).toBe("# Ours\n");
    expect(r.out).toContain(
      "Nothing is committed. Left for you to do by hand:",
    );
  });

  it("names every secret today's tools store when the settings cannot be read", async () => {
    const r = remove({
      files: { ...SYNCED, ".claude/factory.yaml": "version: 3\n" },
    });
    expect(await r.run()).toBe(0);
    expect(r.out[0]).toBe(
      "Could not read .claude/factory.yaml: .claude/factory.yaml: version: must be 2. Naming what Claude Code, GitHub, GitHub Issues, and GitHub Actions leave behind.",
    );
    expect(r.out).toContain(
      "  2. Delete the secrets FACTORY_BOARD_TOKEN, FACTORY_BUILD_TOKEN, and FACTORY_AUTOMERGE_TOKEN if set.",
    );
    expect(r.out).toContain(
      "  3. Delete the secrets CLAUDE_CODE_OAUTH_TOKEN and ANTHROPIC_API_KEY if set, unless another workflow uses them.",
    );
  });

  it("deletes a settings file the factory's hooks were all it held", async () => {
    const onlyFactory = JSON.parse(withHooks(null, LAUNCHER));
    delete onlyFactory.attribution;
    const r = remove({
      files: {
        ...SYNCED,
        ".claude/settings.json": JSON.stringify(onlyFactory),
      },
    });
    await r.run();
    expect(r.out).toContain("  Delete   .claude/settings.json");
    expect(r.has(".claude/settings.json")).toBe(false);
  });

  it("deletes the folder a deleted settings file leaves empty", async () => {
    const onlyFactory = JSON.parse(withHooks(null, LAUNCHER));
    delete onlyFactory.attribution;
    const r = remove({
      files: {
        ".claude/factory.yaml": SETTINGS,
        ".claude/settings.json": JSON.stringify(onlyFactory),
      },
    });
    await r.run();
    expect(r.has(".claude")).toBe(false);
  });

  it("deletes a CLAUDE.md the import was all it held", async () => {
    const r = remove({
      files: { ...SYNCED, "CLAUDE.md": `${IMPORT_LINE}\n` },
    });
    await r.run();
    expect(r.out).toContain("  Delete   CLAUDE.md");
    expect(r.has("CLAUDE.md")).toBe(false);
  });

  it("drops an emptied hooks key, keeping the rest of the file", async () => {
    const r = remove({
      files: { ...SYNCED, ".claude/settings.json": withHooks(null, LAUNCHER) },
    });
    await r.run();
    expect(JSON.parse(r.read(".claude/settings.json"))).toEqual({
      attribution: { commit: "", pr: "", sessionUrl: false },
    });
  });
});
