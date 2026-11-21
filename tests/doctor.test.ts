// `factory doctor`: one line per check, and a failing exit when any fails.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseSettings, SettingsError } from "../src/config.mts";
import { line, main, type DoctorDeps } from "../src/doctor.mts";
import { painter, type Paint } from "../src/lib/color.mts";
import { memoryCodeHost } from "./memory-code-host";
import { memoryRunner } from "./memory-runner";
import { memoryTickets } from "./memory-tickets";
import { memoryTools } from "./memory-tools";
import type { Group, TicketField, Tickets } from "../src/tickets/types.mts";
import { IMPORT_LINE, withHooks } from "../src/sync.mts";
import { NoDefaultBranch } from "../src/lib/default-branch.mts";
import { builtOf, TOOLS, type Registry } from "../src/tools.mts";
import {
  FAKE_AGENT_FILE,
  FAKE_TOKEN,
  withFakeAgent,
  withFakeTickets,
} from "./fake-tools";
import { FACTORY_COLUMNS } from "./factory-columns";
import { CODE_HOST } from "./settings-fixture";

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
  for (const [path, text] of Object.entries(all)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const settings = (raw: Record<string, unknown> = {}, tools: Registry = TOOLS) =>
  parseSettings(
    { version: 2, repository: "acme/site", "code-host": CODE_HOST, ...raw },
    () => true,
    builtOf(tools),
  );

function doctor(o: {
  raw?: Record<string, unknown>;
  invalid?: string;
  outOfStep?: string[];
  /** The default branch, which the sync writes, cannot be told. */
  noDefaultBranch?: boolean;
  installed?: string;
  locked?: string | null;
  secrets?: Record<string, string>;
  dependabotSecrets?: Record<string, string>;
  organizationSecrets?: string[];
  organizationDependabotSecrets?: string[] | null;
  /** Whether an organization owns the repository; a person unless given. */
  organization?: boolean;
  /** What a runner operation fails with. */
  runnerFails?: NonNullable<Parameters<typeof memoryRunner>[0]>["fail"];
  codeHostFails?: NonNullable<Parameters<typeof memoryCodeHost>[1]>["fail"];
  columns?: string[];
  files?: Record<string, string>;
  paint?: Paint;
  claude?: boolean;
  tools?: (base: Registry, tickets: Tickets) => Registry;
  ticketFields?: TicketField[];
  ticketGroups?: Group[];
  ticketsFail?: NonNullable<Parameters<typeof memoryTickets>[1]>["fail"];
}) {
  /** Each check's line, without its heading's indent; `printed` is the
   * output as printed, headings included. */
  const out: string[] = [];
  const printed: string[] = [];
  const tickets = memoryTickets([], {
    ticketFields: o.ticketFields,
    groups: o.ticketGroups,
    fail: o.ticketsFail,
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
      codeHost: memoryCodeHost([], {
        owner: "dave",
        ownerIsOrganization: o.organization,
        fail: o.codeHostFails,
      }).codeHost,
      runner: memoryRunner({
        secrets: o.secrets ?? {},
        dependabotSecrets: o.dependabotSecrets,
        organizationSecrets: o.organizationSecrets,
        organizationDependabotSecrets: o.organizationDependabotSecrets,
        fail: o.runnerFails,
      }).runner,
      tickets,
    }),
    tickets,
  );
  const d: DoctorDeps = {
    settings: async () => {
      if (o.invalid) throw new SettingsError(o.invalid);
      return settings(o.raw, tools);
    },
    outOfStep: async () => {
      if (o.noDefaultBranch) throw new NoDefaultBranch();
      return o.outOfStep ?? [];
    },
    versions: () => ({
      installed: o.installed ?? "0.2.0",
      locked: o.locked === undefined ? "0.2.0" : o.locked,
    }),
    root: checkout(o.files),
    hasCommand: (name) => name !== "claude" || o.claude !== false,
    tools,
    out: (line) => {
      printed.push(line);
      if (line.startsWith("  ")) out.push(line.slice(2));
    },
    paint: o.paint,
  };
  return { run: () => main([], d), out, printed };
}

