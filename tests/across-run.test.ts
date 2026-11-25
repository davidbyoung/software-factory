// What a pull request of a ticket across repositories tells the others.
import { describe, expect, it } from "vitest";
import { main, type Event } from "../src/across-run.mts";
import { DEFAULT_COLUMNS } from "../src/lib/work-status.mts";
import { memoryRunner } from "./memory-runner";
import { memoryTickets, type Seed } from "./memory-tickets";
import { API, confirming, network, SECTION, WEB, type Place } from "./network";
import { into } from "./printed";

const merged = (number: number, body: string) => ({
  number,
  body,
  state: "closed",
  merged: true,
});

function world(
  o: {
    here?: string;
    ticket?: Partial<Seed>;
    places?: Record<string, Place>;
    startFails?: boolean;
  } = {},
) {
  const here = o.here ?? "acme/web";
  const key = here === "acme/api" ? "12" : "acme/api#12";
  const memory = memoryTickets(
    [
      {
        key,
        body: `The ask.\n\n${SECTION}`,
        comments: [confirming([API, WEB])],
        ...o.ticket,
      } as Seed,
    ],
    { repository: here, now: () => "2026-11-09T13:30:00Z" },
  );
  const log: string[] = [];
  const out: string[] = [];
  const net = network(o.places ?? { "acme/api": {}, "acme/web": {} });
  const run = (over: Partial<Event["pull_request"]> = {}, action = "closed") =>
    main(
      {
        action,
        pull_request: {
          number: here === "acme/api" ? 88 : 41,
          merged: false,
          merged_at: null,
          created_at: "2026-11-09T12:00:00Z",
          body: here === "acme/api" ? "Part of #12" : "Part of acme/api#12",
          head: { ref: "b", repo: { full_name: here } },
          ...over,
        },
      },
      {
        tickets: memory.tickets,
        repository: here,
        columns: DEFAULT_COLUMNS,
        reach: net.reach,
        runner: async (name) => {
          const own: string[] = [];
          const { runner } = memoryRunner({
            log: own,
            ...(o.startFails
              ? { fail: { startOn: new Error("HTTP 403") } }
              : {}),
          });
          return {
            startOn: async (...a) => {
              await runner.startOn(...a);
              log.push(`${name} ${own.at(-1)}`);
            },
            startSync: async (...a) => {
              await runner.startSync(...a);
              log.push(`${name} ${own.at(-1)}`);
            },
          };
        },
        now: () => new Date("2026-11-09T13:00:00Z"),
        out: into(out),
      },
    );
  return {
    run,
    log,
    out,
    ticket: () => memory.state.get(key)!,
    notes: () =>
      memory
        .comments(key)
        .slice(1)
        .map((c) => c.body.split("\n")[0]),
  };
}

const MERGE = { merged: true, merged_at: "2026-11-09T12:45:00Z" };
const API_MERGED: Place = { pulls: [merged(88, "Part of #12")] };
const WEB_MERGED: Place = { pulls: [merged(41, "Part of acme/api#12")] };
const WEB_OPEN: Place = {
  pulls: [{ number: 41, body: "Part of acme/api#12" }],
};

describe("the last pull request to merge", () => {
  it("finishes the ticket, and names every pull request", async () => {
    const w = world({
      places: { "acme/api": API_MERGED, "acme/web": WEB_MERGED },
    });
    expect(await w.run(MERGE)).toBe(0);
    expect(w.notes()).toEqual([
      "Every repository merged: acme/api#88, acme/web#41.",
    ]);
    expect(w.ticket().finishedAt).not.toBeNull();
    expect(w.log).toEqual(["acme/api startSync main"]);
  });

  it("counts as merged by its event, where the code host's list lacks it", async () => {
    const w = world({
      places: { "acme/api": API_MERGED, "acme/web": WEB_OPEN },
    });
    await w.run(MERGE);
    expect(w.ticket().finishedAt).not.toBeNull();
  });

  it("finishes nothing while another repository has not merged", async () => {
    const w = world({ places: { "acme/api": {}, "acme/web": WEB_MERGED } });
    await w.run(MERGE);
    expect(w.ticket().finishedAt).toBeNull();
    expect(w.notes()).toEqual([]);
  });

  it("says nothing again of a ticket another run finished", async () => {
    const w = world({
      ticket: { finishedAt: "2026-11-09T13:00:00Z" },
      places: { "acme/api": API_MERGED, "acme/web": WEB_MERGED },
    });
    await w.run(MERGE);
    expect(w.notes()).toEqual([]);
  });

  it("does not count those that merged before a reopened ticket finished", async () => {
    const finished = {
      id: "f",
      author: "dev",
      createdAt: "2026-11-09T12:40:00Z",
      body: "Every repository merged.\n\n<!-- work-status: finished -->\n<!-- agent -->",
    };
    const w = world({
      ticket: {
        reopened: true,
        comments: [confirming([API, WEB]), finished],
      },
      places: { "acme/api": API_MERGED, "acme/web": WEB_MERGED },
    });
    await w.run(MERGE);
    expect(w.ticket().finishedAt).toBeNull();
  });
});

