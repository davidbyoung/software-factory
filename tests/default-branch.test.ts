import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { githubRepository } from "../src/code-host/github-setup.mts";
import {
  branchDeps,
  defaultBranch,
  main,
  needDefaultBranch,
  remoteFor,
  repositoryRemote,
  type Deps,
} from "../src/lib/default-branch.mts";

const EVENT = "/runner/event.json";
const ORIGIN_HEAD = "symbolic-ref --short refs/remotes/origin/HEAD";
const HAS_ORIGIN = "remote get-url origin";
const GIT_DEFAULT = "config init.defaultBranch";
const REMOTES = "remote";
const UPSTREAM_HEAD = "symbolic-ref --short refs/remotes/upstream/HEAD";

/** What git answers about these remotes, each a name and its address. */
const remotes = (...listed: [string, string][]) => ({
  [REMOTES]: listed.map(([name]) => `${name}\n`).join(""),
  ...Object.fromEntries(
    listed.map(([name, address]) => [`remote get-url ${name}`, `${address}\n`]),
  ),
});

/** A checkout described by what its git answers, each key a command's
 * arguments joined by spaces, and anything else failing; the event file a
 * workflow run would have; a code host that answers `host`, or fails
 * when it is an Error; and the `repository` line of its settings, where it
 * has settings. Every git command and every question to the host is
 * recorded. */
function checkout(o: {
  git?: Record<string, string>;
  event?: unknown;
  host?: string | Error;
  repository?: string;
}) {
  const ran: string[] = [];
  let asked = 0;
  const d: Deps = {
    env: o.event === undefined ? {} : { GITHUB_EVENT_PATH: EVENT },
    readFile: (path) => {
      if (path !== EVENT) throw new Error(`ENOENT: ${path}`);
      return typeof o.event === "string" ? o.event : JSON.stringify(o.event);
    },
    git: (args) => {
      const key = args.join(" ");
      ran.push(key);
      const out = o.git?.[key];
      return out === undefined ? { ok: false, out: "" } : { ok: true, out };
    },
    host: async () => {
      asked += 1;
      if (o.host === undefined) throw new Error("the host was asked");
      if (o.host instanceof Error) throw o.host;
      return o.host;
    },
    repository: async () => o.repository ?? null,
    repositoryOf: async (address) => githubRepository(address),
  };
  /** `factory default-branch` there. */
  const command = async (argv: string[] = []) => {
    const out: string[] = [];
    const err: string[] = [];
    const code = await main(
      argv,
      d,
      (l) => out.push(l),
      (l) => err.push(l),
    );
    return { code, out, err };
  };
  return { d, ran, asked: () => asked, command };
}

const CLONE = { [HAS_ORIGIN]: "https://example.com/o/r\n" };

