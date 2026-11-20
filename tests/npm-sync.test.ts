// What `factory sync` does with the variables the repository's `.npmrc`
// reads to sign in: each workflow job that installs sets them from
// secrets, and the lock records them, so a change to them makes it stale.
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";
import {
  defaultDeps,
  filesDeps,
  resolveFiles,
  staleOf,
} from "../src/config.mts";
import { main, PACKAGE, withNpmEnv } from "../src/sync.mts";
import { own, put, read, repo } from "./preset-fixture.ts";

let root = "";
afterEach(() => rmSync(root, { recursive: true, force: true }));

async function sync(argv: string[] = []) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, {
    root,
    pkg: PACKAGE,
    settings: () => resolveFiles({ ...filesDeps(root, {}) }),
    stale: () => staleOf(defaultDeps(root, {})),
    defaultBranch: async () => "main",
    out: (l) => out.push(l),
    err: (l) => err.push(l),
  });
  return { code, out, err };
}

const LOCK = ".claude/factory.lock";
const JFROG = "https://acme.jfrog.io/artifactory/api/npm/npm/";
const NPMRC = `@acme:registry=${JFROG}\n//acme.jfrog.io/artifactory/api/npm/npm/:_authToken=\${NPM_TOKEN}\n`;

/** A repository with every part that writes a workflow turned on. */
function everyPart(npmrc: string | null) {
  root = repo(
    own(
      [],
      [
        "tickets:",
        "  board: 7",
        "builds:",
        "  trigger: github-action",
        "auto-merge:",
        '  allow: ["docs/**"]',
        "pr-review:",
        "  commands: []",
      ],
    ),
  );
  put(root, ".github/dependabot.yml", "version: 2\nupdates: []\n");
  if (npmrc !== null) put(root, ".npmrc", npmrc);
}

const WORKFLOWS = ".github/workflows";
const workflows = () =>
  Object.fromEntries(
    readdirSync(join(root, WORKFLOWS)).map((f) => [
      f,
      read(root, `${WORKFLOWS}/${f}`)!,
    ]),
  );
type Job = {
  env?: Record<string, string>;
  steps: { run?: string; uses?: string }[];
};
const jobsOf = (text: string) =>
  Object.values((load(text) as { jobs: Record<string, Job> }).jobs);
const installs = (j: Job) =>
  j.steps.some(
    (s) =>
      /^npm ci\b/.test(s.run ?? "") ||
      s.uses === "./.github/actions/factory-agent",
  );

describe("the workflows sync writes for .npmrc's variables", () => {
  it("sets NPM_TOKEN from its secret in the env of every job that runs npm ci", async () => {
    everyPart(NPMRC);
    expect((await sync()).code).toBe(0);
    const files = workflows();
    for (const name of [
      "factory-check.yml",
      "factory-board-sync.yml",
      "factory-review-verdict.yml",
      "factory-merge-policy.yml",
      "factory-poller.yml",
      "factory-claude-review.yml",
    ]) {
      const [job] = jobsOf(files[name]!);
      expect(job!.env?.NPM_TOKEN, name).toBe("${{ secrets.NPM_TOKEN }}");
    }
  });

  it("sets it in the env of every job that runs the factory-agent action", async () => {
    everyPart(NPMRC);
    await sync();
    const files = workflows();
    for (const name of [
      "factory-build.yml",
      "factory-review.yml",
      "factory-conflicts.yml",
      "factory-deps.yml",
    ]) {
      const [job] = jobsOf(files[name]!);
      expect(job!.env?.NPM_TOKEN, name).toBe("${{ secrets.NPM_TOKEN }}");
    }
  });

  it("keeps a job's own env entries beside it", async () => {
    everyPart(NPMRC);
    await sync();
    const [job] = jobsOf(workflows()["factory-merge-policy.yml"]!);
    expect(Object.keys(job!.env!)).toEqual(["NPM_TOKEN", "PR", "PR_URL"]);
  });

  it("leaves a job that installs nothing alone", async () => {
    everyPart(NPMRC);
    await sync();
    for (const [name, text] of Object.entries(workflows()))
      for (const job of jobsOf(text))
        if (!installs(job)) expect(job.env?.NPM_TOKEN, name).toBeUndefined();
  });

  it("only adds lines: without them each workflow is what it is with no .npmrc", async () => {
    everyPart(null);
    await sync();
    const before = workflows();
    rmSync(root, { recursive: true, force: true });
    everyPart(`${NPMRC}//other.example/:_authToken=\${OTHER_TOKEN}\n`);
    await sync();
    const after = workflows();
    const added =
      /^ {4}env:$|^ {6}(NPM|OTHER)_TOKEN: \$\{\{ secrets\.\1_TOKEN \}\}$/;
    for (const [name, text] of Object.entries(after)) {
      // Today's lines, in order, with only added lines between them.
      const old = before[name]!.split("\n");
      let at = 0;
      for (const line of text.split("\n"))
        if (at < old.length && line === old[at]) at++;
        else expect(line, name).toMatch(added);
      expect(at, name).toBe(old.length);
    }
  });

  it("writes every workflow as before when .npmrc reads no sign-in variable", async () => {
    everyPart(null);
    await sync();
    const before = workflows();
    rmSync(root, { recursive: true, force: true });
    everyPart(`cache=\${HOME}/.npm-cache\n@acme:registry=${JFROG}\n`);
    await sync();
    expect(workflows()).toEqual(before);
  });

  it("passes the workflow's own GITHUB_TOKEN and lets the workflow read packages", async () => {
    everyPart("//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}\n");
    await sync();
    for (const [name, text] of Object.entries(workflows())) {
      const o = load(text) as {
        permissions: Record<string, string>;
        jobs: Record<string, Job>;
      };
      const any = Object.values(o.jobs).some(installs);
      expect(o.permissions.packages, name).toBe(any ? "read" : undefined);
      for (const job of Object.values(o.jobs))
        if (installs(job))
          expect(job.env?.GITHUB_TOKEN, name).toBe(
            "${{ secrets.GITHUB_TOKEN }}",
          );
    }
  });
});

