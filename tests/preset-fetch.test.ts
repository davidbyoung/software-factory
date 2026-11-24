// Reading a preset's repository with git, against local repositories: the
// newest commit, one commit in the cache, the sign-in each owner's is read
// with, and what `factory update` and the check of a moved pin are built
// from.
import { existsSync, rmSync } from "node:fs";
import { devNull } from "node:os";
import { join } from "node:path";
import { load } from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";
import { fileHash, pinsOf, PresetError } from "../src/preset.mts";
import {
  cachedCommit,
  commitDate,
  fetchCommit,
  FetchError,
  fileAt,
  gitEnv,
  lastGitLine,
  movePin,
  newestCommit,
  pinAt,
  pinFaults,
  presetDiffers,
  runGit,
  sameOwner,
  shippedText,
  type FetchDeps,
  type Git,
  whyUnread,
} from "../src/preset-fetch.mts";
import {
  ACME,
  CACHE,
  fetching,
  HOST,
  install,
  NODE,
  own,
  publish,
  remoteOf,
  put,
  read,
  repo,
} from "./preset-fixture.ts";

let root = "";
afterEach(() => rmSync(root, { recursive: true, force: true }));

const REPO = "acme/factory-config";
const BASE = { "": { settings: "version: 2\n", agents: { a: "one\n" } } };

/** The fixture's reader, recording each call it makes to git. */
function recording(over: Partial<FetchDeps> = {}) {
  const calls: { args: string[]; cwd: string }[] = [];
  const git: Git = (args, o) => {
    calls.push({ args, cwd: o.cwd });
    return runGit(args, o);
  };
  return { d: { ...fetching(), git, ...over }, calls };
}

describe("the newest commit of a preset's repository", () => {
  it("is the default branch's, read with git ls-remote", () => {
    root = repo(own([]));
    publish(REPO, BASE);
    const newest = publish(REPO, {
      "": { settings: "version: 2\n", agents: { a: "two\n" } },
    });
    const { d, calls } = recording();
    expect(newestCommit(d, REPO)).toBe(newest);
    expect(
      calls.map((c) => c.args.slice(0, 1).concat(c.args.slice(2))),
    ).toEqual([["ls-remote", "HEAD"]]);
  });

  it("fails with git's own last line for a repository it cannot read", () => {
    root = repo(own([]));
    expect(() => newestCommit(fetching(), "acme/missing")).toThrow(FetchError);
    expect(() => newestCommit(fetching(), "acme/missing")).toThrow(
      /^fatal: Could not read from remote repository\.$/,
    );
  });

  it("fails for a repository with no commit", () => {
    root = repo(own([]));
    const d: FetchDeps = {
      ...fetching(),
      git: () => ({ status: 0, stdout: "", stderr: "" }),
    };
    expect(() => newestCommit(d, REPO)).toThrow(
      "it has no commit on a default branch",
    );
  });
});

