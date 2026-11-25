import { describe, expect, it } from "vitest";
import { main, type Deps } from "../src/build.mts";
import { fakeSettings } from "./fake-gh";
import { memoryCodeHost } from "./memory-code-host";
import { memoryRunner, type MemoryRunnerOptions } from "./memory-runner";
import { keyOf } from "../src/tickets/index.mts";
import { memoryTickets } from "./memory-tickets";
import { into } from "./printed";

const STARTED = Date.parse("2026-11-14T22:00:00.400Z");

/** `factory build` against the in-memory code host and runner, on a clock
 * each sleep moves. */
function build(options: MemoryRunnerOptions & { strict?: boolean } = {}) {
  let clock = STARTED;
  const { tickets } = memoryTickets([], { strict: options.strict });
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
    keyOf: () => (typed, repository) =>
      options.strict ? tickets.key(typed) : keyOf("github")(typed, repository),
    refOf: () => (key) => tickets.ref(key),
    out: into(out),
    err: into(err),
  };
  return { d, out, err, slept, picked, host, runner };
}

describe("factory build", () => {
  it("starts a build of the ticket on the default branch, and prints the run that start made", async () => {
    const { d, out, runner } = build();

    expect(await main(["12"], d)).toBe(0);
    expect(runner.builds).toEqual([
      { id: 1, ticket: "12", branch: "trunk", at: STARTED },
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

  it("starts another repository's ticket here, by its full name", async () => {
    const { d, out, runner } = build();

    expect(await main(["acme/api#12"], d)).toBe(0);
    expect(out[0]).toBe("Started a build of acme/api#12 in GitHub Actions:");
    expect(runner.log).toContain("startBuild acme/api#12 trunk");
    expect(runner.log).toContain("findBuild Build acme/api#12");
  });

  it("takes its own ticket's full name as its number", async () => {
    const { d, runner } = build();

    await main(["acme/widgets#12"], d);
    expect(runner.log).toContain("startBuild 12 trunk");
  });

  it("keeps looking until the run appears", async () => {
    const { d, out, runner } = build({ buildShowsAfter: 2 });

    expect(await main(["12"], d)).toBe(0);
    expect(out).toEqual([
      "Started a build of #12 in GitHub Actions:",
      "https://runner.example/runs/1",
    ]);
    expect(
      runner.log.filter((call) => call === "findBuild Build #12"),
    ).toHaveLength(3);
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

  it.each([[[]], [["12", "13"]]])(
    "prints the usage and starts nothing for %j",
    async (argv) => {
      const { d, err, host, runner } = build();

      expect(await main(argv, d)).toBe(2);
      expect(err).toEqual(["Usage: factory build N"]);
      expect([...host.log, ...runner.log]).toEqual([]);
    },
  );

  it.each(["twelve", "0", "PROJ-12"])(
    "says what a key looks like and starts nothing for %s",
    async (typed) => {
      const { d, err, host, runner } = build();

      expect(await main([typed], d)).toBe(1);
      expect(err).toEqual([
        `${typed} is not a ticket here: a GitHub ticket is its number, such as 12`,
      ]);
      expect([...host.log, ...runner.log]).toEqual([]);
    },
  );

  it("starts a build of a ticket with a key, and finds its run by the name the workflow gives it", async () => {
    const { d, out, runner } = build({
      strict: true,
      runName: (key) => `Build ${key}`,
    });

    expect(await main(["PROJ-12"], d)).toBe(0);
    expect(runner.builds).toEqual([
      { id: 1, ticket: "PROJ-12", branch: "trunk", at: STARTED },
    ]);
    expect(runner.log).toContain("findBuild Build PROJ-12");
    expect(out).toEqual([
      "Started a build of PROJ-12 in GitHub Actions:",
      "https://runner.example/runs/1",
    ]);
  });
});
