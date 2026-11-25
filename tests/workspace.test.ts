// `factory workspace`, against real git repositories in a temporary folder.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Handoff, RunFile } from "../src/handoff/index.mts";
import { claimPath, readClock, writeClock } from "../src/lib/clock.mts";
import { clonesIn, main, worth, type Deps } from "../src/workspace.mts";
import { memoryTickets, type Seed } from "./memory-tickets";
import { network, SECTION } from "./network";
import { into } from "./printed";

let dir = "";
const home = process.cwd();
beforeEach(() => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), "workspace-")));
});
afterEach(() => {
  process.chdir(home);
  rmSync(dir, { recursive: true, force: true });
});

const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Dev",
      "-c",
      "user.email=dev@example.com",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();

/** A repository on the code host: a bare one with one commit on `trunk`. */
function remote(name: string, files: Record<string, string> = {}) {
  const seed = join(dir, "seed", name);
  mkdirSync(seed, { recursive: true });
  git(seed, "init", "-q", "-b", "trunk");
  for (const [path, text] of Object.entries({ "a.txt": "a\n", ...files })) {
    mkdirSync(dirname(join(seed, path)), { recursive: true });
    writeFileSync(join(seed, path), text);
  }
  git(seed, "add", "-A");
  git(seed, "commit", "-qm", "One");
  const bare = join(dir, "remote", `${name}.git`);
  mkdirSync(dirname(bare), { recursive: true });
  git(dir, "clone", "-q", "--bare", seed, bare);
  return bare;
}

function world(
  o: {
    here?: string;
    ticket?: Partial<Seed>;
    handoff?: Handoff;
    branch?: Deps["branch"];
  } = {},
) {
  const here = o.here ?? "acme/api";
  const key = here === "acme/api" ? "12" : "acme/api#12";
  const memory = memoryTickets(
    [{ key, body: `The ask.\n\n${SECTION}`, ...o.ticket } as Seed],
    { repository: here },
  );
  const root = join(dir, "code", "api");
  if (!existsSync(root)) {
    mkdirSync(dirname(root), { recursive: true });
    git(dir, "clone", "-q", remote("acme/api"), root);
  }
  const lines: string[] = [];
  const errors: string[] = [];
  const d: Deps = {
    tickets: memory.tickets,
    repository: here,
    root,
    work: join(dir, "work"),
    reach: network({}).reach,
    remote: (name) => join(dir, "remote", `${name}.git`),
    branch:
      o.branch ?? (async (k) => `dev/${k.replace(/^.*\/([^/#]+)#/, "$1-")}`),
    gitDir: () => join(root, ".git"),
    handoff: o.handoff ?? null,
    out: into(lines),
    err: into(errors),
  };
  return {
    run: (...argv: string[]) => main(argv, d),
    lines,
    errors,
    root,
    web: join(dir, "work/acme/api-12/web"),
  };
}

describe("factory workspace N", () => {
  it("clones each other repository on the ticket's branch, and says where", async () => {
    remote("acme/web", { "CLAUDE.md": "Rules.\n" });
    const w = world();
    expect(await w.run("12")).toBe(0);
    expect(w.lines).toEqual([
      "#12 workspace",
      `  ✓ acme/api   branch dev/12       ${w.root}, this checkout`,
      `  ✓ acme/web   branch dev/api-12   ${w.web}`,
      `Read first: ${w.web}/CLAUDE.md`,
    ]);
    expect(git(w.web, "branch", "--show-current")).toBe("dev/api-12");
    expect(git(w.web, "rev-parse", "HEAD")).toBe(
      git(w.web, "rev-parse", "origin/trunk"),
    );
  });

  it("takes up the branch an earlier build pushed", async () => {
    const bare = remote("acme/web");
    const other = join(dir, "other");
    git(dir, "clone", "-q", bare, other);
    git(other, "switch", "-qc", "dev/api-12");
    writeFileSync(join(other, "b.txt"), "b\n");
    git(other, "add", "-A");
    git(other, "commit", "-qm", "Two");
    git(other, "push", "-q", "origin", "dev/api-12");
    const w = world();
    await w.run("12");
    expect(existsSync(join(w.web, "b.txt"))).toBe(true);
  });

  it("leaves a clone already there as it is", async () => {
    remote("acme/web");
    const w = world();
    await w.run("12");
    writeFileSync(join(w.web, "a.txt"), "changed\n");
    expect(await w.run("12")).toBe(0);
    expect(readFileSync(join(w.web, "a.txt"), "utf8")).toBe("changed\n");
  });

  it("leaves one that is not set up on its default branch", async () => {
    remote("acme/web");
    const w = world({
      branch: async (_, root) => (root.endsWith("/web") ? null : "dev/12"),
    });
    expect(await w.run("12")).toBe(0);
    expect(w.lines[2]).toContain("acme/web   branch trunk");
  });

  it("says why one could not be cloned, and clones the rest", async () => {
    remote("acme/ios");
    const body = "## Repositories\n\n- acme/api\n- acme/web\n- acme/ios\n";
    const w = world({ ticket: { body } });
    expect(await w.run("12")).toBe(1);
    expect(w.lines[2]).toMatch(/^ {2}✗ acme\/web {3}\S/);
    expect(existsSync(join(dir, "work/acme/api-12/ios/a.txt"))).toBe(true);
  });

  it("clones nothing for a ticket that names no other", async () => {
    const w = world({ ticket: { body: "The ask.\n" } });
    expect(await w.run("12")).toBe(0);
    expect(w.lines).toEqual(["#12 has one repository: nothing to clone."]);
    expect(existsSync(join(dir, "work"))).toBe(false);
  });

  it("refuses a checkout the ticket does not name", async () => {
    const w = world({ here: "acme/docs" });
    expect(await w.run("acme/api#12")).toBe(1);
    expect(w.errors).toEqual([
      "✗ This checkout, acme/docs, is not one of acme/api#12's repositories: acme/api, acme/web",
    ]);
  });
});