describe("one commit of a preset's repository in the cache", () => {
  it("is downloaded with git init, a fetch of that commit alone, and a checkout, into presets/HOST/OWNER/NAME/COMMIT", () => {
    root = repo(own([]));
    const first = publish(REPO, {
      "": { settings: "version: 2\n", agents: { a: `${Math.random()}\n` } },
    });
    publish(REPO, BASE);
    const { d, calls } = recording();
    expect(cachedCommit(d, REPO, first)).toBeNull();
    const dir = fetchCommit(d, REPO, first);
    expect(dir).toBe(
      join(CACHE, "presets", HOST, "acme/factory-config", first),
    );
    expect(read(dir, "factory-preset.yaml")).toBe("version: 2\n");
    expect(calls.map((c) => c.args.filter((a) => !a.startsWith("/")))).toEqual([
      ["init", "--quiet"],
      ["fetch", "--quiet", "--depth", "1", first],
      ["checkout", "--quiet", "FETCH_HEAD"],
    ]);
    expect(cachedCommit(d, REPO, first)).toBe(dir);
  });

  it("is not downloaded again once the cache has it", () => {
    root = repo(own([]));
    const commit = publish(REPO, BASE);
    fetchCommit(fetching(), REPO, commit);
    const { d, calls } = recording();
    fetchCommit(d, REPO, commit);
    expect(calls).toEqual([]);
  });

  it("leaves nothing in the cache when the commit cannot be read", () => {
    root = repo(own([]));
    publish(REPO, BASE);
    const gone = "0123456789abcdef0123456789abcdef01234567";
    expect(() => fetchCommit(fetching(), REPO, gone)).toThrow(FetchError);
    expect(cachedCommit(fetching(), REPO, gone)).toBeNull();
    expect(
      existsSync(
        join(CACHE, "presets", HOST, REPO, `${gone}.${process.pid}.tmp`),
      ),
    ).toBe(false);
  });

  it("hands git nothing but a full commit ID", () => {
    root = repo(own([]));
    publish(REPO, BASE);
    const { d, calls } = recording();
    expect(() => fetchCommit(d, REPO, "--upload-pack=touch x")).toThrow(
      "--upload-pack=touch x is not a commit",
    );
    expect(calls).toEqual([]);
  });

  it("gives the commit's committer date", () => {
    root = repo(own([]));
    const commit = publish(REPO, BASE, "2026-11-20T23:30:00-05:00");
    expect(commitDate(fetching(), REPO, commit).toISOString()).toBe(
      "2026-11-21T04:30:00.000Z",
    );
  });
});

