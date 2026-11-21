// `factory config explain`: the settings as `.claude/factory.yaml` would
// read with every default written out, each line marked with where its
// value came from: `# default`, a preset's name, or nothing for a value
// only `.claude/factory.yaml` sets. `factory sync` writes the same lines
// into the lock.
import {
  PHASES,
  pluginsOf,
  ROLE_SHAPE,
  ROLES,
  type Settings,
} from "./config.mts";
import { itemKey, markText, type Resolution, type Source } from "./preset.mts";

/** A line of output, and its mark, or null for none. */
type Line = { text: string; mark: string | null };

/** The mark of the value at `path`, or of one item of the list there:
 * `item` is the item for a list of values and the plugin's name for a
 * list of plugins. */
export type Marker = {
  value: (path: string[]) => string | null;
  item: (path: string[], item: unknown) => string | null;
  plugin: (path: string[], name: string) => string | null;
};

/** The marks of the values a resolution combined. */
export function markerOf(r: Resolution): Marker {
  const at = (key: string): Source | undefined =>
    r.sources.get(key) ?? r.sources.get(`${key}.type`);
  return {
    value: (path) => markText(at(path.join("."))),
    item: (path, item) => {
      const key = path.join(".");
      return markText(r.sources.get(itemKey(key, item)) ?? at(key));
    },
    plugin: (path, name) =>
      markText(r.sources.get(`${path.join(".")}.${name}`)),
  };
}

/** The value lists that add up across layers, whose items each carry
 * their own mark. */
const ADDS_UP = new Set([
  "pr-review.commands",
  "auto-merge.allow",
  "auto-merge.deny",
  "auto-merge.commands",
  "site.pages",
  "site.widths",
  "site.checks",
  "site.hide",
]);

/** `exists` says whether a path from the root exists, for the plugins the
 * factory uses where the settings name none. */
export async function explainLines(
  s: Settings,
  marks: Marker,
  exists: (path: string) => boolean,
): Promise<string[]> {
  const { stringify } = await import("yaml");
  const value = (v: unknown) => stringify(v, { lineWidth: 0 }).trim();
  const lines: Line[] = [];
  const pad = (depth: number) => "  ".repeat(depth);

  /** One key, its value printed under it when it is a list or a block. */
  const put = (path: string[], v: unknown, depth = path.length - 1) => {
    const key = path.at(-1)!;
    const mark = marks.value(path);
    if (Array.isArray(v) && v.length && typeof v[0] !== "object") {
      const each = ADDS_UP.has(path.join("."));
      lines.push({ text: `${pad(depth)}${key}:`, mark });
      for (const item of v)
        lines.push({
          text: `${pad(depth + 1)}- ${value(item)}`,
          mark: each ? marks.item(path, item) : mark,
        });
      return;
    }
    lines.push({ text: `${pad(depth)}${key}: ${value(v)}`, mark });
  };
  const block = (path: string[]) =>
    lines.push({ text: `${pad(path.length - 1)}${path.at(-1)}:`, mark: null });
  const comment = (depth: number, text: string) =>
    lines.push({ text: `${pad(depth)}# ${text}`, mark: null });

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
      put(
        ["tickets", "columns", k],
        v === null ? "none" : v.length === 1 ? v[0] : v,
      );
    block(["tickets", "fields"]);
    for (const [k, v] of Object.entries(s.tickets.fields))
      put(["tickets", "fields", k], v ?? "none");
  }
  if (s.tickets.board === null) block(["tickets", "fields"]);
  for (const [k, v] of Object.entries(s.tickets.ticketFields))
    put(["tickets", "fields", k], v ?? "none");

  put(["code-host"], s.codeHost.type);
  block(["builds"]);
  put(["builds", "trigger"], s.builds.trigger);
  put(["builds", "runner"], s.builds.runner);
  if (s.builds.trigger === "github-action")
    put(["builds", "poll-minutes"], s.builds.pollMinutes);
  else comment(1, "poll-minutes: only with trigger github-action");
  if (s.specs === "openspec") {
    block(["specs"]);
    put(["specs", "type"], s.specs);
    put(["specs", "check"], s.specCheck);
  } else put(["specs"], s.specs);

  block(["commands"]);
  put(["commands", "build-setup"], s.commands.buildSetup);
  put(["commands", "before-commit"], s.commands.beforeCommit);
  put(["commands", "gate"], s.commands.gate);
  for (const [key, command] of [
    ["test-one", s.commands.testOne],
    ["end-to-end", s.commands.endToEnd],
  ] as const)
    if (command === null) comment(1, `${key}: none (default)`);
    else put(["commands", key], command);
  if (s.commands.coverage === null) comment(1, "coverage: none (default)");
  else {
    block(["commands", "coverage"]);
    put(["commands", "coverage", "run"], s.commands.coverage.run);
    put(["commands", "coverage", "report"], s.commands.coverage.report);
  }
  put(["commands", "relock"], s.commands.relock);

  // Each role holds what `factory plugins` prints for it: the settings'
  // own plugins, or the factory's where they name none.
  const used = pluginsOf(s, exists);
  block(["plugins"]);
  for (const phase of PHASES) {
    block(["plugins", phase]);
    for (const role of ROLES.filter((x) => ROLE_SHAPE[x].phase === phase)) {
      const { key, list } = ROLE_SHAPE[role];
      const path = ["plugins", phase, key];
      const found = used.filter((p) => p.role === role);
      if (!found.length) {
        if (list) put(path, []);
        else comment(2, `${key}: none (default)`);
        continue;
      }
      const roleMark = marks.value(path);
      lines.push({ text: `${pad(2)}${key}:`, mark: roleMark });
      for (const p of found) {
        const mark = list ? marks.plugin(path, p.name) : marks.value(path);
        const add = (depth: number, text: string) =>
          lines.push({ text: `${pad(depth)}${text}`, mark });
        add(3, `${list ? "- " : ""}${p.kind}: ${value(p.name)}`);
        const under = list ? 4 : 3;
        for (const [k, items] of [
          ["files", p.files],
          ["labels", p.labels],
        ] as const)
          if (items.length) {
            add(under, `${k}:`);
            for (const item of items) add(under + 1, `- ${value(item)}`);
          }
      }
    }
  }

  block(["auto-merge"]);
  put(["auto-merge", "allow"], s.autoMerge.allow);
  put(["auto-merge", "deny"], s.autoMerge.deny);
  put(["auto-merge", "commands"], s.autoMerge.commands);

  if (s.prReview === null) comment(0, "pr-review: off");
  else {
    block(["pr-review"]);
    put(["pr-review", "commands"], s.prReview.commands);
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

  // Each mark lines up with the others, two spaces past the longest line
  // that carries one.
  const marked = lines.filter((l) => l.mark !== null);
  const at = Math.max(0, ...marked.map((l) => l.text.length)) + 2;
  return lines.map((l) =>
    l.mark !== null ? `${l.text.padEnd(at)}# ${l.mark}` : l.text,
  );
}
