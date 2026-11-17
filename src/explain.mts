// `factory config explain`: the settings as `.claude/factory.yaml` would
// read with every default written out, each line the file does not set
// marked `# default`, so any line can be copied into the file.
import type { Settings } from "./config.mts";

type Raw = Record<string, unknown>;

/** A line of output, and whether its value is a default. */
type Line = { text: string; byDefault: boolean };

const isObj = (v: unknown): v is Raw =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Whether the file sets `path`, each step a key into the raw file. A
 * block written as one word, such as `code-host: github`, sets its `type`. */
function sets(raw: unknown, path: string[]): boolean {
  let at: unknown = raw;
  for (const key of path) {
    if (typeof at === "string" && key === "type") return true;
    if (!isObj(at) || !(key in at)) return false;
    at = at[key];
  }
  return true;
}

export async function explainLines(
  s: Settings,
  raw: unknown,
): Promise<string[]> {
  const { stringify } = await import("yaml");
  const value = (v: unknown) => stringify(v, { lineWidth: 0 }).trim();
  const lines: Line[] = [];
  const pad = (depth: number) => "  ".repeat(depth);

  /** One key, its value printed under it when it is a list or a block. */
  const put = (path: string[], v: unknown, depth = path.length - 1) => {
    const key = path.at(-1)!;
    const byDefault = !sets(raw, path);
    if (Array.isArray(v) && v.length && typeof v[0] !== "object") {
      lines.push({ text: `${pad(depth)}${key}:`, byDefault });
      for (const item of v)
        lines.push({ text: `${pad(depth + 1)}- ${value(item)}`, byDefault });
      return;
    }
    lines.push({ text: `${pad(depth)}${key}: ${value(v)}`, byDefault });
  };
  const block = (path: string[]) =>
    lines.push({
      text: `${pad(path.length - 1)}${path.at(-1)}:`,
      byDefault: false,
    });
  const comment = (depth: number, text: string) =>
    lines.push({ text: `${pad(depth)}# ${text}`, byDefault: false });

  put(["version"], s.version);
  put(["repository"], s.repository);

  block(["tickets"]);
  put(["tickets", "type"], s.tickets.type);
  for (const [k, v] of Object.entries(s.tickets.options))
    put(["tickets", k], v);
  if (s.tickets.board === null) comment(1, "board: none (default)");
  else {
    put(["tickets", "board"], s.tickets.board);
    block(["tickets", "columns"]);
    for (const [k, v] of Object.entries(s.tickets.columns))
      put(["tickets", "columns", k], v ?? "none");
    block(["tickets", "fields"]);
    for (const [k, v] of Object.entries(s.tickets.fields))
      put(["tickets", "fields", k], v ?? "none");
  }

  put(["code-host"], s.codeHost.type);
  block(["builds"]);
  put(["builds", "trigger"], s.builds.trigger);
  put(["builds", "runner"], s.builds.runner);
  put(["specs"], s.specs);
  put(["before-commit"], s.beforeCommit);
  put(["build-setup"], s.buildSetup);

  if (!s.plugins.length) put(["plugins"], []);
  else {
    block(["plugins"]);
    for (const p of s.plugins) {
      lines.push({ text: `  - ${p.kind}: ${value(p.name)}`, byDefault: false });
      lines.push({ text: `    role: ${p.role}`, byDefault: false });
      for (const [k, list] of [
        ["files", p.files],
        ["labels", p.labels],
      ] as const)
        if (list.length) {
          lines.push({ text: `    ${k}:`, byDefault: false });
          for (const item of list)
            lines.push({ text: `      - ${value(item)}`, byDefault: false });
        }
    }
  }

  block(["auto-merge"]);
  put(["auto-merge", "allow"], s.autoMerge.allow);
  put(["auto-merge", "deny"], s.autoMerge.deny);
  put(["auto-merge", "commands"], s.autoMerge.commands);

  if (s.ciReview === null) comment(0, "ci-review: off");
  else {
    block(["ci-review"]);
    put(["ci-review", "commands"], s.ciReview.commands);
  }

  if (s.site === null) comment(0, "site: off");
  else {
    const site = s.site;
    block(["site"]);
    put(["site", "start"], site.start);
    put(["site", "url"], site.url);
    if (site.designGuide === null) comment(1, "design-guide: none (default)");
    else put(["site", "design-guide"], site.designGuide);
    if (site.pages === null)
      comment(1, "pages: found by the factory (default)");
    else put(["site", "pages"], site.pages);
    put(["site", "widths"], site.widths);
    put(["site", "hide"], site.hide);
    put(["site", "checks"], site.checks);
    put(["site", "max-pages"], site.maxPages);
    put(["site", "start-minutes"], site.startMinutes);
    put(["site", "accessibility"], site.accessibility);
    put(["site", "new-values"], site.newValues);
  }

  block(["session-minutes"]);
  for (const [k, v] of Object.entries(s.sessionMinutes))
    put(["session-minutes", k], v);

  block(["rules"]);
  put(["rules", "small-change-lines"], s.rules.smallChangeLines);
  put(["rules", "review-rounds"], s.rules.reviewRounds);

  // Each default's mark lines up with the others, two spaces past the
  // longest line that carries one.
  const marked = lines.filter((l) => l.byDefault);
  const at = Math.max(0, ...marked.map((l) => l.text.length)) + 2;
  return lines.map((l) =>
    l.byDefault ? `${l.text.padEnd(at)}# default` : l.text,
  );
}
