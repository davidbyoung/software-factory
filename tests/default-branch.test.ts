import { describe, expect, it } from "vitest";
import {
  CANNOT_TELL,
  defaultBranch,
  main,
  needDefaultBranch,
  type Deps,
} from "../src/lib/default-branch.mts";

const EVENT = "/runner/event.json";
const ORIGIN_HEAD = "symbolic-ref --short refs/remotes/origin/HEAD";
const HAS_ORIGIN = "remote get-url origin";
const GIT_DEFAULT = "config init.defaultBranch";

/** A checkout described by what its git answers, each key a command's
 * arguments joined by spaces, and anything else failing; the event file a
 * workflow run would have; and a code host that answers `host`, or fails
 * when it is an Error. Every git command and every question to the host is
 * recorded. */
function checkout(o: {
  git?: Record<string, string>;
  event?: unknown;
  host?: string | Error;
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

    await expect(needDefaultBranch(c.d)).rejects.toThrow(CANNOT_TELL);
  });
});
