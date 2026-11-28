// The ticket commands on a ticket that names more than its own repository:
// `lunamill ticket repositories`, and what claim, link, branch, edit, end,
// and refined ask of one.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseSettings } from "../src/config.mts";
import { listIn, markedList } from "../src/lib/repositories.mts";
import type { PullRequest } from "../src/lib/work-status.mts";
import { main, type Deps } from "../src/ticket.mts";
import { entryOf } from "../src/tickets/record-comments.mts";
import { LUNAMILL_COLUMNS } from "./lunamill-columns";
import { memoryTickets, type Seed } from "./memory-tickets";
import {
  API,
  confirming,
  network,
  OLD_LOCK,
  SECTION,
  WEB,
  type Place,
} from "./network";

const AGENT = "<!-- agent -->";
const marked = (marker: string, at = "12:10") => ({
  id: `m-${marker}-${at}`,
  author: "dev",
  createdAt: `2026-11-09T${at}:00Z`,
  body: `Text.\n\n<!-- work-status: ${marker} -->\n${AGENT}`,
});

type World = {
  ticket?: Partial<Seed>;
  places?: Record<string, Place>;
  /** The repository of the checkout the command runs in. */
  here?: string;
  me?: string;
  actions?: boolean;
  cloud?: boolean;
  /** Why no "Merge order" can be worked out again. */
  refused?: string;
};

function world(w: World = {}) {
  const here = w.here ?? "acme/api";
  const key = here === "acme/api" ? "12" : "acme/api#12";
  const memory = memoryTickets(
    [{ key, labels: ["lunamill"], body: "The ask.\n", ...w.ticket } as Seed],
    { repository: here, owner: "dev", now: () => "2026-11-09T12:59:00Z" },
  );
  const places = w.places ?? { "acme/api": {}, "acme/web": {} };
  const net = network(places);
  const out: string[] = [];
  const started: string[] = [];
  const synced: string[] = [];
  const d: Deps = {
    open: async () => ({ tickets: memory.tickets }),
    openPulls: async () => [] as PullRequest[],
    reach: async (name) => net.reach(name),
    startOrder: async (repository, pull) => {
      if (w.refused) throw new Error(w.refused);
      started.push(`${repository}#${pull}`);
    },
    runner: () => ({
      thisRun: () =>
        w.actions ? { id: "555", page: "https://runs.example/555" } : null,
    }),
    startSync: async (repository) => void synced.push(repository),
    settings: async () =>
      parseSettings(
        {
          version: 1,
          repository: here,
          "code-host": { type: "github", "branch-name": "{user}/{ticket}" },
          tickets: { board: 1, columns: LUNAMILL_COLUMNS },
        },
        () => true,
      ),
    env: { CLAUDE_CODE_SESSION_ID: "s1" },
    sleep: async () => {},
    out: (line) => void out.push(line),
    readFile: () => "New text.\n\n## Decisions\n\n- x\n",
    claimStore: { read: () => null, write: () => {} },
    now: () => new Date("2026-11-09T13:00:00Z"),
    clock: { read: () => null, write: () => {} },
    measure: () => ({
      ok: true,
      spend: { dollars: 0, priced: 0, unpriced: new Map() },
    }),
    signedInAs: async () => w.me ?? "dev",
    hasName: () => true,
    ...(w.cloud ? { fromCloudSession: true } : {}),
  };
  const run = (...argv: string[]) => main(argv, d);
  return {
    run,
    /** Edits the ticket to that body. */
    edit: (text: string) =>
      main(["edit", key, "--body-file", "b.md"], {
        ...d,
        readFile: () => text,
      }),
    out,
    started,
    synced,
    key,
    memory,
    net,
    body: () => memory.state.get(key)!.body,
    comments: () => memory.comments(key),
    /** The lists the ticket's notes record. */
    notes: () =>
      memory
        .comments(key)
        .flatMap((c) => markedList(entryOf(c)?.markers ?? []) ?? []),
  };
}

const two = (over: Partial<Seed> = {}): Partial<Seed> => ({
  body: `The ask.\n\n${SECTION}`,
  comments: [confirming([API, WEB])],
  ...over,
});
const part = (number: number, text = "Part of #12") => ({
  number,
  body: text,
});
const WEB_PART = part(41, "Part of acme/api#12");

let errors: string[] = [];
beforeEach(() => {
  errors = [];
  vi.spyOn(console, "error").mockImplementation(
    (line: unknown) => void errors.push(String(line)),
  );
});
afterEach(() => vi.restoreAllMocks());

