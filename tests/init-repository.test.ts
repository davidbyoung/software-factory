// `lunamill init`, which repository: the settings' line, or the one the
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
  `Setting up lunamill for ${repository}`;

describe("lunamill init, a repository line in the settings", () => {
  const SETTINGS = `version: 1\nrepository: acme/web\n${CODE_HOST_YAML}\n`;
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
      "set-up-lunamill",
    ]);
  });

  it("stops, naming origin's repository, when no remote is the line's", async () => {
    const r = quick({ settings: SETTINGS, remotes: [FORK[0]!] });
    expect(await r.run()).toBe(1);
    expect(r.out).toEqual([
      "✗ repository: .claude/lunamill.yaml says acme/web, and no remote here is acme/web. origin is dev/web. Add the remote, or change the line and run lunamill sync.",
    ]);
    expect(r.asked).toEqual([]);
  });
});

describe("lunamill init, the repository its remotes name", () => {
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

describe("lunamill init, a repository chosen that is no remote yet", () => {
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
      "lunamill runs in a coding agent, and Claude Code is not installed.",
      "Install it and run lunamill init again.",
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
    expect(r.read(".claude/lunamill.yaml")).toBeNull();
    expect(r.tickets.boards).toEqual([]);
    expect(r.synced()).toBe(0);
  });
});

