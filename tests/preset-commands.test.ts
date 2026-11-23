// The `factory preset` commands, run against a repository with presets in
// its node_modules, a stand-in for npm, and the real sync.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { painter } from "../src/lib/color.mts";
import {
  defaultDeps,
  filesDeps,
  resolveFiles,
  staleOf,
} from "../src/config.mts";
import {
  hasOwnGroup,
  installError,
  main,
  nextLines,
  presetChecks,
  type PresetDeps,
} from "../src/preset-commands.mts";
import { main as syncMain, PACKAGE } from "../src/sync.mts";
import { nextStep, type Bump } from "../src/deps.mts";
import {
  ACME,
  install,
  NODE,
  NODE_SETTINGS,
  own,
  put,
  read,
  repo,
  writePackage,
  type PresetFiles,
} from "./preset-fixture.ts";

let root = "";
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

/** The docs' organization preset: it does not set review-rounds. */
const ACME_BASE = [
  "version: 2",
  "rules:",
  "  small-change-lines: 40",
  "plugins:",
  "  build:",
  "    reviewers:",
  "      - agent: acme-security-reviewer",
  "        files: [src/**]",
  "",
].join("\n");

const PACKAGES: Record<
  string,
  { version: string; presets: Record<string, PresetFiles> }
> = {
  [ACME]: {
    version: "1.4.0",
    presets: {
      "": {
        settings: ACME_BASE,
        agents: { "acme-security-reviewer": "security\n" },
      },
      node: {
        settings: NODE_SETTINGS,
        agents: { "node-deps-reviewer": "deps\n" },
      },
    },
  },
  "@acme/web": {
    version: "2.0.0",
    presets: { "": { settings: "version: 2\nrules:\n  review-rounds: 4\n" } },
  },
  "@acme/empty": {
    version: "1.0.0",
    presets: { other: { settings: "version: 2\n" } },
  },
};

type Run = {
  code: number;
  out: string[];
  err: string[];
  asked: string[];
  npm: string[][];
};

/** A repository already using `presets`, synced, with `.claude/factory.yaml`
 * also holding `body`, and the packages in package.json installed. */
async function setUp(
  presets: string[],
  body: string[] = [],
  packages = [ACME],
) {
  root = repo(own(presets, body));
  put(
    root,
    "package.json",
    JSON.stringify({
      devDependencies: Object.fromEntries(packages.map((p) => [p, "^1.0.0"])),
    }),
  );
  for (const p of packages)
    install(root, p, PACKAGES[p]!.version, PACKAGES[p]!.presets);
  await sync();
}

async function sync(out: (l: string) => void = () => {}) {
  return syncMain([], {
    root,
    pkg: PACKAGE,
    settings: () => resolveFiles(filesDeps(root, {})),
    stale: () => staleOf(defaultDeps(root, {})),
    defaultBranch: async () => "main",
    out,
    err: () => {},
  });
}

/** One preset command, answering its questions with `answers` in turn. */
async function preset(
  argv: string[],
  answers: string[] = [],
  over: Partial<PresetDeps> = {},
): Promise<Run> {
  const r: Run = { code: 0, out: [], err: [], asked: [], npm: [] };
  const fs = filesDeps(root, {});
  const d: PresetDeps = {
    root,
    cwd: root,
    out: (l) => r.out.push(l),
    err: (l) => r.err.push(l),
    terminal: true,
    ask: async (q) => {
      r.asked.push(q);
      const a = answers.shift();
      if (a === undefined) throw new Error(`no answer for: ${q}`);
      r.out.push(`${q}${a}`);
      return a;
    },
    npm: (args) => {
      r.npm.push(args);
      const [verb, ...rest] = args;
      if (verb === "install") {
        const name = rest.at(-1)!;
        const p = PACKAGES[name];
        if (!p)
          return {
            status: 1,
            stdout: "",
            stderr: "npm error code E404\nnpm error 404 Not Found\n",
          };
        writePackage(
          join(root, "node_modules", name),
          name,
          p.version,
          p.presets,
        );
      }
      if (verb === "uninstall")
        rmSync(join(root, "node_modules", rest[0]!), {
          recursive: true,
          force: true,
        });
      if (verb === "config")
        return {
          status: 0,
          stdout: "https://registry.npmjs.org/\n",
          stderr: "",
        };
      return { status: 0, stdout: "", stderr: "" };
    },
    sync: (out) => sync(out),
    show: () => null,
    resolve: (ownText, choices) =>
      resolveFiles({
        ...fs,
        readFile: () => ownText,
        readChoices: () => choices,
      }),
    write: (path, text) =>
      text === null
        ? rmSync(join(root, path), { force: true })
        : put(root, path, text),
    read: (path) => read(root, path),
    ...over,
  };
  r.code = await main(argv, d);
  return r;
}

