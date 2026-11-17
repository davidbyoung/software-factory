// The scheduled poller's workflow: one pass of the poller on a schedule,
// one run at a time, reading the board with the board's token.
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";
import { POLL_MINUTES } from "../src/config.mts";
import { withSchedule } from "../src/sync.mts";

type Step = { uses?: string; run?: string; env?: Record<string, string> };
const text = readFileSync(
  new URL("../workflows/factory-poller.yml", import.meta.url),
  "utf8",
);
const workflow = load(text) as {
  on: { schedule?: { cron: string }[]; workflow_dispatch?: unknown };
  concurrency: { group: string; "cancel-in-progress": boolean };
  permissions: Record<string, string>;
  jobs: Record<string, { steps: Step[] }>;
};
const steps = Object.values(workflow.jobs)[0]!.steps;

describe("the scheduled poller's workflow", () => {
  it.each(POLL_MINUTES.map((m) => [m]))(
    "takes the schedule sync writes for every %i minutes",
    (minutes) => {
      const written = load(
        withSchedule(text, minutes, "factory-poller.yml"),
      ) as {
        on: { schedule: { cron: string }[] };
      };

      expect(written.on.schedule).toEqual([
        { cron: minutes === 60 ? "0 * * * *" : `*/${minutes} * * * *` },
      ]);
    },
  );

  it("runs on one schedule, every five minutes as the package ships it, and by hand", () => {
    expect(workflow.on.schedule).toEqual([{ cron: "*/5 * * * *" }]);
    expect("workflow_dispatch" in workflow.on).toBe(true);
  });

  it("runs one pass at a time, never cancelling a pass that has started", () => {
    expect(workflow.concurrency).toEqual({
      group: "factory-poller",
      "cancel-in-progress": false,
    });
  });

  it("runs one pass of the poller with the board's token, and only reads the repository", () => {
    const pass = steps.find((s) => s.run?.includes("factory poller --once"));

    expect(pass?.run).toBe("npx --no-install factory poller --once");
    expect(pass?.env).toEqual({
      FACTORY_BOARD_TOKEN: "${{ secrets.FACTORY_BOARD_TOKEN }}",
    });
    expect(workflow.permissions).toEqual({ contents: "read" });
  });

  it("installs the repository's own copy of the factory first", () => {
    const runs = steps.map((s) => s.run ?? s.uses ?? "");
    const install = runs.findIndex((r) => r.startsWith("npm ci"));

    expect(install).toBeGreaterThan(-1);
    expect(install).toBeLessThan(
      runs.findIndex((r) => r.includes("poller --once")),
    );
  });
});