describe("factory default-branch", () => {
  it("prints the branch a workflow run's event names, and asks git and the host nothing", async () => {
    const c = checkout({
      event: { repository: { default_branch: "develop" } },
      git: { ...CLONE, [ORIGIN_HEAD]: "origin/main\n" },
    });

    expect(await c.command()).toEqual({ code: 0, out: ["develop"], err: [] });
    expect(c.ran).toEqual([]);
    expect(c.asked()).toBe(0);
  });

  it.each([
    ["names no repository", { schedule: "0 9 * * *" }],
    ["cannot be read as JSON", "not json"],
  ])("goes on to origin/HEAD when the event %s", async (_, event) => {
    const c = checkout({ event, git: { [ORIGIN_HEAD]: "origin/trunk\n" } });

    expect((await c.command()).out).toEqual(["trunk"]);
  });

  it("prints the branch origin/HEAD points to, without origin/, and asks the host nothing", async () => {
    const c = checkout({
      git: { ...CLONE, [ORIGIN_HEAD]: "origin/develop\n" },
    });

    expect(await c.command()).toEqual({ code: 0, out: ["develop"], err: [] });
    expect(c.ran).toEqual([ORIGIN_HEAD]);
    expect(c.asked()).toBe(0);
  });

  it("takes only the remote's name off a branch with a slash in it", async () => {
    const c = checkout({ git: { [ORIGIN_HEAD]: "origin/release/origin/2\n" } });

    expect((await c.command()).out).toEqual(["release/origin/2"]);
  });

  it("asks the code host when origin/HEAD is not set, prints its answer, and sets origin/HEAD to it", async () => {
    const c = checkout({
      git: { ...CLONE, "remote set-head origin develop": "" },
      host: "develop",
    });

    expect(await c.command()).toEqual({ code: 0, out: ["develop"], err: [] });
    expect(c.asked()).toBe(1);
    expect(c.ran.at(-1)).toBe("remote set-head origin develop");
  });

  it("keeps the host's answer when origin/HEAD cannot be set to it", async () => {
    const c = checkout({ git: CLONE, host: "develop" });

    expect(await c.command()).toEqual({ code: 0, out: ["develop"], err: [] });
    expect(c.ran).toContain("remote set-head origin develop");
  });

  it("fails, naming the fix, when there is an origin remote and nobody answers", async () => {
    const c = checkout({ git: CLONE, host: new Error("HTTP 401") });

    expect(await c.command()).toEqual({
      code: 1,
      out: [],
      err: [
        "Could not tell the default branch. Run: git remote set-head origin --auto",
      ],
    });
    expect(c.ran).not.toContain(GIT_DEFAULT);
  });

  it("takes a host that answers with no name as no answer", async () => {
    const c = checkout({ git: CLONE, host: "" });

    expect((await c.command()).code).toBe(1);
    expect(c.ran.some((r) => r.startsWith("remote set-head"))).toBe(false);
  });

  it("prints the branch git's init.defaultBranch names when the checkout has no origin remote, and asks the host nothing", async () => {
    const c = checkout({ git: { [GIT_DEFAULT]: "trunk\n" } });

    expect(await c.command()).toEqual({ code: 0, out: ["trunk"], err: [] });
    expect(c.asked()).toBe(0);
  });

  it("prints main when there is no origin remote and init.defaultBranch is not set", async () => {
    const c = checkout({});

    expect(await c.command()).toEqual({ code: 0, out: ["main"], err: [] });
    expect(c.asked()).toBe(0);
  });

  it("prints its usage and exits 2 for an argument", async () => {
    const c = checkout({ git: { [ORIGIN_HEAD]: "origin/main\n" } });

    expect(await c.command(["--remote"])).toEqual({
      code: 2,
      out: [],
      err: ["Usage: factory default-branch"],
    });
    expect(c.ran).toEqual([]);
  });
});

describe("defaultBranch, for a caller that allows origin/HEAD alone", () => {
  it("answers from origin/HEAD", async () => {
    const c = checkout({ git: { [ORIGIN_HEAD]: "origin/develop\n" } });

    expect(await defaultBranch(c.d, "origin-head")).toBe("develop");
  });

  it("does not read a workflow run's event", async () => {
    const c = checkout({
      event: { repository: { default_branch: "main" } },
      git: { [ORIGIN_HEAD]: "origin/develop\n" },
    });

    expect(await defaultBranch(c.d, "origin-head")).toBe("develop");
  });

  it("cannot tell when origin/HEAD is not set, with an origin remote: it asks no host", async () => {
    const c = checkout({ git: CLONE, host: "develop" });

    expect(await defaultBranch(c.d, "origin-head")).toBeNull();
    expect(c.asked()).toBe(0);
    expect(c.ran).toEqual([ORIGIN_HEAD]);
  });

  it("cannot tell when origin/HEAD is not set, with no origin remote: it does not take git's own default", async () => {
    const c = checkout({ git: { [GIT_DEFAULT]: "trunk\n" } });

    expect(await defaultBranch(c.d, "origin-head")).toBeNull();
  });
});

describe("needDefaultBranch", () => {
  it("gives the name where one answers", async () => {
    const c = checkout({ git: { [ORIGIN_HEAD]: "origin/develop\n" } });

    expect(await needDefaultBranch(c.d)).toBe("develop");
  });

  it("throws the line that names the fix where none does", async () => {
    const c = checkout({ git: CLONE, host: new Error("offline") });

    await expect(needDefaultBranch(c.d)).rejects.toThrow(
      "Could not tell the default branch. Run: git remote set-head origin --auto",
    );
  });
});