const ADD_SUMMARY = [
  `${NODE} 1.4.0 would change these settings here:`,
  "",
  "  added",
  "    plugins.build.reviewers    + node-deps-reviewer",
  "    pr-review.commands         + npm audit",
  "  replaces the default",
  "    rules.review-rounds        2 → 3",
  `  disagrees with ${ACME}`,
  `    rules.small-change-lines   ${ACME}: 40   this preset: 30`,
  "  replaced by your .claude/factory.yaml",
  "    commands.gate              yours: npm run check   this preset's: npm test",
  "",
  "  writes .claude/agents/node-deps-reviewer.md",
];

const GATE = ["commands:", "  gate: [npm run check]"];

describe("factory preset add", () => {
  it("shows the summary, asks where presets disagree and about your own value, and applies on y", async () => {
    await setUp([ACME], GATE);
    const r = await preset(["add", NODE], ["30", "keep", "y"]);
    expect(r.out).toEqual([
      ...ADD_SUMMARY,
      "",
      "Choose:",
      `  rules.small-change-lines: 30 from this preset, or 40 from ${ACME}? [30/40] 30`,
      "  commands.gate: keep yours, or drop it and use this preset's? [keep/drop] keep",
      "",
      "Apply? [y/N] y",
      `added ${NODE} to presets in .claude/factory.yaml`,
      // The copies the new settings change: the rules state three rounds,
      // and the review is on with its commands.
      "wrote .claude/skills/factory-address-review/SKILL.md",
      "wrote .claude/factory/rules.md",
      "wrote .github/workflows/factory.yml",
      "wrote .github/workflows/factory-review.yml",
      "wrote .claude/agents/node-deps-reviewer.md",
      "wrote .claude/factory.choices.yaml",
      "wrote .claude/factory.lock",
    ]);
    expect(r.code).toBe(0);
    expect(read(root, ".claude/factory.yaml")).toBe(own([ACME, NODE], GATE));
    expect(read(root, ".claude/factory.choices.yaml")).toContain(
      `rules.small-change-lines: "${NODE}"`,
    );
  });

  it("records the earlier preset when its value is the answer", async () => {
    await setUp([ACME], GATE);
    await preset(["add", NODE], ["40", "keep", "y"]);
    expect(read(root, ".claude/factory.choices.yaml")).toContain(
      `rules.small-change-lines: "${ACME}"`,
    );
  });

  it("deletes your own value on drop", async () => {
    await setUp([ACME], GATE);
    await preset(["add", NODE], ["30", "drop", "y"]);
    expect(read(root, ".claude/factory.yaml")).not.toContain("gate");
  });

  it("asks again on an empty or unrecognized answer", async () => {
    await setUp([ACME], GATE);
    const r = await preset(
      ["add", NODE],
      ["", "35", "30", "maybe", "keep", "y"],
    );
    expect(
      r.asked.filter((q) => q.includes("small-change-lines")),
    ).toHaveLength(3);
    expect(r.asked.filter((q) => q.includes("commands.gate"))).toHaveLength(2);
  });

  it("changes nothing on any answer to Apply but y, uninstalling what it installed", async () => {
    await setUp([ACME]);
    const before = read(root, ".claude/factory.yaml");
    const r = await preset(["add", "@acme/web"], ["yes"]);
    expect(r.code).toBe(0);
    expect(r.out.at(-1)).toBe("Nothing changed.");
    expect(read(root, ".claude/factory.yaml")).toBe(before);
    expect(r.npm).toContainEqual(["uninstall", "@acme/web"]);
    expect(existsSync(join(root, "node_modules/@acme/web"))).toBe(false);
  });

  it("prints the summary and stops outside a terminal without --yes", async () => {
    await setUp([ACME], GATE);
    const before = read(root, ".claude/factory.yaml");
    const r = await preset(["add", NODE], [], { terminal: false });
    expect(r.code).toBe(1);
    expect(r.out).toEqual([
      ...ADD_SUMMARY,
      "",
      "Run it in a terminal to choose, or add --yes to apply it.",
    ]);
    expect(read(root, ".claude/factory.yaml")).toBe(before);
  });

  it("applies with --yes, asking nothing and recording no choice", async () => {
    await setUp([ACME], GATE);
    const r = await preset(["add", NODE, "--yes"], [], { terminal: false });
    expect(r.code).toBe(0);
    expect(r.asked).toEqual([]);
    expect(read(root, ".claude/factory.choices.yaml")).toBeNull();
    expect(read(root, ".claude/factory.lock")).toMatch(
      /small-change-lines: 30 +# @acme\/factory-preset\/node, not chosen yet/,
    );
    expect(read(root, ".claude/factory.yaml")).toMatch(
      /gate: \[ ?npm run check ?\]/,
    );
  });

  it("prints the summary and changes nothing with --dry-run", async () => {
    await setUp([ACME], GATE);
    const before = read(root, ".claude/factory.yaml");
    const r = await preset(["add", NODE, "--dry-run"]);
    expect(r.code).toBe(0);
    expect(r.out).toEqual(ADD_SUMMARY);
    expect(read(root, ".claude/factory.yaml")).toBe(before);
  });

  it("colors the summary when it paints, even outside a terminal", async () => {
    await setUp([ACME], GATE);
    const paint = painter(true);
    const r = await preset(["add", NODE, "--dry-run"], [], {
      terminal: false,
      paint,
    });
    expect(r.out).toEqual([
      `${NODE} 1.4.0 would change these settings here:`,
      "",
      `  ${paint("bold", "added")}`,
      `    plugins.build.reviewers    ${paint("green", "+ node-deps-reviewer")}`,
      `    pr-review.commands         ${paint("green", "+ npm audit")}`,
      `  ${paint("bold", "replaces the default")}`,
      `    rules.review-rounds        ${paint("dim", "2")} → ${paint("bold", "3")}`,
      `  ${paint("bold", `disagrees with ${ACME}`)}`,
      `    rules.small-change-lines   ${ACME}: 40   this preset: 30`,
      `  ${paint("bold", "replaced by your .claude/factory.yaml")}`,
      "    commands.gate              yours: npm run check   this preset's: npm test",
      "",
      "  writes .claude/agents/node-deps-reviewer.md",
    ]);
  });

  it("writes the lock without color, even where FORCE_COLOR asks for it", async () => {
    vi.stubEnv("FORCE_COLOR", "1");
    await setUp([ACME, NODE]);
    expect(read(root, ".claude/factory.lock")).toContain("# default");
    expect(read(root, ".claude/factory.lock")).not.toContain("\x1B");
  });

  it("says to run factory init when there are no settings", async () => {
    await setUp([ACME]);
    rmSync(join(root, ".claude/factory.yaml"));

    const r = await preset(["add", NODE]);

    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      ".claude/factory.yaml is missing. Run: factory init",
    ]);
  });

  it("refuses a preset already listed", async () => {
    await setUp([ACME]);
    const r = await preset(["add", ACME]);
    expect(r.code).toBe(1);
    expect(r.err).toEqual([`${ACME} is already in presets`]);
  });

  it("refuses a package with no factory-preset.yaml in the preset's folder, uninstalling it", async () => {
    await setUp([ACME]);
    const r = await preset(["add", "@acme/empty"]);
    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      "@acme/empty: no factory-preset.yaml in node_modules/@acme/empty",
    ]);
    expect(r.npm).toContainEqual(["uninstall", "@acme/empty"]);
  });

  it("puts npm's failure in the factory's words", async () => {
    await setUp([ACME]);
    const r = await preset(["add", "@acme/missing"]);
    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      "npm couldn't install @acme/missing: https://registry.npmjs.org/ answered 404 Not Found.",
      "If it's a private package, give this machine a token for https://registry.npmjs.org/, as .npmrc expects.",
    ]);
  });

  it("ends with what Dependabot still needs", async () => {
    await setUp([ACME]);
    put(root, ".github/dependabot.yml", "version: 2\nupdates: []\n");
    put(root, ".npmrc", "@acme:registry=https://acme.jfrog.io/npm/\n");
    const r = await preset(["add", "@acme/web", "--yes"]);
    expect(r.out.slice(-2)).toEqual([
      "Next: in .github/dependabot.yml, give @acme/web a group of its own, so its updates arrive as their own pull requests.",
      "Next: in .github/dependabot.yml, add https://acme.jfrog.io/npm/ under registries, so Dependabot sees new versions of @acme/web.",
    ]);
  });
});

