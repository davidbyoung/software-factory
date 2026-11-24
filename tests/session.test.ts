// Whether a cloud session runs: is there work, and are its tokens set. The
// work is asked first, with the workflow's own token, so a repository with
// no build token gets no run that fails for want of one.
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
import { describe, expect, it } from "vitest";
import {
  foundLine,
  ready,
  repositoriesOf,
  workOf,
  type Ready,
} from "../src/session.mts";
import {
  memoryCodeHost,
  REPOSITORY,
  type PullSeed,
} from "./memory-code-host.ts";

const NOTICE =
  "so no session ran. Builds in the cloud are off: factory init turns them on.";

const ask = (over: Partial<Ready> = {}) =>
  ready({
    kind: "conflict",
    byHand: false,
    buildToken: true,
    claude: true,
    work: async () => "#31 conflicts",
    ...over,
  });

describe("ready", () => {
  it("runs the session when there is work and both tokens are set", async () => {
    expect(await ask()).toEqual({ run: true, code: 0, lines: [] });
  });

  it("looks for work before it looks for a token", async () => {
    expect(
      await ask({ buildToken: false, claude: false, work: async () => null }),
    ).toEqual({ run: false, code: 0, lines: ["Nothing to do."] });
  });

  it("passes with a notice when a push, a schedule, or a review found work and no build token is set", async () => {
    expect(await ask({ buildToken: false })).toEqual({
      run: false,
      code: 0,
      lines: [`#31 conflicts, and no build token is set, ${NOTICE}`],
    });
  });

  it("names the Claude credential when that is the one missing", async () => {
    expect((await ask({ claude: false })).lines).toEqual([
      `#31 conflicts, and no Claude credential is set, ${NOTICE}`,
    ]);
  });

  it("fails a run a person or the poller started, with today's message", async () => {
    expect(await ask({ byHand: true, buildToken: false })).toEqual({
      run: false,
      code: 1,
      lines: [
        "::error::No build token: set the secret FACTORY_BUILD_TOKEN, or FACTORY_BOARD_TOKEN.",
      ],
    });
    expect((await ask({ byHand: true, claude: false })).lines).toEqual([
      "::error::No Claude credential: set the secret CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY.",
    ]);
  });

  it("asks a build for no work, since someone asked for it", async () => {
    let asked = false;
    const answer = await ask({
      kind: "build",
      byHand: true,
      work: async () => {
        asked = true;
        return null;
      },
    });
    expect(answer.run).toBe(true);
    expect(asked).toBe(false);
  });
});

describe("a review's run", () => {
  it("needs no build token, since the workflow's own records it", async () => {
    expect(await ask({ kind: "review", buildToken: false })).toMatchObject({
      run: true,
    });
  });
});

describe("the work a run on a pull request is for", () => {
  const review = {
    id: 7,
    author: "acme",
    body: "Why this?",
    submittedAt: "2026-11-09T12:00:00Z",
  };
  const work = (
    kind: "review" | "answer" | "conflict" | "dependency",
    numbers: number[],
    seed: PullSeed[] = [{ number: 41 }],
  ) => {
    const said: string[] = [];
    return {
      said,
      found: workOf(kind, memoryCodeHost(seed).codeHost, numbers, (l) =>
        said.push(l),
      )(),
    };
  };

  it("is nothing for a conflict that was resolved, or stopped on, since it was found", async () => {
    const conflict = (over: Partial<PullSeed>) =>
      work("conflict", [41], [{ number: 41, mergeableState: "dirty", ...over }])
        .found;
    expect(await conflict({})).toBe("#41 conflicts");
    expect(await conflict({ mergeableState: "unknown" })).toBe("#41 conflicts");
    expect(await conflict({ mergeableState: "clean" })).toBeNull();
    const head = { sha: "abc", branch: "b", repository: REPOSITORY };
    const stop = {
      id: 1,
      author: "factory[bot]",
      body: "Why.\n<!-- conflict-stop head=abc -->",
      createdAt: "2026-11-24T09:00:00Z",
    };
    expect(await conflict({ head, comments: [stop] })).toBeNull();
  });

  it.each([
    ["review", "#41 waits for a review"],
    ["answer", "#41 waits for an answer"],
    ["dependency", "#41 is Dependabot's"],
  ] as const)("is named for a %s", async (kind, line) => {
    expect(await work(kind, [41]).found).toBe(line);
    expect(foundLine(kind, 41)).toBe(line);
  });

  it("is a person's review, and nothing when it is not an approver's", async () => {
    const asked = (author: string): PullSeed[] => [
      { number: 41, reviews: [{ ...review, author, comments: [] }] },
    ];
    expect(await work("answer", [41, 7], asked("acme")).found).toBe(
      "#41 waits for an answer",
    );
    const other = work("answer", [41, 7], asked("mallory"));
    expect(await other.found).toBeNull();
    expect(other.said).toEqual([
      "nothing to do: review 7 is not an approver's",
    ]);
  });

  it("is refused without the pull request's number", async () => {
    await expect(work("review", []).found).rejects.toThrow(
      "Usage: factory session ready",
    );
  });
});