describe("lunamill ticket repositories N", () => {
  it("prints each repository in the section's order, and exits 0", async () => {
    const w = world({ ticket: two() });
    expect(await w.run("repositories", "12")).toBe(0);
    expect(w.out).toEqual([
      "#12 repositories",
      "  ✓ acme/api   set up",
      "  ✓ acme/web   set up",
    ]);
    expect(w.synced).toEqual([]);
  });

  it("says where a ticket with no section builds", async () => {
    const w = world();
    expect(await w.run("repositories", "12")).toBe(0);
    expect(w.out).toEqual(["#12 builds in acme/api."]);
  });

  it.each<[string, Place, string]>([
    [
      "has no lock",
      { lock: null },
      "not set up: run lunamill init in acme/web before building",
    ],
    [
      "has an older factory",
      { lock: OLD_LOCK },
      "on lunamill 0.5.0, which can't build a ticket from another repository: run lunamill update in acme/web",
    ],
    ["cannot be seen", { unseen: true }, "not found, or you can't see it"],
  ])("marks a repository that %s, and exits 1", async (_, place, text) => {
    const w = world({
      ticket: two(),
      places: { "acme/api": {}, "acme/web": place },
    });
    expect(await w.run("repositories", "12")).toBe(1);
    expect(w.out[2]).toBe(`  ✗ acme/web   ${text}`);
  });

  it("says last that nobody who may confirmed the list", async () => {
    const w = world({ ticket: two({ comments: [] }) });
    expect(await w.run("repositories", "12")).toBe(1);
    expect(w.out.at(-1)).toBe(
      "✗ #12's repositories were not confirmed by someone who can write to acme/api: run lunamill ticket repositories 12 --set acme/api acme/web --after acme/web=acme/api",
    );
  });

  it("names the line of the section it cannot read", async () => {
    const w = world({ ticket: { body: "## Repositories\n\n- acme web\n" } });
    expect(await w.run("repositories", "12")).toBe(1);
    expect(errors).toEqual([
      `#12's Repositories section: can't read "- acme web"`,
    ]);
  });
});

