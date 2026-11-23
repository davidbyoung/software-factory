// `factory update`: the factory to its newest release and each preset to
// its newest commit, by hand in the working tree, or as one pull request
// for each in the Updates job.
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  main,
  settingsNow,
  type PresetPin,
  type UpdateDeps,
} from "../src/update.mts";
import { writeSettings } from "./locked.ts";
import { CODE_HOST_YAML } from "./settings-fixture.ts";

const pin = (name: string, commit: string): PresetPin => ({
  name,
  repo: name.split("//")[0]!,
  commit,
});
const OLD = "3f2a91c0000000000000000000000000000000aa";
const NEW = "8d04e7b0000000000000000000000000000000bb";

type Setup = {
  version?: string;
  newest?: string | Error;
  own?: boolean;
  settings?: boolean;
  pins?: PresetPin[];
  /** Each repository's newest commit, or why it cannot be read. */
  heads?: Record<string, string | Error>;
  /** The presets whose own files differ at the newest commit. */
  changed?: string[];
  /** The presets whose two commits cannot be compared, and why. */
  uncompared?: Record<string, Error>;
  /** What the sync prints, by the version it runs at. */
  synced?: string[];
  /** The last pull request of a branch. */
  branches?: Record<
    string,
    { number: number; state: "open" | "closed" | "merged" }
  >;
  /** Open pull requests, as their numbers and branches. */
  open?: { number: number; branch: string }[];
  /** `git status --porcelain` after the sync. */
  status?: string;
  /** The sync's exit code. */
  syncCode?: number;
};

function update(o: Setup = {}) {
  const out: string[] = [];
  const calls: string[] = [];
  const bodies: string[] = [];
  let next = 41;
  const d: UpdateDeps = {
    hasSettings: () => o.settings ?? true,
    own: o.own ?? false,
    version: () => o.version ?? "0.2.0",
    newestRelease: async () => {
      if (o.newest instanceof Error) throw o.newest;
      return o.newest ?? "0.3.0";
    },
    presets: {
      pins: () => o.pins ?? [],
      newest: async (repo) => {
        const head = o.heads?.[repo] ?? NEW;
        if (head instanceof Error) throw head;
        return head;
      },
      differs: async (p) => {
        const why = o.uncompared?.[p.name];
        if (why) throw why;
        return (o.changed ?? []).includes(p.name);
      },
      move: async (names, commit) => {
        calls.push(`move ${names.join(",")} ${commit.slice(0, 7)}`);
      },
      changes: async () => [
        "acme/factory-config 3f2a91c → 8d04e7b",
        "",
        "Changes here:",
        "- x",
      ],
    },
    sync: async (version) => {
      calls.push(`sync ${version ?? "as locked"}`);
      return {
        code: o.syncCode ?? 0,
        lines: o.synced ?? [
          "wrote .claude/factory.lock",
          "wrote a",
          "deleted b",
        ],
      };
    },
    git: (args) => {
      calls.push(`git ${args.join(" ")}`);
      return args[0] === "status" ? (o.status ?? "") : "";
    },
    defaultBranch: async () => "main",
    pulls: {
      lastForBranch: async (branch) => o.branches?.[branch] ?? null,
      create: async (pull) => {
        calls.push(
          `open ${pull.head}: ${pull.title}${pull.draft ? " (draft)" : ""}`,
        );
        bodies.push(pull.body);
        return next++;
      },
      listOpen: async () =>
        (o.open ?? []).map(({ number, branch }) => ({
          number,
          head: { branch },
        })),
      comment: async (pull, body) => {
        calls.push(`comment ${pull}: ${body}`);
        return 1;
      },
      close: async (pull) => {
        calls.push(`close ${pull}`);
      },
    },
    releaseNotes: (version) => `https://example.com/releases/v${version}`,
    out: (line) => out.push(line),
  };
  return { run: (argv: string[] = []) => main(argv, d), out, calls, bodies };
}

const TWO = [
  pin("acme/factory-config", OLD),
  pin("acme/factory-config//node", OLD),
];

