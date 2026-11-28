// The strict in-memory adapter holds kodor to what Jira and Linear
// allow, so a command that passes on it does not lean on GitHub's model.
import { describe, expect, it } from "vitest";
import { memoryTickets } from "./memory-tickets";

const MOVES = {
  Backlog: ["Selected"],
  Selected: ["In Progress"],
  "In Progress": ["Done"],
};

describe("the strict in-memory adapter", () => {
  it("moves a card along its allowed moves, through the statuses between", async () => {
    const m = memoryTickets([{ key: "PROJ-1" }], {
      strict: true,
      moves: MOVES,
    });
    m.card("PROJ-1", { status: "Backlog" });

    await m.tickets.board!.move("I_PROJ-1", "Done");
    expect(m.board.get("PROJ-1")!.status).toBe("Done");
    expect(m.writes.flatMap((w) => w.writes)).toEqual(
      ["Selected", "In Progress", "Done"].map((optionName) => ({
        field: "Status",
        optionName,
      })),
    );
  });

  it("refuses a move with no path", async () => {
    const m = memoryTickets([{ key: "PROJ-1" }], {
      strict: true,
      moves: MOVES,
    });
    m.card("PROJ-1", { status: "Done" });

    await expect(m.tickets.board!.move("I_PROJ-1", "Backlog")).rejects.toThrow(
      "No move from Done to Backlog.",
    );
  });

  it("refuses hidden text in a comment", async () => {
    const m = memoryTickets([{ key: "PROJ-1" }], { strict: true });

    await expect(
      m.tickets.comment("PROJ-1", "Hi.\n<!-- work-status: waiting -->"),
    ).rejects.toThrow("hidden text");
  });

  it("refuses a label until it is created", async () => {
    const m = memoryTickets([{ key: "PROJ-1" }], { strict: true });

    await expect(m.tickets.addLabel("PROJ-1", "kodor")).rejects.toThrow(
      "create it first",
    );
    await m.tickets.ensureLabel("kodor");
    await m.tickets.addLabel("PROJ-1", "kodor");
    expect(m.state.get("PROJ-1")!.labels).toEqual(["kodor"]);
  });

  it("has statuses, and never finishes a ticket on its own", async () => {
    const m = memoryTickets([{ key: "PROJ-1" }], { strict: true });

    await m.tickets.finish("PROJ-1");
    expect(m.tickets.statuses).toBe(true);
    expect(m.state.get("PROJ-1")!.finishedAt).toBeNull();
  });
});
