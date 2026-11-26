// Whether a refined ticket's body is one a build can read: the check
// `factory ticket refined` makes before it posts the marker, for the
// factory's own refiner as for a plugin's. It reads headings only, never
// what a section says.

import { fencedLines } from "./fences.mts";

/** The body's lines outside its fenced code blocks, so a sample body in a
 * code block is not read as the ticket's own. */
function proseLines(body: string): string[] {
  const fenced = fencedLines(body);
  return body
    .split(/\r?\n/)
    .filter((_, i) => !fenced[i])
    .map((line) => line.trimEnd());
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

/** A credential's name, as the credentials policy's `find.mts` reads one. */
export const CREDENTIAL_NAME =
  /\b[A-Z][A-Z0-9_]*_(?:TOKEN|SECRET|PASSWORD|KEY|PAT|AUTH|CREDENTIALS?)\b/g;

/** Where a name the repository has doesn't count: docs and tests, as git
 * pathspecs. */
export const OUTSIDE_DOCS_AND_TESTS = [
  ":(exclude,glob)**/docs/**",
  ":(exclude,glob)**/test/**",
  ":(exclude,glob)**/tests/**",
  ":(exclude,glob)**/spec/**",
  ":(exclude,glob)**/specs/**",
  ":(exclude,glob)**/*.test.*",
  ":(exclude,glob)**/*.spec.*",
];

/** The line saying the ticket needs `## Threats`, or null when it doesn't:
 * when the owner's text, the lines before the first `## ` heading, names a
 * credential `has` says the repository doesn't have, or write access. */
function threatsMissing(
  lines: string[],
  has: (name: string) => boolean,
): string | null {
  if (lines.includes("## Threats")) return null;
  const end = lines.findIndex((line) => line.startsWith("## "));
  const owner = (end === -1 ? lines : lines.slice(0, end)).join("\n");
  const names = [
    ...new Set([...owner.matchAll(CREDENTIAL_NAME)].map(([n]) => n)),
  ].filter((n) => n !== "GITHUB_TOKEN" && !has(n));
  if (names.length)
    return `missing: ## Threats, since the ticket names a credential this repository does not have: ${names.join(", ")}`;
  const write = /([\w-]+):\s*['"]?write(?![\w-])/.exec(owner);
  return write
    ? `missing: ## Threats, since the ticket gives a workflow write access: ${write[1]}: write`
    : null;
}

/** Each part a build needs that the ticket's body lacks, as the line
 * `factory ticket refined` prints for it; none when the ticket is sound.
 * A ticket without the `spec` label needs its decisions and at least one acceptance
 * criterion. One with it needs its decisions, a spec with a capability
 * and a numbered line, and the builder's design and tasks. Either needs
 * `## Threats` when its owner's text names a credential the repository
 * doesn't have, by `has`, or write access for a workflow. */
export function missingParts(
  body: string,
  labels: string[],
  names: Readonly<Record<"spec", string>>,
  has: (name: string) => boolean,
): string[] {
  const lines = proseLines(body);
  const missing: string[] = [];
  const need = (found: boolean, part: string) => {
    if (!found) missing.push(`missing: ${part}`);
  };
  need(lines.includes("## Decisions"), "## Decisions");
  const threats = threatsMissing(lines, has);
  if (threats !== null) missing.push(threats);

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