describe("the sign-in a preset's repository is read with", () => {
  const d = (env: Record<string, string | undefined>) => ({
    env,
    repository: "acme/billing",
    cache: "/home/sam/.cache/software-factory",
  });

  it("is the same owner's when the first part of its name is the repository's owner", () => {
    expect(sameOwner("acme/factory-config", "acme/billing")).toBe(true);
    expect(sameOwner("Acme/factory-config", "acme/billing")).toBe(true);
    expect(sameOwner("acme/platform/config", "acme/billing")).toBe(true);
    expect(sameOwner("foo/presets", "acme/billing")).toBe(false);
  });

  it("is the machine's own for the same owner, with nothing that waits on a person", () => {
    expect(
      gitEnv(
        d({ PATH: "/bin", HOME: "/home/sam", GIT_ASKPASS: "/usr/bin/ask" }),
        REPO,
      ),
    ).toEqual({
      PATH: "/bin",
      HOME: "/home/sam",
      GIT_TERMINAL_PROMPT: "0",
      GIT_ASKPASS: "",
      GCM_INTERACTIVE: "never",
      GIT_CEILING_DIRECTORIES: "/home/sam/.cache",
    });
  });

  it.each(["GH_TOKEN", "GITHUB_TOKEN"])(
    "is %s as the password for the same owner in a run, kept out of git's arguments",
    (name) => {
      const env = gitEnv(d({ PATH: "/bin", [name]: "s3cret" }), REPO);
      expect(env.GIT_CONFIG_COUNT).toBe("2");
      expect([env.GIT_CONFIG_KEY_0, env.GIT_CONFIG_VALUE_0]).toEqual([
        "credential.helper",
        "",
      ]);
      expect(env.GIT_CONFIG_KEY_1).toBe("credential.helper");
      expect(env.GIT_CONFIG_VALUE_1).toContain(
        'echo "password=$FACTORY_PRESET_TOKEN"',
      );
      expect(env.GIT_CONFIG_VALUE_1).not.toContain("s3cret");
      expect(env.FACTORY_PRESET_TOKEN).toBe("s3cret");
      expect(env.GIT_TERMINAL_PROMPT).toBe("0");
    },
  );

  it("is the code host's own sign-in for the same owner on a machine, where git's own may hold none", () => {
    const env = gitEnv(
      { ...d({ PATH: "/bin" }), signIn: () => "gho_machine" },
      REPO,
    );
    expect(env.FACTORY_PRESET_TOKEN).toBe("gho_machine");
    expect(env.GIT_CONFIG_VALUE_1).toContain(
      'echo "password=$FACTORY_PRESET_TOKEN"',
    );
  });

  it("takes the environment's token before the code host's sign-in, and asks for neither for another owner", () => {
    let asked = 0;
    const signIn = () => {
      asked += 1;
      return "gho_machine";
    };
    expect(
      gitEnv({ ...d({ GH_TOKEN: "s3cret" }), signIn }, REPO)
        .FACTORY_PRESET_TOKEN,
    ).toBe("s3cret");
    expect(
      gitEnv({ ...d({}), signIn }, "foo/presets").FACTORY_PRESET_TOKEN,
    ).toBeUndefined();
    expect(asked).toBe(0);
  });

  it("is the machine's own when the code host's tool is signed in as nobody", () => {
    const env = gitEnv({ ...d({ PATH: "/bin" }), signIn: () => null }, REPO);
    expect(env.FACTORY_PRESET_TOKEN).toBeUndefined();
    expect(env.GIT_CONFIG_COUNT).toBeUndefined();
  });

  it("adds the token's helper after settings the environment already gives git", () => {
    const env = gitEnv(
      d({
        GH_TOKEN: "s3cret",
        GIT_CONFIG_COUNT: "1",
        GIT_CONFIG_KEY_0: "http.proxy",
        GIT_CONFIG_VALUE_0: "http://proxy",
      }),
      REPO,
    );
    expect(env.GIT_CONFIG_COUNT).toBe("3");
    expect(env.GIT_CONFIG_KEY_0).toBe("http.proxy");
    expect(env.GIT_CONFIG_KEY_2).toBe("credential.helper");
  });

  it("is none at all for another owner: no helper, no system or global settings, no prompt, and no token", () => {
    const env = gitEnv(
      d({
        PATH: "/bin",
        GH_TOKEN: "s3cret",
        GIT_ASKPASS: "/usr/bin/ask",
        SSH_ASKPASS: "/usr/bin/ask",
      }),
      "foo/presets",
    );
    expect(env).toEqual({
      PATH: "/bin",
      GH_TOKEN: "s3cret",
      SSH_ASKPASS: "/usr/bin/ask",
      GIT_TERMINAL_PROMPT: "0",
      GIT_ASKPASS: "",
      GCM_INTERACTIVE: "never",
      GIT_CEILING_DIRECTORIES: "/home/sam/.cache",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: devNull,
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "credential.helper",
      GIT_CONFIG_VALUE_0: "",
    });
  });

  it("reaches git on every call", () => {
    root = repo(own([]));
    const commit = publish("foo/presets", BASE);
    const seen: (string | undefined)[] = [];
    const d: FetchDeps = {
      ...fetching(),
      git: (args, o) => {
        seen.push(o.env.GIT_CONFIG_GLOBAL, o.env.GIT_TERMINAL_PROMPT);
        return runGit(args, o);
      },
    };
    newestCommit(d, "foo/presets");
    rmSync(join(CACHE, "presets", HOST, "foo"), {
      recursive: true,
      force: true,
    });
    fetchCommit(d, "foo/presets", commit);
    commitDate(d, "foo/presets", commit);
    expect(seen).toEqual(Array(5).fill([devNull, "0"]).flat());
  });
});

describe("git's last line", () => {
  it("is its last fatal line, or its last line when it has none", () => {
    expect(
      lastGitLine(
        "remote: Repository not found.\nfatal: repository 'https://github.com/acme/x.git/' not found\n\nhint: check it\n",
      ),
    ).toBe("fatal: repository 'https://github.com/acme/x.git/' not found");
    expect(lastGitLine("error: one\nerror: two\n")).toBe("error: two");
    expect(lastGitLine("")).toBe("");
  });
});

