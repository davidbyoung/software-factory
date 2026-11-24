import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, expect, describe, it } from "vitest";
import type { RunFile } from "../src/handoff/index.mts";
import type { Asked } from "../src/handoff/requests.mts";
import { AGENT_MARK } from "../src/lib/work-status.mts";
import {
  ANSWERS,
  CLOUD_MARK,
  nextAnswer,
  OWNER_MARK,
  publish,
  type PublishDeps,
} from "../src/session-publish.mts";
import { memoryCodeHost, REPOSITORY, type PullSeed } from "./memory-code-host";
import { memoryRunner, type MemoryRunnerOptions } from "./memory-runner";
import { memoryTickets } from "./memory-tickets";

let dir: string;
let work: string;
let base: string;

const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    "git",
    ["-c", "user.name=a", "-c", "user.email=a@example.com", ...args],
    { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();

const write = (path: string, text: string) => {
  mkdirSync(dirname(join(work, path)), { recursive: true });
  writeFileSync(join(work, path), text);
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "publish-"));
  work = join(dir, "work");
  git(dir, "init", "-q", "-b", "trunk", work);
  write(".github/workflows/ci.yml", "v1\n");
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", "first");
  base = git(work, "rev-parse", "HEAD");
  git(dir, "clone", "-q", "--bare", work, join(dir, "origin.git"));
  git(work, "switch", "-q", "-c", "12-add");
  mkdirSync(join(dir, "out"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** What a session that committed `path` leaves, with the new commit. */
const commits = (path = "a.txt", message = "Add a file") => {
  write(path, "x\n");
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", message);
  git(
    work,
    "bundle",
    "create",
    "-q",
    join(dir, "out/build.bundle"),
    `${base}..12-add`,
  );
  return git(work, "rev-parse", "HEAD");
};

const OPEN: Asked = {
  argv: ["pr", "open", "--title", "Add a thing", "--body-file", "p.md"],
  files: { "p.md": "Closes #12\n\nWhat changed." },
};
const asks = (...list: Asked[]) =>
  writeFileSync(
    join(dir, "out/request.json"),
    JSON.stringify({ version: 1, commands: list }),
  );
const say = (argv: string[], text: string): Asked => ({
  argv: [...argv, "--body-file", "b.md"],
  files: { "b.md": text },
});

function world(
  over: Partial<RunFile> = {},
  o: {
    pulls?: PullSeed[];
    runner?: MemoryRunnerOptions;
    claimed?: boolean;
    ci?: string;
  } = {},
) {
  const run: RunFile = {
    version: 1,
    kind: "build",
    repository: REPOSITORY,
    remote: "https://github.com/acme/widgets.git",
    defaultBranch: "trunk",
    base,
    branch: "12-add",
    ticket: "12",
    ref: "#12",
    pull: null,
    round: 0,
    claim: "IC_1",
    committer: { name: "factory[bot]", email: "1+factory[bot]@example.com" },
    ...over,
  };
  const host = memoryCodeHost(o.pulls ?? [], { defaultBranch: "trunk" });
  const runner = memoryRunner(o.runner);
  const tickets = memoryTickets([{ key: "12" }, { key: "13" }]);
  let at = 0;
  const out: string[] = [];
  const pushed: string[] = [];
  const asked: { argv: string[]; text?: string }[] = [];
  const d: PublishDeps = {
    run,
    dir,
    codeHost: host.codeHost,
    runner: runner.runner,
    tickets: tickets.tickets,
    async ticket(argv, readFile) {
      const file = argv[argv.indexOf("--body-file") + 1];
      asked.push({
        argv,
        ...(argv.includes("--body-file") ? { text: readFile(file) } : {}),
      });
      return 0;
    },
    pr: {
      repository: REPOSITORY,
      codeHost: host.codeHost,
      runner: runner.runner,
      sleep: async () => {},
      out: () => {},
      readFile: () => "",
      git: () => "",
      remote: async () => "origin",
    },
    session: "success",
    reviewRounds: 2,
    now: () => (at += 60_000),
    sleep: async () => {},
    clone: () => join(dir, "origin.git"),
    push(clone, commit, branch) {
      git(clone, "update-ref", `refs/heads/${branch}`, commit);
      pushed.push(`${branch} ${commit}`);
    },
    claimed: async () => o.claimed ?? true,
    messages: (clone, tip) =>
      git(clone, "log", "--format=%B%x00", `${base}..${tip}`).split("\0"),
    signIn: async () => {},
    out: (line) => out.push(line),
  };
  return { d, out, pushed, asked, host, runner, tickets };
}

describe("a build", () => {
  it("is pushed and opened as a draft into the default branch", async () => {
    const tip = commits();
    asks(OPEN);
    const w = world();

    await publish(w.d);

    expect(w.pushed).toEqual([`12-add ${tip}`]);
    const [pull] = await w.host.codeHost.listOpen();
    expect(pull).toMatchObject({
      title: "Add a thing",
      head: { branch: "12-add" },
      base: { branch: "trunk" },
    });
  });

  it("publishes nothing once its claim has ended", async () => {
    commits();
    asks(OPEN);
    const w = world({}, { claimed: false });

    expect(await publish(w.d)).toBe(1);
    expect(w.pushed).toEqual([]);
    expect(await w.host.codeHost.listOpen()).toEqual([]);
  });

  it("is not pushed when it changes a workflow, and the ticket is told", async () => {
    commits(".github/workflows/evil.yml");
    asks(OPEN);
    const w = world();

    expect(await publish(w.d)).toBe(1);

    expect(w.pushed).toEqual([]);
    const [comment] = (await w.tickets.tickets.read("12")).comments;
    expect(comment.body).toMatch(
      /^Not pushed: commit [0-9a-f]{7} changes \.github\/workflows\/evil\.yml, which a build in the cloud can't push\.\nBuild this ticket on your computer: tell a session to work it\./,
    );
  });

  it("tells the ticket when the code host refuses the push", async () => {
    commits();
    asks(OPEN);
    const w = world();
    w.d.push = () => {
      throw new Error("the branch moved on");
    };

    expect(await publish(w.d)).toBe(1);
    expect((await w.tickets.tickets.read("12")).comments[0].body).toContain(
      "Not pushed: the code host refused it: the branch moved on.",
    );
    expect(await w.host.codeHost.listOpen()).toEqual([]);
  });

  it("is not pushed when a commit's message closes another ticket", async () => {
    commits("a.txt", "Add a file\n\nCloses #13");
    asks(OPEN);
    const w = world();

    expect(await publish(w.d)).toBe(1);
    expect(w.pushed).toEqual([]);
  });

  it("is not pushed when its pull request would close another ticket", async () => {
    commits();
    asks({ ...OPEN, files: { "p.md": "Closes #13" } });
    const w = world();

    expect(await publish(w.d)).toBe(1);
    expect(w.pushed).toEqual([]);
    expect((await w.tickets.tickets.read("12")).comments[0].body).toContain(
      "Not pushed: the pull request's body links #13, which is not this run's.",
    );
    expect(await w.host.codeHost.listOpen()).toEqual([]);
  });
});

describe("what a session asks for", () => {
  it("is done on the run's ticket, marked as an agent's, with its markers gone", async () => {
    asks(
      say(["ticket", "comment", "12"], "Done. <!-- work-status: merged -->"),
    );
    const w = world();

    await publish(w.d);

    expect(w.asked).toEqual([
      {
        argv: ["comment", "12", "--body-file", "asked-0.md"],
        text: expect.stringContaining(AGENT_MARK),
      },
    ]);
    expect(w.asked[0].text).not.toContain("work-status");
  });

  it("is not done on another ticket, and the run says so", async () => {
    asks(say(["ticket", "comment", "13"], "Hello."));
    const w = world();

    await publish(w.d);

    expect(w.asked).toEqual([]);
    expect(w.out.join("\n")).toContain("Refused: factory ticket comment 13");
  });

  it("is refused whole when its file is not one this version reads", async () => {
    writeFileSync(
      join(dir, "out/request.json"),
      '{"version":1,"commands":[],"merge":true}',
    );
    const w = world();

    await publish(w.d);

    expect(w.out.join("\n")).toContain("Refused every request");
  });
});

describe("the next answer", () => {
  const seed = (): PullSeed => ({
    number: 31,
    isDraft: true,
    body: CLOUD_MARK,
    createdAt: "2026-11-01T00:00:00Z",
  });
  const draftAt = (sha: string): PullSeed[] => [
    { ...seed(), head: { sha, branch: "12-add", repository: REPOSITORY } },
  ];
  const red = (tip: string): MemoryRunnerOptions => ({
    runs: {
      [tip]: [
        {
          id: 1,
          jobs: 1,
          event: "pull_request",
          status: "completed",
          conclusion: "failure",
          checksId: 7,
        },
      ],
    },
  });

  it("starts when CI fails on what was pushed", async () => {
    const tip = commits();
    const w = world(
      { kind: "answer", pull: 31 },
      { pulls: draftAt(tip), runner: red(tip) },
    );

    await publish(w.d);

    expect(await w.runner.runner.answersTo(31, "")).toBe(1);
    expect(w.host.pull(31).isDraft).toBe(true);
  });

  it("does not start past the limit, and the pull request is told", async () => {
    const tip = commits();
    const w = world(
      { kind: "answer", pull: 31 },
      {
        pulls: draftAt(tip),
        runner: { ...red(tip), answers: { 31: ANSWERS } },
      },
    );

    await publish(w.d);

    expect(await w.runner.runner.answersTo(31, "")).toBe(ANSWERS);
    const comments = await w.host.codeHost.comments(31);
    expect(comments.at(-1)!.body).toContain(
      "This waits for a person: it has had 4 answers.",
    );
  });

  it("is not started, and the draft is marked ready, when CI passes", async () => {
    const tip = commits();
    const green = red(tip);
    green.runs![tip][0].conclusion = "success";
    const w = world(
      { kind: "answer", pull: 31 },
      { pulls: draftAt(tip), runner: green },
    );

    await publish(w.d);

    expect(w.host.pull(31).isDraft).toBe(false);
    expect(await w.runner.runner.answersTo(31, "")).toBe(0);
  });

  const waiting = (tip: string): MemoryRunnerOptions => ({
    runs: {
      [tip]: [
        { ...red(tip).runs![tip][0], status: "in_progress", conclusion: null },
      ],
    },
  });

  it("is not started while CI runs, and the pull request is told after an hour", async () => {
    const tip = commits();
    const w = world(
      { kind: "answer", pull: 31 },
      { pulls: draftAt(tip), runner: waiting(tip) },
    );

    await publish(w.d);

    expect(await w.runner.runner.answersTo(31, "")).toBe(0);
    expect(w.host.pull(31).isDraft).toBe(true);
    expect((await w.host.codeHost.comments(31)).at(-1)!.body).toContain(
      "CI has not finished after an hour",
    );
  });

  it("does not mark ready a pull request someone pushed to since", async () => {
    const tip = commits();
    const green = red(tip);
    green.runs![tip][0].conclusion = "success";
    const w = world(
      { kind: "answer", pull: 31 },
      { pulls: draftAt("f".repeat(40)), runner: green },
    );

    await publish(w.d);

    expect(w.host.pull(31).isDraft).toBe(true);
  });

  const asked = (n: number, author = "github-actions[bot]"): PullSeed[] => [
    {
      ...seed(),
      comments: Array.from({ length: n }, (_, i) => ({
        id: i + 1,
        author,
        body: "<!-- review-verdict: changes -->",
        createdAt: "2026-11-02T00:00:00Z",
      })),
    },
  ];
  const answers = async (pulls: PullSeed[]) => {
    const w = world({ kind: "review", pull: 31 }, { pulls });
    await nextAnswer(w.d, 31);
    return w.runner.runner.answersTo(31, "");
  };

  it("follows two reviews that asked for changes, and not a third", async () => {
    expect(await answers(asked(2))).toBe(1);
    expect(await answers(asked(3))).toBe(0);
  });

  it("is not held back by a summary the review did not post", async () => {
    expect(await answers(asked(3, "mallory"))).toBe(1);
  });

  it("does not start on a pull request no build in the cloud opened", async () => {
    expect(await answers([{ ...seed(), body: "A person's." }])).toBe(0);
  });
});

describe("a pull request whose CI passed", () => {
  const passed = () => {
    const tip = commits();
    return {
      pulls: [
        {
          number: 31,
          isDraft: true,
          body: `${CLOUD_MARK}\n${OWNER_MARK}`,
          head: { sha: tip, branch: "12-add", repository: REPOSITORY },
        },
      ],
      runner: {
        runs: {
          [tip]: [
            {
              id: 1,
              jobs: 1,
              event: "pull_request",
              status: "completed",
              conclusion: "success",
              checksId: 7,
            },
          ],
        },
      },
    };
  };

  it("stays a draft when the session left it to its owner", async () => {
    const w = world({ kind: "answer", pull: 31 }, passed());
    await publish(w.d);
    expect(w.host.pull(31).isDraft).toBe(true);
    expect(w.out).toContain("It stays a draft for its owner to mark ready.");
  });
});

describe("a pull request its session leaves to the owner", () => {
  it.each([
    [["--draft"], true],
    [[], false],
  ])("opened with %j is marked so: %s", async (flags, marked) => {
    commits();
    asks({ ...OPEN, argv: [...OPEN.argv, ...flags] });
    const w = world();
    await publish(w.d);
    const [pull] = await w.host.codeHost.listOpen();
    expect(pull.body.includes(OWNER_MARK)).toBe(marked);
  });
});

describe("a session that did not finish", () => {
  it("is told to the pull request it was for, so it does not wait unseen", async () => {
    const w = world({ kind: "answer", pull: 31 }, { pulls: [{ number: 31 }] });
    w.d.session = "failure";
    await publish(w.d);
    expect((await w.host.codeHost.comments(31))[0].body).toContain(
      "The session did not finish, and nothing of its was pushed.",
    );
  });

  it("says nothing of one that finished with nothing to push", async () => {
    const w = world({ kind: "answer", pull: 31 }, { pulls: [{ number: 31 }] });
    await publish(w.d);
    expect(await w.host.codeHost.comments(31)).toEqual([]);
  });
});

describe("what a session cost", () => {
  const spent = (cost: unknown) =>
    writeFileSync(join(dir, "out/cost.json"), JSON.stringify(cost));
  const comments = async () => {
    const w = world({ kind: "answer", pull: 31 }, { pulls: [{ number: 31 }] });
    await publish(w.d);
    return (await w.host.codeHost.comments(31)).map((c) => c.body);
  };

  it("is noted on its pull request, for the board to add up", async () => {
    spent({ dollars: 1.234, session: "abc-1" });
    expect((await comments()).join()).toContain(
      "<!-- cost: 1.23 session=abc-1 -->",
    );
  });

  it.each([
    [{ dollars: "1", session: "abc" }],
    [{ dollars: 1, session: "a --> <!-- cost: 9" }],
  ])("is not noted when it reads %j", async (cost) => {
    spent(cost);
    expect(await comments()).toEqual([]);
  });
});

describe("the pull request a build opens", () => {
  it("is marked as a cloud build's, whatever the session wrote", async () => {
    commits();
    asks({
      ...OPEN,
      files: {
        "p.md": `Closes #12\n\n${CLOUD_MARK.replace("cloud", "other")} Done.`,
      },
    });
    const w = world();

    await publish(w.d);

    const [pull] = await w.host.codeHost.listOpen();
    expect(pull.body.match(/<!--/g)).toHaveLength(1);
    expect(pull.body).toContain(CLOUD_MARK);
  });
});
