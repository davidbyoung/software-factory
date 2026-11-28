// `lunamill config explain`: the settings as `.claude/lunamill.yaml` would
// read with every default written out, each line marked with where its
// value came from: `# default`, a preset's name, or nothing for a value
// only `.claude/lunamill.yaml` sets. `lunamill sync` writes the same lines
// into the lock.
import {
  hasPaths,
  PHASES,
  pluginsOf,
  ROLE_SHAPE,
  ROLES,
  type Command,
  type Settings,
  type Site,
} from "./config.mts";
import { itemKey, markText, type Resolution, type Source } from "./preset.mts";
import * as say from "./lib/output.mts";

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
  "builds.hosts",
  "auto-merge.allow",
  "auto-merge.deny",
  "auto-merge.commands",
  "site.pages",
  "site.widths",
  "site.checks",
  "site.hide",
]);

/** `exists` says whether a path from the root exists, for the plugins
 * Lunamill uses where the settings name none. */
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
  block(["tickets", "labels"]);
  for (const [k, v] of Object.entries(s.tickets.labels))
    put(["tickets", "labels", k], v);

  block(["code-host"]);
  put(["code-host", "type"], s.codeHost.type);
  // Quoted always: YAML reads a pattern that starts with `{` as a map.
  lines.push({
    text: `${pad(1)}branch-name: ${JSON.stringify(s.codeHost.branchName)}`,
    mark: marks.value(["code-host", "branch-name"]),
  });
  block(["code-host", "labels"]);
  for (const [k, v] of Object.entries(s.codeHost.labels))
    put(["code-host", "labels", k], v);
  block(["builds"]);
  put(["builds", "trigger"], s.builds.trigger);
  put(["builds", "runner"], s.builds.runner);
  if (s.builds.trigger === "github-action")
    put(["builds", "poll-minutes"], s.builds.pollMinutes);
  else comment(1, "poll-minutes: only with trigger github-action");
  put(["builds", "max-per-hour"], s.builds.maxPerHour);
  put(["builds", "hosts"], s.builds.hosts);
  if (s.specs === "openspec") {
    block(["specs"]);
    put(["specs", "type"], s.specs);
    put(["specs", "check"], s.specCheck);
  } else put(["specs"], s.specs);

  /** A command as it is written: text, or an item. */
  const written = (c: Command): unknown =>
    hasPaths(c) || c.report !== null
      ? {
          run: c.run,
          ...(c.in && { in: c.in.length === 1 ? c.in[0] : c.in }),
          ...(c.files && { files: c.files }),
          ...(c.report !== null && { report: c.report }),
        }
      : c.run;
  /** A setting of commands: a list, or the one text where it allows
   * that. */
  const putCommands = (key: string, list: Command[], one = false) => {
    const path = ["commands", key];
    if (one && list.length === 1 && !hasPaths(list[0]!) && !list[0]!.report)
      return put(path, list[0]!.run);
    if (!list.some(hasPaths)) return put(path, list.map(written));
    const mark = marks.value(path);
    lines.push({ text: `${pad(1)}${key}:`, mark });
    for (const c of list)
      stringify([written(c)], { lineWidth: 0 })
        .trimEnd()
        .split("\n")
        .forEach((line) => lines.push({ text: `${pad(2)}${line}`, mark }));
  };

  block(["commands"]);
  putCommands("build-setup", s.commands.buildSetup);
  putCommands("before-commit", s.commands.beforeCommit);
  putCommands("gate", s.commands.gate);
  for (const [key, list] of [
    ["test-one", s.commands.testOne],
    ["end-to-end", s.commands.endToEnd],
  ] as const)
    if (list.length === 0) comment(1, `${key}: none (default)`);
    else putCommands(key, list, true);
  const [coverage, ...more] = s.commands.coverage;
  if (!coverage) comment(1, "coverage: none (default)");
  else if (more.length) putCommands("coverage", s.commands.coverage);
  else {
    block(["commands", "coverage"]);
    put(["commands", "coverage", "run"], coverage.run);
    put(["commands", "coverage", "report"], coverage.report);
    if (coverage.in)
      put(
        ["commands", "coverage", "in"],
        coverage.in.length === 1 ? coverage.in[0] : coverage.in,
      );
    if (coverage.files) put(["commands", "coverage", "files"], coverage.files);
  }
  putCommands("relock", s.commands.relock, true);
  // Written only when set, so a repository with no items sees nothing new.
  if (s.commands.ignore.length) put(["commands", "ignore"], s.commands.ignore);

  // Each role holds what `lunamill plugins` prints for it: the settings'
  // own plugins, or Lunamill's where they name none.
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

  if (s.prReview) put(["pr-review"], true);
  else comment(0, "pr-review: off");

  const [site, ...otherSites] = s.sites;
  if (!site) comment(0, "site: off");
  else if (otherSites.length) {
    const mark = marks.value(["site"]);
    lines.push({ text: "site:", mark });
    for (const each of s.sites)
      stringify([siteWritten(each)], { lineWidth: 0 })
        .trimEnd()
        .split("\n")
        .forEach((line) => lines.push({ text: `${pad(1)}${line}`, mark }));
  } else {
    block(["site"]);
    if (site.in)
      put(["site", "in"], site.in.length === 1 ? site.in[0] : site.in);
    if (site.files) put(["site", "files"], site.files);
    put(["site", "start"], site.start);
    put(["site", "url"], site.url);
    if (site.designGuide === null) comment(1, "design-guide: none (default)");
    else put(["site", "design-guide"], site.designGuide);
    if (site.pages === null) comment(1, "pages: found by Lunamill (default)");
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

  // Each policy carries the mark of the layer it came from, as a plugin
  // in a list does.
  if (!s.approvalPolicies.length)
    comment(0, "approval-policies: none (default)");
  else {
    lines.push({ text: "approval-policies:", mark: null });
    for (const p of s.approvalPolicies) {
      const mark = marks.plugin(["approval-policies"], p.name);
      const item = {
        name: p.name,
        ...(p.run !== null && { run: p.run }),
        ...(p.agent !== null && { agent: p.agent }),
        ...(p.in && { in: p.in.length === 1 ? p.in[0] : p.in }),
        ...(p.files && { files: p.files }),
      };
      stringify([item], { lineWidth: 0 })
        .trimEnd()
        .split("\n")
        .forEach((line) => lines.push({ text: `${pad(1)}${line}`, mark }));
    }
  }

  // Each mark lines up with the others, two spaces past the longest line
  // that carries one.
  const marked = lines.filter((l) => l.mark !== null);
  const at = Math.max(0, ...marked.map((l) => l.text.length)) + 2;
  return lines.map((l) =>
    l.mark !== null ? `${l.text.padEnd(at)}# ${l.mark}` : l.text,
  );
}

