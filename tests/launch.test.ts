// Which copy of the factory the `factory` command runs, decided from the
// folders, the repository's lock, and the environment alone: the launcher
// in bin/factory.js only carries it out.
import { describe, expect, it } from "vitest";
import {
  cacheRoot,
  chooseEntry,
  install,
  lastNpmError,
} from "../bin/launch.js";

const NAME = "@acme/factory";
const GLOBAL = "/usr/lib/node_modules/@acme/factory";
const CACHE = "/home/sam/.cache/software-factory";

/** A file system holding only `files`, each path absolute, and the text of
 * those in `texts`. */
function fs(files: string[], texts: Record<string, string> = {}) {
  const all = [...files, ...Object.keys(texts)];
  const has = (path: string) =>
    all.some((f) => f === path || f.startsWith(`${path}/`));
  return {
    exists: has,
    readName: (path: string) => (has(path) ? NAME : null),
    read: (path: string) => texts[path] ?? null,
  };
}

const lock = (version: string) =>
  `# Written by \`factory sync\`.\nversion: ${version}\npresets: []\n`;

function choose(o: {
  cwd: string;
  here?: string;
  files?: string[];
  texts?: Record<string, string>;
  env?: Record<string, string>;
  command?: string;
}) {
  return chooseEntry({
    cwd: o.cwd,
    here: o.here ?? GLOBAL,
    name: NAME,
    version: "0.3.0",
    cache: CACHE,
    env: o.env ?? {},
    command: o.command ?? "status",
    ...fs([`${GLOBAL}/dist/cli.mjs`, ...(o.files ?? [])], o.texts),
  });
}

const SELF = { run: `${GLOBAL}/dist/cli.mjs` };
const cached = (version: string) =>
  `${CACHE}/versions/${version}/node_modules/${NAME}/dist/cli.mjs`;

describe("chooseEntry", () => {
  it("runs the factory's own source in the factory's repository, from a global install", () => {
    expect(
      choose({
        cwd: "/repo/src",
        files: ["/repo/.git", "/repo/package.json", "/repo/src/cli.mts"],
        texts: { "/repo/.claude/factory.lock": lock("0.0.0-development") },
      }),
    ).toEqual({ run: "/repo/src/cli.mts" });
  });

  it("runs a worktree's own source, not the clone's it sits in", () => {
    expect(
      choose({
        cwd: "/repo/.claude/worktrees/w/src",
        files: [
          "/repo/.git",
          "/repo/package.json",
          "/repo/src/cli.mts",
          "/repo/.claude/worktrees/w/.git",
          "/repo/.claude/worktrees/w/package.json",
          "/repo/.claude/worktrees/w/src/cli.mts",
        ],
      }),
    ).toEqual({ run: "/repo/.claude/worktrees/w/src/cli.mts" });
  });

  it("runs itself when the repository names the version installed on the machine", () => {
    expect(
      choose({
        cwd: "/repo/src",
        files: ["/repo/.git"],
        texts: { "/repo/.claude/factory.lock": lock("0.3.0") },
      }),
    ).toEqual(SELF);
  });

  it("runs the cached copy of the version the repository names", () => {
    expect(
      choose({
        cwd: "/repo",
        files: ["/repo/.git", cached("0.2.0")],
        texts: { "/repo/.claude/factory.lock": lock("0.2.0") },
      }),
    ).toEqual({ run: cached("0.2.0") });
  });

  it("asks for a download when the version the repository names is not cached", () => {
    expect(
      choose({
        cwd: "/repo",
        files: ["/repo/.git"],
        texts: { "/repo/.claude/factory.lock": lock("0.2.0") },
      }),
    ).toEqual({
      download: {
        version: "0.2.0",
        dir: `${CACHE}/versions/0.2.0`,
        entry: cached("0.2.0"),
      },
    });
  });

  it("refuses a lock that names something that is not a release", () => {
    expect(
      choose({
        cwd: "/repo",
        files: ["/repo/.git"],
        texts: { "/repo/.claude/factory.lock": lock("0.0.0-development") },
      }),
    ).toEqual({
      fault:
        "✗ .claude/factory.lock names the factory 0.0.0-development, which is not a release. Run: factory update",
    });
  });

  it("runs itself in a repository with no lock, as before it is set up", () => {
    expect(choose({ cwd: "/repo", files: ["/repo/.git"] })).toEqual(SELF);
  });

  it("runs itself outside any repository, as the poller's image does", () => {
    expect(choose({ cwd: "/app" })).toEqual(SELF);
  });

  it("starts factory update in the installed version, whatever the lock names", () => {
    expect(
      choose({
        cwd: "/repo",
        command: "update",
        files: ["/repo/.git"],
        texts: { "/repo/.claude/factory.lock": lock("0.1.15") },
      }),
    ).toEqual(SELF);
  });

  it("takes the version from FACTORY_VERSION over the lock, as update's sync does", () => {
    expect(
      choose({
        cwd: "/repo",
        command: "sync",
        env: { FACTORY_VERSION: "0.4.0" },
        files: ["/repo/.git", cached("0.4.0")],
        texts: { "/repo/.claude/factory.lock": lock("0.2.0") },
      }),
    ).toEqual({ run: cached("0.4.0") });
  });

  it("runs the source beside it before dist/", () => {
    expect(
      choose({
        cwd: "/elsewhere",
        here: "/pkg",
        files: ["/pkg/src/cli.mts", "/pkg/dist/cli.mjs"],
      }),
    ).toEqual({ run: "/pkg/src/cli.mts" });
  });
});

