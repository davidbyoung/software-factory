// What a session noticed, listed in its pull request, and the tickets a
// merge opens from the list.
import { describe, expect, it } from "vitest";
import {
  add,
  END,
  listOn,
  openTicked,
  opened,
  parse,
  START,
  type Event,
} from "../src/follow-ups.mts";
import { memoryCodeHost } from "./memory-code-host";
import { memoryTickets, type Seed } from "./memory-tickets";
import { into } from "./printed";

const REPOSITORY = "acme/widgets";
const HEAD = `### Noticed, not fixed

Tick a box, and merging opens a ticket for it. To have one fixed here instead, say so in a review, such as "fix 1".`;
const LIST = (...items: string[]) =>
  `Closes #88\n\n${START}\n\n${HEAD}\n\n${items.join("\n")}\n\n${END}\n`;

const ONE = "1. [ ] **`x` leaves a file.** It stays. See `src/x.mts`.";
const TWO = "2. [ ] **The test cannot fail.** It passes either way.";
const tick = (item: string) => item.replace("[ ]", "[x]");

function world(
  body: string,
  o: {
    tickets?: Seed[];
    fail?: Record<string, Error>;
    closes?: string[];
    merged?: boolean;
    from?: string | null;
    event?: string;
  } = {},
) {
  const memory = memoryTickets(o.tickets ?? [{ number: 88 }], {
    repository: REPOSITORY,
  });
  const host = memoryCodeHost(
    [
      {
        number: 90,
        body,
        closes: o.closes ?? ["88"],
        head: { sha: "a", branch: "88", repository: REPOSITORY },
      },
    ],
    { fail: o.fail },
  );
  const out: string[] = [];
  const colored: string[] = [];
  const print = into(out, colored);
  const event: Event = {
    pull_request: {
      number: 90,
      merged: o.merged ?? true,
      body: o.event ?? body,
      head: {
        repo: o.from === null ? null : { full_name: o.from ?? "Acme/widgets" },
      },
    },
  };
  return {
    out,
    colored,
    memory,
    host,
    body: async () => (await host.codeHost.get(90)).body,
    list: (title: string, text: string, branch = "88") =>
      listOn(
        branch,
        { title, text },
        { codeHost: host.codeHost, tickets: memory.tickets, out: print },
      ),
    open: (over: Partial<Parameters<typeof openTicked>[1]> = {}) =>
      openTicked(event, {
        codeHost: host.codeHost,
        tickets: memory.tickets,
        own: true,
        repository: REPOSITORY,
        label: "factory",
        out: print,
        ...over,
      }),
    made: () => [...memory.state.values()].filter((t) => t.key !== "88"),
  };
}

