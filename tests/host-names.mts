// The words that name the repository lunamill was drawn out of: its
// name, its owner's sites, its paths, its own plugins, and its subject.
// Nothing the package ships, and none of its tests, may use them, so
// Lunamill tells no story from that repository's private issues. The
// boundary test reads the folder with this list, and `pack-check` the
// packed tarball.
//
// This file is the one place the words are named, and so, with the
// boundary test whose examples use them, one of the two files the checks
// skip. `davidbyoung` alone is allowed: it is in the package's and its
// repository's names.

export const HOST_WORDS: RegExp[] = [
  /\bcfi\b/i,
  /davecfi|cfidave|daveyoungcfi/i,
  /src\/app\b/,
  /dpe-reviewer|write-questions|site-usability/,
  /formspree/i,
  /chicago/i,
  /checkride/i,
  /study ?guides?/i,
];

/** A line allowed to use a listed word, for a reason of its own. */
export interface Exemption {
  /** The file's path inside the package, such as `docs/workflow.md`. */
  file: string;
  /** Text the line contains. */
  line: string;
  why: string;
}

export const EXEMPT: Exemption[] = [];

/** Each line of `text` that uses a listed word, unless `file` exempts it. */
export function hostWordsIn(
  text: string,
  file = "",
  exempt: Exemption[] = EXEMPT,
): string[] {
  return text
    .split("\n")
    .filter((line) => HOST_WORDS.some((word) => word.test(line)))
    .filter(
      (line) => !exempt.some((e) => e.file === file && line.includes(e.line)),
    )
    .map((line) => line.trim());
}
