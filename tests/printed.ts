// What a command prints in a test. Every command's test prints through
// `into`, which keeps each line's plain text and fails on a line whose kind
// nothing said though it reads as a row or a step, so a new line cannot
// leave the scheme of "A command's output" in docs/developing.md.
import { expect } from "vitest";
import { Line, render, ROLES, type Role } from "../src/lib/output.mts";

const ROW = /^\s+\S.*?\S {2,}\S/;
const STEP = /^\s*\d+\. /;

/** Why a line has to say what it is, or null when it reads as plain text. */
export function undressed(line: Line): string | null {
  if (!Line.isText(line)) return null;
  const plain = render(line, false);
  if (ROW.test(plain)) return `a row printed as text: ${plain}`;
  if (STEP.test(plain)) return `a step printed as text: ${plain}`;
  return null;
}

/** A printer that keeps each line's plain text in `lines`, and the line in
 * color, as `marked` writes it, in `colored`. */
export function into(
  lines: string[],
  colored: string[] = [],
): (line: Line) => void {
  return (line) => {
    const fault = undressed(line);
    if (fault) expect.fail(fault);
    lines.push(render(line, false));
    colored.push(marked(render(line, true)));
  };
}

/** A line in color, as `marked` writes it. */
export const look = (line: Line): string => marked(render(line, true));

/** A line in color, as it is printed. */
export const colored = (line: Line): string => render(line, true);

/** A line's plain text. */
export const plainOf = (line: Line): string => render(line, false);

const OPENS: Record<string, Role> = Object.fromEntries(
  Object.entries({
    heading: "\u001b[1m\u001b[4m",
    name: "\u001b[1m",
    skip: "\u001b[2m",
    copy: "\u001b[36m",
    yourTurn: "\u001b[33m",
    good: "\u001b[32m",
    bad: "\u001b[31m",
  } satisfies Record<keyof typeof ROLES, string>).map(([r, c]) => [
    c,
    r as Role,
  ]),
);

/** Text in color with each look as `{role:words}`. */
export function marked(text: string): string {
  return text.replace(
    /((?:\u001b\[(?:1|2|3\d|4)m)+)([^\u001b]*)(?:\u001b\[(?:22|24|39)m)+/g,
    (_all, open: string, words: string) => {
      const role = OPENS[open];
      if (!role) expect.fail(`no look has the codes ${JSON.stringify(open)}`);
      return `{${role}:${words}}`;
    },
  );
}
