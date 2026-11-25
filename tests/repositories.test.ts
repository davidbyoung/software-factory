// A ticket's repositories (`src/lib/repositories.mts`): the section, the
// order, who confirmed the list, and how far each one is.
import { describe, expect, it } from "vitest";
import {
  circleFault,
  confirmed,
  counting,
  countsSince,
  listIn,
  listMarker,
  listText,
  markedList,
  mergeOrder,
  nextToBuild,
  SectionError,
  standing,
  unconfirmed,
  waitsFor,
  withList,
  wordOf,
  type Listed,
  type LinkedPull,
  type Progress,
} from "../src/lib/repositories.mts";
import type { Entry } from "../src/tickets/types.mts";

const API: Listed = { name: "acme/api", after: [] };
const WEB: Listed = { name: "acme/web", after: ["acme/api"] };
const SECTION = "## Repositories\n\n- acme/api\n- acme/web, after acme/api";

const pull = (p: Partial<LinkedPull> = {}): LinkedPull => ({
  number: 88,
  state: "open",
  createdAt: "2026-11-25T10:00:00Z",
  mergedAt: null,
  branch: "12",
  isDraft: false,
  body: "",
  ...p,
});
const merged = (mergedAt: string, number = 88) =>
  pull({ number, state: "merged", mergedAt });
const at = (of: Listed, ...pulls: LinkedPull[]): Progress => ({ ...of, pulls });

describe("the section", () => {
  it("reads each repository and those it merges after", () => {
    expect(
      listIn(`Words.\n\n${SECTION}, after acme/ios\n\n## Decisions\n- x\n`),
    ).toEqual([API, { name: "acme/web", after: ["acme/api", "acme/ios"] }]);
  });

  it("takes a repository under several groups", () => {
    expect(listIn("## Repositories\n- acme/team/api")).toEqual([
      { name: "acme/team/api", after: [] },
    ]);
  });

  it("is none where the body has no such heading", () => {
    expect(listIn("## Repositories we use\n- acme/api")).toBeNull();
  });

  it("does not read a sample in a code block", () => {
    expect(listIn(`~~~markdown\n${SECTION}\n~~~\n`)).toBeNull();
  });

  it.each([
    "- acme web",
    "- acme/web after acme/api",
    "acme/web",
    "* acme/web",
  ])("refuses the line %s", (line) => {
    expect(() => listIn(`## Repositories\n\n${line}\n`)).toThrow(SectionError);
    try {
      listIn(`## Repositories\n\n${line}\n`);
    } catch (error) {
      expect((error as SectionError).line).toBe(line);
    }
  });

  it("is written before what refinement wrote, and read back", () => {
    const body = "The ask.\n\n## Proposed docs\n\nPage.\n\n## Decisions\n- x\n";
    const written = withList(body, [API, WEB]);
    expect(written).toBe(
      `The ask.\n\n${SECTION}\n\n## Proposed docs\n\nPage.\n\n## Decisions\n- x\n`,
    );
    expect(listIn(written)).toEqual([API, WEB]);
  });

  it("goes last in a body with no other section", () => {
    expect(withList("The ask.", [API])).toBe(
      "The ask.\n\n## Repositories\n\n- acme/api\n",
    );
  });

  it("is replaced where it stands, and taken out", () => {
    const body = `The ask.\n\n${SECTION}\n\n## Decisions\n- x\n`;
    expect(withList(body, [WEB])).toBe(
      "The ask.\n\n## Repositories\n\n- acme/web, after acme/api\n\n## Decisions\n- x\n",
    );
    expect(withList(body, null)).toBe("The ask.\n\n## Decisions\n- x\n");
  });
});

