import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeSettings } from "./locked.ts";
import { main, type Deps } from "../src/commands.mts";
import { parseSettings, SettingsError } from "../src/config.mts";
import { CODE_HOST, CODE_HOST_YAML } from "./settings-fixture";
import { specTools } from "../src/specs/index.mts";
import { openspec } from "../src/specs/openspec.mts";
import type { Run } from "../src/specs/types.mts";
import { NotFoundError } from "../src/tickets/types.mts";
import { BUILT } from "../src/tool-names.mts";
import { pagesSpecTool } from "./memory-tools";
import { into } from "./printed";

const ROOT = "/repo";

type Ran = { command: string; cwd: string; env: Record<string, string> };

/** A repository as git answers for it: the files it has, which of them
 * changed since `BASE`, the commit the branch left `origin/main` at, and
 * whether there is an `origin/main` at all. */
type Repo = {
  files?: string[];
  /** Folders git still lists files in that are gone from the disk. */
  gone?: string[];
  changed?: string[];
  remote?: boolean;
  shared?: boolean;
  diff?: string;
};

const BASE = "b45e";

function gitFor(repo: Repo) {
  return (args: string[]) => {
    const [cmd] = args;
    if (cmd === "rev-parse")
      return {
        ok: repo.remote !== false,
        out: repo.remote === false ? "" : "x",
      };
    if (cmd === "merge-base")
      return repo.shared === false
        ? { ok: false, out: "" }
        : { ok: true, out: `${BASE}\n` };
    if (cmd === "diff" && args.includes("-U0"))
      return { ok: true, out: repo.diff ?? "" };
    if (cmd === "diff")
      return { ok: true, out: (repo.changed ?? []).join("\n") };
    return { ok: true, out: "" };
  };
}

/** The commands' dependencies with a runner that runs nothing: it records
 * each command, its directory, and what was added to its environment, and
 * answers with the next status in `statuses`, or 0. */
function deps(
  raw: Record<string, unknown> = {},
  statuses: number[] = [],
  repo: Repo = {},
  read: Record<string, string> = {},
) {
  const ran: Ran[] = [];
  const out: string[] = [];
  /** Every line printed, in color. */
  const looks: string[] = [];
  const err: string[] = [];
  const left = [...statuses];
  const d: Deps = {
    root: ROOT,
    settings: async () =>
      parseSettings(
        { version: 1, repository: "o/r", "code-host": CODE_HOST, ...raw },
        () => true,
      ),
    exec: (command, cwd, env) => {
      // The `$ COMMAND` line is printed before the command runs.
      out.push(`(ran ${command})`);
      ran.push({ command, cwd, env });
      return left.shift() ?? 0;
    },
    out: into(out, looks),
    err: into(err, looks),
    specTools: specTools(),
    labels: async () => [],
    git: gitFor(repo),
    defaultBranch: async () => "main",
    files: () => repo.files ?? [],
    exists: (path) =>
      !(repo.gone ?? []).includes(path) &&
      (repo.files ?? []).some((f) => f === path || f.startsWith(`${path}/`)),
    readFile: (path) => {
      if (path in read) return read[path]!;
      throw new Error(`no ${path}`);
    },
  };
  return { d, ran, out, err, looks };
}

const GATE = { commands: { gate: ["npm run lint", "npm test"] } };

describe("kodor gate", () => {
  it("runs each command in order from the root, prints `$ COMMAND` before each, and exits 0 when all pass", async () => {
    const { d, ran, out, err } = deps(GATE);

    expect(await main(["gate"], d)).toBe(0);
    expect(ran).toEqual([
      { command: "npm run lint", cwd: ROOT, env: { BASE } },
      { command: "npm test", cwd: ROOT, env: { BASE } },
    ]);
    expect(out).toEqual([
      "$ npm run lint",
      "(ran npm run lint)",
      "$ npm test",
      "(ran npm test)",
      "✓ Every gate command passed.",
    ]);
    expect(err).toEqual([]);
  });

  it("runs none after a command that fails, names it on standard error, and exits 1", async () => {
    const { d, ran, err } = deps(
      { commands: { gate: ["one", "two", "three"] } },
      [0, 3],
    );

    expect(await main(["gate"], d)).toBe(1);
    expect(ran.map((r) => r.command)).toEqual(["one", "two"]);
    expect(err).toEqual(["✗ The gate failed on: two"]);
  });

  it("fails, saying no gate is set, when commands.gate is empty", async () => {
    const { d, ran, out, err } = deps();

    expect(await main(["gate"], d)).toBe(1);
    expect(err).toEqual([
      "commands.gate is not set: add the commands that check a change to .claude/kodor.yaml",
    ]);
    expect(out).toEqual([]);
    expect(ran).toEqual([]);
  });

  it("prints its usage and exits 2 for an argument", async () => {
    const { d, ran, err } = deps(GATE);

    expect(await main(["gate", "--fast"], d)).toBe(2);
    expect(err).toEqual(["Usage: kodor gate [--dry-run | --all]"]);
    expect(ran).toEqual([]);
  });
});

const TEST_ONE = { commands: { "test-one": 'runner $FILE -t "$NAME"' } };

