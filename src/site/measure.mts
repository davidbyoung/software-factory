// Three measurements a standard or the browser defines, for any website:
// accessibility by axe-core, a page that scrolls sideways, and a style value
// the base site uses nowhere. No browser here: the functions take what one
// `evaluate` returned for a view, so each is tested as a plain function. The
// scripts that collect it are strings, run in the page by capture.mts.
import type { Accessibility } from "../config.mts";

export type Scheme = "light" | "dark";

/** The axe-core tags that make up each level. */
export const AXE_TAGS: Record<Exclude<Accessibility, "none">, string[]> = {
  wcag2aa: ["wcag2a", "wcag2aa"],
  wcag21aa: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
  wcag22aa: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
};

/** One failing element, as axe-core reports it, cut to what is used. */
export type AxeNode = { selector: string; html: string; words: string };
export type AxeViolation = { id: string; nodes: AxeNode[] };

/** One value of one style property in a view, with the first element that
 * has it and how many have it. */
export type Entry = {
  prop: Prop;
  value: string;
  tag: string;
  text: string;
  count: number;
};

export type Snapshot = {
  /** The widest the page scrolls, in px. */
  scrollWidth: number;
  entries: Entry[];
};

export const SIZE_PROPS = [
  "font-size",
  "padding",
  "border-radius",
  "gap",
] as const;
export const COLOR_PROPS = [
  "color",
  "background-color",
  "border-color",
] as const;
export type Prop = (typeof SIZE_PROPS)[number] | (typeof COLOR_PROPS)[number];

export type Finding = {
  page: string;
  width: number;
  scheme: Scheme;
  kind: "accessibility" | "sideways scroll" | "new value";
  rule: string | null;
  element: string;
  words: string;
};

export type View = { page: string; width: number; scheme: Scheme };

/** The line a finding prints, as `lunamill site compare` gives it. */
export function formatFinding(f: Finding): string {
  const at = `${f.page} ${f.width} ${f.scheme}`;
  if (f.kind === "accessibility")
    return `measured: ${at}: accessibility ${f.rule}: ${f.element}: ${f.words}`;
  return `measured: ${at}: ${f.kind}: ${f.words}`;
}

// ---- accessibility ----

/** The failures `after` has that `before` lacks: a failure is the base's when
 * it is the same rule on an element with the same selector or the same
 * markup. `before` is null for a page the base does not have. */
export function newViolations(
  before: AxeViolation[] | null,
  after: AxeViolation[],
  view: View,
): Finding[] {
  const known = new Map<
    string,
    { selectors: Set<string>; html: Set<string> }
  >();
  for (const v of before ?? []) {
    const k = known.get(v.id) ?? { selectors: new Set(), html: new Set() };
    for (const n of v.nodes) {
      k.selectors.add(n.selector);
      k.html.add(n.html);
    }
    known.set(v.id, k);
  }
  const out: Finding[] = [];
  for (const v of after)
    for (const n of v.nodes) {
      const k = known.get(v.id);
      if (k && (k.selectors.has(n.selector) || k.html.has(n.html))) continue;
      out.push({
        ...view,
        kind: "accessibility",
        rule: v.id,
        element: n.selector,
        words: n.words,
      });
    }
  return out;
}

// ---- sideways scroll ----

/** One finding when the branch's page is wider than its window and the base's
 * is not. `before` is the base's scroll width, or null for a missing page. */
export function sidewaysScroll(
  before: number | null,
  after: number,
  view: View,
): Finding[] {
  if (after <= view.width) return [];
  if (before !== null && before > view.width) return [];
  return [
    {
      ...view,
      kind: "sideways scroll",
      rule: null,
      element: "page",
      words: `the page is ${after} px wide in a ${view.width} px window`,
    },
  ];
}

// ---- the style census ----

/** What the base site uses: each scheme's values of each property. */
export type Census = Record<Scheme, Record<string, Set<string>>>;

export const emptyCensus = (): Census => ({ light: {}, dark: {} });

export function addToCensus(c: Census, scheme: Scheme, entries: Entry[]) {
  for (const e of entries) (c[scheme][e.prop] ??= new Set()).add(e.value);
}

const sizeOf = (v: string) => Number.parseFloat(v);

function list(items: string[], unit: string): string {
  const n = items.length;
  if (n === 0) return "";
  const joined =
    n <= 2
      ? items.join(" and ")
      : `${items.slice(0, -1).join(", ")}, and ${items[n - 1]}`;
  return `${joined} ${unit}`.trim();
}

/** The sizes the site uses for a property: all of them, or the 12 nearest
 * to `near` when there are more, in ascending order. */
export function nearestSizes(used: Set<string>, near: number): string[] {
  const sizes = [...used].filter((v) => v.endsWith("px")).map(sizeOf);
  const picked =
    sizes.length > 12
      ? [...sizes]
          .sort((a, b) => Math.abs(a - near) - Math.abs(b - near) || a - b)
          .slice(0, 12)
      : sizes;
  return picked.sort((a, b) => a - b).map(String);
}

/** One finding for each value of a property on a changed view of the branch
 * that the base uses in no view of that scheme. */