describe("a name sync refuses", () => {
  it("refuses a GITHUB_ name other than GITHUB_TOKEN, writing nothing", async () => {
    everyPart("//a.example/:_authToken=${GITHUB_PACKAGES_TOKEN}\n");
    const r = await sync();
    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      ".npmrc reads ${GITHUB_PACKAGES_TOKEN} to sign in, and GitHub refuses a secret whose name starts with GITHUB_. Rename it in .npmrc, then run: npx --no-install factory sync",
    ]);
    expect(read(root, LOCK)).toBeNull();
  });

  it("refuses a name the runner sets for itself, writing nothing", async () => {
    everyPart("//a.example/:_authToken=${HOME}\n");
    const r = await sync();
    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      ".npmrc reads ${HOME} to sign in, and the runner sets HOME for itself. Rename it in .npmrc, then run: npx --no-install factory sync",
    ]);
    expect(read(root, LOCK)).toBeNull();
  });
});

describe("the lock and .npmrc", () => {
  it("records the names, in the order .npmrc first reads them", async () => {
    everyPart(`//b.example/:_authToken=\${B_TOKEN}\n${NPMRC}`);
    await sync();
    expect(
      (load(read(root, LOCK)!) as Record<string, unknown>)["npmrc-variables"],
    ).toEqual(["B_TOKEN", "NPM_TOKEN"]);
  });

  it("is stale once .npmrc reads another name", async () => {
    everyPart(NPMRC);
    await sync();
    put(root, ".npmrc", NPMRC.replace("NPM_TOKEN", "ACME_TOKEN"));
    const r = await sync(["--check"]);
    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      ".npmrc changed since the last sync. Run: npx --no-install factory sync",
    ]);
  });

  it("names the refusal, not a change, when .npmrc now reads a refused name", async () => {
    everyPart(NPMRC);
    await sync();
    put(root, ".npmrc", NPMRC.replace("NPM_TOKEN", "HOME"));
    const r = await sync(["--check"]);
    expect(r.err).toEqual([
      ".npmrc reads ${HOME} to sign in, and the runner sets HOME for itself. Rename it in .npmrc, then run: npx --no-install factory sync",
    ]);
  });

  it("is current after an edit to .npmrc that reads the same names", async () => {
    everyPart(NPMRC);
    await sync();
    put(
      root,
      ".npmrc",
      NPMRC.replaceAll("acme.jfrog.io", "acme2.jfrog.io") + "save-exact=true\n",
    );
    expect((await sync(["--check"])).code).toBe(0);
  });

  it("reads a lock with no npmrc-variables as naming none", async () => {
    everyPart(null);
    await sync();
    put(root, LOCK, read(root, LOCK)!.replace("npmrc-variables: []\n", ""));
    expect(await staleOf(defaultDeps(root, {}))).toBeNull();
  });
});

describe("the install steps sync recognizes", () => {
  const workflow = (job: string[]) =>
    [
      "name: Example",
      "on: push",
      "permissions:",
      "  contents: read",
      "jobs:",
      "  example:",
      "    runs-on: ubuntu-latest",
      ...job,
      "",
    ].join("\n");
  const envOf = (text: string) =>
    (load(text) as { jobs: { example: Job } }).jobs.example.env;

  it.each([
    ["a step with no name", ["    steps:", "      - run: npm ci"]],
    [
      "npm ci inside a run block",
      [
        "    steps:",
        "      - name: Install",
        "        run: |",
        "          npm ci --ignore-scripts",
        "          echo done",
      ],
    ],
  ])("sets the variable for %s", (_, job) => {
    expect(envOf(withNpmEnv(workflow(job), ["NPM_TOKEN"], "x.yml"))).toEqual({
      NPM_TOKEN: "${{ secrets.NPM_TOKEN }}",
    });
  });

  it("lets a job with permissions of its own read packages for GITHUB_TOKEN", () => {
    const text = withNpmEnv(
      workflow([
        "    permissions:",
        "      contents: read",
        "    steps:",
        "      - run: npm ci",
      ]),
      ["GITHUB_TOKEN"],
      "x.yml",
    );
    const job = (load(text) as { jobs: { example: { permissions: object } } })
      .jobs.example;
    expect(job.permissions).toEqual({ contents: "read", packages: "read" });
  });
});
