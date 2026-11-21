import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

type Step = {
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  with?: Record<string, unknown>;
};
type Workflow = { jobs: Record<string, { steps?: Step[] }> };

const steps =
  (
    load(
      readFileSync(
        new URL("../.github/workflows/ci.yml", import.meta.url),
        "utf8",
      ),
    ) as Workflow
  ).jobs.check?.steps ?? [];
const coverage = steps.findIndex((s) => s.run === "npm run coverage");
const upload = steps.findIndex((s) =>
  s.uses?.startsWith("codecov/codecov-action@"),
);

describe("ci.yml", () => {
  it("runs the unit tests through the coverage script", () => {
    expect(coverage).toBeGreaterThanOrEqual(0);
    expect(steps.some((s) => s.run === "npm test")).toBe(false);
  });

  it("uploads the coverage report to Codecov after the tests, with the token", () => {
    expect(upload).toBeGreaterThan(coverage);
    expect(steps[upload]?.with).toMatchObject({
      files: "coverage/lcov.info",
      token: "${{ secrets.CODECOV_TOKEN }}",
      fail_ci_if_error: false,
    });
  });

  // Called by release.yml, github.event_name is the caller's, so a test of
  // "workflow_call" would never match and the release run would upload.
  it("uploads only from a pull request or a push", () => {
    expect(steps[upload]?.if).toBe(
      "github.event_name == 'pull_request' || github.event_name == 'push'",
    );
  });
});