/** The lines as `config explain` prints them: a default's whole line and a
 * comment line may be skipped, and so may any other mark alone. It works on
 * the text alone, since the lock keeps only that. */
export function explainedLines(lines: string[]): say.Line[] {
  const comment = (l: string) => l.trimStart().startsWith("#");
  // Every mark starts at one column, two spaces past the longest marked
  // line. A quoted value can hold "  # " too, but rarely at that column.
  const counts = new Map<number, number>();
  for (const l of lines.filter((l) => !comment(l)))
    for (const m of l.matchAll(/ {2}# /g)) {
      const at = m.index + 2;
      counts.set(at, (counts.get(at) ?? 0) + 1);
    }
  const most = Math.max(0, ...counts.values());
  const at = Math.max(
    -1,
    ...[...counts].filter(([, n]) => n === most).map(([c]) => c),
  );
  return lines.map((l) => {
    if (comment(l)) return say.verbatim(l, 0);
    if (at < 0 || !l.startsWith("  # ", at - 2)) return say.verbatim(l);
    return say.verbatim(l, l.slice(at) === "# default" ? 0 : at);
  });
}

/** A site as it is written, in a list of them. */
function siteWritten(site: Site): Record<string, unknown> {
  return {
    ...(site.in && { in: site.in.length === 1 ? site.in[0] : site.in }),
    ...(site.files && { files: site.files }),
    start: site.start,
    url: site.url,
    ...(site.designGuide !== null && { "design-guide": site.designGuide }),
    ...(site.pages !== null && { pages: site.pages }),
    widths: site.widths,
    hide: site.hide,
    checks: site.checks,
    "max-pages": site.maxPages,
    "start-minutes": site.startMinutes,
    accessibility: site.accessibility,
    "new-values": site.newValues,
  };
}
