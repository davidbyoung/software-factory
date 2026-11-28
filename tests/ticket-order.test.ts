import { describe, expect, it } from "vitest";
import { main, type Run } from "../.claude/skills/ticket-order/order.mts";

type Seed = {
  number: number;
  title?: string;
  /** Each blocker by its number here, or as written for another
   * repository's ticket, such as `octo/web#4`. */
  blockers?: [number | string, "open" | "closed"][];
};

/** A `lunamill ticket` runner over these open tickets. `failing` names a
 * command, by its arguments joined with spaces, that exits 1. */
function tickets(seeds: Seed[], failing?: string): Run {
  return async (args) => {
    if (args.join(" ") === failing)
      return { code: 1, stdout: "", stderr: `could not read ${failing}` };
    if (args[0] === "list" && args[1] === "--json") {
      const list = seeds.map((s) => ({
        key: String(s.number),
        ref: `#${s.number}`,
        title: s.title ?? `Ticket ${s.number}`,
        labels: [],
      }));
      return { code: 0, stdout: JSON.stringify(list), stderr: "" };
    }
    if (args[0] === "blockers") {
      const seed = seeds.find((s) => String(s.number) === args[1]);
      const lines = (seed?.blockers ?? []).map(
        ([n, state]) => `${typeof n === "number" ? `#${n}` : n} ${state}`,
      );
      return {
        code: 0,
        stdout: lines.map((l) => `${l}\n`).join(""),
        stderr: "",
      };
    }
    throw new Error(`unexpected command: ${args.join(" ")}`);
  };
}

async function order(seeds: Seed[], argv: string[] = [], failing?: string) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(
    argv,
    tickets(seeds, failing),
    (line) => out.push(line),
    (line) => err.push(line),
  );
  return { code, out: out.join("\n"), err: err.join("\n") };
}

describe("ticket-order", () => {
  it("counts every ticket a start-now ticket unblocks through a chain, once each", async () => {
    // 1 blocks 2 and 3, both of which block 4: a diamond, so 4 counts once.
    const { code, out } = await order([
      { number: 1, title: "Base" },
      { number: 2, blockers: [[1, "open"]] },
      { number: 3, blockers: [[1, "open"]] },
      {
        number: 4,
        blockers: [
          [2, "open"],
          [3, "open"],
        ],
      },
    ]);
    expect(code).toBe(0);
    expect(out).toContain("Start now\n  #1  Base  unblocks 3 (#2, #3, #4)");
    expect(out).toContain("Waiting\n  #2  Ticket 2  waits on #1\n");
    expect(out).toContain("  #4  Ticket 4  waits on #2, #3");
    expect(out).not.toContain("Problems");
  });

  it("puts the ticket that unblocks more first, and the lower number first on a tie", async () => {
    const { out } = await order([
      { number: 7 },
      { number: 5 },
      { number: 9 },
      { number: 10, blockers: [[9, "open"]] },
    ]);
    expect(out.split("\n").slice(0, 4)).toEqual([
      "Start now",
      "  #9  Ticket 9  unblocks 1 (#10)",
      "  #5  Ticket 5  unblocks 0",
      "  #7  Ticket 7  unblocks 0",
    ]);
  });

  it("lists a cycle once, from its lowest number in the order the tickets block each other", async () => {
    // 45 blocks 46, 46 blocks 47, and 47 blocks 45.
    const { out } = await order([
      { number: 47, blockers: [[46, "open"]] },
      { number: 46, blockers: [[45, "open"]] },
      { number: 45, blockers: [[47, "open"]] },
    ]);
    expect(out).toContain("Problems\n  cycle: #45 -> #46 -> #47 -> #45");
    expect(out.match(/cycle:/g)).toHaveLength(1);
  });

  it("counts every ticket in a cycle that a start-now ticket blocks, and lists them as waiting", async () => {
    const { out } = await order([
      { number: 3 },
      { number: 46, blockers: [[45, "open"]] },
      {
        number: 45,
        blockers: [
          [46, "open"],
          [3, "open"],
        ],
      },
    ]);
    expect(out).toContain("  #3  Ticket 3  unblocks 2 (#45, #46)");
    expect(out).toContain("  #45  Ticket 45  waits on #3, #46");
    expect(out).toContain("  #46  Ticket 46  waits on #45");
  });

  it("names an open blocker that is not an open ticket here, and the ticket waits on it", async () => {
    const { out } = await order([{ number: 34, blockers: [[99, "open"]] }]);
    expect(out).not.toContain("Start now");
    expect(out).toContain("Waiting\n  #34  Ticket 34  waits on #99");
    expect(out).toContain(
      "Problems\n  #34 waits on #99, which is not an open ticket here",
    );
  });

  it("names a blocker in another repository as its line wrote it, outside this one", async () => {
    const { out } = await order([
      { number: 12, blockers: [["octo/web#4", "open"]] },
    ]);
    expect(out).toContain("Waiting\n  #12  Ticket 12  waits on octo/web#4");
    expect(out).toContain(
      "Problems\n  #12 waits on octo/web#4, which is not an open ticket here",
    );
  });

  it("ignores a closed blocker", async () => {
    const { out } = await order([{ number: 8, blockers: [[2, "closed"]] }]);
    expect(out).toBe("Start now\n  #8  Ticket 8  unblocks 0");
  });

  it("says so when there are no open tickets", async () => {
    const { code, out } = await order([]);
    expect(code).toBe(0);
    expect(out).toBe("No open tickets.");
  });

  it.each(["list --json", "blockers 2"])(
    "prints the error and no order when `%s` fails",
    async (failing) => {
      const { code, out, err } = await order(
        [{ number: 1 }, { number: 2 }],
        [],
        failing,
      );
      expect(code).not.toBe(0);
      expect(out).toBe("");
      expect(err).toContain(
        `lunamill ticket ${failing} failed: could not read ${failing}`,
      );
    },
  );

  it("prints the same order as JSON with --json", async () => {
    const { code, out } = await order(
      [
        { number: 1, title: "Base" },
        { number: 2, blockers: [[1, "open"]] },
        { number: 3, blockers: [[4, "open"]] },
        { number: 4, blockers: [[3, "open"]] },
        { number: 5, blockers: [[99, "open"]] },
      ],
      ["--json"],
    );
    expect(code).toBe(0);
    expect(JSON.parse(out)).toEqual({
      startNow: [{ ticket: "#1", title: "Base", unblocks: ["#2"] }],
      waiting: [
        { ticket: "#2", title: "Ticket 2", waitsOn: ["#1"] },
        { ticket: "#3", title: "Ticket 3", waitsOn: ["#4"] },
        { ticket: "#4", title: "Ticket 4", waitsOn: ["#3"] },
        { ticket: "#5", title: "Ticket 5", waitsOn: ["#99"] },
      ],
      problems: [
        { kind: "cycle", tickets: ["#3", "#4", "#3"] },
        { kind: "outside", ticket: "#5", blocker: "#99" },
      ],
    });
  });

  it("prints all three JSON keys, empty, with no open tickets", async () => {
    const { out } = await order([], ["--json"]);
    expect(JSON.parse(out)).toEqual({
      startNow: [],
      waiting: [],
      problems: [],
    });
  });
});
