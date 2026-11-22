// OpenSpec (https://github.com/Fission-AI/OpenSpec): a ticket's spec is a
// change under openspec/changes/, archived into openspec/specs/.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BUILT } from "../tool-names.mts";
import type { Run, SpecTool } from "./types.mts";

const PACKAGE = "@fission-ai/openspec";
const CHANGES = "openspec/changes";
const SPECS = "openspec/specs";
const ENV = { DO_NOT_TRACK: "1" };
const OPENSPEC = ["npx", "--no-install", "openspec"];

/** A change's name, from the ticket as the ticket system writes it. */
const changeOf = (id: string) => `issue-${id.toLowerCase()}`;

function listsPackage(root: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    return [pkg.dependencies, pkg.devDependencies].some(
      (deps) => deps && typeof deps === "object" && PACKAGE in deps,
    );
  } catch {
    return false;
  }
}

const folders = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    : [];

export function openspec(run: Run): SpecTool {
  return {
    name: "OpenSpec",
    label:
      "OpenSpec: each ticket holds its spec, and each build also keeps it in openspec/specs/",
    install: {
      package: PACKAGE,
      via: "npm install --save-dev",
      installed: listsPackage,
    },
    defaultCheck: BUILT.specs.openspec!,
    env: ENV,
    processFiles: ["openspec/config.yaml"],
    runs: (root) => run([...OPENSPEC, "--version"], root, ENV, true) === 0,
    list: (root) =>
      folders(join(root, SPECS))
        .filter((name) => existsSync(join(root, SPECS, name, "spec.md")))
        .sort()
        .map((name) => ({ name, path: `${SPECS}/${name}/spec.md` })),
    folder: (id) => `${CHANGES}/${changeOf(id)}/`,
    started: (root, id) => existsSync(join(root, CHANGES, changeOf(id))),
    start: (root, id) =>
      run([...OPENSPEC, "new", "change", changeOf(id)], root, ENV, true),
    files: (id, spec) => [
      {
        kind: "new",
        path: "proposal.md",
        what: `The owner's text and Decisions, linking ticket ${id}`,
      },
      {
        kind: "new",
        path: "specs/CAPABILITY/spec.md",
        what: 'One per heading under Spec: ADDED for (new), MODIFIED for (modified), REMOVED for each "No longer" line; each numbered line is one requirement whose SHALL sentence restates it, with one scenario whose WHEN is the line\'s "When" clause and whose THEN is the rest',
      },
      ...(spec
        ? [
            {
              kind: "new" as const,
              path: "design.md",
              what: "Design, under For the builder",
            },
            {
              kind: "new" as const,
              path: "tasks.md",
              what: "Tasks, under For the builder",
            },
          ]
        : []),
    ],
    then: "factory specs check",
    finished: (root, id) =>
      folders(join(root, CHANGES, "archive")).some((name) =>
        name.endsWith(`-${changeOf(id)}`),
      ),
    finish: (root, id) =>
      run([...OPENSPEC, "archive", changeOf(id), "--yes"], root, ENV, false),
    foldsInto: `${SPECS}/`,
  };
}