describe("kodor test-one", () => {
  it("runs the command from the root with FILE and NAME in its environment, and exits with its status", async () => {
    const { d, ran, err } = deps(TEST_ONE, [7]);

    expect(await main(["test-one", "tests/a.test.ts", "adds two"], d)).toBe(7);
    expect(ran).toEqual([
      {
        command: 'runner $FILE -t "$NAME"',
        cwd: ROOT,
        env: { FILE: "tests/a.test.ts", NAME: "adds two" },
      },
    ]);
    expect(err).toEqual(["✗ The test failed."]);
  });

  it("ends with a line saying the test passed", async () => {
    const { d, out, err } = deps(TEST_ONE);

    expect(await main(["test-one", "tests/a.test.ts"], d)).toBe(0);
    expect(out.at(-1)).toBe("✓ The test passed.");
    expect(err).toEqual([]);
  });

  it("gives an empty NAME when none is given", async () => {
    const { d, ran } = deps(TEST_ONE);

    expect(await main(["test-one", "tests/a.test.ts"], d)).toBe(0);
    expect(ran[0].env).toEqual({ FILE: "tests/a.test.ts", NAME: "" });
  });

  it("fails, saying so, when commands.test-one is not set", async () => {
    const { d, ran, err } = deps();

    expect(await main(["test-one", "tests/a.test.ts"], d)).toBe(1);
    expect(err).toEqual(["commands.test-one is not set"]);
    expect(ran).toEqual([]);
  });

  it.each([
    ["no FILE", []],
    ["an option it does not know", ["--watch", "tests/a.test.ts"]],
    ["a third argument", ["tests/a.test.ts", "adds two", "more"]],
  ])("prints its usage and exits 2 for %s", async (_, args) => {
    const { d, ran, err } = deps(TEST_ONE);

    expect(await main(["test-one", ...args], d)).toBe(2);
    expect(err).toEqual(["Usage: kodor test-one FILE [NAME]"]);
    expect(ran).toEqual([]);
  });
});

const E2E = { commands: { "end-to-end": "browser-tests $FILE" } };

describe("kodor end-to-end", () => {
  it("runs the command once from the root with FILE in its environment, and exits with its status", async () => {
    const { d, ran, err } = deps(E2E, [4]);

    expect(await main(["end-to-end", "e2e/home.spec.ts"], d)).toBe(4);
    expect(ran).toEqual([
      {
        command: "browser-tests $FILE",
        cwd: ROOT,
        env: { FILE: "e2e/home.spec.ts" },
      },
    ]);
    expect(err).toEqual(["✗ The test failed."]);
  });

  it("runs the command K times in a row with --times K, and exits 0 when every run passes", async () => {
    const { d, ran, out, err } = deps(E2E);

    expect(
      await main(["end-to-end", "e2e/home.spec.ts", "--times", "3"], d),
    ).toBe(0);
    expect(ran.map((r) => r.env)).toEqual([
      { FILE: "e2e/home.spec.ts" },
      { FILE: "e2e/home.spec.ts" },
      { FILE: "e2e/home.spec.ts" },
    ]);
    expect(out.filter((l) => l.startsWith("✓"))).toEqual([
      "✓ The test passed.",
    ]);
    expect(out.at(-1)).toBe("✓ The test passed.");
    expect(err).toEqual([]);
  });

  it("stops at the first run that fails, says which of K it was, and exits 1", async () => {
    const { d, ran, err } = deps(E2E, [0, 9]);

    expect(
      await main(["end-to-end", "e2e/home.spec.ts", "--times", "5"], d),
    ).toBe(1);
    expect(ran).toHaveLength(2);
    expect(err).toEqual(["failed on run 2 of 5", "✗ The test failed."]);
  });

  it("fails, saying so, when commands.end-to-end is not set", async () => {
    const { d, ran, err } = deps();

    expect(await main(["end-to-end", "e2e/home.spec.ts"], d)).toBe(1);
    expect(err).toEqual(["commands.end-to-end is not set"]);
    expect(ran).toEqual([]);
  });

  it.each([
    ["no FILE", []],
    ["--times alone, with no FILE", ["--times", "3"]],
    ["--times with no value", ["e2e/home.spec.ts", "--times"]],
    ["--times 0", ["e2e/home.spec.ts", "--times", "0"]],
    ["--times with a fraction", ["e2e/home.spec.ts", "--times", "2.5"]],
    ["--times with a word", ["e2e/home.spec.ts", "--times", "many"]],
    ["an option it does not know", ["e2e/home.spec.ts", "--headed"]],
    ["a second FILE", ["e2e/home.spec.ts", "e2e/other.spec.ts"]],
  ])("prints its usage and exits 2 for %s", async (_, args) => {
    const { d, ran, err } = deps(E2E);

    expect(await main(["end-to-end", ...args], d)).toBe(2);
    expect(err).toEqual(["Usage: kodor end-to-end FILE [--times K]"]);
    expect(ran).toEqual([]);
  });
});

describe("kodor specs check", () => {
  it("runs specs.check from the root with DO_NOT_TRACK=1, and exits with its status", async () => {
    const { d, ran, out, err } = deps(
      { specs: { type: "openspec", check: "check-the-specs --all" } },
      [5],
    );

    expect(await main(["specs-check"], d)).toBe(5);
    expect(ran).toEqual([
      {
        command: "check-the-specs --all",
        cwd: ROOT,
        env: { DO_NOT_TRACK: "1" },
      },
    ]);
    expect(out).toEqual(["(ran check-the-specs --all)"]);
    expect(err).toEqual(["✗ The specs check failed."]);
  });

  it("ends with a line saying the check passed", async () => {
    const { d, out } = deps({ specs: { type: "openspec", check: "check" } });

    expect(await main(["specs-check"], d)).toBe(0);
    expect(out).toEqual(["(ran check)", "✓ The specs check passed."]);
  });

  it("has each command it runs as one to copy, and a green mark when it passes", async () => {
    const { d, looks } = deps(GATE);
    await main(["gate"], d);
    expect(looks[0]).toBe("$ {copy:npm run lint}");
    expect(looks.at(-1)).toBe("{good:✓} Every gate command passed.");
  });

  it("has a red mark when it fails, and its words plain", async () => {
    const { d, looks } = deps(GATE, [1]);
    await main(["gate"], d);
    expect(looks.at(-1)).toBe("{bad:✗} The gate failed on: npm run lint");
  });

  it("says there is no spec tool and exits 0 when specs.type is none", async () => {
    const { d, ran, out, err } = deps({ specs: "none" });

    expect(await main(["specs-check"], d)).toBe(0);
    expect(out).toEqual([NONE]);
    expect(err).toEqual([]);
    expect(ran).toEqual([]);
  });

  it("prints its usage and exits 2 for an argument", async () => {
    const { d, ran, err } = deps({ specs: "openspec" });

    expect(await main(["specs-check", "--strict"], d)).toBe(2);
    expect(err).toEqual(["Usage: kodor specs check"]);
    expect(ran).toEqual([]);
  });
});

