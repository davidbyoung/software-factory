import { describe, expect, it } from "vitest";
import { check, join, split, table } from "../src/ticket-fields.mts";
import { listIn } from "../src/lib/repositories.mts";
import { API, SECTION, WEB } from "./network";
import { plainOf } from "./printed";

const MAPPING = {
  decisions: null,
  spec: "Acceptance criteria",
  "acceptance-criteria": "Acceptance criteria",
  "for-the-builder": "Design notes",
};

const DOC = `Let a customer save a cart.

## Decisions

- Saved for 30 days.

## Spec

### cart (new)

1. When a customer saves, the cart is kept.

## For the builder

<details>

### Tasks

## 1. Saving

- [ ] 1.1 Save it.

</details>
`;

describe("the repositories field", () => {
  const mapping = { ...MAPPING, repositories: "Repos" };
  const body = `The ask.\n\n${SECTION}\n## Decisions\n\n- x\n`;

  it("holds the section's text, and gives it back where it was", () => {
    const parts = split(body, mapping);
    if ("error" in parts) throw new Error(parts.error);
    expect(parts.values.Repos).toBe("- acme/api\n- acme/web, after acme/api");
    expect(parts.description).not.toContain("acme/web");
    const joined = join(parts.description, parts.values as never, mapping, []);
    expect(listIn(joined)).toEqual([API, WEB]);
  });
});

describe("split", () => {
  it("puts each named section in its field, without its heading, and keeps the rest", () => {
    const got = split(DOC, MAPPING);
    expect(got).toEqual({
      description:
        "Let a customer save a cart.\n\n## Decisions\n\n- Saved for 30 days.\n",
      values: {
        "Acceptance criteria":
          "### cart (new)\n\n1. When a customer saves, the cart is kept.",
        "Design notes":
          "<details>\n\n### Tasks\n\n## 1. Saving\n\n- [ ] 1.1 Save it.\n\n</details>",
      },
    });
  });

  it("ends a section at Mockups, which stays in the description", () => {
    const doc =
      "Ask.\n\n## Spec\n\n1. When it runs, it works.\n\n## Mockups\n\n![Open](./open.png)\n";
    const got = split(doc, { spec: "AC" });
    expect(got).toEqual({
      description: "Ask.\n\n## Mockups\n\n![Open](./open.png)\n",
      values: { AC: "1. When it runs, it works." },
    });
  });

  it("puts Mockups in a field when the settings name it", () => {
    const doc = "Ask.\n\n## Mockups\n\n![Open](./open.png)\n";
    expect(split(doc, { mockups: "Shots" })).toEqual({
      description: "Ask.\n",
      values: { Shots: "![Open](./open.png)" },
    });
  });

  it("reads a heading inside a fenced block as text", () => {
    const doc =
      "Ask.\n\n## Decisions\n\n```text\n## Spec\nnot a heading\n```\n\n## Spec\n\n1. Real.\n";
    const got = split(doc, { decisions: "D", spec: "S" });
    expect(got).toEqual({
      description: "Ask.\n",
      values: {
        D: "```text\n## Spec\nnot a heading\n```",
        S: "1. Real.",
      },
    });
  });

  it("reads a longer fence as closed only by one at least as long", () => {
    const doc =
      "Intro\n\n## Spec\n\n1. a\n\n````md\n```\n## Mockups\n```\nstill code\n````\n\nmore spec\n";
    expect(split(doc, { spec: "Spec F" })).toEqual({
      description: "Intro\n",
      values: {
        "Spec F":
          "1. a\n\n````md\n```\n## Mockups\n```\nstill code\n````\n\nmore spec",
      },
    });
  });

  it("ends a section at a heading of the repository's own kept in the description", () => {
    const doc = "Intro\n\n## A\n\naa\n\n## B\n\nbee\n";
    expect(split(doc, { a: "A", b: null })).toEqual({
      description: "Intro\n\n## B\n\nbee\n",
      values: { A: "aa" },
    });
  });

  it("matches a heading of the repository's own by its key, ignoring capitals", () => {
    const doc =
      "Ask.\n\n## Proposed Docs\n\nThe page.\n\n## Decisions\n\n- One.\n";
    expect(split(doc, { "proposed-docs": "Docs draft" })).toEqual({
      description: "Ask.\n\n## Decisions\n\n- One.\n",
      values: { "Docs draft": "The page." },
    });
  });

  it("clears a named field whose section the file lacks", () => {
    expect(split("Ask.\n", { decisions: "D" })).toEqual({
      description: "Ask.\n",
      values: { D: null },
    });
  });

  it("keeps a field Spec and Acceptance criteria share when the file has one of them", () => {
    const doc = "Ask.\n\n## Acceptance criteria\n\n- It works.\n";
    expect(split(doc, MAPPING)).toEqual({
      description: "Ask.\n",
      values: { "Acceptance criteria": "- It works.", "Design notes": null },
    });
  });

  it("refuses a file with both Spec and Acceptance criteria for a shared field", () => {
    const doc = "Ask.\n\n## Spec\n\n1. A.\n\n## Acceptance criteria\n\n- B.\n";
    expect(split(doc, MAPPING)).toEqual({
      error:
        "Spec and Acceptance criteria both go in Acceptance criteria, and the file has both: keep one.",
    });
  });
});

