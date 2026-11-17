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

/** Whether the condition's `contains` holds back an update of these
 * dependencies, matching as GitHub's `contains` does: a substring, in any
 * case. */
const holdsBack = (names: string) => {
  const held =
    /!contains\(steps\.meta\.outputs\.dependency-names, '([^']+)'\)/.exec(
      enable.if!,
    )![1]!;
  return names.toLowerCase().includes(held.toLowerCase());
};

describe("the dependency auto-merge workflow", () => {
  it("turns auto-merge on only for a bump that is not a major", () => {
    expect(enable.if!).toContain(
      "steps.meta.outputs.update-type != 'version-update:semver-major'",
    );
  });

  it.each([
    NAME,
    `${NAME}, typescript`,
    "ghcr.io/davidbyoung/software-factory-poller",
    "davidbyoung/software-factory-poller",
  ])(
    "holds back an update of the factory or its poller's image: %s",
    (names) => {
      expect(holdsBack(names)).toBe(true);
    },
  );

  it("lets any other dependency through", () => {
    expect(holdsBack("typescript, @types/node, node")).toBe(false);
  });
});