describe("factory follow-up", () => {
  it("adds the list with its first item, at the end of the description", async () => {
    const w = world("Closes #88\n");
    expect(
      await w.list("`x` leaves a file.", "It stays. See `src/x.mts`."),
    ).toBe(0);
    expect(await w.body()).toBe(LIST(ONE));
    expect(w.out).toEqual(["✓ Listed in #90, as 1."]);
    expect(w.colored).toEqual(["{good:✓} Listed in #90, as 1."]);
  });

  it("adds an item to the list there is, and keeps what a person wrote around it", async () => {
    const before = LIST(tick(ONE)) + "\nA person's last words.";
    const w = world(before);
    await w.list("The test cannot fail.", "It passes either way.");
    expect(await w.body()).toBe(
      LIST(tick(ONE), TWO) + "\nA person's last words.",
    );
    expect(w.out).toEqual(["✓ Listed in #90, as 2."]);
  });

  it("lists in a description that is empty", async () => {
    const w = world("");
    expect(await w.list("A.", "B.")).toBe(0);
    expect(await w.body()).toBe(
      `${START}\n\n${HEAD}\n\n1. [ ] **A.** B.\n\n${END}\n`,
    );
  });

  it("changes nothing on a branch with no open pull request", async () => {
    const w = world("x");
    expect(await w.list("A.", "B.", "other")).toBe(1);
    expect(w.out).toEqual([
      "✗ Branch other has no open pull request to list it in. Open one first: factory pr open",
    ]);
    expect(await w.body()).toBe("x");
  });

  it("lists no title twice, in any capitals", async () => {
    const w = world(LIST(ONE, TWO));
    expect(await w.list("the TEST cannot fail.", "Again.")).toBe(0);
    expect(w.out).toEqual(["- Already listed in #90, as 2."]);
    expect(await w.body()).toBe(LIST(ONE, TWO));
  });

  it("refuses a fourth, counting a ticked one and one that opened a ticket", async () => {
    const full = LIST(tick(ONE), `${tick(TWO)} Opened #5.`, "3. [ ] **C.** D.");
    const w = world(full);
    expect(await w.list("E.", "F.")).toBe(1);
    expect(w.out).toEqual([
      "✗ #90 already lists three. List only what someone would run into.",
    ]);
    expect(await w.body()).toBe(full);
  });

  it.each([
    ["closes one", "Fixes #5.", "#5"],
    ["builds part of one", "Part of #6 is stale.", "#6"],
    ["closes the pull request's own", "Closes #88.", "#88"],
  ])("refuses words that say it %s", async (_, text, ref) => {
    const w = world("x");
    expect(await w.list("A.", text)).toBe(1);
    expect(w.out).toEqual([
      `✗ A follow-up can't link a ticket, and this one links ${ref}.`,
    ]);
    expect(await w.body()).toBe("x");
  });

  it("refuses a bare tag-like word", async () => {
    const w = world("x");
    await expect(w.list("A <slug>.", "B.")).rejects.toThrow("<slug>");
    expect(await w.body()).toBe("x");
  });

  it("writes it on one line, without bold or a hidden marker", async () => {
    const w = world("");
    await w.list(
      "A **b**\nc.",
      `D\n2. [x] **E.** F <**!-- /factory: follow-ups -->`,
    );
    expect(parse(await w.body())).toEqual([
      {
        n: 1,
        item: {
          n: 1,
          ticked: false,
          title: "A b c.",
          text: "D 2. [x] E. F",
          opened: null,
        },
      },
    ]);
    expect((await w.body()).split(END)).toHaveLength(2);
  });
});

