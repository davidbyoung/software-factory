// The two workflow files `factory sync` writes into a repository. Each has
// one job, which calls a workflow in the factory's own repository at the
// version the repository's lock names, so a release changes one line of
// each. They hold only what the repository decides: its default branch,
// which parts are on, the poller's schedule, and the names of its secrets.
//
//   .github/workflows/factory.yml          everything judged from the
//                                          default branch's copy (run.yml)
//   .github/workflows/factory-review.yml   what reads a pull request's own
//                                          code (review.yml)
//
// There are two because GitHub runs a `pull_request` workflow from the pull
// request's copy, and what decides a merge must run from the default
// branch's.
import { SESSION_MINUTES, type SessionKind } from "./config.mts";
import { PR_LABELS } from "./labels.mts";

export const FACTORY_FILE = ".github/workflows/factory.yml";
export const REVIEW_FILE = ".github/workflows/factory-review.yml";

/** Every event factory.yml starts on. A code host's policy for the file
 * lists them all, since such a policy lets through only what it lists. */
export const FACTORY_EVENTS = [
  "pull_request_target",
  "pull_request_review",
  "workflow_run",
  "push",
  "schedule",
  "workflow_dispatch",
];
/** The one of them a code host may hold back in a repository anyone can
 * read, since it runs with the repository's secrets. */
export const HELD_EVENT = "pull_request_target";

/** Where the factory's own workflows are, for a repository that calls them. */
const HOME = "davidbyoung/software-factory/.github/workflows";

/** The schedules run.yml tells apart by their text. Any other line of the
 * file is the poller's. */
const SCHEDULES: [string, string][] = [
  ["0 1,13,19 * * *", "Dependabot's pull requests, and updates"],
  ["0 7 * * *", "the board sync"],
  ["0 9 * * *", "the conflict sweep"],
];

/** What a pull request does that some job of run.yml starts on. */
const TARGET_ACTIONS = [
  "opened",
  "reopened",
  "synchronize",
  "ready_for_review",
  "converted_to_draft",
  "closed",
  "labeled",
  "unlabeled",
];

/** The parts a job of run.yml or review.yml is skipped without. */
export type Part = "review" | "board" | "auto-merge" | "poller" | "dependabot";

export type WorkflowOptions = {
  /** The factory's version, or null in the factory's own repository, whose
   * files call the copies in the same commit. */
  version: string | null;
  /** The default branch, which a push trigger cannot ask for. */
  branch: string;
  parts: Part[];
  /** How often the poller's pass runs, or null when it runs elsewhere. */
  pollMinutes: number | null;
  /** How the ticket system writes a ticket, such as `#12`, for the name
   * `factory build` finds its run by. */
  ref: (key: string) => string;
  minutes: Record<SessionKind, number>;
  /** The override label's name, as `code-host.labels` gives it. */
  overrideLabel: string;
  /** The secrets the repository's `.npmrc` and ticket system read. */
  secrets: string[];
};

const uses = (o: WorkflowOptions, file: string) =>
  o.version === null
    ? `./.github/workflows/${file}`
    : `${HOME}/${file}@v${o.version}`;

/** Text as YAML reads it back: plain where that is safe, quoted otherwise. */
const scalar = (text: string) =>
  /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(text) ? text : JSON.stringify(text);

/** The poller's schedule: on the hour for 60, every N minutes otherwise. */
export const pollerCron = (minutes: number) =>
  minutes === 60 ? "0 * * * *" : `*/${minutes} * * * *`;

/** The repository's own secrets as one JSON object, since a workflow in
 * another owner's repository takes a secret only by a name it declares.
 * `toJSON` quotes each value, and an unset one is an empty string. */
function extra(names: string[]): string[] {
  if (!names.length) return [];
  const shape = names.map((name, i) => `"${name}":{${i}}`).join(",");
  const values = names.map((name) => `toJSON(secrets.${name})`).join(", ");
  return [`      extra: \${{ format('{{${shape}}}', ${values}) }}`];
}

const HEADER = [
  "# Written by `factory sync`. Do not edit: change .claude/factory.yaml and",
  "# run it again.",
];

