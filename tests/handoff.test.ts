import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openCodeHost } from "../src/code-host/index.mts";
import { HANDOFF, type RunFile } from "../src/handoff/index.mts";
import { readRequests } from "../src/handoff/requests.mts";
import { main as prMain } from "../src/pr.mts";
import { memoryCodeHost } from "./memory-code-host";
import { memoryRunner } from "./memory-runner";

const LAUNCHER = fileURLToPath(new URL("../bin/factory.js", import.meta.url));
const RUN: RunFile = {
  version: 1,
  kind: "answer",
  repository: "acme/widgets",
  remote: "https://github.com/acme/widgets.git",
  defaultBranch: "trunk",
  base: "a".repeat(40),
  branch: "12-add-a-thing",
  ticket: "12",
  ref: "#12",
  pull: 31,
  round: 1,
  claim: null,
  committer: { name: "factory[bot]", email: "1+factory[bot]@example.com" },
};

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "handoff-"));
  mkdirSync(join(dir, "in"));
  mkdirSync(join(dir, "out"));
  writeFileSync(join(dir, "in/run.json"), JSON.stringify(RUN));
  writeFileSync(join(dir, "in/snapshot.json"), "[]");
});
afterEach(() => {
  delete process.env[HANDOFF];
  rmSync(dir, { recursive: true, force: true });
});

/** A `factory` command as a session in the cloud runs it, on a machine
 * whose GitHub CLI is not found. */
const factory = (...args: string[]) =>
  spawnSync(process.execPath, [LAUNCHER, ...args], {
    encoding: "utf8",
    cwd: dir,
    env: { [HANDOFF]: dir, PATH: "/usr/bin:/bin", HOME: dir },
  });

const asked = () =>
  readRequests(readFileSync(join(dir, "out/request.json"), "utf8"));

describe("a factory command in a session in the cloud", () => {
  it("is asked for when it would write, with its file's text", () => {
    writeFileSync(join(dir, "r.md"), "Fixed.");
    const first = factory("pr", "reply", "31", "901", "--body-file", "r.md");
    factory("pr", "resolve", "31", "901");

    expect(first.stdout).toBe("Asked: factory pr reply 31\n");
    expect(asked()).toEqual([
      {
        argv: ["pr", "reply", "31", "901", "--body-file", "r.md"],
        files: { "r.md": "Fixed." },
      },
      { argv: ["pr", "resolve", "31", "901"], files: {} },
    ]);
  });

  it("is told at once when it can't be asked for, so it can ask again", () => {
    const wrong = factory("pr", "resolve", "31", "901", "902");
    expect(wrong.status).toBe(1);
    expect(wrong.stdout).toBe(
      "✗ Can't ask for this. factory pr resolve 31: it takes fewer words\n",
    );
    expect(factory("ticket", "label", "12", "--add", "spec").status).toBe(1);
    expect(() => asked()).toThrow();
  });

  it.each([
    ["ticket", "cost", "12"],
    ["pr", "cost", "31"],
    ["pr", "ready", "31"],
  ])(
    "is not kept for what Publish does itself, as factory %s %s",
    (...args) => {
      expect(factory(...args).status).toBe(0);
      expect(() => asked()).toThrow();
    },
  );

  it("finds its ticket claimed", () => {
    expect(factory("ticket", "claim", "12").stdout).toBe("claimed\n");
    expect(factory("ticket", "still-live", "12").stdout).toBe("live\n");
  });

  it("does not find another ticket claimed", () => {
    const r = factory("ticket", "claim", "13");
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("This run is for ticket 12, not 13.");
  });

  it.each([
    ["pr", "state", "31", "--wait"],
    ["pr", "wait-checks", "31"],
    ["pr", "watch", "31"],
  ])("ends the run in place of waiting, as factory %s %s", (...args) => {
    const r = factory(...args);
    expect(r.stdout).toBe(
      "This run ends here. The next one starts when CI and the review have finished.\n",
    );
    expect(r.status).toBe(0);
  });
});

