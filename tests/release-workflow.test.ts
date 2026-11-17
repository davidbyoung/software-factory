// The release workflow publishes only a tag that matches package.json's
// version, on a commit that is on main, after the same CI a pull request
// gets passes on it, so a mistyped or stray tag never publishes a version
// nobody meant.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load } from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

type Step = { name?: string; id?: string; run?: string };
type Job = { uses?: string; needs?: string | string[]; steps?: Step[] };
const read = (name: string) =>
  load(
    readFileSync(
      new URL(`../.github/workflows/${name}`, import.meta.url),
      "utf8",
    ),
  ) as { on: Record<string, unknown>; jobs: Record<string, Job> };
const workflow = read("release.yml");
const steps = workflow.jobs.publish!.steps!;
const check = steps.find((s) => s.id === "version")!;
const onMain = steps.find((s) => s.id === "on-main")!;

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

  it("runs the whole CI on the tagged commit, and publishes only once it passes", () => {
    expect(workflow.jobs.ci?.uses).toBe("./.github/workflows/ci.yml");
    expect([workflow.jobs.publish!.needs].flat()).toContain("ci");
    expect(read("ci.yml").on).toHaveProperty("workflow_call");
  });

  describe("a tag's commit", () => {
    let origin = "";
    afterEach(() => rmSync(origin, { recursive: true, force: true }));

    /** A clone whose origin's main has one commit, checked out at a
     * second commit that main does not have, or at main itself. */
    function clone(onMainBranch: boolean) {
      origin = mkdtempSync(join(tmpdir(), "release-origin-"));
      const git = (cwd: string, ...args: string[]) =>
        execFileSync("git", args, { cwd, stdio: "pipe", encoding: "utf8" });
      const id = ["-c", "user.name=t", "-c", "user.email=t@t"];
      git(origin, "init", "-q", "-b", "main");
      git(origin, ...id, "commit", "-q", "--allow-empty", "-m", "on main");
      dir = mkdtempSync(join(tmpdir(), "release-"));
      git(dir, "clone", "-q", origin, ".");
      if (!onMainBranch)
        git(dir, ...id, "commit", "-q", "--allow-empty", "-m", "elsewhere");
      return git(dir, "rev-parse", "HEAD").trim();
    }

    const runOnMain = (sha: string) =>
      spawnSync("bash", ["-eo", "pipefail", "-c", onMain.run!], {
        cwd: dir,
        env: { ...process.env, GITHUB_SHA: sha, GITHUB_REF_NAME: "v0.2.0" },
        encoding: "utf8",
      });

    it("is refused when main does not have it", () => {
      const r = runOnMain(clone(false));
      expect(r.status).toBe(1);
      expect(r.stdout).toContain(
        "The tag v0.2.0 is on a commit main does not have. Nothing was published.",
      );
    });

    it("goes on when main has it", () => {
      expect(runOnMain(clone(true)).status).toBe(0);
    });
  });
});

describe("the poller's image", () => {
  const image = read("release.yml").jobs.image as Job & {
    permissions?: Record<string, string>;
  };
  const script = (image?.steps ?? []).map((s) => s.run ?? "").join("\n");

  it("is published only after the npm package, from the version just published", () => {
    expect(image.needs).toBe("publish");
    expect(script).toContain(
      'npm view "@davidbyoung/software-factory@$version"',
    );
    expect(script).toContain('--build-arg VERSION="$version"');
  });

  it("may write packages, and logs in to GitHub's container registry with the run's own token", () => {
    expect(image.permissions).toEqual({ contents: "read", packages: "write" });
    expect(script).toContain("docker login ghcr.io");
  });

  it("pushes the version's tag and latest", () => {
    expect(script).toContain(
      'docker push "ghcr.io/davidbyoung/software-factory-poller:$version"',
    );
    expect(script).toContain(
      'docker push "ghcr.io/davidbyoung/software-factory-poller:latest"',
    );
  });
});
