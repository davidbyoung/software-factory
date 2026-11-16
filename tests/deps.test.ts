import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatBump,
  isMajor,
  main,
  nextStep,
  type Bump,
} from "../src/deps.mts";
import { memoryCodeHost, type PullSeed } from "./memory-code-host";

const bump = (over: Partial<Bump> = {}): Bump => ({
  number: 5,
  title: "Bump jsdom from 30.1.3 to 31.0.0",
  head: "dependabot/npm_and_yarn/jsdom-31.0.0",
  sha: "abcdef1234",
  major: true,
  mergeableState: "clean",
  autoMerge: false,
  checks: [
    {
      id: 1,
      name: "Unit tests",
      status: "completed",
      conclusion: "success",
    },
    {
      id: 2,
      name: "Browser tests",
      status: "completed",
      conclusion: "skipped",
    },
  ],
  shepherdComments: 0,
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe("isMajor", () => {
  it.each([
    ["Bump jsdom from 30.1.3 to 31.0.0", true],
    ["Bump actions/checkout from v6 to v7", true],
    ["Bump vitest from 5.0.5 to 5.1.0", false],
    ["Bump the npm group with 12 updates", false],
  ])("%s", (title, major) => {
    expect(isMajor(title)).toBe(major);
  });
});

describe("nextStep", () => {
  it("leaves a bump whose checks are running or whose state is unknown", () => {
    const running = bump({
      checks: [{ id: 1, name: "E2E", status: "in_progress", conclusion: null }],
    });

    expect(nextStep(running)).toBe("leave: checks still running");
    expect(nextStep(bump({ mergeableState: "unknown" }))).toMatch(/^leave/);
  });

  it("lists the merge, the fix, and the migration in step order", () => {
    const failing = bump({
      mergeableState: "dirty",
      checks: [
        { id: 1, name: "E2E", status: "completed", conclusion: "failure" },
      ],
    });

    expect(nextStep(failing)).toBe(
      "merge main (step 2); fix E2E (step 3); migrate (step 4)",
    );
  });

  it("stops after two earlier fixes that left CI red", () => {
    const failing = bump({
      shepherdComments: 2,
      checks: [
        { id: 1, name: "E2E", status: "completed", conclusion: "failure" },
      ],
    });

    expect(nextStep(failing)).toMatch(/^stop/);
  });

  it("waits on its merge when green and minor", () => {
    expect(nextStep(bump({ major: false }))).toBe(
      "nothing: waits on its merge",
    );
  });
});

describe("formatBump", () => {
  const check = (
    id: number,
    name: string,
    status: string,
    conclusion: string | null,
  ) => ({ id, name, status, conclusion });

  it("prints checks: passed when each check's newest run passed or was skipped", () => {
    const rerun = bump({
      checks: [
        check(3, "Browser tests", "completed", "skipped"),
        check(2, "Browser tests", "completed", "failure"),
        check(1, "Unit tests", "completed", "success"),
        check(4, "Lint", "completed", "neutral"),
      ],
    });

    expect(formatBump(rerun)[2]).toBe("  checks: passed");
  });

  it("names the checks that failed and those still running", () => {
    const mixed = bump({
      checks: [
        check(1, "Unit tests", "completed", "failure"),
        check(2, "Browser tests", "in_progress", null),
        check(3, "Lint", "completed", "success"),
        check(4, "Types", "completed", "timed_out"),
      ],
    });

    expect(formatBump(mixed)[2]).toBe(
      "  checks: failed Unit tests, Types; running Browser tests",
    );
  });

  it("says when no check has started", () => {
    expect(formatBump(bump({ checks: [] }))[2]).toBe("  checks: none started");
  });
});

describe("main", () => {
  const dependabots = (
    number: number,
    at: string,
    over: Partial<PullSeed> = {},
  ): PullSeed => ({
    title: "Bump a from 1.0.0 to 1.0.1",
    author: "dependabot[bot]",
    createdAt: at,
    ...over,
    number,
  });

  it("lists only Dependabot's, oldest first, reading each one it lists", async () => {
    const host = memoryCodeHost([
      dependabots(9, "2026-11-02"),
      dependabots(8, "2026-11-01"),
      dependabots(7, "2026-10-01", { author: "acme" }),
    ]);
    const out: string[] = [];

    await main(host.codeHost, (l) => out.push(l));

    expect(out.filter((l) => l.startsWith("#"))).toEqual([
      "#8 Bump a from 1.0.0 to 1.0.1",
      "#9 Bump a from 1.0.0 to 1.0.1",
    ]);
    expect(host.log.filter((call) => call.startsWith("get "))).toEqual([
      "get 8",
      "get 9",
    ]);
  });

  it("reads a bump's branch, commit, mergeable state, auto-merge, checks, and earlier fixes from the code host", async () => {
    const shepherd = (id: number) => ({
      id,
      author: "acme",
      body: "Fixed the lockfile.\n\n<!-- factory-deps -->",
      createdAt: "2026-11-03T00:00:00Z",
    });
    const host = memoryCodeHost(
      [
        dependabots(8, "2026-11-01", {
          title: "Bump jsdom from 30.1.3 to 31.0.0",
          head: {
            sha: "abcdef1234",
            branch: "dependabot/jsdom",
            repository: null,
          },
          mergeableState: "dirty",
          autoMerge: true,
          comments: [shepherd(1), { ...shepherd(2), body: "Thanks." }],
        }),
      ],
      {
        commits: {
          abcdef1234: {
            checkRuns: [
              {
                id: 1,
                name: "E2E",
                status: "completed",
                conclusion: "failure",
              },
            ],
          },
        },
      },
    );
    const out: string[] = [];

    expect(await main(host.codeHost, (l) => out.push(l))).toBe(0);
    expect(out).toEqual([
      "#8 Bump jsdom from 30.1.3 to 31.0.0",
      "  major; head dependabot/jsdom at abcdef1; mergeable dirty; auto-merge on",
      "  checks: failed E2E",
      "  earlier shepherd comments: 1",
      "  next: merge main (step 2); fix E2E (step 3); migrate (step 4)",
    ]);
  });

  describe("--any", () => {
    const run = async (list: PullSeed[]) => {
      const host = memoryCodeHost(list);
      const out: string[] = [];
      const code = await main(host.codeHost, (l) => out.push(l), ["--any"]);
      return { code, out, log: host.log };
    };

    it("exits 0 with a dependency pull request open, reading nothing more", async () => {
      const { code, log } = await run([dependabots(8, "2026-11-01")]);
      expect(code).toBe(0);
      expect(log).toEqual(["listOpen"]);
    });

    it("exits 2, with the error, when the list cannot be read", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const host = memoryCodeHost([], {
        fail: { listOpen: new Error("HTTP 401") },
      });
      const code = await main(host.codeHost, () => {}, ["--any"]);
      expect(code).toBe(2);
      expect(error).toHaveBeenCalledWith("HTTP 401");
      error.mockRestore();
    });

    it("exits 1 with none open", async () => {
      const { code } = await run([{ number: 8, author: "someone" }]);
      expect(code).toBe(1);
    });
  });

  it("exits nonzero when the list cannot be read", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const host = memoryCodeHost([], {
      fail: { listOpen: new Error("HTTP 401") },
    });

    expect(await main(host.codeHost, () => {})).toBe(1);
    expect(error).toHaveBeenCalledWith("HTTP 401");
  });
});
