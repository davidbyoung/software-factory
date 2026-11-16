import { describe, expect, it } from "vitest";
import {
  changedWithoutNoise,
  classify,
  diff,
  strips,
  type Picture,
} from "../src/site/pixels.mts";

const pic = (w: number, h: number, rgba = [255, 255, 255, 255]): Picture => ({
  width: w,
  height: h,
  data: Uint8Array.from({ length: w * h * 4 }, (_, i) => rgba[i % 4]),
});
const set = (p: Picture, x: number, y: number, rgba: number[]) =>
  rgba.forEach((v, c) => (p.data[(y * p.width + x) * 4 + c] = v));

describe("strips", () => {
  it("divides a page 9,000 px tall into three strips", () => {
    expect(strips(9000)).toEqual([
      { top: 0, height: 4000 },
      { top: 4000, height: 4000 },
      { top: 8000, height: 1000 },
    ]);
  });
});

describe("diff", () => {
  it("treats a channel that differs by 8 as the same and by 9 as changed", () => {
    const a = pic(2, 2);
    const eight = pic(2, 2, [247, 255, 255, 255]);
    const nine = pic(2, 2, [246, 255, 255, 255]);
    expect(diff(a, eight).count).toBe(0);
    expect(diff(a, nine).count).toBe(4);
  });

  it("reports the rows of what changed", () => {
    const a = pic(3, 10);
    const b = pic(3, 10);
    set(b, 1, 4, [0, 0, 0, 255]);
    set(b, 2, 7, [0, 0, 0, 255]);
    const d = diff(a, b);
    expect(d.count).toBe(2);
    expect(d.rows).toEqual([4, 7]);
  });

  it("counts what only the taller picture has", () => {
    expect(diff(pic(2, 2), pic(2, 5)).count).toBe(6);
  });
});

describe("changedWithoutNoise", () => {
  it("leaves out a pixel that differs between the two after pictures", () => {
    const before = pic(8, 8);
    const after = pic(8, 8);
    const again = pic(8, 8);
    set(after, 3, 3, [0, 0, 0, 255]);
    set(again, 3, 3, [255, 0, 0, 255]);
    expect(diff(before, after).count).toBe(1);
    expect(changedWithoutNoise(before, after, again).count).toBe(0);
  });

  it("keeps a change that is far from the noise", () => {
    const before = pic(300, 100);
    const after = pic(300, 100);
    const again = pic(300, 100);
    set(after, 5, 5, [0, 0, 0, 255]);
    set(again, 5, 5, [9, 9, 9, 255]);
    set(after, 280, 90, [0, 0, 0, 255]);
    set(again, 280, 90, [0, 0, 0, 255]);
    const d = changedWithoutNoise(before, after, again);
    expect(d.count).toBe(1);
    expect(d.rows).toEqual([90, 90]);
  });
});

describe("changedWithoutNoise with a second picture of each site", () => {
  it("ignores a page caught half-loaded in the first pair only", () => {
    const loaded = pic(10, 40);
    const half = pic(10, 10);
    const d = changedWithoutNoise(half, loaded, loaded, loaded);
    expect(diff(half, loaded).count).toBe(300);
    expect(d.count).toBe(0);
  });

  it("keeps what differs in both pairs", () => {
    const a = pic(10, 10);
    const b = pic(10, 10);
    set(b, 4, 4, [0, 0, 0, 255]);
    expect(changedWithoutNoise(a, b, b, a).count).toBe(1);
  });
});

describe("classify", () => {
  it.each([
    [{ before: true, after: true }, 0, "same"],
    [{ before: true, after: true }, 3, "changed"],
    [{ before: false, after: true }, 0, "new"],
    [{ before: true, after: false }, 0, "removed"],
  ] as const)("%j with %i changed pixels is %s", (has, px, status) => {
    expect(classify(has, px)).toBe(status);
  });
});
