// A value that is not valid is refused in the same words by everything that
// reads a settings file or a preset. Each reader is run whole, as its
// command runs, on the same value.
import { rmSync } from "node:fs";
import { load } from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";
import { main as initOrg, type InitOrgDeps } from "../src/init-org.mts";
import { oncePreset } from "../src/poller.mts";
import { main as presetCommand } from "../src/preset-commands.mts";
import { movePins, type PinMove } from "../src/preset-fetch.mts";
import { main as sync, PACKAGE } from "../src/sync.mts";
import { main as update, type UpdateDeps } from "../src/update.mts";
import {
  defaultDeps,
  filesDeps,
  main as config,
  resolveFiles,
  staleOf,
} from "../src/config.mts";
import { init } from "./init-harness";
import { memoryTools } from "./memory-tools";
import { memoryCodeHost } from "./memory-code-host";
import { memoryRunner } from "./memory-runner";
import { memoryTickets } from "./memory-tickets";
import {
  ACME,
  deps,
  fetching,
  own,
  publish,
  put,
  remoteOf,
  repo,
} from "./preset-fixture";
import { into } from "./printed";
import { CODE_HOST_YAML } from "./settings-fixture";

const OWN = ".claude/factory.yaml";
const PRESET = "factory-preset.yaml";

let root: string;
afterEach(() => rmSync(root, { recursive: true, force: true }));

type Reader = {
  /** The name it puts before the words. */
  named: string;
  read: (file: string) => Promise<{ code: number; said: string[] }>;
};

/** A settings file with `lines`, and a preset whose `lines` are on the same
 * line numbers, which a message about YAML gives. */
const HEAD = [
  "version: 2",
  "repository: acme/site",
  ...CODE_HOST_YAML.split("\n"),
];
const ownFile = (lines: string[]) => [...HEAD, ...lines, ""].join("\n");
const presetFile = (lines: string[]) =>
  [...HEAD.map((l, i) => (i ? `# ${l}` : l)), ...lines, ""].join("\n");

/** The dependencies of a preset command in a repository whose own settings
 * are sound. */
const presetDepsAt = (cwd: string, said: string[]) => ({
  root,
  cwd,
  out: into(said),
  err: into(said),
  terminal: true,
  ask: async (q: string) => {
    throw new Error(`asked: ${q}`);
  },
  sync: async () => 0,
  show: () => null,
  resolve: (text: string, choices: string | null, lock?: string | null) =>
    resolveFiles({
      ...filesDeps(root, {}),
      readFile: () => text,
      readChoices: () => choices,
      ...(lock === undefined ? {} : { readLock: () => lock }),
    }),
  write: (path: string) => {
    throw new Error(`wrote: ${path}`);
  },
  read: (path: string) => (path === OWN ? own([]) : null),
  fetch: (repository: string) => fetching(repository),
  now: () => new Date("2026-11-23T12:00:00Z"),
});

const OWN_READERS: Record<string, Reader> = {
  "factory sync": {
    named: OWN,
    read: async (file) => {
      root = repo(file);
      const said: string[] = [];
      const code = await sync([], {
        root,
        pkg: PACKAGE,
        settings: () => resolveFiles(filesDeps(root, {})),
        stale: () => staleOf(defaultDeps(root, {})),
        defaultBranch: async () => "main",
        out: into(said),
        err: into(said),
        fetch: (s) => fetching(s.repository),
      });
      return { code, said };
    },
  },
  "factory config check": {
    named: OWN,
    read: async (file) => {
      root = repo(file);
      const r = deps(root);
      const code = await config(["check"], r.d);
      return { code, said: r.err };
    },
  },
  "factory init": {
    named: OWN,
    read: async (file) => {
      root = repo(own([]));
      const r = init({ settings: file, answers: {} });
      return { code: await r.run(), said: r.out };
    },
  },
};

