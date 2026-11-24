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
import { memoryCodeHost, type PullSeed } from "./memory-code-host.ts";

const NOTICE =
  "so no session ran. Builds in the cloud are off: factory init turns them on.";

const ask = (over: Partial<Ready> = {}) =>
  ready({
    kind: "conflicts",
    byHand: false,
    buildToken: true,
    claude: true,
    work: async () => "2 pull requests conflict",
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
      lines: [`2 pull requests conflict, and no build token is set, ${NOTICE}`],
    });
  });

  it("names the Claude credential when that is the one missing", async () => {
    expect((await ask({ claude: false })).lines).toEqual([
      `2 pull requests conflict, and no Claude credential is set, ${NOTICE}`,
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

describe("foundLine", () => {
  it("says what each check found, in the singular for one", () => {
    expect(foundLine("conflicts", 2)).toBe("2 pull requests conflict");
    expect(foundLine("conflicts", 1)).toBe("1 pull request conflicts");
    expect(foundLine("deps", 3)).toBe("3 Dependabot pull requests are open");
    expect(foundLine("deps", 1)).toBe("1 Dependabot pull request is open");
    expect(foundLine("review", 41)).toBe("A review on #41 waits for an answer");
  });
});

describe("the work a kind's check finds", () => {
  const pull = (number: number, over: Partial<PullSeed> = {}): PullSeed => ({
    number,
    head: {
      branch: `b${number}`,
      sha: `sha${number}`,
      repository: "acme/widgets",
    },
    ...over,
  });
  const found = (kind: "conflicts" | "deps" | "review", seed: PullSeed[]) => {
    const said: string[] = [];
    const work = workOf(kind, memoryCodeHost(seed).codeHost, [], (l) =>
      said.push(l),
    );
    return { work, said };
  };

  it("counts the pull requests that conflict with the default branch", async () => {
    const { work } = found("conflicts", [
      pull(1, { mergeableState: "dirty" }),
      pull(2, { mergeableState: "dirty" }),
      pull(3),
    ]);
    expect(await work()).toBe("2 pull requests conflict");
  });

  it("finds no conflict to sweep where every pull request merges cleanly", async () => {
    expect(await found("conflicts", [pull(1)]).work()).toBeNull();
  });

  it("counts Dependabot's open pull requests, and nobody else's", async () => {
    const { work } = found("deps", [
      pull(1, { author: "dependabot[bot]" }),
      pull(2),
    ]);
    expect(await work()).toBe("1 Dependabot pull request is open");
  });

  it("finds nothing for the dependencies' session with no pull request of Dependabot's", async () => {
    expect(await found("deps", [pull(1)]).work()).toBeNull();
  });

  it("refuses a review's check without the pull request's and the review's numbers", async () => {
    await expect(found("review", []).work()).rejects.toThrow(
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
      err: "Usage: factory session ready build|conflicts|deps|review [PR REVIEW]\n",
      wrote: "",
    });
  });
});
