// What a pull request of a ticket across repositories waits for.
import { describe, expect, it } from "vitest";
import { orderOf } from "../src/merge-order.mts";
import type { Tickets } from "../src/tickets/types.mts";
import { memoryTickets, type Seed } from "./memory-tickets";
import { API, confirming, network, SECTION, WEB, type Place } from "./network";

type World = {
  here?: string;
  body?: string;
  ticket?: Partial<Seed>;
  /** Other tickets. */
  more?: Seed[];
  places?: Record<string, Place>;
  reaches?: boolean;
  read?: Tickets["read"];
};

async function order(w: World = {}) {
  const here = w.here ?? "acme/web";
  const key = here === "acme/api" ? "12" : "acme/api#12";
  const memory = memoryTickets(
    [
      {
        key,
        body: `The ask.\n\n${SECTION}`,
        comments: [confirming([API, WEB])],
        ...w.ticket,
      } as Seed,
      ...(w.more ?? []),
    ],
    { repository: here },
  );
  const found = await orderOf(w.body ?? "Part of acme/api#12", {
    tickets: { ...memory.tickets, ...(w.read ? { read: w.read } : {}) },
    repository: here,
    reach: network(w.places ?? { "acme/api": {}, "acme/web": {} }).reach,
    reaches: w.reaches ?? true,
    log: () => {},
  });
  return found;
}
const API_OPEN = { pulls: [{ number: 88, body: "Part of #12" }] };
const API_MERGED = {
  pulls: [{ number: 88, body: "Part of #12", state: "closed", merged: true }],
};

describe("Merge order", () => {
  it("waits for the open pull request it merges after", async () => {
    expect(
      await order({ places: { "acme/api": API_OPEN, "acme/web": {} } }),
    ).toEqual({
      state: "pending",
      description: "Waits for acme/api#88 to merge",
    });
  });

  it("waits for a repository with no pull request yet", async () => {
    expect(await order()).toEqual({
      state: "pending",
      description: "Waits for acme/api, which has no pull request yet",
    });
  });

  it("has nothing to wait for once that merged", async () => {
    expect(
      await order({ places: { "acme/api": API_MERGED, "acme/web": {} } }),
    ).toEqual({ state: "success", description: "Nothing to wait for" });
  });

  it("has nothing to wait for in the repository that merges first", async () => {
    expect(await order({ here: "acme/api", body: "Part of #12" })).toEqual({
      state: "success",
      description: "Nothing to wait for",
    });
  });

  it.each([
    ["links nothing", "Why."],
    ["closes a ticket", "Closes #12"],
    ["is part of a ticket that is not there", "Part of #99"],
  ])("is not posted on one that %s", async (_, body) => {
    expect(await order({ here: "acme/api", body })).toBeNull();
  });

  it("is not posted for a ticket that names only its own repository", async () => {
    expect(
      await order({
        here: "acme/api",
        body: "Part of #12",
        ticket: { body: "The ask." },
      }),
    ).toBeNull();
  });

  it.each([
    ["acme/web", "Part of acme/api#12", "acme/api#12"],
    ["acme/api", "Part of #12", "#12"],
  ])(
    "holds nothing in %s where no token reaches the others",
    async (here, body, ref) => {
      expect(await order({ here, body, reaches: false })).toEqual({
        state: "success",
        description: `Can't read ${ref}: no token here reaches it`,
      });
    },
  );

  it.each<[string, World, string]>([
    [
      "of the ticket",
      { read: () => Promise.reject(new Error("HTTP 502")) },
      "acme/api#12",
    ],
    [
      "of a repository",
      {
        places: {
          "acme/api": { fail: { recentPulls: new Error("HTTP 502") } },
          "acme/web": {},
        },
      },
      "acme/api#12",
    ],
    [
      "of a ticket that is not there",
      { body: "Part of acme/api#99" },
      "acme/api#99",
    ],
  ])("waits when there is a token and a read %s fails", async (_, w, ref) => {
    expect(await order(w)).toEqual({
      state: "pending",
      description: `Could not read ${ref}`,
    });
  });

  it("waits for a list that was not confirmed", async () => {
    expect(await order({ ticket: { comments: [] } })).toEqual({
      state: "pending",
      description: "acme/api#12's repositories are not confirmed",
    });
  });

  it.each([
    ["first", "Part of acme/ios#7\nPart of acme/api#12"],
    ["last", "Part of acme/api#12\nPart of acme/ios#7"],
  ])("waits by the one of two tickets that waits, %s", async (_, body) => {
    const IOS = { name: "acme/ios", after: [] };
    const found = await order({
      body,
      more: [
        {
          key: "acme/ios#7",
          body: "## Repositories\n\n- acme/ios\n- acme/web, after acme/ios\n",
          comments: [confirming([IOS, { ...WEB, after: ["acme/ios"] }])],
        },
      ],
      places: {
        "acme/api": API_MERGED,
        "acme/ios": { pulls: [{ number: 5, body: "Part of #7" }] },
        "acme/web": {},
      },
    });
    expect(found).toEqual({
      state: "pending",
      description: "Waits for acme/ios#5 to merge",
    });
  });

  it("fits what a status holds", async () => {
    const long = `acme/${"a".repeat(160)}`;
    const found = await order({
      ticket: {
        body: `## Repositories\n\n- ${long}\n- acme/web, after ${long}\n`,
        comments: [
          confirming([
            { name: long, after: [] },
            { name: "acme/web", after: [long] },
          ]),
        ],
      },
      places: { [long]: {}, "acme/web": {} },
    });
    expect(found!.description).toHaveLength(140);
    expect(found!.description.endsWith("…")).toBe(true);
  });
});
