// The review reads .github/factory-review.md and .github/review-notes.md,
// and may run the commands in .claude/factory.yaml's `pr-review`. Its
// workflow takes all three from the pull request's base commit before the
// review step, so a pull request cannot edit the instructions its own
// review follows, or widen what it may run. A file the base commit lacks
// stays as the pull request has it.
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { load } from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";

type Step = {
  name?: string;
  id?: string;
  uses?: string;
  run?: string;
  with?: Record<string, string>;
};
const workflow = load(
  readFileSync(
    new URL("../workflows/factory-claude-review.yml", import.meta.url),
    "utf8",
  ),
) as { jobs: { review: { steps: Step[] } } };
const steps = workflow.jobs.review.steps;
const restore = steps.find(
  (s) => s.name === "Read the review instructions from the base commit",
);
const tools = steps.find((s) => s.id === "tools");

let repo = "";
let temp = "";
afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
  if (temp) rmSync(temp, { recursive: true, force: true });
});

function git(...args: string[]): string {
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

function write(file: string, text: string) {
  mkdirSync(join(repo, ".github"), { recursive: true });
  writeFileSync(join(repo, file), text);
}

/** A repository whose base commit has the notes and whose head edits them
 * and adds factory-review.md. Returns the base commit. */
function pullRequest(): string {
  repo = mkdtempSync(join(tmpdir(), "claude-review-"));
  git("init", "-q");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  write(".github/review-notes.md", "main's notes\n");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  const base = git("rev-parse", "HEAD");
  write(".github/review-notes.md", "the pull request's notes\n");
  write(".github/factory-review.md", "new instructions\n");
  git("add", "-A");
  git("commit", "-q", "-m", "head");
  return base;
}

function runRestore(base: string) {
  // Actions runs a `run:` step with `bash -eo pipefail`.
  return spawnSync("bash", ["-eo", "pipefail", "-c", restore!.run!], {
    cwd: repo,
    env: { ...process.env, BASE: base },
    encoding: "utf8",
  });
}

describe("the CI review workflow", () => {
  it("restores the instructions before the review step", () => {
    const at = steps.indexOf(restore!);
    const review = steps.findIndex((s) => s.id === "review");

    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(review);
  });

  it("takes review-notes.md from the base commit and says so", () => {
    const base = pullRequest();

    const result = runRestore(base);

    expect(result.status).toBe(0);
    expect(readFileSync(join(repo, ".github/review-notes.md"), "utf8")).toBe(
      "main's notes\n",
    );
    expect(result.stdout).toContain(
      `Restored .github/review-notes.md from ${base}.`,
    );
  });

  it("leaves a file the base commit lacks as the pull request has it", () => {
    const base = pullRequest();

    const result = runRestore(base);

    expect(result.status).toBe(0);
    expect(readFileSync(join(repo, ".github/factory-review.md"), "utf8")).toBe(
      "new instructions\n",
    );
    expect(result.stdout).toContain(
      `Left .github/factory-review.md as the pull request has it`,
    );
  });

  it("lists the review's tools before the review step, which allows only those", () => {
    const review = steps.find((s) => s.id === "review")!;
    expect(steps.indexOf(tools!)).toBeGreaterThan(-1);
    expect(steps.indexOf(tools!)).toBeLessThan(steps.indexOf(review));
    expect(review.with!.claude_args).toContain(
      '--allowedTools "${{ steps.tools.outputs.allowed }}"',
    );
  });

  /** The step run in a repository whose base commit has `base` and whose
   * head has `head`, each by its path, printing the file the factory would
   * read its settings from. */
  const listTools = (
    base: Record<string, string>,
    head: Record<string, string>,
  ) => {
    repo = mkdtempSync(join(tmpdir(), "claude-review-"));
    git("init", "-q");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test");
    mkdirSync(join(repo, ".claude"));
    for (const [path, text] of Object.entries(base))
      writeFileSync(join(repo, path), text);
    git("add", "-A");
    git("commit", "-q", "-m", "base");
    const at = git("rev-parse", "HEAD");
    for (const [path, text] of Object.entries(head))
      writeFileSync(join(repo, path), text);
    git("add", "-A");
    git("commit", "-q", "-m", "head");
    temp = mkdtempSync(join(tmpdir(), "claude-review-temp-"));
    const output = join(repo, "output");

    // The factory itself is not installed here: stand in for it with a
    // command that prints the file it would read, the lock where
    // FACTORY_LOCK names one.
    const script = tools!.run!.replace(
      "npx --no-install factory review tools",
      'cat "${FACTORY_LOCK:-$FACTORY_SETTINGS}"',
    );
    const result = spawnSync("bash", ["-eo", "pipefail", "-c", script], {
      cwd: repo,
      env: {
        ...process.env,
        BASE: at,
        FACTORY_SETTINGS: join(temp, "factory.yaml"),
        RUNNER_TEMP: temp,
        GITHUB_OUTPUT: output,
      },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    return readFileSync(output, "utf8");
  };

  it("reads the settings the review's tools come from at the base commit", () => {
    expect(
      listTools(
        { ".claude/factory.yaml": "base settings\n" },
        { ".claude/factory.yaml": "head settings\n" },
      ),
    ).toBe("allowed=base settings\n");
  });

  it("reads them from the base commit's lock where it holds the settings", () => {
    const lock = "version: 1.0.0\nsettings:\n  base: lock\n";
    expect(
      listTools(
        {
          ".claude/factory.yaml": "base settings\n",
          ".claude/factory.lock": lock,
        },
        { ".claude/factory.lock": "version: 1.0.0\nsettings:\n  head: lock\n" },
      ),
    ).toBe(`allowed=${lock}`);
  });

  it("reads the base commit's settings file where its lock is from before presets", () => {
    expect(
      listTools(
        {
          ".claude/factory.yaml": "base settings\n",
          ".claude/factory.lock": "version: 0.4.0\nfiles:\n  - a\n",
        },
        { ".claude/factory.yaml": "head settings\n" },
      ),
    ).toBe("allowed=base settings\n");
  });
});

describe("the tickets the review reads", () => {
  const named = (name: string) => steps.find((s) => s.name === name)!;
  const install = named("Install the base commit's factory");
  const read = named("Read the tickets the pull request builds");
  const review = steps.find((s) => s.id === "review")!;
  const BASE_DIR = "${{ steps.base.outputs.dir || github.workspace }}";

  it("installs the base commit beside the checkout, before the steps that run the factory", () => {
    expect(install.id).toBe("base");
    expect(install.run).toContain(
      'git worktree add --detach "$RUNNER_TEMP/base" "$BASE"',
    );
    expect(install.run).toContain("npm ci");
    expect(steps.indexOf(install)).toBeLessThan(steps.indexOf(tools!));
  });

  /** Runs the install step on a repository whose base commit holds
   * `base`, with npm stood in for, and returns what it put in the step's
   * output. */
  const installOn = (base: Record<string, string>) => {
    repo = mkdtempSync(join(tmpdir(), "claude-review-base-"));
    temp = mkdtempSync(join(tmpdir(), "claude-review-temp-"));
    git("init", "-q");
    git("config", "user.email", "t@example.com");
    git("config", "user.name", "Test");
    const files = { "package-lock.json": "{}\n", ...base };
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(repo, path)), { recursive: true });
      writeFileSync(join(repo, path), text);
    }
    git("add", "-A");
    git("commit", "-q", "-m", "base");
    const bin = join(temp, "bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "npm"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    const output = join(temp, "output");
    writeFileSync(output, "");
    const result = spawnSync("bash", ["-eo", "pipefail", "-c", install.run!], {
      cwd: repo,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        BASE: git("rev-parse", "HEAD"),
        RUNNER_TEMP: temp,
        GITHUB_OUTPUT: output,
      },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    return readFileSync(output, "utf8");
  };

  it("uses the base commit's install where the base has the factory", () => {
    expect(installOn({ ".claude/factory.yaml": "version: 2\n" })).toBe(
      `dir=${temp}/base\n`,
    );
  });

  it("leaves the steps to fall back where the base has no factory yet, as before the pull request that adds it", () => {
    expect(installOn({})).toBe("");
  });

  it("lists the tools and reads the tickets with the base commit's factory, or the head's when it could not install", () => {
    expect(
      (tools as Step & { "working-directory"?: string })["working-directory"],
    ).toBe(BASE_DIR);
    expect(
      (read as Step & { "working-directory"?: string })["working-directory"],
    ).toBe(BASE_DIR);
    expect(read.run).toContain('npx --no-install factory review tickets "$PR"');
  });

  it("hands the review the file and lets it read there", () => {
    expect(review.with!.prompt).toContain(
      "TICKETS: ${{ runner.temp }}/tickets.md",
    );
    expect(review.with!.claude_args).toContain(
      '--add-dir "${{ runner.temp }}"',
    );
  });

  /** Runs the step with `factory` standing in for the factory's command,
   * and returns the file it leaves. */
  const readTickets = (baseDir: string, factory: string) => {
    temp = mkdtempSync(join(tmpdir(), "claude-review-tickets-"));
    repo = temp;
    const script = read.run!.replace(
      'npx --no-install factory review tickets "$PR"',
      factory,
    );
    const result = spawnSync("bash", ["-eo", "pipefail", "-c", script], {
      cwd: temp,
      env: { ...process.env, BASE_DIR: baseDir, PR: "64", RUNNER_TEMP: temp },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    return readFileSync(join(temp, "tickets.md"), "utf8");
  };

  it("leaves what the base commit's factory printed", () => {
    expect(readTickets("/base", "echo '## #12 A ticket'")).toBe(
      "## #12 A ticket\n",
    );
  });

  it("notes that the tickets could not be read, and passes, when the base could not install", () => {
    expect(readTickets("", "echo unused")).toBe(
      "The tickets could not be read: the base commit has no factory, or it could not be installed\n",
    );
  });

  it("notes the error's last line, and passes, when the read fails", () => {
    expect(
      readTickets(
        "/base",
        "(echo 'first' >&2; echo 'Unknown command: review tickets' >&2; exit 1)",
      ),
    ).toBe("The tickets could not be read: Unknown command: review tickets\n");
  });
});
