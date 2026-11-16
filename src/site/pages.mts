// Finding the pages of a website: from its sitemap, or from the links on its
// home page. Both give paths only, since a sitemap names the live site and the
// pages wanted are the same paths on the two sites being compared.

const SKIP_EXTENSION =
  /\.(?:png|jpe?g|gif|svg|webp|avif|ico|pdf|zip|css|js|mjs|json|xml|txt|mp4|webm|mp3|woff2?|ttf)$/i;

/** The path of each `<loc>` in a sitemap, whatever host it names. */
export function sitemapPaths(xml: string): string[] {
  const paths: string[] = [];
  for (const m of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) {
    try {
      paths.push(normalize(new URL(m[1].replaceAll("&amp;", "&")).pathname));
    } catch {
      // Not an address: not a page.
    }
  }
  return [...new Set(paths)];
}

/** A path as one page's name: without a query or fragment. */
export function normalize(path: string): string {
  const p = path.split(/[?#]/)[0] || "/";
  return p.startsWith("/") ? p : `/${p}`;
}

/** The paths on the same site that a page's links lead to. `pagePath` is the
 * page the links are on, for relative ones. */
export function linkPaths(html: string, pagePath = "/"): string[] {
  const origin = "http://site.invalid";
  const found: string[] = [];
  for (const m of html.matchAll(
    /<a\s[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
  )) {
    const href = (m[1] ?? m[2] ?? "").trim();
    if (!href || /^(?:mailto|tel|javascript|data):/i.test(href)) continue;
    try {
      const url = new URL(href, `${origin}${pagePath}`);
      if (url.origin !== origin && !/^\/\/|^[a-z]+:/i.test(href)) continue;
      if (url.origin !== origin) continue;
      if (SKIP_EXTENSION.test(url.pathname)) continue;
      found.push(normalize(url.pathname));
    } catch {
      // Not a link.
    }
  }
  return [...new Set(found)];
}

/** Breadth-first from the home page, `depth` levels, at most `limit` pages.
 * `fetchHtml` returns a page's HTML, or null when it cannot be read. */
export async function crawl(
  fetchHtml: (path: string) => Promise<string | null>,
  depth = 2,
  limit = 50,
): Promise<string[]> {
  const seen = ["/"];
  let level = ["/"];
  for (let d = 0; d < depth && seen.length < limit; d++) {
    const next: string[] = [];
    for (const path of level) {
      const html = await fetchHtml(path);
      if (html === null) continue;
      for (const link of linkPaths(html, path)) {
        if (seen.length >= limit) break;
        if (!seen.includes(link)) {
          seen.push(link);
          next.push(link);
        }
      }
    }
    level = next;
  }
  return seen;
}