// A fork's checkout: `origin` is the fork, and the settings name the
// repository it was forked from, which is the remote `upstream`.
describe("in a checkout whose settings have a repository line", () => {
  const FORK = remotes(
    ["origin", "git@github.com:dev/web.git"],
    ["upstream", "https://github.com/acme/web.git"],
  );

  it("prints the branch the HEAD of that repository's remote points to, whatever the remote is called", async () => {
    const c = checkout({
      repository: "acme/web",
      git: {
        ...FORK,
        [ORIGIN_HEAD]: "origin/main\n",
        [UPSTREAM_HEAD]: "upstream/develop\n",
      },
    });

    expect(await c.command()).toEqual({ code: 0, out: ["develop"], err: [] });
    expect(c.ran).toEqual([
      REMOTES,
      "remote get-url origin",
      "remote get-url upstream",
      UPSTREAM_HEAD,
    ]);
    expect(c.asked()).toBe(0);
  });

  it.each([
    "git@github.com:acme/web.git",
    "ssh://git@github.com/acme/web.git",
    "https://github.com/acme/web",
    "https://github.com/Acme/Web.git",
  ])("takes %s as the address of acme/web", async (address) => {
    const c = checkout({
      repository: "acme/web",
      git: {
        ...remotes(["upstream", address]),
        [UPSTREAM_HEAD]: "upstream/trunk\n",
      },
    });

    expect((await c.command()).out).toEqual(["trunk"]);
  });

  it("asks the code host when that remote's HEAD is not set, and sets that remote's HEAD to its answer", async () => {
    const c = checkout({
      repository: "acme/web",
      git: { ...FORK, [ORIGIN_HEAD]: "origin/main\n" },
      host: "develop",
    });

    expect(await c.command()).toEqual({ code: 0, out: ["develop"], err: [] });
    expect(c.ran.at(-1)).toBe("remote set-head upstream develop");
  });

  it("names that remote in the fix when nobody answers", async () => {
    const c = checkout({
      repository: "acme/web",
      git: FORK,
      host: new Error("HTTP 401"),
    });

    expect(await c.command()).toEqual({
      code: 1,
      out: [],
      err: [
        "Could not tell the default branch. Run: git remote set-head upstream --auto",
      ],
    });
  });

  it("reads origin where two remotes are that repository's and one is origin", async () => {
    const c = checkout({
      repository: "acme/web",
      git: {
        ...remotes(
          ["backup", "https://github.com/acme/web.git"],
          ["origin", "git@github.com:acme/web.git"],
        ),
        [ORIGIN_HEAD]: "origin/develop\n",
      },
    });

    expect((await c.command()).out).toEqual(["develop"]);
  });

  it("fails with the line that names the repository and origin's, when no remote is that repository's", async () => {
    const c = checkout({
      repository: "acme/web",
      git: {
        ...remotes(["origin", "git@github.com:dev/web.git"]),
        [ORIGIN_HEAD]: "origin/main\n",
        [GIT_DEFAULT]: "trunk\n",
      },
      host: "main",
    });

    expect(await c.command()).toEqual({
      code: 1,
      out: [],
      err: [
        "✗ repository: .claude/factory.yaml says acme/web, and no remote here is acme/web. origin is dev/web. Add the remote, or change the line and run factory sync.",
      ],
    });
    expect(c.ran).toEqual([REMOTES, "remote get-url origin"]);
    expect(c.asked()).toBe(0);
  });

  it.each([
    ["there is no remote", remotes()],
    [
      "the only remote is not called origin",
      remotes(["fork", "git@github.com:dev/web.git"]),
    ],
    [
      "the only remote is not called origin, and its address names no repository",
      remotes(["work", "git@github-work:acme/web.git"]),
    ],
  ])("leaves origin out of that line when %s", async (_, listed) => {
    const c = checkout({
      repository: "acme/web",
      git: { ...listed, [GIT_DEFAULT]: "trunk\n" },
    });

    expect(await c.command()).toEqual({
      code: 1,
      out: [],
      err: [
        "✗ repository: .claude/factory.yaml says acme/web, and no remote here is acme/web. Add the remote, or change the line and run factory sync.",
      ],
    });
  });

  it.each([
    ["an SSH host alias", "git@github-work:acme/web.git"],
    ["a proxy's address", "https://git-proxy.example.com/acme/web.git"],
  ])(
    "reads origin where its address is %s, which names no repository the factory can read, and no other remote is that repository's",
    async (_, address) => {
      const c = checkout({
        repository: "acme/web",
        git: {
          ...remotes(
            ["origin", address],
            ["fork", "git@github.com:dev/web.git"],
          ),
          [ORIGIN_HEAD]: "origin/develop\n",
        },
      });

      expect(await c.command()).toEqual({
        code: 0,
        out: ["develop"],
        err: [],
      });
    },
  );

  it("still takes a workflow run's event first, and reads no remote", async () => {
    const c = checkout({
      repository: "acme/web",
      event: { repository: { default_branch: "develop" } },
      git: remotes(["origin", "git@github.com:dev/web.git"]),
    });

    expect(await c.command()).toEqual({ code: 0, out: ["develop"], err: [] });
    expect(c.ran).toEqual([]);
  });

  it("fails the same way for a caller that cannot go on without the default branch", async () => {
    const c = checkout({ repository: "acme/web", git: remotes() });

    await expect(needDefaultBranch(c.d)).rejects.toThrow(
      "✗ repository: .claude/factory.yaml says acme/web, and no remote here is acme/web. Add the remote",
    );
  });
});

