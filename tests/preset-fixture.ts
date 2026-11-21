// A repository with presets installed in its node_modules, as npm installs
// them, for the tests of combining, the lock, and the preset commands.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { load } from "js-yaml";
import { filesDeps, resolveFiles, type Deps } from "../src/config.mts";
import { CODE_HOST_YAML } from "./settings-fixture";

export type PresetFiles = {
  settings: string;
  agents?: Record<string, string>;
  skills?: Record<string, string>;
};

export const put = (root: string, path: string, text: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

export const read = (root: string, path: string) =>
  existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : null;

/** A package in `dir`: each folder's preset, "" for the package's own. */
export function writePackage(
  dir: string,
  pkg: string,
  version: string,
  presets: Record<string, PresetFiles>,
) {
  put(dir, "package.json", JSON.stringify({ name: pkg, version }));
  for (const [folder, p] of Object.entries(presets)) {
    const at = folder ? `${folder}/` : "";
    put(dir, `${at}factory-preset.yaml`, p.settings);
    for (const [name, text] of Object.entries(p.agents ?? {}))
      put(dir, `${at}agents/${name}.md`, text);
    for (const [name, text] of Object.entries(p.skills ?? {}))
      put(dir, `${at}skills/${name}/SKILL.md`, text);
  }
}

/** The package installed in the repository at `root`. */
export const install = (
  root: string,
  pkg: string,
  version: string,
  presets: Record<string, PresetFiles>,
) => writePackage(join(root, "node_modules", pkg), pkg, version, presets);

export const ACME = "@acme/factory-preset";
export const NODE = "@acme/factory-preset/node";

export const ACME_SETTINGS = [
  "version: 2",
  "rules:",
  "  small-change-lines: 40",
  "  review-rounds: 2",
  "plugins:",
  "  build:",
  "    reviewers:",
  "      - agent: acme-security-reviewer",
  "        files: [src/**]",
  "",
].join("\n");

export const NODE_SETTINGS = [
  "version: 2",
  "rules:",
  "  small-change-lines: 30",
  "  review-rounds: 3",
  "commands:",
  "  gate: [npm test]",
  "plugins:",
  "  build:",
  "    reviewers:",
  "      - agent: node-deps-reviewer",
  "        files: [package.json]",
  "pr-review:",
  "  commands: [npm audit]",
  "",
].join("\n");

/** The two presets of the docs' example, at `version`. */
export const installAcme = (
  root: string,
  version = "1.4.0",
  acme = ACME_SETTINGS,
  node = NODE_SETTINGS,
) =>
  install(root, ACME, version, {
    "": {
      settings: acme,
      agents: { "acme-security-reviewer": "security\n" },
    },
    node: {
      settings: node,
      agents: { "node-deps-reviewer": "deps\n" },
    },
  });

/** `.claude/factory.yaml` naming `presets`, with the rest of `body`. */
export const own = (presets: string[], body: string[] = []) =>
  [
    "version: 2",
    "repository: acme/billing",
    CODE_HOST_YAML,
    ...(presets.length
      ? ["presets:", ...presets.map((p) => `  - "${p}"`)]
      : []),
    ...body,
    "",
  ].join("\n");

/** An empty repository: a `.git` folder and `.claude/factory.yaml`. */
export function repo(settings: string): string {
  const root = mkdtempSync(join(tmpdir(), "factory-preset-"));
  mkdirSync(join(root, ".git"));
  put(root, ".claude/factory.yaml", settings);
  return root;
}

/** Deps that read the files of the repository at `root`, with no lock,
 * capturing what is printed. */
export function deps(root: string, over: Partial<Deps> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const d: Deps = {
    ...filesDeps(root, {}),
    listFiles: () => [],
    out: (l) => out.push(l),
    err: (l) => err.push(l),
    ...over,
  };
  return { d, out, err };
}

export const resolveAt = (root: string, over: Partial<Deps> = {}) =>
  resolveFiles(deps(root, over).d);

export const yaml = (text: string) => load(text);
