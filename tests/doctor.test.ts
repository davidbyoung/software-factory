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
  REFUSED,
  withFakeAgent,
  withFakeTickets,
} from "./fake-tools";
import { FACTORY_COLUMNS } from "./factory-columns";
import { CODE_HOST } from "./settings-fixture";
import { chmodSync } from "node:fs";
import { credentialsPath, writeCredential } from "../src/lib/credentials.mts";

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
  /** The default branch, which the sync writes, cannot be told, for the
   * reason this line gives. */
  noDefaultBranch?: string;
  /** The version the lock names; 0.2.0 unless given, and null for none. */
  locked?: string | null;
  /** The factory's newest release, or why it cannot be read; the version
   * the lock names unless given. */
  newest?: string | Error;
  /** The repository is the factory's own, which runs its source. */
  own?: boolean;
  secrets?: Record<string, string>;
  dependabotSecrets?: Record<string, string>;
  organizationSecrets?: string[];
  organizationDependabotSecrets?: string[] | null;
  /** Whether an organization owns the repository; a person unless given. */
  organization?: boolean;
  /** What a runner operation fails with. */
  runnerFails?: NonNullable<Parameters<typeof memoryRunner>[0]>["fail"];
  codeHostFails?: NonNullable<Parameters<typeof memoryCodeHost>[1]>["fail"];
  /** Whether the code host holds a workflow's events back, as GitHub does
   * in a public repository. */
  eventsHeld?: boolean;
  columns?: string[];
  files?: Record<string, string>;
  paint?: Paint;
  claude?: boolean;
  tools?: (base: Registry, tickets: Tickets) => Registry;
  ticketFields?: TicketField[];
  ticketGroups?: Group[];
  ticketsFail?: NonNullable<Parameters<typeof memoryTickets>[1]>["fail"];
  env?: Record<string, string | undefined>;
  /** The repository whose poller starts the builds, as the lock's pins
   * give it to the settings. */
  pollerIn?: string;
  /** The repository's value for the property its owner's rule, which
   * requires the review's verdict, applies by; `on` unless given. */
  enrolled?: string | null;
  /** Whether the repository's owner defines that property, and has the
   * rule that applies by it; it does unless given. */
  ownerRule?: boolean;
  /** Each workflow on the default branch; none unless given. */
  workflows?: Record<string, "active" | "disabled">;
  /** The plan of the owner's that keeps its shared secrets from the
   * repository, when one does. */
  secretsWithheldBy?: string;
  /** Why the code host can hold no branch rule for the repository, when
   * it cannot. */
  noRules?: string;
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
        eventsHeld: o.eventsHeld,
        secretsWithheldBy: o.secretsWithheldBy,
        noRules: o.noRules,
        ownerRules:
          o.ownerRule === false
            ? []
            : [
                {
                  check: "Review verdict",
                  property: "software-factory",
                  value: "on",
                },
              ],
        definedProperties: o.ownerRule === false ? [] : ["software-factory"],
        properties: {
          "software-factory": o.enrolled === undefined ? "on" : o.enrolled,
        },
        fail: o.codeHostFails,
      }).codeHost,
      runner: memoryRunner({
        secrets: o.secrets ?? {},
        dependabotSecrets: o.dependabotSecrets,
        organizationSecrets: o.organizationSecrets,
        organizationDependabotSecrets: o.organizationDependabotSecrets,
        workflows: o.workflows,
        fail: o.runnerFails,
      }).runner,
      tickets,
    }),
    tickets,
  );
  const d: DoctorDeps = {
    settings: async () => {
      if (o.invalid) throw new SettingsError(o.invalid);
      const s = settings(o.raw, tools);
      return o.pollerIn
        ? { ...s, builds: { ...s.builds, pollerIn: o.pollerIn } }
        : s;
    },
    outOfStep: async () => {
      if (o.noDefaultBranch) throw new NoDefaultBranch(o.noDefaultBranch);
      return o.outOfStep ?? [];
    },
    factory: async () => {
      const named = o.locked === undefined ? "0.2.0" : o.locked;
      return {
        named,
        own: o.own ?? false,
        newest: async () => {
          if (o.newest instanceof Error) throw o.newest;
          return o.newest ?? named ?? "0.2.0";
        },
      };
    },
    root: checkout(o.files),
    hasCommand: (name) => name !== "claude" || o.claude !== false,
    tools,
    out: (line) => {
      printed.push(line);
      if (line.startsWith("  ")) out.push(line.slice(2));
    },
    paint: o.paint,
    env: o.env ?? { XDG_CONFIG_HOME: "/nonexistent" },
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

describe("factory doctor, the rule that requires the review's verdict", () => {
  const REVIEW = { "pr-review": { commands: [] } };

  it("passes when a rule the code host applies to the default branch requires it, the owner's among them", async () => {
    const { run, printed } = doctor({ raw: REVIEW });
    await run();
    expect(section(printed, "GitHub")).toContain(
      '✓ "Review verdict" is required before a merge to main',
    );
  });

  const ON_MAIN = { "factory.yml": "active" } as const;
  const SET = { CLAUDE_CODE_OAUTH_TOKEN: "x" };

  it("says it is not required yet, as off on purpose, while the default branch has no factory workflow to post it", async () => {
    const { run, printed } = doctor({
      raw: REVIEW,
      enrolled: null,
      secrets: SET,
    });
    expect(await run()).toBe(0);
    expect(section(printed, "GitHub")).toContain(
      '- "Review verdict" is not required yet: the rule is made once the setup\'s pull request merges',
    );
    expect(printed.join("\n")).not.toContain("is not required before");
  });

  it("fails, naming init as the fix, once the workflow is on the default branch, where the owner has no rule of its own", async () => {
    const { run, printed } = doctor({
      raw: REVIEW,
      enrolled: null,
      ownerRule: false,
      workflows: ON_MAIN,
      secrets: SET,
    });
    expect(await run()).toBe(1);
    expect(section(printed, "GitHub")).toContain(
      '✗ "Review verdict" is not required before a merge to main. Run factory init',
    );
  });

  it.each([["off"], [null]])(
    "fails, saying what sets the property, where the owner defines it and the repository's value is %s",
    async (enrolled) => {
      const { run, printed } = doctor({
        raw: REVIEW,
        enrolled,
        workflows: ON_MAIN,
        secrets: SET,
      });
      expect(await run()).toBe(1);
      expect(section(printed, "GitHub")).toContain(
        '✗ "Review verdict" is not required before a merge to main. The next push to main sets it, or an owner of acme sets software-factory to "on" for this repository',
      );
      expect(printed.join("\n")).not.toContain("Run factory init");
    },
  );

  it("takes the workflow to be there when the runner cannot say, so a missing rule still fails", async () => {
    const { run, printed } = doctor({
      raw: REVIEW,
      enrolled: null,
      ownerRule: false,
      runnerFails: { workflowState: new Error("HTTP 500") },
      secrets: SET,
    });
    expect(await run()).toBe(1);
    expect(section(printed, "GitHub")).toContain(
      '✗ "Review verdict" is not required before a merge to main. Run factory init',
    );
  });

  it("says why when the code host cannot tell, and fails nothing", async () => {
    const { run, printed } = doctor({
      raw: REVIEW,
      codeHostFails: { requiresStatus: new Error("HTTP 403") },
      secrets: { CLAUDE_CODE_OAUTH_TOKEN: "x" },
    });
    expect(await run()).toBe(0);
    expect(section(printed, "GitHub")).toContain(
      '? Could not tell whether "Review verdict" is required: HTTP 403',
    );
  });

  it("says the verdict cannot be required, as off on purpose, where the plan has no branch rules for the repository", async () => {
    const { run, printed } = doctor({
      raw: REVIEW,
      noRules: "GitHub Free has no branch rules for a private repository",
      secrets: { CLAUDE_CODE_OAUTH_TOKEN: "x" },
    });
    expect(await run()).toBe(0);
    expect(section(printed, "GitHub")).toContain(
      '- "Review verdict" cannot be required here: GitHub Free has no branch rules for a private repository',
    );
    expect(printed.join("\n")).not.toContain("Could not tell");
  });

  it("gives the code host's reason for any other failed read, without the command that made it", async () => {
    const { run, printed } = doctor({
      raw: REVIEW,
      codeHostFails: {
        requiresStatus: new Error(
          "gh api --paginate --slurp repos/acme/site/rules/branches/main?per_page=100: gh: Server Error (HTTP 500)",
        ),
      },
      secrets: { CLAUDE_CODE_OAUTH_TOKEN: "x" },
    });
    expect(await run()).toBe(0);
    expect(section(printed, "GitHub")).toContain(
      '? Could not tell whether "Review verdict" is required: Server Error (HTTP 500)',
    );
  });

  it("prints no such line with the review off", async () => {
    const { run, printed } = doctor({ enrolled: "off" });
    await run();
    expect(printed.join("\n")).not.toContain("Review verdict");
  });
});

describe("factory doctor, the events the factory's workflow starts on", () => {
  const LINE =
    "pull_request_target is not allowed for .github/workflows/factory.yml, so GitHub runs no verdict, merge policy, or board sync on a pull request";

  it("fails, naming the fix, where the code host holds the event back and no policy allows it", async () => {
    const { run, printed } = doctor({ eventsHeld: true });
    expect(await run()).toBe(1);
    expect(section(printed, "GitHub")).toContain(`✗ ${LINE}. Run factory init`);
  });

  it("prints no line where the code host holds nothing back, as in a private repository", async () => {
    const { run, printed } = doctor({});
    expect(await run()).toBe(0);
    expect(printed.join("\n")).not.toContain("pull_request_target");
  });

  it("says it could not tell, and fails nothing, when the policies cannot be read", async () => {
    const { run, printed } = doctor({
      codeHostFails: { eventAllowed: new Error("HTTP 403") },
    });
    expect(await run()).toBe(0);
    expect(section(printed, "GitHub")).toContain(
      "? Could not tell whether pull_request_target is allowed: HTTP 403",
    );
  });
});

describe("factory doctor", () => {
  it("passes a repository with only the basics, listing every part as off, under headings", async () => {
    const { run, printed } = doctor({});
    expect(await run()).toBe(0);
    expect(printed).toEqual([
      "Settings and files",
      "  ✓ The settings are valid",
      "  ✓ The factory's files match the settings",
      "  ✓ The factory 0.2.0, the newest release",
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
      "  - Signed commits on the factory's updates",
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
      "  ✓ The factory 0.2.0, the newest release",
      "",
      "GitHub",
      "  ✓ Signed in as dave",
      '  ✓ "Review verdict" is required before a merge to main',
      "",
      "GitHub Actions",
      "  ✓ CLAUDE_CODE_OAUTH_TOKEN is set, for an automated review of every pull request and builds in the cloud",
      "  ✓ FACTORY_BOARD_TOKEN is set, for a board, builds in the cloud, and builds that start when you move a card to Ready",
      "  ✓ FACTORY_AUTOMERGE_TOKEN is set, for pull requests that merge themselves",
      "  ✓ FACTORY_SIGNING_KEY is set, for signed commits on the factory's updates",
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
    const { run, out } = doctor({
      noDefaultBranch:
        "Could not tell the default branch. Run: git remote set-head upstream --auto",
    });
    expect(await run()).toBe(1);
    expect(out[1]).toBe(
      "✗ The factory's files match the settings: Could not tell the default branch. Run: git remote set-head upstream --auto",
    );
  });

  it("fails with the line that names the repository, under one mark, when no remote is the settings' repository", async () => {
    const { run, out } = doctor({
      noDefaultBranch:
        "✗ repository: .claude/factory.yaml says o/r, and no remote here is o/r. Add the remote, or change the line and run factory sync.",
    });
    expect(await run()).toBe(1);
    expect(out[1]).toBe(
      "✗ The factory's files match the settings: repository: .claude/factory.yaml says o/r, and no remote here is o/r. Add the remote, or change the line and run factory sync.",
    );
  });

  it("says a newer release is out, and how to get it, without failing", async () => {
    const { run, out } = doctor({ locked: "0.2.0", newest: "0.3.0" });
    expect(await run()).toBe(0);
    expect(out[2]).toBe(
      "? The factory 0.2.0. 0.3.0 is released: merge its pull request, or run factory update",
    );
  });

  it("says so when the newest release cannot be read, without failing", async () => {
    const { run, out } = doctor({ newest: new Error("HTTP 503") });
    expect(await run()).toBe(0);
    expect(out[2]).toBe(
      "? The factory 0.2.0. The newest release could not be read: HTTP 503",
    );
  });

  it("fails a repository whose lock names no version", async () => {
    const { run, out } = doctor({ locked: null });
    expect(await run()).toBe(1);
    expect(out[2]).toBe(
      "✗ The repository names a version of the factory. Run factory sync",
    );
  });

  it("asks for no release in the factory's own repository, which runs its source", async () => {
    const { run, out } = doctor({
      own: true,
      locked: "0.0.0-development",
      newest: new Error("never asked"),
    });
    await run();
    expect(out[2]).toBe("✓ The factory runs from its source here");
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

      it("counts no secret the organization's plan keeps from a private repository as set, and says why", async () => {
        const { run, out } = doctor({
          raw: { "pr-review": null },
          files: { ".npmrc": NPMRC },
          organization: true,
          organizationSecrets: ["NPM_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN"],
          organizationDependabotSecrets: ["NPM_TOKEN"],
          secretsWithheldBy: "GitHub Free",
        });
        expect(await run()).toBe(1);
        expect(out).toContain(
          "✗ CLAUDE_CODE_OAUTH_TOKEN is stored for acme, and GitHub Free does not share it with a private repository",
        );
        expect(out).toContain(
          "✗ NPM_TOKEN is stored for acme, and GitHub Free does not share it with a private repository",
        );
        expect(out.join("\n")).not.toMatch(
          /(CLAUDE_CODE_OAUTH_TOKEN|NPM_TOKEN) is set by the organization,/,
        );
      });

      it("counts the repository's own copy as set, whatever the plan keeps back", async () => {
        const { run, out } = doctor({
          raw: { "pr-review": null },
          organization: true,
          secrets: { CLAUDE_CODE_OAUTH_TOKEN: "x" },
          organizationSecrets: ["CLAUDE_CODE_OAUTH_TOKEN"],
          secretsWithheldBy: "GitHub Free",
        });
        expect(await run()).toBe(0);
        expect(out).toContain(
          "✓ CLAUDE_CODE_OAUTH_TOKEN is set, for an automated review of every pull request",
        );
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

describe("factory doctor, a credential kept on the machine", () => {
  const SITE = "acme.example";
  const RAW = { tickets: { type: "fake", site: SITE } };
  const PAIR = {
    FAKE_TICKETS_EMAIL: "dana@acme.example",
    FAKE_TICKETS_TOKEN: "t0k",
  };
  const fake = (b: Registry, t: Tickets) =>
    withFakeTickets(b, t, true, { credential: true });
  const run = async (
    machine: Record<string, string> | null,
    o: { env?: Record<string, string>; spoil?: (path: string) => void } = {},
  ) => {
    const env = {
      XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), "doctor-config-")),
      ...o.env,
    };
    if (machine)
      writeCredential({ tool: "fake", site: SITE, values: machine, env });
    o.spoil?.(credentialsPath(env));
    const r = doctor({
      raw: RAW,
      tools: fake,
      secrets: { FAKE_TICKETS_TOKEN: "x" },
      env,
    });
    const code = await r.run();
    return {
      code,
      lines: section(r.printed, "Fake Tickets"),
      path: credentialsPath(env),
    };
  };

  it("says whose the credential on this machine is, and runs the tool's own checks", async () => {
    const r = await run(PAIR);
    expect(r.code).toBe(0);
    expect(r.lines).toEqual([
      "✓ The credential on this machine is accepted, for Fake User",
      "✓ Fake Tickets can be reached",
    ]);
  });

  it("names the variables when the credential came from them", async () => {
    const r = await run(null, { env: PAIR });
    expect(r.lines[0]).toBe(
      "✓ The credential in FAKE_TICKETS_EMAIL and FAKE_TICKETS_TOKEN is accepted, for Fake User",
    );
  });

  it("says to replace refused variables where they are set", async () => {
    const r = await run(null, {
      env: { ...PAIR, FAKE_TICKETS_TOKEN: REFUSED },
    });
    expect(r.code).toBe(1);
    expect(r.lines).toEqual([
      "✗ The credential in FAKE_TICKETS_EMAIL and FAKE_TICKETS_TOKEN is refused (401 Unauthorized). They may have expired: replace them where they are set",
    ]);
  });

  it.each([
    [
      "missing",
      null,
      "✗ No credential on this machine for acme.example. Run factory init",
    ],
    [
      "refused",
      { ...PAIR, FAKE_TICKETS_TOKEN: REFUSED },
      "✗ The credential on this machine is refused (401 Unauthorized). It may have expired. Run factory init",
    ],
    [
      "not checked",
      { ...PAIR, FAKE_TICKETS_TOKEN: "down" },
      "✗ The credential on this machine could not be checked (Fake Tickets is down.). Check that acme.example can be reached. Run factory doctor",
    ],
  ])(
    "fails when it is %s, with the fix, and skips the tool's own checks",
    async (_, machine, expected) => {
      const r = await run(machine);
      expect(r.code).toBe(1);
      expect(r.lines).toEqual([expected]);
    },
  );

  it("fails on a file others can read, naming the chmod", async () => {
    const r = await run(PAIR, { spoil: (p) => chmodSync(p, 0o644) });
    expect(r.lines).toEqual([
      `✗ ${r.path} can be read by others. Run chmod 600 ${r.path}`,
    ]);
  });

  it("fails on a file that is not YAML", async () => {
    const r = await run(PAIR, { spoil: (p) => writeFileSync(p, "fake: [") });
    expect(r.lines).toEqual([
      `✗ ${r.path} is not valid YAML. Fix or delete it. Run factory init`,
    ]);
  });
});

describe("factory doctor, where the organization's poller starts the builds", () => {
  const ORG = "acme/factory-config";
  /** Doctor in a repository whose builds that repository's poller starts,
   * with the state of each workflow there, and of this repository's own. */
  const run = async (
    there: Record<string, "active" | "disabled"> | Error,
    pollerIn: string | undefined = ORG,
  ) => {
    const opened: string[] = [];
    const { run, printed } = doctor({
      raw: { builds: { trigger: "github-action" } },
      pollerIn,
      tools: (base) => ({
        ...base,
        runner: {
          "github-actions": {
            ...base.runner["github-actions"]!,
            open: (repository) => {
              opened.push(repository);
              return memoryRunner({
                secrets: { FACTORY_BOARD_TOKEN: "ghp_x" },
                workflows:
                  repository !== ORG
                    ? { "factory.yml": "active" }
                    : there instanceof Error
                      ? {}
                      : there,
                fail:
                  repository === ORG && there instanceof Error
                    ? { workflowState: there }
                    : {},
              }).runner;
            },
          },
        },
      }),
    });
    const code = await run();
    return {
      code,
      lines: section(printed, "GitHub Actions").filter((l) => /\.yml/.test(l)),
      opened,
    };
  };

  it("says its workflow is enabled there, in place of this repository's own workflow", async () => {
    const r = await run({ "factory-poller.yml": "active" });
    expect(r.lines).toEqual([
      "✓ factory-poller.yml is enabled in acme/factory-config",
    ]);
    expect(r.code).toBe(0);
    expect(r.opened).toEqual(["acme/site", ORG]);
  });

  it("fails when it is disabled there, naming that repository's Actions tab", async () => {
    const r = await run({ "factory-poller.yml": "disabled" });
    expect(r.lines).toEqual([
      "✗ factory-poller.yml is disabled in acme/factory-config: Enable it on the Actions tab of acme/factory-config",
    ]);
    expect(r.code).toBe(1);
  });

  it("fails when the default branch there no longer has it", async () => {
    const r = await run({});
    expect(r.lines).toEqual([
      "✗ factory-poller.yml is not on the default branch of acme/factory-config: An owner of acme runs factory init --org again",
    ]);
    expect(r.code).toBe(1);
  });

  it("cannot tell, and fails nothing, when that repository's workflows cannot be read", async () => {
    const r = await run(new Error("HTTP 404: Not Found"));
    expect(r.lines).toEqual([
      "? Could not tell whether factory-poller.yml is enabled in acme/factory-config: HTTP 404: Not Found",
    ]);
    expect(r.code).toBe(0);
  });

  it("checks this repository's own workflow where no other repository's poller starts its builds", async () => {
    const r = await run({}, "");
    expect(r.lines).toEqual(["✓ factory.yml is enabled"]);
    expect(r.opened).toEqual(["acme/site"]);
  });
});
