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
  '? "Review verdict" is not required before a merge to main, and this run\'s token cannot require it. An admin of acme/web runs: lunamill init';
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
  const RULE = [{ check: "Review verdict", property: "lunamill", value: "on" }];

  it.each<[string, string | null]>([
    ["off", "off"],
    ["not set", null],
  ])(
    "turns the property on for a repository where it is %s, and says what that does",
    async (_, value) => {
      const { lines, host } = run("app", {
        properties: { lunamill: value },
        ownerRules: RULE,
      });

      expect(await lines()).toEqual([
        '✓ Set lunamill to "on" for acme/web, so acme\'s rule requires "Review verdict" here.',
      ]);
      expect(host.settings.properties["lunamill"]).toBe("on");
      expect(await host.codeHost.requiresStatus("main", "Review verdict")).toBe(
        true,
      );
    },
  );

  it("turns the property on for a repository with no value for it yet, which the code host leaves out of the repository's values", async () => {
    const { lines, host } = run("app", { properties: {}, ownerRules: RULE });

    expect(await lines()).toEqual([
      '✓ Set lunamill to "on" for acme/web, so acme\'s rule requires "Review verdict" here.',
    ]);
    expect(host.settings.properties["lunamill"]).toBe("on");
  });

  it("prints nothing, and sets nothing, where the property is already on", async () => {
    const { lines, wrote } = run("app", {
      properties: { lunamill: "on" },
      ownerRules: RULE,
    });

    expect(await lines()).toEqual([]);
    expect(wrote()).toEqual([]);
  });

  /** An organization that defines no such property, as the code host
   * answers an attempt to set one. */
  const undefinedProperty = (status: number): MemoryCodeHostOptions => ({
    properties: { team: "web" },
    propertyRefused: status === 404 ? "Not Found" : "Validation Failed",
    propertyRefusedStatus: status,
  });

  it.each([404, 422])(
    "says an admin runs init where the organization has no such property, which the code host answers with %s",
    async (status) => {
      const { lines, host } = run("app", undefinedProperty(status));

      expect(await lines()).toEqual([NOT_REQUIRED]);
      expect(host.settings.properties).toEqual({ team: "web" });
    },
  );

  it("prints nothing where there is no such property and the repository's own rule already requires the verdict", async () => {
    const { lines, host } = run("app", undefinedProperty(404));
    await host.codeHost.requireCheck("lunamill", "Review verdict");

    expect(await lines()).toEqual([]);
  });

  it("gives the code host's reason, and who sets it by hand, when the value is refused", async () => {
    const { lines, host } = run("app", {
      properties: { lunamill: "off" },
      propertyRefused: "403 Resource not accessible by integration",
    });

    expect(await lines()).toEqual([
      '? Could not set lunamill to "on" for acme/web: 403 Resource not accessible by integration. An owner of acme sets it under the organization\'s Settings, Custom properties.',
    ]);
    expect(host.settings.properties["lunamill"]).toBe("off");
  });

  it("gives the reason for a refusal with any other status too, such as a token that may not set it", async () => {
    const { lines } = run("app", {
      propertyRefused: "Resource not accessible by integration",
      propertyRefusedStatus: 403,
    });

    expect(await lines()).toEqual([
      '? Could not set lunamill to "on" for acme/web: Resource not accessible by integration (HTTP 403). An owner of acme sets it under the organization\'s Settings, Custom properties.',
    ]);
  });

  it("tries to set the property all the same when the repository's values cannot be read", async () => {
    const { lines, host } = run("app", {
      fail: { properties: new Error("gh api: Server Error (HTTP 500)") },
    });

    expect(await lines()).toEqual([
      '✓ Set lunamill to "on" for acme/web, so acme\'s rule requires "Review verdict" here.',
    ]);
    expect(host.settings.properties["lunamill"]).toBe("on");
  });
});

describe("with a person's build token", () => {
  it("makes the rule init makes, from the runner's own account, where the default branch has none", async () => {
    const { lines, host } = run("person");

    expect(await lines()).toEqual([
      '✓ Required "Review verdict" before a merge to main, as the rule "Lunamill".',
    ]);
    expect(host.settings.rules).toEqual([
      { name: "Lunamill", check: "Review verdict", source: "runner" },
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
      '✓ Required "Review verdict" before a merge to trunk, as the rule "Lunamill".',
    ]);
  });
});

describe("with no token of either kind", () => {
  it("says an admin of the repository runs init, and changes nothing", async () => {
    const { lines, wrote } = run(
      null,
      { properties: { lunamill: "off" } },
      { repository: "sam/api" },
    );

    expect(await lines()).toEqual([
      '? "Review verdict" is not required before a merge to main, and this run\'s token cannot require it. An admin of sam/api runs: lunamill init',
    ]);
    expect(wrote()).toEqual([]);
  });

  it("prints nothing where the verdict is already required", async () => {
    const { lines, host } = run(null);
    await host.codeHost.requireCheck("lunamill", "Review verdict");

    expect(await lines()).toEqual([]);
  });
});

