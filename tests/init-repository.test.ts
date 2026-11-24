// `factory init`, which repository: the settings' line, or the one the
// remotes name, a fork's parent among the choices, and whether the checkout
// can hold the setup's commit.
import { describe, expect, it } from "vitest";
import { githubForkOf } from "../src/code-host/github-setup.mts";
import { CODE_HOST_YAML } from "./settings-fixture";
import { scriptedAgent } from "./fake-tools";
import { init, type Setup } from "./init-harness";

const QUESTION = "select: Which repository are you setting up?";
/** A first run that goes ahead with no part on. */
const quick = (over: Partial<Setup> = {}) =>
  init({ answers: { checkbox: [[]], confirm: [true] }, ...over });
const FIRST_LINE = (repository: string) =>
  `Setting up the software factory for ${repository}`;

describe("factory init, a repository line in the settings", () => {
  const SETTINGS = `version: 2\nrepository: acme/web\n${CODE_HOST_YAML}\n`;
  const FORK = [
    { name: "origin", url: "git@github.com:dev/web.git" },
    { name: "upstream", url: "git@github.com:acme/web.git" },
  ];

  it("uses the line, asking nothing of the remotes or the code host about forks", async () => {
    const r = quick({
      settings: SETTINGS,
      remotes: FORK,
      forks: { "dev/web": "acme/web" },
    });
    expect(await r.run()).toBe(0);
    expect(r.out[0]).toBe(FIRST_LINE("acme/web"));
    expect(r.asked).not.toContain(QUESTION);
    expect(r.forksAsked).toEqual([]);
  });

  it("fetches from, and pushes to, the remote whose address is the line's, whatever it is called", async () => {
    const r = quick({ settings: SETTINGS, remotes: FORK });
    await r.run();
    expect(r.git).toContainEqual(["fetch", "--quiet", "upstream", "main"]);
    expect(r.git).toContainEqual([
      "push",
      "--quiet",
      "--set-upstream",
      "upstream",
      "set-up-factory",
    ]);
  });

  it("stops, naming origin's repository, when no remote is the line's", async () => {
    const r = quick({ settings: SETTINGS, remotes: [FORK[0]!] });
    expect(await r.run()).toBe(1);
    expect(r.out).toEqual([
      "✗ repository: .claude/factory.yaml says acme/web, and no remote here is acme/web. origin is dev/web. Add the remote, or change the line and run factory sync.",
    ]);
    expect(r.asked).toEqual([]);
  });
});

