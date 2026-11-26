// The commands that run what the settings name, so a skill says what to
// run and the repository's settings say how:
//
//   factory gate [--dry-run | --all]      # commands.gate, in order
//   factory test-one FILE [NAME]          # commands.test-one, one test alone
//   factory end-to-end FILE [--times K]   # commands.end-to-end, K times in a row
//   factory coverage [--dry-run]          # commands.coverage, then the lines no test covers
//   factory relock [--dry-run | --all]    # commands.relock
//   factory build-setup [--dry-run]       # commands.build-setup
//   factory specs check                   # specs.check
//
// and the commands that reach the spec tool `specs` names:
//
//   factory specs list                    # each spec it keeps
//   factory specs new N                   # start ticket N's spec
//   factory specs finish N                # fold ticket N's spec in
//
// Each command runs with bash, text from the repository's root and an item
// in each of its folders, with its output passed through and no standard
// input. Which of a setting's commands run is `lib/plan.mts`'s. `test-one`
// gets FILE and NAME in its environment, `end-to-end` FILE, the spec check
// the spec tool's environment, and every command of a change BASE. An
// argument a command does not know prints its usage and exits 2.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  defaultDeps,
  hasPaths,
  loadSettings,
  repoRoot,
  SETTINGS_FILE,
  SettingsError,
  type Command,
  type Settings,
} from "./config.mts";
import {
  branchChange,
  commitChange,
  relockChange,
  type Change,
  type Git,
} from "./lib/changes.mts";
import { branchDeps, gitIn, needDefaultBranch } from "./lib/default-branch.mts";
import { matchesAny } from "./lib/glob.mts";
import { commandLine, patternsIn, runsOf, type Run } from "./lib/paths.mts";
import { planOf, waitsOn, type Plan } from "./lib/plan.mts";
import { changedLines, parseLcov, uncovered } from "./patch-coverage.mts";
import { specTools, type SpecTools } from "./specs/index.mts";
import { keyOf, openTickets } from "./tickets/index.mts";
import { KeyError } from "./tickets/types.mts";
import * as say from "./lib/output.mts";

export type Deps = {
  /** The repository's root, where every command runs. */
  root: string;
  settings: () => Promise<Settings>;
  /** Runs one settings command from `cwd` with `env` added to the
   * environment, and returns its exit status. */
  exec: (command: string, cwd: string, env: Record<string, string>) => number;
  out: say.Out;
  err: say.Out;
  specTools: SpecTools;
  /** Ticket `id`'s labels; throws when it can't be read. */
  labels: (settings: Settings, id: string) => Promise<string[]>;
  /** Git, in the repository's root. */
  git: Git;
  /** The default branch's name; rejects with the line that says why not. */
  defaultBranch: () => Promise<string>;
  /** The files git tracks, and the new ones it doesn't ignore. */
  files: () => string[];
  /** Whether a path from the root exists. */
  exists: (path: string) => boolean;
  /** A file's text, by its path from the root; throws when there is none. */
  readFile: (path: string) => string;
};

const USAGE = {
  gate: "Usage: factory gate [--dry-run | --all]",
  "test-one": "Usage: factory test-one FILE [NAME]",
  "end-to-end": "Usage: factory end-to-end FILE [--times K]",
  coverage: "Usage: factory coverage [--dry-run]",
  relock: "Usage: factory relock [--dry-run | --all]",
  "build-setup": "Usage: factory build-setup [--dry-run]",
  "specs-check": "Usage: factory specs check",
  "specs-list": "Usage: factory specs list",
  "specs-new": "Usage: factory specs new N",
  "specs-finish": "Usage: factory specs finish N",
} as const;

type Name = keyof typeof USAGE;

/** The flags each command that plans takes. */
const FLAGS: Partial<Record<Name, string[]>> = {
  gate: ["--dry-run", "--all"],
  coverage: ["--dry-run"],
  relock: ["--dry-run", "--all"],
  "build-setup": ["--dry-run"],
};

/** What `factory end-to-end` was asked: the file, and how many runs when
 * `--times` is given; null when the arguments are not ones it knows. */
function endToEndArgs(
  args: string[],
): { file: string; times: number | null } | null {
  let file: string | null = null;
  let times: number | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--times") {
      // A whole number above zero.
      if (times !== null || !/^[1-9]\d*$/.test(args[i + 1] ?? "")) return null;
      times = Number(args[++i]);
    } else if (args[i].startsWith("-") || file !== null) return null;
    else file = args[i];
  }
  return file === null ? null : { file, times };
}

