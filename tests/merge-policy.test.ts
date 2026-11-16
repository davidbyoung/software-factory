import { describe, it, expect } from "vitest";
import { load } from "js-yaml";
import { readFileSync } from "node:fs";
import {
  classify,
  commandReasons,
  decide,
  inGithubNames,
  runCommand,
  statusLine,
  workflowOutput,
} from "../src/merge-policy.mts";

describe("inGithubNames", () => {
  it("hands a command each changed file as filename, previous_filename, and status", () => {
    expect(
      inGithubNames([
        { path: "docs/a.md", status: "modified" },
        { path: "docs/c.md", previousPath: "docs/b.md", status: "renamed" },
      ]),
    ).toEqual([
      {
        filename: "docs/a.md",
        previous_filename: undefined,
        status: "modified",
      },
      {
        filename: "docs/c.md",
        previous_filename: "docs/b.md",
        status: "renamed",
      },
    ]);
  });
});

// A made-up policy: the decision's own rules, whatever a repository lists.
const POLICY = { allow: ["docs/**", "site/**"], deny: ["site/checkout/**"] };

describe("classify", () => {
  it("lets a change merge itself when every path is in allow and none in deny", () => {
    expect(
      classify([{ filename: "docs/a.md" }, { filename: "site/b.ts" }], POLICY),
    ).toEqual({ risk: "merge: automatic", reasons: [] });
  });

  it("lets deny win over allow", () => {
    expect(classify([{ filename: "site/checkout/pay.ts" }], POLICY)).toEqual({
      risk: "merge: manual",
      reasons: ["site/checkout/pay.ts: held by auto-merge.deny"],
    });
  });

  it("holds a path outside allow", () => {
    expect(classify([{ filename: "build/x.sh" }], POLICY)).toEqual({
      risk: "merge: manual",
      reasons: ["build/x.sh: not in auto-merge.allow"],
    });
  });

  it("checks a renamed file under both names", () => {
    expect(
      classify(
        [
          {
            filename: "docs/moved.md",
            previous_filename: "site/checkout/old.md",
            status: "renamed",
          },
        ],
        POLICY,
      ),
    ).toEqual({
      risk: "merge: manual",
      reasons: ["site/checkout/old.md: held by auto-merge.deny"],
    });
  });

  it("holds a pull request with no changed files", () => {
    expect(classify([], POLICY)).toEqual({
      risk: "merge: manual",
      reasons: ["no changed files"],
    });
  });

  it("holds a factory file though allow matches it", () => {
    expect(
      classify(
        [
          { filename: ".claude/skills/x/SKILL.md" },
          { filename: "docs/CLAUDE.md" },
          { filename: "openspec/config.yaml" },
        ],
        { allow: ["**"], deny: [] },
      ).reasons,
    ).toEqual([
      ".claude/skills/x/SKILL.md: the factory's own files",
      "docs/CLAUDE.md: the factory's own files",
      "openspec/config.yaml: the factory's own files",
    ]);
  });
});

const input = { repository: "o/n", pull: 1, base: "b", head: "h", files: [] };

describe("decide", () => {
  const allowed = classify([{ filename: "docs/a.md" }], POLICY);

  it("lets the merge through when every command exits 0", () => {
    const results = [runCommand(`node -e "process.exit(0)"`, input)];
    expect(decide(allowed, commandReasons(results)).risk).toBe(
      "merge: automatic",
    );
  });

  it("holds the merge when a command exits non-zero, though every path is allowed", () => {
    const results = [runCommand(`node -e "process.exit(1)"`, input)];
    expect(decide(allowed, commandReasons(results))).toEqual({
      risk: "merge: manual",
      reasons: [`held by node -e "process.exit(1)"`],
    });
  });
});

describe("commands", () => {
  const run = (command: string) => commandReasons([runCommand(command, input)]);

  it("allows the merge when a command exits 0", () => {
    expect(run(`node -e "process.exit(0)"`)).toEqual([]);
  });

  it("holds with the command's output as the reason when it exits 1", () => {
    expect(
      run(
        `node -e "console.log('a.tsx: changes page metadata'); process.exit(1)"`,
      ),
    ).toEqual(["a.tsx: changes page metadata"]);
  });

  it("holds, naming the command, when it exits 1 and prints nothing", () => {
    expect(run(`node -e "process.exit(1)"`)).toEqual([
      `held by node -e "process.exit(1)"`,
    ]);
  });

  it("holds when the command does not exist", () => {
    expect(run("no-such-command-245")).toEqual([
      "held by no-such-command-245: it could not be run",
    ]);
  });

  it("gives the command the pull request on its standard input", () => {
    const echo = `node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{console.log(JSON.parse(s).repository);process.exit(1)})"`;
    expect(run(echo)).toEqual(["o/n"]);
  });
});

describe("statusLine", () => {
  it("says an automatic pull request merges itself", () => {
    expect(statusLine({ risk: "merge: automatic", reasons: [] })).toBe(
      "Merges itself once every gate passes: every file is on the allowlist",
    );
  });

  it("names the first reason and counts the rest", () => {
    expect(
      statusLine({
        risk: "merge: manual",
        reasons: ["CLAUDE.md: the agents' guardrails", "a", "b"],
      }),
    ).toBe(
      "Waits for the owner: CLAUDE.md: the agents' guardrails, and 2 more",
    );
  });

  it("keeps a path with a newline on one line", () => {
    const line = statusLine(
      classify([{ filename: "docs/a\nautomatic=true\nx=y" }], POLICY),
    );
    expect(line).not.toMatch(/[\n\r]/);
    expect(line).toBe(
      "Waits for the owner: docs/a automatic=true x=y: not in auto-merge.allow",
    );
  });

  it("stays within GitHub's 140-character limit", () => {
    const line = statusLine({
      risk: "merge: manual",
      reasons: [`${"content/questions/x".repeat(10)}.md: study-guide content`],
    });
    expect(line).toHaveLength(140);
    expect(line.endsWith("…")).toBe(true);
  });
});

describe("workflowOutput", () => {
  it("sets one merge label, removes the other, and says whether auto-merge goes on", () => {
    expect(
      workflowOutput({ risk: "merge: automatic", reasons: [] }),
    ).toMatchObject({ other: "merge: manual", automatic: true });
    expect(
      workflowOutput({ risk: "merge: manual", reasons: ["CLAUDE.md: x"] }),
    ).toMatchObject({ other: "merge: automatic", automatic: false });
  });
});

// The merge-policy and verdict workflows run main's copy of themselves and
// of the factory's command, never a pull request's: pull_request_target with
// the default checkout, which is the base branch.
describe.each(["factory-merge-policy.yml", "factory-review-verdict.yml"])(
  "workflows/%s",
  (file) => {
    const workflow = load(
      readFileSync(new URL(`../workflows/${file}`, import.meta.url), "utf8"),
    ) as {
      on: Record<string, unknown>;
      jobs: Record<string, { steps: { uses?: string; with?: object }[] }>;
    };

    it("runs on pull_request_target, never pull_request", () => {
      expect(Object.keys(workflow.on)).toContain("pull_request_target");
      expect(Object.keys(workflow.on)).not.toContain("pull_request");
    });

    it("checks out the base branch, not the pull request", () => {
      const checkouts = Object.values(workflow.jobs).flatMap((j) =>
        j.steps.filter((s) => s.uses?.startsWith("actions/checkout")),
      );
      expect(checkouts).toHaveLength(1);
      expect(checkouts[0].with).toBeUndefined();
    });
  },
);