export function newValues(base: Census, after: Entry[], view: View): Finding[] {
  const out: Finding[] = [];
  for (const e of after) {
    const used = base[view.scheme][e.prop] ?? new Set<string>();
    if (used.has(e.value)) continue;
    const on = `${e.tag}${e.text ? ` "${e.text}"` : ""}`;
    const more = e.count > 1 ? ` and ${e.count - 1} more` : "";
    const isColor = (COLOR_PROPS as readonly string[]).includes(e.prop);
    const sizes = [
      list(nearestSizes(used, sizeOf(e.value)), "px"),
      list([...used].filter((v) => !v.endsWith("px")).sort(), ""),
    ].filter(Boolean);
    const tail = isColor
      ? `the site uses ${used.size} in ${view.scheme}`
      : sizes.length
        ? `the site uses ${sizes.join(", and ")}`
        : "the site uses none";
    out.push({
      ...view,
      kind: "new value",
      rule: null,
      element: on,
      words: `${e.prop} ${e.value} on ${on}${more}; ${tail}`,
    });
  }
  return out;
}

// ---- collecting, in the page ----

/** A size as the census keeps it, or null to leave it out: pixels rounded to
 * a tenth, and a percentage, which a radius can compute to, as written. */
export function sizeValue(raw: string): string | null {
  const n = Math.round(Number.parseFloat(raw) * 10) / 10;
  if (!Number.isFinite(n) || n <= 0) return null;
  return raw.trim().endsWith("%") ? raw.trim() : `${n}px`;
}

/** Whether a computed color is fully transparent. Chrome keeps a color's
 * own notation, so the alpha is read after a comma, as in `rgba(0, 0, 0, 0)`,
 * and after a slash, as in `oklab(0 0 0 / 0)`. */
export function isClear(color: string): boolean {
  if (!color || color === "transparent") return true;
  const alpha =
    /\/\s*([\d.]+)%?\s*\)$/.exec(color) ??
    /^(?:rgba|hsla)\(.*,\s*([\d.]+)%?\s*\)$/.exec(color);
  return alpha !== null && Number(alpha[1]) === 0;
}

/** The entries as the census keeps them, from what the page reported: a size
 * rounded, a fully transparent color left out, and entries that come to the
 * same value joined, the first naming the element. */
export function tidy(raw: Entry[]): Entry[] {
  const kept = new Map<string, Entry>();
  for (const e of raw) {
    const isColor = (COLOR_PROPS as readonly string[]).includes(e.prop);
    const value = isColor
      ? isClear(e.value)
        ? null
        : e.value
      : sizeValue(e.value);
    if (!value) continue;
    const hit = kept.get(`${e.prop}|${value}`);
    if (hit) hit.count += e.count;
    else kept.set(`${e.prop}|${value}`, { ...e, value });
  }
  return [...kept.values()];
}

/** Run in the page: every visible element's values as the browser computed
 * them, which `tidy` then rounds and filters. A border's color is reported
 * only where the border has a width. A padding is its four sides, a radius
 * its four corners, and a gap its row and column. */
export const COLLECT = `(() => {
  const found = new Map();
  const add = (prop, value, el) => {
    if (!value) return;
    const key = prop + '|' + value;
    const hit = found.get(key);
    if (hit) { hit.count++; return; }
    const own = [...el.childNodes].filter((n) => n.nodeType === 3)
      .map((n) => n.textContent).join(' ').replace(/\\s+/g, ' ').trim();
    const text = (own || (el.textContent || '').replace(/\\s+/g, ' ').trim()).slice(0, 40);
    found.set(key, { prop, value, tag: el.tagName.toLowerCase(), text, count: 1 });
  };
  for (const el of document.body.querySelectorAll('*')) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD'].includes(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    if (!r.width || !r.height || s.display === 'none' || s.visibility === 'hidden') continue;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (hasText) {
      add('font-size', s.fontSize, el);
      add('color', s.color, el);
    }
    add('background-color', s.backgroundColor, el);
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      if (parseFloat(s['border' + side + 'Width']) > 0)
        add('border-color', s['border' + side + 'Color'], el);
      add('padding', s['padding' + side], el);
    }
    for (const c of ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'])
      add('border-radius', s['border' + c + 'Radius'].split(' ')[0], el);
    add('gap', s.rowGap, el);
    add('gap', s.columnGap, el);
  }
  return { scrollWidth: document.documentElement.scrollWidth, entries: [...found.values()] };
})()`;

/** Run in the page after axe-core's source: the failures of the given tags,
 * outside frames. */
export const axeRun = (tags: string[]) => `(async () => {
  const res = await axe.run(document, {
    runOnly: { type: 'tag', values: ${JSON.stringify(tags)} },
    iframes: false,
    resultTypes: ['violations'],
  });
  return res.violations.map((v) => ({
    id: v.id,
    nodes: v.nodes.map((n) => ({
      selector: n.target.join(' '),
      html: n.html,
      words: [...n.any, ...n.all, ...n.none].map((c) => c.message).join('; '),
    })),
  }));
})()`;