describe("npm's failures and Dependabot's needs", () => {
  it.each([
    ["401", "401 Unauthorized"],
    ["403", "403 Forbidden"],
    ["404", "404 Not Found"],
  ])(
    "names the status of E%s, and the token a private package needs",
    (code, status) => {
      expect(installError("p", `npm error code E${code}\n`, "R")).toEqual([
        `npm couldn't install p: R answered ${status}.`,
        "If it's a private package, give this machine a token for R, as .npmrc expects.",
      ]);
    },
  );

  it("names any other status without the token line", () => {
    expect(installError("p", "npm error code E500\n", "R")).toEqual([
      "npm couldn't install p: R answered 500 Internal Server Error.",
    ]);
  });

  it("gives npm's last error line when it has no HTTP status", () => {
    expect(
      installError(
        "p",
        "npm error code ENOTFOUND\nnpm error getaddrinfo ENOTFOUND x\n",
        "R",
      ),
    ).toEqual(["npm couldn't install p:", "npm error getaddrinfo ENOTFOUND x"]);
  });

  it("counts a group as the package's own only when it is the group's one pattern", async () => {
    const groups = (patterns: string[]) =>
      `version: 2\nupdates:\n  - package-ecosystem: npm\n    groups:\n      g:\n        patterns: ${JSON.stringify(patterns)}\n`;
    expect(await hasOwnGroup(groups(["@acme/p"]), "@acme/p")).toBe(true);
    expect(await hasOwnGroup(groups(["@acme/p", "x"]), "@acme/p")).toBe(false);
  });

  it("names no registry Dependabot already has", async () => {
    const text =
      'version: 2\nregistries:\n  acme:\n    type: npm-registry\n    url: https://acme.jfrog.io/npm\nupdates:\n  - groups:\n      p:\n        patterns: ["@acme/p"]\n';
    expect(
      await nextLines(
        text,
        "@acme:registry=https://acme.jfrog.io/npm/\n",
        "@acme/p",
      ),
    ).toEqual([]);
  });
});

