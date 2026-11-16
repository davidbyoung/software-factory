// The release workflow publishes only a tag that matches package.json's
// version, so a mistyped tag never publishes a version nobody meant.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load } from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

type Step = { name?: string; id?: string; run?: string };
const workflow = load(
  readFileSync(
    new URL("../.github/workflows/release.yml", import.meta.url),
    "utf8",
  ),
) as { jobs: { publish: { steps: Step[] } } };
const steps = workflow.jobs.publish.steps;
const check = steps.find((s) => s.id === "version")!;

let dir = "";
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function runCheck(tag: string) {
  dir = mkdtempSync(join(tmpdir(), "release-"));
  writeFileSync(join(dir, "package.json"), '{ "version": "0.2.0" }\n');
  return spawnSync("bash", ["-eo", "pipefail", "-c", check.run!], {
    cwd: dir,
    env: { ...process.env, GITHUB_REF_NAME: tag },
    encoding: "utf8",
  });
}

describe("the release workflow", () => {
  it("refuses a tag that does not match the package's version", () => {
    const r = runCheck("v0.2.1");
    expect(r.status).toBe(1);
    expect(r.stdout).toContain(
      "The tag v0.2.1 does not match package.json's version, 0.2.0. Nothing was published.",
    );
  });

  it("goes on for the matching tag", () => {
    expect(runCheck("v0.2.0").status).toBe(0);
  });

  it("checks the tag before it publishes", () => {
    const publish = steps.findIndex((s) => s.name === "Publish");
    expect(steps.indexOf(check)).toBeLessThan(publish);
  });
});