describe("factory init, the repository its remotes name", () => {
  it("uses the one repository among them when it is no fork, and asks nothing", async () => {
    const r = quick({
      remotes: [{ name: "github", url: "https://github.com/acme/web.git" }],
    });
    expect(await r.run()).toBe(0);
    expect(r.out[0]).toBe(FIRST_LINE("acme/web"));
    expect(r.asked).not.toContain(QUESTION);
    expect(r.yaml().repository).toBe("acme/web");
    expect(r.git).toContainEqual(["fetch", "--quiet", "github", "main"]);
  });

  it("counts two addresses of one repository as one", async () => {
    const r = quick({
      remotes: [
        { name: "ssh", url: "git@github.com:acme/web.git" },
        { name: "origin", url: "https://github.com/Acme/Web" },
      ],
    });
    expect(await r.run()).toBe(0);
    expect(r.asked).not.toContain(QUESTION);
    expect(r.git).toContainEqual(["fetch", "--quiet", "origin", "main"]);
  });

  it("asks which, with a repository that is not a fork first, when the remotes name several", async () => {
    const r = init({
      remotes: [
        { name: "origin", url: "git@github.com:dev/web.git" },
        { name: "upstream", url: "git@github.com:acme/web.git" },
      ],
      forks: { "dev/web": "acme/web" },
      answers: { select: ["acme/web"], checkbox: [[]], confirm: [true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.asked[0]).toBe(QUESTION);
    expect(r.selects[0]!.names).toEqual([
      "acme/web   the remote upstream",
      "dev/web    the remote origin, a fork of acme/web",
    ]);
    expect(r.out[0]).toBe(FIRST_LINE("acme/web"));
    expect(r.out).not.toContain("Added the remote upstream, acme/web.");
  });

  it("asks about one repository that is a fork, with the repository it was forked from first", async () => {
    const r = init({
      remotes: [{ name: "origin", url: "git@github.com:dev/web.git" }],
      forks: { "dev/web": "acme/web" },
      answers: { select: ["dev/web"], checkbox: [[]], confirm: [true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.selects[0]!.names).toEqual([
      "acme/web   no remote here yet",
      "dev/web    the remote origin, a fork of acme/web",
    ]);
    expect(r.out[0]).toBe(FIRST_LINE("dev/web"));
  });

  it("asks, listing each remote's repository, when the code host cannot say which is a fork", async () => {
    const r = init({
      remotes: [{ name: "origin", url: "git@github.com:dev/web.git" }],
      forks: false,
      answers: { select: ["dev/web"], checkbox: [[]], confirm: [true] },
    });
    expect(await r.run()).toBe(0);
    expect(r.asked[0]).toBe(QUESTION);
    expect(r.selects[0]!.names).toEqual(["dev/web   the remote origin"]);
  });

  it("names every remote of a repository that has several", async () => {
    const r = init({
      remotes: [
        { name: "origin", url: "git@github.com:dev/web.git" },
        { name: "mine", url: "https://github.com/dev/web.git" },
        { name: "upstream", url: "git@github.com:acme/web.git" },
      ],
      answers: { select: ["dev/web"], checkbox: [[]], confirm: [true] },
    });
    await r.run();
    expect(r.selects[0]!.names).toEqual([
      "dev/web    the remotes origin and mine",
      "acme/web   the remote upstream",
    ]);
  });
});

describe("factory init, a repository chosen that is no remote yet", () => {
  const fork = (over: Partial<Setup> = {}) =>
    init({
      remotes: [{ name: "origin", url: "git@github.com:dev/web.git" }],
      forks: { "dev/web": "acme/web" },
      answers: { select: ["acme/web"], checkbox: [[]], confirm: [true] },
      ...over,
    });
  const ADDRESS = "git@github.com:acme/web.git";
  const GO = "? confirm: Go ahead?";
  const added = (r: ReturnType<typeof init>) =>
    r.git.filter((args) => args[0] === "remote");

  it("plans adding it as the remote upstream, first", async () => {
    const r = fork();
    await r.run();
    const at = r.out.indexOf("This is everything setup will do:");
    expect(r.out[at + 1]).toBe(
      "  remote        Add the remote upstream, acme/web",
    );
  });

  it("adds it once told to go ahead, at the fork's own kind of address, before anything else, and says so", async () => {
    const r = fork();
    expect(await r.run()).toBe(0);
    expect(added(r)).toEqual([["remote", "add", "upstream", ADDRESS]]);
    expect(r.events.indexOf("git remote")).toBeGreaterThan(
      r.events.indexOf(GO),
    );
    expect(r.transcript[r.transcript.indexOf(GO) + 1]).toBe(
      "Added the remote upstream, acme/web.",
    );
    expect(r.out[0]).toBe(FIRST_LINE("acme/web"));
  });

  it("pushes the setup's branch to the remote it added", async () => {
    const r = fork();
    await r.run();
    const pushed = r.git.find((args) => args[0] === "push")!;
    expect(pushed).toContain("upstream");
    expect(pushed).not.toContain("origin");
  });

  it("names it upstream-2 when a remote is called upstream already", async () => {
    const r = fork({
      remotes: [
        { name: "origin", url: "https://github.com/dev/web.git" },
        { name: "upstream", url: "https://gitlab.com/else/where.git" },
      ],
    });
    expect(await r.run()).toBe(0);
    expect(added(r)).toEqual([
      ["remote", "add", "upstream-2", "https://github.com/acme/web.git"],
    ]);
    expect(r.out).toContain("Added the remote upstream-2, acme/web.");
  });

  it("reads the default branch, and the branch names taken, from its address until then", async () => {
    const r = fork();
    await r.run();
    expect(r.git).toContainEqual(["fetch", "--quiet", ADDRESS, "main"]);
    const looked = r.git.filter((args) => args[0] === "ls-remote");
    expect(looked.length).toBeGreaterThan(0);
    for (const args of looked) expect(args).toContain(ADDRESS);
    expect(r.events.indexOf("git fetch")).toBeLessThan(
      r.events.indexOf("git remote"),
    );
  });

  it("adds no remote when told not to go ahead, so nothing changed", async () => {
    const r = fork({
      answers: { select: ["acme/web"], checkbox: [[]], confirm: [false] },
    });
    expect(await r.run()).toBe(0);
    expect(r.out.at(-1)).toBe("Nothing changed.");
    expect(added(r)).toEqual([]);
  });

  it("adds no remote before it stops for a coding agent that is not installed", async () => {
    const r = fork({
      agent: scriptedAgent([], { installed: false }),
      answers: { select: ["acme/web"] },
    });
    expect(await r.run()).toBe(1);
    expect(r.out).toEqual([
      FIRST_LINE("acme/web"),
      "",
      "The factory runs in a coding agent, and Claude Code is not installed.",
      "Install it and run factory init again.",
      "Nothing changed.",
    ]);
    expect(added(r)).toEqual([]);
  });

  it("adds no remote before it stops for a checkout ahead of the default branch", async () => {
    const r = fork({
      answers: { select: ["acme/web"] },
      git: (args) => (args[0] === "rev-list" ? { stdout: "1\n" } : undefined),
    });
    expect(await r.run()).toBe(1);
    expect(r.out.at(-1)).toBe("Nothing changed.");
    expect(added(r)).toEqual([]);
  });

  it("adds no remote before it stops for a preset that is refused", async () => {
    const r = fork({
      argv: ["--preset", "acme/none"],
      answers: { select: ["acme/web"] },
    });
    expect(await r.run()).toBe(1);
    expect(r.out.at(-1)).toBe("Nothing changed.");
    expect(added(r)).toEqual([]);
  });

  it("stops, having changed nothing, when git will not add the remote", async () => {
    const r = fork({
      boards: [],
      answers: {
        select: ["acme/web", "new"],
        checkbox: [["board"]],
        confirm: [true],
      },
      git: (args) =>
        args[0] === "remote"
          ? { status: 3, stderr: "error: remote upstream already exists.\n" }
          : undefined,
    });
    expect(await r.run()).toBe(1);
    expect(r.out.slice(-2)).toEqual([
      "✗ Could not add the remote upstream: error: remote upstream already exists.",
      "Nothing changed.",
    ]);
    expect(r.read(".claude/factory.yaml")).toBeNull();
    expect(r.tickets.boards).toEqual([]);
    expect(r.synced()).toBe(0);
  });
});

describe("factory init, with no remote on a code host it supports", () => {
  it("stops, naming the code hosts, when several remotes are all elsewhere", async () => {
    const r = quick({
      remotes: [
        { name: "origin", url: "https://gitlab.com/acme/web.git" },
        { name: "backup", url: "https://example.org/acme/web.git" },
      ],
    });
    expect(await r.run()).toBe(1);
    expect(r.out).toEqual([
      "No remote here is on a code host the factory supports: GitHub.",
    ]);
  });

  it("stops in a checkout with no remote at all, whatever a remote would be called", async () => {
    const r = quick({ remote: null });
    expect(await r.run()).toBe(1);
    expect(r.out).toEqual([
      "This is not a git repository with a remote. Run it in your repository's checkout.",
    ]);
  });
});

describe("factory init, a checkout that cannot hold the setup's commit", () => {
  const ahead = (branch: string) => (args: string[]) =>
    args[0] === "rev-list"
      ? { stdout: "2\n" }
      : args[0] === "rev-parse" && args[1] === "--abbrev-ref"
        ? { stdout: `${branch}\n` }
        : undefined;

  it("fetches the default branch from the repository's remote before its first question", async () => {
    const r = quick({ defaultBranch: "trunk" });
    await r.run();
    expect(r.git).toContainEqual(["fetch", "--quiet", "origin", "trunk"]);
    expect(r.git).toContainEqual(["rev-list", "--count", "base000..HEAD"]);
    const firstQuestion = r.events.findIndex((e) => e.startsWith("? "));
    expect(firstQuestion).toBeGreaterThan(-1);
    expect(r.events.indexOf("git fetch")).toBeLessThan(firstQuestion);
    expect(r.events.indexOf("git rev-list")).toBeLessThan(firstQuestion);
  });

  it("stops, naming the branch, when the commit checked out has commits the default branch lacks", async () => {
    const r = quick({ git: ahead("cart-fix") });
    expect(await r.run()).toBe(1);
    expect(r.out).toEqual([
      "✗ This checkout is on the branch cart-fix, which has commits main does not. Switch to main, then run factory init again.",
      "Nothing changed.",
    ]);
    expect(r.asked).toEqual([]);
    expect(r.read(".claude/factory.yaml")).toBeNull();
  });

  it("stops the same way on the default branch itself, when it is ahead", async () => {
    const r = quick({ git: ahead("main") });
    expect(await r.run()).toBe(1);
    expect(r.out[0]).toBe(
      "✗ This checkout is on the branch main, which has commits main does not. Switch to main, then run factory init again.",
    );
  });

  it("names no branch for a commit checked out on none", async () => {
    const r = quick({ git: ahead("HEAD") });
    expect(await r.run()).toBe(1);
    expect(r.out[0]).toBe(
      "✗ This checkout has commits main does not. Switch to main, then run factory init again.",
    );
  });

  it("goes on from a branch at or behind the default branch", async () => {
    const r = quick({
      git: (args) =>
        args[0] === "rev-parse" && args[1] === "--abbrev-ref"
          ? { stdout: "old-work\n" }
          : undefined,
    });
    expect(await r.run()).toBe(0);
    expect(r.out[0]).toBe(FIRST_LINE("acme/site"));
  });

  it("asks which repository before it fetches, and nothing else", async () => {
    const r = init({
      remotes: [
        { name: "origin", url: "git@github.com:dev/web.git" },
        { name: "upstream", url: "git@github.com:acme/web.git" },
      ],
      git: ahead("cart-fix"),
      answers: { select: ["acme/web"] },
    });
    expect(await r.run()).toBe(1);
    expect(r.asked).toEqual([QUESTION]);
    expect(r.git).toContainEqual(["fetch", "--quiet", "upstream", "main"]);
    expect(r.events.indexOf(`? ${QUESTION}`)).toBeLessThan(
      r.events.indexOf("git fetch"),
    );
  });

  it("stops with git's reason when the default branch cannot be fetched", async () => {
    const r = quick({
      git: (args) =>
        args[0] === "fetch"
          ? {
              status: 128,
              stderr: "fatal: couldn't find remote ref main\n",
            }
          : undefined,
    });
    expect(await r.run()).toBe(1);
    expect(r.out).toEqual([
      "✗ Could not fetch main from acme/site: fatal: couldn't find remote ref main",
      "Nothing changed.",
    ]);
  });
});

describe("whether a repository on GitHub is a fork", () => {
  const answering = (body: object) => async (args: string[]) => {
    expect(args).toEqual(["api", "repos/dev/web"]);
    return JSON.stringify(body);
  };

  it("gives the repository a fork was made from", async () => {
    expect(
      await githubForkOf(
        "dev/web",
        answering({ fork: true, parent: { full_name: "acme/web" } }),
      ),
    ).toBe("acme/web");
  });

  it("gives none for a repository that is no fork, and for a fork whose parent is gone", async () => {
    expect(
      await githubForkOf("dev/web", answering({ fork: false })),
    ).toBeNull();
    expect(await githubForkOf("dev/web", answering({ fork: true }))).toBeNull();
  });

  it("rejects when GitHub cannot be asked, so init asks the person", async () => {
    await expect(
      githubForkOf("dev/web", async () => {
        throw new Error("gh: not signed in");
      }),
    ).rejects.toThrow("not signed in");
  });
});
