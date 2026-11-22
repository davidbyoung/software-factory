// Whether a refined ticket's body is one a build can read: the check
// `factory ticket refined` makes before it posts the marker, for the
// factory's own refiner as for a plugin's. It reads headings only, never
// what a section says.

/** The body's lines outside its fenced code blocks, so a sample body in a
 * code block is not read as the ticket's own. */
function proseLines(body: string): string[] {
  const out: string[] = [];
  let fence: string | null = null;
  for (const line of body.split(/\r?\n/)) {
    const mark = /^\s*(```+|~~~+)/.exec(line)?.[1];
    if (fence === null && mark) fence = mark[0];
    else if (fence !== null && mark?.[0] === fence) fence = null;
    else if (fence === null) out.push(line.trimEnd());
  }
  return out;
}

/** The lines under the heading `heading`, or null when the body has no such
 * heading. They end at the next heading of its level or above, or at the
 * body's end when `toEnd` is set. */
function under(
  lines: string[],
  heading: string,
  toEnd = false,
): string[] | null {
  const at = lines.indexOf(heading);
  if (at === -1) return null;
  const rest = lines.slice(at + 1);
  if (toEnd) return rest;
  const end = rest.findIndex((line) => /^##? /.test(line));
  return end === -1 ? rest : rest.slice(0, end);
}

/** Each part a build needs that the ticket's body lacks, as the line
 * `factory ticket refined` prints for it; none when the ticket is sound.
 * The follow-ups issue is sound whatever its body holds. A ticket without
 * the `spec` label needs its decisions and at least one acceptance
 * criterion. One with it needs its decisions, a spec with a capability
 * and a numbered line, and the builder's design and tasks. */
export function missingParts(
  body: string,
  labels: string[],
  names: Readonly<Record<"spec" | "follow-up", string>>,
): string[] {
  if (labels.includes(names["follow-up"])) return [];
  const lines = proseLines(body);
  const missing: string[] = [];
  const need = (found: boolean, part: string) => {
    if (!found) missing.push(`missing: ${part}`);
  };
  need(lines.includes("## Decisions"), "## Decisions");

  if (!labels.includes(names.spec)) {
    const criteria = under(lines, "## Acceptance criteria");
    if (criteria === null) need(false, "## Acceptance criteria");
    else
      need(
        criteria.some((line) => /^\s*([-*+]|\d+[.)])\s+\S/.test(line)),
        "a list item under ## Acceptance criteria",
      );
    return missing;
  }

  const spec = under(lines, "## Spec");
  if (spec === null) need(false, "## Spec");
  else {
    need(
      spec.some((line) => /^### \S.* \((new|modified)\)$/.test(line)),
      "a ### NAME (new) or ### NAME (modified) heading under ## Spec",
    );
    need(
      spec.some((line) => /^\d+\.\s+\S/.test(line)),
      "a numbered line under ## Spec",
    );
  }
  // The tasks are grouped under level-two headings, as OpenSpec's tasks.md
  // has them, so this section runs to the body's end.
  const builder = under(lines, "## For the builder", true);
  if (builder === null) need(false, "## For the builder");
  else
    for (const heading of ["### Design", "### Tasks"])
      need(builder.includes(heading), `${heading} under ## For the builder`);
  return missing;
}