describe("an earlier pull request that merges", () => {
  it("has each other repository's open one worked out again, and the board synced", async () => {
    const w = world({
      here: "acme/api",
      places: { "acme/api": API_MERGED, "acme/web": WEB_OPEN },
    });
    expect(await w.run(MERGE)).toBe(0);
    expect(w.log).toEqual([
      "acme/web startOn order 41 main",
      "acme/api startSync main",
    ]);
    expect(w.ticket().finishedAt).toBeNull();
  });

  it("goes on when another repository cannot be told", async () => {
    const w = world({
      here: "acme/api",
      places: { "acme/api": API_MERGED, "acme/web": WEB_OPEN },
      startFails: true,
    });
    expect(await w.run(MERGE)).toBe(0);
    expect(w.out).toContain("Could not tell acme/web#41: HTTP 403");
    expect(w.log).toEqual(["acme/api startSync main"]);
  });
});

describe("a pull request that is opened", () => {
  it("has those that waited for one worked out again", async () => {
    const w = world({
      here: "acme/api",
      places: {
        "acme/api": { pulls: [{ number: 88, body: "Part of #12" }] },
        "acme/web": WEB_OPEN,
      },
    });
    await w.run({}, "opened");
    expect(w.log).toContain("acme/web startOn order 41 main");
    expect(w.notes()).toEqual([]);
  });
});

describe("one closed without merging", () => {
  it("is noted on the ticket, which waits on you", async () => {
    const w = world();
    await w.run();
    expect(w.notes()[0]).toMatch(
      /^acme\/web#41 was closed without merging\. The card stays In progress, waiting on you\./,
    );
  });

  it("is not noted on a ticket that is finished", async () => {
    const w = world({ ticket: { finishedAt: "2026-11-09T13:00:00Z" } });
    await w.run();
    expect(w.notes()).toEqual([]);
  });
});

describe("what it leaves alone", () => {
  it("is a pull request from another repository", async () => {
    const w = world();
    await w.run({ head: { ref: "b", repo: { full_name: "mallory/web" } } });
    expect(w.notes()).toEqual([]);
    expect(w.log).toEqual([]);
  });

  it("is a ticket that does not name this repository", async () => {
    const w = world({
      ticket: { body: "## Repositories\n\n- acme/api\n- acme/ios\n" },
    });
    await w.run();
    expect(w.notes()).toEqual([]);
    expect(w.out).toEqual(["acme/api#12 does not name acme/web."]);
  });

  it("is a list nobody who may confirmed", async () => {
    const w = world({
      ticket: { comments: [confirming([API, WEB], "mallory")] },
      places: { "acme/api": API_MERGED, "acme/web": WEB_MERGED },
    });
    await w.run(MERGE);
    expect(w.ticket().finishedAt).toBeNull();
    expect(w.log).toEqual([]);
  });

  it("is a ticket that is not there", async () => {
    const w = world();
    expect(await w.run({ body: "Part of acme/api#99" })).toBe(0);
    expect(w.out).toEqual(["acme/api#99 was not found."]);
  });
});

it("fails the run when what it reads fails", async () => {
  const w = world({
    places: {
      "acme/api": { fail: { recentPulls: new Error("HTTP 502") } },
      "acme/web": {},
    },
  });
  expect(await w.run(MERGE)).toBe(1);
  expect(w.out).toEqual(["acme/api#12: HTTP 502"]);
});
