// Glob patterns as Lunamill's settings use them: `*` matches within one
// folder, `**` across folders including none, both match names that start
// with a dot, and a pattern with no wildcard matches that one path from the
// root. Node's own `path.matchesGlob` skips dot names, so this is small and
// its own. It prints nothing, since the merge-policy workflow parses standard output.

const cache = new Map<string, RegExp>();

function toRegExp(pattern: string): RegExp {
  let source = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*" && pattern[i + 1] === "*") {
      const atStart = i === 0 || pattern[i - 1] === "/";
      const slashAfter = pattern[i + 2] === "/";
      if (atStart && slashAfter) {
        // `**/` is any number of folders, including none.
        source += "(?:[^/]*/)*";
        i += 2;
      } else {
        source += ".*";
        i += 1;
      }
    } else if (c === "*") source += "[^/]*";
    else if (c === "?") source += "[^/]";
    else source += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`);
}

export function matchesGlob(path: string, pattern: string): boolean {
  let re = cache.get(pattern);
  if (!re) {
    re = toRegExp(pattern);
    cache.set(pattern, re);
  }
  return re.test(path);
}

export const matchesAny = (path: string, patterns: readonly string[]) =>
  patterns.some((p) => matchesGlob(path, p));