/** `n` and the word for it, one or many. */
const counted = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** "R of T run", with the verb agreeing with R. */
const ofRun = (r: number, t: number) =>
  `${r} of ${t} ${r === 1 ? "runs" : "run"}`;

/** A list read aloud: "a", "a or b", "a, b, or c". */
function either(items: string[]): string {
  if (items.length < 3) return items.join(" or ");
  return `${items.slice(0, -1).join(", ")}, or ${items.at(-1)}`;
}

/** The line that says why the change can't be told, and how to fix it. */
function cannotTell(
  change: Extract<Change, { files: null }>,
  remote: string,
): [string, string] {
  if (change.why === "no-shared")
    return [
      `this branch shares no commit with ${remote}`,
      "In a shallow clone, fetch the history with: git fetch --unshallow origin",
    ];
  if (change.why === "no-commit")
    return ["there is no commit yet", "Commit once, and it reads from there."];
  const [, name] = remote.split("/");
  return [
    `there is no ${remote} to compare with`,
    `Fetch it with: git fetch origin ${name}`,
  ];
}

/** Why a command runs: the first changed file that sets it off, and how
 * many more do, or that it runs on every change. */
const reasonOf = (files: string[]) =>
  files.length === 0
    ? "every change"
    : `${files[0]}${files.length > 1 ? `, and ${files.length - 1} more` : ""}`;

/** Each command that runs, grouped as one row per command of the setting. */
function rowsOf(plan: Plan): { label: string; why: string }[] {
  const rows: { label: string; why: string }[] = [];
  const byCommand = new Map<Command, Plan["runs"]>();
  for (const r of plan.runs) {
    const list = byCommand.get(r.run.command) ?? [];
    list.push(r);
    byCommand.set(r.run.command, list);
  }
  for (const [command, runs] of byCommand) {
    const of = plan.all.filter((a) => a.command === command).length;
    const why = reasonOf([...new Set(runs.flatMap((r) => r.files))].sort());
    const label =
      runs.length === 1
        ? commandLine(runs[0]!.run)
        : `${command.run}, in ${runs.length === of ? `each of the ${of}` : `${runs.length} of the ${of}`} folders of ${command.in!.join(", ")}`;
    rows.push({ label, why });
  }
  return rows;
}

type PlanWords = {
  /** The setting's key under `commands`. */
  key: string;
  /** What a failure line starts with, such as "The gate failed". */
  failed: string;
  /** The noun of "Every gate command". */
  noun: string;
  /** How the change is said after the count of files. */
  since: (remote: string) => string;
  command: string;
};

/** Prints the plan's first lines: what runs, and why. */
function printPlan(
  d: Deps,
  plan: Plan,
  w: PlanWords,
  remote: string,
  changed: number,
  dry: boolean,
) {
  const head = `commands.${w.key}: `;
  const t = plan.all.length;
  const e = plan.everything;
  if (!plan.paths) {
    // An all-text setting prints no plan; a dry run lists its commands.
  } else if (e?.kind === "asked")
    d.out(
      say.text(
        w.key === "build-setup"
          ? `${head}all ${t} run, before there is a change`
          : `${head}all ${t} run, as --all asks`,
      ),
    );
  else if (e?.kind === "settings")
    d.out(say.text(`${head}all ${t} run, since ${e.path} changed`));
  else if (e?.kind === "uncovered") {
    d.out(
      say.text(
        `${head}all ${t} run, since ${counted(e.files.length, "changed file is", "changed files are")} in no gate command's files and not in commands.ignore`,
      ),
    );
    for (const f of e.files.slice(0, 10)) d.out(say.text("  ", f));
    if (e.files.length > 10)
      d.out(say.text(`  and ${e.files.length - 10} more`));
  } else if (e?.kind === "unknown") {
    // The "Can't tell" line above says why.
  } else if (plan.nothing)
    d.out(
      say.text(`${head}0 of ${t} run, since nothing changed since ${remote}`),
    );
  else {
    const r = plan.runs.length;
    d.out(
      say.text(
        `${head}${dry ? `${r} of ${t} would run` : ofRun(r, t)}, for the ${counted(changed, "file")} ${w.since(remote)}${plan.ignoredOnly ? ", which commands.ignore lists" : ""}`,
      ),
    );
  }
  if (dry) {
    const running = new Set(plan.runs.map((r) => r.run));
    const reasons = new Map(plan.runs.map((r) => [r.run, reasonOf(r.files)]));
    const width = Math.max(...plan.all.map((r) => commandLine(r).length));
    for (const run of plan.all)
      d.out(
        say.cells([
          { text: "  " },
          { text: (running.has(run) ? "runs" : "left out").padEnd(10) },
          { role: "copy", text: commandLine(run).padEnd(width + 2) },
          {
            text: running.has(run)
              ? reasons.get(run)!
              : `no change in ${either(waitsOn(run))}`,
          },
        ]),
      );
    return;
  }
  if (plan.paths && !e) {
    const rows = rowsOf(plan);
    const width = Math.max(0, ...rows.map((r) => r.label.length));
    for (const r of rows)
      d.out(say.row(r.label, r.why, { width, gap: 2, typed: true }));
    const left = plan.all.length - plan.runs.length;
    if (left > 0 && !plan.nothing)
      d.out(
        say.mark(
          "off",
          plan.ignoredOnly
            ? `${left} left out, since commands.ignore lists every changed file`
            : [
                `${left} left out, since this change touches none of their files: `,
                say.copy(`factory ${w.command} --dry-run`),
                " lists each",
              ],
        ),
      );
  }
  d.out(say.BLANK);
}

