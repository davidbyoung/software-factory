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
import { painter } from "../src/lib/color.mts";
import { CODE_HOST, CODE_HOST_YAML } from "./settings-fixture";
import { specTools } from "../src/specs/index.mts";
import { openspec } from "../src/specs/openspec.mts";
import type { Run } from "../src/specs/types.mts";
import { NotFoundError } from "../src/tickets/types.mts";
import { BUILT } from "../src/tool-names.mts";
import { pagesSpecTool } from "./memory-tools";

const ROOT = "/repo";

type Ran = { command: string; cwd: string; env: Record<string, string> };

/** The commands' dependencies with a runner that runs nothing: it records
 * each command, its directory, and what was added to its environment, and
 * answers with the next status in `statuses`, or 0. */
function deps(raw: Record<string, unknown> = {}, statuses: number[] = []) {
  const ran: Ran[] = [];
  const out: string[] = [];
  const err: string[] = [];
  const left = [...statuses];
  const d: Deps = {
    root: ROOT,
    settings: async () =>
      parseSettings(
        { version: 2, repository: "o/r", "code-host": CODE_HOST, ...raw },
        () => true,
      ),
    exec: (command, cwd, env) => {
      // The `$ COMMAND` line is printed before the command runs.
      out.push(`(ran ${command})`);
      ran.push({ command, cwd, env });
      return left.shift() ?? 0;
    },
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    specTools: specTools(),
    labels: async () => [],
  };
  return { d, ran, out, err };
}

const GATE = { commands: { gate: ["npm run lint", "npm test"] } };

describe("factory gate", () => {
  it("runs each command in order from the root, prints `$ COMMAND` before each, and exits 0 when all pass", async () => {
    const { d, ran, out, err } = deps(GATE);

    expect(await main(["gate"], d)).toBe(0);
    expect(ran).toEqual([
      { command: "npm run lint", cwd: ROOT, env: {} },
      { command: "npm test", cwd: ROOT, env: {} },
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
      "commands.gate is not set: add the commands that check a change to .claude/factory.yaml",
    ]);
    expect(out).toEqual([]);
    expect(ran).toEqual([]);
  });

  it("prints its usage and exits 2 for an argument", async () => {
    const { d, ran, err } = deps(GATE);

    expect(await main(["gate", "--fast"], d)).toBe(2);
    expect(err).toEqual(["Usage: factory gate"]);
    expect(ran).toEqual([]);
  });
});

const TEST_ONE = { commands: { "test-one": 'runner $FILE -t "$NAME"' } };

describe("factory test-one", () => {
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
    expect(err).toEqual(["Usage: factory test-one FILE [NAME]"]);
    expect(ran).toEqual([]);
  });
});

const E2E = { commands: { "end-to-end": "browser-tests $FILE" } };

describe("factory end-to-end", () => {
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
    expect(err).toEqual(["Usage: factory end-to-end FILE [--times K]"]);
    expect(ran).toEqual([]);
  });
});

describe("factory specs check", () => {
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

  it("colors a passing closing line's mark alone when it paints", async () => {
    const paint = painter(true);
    const passing = deps(GATE);
    await main(["gate"], { ...passing.d, paint });
    expect(passing.out.at(-1)).toBe(
      `${paint("green", "✓")} Every gate command passed.`,
    );
  });

  it("colors a failing closing line's mark alone when it paints", async () => {
    const paint = painter(true);
    const failing = deps(GATE, [1]);
    await main(["gate"], { ...failing.d, paint });
    expect(failing.err).toEqual([
      `${paint("red", "✗")} The gate failed on: npm run lint`,
    ]);
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
    expect(err).toEqual(["Usage: factory specs check"]);
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
  const { d, out, err } = deps({ specs: "openspec", ...settings });
  d.root = at.root;
  d.specTools = at.tools;
  d.labels = async (_s, id) => {
    if (labels === null) throw new NotFoundError(`#${id}`);
    return labels;
  };
  return { d, out, err };
}

const SPEC_FILES = [
  "  new  proposal.md               The owner's text and Decisions, linking ticket 37",
  `  new  specs/CAPABILITY/spec.md  One per heading under Spec: ADDED for (new), MODIFIED for (modified), REMOVED for each "No longer" line; each numbered line is one requirement whose SHALL sentence restates it, with one scenario whose WHEN is the line's "When" clause and whose THEN is the rest`,
  "  new  design.md                 Design, under For the builder",
  "  new  tasks.md                  Tasks, under For the builder",
];

describe("factory specs with no spec tool", () => {
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

  it("dims the mark when it paints", async () => {
    const paint = painter(true);
    const { d, out } = deps({ specs: "none" });
    await main(["specs-list"], { ...d, paint });
    expect(out).toEqual([`${paint("dim", "-")} ${NONE.slice(2)}`]);
  });
});

describe("factory specs list", () => {
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

describe("factory specs new", () => {
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
      "Then: factory specs check",
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
      "Then: factory specs check",
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
      "✗ OpenSpec is not installed: run factory init, which installs it.",
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

describe("factory specs new, with a spec tool that is not OpenSpec", () => {
  it("lists the files it updates and writes, and ends with the tool's own next step", async () => {
    const { d, out } = deps({ specs: "pages" });
    d.settings = async () =>
      parseSettings(
        {
          version: 2,
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

describe("factory specs finish", () => {
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
      "✗ Ticket 37 has no spec started: run factory specs new 37 first.",
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
    ["specs-new", [], "Usage: factory specs new N"],
    ["specs-new", ["--all"], "Usage: factory specs new N"],
    ["specs-finish", ["37", "38"], "Usage: factory specs finish N"],
    ["specs-list", ["--all"], "Usage: factory specs list"],
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
      throw new SettingsError(".claude/factory.yaml: version: must be 2");
    };

    expect(await main(["gate"], d)).toBe(1);
    expect(err).toEqual([".claude/factory.yaml: version: must be 2"]);
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
      `version: 2\nrepository: o/r\n${CODE_HOST_YAML}\n${settings}`,
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
