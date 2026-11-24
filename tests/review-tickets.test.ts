import { afterEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/review-tickets.mts";
import { pullTickets, type Deps as PrDeps } from "../src/pr.mts";
import { memoryCodeHost, type PullSeed } from "./memory-code-host";
import { memoryRunner } from "./memory-runner";
import { memoryTickets, type Seed } from "./memory-tickets";

/** `factory review tickets` over a pull request and the tickets it links,
 * with keys like `PROJ-12` when `strict`. */
function review(pull: PullSeed, tickets: Seed[], strict = false) {
  const memory = memoryTickets(tickets, { strict });
  const host = memoryCodeHost([pull]);
  const deps: PrDeps = {
    repository: "acme/widgets",
    codeHost: host.codeHost,
    runner: memoryRunner().runner,
    sleep: async () => {},
    out: () => {},
    readFile: () => "",
    git: () => "",
    remote: async () => "origin",
    tickets: async () => ({ tickets: memory.tickets, own: !strict }),
  };
  const out: string[] = [];
  return {
    run: () =>
      main([String(pull.number)], {
        pull: (n) => pullTickets(deps, n),
        out: (line) => out.push(line),
      }),
    out,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("factory review tickets", () => {
  it("prints each ticket the pull request closes, then each it builds part of, with its written form, title, and body", async () => {
    const r = review(
      {
        number: 64,
        body: "Part of PROJ-4: a line.\nCloses PROJ-12\nCloses PROJ-3\nPart of PROJ-12",
      },
      [
        { key: "PROJ-12", title: "Twelve", body: "## Spec\n\n1. A line.\n" },
        { key: "PROJ-3", title: "Three", body: "Three's body." },
        { key: "PROJ-4", title: "Follow-ups", body: "- [ ] a: b" },
      ],
      true,
    );

    expect(await r.run()).toBe(0);
    expect(r.out.join("\n")).toBe(
      [
        "## PROJ-12 Twelve",
        "",
        "## Spec",
        "",
        "1. A line.",
        "",
        "## PROJ-3 Three",
        "",
        "Three's body.",
        "",
        "## PROJ-4 Follow-ups",
        "",
        "- [ ] a: b",
      ].join("\n"),
    );
  });

  it("takes the code host's closing list when the tickets are its own", async () => {
    const r = review({ number: 64, body: "Fixes it.", closes: ["7"] }, [
      { number: 7, title: "Seven", body: "Body." },
    ]);

    expect(await r.run()).toBe(0);
    expect(r.out).toEqual(["## #7 Seven", "", "Body."]);
  });

  it("prints nothing for a pull request that links no ticket", async () => {
    const r = review({ number: 64, body: "Bump vitest." }, []);

    expect(await r.run()).toBe(0);
    expect(r.out).toEqual([]);
  });

  it("names a linked ticket that does not exist, and prints the rest", async () => {
    const r = review({ number: 64, body: "Closes #99", closes: ["99", "7"] }, [
      { number: 7, title: "Seven", body: "Body." },
    ]);

    expect(await r.run()).toBe(0);
    expect(r.out).toEqual([
      "## #99",
      "",
      "Not found.",
      "",
      "## #7 Seven",
      "",
      "Body.",
    ]);
  });

  it("exits 1 with the error when a read fails otherwise", async () => {
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation(
      (line: unknown) => void errors.push(String(line)),
    );
    const code = await main(["64"], {
      pull: async () => ({
        tickets: memoryTickets([{ number: 7 }], {
          fail: { read: new Error("HTTP 500") },
        }).tickets,
        links: { closes: ["7"], partOf: [] },
      }),
      out: () => {},
    });

    expect(code).toBe(1);
    expect(errors).toEqual(["HTTP 500"]);
  });

  it.each([[[]], [["sixty-four"]], [["64", "65"]]])(
    "prints the usage for %j",
    async (argv) => {
      const errors: string[] = [];
      vi.spyOn(console, "error").mockImplementation(
        (line: unknown) => void errors.push(String(line)),
      );

      expect(
        await main(argv, {
          pull: async () => {
            throw new Error("unexpected read");
          },
          out: () => {},
        }),
      ).toBe(2);
      expect(errors).toEqual(["Usage: factory review tickets N"]);
    },
  );
});
