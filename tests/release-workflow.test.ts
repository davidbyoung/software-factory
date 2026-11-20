// The release workflow is a button: run by hand on main with a level, it
// works out the next version from the tags, runs CI, publishes, and tags
// last, so a run that stops partway can be finished by re-running it.
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load } from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";

type Step = { name?: string; id?: string; run?: string };
type Job = {
  uses?: string;
  needs?: string | string[];
  permissions?: Record<string, string>;
  steps?: Step[];
};
type Workflow = {
  on: Record<string, unknown>;
  concurrency?: { group?: string; "cancel-in-progress"?: boolean };
  permissions?: Record<string, string>;
  jobs: Record<string, Job>;
};
const read = (name: string) =>
  load(
    readFileSync(
      new URL(`../.github/workflows/${name}`, import.meta.url),
      "utf8",
    ),
  ) as Workflow;
const workflow = read("release.yml");
const { jobs } = workflow;
const needs = (job: string) => [jobs[job]?.needs ?? []].flat();
const script = (job: string) =>
  (jobs[job]?.steps ?? []).map((s) => s.run ?? "").join("\n");
const step = (job: string, id: string) =>
  jobs[job]?.steps?.find((s) => s.id === id) ?? {};

let dir = "";
afterEach(() => rmSync(dir, { recursive: true, force: true }));

// No GIT_DIR or GIT_INDEX_FILE from a hook running the suite reaches the
// repositories made here.
const clean = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")),
);

function run(body: string | undefined, env: Record<string, string>) {
  return spawnSync("bash", ["-eo", "pipefail", "-c", body ?? "exit 99"], {
    cwd: dir,
    env: { ...clean, ...env },
    encoding: "utf8",
  });
}

describe("starting a release", () => {
  it("is only by hand, with a required choice of patch, minor, or major", () => {
    expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
    const dispatch = workflow.on.workflow_dispatch as {
      inputs?: Record<string, Record<string, unknown>>;
    } | null;
    expect(dispatch?.inputs?.level).toMatchObject({
      required: true,
      type: "choice",
      options: ["patch", "minor", "major"],
    });
  });

  it("waits for a run already going rather than cancelling it", () => {
    expect(workflow.concurrency?.group).toBeTruthy();
    expect(workflow.concurrency?.["cancel-in-progress"]).not.toBe(true);
  });

  describe("on a branch", () => {
    const onBranch = (branch: string) => {
      dir = mkdtempSync(join(tmpdir(), "release-"));
      return run(step("version", "branch").run, { GITHUB_REF_NAME: branch });
    };

    it("other than main, fails naming it", () => {
      const r = onBranch("issue-19");
      expect(r.status).toBe(1);
      expect(r.stdout).toContain(
        "Release runs only on main, not issue-19. Nothing was published.",
      );
    });

    it("main, goes on", () => {
      expect(onBranch("main").status).toBe(0);
    });
  });
});

describe("the next version", () => {
  /** Runs the step in a repository holding these tags, and returns what
   * it wrote to the step's outputs. */
  function next(level: string, tags: string[]) {
    dir = mkdtempSync(join(tmpdir(), "release-"));
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: dir, stdio: "pipe", env: clean });
    const commit = () =>
      git(
        ...["-c", "user.name=t", "-c", "user.email=t@t"],
        ...["-c", "commit.gpgsign=false", "commit", "-q", "--allow-empty"],
        ...["-m", "c"],
      );
    git("init", "-q");
    // The highest version is on the older commit, and the newest commit
    // holds lower and malformed tags.
    commit();
    for (const t of tags.slice(0, 1)) git("-c", "tag.gpgSign=false", "tag", t);
    commit();
    for (const t of tags.slice(1)) git("-c", "tag.gpgSign=false", "tag", t);
    const out = join(dir, "output");
    writeFileSync(out, "");
    const r = run(step("version", "next").run, {
      LEVEL: level,
      GITHUB_OUTPUT: out,
    });
    return { ...r, outputs: readFileSync(out, "utf8") };
  }
  const tags = ["v0.1.10", "v0.1.9", "v0.1.1", "vnext", "v0.2.0-rc.1"];

  it.each([
    ["patch", "0.1.11"],
    ["minor", "0.2.0"],
    ["major", "1.0.0"],
  ])(
    "raises the highest vX.Y.Z tag by version, not by date, for %s",
    (level, version) => {
      const r = next(level, tags);
      expect(r.status).toBe(0);
      expect(r.outputs).toContain(`version=${version}\n`);
      expect(r.outputs).toContain("previous=0.1.10\n");
    },
  );

  it("fails when there is no version tag to raise", () => {
    const r = next("patch", ["vnext", "v1"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain(
      "No vX.Y.Z tag to raise. Nothing was published.",
    );
  });
});

