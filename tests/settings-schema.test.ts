import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";
import {
  SETTINGS_KEYS,
  SPECS,
  TRIGGERS,
  parseSettings,
} from "../src/config.mts";

type Block = { properties: Record<string, unknown>; enum?: string[] };
const schema = JSON.parse(
  readFileSync(new URL("../settings.schema.json", import.meta.url), "utf8"),
) as Block & { definitions: Record<string, Block> };

/** The schema's block at a path from `SETTINGS_KEYS`. */
const blockAt = (path: string): Block =>
  path === "" ? schema : schema.definitions[path]!;

const enumOf = (block: string, key: string) =>
  (schema.definitions[block]!.properties[key] as { enum: string[] }).enum;

describe("settings.schema.json against the code's keys", () => {
  for (const [path, keys] of Object.entries(SETTINGS_KEYS)) {
    it(`lists the keys of "${path}"`, () => {
      expect(Object.keys(blockAt(path).properties).sort()).toEqual(
        [...keys].sort(),
      );
    });
  }

  it("has no block the table lacks", () => {
    expect(Object.keys(schema.definitions).sort()).toEqual(
      Object.keys(SETTINGS_KEYS)
        .filter((p) => p !== "")
        .sort(),
    );
  });

  it("allows the words the code allows", () => {
    expect(enumOf("builds", "trigger")).toEqual([...TRIGGERS]);
    expect(enumOf("specs", "type")).toEqual([...SPECS]);
  });
});

const ajv = new Ajv({ strict: false });
const validate = ajv.compile(schema);
const bySchema = (raw: unknown) => validate(raw) as boolean;
const byCode = (raw: unknown) => {
  try {
    parseSettings(raw, () => true);
    return true;
  } catch {
    return false;
  }
};

const read = (url: string) =>
  readFileSync(new URL(url, import.meta.url), "utf8");
const yamlBlocks = (md: string) =>
  [...md.matchAll(/```yaml\n([\s\S]*?)```/g)].map((m) => m[1]!);

const complete = yamlBlocks(read("../docs/configuration.md")).filter((b) =>
  b.includes("repository:"),
);

describe("the schema and parseSettings agree on whole files", () => {
  it("finds the three complete files and the shortest", () => {
    expect(complete.length).toBe(4);
  });

  for (const [i, text] of complete.entries()) {
    it(`both accept the docs' file ${i + 1}`, () => {
      const raw = load(text);
      expect(byCode(raw)).toBe(true);
      expect(bySchema(raw)).toBe(true);
    });
  }

  it("both accept the one-word forms", () => {
    const raw = {
      version: 2,
      repository: "a/b",
      tickets: "github",
      specs: "openspec",
    };
    expect([byCode(raw), bySchema(raw)]).toEqual([true, true]);
  });

  const base = { version: 2, repository: "owner/name" };
  const site = { start: "npm start", url: "http://localhost:$PORT" };

  it("both accept every command, the spec check, and a plugin in every role", () => {
    const raw = {
      ...base,
      specs: { type: "openspec", check: "make specs" },
      commands: {
        "build-setup": ["make tools"],
        "before-commit": ["make lint"],
        gate: ["make check"],
        "test-one": "make test FILE=$FILE",
        "end-to-end": "make e2e FILE=$FILE",
        coverage: { run: "make coverage", report: "out/lcov.info" },
        relock: "make lock",
      },
      plugins: {
        refine: { refiner: { skill: "a" }, mockups: { skill: "b" } },
        build: {
          builders: [{ skill: "c", labels: ["new"] }],
          reviewers: [{ agent: "d", files: ["db/**"] }],
        },
        test: {
          prover: { skill: "e" },
          reviewers: [{ agent: "f" }, { agent: "g", files: ["e2e/**"] }],
        },
        conflicts: { resolvers: [{ skill: "h", files: ["gen/**"] }] },
      },
    };
    expect([byCode(raw), bySchema(raw)]).toEqual([true, true]);
  });

  it("both accept a list of columns for a state other than ready", () => {
    const raw = {
      ...base,
      tickets: {
        board: 3,
        columns: { backlog: "Todo", review: ["Code review", "QA"] },
      },
    };
    expect([byCode(raw), bySchema(raw)]).toEqual([true, true]);
  });

  it("both accept plugins and a phase with nothing in them", () => {
    for (const plugins of [{}, { build: {} }, { test: { reviewers: [] } }])
      expect([
        byCode({ ...base, plugins }),
        bySchema({ ...base, plugins }),
      ]).toEqual([true, true]);
  });

  const wrong: Record<string, unknown> = {
    "a version 1 file": { ...base, version: 1 },
    "a command at the top level, where version 1 had it": {
      ...base,
      "before-commit": ["npm test"],
    },
    "plugins written as a list": {
      ...base,
      plugins: [{ agent: "a", role: "reviewer" }],
    },
    "a skill where an agent goes": {
      ...base,
      plugins: { build: { reviewers: [{ skill: "a", files: ["x"] }] } },
    },
    "an agent where a skill goes": {
      ...base,
      plugins: { refine: { refiner: { agent: "a" } } },
    },
    "a builder with no labels": {
      ...base,
      plugins: { build: { builders: [{ skill: "a" }] } },
    },
    "a build reviewer with an empty list of files": {
      ...base,
      plugins: { build: { reviewers: [{ agent: "a", files: [] }] } },
    },
    "labels on a resolver": {
      ...base,
      plugins: {
        conflicts: { resolvers: [{ skill: "a", files: ["x"], labels: ["y"] }] },
      },
    },
    "coverage without its report": {
      ...base,
      commands: { coverage: { run: "npm run coverage" } },
    },
    "a command that is empty text": { ...base, commands: { "test-one": "" } },
    "a command list that is one line of text": {
      ...base,
      commands: { gate: "npm run check" },
    },
    "a spec check that is not text": {
      ...base,
      specs: { type: "openspec", check: ["make specs"] },
    },
    "a misspelled top-level key": { ...base, repositry: "x/y" },
    "a misspelled key inside a block": {
      ...base,
      builds: { triger: "manual" },
    },
    "a word that is not allowed": { ...base, builds: { trigger: "sometimes" } },
    "a value of the wrong type": { ...base, tickets: { board: "one" } },
    "site.widths that is not a list of whole numbers": {
      ...base,
      site: { ...site, widths: [390, "wide"] },
    },
    "a list of columns for ready": {
      ...base,
      tickets: { board: 3, columns: { ready: ["Ready", "Go"] } },
    },
    "an empty list of columns": {
      ...base,
      tickets: { board: 3, columns: { review: [] } },
    },
    "site.pages that is not a list of text": {
      ...base,
      site: { ...site, pages: [1, 2] },
    },
  };
  for (const [kind, raw] of Object.entries(wrong)) {
    it(`both refuse ${kind}`, () => {
      expect(byCode(raw)).toBe(false);
      expect(bySchema(raw)).toBe(false);
    });
  }
});