describe("the order", () => {
  it("puts each after those it waits for, and the rest as listed", () => {
    const ios: Listed = { name: "acme/ios", after: [] };
    expect(mergeOrder([WEB, ios, API]).map((r) => r.name)).toEqual([
      "acme/ios",
      "acme/api",
      "acme/web",
    ]);
  });

  it("names two that wait on each other", () => {
    expect(circleFault([{ name: "acme/api", after: ["acme/web"] }, WEB])).toBe(
      "acme/api and acme/web each merge after the other",
    );
  });

  it("names every one of a longer circle", () => {
    expect(
      circleFault([
        { name: "a/a", after: ["a/c"] },
        { name: "a/b", after: ["a/a"] },
        { name: "a/c", after: ["a/b"] },
        { name: "a/d", after: ["a/a"] },
      ]),
    ).toBe("The order goes in a circle: a/a, a/b, a/c");
  });

  it("finds nothing wrong where there is no circle", () => {
    expect(circleFault([API, WEB])).toBeNull();
  });
});

const note = (
  list: Listed[],
  author: string,
  at = "2026-11-25T10:00:00Z",
): Entry => ({ id: at, at, author, text: "", markers: [listMarker(list)] });

describe("who confirmed the list", () => {
  const can =
    (writers: Record<string, string[]>) =>
    async (repository: string, login: string) =>
      (writers[repository] ?? []).includes(login);
  const both = can({ "acme/api": ["dev"], "acme/web": ["dev"] });

  it("records the list in a note and reads it back", () => {
    expect(listText([API, WEB])).toBe("acme/api, acme/web (after acme/api)");
    expect(markedList([listMarker([API, WEB])])).toEqual([API, WEB]);
  });

  it("counts a list someone who can write to each one recorded", async () => {
    expect(
      await confirmed([API, WEB], [note([API, WEB], "dev")], both),
    ).toEqual({ counts: true });
  });

  it("does not count one nobody recorded", async () => {
    expect(await confirmed([API, WEB], [], both)).toEqual({
      counts: false,
      at: "acme/api",
    });
  });

  it("does not count a section changed by hand since", async () => {
    const pay: Listed = { name: "acme/payroll", after: [] };
    expect(
      await confirmed([API, pay], [note([API, WEB], "dev")], both),
    ).toMatchObject({ counts: false });
  });

  it("does not count the same repositories in another order", async () => {
    expect(
      await confirmed(
        [API, { ...WEB, after: [] }],
        [note([API, WEB], "dev")],
        both,
      ),
    ).toMatchObject({ counts: false });
  });

  it("names the repository whoever recorded it cannot write to", async () => {
    const writers = can({ "acme/api": ["sam"] });
    expect(
      await confirmed([API, WEB], [note([API, WEB], "sam")], writers),
    ).toEqual({ counts: false, at: "acme/web" });
  });

  it("goes by an older note when a newer one is by someone who cannot", async () => {
    const record = [
      note([API, WEB], "dev", "2026-11-25T10:00:00Z"),
      note([API], "stranger", "2026-11-25T11:00:00Z"),
    ];
    expect(await confirmed([API, WEB], record, both)).toEqual({ counts: true });
  });

  it("goes by the newest note of two by people who can", async () => {
    const record = [
      note([API], "dev", "2026-11-25T11:00:00Z"),
      note([API, WEB], "dev", "2026-11-25T10:00:00Z"),
    ];
    expect(await confirmed([API, WEB], record, both)).toMatchObject({
      counts: false,
    });
  });

  it("does not count one that cannot be checked", async () => {
    const answer = await confirmed([API, WEB], [note([API, WEB], "dev")], () =>
      Promise.reject(new Error("HTTP 500")),
    );
    expect(answer).toEqual({
      counts: false,
      at: "acme/api",
      unchecked: "HTTP 500",
    });
    expect(
      unconfirmed(
        "#12",
        "12",
        [API, WEB],
        answer as { counts: false; at: string },
      ),
    ).toBe("could not check who confirmed #12's repositories");
  });

  it("says who has to confirm it, and the command that does", () => {
    expect(
      unconfirmed("#12", "12", [API, WEB], { counts: false, at: "acme/web" }),
    ).toBe(
      "#12's repositories were not confirmed by someone who can write to acme/web: run factory ticket repositories 12 --set acme/api acme/web --after acme/web=acme/api",
    );
  });
});