describe("factory pr push and pull", () => {
  const git = (cwd: string, ...args: string[]) =>
    execFileSync(
      "git",
      ["-c", "user.name=a", "-c", "user.email=a@example.com", ...args],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  let work: string;
  /** A repository on a branch, one commit past `base`. */
  beforeEach(() => {
    work = join(dir, "work");
    git(dir, "init", "-q", "-b", "trunk", work);
    git(work, "commit", "-q", "--allow-empty", "-m", "first");
    const base = git(work, "rev-parse", "HEAD");
    writeFileSync(join(dir, "in/run.json"), JSON.stringify({ ...RUN, base }));
    git(work, "switch", "-q", "-c", "12-add-a-thing");
  });
  const commit = () => git(work, "commit", "-q", "--allow-empty", "-m", "work");
  const asked = async (
    step: string,
    env: Record<string, string>,
    ran: string[][] = [],
  ) => {
    const out: string[] = [];
    const code = await prMain([step], {
      repository: "acme/widgets",
      codeHost: memoryCodeHost([], { defaultBranch: "trunk" }).codeHost,
      runner: memoryRunner().runner,
      sleep: async () => {},
      out: (line) => out.push(line),
      readFile: () => "",
      git(args) {
        ran.push(args);
        return ["push", "pull"].includes(args[0]) ? "" : git(work, ...args);
      },
      remote: async () => "upstream",
      env,
    });
    return { code, out, ran };
  };

  it("hands a session's commits over, and pushes nothing", async () => {
    commit();
    const r = await asked("push", { [HANDOFF]: dir });
    expect(r.out).toEqual(["Handed over 1 commit on 12-add-a-thing."]);
    expect(r.ran.some(([c]) => c === "push")).toBe(false);
    const heads = git(
      work,
      "bundle",
      "list-heads",
      join(dir, "out/build.bundle"),
    );
    expect(heads).toBe(`${git(work, "rev-parse", "HEAD")} HEAD`);
  });

  it("fails a session that committed nothing", async () => {
    expect((await asked("push", { [HANDOFF]: dir })).code).not.toBe(0);
  });

  it("pushes the branch to the repository's remote anywhere else", async () => {
    commit();
    const r = await asked("push", {});
    expect(r.ran.at(-1)).toEqual([
      "push",
      "-q",
      "-u",
      "upstream",
      "12-add-a-thing",
    ]);
  });

  it("never pushes the default branch", async () => {
    git(work, "switch", "-q", "trunk");
    const r = await asked("push", {});
    expect(r.code).not.toBe(0);
    expect(r.ran.some(([c]) => c === "push")).toBe(false);
  });

  it("pulls only where there is a remote to pull from", async () => {
    expect(
      (await asked("pull", { [HANDOFF]: dir })).ran.some(([c]) => c === "pull"),
    ).toBe(false);
    expect((await asked("pull", {})).ran.at(-1)).toEqual([
      "pull",
      "-q",
      "--no-rebase",
      "upstream",
      "12-add-a-thing",
    ]);
  });
});

describe("an adapter in a session in the cloud", () => {
  it("answers only what was handed over", async () => {
    writeFileSync(
      join(dir, "in/snapshot.json"),
      JSON.stringify([
        { on: "codeHost", call: "forBranch", args: ["b"], value: 31 },
      ]),
    );
    process.env[HANDOFF] = dir;
    const reached = () => {
      throw new Error("the code host was reached");
    };
    const host = openCodeHost("acme/widgets", "github", reached);

    expect(await host.forBranch("b")).toBe(31);
    await expect(host.get(40)).rejects.toThrow(
      "✗ The code host's get of 40 was not handed to this run. Go on without it, or stop with: factory ticket stop 12 \"needs the code host's get of 40\"",
    );
  });
});
