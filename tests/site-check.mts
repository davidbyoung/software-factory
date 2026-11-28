// Proves `kodor site compare` with a real browser, against the sample sites
// in tests/sites/, each served twice as a "before" and an "after".
//
//   npm run site-check
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { compareSites, type Report } from "../src/site.mts";
import { launch, type PwBrowser } from "../src/site/capture.mts";
import { repoRoot, type Accessibility } from "../src/config.mts";
import { serve } from "./sites/sites.mts";

const root = repoRoot();
let browser: PwBrowser;
before(async () => {
  browser = await launch(root);
});
after(async () => {
  await browser.close();
});

async function compare(
  name: string,
  pages: string[] | null = null,
  extra: { accessibility?: Accessibility; newValues?: boolean } = {},
): Promise<Report> {
  const b = await serve(name, "before");
  const a = await serve(name, "after");
  try {
    return await compareSites({
      root,
      before: b.url,
      after: a.url,
      site: { pages, widths: [390, 1280], hide: [], ...extra },
      folder: mkdtempSync(join(tmpdir(), "site-check-")),
      browser,
    });
  } finally {
    b.close();
    a.close();
  }
}

const changed = (r: Report) =>
  r.rows
    .filter((x) => x.status === "changed")
    .map((x) => `${x.page} ${x.width} ${x.scheme}`);

describe("plain pages, a sitemap, dark mode, one page changed", () => {
  it("flags exactly that page, in light and in dark", async () => {
    const r = await compare("plain");
    assert.deepEqual(r.pages, ["/", "/a/", "/b/"]);
    assert.deepEqual(changed(r).sort(), [
      "/a/ 1280 dark",
      "/a/ 1280 light",
      "/a/ 390 dark",
      "/a/ 390 light",
    ]);
    assert.ok(r.rows.find((x) => x.files)?.files);
  });
});

describe("a site with no dark mode", () => {
  it("skips dark", async () => {
    const r = await compare("noDark");
    assert.equal(r.darkSkipped, true);
    assert.ok(r.rows.every((x) => x.scheme === "light"));
    assert.ok(changed(r).length > 0);
  });
});

describe("a clock, an animation, and a video, and nothing changed", () => {
  it("flags nothing", async () => {
    for (let i = 0; i < 3; i++)
      assert.deepEqual(changed(await compare("noisy")), []);
  });
});

describe("no sitemap", () => {
  it("finds the pages by their links", async () => {
    const r = await compare("noSitemap");
    assert.deepEqual(r.pages, ["/", "/x/", "/y/"]);
  });
});

describe("a page 12,000 px tall, changed near its bottom", () => {
  it("is flagged, with the rows", async () => {
    const r = await compare("tall");
    const row = r.rows.find((x) => x.status === "changed");
    assert.ok(row, "the tall page is flagged");
    assert.ok(row.rows && row.rows[0] > 11000, `rows ${row.rows}`);
  });
});

describe("measuring a changed view", () => {
  const kinds = (r: Report) =>
    r.measured
      .filter((f) => f.width === 390 && f.scheme === "light")
      .map((f) => `${f.kind} ${f.rule ?? ""} ${f.element}`.trim())
      .sort();

  it("reports a text whose contrast dropped, once", async () => {
    assert.deepEqual(kinds(await compare("measuredContrast")), [
      "accessibility color-contrast p",
    ]);
  });

  it("reports two neighboring buttons shrunk to 20 px, once each", async () => {
    const found = kinds(await compare("measuredButtons"));
    assert.equal(found.length, 2, found.join("\n"));
    assert.ok(found.every((f) => f.startsWith("accessibility target-size")));
  });

  it("reports a page that scrolls sideways, once", async () => {
    const found = kinds(await compare("measuredScroll"));
    assert.deepEqual(found, ["sideways scroll  page"]);
  });

  it("reports a font size the site uses nowhere, once", async () => {
    const r = await compare("measuredFont");
    const found = r.measured.filter(
      (f) => f.width === 390 && f.scheme === "light",
    );
    assert.equal(found.length, 1);
    assert.match(found[0].words, /^font-size 23px on h2 "Heading"/);
  });

  it("reports nothing the base already has", async () => {
    const r = await compare("measuredAlready");
    assert.ok(
      r.rows.some((row) => row.status === "changed"),
      "a view has to change, or nothing is measured",
    );
    assert.deepEqual(r.measured, []);
  });

  it("reports only the sideways scroll with accessibility none and new-values false", async () => {
    const r = await compare("measuredAll", null, {
      accessibility: "none",
      newValues: false,
    });
    assert.deepEqual(
      r.measured.filter((f) => f.scheme === "light").map((f) => f.kind),
      ["sideways scroll"],
    );
  });
});
