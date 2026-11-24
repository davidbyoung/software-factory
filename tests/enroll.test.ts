// What the first run on the default branch does so that "Review verdict"
// is required there: under the organization's app it sets the repository's
// property, and with a person's build token it makes the repository's rule.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { enroll, holds, type Enroll } from "../src/enroll.mts";
import { writeSettings } from "./locked.ts";
import { CODE_HOST_YAML } from "./settings-fixture.ts";
import {
  memoryCodeHost,
  type MemoryCodeHostOptions,
} from "./memory-code-host.ts";

const NOT_REQUIRED =
  '? "Review verdict" is not required before a merge to main, and this run\'s token cannot require it. An admin of acme/web runs: factory init';
const WRITES = ["setProperty", "requireCheck"];

/** A repository as the code host has it, and the command's lines once
 * `lines` runs it there. */
function run(
  as: Enroll["as"],
  options: MemoryCodeHostOptions = {},
  over: Partial<Enroll> = {},
) {
  const host = memoryCodeHost([], options);
  const lines = () =>
    enroll({
      repository: "acme/web",
      branch: "main",
      reviewOn: true,
      as,
      codeHost: host.codeHost,
      ...over,
    });
  const wrote = () =>
    host.log.filter((call) => WRITES.some((name) => call.startsWith(name)));
  return { lines, host, wrote };
}

describe("under the organization's app", () => {
  const RULE = [
    { check: "Review verdict", property: "software-factory", value: "on" },
  ];

  it.each<[string, string | null]>([
    ["off", "off"],
    ["not set", null],
  ])(
    "turns the property on for a repository where it is %s, and says what that does",
    async (_, value) => {
      const { lines, host } = run("app", {
        properties: { "software-factory": value },
        ownerRules: RULE,
      });

      expect(await lines()).toEqual([
        '✓ Set software-factory to "on" for acme/web, so acme\'s rule requires "Review verdict" here.',
      ]);
      expect(host.settings.properties["software-factory"]).toBe("on");
      expect(await host.codeHost.requiresStatus("main", "Review verdict")).toBe(
        true,
      );
    },
  );

  it("prints nothing, and sets nothing, where the property is already on", async () => {
    const { lines, wrote } = run("app", {
      properties: { "software-factory": "on" },
      ownerRules: RULE,
    });

    expect(await lines()).toEqual([]);
    expect(wrote()).toEqual([]);
  });

  it("says an admin runs init where the organization has no such property", async () => {
    const { lines, wrote } = run("app", { properties: { team: "web" } });

    expect(await lines()).toEqual([NOT_REQUIRED]);
    expect(wrote()).toEqual([]);
  });

  it("prints nothing where there is no such property and the repository's own rule already requires the verdict", async () => {
    const { lines, host, wrote } = run("app");
    await host.codeHost.requireCheck("Software factory", "Review verdict");
    host.log.length = 0;

    expect(await lines()).toEqual([]);
    expect(wrote()).toEqual([]);
  });

  it("gives the code host's reason, and who sets it by hand, when the value is refused", async () => {
    const { lines, host } = run("app", {
      properties: { "software-factory": "off" },
      propertyRefused: "403 Resource not accessible by integration",
    });

    expect(await lines()).toEqual([
      '? Could not set software-factory to "on" for acme/web: 403 Resource not accessible by integration. An owner of acme sets it under the organization\'s Settings, Custom properties.',
    ]);
    expect(host.settings.properties["software-factory"]).toBe("off");
  });

  it("takes a property it cannot read for one the organization does not have", async () => {
    const { lines } = run("app", {
      fail: { properties: new Error("404 Not Found") },
    });

    expect(await lines()).toEqual([NOT_REQUIRED]);
  });
});