describe("a session's claim and clock in a clone", () => {
  it("are those of the checkout the workspace was made in", async () => {
    remote("acme/web");
    const w = world();
    await w.run("12");

    process.chdir(w.root);
    writeFileSync(claimPath("12"), "77");
    writeClock("s1", { issue: "12", start: "2026-11-25T10:00:00Z" });

    process.chdir(w.web);
    expect(readFileSync(claimPath("acme/api#12"), "utf8")).toBe("77");
    expect(readClock("s1")).toEqual({
      issue: "acme/api#12",
      start: "2026-11-25T10:00:00Z",
    });
    writeClock("s1", { issue: "acme/api#12", start: "2026-11-25T11:00:00Z" });

    process.chdir(w.root);
    expect(readClock("s1")).toEqual({
      issue: "12",
      start: "2026-11-25T11:00:00Z",
    });
  });
});

describe("factory workspace N --remove", () => {
  it("deletes each clone with nothing to lose, and the ticket's folder", async () => {
    remote("acme/web");
    const w = world();
    await w.run("12");
    w.lines.length = 0;
    expect(await w.run("12", "--remove")).toBe(0);
    expect(w.lines).toEqual(["✓ Removed acme/web"]);
    expect(existsSync(dirname(w.web))).toBe(false);
  });

  const commit = (at: string, name: string) => {
    writeFileSync(join(at, name), "x\n");
    git(at, "add", "-A");
    git(at, "commit", "-qm", name);
  };

  it("keeps one with commits that are not pushed, on any branch", async () => {
    remote("acme/web");
    const w = world();
    await w.run("12");
    commit(w.web, "one");
    git(w.web, "switch", "-q", "-c", "side");
    commit(w.web, "two");
    git(w.web, "switch", "-q", "dev/api-12");
    w.lines.length = 0;
    expect(await w.run("12", "--remove")).toBe(1);
    expect(w.lines).toEqual([
      `✗ acme/web   2 commits are not pushed: ${w.web}`,
    ]);
    expect(existsSync(join(w.web, "one"))).toBe(true);
  });

  it("says one commit is not pushed", async () => {
    remote("acme/web");
    const w = world();
    await w.run("12");
    commit(w.web, "one");
    expect(worth(w.web)).toBe(`1 commit is not pushed: ${w.web}`);
    git(w.web, "push", "-q", "origin", "HEAD");
    expect(worth(w.web)).toBeNull();
  });

  it("keeps one with uncommitted or stashed changes", async () => {
    remote("acme/web");
    const w = world();
    await w.run("12");
    writeFileSync(join(w.web, "a.txt"), "changed\n");
    expect(worth(w.web)).toBe(`uncommitted changes: ${w.web}`);
    git(w.web, "stash", "-q");
    expect(worth(w.web)).toBe(`stashed changes: ${w.web}`);
  });

  it("keeps a folder git cannot read", async () => {
    const w = world();
    mkdirSync(w.web, { recursive: true });
    expect(await w.run("12", "--remove")).toBe(1);
    expect(existsSync(w.web)).toBe(true);
  });
});

describe("the clones left", () => {
  it("are listed with the ticket each is for", async () => {
    remote("acme/web");
    const w = world();
    await w.run("12");
    expect(clonesIn(join(dir, "work"), "acme")).toEqual([
      { word: "api-12", name: "acme/web", folder: w.web },
    ]);
  });
});

describe("factory workspace in the cloud", () => {
  it("clones nothing, and says what may be changed and what read", async () => {
    const run = {
      repository: "acme/web",
      branch: "bot/api-12",
      others: [
        { repository: "acme/api", pull: 88, folder: "api" },
        { repository: "acme/ios", pull: null, folder: "ios" },
        { repository: "acme/big", pull: null, folder: null },
      ],
    } as unknown as RunFile;
    const w = world({
      here: "acme/web",
      handoff: { dir: "/run", run: () => run } as unknown as Handoff,
    });
    expect(await w.run("acme/api#12")).toBe(0);
    expect(w.lines).toEqual([
      "acme/api#12 workspace",
      "  ✓ acme/web   branch bot/api-12     /run/work, this run's",
      "  - acme/api   acme/api#88           /run/others/api, to read only",
      "  - acme/ios   no pull request yet   /run/others/ios, to read only",
      "  - acme/big   no pull request yet   too large to hand over",
    ]);
    expect(existsSync(join(dir, "work"))).toBe(false);
  });
});

describe("the arguments", () => {
  it.each([[], ["--remove"], ["12", "--all"], ["12", "--remove", "13"]])(
    "%s is refused with the usage",
    async (...argv) => {
      const w = world();
      expect(await w.run(...argv)).toBe(2);
      expect(w.errors).toEqual(["Usage: factory workspace N [--remove]"]);
    },
  );
});
