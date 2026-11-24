import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { COMMANDS, resolveCommand } from "../src/cli.mts";

const PACKAGE = fileURLToPath(new URL("..", import.meta.url));
const LAUNCHER = join(PACKAGE, "bin/factory.js");
const NAME = JSON.parse(readFileSync(join(PACKAGE, "package.json"), "utf8"))
  .name as string;

const factory = (
  args: string[],
  options: { cwd?: string; input?: string } = {},
) => spawnSync("node", [LAUNCHER, ...args], { encoding: "utf8", ...options });

describe("the commands the router knows", () => {
  it("have every command a workflow's step runs", () => {
    type Workflow = { jobs: Record<string, { steps?: { run?: string }[] }> };
    const run = readdirSync(".github/workflows")
      .filter((file) => file.endsWith(".yml"))
      .flatMap((file) =>
        Object.values(
          (
            parse(
              readFileSync(join(".github/workflows", file), "utf8"),
            ) as Workflow
          ).jobs,
        )
          .flatMap((job) => job.steps ?? [])
          .flatMap((step) => (step.run ?? "").split("\n"))
          .flatMap(
            (line) =>
              /^\s*(?:\w+="?\$\(|[A-Z_]+="[^"]*" )?factory ([a-z][^|>&)]*)/.exec(
                line,
              )?.[1] ?? [],
          )
          .map((command) => ({ file, command: command.trim() })),
      );

    expect(run.map(({ command }) => command)).toContain("review verdict");
    expect(
      run
        .filter(({ command }) => !resolveCommand(command.split(/\s+/)))
        .map(({ file, command }) => `${file}: factory ${command}`),
    ).toEqual([]);
  });

  // A subcommand the router does not list never reaches its command: the
  // router prints the usage and exits 2.
  it.each([
    ["pr", "src/pr.mts"],
    ["ticket", "src/ticket.mts"],
  ])("lists every factory %s subcommand its command handles", (word, file) => {
    const handled = [
      ...readFileSync(file, "utf8").matchAll(/^\s+case "([a-z-]+)":/gm),
    ].map((m) => m[1]);
    const listed = COMMANDS.filter((c) => c.words[0] === word).map(
      (c) => c.words[1],
    );

    expect(handled.length).toBeGreaterThan(5);
    expect(handled.filter((sub) => !listed.includes(sub))).toEqual([]);
  });

  it("routes every command docs/cli.md does not mark Planned", () => {
    const built = readFileSync(join(PACKAGE, "docs/cli.md"), "utf8")
      .split("\n")
      .filter((line) => /^\| `(?:npx --no-install )?factory/.test(line))
      .filter((line) => !/\|\s*Planned\s*\|\s*$/.test(line))
      .map((line) => /`(?:npx --no-install )?factory ([^`]*)`/.exec(line)![1])
      .map((command) => {
        const words = command.split(" ");
        const args = words.findIndex((w) => !/^[a-z][a-z-]*$/.test(w));
        return args < 0 ? words : words.slice(0, args);
      });
    const unrouted = built.filter((words) => {
      const found = resolveCommand(words);
      return !found || found.rest.length > 0;
    });

    expect(built.length).toBeGreaterThan(20);
    expect(unrouted.map((words) => words.join(" "))).toEqual([]);
  });
});

describe("factory's usage", () => {
  /** The commands docs/cli.md lists under a heading, by their words. */
  const documented = (heading: string) => {
    const lines = readFileSync(join(PACKAGE, "docs/cli.md"), "utf8").split(
      "\n",
    );
    const start = lines.findIndex((l) => l === heading);
    const end = lines.findIndex((l, i) => i > start && /^#{2,3} /.test(l));
    return lines
      .slice(start, end)
      .filter((l) => /^\| `factory /.test(l))
      .map((l) => /`factory ([^`]*)`/.exec(l)![1])
      .map((c) =>
        c
          .split(" ")
          .filter((w) => /^[a-z][a-z-]*$/.test(w))
          .join(" "),
      );
  };

  it("lists a person's commands in the docs' groups, each with what it does", () => {
    const r = factory([]);

    expect(r.status).toBe(2);
    expect(r.stderr.split("\n").slice(0, 4)).toEqual([
      "Usage: factory COMMAND",
      "",
      "Setting up",
      "  init                 Set a repository up, or turn a part on or off",
    ]);
    expect(r.stderr).toContain(
      "  preset choose KEY PRESET\n                       Record one of those choices without questions",
    );
    expect(r.stderr.trimEnd().split("\n").at(-1)).toBe(
      'The commands skills, hooks, and workflows run are under "Run for you" in docs/cli.md.',
    );
  });

  it("lists exactly the commands the docs list under a person's headings", () => {
    const usage = factory([]).stderr.split("\n");
    const listed = usage
      .filter((l) => /^ {2}[a-z]/.test(l))
      .map((l) => l.slice(2, 23).trim())
      .map((c) =>
        c
          .split(" ")
          .filter((w) => /^[a-z][a-z-]*$/.test(w))
          .join(" "),
      );
    const docs = [
      "## Setting up",
      "## Every day",
      "## Now and then",
      "## Presets",
      "### Your repository's commands",
    ].flatMap(documented);

    expect(new Set(listed)).toEqual(new Set(docs));
  });

  it("says a command it does not have is not there, before the usage", () => {
    const r = factory(["ticket", "nonesuch"]);

    expect(r.status).toBe(2);
    expect(r.stderr.split("\n").slice(0, 3)).toEqual([
      'factory has no command "ticket nonesuch".',
      "",
      "Usage: factory COMMAND",
    ]);
  });

  it.each([["--help"], ["-h"]])("prints the usage alone for %s", (flag) => {
    const r = factory([flag]);

    expect(r.status).toBe(2);
    expect(r.stderr.split("\n")[0]).toBe("Usage: factory COMMAND");
  });
});

// Three folders, each with a package of the factory's name whose cli prints
// which copy ran.
describe("the launcher", () => {
  let dir: string;

  /** A package folder at `at` whose entry, at `entry`, prints `says`. */
  function fakePackage(at: string, entry: string | null, says: string) {
    mkdirSync(join(at, "bin"), { recursive: true });
    copyFileSync(LAUNCHER, join(at, "bin/factory.js"));
    copyFileSync(join(PACKAGE, "bin/launch.js"), join(at, "bin/launch.js"));
    writeFileSync(
      join(at, "package.json"),
      JSON.stringify({ name: NAME, version: "0.3.0" }),
    );
    if (entry) {
      mkdirSync(dirname(join(at, entry)), { recursive: true });
      writeFileSync(join(at, entry), `console.log(${JSON.stringify(says)});\n`);
    }
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "factory-launcher-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("runs the source of the repository it was run from, not the checkout whose node_modules it came from", () => {
    // The main checkout's package, which npx finds up the tree.
    const main = join(dir, "main");
    fakePackage(main, "src/cli.mts", "main");
    mkdirSync(join(main, ".git"));
    // A worktree with its own source and no node_modules.
    const worktree = join(main, ".claude/worktrees/w");
    fakePackage(worktree, "src/cli.mts", "worktree");
    writeFileSync(join(worktree, ".git"), "gitdir: elsewhere\n");

    const out = execFileSync("node", [join(main, "bin/factory.js")], {
      cwd: join(worktree, "src"),
      encoding: "utf8",
    });

    expect(out.trim()).toBe("worktree");
  });

  /** A repository whose lock names `version`. */
  function repository(version: string) {
    const repo = join(dir, "repo");
    mkdirSync(join(repo, ".git"), { recursive: true });
    mkdirSync(join(repo, ".claude"));
    writeFileSync(
      join(repo, ".claude/factory.lock"),
      `version: ${version}\npresets: []\n`,
    );
    return repo;
  }

  it("runs the cached copy of the version the repository's lock names", () => {
    const global = join(dir, "global");
    fakePackage(global, "dist/cli.mjs", "the machine's 0.3.0");
    const cache = join(dir, "cache");
    fakePackage(
      join(cache, "software-factory/versions/0.2.0/node_modules", NAME),
      "dist/cli.mjs",
      "cached 0.2.0",
    );

    const out = execFileSync("node", [join(global, "bin/factory.js")], {
      cwd: repository("0.2.0"),
      encoding: "utf8",
      env: { ...process.env, XDG_CACHE_HOME: cache, FACTORY_VERSION: "" },
    });

    expect(out.trim()).toBe("cached 0.2.0");
  });

  it("runs itself where the repository names the version installed", () => {
    const global = join(dir, "global");
    fakePackage(global, "dist/cli.mjs", "the machine's 0.3.0");

    const out = execFileSync("node", [join(global, "bin/factory.js")], {
      cwd: repository("0.3.0"),
      encoding: "utf8",
      env: { ...process.env, FACTORY_VERSION: "" },
    });

    expect(out.trim()).toBe("the machine's 0.3.0");
  });

  it("stops on a lock that names no release, and exits 1", () => {
    const global = join(dir, "global");
    fakePackage(global, "dist/cli.mjs", "the machine's 0.3.0");

    const r = spawnSync("node", [join(global, "bin/factory.js")], {
      cwd: repository("banana"),
      encoding: "utf8",
      env: { ...process.env, FACTORY_VERSION: "" },
    });

    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr.trim()).toBe(
      "✗ .claude/factory.lock names the factory banana, which is not a release. Run: factory update",
    );
  });

  it("runs dist/ when there is no source", () => {
    const pkg = join(dir, "node_modules/factory");
    fakePackage(pkg, "dist/cli.mjs", "compiled");
    mkdirSync(join(dir, ".git"));

    const out = execFileSync("node", [join(pkg, "bin/factory.js")], {
      cwd: dir,
      encoding: "utf8",
    });

    expect(out.trim()).toBe("compiled");
  });
});

// The hook's input, as Claude Code sends it on a Bash call.
const call = (command: string, cwd: string) =>
  JSON.stringify({ cwd, tool_input: { command } });

describe("factory guard", () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "factory-guard-"));
    execFileSync("git", ["init", "-q", "-b", "feature", repo]);
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it("blocks what the commit guard blocks", () => {
    const r = factory(["guard"], {
      input: call("git push --force origin feature", repo),
    });

    expect(r.status).toBe(2);
    expect(r.stderr).toContain("Blocked by factory guard commit: force push");
  });

  it("blocks what the ticket-text guard blocks", () => {
    const r = factory(["guard"], {
      input: call('gh issue comment 5 --body "see /guides/<slug>/"', repo),
    });

    expect(r.status).toBe(2);
    expect(r.stderr).toContain("Blocked by factory guard ticket-text");
  });

  it("lets a call neither guard objects to through", () => {
    const r = factory(["guard"], { input: call("git status", repo) });

    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
  });
});

