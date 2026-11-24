// `factory init`, presets first: how it learns which presets a repository
// follows, how it pins them, what they answer so it does not ask, and the
// one gate command it asks for when nothing names any.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { load } from "js-yaml";
import {
  followPresets,
  presetArgs,
  presetRows,
  presetSource,
  shipsText,
  type Files,
  type FromPresets,
} from "../src/init.mts";
import { presetsPath, rememberPresets } from "../src/lib/credentials.mts";
import { pinsOf } from "../src/preset.mts";
import { TOOLS } from "../src/tools.mts";
import { FACTORY_COLUMNS } from "./factory-columns";
import { CODE_HOST_YAML } from "./settings-fixture";
import {
  GATE_QUESTION,
  init,
  scripted,
  type FakePreset,
  type Setup,
} from "./init-harness";
import { fetching, publish } from "./preset-fixture";

const ROOT = "acme/factory-config";
const NODE = `${ROOT}//node`;
const OTHER = "acme/platform-settings";
const PRESETS: Record<string, FakePreset> = {
  [ROOT]: {
    about: "The preset for every acme repository.",
    settings: {
      tickets: { board: 12, columns: FACTORY_COLUMNS },
      "code-host": { "branch-name": "{user}/{ticket}" },
      specs: "none",
      "pr-review": { commands: [] },
      builds: { trigger: "github-action", "poll-minutes": 30 },
    },
    summary: [
      `${ROOT} at 1a2b3c4, from November 20, would change these settings here:`,
      "",
      "  replaces the default",
      "    tickets.board   none → 12",
    ],
  },
  [NODE]: {
    about: "The preset for acme's Node repositories.",
    settings: { commands: { gate: ["npm run check"] } },
  },
  [OTHER]: { settings: { specs: "none" } },
};
const QUESTION =
  "checkbox: Which of acme's presets does this repository follow?";
const web = (over: Partial<Setup> = {}) =>
  init({
    remote: "git@github.com:acme/web.git",
    presets: PRESETS,
    answers: { checkbox: [[]], confirm: [true] },
    ...over,
  });
const SITE = "code.example/acme";
/** Each token a part the root preset turns on reads, left for later. */
const LATER = ["", ""];

describe("factory init --preset", () => {
  it("reads each name after --preset, in order, and none from a flag with no name", () => {
    expect(presetArgs(["--preset", ROOT, "--preset", NODE])).toEqual([
      ROOT,
      NODE,
    ]);
    expect(presetArgs([])).toEqual([]);
    expect(presetArgs(["--preset"])).toBeNull();
    expect(presetArgs(["--preset", "--preset", ROOT])).toBeNull();
  });

  it("prints its usage and exits 2 for a flag with no name", async () => {
    const r = web({ argv: ["--preset"] });
    expect(await r.run()).toBe(2);
    expect(r.out).toEqual([
      "Usage: factory init [--preset NAME]... [--org ADDRESS]",
    ]);
  });

  it("follows the presets it names, in order, and looks for no other", async () => {
    const r = web({
      argv: ["--preset", OTHER, "--preset", NODE],
      config: [ROOT],
    });
    expect(await r.run()).toBe(0);
    expect(r.yaml().presets).toEqual([OTHER, NODE]);
    expect(r.looked).toEqual([]);
    expect(r.asked).not.toContain(QUESTION);
    expect(r.out.join("\n")).not.toMatch(/^ {2}Presets /m);
  });
});