describe("factory preset remove", () => {
  /** The docs' repository: both presets, 30 chosen over 40. */
  const both = async () => {
    await setUp([ACME, NODE]);
    put(
      root,
      ".claude/factory.choices.yaml",
      `rules.small-change-lines: "${NODE}"\n`,
    );
    await sync();
  };
  const SUMMARY = [
    `Removing ${NODE} would change these settings here:`,
    "",
    "  removed",
    "    plugins.build.reviewers    − node-deps-reviewer",
    "    pr-review.commands         − npm audit",
    "  back to the default",
    "    rules.review-rounds        3 → 2",
    "    commands.gate              npm test → none",
    "  back to a value you chose against",
    `    rules.small-change-lines   30 → 40, from ${ACME}`,
    "",
    "  deletes .claude/agents/node-deps-reviewer.md",
  ];

  it("shows the summary, asks about a value you chose against, and applies on y", async () => {
    await both();
    const r = await preset(["remove", NODE], ["40", "y"]);
    expect(r.out).toEqual([
      ...SUMMARY,
      "",
      "Choose:",
      `  rules.small-change-lines: use 40 from ${ACME}, or keep 30 in your .claude/factory.yaml? [40/30] 40`,
      "",
      "Apply? [y/N] y",
      `removed ${NODE} from presets in .claude/factory.yaml`,
      "removed 1 choice from .claude/factory.choices.yaml",
      // The copies the settings change: two rounds again, and no review.
      "wrote .claude/skills/factory-address-review/SKILL.md",
      "wrote .claude/factory/rules.md",
      "wrote .github/workflows/factory.yml",
      "wrote .github/workflows/factory-review.yml",
      "deleted .claude/agents/node-deps-reviewer.md",
      "wrote .claude/factory.lock",
    ]);
    expect(read(root, ".claude/factory.yaml")).not.toContain(NODE);
    expect(read(root, ".claude/factory.choices.yaml")).toBeNull();
  });

  it("colors the summary when it paints", async () => {
    await both();
    const paint = painter(true);
    const r = await preset(["remove", NODE, "--dry-run"], [], { paint });
    expect(r.out).toEqual([
      `Removing ${NODE} would change these settings here:`,
      "",
      `  ${paint("bold", "removed")}`,
      `    plugins.build.reviewers    ${paint("red", "− node-deps-reviewer")}`,
      `    pr-review.commands         ${paint("red", "− npm audit")}`,
      `  ${paint("bold", "back to the default")}`,
      `    rules.review-rounds        ${paint("dim", "3")} → ${paint("bold", "2")}`,
      `    commands.gate              ${paint("dim", "npm test")} → ${paint("bold", "none")}`,
      `  ${paint("bold", "back to a value you chose against")}`,
      `    rules.small-change-lines   ${paint("dim", "30")} → ${paint("bold", "40")}, from ${ACME}`,
      "",
      "  deletes .claude/agents/node-deps-reviewer.md",
    ]);
  });

  it("writes the kept value into .claude/factory.yaml", async () => {
    await both();
    await preset(["remove", NODE], ["30", "y"]);
    expect(read(root, ".claude/factory.yaml")).toMatch(
      /small-change-lines: 30/,
    );
  });

  it("keeps the package while another listed preset is in it, and uninstalls it with the last", async () => {
    await both();
    let r = await preset(["remove", NODE, "--yes"]);
    expect(r.npm).not.toContainEqual(["uninstall", ACME]);
    r = await preset(["remove", ACME, "--yes"]);
    expect(r.npm).toContainEqual(["uninstall", ACME]);
  });

  it("takes the remaining preset's value with --yes, writing nothing into .claude/factory.yaml", async () => {
    await both();
    const r = await preset(["remove", NODE, "--yes"], [], { terminal: false });
    expect(r.code).toBe(0);
    expect(read(root, ".claude/factory.yaml")).not.toContain(
      "small-change-lines",
    );
    expect(read(root, ".claude/factory.lock")).toMatch(
      /small-change-lines: 40 +# @acme\/factory-preset\n/,
    );
  });

  it("changes nothing on no, outside a terminal, or with --dry-run", async () => {
    await both();
    const before = read(root, ".claude/factory.yaml");
    expect((await preset(["remove", NODE], ["40", "n"])).out.at(-1)).toBe(
      "Nothing changed.",
    );
    const outside = await preset(["remove", NODE], [], { terminal: false });
    expect(outside.code).toBe(1);
    expect(outside.out.at(-1)).toBe(
      "Run it in a terminal to choose, or add --yes to apply it.",
    );
    const dry = await preset(["remove", NODE, "--dry-run"]);
    expect(dry.out).toEqual(SUMMARY);
    expect(read(root, ".claude/factory.yaml")).toBe(before);
    expect(dry.npm.concat(outside.npm)).toEqual([]);
  });

  it("refuses a preset not listed", async () => {
    await setUp([ACME]);
    const r = await preset(["remove", NODE]);
    expect(r.code).toBe(1);
    expect(r.err).toEqual([`${NODE} is not in presets`]);
  });
});

