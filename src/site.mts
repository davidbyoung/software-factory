#!/usr/bin/env node
// `factory site compare` and `factory site stop`: pictures of a website's
// pages before and after a change, and which pixels differ.
//
//   factory site compare [--before URL --after URL] [--base REF] [--keep]
//   factory site stop
//
// With no addresses it starts the working tree and a worktree of the base with
// `site.start` and stops both when it ends. It exits 0 whether or not anything
// changed, and non-zero only when it could not do its job.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import {
  loadSettings,
  repoRoot,
  SettingsError,
  type Command,
  type Site,
} from "./config.mts";
import {
  branchChange,
  cannotTell,
  type Change,
  type Git,
} from "./lib/changes.mts";
import { branchDeps, gitIn, needDefaultBranch } from "./lib/default-branch.mts";
import { runsOf } from "./lib/paths.mts";
import { planOf } from "./lib/plan.mts";
import { crawl, normalize, sitemapPaths } from "./site/pages.mts";
import {
  changedWithoutNoise,
  classify,
  diff,
  type Picture,
  type Status,
} from "./site/pixels.mts";
import {
  encode,
  launch,
  measureView,
  shoot,
  type PwBrowser,
} from "./site/capture.mts";
import {
  addToCensus,
  AXE_TAGS,
  emptyCensus,
  formatFinding,
  newValues,
  newViolations,
  sidewaysScroll,
  type Finding,
} from "./site/measure.mts";
import {
  addWorktree,
  defaultBase,
  freePort,
  keep,
  removeWorktree,
  SiteError,
  startSites,
  stopKept,
  stopProcess,
} from "./site/servers.mts";
import * as say from "./lib/output.mts";

export type Row = {
  page: string;
  width: number;
  scheme: "light" | "dark";
  status: Status;
  pixels: number;
  rows: [number, number] | null;
  files: { before: string; after: string; changed: string } | null;
};

export type Report = {
  /** The base's address, or null for a site the base doesn't have. */
  before: string | null;
  after: string;
  pages: string[];
  widths: number[];
  darkSkipped: boolean;
  rows: Row[];
  /** What got worse on a changed view, by what a standard or the browser
   * defines. */
  measured: Finding[];
  unchanged: number;
  folder: string;
};

const slug = (p: string) =>
  p.replace(/^\/|\/$/g, "").replace(/\W+/g, "-") || "home";

async function text(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** The pages of a running site: its sitemap, or else its links. */
export async function findPages(base: string): Promise<string[]> {
  const xml = await text(new URL("/sitemap.xml", base).href);
  const fromMap = xml ? sitemapPaths(xml) : [];
  if (fromMap.length) return fromMap;
  return crawl((p) => text(new URL(p, base).href));
}

/** How many views to picture at once on a machine with this many cores. A
 * view is already two pages, the base's and the branch's. On two cores, as
 * a GitHub runner has, three at once starve a long page past the
 * screenshot's limit, and one at a time is quicker there. */
export function viewsAtOnce(cores: number): number {
  return cores >= 8 ? 3 : 1;
}

async function pool<T>(items: T[], size: number, f: (i: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await f(items[next++]);
    }),
  );
}