describe("factory update, by hand", () => {
  it("raises the factory and each changed preset, syncs once at the new version, and says what it wrote", async () => {
    const u = update({ pins: TWO, changed: ["acme/factory-config"] });
    expect(await u.run()).toBe(0);
    expect(u.out).toEqual([
      "The factory 0.2.0 → 0.3.0",
      "acme/factory-config 3f2a91c → 8d04e7b",
      "acme/factory-config//node is at its newest commit, 3f2a91c.",
      "✓ Wrote 2 files and deleted 1. Commit them on a branch and open a pull request.",
    ]);
    expect(u.calls).toEqual(["move acme/factory-config 8d04e7b", "sync 0.3.0"]);
  });

  it("counts one file as one, and names no deletion when there was none", async () => {
    const u = update({ synced: ["wrote .claude/factory.lock"] });
    await u.run();
    expect(u.out.at(-1)).toBe(
      "✓ Wrote 1 file. Commit them on a branch and open a pull request.",
    );
  });

  it("leaves a preset whose newest commit changed none of its own files where it is", async () => {
    const u = update({ version: "0.3.0", pins: TWO, changed: [] });
    expect(await u.run()).toBe(0);
    expect(u.calls).toEqual([]);
  });

  it.each<[PresetPin[], string]>([
    [[], "."],
    [[TWO[0]!], ", and acme/factory-config is at its newest commit."],
    [TWO, ", and both presets are at their newest commits."],
    [
      [...TWO, pin("acme/go", OLD)],
      ", and all 3 presets are at their newest commits.",
    ],
  ])("says there is nothing to update, with %j", async (pins, end) => {
    const u = update({ version: "0.3.0", pins });
    expect(await u.run()).toBe(0);
    expect(u.out).toEqual([
      `✓ Nothing to update: the factory is 0.3.0, the newest release${end}`,
    ]);
    expect(u.calls).toEqual([]);
  });

  it("does not take the factory back from a version newer than the newest release", async () => {
    const u = update({ version: "0.4.0" });
    await u.run();
    expect(u.calls).toEqual([]);
  });

  it("says which preset it could not read, goes on with the rest, and exits 0", async () => {
    const u = update({
      version: "0.3.0",
      pins: [pin("foo/old-presets", OLD), TWO[0]!],
      heads: { "foo/old-presets": new Error("not found, or private") },
      changed: ["acme/factory-config"],
    });
    expect(await u.run()).toBe(0);
    expect(u.out).toEqual([
      "? foo/old-presets could not be read: not found, or private. To stop following it: factory preset remove foo/old-presets",
      "acme/factory-config 3f2a91c → 8d04e7b",
      "✓ Wrote 2 files and deleted 1. Commit them on a branch and open a pull request.",
    ]);
  });

  it("says which preset it could not compare, and still updates the factory and the rest", async () => {
    const u = update({
      pins: [pin("acme/gone", OLD), TWO[0]!],
      uncompared: {
        "acme/gone": new Error(
          "fatal: remote error: upload-pack: not our ref 3f2a91c.",
        ),
      },
      changed: ["acme/factory-config"],
    });
    expect(await u.run()).toBe(0);
    expect(u.out).toEqual([
      "? acme/gone could not be read: fatal: remote error: upload-pack: not our ref 3f2a91c. To stop following it: factory preset remove acme/gone",
      "The factory 0.2.0 → 0.3.0",
      "acme/factory-config 3f2a91c → 8d04e7b",
      "✓ Wrote 2 files and deleted 1. Commit them on a branch and open a pull request.",
    ]);
  });

  it("moves presets only in the factory's own repository, which runs its source", async () => {
    const u = update({
      own: true,
      pins: [TWO[0]!],
      changed: ["acme/factory-config"],
    });
    await u.run();
    expect(u.out[0]).toBe("acme/factory-config 3f2a91c → 8d04e7b");
    expect(u.calls).toEqual([
      "move acme/factory-config 8d04e7b",
      "sync as locked",
    ]);
  });

  it("stops where the factory is not set up", async () => {
    const u = update({ settings: false });
    expect(await u.run()).toBe(1);
    expect(u.out).toEqual([
      ".claude/factory.yaml is missing. Run: factory init",
    ]);
  });

  it("stops, changing nothing, when the newest release cannot be read", async () => {
    const u = update({ newest: new Error("HTTP 503") });
    expect(await u.run()).toBe(1);
    expect(u.out).toEqual(["✗ The newest release could not be read: HTTP 503"]);
    expect(u.calls).toEqual([]);
  });

  it("exits with the sync's code when the sync fails, and claims nothing was written", async () => {
    const u = update({ syncCode: 1 });
    expect(await u.run()).toBe(1);
    expect(u.out).toEqual(["The factory 0.2.0 → 0.3.0"]);
  });
});