describe("lunamill ticket repositories N --set", () => {
  const SET = [
    "repositories",
    "12",
    "--set",
    "acme/api",
    "acme/web",
    "--after",
    "acme/web=acme/api",
  ];

  it("records the list with its order, and a note of who confirmed it", async () => {
    const w = world({ places: { "acme/api": {}, "acme/web": { lock: null } } });
    expect(await w.run(...SET)).toBe(0);
    expect(w.out).toEqual([
      "#12 repositories",
      "  ✓ acme/api   set up",
      "  ✗ acme/web   not set up: run lunamill init in acme/web before building",
      "Recorded on #12. acme/web merges after acme/api.",
    ]);
    expect(listIn(w.body())).toEqual([API, WEB]);
    expect(w.notes()).toEqual([API, WEB]);
    expect(w.comments().at(-1)!.body.split("\n")[0]).toBe(
      "Repositories: acme/api, acme/web (after acme/api).",
    );
    expect(w.synced).toEqual(["acme/api"]);
  });

  it("replaces the list, its order included", async () => {
    const w = world({ ticket: two() });
    await w.run("repositories", "12", "--set", "acme/api", "acme/web");
    expect(listIn(w.body())).toEqual([API, { ...WEB, after: [] }]);
    expect(w.out.at(-1)).toBe("Recorded on #12.");
  });

  it("takes the section out with only the ticket's own repository left", async () => {
    const w = world({ ticket: two() });
    expect(await w.run("repositories", "12", "--set", "acme/api")).toBe(0);
    expect(w.body()).toBe("The ask.\n");
    expect(w.out).toEqual(["#12 builds in acme/api."]);
    // The note for the old list no longer is the newest, so a section put
    // back by hand does not count.
    expect(w.notes().at(-1)).toEqual(API);
  });

  it.each<[string, Place, string]>([
    [
      "is not found",
      { unseen: true },
      "  ✗ acme/web   not found, or you can't see it",
    ],
    [
      "they cannot write to",
      { writers: ["ann"] },
      "  ✗ acme/web   you can't write to it, so you can't put it on the list",
    ],
  ])("records nothing when a repository %s", async (_, place, line) => {
    const w = world({ places: { "acme/api": {}, "acme/web": place } });
    expect(await w.run(...SET)).toBe(1);
    expect(w.out).toEqual(["#12 repositories", "  ✓ acme/api   set up", line]);
    expect(w.body()).toBe("The ask.\n");
    expect(w.comments()).toEqual([]);
  });

  it("records nothing for a repository of another owner", async () => {
    const w = world({ places: { "acme/api": {}, "other/web": {} } });
    expect(
      await w.run("repositories", "12", "--set", "acme/api", "other/web"),
    ).toBe(1);
    expect(w.out).toContain(
      "  ✗ other/web   another owner than acme/api: a ticket's repositories have one owner",
    );
    expect(w.comments()).toEqual([]);
  });

  it("records nothing for an order that goes in a circle", async () => {
    const w = world();
    expect(await w.run(...SET, "--after", "acme/api=acme/web")).toBe(1);
    expect(w.out).toEqual([
      "✗ acme/api and acme/web each merge after the other",
    ]);
    expect(w.comments()).toEqual([]);
  });

  it("records nothing for a pair that is not on the list", async () => {
    const w = world();
    expect(await w.run(...SET, "--after", "acme/web=acme/ios")).toBe(1);
    expect(w.out).toEqual([
      "✗ --after names acme/ios, which is not one of #12's repositories",
    ]);
  });

  it("refuses while a build is live and a repository has no pull request", async () => {
    const comments = [confirming([API, WEB]), marked("claim actions 5")];
    const w = world({
      ticket: two({ comments }),
      places: { "acme/api": { pulls: [part(88)] }, "acme/web": {} },
    });
    expect(await w.run("repositories", "12", "--set", "acme/api")).toBe(1);
    expect(w.out).toEqual([
      "✗ #12 is being built: wait for it, or stop that build first",
    ]);
    expect(listIn(w.body())).toEqual([API, WEB]);
  });

  it("says which dropped repository still has a pull request open", async () => {
    const comments = [confirming([API, WEB]), marked("claim actions 5")];
    const w = world({
      ticket: two({ comments }),
      places: {
        "acme/api": { pulls: [part(88)] },
        "acme/web": { pulls: [WEB_PART] },
      },
    });
    expect(await w.run("repositories", "12", "--set", "acme/api")).toBe(0);
    expect(w.out.at(-1)).toBe(
      "? acme/web#41 is still open: close it, or merge it knowing that #12 does not wait for it",
    );
  });

  it("has each open pull request's order worked out again", async () => {
    const w = world({
      ticket: two(),
      places: {
        "acme/api": { pulls: [part(88)] },
        "acme/web": { pulls: [WEB_PART] },
      },
    });
    await w.run("repositories", "12", "--set", "acme/api", "acme/web");
    expect(w.started).toEqual(["acme/api#88", "acme/web#41"]);
  });

  it("says what to do where one can't be worked out again", async () => {
    const w = world({
      ticket: two(),
      places: {
        "acme/api": {},
        "acme/web": { pulls: [WEB_PART] },
      },
      refused: "HTTP 403",
    });
    const set = ["--set", "acme/api", "acme/web"];
    expect(await w.run("repositories", "12", ...set)).toBe(0);
    expect(w.out.at(-1)).toBe(
      `? couldn't have acme/web#41's "Merge order" worked out again: push to it, or mark it ready, to do it (HTTP 403)`,
    );
  });

  it("writes nothing when the list is confirmed as it stands", async () => {
    const w = world({ ticket: two() });
    expect(await w.run(...SET)).toBe(0);
    expect(w.comments()).toHaveLength(1);
    expect(w.out.at(-1)).toBe("  ✓ acme/web   set up");
  });

  it("confirms a list that was not", async () => {
    const w = world({ ticket: two({ comments: [] }) });
    expect(await w.run(...SET)).toBe(0);
    expect(w.notes()).toEqual([API, WEB]);
  });
});

describe("what lunamill ticket repositories refuses to read", () => {
  it.each([
    ["--set"],
    ["--set", "acme/api", "--add", "acme/web"],
    ["--after", "acme/web=acme/api"],
    ["--set", "acme/api", "--after", "acme/web"],
    ["--set", "acme/api", "--drop"],
    ["acme/web", "--set", "acme/api"],
    ["acme/web"],
  ])("%s %s %s %s", async (...argv) => {
    const w = world();
    expect(await w.run("repositories", "12", ...argv)).toBe(1);
    expect(errors[0]).toMatch(/^Usage: lunamill ticket repositories N/);
    expect(w.comments()).toEqual([]);
  });

  it("is a name that is not a repository's", async () => {
    const w = world();
    expect(await w.run("repositories", "12", "--set", "web")).toBe(1);
    expect(errors).toEqual(["web is not a repository: write it as owner/name"]);
  });
});