describe("a preset at one commit", () => {
  const TWO = {
    "": {
      settings: "version: 2\nrules:\n  review-rounds: 3\n",
      agents: { a: "one\n" },
      skills: { tidy: "tidy\n" },
    },
    node: { settings: "version: 2\n", agents: { n: "node\n" } },
  };

  it("is its settings without the version, and a hash of each agent and skill by its path in a repository that follows it", () => {
    root = repo(own([]));
    const commit = publish(REPO, TWO);
    expect(pinAt(fetching(), ACME, commit, load)).toEqual({
      name: ACME,
      commit,
      poller: false,
      settings: { rules: { "review-rounds": 3 } },
      files: {
        ".claude/agents/a.md": fileHash("one\n"),
        ".claude/skills/tidy/SKILL.md": fileHash("tidy\n"),
      },
    });
    expect(pinAt(fetching(), NODE, commit, load).files).toEqual({
      ".claude/agents/n.md": fileHash("node\n"),
    });
  });

  it("says whether the commit's repository holds an organization's poller, for a preset in any folder of it", () => {
    root = repo(own([]));
    const commit = publish(REPO, {
      "": {
        settings: "version: 2\n",
        others: {
          ".github/workflows/factory-poller.yml": "name: Factory poller\n",
        },
      },
      node: { settings: "version: 2\n" },
    });
    expect(pinAt(fetching(), ACME, commit, load).poller).toBe(true);
    expect(pinAt(fetching(), NODE, commit, load).poller).toBe(true);
    const without = publish(REPO, {
      node: {
        settings: "version: 2\n",
        others: {
          ".github/workflows/factory-poller.yml": "name: Factory poller\n",
        },
      },
    });
    expect(pinAt(fetching(), NODE, without, load).poller).toBe(false);
  });

  it("says where it looked when the commit holds no preset file", () => {
    root = repo(own([]));
    const commit = publish(REPO, { node: { settings: "version: 2\n" } });
    expect(() => pinAt(fetching(), ACME, commit, load)).toThrow(
      new PresetError(`${ACME}: no factory-preset.yaml in ${REPO}`),
    );
    expect(() => pinAt(fetching(), `${REPO}//go`, commit, load)).toThrow(
      new PresetError(`${REPO}//go: no go/factory-preset.yaml in ${REPO}`),
    );
  });

  it("refuses a preset file a preset can't be, naming the key", () => {
    root = repo(own([]));
    const commit = publish(REPO, {
      "": { settings: "version: 2\nrules:\n  small-change-lnes: 3\n" },
    });
    expect(() => pinAt(fetching(), ACME, commit, load)).toThrow(
      `${ACME}: rules.small-change-lnes: unknown key`,
    );
  });

  it("gives a shipped file's text only while it is what the pin records", () => {
    root = repo(own([]));
    const commit = publish(REPO, TWO);
    const node = pinAt(fetching(), NODE, commit, load);
    expect(shippedText(fetching(), node, ".claude/agents/n.md")).toBe("node\n");
    expect(shippedText(fetching(), node, ".claude/agents/other.md")).toBeNull();
    expect(
      shippedText(
        fetching(),
        { ...node, files: { ".claude/agents/n.md": fileHash("edited\n") } },
        ".claude/agents/n.md",
      ),
    ).toBeNull();
    expect(
      shippedText(
        fetching(),
        { ...node, commit: "0123456789abcdef0123456789abcdef01234567" },
        ".claude/agents/n.md",
      ),
    ).toBeNull();
  });
});