describe("the repositories a run's token is for", () => {
  it("names the repository alone when it follows no preset", () => {
    expect(repositoriesOf("acme/web", [])).toBe("web");
  });

  it("adds each preset's repository of the same owner, once, by name", () => {
    expect(
      repositoriesOf("acme/web", [
        "acme/factory-config",
        "acme/factory-config",
        "acme/web",
        "Acme/styles",
      ]),
    ).toBe("web,factory-config,styles");
  });

  it("leaves out a preset in another owner's repository, which the organization's app is not installed on", () => {
    expect(
      repositoriesOf("acme/web", ["contoso/presets", "acme/factory-config"]),
    ).toBe("web,factory-config");
  });
});

const CLI = join(import.meta.dirname, "..", "bin", "factory.js");

// The lock names this checkout's own version, so the launcher runs this
// checkout and downloads nothing.
describe("factory session repositories, as the workflow's step runs it", () => {
  const { version } = JSON.parse(
    readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8"),
  ) as { version: string };
  const PIN = [
    "    commit: 4f1a9c2b7d3e8f6a5b4c3d2e1f0a9b8c7d6e5f4a",
    "    poller: false",
    "    settings: {}",
    "    files: {}",
  ];
  function printed(lock: string | null) {
    const dir = mkdtempSync(join(tmpdir(), "factory-session-"));
    mkdirSync(join(dir, ".git"));
    if (lock !== null) {
      mkdirSync(join(dir, ".claude"));
      writeFileSync(join(dir, ".claude/factory.lock"), lock);
    }
    const r = spawnSync("node", [CLI, "session", "repositories"], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, GITHUB_REPOSITORY: "acme/web" },
    });
    rmSync(dir, { recursive: true, force: true });
    return { code: r.status, out: r.stdout, err: r.stderr };
  }

  it("prints the run's repository and the presets' the lock names, separated by commas", () => {
    expect(
      printed(
        [
          `version: ${version}`,
          "presets:",
          "  - name: acme/factory-config//node",
          ...PIN,
          "  - name: contoso/presets",
          ...PIN,
          "",
        ].join("\n"),
      ),
    ).toEqual({ code: 0, out: "web,factory-config\n", err: "" });
  });

  it("prints the repository alone in a checkout with no lock", () => {
    expect(printed(null)).toEqual({ code: 0, out: "web\n", err: "" });
  });
});

// The command itself, in this repository's checkout: a build's check asks
// the code host nothing, so it runs with no network.
describe("factory session ready, as the workflow's step runs it", () => {
  function step(args: string[], env: Record<string, string>) {
    const dir = mkdtempSync(join(tmpdir(), "factory-session-"));
    const output = join(dir, "output");
    const r = spawnSync("node", [CLI, "session", ...args], {
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_EVENT_NAME: "workflow_dispatch",
        FACTORY_BUILD_TOKEN_SET: "",
        FACTORY_APP_KEY_SET: "",
        FACTORY_CLAUDE_SET: "",
        GITHUB_OUTPUT: output,
        ...env,
      },
    });
    let wrote = "";
    try {
      wrote = readFileSync(output, "utf8");
    } catch {
      // The step wrote no output.
    }
    rmSync(dir, { recursive: true, force: true });
    return { code: r.status, out: r.stdout, err: r.stderr, wrote };
  }

  it("tells the next steps to run when both tokens are set", () => {
    expect(
      step(["ready", "build"], {
        FACTORY_BUILD_TOKEN_SET: "true",
        FACTORY_CLAUDE_SET: "true",
      }),
    ).toMatchObject({ code: 0, wrote: "ran=true\n" });
  });

  it("counts the organization's app's key as the build token", () => {
    expect(
      step(["ready", "build"], {
        FACTORY_APP_KEY_SET: "true",
        FACTORY_CLAUDE_SET: "true",
      }),
    ).toMatchObject({ code: 0, out: "", wrote: "ran=true\n" });
  });

  it("fails a build with no build token, and tells the next steps not to run", () => {
    expect(step(["ready", "build"], { FACTORY_CLAUDE_SET: "true" })).toEqual({
      code: 1,
      out: "::error::No build token: set the secret FACTORY_BUILD_TOKEN, or FACTORY_BOARD_TOKEN.\n",
      err: "",
      wrote: "ran=false\n",
    });
  });

  it("exits 2 with its usage for a kind it does not know", () => {
    expect(step(["ready", "nothing"], {})).toMatchObject({
      code: 2,
      err: "Usage: factory session ready build|review|answer|conflict|dependency ID [REVIEW]\n",
      wrote: "",
    });
  });
});