describe("cacheRoot", () => {
  it("is ~/.cache/software-factory", () => {
    expect(cacheRoot({}, "/home/sam")).toBe(CACHE);
  });

  it("follows XDG_CACHE_HOME when it is set", () => {
    expect(cacheRoot({ XDG_CACHE_HOME: "/var/cache" }, "/home/sam")).toBe(
      "/var/cache/software-factory",
    );
  });
});

describe("lastNpmError", () => {
  it("is npm's last error line, leaving out the one that names its log", () => {
    expect(
      lastNpmError(
        [
          "npm error code E404",
          "npm error 404 Not Found - GET https://registry.npmjs.org/@acme%2ffactory - Not found",
          "npm error 404 '@acme/factory@0.9.0' is not in this registry.",
          "npm error A complete log of this run can be found in: /home/sam/.npm/_logs/x.log",
        ].join("\n"),
      ),
    ).toBe("npm error 404 '@acme/factory@0.9.0' is not in this registry.");
  });

  it("is the output's last line when npm printed no error line", () => {
    expect(lastNpmError("spawn npm ENOENT\n")).toBe("spawn npm ENOENT");
  });
});

describe("install", () => {
  const download = {
    version: "0.2.0",
    dir: `${CACHE}/versions/0.2.0`,
    entry: cached("0.2.0"),
  };

  function run(o: { status: number; output?: string; taken?: boolean }) {
    const files = new Set<string>();
    const calls: string[] = [];
    const why = install(download, {
      name: NAME,
      pid: 42,
      npm: (args) => {
        calls.push(`npm ${args.join(" ")}`);
        return { status: o.status, output: o.output ?? "" };
      },
      mkdir: (path) => calls.push(`mkdir ${path}`),
      rename: (from, to) => {
        if (o.taken) throw new Error("ENOTEMPTY");
        calls.push(`rename ${from} ${to}`);
        files.add(download.entry);
      },
      remove: (path) => calls.push(`remove ${path}`),
      exists: (path) => files.has(path) || Boolean(o.taken),
    });
    return { why, calls };
  }

  it("installs the version into a folder of its own and moves it into place", () => {
    const staging = `${download.dir}.42`;
    expect(run({ status: 0 })).toEqual({
      why: null,
      calls: [
        `mkdir ${staging}`,
        `npm install --prefix ${staging} --no-save --no-audit --no-fund ${NAME}@0.2.0`,
        `rename ${staging} ${download.dir}`,
        `remove ${staging}`,
      ],
    });
  });

  it("uses the copy another command put there first", () => {
    expect(run({ status: 0, taken: true }).why).toBeNull();
  });

  it("says why npm failed, and leaves nothing in the cache", () => {
    const { why, calls } = run({
      status: 1,
      output: "npm error code ETARGET\nnpm error notarget No matching version",
    });
    expect(why).toBe("npm error notarget No matching version");
    expect(calls.some((c) => c.startsWith("rename"))).toBe(false);
    expect(calls.at(-1)).toBe(`remove ${download.dir}.42`);
  });
});