describe("whether a preset's own files differ between two commits", () => {
  const at = (presets: Parameters<typeof publish>[1]) => publish(REPO, presets);

  it("is true when its preset file, an agent, or a skill changed, and false for the same commit", () => {
    root = repo(own([]));
    const first = at(BASE);
    const settings = at({
      "": { settings: "version: 2\nspecs: none\n", agents: { a: "one\n" } },
    });
    const agent = at({
      "": { settings: "version: 2\nspecs: none\n", agents: { a: "two\n" } },
    });
    const skill = at({
      "": {
        settings: "version: 2\nspecs: none\n",
        agents: { a: "two\n" },
        skills: { tidy: "tidy\n" },
      },
    });
    const d = fetching();
    expect(presetDiffers(d, ACME, first, settings)).toBe(true);
    expect(presetDiffers(d, ACME, settings, agent)).toBe(true);
    expect(presetDiffers(d, ACME, agent, skill)).toBe(true);
    expect(presetDiffers(d, ACME, first, first)).toBe(false);
  });

  it("is false when only another folder of the repository changed", () => {
    root = repo(own([]));
    const first = at({ ...BASE, go: { settings: "version: 2\n" } });
    const second = at({
      ...BASE,
      go: { settings: "version: 2\nspecs: none\n", agents: { g: "go\n" } },
    });
    expect(presetDiffers(fetching(), ACME, first, second)).toBe(false);
    expect(presetDiffers(fetching(), `${REPO}//go`, first, second)).toBe(true);
  });

  it("downloads a commit the cache lacks", () => {
    root = repo(own([]));
    const first = at({
      "": { settings: "version: 2\n", agents: { a: `${Math.random()}\n` } },
    });
    const second = at(BASE);
    expect(cachedCommit(fetching(), REPO, first)).toBeNull();
    expect(presetDiffers(fetching(), ACME, first, second)).toBe(true);
    expect(cachedCommit(fetching(), REPO, first)).not.toBeNull();
  });
});

describe("moving a preset's pin in the lock", () => {
  it("records the commit, its settings, and its hashes, and leaves every other part of the lock", async () => {
    root = repo(own([ACME, NODE]));
    install(root, REPO, {
      ...BASE,
      node: { settings: "version: 2\n" },
    });
    const before = read(root, ".claude/factory.lock")!;
    put(
      root,
      ".claude/factory.lock",
      `version: 1.2.3\n${before}files:\n  - a\n`,
    );
    const next = publish(REPO, {
      "": {
        settings: "version: 2\nrules:\n  review-rounds: 4\n",
        agents: { a: "two\n" },
      },
      node: { settings: "version: 2\n" },
    });
    const moved = await movePin(root, ACME, next, fetching());
    expect(moved).toEqual({
      name: ACME,
      commit: next,
      poller: false,
      settings: { rules: { "review-rounds": 4 } },
      files: { ".claude/agents/a.md": fileHash("two\n") },
    });
    const text = read(root, ".claude/factory.lock")!;
    const pins = pinsOf(text, load);
    expect(pins.map((p) => p.name)).toEqual([ACME, NODE]);
    expect(pins[0]).toEqual(moved);
    expect(pins[1]!.commit).not.toBe(next);
    expect(text.startsWith("version: 1.2.3\npresets:\n")).toBe(true);
    expect(text.endsWith("files:\n  - a\n")).toBe(true);
  });

  it("adds the pin to a lock that has none for the preset, and to no lock at all", async () => {
    root = repo(own([ACME]));
    const commit = publish(REPO, BASE);
    await movePin(root, ACME, commit, fetching());
    expect(pinsOf(read(root, ".claude/factory.lock"), load)).toEqual([
      pinAt(fetching(), ACME, commit, load),
    ]);
  });
});