const NONE = "- No spec tool (specs: none): each ticket holds its own spec.";

/** OpenSpec over a temporary root, with a runner that runs nothing: `new
 * change` and `archive` make and move the change's folder as OpenSpec
 * does, `--version` answers whether it is installed, and each run is
 * recorded with what was added to its environment. */
function openspecAt(o: { installed?: boolean; archive?: number } = {}) {
  const root = mkdtempSync(join(tmpdir(), "factory-specs-"));
  const runs: { argv: string[]; env: Record<string, string> }[] = [];
  const run: Run = (argv, cwd, env) => {
    runs.push({ argv: argv.slice(3), env });
    const [verb, a, b] = argv.slice(3);
    if (verb === "--version") return o.installed === false ? 1 : 0;
    if (verb === "new")
      mkdirSync(join(cwd, "openspec/changes", b!), { recursive: true });
    if (verb === "archive") {
      if (o.archive) return o.archive;
      mkdirSync(join(cwd, "openspec/changes/archive"), { recursive: true });
      renameSync(
        join(cwd, "openspec/changes", a!),
        join(cwd, "openspec/changes/archive", `2026-11-22-${a}`),
      );
    }
    return 0;
  };
  return { root, runs, tools: { openspec: openspec(run) } };
}

/** The commands over `openspecAt`, with ticket 37 labeled `labels`. */
function specDeps(
  at: ReturnType<typeof openspecAt>,
  labels: string[] | null = ["spec"],
  settings: Record<string, unknown> = {},
) {
  const { d, out, err, looks } = deps({ specs: "openspec", ...settings });
  d.root = at.root;
  d.specTools = at.tools;
  d.labels = async (_s, id) => {
    if (labels === null) throw new NotFoundError(`#${id}`);
    return labels;
  };
  return { d, out, err, looks };
}

const SPEC_FILES = [
  "  new  proposal.md               The owner's text and Decisions, linking ticket 37",
  `  new  specs/CAPABILITY/spec.md  One per heading under Spec: ADDED for (new), MODIFIED for (modified), REMOVED for each "No longer" line; each numbered line is one requirement whose SHALL sentence restates it, with one scenario whose WHEN is the line's "When" clause and whose THEN is the rest`,
  "  new  design.md                 Design, under For the builder",
  "  new  tasks.md                  Tasks, under For the builder",
];

describe("kodor specs with no spec tool", () => {
  it.each([[["specs-list"]], [["specs-new", "37"]], [["specs-finish", "37"]]])(
    "%j says there is no spec tool and exits 0",
    async (argv) => {
      const { d, ran, out, err } = deps({ specs: "none" });

      expect(await main(argv, d)).toBe(0);
      expect(out).toEqual([NONE]);
      expect(err).toEqual([]);
      expect(ran).toEqual([]);
    },
  );

  it("dims the mark", async () => {
    const { d, looks } = deps({ specs: "none" });
    await main(["specs-check"], d);
    expect(looks).toEqual([`{skip:-} ${NONE.slice(2)}`]);
  });
});

describe("kodor specs list", () => {
  let at: ReturnType<typeof openspecAt>;
  afterEach(() => rmSync(at.root, { recursive: true, force: true }));

  it("lists each spec by name, sorted, with its file in one column", async () => {
    at = openspecAt();
    for (const name of ["settings", "cli-output", "docs"]) {
      mkdirSync(join(at.root, "openspec/specs", name), { recursive: true });
      writeFileSync(join(at.root, "openspec/specs", name, "spec.md"), "");
    }
    const { d, out } = specDeps(at);

    expect(await main(["specs-list"], d)).toBe(0);
    expect(out).toEqual([
      "specs: openspec",
      "  cli-output  openspec/specs/cli-output/spec.md",
      "  docs        openspec/specs/docs/spec.md",
      "  settings    openspec/specs/settings/spec.md",
    ]);
  });

  it("says none yet when there is no spec", async () => {
    at = openspecAt();
    const { d, out } = specDeps(at);

    expect(await main(["specs-list"], d)).toBe(0);
    expect(out).toEqual(["specs: openspec", "  none yet"]);
  });
});