describe("factory init, the owner's factory-config", () => {
  const found = (over: Partial<Setup> = {}) =>
    web({
      config: [ROOT, NODE],
      answers: { checkbox: [[ROOT], []], confirm: [true], secret: LATER },
      ...over,
    });

  it("looks for it by name under the repository's owner, with no --preset and no presets in the settings", async () => {
    const r = found();
    await r.run();
    expect(r.looked).toEqual(["acme/factory-config"]);
  });

  it("says how many presets it holds, under Found", async () => {
    const r = found();
    await r.run();
    expect(r.out).toContain("  Presets        acme/factory-config holds 2");
  });

  it("asks which the repository follows, each by its name and its file's first comment line, the one at the root checked", async () => {
    const r = found();
    await r.run();
    expect(r.asked[0]).toBe(QUESTION);
    expect(r.checkboxes[0]).toEqual({
      names: [
        "acme/factory-config        The preset for every acme repository.",
        "acme/factory-config//node  The preset for acme's Node repositories.",
      ],
      checked: [ROOT],
    });
  });

  it("looks for none when the settings list presets already", async () => {
    const r = found({
      settings: `version: 2\nrepository: acme/web\npresets:\n  - ${OTHER}\n${CODE_HOST_YAML}\n`,
      answers: { checkbox: [[]], confirm: [true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.looked).toEqual([]);
    expect(r.asked).not.toContain(QUESTION);
    expect(r.yaml().presets).toEqual([OTHER]);
  });
});

describe("factory init, the presets this machine last used for the owner", () => {
  const ASKED =
    "confirm: acme's other repositories on this machine follow acme/platform-settings. Follow it here?";
  const second = (follow: boolean, over: Partial<Setup> = {}) => {
    const r = web({
      answers: { checkbox: [[]], confirm: [follow, true] },
      ...over,
    });
    rememberPresets(SITE, [OTHER], r.env);
    return r;
  };

  it("offers them, with yes for Enter, when the owner has no factory-config", async () => {
    const r = second(true);
    expect(await r.run()).toBe(0);
    expect(r.asked[0]).toBe(ASKED);
    expect(r.fallbacks[ASKED.slice("confirm: ".length)]).toBe(true);
    expect(r.yaml().presets).toEqual([OTHER]);
  });

  it("follows none on a no", async () => {
    const r = second(false);
    expect(await r.run()).toBe(0);
    expect(r.yaml().presets).toBeUndefined();
  });

  it("offers several as them", async () => {
    const r = second(false);
    rememberPresets(SITE, [OTHER, NODE], r.env);
    await r.run();
    expect(r.asked[0]).toBe(
      "confirm: acme's other repositories on this machine follow acme/platform-settings and acme/factory-config//node. Follow them here?",
    );
  });

  it("offers none when the owner has a factory-config", async () => {
    const r = second(true, {
      config: [ROOT],
      answers: { checkbox: [[], []], confirm: [true] },
    });
    await r.run();
    expect(r.asked).not.toContain(ASKED);
  });

  it("offers none for another owner's", async () => {
    const r = web();
    rememberPresets("code.example/sam", [OTHER], r.env);
    await r.run();
    expect(r.asked.filter((q) => q.includes("other repositories"))).toEqual([]);
  });
});

describe("factory init, pinning the presets chosen", () => {
  const chosen = (over: Partial<Setup> = {}) =>
    web({
      config: [ROOT, NODE],
      answers: {
        checkbox: [[ROOT, NODE], []],
        confirm: [true],
        secret: LATER,
      },
      ...over,
    });

  it("prints factory preset add's summary for each, after the question and before what the presets answer", async () => {
    const r = chosen();
    await r.run();
    const at = r.transcript.indexOf(`? ${QUESTION}`);
    expect(r.transcript.slice(at + 1, at + 7)).toEqual([
      ...PRESETS[ROOT]!.summary!,
      "",
      "From the presets, so not asked",
    ]);
  });

  it("writes the settings with the presets, and the lock that pins them, only once told to go ahead", async () => {
    const no = chosen({
      answers: { checkbox: [[ROOT, NODE], []], confirm: [false] },
    });
    await no.run();
    expect(no.read(".claude/factory.yaml")).toBeNull();
    expect(no.read(".claude/factory.lock")).toBeNull();

    const yes = chosen();
    await yes.run();
    expect(yes.yaml().presets).toEqual([ROOT, NODE]);
    expect(yes.read(".claude/factory.lock")).toBe(
      `# pins ${ROOT}\n# pins ${NODE}\n`,
    );
  });

  it("stops with that command's refusal, changing nothing", async () => {
    const REFUSAL =
      "✗ evil/presets: not found, or private. A preset of another owner has to be public. To follow a private one, keep a copy under acme and add the copy.";
    const r = web({
      argv: ["--preset", "evil/presets"],
      presets: { "evil/presets": { refuses: REFUSAL } },
      answers: {},
    });
    expect(await r.run()).toBe(1);
    expect(r.out.slice(-2)).toEqual([REFUSAL, "Nothing changed."]);
    expect(r.asked).toEqual([]);
    expect(r.read(".claude/factory.yaml")).toBeNull();
  });

  it("records the choice for the owner on this machine once told to go ahead, and not before", async () => {
    const no = chosen({
      answers: { checkbox: [[ROOT, NODE], []], confirm: [false] },
    });
    await no.run();
    expect(no.read(presetsPath(no.env))).toBeNull();

    const yes = chosen();
    await yes.run();
    expect(
      (await import("../src/lib/credentials.mts")).rememberedPresets(
        SITE,
        yes.env,
      ),
    ).toEqual([ROOT, NODE]);
  });

  it("adds no preset the settings list already", async () => {
    const d = { ...scripted({}), out: () => {} };
    const added: string[] = [];
    const files: Files = { settings: "", choices: null, lock: null };
    const got = await followPresets(
      {
        ask: d.ask,
        out: d.out,
        presets: {
          held: async () => null,
          combined: async () => null,
          add: async (name, f) => {
            added.push(name);
            return f;
          },
        },
      },
      {
        owner: "acme",
        files,
        listed: [ROOT],
        flags: [ROOT, NODE, NODE],
        held: null,
        remembered: [],
      },
    );
    expect(added).toEqual([NODE]);
    expect(got).toEqual({ files, added: [NODE], asked: false });
  });
});

describe("factory init, what the presets answer", () => {
  const follows = (over: Partial<Setup> = {}) =>
    web({
      argv: ["--preset", ROOT, "--preset", NODE],
      answers: { checkbox: [[]], confirm: [true], secret: LATER },
      ...over,
    });

  it("asks nothing they answer: the ticket system, the board and its columns, the branch name, the spec tool, where the poller runs, the interval, and the gate", async () => {
    const r = follows({
      private: true,
      boards: [{ number: 12, title: "acme", columns: ["Todo"] }],
    });
    expect(await r.run()).toBe(0);
    expect(r.asked.filter((q) => !q.startsWith("secret:"))).toEqual([
      "checkbox: Which parts do you want?",
      "confirm: Go ahead?",
    ]);
  });

  it("prints what they answer under one heading, with the parts they turn on", async () => {
    const r = follows();
    await r.run();
    const at = r.out.indexOf("From the presets, so not asked");
    expect(r.out.slice(at, at + 7)).toEqual([
      "From the presets, so not asked",
      "  Tickets        GitHub Issues on board 12",
      "  Branch names   {user}/{ticket}",
      "  Spec tool      none",
      "  Gate           npm run check",
      "  Parts          a board, the review, and builds that start from the board",
      "",
    ]);
  });

  it("offers no part a preset turns on, and keeps each on", async () => {
    const r = follows();
    await r.run();
    expect(r.checkboxes[0]!.names).toEqual([
      "Builds in the cloud",
      "Pull requests that merge themselves",
      "Signed commits from cloud builds",
    ]);
    expect(r.out.join("\n")).not.toContain("turn off");
  });

  it("leaves a board a preset names as its owner made it", async () => {
    const r = follows({
      boards: [{ number: 12, title: "acme", columns: ["Todo"] }],
    });
    await r.run();
    expect(r.out.join("\n")).not.toMatch(/^ {2}board /m);
    expect(r.tickets.boards[0]!.columns).toEqual(["Todo"]);
  });

  it("names only the rows the presets give", () => {
    const from = (raw: Record<string, unknown>): FromPresets => ({
      raw,
      gives: (key) =>
        key
          .split(".")
          .reduce<unknown>(
            (at, part) => (at as Record<string, unknown> | undefined)?.[part],
            raw,
          ) !== undefined,
      ships: [],
    });
    const rows = (raw: Record<string, unknown>, parts: string[] = []) =>
      presetRows(from(raw), {
        tools: TOOLS,
        parts: (part) => parts.includes(part),
      });
    expect(rows({})).toEqual([]);
    expect(rows({ tickets: { type: "github" } })).toEqual([
      ["Tickets", "GitHub Issues"],
    ]);
    expect(rows({ specs: { type: "openspec" } })).toEqual([
      ["Spec tool", "openspec"],
    ]);
    expect(
      rows({ commands: { gate: ["npm run lint", "npm test"] } }, ["review"]),
    ).toEqual([
      ["Gate", "npm run lint and npm test"],
      ["Parts", "the review"],
    ]);
  });

  it("says what the presets ship by kind, counting a kind with more than one", () => {
    const o = { owner: "acme", ownPresets: true, reviewers: ["a", "b"] };
    expect(shipsText([], o)).toBeNull();
    expect(
      shipsText([".claude/agents/a.md", ".claude/skills/s/SKILL.md"], o),
    ).toBe("acme's own reviewer and skill");
    expect(
      shipsText(
        [
          ".claude/agents/a.md",
          ".claude/agents/b.md",
          ".claude/agents/c.md",
          ".claude/skills/s/SKILL.md",
          ".claude/skills/s/notes.md",
        ],
        o,
      ),
    ).toBe("acme's own 2 reviewers, an agent, and a skill");
    expect(
      shipsText([".claude/agents/c.md"], { ...o, ownPresets: false }),
    ).toBe("the presets' own agent");
  });
});

describe("factory init, the gate", () => {
  const ASKED = `input: ${GATE_QUESTION}`;
  const LEFT =
    "Add the commands that check a change, under commands.gate in .claude/factory.yaml";

  it("asks for the command that checks a change when nothing sets one, and writes it as the one gate command", async () => {
    const r = web({
      answers: { checkbox: [[]], confirm: [true], gate: [" npm test "] },
    });
    expect(await r.run()).toBe(0);
    expect(r.asked).toContain(ASKED);
    expect(r.yaml().commands).toEqual({ gate: ["npm test"] });
    expect(r.out.join("\n")).not.toContain(LEFT);
  });

  it("keeps the step under Left to do when the question is left empty", async () => {
    const r = web();
    expect(await r.run()).toBe(0);
    expect(r.yaml().commands).toBeUndefined();
    expect(r.out).toContain(`  1. ${LEFT}`);
  });

  it("does not ask when the settings set one", async () => {
    const r = web({
      settings: `version: 2\nrepository: acme/web\n${CODE_HOST_YAML}\ncommands:\n  gate:\n    - make check\n`,
    });
    await r.run();
    expect(r.asked).not.toContain(ASKED);
  });

  it("does not ask when a preset sets one, and writes none of its own", async () => {
    const r = web({ argv: ["--preset", NODE] });
    await r.run();
    expect(r.asked).not.toContain(ASKED);
    expect(r.yaml().commands).toBeUndefined();
  });
});

describe("the presets as init reads and pins them", () => {
  const REPOSITORY = "acme/web";
  const source = (root: string) =>
    presetSource(root, {
      fetch: (repository) => fetching(repository),
      now: () => new Date("2026-11-23T12:00:00Z"),
    });
  const publishAcme = () =>
    publish(ROOT, {
      "": {
        settings:
          "# The preset for every acme repository.\n# Yours to edit.\nversion: 2\ntickets:\n  board: 12\n",
        agents: { "acme-reviewer": "review\n" },
      },
      node: {
        settings: "version: 2\ncommands:\n  gate: [npm run check]\n",
      },
      "docs/site": {
        settings: "#The preset for a docs site.\nversion: 2\nspecs: none\n",
      },
    });
  const DRAFT: Files = {
    settings: `version: 2\nrepository: ${REPOSITORY}\n`,
    choices: null,
    lock: null,
  };
  const io = (answers: string[] = []) => {
    const out: string[] = [];
    const s = scripted({ input: answers });
    return {
      out,
      asked: s.asked,
      d: { ask: s.ask, out: (l: string) => out.push(l) },
    };
  };

  it("lists each factory-preset.yaml a repository holds, the root's first, by its name and first comment line", async () => {
    publishAcme();
    const root = mkdtempSync(join(tmpdir(), "init-presets-"));
    expect(await source(root).held(ROOT, "github", REPOSITORY)).toEqual([
      { name: ROOT, about: "The preset for every acme repository." },
      { name: `${ROOT}//docs/site`, about: "The preset for a docs site." },
      { name: NODE, about: "" },
    ]);
  });

  it("finds no presets in a repository that cannot be read", async () => {
    const root = mkdtempSync(join(tmpdir(), "init-presets-"));
    expect(
      await source(root).held("acme/no-such", "github", REPOSITORY),
    ).toBeNull();
  });

  it("pins a preset as factory preset add does, printing its summary and writing nothing", async () => {
    const commit = publishAcme();
    const root = mkdtempSync(join(tmpdir(), "init-presets-"));
    const { out, d } = io();
    const files = await source(root).add(ROOT, DRAFT, d);
    expect(out[0]).toBe(
      `${ROOT} at ${commit.slice(0, 7)}, from November 20, would change these settings here:`,
    );
    expect(out.join("\n")).toContain("tickets.board");
    expect(out.join("\n")).toContain("writes .claude/agents/acme-reviewer.md");
    expect(out.join("\n")).not.toMatch(/✓|Apply/);
    expect(out.at(-1)).not.toBe("");
    expect((load(files!.settings) as { presets: string[] }).presets).toEqual([
      ROOT,
    ]);
    expect(pinsOf(files!.lock, load)).toMatchObject([{ name: ROOT, commit }]);
    expect((await import("node:fs")).existsSync(join(root, ".claude"))).toBe(
      false,
    );
  });

  it("pins a second preset beside the first, from the files the first left", async () => {
    publishAcme();
    const root = mkdtempSync(join(tmpdir(), "init-presets-"));
    const s = source(root);
    const first = await s.add(ROOT, DRAFT, io().d);
    const both = await s.add(NODE, first!, io().d);
    expect(pinsOf(both!.lock, load).map((p) => p.name)).toEqual([ROOT, NODE]);
  });

  it("gives that command's refusal for a preset that is not there", async () => {
    publishAcme();
    const root = mkdtempSync(join(tmpdir(), "init-presets-"));
    const { out, d } = io();
    expect(await source(root).add(`${ROOT}//rust`, DRAFT, d)).toBeNull();
    expect(out.join("\n")).toContain("no rust/factory-preset.yaml");
  });

  it("says what the presets give, which keys are theirs, and what they ship", async () => {
    publishAcme();
    const root = mkdtempSync(join(tmpdir(), "init-presets-"));
    const s = source(root);
    const files = (await s.add(
      NODE,
      (await s.add(ROOT, DRAFT, io().d))!,
      io().d,
    ))!;
    const own = { ...files, settings: `${files.settings}specs: openspec\n` };
    const from = (await s.combined(own))!;
    expect(from.raw).toMatchObject({
      repository: REPOSITORY,
      tickets: { board: 12 },
      commands: { gate: ["npm run check"] },
      specs: { type: "openspec" },
    });
    expect(from.gives("tickets.board")).toBe(true);
    expect(from.gives("tickets")).toBe(true);
    expect(from.gives("commands.gate")).toBe(true);
    expect(from.gives("specs")).toBe(false);
    expect(from.gives("pr-review")).toBe(false);
    expect(from.ships).toEqual([".claude/agents/acme-reviewer.md"]);
  });

  it("gives nothing for files that list no preset, or whose presets are not pinned", async () => {
    const root = mkdtempSync(join(tmpdir(), "init-presets-"));
    const s = source(root);
    expect(await s.combined(DRAFT)).toBeNull();
    expect(
      await s.combined({
        ...DRAFT,
        settings: `${DRAFT.settings}presets:\n  - ${ROOT}\n`,
      }),
    ).toBeNull();
  });
});
