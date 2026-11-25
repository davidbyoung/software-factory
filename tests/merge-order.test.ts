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
      { key: "4", labels: ["follow-up"], body: "- [ ] a line" },
    ],
    { repository: here },
  );
  const log: string[] = [];
  const found = await orderOf(w.body ?? "Part of acme/api#12", {
    tickets: { ...memory.tickets, ...(w.read ? { read: w.read } : {}) },
    repository: here,
    reach: network(w.places ?? { "acme/api": {}, "acme/web": {} }).reach,
    reaches: w.reaches ?? true,
    log: (line) => void log.push(line),
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
    ["is part of the follow-ups", "Part of #4"],
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

  it("holds nothing where no token reaches the ticket", async () => {
    expect(await order({ reaches: false })).toEqual({
      state: "success",
      description: "Can't read acme/api#12: no token here reaches it",
    });
    expect(
      await order({ here: "acme/api", body: "Part of #12", reaches: false }),
    ).toEqual({
      state: "success",
      description: "Can't read #12: no token here reaches it",
    });
  });

  it("waits when there is a token and a read fails", async () => {
    const failed = {
      state: "pending",
      description: "Could not read acme/api#12",
    };
    expect(
      await order({ read: () => Promise.reject(new Error("HTTP 502")) }),
    ).toEqual(failed);
    expect(
      await order({
        places: {
          "acme/api": { fail: { recentPulls: new Error("HTTP 502") } },
          "acme/web": {},
        },
      }),
    ).toEqual(failed);
    expect(await order({ body: "Part of acme/api#99" })).toEqual({
      state: "pending",
      description: "Could not read acme/api#99",
    });
  });

  it("waits for a list that was not confirmed", async () => {
    expect(await order({ ticket: { comments: [] } })).toEqual({
      state: "pending",
      description: "acme/api#12's repositories are not confirmed",
    });
  });

  it("waits by any of two tickets it is part of", async () => {
    expect(
      (
        await order({
          places: { "acme/api": API_MERGED, "acme/web": {} },
          body: "Part of acme/api#99\nPart of acme/api#12",
        })
      )?.state,
    ).toBe("pending");
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
