// The `factory` command: reads the command and loads only that command's
// module, so a hook that runs before every shell command loads one file
// and what it imports, not the whole tool.
//
//   factory COMMAND [ARGS]
//
// An unknown command, or none, prints the usage and exits 2.

type Run = (argv: string[]) => Promise<number | void>;

/** A command: the words that name it, what it takes, and how it runs. */
type Command = {
  words: string[];
  args: string;
  run: Run;
};

const TICKET_STEPS = [
  "refining",
  "waiting",
  "refined",
  "ready",
  "claim",
  "still-live",
  "stop",
  "end",
  "cost",
  "view",
  "list",
  "edit",
  "comment",
  "open",
  "label",
  "link",
  "blockers",
  "block",
  "unblock",
  "supports",
];
const PR_STEPS = [
  "state",
  "threads",
  "reply",
  "resolve",
  "ready",
  "closes",
  "comments",
  "comment",
  "comment-view",
  "label",
  "review-pending",
  "conflicts",
  "open",
  "view",
  "review",
  "unverified",
  "uncovered",
  "failed",
  "review-again",
];

const ticket = (sub: string, args: string): Command => ({
  words: ["ticket", sub],
  args,
  run: async (argv) => (await import("./ticket.mts")).run([sub, ...argv]),
});
const pr = (sub: string, args: string): Command => ({
  words: ["pr", sub],
  args,
  run: async (argv) => (await import("./pr.mts")).run([sub, ...argv]),
});

const TICKET_ARGS: Record<string, string> = {
  refined: "N [--check] [--before-file FILE]",
  stop: 'N "reason"',
  view: "N [--field title|state|labels|body] [--json]",
  list: '[--label LABEL] [--title "TITLE"] [--json]',
  edit: "N --body-file FILE [--attach FILE]",
  comment: "N --body-file FILE [--attach FILE]",
  open: "--title TITLE --body-file FILE [--label LABEL]",
  label: "N --add LABEL | --remove LABEL | --was-removed LABEL",
  block: "N --by M",
  unblock: "N --by M",
  supports: "GROUP",
};
const PR_ARGS: Record<string, string> = {
  state: "[N] [--wait]",
  threads: "N [--all]",
  open: "--title TITLE --body-file FILE [--base BRANCH] [--ready]",
  view: "N --field FIELD",
  review: "N REVIEW",
  reply: "N COMMENT --body-file FILE",
  resolve: "N COMMENT",
  comments: "N [--author LOGIN] [--contains TEXT] [--json]",
  comment: "N --body-file FILE",
  "comment-view": "ID",
  label: "N --add LABEL | --remove LABEL",
  "review-pending": "N REVIEW",
  conflicts: "",
  uncovered: "[BASE] [LCOV]",
};

