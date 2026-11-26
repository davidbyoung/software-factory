// The steps of the approval policies' jobs, run against a real git origin
// that holds a pull request's head as GitHub does, and an in-memory code
// host, tickets, and runner.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  agent,
  approve,
  check,
  commands,
  kept,
  prepare,
  status,
  type Deps,
} from "../src/approval-job.mts";
import type { Input, Ran } from "../src/approval-policies.mts";
import { parseSettings, type ApprovalPolicy } from "../src/config.mts";
import type { NewStatus } from "../src/code-host/types.mts";
import { gitIn } from "../src/lib/default-branch.mts";
import { memoryCodeHost } from "./memory-code-host";
import { memoryTickets } from "./memory-tickets";
import { memoryRunner } from "./memory-runner";
import { CODE_HOST } from "./settings-fixture";
import { into } from "./printed";

let world = "";
afterEach(() => rmSync(world, { recursive: true, force: true }));

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@t",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@t",
};
const sh = (cwd: string, ...args: string[]) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", env: GIT_ENV });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};
const put = (root: string, path: string, text: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

/** An origin whose main has a lock file, and whose refs/pull/7/head
 * changes it and adds a migration; and a checkout of main. */
function repository(change = true) {
  world = mkdtempSync(join(tmpdir(), "approval-job-"));
  const origin = join(world, "origin");
  mkdirSync(origin);
  sh(origin, "init", "-q", "-b", "main");
  put(origin, "package-lock.json", "{}\n");
  sh(origin, "add", "-A");
  sh(origin, "commit", "-qm", "base");
  sh(origin, "checkout", "-qb", "feature");
  if (change) {
    put(origin, "package-lock.json", '{\n  "license": "GPL-3.0"\n}\n');
    put(origin, "services/orders/db/migrations/1.sql", "DROP TABLE x;\n");
  } else put(origin, "README.md", "hello\n");
  sh(origin, "add", "-A");
  sh(origin, "commit", "-qm", "change");
  const head = sh(origin, "rev-parse", "HEAD");
  sh(origin, "update-ref", "refs/pull/7/head", head);
  sh(origin, "checkout", "-q", "main");
  const checkout = join(world, "checkout");
  sh(world, "clone", "-q", origin, checkout);
  return { checkout, head, dir: join(world, "approval") };
}

const POLICIES = [
  { name: "licenses", run: "node check.mjs", files: ["package-lock.json"] },
  {
    name: "migrations",
    agent: "rollback-checker",
    in: "services/*",
    files: ["./db/migrations/**"],
  },
];

function setup(
  o: {
    policies?: unknown[];
    labels?: string[];
    isDraft?: boolean;
    event?: object;
    head?: string;
    body?: string;
    writers?: string[];
    env?: Record<string, string>;
    ran?: Ran;
    agentAnswer?: Awaited<ReturnType<Deps["runAgent"]>>;
  } = {},
  r = repository(),
) {
  const settings = parseSettings(
    {
      version: 2,
      repository: "acme/widgets",
      "code-host": CODE_HOST,
      "approval-policies": o.policies ?? POLICIES,
    },
    () => true,
  );
  const host = memoryCodeHost(
    [
      {
        number: 7,
        isDraft: o.isDraft ?? false,
        body: o.body ?? "Closes #12",
        labels: o.labels ?? [],
        labeledBy: { "policy-override": "lead" },
        head: {
          sha: o.head ?? r.head,
          branch: "feature",
          repository: "acme/widgets",
        },
        base: { sha: "", branch: "main", repository: "acme/widgets" },
      },
    ],
    { writers: o.writers ?? ["lead", "acme"] },
  );
  const posted: (NewStatus & { sha: string })[] = [];
  const { tickets } = memoryTickets([{ key: "12", body: "Add refunds." }], {
    repository: "acme/widgets",
  });
  const event = join(world, "event.json");
  writeFileSync(
    event,
    JSON.stringify(
      o.event ?? {
        action: "opened",
        pull_request: { number: 7, head: { sha: r.head } },
      },
    ),
  );
  const outputs: string[] = [];
  const summaries: string[] = [];
  const agents: { name: string; found: unknown }[] = [];
  const d: Deps = {
    settings,
    codeHost: {
      ...host.codeHost,
      setStatus: async (sha, s) => {
        posted.push({ sha, ...s });
        return host.codeHost.setStatus(sha, s);
      },
    },
    tickets,
    runner: memoryRunner().runner,
    git: gitIn(r.checkout),
    env: { GITHUB_EVENT_PATH: event, ...o.env },
    root: r.checkout,
    runCommand: async () =>
      o.ran ?? {
        status: 0,
        stdout:
          '{"findings":[{"file":"package-lock.json","title":"A dependency is GPL-3.0"}]}',
        stderr: "",
        timedOut: false,
      },
    runAgent: async (name, _input, found) => {
      agents.push({ name, found });
      return o.agentAnswer ?? { findings: [] };
    },
    output: (line) => outputs.push(line),
    summary: (m) => summaries.push(m),
    out: () => {},
    err: () => {},
  };
  return { d, r, host, posted, outputs, summaries, agents };
}

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));

