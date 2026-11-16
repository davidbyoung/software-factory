// Taking a picture of a page the same way every time: motion off, media
// paused at its start, fonts loaded, the network idle. Needs Playwright from
// the repository, and its browser.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { PNG } from "pngjs";
import type { Picture } from "./pixels.mts";
import {
  axeRun,
  COLLECT,
  tidy,
  type AxeViolation,
  type Snapshot,
} from "./measure.mts";
import { SiteError } from "./servers.mts";

export const NO_BROWSER =
  "site needs a browser: npx playwright install chromium";

type PwPage = {
  goto: (u: string, o: object) => Promise<{ status: () => number } | null>;
  addStyleTag: (o: { content: string }) => Promise<unknown>;
  evaluate: (f: string) => Promise<unknown>;
  addScriptTag: (o: { content: string }) => Promise<unknown>;
  waitForLoadState: (s: string, o: object) => Promise<void>;
  screenshot: (o: object) => Promise<Buffer>;
};
type PwContext = {
  addInitScript: (s: string) => Promise<void>;
  newPage: () => Promise<PwPage>;
  close: () => Promise<void>;
};
export type PwBrowser = {
  newContext: (o: object) => Promise<PwContext>;
  close: () => Promise<void>;
};

export async function launch(root: string): Promise<PwBrowser> {
  const require = createRequire(join(root, "package.json"));
  let chromium: { launch: () => Promise<PwBrowser> };
  try {
    chromium = require("playwright").chromium;
  } catch {
    throw new SiteError("site needs Playwright: npm install -D playwright");
  }
  try {
    return await chromium.launch();
  } catch (e) {
    if (/Executable doesn't exist|browserType\.launch/.test(String(e)))
      throw new SiteError(NO_BROWSER);
    throw e;
  }
}

const STILL = `*, *::before, *::after {
  animation: none !important; transition: none !important;
  caret-color: transparent !important; scroll-behavior: auto !important;
}`;

// A page that calls play() itself, when its video can play, must not start it
// again after the picture's pause.
const NO_PLAY = `HTMLMediaElement.prototype.play = function () {
  this.pause();
  return Promise.resolve();
};`;

const PAUSE = `(async () => {
  for (const m of document.querySelectorAll('video, audio')) {
    m.pause();
    try { m.currentTime = 0; } catch {}
  }
  await new Promise((r) => setTimeout(r, 300));
  if (document.fonts) await document.fonts.ready;
})()`;

/** Open `path` at `base` the same way every time and call `run` on the page;
 * null when the site has no such page. */
async function inView<T>(
  browser: PwBrowser,
  base: string,
  path: string,
  view: { width: number; scheme: "light" | "dark" },
  hide: string[],
  run: (page: PwPage) => Promise<T>,
): Promise<T | null> {
  const ctx = await browser.newContext({
    viewport: { width: view.width, height: 800 },
    colorScheme: view.scheme,
    reducedMotion: "reduce",
  });
  try {
    await ctx.addInitScript(NO_PLAY);
    const page = await ctx.newPage();
    const res = await page.goto(new URL(path, base).href, {
      waitUntil: "load",
    });
    if (!res || res.status() >= 400) return null;
    await page
      .waitForLoadState("networkidle", { timeout: 5000 })
      .catch(() => {});
    const hidden = hide.length
      ? `${hide.join(", ")} { visibility: hidden !important; }`
      : "";
    await page.addStyleTag({ content: STILL + hidden });
    await page.evaluate(PAUSE);
    return await run(page);
  } finally {
    await ctx.close();
  }
}

/** One picture of `path` at `base`, or null when the site has no such page.
 * `census` also gets the page's style values, from the same load. */
export async function shoot(
  browser: PwBrowser,
  base: string,
  path: string,
  view: { width: number; scheme: "light" | "dark" },
  hide: string[],
  census?: (s: Snapshot) => void,
): Promise<Picture | null> {
  return inView(browser, base, path, view, hide, async (page) => {
    if (census) census(tidied((await page.evaluate(COLLECT)) as Snapshot));
    const png = await page.screenshot({
      fullPage: true,
      caret: "hide",
      timeout: 180_000,
    });
    return decode(png);
  });
}

const tidied = (s: Snapshot): Snapshot => ({ ...s, entries: tidy(s.entries) });

/** What measuring a view needs: its style values, how wide it scrolls, and
 * axe-core's failures at the given tags (none when `tags` is empty). */
export async function measureView(
  browser: PwBrowser,
  base: string,
  path: string,
  view: { width: number; scheme: "light" | "dark" },
  hide: string[],
  tags: string[],
): Promise<(Snapshot & { violations: AxeViolation[] }) | null> {
  return inView(browser, base, path, view, hide, async (page) => {
    const snap = tidied((await page.evaluate(COLLECT)) as Snapshot);
    let violations: AxeViolation[] = [];
    if (tags.length) {
      const src = readFileSync(
        createRequire(import.meta.url).resolve("axe-core/axe.min.js"),
        "utf8",
      );
      await page.addScriptTag({ content: src });
      violations = (await page.evaluate(axeRun(tags))) as AxeViolation[];
    }
    return { ...snap, violations };
  });
}

export function decode(png: Buffer): Picture {
  const p = PNG.sync.read(png);
  return { width: p.width, height: p.height, data: p.data };
}

export function encode(p: Picture): Buffer {
  const png = new PNG({ width: p.width, height: p.height });
  png.data = Buffer.from(p.data);
  return PNG.sync.write(png);
}