describe("what is wrong with a lock's pins beside the base lock's", () => {
  const LOCK = ".claude/factory.lock";
  const setUp = () => {
    root = repo(own([ACME]));
    install(root, REPO, BASE);
    return pinsOf(read(root, LOCK), load);
  };

  it("is nothing for a pin the base has as it is, and reads no repository for it", () => {
    const pins = setUp();
    const { d, calls } = recording();
    expect(pinFaults(d, pins, pins, load)).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("is nothing for a new or moved pin that holds what its commit holds", () => {
    const pins = setUp();
    expect(pinFaults(fetching(), pins, [], load)).toEqual([]);
    expect(
      pinFaults(
        fetching(),
        pins,
        [{ ...pins[0]!, commit: "0".repeat(40) }],
        load,
      ),
    ).toEqual([]);
  });

  it.each([
    ["settings", { settings: { rules: { "review-rounds": 9 } } }],
    ["hashes", { files: { ".claude/agents/a.md": fileHash("mine\n") } }],
    ["poller's record", { poller: true }],
  ])(
    "names a new pin whose %s are not what its commit holds",
    (_what, change) => {
      const [pinned] = setUp();
      expect(
        pinFaults(fetching(), [{ ...pinned!, ...change }], [], load),
      ).toEqual([
        `.claude/factory.lock: ${ACME} at ${pinned!.commit.slice(0, 7)} does not match what that commit holds. Run: factory update`,
      ]);
    },
  );

  it("names a pin whose commit holds no such preset", () => {
    const [pinned] = setUp();
    expect(
      pinFaults(fetching(), [{ ...pinned!, name: `${REPO}//go` }], [], load),
    ).toEqual([
      `.claude/factory.lock: ${REPO}//go at ${pinned!.commit.slice(0, 7)} does not match what that commit holds. Run: factory update`,
    ]);
  });

  it.each([
    ["settings", { settings: { rules: { "review-rounds": 9 } } }],
    ["hashes", { files: { ".claude/agents/a.md": fileHash("mine\n") } }],
    ["poller's record", { poller: true }],
  ])(
    "names a pin whose %s changed while its commit did not",
    (_what, change) => {
      const pins = setUp();
      expect(
        pinFaults(fetching(), [{ ...pins[0]!, ...change }], pins, load),
      ).toEqual([
        `.claude/factory.lock: the settings or files recorded for ${ACME} changed, and its commit did not. Restore the lock from the default branch, then run: factory sync`,
      ]);
    },
  );

  it("says so when a moved pin's commit cannot be read", () => {
    const [pinned] = setUp();
    const gone = "0123456789abcdef0123456789abcdef01234567";
    const faults = pinFaults(
      fetching(),
      [{ ...pinned!, commit: gone }],
      [pinned!],
      load,
    );
    expect(faults).toHaveLength(1);
    expect(faults[0]).toMatch(
      /^\.claude\/factory\.lock: acme\/factory-config at 0123456 could not be read to check it: fatal: /,
    );
  });

  it("hands a pin whose commit cannot be read to a caller that takes it, and is nothing for it", () => {
    const [pinned] = setUp();
    const gone = {
      ...pinned!,
      commit: "0123456789abcdef".repeat(3).slice(0, 40),
    };
    const unread: string[] = [];
    expect(
      pinFaults(fetching(), [gone], [pinned!], load, (pin) =>
        unread.push(`${pin.name} ${pin.commit}`),
      ),
    ).toEqual([]);
    expect(unread).toEqual([`${ACME} ${gone.commit}`]);
  });

  it("still names a pin it can read that does not hold what its commit holds, and hands over none", () => {
    const [pinned] = setUp();
    const unread: string[] = [];
    expect(
      pinFaults(
        fetching(),
        [
          { ...pinned!, settings: { rules: { "review-rounds": 9 } } },
          { ...pinned!, name: `${REPO}//go` },
        ],
        [],
        load,
        (pin) => unread.push(pin.name),
      ),
    ).toHaveLength(2);
    expect(unread).toEqual([]);
  });
});

describe("why a preset's repository could not be read, for factory update", () => {
  const git = new FetchError("fatal: Could not read from remote repository.");

  it("is git's last line, without its period, for a repository of the same owner", () => {
    expect(whyUnread(git, "acme/factory-config", "acme/web")).toBe(
      "fatal: Could not read from remote repository",
    );
  });

  it("is not found, or private, for another owner's, which is read with no sign-in", () => {
    expect(whyUnread(git, "foo/old-presets", "acme/web")).toBe(
      "not found, or private",
    );
  });
});

describe("a file at a revision of the repository", () => {
  it("is its text at that commit, and null where the commit has none", () => {
    const commit = publish("acme/base-lock", {
      "": { settings: "version: 2\n" },
    });
    const dir = remoteOf("acme/base-lock");
    expect(fileAt(dir, commit, "factory-preset.yaml")).toBe("version: 2\n");
    expect(fileAt(dir, commit, ".claude/factory.lock")).toBeNull();
  });
});