describe("with a person's build token", () => {
  it("makes the rule init makes, from the runner's own account, where the default branch has none", async () => {
    const { lines, host } = run("person");

    expect(await lines()).toEqual([
      '✓ Required "Review verdict" before a merge to main, as the rule "Software factory".',
    ]);
    expect(host.settings.rules).toEqual([
      { name: "Software factory", check: "Review verdict", source: "runner" },
    ]);
  });

  it("prints nothing, and makes nothing, where the verdict is already required", async () => {
    const { lines, host, wrote } = run("person");
    await host.codeHost.requireCheck("Mine", "Review verdict");
    host.log.length = 0;

    expect(await lines()).toEqual([]);
    expect(wrote()).toEqual([]);
  });

  it("says an admin runs init when the code host refuses the rule", async () => {
    const { lines, host } = run("person", {
      rulesRefused: "403 Upgrade to GitHub Pro",
    });

    expect(await lines()).toEqual([NOT_REQUIRED]);
    expect(host.settings.rules).toEqual([]);
  });

  it("names the default branch as the repository has it", async () => {
    const { lines } = run(
      "person",
      { defaultBranch: "trunk" },
      { branch: "trunk", repository: "sam/api" },
    );

    expect(await lines()).toEqual([
      '✓ Required "Review verdict" before a merge to trunk, as the rule "Software factory".',
    ]);
  });
});

describe("with no token of either kind", () => {
  it("says an admin of the repository runs init, and changes nothing", async () => {
    const { lines, wrote } = run(
      null,
      { properties: { "software-factory": "off" } },
      { repository: "sam/api" },
    );

    expect(await lines()).toEqual([
      '? "Review verdict" is not required before a merge to main, and this run\'s token cannot require it. An admin of sam/api runs: factory init',
    ]);
    expect(wrote()).toEqual([]);
  });

  it("prints nothing where the verdict is already required", async () => {
    const { lines, host } = run(null);
    await host.codeHost.requireCheck("Software factory", "Review verdict");

    expect(await lines()).toEqual([]);
  });
});

describe("with the review off", () => {
  it.each<[Enroll["as"]]>([["app"], ["person"], [null]])(
    "does nothing, and asks the code host nothing, holding %s",
    async (as) => {
      const { lines, host } = run(
        as,
        { properties: { "software-factory": "off" } },
        { reviewOn: false },
      );

      expect(await lines()).toEqual([]);
      expect(host.log).toEqual([]);
    },
  );
});

// The command itself, in a repository whose settings leave the review off:
// it stops before it asks the code host anything, so it runs with no
// network. FACTORY_VERSION keeps the launcher on this checkout.
describe("factory enroll, as the workflow's step runs it", () => {
  const ROOT = join(import.meta.dirname, "..");
  const { version } = JSON.parse(
    readFileSync(join(ROOT, "package.json"), "utf8"),
  ) as { version: string };

  it("prints nothing and passes where pr-review is not set", () => {
    const dir = mkdtempSync(join(tmpdir(), "factory-enroll-"));
    mkdirSync(join(dir, ".git"));
    writeSettings(
      dir,
      `version: 2\nrepository: sam/api\ntickets:\n  type: github\n${CODE_HOST_YAML}\n`,
    );
    const r = spawnSync("node", [join(ROOT, "bin/factory.js"), "enroll"], {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...process.env,
        FACTORY_VERSION: version,
        FACTORY_BUILD_TOKEN_SET: "true",
        GH_TOKEN: "",
      },
    });
    rmSync(dir, { recursive: true, force: true });

    expect({ code: r.status, out: r.stdout, err: r.stderr }).toEqual({
      code: 0,
      out: "",
      err: "",
    });
  });
});

describe("which token the run holds, as its workflow's step says", () => {
  it("is the app's when one was made, whatever else is set", () => {
    expect(
      holds({ FACTORY_APP_TOKEN_SET: "true", FACTORY_BUILD_TOKEN_SET: "true" }),
    ).toBe("app");
  });

  it("is a person's when only the build token is set", () => {
    expect(
      holds({
        FACTORY_APP_TOKEN_SET: "false",
        FACTORY_BUILD_TOKEN_SET: "true",
      }),
    ).toBe("person");
  });

  it("is neither when the step names none", () => {
    expect(
      holds({
        FACTORY_APP_TOKEN_SET: "false",
        FACTORY_BUILD_TOKEN_SET: "false",
      }),
    ).toBeNull();
    expect(holds({})).toBeNull();
  });
});