describe("factory preset choices and choose", () => {
  const LISTED = [
    "rules.review-rounds                    not chosen yet",
    `  1) 2   ${ACME}`,
    `  2) 3   ${NODE}     ← applies now`,
  ];
  const disagree = async () => {
    await setUp([ACME, NODE]);
    install(root, ACME, "1.4.0", {
      ...PACKAGES[ACME]!.presets,
      "": {
        settings: ACME_BASE.replace(
          "  small-change-lines: 40",
          "  small-change-lines: 40\n  review-rounds: 2",
        ),
      },
    });
    put(
      root,
      ".claude/factory.choices.yaml",
      `rules.small-change-lines: "${NODE}"\n`,
    );
    await sync();
  };

  it("lists each disagreement and asks which preset to follow, writing what changed", async () => {
    await disagree();
    const r = await preset(["choices"], ["2", ""]);
    expect(r.out).toEqual([
      ...LISTED,
      "  choose [1/2, Enter keeps it]: 2",
      "",
      "rules.small-change-lines               chosen",
      `  1) 40  ${ACME}`,
      `  2) 30  ${NODE}     ← applies now`,
      "  choose [1/2, Enter keeps it]: ",
      "",
      "wrote .claude/factory.choices.yaml",
      "wrote .claude/factory.lock",
    ]);
    expect(read(root, ".claude/factory.choices.yaml")).toContain(
      `rules.review-rounds: "${NODE}"`,
    );
  });

  it("says Nothing changed. when every answer keeps it", async () => {
    await disagree();
    const r = await preset(["choices"], ["", ""]);
    expect(r.out.at(-1)).toBe("Nothing changed.");
  });

  it("prints the list without asking outside a terminal", async () => {
    await disagree();
    const r = await preset(["choices"], [], { terminal: false });
    expect(r.code).toBe(0);
    expect(r.asked).toEqual([]);
    expect(r.out.slice(0, 3)).toEqual(LISTED);
  });

  it("says when no two presets disagree", async () => {
    await setUp([ACME]);
    const r = await preset(["choices"]);
    expect(r.out).toEqual(["No two presets disagree here."]);
  });

  it("records one choice without asking", async () => {
    await disagree();
    const r = await preset(["choose", "rules.review-rounds", ACME]);
    expect(r.code).toBe(0);
    expect(read(root, ".claude/factory.lock")).toMatch(
      /review-rounds: 2 +# @acme\/factory-preset, chosen over @acme\/factory-preset\/node/,
    );
  });

  it("refuses a key no two presets disagree on, and a preset that doesn't set it", async () => {
    await disagree();
    let r = await preset(["choose", "rules.relock", ACME]);
    expect(r.err).toEqual(["rules.relock: no two presets disagree on this"]);
    expect(r.code).toBe(1);
    r = await preset(["choose", "rules.review-rounds", "@acme/web"]);
    expect(r.err).toEqual(["rules.review-rounds: @acme/web doesn't set this"]);
    expect(r.code).toBe(1);
  });

  it("writes the choices file as one quoted line a choice, under its comment", async () => {
    await disagree();
    await preset(["choose", "rules.review-rounds", ACME]);
    expect(read(root, ".claude/factory.choices.yaml")).toBe(
      [
        "# Written by `factory preset add`, `remove`, and `choices`: which preset",
        "# wins where two presets set the same thing. Change it with",
        "# `factory preset choices`.",
        `rules.small-change-lines: "${NODE}"`,
        `rules.review-rounds: "${ACME}"`,
        "",
      ].join("\n"),
    );
  });
});

