// Every command the factory has, and how each one's module is loaded: only
// when it runs, so a hook that runs before every shell command loads one
// file and what it imports, not the whole tool.

type Run = (argv: string[]) => Promise<number | void>;

/** A command: the words that name it, what it takes, and how it runs. */
export type Command = {
  words: string[];
  args: string;
  /** Who reads what it prints. A machine's is never colored: a skill or a
   * workflow takes it as it is. */
  reads: "person" | "machine";
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
  "adopt",
  "view",
  "answers",
  "list",
  "edit",
  "comment",
  "open",
  "label",
  "link",
  "branch",
  "repositories",
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
  "cost",
  "adopt",
  "for-branch",
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
  "push",
  "pull",
];

const ticket = (sub: string, args: string): Command => ({
  words: ["ticket", sub],
  args,
  reads: "machine",
  run: async (argv) => (await import("./ticket.mts")).run([sub, ...argv]),
});
const pr = (sub: string, args: string): Command => ({
  words: ["pr", sub],
  args,
  reads: "machine",
  run: async (argv) => (await import("./pr.mts")).run([sub, ...argv]),
});

const TICKET_ARGS: Record<string, string> = {
  refined: "N [--check] [--before-file FILE]",
  stop: 'N "reason"',
  view: "N [--field title|state|labels|body|ref] [--json]",
  link: "N [--part]",
  list: '[--label LABEL] [--title "TITLE"] [--json]',
  edit: "N --body-file FILE [--attach FILE]",
  comment: "N --body-file FILE [--attach FILE]",
  open: "--title TITLE --body-file FILE [--label LABEL]",
  label: "N --add LABEL | --remove LABEL | --was-removed LABEL",
  repositories: "N [--set REPO...|--add REPO...] [--after LATER=EARLIER]",
  block: "N --by M",
  unblock: "N --by M",
  supports: "GROUP",
};
const PR_ARGS: Record<string, string> = {
  state: "[N] [--wait]",
  threads: "N [--all]",
  open: "--title TITLE --body-file FILE [--base BRANCH] [--ready|--draft]",
  view: "N --field FIELD",
  review: "N REVIEW",
  reply: "N COMMENT --body-file FILE",
  resolve: "N COMMENT",
  comments: "N [--author LOGIN] [--contains TEXT] [--from-approvers] [--json]",
  comment: "N --body-file FILE",
  "comment-view": "ID",
  label: "N --add LABEL | --remove LABEL",
  "review-pending": "N REVIEW",
  conflicts: "",
  push: "",
  pull: "",
  "for-branch": "BRANCH",
  uncovered: "[BASE] [LCOV]",
};

