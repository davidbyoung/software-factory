// Which copy of the factory the `factory` command runs, decided from the
// folders alone: the launcher in bin/factory.js only carries it out.
import { describe, expect, it } from "vitest";
import { chooseEntry } from "../bin/launch.js";

const NAME = "@acme/factory";

/** A file system holding only `files`, each path absolute. */
function fs(files: string[], links: Record<string, string> = {}) {
  const has = (path: string) =>
    files.some((f) => f === path || f.startsWith(`${path}/`));
  return {
    exists: has,
    readName: (path: string) => (has(path) ? NAME : null),
    realpath: (path: string) => links[path] ?? path,
  };
}

const choose = (
  cwd: string,
  here: string,
  files: string[],
  links?: Record<string, string>,
) => chooseEntry({ cwd, here, name: NAME, ...fs(files, links) });

describe("chooseEntry", () => {
  it("runs the factory's own source in the factory's repository, from a global install", () => {
    expect(
      choose("/repo/src", "/usr/lib/node_modules/@acme/factory", [
        "/repo/.git",
        "/repo/package.json",
        "/repo/src/cli.mts",
      ]),
    ).toEqual({ run: "/repo/src/cli.mts" });
  });

  it("runs a worktree's own source, not the clone's it sits in", () => {
    expect(
      choose(
        "/repo/.claude/worktrees/w/src",
        "/usr/lib/node_modules/@acme/factory",
        [
          "/repo/.git",
          "/repo/package.json",
          "/repo/src/cli.mts",
          "/repo/.claude/worktrees/w/.git",
          "/repo/.claude/worktrees/w/package.json",
          "/repo/.claude/worktrees/w/src/cli.mts",
        ],
      ),
    ).toEqual({ run: "/repo/.claude/worktrees/w/src/cli.mts" });
  });

  it("hands a global install's run to the copy the repository installed", () => {
    expect(
      choose("/repo/src", "/usr/lib/node_modules/@acme/factory", [
        "/repo/.git",
        "/repo/node_modules/@acme/factory/package.json",
        "/repo/node_modules/@acme/factory/bin/factory.js",
        "/usr/lib/node_modules/@acme/factory/dist/cli.mjs",
      ]),
    ).toEqual({ launch: "/repo/node_modules/@acme/factory/bin/factory.js" });
  });

  it("runs itself when it is the repository's installed copy, never handing off to itself", () => {
    expect(
      choose("/repo", "/repo/node_modules/@acme/factory", [
        "/repo/.git",
        "/repo/node_modules/@acme/factory/package.json",
        "/repo/node_modules/@acme/factory/bin/factory.js",
        "/repo/node_modules/@acme/factory/dist/cli.mjs",
      ]),
    ).toEqual({ run: "/repo/node_modules/@acme/factory/dist/cli.mjs" });
  });

  it("knows itself through a link, as a workspace installs it", () => {
    expect(
      choose(
        "/repo",
        "/repo/packages/f",
        [
          "/repo/.git",
          "/repo/node_modules/@acme/factory/package.json",
          "/repo/node_modules/@acme/factory/bin/factory.js",
          "/repo/packages/f/src/cli.mts",
        ],
        { "/repo/node_modules/@acme/factory": "/repo/packages/f" },
      ),
    ).toEqual({ run: "/repo/packages/f/src/cli.mts" });
  });

  it("says so when run from a repository that has no copy of its own", () => {
    expect(
      choose("/repo", "/usr/lib/node_modules/@acme/factory", [
        "/repo/.git",
        "/usr/lib/node_modules/@acme/factory/dist/cli.mjs",
      ]),
    ).toEqual({ missing: "/repo" });
  });

  it("runs itself outside any repository, as the poller's image does", () => {
    expect(
      choose("/app", "/app/node_modules/@acme/factory", [
        "/app/node_modules/@acme/factory/dist/cli.mjs",
      ]),
    ).toEqual({ run: "/app/node_modules/@acme/factory/dist/cli.mjs" });
  });

  it("runs the source beside it before dist/", () => {
    expect(
      choose("/elsewhere", "/pkg", ["/pkg/src/cli.mts", "/pkg/dist/cli.mjs"]),
    ).toEqual({ run: "/pkg/src/cli.mts" });
  });
});
