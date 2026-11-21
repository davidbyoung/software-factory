// The commands that run what the settings name, so a skill says what to
// run and the repository's settings say how:
//
//   factory gate                          # commands.gate, in order
//   factory test-one FILE [NAME]          # commands.test-one, one test alone
//   factory end-to-end FILE [--times K]   # commands.end-to-end, K times in a row
//   factory specs check                   # specs.check
//
// Each command runs with bash from the repository's root, with its output
// passed through and no standard input. `test-one` gets FILE and NAME in its
// environment, `end-to-end` FILE, and the spec check DO_NOT_TRACK=1. An
// argument a command does not know prints its usage and exits 2.
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
};

const USAGE = {
  gate: "Usage: factory gate",
  "test-one": "Usage: factory test-one FILE [NAME]",
  "end-to-end": "Usage: factory end-to-end FILE [--times K]",
  "specs-check": "Usage: factory specs check",
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
  if (name === "gate" || name === "specs-check") {
    if (args.length > 0) return usage();
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
  if (s.specCheck === null) {
    d.out("specs are off");
    return 0;
  }
  return ended(
    d.exec(s.specCheck, d.root, { DO_NOT_TRACK: "1" }),
    "The specs check passed.",
    "The specs check failed.",
  );
}

/** `factory gate`, `factory test-one`, `factory end-to-end`, and
 * `factory specs check`, the last as `specs-check`. */
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
  });
}