describe("kodor specs new", () => {
  let at: ReturnType<typeof openspecAt>;
  afterEach(() => rmSync(at.root, { recursive: true, force: true }));

  it("starts the change and lists the four files of a spec ticket", async () => {
    at = openspecAt();
    const { d, out, err } = specDeps(at);

    expect(await main(["specs-new", "37"], d)).toBe(0);
    expect(out).toEqual([
      "Started ticket 37's spec in openspec/changes/issue-37/",
      "Write each file from ticket 37's body:",
      ...SPEC_FILES,
      "Then: kodor specs check",
    ]);
    expect(err).toEqual([]);
    expect(at.runs.map((r) => r.argv)).toEqual([
      ["--version"],
      ["new", "change", "issue-37"],
    ]);
  });

  it("lists only the proposal and the specs for a ticket without the spec label", async () => {
    at = openspecAt();
    const { d, out } = specDeps(at, []);

    expect(await main(["specs-new", "37"], d)).toBe(0);
    expect(out.slice(2, -1)).toEqual([
      "  new  proposal.md               The owner's text and Decisions, linking ticket 37",
      SPEC_FILES[1],
    ]);
  });

  it("lists the four files for a ticket with the spec label's configured name", async () => {
    at = openspecAt();
    const renamed = { tickets: { labels: { spec: "needs-spec" } } };
    const { d, out } = specDeps(at, ["needs-spec"], renamed);

    expect(await main(["specs-new", "37"], d)).toBe(0);
    expect(out.slice(2, -1)).toEqual(SPEC_FILES);
  });

  it("says a change already started is started, lists the files again, and starts nothing", async () => {
    at = openspecAt();
    mkdirSync(join(at.root, "openspec/changes/issue-37"), { recursive: true });
    const { d, out } = specDeps(at);

    expect(await main(["specs-new", "37"], d)).toBe(0);
    expect(out[0]).toBe(
      "Ticket 37's spec is already started in openspec/changes/issue-37/",
    );
    expect(out.slice(1)).toEqual([
      "Write each file from ticket 37's body:",
      ...SPEC_FILES,
      "Then: kodor specs check",
    ]);
    expect(at.runs.map((r) => r.argv)).toEqual([["--version"]]);
  });

  it("says OpenSpec is not installed, creates nothing, and exits 1", async () => {
    at = openspecAt({ installed: false });
    mkdirSync(join(at.root, "openspec/changes/issue-37"), { recursive: true });
    const { d, out, err } = specDeps(at);

    expect(await main(["specs-new", "37"], d)).toBe(1);
    expect(out).toEqual([]);
    expect(err).toEqual([
      "✗ OpenSpec is not installed: run kodor init, which installs it.",
    ]);
    expect(at.runs.map((r) => r.argv)).toEqual([["--version"]]);
  });

  it("prints the ticket system's message for a missing ticket before it looks at OpenSpec", async () => {
    at = openspecAt({ installed: false });
    const { d, err } = specDeps(at, null);

    expect(await main(["specs-new", "37"], d)).toBe(1);
    expect(err).toEqual(["#37 was not found"]);
    expect(at.runs).toEqual([]);
  });

  it("runs OpenSpec with DO_NOT_TRACK=1", async () => {
    at = openspecAt();
    const { d } = specDeps(at);

    await main(["specs-new", "37"], d);
    expect(at.runs.map((r) => r.env)).toEqual([
      { DO_NOT_TRACK: "1" },
      { DO_NOT_TRACK: "1" },
    ]);
  });
});

describe("kodor specs new, with a spec tool that is not OpenSpec", () => {
  it("lists the files it updates and writes, and ends with the tool's own next step", async () => {
    const { d, out } = deps({ specs: "pages" });
    d.settings = async () =>
      parseSettings(
        {
          version: 1,
          repository: "o/r",
          "code-host": CODE_HOST,
          specs: "pages",
        },
        () => true,
        { ...BUILT, specs: { ...BUILT.specs, pages: "pages check" } },
      );
    d.specTools = { pages: pagesSpecTool() };

    expect(await main(["specs-new", "37"], d)).toBe(0);
    expect(out).toEqual([
      "Started ticket 37's spec in pages/",
      "Write each file from ticket 37's body:",
      "  update  pages/SITEMAP.md  A line for ticket 37",
      "  new     pages/37.md       The Spec",
      "Then: /pages-review",
    ]);
  });
});

describe("kodor specs finish", () => {
  let at: ReturnType<typeof openspecAt>;
  afterEach(() => rmSync(at.root, { recursive: true, force: true }));

  it("folds a started change into openspec/specs/ with OpenSpec's archive", async () => {
    at = openspecAt();
    mkdirSync(join(at.root, "openspec/changes/issue-37"), { recursive: true });
    const { d, out, err } = specDeps(at);

    expect(await main(["specs-finish", "37"], d)).toBe(0);
    expect(out).toEqual(["✓ Folded ticket 37's spec into openspec/specs/."]);
    expect(err).toEqual([]);
    expect(at.runs).toEqual([
      { argv: ["archive", "issue-37", "--yes"], env: { DO_NOT_TRACK: "1" } },
    ]);
  });

  it("says a change already folded is folded, and exits 0", async () => {
    at = openspecAt();
    mkdirSync(join(at.root, "openspec/changes/archive/2026-11-21-issue-37"), {
      recursive: true,
    });
    const { d, out } = specDeps(at);

    expect(await main(["specs-finish", "37"], d)).toBe(0);
    expect(out).toEqual([
      "✓ Ticket 37's spec is already folded into openspec/specs/.",
    ]);
    expect(at.runs).toEqual([]);
  });

  it("says a ticket with no change has none started, and exits 1", async () => {
    at = openspecAt();
    mkdirSync(join(at.root, "openspec/changes/archive/2026-11-21-issue-370"), {
      recursive: true,
    });
    const { d, err } = specDeps(at);

    expect(await main(["specs-finish", "37"], d)).toBe(1);
    expect(err).toEqual([
      "✗ Ticket 37 has no spec started: run kodor specs new 37 first.",
    ]);
  });

  it("says the fold failed when OpenSpec's archive fails, and exits 1", async () => {
    at = openspecAt({ archive: 1 });
    mkdirSync(join(at.root, "openspec/changes/issue-37"), { recursive: true });
    const { d, out, err } = specDeps(at);

    expect(await main(["specs-finish", "37"], d)).toBe(1);
    expect(out).toEqual([]);
    expect(err).toEqual([
      "✗ Could not fold ticket 37's spec into openspec/specs/.",
    ]);
  });
});

describe("the OpenSpec change's folder", () => {
  it("is named by the ticket's key in lowercase", () => {
    const tool = openspec(() => 0);
    expect(tool.folder("12")).toBe("openspec/changes/issue-12/");
    expect(tool.folder("PROJ-12")).toBe("openspec/changes/issue-proj-12/");
    expect(tool.folder("acme/api#12")).toBe(
      "openspec/changes/issue-acme-api-12/",
    );
  });
});

describe("the spec commands' ticket", () => {
  let at: ReturnType<typeof openspecAt>;
  afterEach(() => rmSync(at.root, { recursive: true, force: true }));

  it.each([["specs-new"], ["specs-finish"]])(
    "%s refuses a key the ticket system does not use, and exits 1",
    async (name) => {
      at = openspecAt();
      const { d, out, err } = specDeps(at);

      expect(await main([name, "PROJ-12"], d)).toBe(1);
      expect(out).toEqual([]);
      expect(err).toEqual([
        "PROJ-12 is not a ticket here: a GitHub ticket is its number, such as 12",
      ]);
      expect(at.runs).toEqual([]);
    },
  );
});