export const COMMANDS: Command[] = [
  ...TICKET_STEPS.map((s) => ticket(s, TICKET_ARGS[s] ?? "N")),
  {
    words: ["follow-up"],
    args: 'FILE "what is wrong"',
    run: async (argv) =>
      (await import("./ticket.mts")).run(["follow-up", ...argv]),
  },
  ...PR_STEPS.map((s) => pr(s, PR_ARGS[s] ?? "N")),
  pr("wait-checks", "N"),
  {
    words: ["pr", "watch"],
    args: "N [--release]",
    run: async (argv) => (await import("./pr-watch.mts")).run(argv),
  },
  {
    words: ["build"],
    args: "N",
    run: async (argv) => (await import("./build.mts")).run(argv),
  },
  {
    words: ["deps"],
    args: "[--any]",
    run: async (argv) => (await import("./deps.mts")).run(argv),
  },
  {
    words: ["status"],
    args: "[--watch]",
    run: async (argv) => (await import("./status.mts")).run(argv),
  },
  {
    words: ["session-start"],
    args: "",
    run: async () => (await import("./session-start.mts")).run(),
  },
  {
    words: ["sync"],
    args: "[--check]",
    run: async (argv) => (await import("./sync.mts")).run(argv),
  },
  {
    words: ["init"],
    args: "",
    run: async (argv) => (await import("./init.mts")).run(argv),
  },
  {
    words: ["doctor"],
    args: "",
    run: async (argv) => (await import("./doctor.mts")).run(argv),
  },
  {
    words: ["remove"],
    args: "",
    run: async (argv) => (await import("./remove.mts")).run(argv),
  },
  {
    words: ["config", "get"],
    args: "KEY",
    run: async (argv) => (await import("./config.mts")).run(argv.slice(0, 1)),
  },
  {
    words: ["site", "compare"],
    args: "[--before URL --after URL] [--base REF] [--keep]",
    run: async (argv) => (await import("./site.mts")).run(["compare", ...argv]),
  },
  {
    words: ["site", "stop"],
    args: "",
    run: async () => (await import("./site.mts")).run(["stop"]),
  },
  {
    words: ["config", "check"],
    args: "",
    run: async () => (await import("./config.mts")).run(["check"]),
  },
  {
    words: ["config", "explain"],
    args: "",
    run: async () => (await import("./config.mts")).run(["explain"]),
  },
  {
    words: ["plugins"],
    args: "[SLOT]",
    run: async (argv) =>
      (await import("./config.mts")).run(["plugins", ...argv]),
  },
  {
    words: ["gate"],
    args: "",
    run: async (argv) =>
      (await import("./commands.mts")).run(["gate", ...argv]),
  },
  {
    words: ["test-one"],
    args: "FILE [NAME]",
    run: async (argv) =>
      (await import("./commands.mts")).run(["test-one", ...argv]),
  },
  {
    words: ["end-to-end"],
    args: "FILE [--times K]",
    run: async (argv) =>
      (await import("./commands.mts")).run(["end-to-end", ...argv]),
  },
  {
    words: ["specs", "check"],
    args: "",
    run: async (argv) =>
      (await import("./commands.mts")).run(["specs-check", ...argv]),
  },
  {
    words: ["default-branch"],
    args: "",
    run: async (argv) => (await import("./lib/default-branch.mts")).run(argv),
  },
  {
    words: ["board", "collect"],
    args: "--out FILE [--event FILE --event-name NAME]",
    run: async (argv) =>
      (await import("./board.mts")).run(["collect", ...argv]),
  },
  {
    words: ["board", "apply"],
    args: "--in FILE",
    run: async (argv) => (await import("./board.mts")).run(["apply", ...argv]),
  },
  {
    words: ["board", "check"],
    args: "",
    run: async (argv) => (await import("./board.mts")).run(["check", ...argv]),
  },
  {
    words: ["board"],
    args: "--dry-run",
    run: async (argv) => (await import("./board.mts")).run(argv),
  },
  {
    words: ["poller"],
    args: "[--once]",
    run: async (argv) => (await import("./poller.mts")).run(argv),
  },
  {
    words: ["merge-policy"],
    args: "N",
    run: async (argv) => (await import("./merge-policy.mts")).run(argv),
  },
  {
    words: ["review", "verdict"],
    args: "",
    run: async () => (await import("./review-verdict.mts")).run(),
  },
  {
    words: ["review", "cost"],
    args: "",
    run: async () => (await import("./review-cost.mts")).run(),
  },
  {
    words: ["review", "tools"],
    args: "",
    run: async () => (await import("./review-tools.mts")).run(),
  },
  {
    words: ["reviewers", "start"],
    args: "",
    run: async () => (await import("./reviewers.mts")).run(["start"]),
  },
  {
    words: ["reviewers", "stop"],
    args: "",
    run: async () => (await import("./reviewers.mts")).run(["stop"]),
  },
  {
    words: ["guard"],
    args: "",
    run: async () => (await import("./guard.mts")).run("all"),
  },
  {
    words: ["guard", "commit"],
    args: "",
    run: async () => (await import("./guard.mts")).run("commit"),
  },
  {
    words: ["guard", "permission"],
    args: "",
    run: async () => (await import("./guard-permission.mts")).run(),
  },
  {
    words: ["guard", "ticket-text"],
    args: "",
    run: async () => (await import("./guard.mts")).run("ticket-text"),
  },
];

export function usage(): string {
  const width = Math.max(
    ...COMMANDS.map((c) => c.words.join(" ").length + 1 + c.args.length),
  );
  return [
    "Usage: factory COMMAND [ARGS]",
    "",
    "Commands:",
    ...COMMANDS.map(
      (c) => `  factory ${`${c.words.join(" ")} ${c.args}`.padEnd(width)}`,
    ).map((line) => line.trimEnd()),
  ].join("\n");
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
    console.error(usage());
    return 2;
  }
  return (await found.command.run(found.rest)) ?? 0;
}

process.exitCode = await main(process.argv.slice(2));