describe("lunamill init, with no remote on a code host it supports", () => {
  it("stops, naming the code hosts, when several remotes are all elsewhere", async () => {
    const r = quick({
      remotes: [
        { name: "origin", url: "https://gitlab.com/acme/web.git" },
        { name: "backup", url: "https://example.org/acme/web.git" },
      ],
    });
    expect(await r.run()).toBe(1);
    expect(r.out).toEqual([
      "No remote here is on a code host lunamill supports: GitHub.",
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

describe("lunamill init, a checkout that cannot hold the setup's commit", () => {
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
      "✗ This checkout is on the branch cart-fix, which has commits main does not. Switch to main, then run lunamill init again.",
      "Nothing changed.",
    ]);
    expect(r.asked).toEqual([]);
    expect(r.read(".claude/lunamill.yaml")).toBeNull();
  });

  it("stops the same way on the default branch itself, when it is ahead", async () => {
    const r = quick({ git: ahead("main") });
    expect(await r.run()).toBe(1);
    expect(r.out[0]).toBe(
      "✗ This checkout is on the branch main, which has commits main does not. Switch to main, then run lunamill init again.",
    );
  });

  it("names no branch for a commit checked out on none", async () => {
    const r = quick({ git: ahead("HEAD") });
    expect(await r.run()).toBe(1);
    expect(r.out[0]).toBe(
      "✗ This checkout has commits main does not. Switch to main, then run lunamill init again.",
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

describe("lunamill init, a repository with no commits yet", () => {
  const NOTHING_YET =
    "acme/site has no commits yet, so a pull request has nothing to merge into.";
  const FIRST = `confirm: ${NOTHING_YET} Make a first, empty commit on trunk and push it?`;
  const PUSH = (n: string) =>
    `confirm: ${NOTHING_YET} Push trunk, which has ${n} here?`;
  const unborn = (over: Partial<Setup> = {}) =>
    init({
      empty: { branch: "trunk", commits: 0 },
      answers: { checkbox: [[]], confirm: [true, true] },
      ...over,
    });
  const ran = (r: ReturnType<typeof init>, command: string) =>
    r.git.filter((args) => args[0] === command);

  it("asks nothing of the kind when the repository has a branch", async () => {
    const r = quick();
    await r.run();
    expect(r.asked.filter((q) => q.includes("no commits yet"))).toEqual([]);
    expect(ran(r, "push")).toHaveLength(1);
  });

  it("asks whether to make a first, empty commit and push it, yes for Enter, before the checkout is checked and before any other question", async () => {
    const r = unborn();
    expect(await r.run()).toBe(0);
    expect(r.asked[0]).toBe(FIRST);
    expect(r.fallbacks[FIRST.slice("confirm: ".length)]).toBe(true);
    expect(r.events.indexOf(`? ${FIRST}`)).toBeLessThan(
      r.events.indexOf("git fetch"),
    );
  });

  it("makes the commit, empty and of nothing staged, pushes the branch with its upstream set, and says so", async () => {
    const r = unborn();
    await r.run();
    const [made] = ran(r, "commit");
    expect(made).toEqual(
      expect.arrayContaining([
        "--allow-empty",
        "--only",
        "--message",
        "Start the repository",
      ]),
    );
    const [first] = ran(r, "push");
    expect(first).toEqual(
      expect.arrayContaining(["--set-upstream", "origin", "trunk"]),
    );
    expect(r.out[0]).toBe("✓ Pushed a first commit to trunk.");
    expect(r.out[1]).toBe("Setting up lunamill for acme/site");
  });

  it("carries on with that branch as the default branch", async () => {
    const r = unborn();
    expect(await r.run()).toBe(0);
    expect(r.git).toContainEqual(["fetch", "--quiet", "origin", "trunk"]);
    expect(r.branchAsked).toEqual(["trunk"]);
    expect(await r.host.codeHost.get(1)).toMatchObject({
      head: { branch: "set-up-lunamill" },
      base: { branch: "trunk" },
    });
    expect(r.out.join("\n")).toContain("git switch trunk && git pull");
  });

  it("stops on a no, with the commands to run, having changed nothing", async () => {
    const r = unborn({ answers: { confirm: [false] } });
    expect(await r.run()).toBe(1);
    expect(r.out).toEqual([
      'Push a first commit, then run lunamill init again: git commit --allow-empty -m "Start the repository" && git push -u origin trunk',
      "Nothing changed.",
    ]);
    expect(ran(r, "commit")).toEqual([]);
    expect(ran(r, "push")).toEqual([]);
  });

  it("asks instead whether to push the branch, with how many commits it has, when the checkout has some", async () => {
    const r = unborn({ empty: { branch: "trunk", commits: 2 } });
    expect(await r.run()).toBe(0);
    expect(r.asked[0]).toBe(PUSH("2 commits"));
    expect(r.fallbacks[PUSH("2 commits").slice("confirm: ".length)]).toBe(true);
    expect(ran(r, "commit")).toHaveLength(1);
    expect(ran(r, "commit")[0]).not.toContain("--allow-empty");
    expect(ran(r, "push")[0]).toEqual(
      expect.arrayContaining(["--set-upstream", "origin", "trunk"]),
    );
    expect(r.out[0]).toBe("✓ Pushed trunk.");
    expect(r.git).toContainEqual(["fetch", "--quiet", "origin", "trunk"]);
  });

  it("says 1 commit for one", async () => {
    const r = unborn({
      empty: { branch: "trunk", commits: 1 },
      answers: { confirm: [false] },
    });
    await r.run();
    expect(r.asked).toEqual([PUSH("1 commit")]);
  });

  it("stops on a no to pushing the branch, with the command to run", async () => {
    const r = unborn({
      empty: { branch: "trunk", commits: 2 },
      answers: { confirm: [false] },
    });
    expect(await r.run()).toBe(1);
    expect(r.out).toEqual([
      "Push trunk, then run lunamill init again: git push -u origin trunk",
      "Nothing changed.",
    ]);
    expect(ran(r, "push")).toEqual([]);
  });

  const refused = (args: string[]) =>
    args[0] === "push"
      ? {
          status: 1,
          stderr:
            "remote: Permission to acme/site.git denied to dev.\nfatal: unable to access\n",
        }
      : undefined;

  it("says what the remote said when the first commit cannot be pushed, and that the commit is made here", async () => {
    const r = unborn({ answers: { confirm: [true] }, git: refused });
    expect(await r.run()).toBe(1);
    expect(r.out).toEqual([
      "✗ Could not push trunk to acme/site: remote: Permission to acme/site.git denied to dev.",
      "The first commit is made here and not pushed.",
    ]);
  });

  it("says nothing changed when a branch with commits cannot be pushed", async () => {
    const r = unborn({
      empty: { branch: "trunk", commits: 2 },
      answers: { confirm: [true] },
      git: refused,
    });
    expect(await r.run()).toBe(1);
    expect(r.out).toEqual([
      "✗ Could not push trunk to acme/site: remote: Permission to acme/site.git denied to dev.",
      "Nothing changed.",
    ]);
  });

  it("asks after which repository, when that is asked", async () => {
    const r = init({
      empty: { branch: "trunk", commits: 0 },
      remotes: [
        { name: "origin", url: "git@github.com:dev/web.git" },
        { name: "upstream", url: "git@github.com:acme/web.git" },
      ],
      answers: { select: ["acme/web"], confirm: [false] },
    });
    await r.run();
    expect(r.asked).toEqual([
      QUESTION,
      "confirm: acme/web has no commits yet, so a pull request has nothing to merge into. Make a first, empty commit on trunk and push it?",
    ]);
    expect(r.out[0]).toContain("git push -u upstream trunk");
  });

  it("says nothing else changed at a later stop, the first commit being pushed", async () => {
    const r = unborn({
      agent: scriptedAgent([], { installed: false }),
      answers: { confirm: [true] },
    });
    expect(await r.run()).toBe(1);
    expect(r.out.at(-1)).toBe("Nothing else changed.");
  });

  it("leaves a remote it cannot list to the fetch, which says why", async () => {
    const r = quick({
      git: (args) =>
        args[0] === "ls-remote" || args[0] === "fetch"
          ? {
              status: 128,
              stderr: "fatal: Could not read from remote repository.\n",
            }
          : undefined,
    });
    expect(await r.run()).toBe(1);
    expect(r.asked).toEqual([]);
    expect(r.out[0]).toBe(
      "✗ Could not fetch main from acme/site: fatal: Could not read from remote repository.",
    );
  });
});
