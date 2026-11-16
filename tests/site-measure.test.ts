import { describe, expect, it } from "vitest";
import {
  addToCensus,
  emptyCensus,
  formatFinding,
  nearestSizes,
  tidy,
  newValues,
  newViolations,
  sidewaysScroll,
  type AxeViolation,
  type Entry,
} from "../src/site/measure.mts";

const view = { page: "/about/", width: 390, scheme: "light" as const };
const node = (selector: string, html: string) => ({
  selector,
  html,
  words: "Element has insufficient color contrast of 2.5",
});
const violation = (
  id: string,
  ...nodes: ReturnType<typeof node>[]
): AxeViolation => ({ id, nodes });

describe("newViolations", () => {
  const base = [violation("color-contrast", node("p.intro", "<p>old</p>"))];

  it("prints nothing for a failure on the same selector", () => {
    const after = [violation("color-contrast", node("p.intro", "<p>new</p>"))];
    expect(newViolations(base, after, view)).toEqual([]);
  });

  it("prints nothing for a failure on the same markup under a new selector", () => {
    const after = [violation("color-contrast", node("main > p", "<p>old</p>"))];
    expect(newViolations(base, after, view)).toEqual([]);
  });

  it("prints a failure of another rule on a known element", () => {
    const after = [violation("target-size", node("p.intro", "<p>old</p>"))];
    expect(newViolations(base, after, view)).toHaveLength(1);
  });

  it("prints every failure on a page the base lacks", () => {
    const after = [violation("color-contrast", node("p.intro", "<p>old</p>"))];
    const [f] = newViolations(null, after, view);
    expect(formatFinding(f)).toBe(
      "measured: /about/ 390 light: accessibility color-contrast: p.intro: Element has insufficient color contrast of 2.5",
    );
  });
});

describe("sidewaysScroll", () => {
  it("prints when only the branch is wider than the window", () => {
    const [f] = sidewaysScroll(390, 412, view);
    expect(formatFinding(f)).toBe(
      "measured: /about/ 390 light: sideways scroll: the page is 412 px wide in a 390 px window",
    );
  });
  it("prints nothing when the base scrolls sideways too", () => {
    expect(sidewaysScroll(500, 412, view)).toEqual([]);
  });
  it("prints nothing when the branch fits", () => {
    expect(sidewaysScroll(390, 390, view)).toEqual([]);
  });
});

describe("tidy", () => {
  const raw = (prop: Entry["prop"], value: string, count = 1): Entry => ({
    prop,
    value,
    tag: "div",
    text: "",
    count,
  });
  const values = (entries: Entry[]) => tidy(entries).map((e) => e.value);

  it.each([
    "transparent",
    "rgba(0, 0, 0, 0)",
    "oklab(0 0 0 / 0)",
    "color(srgb 0 0 0 / 0)",
    "rgb(0 0 0 / 0%)",
    "hsla(0, 0%, 0%, 0)",
  ])("leaves out the fully transparent color %s", (color) => {
    expect(values([raw("background-color", color)])).toEqual([]);
  });

  it.each(["rgb(1, 2, 0)", "rgba(1, 2, 3, 0.5)", "oklab(0.5 0 0 / 0.5)"])(
    "keeps the color %s",
    (color) => {
      expect(values([raw("color", color)])).toEqual([color]);
    },
  );

  it("keeps a radius given as a percentage as it is written", () => {
    expect(values([raw("border-radius", "50%")])).toEqual(["50%"]);
  });

  it("rounds a size to a tenth of a pixel", () => {
    expect(values([raw("padding", "13.456px")])).toEqual(["13.5px"]);
  });

  it.each(["0px", "0%"])("leaves out a size of %s", (size) => {
    expect(values([raw("border-radius", size)])).toEqual([]);
  });

  it("leaves out a size the browser gives as a word", () => {
    expect(values([raw("gap", "normal")])).toEqual([]);
  });

  it("joins entries that come to the same value, and adds their counts", () => {
    expect(
      tidy([raw("padding", "13.46px", 2), raw("padding", "13.54px", 3)]),
    ).toEqual([{ ...raw("padding", "13.5px"), count: 5 }]);
  });
});

describe("nearestSizes", () => {
  const evens = (count: number) =>
    new Set(Array.from({ length: count }, (_, i) => `${i * 2}px`));

  it("lists sizes in pixels only", () => {
    expect(nearestSizes(new Set(["8px", "50%", "4px"]), 6)).toEqual(["4", "8"]);
  });

  it("lists the 12 nearest when there are more, in ascending order", () => {
    expect(nearestSizes(evens(20), 10)).toEqual(
      "0 2 4 6 8 10 12 14 16 18 20 22".split(" "),
    );
  });

  it("takes the smaller of two sizes equally near for the last place", () => {
    // 24 to 0 px in twos, around 12: 24 and 0 are both 12 away, and one fits.
    const descending = new Set([...evens(13)].reverse());
    const picked = nearestSizes(descending, 12);
    expect(picked).toContain("0");
    expect(picked).not.toContain("24");
  });
});

describe("newValues", () => {
  const entry = (e: Partial<Entry>): Entry => ({
    prop: "font-size",
    value: "15px",
    tag: "h2",
    text: "Background",
    count: 1,
    ...e,
  });
  const census = emptyCensus();
  addToCensus(
    census,
    "light",
    [12, 14, 16, 18, 24, 30, 36].map((n) => entry({ value: `${n}px` })),
  );
  addToCensus(census, "dark", [
    entry({ prop: "color", value: "rgb(1, 2, 3)" }),
  ]);

  it("names the value, the element, and the sizes the site uses", () => {
    const [f] = newValues(census, [entry({})], view);
    expect(formatFinding(f)).toBe(
      'measured: /about/ 390 light: new value: font-size 15px on h2 "Background"; the site uses 12, 14, 16, 18, 24, 30, and 36 px',
    );
  });
  it("prints nothing for a value the base uses", () => {
    expect(newValues(census, [entry({ value: "16px" })], view)).toEqual([]);
  });
  it("counts the other elements and gives colors as a count by scheme", () => {
    const [f] = newValues(
      census,
      [entry({ prop: "color", value: "rgb(9, 9, 9)", count: 4 })],
      { ...view, scheme: "dark" },
    );
    expect(f.words).toBe(
      'color rgb(9, 9, 9) on h2 "Background" and 3 more; the site uses 1 in dark',
    );
  });
  it("lists the site's percentages when it uses no size in pixels", () => {
    const rounds = emptyCensus();
    addToCensus(rounds, "light", [
      entry({ prop: "border-radius", value: "50%" }),
    ]);
    const [f] = newValues(
      rounds,
      [entry({ prop: "border-radius", value: "4px", text: "" })],
      view,
    );
    expect(f.words).toBe("border-radius 4px on h2; the site uses 50%");
  });
  it("judges a color by its scheme", () => {
    expect(
      newValues(
        census,
        [entry({ prop: "color", value: "rgb(1, 2, 3)" })],
        view,
      ),
    ).toHaveLength(1);
  });
});