describe("repositoryRemote", () => {
  it("is origin in a checkout with no settings, and asks git nothing", async () => {
    const c = checkout({
      git: remotes(["upstream", "git@github.com:acme/web.git"]),
    });

    expect(await repositoryRemote(c.d)).toBe("origin");
    expect(c.ran).toEqual([]);
  });

  it("is the remote whose address is the repository line's", async () => {
    const c = checkout({
      repository: "acme/web",
      git: remotes(
        ["origin", "git@github.com:dev/web.git"],
        ["upstream", "git@github.com:acme/web.git"],
      ),
    });

    expect(await repositoryRemote(c.d)).toBe("upstream");
  });
});

describe("remoteFor", () => {
  it("is null when no remote is the repository's", () => {
    expect(
      remoteFor("acme/web", [
        { name: "origin", repository: "dev/web" },
        { name: "mirror", repository: null },
      ]),
    ).toBeNull();
  });

  it("is origin where no remote is the repository's and origin's address names none", () => {
    expect(
      remoteFor("acme/web", [
        { name: "fork", repository: "dev/web" },
        { name: "origin", repository: null },
      ]),
    ).toBe("origin");
  });

  it("is the remote that is the repository's, not an origin whose address names none", () => {
    expect(
      remoteFor("acme/web", [
        { name: "origin", repository: null },
        { name: "upstream", repository: "acme/web" },
      ]),
    ).toBe("upstream");
  });

  it("is null where a remote whose address names no repository is not called origin", () => {
    expect(
      remoteFor("acme/web", [{ name: "work", repository: null }]),
    ).toBeNull();
  });

  it("is the first remote that is the repository's, where none of them is origin", () => {
    expect(
      remoteFor("acme/web", [
        { name: "fork", repository: "dev/web" },
        { name: "upstream", repository: "acme/web" },
        { name: "work", repository: "acme/web" },
      ]),
    ).toBe("upstream");
  });
});

describe("the repository line of the checkout at a folder", () => {
  let root: string;

  /** A folder whose `.claude/factory.yaml` holds `settings`, when given. */
  function folder(settings?: string): string {
    root = mkdtempSync(join(tmpdir(), "factory-branch-"));
    if (settings !== undefined) {
      mkdirSync(join(root, ".claude"));
      writeFileSync(join(root, ".claude/factory.yaml"), settings);
    }
    return root;
  }

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("is the settings file's own", async () => {
    const dir = folder("version: 2\nrepository: acme/web\n");

    expect(await branchDeps(dir, {}).repository()).toBe("acme/web");
  });

  it.each([
    ["has no settings file", undefined],
    ["has settings with no such line", "version: 2\n"],
    ["has settings that are not YAML", "repository: [acme/web\n"],
    ["has a line that is not text", "repository: 12\n"],
  ])("is none where the checkout %s", async (_, settings) => {
    expect(await branchDeps(folder(settings), {}).repository()).toBeNull();
  });

  it("is the line of the file FACTORY_SETTINGS names, where it is set", async () => {
    const dir = folder("repository: acme/web\n");
    const other = join(dir, "other.yaml");
    writeFileSync(other, "repository: acme/site\n");

    expect(
      await branchDeps(dir, { FACTORY_SETTINGS: other }).repository(),
    ).toBe("acme/site");
  });
});