describe("lunamill ticket repositories N --add", () => {
  const MOBILE: Place = {};

  it("adds to the list, keeping its order", async () => {
    const w = world({
      ticket: two(),
      places: { "acme/api": {}, "acme/web": {}, "acme/mobile": MOBILE },
    });
    expect(
      await w.run(
        "repositories",
        "12",
        "--add",
        "acme/mobile",
        "--after",
        "acme/mobile=acme/api",
      ),
    ).toBe(0);
    expect(listIn(w.body())).toEqual([
      API,
      WEB,
      { name: "acme/mobile", after: ["acme/api"] },
    ]);
  });

  it("starts the list with the ticket's own repository", async () => {
    const w = world();
    await w.run("repositories", "12", "--add", "acme/web");
    expect(listIn(w.body())).toEqual([API, { ...WEB, after: [] }]);
  });

  it("has an open pull request that closes the ticket build part of it", async () => {
    const w = world({
      ticket: { comments: [marked("claim local a")] },
      places: {
        "acme/api": {
          pulls: [part(88, "Closes #12\n\nWhy. Closes #120 is another.")],
        },
        "acme/web": {},
      },
    });
    expect(await w.run("repositories", "12", "--add", "acme/web")).toBe(0);
    expect(w.net.hosts["acme/api"]!.pull(88).body).toBe(
      "Part of #12\n\nWhy. Closes #120 is another.",
    );
    expect(w.comments().at(-1)!.body).toContain(
      "acme/web was added. The card stays In progress, waiting on you.",
    );
  });

  it("says nothing of the state before any pull request is open", async () => {
    const w = world();
    await w.run("repositories", "12", "--add", "acme/web");
    expect(w.comments()).toHaveLength(1);
  });
});

describe("lunamill ticket claim", () => {
  it("claims a ticket whose repositories are ready", async () => {
    const w = world({ ticket: two() });
    expect(await w.run("claim", "12")).toBe(0);
    expect(w.out).toEqual(["claimed"]);
  });

  it.each<[string, World, string]>([
    [
      "one is not set up",
      { places: { "acme/api": {}, "acme/web": { lock: null } } },
      "#12 names acme/web, which is not set up: run lunamill init in acme/web",
    ],
    [
      "one's factory is too old",
      { places: { "acme/api": {}, "acme/web": { lock: OLD_LOCK } } },
      "#12 names acme/web, whose lunamill is too old: run lunamill update in acme/web",
    ],
    [
      "one cannot be seen",
      {
        places: {
          "acme/api": {},
          "acme/web": { unseen: true, writers: ["dev"] },
        },
      },
      "#12 names acme/web, which was not found, or you can't see it",
    ],
    [
      "the list was changed by hand",
      { ticket: two({ body: "## Repositories\n\n- acme/api\n- acme/web\n" }) },
      "#12's repositories were not confirmed by someone who can write to acme/api: run lunamill ticket repositories 12 --set acme/api acme/web",
    ],
    [
      "whoever confirmed it cannot write to one",
      {
        ticket: two(),
        places: { "acme/api": {}, "acme/web": { writers: ["ann"] } },
      },
      "#12's repositories were not confirmed by someone who can write to acme/web: run lunamill ticket repositories 12 --set acme/api acme/web --after acme/web=acme/api",
    ],
  ])("posts nothing when %s", async (_, o, why) => {
    const w = world({ ticket: two(), ...o });
    const before = w.comments().length;
    expect(await w.run("claim", "12")).toBe(1);
    expect(w.out).toEqual([`✗ ${why}`]);
    expect(w.comments()).toHaveLength(before);
  });

  it("stops the ticket with the same words in the cloud", async () => {
    const w = world({
      ticket: two(),
      actions: true,
      places: { "acme/api": {}, "acme/web": { lock: null } },
    });
    expect(await w.run("claim", "12")).toBe(1);
    expect(w.comments().at(-1)!.body).toContain(
      "Stopped without a pull request: #12 names acme/web, which is not set up: run lunamill init in acme/web.",
    );
  });

  it("refuses a checkout the ticket does not name", async () => {
    const w = world({ here: "acme/docs", ticket: two() });
    expect(await w.run("claim", "acme/api#12")).toBe(1);
    expect(w.out).toEqual([
      "✗ This checkout, acme/docs, is not one of acme/api#12's repositories: acme/api, acme/web",
    ]);
  });

  it("refuses another repository's ticket that names none", async () => {
    const w = world({ here: "acme/web" });
    expect(await w.run("claim", "acme/api#12")).toBe(1);
    expect(w.out).toEqual([
      "✗ This checkout, acme/web, is not one of acme/api#12's repositories: acme/api",
    ]);
  });

  it("starts the sync of the ticket's own repository", async () => {
    const w = world({ here: "acme/web", ticket: two() });
    expect(await w.run("claim", "acme/api#12")).toBe(0);
    expect(w.synced).toEqual(["acme/api"]);
  });
});