/** Outline the changed pixels on the after picture. */
function outline(
  after: Picture,
  mask: Uint8Array,
  maskWidth: number,
  rows: [number, number],
): Picture {
  const data = new Uint8Array(after.data);
  for (let y = rows[0]; y <= rows[1] && y < after.height; y++)
    for (let x = 0; x < after.width && x < maskWidth; x++)
      if (mask[y * maskWidth + x]) {
        const i = (y * after.width + x) * 4;
        data[i] = 255;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
  return { width: after.width, height: after.height, data };
}

export async function compareSites(o: {
  root: string;
  /** The base's address, or null for a site the base doesn't have. */
  before: string | null;
  after: string;
  site: Pick<Site, "pages" | "widths" | "hide"> &
    Partial<Pick<Site, "accessibility" | "newValues">>;
  folder: string;
  browser: PwBrowser;
}): Promise<Report> {
  const { site, browser } = o;
  const pages = (
    site.pages ?? [
      ...new Set([
        ...(o.before ? await findPages(o.before) : []),
        ...(await findPages(o.after)),
      ]),
    ]
  ).map(normalize);
  mkdirSync(o.folder, { recursive: true });
  const schemes: ("light" | "dark")[] = ["light", "dark"];

  // Dark mode: when the first page's dark picture is its light one, the site
  // has none, and dark is skipped.
  let darkSkipped = false;
  if (pages.length) {
    const w = site.widths[0];
    const light = await shoot(
      browser,
      o.after,
      pages[0],
      { width: w, scheme: "light" },
      site.hide,
    );
    const dark = await shoot(
      browser,
      o.after,
      pages[0],
      { width: w, scheme: "dark" },
      site.hide,
    );
    darkSkipped = !!light && !!dark && diff(light, dark).count === 0;
  }
  const use = darkSkipped ? schemes.slice(0, 1) : schemes;

  const rows: Row[] = [];
  const census = emptyCensus();
  const jobs = pages.flatMap((page) =>
    site.widths.flatMap((width) =>
      use.map((scheme) => ({ page, width, scheme })),
    ),
  );
  const atOnce = viewsAtOnce(availableParallelism());
  await pool(jobs, atOnce, async ({ page, width, scheme }) => {
    const view = { width, scheme };
    const before = o.before;
    const [b, a] = await Promise.all([
      before
        ? shoot(browser, before, page, view, site.hide, (snap) =>
            addToCensus(census, scheme, snap.entries),
          )
        : null,
      shoot(browser, o.after, page, view, site.hide),
    ]);
    let pixels = 0;
    let changedRows: [number, number] | null = null;
    let files: Row["files"] = null;
    if (a && b) {
      let d = diff(b, a);
      if (d.count > 0) {
        // Shot again, both sites: what differs between two pictures of one
        // site is noise, and a pixel has to differ in both pairs.
        const [againB, againA] = await Promise.all([
          shoot(browser, before!, page, view, site.hide),
          shoot(browser, o.after, page, view, site.hide),
        ]);
        if (againA && againB) d = changedWithoutNoise(b, a, againA, againB);
      }
      pixels = d.count;
      changedRows = d.rows;
      if (d.count > 0 && d.rows) {
        const name = `${slug(page)}-${width}-${scheme}`;
        files = {
          before: `${name}-before.png`,
          after: `${name}-after.png`,
          changed: `${name}-changed.png`,
        };
        writeFileSync(join(o.folder, files.before), encode(b));
        writeFileSync(join(o.folder, files.after), encode(a));
        writeFileSync(
          join(o.folder, files.changed),
          encode(outline(a, d.mask, d.width, d.rows)),
        );
      }
    }
    const status = classify({ before: !!b, after: !!a }, pixels);
    rows.push({
      page,
      width,
      scheme,
      status,
      pixels,
      rows: changedRows,
      files,
    });
  });
  rows.sort(
    (x, y) =>
      pages.indexOf(x.page) - pages.indexOf(y.page) ||
      y.width - x.width ||
      x.scheme.localeCompare(y.scheme),
  );
  // Only a view that changed is measured, once every base view is in the
  // census: views finish out of order.
  const level = site.accessibility ?? "wcag22aa";
  const tags = level === "none" ? [] : AXE_TAGS[level];
  const measured: Finding[] = [];
  const toMeasure = rows.filter(
    (r) => r.status === "changed" || r.status === "new",
  );
  await pool(toMeasure, atOnce, async (row) => {
    const view = { page: row.page, width: row.width, scheme: row.scheme };
    const [b, a] = await Promise.all([
      row.status === "new" || o.before === null
        ? null
        : measureView(browser, o.before, row.page, view, site.hide, tags),
      measureView(browser, o.after, row.page, view, site.hide, tags),
    ]);
    if (!a) return;
    measured.push(
      ...newViolations(b ? b.violations : null, a.violations, view),
      ...sidewaysScroll(b ? b.scrollWidth : null, a.scrollWidth, view),
      ...(site.newValues === false ? [] : newValues(census, a.entries, view)),
    );
  });
  const order = (f: Finding) =>
    `${String(pages.indexOf(f.page)).padStart(5, "0")}|${String(100000 - f.width).padStart(6, "0")}|${f.scheme}|${f.kind}|${f.rule}|${f.element}`;
  measured.sort((x, y) => order(x).localeCompare(order(y)));
  const report: Report = {
    before: o.before,
    after: o.after,
    pages,
    widths: site.widths,
    darkSkipped,
    rows,
    measured,
    unchanged: pages.filter((p) =>
      rows.filter((r) => r.page === p).every((r) => r.status === "same"),
    ).length,
    folder: o.folder,
  };
  writeFileSync(join(o.folder, "report.json"), JSON.stringify(report, null, 2));
  return report;
}

const n = (x: number) => x.toLocaleString("en-US");

export function table(r: Report): say.Line[] {
  const lines = [
    say.text(
      `${r.pages.length} pages, ${r.rows.length / Math.max(1, r.pages.length)} views each.`,
    ),
    say.BLANK,
  ];
  for (const row of r.rows) {
    if (row.status === "same") continue;
    const rows = row.rows ? `rows ${n(row.rows[0])} to ${n(row.rows[1])}` : "";
    lines.push(
      say.row(
        row.page,
        `${String(row.width).padStart(4)} ${row.scheme.padEnd(5)}  ${row.status.padEnd(8)} ${n(row.pixels)} px  ${rows}`.trimEnd(),
        { width: 28 },
      ),
    );
  }
  lines.push(say.text(`  ${r.unchanged} pages did not change.`));
  if (r.darkSkipped)
    lines.push(say.text("  The site has no dark mode, so dark was skipped."));
  return lines;
}

/** Run each of the repository's checks with the report on its stdin. Each
 * non-empty line it prints is a finding; its exit code says nothing. */
export function runChecks(root: string, checks: string[], input: object) {
  return checks.map((command) => {
    const res = spawnSync("sh", ["-c", command], {
      cwd: root,
      input: JSON.stringify(input),
      encoding: "utf8",
    });
    const findings = (res.stdout ?? "").split("\n").filter((l) => l.trim());
    return { command, findings };
  });
}

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

/** The two running sites `--before` and `--after` name, or null when the
 * command is to start them itself. */
export function givenUrls(
  argv: string[],
): { before: string; after: string } | null {
  const before = flag(argv, "--before");
  const after = flag(argv, "--after");
  if (before && after) return { before, after };
  if (before || after)
    throw new SiteError(
      `--before and --after go together: ${before ? "--after" : "--before"} is missing`,
    );
  return null;
}

/** One site to compare, and the folder it is in: null for the root. */
export type SiteRun = { site: Site; folder: string | null };

/** The sites to compare: the one `--site` names, the one site there is, or
 * each site the change touches, after a plan of them like the gate's. */
export function sitesToCompare(o: {
  sites: Site[];
  gate: Command[];
  ignore: string[];
  argv: string[];
  out: say.Out;
  git: Git;
  /** The default branch's name, or null when it can't be told. */
  defaultBranch: string | null;
  /** The files git tracks, and the new ones it doesn't ignore. */
  files: string[];
  exists: (path: string) => boolean;
}): SiteRun[] {
  const { argv, out, defaultBranch, files, exists } = o;
  const asCommand = new Map<Command, Site>();
  const commands = o.sites.map((site) => {
    const c: Command = {
      run: site.start,
      in: site.in,
      files: site.files,
      report: null,
    };
    asCommand.set(c, site);
    return c;
  });
  const every = commands.flatMap((c) => runsOf(c, files, exists));
  const named = flag(argv, "--site");
  if (named !== undefined) {
    const run = every.find((r) => r.folder === named.replace(/\/+$/, ""));
    if (!run)
      throw new SiteError(
        `--site ${named}: no site is in that folder. factory config get site lists them`,
      );
    return [{ site: asCommand.get(run.command)!, folder: run.folder }];
  }
  if (every.length > 1) {
    if (givenUrls(argv))
      throw new SiteError(
        "--before and --after compare one site: name it with --site FOLDER",
      );
    if (argv.includes("--keep"))
      throw new SiteError(
        "--keep leaves one site running: name it with --site FOLDER",
      );
  }
  if (!commands.some((c) => c.in !== null || c.files !== null))
    return every.map((r) => ({
      site: asCommand.get(r.command)!,
      folder: null,
    }));
  const remote = `origin/${defaultBranch ?? "DEFAULT"}`;
  const read: Change =
    defaultBranch === null
      ? { files: null, why: "no-remote", base: "" }
      : branchChange(o.git, defaultBranch);
  const change = read.files;
  const plan = planOf({
    commands,
    change,
    gate: o.gate,
    ignore: o.ignore,
    files,
    exists,
    everyCommand: true,
  });
  const t = plan.all.length;
  const e = plan.everything;
  if (e?.kind === "settings")
    out(say.text(`site: all ${t} pictured, since ${e.path} changed`));
  else if (e?.kind === "uncovered")
    out(
      say.text(
        `site: all ${t} pictured, since ${e.files.length} changed ${e.files.length === 1 ? "file is" : "files are"} in no gate command's files and not in commands.ignore`,
      ),
    );
  else if (e?.kind === "unknown" && read.files === null) {
    const [why, fix] = cannotTell(read, remote);
    out(
      say.mark(
        "look",
        `Can't tell what changed, since ${why}. Every site command runs.`,
      ),
    );
    out(say.text("  ", fix));
  } else {
    out(
      say.text(
        `site: ${plan.runs.length} of ${t} pictured, for the ${change!.length} ${change!.length === 1 ? "file" : "files"} changed since ${remote}`,
      ),
    );
    const width = Math.max(
      0,
      ...plan.runs.map((r) => (r.run.folder ?? "").length),
    );
    for (const r of plan.runs)
      out(
        say.row(
          r.run.folder ?? ".",
          r.files.length
            ? `${r.files[0]}${r.files.length > 1 ? `, and ${r.files.length - 1} more` : ""}`
            : "every change",
          { width, gap: 2 },
        ),
      );
  }
  out(say.BLANK);
  return plan.runs.map((r) => ({
    site: asCommand.get(r.run.command)!,
    folder: r.run.folder,
  }));
}

async function compare(argv: string[], out: say.Out): Promise<number> {
  const root = repoRoot();
  const settings = await loadSettings();
  if (settings.sites.length === 0)
    throw new SiteError(".claude/factory.yaml: site: not written");
  const keepRunning = argv.includes("--keep");
  const given = givenUrls(argv);
  const git = gitIn(root);
  let defaultBranch: string | null = null;
  try {
    defaultBranch = await needDefaultBranch(branchDeps(root));
  } catch {
    defaultBranch = null;
  }
  const runs = sitesToCompare({
    sites: settings.sites,
    gate: settings.commands.gate,
    ignore: settings.commands.ignore,
    argv,
    out,
    git,
    defaultBranch,
    files: git(["ls-files", "--cached", "--others", "--exclude-standard"])
      .out.split("\n")
      .filter(Boolean),
    exists: (path) => existsSync(join(root, path)),
  });
  if (runs.length === 0) {
    out(say.mark("ok", "No site changed."));
    return 0;
  }
  let worktree: string | null = null;
  const pids: number[] = [];
  let started: { after: number; before: number | null } | null = null;
  let browser: PwBrowser | null = null;
  // What `--keep` leaves is only what a finished comparison recorded for
  // `factory site stop`; a failed one stops what it started.
  let kept = false;
  const cleanup = () => {
    if (kept) return;
    pids.forEach(stopProcess);
    if (worktree) removeWorktree(root, worktree);
    worktree = null;
  };
  for (const sig of ["SIGINT", "SIGTERM"] as const)
    process.once(sig, () => {
      cleanup();
      process.exit(130);
    });
  const stamp = join(
    root,
    "node_modules/.cache/factory/site",
    new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19),
  );
  try {
    browser = await launch(root);
    for (const { site, folder } of runs) {
      const here = folder === null ? root : join(root, folder);
      if (folder !== null && runs.length > 1) out(say.text(say.name(folder)));
      let before: string | null;
      let after: string;
      if (given) {
        for (const url of [given.before, given.after]) {
          try {
            await fetch(url, { signal: AbortSignal.timeout(5000) });
          } catch {
            throw new SiteError(`nothing answers at ${url}`);
          }
        }
        before = given.before;
        after = given.after;
      } else {
        const base = flag(argv, "--base") ?? (await defaultBase(root));
        // A site the base doesn't have is pictured on this branch alone.
        const onBase =
          folder === null ||
          defaultBranch === null ||
          gitIn(root)(["ls-tree", "-d", base, folder]).out.trim() !== "";
        if (onBase && !worktree) worktree = addWorktree(root, base);
        const common = { start: site.start, minutes: site.startMinutes };
        const ports = [await freePort(), await freePort()];
        const wanted = [
          { ...common, url: site.url, cwd: here, port: ports[0]! },
          ...(onBase
            ? [
                {
                  ...common,
                  url: site.url,
                  cwd: folder === null ? worktree! : join(worktree!, folder),
                  port: ports[1]!,
                },
              ]
            : []),
        ];
        const [a, b] = await startSites(wanted, pids);
        started = { after: a!.pid, before: b?.pid ?? null };
        after = a!.url;
        before = b?.url ?? null;
        out(
          say.text(
            before
              ? `Started this branch at ${after} and ${base} at ${before}.`
              : `Started this branch at ${after}. ${base} has no ${folder}, so every page is new.`,
          ),
        );
      }
      const into = folder === null ? stamp : join(stamp, folder);
      const report = await compareSites({
        root,
        before,
        after,
        site,
        folder: into,
        browser,
      });
      for (const line of table(report)) out(line);
      for (const f of report.measured)
        out(say.text(say.asIs(formatFinding(f))));
      const changedPages = [
        ...new Set(
          report.rows.filter((r) => r.status !== "same").map((r) => r.page),
        ),
      ];
      const checks = runChecks(here, site.checks, {
        before,
        after,
        pages: changedPages,
        report: into,
      });
      for (const c of checks)
        for (const f of c.findings) out(say.verbatim(`${c.command}: ${f}`));
      writeFileSync(
        join(into, "report.json"),
        JSON.stringify({ ...report, checks }, null, 2),
      );
      out(say.BLANK);
      out(say.text(`Pictures and the full list: ${into}/`));
      if (keepRunning && worktree && started && started.before !== null) {
        kept = true;
        keep(root, {
          before: { url: before!, pid: started.before },
          after: { url: after, pid: started.after },
          worktree,
        });
        out(
          say.text(
            `Left running: ${after} (this branch) and ${before} (base). \`factory site stop\` ends them.`,
          ),
        );
      }
      if (!keepRunning && runs.length > 1) {
        pids.splice(0).forEach(stopProcess);
        out(say.BLANK);
      }
    }
    return 0;
  } finally {
    await browser?.close();
    cleanup();
  }
}

/** What `factory site stop` says: a kept comparison is always two sites,
 * this branch's and the base's. */
export function stopMessage(stopped: boolean): string {
  return stopped
    ? "Stopped the 2 sites site compare --keep left running."
    : "No sites were left running.";
}

export async function run(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  const { out, err } = say.printersFor(`site ${command}`);
  try {
    if (command === "compare") return await compare(rest, out);
    if (command === "stop") {
      out(say.text(stopMessage(stopKept(repoRoot()))));
      return 0;
    }
    err(say.text("Usage: factory site compare | site stop"));
    return 2;
  } catch (e) {
    // Anything that stopped the comparison is a job not done, not a finding.
    if (e instanceof SiteError || e instanceof SettingsError) {
      err(say.text(e.message));
      return 1;
    }
    err(say.text(e instanceof Error ? e.message : String(e)));
    return 1;
  }
}
