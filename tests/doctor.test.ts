// `factory doctor`: one line per check, and a failing exit when any fails.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseSettings, SettingsError } from "../src/config.mts";
import { main, type DoctorDeps } from "../src/doctor.mts";
import { memoryCodeHost } from "./memory-code-host";
import { memoryRunner } from "./memory-runner";
import { memoryTickets } from "./memory-tickets";
import { memoryTools } from "./memory-tools";
import type { Tickets } from "../src/tickets/types.mts";
import { IMPORT_LINE, withHooks } from "../src/sync.mts";
import { builtOf, TOOLS, type Registry } from "../src/tools.mts";
import {
  FAKE_AGENT_FILE,
  FAKE_TOKEN,
  withFakeAgent,
  withFakeTickets,
} from "./fake-tools";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

/** A checkout with Claude Code's configuration as `factory sync` writes it,
 * with any file given in `files` in place of the synced one. */
function checkout(files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "doctor-"));
  roots.push(root);
  mkdirSync(join(root, ".claude"));
  const all = {
    "CLAUDE.md": `# Ours\n\n${IMPORT_LINE}\n`,
    ".claude/settings.json": withHooks(
      null,
      "node_modules/@davidbyoung/software-factory/bin/factory.js",
    ),
    ...files,
  };
  for (const [path, text] of Object.entries(all))
    writeFileSync(join(root, path), text);
  return root;
}

const settings = (raw: Record<string, unknown> = {}, tools: Registry = TOOLS) =>
  parseSettings(
    { version: 2, repository: "acme/site", ...raw },
    () => true,
    builtOf(tools),
  );

function doctor(o: {
  raw?: Record<string, unknown>;
  invalid?: string;
  outOfStep?: string[];
  installed?: string;
  locked?: string | null;
  secrets?: Record<string, string>;
  columns?: string[];
  files?: Record<string, string>;
  claude?: boolean;
  tools?: (base: Registry, tickets: Tickets) => Registry;
}) {
  const out: string[] = [];
  const tickets = memoryTickets([], {
    fields: [
      {
        id: "S",
        name: "Status",
        dataType: "SINGLE_SELECT",
        options: (o.columns ?? []).map((name) => ({ id: name, name })),
      },
    ],
  }).tickets;
  const tools = (o.tools ?? ((b) => b))(
    memoryTools({
      codeHost: memoryCodeHost([], { owner: "dave" }).codeHost,
      runner: memoryRunner({ secrets: o.secrets ?? {} }).runner,
      tickets,
    }),
    tickets,
  );
  const d: DoctorDeps = {
    settings: async () => {
      if (o.invalid) throw new SettingsError(o.invalid);
      return settings(o.raw, tools);
    },
    outOfStep: () => o.outOfStep ?? [],
    versions: () => ({
      installed: o.installed ?? "0.2.0",
      locked: o.locked === undefined ? "0.2.0" : o.locked,
    }),
    root: checkout(o.files),
    hasCommand: (name) => name !== "claude" || o.claude !== false,
    tools,
    out: (line) => out.push(line),
  };
  return { run: () => main([], d), out };
}

const SIX = [
  "Backlog",
  "In refinement",
  "Ready",
  "In progress",
  "In review",
  "Done",
];