describe("the spec commands' arguments", () => {
  it.each([
    ["specs-new", [], "Usage: kodor specs new N"],
    ["specs-new", ["--all"], "Usage: kodor specs new N"],
    ["specs-finish", ["37", "38"], "Usage: kodor specs finish N"],
    ["specs-list", ["--all"], "Usage: kodor specs list"],
  ])(
    "%s %j prints its usage and exits 2, even with no spec tool",
    async (name, args, usage) => {
      const { d, out, err } = deps({ specs: "none" });

      expect(await main([name, ...args], d)).toBe(2);
      expect(out).toEqual([]);
      expect(err).toEqual([usage]);
    },
  );
});

describe("the four commands", () => {
  it("print the settings' error and exit 1 when the settings cannot be read", async () => {
    const { d, err } = deps();
    d.settings = async () => {
      throw new SettingsError(".claude/kodor.yaml: version: must be 1");
    };

    expect(await main(["gate"], d)).toBe(1);
    expect(err).toEqual([".claude/kodor.yaml: version: must be 1"]);
  });
});

// The runner the commands get outside tests, through the router: bash from
// the repository's root, the output passed through, and no standard input.
// The router is run from source, since the launcher hands a run in another
// repository to the copy that repository installed.
describe("the commands' own runner", () => {
  const CLI = new URL("../src/cli.mts", import.meta.url).pathname;
  let repo: string;

  function factory(
    settings: string,
    args: string[],
    from = "",
    extra: Record<string, string | undefined> = {},
  ) {
    repo = mkdtempSync(join(tmpdir(), "factory-commands-"));
    execFileSync("git", ["init", "-q", repo]);
    mkdirSync(join(repo, "src/deep"), { recursive: true });
    writeSettings(
      repo,
      `version: 1\nrepository: o/r\n${CODE_HOST_YAML}\n${settings}`,
    );
    return spawnSync("node", [CLI, ...args], {
      cwd: join(repo, from),
      encoding: "utf8",
      input: "TYPED-IN\n",
      env: {
        ...process.env,
        FILE: "",
        NAME: "",
        DO_NOT_TRACK: "",
        npm_config_loglevel: undefined,
        ...extra,
      },
    });
  }

  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it("runs the gate with bash from the root, whatever folder it was run in, and passes both outputs through", () => {
    const r = factory(
      'commands:\n  gate: ["pwd", "echo TO-ERR >&2; exit 3", "echo never"]\n',
      ["gate"],
      "src/deep",
    );

    expect(r.status).toBe(1);
    expect(r.stdout).toBe(
      `$ pwd\n${realpathSync(repo)}\n$ echo TO-ERR >&2; exit 3\n`,
    );
    expect(r.stderr).toBe(
      "TO-ERR\n✗ The gate failed on: echo TO-ERR >&2; exit 3\n",
    );
  });

  it("gives a command no standard input", () => {
    const r = factory('commands:\n  gate: ["cat", "echo after"]\n', ["gate"]);

    expect(r.status).toBe(0);
    expect(r.stdout).toBe(
      "$ cat\n$ echo after\nafter\n✓ Every gate command passed.\n",
    );
  });

  it("puts FILE and NAME in test-one's environment", () => {
    const r = factory(`commands:\n  test-one: 'echo "$FILE|$NAME"; exit 6'\n`, [
      "test-one",
      "tests/a.test.ts",
      "adds two",
    ]);

    expect(r.stdout).toBe("tests/a.test.ts|adds two\n");
    expect(r.status).toBe(6);
  });

  it("puts FILE in end-to-end's environment, each time", () => {
    const r = factory("commands:\n  end-to-end: 'echo \"$FILE\"'\n", [
      "end-to-end",
      "e2e/home.spec.ts",
      "--times",
      "2",
    ]);

    expect(r.stdout).toBe(
      "e2e/home.spec.ts\ne2e/home.spec.ts\n✓ The test passed.\n",
    );
    expect(r.status).toBe(0);
  });

  it("quiets npm's notices for a settings command, unless the caller set npm's log level", () => {
    const gate = "commands:\n  gate: ['echo \"level=$npm_config_loglevel\"']\n";

    expect(factory(gate, ["gate"]).stdout).toContain("level=warn\n");
    expect(
      factory(gate, ["gate"], "", { npm_config_loglevel: "info" }).stdout,
    ).toContain("level=info\n");
  });

  it("puts DO_NOT_TRACK=1 in the spec check's environment", () => {
    const r = factory(
      "specs:\n  type: openspec\n  check: 'echo \"track=$DO_NOT_TRACK\"'\n",
      ["specs", "check"],
    );

    expect(r.stdout).toBe("track=1\n✓ The specs check passed.\n");
    expect(r.status).toBe(0);
  });
});

/** A monorepo of three Node packages and a Python service. */
const MONO_FILES = [
  "packages/api/src/orders.ts",
  "packages/api/package.json",
  "packages/shared/src/money.ts",
  "packages/web/src/cart.ts",
  "services/billing/app.py",
  "docs/guide.md",
  "tsconfig.base.json",
];
const MONO = {
  commands: {
    gate: [
      "npm run -s format:check",
      {
        run: "npm test",
        in: "packages/*",
        files: ["./**", "packages/shared/**"],
      },
      { run: "pytest -q", in: "services/*" },
    ],
    ignore: ["docs/**"],
  },
};
const mono = (changed: string[], statuses: number[] = [], extra: Repo = {}) =>
  deps(MONO, statuses, { files: MONO_FILES, changed, ...extra });