export const COMMANDS: Command[] = [
  ...TICKET_STEPS.map((s) => ticket(s, TICKET_ARGS[s] ?? "N")),
  {
    words: ["follow-up"],
    args: '"TITLE" "WHAT IS WRONG"',
    reads: "machine",
    run: async (argv) => (await import("./follow-ups.mts")).run(argv),
  },
  ...PR_STEPS.map((s) => pr(s, PR_ARGS[s] ?? "N")),
  pr("wait-checks", "N"),
  {
    words: ["pr", "follow-ups"],
    args: "--event FILE",
    reads: "machine",
    run: async (argv) => (await import("./follow-ups.mts")).runOpen(argv),
  },
  {
    words: ["pr", "watch"],
    args: "N [--release]",
    reads: "person",
    run: async (argv) => (await import("./pr-watch.mts")).run(argv),
  },
  {
    words: ["build"],
    args: "N",
    reads: "person",
    run: async (argv) => (await import("./build.mts")).run(argv),
  },
  {
    words: ["workspace"],
    args: "N [--remove]",
    reads: "machine",
    run: async (argv) => (await import("./workspace.mts")).run(argv),
  },
  {
    words: ["deps"],
    args: "[--any]",
    reads: "machine",
    run: async (argv) => (await import("./deps.mts")).run(argv),
  },
  {
    words: ["status"],
    args: "[--watch]",
    reads: "person",
    run: async (argv) => (await import("./status.mts")).run(argv),
  },
  {
    words: ["session-start"],
    args: "",
    reads: "machine",
    run: async () => (await import("./session-start.mts")).run(),
  },
  {
    words: ["sync"],
    args: "[--check]",
    reads: "person",
    run: async (argv) => (await import("./sync.mts")).run(argv),
  },
  {
    words: ["update"],
    args: "[--pull-requests]",
    reads: "person",
    run: async (argv) => (await import("./update.mts")).run(argv),
  },
  {
    words: ["init"],
    args: "[--preset NAME]... [--org ADDRESS]",
    reads: "person",
    run: async (argv) => (await import("./init.mts")).run(argv),
  },
  {
    words: ["doctor"],
    args: "",
    reads: "person",
    run: async (argv) => (await import("./doctor.mts")).run(argv),
  },
  {
    words: ["remove"],
    args: "",
    reads: "person",
    run: async (argv) => (await import("./remove.mts")).run(argv),
  },
  ...(
    [
      ["add", "NAME [--yes] [--dry-run]"],
      ["remove", "NAME [--yes] [--dry-run]"],
      ["choices", ""],
      ["choose", "KEY PRESET"],
      ["check", ""],
      ["changes", "REF"],
    ] as const
  ).map(([sub, args]): Command => ({
    words: ["preset", sub],
    args,
    reads: sub === "changes" ? "machine" : "person",
    run: async (argv) =>
      (await import("./preset-commands.mts")).run([sub, ...argv]),
  })),
  {
    words: ["config", "get"],
    args: "KEY",
    reads: "machine",
    run: async (argv) => (await import("./config.mts")).run(argv.slice(0, 1)),
  },
  {
    words: ["site", "compare"],
    args: "[--before URL --after URL] [--base REF] [--keep]",
    reads: "person",
    run: async (argv) => (await import("./site.mts")).run(["compare", ...argv]),
  },
  {
    words: ["site", "stop"],
    args: "",
    reads: "person",
    run: async () => (await import("./site.mts")).run(["stop"]),
  },
  {
    words: ["config", "check"],
    args: "",
    reads: "person",
    run: async () => (await import("./config.mts")).run(["check"]),
  },
  {
    words: ["config", "explain"],
    args: "",
    reads: "person",
    run: async () => (await import("./config.mts")).run(["explain"]),
  },
  {
    words: ["plugins"],
    args: "[ROLE]",
    reads: "machine",
    run: async (argv) =>
      (await import("./config.mts")).run(["plugins", ...argv]),
  },
  {
    words: ["gate"],
    args: "",
    reads: "person",
    run: async (argv) =>
      (await import("./commands.mts")).run(["gate", ...argv]),
  },
  {
    words: ["test-one"],
    args: "FILE [NAME]",
    reads: "person",
    run: async (argv) =>
      (await import("./commands.mts")).run(["test-one", ...argv]),
  },
  {
    words: ["end-to-end"],
    args: "FILE [--times K]",
    reads: "person",
    run: async (argv) =>
      (await import("./commands.mts")).run(["end-to-end", ...argv]),
  },
  {
    words: ["specs", "check"],
    args: "",
    reads: "person",
    run: async (argv) =>
      (await import("./commands.mts")).run(["specs-check", ...argv]),
  },
  {
    words: ["specs", "list"],
    args: "",
    reads: "machine",
    run: async (argv) =>
      (await import("./commands.mts")).run(["specs-list", ...argv]),
  },
  {
    words: ["specs", "new"],
    args: "N",
    reads: "machine",
    run: async (argv) =>
      (await import("./commands.mts")).run(["specs-new", ...argv]),
  },
  {
    words: ["specs", "finish"],
    args: "N",
    reads: "person",
    run: async (argv) =>
      (await import("./commands.mts")).run(["specs-finish", ...argv]),
  },
  {
    words: ["default-branch"],
    args: "",
    reads: "machine",
    run: async (argv) => (await import("./lib/default-branch.mts")).run(argv),
  },
  {
    words: ["board", "collect"],
    args: "--out FILE [--event FILE --event-name NAME]",
    reads: "machine",
    run: async (argv) =>
      (await import("./board.mts")).run(["collect", ...argv]),
  },
  {
    words: ["board", "apply"],
    args: "--in FILE",
    reads: "machine",
    run: async (argv) => (await import("./board.mts")).run(["apply", ...argv]),
  },
  {
    words: ["board", "check"],
    args: "",
    reads: "person",
    run: async (argv) => (await import("./board.mts")).run(["check", ...argv]),
  },
  {
    words: ["board"],
    args: "--dry-run",
    reads: "machine",
    run: async (argv) => (await import("./board.mts")).run(argv),
  },
  {
    words: ["poller"],
    args: "[--once [--preset FILE]]",
    reads: "machine",
    run: async (argv) => (await import("./poller.mts")).run(argv),
  },
  {
    words: ["merge-policy"],
    args: "N",
    reads: "machine",
    run: async (argv) => (await import("./merge-policy.mts")).run(argv),
  },
  {
    words: ["across"],
    args: "--event FILE",
    reads: "machine",
    run: async (argv) => (await import("./across-run.mts")).run(argv),
  },
  {
    words: ["review", "verdict"],
    args: "[--pr N]",
    reads: "machine",
    run: async (argv) => (await import("./review-verdict.mts")).run(argv),
  },
  {
    words: ["session", "ready"],
    args: "build|conflicts|deps|review [PR REVIEW]",
    reads: "machine",
    run: async (argv) =>
      (await import("./session.mts")).run(["ready", ...argv]),
  },
  ...["prepare", "run", "publish", "next", "each"].map((step): Command => ({
    words: ["session", step],
    args: "",
    reads: "machine",
    run: async (argv) => (await import("./session.mts")).run([step, ...argv]),
  })),
  {
    words: ["session", "repositories"],
    args: "",
    reads: "machine",
    run: async () => (await import("./session.mts")).run(["repositories"]),
  },
  {
    words: ["session", "token"],
    args: "[--keep]",
    reads: "machine",
    run: async (argv) =>
      (await import("./session.mts")).run(["token", ...argv]),
  },
  {
    words: ["enroll"],
    args: "",
    reads: "machine",
    run: async () => (await import("./enroll.mts")).run(),
  },
  {
    words: ["reviewers", "start"],
    args: "",
    reads: "machine",
    run: async () => (await import("./reviewers.mts")).run(["start"]),
  },
  {
    words: ["reviewers", "stop"],
    args: "",
    reads: "machine",
    run: async () => (await import("./reviewers.mts")).run(["stop"]),
  },
  {
    words: ["guard"],
    args: "",
    reads: "machine",
    run: async () => (await import("./guard.mts")).run("all"),
  },
  {
    words: ["guard", "commit"],
    args: "",
    reads: "machine",
    run: async () => (await import("./guard.mts")).run("commit"),
  },
  {
    words: ["guard", "permission"],
    args: "",
    reads: "machine",
    run: async () => (await import("./guard-permission.mts")).run(),
  },
  {
    words: ["guard", "ticket-text"],
    args: "",
    reads: "machine",
    run: async () => (await import("./guard.mts")).run("ticket-text"),
  },
  {
    words: ["guard", "credentials"],
    args: "",
    reads: "machine",
    run: async () => (await import("./guard.mts")).run("credentials"),
  },
];
