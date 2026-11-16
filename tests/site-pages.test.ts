import { describe, expect, it } from "vitest";
import { crawl, linkPaths, sitemapPaths } from "../src/site/pages.mts";

describe("sitemapPaths", () => {
  it("takes each entry's path and ignores its host", () => {
    const xml = `<urlset><url><loc>https://live.example.com/</loc></url>
      <url><loc> https://other.test/pricing/?a=1 </loc></url>
      <url><loc>https://live.example.com/</loc></url></urlset>`;
    expect(sitemapPaths(xml)).toEqual(["/", "/pricing/"]);
  });
});

describe("linkPaths", () => {
  it("keeps same-site pages, resolves relative links, and drops the rest", () => {
    const html = `<a href="/a/">a</a> <a href='b/'>b</a> <a href="https://elsewhere.example/c/">c</a>
      <a href="//cdn.example/d">d</a> <a href="mailto:x@y.z">m</a> <a href="/logo.png">i</a>
      <a href="#top">t</a> <a href="/a/#x">again</a>`;
    expect(linkPaths(html, "/docs/")).toEqual(["/a/", "/docs/b/", "/docs/"]);
  });
});

describe("crawl", () => {
  const site: Record<string, string> = {
    "/": `<a href="/x/">x</a>`,
    "/x/": `<a href="/y/">y</a>`,
    "/y/": `<a href="/z/">z</a>`,
  };
  const get = async (p: string) => site[p] ?? null;

  it("follows links two levels deep", async () => {
    expect(await crawl(get)).toEqual(["/", "/x/", "/y/"]);
  });

  it("stops at the limit", async () => {
    expect(await crawl(get, 2, 2)).toEqual(["/", "/x/"]);
  });
});
