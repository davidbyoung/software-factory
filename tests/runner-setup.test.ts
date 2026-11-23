// What GitHub Actions, as the runner, has doctor check and remove name:
// the scheduled poller's workflow, and a poller hosted elsewhere.
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

describe("the scheduled poller's workflow, in doctor", () => {
  it("fails when GitHub has switched it off, saying how to switch it on", async () => {
    const c = withTrigger("github-action", {
      "factory.yml": "disabled",
    });

    expect(await setup.checks!(c)).toEqual([
      {
        state: "fail",
        text: "factory.yml is disabled",
        fix: "Enable it on the Actions tab, or run: gh workflow enable factory.yml",
      },
    ]);
  });

  it("is off, not failed, before the workflow reaches the default branch", async () => {
    expect(await setup.checks!(withTrigger("github-action"))).toEqual([
      {
        state: "off",
        text: "factory.yml is not on the default branch yet",
      },
    ]);
  });

  it("passes while it runs", async () => {
    const c = withTrigger("github-action", { "factory.yml": "active" });

    expect(await setup.checks!(c)).toEqual([
      { state: "pass", text: "factory.yml is enabled" },
    ]);
  });

  it.each(["own-server", "manual"])(
    "is not checked with the %s trigger",
    async (trigger) => {
      expect(await setup.checks!(withTrigger(trigger))).toEqual([]);
    },
  );
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