/** Runs the plan's commands in order: after one fails, only the same
 * command's other folders. The commands that failed, by command line. */
function runPlan(d: Deps, runs: Run[], env: Record<string, string>): Run[] {
  const failed: Run[] = [];
  for (const run of runs) {
    if (failed.length && run.command !== failed[0]!.command) break;
    d.out(say.text("$ ", say.copy(commandLine(run))));
    const cwd = run.folder === null ? d.root : join(d.root, run.folder);
    if (d.exec(run.command.run, cwd, env) !== 0) failed.push(run);
  }
  return failed;
}

/** The closing line of a run that failed. */
function failure(d: Deps, failed: Run[], ran: Run[], w: PlanWords) {
  if (failed.length === 1)
    d.err(say.mark("fail", `${w.failed} on: ${commandLine(failed[0]!)}`));
  else {
    const command = failed[0]!.command;
    const of = ran.filter((r) => r.command === command).length;
    d.err(
      say.mark(
        "fail",
        `${w.failed} in ${failed.length} of the ${of} folders ${command.run} ran in:`,
      ),
    );
    for (const f of failed) d.err(say.text("    ", say.copy(commandLine(f))));
  }
}

/** `factory gate`, `relock`, and `build-setup`: plan, print, run, close. */
async function plannedRun(
  d: Deps,
  s: Settings,
  commands: Command[],
  w: PlanWords,
  o: {
    flags: string[];
    /** The default branch's name, or null when it can't be told. */
    defaultBranch: string | null;
    change: (defaultBranch: string) => Change;
    everyCommand: boolean;
    /** Whether every command always runs, as build-setup's do. */
    always?: boolean;
  },
): Promise<number> {
  const dry = o.flags.includes("--dry-run");
  const all = o.flags.includes("--all") || o.always === true;
  const paths = commands.some(hasPaths);
  const remote = `origin/${o.defaultBranch ?? "DEFAULT"}`;
  // Read even for text alone, which a tool of its own such as Nx reads as
  // $BASE.
  const change: Change | null = o.always
    ? null
    : o.defaultBranch === null
      ? { files: null, why: "no-remote", base: "" }
      : o.change(o.defaultBranch);
  const plan = planOf({
    commands,
    change: change ? change.files : [],
    gate: s.commands.gate,
    ignore: s.commands.ignore,
    files: d.files(),
    exists: d.exists,
    everyCommand: o.everyCommand,
    all,
  });
  if (paths && !all && change && change.files === null) {
    const [why, fix] = cannotTell(change, remote);
    d.out(
      say.mark(
        "look",
        `Can't tell what changed, since ${why}. Every ${w.noun} command runs.`,
      ),
    );
    d.out(say.text("  ", fix));
    d.out(say.BLANK);
  }
  if (paths || dry)
    printPlan(d, plan, w, remote, change?.files?.length ?? 0, dry);
  if (dry) return 0;
  const runs = plan.runs.map((r) => r.run);
  const base = change && change.files !== null ? change.base : "";
  const failed = runPlan(d, runs, { BASE: base });
  if (failed.length) {
    failure(d, failed, runs, w);
    return 1;
  }
  const left = plan.all.length - runs.length;
  if (runs.length === 0)
    d.out(
      say.mark(
        "ok",
        plan.nothing
          ? "Nothing to check."
          : plan.ignoredOnly && w.key === "gate"
            ? "No gate command needs to run: every changed file is in commands.ignore."
            : `No ${w.noun} command needs to run.`,
      ),
    );
  else if (left > 0)
    d.out(
      say.mark(
        "ok",
        `Every ${w.noun} command that ran passed: ${runs.length} run, ${left} left out.`,
      ),
    );
  else d.out(say.mark("ok", `Every ${w.noun} command passed.`));
  return 0;
}

