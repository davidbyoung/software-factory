import { describe, expect, it } from "vitest";
import { main, type Deps } from "../src/build.mts";
import { fakeSettings } from "./fake-gh";
import { memoryCodeHost } from "./memory-code-host";
import { memoryRunner, type MemoryRunnerOptions } from "./memory-runner";

const STARTED = Date.parse("2026-11-14T22:00:00.400Z");

/** `factory build` against the in-memory code host and runner, on a clock
 * each sleep moves. */
function build(options: MemoryRunnerOptions = {}) {
  let clock = STARTED;
  const host = memoryCodeHost([], { defaultBranch: "trunk" });
  const runner = memoryRunner({ now: () => clock, ...options });
  const out: string[] = [];
  const err: string[] = [];
  const slept: number[] = [];
  const picked: string[][] = [];
  const d: Deps = {
    settings: fakeSettings,
    env: {},
    codeHost: (repository, type) => {
      picked.push(["code host", repository, type]);
      return host.codeHost;
    },
    runner: (repository, name) => {
      picked.push(["runner", repository, name]);
      return runner.runner;
    },
    now: () => new Date(clock),
    sleep: async (ms) => {
      slept.push(ms);
      clock += ms;
    },
    out: (line) => out.push(line),
    err: (line) => err.push(line),
  };
  return { d, out, err, slept, picked, host, runner };
}

describe("factory build", () => {
  it("starts a build of the ticket on the default branch, and prints the run that start made", async () => {
    const { d, out, runner } = build();

    expect(await main(["12"], d)).toBe(0);
    expect(runner.builds).toEqual([
      { id: 1, ticket: 12, branch: "trunk", at: STARTED },
    ]);
    expect(out).toEqual([
      "Started a build of #12 in GitHub Actions:",
      "https://runner.example/runs/1",
    ]);
  });

  it("asks for the code host and the runner the settings name, for the settings' repository", async () => {
    const { d, picked } = build();

    await main(["12"], d);

    expect(picked.sort()).toEqual([
      ["code host", "acme/widgets", "github"],
      ["runner", "acme/widgets", "github-actions"],
    ]);
  });

  it("keeps looking until the run appears", async () => {
    const { d, out, runner } = build({ buildShowsAfter: 2 });

    expect(await main(["12"], d)).toBe(0);
    expect(out).toEqual([
      "Started a build of #12 in GitHub Actions:",
      "https://runner.example/runs/1",
    ]);
    expect(runner.log.filter((call) => call === "findBuild 12")).toHaveLength(
      3,
    );
  });

  it("prints the page that lists builds when no run has appeared after 15 seconds", async () => {
    const { d, out, slept } = build({ buildShowsAfter: Infinity });

    expect(await main(["12"], d)).toBe(0);
    expect(out).toEqual([
      "Started a build of #12 in GitHub Actions:",
      "https://runner.example/builds",
    ]);
    expect(slept.reduce((a, b) => a + b, 0)).toBe(15_000);
  });

  it("exits non-zero with the runner's error and prints no link when the start is refused", async () => {
    const { d, out, err } = build({
      fail: {
        startBuild: new Error(
          "Workflow does not have 'workflow_dispatch' trigger (HTTP 422)",
        ),
      },
    });

    expect(await main(["12"], d)).toBe(1);
    expect(out).toEqual([]);
    expect(err.join("\n")).toContain("HTTP 422");
  });

  it.each([[[]], [["twelve"]], [["0"]]])(
    "prints the usage and starts nothing for %j",
    async (argv) => {
      const { d, err, host, runner } = build();

      expect(await main(argv, d)).toBe(2);
      expect(err).toEqual(["Usage: factory build N"]);
      expect([...host.log, ...runner.log]).toEqual([]);
    },
  );
});