describe("preparing the checks", () => {
  it("writes each check's input from git: its files, their diff, its folder, and the ticket the body closes", async () => {
    const { d, r, outputs } = setup();
    const plan = await prepare(d, r.dir);
    expect(plan.checks).toEqual([
      { i: 0, name: "licenses", run: "node check.mjs", agent: null },
      {
        i: 1,
        name: "migrations in services/orders",
        run: null,
        agent: "rollback-checker",
      },
    ]);
    const input: Input = readJson(join(r.dir, "input", "0.json"));
    expect(input).toMatchObject({
      version: 1,
      repository: "acme/widgets",
      pull: 7,
      head: r.head,
      files: [{ filename: "package-lock.json", status: "modified" }],
      in: null,
      ticket: { id: "12", text: "Add refunds." },
    });
    expect(input.diff).toContain('+  "license": "GPL-3.0"');
    expect(input.diff).not.toContain("DROP TABLE");
    expect(readJson(join(r.dir, "input", "1.json")).in).toBe("services/orders");
    expect(outputs).toEqual([
      `kept=approval-policies-7-${r.head}`,
      `approved=approval-policies-approved-7-${r.head}`,
      "commands=true",
      "agents=[1]",
    ]);
  });

  it("posts Nothing to approve when no policy applies, and runs nothing", async () => {
    const { d, r, posted, outputs } = setup({}, repository(false));
    expect((await prepare(d, r.dir)).done).toBe(true);
    expect(posted).toMatchObject([
      { sha: r.head, state: "success", description: "Nothing to approve" },
    ]);
    expect(outputs).toEqual(["commands=false", "agents=[]"]);
  });

  it("posts a pending status that waits for the draft to be marked ready", async () => {
    const { d, r, posted } = setup({ isDraft: true });
    expect((await prepare(d, r.dir)).done).toBe(true);
    expect(posted).toMatchObject([
      {
        state: "pending",
        description: "Checks when the pull request is marked ready",
      },
    ]);
  });

  it("makes every policy wait when git can't read the change", async () => {
    const { d, r, posted } = setup({ head: "0".repeat(40) });
    await prepare(d, r.dir);
    expect(posted).toMatchObject([
      {
        state: "pending",
        description:
          "The change couldn't be read, so every policy waits for approval",
      },
    ]);
  });

  it.each([
    ["a push", { action: "synchronize" }],
    [
      "a change of base",
      { action: "edited", changes: { base: { ref: { from: "x" } } } },
    ],
  ])("takes the label off after %s", async (_, e) => {
    const r = repository();
    const { d, host } = setup(
      {
        labels: ["policy-override"],
        event: { ...e, pull_request: { number: 7, head: { sha: r.head } } },
      },
      r,
    );
    await prepare(d, r.dir);
    expect(host.pull(7).labels).toEqual([]);
  });

  it("leaves the label on after an edit of the title", async () => {
    const r = repository();
    const { d, host } = setup(
      {
        labels: ["policy-override"],
        event: {
          action: "edited",
          changes: { title: {} },
          pull_request: { number: 7 },
        },
      },
      r,
    );
    await prepare(d, r.dir);
    expect(host.pull(7).labels).toEqual(["policy-override"]);
  });
});

