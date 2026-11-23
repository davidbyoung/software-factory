// Which lines of Markdown sit in a fenced code block, as CommonMark reads
// them: a fence of three or more backticks or tildes opens one, and only a
// fence of the same character at least as long closes it, so a shorter
// fence quoted inside stays code.

/** For each line of `text`, whether it is a fence or inside one. */
export function fencedLines(text: string): boolean[] {
  let fence: string | null = null;
  return text.split(/\r?\n/).map((line) => {
    const mark = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence === null) {
      if (mark) fence = mark;
      return mark !== undefined;
    }
    if (mark && mark[0] === fence[0] && mark.length >= fence.length)
      fence = null;
    return true;
  });
}
