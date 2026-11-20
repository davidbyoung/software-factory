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
import { join } from "node:path";
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