describe("factory update --pull-requests", () => {
  const PR = ["--pull-requests"];

  it("still opens the factory's pull request when a preset's commits cannot be compared", async () => {
    const u = update({
      pins: [pin("acme/gone", OLD)],
      uncompared: { "acme/gone": new Error("fatal: not our ref 3f2a91c") },
    });
    expect(await u.run(PR)).toBe(0);
    expect(u.out).toEqual([
      "✓ Opened #41, Update the factory to 0.3.0",
      "? acme/gone could not be read: fatal: not our ref 3f2a91c. To stop following it: factory preset remove acme/gone",
    ]);
  });

  it("opens one pull request for the factory and one for each preset repository, each from the default branch", async () => {
    const u = update({
      pins: [...TWO, pin("foo/presets//bar", OLD)],
      changed: [
        "acme/factory-config",
        "acme/factory-config//node",
        "foo/presets//bar",
      ],
      status:
        " M .claude/factory.lock\n M .claude/skills/factory-build/SKILL.md\n?? .github/workflows/factory.yml\n D .github/workflows/factory-check.yml\n",
    });
    expect(await u.run(PR)).toBe(0);
    expect(u.out).toEqual([
      "✓ Opened #41, Update the factory to 0.3.0",
      "✓ Opened #42, Update acme/factory-config to 8d04e7b",
      "✓ Opened #43, Update foo/presets to 8d04e7b",
    ]);
    expect(u.calls).toEqual([
      "git fetch origin main",
      "git switch -C factory-update/factory-0.3.0 origin/main",
      "sync 0.3.0",
      "git status --porcelain",
      "git add -A",
      "git commit -m Update the factory to 0.3.0",
      "git push -u origin factory-update/factory-0.3.0",
      "open factory-update/factory-0.3.0: Update the factory to 0.3.0",
      "git switch --detach origin/main",
      "git switch -C factory-update/acme-factory-config-8d04e7b origin/main",
      "move acme/factory-config,acme/factory-config//node 8d04e7b",
      "sync as locked",
      "git add -A",
      "git commit -m Update acme/factory-config to 8d04e7b",
      "git push -u origin factory-update/acme-factory-config-8d04e7b",
      "open factory-update/acme-factory-config-8d04e7b: Update acme/factory-config to 8d04e7b",
      "git switch --detach origin/main",
      "git switch -C factory-update/foo-presets-8d04e7b origin/main",
      "move foo/presets//bar 8d04e7b",
      "sync as locked",
      "git add -A",
      "git commit -m Update foo/presets to 8d04e7b",
      "git push -u origin factory-update/foo-presets-8d04e7b",
      "open factory-update/foo-presets-8d04e7b: Update foo/presets to 8d04e7b",
      "git switch --detach origin/main",
    ]);
  });

  it("describes the factory's by its versions, each file the sync changed but the lock, and the release's notes", async () => {
    const u = update({
      status:
        " M .claude/factory.lock\n M .claude/skills/factory-build/SKILL.md\n?? .github/workflows/factory.yml\n D .github/workflows/factory-check.yml\n",
    });
    await u.run(PR);
    expect(u.bodies).toEqual([
      [
        "The factory 0.2.0 → 0.3.0",
        "",
        "Changes here:",
        "- .claude/skills/factory-build/SKILL.md, rewritten",
        "- .github/workflows/factory.yml, new",
        "- .github/workflows/factory-check.yml, deleted",
        "",
        "Release notes: https://example.com/releases/v0.3.0",
      ].join("\n"),
    ]);
  });

  it("describes a preset's by what factory preset changes prints", async () => {
    const u = update({
      version: "0.3.0",
      pins: [TWO[0]!],
      changed: ["acme/factory-config"],
    });
    await u.run(PR);
    expect(u.bodies).toEqual([
      "acme/factory-config 3f2a91c → 8d04e7b\n\nChanges here:\n- x",
    ]);
  });

  it("opens none where that update's branch has a pull request, open, closed, or merged", async () => {
    const u = update({
      pins: [pin("foo/presets", OLD), pin("foo/tools", OLD)],
      changed: ["foo/presets", "foo/tools"],
      branches: {
        "factory-update/factory-0.3.0": { number: 30, state: "merged" },
        "factory-update/foo-presets-8d04e7b": { number: 38, state: "open" },
        "factory-update/foo-tools-8d04e7b": { number: 39, state: "closed" },
      },
    });
    expect(await u.run(PR)).toBe(0);
    expect(u.out).toEqual([
      "- Update the factory to 0.3.0 was closed, so it is not opened again",
      "- #38, Update foo/presets to 8d04e7b, is still open",
      "- Update foo/tools to 8d04e7b was closed, so it is not opened again",
    ]);
    expect(u.calls.filter((c) => c.startsWith("open"))).toEqual([]);
  });

  it("closes an older open pull request for the same thing, naming the one that replaced it, and no other", async () => {
    const u = update({
      open: [
        { number: 35, branch: "factory-update/factory-0.2.5" },
        { number: 36, branch: "factory-update/factory-config-1234567" },
        { number: 37, branch: "feature/factory-update" },
      ],
    });
    await u.run(PR);
    expect(u.calls.filter((c) => /^(comment|close)/.test(c))).toEqual([
      "comment 35: Superseded by #41.",
      "close 35",
    ]);
  });

  it("opens the pull request ready, since nothing else would mark it so", async () => {
    const u = update();
    await u.run(PR);
    expect(u.calls.some((c) => c.includes("(draft)"))).toBe(false);
  });

  it("says there is nothing to update, and touches no branch, when nothing is behind", async () => {
    const u = update({ version: "0.3.0", pins: TWO });
    expect(await u.run(PR)).toBe(0);
    expect(u.out).toEqual([
      "✓ Nothing to update: the factory is 0.3.0, the newest release, and both presets are at their newest commits.",
    ]);
    expect(u.calls).toEqual([]);
  });
});