/** `.github/workflows/factory.yml`. */
export function factoryWorkflow(o: WorkflowOptions): string {
  const name = `Build ${o.ref("{0}")}`.replaceAll("'", "''");
  const schedules = [
    ...SCHEDULES.map(([cron, what]) => `    - cron: "${cron}" # ${what}`),
    ...(o.pollMinutes === null
      ? []
      : [`    - cron: "${pollerCron(o.pollMinutes)}" # the poller`]),
  ];
  const minutes = (Object.keys(SESSION_MINUTES) as SessionKind[]).flatMap(
    (kind) =>
      o.minutes[kind] === SESSION_MINUTES[kind]
        ? []
        : [
            `      ${kind}-minutes: ${o.minutes[kind]}`,
            `      ${kind}-limit: ${o.minutes[kind] + 10}`,
          ],
  );
  return `${[
    ...HEADER,
    "#",
    "# Everything the factory runs from the default branch's copy: the",
    "# review's verdict, who merges, the board sync, the poller, a build, an",
    "# answer to a review, the conflict sweep, Dependabot's pull requests, and",
    "# updates. The jobs are in the factory's own repository, at the version",
    "# below. A job whose part is off in the settings is skipped.",
    "name: Factory",
    `run-name: ${JSON.stringify(`\${{ inputs.ticket && format('${name}', inputs.ticket) || '' }}`)}`,
    "",
    "on:",
    "  pull_request_target:",
    "    types:",
    ...TARGET_ACTIONS.map((action) => `      - ${action}`),
    "  pull_request_review:",
    "    types: [submitted]",
    "  workflow_run:",
    "    workflows: [Factory review]",
    "    types: [completed]",
    "  push:",
    `    branches: [${scalar(o.branch)}]`,
    "  schedule:",
    ...schedules,
    "  workflow_dispatch:",
    "    inputs:",
    "      job:",
    '        description: "What to run: build, review, conflicts, dependencies, updates, board, or poller"',
    "        type: string",
    "      ticket:",
    "        description: The ticket's key, for a build",
    "        type: string",
    "      pr:",
    "        description: The pull request's number, to answer a review",
    "        type: string",
    "      review:",
    "        description: The review's number, to answer a review",
    "        type: string",
    "",
    "permissions:",
    "  actions: read",
    "  contents: read",
    "  issues: write",
    ...(o.secrets.includes("GITHUB_TOKEN") ? ["  packages: read"] : []),
    "  pull-requests: write",
    "  statuses: write",
    "",
    "jobs:",
    "  factory:",
    `    uses: ${uses(o, "run.yml")}`,
    "    with:",
    `      parts: ${JSON.stringify(o.parts.join(" "))}`,
    "      job: ${{ inputs.job }}",
    "      ticket: ${{ inputs.ticket }}",
    "      pr: ${{ inputs.pr }}",
    "      review: ${{ inputs.review }}",
    ...minutes,
    ...(o.overrideLabel === PR_LABELS["verdict-override"]
      ? []
      : [`      override-label: ${JSON.stringify(o.overrideLabel)}`]),
    "    secrets:",
    "      build-token: ${{ secrets.FACTORY_BUILD_TOKEN || secrets.FACTORY_BOARD_TOKEN }}",
    "      board-token: ${{ secrets.FACTORY_BOARD_TOKEN }}",
    "      automerge-token: ${{ secrets.FACTORY_AUTOMERGE_TOKEN }}",
    "      app-key: ${{ secrets.FACTORY_APP_PRIVATE_KEY }}",
    "      signing-key: ${{ secrets.FACTORY_SIGNING_KEY }}",
    "      claude-token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}",
    "      claude-api-key: ${{ secrets.ANTHROPIC_API_KEY }}",
    ...extra(o.secrets),
  ].join("\n")}\n`;
}

/** `.github/workflows/factory-review.yml`. */
export function reviewWorkflow(o: WorkflowOptions): string {
  return `${[
    ...HEADER,
    "#",
    "# What has to read a pull request's own code: the check that the",
    "# factory's files match the settings, the automated review, and",
    "# Dependabot's auto-merge. The jobs are in the factory's own repository,",
    "# at the version below. Nothing here decides a merge.",
    "name: Factory review",
    "",
    "on:",
    "  pull_request:",
    "    types: [opened, reopened, synchronize, ready_for_review]",
    "",
    "permissions:",
    "  contents: read",
    "  issues: read",
    ...(o.secrets.includes("GITHUB_TOKEN") ? ["  packages: read"] : []),
    "  pull-requests: write",
    "",
    "jobs:",
    "  review:",
    `    uses: ${uses(o, "review.yml")}`,
    "    with:",
    `      parts: ${JSON.stringify(o.parts.join(" "))}`,
    "    secrets:",
    "      build-token: ${{ secrets.FACTORY_BUILD_TOKEN || secrets.FACTORY_BOARD_TOKEN }}",
    "      automerge-token: ${{ secrets.FACTORY_AUTOMERGE_TOKEN }}",
    "      app-key: ${{ secrets.FACTORY_APP_PRIVATE_KEY }}",
    "      claude-token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}",
    "      claude-api-key: ${{ secrets.ANTHROPIC_API_KEY }}",
    ...extra(o.secrets),
  ].join("\n")}\n`;
}

export const POLLER_FILE = ".github/workflows/factory-poller.yml";

/** The updates' schedule in the poller's file, which poller.yml tells from
 * the poller's own by its text. */
const POLLER_UPDATES = "0 1 * * *";

/** `.github/workflows/factory-poller.yml`, in the repository that holds an
 * organization's preset. It is that repository's to edit, so nothing
 * writes it again but an update of the version it names. */
export function pollerWorkflow(o: {
  /** The organization whose board it reads. */
  owner: string;
  version: string;
  pollMinutes: number;
}): string {
  return `${[
    `# ${POLLER_FILE}, written by factory init --org.`,
    `# The one poller for ${o.owner}'s board. The cron line is yours to change, with`,
    "# builds.poll-minutes in factory-preset.yaml: factory preset check fails",
    "# when the two differ.",
    "name: Factory poller",
    "on:",
    "  schedule:",
    `    - cron: "${pollerCron(o.pollMinutes)}" # the poller`,
    `    - cron: "${POLLER_UPDATES}" # updates`,
    "  workflow_dispatch:",
    "permissions:",
    "  contents: read",
    "jobs:",
    "  poller:",
    `    uses: ${HOME}/poller.yml@v${o.version}`,
    "    secrets:",
    "      app-key: ${{ secrets.FACTORY_APP_PRIVATE_KEY }}",
  ].join("\n")}\n`;
}