/** `factory coverage`: runs the coverage commands a change sets off, then
 * prints the lines the branch changed that no test covers. */
async function coverage(
  d: Deps,
  s: Settings,
  args: string[],
  defaultBranch: string | null,
): Promise<number> {
  const list = s.commands.coverage;
  if (list.length === 0) {
    d.out(
      say.mark("off", "No coverage command (commands.coverage is not set)."),
    );
    return 0;
  }
  const dry = args.includes("--dry-run");
  const remote = `origin/${defaultBranch ?? "DEFAULT"}`;
  const change: Change =
    defaultBranch === null
      ? { files: null, why: "no-remote", base: "" }
      : branchChange(d.git, defaultBranch);
  if (change.files === null) {
    const [why, fix] = cannotTell(change, remote);
    d.err(say.mark("fail", `Can't tell which lines changed, since ${why}.`));
    d.err(say.text("  ", fix));
    return 1;
  }
  const w: PlanWords = {
    key: "coverage",
    failed: "Coverage failed",
    noun: "coverage",
    since: (r) => `changed since ${r}`,
    command: "coverage",
  };
  const plan = planOf({
    commands: list,
    change: change.files,
    gate: s.commands.gate,
    ignore: s.commands.ignore,
    files: d.files(),
    exists: d.exists,
    everyCommand: false,
  });
  if (plan.paths || dry)
    printPlan(d, plan, w, remote, change.files.length, dry);
  if (dry) return 0;
  const runs = plan.runs.map((r) => r.run);
  const failed = runPlan(d, runs, { BASE: change.base });
  if (failed.length) {
    failure(d, failed, runs, w);
    return 1;
  }
  if (runs.length === 0) {
    d.out(say.mark("ok", "Coverage ran: nothing it covers changed."));
    return 0;
  }
  const reports = new Map<
    string,
    import("./patch-coverage.mts").FileCoverage
  >();
  for (const run of runs) {
    const path = run.command.report
      ? run.command.report.startsWith("./")
        ? (run.folder === null ? "" : `${run.folder}/`) +
          run.command.report.slice(2)
        : run.command.report
      : "coverage/lcov.info";
    let text: string;
    try {
      text = d.readFile(path);
    } catch {
      d.err(
        say.mark("fail", [
          `No coverage report at ${path}, which `,
          say.copy(commandLine(run)),
          " should have written.",
        ]),
      );
      return 1;
    }
    const from = run.folder === null ? d.root : resolve(d.root, run.folder);
    for (const [file, c] of parseLcov(text, d.root, from)) reports.set(file, c);
  }
  const diff = d.git(["diff", "-U0", "--no-renames", change.base]).out;
  const source = (path: string) => {
    try {
      return d.readFile(path);
    } catch {
      return null;
    }
  };
  const lines = uncovered(reports, changedLines(diff), source);
  for (const line of lines) d.out(say.verbatim(line));
  const files = lines.filter((l) => l.startsWith("=== ")).length;
  const missing = lines.length - files;
  d.out(
    say.mark(
      "ok",
      missing === 0
        ? "Coverage ran: every line the branch changed is covered."
        : `Coverage ran: ${counted(missing, "line")} the branch changed ${missing === 1 ? "is" : "are"} not covered, in ${counted(files, "file")}.`,
    ),
  );
  return 0;
}

/** The command of a list that covers FILE, the folder it runs in, and FILE
 * from that folder; null when none does. */
function coveringRun(
  d: Deps,
  list: Command[],
  file: string,
): { run: Run; file: string } | null {
  for (const command of list) {
    if (!hasPaths(command)) return { run: { command, folder: null }, file };
    for (const run of runsOf(command, d.files(), d.exists)) {
      if (run.folder !== null && !file.startsWith(`${run.folder}/`)) continue;
      if (!matchesAny(file, patternsIn(command, run.folder))) continue;
      return {
        run,
        file: run.folder === null ? file : file.slice(run.folder.length + 1),
      };
    }
  }
  return null;
}

