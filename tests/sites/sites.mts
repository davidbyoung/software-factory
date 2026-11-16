// Small sample websites for `npm run site-check`, each served as a "before"
// and an "after". No dependencies: a page is a string.
import { createServer, type Server } from "node:http";

export type Variant = "before" | "after";
type Pages = Record<string, { type?: string; body: string }>;

const page = (title: string, body: string, css = "") => `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { margin: 0; padding: 24px; font: 18px sans-serif; background: #fff; color: #111; }
  @media (prefers-color-scheme: dark) { body { background: #111; color: #eee; } }
  ${css}
</style></head><body>${body}</body></html>`;

/** Plain pages and a sitemap that names another host. */
function plain(v: Variant): Pages {
  const block = (color: string, dark: string) =>
    `.mark { height: 80px; background: ${color}; } @media (prefers-color-scheme: dark) { .mark { background: ${dark}; } }`;
  const nav = `<nav><a href="/">Home</a> <a href="/a/">A</a> <a href="/b/">B</a></nav>`;
  return {
    "/sitemap.xml": {
      type: "application/xml",
      body: `<urlset><url><loc>https://live.example.com/</loc></url><url><loc>https://live.example.com/a/</loc></url><url><loc>https://live.example.com/b/</loc></url></urlset>`,
    },
    "/": { body: page("Home", `${nav}<h1>Home</h1><p>Welcome.</p>`) },
    "/a/": {
      body: page(
        "A",
        `${nav}<h1>A</h1><div class="mark"></div>`,
        v === "before" ? block("#cde", "#345") : block("#c33", "#e66"),
      ),
    },
    "/b/": { body: page("B", `${nav}<h1>B</h1><p>Second page.</p>`) },
  };
}

/** The same, with no dark mode at all. */
function noDark(v: Variant): Pages {
  const p = plain(v);
  for (const k of Object.keys(p)) {
    if (k.endsWith("/"))
      p[k] = {
        body: p[k].body
          .replace(/@media[\s\S]*?\}\s*\}/g, "")
          .replace(/@media[^{]*\{[^{}]*\}/g, ""),
      };
  }
  return p;
}

/** A clock, an animation, and a video that differ on every look, and nothing
 * that changes between before and after. */
function noisy(): Pages {
  return {
    "/sitemap.xml": {
      type: "application/xml",
      body: `<urlset><url><loc>http://x/</loc></url></urlset>`,
    },
    "/": {
      body: page(
        "Noisy",
        `<h1>Noisy</h1>
<div id="clock" style="font: 48px monospace; width: 4ch; height: 60px"></div>
<div class="spin" style="width:80px;height:80px;background:#36c;animation:spin 1s linear infinite"></div>
<video muted autoplay loop width="200" height="100"></video>
<script>
  const el = document.getElementById("clock");
  const tick = () => { el.textContent = Math.floor(Math.random() * 1e4).toString().padStart(4, "0"); };
  tick(); setInterval(tick, 10);
</script>`,
        "@keyframes spin { to { transform: rotate(360deg) } }",
      ),
    },
  };
}

/** No sitemap: the pages are found by their links, two levels deep. */
function noSitemap(): Pages {
  return {
    "/": {
      body: page(
        "Home",
        `<h1>Home</h1><a href="/x/">X</a> <a href="https://elsewhere.example/">out</a>`,
      ),
    },
    "/x/": { body: page("X", `<h1>X</h1><a href="/y/">Y</a>`) },
    "/y/": { body: page("Y", `<h1>Y</h1>`) },
  };
}

/** A page 12,000 px tall, changed near its bottom. */
function tall(v: Variant): Pages {
  return {
    "/": {
      body: page(
        "Tall",
        `<h1>Tall</h1><div style="height:11400px;background:linear-gradient(#fff,#ddd)"></div>
<div style="height:120px;background:${v === "before" ? "#9c9" : "#c39"}"></div>
<div style="height:400px"></div>`,
      ),
    },
  };
}

type Defects = {
  contrast?: boolean;
  buttons?: boolean;
  scroll?: boolean;
  font?: boolean;
  /** More words in a paragraph: a change a visitor sees and nothing measures. */
  words?: boolean;
};

/** One page with four defects a measurement finds, each on or off. The
 * heading uses the gray large text may use, so the small gray text that fails
 * brings in no new color. */
function measuredPage(on: Defects): Pages {
  const size = on.buttons ? 20 : 40;
  return {
    "/sitemap.xml": {
      type: "application/xml",
      body: `<urlset><url><loc>http://x/</loc></url></urlset>`,
    },
    "/": {
      body: page(
        "Measured",
        `<h1 style="color:#888;font-size:24px;margin:0 0 12px">Measured</h1>
<p class="intro" style="${on.contrast ? "color:#888" : ""}">${on.words ? "A longer line of words" : "A line"}</p>
<h2 style="font-size:${on.font ? 23 : 18}px;margin:0 0 12px">Heading</h2>
<button style="width:${size}px;height:${size}px;padding:0;margin:0 2px 0 0" aria-label="One"></button><button style="width:${size}px;height:${size}px;padding:0;margin:0" aria-label="Two"></button>
<div style="width:${on.scroll ? 1000 : 100}px;height:10px;background:#ccc"></div>`,
        "button { font: inherit; }",
      ),
    },
  };
}

const ALL: Defects = {
  contrast: true,
  buttons: true,
  scroll: true,
  font: true,
};
const only = (d: keyof Defects) => (v: Variant) =>
  measuredPage(v === "after" ? { [d]: true } : {});

export const SITES: Record<string, (v: Variant) => Pages> = {
  measuredContrast: only("contrast"),
  measuredButtons: only("buttons"),
  measuredScroll: only("scroll"),
  measuredFont: only("font"),
  measuredAll: (v) => measuredPage(v === "after" ? ALL : {}),
  measuredAlready: (v) =>
    measuredPage(v === "after" ? { ...ALL, words: true } : ALL),
  plain,
  noDark,
  noisy,
  noSitemap,
  tall,
};

export async function serve(
  name: string,
  variant: Variant,
): Promise<{ url: string; close: () => void }> {
  const pages = SITES[name](variant);
  const server: Server = createServer((req, res) => {
    const hit = pages[new URL(req.url ?? "/", "http://x").pathname];
    if (!hit) {
      res.writeHead(404).end("not found");
      return;
    }
    res
      .writeHead(200, { "content-type": hit.type ?? "text/html" })
      .end(hit.body);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as { port: number };
  return { url: `http://127.0.0.1:${port}`, close: () => server.close() };
}