describe("the settings factory update reads", () => {
  let repo: string;
  afterEach(() => rmSync(repo, { recursive: true, force: true }));
  const withSettings = (settings: string) => {
    repo = mkdtempSync(join(tmpdir(), "factory-update-"));
    writeSettings(repo, settings);
  };

  it("reads the settings file as it is now, edited since the last sync", async () => {
    withSettings(`version: 2\nrepository: o/r\n${CODE_HOST_YAML}\n`);
    appendFileSync(join(repo, ".claude/factory.yaml"), "pr-review:\n");
    const said: string[] = [];
    const settings = await settingsNow(repo, (l) => said.push(l));
    expect(said).toEqual([]);
    expect(settings?.prReview).not.toBeNull();
  });

  it("says what the settings lack in one line, and reads none", async () => {
    withSettings("version: 2\nrepository: o/r\ncode-host:\n  type: github\n");
    const said: string[] = [];
    expect(await settingsNow(repo, (l) => said.push(l))).toBeNull();
    expect(said).toEqual([
      expect.stringContaining("code-host.branch-name: is required"),
    ]);
  });
});

describe("factory update, the command, in the factory's own repository", () => {
  it("reads the settings, the lock, and its pins, and finds nothing to move", () => {
    const r = spawnSync(
      "node",
      [join(import.meta.dirname, "..", "bin", "factory.js"), "update"],
      { encoding: "utf8" },
    );
    expect({ code: r.status, out: r.stdout, err: r.stderr }).toEqual({
      code: 0,
      out: "✓ Nothing to update: the factory runs from its source here.\n",
      err: "",
    });
  });
});