describe("how far each one is", () => {
  it("builds the first in merge order with no pull request", () => {
    expect(nextToBuild([at(WEB), at(API)])?.name).toBe("acme/api");
    expect(nextToBuild([at(WEB), at(API, pull())])?.name).toBe("acme/web");
    expect(
      nextToBuild([at(WEB, pull()), at(API, merged("2026-11-25T11:00:00Z"))]),
    ).toBeNull();
  });

  it("waits for an earlier one until it merges", () => {
    expect(waitsFor([at(API), at(WEB, pull())], "acme/web")).toEqual({
      name: "acme/api",
      pull: null,
    });
    expect(waitsFor([at(API, pull()), at(WEB, pull())], "acme/web")).toEqual({
      name: "acme/api",
      pull: 88,
    });
    const done = at(API, merged("2026-11-25T11:00:00Z"));
    expect(waitsFor([done, at(WEB, pull())], "acme/web")).toBeNull();
    expect(waitsFor([done, at(WEB, pull())], "acme/api")).toBeNull();
  });

  it("waits again for one with a newer pull request open", () => {
    const again = at(API, merged("2026-11-25T11:00:00Z"), pull({ number: 90 }));
    expect(waitsFor([again, at(WEB, pull())], "acme/web")).toEqual({
      name: "acme/api",
      pull: 90,
    });
  });

  it("is in review while every one has a pull request and one is open", () => {
    const done = at(API, merged("2026-11-25T11:00:00Z"));
    expect(standing([done, at(WEB, pull({ number: 41 }))])).toEqual({
      reviewing: true,
      partly: false,
      unbuilt: false,
      open: [
        { repository: "acme/web", number: 41, at: "2026-11-25T10:00:00Z" },
      ],
    });
    expect(standing([at(API, pull()), at(WEB)])).toMatchObject({
      reviewing: false,
      partly: true,
      unbuilt: true,
    });
    expect(standing([at(API), at(WEB)])).toMatchObject({
      reviewing: false,
      partly: false,
    });
    expect(
      standing([done, at(WEB, merged("2026-11-25T12:00:00Z"))]),
    ).toMatchObject({ reviewing: false, partly: false, unbuilt: false });
  });
});

describe("the merges that count", () => {
  const entry = (at: string, marker: string): Entry => ({
    id: at,
    at,
    author: "dev",
    text: "",
    markers: [`<!-- work-status: ${marker} -->`],
  });
  const old = merged("2026-11-25T11:00:00Z");
  const since = merged("2026-11-25T13:00:00Z", 90);

  it("are all of them on a ticket that never finished", () => {
    const record = [entry("2026-11-25T12:00:00Z", "claim local a")];
    expect(counting([old, since], countsSince(record, false))).toEqual([
      old,
      since,
    ]);
  });

  it("are those after it finished, and every open one", () => {
    const record = [entry("2026-11-25T12:00:00Z", "finished")];
    const open = pull({ number: 91 });
    expect(counting([old, since, open], countsSince(record, true))).toEqual([
      since,
      open,
    ]);
  });

  it("are those since the newest claim on one closed by hand and reopened", () => {
    const record = [
      entry("2026-11-25T12:00:00Z", "claim local b"),
      entry("2026-11-25T09:00:00Z", "claim local a"),
    ];
    expect(counting([old, since], countsSince(record, true))).toEqual([since]);
  });
});

describe("a ticket's name where a key cannot go", () => {
  it("is its repository's last part and its number", () => {
    expect(wordOf("acme/team/api#12")).toBe("api-12");
    expect(wordOf("12")).toBe("12");
    expect(wordOf("PROJ-12")).toBe("PROJ-12");
  });
});