/** `argv` is the command's name, then its arguments. */
export async function main(argv: string[], d: Deps): Promise<number> {
  const [name, ...args] = argv as [Name, ...string[]];
  const usage = () => {
    d.err(say.text(USAGE[name]));
    return 2;
  };
  const e2e = name === "end-to-end" ? endToEndArgs(args) : null;
  const flags = FLAGS[name];
  if (flags) {
    if (args.some((a) => !flags.includes(a)) || args.length > 1) return usage();
  } else if (name === "specs-check" || name === "specs-list") {
    if (args.length > 0) return usage();
  } else if (name === "specs-new" || name === "specs-finish") {
    if (args.length !== 1 || args[0]!.startsWith("-")) return usage();
  } else if (name === "test-one") {
    if (args.length < 1 || args.length > 2) return usage();
    if (args.some((a) => a.startsWith("--"))) return usage();
  } else if (!e2e) return usage();

  let s: Settings;
  try {
    s = await d.settings();
  } catch (e) {
    if (!(e instanceof SettingsError)) throw e;
    d.err(say.text(e.message));
    return 1;
  }
  if (name === "specs-new" || name === "specs-finish")
    try {
      keyOf(s.tickets.type)(args[0]!);
    } catch (e) {
      if (!(e instanceof KeyError)) throw e;
      d.err(say.text(e.message));
      return 1;
    }
  /** The command's own closing line, after the output passed through. */
  const ended = (status: number, passed: string, failed: string) => {
    if (status === 0) d.out(say.mark("ok", passed));
    else d.err(say.mark("fail", failed));
    return status;
  };
  const notSet = (key: string) => {
    d.err(say.text(`commands.${key} is not set`));
    return 1;
  };
  /** The default branch's name, or null when it can't be told. */
  const branchOrNull = async () => {
    try {
      return await d.defaultBranch();
    } catch {
      return null;
    }
  };

  if (name === "gate") {
    if (s.commands.gate.length === 0) {
      d.err(
        say.text(
          `commands.gate is not set: add the commands that check a change to ${SETTINGS_FILE}`,
        ),
      );
      return 1;
    }
    return plannedRun(
      d,
      s,
      s.commands.gate,
      {
        key: "gate",
        failed: "The gate failed",
        noun: "gate",
        since: (remote) => `changed since ${remote}`,
        command: "gate",
      },
      {
        flags: args,
        defaultBranch: await branchOrNull(),
        change: (def) => branchChange(d.git, def),
        everyCommand: true,
      },
    );
  }
  if (name === "relock" || name === "build-setup") {
    const relock = name === "relock";
    return plannedRun(
      d,
      s,
      relock ? s.commands.relock : s.commands.buildSetup,
      {
        key: name,
        failed: relock ? "Relock failed" : "Build setup failed",
        noun: relock ? "relock" : "build-setup",
        since: (remote) => `that differ from ${remote}`,
        command: name,
      },
      {
        flags: args,
        defaultBranch: relock ? await branchOrNull() : null,
        change: (def) => relockChange(d.git, def),
        everyCommand: relock,
        always: !relock,
      },
    );
  }
  if (name === "coverage") return coverage(d, s, args, await branchOrNull());
  if (name === "test-one" || name === "end-to-end") {
    const key = name;
    const list = name === "test-one" ? s.commands.testOne : s.commands.endToEnd;
    if (list.length === 0) return notSet(key);
    const [file, test = ""] = name === "test-one" ? args : [e2e!.file];
    const found = coveringRun(d, list, file!);
    if (!found) {
      d.err(
        say.mark(
          "fail",
          `No commands.${key} command covers ${file}: add one whose files cover it to ${SETTINGS_FILE}`,
        ),
      );
      return 1;
    }
    const { run } = found;
    const cwd = run.folder === null ? d.root : join(d.root, run.folder);
    if (run.folder !== null)
      d.out(
        say.text(
          `commands.${key}: `,
          say.copy(`cd ${run.folder}`),
          `, with FILE=${found.file}`,
        ),
      );
    const env: Record<string, string> =
      name === "test-one"
        ? { FILE: found.file, NAME: test }
        : { FILE: found.file };
    if (name === "test-one")
      return ended(
        d.exec(run.command.run, cwd, env),
        "The test passed.",
        "The test failed.",
      );
    const { times } = e2e!;
    const result = (status: number) =>
      ended(status, "The test passed.", "The test failed.");
    if (times === null) return result(d.exec(run.command.run, cwd, env));
    for (let n = 1; n <= times; n++)
      if (d.exec(run.command.run, cwd, env) !== 0) {
        d.err(say.text(`failed on run ${n} of ${times}`));
        return result(1);
      }
    return result(0);
  }
  const tool = d.specTools[s.specs];
  if (s.specs === "none" || !tool) {
    d.out(say.mark("off", NO_SPEC_TOOL));
    return 0;
  }
  if (name === "specs-check")
    return ended(
      d.exec(s.specCheck!, d.root, tool.env),
      "The specs check passed.",
      "The specs check failed.",
    );
  if (name === "specs-list") {
    const specs = tool.list(d.root);
    d.out(say.text(`specs: ${s.specs}`));
    if (specs.length === 0) d.out(say.text("  none yet"));
    const width = Math.max(0, ...specs.map((x) => x.name.length));
    for (const x of specs) d.out(say.row(x.name, x.path, { width, gap: 2 }));
    return 0;
  }
  const id = args[0]!;
  const failed = (line: string) => {
    d.err(say.mark("fail", line));
    return 1;
  };
  if (name === "specs-finish") {
    if (!tool.started(d.root, id)) {
      if (tool.finished(d.root, id)) {
        d.out(
          say.mark(
            "ok",
            `Ticket ${id}'s spec is already folded into ${tool.foldsInto}.`,
          ),
        );
        return 0;
      }
      return failed(
        `Ticket ${id} has no spec started: run factory specs new ${id} first.`,
      );
    }
    if (tool.finish(d.root, id) !== 0)
      return failed(
        `Could not fold ticket ${id}'s spec into ${tool.foldsInto}.`,
      );
    d.out(say.mark("ok", `Folded ticket ${id}'s spec into ${tool.foldsInto}.`));
    return 0;
  }
  let labels: string[];
  try {
    labels = await d.labels(s, id);
  } catch (e) {
    d.err(say.text(e instanceof Error ? e.message : String(e)));
    return 1;
  }
  if (!tool.runs(d.root))
    return failed(
      `${tool.name} is not installed: run factory init, which installs it.`,
    );
  const folder = tool.folder(id);
  if (tool.started(d.root, id))
    d.out(say.text(`Ticket ${id}'s spec is already started in ${folder}`));
  else {
    if (tool.start(d.root, id) !== 0)
      return failed(`Could not start ticket ${id}'s spec in ${folder}`);
    d.out(say.text(`Started ticket ${id}'s spec in ${folder}`));
  }
  const files = tool.files(id, labels.includes(s.tickets.labels.spec));
  const width = Math.max(...files.map((f) => f.path.length)) + 2;
  const kinds = Math.max(...files.map((f) => f.kind.length));
  d.out(say.text(`Write each file from ticket ${id}'s body:`));
  for (const f of files)
    d.out(
      say.row(f.kind, `${f.path.padEnd(width)}${f.what}`, {
        width: kinds,
        gap: 2,
      }),
    );
  d.out(say.text(`Then: ${tool.then}`));
  return 0;
}

