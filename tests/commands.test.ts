import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
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
      parseSettings({ version: 2, repository: "o/r", ...raw }, () => true),
    exec: (command, cwd, env) => {
      // The `$ COMMAND` line is printed before the command runs.
      out.push(`(ran ${command})`);
      ran.push({ command, cwd, env });
      return left.shift() ?? 0;
    },
    out: (line) => out.push(line),
    err: (line) => err.push(line),
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

  it("colors the closing line's mark alone when it paints", async () => {
    const paint = painter(true);
    const passing = deps(GATE);
    await main(["gate"], { ...passing.d, paint });
    expect(passing.out.at(-1)).toBe(
      `${paint("green", "✓")} Every gate command passed.`,
    );
    const failing = deps(GATE, [1]);
    await main(["gate"], { ...failing.d, paint });
    expect(failing.err).toEqual([
      `${paint("red", "✗")} The gate failed on: npm run lint`,
    ]);
  });

  it("prints `specs are off` and exits 0 when specs.type is none", async () => {
    const { d, ran, out, err } = deps({ specs: "none" });

    expect(await main(["specs-check"], d)).toBe(0);
    expect(out).toEqual(["specs are off"]);
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
    writeSettings(repo, `version: 2\nrepository: o/r\n${settings}`);
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
