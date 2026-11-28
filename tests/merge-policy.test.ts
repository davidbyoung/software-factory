import type { Outcome } from "../src/approval-policies.mts";
import { afterEach, describe, it, expect } from "vitest";
import { PR_LABELS } from "../src/labels.mts";
import { load } from "js-yaml";
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
import { gitIn } from "../src/lib/default-branch.mts";
import {
  acrossReasons,
  type ChangedFile,
  classify,
  commandReasons,
  decide,
  judge,
  readChange,
  runCommand,
  statusLine,
  workflowOutput,
} from "../src/merge-policy.mts";
import { memoryTickets } from "./memory-tickets";
import { SECTION } from "./network";

// A made-up policy: the decision's own rules, whatever a repository lists.
const POLICY = { allow: ["docs/**", "site/**"], deny: ["site/checkout/**"] };

describe("classify", () => {
  it("lets a change merge itself when every path is in allow and none in deny", () => {
    expect(
      classify([{ filename: "docs/a.md" }, { filename: "site/b.ts" }], POLICY),
    ).toEqual({ risk: "merge-automatic", reasons: [] });
  });

  it("lets deny win over allow", () => {
    expect(classify([{ filename: "site/checkout/pay.ts" }], POLICY)).toEqual({
      risk: "merge-manual",
      reasons: ["site/checkout/pay.ts: held by auto-merge.deny"],
    });
  });

  it("holds a path outside allow", () => {
    expect(classify([{ filename: "build/x.sh" }], POLICY)).toEqual({
      risk: "merge-manual",
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
      risk: "merge-manual",
      reasons: ["site/checkout/old.md: held by auto-merge.deny"],
    });
  });

  it("holds a pull request with no changed files", () => {
    expect(classify([], POLICY)).toEqual({
      risk: "merge-manual",
      reasons: ["no changed files"],
    });
  });

  it("holds a kodor file though allow matches it", () => {
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
      ".claude/skills/x/SKILL.md: kodor's own files",
      "docs/CLAUDE.md: kodor's own files",
      "openspec/config.yaml: kodor's own files",
    ]);
  });
});

const input = { repository: "o/n", pull: 1, base: "b", head: "h", files: [] };