describe("kodor gate by path", () => {
  it("runs the commands a changed file sets off, each in its folder, after its plan", async () => {
    const { d, ran, out } = mono(["packages/api/src/orders.ts"]);

    expect(await main(["gate"], d)).toBe(0);
    expect(ran).toEqual([
      { command: "npm run -s format:check", cwd: ROOT, env: { BASE } },
      { command: "npm test", cwd: `${ROOT}/packages/api`, env: { BASE } },
    ]);
    expect(out).toEqual([
      "commands.gate: 2 of 5 run, for the 1 file changed since origin/main",
      "  npm run -s format:check      every change",
      "  cd packages/api && npm test  packages/api/src/orders.ts",
      "- 3 left out, since this change touches none of their files: kodor gate --dry-run lists each",
      "",
      "$ npm run -s format:check",
      "(ran npm run -s format:check)",
      "$ cd packages/api && npm test",
      "(ran npm test)",
      "✓ Every gate command that ran passed: 2 run, 3 left out.",
    ]);
  });

  it("runs an item in every folder when a root pattern it lists changes, as one row", async () => {
    const { d, ran, out } = mono(["packages/shared/src/money.ts"]);

    expect(await main(["gate"], d)).toBe(0);
    expect(ran.map((r) => r.cwd)).toEqual([
      ROOT,
      `${ROOT}/packages/api`,
      `${ROOT}/packages/shared`,
      `${ROOT}/packages/web`,
    ]);
    expect(out).toContain(
      "  npm test, in each of the 3 folders of packages/*  packages/shared/src/money.ts",
    );
  });

  it("runs every command when a changed file is covered by nothing, and names it", async () => {
    const { d, ran, out } = mono(["tsconfig.base.json"]);

    expect(await main(["gate"], d)).toBe(0);
    expect(ran).toHaveLength(5);
    expect(out.slice(0, 2)).toEqual([
      "commands.gate: all 5 run, since 1 changed file is in no gate command's files and not in commands.ignore",
      "  tsconfig.base.json",
    ]);
    expect(out.at(-1)).toBe("✓ Every gate command passed.");
  });

  it("names ten files nothing covers and counts the rest, and --dry-run names every one", async () => {
    const twelve = Array.from(
      { length: 12 },
      (_, i) => `root-${String(i).padStart(2, "0")}.txt`,
    );
    const run = mono(twelve);
    expect(await main(["gate"], run.d)).toBe(0);
    expect(run.out.slice(1, 12)).toEqual([
      ...twelve.slice(0, 10).map((f) => `  ${f}`),
      "  and 2 more: kodor gate --dry-run lists each",
    ]);
    const dry = mono(twelve);
    expect(await main(["gate", "--dry-run"], dry.d)).toBe(0);
    expect(dry.out.slice(1, 13)).toEqual(twelve.map((f) => `  ${f}`));
  });

  it("runs every command when the settings changed", async () => {
    const { d, ran, out } = mono([".claude/kodor.yaml"]);

    expect(await main(["gate"], d)).toBe(0);
    expect(ran).toHaveLength(5);
    expect(out[0]).toBe(
      "commands.gate: all 5 run, since .claude/kodor.yaml changed",
    );
  });

  it("runs only text commands when every changed file is ignored", async () => {
    const { d, ran, out } = mono(["docs/guide.md"]);

    expect(await main(["gate"], d)).toBe(0);
    expect(ran.map((r) => r.command)).toEqual(["npm run -s format:check"]);
    expect(out[0]).toBe(
      "commands.gate: 1 of 5 runs, for the 1 file changed since origin/main, which commands.ignore lists",
    );
    expect(out).toContain(
      "- 4 left out, since commands.ignore lists every changed file",
    );
  });

  it("runs no item for an ignored file inside its folder", async () => {
    const { d, ran } = deps(
      {
        commands: {
          gate: [{ run: "npm test", in: "packages/*" }],
          ignore: ["**/*.md"],
        },
      },
      [],
      {
        files: [...MONO_FILES, "packages/api/README.md"],
        changed: ["packages/api/README.md"],
      },
    );

    expect(await main(["gate"], d)).toBe(0);
    expect(ran).toEqual([]);
  });

  it("says when a gate with no text command has nothing to run", async () => {
    const { d, out } = deps(
      {
        commands: {
          gate: [{ run: "npm test", in: "packages/*" }],
          ignore: ["docs/**"],
        },
      },
      [],
      { files: MONO_FILES, changed: ["docs/guide.md"] },
    );

    expect(await main(["gate"], d)).toBe(0);
    expect(out.at(-1)).toBe(
      "✓ No gate command needs to run: every changed file is in commands.ignore.",
    );
  });

  it("runs nothing when nothing changed", async () => {
    const { d, ran, out } = mono([]);

    expect(await main(["gate"], d)).toBe(0);
    expect(ran).toEqual([]);
    expect(out).toEqual([
      "commands.gate: 0 of 5 run, since nothing changed since origin/main",
      "",
      "✓ Nothing to check.",
    ]);
  });

  it("runs every command, and says why, when there is no origin/main", async () => {
    const { d, ran, out } = mono(["packages/api/src/orders.ts"], [], {
      remote: false,
    });

    expect(await main(["gate"], d)).toBe(0);
    expect(ran).toHaveLength(5);
    expect(ran[0]!.env).toEqual({ BASE: "" });
    expect(out.slice(0, 2)).toEqual([
      "? Can't tell what changed, since there is no origin/main to compare with. Every gate command runs.",
      "  Fetch it with: git fetch origin main",
    ]);
  });

  it("runs every command, and says why, when the branch shares no commit with origin/main", async () => {
    const { d, ran, out } = mono(["packages/api/src/orders.ts"], [], {
      shared: false,
    });

    expect(await main(["gate"], d)).toBe(0);
    expect(ran).toHaveLength(5);
    expect(out.slice(0, 2)).toEqual([
      "? Can't tell what changed, since this branch shares no commit with origin/main. Every gate command runs.",
      "  In a shallow clone, fetch the history with: git fetch --unshallow origin",
    ]);
  });

  it("lists every command and why with --dry-run, and runs nothing", async () => {
    const { d, ran, out } = mono(["packages/api/src/orders.ts"]);

    expect(await main(["gate", "--dry-run"], d)).toBe(0);
    expect(ran).toEqual([]);
    expect(out[0]).toBe(
      "commands.gate: 2 of 5 would run, for the 1 file changed since origin/main",
    );
    expect(out).toContain(
      "  runs      cd packages/api && npm test       packages/api/src/orders.ts",
    );
    expect(out).toContain(
      "  left out  cd packages/web && npm test       no change in ./** or packages/shared/**",
    );
  });

  it("runs every command with --all", async () => {
    const { d, ran, out } = mono([]);

    expect(await main(["gate", "--all"], d)).toBe(0);
    expect(ran).toHaveLength(5);
    expect(out[0]).toBe("commands.gate: all 5 run, as --all asks");
  });

  it("finishes an item's other folders when it fails in one, then stops", async () => {
    const { d, ran, err } = mono(
      ["packages/shared/src/money.ts", "services/billing/app.py"],
      [0, 1, 0, 1],
    );

    expect(await main(["gate"], d)).toBe(1);
    expect(ran.map((r) => r.cwd)).toEqual([
      ROOT,
      `${ROOT}/packages/api`,
      `${ROOT}/packages/shared`,
      `${ROOT}/packages/web`,
    ]);
    expect(err).toEqual([
      "✗ The gate failed in 2 of the 3 folders npm test ran in:",
      "    cd packages/api && npm test",
      "    cd packages/web && npm test",
    ]);
  });

  it("counts a new folder that git has not been told of yet", async () => {
    const { d, ran } = mono(["packages/new/src/a.ts"], [], {
      files: [...MONO_FILES, "packages/new/src/a.ts"],
    });

    expect(await main(["gate"], d)).toBe(0);
    expect(ran.map((r) => r.cwd)).toContain(`${ROOT}/packages/new`);
  });

  it("does not count a folder that no longer exists, and runs everything for its files", async () => {
    const { d, ran } = deps(MONO, [], {
      files: [...MONO_FILES, "packages/old/src/gone.ts"],
      gone: ["packages/old"],
      changed: ["packages/old/src/gone.ts"],
    });

    expect(await main(["gate"], d)).toBe(0);
    expect(ran.map((r) => r.cwd)).not.toContain(`${ROOT}/packages/old`);
    expect(ran).toHaveLength(5);
  });

  it("prints nothing new for a gate of text", async () => {
    const { d, out } = deps(GATE, [], { changed: ["a.ts"] });

    expect(await main(["gate"], d)).toBe(0);
    expect(out[0]).toBe("$ npm run lint");
  });

  it("runs no relock item for a file outside its files while the gate is all text, though no gate item covers the file", async () => {
    const { d, ran } = deps(
      {
        commands: {
          gate: ["npx nx affected -t test --base=$BASE"],
          relock: [
            { run: "poetry lock", in: "services/*", files: ["./poetry.lock"] },
          ],
        },
      },
      [],
      { files: MONO_FILES, changed: ["tsconfig.base.json"] },
    );

    expect(await main(["relock"], d)).toBe(0);
    expect(ran).toEqual([]);
  });
});

