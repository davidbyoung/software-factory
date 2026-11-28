// What `lunamill site compare` prints for its report.
import { expect, it } from "vitest";
import { table, type Report } from "../src/site.mts";
import { look, plainOf } from "./printed";

const REPORT: Report = {
  before: "http://localhost:1",
  after: "http://localhost:2",
  pages: ["/", "/about/", "/team/"],
  widths: [390],
  darkSkipped: true,
  rows: [
    {
      page: "/about/",
      width: 390,
      scheme: "light",
      status: "changed",
      pixels: 1200,
      rows: [10, 2000],
      files: null,
    },
    {
      page: "/",
      width: 390,
      scheme: "light",
      status: "same",
      pixels: 0,
      rows: null,
      files: null,
    },
  ],
  measured: [],
  unchanged: 2,
  folder: "/tmp/site",
};

const printed = (over: Partial<Report> = {}) => table({ ...REPORT, ...over });

it("prints a changed view in columns, its page in bold, and no view that stayed the same", () => {
  const views = printed().filter((l) => /^ {2}\//.test(plainOf(l)));
  expect(views.map(plainOf)).toEqual([
    "  /about/                       390 light  changed  1,200 px  rows 10 to 2,000",
  ]);
  expect(look(views[0]!)).toMatch(/^ {2}\{name:\/about\/\} +390 light/);
});

it("says how many pages did not change", () => {
  expect(printed().map(plainOf)).toContain("  2 pages did not change.");
});

it.each([
  [true, 1],
  [false, 0],
])("says dark was skipped only when it was: %s", (darkSkipped, lines) => {
  expect(
    printed({ darkSkipped })
      .map(plainOf)
      .filter((l) => l.includes("dark was skipped")),
  ).toHaveLength(lines);
});