/** The checks printed under `heading`, without their indent. */
const section = (printed: string[], heading: string) => {
  const at = printed.indexOf(heading);
  if (at < 0) return [];
  const end = printed.indexOf("", at);
  return printed
    .slice(at + 1, end < 0 ? undefined : end)
    .map((l) => l.slice(2));
};

const SIX = [
  "Backlog",
  "In refinement",
  "Ready",
  "In progress",
  "In review",
  "Done",
];

describe("factory doctor", () => {
  it("passes a repository with only the basics, listing every part as off, under headings", async () => {
    const { run, printed } = doctor({});
    expect(await run()).toBe(0);
    expect(printed).toEqual([
      "Settings and files",
      "  ✓ The settings are valid",
      "  ✓ The factory's files match the settings",
      "  ✓ Version 0.2.0 is installed, as the repository records",
      "  - commands.gate is not set: a build cannot finish until it is",
      "",
      "GitHub",
      "  ✓ Signed in as dave",
      "",
      "Claude Code",
      "  ✓ CLAUDE.md imports the factory's rules",
      "  ✓ .claude/settings.json has the factory's hooks",
      "  ✓ The claude command is installed",
      "",
      "Parts that are off",
      "  - An automated review of every pull request",
      "  - A board",
      "  - Builds in the cloud",
      "  - Builds that start when you move a card to Ready",
      "  - Pull requests that merge themselves",
      "  - Signed commits from cloud builds",
    ]);
  });

  it("prints each secret once, naming every part that reads it, under the runner's name", async () => {
    const { run, printed } = doctor({
      raw: {
        "pr-review": null,
        tickets: { board: 3, columns: FACTORY_COLUMNS },
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
    expect(printed).toEqual([
      "Settings and files",
      "  ✓ The settings are valid",
      "  ✓ The factory's files match the settings",
      "  ✓ Version 0.2.0 is installed, as the repository records",
      "",
      "GitHub",
      "  ✓ Signed in as dave",
      "",
      "GitHub Actions",
      "  ✓ CLAUDE_CODE_OAUTH_TOKEN is set, for an automated review of every pull request and builds in the cloud",
      "  ✓ FACTORY_BOARD_TOKEN is set, for a board, builds in the cloud, and builds that start when you move a card to Ready",
      "  ✓ FACTORY_AUTOMERGE_TOKEN is set, for pull requests that merge themselves",
      "  ✓ FACTORY_SIGNING_KEY is set, for signed commits from cloud builds",
      "",
      "GitHub Issues",
      "  ✓ Board 3 has every column the settings name",
      "",
      "Claude Code",
      "  ✓ CLAUDE.md imports the factory's rules",
      "  ✓ .claude/settings.json has the factory's hooks",
      "  ✓ The claude command is installed",
    ]);
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
      "✗ The factory's files match the settings: 2 differ. Run factory sync",
    );
  });

  it("fails, naming the fix, when it cannot tell the default branch the sync writes", async () => {
    const { run, out } = doctor({ noDefaultBranch: true });
    expect(await run()).toBe(1);
    expect(out[1]).toBe(
      "✗ The factory's files match the settings: Could not tell the default branch. Run: git remote set-head origin --auto",
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
      "✗ Version 0.3.0 is installed, but the repository records 0.2.0. Run factory sync",
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
      raw: { "pr-review": null, "auto-merge": { allow: ["docs/**"] } },
      secrets: { CLAUDE_CODE_OAUTH_TOKEN: "x" },
    });
    expect(await run()).toBe(1);
    expect(out).toContain(
      "✓ CLAUDE_CODE_OAUTH_TOKEN is set, for an automated review of every pull request",
    );
    expect(out).toContain(
      "✗ FACTORY_AUTOMERGE_TOKEN is not set, for pull requests that merge themselves. Run factory init",
    );
  });

  it("passes a board that has every column the settings name", async () => {
    const r = doctor({
      raw: { tickets: { board: 3, columns: FACTORY_COLUMNS } },
      secrets: { FACTORY_BOARD_TOKEN: "x" },
      columns: SIX,
    });
    expect(await r.run()).toBe(0);
    expect(r.out).toContain("✓ Board 3 has every column the settings name");
  });

  it("fails a board that lacks a column, naming it", async () => {
    const r = doctor({
      raw: { tickets: { board: 3, columns: FACTORY_COLUMNS } },
      secrets: { FACTORY_BOARD_TOKEN: "x" },
      columns: ["Backlog", "Done"],
    });
    expect(await r.run()).toBe(1);
    expect(r.out.find((l) => l.startsWith("✗ Board"))).toMatch(
      /^✗ Board 3: the Status field lacks In refinement .*\. Run factory init$/,
    );
  });

  it("passes a board only when it has every name a state's list gives", async () => {
    const board = (columns: string[]) =>
      doctor({
        raw: {
          tickets: {
            board: 3,
            columns: { ...FACTORY_COLUMNS, review: ["In review", "QA"] },
          },
        },
        secrets: { FACTORY_BOARD_TOKEN: "x" },
        columns,
      });
    const all = board([...SIX, "QA"]);
    expect(await all.run()).toBe(0);
    expect(all.out).toContain("✓ Board 3 has every column the settings name");
    const lacking = board(SIX);
    expect(await lacking.run()).toBe(1);
    expect(lacking.out.find((l) => l.startsWith("✗ Board"))).toBe(
      "✗ Board 3: the Status field lacks QA (tickets.columns.review). Run factory init",
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
        `✗ ${FAKE_TOKEN} is not set, for Fake Tickets. Run factory init`,
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
      expect(section(r.printed, "Claude Code")).toEqual([
        "✓ CLAUDE.md imports the factory's rules",
        "✓ .claude/settings.json has the factory's hooks",
        "✓ The claude command is installed",
      ]);
    });

    it("fails without the import, saying to sync", async () => {
      const r = doctor({ files: { "CLAUDE.md": "# Ours\n" } });
      expect(await r.run()).toBe(1);
      expect(r.out).toContain(
        "✗ CLAUDE.md imports the factory's rules. Run factory sync",
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
        "✗ .claude/settings.json has the factory's hooks. Run factory sync",
      );
    });

    it("fails when the claude command is not installed", async () => {
      const r = doctor({ claude: false });
      expect(await r.run()).toBe(1);
      expect(r.out).toContain(
        "✗ The claude command is installed: Install Claude Code, then sign in",
      );
    });

    it("fails on another agent's missing configuration in its words", async () => {
      const r = doctor({ tools: (b) => withFakeAgent(b) });
      expect(await r.run()).toBe(1);
      expect(section(r.printed, "Fake Agent")).toEqual([
        `✗ ${FAKE_AGENT_FILE} is there. Run fake-agent init`,
      ]);
      expect(r.printed).not.toContain("Claude Code");
    });
  });

  describe("the tokens .npmrc reads", () => {
    const JFROG = "https://acme.jfrog.io/artifactory/api/npm/npm/";
    const NPMRC = `@acme:registry=${JFROG}\n//acme.jfrog.io/artifactory/api/npm/npm/:_authToken=\${NPM_TOKEN}\n`;
    const SET = "✓ NPM_TOKEN is set, for installing what .npmrc names";
    const SET_DEPENDABOT =
      "✓ NPM_TOKEN is set for Dependabot, for installing on Dependabot's pull requests";
    const DEPENDABOT = (registry: string, npm: string) =>
      [
        "version: 2",
        "registries:",
        "  acme:",
        "    type: npm-registry",
        `    url: ${registry}`,
        "    token: ${{secrets.NPM_TOKEN}}",
        "updates:",
        "  - package-ecosystem: npm",
        "    directory: /",
        npm,
        "    schedule:",
        "      interval: weekly",
        "",
      ].join("\n");
    const npmLines = (out: string[]) =>
      out.filter((l) => /NPM_TOKEN|GITHUB_TOKEN|dependabot\.yml/.test(l));

    it("prints nothing about .npmrc when it reads no token", async () => {
      const { run, out } = doctor({
        files: {
          ".npmrc": `cache=\${HOME}/.npm\n@acme:registry=${JFROG}\n`,
          ".github/dependabot.yml": "version: 2\nupdates: []\n",
        },
      });
      expect(await run()).toBe(0);
      const without = doctor({
        files: { ".github/dependabot.yml": "version: 2\nupdates: []\n" },
      });
      await without.run();
      expect(out).toEqual(without.out);
    });

    it("passes a token set for Actions and for Dependabot, and a registry Dependabot uses, under the runner's name", async () => {
      const { run, printed } = doctor({
        files: {
          ".npmrc": NPMRC,
          ".github/dependabot.yml": DEPENDABOT(JFROG, "    registries: [acme]"),
        },
        secrets: { NPM_TOKEN: "x" },
        dependabotSecrets: { NPM_TOKEN: "x" },
      });
      expect(await run()).toBe(0);
      expect(section(printed, "GitHub Actions")).toEqual([
        SET,
        SET_DEPENDABOT,
        `✓ .github/dependabot.yml uses ${JFROG} for its npm updates`,
      ]);
    });

    it("fails a token not set, for Actions and for Dependabot, naming init", async () => {
      const { run, out } = doctor({ files: { ".npmrc": NPMRC } });
      expect(await run()).toBe(1);
      expect(npmLines(out)).toEqual([
        "✗ NPM_TOKEN is not set, for installing what .npmrc names. Run factory init",
        "✗ NPM_TOKEN is not set for Dependabot, for installing on Dependabot's pull requests. Run factory init",
      ]);
    });

    it("shows GITHUB_TOKEN as the workflow's own, asking for no secret", async () => {
      const { run, out } = doctor({
        files: {
          ".npmrc": "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}\n",
        },
      });
      expect(await run()).toBe(0);
      expect(npmLines(out)).toEqual([
        "- GITHUB_TOKEN is the workflow's own token: it installs only the packages that give this repository access",
      ]);
    });

    it.each([
      [
        "a registry the npm update doesn't name",
        DEPENDABOT(JFROG, "    registries: [other]"),
      ],
      [
        "a registry not listed",
        DEPENDABOT("https://other.example/", "    registries: [acme]"),
      ],
      [
        "an npm update with no registries",
        DEPENDABOT(JFROG, "    open-pull-requests-limit: 5"),
      ],
      [
        "a second npm update that doesn't name it",
        `${DEPENDABOT(JFROG, "    registries: [acme]")}  - package-ecosystem: npm\n    directory: /web\n    schedule:\n      interval: weekly\n`,
      ],
      [
        "no npm update",
        DEPENDABOT(JFROG, "    registries: [acme]").replace(
          "package-ecosystem: npm",
          "package-ecosystem: github-actions",
        ),
      ],
    ])("marks %s as unknown, without failing", async (_, settings) => {
      const { run, out } = doctor({
        files: { ".npmrc": NPMRC, ".github/dependabot.yml": settings },
        secrets: { NPM_TOKEN: "x" },
        dependabotSecrets: { NPM_TOKEN: "x" },
      });
      expect(await run()).toBe(0);
      expect(npmLines(out).at(-1)).toBe(
        `? .github/dependabot.yml doesn't use ${JFROG} for its npm updates: unless your organization sets that registry for Dependabot, it never sees a new version of a package from there. Add it under registries, and name it in the npm entry's registries`,
      );
    });

    it('passes registries: "*" and a URL that differs by a trailing slash', async () => {
      const r = doctor({
        files: {
          ".npmrc": NPMRC,
          ".github/dependabot.yml": DEPENDABOT(
            JFROG.replace(/\/$/, ""),
            '    registries: "*"',
          ),
        },
      });
      await r.run();
      expect(r.out).toContain(
        `✓ .github/dependabot.yml uses ${JFROG} for its npm updates`,
      );
    });

    it("checks no registry Dependabot needn't know, the public one", async () => {
      const { out, run } = doctor({
        files: {
          ".npmrc": `registry=https://registry.npmjs.org/\n${NPMRC}`,
          ".github/dependabot.yml": DEPENDABOT(JFROG, "    registries: [acme]"),
        },
      });
      await run();
      expect(out.filter((l) => l.includes("dependabot.yml"))).toEqual([
        `✓ .github/dependabot.yml uses ${JFROG} for its npm updates`,
      ]);
    });

    it("checks no registry without a dependabot.yml", async () => {
      const { out, run } = doctor({ files: { ".npmrc": NPMRC } });
      await run();
      expect(out.join("\n")).not.toContain("dependabot.yml");
    });

    describe("on a repository an organization owns", () => {
      it("passes a secret the organization shares, saying so, for any secret the factory reads", async () => {
        const { run, out } = doctor({
          raw: { "pr-review": null },
          files: { ".npmrc": NPMRC },
          organization: true,
          organizationSecrets: ["NPM_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN"],
          organizationDependabotSecrets: ["NPM_TOKEN"],
        });
        expect(await run()).toBe(0);
        expect(out).toContain(
          "✓ CLAUDE_CODE_OAUTH_TOKEN is set by the organization, for an automated review of every pull request",
        );
        expect(npmLines(out)).toEqual([
          "✓ NPM_TOKEN is set by the organization, for installing what .npmrc names",
          "✓ NPM_TOKEN is set by the organization for Dependabot, for installing on Dependabot's pull requests",
        ]);
      });

      it("marks a Dependabot secret it can't see as unknown, without failing", async () => {
        const { run, out } = doctor({
          files: { ".npmrc": NPMRC },
          secrets: { NPM_TOKEN: "x" },
          organization: true,
          organizationDependabotSecrets: null,
        });
        expect(await run()).toBe(0);
        expect(npmLines(out)).toEqual([
          SET,
          "? NPM_TOKEN is not set for Dependabot on the repository, and only an organization admin can see whether the organization sets it",
        ]);
      });

      it("reads an owner it can't tell as an organization, so a Dependabot secret it can't see is unknown", async () => {
        const { run, out } = doctor({
          files: { ".npmrc": NPMRC },
          secrets: { NPM_TOKEN: "x" },
          codeHostFails: { ownerIsOrganization: new Error("HTTP 502") },
          organizationDependabotSecrets: null,
        });
        expect(await run()).toBe(0);
        expect(npmLines(out).at(-1)).toMatch(
          /^\? NPM_TOKEN is not set for Dependabot on the repository/,
        );
      });

      it("fails a Dependabot secret the organization's list doesn't name", async () => {
        const { run, out } = doctor({
          files: { ".npmrc": NPMRC },
          secrets: { NPM_TOKEN: "x" },
          organization: true,
          organizationDependabotSecrets: [],
        });
        expect(await run()).toBe(1);
        expect(npmLines(out).at(-1)).toBe(
          "✗ NPM_TOKEN is not set for Dependabot, for installing on Dependabot's pull requests. Run factory init",
        );
      });
    });

    it("on a person's repository, fails a missing secret without asking about an organization", async () => {
      const { run, out } = doctor({
        files: { ".npmrc": NPMRC },
        secrets: { NPM_TOKEN: "x" },
        organizationDependabotSecrets: null,
      });
      expect(await run()).toBe(1);
      expect(npmLines(out).at(-1)).toMatch(
        /^✗ NPM_TOKEN is not set for Dependabot/,
      );
    });

    it("fails a Dependabot list it can't read, and prints no Dependabot line", async () => {
      const { run, out } = doctor({
        files: { ".npmrc": NPMRC },
        secrets: { NPM_TOKEN: "x" },
        runnerFails: { dependabotSecretNames: new Error("HTTP 403") },
      });
      expect(await run()).toBe(1);
      expect(out).toContain("✗ The Dependabot secrets can be listed: HTTP 403");
      expect(npmLines(out)).toEqual([SET]);
    });

    it("prints no Actions line when the secrets can't be listed, but still the rest", async () => {
      const r = doctor({
        files: { ".npmrc": NPMRC },
        dependabotSecrets: { NPM_TOKEN: "x" },
        runnerFails: { secretNames: new Error("HTTP 403") },
      });
      expect(await r.run()).toBe(1);
      expect(npmLines(r.out)).toEqual([SET_DEPENDABOT]);
    });
  });
});