describe("running the checks", () => {
  it("runs each command and keeps what it found", async () => {
    const { d, r } = setup();
    await prepare(d, r.dir);
    await commands(d, r.dir);
    expect(readJson(join(r.dir, "answer", "0.json"))).toEqual({
      kind: "findings",
      findings: [
        { file: "package-lock.json", title: "A dependency is GPL-3.0" },
      ],
    });
  });

  const BOTH = [
    {
      name: "credentials",
      run: "node find.mjs",
      agent: "reader",
      files: ["**"],
    },
  ];
  /** A policy with a command and an agent, run through both. */
  const both = async (ran?: Ran) => {
    const s = setup({
      policies: BOTH,
      env: { CLAUDE_CODE_OAUTH_TOKEN: "t" },
      ran,
    });
    await prepare(s.d, s.r.dir);
    await commands(s.d, s.r.dir);
    await agent(s.d, s.r.dir, 0);
    return { ...s, answer: readJson(join(s.r.dir, "answer", "0.json")) };
  };

  it("hands an agent only what its command found", async () => {
    const s = await both();
    expect(s.agents).toEqual([
      {
        name: "reader",
        found: [
          { file: "package-lock.json", title: "A dependency is GPL-3.0" },
        ],
      },
    ]);
    expect(s.answer).toEqual({ kind: "cleared", agent: "reader" });
  });

  it("runs no agent when its command found nothing", async () => {
    const s = await both({
      status: 0,
      stdout: '{"findings":[]}',
      stderr: "",
      timedOut: false,
    });
    expect(s.agents).toEqual([]);
    expect(s.answer).toEqual({ kind: "nothing" });
  });

  it("can't run an agent with no Claude credential", async () => {
    const { d, r, agents } = setup();
    await prepare(d, r.dir);
    await agent(d, r.dir, 1);
    expect(agents).toEqual([]);
    expect(readJson(join(r.dir, "answer", "1.json"))).toEqual({
      kind: "cant-run",
      agent: "rollback-checker",
    });
  });
});

describe("posting the status", () => {
  it("waits on what was found, creates the label, and lists the findings in the run's summary", async () => {
    const { d, r, posted, summaries, host } = setup({
      env: { CLAUDE_CODE_OAUTH_TOKEN: "t" },
      agentAnswer: {
        findings: [
          {
            file: "services/orders/db/migrations/1.sql",
            title: "No rollback",
            line: 1,
          },
        ],
      },
    });
    await prepare(d, r.dir);
    await commands(d, r.dir);
    await agent(d, r.dir, 1);
    await status(d, r.dir);
    expect(posted.at(-1)).toMatchObject({
      sha: r.head,
      state: "pending",
      description:
        "2 policies waiting for approval: licenses, migrations in services/orders. To accept them, add the policy-override label",
    });
    expect(Object.keys(host.settings.labels)).toContain("policy-override");
    expect(summaries[0]).toContain(
      "`services/orders/db/migrations/1.sql:1` No rollback",
    );
    expect(readJson(join(r.dir, "kept", "results.json")).results).toHaveLength(
      2,
    );
  });

  it("names an agent that never ran as one that can't run here", async () => {
    const { d, r, posted } = setup();
    await prepare(d, r.dir);
    await commands(d, r.dir);
    await status(d, r.dir);
    expect(posted.at(-1)?.description).toBe(
      "migrations in services/orders: rollback-checker can't run here, so everything it applies to waits for approval",
    );
  });

  /** A commit whose licenses finding was approved with the label, and
   * a later run of its checks whose command answers `stdout`. */
  async function rerunAfterApproval(stdout: string) {
    const s = setup({ policies: [POLICIES[0]] });
    await prepare(s.d, s.r.dir);
    await commands(s.d, s.r.dir);
    await status(s.d, s.r.dir);
    writeFileSync(
      s.d.env.GITHUB_EVENT_PATH!,
      JSON.stringify({
        action: "labeled",
        label: { name: "policy-override" },
        pull_request: { number: 7, head: { sha: s.r.head } },
      }),
    );
    s.host.change(7, { labels: ["policy-override"] });
    await approve(s.d, s.r.dir);
    s.d.runCommand = async () => ({
      status: 0,
      stdout,
      stderr: "",
      timedOut: false,
    });
    rmSync(join(s.r.dir, "answer"), { recursive: true });
    await commands(s.d, s.r.dir);
    await status(s.d, s.r.dir);
    return s;
  }
  const GPL = '{"file":"package-lock.json","title":"A dependency is GPL-3.0"}';

  it("leaves an approval of this commit standing when its checks run again and find the same", async () => {
    const s = await rerunAfterApproval(`{"findings":[${GPL}]}`);
    expect(s.posted.at(-1)).toMatchObject({
      state: "success",
      description: `Approved by @lead at ${s.r.head.slice(0, 7)}`,
    });
  });

  it("waits again when its checks run again and find more than was approved", async () => {
    const s = await rerunAfterApproval(
      `{"findings":[${GPL},{"file":"package-lock.json","title":"Another"}]}`,
    );
    expect(s.posted.at(-1)?.state).toBe("pending");
  });
});