describe("kodor test-one and end-to-end with a list", () => {
  const LIST = {
    commands: {
      "test-one": [
        { run: 'npx vitest run $FILE -t "$NAME"', in: "packages/*" },
        { run: "pytest $FILE", in: "services/*" },
      ],
      "end-to-end": [{ run: "npx playwright test $FILE", in: "packages/*" }],
    },
  };

  it("runs the first command whose folder holds FILE, in it, with FILE from it", async () => {
    const { d, ran, out } = deps(LIST, [], { files: MONO_FILES });

    expect(
      await main(["test-one", "packages/api/src/orders.ts", "adds"], d),
    ).toBe(0);
    expect(ran).toEqual([
      {
        command: 'npx vitest run $FILE -t "$NAME"',
        cwd: `${ROOT}/packages/api`,
        env: { FILE: "src/orders.ts", NAME: "adds" },
      },
    ]);
    expect(out[0]).toBe(
      "commands.test-one: cd packages/api, with FILE=src/orders.ts",
    );
  });

  it("fails when no command covers FILE", async () => {
    const { d, ran, err } = deps(LIST, [], { files: MONO_FILES });

    expect(await main(["test-one", "docs/guide.test.ts"], d)).toBe(1);
    expect(ran).toEqual([]);
    expect(err).toEqual([
      "✗ No commands.test-one command covers docs/guide.test.ts: add one whose files cover it to .claude/kodor.yaml",
    ]);
  });

  it("does the same for end-to-end, --times included", async () => {
    const { d, ran } = deps(LIST, [], { files: MONO_FILES });

    expect(
      await main(["end-to-end", "packages/web/src/cart.ts", "--times", "2"], d),
    ).toBe(0);
    expect(ran.map((r) => [r.cwd, r.env.FILE])).toEqual([
      [`${ROOT}/packages/web`, "src/cart.ts"],
      [`${ROOT}/packages/web`, "src/cart.ts"],
    ]);
  });
});