export const NO_SPEC_TOOL =
  "No spec tool (specs: none): each ticket holds its own spec.";

/** `factory gate`, `factory test-one`, `factory end-to-end`,
 * and `factory specs check`, `list`, `new`, and `finish`, as `specs-check`
 * and the rest. */
export async function run(argv: string[]): Promise<number> {
  const root = repoRoot();
  return main(argv, {
    root,
    settings: () => loadSettings(defaultDeps(root)),
    exec: (command, cwd, env) =>
      spawnSync("bash", ["-c", command], {
        cwd,
        // npm 11 prints a notice line for every script and npx it runs.
        env: { npm_config_loglevel: "warn", ...process.env, ...env },
        stdio: ["ignore", "inherit", "inherit"],
      }).status ?? 1,
    ...say.printersFor(argv[0]!.replace(/^specs-/, "specs ")),
    specTools: specTools(),
    labels: async (settings, id) => {
      const { tickets } = await openTickets(settings, {
        repository: settings.repository,
        board: null,
      });
      return (await tickets.read(tickets.key(id))).labels;
    },
    git: gitIn(root),
    defaultBranch: () => needDefaultBranch(branchDeps(root)),
    files: () => {
      const r = gitIn(root)([
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
      ]);
      return r.out.split("\n").filter(Boolean);
    },
    exists: (path) => existsSync(join(root, path)),
    readFile: (path) => readFileSync(join(root, path), "utf8"),
  });
}