describe("join", () => {
  it("puts each field back under its heading, in the description's order", () => {
    const got = join(
      "Let a customer save a cart.\n\n## Decisions\n\n- Saved for 30 days.\n",
      {
        "Acceptance criteria":
          "### cart (new)\n\n1. When a customer saves, the cart is kept.",
        "Design notes":
          "<details>\n\n### Tasks\n\n## 1. Saving\n\n- [ ] 1.1 Save it.\n\n</details>",
      },
      MAPPING,
      ["spec"],
    );
    expect(got).toBe(DOC);
  });

  it("goes before a later heading the description holds", () => {
    const got = join(
      "Ask.\n\n## Mockups\n\n![Open](./open.png)\n\n## For the builder\n\nNotes.\n",
      { D: "- One." },
      { decisions: "D" },
      [],
    );
    expect(got).toBe(
      "Ask.\n\n## Decisions\n\n- One.\n\n## Mockups\n\n![Open](./open.png)\n\n## For the builder\n\nNotes.\n",
    );
  });

  it("puts a heading of the repository's own first, before Decisions", () => {
    const got = join(
      "Ask.\n\n## Decisions\n\n- One.\n",
      { "Docs draft": "The page." },
      { "proposed-docs": "Docs draft" },
      [],
    );
    expect(got).toBe(
      "Ask.\n\n## Proposed docs\n\nThe page.\n\n## Decisions\n\n- One.\n",
    );
  });

  it("reads a field Spec and Acceptance criteria share by the spec label", () => {
    const values = { "Acceptance criteria": "1. It works." };
    expect(join("Ask.\n", values, MAPPING, ["spec"])).toBe(
      "Ask.\n\n## Spec\n\n1. It works.\n",
    );
    expect(join("Ask.\n", values, MAPPING, ["enhancement"])).toBe(
      "Ask.\n\n## Acceptance criteria\n\n1. It works.\n",
    );
  });

  it("adds nothing for a field with no text", () => {
    expect(join("Ask.\n", { D: "  " }, { decisions: "D" }, [])).toBe("Ask.\n");
  });

  it("gives back what split took apart", () => {
    const parts = split(DOC, MAPPING);
    if ("error" in parts) throw new Error(parts.error);
    const values = Object.fromEntries(
      Object.entries(parts.values).filter(([, v]) => v !== null),
    ) as Record<string, string>;
    expect(join(parts.description, values, MAPPING, ["spec"])).toBe(DOC);
  });
});

describe("check, the agent's answer", () => {
  const FIELDS = [
    { name: "Acceptance criteria", description: null },
    { name: "Design notes", description: null },
  ];
  const GOOD = {
    decisions: "__description__",
    spec: "Acceptance criteria",
    "acceptance-criteria": "Acceptance criteria",
    "for-the-builder": "Design notes",
  };
  const reason = (answer: unknown) => {
    const got = check(answer, FIELDS, "acme/shop");
    return "reason" in got ? got.reason : null;
  };

  it("gives the suggestion, the description as null, Spec and Acceptance criteria sharing", () => {
    expect(check(GOOD, FIELDS, "acme/shop")).toEqual({
      suggestion: {
        decisions: null,
        spec: "Acceptance criteria",
        "acceptance-criteria": "Acceptance criteria",
        "for-the-builder": "Design notes",
      },
    });
  });

  it.each([
    [
      "a field the tickets don't have",
      { ...GOOD, decisions: "Notes" },
      "it named Notes, which acme/shop's tickets don't have",
    ],
    [
      "one field for two lunamill fields",
      { ...GOOD, decisions: "Design notes" },
      "it put Design notes in both Decisions and For the builder",
    ],
    [
      "a lunamill field left out",
      { ...GOOD, "for-the-builder": undefined },
      "it left out For the builder",
    ],
    [
      "output that isn't an object",
      "Acceptance criteria",
      "it did not answer in the form asked for",
    ],
    [
      "a value that isn't a string",
      { ...GOOD, decisions: 3 },
      "it did not answer in the form asked for",
    ],
  ])("refuses %s", (_name, answer, words) => {
    expect(reason(answer)).toBe(words);
  });

  it("names the first reason in the issue's order when several apply", () => {
    expect(
      reason({
        decisions: "Notes",
        spec: "Design notes",
        "for-the-builder": "Design notes",
      }),
    ).toBe("it named Notes, which acme/shop's tickets don't have");
    expect(
      reason({ decisions: "Design notes", "for-the-builder": "Design notes" }),
    ).toBe("it put Design notes in both Decisions and For the builder");
  });
});

describe("table", () => {
  it("lines each lunamill field up with its ticket field, or the description", () => {
    expect(
      table({
        decisions: null,
        spec: "Acceptance criteria",
        "acceptance-criteria": "Acceptance criteria",
        "for-the-builder": "Design notes",
      }).map(plainOf),
    ).toEqual([
      "  lunamill field        Ticket field",
      "  Decisions             the description",
      "  Spec                  Acceptance criteria",
      "  Acceptance criteria   Acceptance criteria",
      "  For the builder       Design notes",
    ]);
  });
});