describe("factory preset check", () => {
  const checkIn = async (presets: Record<string, PresetFiles>) => {
    root = mkdtempSync(join(tmpdir(), "factory-preset-pkg-"));
    writePackage(root, ACME, "1.0.0", presets);
    return preset(["check"]);
  };

  it("lists each preset it finds and what it ships", async () => {
    const r = await checkIn({
      "": {
        settings: ACME_BASE,
        agents: { "acme-security-reviewer": "s\n" },
        skills: { "acme-refine": "r\n" },
      },
      node: { settings: "version: 2\n" },
    });
    expect(r.code).toBe(0);
    expect(r.out).toEqual([
      `${ACME}        1 agent, 1 skill`,
      `${NODE}   no agents or skills`,
    ]);
  });

  it("names each problem with what to change, and fails", async () => {
    const r = await checkIn({
      "": { settings: "version: 2\n", agents: {} },
      node: {
        settings: "version: 2\nauto-merge:\n  allow: [src/**]\npresets: [x]\n",
      },
    });
    expect(r.code).toBe(1);
    expect(r.out).toEqual([
      "node/factory-preset.yaml: auto-merge.allow: a preset can't set this. Remove it, and set it in each repository that wants it",
      "node/factory-preset.yaml: presets: a preset can't name another preset. Remove it, and list each preset in the repositories that use this one",
    ]);
  });

  it("notes a plugin the package doesn't ship without failing, and says nothing of the factory's own", async () => {
    const r = await checkIn({
      "": {
        settings:
          "version: 2\nplugins:\n  build:\n    reviewers:\n      - agent: acme-docs-reader\n        files: [docs/**]\n  test:\n    reviewers:\n      - agent: factory-test-reviewer\n",
      },
    });
    expect(r.code).toBe(0);
    expect(r.out.at(-1)).toBe(
      "factory-preset.yaml: plugins.build.reviewers: acme-docs-reader: not shipped here, so each repository that uses this preset must provide it",
    );
    expect(r.out.join("\n")).not.toContain("factory-test-reviewer");
  });

  it("says there is no preset where there is no package.json or no preset file", async () => {
    root = mkdtempSync(join(tmpdir(), "factory-preset-pkg-"));
    let r = await preset(["check"]);
    expect(r.err).toEqual([
      "No preset here: no factory-preset.yaml beside a package.json",
    ]);
    expect(r.code).toBe(1);
    put(root, "package.json", "{}");
    r = await preset(["check"]);
    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      "No preset here: no factory-preset.yaml beside a package.json",
    ]);
  });
});

