// What `lunamill sync` does with the variables the repository's `.npmrc`
// reads to sign in: lunamill.yml passes them, by name, as secrets to the
// lunamill's workflows, lunamill-review.yml passes none, and the lock records
// them, so a change to them makes it stale.
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  defaultDeps,
  filesDeps,
  resolveFiles,
  staleOf,
} from "../src/config.mts";
import { main, PACKAGE } from "../src/sync.mts";
import { LUNAMILL_FILE, REVIEW_FILE } from "../src/workflow-files.mts";
import { own, put, read, repo } from "./preset-fixture.ts";
import { LUNAMILL_COLUMNS_YAML } from "./lunamill-columns";
import { into } from "./printed";

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
    out: into(out),
    err: into(err),
  });
  return { code, out, err };
}

const LOCK = ".claude/lunamill.lock";
const JFROG = "https://acme.jfrog.io/artifactory/api/npm/npm/";
const NPMRC = `@acme:registry=${JFROG}\n//acme.jfrog.io/artifactory/api/npm/npm/:_authToken=\${NPM_TOKEN}\n`;

/** A repository with every part of lunamill's workflows turned on. */
function everyPart(npmrc: string | null) {
  root = repo(
    own(
      [],
      [
        "tickets:",
        "  board: 7",
        LUNAMILL_COLUMNS_YAML,
        "builds:",
        "  trigger: github-action",
        "auto-merge:",
        '  allow: ["docs/**"]',
        "pr-review: true",
      ],
    ),
  );
  put(root, ".github/dependabot.yml", "version: 1\nupdates: []\n");
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
type Written = {
  permissions: Record<string, string>;
  jobs: Record<string, { secrets?: Record<string, string> }>;
};
/** A workflow file a sync wrote, read as YAML, with the one job that calls
 * lunamill's workflow. */
const written = (path: string) => {
  const file = parse(read(root, path)!) as Written;
  return { file, called: Object.values(file.jobs)[0]! };
};
/** The one secret that carries the repository's own, by name. */
const extra = (names: string[]) =>
  `\${{ format('{{${names.map((n, i) => `"${n}":{${i}}`).join(",")}}}', ${names.map((n) => `toJSON(secrets.${n})`).join(", ")}) }}`;

describe("the workflows sync writes for .npmrc's variables", () => {
  it("passes NPM_TOKEN, by name, from lunamill.yml", async () => {
    everyPart(NPMRC);
    expect((await sync()).code).toBe(0);
    const { called } = written(LUNAMILL_FILE);
    expect(called.secrets!.extra).toBe(extra(["NPM_TOKEN"]));
  });

  it.each(["NPM_TOKEN", "GITHUB_TOKEN"])(
    "passes %s from lunamill-review.yml to nothing, which runs a pull request's copy",
    async (name) => {
      everyPart(null);
      await sync();
      const without = read(root, REVIEW_FILE);
      rmSync(root, { recursive: true, force: true });
      everyPart(`//a.example/:_authToken=\${${name}}\n`);
      await sync();
      expect(read(root, LUNAMILL_FILE)!.includes(name)).toBe(
        name === "NPM_TOKEN",
      );
      expect(read(root, REVIEW_FILE)).toBe(without);
      expect(written(REVIEW_FILE).called).not.toHaveProperty("secrets");
    },
  );

  it("passes each name once, in the order .npmrc first reads them", async () => {
    everyPart(
      `//other.example/:_authToken=\${OTHER_TOKEN}\n${NPMRC}//third.example/:_authToken=\${OTHER_TOKEN}\n`,
    );
    await sync();
    expect(written(LUNAMILL_FILE).called.secrets!.extra).toBe(
      extra(["OTHER_TOKEN", "NPM_TOKEN"]),
    );
  });

  it("only adds a line to lunamill.yml: without it each workflow is what it is with no .npmrc", async () => {
    everyPart(null);
    await sync();
    const before = workflows();
    rmSync(root, { recursive: true, force: true });
    everyPart(NPMRC);
    await sync();
    for (const [name, text] of Object.entries(workflows())) {
      const lines = text.split("\n");
      const added = lines.filter((line) => /^ {6}extra: /.test(line));
      expect(added, name).toHaveLength(
        LUNAMILL_FILE.endsWith(`/${name}`) ? 1 : 0,
      );
      expect(
        lines.filter((line) => !added.includes(line)),
        name,
      ).toEqual(before[name]!.split("\n"));
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

  it("passes no GITHUB_TOKEN, which each job has its own of, and lets lunamill.yml read packages", async () => {
    everyPart("//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}\n");
    await sync();
    const { file, called } = written(LUNAMILL_FILE);
    expect(file.permissions.packages).toBe("read");
    expect(called.secrets).not.toHaveProperty("extra");
  });
});

describe("a name sync refuses", () => {
  it("refuses a GITHUB_ name other than GITHUB_TOKEN, writing nothing", async () => {
    everyPart("//a.example/:_authToken=${GITHUB_PACKAGES_TOKEN}\n");
    const r = await sync();
    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      ".npmrc reads ${GITHUB_PACKAGES_TOKEN} to sign in, and GitHub refuses a secret whose name starts with GITHUB_. Rename it in .npmrc, then run: lunamill sync",
    ]);
    expect(read(root, LOCK)).toBeNull();
  });

  it("refuses a name the runner sets for itself, writing nothing", async () => {
    everyPart("//a.example/:_authToken=${HOME}\n");
    const r = await sync();
    expect(r.code).toBe(1);
    expect(r.err).toEqual([
      ".npmrc reads ${HOME} to sign in, and the runner sets HOME for itself. Rename it in .npmrc, then run: lunamill sync",
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
      ".npmrc changed since the last sync. Run: lunamill sync",
    ]);
  });

  it("names the refusal, not a change, when .npmrc now reads a refused name", async () => {
    everyPart(NPMRC);
    await sync();
    put(root, ".npmrc", NPMRC.replace("NPM_TOKEN", "HOME"));
    const r = await sync(["--check"]);
    expect(r.err).toEqual([
      ".npmrc reads ${HOME} to sign in, and the runner sets HOME for itself. Rename it in .npmrc, then run: lunamill sync",
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