describe("approving with the label", () => {
  const labeled = (head: string) => ({
    action: "labeled",
    label: { name: "policy-override" },
    pull_request: { number: 7, head: { sha: head } },
  });
  async function ready(o: Parameters<typeof setup>[0] = {}) {
    const r = repository();
    const s = setup(
      { policies: [POLICIES[0]], ...o, event: labeled(r.head) },
      r,
    );
    writeFileSync(
      s.d.env.GITHUB_EVENT_PATH!,
      JSON.stringify({ action: "opened", pull_request: { number: 7 } }),
    );
    await prepare(s.d, r.dir);
    await commands(s.d, r.dir);
    await status(s.d, r.dir);
    writeFileSync(
      s.d.env.GITHUB_EVENT_PATH!,
      JSON.stringify(o.event ?? labeled(r.head)),
    );
    s.host.change(7, { labels: ["policy-override"] });
    return s;
  }

  it("approves what waited on the label's commit, and says what it approved", async () => {
    const { d, r, posted, host } = await ready();
    await approve(d, r.dir);
    expect(posted.at(-1)).toMatchObject({
      sha: r.head,
      state: "success",
      description: `Approved by @lead at ${r.head.slice(0, 7)}`,
    });
    expect(host.pull(7).comments.at(-1)?.body).toBe(
      [
        `**Approved by @lead** at ${r.head.slice(0, 7)}, as the approval policies stood on the default branch:`,
        "",
        "- **licenses:** `package-lock.json` A dependency is GPL-3.0",
      ].join("\n"),
    );
    expect(existsSync(join(r.dir, "approved", "approved.json"))).toBe(true);
  });

  it("takes off a label someone who can't write added, and approves nothing", async () => {
    const { d, r, posted, host } = await ready({ writers: ["acme"] });
    const before = posted.length;
    await approve(d, r.dir);
    expect(posted.length).toBe(before);
    expect(host.pull(7).labels).toEqual([]);
    expect(host.pull(7).comments.at(-1)?.body).toBe(
      "Removed `policy-override`: only someone who can write to this repository may accept what an approval policy found.",
    );
  });

  it("takes off a label added on a commit that is no longer the head", async () => {
    const { d, r, posted, host } = await ready({
      event: labeled("f".repeat(40)),
    });
    const before = posted.length;
    await approve(d, r.dir);
    expect(posted.length).toBe(before);
    expect(host.pull(7).comments.at(-1)?.body).toContain(
      `a newer commit, ${r.head.slice(0, 7)}, is unread`,
    );
  });

  it("approves nothing on the verdict's override", async () => {
    const { d, r, posted, host } = await ready({
      event: {
        action: "labeled",
        label: { name: "verdict-override" },
        pull_request: { number: 7 },
      },
    });
    const before = posted.length;
    const comments = host.pull(7).comments.length;
    await approve(d, r.dir);
    expect(posted.length).toBe(before);
    expect(host.pull(7).comments.length).toBe(comments);
  });

  it("takes off a label added before the checks kept anything", async () => {
    const { d, r, host } = await ready();
    rmSync(join(r.dir, "kept"), { recursive: true });
    await approve(d, r.dir);
    expect(host.pull(7).labels).toEqual([]);
    expect(host.pull(7).comments.at(-1)?.body).toContain("haven't finished");
  });

  it("says once, on an approving review while a policy waits, that the label accepts it", async () => {
    const review = {
      review: { state: "approved" },
      pull_request: { number: 7 },
    };
    const { d, r, host } = await ready({ event: review });
    await approve(d, r.dir);
    await approve(d, r.dir);
    const said = host
      .pull(7)
      .comments.filter((c) => c.body.includes("still waits"));
    expect(said).toHaveLength(1);
    expect(said[0]!.body).toContain("add the `policy-override` label");
  });
});

describe("the run that kept an artifact", () => {
  it("is printed for the workflow to download from, or nothing", async () => {
    const outputs: string[] = [];
    const output = (l: string) => void outputs.push(l);
    const runner = memoryRunner({
      kept: { "approval-policies-7-abc": 91 },
    }).runner;
    await kept({ runner, output, env: {} }, ["approval-policies-7-abc"]);
    await kept({ runner: memoryRunner().runner, output, env: {} }, ["x"]);
    expect(outputs).toEqual(["run=91", "run="]);
  });

  it("is named, with --event, for the findings of the commit the event names", async () => {
    world = mkdtempSync(join(tmpdir(), "approval-job-"));
    const event = join(world, "event.json");
    writeFileSync(
      event,
      JSON.stringify({ pull_request: { number: 7, head: { sha: "abc" } } }),
    );
    const outputs: string[] = [];
    const runner = memoryRunner({
      kept: { "approval-policies-7-abc": 91 },
    }).runner;
    await kept(
      {
        runner,
        output: (l) => void outputs.push(l),
        env: { GITHUB_EVENT_PATH: event },
      },
      ["--event", "findings"],
    );
    expect(outputs).toEqual(["name=approval-policies-7-abc", "run=91"]);
  });
});