describe("factory preset changes", () => {
  /** The lock at REF, then the working tree's after a newer ACME. */
  const update = async (
    acme150: string,
    agents: Record<string, string> = {
      "acme-security-reviewer": "security\n",
      "acme-a11y-reviewer": "a11y\n",
    },
  ) => {
    await setUp([ACME, NODE], GATE);
    put(
      root,
      ".claude/factory.choices.yaml",
      `rules.small-change-lines: "${NODE}"\n`,
    );
    await sync();
    const before = read(root, ".claude/factory.lock")!;
    install(root, ACME, "1.5.0", {
      ...PACKAGES[ACME]!.presets,
      "": {
        settings: acme150,
        agents,
      },
    });
    await sync();
    return preset(["changes", "main"], [], {
      show: (ref, path) =>
        ref === "main" && path === ".claude/factory.lock" ? before : null,
    });
  };

  it("says what changed here, what needs a choice, and what doesn't apply", async () => {
    const r = await update(
      [
        "version: 2",
        "rules:",
        "  small-change-lines: 35",
        "  review-rounds: 2",
        "commands:",
        "  gate: [npm run lint]",
        "plugins:",
        "  build:",
        "    reviewers:",
        "      - agent: acme-security-reviewer",
        "        files: [src/**]",
        "      - agent: acme-a11y-reviewer",
        "        files: [src/**]",
        "",
      ].join("\n"),
    );
    expect(r.out).toEqual([
      `${ACME} 1.4.0 → 1.5.0`,
      "",
      "Changes here:",
      "- plugins.build.reviewers: + acme-a11y-reviewer,",
      "  which wrote .claude/agents/acme-a11y-reviewer.md",
      "",
      "Needs a choice:",
      `- rules.review-rounds: ${ACME} now sets 2, and ${NODE} sets 3. 3 applies, from the later preset, until you choose.`,
      "",
      "Doesn't apply here:",
      `- rules.small-change-lines: 40 → 35, but you chose ${NODE}'s 30`,
      "- commands.gate, which your .claude/factory.yaml sets",
      "",
      "To choose, on this branch:",
      "  factory preset choices",
    ]);
  });

  it("says Nothing changes here. when an update changes nothing in effect", async () => {
    const r = await update(ACME_BASE, {
      "acme-security-reviewer": "security\n",
    });
    expect(r.out).toEqual([
      `${ACME} 1.4.0 → 1.5.0`,
      "",
      "Nothing changes here.",
    ]);
  });
});

