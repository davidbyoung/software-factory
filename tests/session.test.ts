// Whether a cloud session runs: is there work, and are its tokens set. The
// work is asked first, with the workflow's own token, so a repository with
// no build token gets no run that fails for want of one.
import { describe, expect, it } from "vitest";
import { foundLine, ready, workOf, type Ready } from "../src/session.mts";
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