describe("factory approval-policies check", () => {
  /** The checkout on a branch whose working folder changes `files`. */
  function local(
    files: Record<string, string>,
    policies: ApprovalPolicy[] | unknown[] = [POLICIES[0]],
  ) {
    const r = repository();
    sh(r.checkout, "checkout", "-qb", "12");
    for (const [path, text] of Object.entries(files))
      put(r.checkout, path, text);
    const out: string[] = [];
    const err: string[] = [];
    const { d } = setup({ policies }, r);
    return {
      r,
      out,
      err,
      run: (argv: string[] = [], ran?: Ran) =>
        check(
          {
            settings: d.settings,
            git: d.git,
            defaultBranch: async () => "main",
            pull: async () => ({
              body: "Closes #12",
              head: r.head,
              base: "main",
            }),
            tickets: { ...d.tickets, key: (k: string) => k } as never,
            runCommand: ran ? async () => ran : d.runCommand,
            runAgent: d.runAgent,
            out: into(out),
            err: into(err),
          },
          argv,
        ),
    };
  }

  it("prints what the branch would wait for, uncommitted changes included, and exits 0", async () => {
    const l = local({ "package-lock.json": '{"license": "GPL-3.0"}\n' });
    expect(await l.run()).toBe(0);
    expect(l.out).toEqual([
      "approval-policies: 1 applies, for the 1 file changed since origin/main",
      "? licenses: 1 waiting for approval",
      "  package-lock.json  A dependency is GPL-3.0",
    ]);
  });

  it("prints a check that found nothing", async () => {
    const l = local({ "package-lock.json": "{ }\n" });
    await l.run([], {
      status: 0,
      stdout: '{"findings":[]}',
      stderr: "",
      timedOut: false,
    });
    expect(l.out.at(-1)).toBe("✓ licenses: nothing to approve");
  });

  it("says when no policy applies", async () => {
    const l = local({ "README.md": "x\n" });
    expect(await l.run()).toBe(0);
    expect(l.out).toEqual(["- No approval policy applies to this change"]);
  });

  it("names a check that failed, with what it printed, and exits 1", async () => {
    const l = local({ "package-lock.json": "x\n" });
    expect(
      await l.run([], {
        status: 1,
        stdout: "",
        stderr: "TypeError: boom\n    at check.mjs:9:30",
        timedOut: false,
      }),
    ).toBe(1);
    expect(l.err).toEqual([
      "✗ licenses: node check.mjs failed (exit 1). Fix it, then run: factory approval-policies check",
      "  TypeError: boom",
      "      at check.mjs:9:30",
    ]);
  });

  it("hands a check the ticket the branch is named for", async () => {
    const l = local({ "package-lock.json": "x\n" });
    const inputs: Input[] = [];
    await check(
      {
        settings: parseSettings(
          {
            version: 2,
            repository: "acme/widgets",
            "code-host": { "branch-name": "{ticket}" },
            "approval-policies": [POLICIES[0]],
          },
          () => true,
        ),
        git: gitIn(l.r.checkout),
        defaultBranch: async () => "main",
        pull: async () => ({ body: "", head: "", base: "main" }),
        tickets: {
          ...memoryTickets([{ key: "12", body: "Add refunds." }], {
            repository: "acme/widgets",
          }).tickets,
          key: (k: string) => k,
        } as never,
        runCommand: async (_c, input) => {
          inputs.push(input);
          return {
            status: 0,
            stdout: '{"findings":[]}',
            stderr: "",
            timedOut: false,
          };
        },
        runAgent: async () => ({ findings: [] }),
        out: () => {},
        err: () => {},
      },
      [],
    );
    expect(inputs[0]?.ticket).toEqual({ id: "12", text: "Add refunds." });
    expect(inputs[0]?.pull).toBeNull();
  });

  it("checks a past pull request with --pull", async () => {
    const l = local({});
    expect(await l.run(["--pull", "7"])).toBe(0);
    expect(l.out[0]).toBe(
      "approval-policies: 1 applies, for the 2 files #7 changed",
    );
  });
});
