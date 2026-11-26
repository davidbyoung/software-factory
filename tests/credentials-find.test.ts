// The credentials policy's rule, run as a policy's check runs: the real
// script, from a repository's checkout, with the change as JSON on its
// standard input.
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { modelOf } from "../src/approval-agent.mts";
import { CREDENTIAL_NAME } from "../src/lib/refined-check.mts";
import { hasNameIn } from "../src/ticket.mts";

const SCRIPT = resolve("approval-policies/credentials/find.mts");

let repo = "";
let base = "";
const env = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@t",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@t",
};
beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "credentials-find-"));
  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), text);
  };
  put("src/a.ts", "const t = process.env.EXISTING_TOKEN;\n");
  put("docs/setup.md", "Set DOCS_ONLY_TOKEN first.\n");
  const git = (...args: string[]) =>
    spawnSync("git", args, { cwd: repo, env, encoding: "utf8" });
  git("init", "-q");
  git("add", "-A");
  git("commit", "-qm", "base");
  base = git("rev-parse", "HEAD").stdout.trim();
});
afterAll(() => rmSync(repo, { recursive: true, force: true }));

/** A diff that adds `lines` to `file`, from line 1. */
const adds = (file: string, ...lines: string[]) =>
  [
    `diff --git a/${file} b/${file}`,
    `--- a/${file}`,
    `+++ b/${file}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((l) => `+${l}`),
  ].join("\n");

const found = (
  diff: string,
  files: {
    filename: string;
    status: string;
    previous_filename?: string;
  }[] = [],
) => {
  const r = spawnSync("node", [SCRIPT], {
    cwd: repo,
    input: JSON.stringify({ base, files, diff }),
    encoding: "utf8",
  });
  expect(r.status, r.stderr).toBe(0);
  return JSON.parse(r.stdout).findings as {
    file: string;
    line: number;
    title: string;
  }[];
};
const titles = (...args: Parameters<typeof found>) =>
  found(...args).map((f) => f.title);

describe("the credentials policy's rule", () => {
  it("finds a credential's name the repository doesn't have, on its line", () => {
    expect(found(adds("src/b.ts", "x", "const k = env.STRIPE_KEY;"))).toEqual([
      { file: "src/b.ts", line: 2, title: "A new credential: STRIPE_KEY" },
    ]);
  });

  it.each([
    "NPM_TOKEN",
    "DB_PASSWORD",
    "APP_SECRET",
    "GH_PAT",
    "BASIC_AUTH",
    "AWS_CREDENTIALS",
    "GCP_CREDENTIAL",
  ])("counts %s as a credential's name", (name) => {
    expect(titles(adds("src/b.ts", name))).toEqual([
      `A new credential: ${name}`,
    ]);
  });

  it.each(["COMPAT", "HOTKEY", "OAUTH", "apiKey", "GITHUB_TOKEN"])(
    "leaves %s alone",
    (name) => {
      expect(titles(adds("src/b.ts", name))).toEqual([]);
    },
  );

  it("leaves a name alone that the repository already has outside docs and tests", () => {
    expect(titles(adds("src/b.ts", "EXISTING_TOKEN"))).toEqual([]);
  });

  it("counts a name as new when the repository has it only in docs", () => {
    expect(titles(adds("src/b.ts", "DOCS_ONLY_TOKEN"))).toEqual([
      "A new credential: DOCS_ONLY_TOKEN",
    ]);
  });

  it.each([
    "tests/a.ts",
    "packages/api/tests/a.ts",
    "docs/x.md",
    "spec/x.ts",
    "openspec/specs/x/spec.md",
    "src/a.test.ts",
    "src/a.spec.ts",
  ])("doesn't read %s", (file) => {
    expect(titles(adds(file, "NEW_TOKEN"))).toEqual([]);
  });

  it.each([
    ["${{ secrets.DEPLOY_KEY }}", "Passes a secret: DEPLOY_KEY"],
    ["${{ secrets['DEPLOY_HOOK'] }}", "Passes a secret: DEPLOY_HOOK"],
    ["extra: ${{ toJSON(secrets) }}", "Passes every secret"],
    ["secrets: inherit", "Passes every secret"],
  ])("finds a secret passed to a workflow as %s", (line, title) => {
    expect(titles(adds(".github/workflows/ci.yml", line))).toContain(title);
  });

  it("leaves the workflow's own GITHUB_TOKEN alone", () => {
    expect(
      titles(
        adds(".github/workflows/ci.yml", "token: ${{ secrets.GITHUB_TOKEN }}"),
      ),
    ).toEqual([]);
  });

  it.each([
    ["contents: write", "Write access: contents: write"],
    ["contents: 'write'", "Write access: contents: write"],
    [
      "permissions: { contents: write, issues: read }",
      "Write access: contents: write",
    ],
    ["permissions: write-all", "Write access: write-all"],
    ["  'contents': write", "Write access: contents: write"],
    ['  "contents": "write"', "Write access: contents: write"],
  ])("finds write access written as %s", (line, title) => {
    expect(titles(adds(".github/workflows/ci.yml", line))).toEqual([title]);
  });

  it("reads secrets and write access only in a workflow", () => {
    expect(
      titles(adds("src/config.yml", "contents: write", "${{ secrets.X }}")),
    ).toEqual([]);
  });

  it.each([
    "on: pull_request_target",
    "  pull_request_target:",
    "on: [push, pull_request_target]",
    "  - pull_request_target",
    '  "pull_request_target":',
    'on: [push, "pull_request_target"]',
  ])("finds a pull_request_target trigger written as %s", (line) => {
    expect(titles(adds(".github/workflows/ci.yml", line))).toEqual([
      "A pull_request_target trigger",
    ]);
  });

  it("doesn't read a trigger in a comment", () => {
    expect(
      titles(adds(".github/workflows/ci.yml", "# on: pull_request_target")),
    ).toEqual([]);
  });

  it("finds a workflow new to the repository, or moved into .github/workflows/, on line 1", () => {
    expect(
      found("", [{ filename: ".github/workflows/new.yml", status: "added" }]),
    ).toEqual([
      {
        file: ".github/workflows/new.yml",
        line: 1,
        title: "A workflow new to the repository",
      },
    ]);
    expect(
      titles("", [
        {
          filename: ".github/workflows/moved.yml",
          previous_filename: "ci/moved.yml",
          status: "renamed",
        },
      ]),
    ).toEqual(["A workflow new to the repository"]);
  });

  it("reads an added line that starts with ++ as code, not as a file's header", () => {
    expect(
      found(adds("src/a.js", "++ i;", "process.env.DEPLOY_TOKEN;")),
    ).toEqual([
      { file: "src/a.js", line: 2, title: "A new credential: DEPLOY_TOKEN" },
    ]);
  });

  it("leaves a workflow renamed within .github/workflows/ alone", () => {
    expect(
      titles("", [
        {
          filename: ".github/workflows/b.yml",
          previous_filename: ".github/workflows/a.yml",
          status: "renamed",
        },
      ]),
    ).toEqual([]);
  });

  it("finds nothing in a one-sentence change to a docs page", () => {
    expect(
      found(adds("README.md", "The factory reads every pull request.")),
    ).toEqual([]);
  });
});

describe("the credentials policy's reader", () => {
  const text = readFileSync("agents/factory-credentials-reader.md", "utf8");
  const paragraphs = text.split(/^---$/m)[2]!.trim().split(/\n\n+/);

  it("runs with Opus", () => {
    expect(modelOf(text)).toBe("opus");
  });

  it("is told it has the default branch's code and the change's diff, and to report only a High", () => {
    expect(paragraphs[1]).toBe(
      "A script found that this change touches a credential or widens what a workflow may do. The findings you are handed are the lines it found. Your working folder holds the default branch's code, and the diff you are handed is the change: the code after it is that folder with the diff applied.",
    );
    expect(paragraphs.at(-1)).toBe(
      "Report only a High, in the answer's shape. If you find nothing, answer with no findings.",
    );
  });
});

describe("the refined check's lookup", () => {
  it.each([
    "STRIPE_KEY",
    "NPM_TOKEN",
    "GH_PAT",
    "BASIC_AUTH",
    "GCP_CREDENTIAL",
    "COMPAT",
    "HOTKEY",
    "OAUTH",
    "apiKey",
  ])("reads %s as a credential's name only when the rule does", (name) => {
    const named = [...` ${name} `.matchAll(CREDENTIAL_NAME)].length > 0;
    expect(titles(adds("src/b.ts", name)).length > 0).toBe(named);
  });

  it("finds a name the default branch has outside docs, and not one only in docs", () => {
    const has = hasNameIn(repo);
    expect([has("EXISTING_TOKEN"), has("DOCS_ONLY_TOKEN")]).toEqual([
      true,
      false,
    ]);
  });

  it("reads origin's default branch where there is one", () => {
    const own = mkdtempSync(join(tmpdir(), "credentials-origin-"));
    try {
      const git = (...args: string[]) =>
        spawnSync("git", args, { cwd: own, env, encoding: "utf8" });
      git("init", "-q");
      writeFileSync(join(own, "a.ts"), "x\n");
      git("add", "-A");
      git("commit", "-qm", "base");
      const local = git("rev-parse", "HEAD").stdout.trim();
      writeFileSync(join(own, "a.ts"), "ORIGIN_ONLY_TOKEN\n");
      git("commit", "-qam", "ahead");
      git("update-ref", "refs/remotes/origin/main", "HEAD");
      git(
        "symbolic-ref",
        "refs/remotes/origin/HEAD",
        "refs/remotes/origin/main",
      );
      git("checkout", "-q", local);
      expect(hasNameIn(own)("ORIGIN_ONLY_TOKEN")).toBe(true);
    } finally {
      rmSync(own, { recursive: true, force: true });
    }
  });
});