describe("decide", () => {
  const allowed = classify([{ filename: "docs/a.md" }], POLICY);

  it("lets the merge through when every command exits 0", () => {
    const results = [runCommand(`node -e "process.exit(0)"`, input)];
    expect(decide(allowed, commandReasons(results)).risk).toBe(
      "merge-automatic",
    );
  });

  it("holds the merge when a command exits non-zero, though every path is allowed", () => {
    const results = [runCommand(`node -e "process.exit(1)"`, input)];
    expect(decide(allowed, commandReasons(results))).toEqual({
      risk: "merge-manual",
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
    expect(statusLine({ risk: "merge-automatic", reasons: [] })).toBe(
      "Merges itself once every gate passes: every file is on the allowlist",
    );
  });

  it("names the first reason and counts the rest", () => {
    expect(
      statusLine({
        risk: "merge-manual",
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
      risk: "merge-manual",
      reasons: [`${"content/questions/x".repeat(10)}.md: study-guide content`],
    });
    expect(line).toHaveLength(140);
    expect(line.endsWith("…")).toBe(true);
  });
});

describe("workflowOutput", () => {
  it("sets one merge label, removes the other, and says whether auto-merge goes on", () => {
    expect(
      workflowOutput({ risk: "merge-automatic", reasons: [] }, PR_LABELS),
    ).toMatchObject({
      label: "merge-automatic",
      other: "merge-manual",
      automatic: true,
    });
    expect(
      workflowOutput(
        { risk: "merge-manual", reasons: ["CLAUDE.md: x"] },
        PR_LABELS,
      ),
    ).toMatchObject({
      label: "merge-manual",
      other: "merge-automatic",
      automatic: false,
    });
  });

  it("names each label as the settings rename it", () => {
    const names = {
      ...PR_LABELS,
      "merge-automatic": "auto-merge",
      "merge-manual": "needs owner",
    };
    expect(
      workflowOutput({ risk: "merge-manual", reasons: ["x"] }, names),
    ).toMatchObject({ label: "needs owner", other: "auto-merge" });
  });
});

// The merge policy and the verdict run the default branch's copy of
// themselves and of kodor's command, never a pull request's: jobs of
// run.yml's Pull request group that start on pull_request_target, with the
// default checkout,
// which is the base branch.
const run = load(
  readFileSync(
    new URL("../.github/workflows/run-pull-request.yml", import.meta.url),
    "utf8",
  ),
) as {
  jobs: Record<
    string,
    {
      if: string;
      steps: {
        id?: string;
        uses?: string;
        with?: Record<string, unknown>;
        run?: string;
      }[];
    }
  >;
};

describe.each(["merge-policy", "verdict"])(
  "the Pull request group's %s job",
  (name) => {
    const job = run.jobs[name]!;

    it("starts on pull_request_target, never pull_request", () => {
      expect(job.if).toContain("github.event_name == 'pull_request_target'");
      expect(job.if).not.toContain("github.event_name == 'pull_request'");
    });

    it("checks out the base branch, not the pull request", () => {
      const checkouts = job.steps.filter((s) =>
        s.uses?.startsWith("actions/checkout"),
      );
      expect(checkouts).toHaveLength(1);
      // How much history it fetches is its own; which commit, never.
      expect(checkouts[0]!.with?.ref).toBeUndefined();
      expect(checkouts[0]!.with?.repository).toBeUndefined();
    });
  },
);

describe("the Pull request group's merge-policy job", () => {
  const classify = run.jobs["merge-policy"]!.steps.find(
    (s) => s.id === "classify",
  )!;

  it("labels with the name the command gives, not its key", () => {
    const output = workflowOutput(
      { risk: "merge-manual", reasons: ["x"] },
      { ...PR_LABELS, "merge-manual": "needs owner" },
    );
    const [, field] = /echo "label=\$\(jq -r \.(\w+) /.exec(classify.run!)!;
    const [, other] = /echo "other=\$\(jq -r \.(\w+) /.exec(classify.run!)!;

    expect((output as Record<string, unknown>)[field!]).toBe("needs owner");
    expect((output as Record<string, unknown>)[other!]).toBe("merge-automatic");
  });
});

describe("a pull request that is part of a ticket across repositories", () => {
  const held = (body: string, ticketBody = `The ask.\n\n${SECTION}`) => {
    const { tickets } = memoryTickets([{ key: "12", body: ticketBody }], {
      repository: "acme/api",
    });
    return acrossReasons(body, { tickets, repository: "acme/api" });
  };

  it("waits for a person, in the ticket's repository and in any other", async () => {
    expect(await held("Part of #12")).toEqual([
      "part of #12, which spans repositories",
    ]);
    expect(await held("Part of acme/web#7")).toEqual([
      "part of acme/web#7, which spans repositories",
    ]);
  });

  it("is told by the ticket a cloud build recorded, whatever its link says", async () => {
    expect(
      await held(
        "Words.\n\n<!-- factory: cloud-build -->\n<!-- factory: ticket acme/web#7 -->",
      ),
    ).toEqual(["part of acme/web#7, which spans repositories"]);
  });

  it("merges by its files when its ticket names one repository", async () => {
    expect(await held("Part of #12", "The ask.")).toEqual([]);
    expect(await held("Part of #99")).toEqual([]);
  });

  it("waits when its ticket cannot be read", async () => {
    expect(
      await held("Part of #12", "## Repositories\n\n- acme web\n"),
    ).toEqual(["part of #12, which could not be read"]);
  });
});

describe("judge", () => {
  const { tickets } = memoryTickets(
    [{ key: "12", body: `The ask.\n\n${SECTION}` }],
    { repository: "acme/api" },
  );
  const judged = (
    body: string,
    files: ChangedFile[] | null = [{ filename: "docs/a.md" }],
    held: () => string[] = () => [],
  ) =>
    judge({
      files,
      body,
      policy: POLICY,
      across: { tickets, repository: "acme/api" },
      held,
    });

  it("holds a pull request of a ticket across repositories whose every file is allowed", async () => {
    expect(await judged("Part of #12")).toEqual({
      risk: "merge-manual",
      reasons: ["part of #12, which spans repositories"],
    });
    expect((await judged("Closes #7")).risk).toBe("merge-automatic");
  });

  it("holds one a command holds", async () => {
    expect(
      (await judged("", undefined, () => ["held by a command"])).reasons,
    ).toEqual(["held by a command"]);
  });

  it("holds one an approval policy with an agent applies to, before any check runs, and not one with a command alone", async () => {
    const policies = [
      {
        name: "migrations",
        run: null,
        agent: "rollback-checker",
        in: ["services/*"],
        files: ["./db/**"],
      },
      {
        name: "licenses",
        run: "node c.mjs",
        agent: null,
        in: null,
        files: ["docs/**"],
      },
    ];
    const judgedWith = (files: { filename: string }[]) =>
      judge({
        files,
        body: "Closes #7",
        policy: { allow: ["**"], deny: [] },
        across: { tickets, repository: "acme/api" },
        held: () => [],
        approvalPolicies: policies,
      });
    expect(
      await judgedWith([{ filename: "services/orders/db/1.sql" }]),
    ).toEqual({
      risk: "merge-manual",
      reasons: [
        "migrations in services/orders is checked by an agent, so a person merges it",
      ],
    });
    expect((await judgedWith([{ filename: "docs/a.md" }])).risk).toBe(
      "merge-automatic",
    );
  });

  describe("a policy with both a command and an agent", () => {
    const credentials = {
      name: "credentials",
      run: "node find.mts",
      agent: "kodor-credentials-reader",
      in: null,
      files: ["**"],
    };
    const judgedAfter = (outcome: Outcome) =>
      judge({
        files: [{ filename: "docs/a.md" }],
        body: "Closes #7",
        policy: { allow: ["**"], deny: [] },
        across: { tickets, repository: "acme/api" },
        held: () => [],
        approvalPolicies: [credentials],
        ran: async () => outcome,
      });

    it("lets a pull request its command found nothing in merge itself", async () => {
      expect((await judgedAfter({ kind: "nothing" })).risk).toBe(
        "merge-automatic",
      );
    });

    it.each<[string, Outcome]>([
      [
        "found something",
        { kind: "findings", findings: [{ file: "a", title: "t" }] },
      ],
      ["failed", { kind: "failed", why: "exit 1", command: "c", stderr: "" }],
    ])("holds one its command %s in, for a person", async (_, outcome) => {
      expect(await judgedAfter(outcome)).toEqual({
        risk: "merge-manual",
        reasons: ["credentials is checked by an agent, so a person merges it"],
      });
    });
  });

  it("asks no command about one with no files", async () => {
    const found = await judged("", [], () => {
      throw new Error("asked");
    });
    expect(found.reasons).toEqual(["no changed files"]);
  });

  it("holds one whose changed files could not be read, and asks no command", async () => {
    const found = await judged("Closes #7", null, () => {
      throw new Error("asked");
    });
    expect(found).toEqual({
      risk: "merge-manual",
      reasons: ["the changed files could not be read"],
    });
  });
});

describe("readChange", () => {
  let world = "";
  afterEach(() => rmSync(world, { recursive: true, force: true }));

  const sh = (cwd: string, ...args: string[]) => {
    const r = spawnSync("git", args, {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_AUTHOR_NAME: "t",
        GIT_AUTHOR_EMAIL: "t@t",
        GIT_COMMITTER_NAME: "t",
        GIT_COMMITTER_EMAIL: "t@t",
      },
    });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
    return r.stdout.trim();
  };

  /** A checkout of an origin whose refs/pull/7/head adds `paths` to main. */
  function pull(paths: string[]) {
    world = mkdtempSync(join(tmpdir(), "merge-policy-"));
    const origin = join(world, "origin");
    mkdirSync(origin);
    sh(origin, "init", "-q", "-b", "main");
    writeFileSync(join(origin, "README.md"), "base\n");
    sh(origin, "add", "-A");
    sh(origin, "commit", "-qm", "base");
    sh(origin, "checkout", "-qb", "feature");
    for (const path of paths) {
      mkdirSync(dirname(join(origin, path)), { recursive: true });
      writeFileSync(join(origin, path), "x\n");
    }
    sh(origin, "add", "-A");
    sh(origin, "commit", "-qm", "change");
    const head = sh(origin, "rev-parse", "HEAD");
    sh(origin, "update-ref", "refs/pull/7/head", head);
    sh(origin, "checkout", "-q", "main");
    const checkout = join(world, "checkout");
    sh(world, "clone", "-q", origin, checkout);
    return { git: gitIn(checkout), head };
  }

  it("reads a deny file past the 3000 files GitHub lists", () => {
    const many = Array.from(
      { length: 3000 },
      (_, i) => `docs/${String(i).padStart(4, "0")}.md`,
    );
    const { git, head } = pull([...many, "site/checkout/pay.ts"]);
    const change = readChange(git, 7, "main", head);
    expect(change?.files).toHaveLength(3001);
    expect(classify(change!.files, POLICY)).toEqual({
      risk: "merge-manual",
      reasons: ["site/checkout/pay.ts: held by auto-merge.deny"],
    });
  });

  it("can't read a head commit the fetch did not bring", () => {
    const { git } = pull(["docs/a.md"]);
    expect(readChange(git, 7, "main", "0".repeat(40))).toBeNull();
  });
});
