// The one interface every runner's implementation fills: where an
// unattended build runs. The factory's commands start a build and read its
// runs only through it. The job files a runner needs, such as GitHub
// Actions' workflows, are its own and no part of this.

import type { Key } from "../tickets/types.mts";

/** One run of the repository's jobs for a commit. `status` is `completed`
 * once it has ended, and `conclusion` says how. */
export type Run = {
  id: number;
  /** The runner's ID for the set of jobs this is a run of, so two runs of
   * the same set can be told from runs of another. */
  jobs: number;
  /** What started it, such as `push` or `pull_request`. */
  event: string;
  status: string;
  conclusion: string | null;
  /** The ID the run shares with the checks it reports on its commit. */
  checksId: number;
};

/** The run a session is in. */
export type ThisRun = {
  /** `unknown` when the runner does not say. */
  id: string;
  page?: string;
  /** The account that started it. */
  startedBy?: string;
};

/** A job that failed, and everything it printed. */
export type FailedJob = { name: string; log: string };

export type Runner = {
  /** Starts a build of the ticket, by its key, on the branch. The runner
   * may answer before the run exists, so `findBuild` finds it. */
  startBuild(ticket: Key, branch: string): Promise<void>;
  /** Starts the board sync on the branch, so the board follows what a
   * command just recorded. */
  startSync(branch: string): Promise<void>;
  /** The page of the build named `runName`, such as `Build #12`, started at
   * or after `since`, in milliseconds, or null when none shows yet. */
  findBuild(runName: string, since: number): Promise<string | null>;
  /** The page that lists builds. */
  buildsPage(): string;
  /** The page of a run, from its ID. */
  runPage(id: string): string;
  /** The run this session is in, read from its environment, or null
   * outside one. */
  thisRun(env: Record<string, string | undefined>): ThisRun | null;
  /** Every run for a commit. */
  runs(sha: string): Promise<Run[]>;
  /** The newest runs of the review of a commit, newest first. */
  reviewRuns(
    sha: string,
  ): Promise<{ status: string; conclusion: string | null }[]>;
  /** Has the review of a commit run again, and answers false when none
   * has run on it. */
  reviewAgain(sha: string): Promise<boolean>;
  /** The jobs that failed in one run, each with its log. Which runs count
   * is the caller's: `factory pr failed` takes those `wait-checks` waits on. */
  failedJobs(run: number): Promise<FailedJob[]>;
  /** Whether a workflow of the factory's, by its file name, runs: missing
   * when the default branch does not have it. */
  workflowState(file: string): Promise<"active" | "disabled" | "missing">;
  /** The names of the secrets the runner's jobs can read. */
  secretNames(): Promise<string[]>;
  /** Stores a secret the runner's jobs can read. The value never appears
   * in a command's arguments or its output. */
  setSecret(name: string, value: string): Promise<void>;
  /** The names of the secrets the runner gives a job that the dependency
   * bot's pull request starts. */
  dependabotSecretNames(): Promise<string[]>;
  /** Stores a secret for those jobs, as `setSecret` does. */
  setDependabotSecret(name: string, value: string): Promise<void>;
  /** The names of the secrets the repository's organization shares with
   * it. Not called on a repository a person owns. */
  organizationSecretNames(): Promise<string[]>;
  /** The names of the organization's secrets for the dependency bot that
   * reach this repository, which private ones do only when it is private,
   * or null when the organization will not list them. Not called on a
   * repository a person owns. */
  organizationDependabotSecretNames(
    isPrivate: boolean,
  ): Promise<string[] | null>;
};
