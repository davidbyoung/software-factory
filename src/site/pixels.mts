// Comparing two pictures of a page: which pixels changed, which of those are
// noise, and what to call a page and view. No browser: these take decoded
// pictures, so each is a plain function.

/** A decoded picture: RGBA, four bytes a pixel. */
export type Picture = { width: number; height: number; data: Uint8Array };

/** A color channel has to differ by more than this, of 255, to count. */
export const TOLERANCE = 8;
export const STRIP = 4000;

/** The strips a page of `height` px is read in. */
export function strips(height: number, size = STRIP) {
  const out: { top: number; height: number }[] = [];
  for (let top = 0; top < height; top += size)
    out.push({ top, height: Math.min(size, height - top) });
  return out;
}

export type Diff = {
  width: number;
  height: number;
  /** One byte a pixel, 1 where the pictures differ. */
  mask: Uint8Array;
  count: number;
  /** The first and last row with a difference, or null. */
  rows: [number, number] | null;
};

/** The pixels where either picture is missing, or a channel differs by more
 * than the tolerance. The pictures may be different sizes: what only one has
 * differs. Read strip by strip, so a tall page is walked in bounded pieces. */
export function diff(a: Picture, b: Picture, tolerance = TOLERANCE): Diff {
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);
  const mask = new Uint8Array(width * height);
  let count = 0;
  let first = -1;
  let last = -1;
  for (const strip of strips(height)) {
    for (let y = strip.top; y < strip.top + strip.height; y++) {
      for (let x = 0; x < width; x++) {
        const inA = x < a.width && y < a.height;
        const inB = x < b.width && y < b.height;
        let changed = inA !== inB;
        if (inA && inB) {
          const i = (y * a.width + x) * 4;
          const j = (y * b.width + x) * 4;
          for (let c = 0; c < 4 && !changed; c++)
            changed = Math.abs(a.data[i + c] - b.data[j + c]) > tolerance;
        }
        if (changed) {
          mask[y * width + x] = 1;
          count++;
          if (first < 0) first = y;
          last = y;
        }
      }
    }
  }
  return { width, height, mask, count, rows: first < 0 ? null : [first, last] };
}

/** The mask grown by `by` px on every side, so noise that moves a little
 * between two shots still covers where it was. */
export function grow(d: Diff, byX: number, byY = byX): Uint8Array {
  const out = new Uint8Array(d.mask.length);
  for (let y = 0; y < d.height; y++)
    for (let x = 0; x < d.width; x++) {
      if (!d.mask[y * d.width + x]) continue;
      for (let dy = -byY; dy <= byY; dy++)
        for (let dx = -byX; dx <= byX; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy >= 0 && yy < d.height && xx >= 0 && xx < d.width)
            out[yy * d.width + xx] = 1;
        }
    }
  return out;
}

/** Each connected patch of `mask` filled out to its bounding box, so a clock
 * or a carousel is covered whole, wherever its pixels happened to differ. */
export function boxes(mask: Uint8Array, width: number, height: number) {
  const out = new Uint8Array(mask.length);
  const seen = new Uint8Array(mask.length);
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let [x0, y0, x1, y1] = [width, height, 0, 0];
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const at = stack.pop()!;
      const x = at % width;
      const y = (at - x) / width;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (mask[next] && !seen[next]) {
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
    for (let y = y0; y <= y1; y++)
      out.fill(1, y * width + x0, y * width + x1 + 1);
  }
  return out;
}

const at = (m: Uint8Array, w: number, h: number, x: number, y: number) =>
  x < w && y < h ? m[y * w + x] : 0;

/** What changed between `before` and `after`, leaving out whatever differs
 * between two pictures of one site: that is noise, a clock or a carousel, and
 * needs no setting. `again` is a second picture of the after site. With
 * `beforeAgain`, a second picture of the before site, a pixel must also differ
 * between the two second pictures, so a page caught half-loaded in one shot
 * is not reported as changed. */
export function changedWithoutNoise(
  before: Picture,
  after: Picture,
  again: Picture,
  beforeAgain?: Picture,
  noiseMargin = 12,
  noiseMarginX = 60,
): Diff {
  const first = diff(before, after);
  const second = beforeAgain ? diff(beforeAgain, again) : null;
  const noises = [
    diff(after, again),
    ...(beforeAgain ? [diff(before, beforeAgain)] : []),
  ].map((d) => ({
    d,
    mask: boxes(grow(d, noiseMarginX, noiseMargin), d.width, d.height),
  }));
  const { width, height } = first;
  const mask = new Uint8Array(first.mask.length);
  let count = 0;
  let firstRow = -1;
  let lastRow = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (!first.mask[y * width + x]) continue;
      if (second && !at(second.mask, second.width, second.height, x, y))
        continue;
      if (noises.some((n) => at(n.mask, n.d.width, n.d.height, x, y))) continue;
      mask[y * width + x] = 1;
      count++;
      if (firstRow < 0) firstRow = y;
      lastRow = y;
    }
  return {
    width,
    height,
    mask,
    count,
    rows: firstRow < 0 ? null : [firstRow, lastRow],
  };
}

export type Status = "same" | "changed" | "new" | "removed";

/** A page and view: new when only the after site has the page, removed when
 * only the before site does, changed when a pixel differs. */
export function classify(
  has: { before: boolean; after: boolean },
  changedPixels: number,
): Status {
  if (has.after && !has.before) return "new";
  if (has.before && !has.after) return "removed";
  return changedPixels > 0 ? "changed" : "same";
}
