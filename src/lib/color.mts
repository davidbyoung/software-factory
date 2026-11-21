import { styleText } from "node:util";

export type StyleFormat = Parameters<typeof styleText>[0];
export type Paint = (format: StyleFormat, text: string) => string;

export const plain: Paint = (_format, text) => text;

/** Whether output to `stream` is colored, by Node's own rule: a terminal
 * unless NO_COLOR, NODE_DISABLE_COLORS, or TERM=dumb, or wherever
 * FORCE_COLOR says. */
export function colorOn(
  stream: NodeJS.WritableStream = process.stdout,
): boolean {
  return styleText("red", "x", { stream }) !== "x";
}

/** Paints when `on`. The decision is made once, by `colorOn`, so painting
 * skips Node's stream check: with it, a test's piped output stays plain. */
export function painter(on: boolean): Paint {
  return on
    ? (format, text) => styleText(format, text, { validateStream: false })
    : plain;
}
