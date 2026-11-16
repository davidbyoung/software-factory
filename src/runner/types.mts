// The one interface every runner's implementation fills: where an
// unattended build runs. The factory's commands start a build and read its
// runs only through it. The job files a runner needs, such as GitHub
// Actions' workflows, are its own and no part of this.
//
// Node built-ins only: the poller's image copies this file.

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
  /** Starts a build of the ticket on the branch. The runner may answer
   * before the run exists, so `findBuild` finds it. */
  startBuild(ticket: number, branch: string): Promise<void>;
  /** The page of the ticket's build started at or after `since`, in
   * milliseconds, or null when none shows yet. */
  findBuild(ticket: number, since: number): Promise<string | null>;
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
  /** The names of the secrets the runner's jobs can read. */
  secretNames(): Promise<string[]>;
  /** Stores a secret the runner's jobs can read. The value never appears
   * in a command's arguments or its output. */
  setSecret(name: string, value: string): Promise<void>;
};