describe("the order of a release", () => {
  it("chooses the version, then runs the whole CI on the commit", () => {
    expect(jobs.ci?.uses).toBe("./.github/workflows/ci.yml");
    expect(needs("ci")).toContain("version");
    expect(read("ci.yml").on).toHaveProperty("workflow_call");
  });

  it("publishes to npm only once CI passes, with the version set in its own copy", () => {
    expect(needs("publish")).toEqual(expect.arrayContaining(["version", "ci"]));
    const steps = jobs.publish?.steps ?? [];
    const set = steps.findIndex((s) =>
      s.run?.includes('npm version "$VERSION" --no-git-tag-version'),
    );
    const publish = steps.findIndex((s) => s.id === "publish");
    expect(set).toBeGreaterThan(-1);
    expect(set).toBeLessThan(publish);
  });

  it("commits and pushes nothing", () => {
    const all = Object.keys(jobs).map(script).join("\n");
    expect(all).not.toMatch(/git (commit|push)/);
  });

  it("pushes the poller's image after the npm package", () => {
    expect(needs("image")).toContain("publish");
  });

  it("tags and creates the GitHub Release last", () => {
    expect(needs("release")).toContain("image");
  });

  it("tags the commit the run started on, with notes generated from the previous version's tag", () => {
    const release = script("release");
    expect(release).toContain('gh release create "v$VERSION"');
    expect(release).toContain('--target "$GITHUB_SHA"');
    expect(release).toContain("--generate-notes");
    expect(release).toContain('--notes-start-tag "v$PREVIOUS"');
  });

  it("gives contents: write only to the job that tags", () => {
    const writers = Object.entries(jobs)
      .filter(([, j]) => j.permissions?.contents === "write")
      .map(([name]) => name);
    expect(writers).toEqual(["release"]);
    expect(workflow.permissions?.contents).toBe("read");
  });
});

describe("a version npm already has", () => {
  /** Runs a step with curl answering as npm's registry would, found or
   * not, and npm recording what it was asked to do. */
  function withNpm(job: string, id: string, has: boolean) {
    dir = mkdtempSync(join(tmpdir(), "release-"));
    const bin = join(dir, "bin");
    mkdirSync(bin);
    const log = join(dir, "npm.log");
    writeFileSync(log, "");
    writeFileSync(join(bin, "curl"), `#!/bin/sh\nexit ${has ? 0 : 22}\n`, {
      mode: 0o755,
    });
    writeFileSync(join(bin, "npm"), `#!/bin/sh\necho "npm $*" >> "${log}"\n`, {
      mode: 0o755,
    });
    const r = run(step(job, id).run, {
      VERSION: "0.2.0",
      PATH: `${bin}:${clean.PATH}`,
    });
    return { ...r, npm: readFileSync(log, "utf8") };
  }

  it("stops a new run, saying to re-run the one that published it", () => {
    const r = withNpm("version", "unpublished", true);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain(
      "npm already has 0.2.0. Re-run the failed jobs of the run that published it.",
    );
  });

  it("is not in the way of a version npm does not have", () => {
    expect(withNpm("version", "unpublished", false).status).toBe(0);
  });

  it("is not published again when a re-run reaches the publish step", () => {
    const r = withNpm("publish", "publish", true);
    expect(r.status).toBe(0);
    expect(r.npm).not.toContain("publish");
  });

  it("is published when npm does not have it", () => {
    const r = withNpm("publish", "publish", false);
    expect(r.status).toBe(0);
    expect(r.npm).toContain("npm publish --access public");
  });
});

describe("the poller's image", () => {
  const steps = script("image");

  it("is built from the version just published", () => {
    expect(steps).toContain('--build-arg VERSION="$VERSION"');
  });

  it("waits until npm serves the version's tarball, which can come minutes after its listing", () => {
    dir = mkdtempSync(join(tmpdir(), "release-"));
    const bin = join(dir, "bin");
    mkdirSync(bin);
    const log = join(dir, "curl.log");
    writeFileSync(log, "");
    writeFileSync(join(bin, "npm"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    writeFileSync(join(bin, "sleep"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    writeFileSync(
      join(bin, "curl"),
      `#!/bin/sh\necho "$*" >> "${log}"\n[ "$(wc -l < "${log}")" -ge 3 ]\n`,
      { mode: 0o755 },
    );
    const wait = jobs.image?.steps?.find(
      (s) => s.name === "Wait for the version on npm",
    );
    const r = run(wait?.run, {
      VERSION: "0.2.0",
      PATH: `${bin}:${clean.PATH}`,
    });
    expect(r.status).toBe(0);
    const calls = readFileSync(log, "utf8").trim().split("\n");
    expect(calls).toHaveLength(3);
    for (const call of calls)
      expect(call).toContain(
        "https://registry.npmjs.org/@davidbyoung/software-factory/-/software-factory-0.2.0.tgz",
      );
  });

  it("may write packages, and logs in to GitHub's container registry with the run's own token", () => {
    expect(jobs.image?.permissions).toEqual({
      contents: "read",
      packages: "write",
    });
    expect(steps).toContain("docker login ghcr.io");
  });

  it("pushes the version's tag and latest", () => {
    expect(steps).toContain(
      'docker push "ghcr.io/davidbyoung/software-factory-poller:$VERSION"',
    );
    expect(steps).toContain(
      'docker push "ghcr.io/davidbyoung/software-factory-poller:latest"',
    );
  });
});