describe("lunamill ticket link", () => {
  it("closes a ticket that names only its own repository", async () => {
    const w = world();
    await w.run("link", "12");
    expect(w.out).toEqual(["Closes #12"]);
  });

  it("builds part of one that names others, in its own repository", async () => {
    const w = world({ ticket: two() });
    await w.run("link", "12");
    expect(w.out).toEqual(["Part of #12"]);
  });

  it("names the newest of two that a reopened ticket has there", async () => {
    const w = world({
      here: "acme/web",
      ticket: two(),
      places: {
        "acme/api": { pulls: [part(88), part(90)] },
        "acme/web": {},
      },
    });
    await w.run("link", "acme/api#12");
    expect(w.out).toEqual(["Part of acme/api#12", "Depends-On: acme/api#90"]);
  });

  it("names what it merges after, once that has a pull request", async () => {
    const w = world({
      here: "acme/web",
      ticket: two(),
      places: { "acme/api": { pulls: [part(88)] }, "acme/web": {} },
    });
    await w.run("link", "acme/api#12");
    expect(w.out).toEqual(["Part of acme/api#12", "Depends-On: acme/api#88"]);
  });

  it("does not take a fork's pull request for the one it merges after", async () => {
    const fork = {
      ...part(88),
      head: { sha: "f", branch: "x", repository: "mallory/api" },
    };
    const w = world({
      here: "acme/web",
      ticket: two(),
      places: { "acme/api": { pulls: [fork] }, "acme/web": {} },
    });
    await w.run("link", "acme/api#12");
    expect(w.out).toEqual(["Part of acme/api#12"]);
  });
});

describe("lunamill ticket branch", () => {
  it("names another repository's ticket by its repository and number", async () => {
    const w = world({ here: "acme/web", ticket: two() });
    await w.run("branch", "acme/api#12");
    expect(w.out).toEqual(["dev/api-12"]);
  });
});

describe("lunamill ticket edit", () => {
  it("keeps the section a new body lacks", async () => {
    const w = world({ ticket: two() });
    await w.run("edit", "12", "--body-file", "b.md");
    expect(w.body()).toBe(`New text.\n\n${SECTION}\n## Decisions\n\n- x\n`);
  });

  it("takes the section a new body has", async () => {
    const w = world({ ticket: two() });
    const other = "## Repositories\n\n- acme/api\n- acme/ios\n";
    await w.edit(other);
    expect(w.body()).toBe(other);
  });

  it("keeps the ticket's own for a session in the cloud, whatever it has", async () => {
    const w = world({ ticket: two(), cloud: true });
    await w.edit("## Repositories\n\n- acme/payroll\n");
    expect(listIn(w.body())).toEqual([API, WEB]);
  });

  it("adds none for a session in the cloud", async () => {
    const w = world({ cloud: true });
    await w.edit("Text.\n\n## Repositories\n\n- acme/payroll\n");
    expect(listIn(w.body())).toBeNull();
  });
});

describe("lunamill ticket end", () => {
  const claimed = [confirming([API, WEB]), marked("claim local s1")];

  it("keeps the claim while this repository has a pull request for it", async () => {
    const w = world({
      ticket: two({ comments: claimed }),
      places: { "acme/api": { pulls: [part(88)] }, "acme/web": {} },
    });
    await w.run("end", "12");
    expect(w.out).toEqual(["kept"]);
  });

  it("releases it when only another repository has one", async () => {
    const w = world({
      here: "acme/web",
      ticket: two({ comments: claimed }),
      places: { "acme/api": { pulls: [part(88)] }, "acme/web": {} },
    });
    await w.run("end", "acme/api#12");
    expect(w.out).toEqual(["released"]);
  });
});

describe("lunamill ticket refined --check", () => {
  it("names a section it cannot read among what is missing", async () => {
    const w = world({
      ticket: {
        body: "## Repositories\n\n- acme web\n\n## Decisions\n\n- x\n\n## Acceptance criteria\n\n- y\n",
      },
    });
    expect(await w.run("refined", "12", "--check")).toBe(1);
    expect(errors).toEqual([
      'missing: a Repositories section that can be read: "- acme web"',
    ]);
  });
});
