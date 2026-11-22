import { describe, expect, it } from "vitest";
import { linkPulls, ownLinks, ticketsOf } from "../src/lib/pull-tickets.mts";
import {
  derive,
  issueCost,
  type Issue,
  type PullRequest,
} from "../src/lib/work-status.mts";
import { fakeSettings } from "./fake-gh";
import { memoryTickets } from "./memory-tickets";

/** Tickets with keys, which are not the code host's own. */
const KEYED = memoryTickets([], { strict: true }).tickets;
const GITHUB = memoryTickets().tickets;

const pull = (body: string, closes: string[] = []): PullRequest => ({
  number: 50,
  createdAt: "2026-11-09T12:30:00Z",
  body,
  closes,
  partOf: [],
  isDraft: true,
  checks: null,
  openThreads: 0,
  author: "acme",
  comments: [
    {
      id: "c1",
      createdAt: "2026-11-09T12:31:00Z",
      author: "acme",
      body: "<!-- cost: 1.25 session=s -->\n<!-- agent -->",
    },
  ],
});
const ticket = (key: string, labels: string[] = []): Issue => ({
  key,
  title: key,
  state: "open",
  closedAt: null,
  labels,
  comments: [],
});

describe("the tickets a pull request builds, when the tickets are not the code host's own", () => {
  it("closes the tickets its body closes, and the sync shows them In review and counts their cost", () => {
    const [linked] = linkPulls([pull("Closes PROJ-12")], KEYED, false);

    expect(linked.closes).toEqual(["PROJ-12"]);
    expect(derive(ticket("PROJ-12"), null, [linked]).status).toBe("In review");
    expect(issueCost(ticket("PROJ-12"), [linked])).toBe(1.25);
  });

  it("counts the cost of a pull request that builds part of a ticket, and shows the follow-ups In review", () => {
    const [linked] = linkPulls([pull("Part of PROJ-4")], KEYED, false);

    expect(linked.partOf).toEqual(["PROJ-4"]);
    expect(issueCost(ticket("PROJ-4"), [linked])).toBe(1.25);
    expect(derive(ticket("PROJ-4", ["follow-up"]), null, [linked]).status).toBe(
      "In review",
    );
  });

  it("links nothing by a plain mention", () => {
    const [linked] = linkPulls(
      [pull("A finding went on PROJ-9, and PROJ-12 is related.")],
      KEYED,
      false,
    );

    expect(linked).toMatchObject({ closes: [], partOf: [] });
    expect(derive(ticket("PROJ-9"), null, [linked]).status).toBe("Backlog");
    expect(issueCost(ticket("PROJ-9"), [linked])).toBeNull();
  });

  it("leaves out the code host's own closing list", () => {
    expect(
      ticketsOf({ body: "Closes PROJ-12", closes: ["12"] }, KEYED, false),
    ).toEqual({ closes: ["PROJ-12"], partOf: [] });
  });
});

describe("the tickets a pull request builds, when the tickets are the code host's own", () => {
  it("closes the tickets the code host says, and builds part of those its body says", () => {
    expect(
      ticketsOf(
        { body: "Closes #7. Closes #9. Part of #4.", closes: ["7", "8"] },
        GITHUB,
        true,
      ),
    ).toEqual({ closes: ["7", "8"], partOf: ["4"] });
  });

  it("counts GitHub's own tickets as its own, and no other pairing", async () => {
    const settings = await fakeSettings();
    expect(ownLinks(settings)).toBe(true);
    expect(
      ownLinks({ ...settings, tickets: { ...settings.tickets, type: "jira" } }),
    ).toBe(false);
  });
});