describe("factory pr follow-ups", () => {
  it("opens a ticket for a ticked item, and says so in the list", async () => {
    const w = world(LIST(tick(ONE), TWO) + "\nAfter.");
    expect(await w.open()).toBe(0);
    const [made, ...rest] = w.made();
    expect(rest).toEqual([]);
    expect(made).toMatchObject({
      title: "x leaves a file",
      body: "It stays. See `src/x.mts`.\n\nNoticed while building #88, in pull request #90.\n",
      labels: ["factory"],
    });
    expect(made!.record).toEqual([]);
    expect(await w.body()).toBe(
      LIST(`${tick(ONE)} Opened #${made!.key}.`, TWO) + "\nAfter.",
    );
    expect(w.out).toEqual([
      `✓ Opened #${made!.key} for 1, "x leaves a file".`,
      "- 2 is not ticked, so nothing was opened for it.",
    ]);
  });

  it("names no ticket for a pull request that is for none", async () => {
    const w = world(LIST(tick(ONE)).replace("Closes #88", "x"), { closes: [] });
    await w.open();
    expect(w.made()[0]!.body).toContain("\n\nNoticed in pull request #90.\n");
  });

  it("names the ticket a build in the cloud recorded, before what it closes", async () => {
    const w = world(
      `<!-- factory: cloud-build -->\n<!-- factory: ticket 89 -->\n${LIST(tick(ONE))}`,
    );
    await w.open();
    expect(w.made()[0]!.body).toContain("Noticed while building #89,");
  });

  it("opens nothing on a second run", async () => {
    const w = world(LIST(tick(ONE)));
    await w.open();
    const key = w.made()[0]!.key;
    w.out.length = 0;
    expect(await w.open()).toBe(0);
    expect(w.made()).toHaveLength(1);
    expect(w.out).toEqual([`- 1 opened #${key} already.`]);
  });

  it("opens nothing on a second run for a ticket closed since", async () => {
    const w = world(LIST(tick(ONE)));
    await w.open();
    const key = w.made()[0]!.key;
    await w.memory.tickets.finish(key);
    await w.open();
    expect(w.made()).toHaveLength(1);
  });

  it("opens none again when the list could not be written, and then writes it", async () => {
    const fail: Record<string, Error> = { setBody: new Error("HTTP 503") };
    const w = world(LIST(tick(ONE)), { fail });
    expect(await w.open()).toBe(1);
    expect(w.out).toEqual([
      "✗ Could not open a ticket for 1: HTTP 503. Run this job again.",
    ]);
    const [made] = w.made();
    delete fail.setBody;
    w.out.length = 0;
    expect(await w.open()).toBe(0);
    expect(w.made()).toHaveLength(1);
    expect(await w.body()).toContain(`${tick(ONE)} Opened #${made!.key}.`);
    expect(w.out).toEqual([`- 1 opened #${made!.key} already.`]);
  });

  it("opens one though an open ticket of that title came from elsewhere", async () => {
    const w = world(LIST(tick(ONE)), {
      tickets: [
        { number: 88 },
        {
          number: 70,
          title: "x leaves a file",
          body: "Noticed in pull request #9.",
        },
      ],
    });
    await w.open();
    expect(w.out[0]).toMatch(/^✓ Opened #/);
  });

  it("goes on to the next when one cannot be opened", async () => {
    const w = world(LIST(tick(ONE), tick(TWO)));
    const open = w.memory.tickets.open.bind(w.memory.tickets);
    const tickets = {
      ...w.memory.tickets,
      open: async (t: Parameters<typeof open>[0]) => {
        if (t.title.startsWith("x ")) throw new Error("GitHub answered 503.");
        return open(t);
      },
    };
    expect(await w.open({ tickets })).toBe(1);
    expect(w.out[0]).toBe(
      "✗ Could not open a ticket for 1: GitHub answered 503. Run this job again.",
    );
    expect(w.out[1]).toMatch(/^✓ Opened #\d+ for 2, "The test cannot fail"\.$/);
  });

  it("counts the boxes ticked when it merged, and none ticked since", async () => {
    const w = world(LIST(tick(ONE), tick(TWO)), {
      event: LIST(tick(ONE), TWO),
    });
    await w.open();
    expect(w.made().map((t) => t.title)).toEqual(["x leaves a file"]);
    expect(w.out[1]).toBe("- 2 is not ticked, so nothing was opened for it.");
  });

  it("takes a person's words, wrapped and with a host's line breaks", async () => {
    const w = world(
      LIST("1. [X] **My words** for it,\n   on two lines.").replaceAll(
        "\n",
        "\r\n",
      ),
    );
    await w.open();
    const [made] = w.made();
    expect(made).toMatchObject({ title: "My words" });
    expect(made!.body).toMatch(/^for it, on two lines\.\n/);
    expect(await w.body()).toContain(
      `   on two lines. Opened #${made!.key}.\r\n`,
    );
  });

  it.each([
    ["no bold title", "1. [x] No title here."],
    ["bold that does not close", "1. [x] **A ** b** c."],
    ["no box", "1. **A.** B."],
  ])("skips a line with %s, and says so", async (_, line) => {
    const w = world(LIST(line, tick(TWO)));
    expect(await w.open()).toBe(0);
    expect(w.out[0]).toBe("? 1 can't be read, so nothing was opened for it.");
    expect(w.made()).toHaveLength(1);
  });

  it("reads nothing outside the list", async () => {
    const w = world(
      `1. [x] **Not one.** Text.\n\n${LIST(TWO)}\n3. [x] **Nor this.** Text.`,
    );
    await w.open();
    expect(w.made()).toEqual([]);
  });

  it.each([
    ["did not merge", { merged: false }, LIST(tick(ONE))],
    ["came from a fork", { from: "stranger/widgets" }, LIST(tick(ONE))],
    ["came from a deleted fork", { from: null }, LIST(tick(ONE))],
    ["has no list", {}, "1. [x] **A.** B."],
  ])("opens nothing for a pull request that %s", async (_, over, body) => {
    const w = world(body, over);
    expect(await w.open()).toBe(0);
    expect(w.made()).toEqual([]);
    expect(w.out).toEqual([]);
  });
});

describe("the list's text", () => {
  it("ends an item with no line break after it", () => {
    const body = `${START}\n${ONE}`;
    expect(opened(body, "`x` leaves a file.", "PROJ-4")).toBe(
      `${body} Opened PROJ-4.`,
    );
    expect(add(body, "B.", "C.")).toEqual({
      n: 2,
      body: `${body}\n2. [ ] **B.** C.\n`,
    });
  });

  it("says nothing of an item a person took out", () => {
    expect(opened(LIST(TWO), "Gone.", "#5")).toBeNull();
  });
});