const PRESET_READERS: Record<string, Reader> = {
  "factory preset check": {
    named: PRESET,
    read: async (file) => {
      root = repo(own([]));
      publish(ACME, { "": { settings: file } });
      const said: string[] = [];
      const code = await presetCommand(
        ["check"],
        presetDepsAt(remoteOf(ACME), said),
      );
      return { code, said };
    },
  },
  "factory preset add": {
    named: ACME,
    read: async (file) => {
      root = repo(own([]));
      publish(ACME, { "": { settings: file } });
      const said: string[] = [];
      const code = await presetCommand(["add", ACME], presetDepsAt(root, said));
      return { code, said };
    },
  },
  "factory update": {
    named: ACME,
    read: async (file) => {
      root = repo(own([]));
      const commit = publish(ACME, { "": { settings: file } });
      const said: string[] = [];
      const code = await update([], {
        hasSettings: () => true,
        own: true,
        version: () => "0.4.0",
        presets: {
          pins: () => [{ name: ACME, repo: ACME, commit: "1".repeat(40) }],
          newest: async () => commit,
          differs: async () => true,
          move: async (moves: PinMove[]) => {
            await movePins(root, moves, fetching());
          },
        },
        sync: async () => ({ code: 0, lines: [] }),
        out: into(said),
      } as unknown as UpdateDeps);
      return { code, said };
    },
  },
  "factory init --org": {
    named: PRESET,
    read: async (file) => {
      root = repo(own([]));
      const said: string[] = [];
      const organization = {
        kind: async () => "organization",
        role: async () => "owner",
        signInLacks: async () => null,
        plan: async () => ({ name: "Team", rules: true, privateSecrets: true }),
        repository: async () => ({ isPrivate: true }),
        file: async (_: string, path: string) =>
          path === PRESET ? file : null,
        secretNames: async () => [],
        variable: async () => null,
        ruleNames: async () => [],
      };
      const tickets = memoryTickets([]);
      const code = await initOrg(["--org", "https://github.com/acme"], {
        out: into(said),
        ask: {},
        hasCommand: () => true,
        hosts: {
          github: {
            label: "GitHub",
            serves: () => true,
            ownerOf: () => "acme",
            addressOf: () => "https://github.com/acme",
            organization: () => organization,
          },
        },
        tools: memoryTools({
          codeHost: memoryCodeHost().codeHost,
          runner: memoryRunner().runner,
          tickets: tickets.tickets,
        }),
      } as unknown as InitOrgDeps);
      return { code, said };
    },
  },
  "the poller": {
    named: PRESET,
    read: async (file) => {
      root = repo(own([]));
      const said: string[] = [];
      const code = await oncePreset(
        PRESET,
        {
          fetch: async () => {
            throw new Error("read the board");
          },
          env: { GITHUB_REPOSITORY: "acme/factory-config" },
          now: () => 0,
          log: (line) => said.push(line),
          marker: () => "st_0123456789ab",
        },
        () => file,
      );
      return { code, said };
    },
  },
};

const VALUES: [what: string, lines: string[], words: string][] = [
  [
    "one key",
    ["rules:", "  review-rounds: zero"],
    "rules.review-rounds: must be a whole number above zero",
  ],
  [
    "an item of a list",
    [
      "plugins:",
      "  build:",
      "    reviewers:",
      "      - agent: x",
      "        files: src",
    ],
    "plugins.build.reviewers[0].files: must be a list",
  ],
  [
    "two settings that contradict",
    ["builds:", "  trigger: manual", "  poll-minutes: 10"],
    "builds.poll-minutes needs builds.trigger: github-action",
  ],
  ["a key nobody knows", ["nope: 1"], "nope: unknown key"],
  [
    "GitHub as a host",
    ["builds:", "  hosts: [github.com]"],
    "builds.hosts can't name GitHub: a build has no GitHub access",
  ],
  [
    "a name that needs quotes",
    ["rules: a: b"],
    `line ${HEAD.length + 1}: rules: a: b needs quotes around the name, such as rules: "a: b"`,
  ],
];

describe.each(Object.entries({ ...OWN_READERS, ...PRESET_READERS }))(
  "%s",
  (name, reader) => {
    const file = name in OWN_READERS ? ownFile : presetFile;
    const readIt = async (text: string, words: string) => {
      const r = await reader.read(text);
      expect(r.said).toContain(`${reader.named}: ${words}`);
      expect(r.code).toBe(1);
    };

    it.each(VALUES)("refuses %s in the shared words", (_, lines, words) =>
      readIt(file(lines), words),
    );

    it("refuses an older version in the shared words", () =>
      readIt(
        file([]).replace("version: 2", "version: 1"),
        'version: must be 2: this file is version 1, see "Moving to settings version 2" in docs/updating.md',
      ));

    it("refuses a file YAML cannot read in YAML's own words", async () => {
      const text = file(["rules: ["]);
      let said = "";
      try {
        load(text);
      } catch (e) {
        said = (e as Error).message;
      }
      const r = await reader.read(text);
      // What follows the first line is an excerpt of the file itself.
      const first = `${reader.named}: ${said.split("\n")[0]}`;
      expect(r.said.some((l) => l.startsWith(first))).toBe(true);
      expect(r.code).toBe(1);
    });
  },
);