describe("kodor coverage", () => {
  const COV = {
    commands: {
      coverage: [
        {
          run: "npm run coverage",
          in: "packages/*",
          report: "./coverage/lcov.info",
        },
      ],
    },
  };
  const DIFF = [
    "diff --git a/packages/api/src/orders.ts b/packages/api/src/orders.ts",
    "+++ b/packages/api/src/orders.ts",
    "@@ -1,0 +2,2 @@",
  ].join("\n");

  it("runs the commands a change sets off, then lists the changed lines no test covers", async () => {
    const { d, ran, out } = deps(
      COV,
      [],
      {
        files: MONO_FILES,
        changed: ["packages/api/src/orders.ts"],
        diff: DIFF,
      },
      {
        "packages/api/coverage/lcov.info":
          "SF:src/orders.ts\nDA:2,0\nDA:3,1\nend_of_record\n",
        "packages/api/src/orders.ts": "a\nb\nc\n",
      },
    );

    expect(await main(["coverage"], d)).toBe(0);
    expect(ran.map((r) => r.cwd)).toEqual([`${ROOT}/packages/api`]);
    expect(out).toContain("=== packages/api/src/orders.ts");
    expect(out.at(-1)).toBe(
      "✓ Coverage ran: 1 line the branch changed is not covered, in 1 file.",
    );
  });

  it("says every changed line is covered when none is left", async () => {
    const { d, out } = deps(
      COV,
      [],
      {
        files: MONO_FILES,
        changed: ["packages/api/src/orders.ts"],
        diff: DIFF,
      },
      {
        "packages/api/coverage/lcov.info":
          "SF:src/orders.ts\nDA:2,1\nDA:3,1\nend_of_record\n",
      },
    );

    expect(await main(["coverage"], d)).toBe(0);
    expect(out.at(-1)).toBe(
      "✓ Coverage ran: every line the branch changed is covered.",
    );
  });

  it("lists every command and why with --dry-run, and runs nothing", async () => {
    const { d, ran, out } = deps(COV, [], {
      files: MONO_FILES,
      changed: ["packages/api/src/orders.ts"],
    });

    expect(await main(["coverage", "--dry-run"], d)).toBe(0);
    expect(ran).toEqual([]);
    expect(out[0]).toBe(
      "commands.coverage: 1 of 3 would run, for the 1 file changed since origin/main",
    );
  });

  it("says so when coverage is not set", async () => {
    const { d, out } = deps({});

    expect(await main(["coverage"], d)).toBe(0);
    expect(out).toEqual([
      "- No coverage command (commands.coverage is not set).",
    ]);
  });

  it("fails without a base to compare lines with", async () => {
    const { d, ran, err } = deps(COV, [], { files: MONO_FILES, remote: false });

    expect(await main(["coverage"], d)).toBe(1);
    expect(ran).toEqual([]);
    expect(err[0]).toBe(
      "✗ Can't tell which lines changed, since there is no origin/main to compare with.",
    );
  });

  it("fails naming the command when it fails", async () => {
    const { d, err } = deps(COV, [1], {
      files: MONO_FILES,
      changed: ["packages/api/src/orders.ts"],
    });

    expect(await main(["coverage"], d)).toBe(1);
    expect(err).toEqual([
      "✗ Coverage failed on: cd packages/api && npm run coverage",
    ]);
  });
});

describe("kodor relock and build-setup", () => {
  const RELOCK = {
    commands: {
      gate: [{ run: "pytest", in: "services/*" }],
      relock: [
        {
          run: "poetry lock",
          in: "services/*",
          files: ["./pyproject.toml", "./poetry.lock"],
        },
      ],
      "build-setup": [
        "pip install poetry",
        { run: "composer install", in: "services/*" },
      ],
    },
  };
  const FILES = [
    "services/billing/pyproject.toml",
    "services/billing/poetry.lock",
    "services/orders/pyproject.toml",
    "services/orders/poetry.lock",
  ];

  it("relocks the folders whose lock or manifest differs from origin/main", async () => {
    const { d, ran, out } = deps(RELOCK, [], {
      files: FILES,
      changed: ["services/billing/poetry.lock"],
    });

    expect(await main(["relock"], d)).toBe(0);
    expect(ran.map((r) => r.cwd)).toEqual([`${ROOT}/services/billing`]);
    expect(out[0]).toBe(
      "commands.relock: 1 of 2 runs, for the 1 file that differ from origin/main",
    );
    expect(out.at(-1)).toBe(
      "✓ Every relock command that ran passed: 1 run, 1 left out.",
    );
  });

  it("relocks everything, and says why, when a file nothing covers differs", async () => {
    const { d, ran, out } = deps(RELOCK, [], {
      files: FILES,
      changed: ["Makefile"],
    });

    expect(await main(["relock"], d)).toBe(0);
    expect(ran).toHaveLength(2);
    expect(out[0]).toBe(
      "commands.relock: all 2 run, since 1 changed file is in no gate command's files and not in commands.ignore",
    );
  });

  it("lists every build-setup command with --dry-run, and runs nothing", async () => {
    const { d, ran, out } = deps(RELOCK, [], { files: FILES });

    expect(await main(["build-setup", "--dry-run"], d)).toBe(0);
    expect(ran).toEqual([]);
    expect(out[0]).toBe(
      "commands.build-setup: all 3 run, before there is a change",
    );
  });

  it("stops build-setup after the first command that fails, and names it", async () => {
    const { d, ran, err } = deps(
      { commands: { "build-setup": ["make tools", "make more"] } },
      [1],
    );

    expect(await main(["build-setup"], d)).toBe(1);
    expect(ran.map((r) => r.command)).toEqual(["set -eo pipefail\nmake tools"]);
    expect(err).toEqual(["✗ Build setup failed on: make tools"]);
  });

  it("says so when build-setup is not set, and passes", async () => {
    const { d, ran, out } = deps({});

    expect(await main(["build-setup"], d)).toBe(0);
    expect(ran).toEqual([]);
    expect(out).toEqual([
      "- No build-setup command (commands.build-setup is not set).",
    ]);
  });

  it("relocks everything with --all", async () => {
    const { d, ran } = deps(RELOCK, [], { files: FILES });

    expect(await main(["relock", "--all"], d)).toBe(0);
    expect(ran).toHaveLength(2);
  });

  it("runs the default npm install when relock is not written", async () => {
    const { d, ran } = deps({}, [], {});

    expect(await main(["relock"], d)).toBe(0);
    expect(ran.map((r) => r.command)).toEqual(["npm install"]);
  });

  it("runs every build-setup command, each in its folders", async () => {
    const { d, ran, out } = deps(RELOCK, [], { files: FILES });

    expect(await main(["build-setup"], d)).toBe(0);
    // As the workflow ran each before, a line or a pipe that fails fails
    // the command.
    expect(ran.map((r) => [r.command, r.cwd])).toEqual([
      ["set -eo pipefail\npip install poetry", ROOT],
      ["set -eo pipefail\ncomposer install", `${ROOT}/services/billing`],
      ["set -eo pipefail\ncomposer install", `${ROOT}/services/orders`],
    ]);
    expect(out).toContain("$ cd services/orders && composer install");
  });
});