describe("factory doctor's preset lines", () => {
  it("says each preset is installed as the lock records, and whether it has a Dependabot group", async () => {
    await setUp([ACME]);
    put(root, ".github/dependabot.yml", "version: 2\nupdates: []\n");
    const lines = await presetChecks(root, null);
    expect(lines).toEqual([
      {
        state: "pass",
        text: `${ACME} 1.4.0 is installed, as the lock records`,
      },
      {
        state: "fail",
        text: `${ACME} has no Dependabot group of its own, so its updates may arrive with other packages`,
        fix: `in .github/dependabot.yml, give ${ACME} a group of its own`,
      },
    ]);
  });

  it("gives a stale lock one line, and a preset at another version its own", async () => {
    await setUp([ACME]);
    install(root, ACME, "1.5.0", PACKAGES[ACME]!.presets);
    const stale = await staleOf(defaultDeps(root, {}));
    const lines = await presetChecks(root, stale);
    expect(lines).toEqual([
      {
        state: "fail",
        text: `${ACME} is 1.5.0 in node_modules but 1.4.0 in .claude/factory.lock. Run: factory sync`,
      },
    ]);
    put(
      root,
      ".claude/factory.yaml",
      own([ACME], ["rules:", "  review-rounds: 4"]),
    );
    const changed = await presetChecks(
      root,
      await staleOf(defaultDeps(root, {})),
    );
    expect(changed[0]).toEqual({
      state: "fail",
      text: ".claude/factory.yaml changed since the last sync. Run: factory sync",
    });
  });
});

describe("factory deps with presets", () => {
  const bump = (title: string): Bump => ({
    number: 1,
    title,
    head: "b",
    sha: "abcdef0",
    major: false,
    mergeableState: "clean",
    autoMerge: false,
    checks: [{ id: 1, name: "CI", status: "completed", conclusion: "success" }],
    shepherdComments: 0,
  });

  it("says an update of a preset's package needs a sync, as the factory's does", () => {
    const synced = ["@davidbyoung/software-factory", ACME];
    expect(
      nextStep(bump(`Bump ${ACME} from 1.4.0 to 1.5.0`), "main", synced),
    ).toBe("sync (step 4)");
    expect(
      nextStep(
        bump("Bump @davidbyoung/software-factory from 0.4.0 to 0.5.0"),
        "main",
        synced,
      ),
    ).toBe("sync (step 4)");
    expect(
      nextStep(bump("Bump left-pad from 1.0.0 to 1.0.1"), "main", synced),
    ).toBe("nothing: waits on its merge");
  });
});

describe("the factory-deps skill on a preset update", () => {
  it("syncs it as it does the factory's, and comments what factory preset changes prints", () => {
    const skill = readFileSync(
      join(PACKAGE, "skills/factory-deps/SKILL.md"),
      "utf8",
    );
    const step = skill.split("## 4. ")[1]!.split("\n## ")[0]!;
    expect(step).toMatch(/^An update of the factory or a preset/);
    expect(step).toContain("factory sync");
    expect(step).toContain("factory preset changes origin/DEFAULT");
  });
});
