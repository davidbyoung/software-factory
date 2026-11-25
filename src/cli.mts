// The `factory` command: reads the command and loads only that command's
// module, so a hook that runs before every shell command loads one file
// and what it imports, not the whole tool.
//
//   factory COMMAND [ARGS]
//
// An unknown command, or none, prints the commands a person runs and exits 2.

import { COMMANDS, type Command } from "./commands-list.mts";
import * as say from "./lib/output.mts";

/** The commands a person runs, in the groups and words of docs/cli.md. */
const USAGE: [string, [string, string][]][] = [
  [
    "Setting up",
    [
      ["init", "Set a repository up, or turn a part on or off"],
      [
        "sync [--check]",
        "Write the factory's files from your settings, or check they match",
      ],
      ["config check", "Check your settings"],
      ["board check", "See how the factory reads your board"],
      ["doctor", "Check everything, when something seems off"],
    ],
  ],
  [
    "Every day",
    [
      ["status [--watch]", "Each ticket's state and which session is on it"],
      ["build N", "Build ticket N in the cloud"],
      ["pr watch N", "Wait until pull request N needs you"],
    ],
  ],
  [
    "Now and then",
    [
      ["config get KEY", "Print one setting in effect"],
      ["config explain", "Print every setting in effect, defaults included"],
      ["plugins [ROLE]", "List the plugins the factory uses, by role"],
      ["site compare", "Picture a website's pages before and after a change"],
      ["site stop", "End the sites compare --keep left running"],
      [
        "update",
        "Raise the factory and each preset to its newest, without waiting for the job",
      ],
      ["remove", "Take the factory out of this repository"],
    ],
  ],
  [
    "Presets",
    [
      ["preset add NAME", "Follow a preset"],
      ["preset remove NAME", "Stop following one"],
      ["preset choices", "See where two presets disagree, and choose"],
      [
        "preset choose KEY PRESET",
        "Record one of those choices without questions",
      ],
      ["preset check", "Check a preset's own repository before releasing it"],
      ["preset changes REF", "See what a preset update changed since REF"],
    ],
  ],
  [
    "Your repository's commands",
    [
      ["gate", "Run the commands under commands.gate"],
      ["test-one FILE [NAME]", "Run one test file, or one test in it"],
      ["end-to-end FILE", "Run one end-to-end spec"],
      ["specs list", "List the specs your spec tool keeps"],
      ["specs new N", "Start ticket N's spec"],
      ["specs check", "Check your written specs"],
      ["specs finish N", "Fold ticket N's spec into your specs"],
      ["default-branch", "Print the default branch's name"],
    ],
  ],
];
const NAME_WIDTH = 21;

export function usage(): say.Line[] {
  const lines = [say.text("Usage: ", say.copy("factory COMMAND"))];
  for (const [group, commands] of USAGE) {
    lines.push(say.BLANK, say.heading(group));
    for (const [name, summary] of commands)
      lines.push(
        ...(name.length < NAME_WIDTH
          ? [
              say.row(name, summary, {
                width: NAME_WIDTH,
                gap: 0,
                typed: true,
              }),
            ]
          : [
              say.text("  ", say.copy(name)),
              say.text(`  ${" ".repeat(NAME_WIDTH)}`, say.asIs(summary)),
            ]),
      );
  }
  lines.push(
    say.BLANK,
    say.text(
      'The commands skills, hooks, and workflows run are under "Run for you" in docs/cli.md.',
    ),
  );
  return lines;
}

/** The command `argv` names, the longest match first, with the arguments
 * left after its words; null when none matches. */
export function resolveCommand(
  argv: string[],
): { command: Command; rest: string[] } | null {
  let best: Command | null = null;
  for (const c of COMMANDS) {
    if (c.words.every((w, i) => argv[i] === w)) {
      if (!best || c.words.length > best.words.length) best = c;
    }
  }
  return best ? { command: best, rest: argv.slice(best.words.length) } : null;
}

export async function main(argv: string[]): Promise<number> {
  const found = resolveCommand(argv);
  // `guard` alone runs both guards, but `guard WORD` with a word that is
  // not a guard is a mistake, not a request for both.
  if (!found || (found.command.words.join(" ") === "guard" && found.rest[0])) {
    const asked = argv.length > 0 && argv[0] !== "--help" && argv[0] !== "-h";
    const err = say.printer(process.stderr);
    if (asked) {
      err(say.text(say.asIs(`factory has no command "${argv.join(" ")}".`)));
      err(say.BLANK);
    }
    for (const line of usage()) err(line);
    return 2;
  }
  try {
    if (process.env.FACTORY_HANDOFF) {
      const { handoffIn, intercept } = await import("./handoff/index.mts");
      const h = handoffIn()!;
      const fault =
        argv[0] === "follow-up" || (argv[0] === "pr" && argv[1] === "open")
          ? await (await import("./handoff/links.mts")).sessionFault(h.run())
          : undefined;
      const code = intercept(argv, h, say.plainPrinter(), undefined, fault);
      if (code !== null) return code;
    }
    return (await found.command.run(found.rest)) ?? 0;
  } catch (e) {
    // A ticket system's credential to fix is one line, with no stack.
    if (e instanceof Error && e.name === "CredentialError") {
      say.printersFor(found.command.words.join(" ")).err(say.text(e.message));
      return 1;
    }
    throw e;
  }
}

process.exitCode = await main(process.argv.slice(2));