describe("factory doctor, the ticket fields the settings name", () => {
  const FIELDS: TicketField[] = [
    { name: "Priority", description: null, text: false },
    { name: "Acceptance criteria", description: null, text: true },
  ];
  const named = (fields: Record<string, string>) => ({
    raw: { tickets: { fields } },
    ticketFields: FIELDS,
  });
  /** The lines the ticket field check prints, by their exact openings. */
  const about = (out: string[]) =>
    out.filter((l) =>
      [
        "✓ acme/site's tickets have every field",
        "✗ acme/site's tickets have no field called",
        "✗ acme/site's ticket fields can be read",
        "✗ GitHub Issues has no ticket fields",
        "✗ Priority, which tickets.fields",
      ].some((start) => l.startsWith(start)),
    );

  it("passes when each named field exists and holds text", async () => {
    const r = doctor(named({ spec: "Acceptance criteria" }));
    await r.run();
    expect(about(r.out)).toEqual([
      "✓ acme/site's tickets have every field the settings name",
    ]);
  });

  it("fails a field the tickets don't have, and one that doesn't hold text, each on its line", async () => {
    const r = doctor(named({ spec: "Spec", decisions: "Priority" }));
    expect(await r.run()).toBe(1);
    const lines = about(r.out);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(
      /^✗ Priority, which tickets\.fields\.decisions names, doesn't hold text/,
    );
    expect(lines[1]).toMatch(
      /^✗ acme\/site's tickets have no field called Spec, which tickets\.fields\.spec names/,
    );
  });

  it("prints nothing about ticket fields when the settings name none", async () => {
    const r = doctor({ ticketFields: FIELDS });
    await r.run();
    expect(about(r.out)).toEqual([]);
  });

  it("fails a ticket system without fields, by its label", async () => {
    const r = doctor({
      ...named({ spec: "Acceptance criteria" }),
      ticketGroups: ["board"],
    });
    expect(await r.run()).toBe(1);
    expect(about(r.out)[0]).toMatch(
      /^✗ GitHub Issues has no ticket fields, which tickets\.fields names/,
    );
  });

  it("fails with the error's first line when the fields can't be read", async () => {
    const r = doctor({
      ...named({ spec: "Acceptance criteria" }),
      ticketsFail: { fields: new Error("Server Error (HTTP 500)\nmore") },
    });
    expect(await r.run()).toBe(1);
    const line = about(r.out)[0]!;
    expect(line).toMatch(/^✗ acme\/site's ticket fields can be read/);
    expect(line).toContain("Server Error (HTTP 500)");
    expect(line).not.toContain("more");
  });
});

describe("factory doctor, in color", () => {
  const paint = painter(true);
  const strip = (s: string) => s.replace(/\x1B\[\d+m/g, "");

  it.each([
    ["pass", "✓", "green"],
    ["fail", "✗", "red"],
    ["off", "-", "dim"],
    ["unknown", "?", "yellow"],
  ] as const)(
    "colors a %s mark %s %s, and only the mark",
    (state, mark, color) => {
      const c = { state, text: "The settings are valid", fix: "Run npm ci" };
      expect(line(c, paint).startsWith(`${paint(color, mark)} `)).toBe(true);
      expect(strip(line(c, paint))).toBe(line(c));
    },
  );

  it("leaves a failing check's text and fix uncolored", () => {
    const c = {
      state: "fail" as const,
      text: "Version 0.4.0 is installed",
      fix: "Run npm ci",
    };
    expect(line(c, paint)).toBe(
      `${paint("red", "✗")} Version 0.4.0 is installed. Run npm ci`,
    );
  });

  it("prints a failing check with no fix as its mark and text alone", () => {
    expect(line({ state: "fail", text: "Board 1 can be read" }, paint)).toBe(
      `${paint("red", "✗")} Board 1 can be read`,
    );
  });

  it("prints its checks with the paint it is given", async () => {
    const { run, out } = doctor({ paint });
    await run();
    expect(out[0]).toBe(`${paint("green", "✓")} The settings are valid`);
    expect(out).toContain(`${paint("dim", "-")} A board`);
  });
});