describe("where the owner's plan has no branch rules for the repository", () => {
  const NO_RULES = {
    noRules: "GitHub Free has no branch rules for a private repository",
  };

  it.each<[string, Enroll["as"], MemoryCodeHostOptions]>([
    [
      "the app's token, in an organization with no such property",
      "app",
      {
        ...NO_RULES,
        propertyRefused: "Not Found",
        propertyRefusedStatus: 404,
      },
    ],
    ["a person's build token", "person", NO_RULES],
    ["no token of either kind", null, NO_RULES],
  ])(
    "prints nothing and makes no rule, since none can be made there, with %s",
    async (_, as, options) => {
      const { lines, host } = run(as, options);

      expect(await lines()).toEqual([]);
      expect(
        host.log.filter((call) => call.startsWith("requireCheck")),
      ).toEqual([]);
    },
  );

  it("still fails on any other failure to read the branch's rules", async () => {
    const { lines } = run("person", {
      fail: { requiresStatus: new Error("gh api: Server Error (HTTP 500)") },
    });

    await expect(lines()).rejects.toThrow("Server Error (HTTP 500)");
  });
});

describe("with the review off", () => {
  it.each<[Enroll["as"]]>([["app"], ["person"], [null]])(
    "does nothing, and asks the code host nothing, holding %s",
    async (as) => {
      const { lines, host } = run(
        as,
        { properties: { lunamill: "off" } },
        { reviewOn: false },
      );

      expect(await lines()).toEqual([]);
      expect(host.log).toEqual([]);
    },
  );
});

// The command itself, in a repository whose settings leave the review off:
// it stops before it asks the code host anything, so it runs with no
// network. LUNAMILL_VERSION keeps the launcher on this checkout.
describe("lunamill enroll, as the workflow's step runs it", () => {
  const ROOT = join(import.meta.dirname, "..");
  const { version } = JSON.parse(
    readFileSync(join(ROOT, "package.json"), "utf8"),
  ) as { version: string };

  it("prints nothing and passes where pr-review is not set and no approval policy is on", () => {
    const dir = mkdtempSync(join(tmpdir(), "factory-enroll-"));
    mkdirSync(join(dir, ".git"));
    writeSettings(
      dir,
      `version: 1\nrepository: sam/api\ntickets:\n  type: github\n${CODE_HOST_YAML}\napproval-policies:\n  - name: credentials\n    off: true\n`,
    );
    const r = spawnSync("node", [join(ROOT, "bin/lunamill.js"), "enroll"], {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...process.env,
        LUNAMILL_VERSION: version,
        LUNAMILL_BUILD_TOKEN_SET: "true",
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
      holds({
        LUNAMILL_APP_TOKEN_SET: "true",
        LUNAMILL_BUILD_TOKEN_SET: "true",
      }),
    ).toBe("app");
  });

  it("is a person's when only the build token is set", () => {
    expect(
      holds({
        LUNAMILL_APP_TOKEN_SET: "false",
        LUNAMILL_BUILD_TOKEN_SET: "true",
      }),
    ).toBe("person");
  });

  it("is neither when the step names none", () => {
    expect(
      holds({
        LUNAMILL_APP_TOKEN_SET: "false",
        LUNAMILL_BUILD_TOKEN_SET: "false",
      }),
    ).toBeNull();
    expect(holds({})).toBeNull();
  });
});

describe("the approval policies' status", () => {
  const APPROVAL_NOT_REQUIRED =
    '? "Approval policies" is not required before a merge to main, and this run\'s token cannot require it. An admin of acme/web runs: lunamill init';

  it("is required beside the verdict with a person's token, whether or not the review is on", async () => {
    const { lines, host } = run(
      "person",
      {},
      { reviewOn: false, policiesOn: true },
    );
    expect(await lines()).toEqual([
      '✓ Required "Approval policies" before a merge to main, as the rule "Lunamill".',
    ]);
    expect(host.settings.rules.map((r) => r.check)).toEqual([
      "Approval policies",
    ]);
    expect(await lines()).toEqual([]);
  });

  it("says who requires it under the organization's app, which manages no rules", async () => {
    const { lines, wrote } = run(
      "app",
      {},
      { reviewOn: false, policiesOn: true },
    );
    expect(await lines()).toEqual([APPROVAL_NOT_REQUIRED]);
    expect(wrote()).toEqual([]);
  });

  it("is left alone with no policy", async () => {
    const { lines, wrote } = run("person", {}, { reviewOn: false });
    expect(await lines()).toEqual([]);
    expect(wrote()).toEqual([]);
  });
});
