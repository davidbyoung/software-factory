// The commands that run what the settings name, so a skill says what to
// run and the repository's settings say how:
//
//   factory gate                          # commands.gate, in order
//   factory test-one FILE [NAME]          # commands.test-one, one test alone
//   factory end-to-end FILE [--times K]   # commands.end-to-end, K times in a row
//   factory specs check                   # specs.check
//
// and the commands that reach the spec tool `specs` names:
//
//   factory specs list                    # each spec it keeps
//   factory specs new N                   # start ticket N's spec
//   factory specs finish N                # fold ticket N's spec in
//
// Each command runs with bash from the repository's root, with its output
// passed through and no standard input. `test-one` gets FILE and NAME in its
// environment, `end-to-end` FILE, and the spec check the spec tool's
// environment. An argument a command does not know prints its usage and
// exits 2.
import { spawnSync } from "node:child_process";
import { colorOn, painter, plain, type Paint } from "./lib/color.mts";
import {
  defaultDeps,
  loadSettings,
  repoRoot,
  SETTINGS_FILE,
  SettingsError,
  type Settings,
} from "./config.mts";
import { specTools, type SpecTools } from "./specs/index.mts";
import { keyOf, openTickets } from "./tickets/index.mts";
import { KeyError } from "./tickets/types.mts";

export type Deps = {
  /** The repository's root, where every command runs. */
  root: string;
  settings: () => Promise<Settings>;
  /** Runs one settings command from `cwd` with `env` added to the
   * environment, and returns its exit status. */
  exec: (command: string, cwd: string, env: Record<string, string>) => number;
  out: (line: string) => void;
  err: (line: string) => void;
  paint?: Paint;
  specTools: SpecTools;
  /** Ticket `id`'s labels; throws when it can't be read. */
  labels: (settings: Settings, id: string) => Promise<string[]>;
};

const USAGE = {
  gate: "Usage: factory gate",
  "test-one": "Usage: factory test-one FILE [NAME]",
  "end-to-end": "Usage: factory end-to-end FILE [--times K]",
  "specs-check": "Usage: factory specs check",
  "specs-list": "Usage: factory specs list",
  "specs-new": "Usage: factory specs new N",
  "specs-finish": "Usage: factory specs finish N",
} as const;

type Name = keyof typeof USAGE;

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

/** `argv` is the command's name, then its arguments. */
export async function main(argv: string[], d: Deps): Promise<number> {
  const [name, ...args] = argv as [Name, ...string[]];
  const usage = () => {
    d.err(USAGE[name]);
    return 2;
  };
  const e2e = name === "end-to-end" ? endToEndArgs(args) : null;
  if (name === "gate" || name === "specs-check" || name === "specs-list") {
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
    d.err(e.message);
    return 1;
  }
  if (name === "specs-new" || name === "specs-finish")
    try {
      keyOf(s.tickets.type)(args[0]!);
    } catch (e) {
      if (!(e instanceof KeyError)) throw e;
      d.err(e.message);
      return 1;
    }
  const paint = d.paint ?? plain;
  /** The command's own closing line, after the output passed through. */
  const ended = (status: number, passed: string, failed: string) => {
    if (status === 0) d.out(`${paint("green", "✓")} ${passed}`);
    else d.err(`${paint("red", "✗")} ${failed}`);
    return status;
  };
  const notSet = (key: string) => {
    d.err(`commands.${key} is not set`);
    return 1;
  };

  if (name === "gate") {
    if (s.commands.gate.length === 0) {
      d.err(
        `commands.gate is not set: add the commands that check a change to ${SETTINGS_FILE}`,
      );
      return 1;
    }
    for (const command of s.commands.gate) {
      d.out(`$ ${command}`);
      if (d.exec(command, d.root, {}) !== 0)
        return ended(1, "", `The gate failed on: ${command}`);
    }
    return ended(0, "Every gate command passed.", "");
  }
  if (name === "test-one") {
    if (s.commands.testOne === null) return notSet("test-one");
    const [file, test = ""] = args;
    return ended(
      d.exec(s.commands.testOne, d.root, { FILE: file, NAME: test }),
      "The test passed.",
      "The test failed.",
    );
  }
  if (name === "end-to-end") {
    const { file, times } = e2e!;
    const command = s.commands.endToEnd;
    if (command === null) return notSet("end-to-end");
    const test = (status: number) =>
      ended(status, "The test passed.", "The test failed.");
    if (times === null) return test(d.exec(command, d.root, { FILE: file }));
    for (let run = 1; run <= times; run++)
      if (d.exec(command, d.root, { FILE: file }) !== 0) {
        d.err(`failed on run ${run} of ${times}`);
        return test(1);
      }
    return test(0);
  }
  const tool = d.specTools[s.specs];
  if (s.specs === "none" || !tool) {
    d.out(`${paint("dim", "-")} ${NO_SPEC_TOOL}`);
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
    d.out(`specs: ${s.specs}`);
    if (specs.length === 0) d.out("  none yet");
    const width = Math.max(0, ...specs.map((x) => x.name.length));
    for (const x of specs) d.out(`  ${x.name.padEnd(width)}  ${x.path}`);
    return 0;
  }
  const id = args[0]!;
  const failed = (line: string) => {
    d.err(`${paint("red", "✗")} ${line}`);
    return 1;
  };
  if (name === "specs-finish") {
    if (!tool.started(d.root, id)) {
      if (tool.finished(d.root, id)) {
        d.out(
          `${paint("green", "✓")} Ticket ${id}'s spec is already folded into ${tool.foldsInto}.`,
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
    d.out(
      `${paint("green", "✓")} Folded ticket ${id}'s spec into ${tool.foldsInto}.`,
    );
    return 0;
  }
  let labels: string[];
  try {
    labels = await d.labels(s, id);
  } catch (e) {
    d.err(e instanceof Error ? e.message : String(e));
    return 1;
  }
  if (!tool.runs(d.root))
    return failed(
      `${tool.name} is not installed: run factory init, which installs it.`,
    );
  const folder = tool.folder(id);
  if (tool.started(d.root, id))
    d.out(`Ticket ${id}'s spec is already started in ${folder}`);
  else {
    if (tool.start(d.root, id) !== 0)
      return failed(`Could not start ticket ${id}'s spec in ${folder}`);
    d.out(`Started ticket ${id}'s spec in ${folder}`);
  }
  const files = tool.files(id, labels.includes(s.tickets.labels.spec));
  const width = Math.max(...files.map((f) => f.path.length)) + 2;
  const kinds = Math.max(...files.map((f) => f.kind.length));
  d.out(`Write each file from ticket ${id}'s body:`);
  for (const f of files)
    d.out(`  ${f.kind.padEnd(kinds)}  ${f.path.padEnd(width)}${f.what}`);
  d.out(`Then: ${tool.then}`);
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
    out: (line) => console.log(line),
    err: (line) => console.error(line),
    paint: painter(colorOn()),
    specTools: specTools(),
    labels: async (settings, id) => {
      const { tickets } = await openTickets(settings, {
        repository: settings.repository,
        board: null,
      });
      return (await tickets.read(tickets.key(id))).labels;
    },
  });
}