/** Every file under `dir`, relative to the package. */
function files(dir: string): string[] {
  return readdirSync(join(PACKAGE, dir)).flatMap((n) => {
    const path = join(PACKAGE, dir, n);
    return statSync(path).isDirectory()
      ? files(relative(PACKAGE, path))
      : [relative(PACKAGE, path)];
  });
}

describe("the factory's own files and messages", () => {
  // The factory is installed once on a machine, so nothing it writes into a
  // repository, and nothing it prints, runs it through `npx`: there is no
  // copy in the repository for `npx --no-install` to find, and a bare
  // `npx factory` downloads another package of that name.
  it("name the command factory, never through npx", () => {
    const scanned = [
      ...files("skills"),
      ...files("agents"),
      ...files("src"),
      "rules.md",
      "review.md",
    ];
    const found: string[] = [];
    for (const f of scanned) {
      readFileSync(join(PACKAGE, f), "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (/\bnpx(\s+-\S+)*\s+factory\b/.test(line))
            found.push(`${f}:${i + 1}: ${line.trim()}`);
        });
    }

    expect(scanned.length).toBeGreaterThan(50);
    expect(found).toEqual([]);
  });
});

describe("the commands that ask questions", () => {
  it.each(["init", "remove"])(
    "%s says it needs a terminal when there is none, and changes nothing",
    (command) => {
      const cwd = mkdtempSync(join(tmpdir(), "no-terminal-"));
      try {
        writeFileSync(join(cwd, "CLAUDE.md"), "@.claude/factory/rules.md\n");
        const r = factory([command], { cwd, input: "" });
        expect(r.status).toBe(1);
        expect(r.stdout).toBe(
          `factory ${command} asks its questions in a terminal: run it in one.\n`,
        );
        expect(readFileSync(join(cwd, "CLAUDE.md"), "utf8")).toBe(
          "@.claude/factory/rules.md\n",
        );
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    },
  );
});