describe("factory doctor", () => {
  it("passes a repository with only the basics, listing every part as off", async () => {
    const { run, out } = doctor({});
    expect(await run()).toBe(0);
    expect(out).toEqual([
      "✓ The settings are valid",
      "✓ The factory's files match the settings",
      "✓ Version 0.2.0 is installed, as the repository records",
      "✓ Signed in to the code host as dave",
      "- An automated review of every pull request: off",
      "- A board: off",
      "- Builds in the cloud: off",
      "- Builds that start when you move a card to Ready: off",
      "- Pull requests that merge themselves: off",
      "- Signed commits from cloud builds: off",
      "- commands.gate is not set: a build cannot finish until it is",
      "✓ Claude Code: CLAUDE.md imports the factory's rules",
      "✓ Claude Code: .claude/settings.json has the factory's hooks",
      "✓ Claude Code: the claude command is installed",
    ]);
  });

  it("prints the same lines, word for word, with every part on", async () => {
    const { run, out } = doctor({
      raw: {
        "ci-review": null,
        tickets: { board: 3 },
        builds: { trigger: "own-server" },
        "auto-merge": { allow: ["docs/**"] },
        commands: { gate: ["npm run check"] },
      },
      secrets: {
        CLAUDE_CODE_OAUTH_TOKEN: "x",
        FACTORY_BOARD_TOKEN: "x",
        FACTORY_AUTOMERGE_TOKEN: "x",
        FACTORY_SIGNING_KEY: "x",
      },
      columns: SIX,
    });
    expect(await run()).toBe(0);
    expect(out).toMatchInlineSnapshot(`
      [
        "✓ The settings are valid",
        "✓ The factory's files match the settings",
        "✓ Version 0.2.0 is installed, as the repository records",
        "✓ Signed in to the code host as dave",
        "✓ CLAUDE_CODE_OAUTH_TOKEN is set, for an automated review of every pull request",
        "✓ FACTORY_BOARD_TOKEN is set, for a board",
        "✓ CLAUDE_CODE_OAUTH_TOKEN is set, for builds in the cloud",
        "✓ FACTORY_BOARD_TOKEN is set, for builds in the cloud",
        "✓ FACTORY_BOARD_TOKEN is set, for builds that start when you move a card to Ready",
        "✓ FACTORY_AUTOMERGE_TOKEN is set, for pull requests that merge themselves",
        "✓ FACTORY_SIGNING_KEY is set, for signed commits from cloud builds",
        "✓ Board 3 has every column the settings name",
        "✓ Claude Code: CLAUDE.md imports the factory's rules",
        "✓ Claude Code: .claude/settings.json has the factory's hooks",
        "✓ Claude Code: the claude command is installed",
      ]
    `);
  });

  describe("the gate", () => {
    const GATE =
      "- commands.gate is not set: a build cannot finish until it is";
    const SET = { commands: { gate: ["npm run check"] } };

    it("shows a gate that is not set as off, without failing", async () => {
      const { run, out } = doctor({});
      expect(await run()).toBe(0);
      expect(out.filter((l) => l.includes("commands.gate"))).toEqual([GATE]);
    });

    it("shows an empty list as not set", async () => {
      const { run, out } = doctor({ raw: { commands: { gate: [] } } });
      expect(await run()).toBe(0);
      expect(out).toContain(GATE);
    });

    it("prints no line about a gate that is set", async () => {
      const { run, out } = doctor({ raw: SET });
      expect(await run()).toBe(0);
      expect(out.join("\n")).not.toContain("commands.gate");
    });

    it("still fails when another check fails, set or not", async () => {
      const missing = doctor({ outOfStep: ["a"] });
      const set = doctor({ raw: SET, outOfStep: ["a"] });
      expect([await missing.run(), await set.run()]).toEqual([1, 1]);
      expect(missing.out.filter((l) => !l.includes("commands.gate"))).toEqual(
        set.out,
      );
    });
  });

  it("stops at settings it cannot read, and fails", async () => {
    const { run, out } = doctor({ invalid: "tickets.board: must be a number" });
    expect(await run()).toBe(1);
    expect(out).toEqual([
      "✗ The settings are valid: tickets.board: must be a number",
    ]);
  });

  it("fails when the files are out of step, saying what to run", async () => {
    const { run, out } = doctor({ outOfStep: ["a", "b"] });
    expect(await run()).toBe(1);
    expect(out[1]).toBe(
      "✗ The factory's files match the settings: 2 differ. Run npx --no-install factory sync",
    );
  });

  it("tells someone behind the repository's version to install it", async () => {
    const { run, out } = doctor({ installed: "0.1.0", locked: "0.2.0" });
    expect(await run()).toBe(1);
    expect(out[2]).toBe(
      "✗ Version 0.1.0 is installed, but the repository records 0.2.0. Run npm ci",
    );
  });

  it("tells someone ahead of the repository's version to sync", async () => {
    const { run, out } = doctor({ installed: "0.3.0", locked: "0.2.0" });
    expect(await run()).toBe(1);
    expect(out[2]).toBe(
      "✗ Version 0.3.0 is installed, but the repository records 0.2.0. Run npx --no-install factory sync",
    );
  });

  it("passes a placeholder version the repository records, as the factory's own does", async () => {
    const { run, out } = doctor({
      installed: "0.0.0-development",
      locked: "0.0.0-development",
    });
    await run();
    expect(out[2]).toBe(
      "✓ Version 0.0.0-development is installed, as the repository records",
    );
  });

  it("checks each secret a part that is on reads", async () => {
    const { run, out } = doctor({
      raw: { "ci-review": null, "auto-merge": { allow: ["docs/**"] } },
      secrets: { CLAUDE_CODE_OAUTH_TOKEN: "x" },
    });
    expect(await run()).toBe(1);
    expect(out).toContain(
      "✓ CLAUDE_CODE_OAUTH_TOKEN is set, for an automated review of every pull request",
    );
    expect(out).toContain(
      "✗ FACTORY_AUTOMERGE_TOKEN is not set, for pull requests that merge themselves. Run npx --no-install factory init",
    );
  });

  it("passes a board that has every column the settings name", async () => {
    const r = doctor({
      raw: { tickets: { board: 3 } },
      secrets: { FACTORY_BOARD_TOKEN: "x" },
      columns: SIX,
    });
    expect(await r.run()).toBe(0);
    expect(r.out).toContain("✓ Board 3 has every column the settings name");
  });

  it("fails a board that lacks a column, naming it", async () => {
    const r = doctor({
      raw: { tickets: { board: 3 } },
      secrets: { FACTORY_BOARD_TOKEN: "x" },
      columns: ["Backlog", "Done"],
    });
    expect(await r.run()).toBe(1);
    expect(r.out.find((l) => l.startsWith("✗ Board"))).toMatch(
      /^✗ Board 3: the Status field lacks In refinement .*\. Run npx --no-install factory init$/,
    );
  });

  describe("a tool of another kind", () => {
    const FAKE = {
      tickets: { type: "fake", site: "https://tickets.example" },
    };
    const fake = (b: Registry, t: Tickets) => withFakeTickets(b, t);

    it("fails on a secret the tool always needs, naming the tool", async () => {
      const r = doctor({ raw: FAKE, tools: fake });
      expect(await r.run()).toBe(1);
      expect(r.out).toContain(
        `✗ ${FAKE_TOKEN} is not set, for Fake Tickets. Run npx --no-install factory init`,
      );
    });

    it("prints the tool's own failing check in its words, and fails", async () => {
      const r = doctor({
        raw: { tickets: { type: "fake", site: "down" } },
        secrets: { [FAKE_TOKEN]: "x" },
        tools: fake,
      });
      expect(await r.run()).toBe(1);
      expect(r.out).toContain(
        "✗ Fake Tickets can be reached: check tickets.site",
      );
    });
  });

  describe("the coding agent's configuration", () => {
    it("passes Claude Code's three pieces when each is there", async () => {
      const r = doctor({});
      expect(await r.run()).toBe(0);
      expect(r.out.slice(-3)).toEqual([
        "✓ Claude Code: CLAUDE.md imports the factory's rules",
        "✓ Claude Code: .claude/settings.json has the factory's hooks",
        "✓ Claude Code: the claude command is installed",
      ]);
    });

    it("fails without the import, saying to sync", async () => {
      const r = doctor({ files: { "CLAUDE.md": "# Ours\n" } });
      expect(await r.run()).toBe(1);
      expect(r.out).toContain(
        "✗ Claude Code: CLAUDE.md imports the factory's rules. Run npx --no-install factory sync",
      );
    });

    it("fails when one of the factory's hooks is gone, saying to sync", async () => {
      const synced = JSON.parse(
        withHooks(
          null,
          "node_modules/@davidbyoung/software-factory/bin/factory.js",
        ),
      );
      delete synced.hooks.SubagentStop;
      const r = doctor({
        files: { ".claude/settings.json": JSON.stringify(synced) },
      });
      expect(await r.run()).toBe(1);
      expect(r.out).toContain(
        "✗ Claude Code: .claude/settings.json has the factory's hooks. Run npx --no-install factory sync",
      );
    });

    it("fails when the claude command is not installed", async () => {
      const r = doctor({ claude: false });
      expect(await r.run()).toBe(1);
      expect(r.out).toContain(
        "✗ Claude Code: the claude command is installed: Install Claude Code, then sign in",
      );
    });

    it("fails on another agent's missing configuration in its words", async () => {
      const r = doctor({ tools: (b) => withFakeAgent(b) });
      expect(await r.run()).toBe(1);
      expect(r.out.at(-1)).toBe(
        `✗ Fake Agent: ${FAKE_AGENT_FILE} is there. Run fake-agent init`,
      );
      expect(r.out.join("\n")).not.toContain("Claude Code");
    });
  });
});
