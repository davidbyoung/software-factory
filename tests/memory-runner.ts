// A second runner, kept in memory, that the commands' tests run against.
// It fills the same interface as GitHub Actions' (`src/runner/`), so a
// command that works here works on any runner that keeps the interface.
import type { FailedJob, Run, Runner, ThisRun } from "../src/runner/types.mts";

type ReviewRun = { status: string; conclusion: string | null };

export type MemoryRunnerOptions = {
  /** What a build's run is named, as the build workflow names it; GitHub's
   * `Build #12` unless given. */
  runName?: (ticket: string) => string;
  /** The runs for each commit. */
  runs?: Record<string, Run[]>;
  /** The review's runs for each commit, newest first. */
  reviewRuns?: Record<string, ReviewRun[]>;
  /** The jobs that failed in each run, by the run's ID, with their logs. */
  failedJobs?: Record<number, FailedJob[]>;
  /** The run the session is in; outside one unless given. */
  thisRun?: ThisRun | null;
  /** How many times `findBuild` answers null before a started build shows:
   * none unless given, and Infinity for a build that never shows. */
  buildShowsAfter?: number;
  /** The time a build is started at, in milliseconds. */
  now?: () => number;
  /** What each operation fails with, to test a command's failure path. */
  fail?: Partial<Record<keyof Runner, Error>>;
  /** Every operation called, in order, as its name and arguments. Shared
   * with the in-memory code host when a test reads the order across both. */
  log?: string[];
  /** The secrets set on the repository, by name. */
  secrets?: Record<string, string>;
  /** The secrets set on the repository for Dependabot, by name. */
  dependabotSecrets?: Record<string, string>;
  /** The organization's secrets shared with the repository. */
  organizationSecrets?: string[];
  /** When each secret was last stored, by name, the repository's and the
   * organization's alike; a day in 2026 unless given. */
  stored?: Record<string, string>;
  /** The organization's variables shared with the repository. */
  organizationVariables?: string[];
  /** The organization's Dependabot secrets that reach the repository, or
   * null when the organization will not list them; none unless given. */
  organizationDependabotSecrets?: string[] | null;
  /** How many answers each pull request has had, by its number. */
  answers?: Record<number, number>;
  /** Each workflow's state, by its file name; missing unless given. */
  workflows?: Record<string, "active" | "disabled">;
  /** The trusted run that keeps each artifact, by the artifact's name. */
  kept?: Record<string, number>;
};

export function memoryRunner(options: MemoryRunnerOptions = {}) {
  const fail = options.fail ?? {};
  const log = options.log ?? [];
  const now = options.now ?? (() => 0);
  const runs = new Map(Object.entries(options.runs ?? {}));
  const reviewRuns = new Map(Object.entries(options.reviewRuns ?? {}));
  const builds: { id: number; ticket: string; branch: string; at: number }[] =
    [];
  const runName = options.runName ?? ((ticket: string) => `Build #${ticket}`);
  const reviewsAsked: string[] = [];
  const answers = new Map(
    Object.entries(options.answers ?? {}).map(([k, v]) => [Number(k), v]),
  );
  const secrets = new Map(Object.entries(options.secrets ?? {}));
  const dependabotSecrets = new Map(
    Object.entries(options.dependabotSecrets ?? {}),
  );
  let looked = 0;

  /** Records the call, and fails it when the test asked for that. */
  const called = (op: keyof Runner, ...args: unknown[]) => {
    log.push([op, ...args].join(" "));
    const error = fail[op];
    if (error) throw error;
  };
  const storedOf = (name: string) => ({
    name,
    stored: options.stored?.[name] ?? "2026-11-16T14:50:57Z",
  });
  const runPage = (id: string) => `https://runner.example/runs/${id}`;

  const runner: Runner = {
    async startBuild(ticket, branch) {
      called("startBuild", ticket, branch);
      builds.push({ id: builds.length + 1, ticket, branch, at: now() });
    },
    async startAnswer(pull, branch) {
      called("startAnswer", pull, branch);
      answers.set(pull, (answers.get(pull) ?? 0) + 1);
    },
    async answersTo(pull, since) {
      called("answersTo", pull, since);
      return answers.get(pull) ?? 0;
    },
    async startOn(kind, pull, branch) {
      called("startOn", kind, pull, branch);
    },
    poster: "github-actions[bot]",
    workflowsFolder: ".github/workflows",
    async startSync(branch) {
      called("startSync", branch);
    },
    async findBuild(name, since) {
      called("findBuild", name);
      if (looked++ < (options.buildShowsAfter ?? 0)) return null;
      const found = builds.find(
        (b) => runName(b.ticket) === name && b.at >= since,
      );
      return found ? runPage(String(found.id)) : null;
    },
    buildsPage: () => "https://runner.example/builds",
    runPage,
    thisRun: () => options.thisRun ?? null,
    async runs(sha) {
      called("runs", sha);
      return (runs.get(sha) ?? []).map((r) => ({ ...r }));
    },
    async reviewRuns(sha) {
      called("reviewRuns", sha);
      return (reviewRuns.get(sha) ?? []).map((r) => ({ ...r }));
    },
    async reviewAgain(sha) {
      called("reviewAgain", sha);
      if (!reviewRuns.get(sha)?.length) return false;
      reviewsAsked.push(sha);
      return true;
    },
    async failedJobs(run) {
      called("failedJobs", run);
      return (options.failedJobs?.[run] ?? []).map((j) => ({ ...j }));
    },
    async keptBy(name, file) {
      called("keptBy", name, file);
      return options.kept?.[name] ?? null;
    },
    async workflowState(file) {
      called("workflowState", file);
      return options.workflows?.[file] ?? "missing";
    },
    async secretNames() {
      called("secretNames");
      return [...secrets.keys()];
    },
    // One listing with secretNames, so it fails as that does.
    async secrets() {
      called("secrets");
      if (fail.secretNames) throw fail.secretNames;
      return [...secrets.keys()].map(storedOf);
    },
    async setSecret(name, value) {
      // The value is not logged: the log is what a test prints on failure.
      called("setSecret", name);
      secrets.set(name, value);
    },
    async dependabotSecretNames() {
      called("dependabotSecretNames");
      return [...dependabotSecrets.keys()];
    },
    async setDependabotSecret(name, value) {
      called("setDependabotSecret", name);
      dependabotSecrets.set(name, value);
    },
    async organizationSecretNames() {
      called("organizationSecretNames");
      return [...(options.organizationSecrets ?? [])];
    },
    async organizationSecrets() {
      called("organizationSecrets");
      if (fail.organizationSecretNames) throw fail.organizationSecretNames;
      return (options.organizationSecrets ?? []).map(storedOf);
    },
    async organizationVariableNames() {
      called("organizationVariableNames");
      return [...(options.organizationVariables ?? [])];
    },
    async organizationDependabotSecretNames(isPrivate) {
      called("organizationDependabotSecretNames", isPrivate);
      const names = options.organizationDependabotSecrets;
      return names === null ? null : [...(names ?? [])];
    },
  };

  return {
    runner,
    /** Every operation called, in order. */
    log,
    /** The builds started, oldest first. */
    builds,
    /** The commits a fresh review was asked for, oldest first. */
    reviewsAsked,
    /** The secrets as they stand, by name. */
    secrets,
    /** The Dependabot secrets as they stand, by name. */
    dependabotSecrets,
    /** Replaces a commit's runs, as time passing on the runner would. */
    setRuns(sha: string, to: Run[]) {
      runs.set(sha, to);
    },
  };
}
