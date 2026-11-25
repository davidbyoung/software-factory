// What GitHub Actions, as the runner, has doctor check and remove name:
// whether factory.yml is enabled, and a poller hosted elsewhere.
import { describe, expect, it } from "vitest";
import { parseSettings } from "../src/config.mts";
import { TOOLS } from "../src/tools.mts";
import { memoryContext } from "./memory-tools";
import { memoryRunner } from "./memory-runner";
import { FACTORY_COLUMNS } from "./factory-columns";
import { CODE_HOST } from "./settings-fixture";

const setup = TOOLS.runner["github-actions"]!.setup;
const withTrigger = (
  trigger: string,
  workflows: Record<string, "active" | "disabled"> = {},
) => {
  const c = memoryContext(["board", "cloud", "from-board"], {
    settings: parseSettings(
      {
        version: 2,
        repository: "acme/site",
        "code-host": CODE_HOST,
        tickets: { board: 3, columns: FACTORY_COLUMNS },
        builds: { trigger },
      },
      () => true,
    ),
  });
  return {
    ...c,
    opened: { ...c.opened, runner: memoryRunner({ workflows }).runner },
    secrets: [],
  };
};

describe.each(["github-action", "own-server", "manual"])(
  "factory.yml, in doctor, with the %s trigger",
  (trigger) => {
    it("fails when it is disabled, saying how to enable it", async () => {
      const c = withTrigger(trigger, { "factory.yml": "disabled" });

      expect(await setup.checks!(c)).toEqual([
        {
          state: "fail",
          text: "factory.yml is disabled",
          fix: "Enable it on the Actions tab, or run: gh workflow enable factory.yml",
        },
      ]);
    });

    it("is off, not failed, before it reaches the default branch", async () => {
      expect(await setup.checks!(withTrigger(trigger))).toEqual([
        {
          state: "off",
          text: "factory.yml is not on the default branch yet",
        },
      ]);
    });

    it("passes while it is enabled", async () => {
      const c = withTrigger(trigger, { "factory.yml": "active" });

      expect(await setup.checks!(c)).toEqual([
        { state: "pass", text: "factory.yml is enabled" },
      ]);
    });
  },
);

describe("factory.yml, in doctor, when its state cannot be read", () => {
  it("is not known, with the reason in GitHub's words", async () => {
    const c = withTrigger("manual");
    const { runner } = memoryRunner({
      fail: {
        workflowState: new Error(
          "gh api repos/acme/site/actions/workflows/factory.yml: gh: Bad Gateway (HTTP 502)",
        ),
      },
    });

    expect(
      await setup.checks!({ ...c, opened: { ...c.opened, runner } }),
    ).toEqual([
      {
        state: "unknown",
        text: "Could not tell whether factory.yml is enabled: Bad Gateway (HTTP 502)",
      },
    ]);
  });
});

describe("a hosted poller, in remove", () => {
  it("is left by hand with the own-server trigger", () => {
    expect(setup.leftovers!(withTrigger("own-server"))).toEqual([
      "The poller you host",
    ]);
  });

  it.each(["github-action", "manual"])(
    "is not named with the %s trigger",
    (trigger) => {
      expect(setup.leftovers!(withTrigger(trigger))).toEqual([]);
    },
  );
});
