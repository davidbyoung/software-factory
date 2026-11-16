// Dependabot's pull requests merge themselves when they are not majors, but
// never one that updates the factory: it changes the instructions every
// session follows, so its pull request waits for the owner.
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

const NAME = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).name as string;

type Step = { name?: string; if?: string };
const workflow = load(
  readFileSync(
    new URL("../workflows/factory-deps-auto-merge.yml", import.meta.url),
    "utf8",
  ),
) as { jobs: { enable: { steps: Step[] } } };
const enable = workflow.jobs.enable.steps.find(
  (s) => s.name === "Enable auto-merge",
)!;

describe("the dependency auto-merge workflow", () => {
  it("turns auto-merge on only for a bump that is neither a major nor the factory itself", () => {
    expect(enable.if!.trim()).toBe(
      "steps.meta.outputs.update-type != 'version-update:semver-major' && " +
        `!contains(steps.meta.outputs.dependency-names, '${NAME}')`,
    );
  });
});
