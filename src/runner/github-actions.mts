// GitHub Actions as the runner: a build is a run of Lunamill's workflow,
// started by a dispatch that names the job, and the review is one job of
// the workflow a pull request starts.
// With `src/tickets/` and `src/code-host/`, this is the only code that
// calls GitHub.
import type { GhIn } from "../lib/gh.mts";
import { statusOf, type Transport } from "../tickets/transport.mts";
import type { FailedJob, Run, Runner, StoredSecret } from "./types.mts";

/** The workflow file every job judged from the default branch runs in: a
 * build, the board sync, and the poller among them. */
export const LUNAMILL_WORKFLOW = "lunamill.yml";
/** The workflow file a pull request starts, and the review's job in it, as
 * its check is named: the calling job, then the job. */
/** Opens the name of each job of a review's run. */
export const REVIEW_JOBS = "lunamill / Review / ";
const SITE = "https://github.com";

type RestRun = {
  id: number;
  workflow_id: number;
  event: string;
  status: string;
  conclusion: string | null;
  check_suite_id: number;
};

/** A run as the runs list gives it: `display_title` is the run's name,
 * which a workflow's `run-name` sets. */
type DispatchedRun = {
  display_title: string;
  created_at: string;
  html_url: string;
};

/** A terminal's escape sequences, such as the color codes a job's log is
 * full of. */
const ESCAPES = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

/** How a job ended without passing. */
const FAILED = ["failure", "timed_out", "startup_failure"];

/** Each secret a listing names, with when it was last stored. */
const stored = (
  listed: { name: string; updated_at?: string }[],
): StoredSecret[] =>
  listed.map((x) => ({ name: x.name, stored: x.updated_at ?? "" }));

/** The name the workflow gives an answer's run. */
export const answerName = (pull: number) => `Answer #${pull}`;

export function githubActionsRunner(o: {
  transport: Transport;
  repository: string;
  /** The GitHub CLI, given a secret's value on standard input. Without it,
   * the runner cannot store a secret. */
  cli?: GhIn;
}): Runner {
  const t = o.transport;
  const API = `repos/${o.repository}`;
  /** Every secret a listing names, page by page: the list is an object,
   * not an array, so it is paged by hand. */
  const secretsAt = async (path: string) => {
    const all: { name: string; visibility?: string; updated_at?: string }[] =
      [];
    for (let page = 1; ; page++) {
      const listed = await t.rest<{
        secrets: { name: string; visibility?: string; updated_at?: string }[];
      }>("GET", `${path}?per_page=100&page=${page}`);
      all.push(...listed.secrets);
      if (listed.secrets.length < 100) return all;
    }
  };
  type Job = {
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
  };
  const jobsOf = async (run: number) =>
    (
      await t.rest<{ jobs: Job[] }>(
        "GET",
        `${API}/actions/runs/${run}/jobs?per_page=100`,
      )
    ).jobs;
  /** The review's jobs in each of the runs for a commit, newest first.
   * GitHub gives a `pull_request_target` run the pull request's head as its
   * `head_sha`, so the commit's own runs are asked for, however many other
   * runs there are; its name, which holds the commit too, is checked as
   * well. A run whose review was skipped, as for a draft, has none. */
  const reviewsOf = async (sha: string) => {
    const { workflow_runs } = await t.rest<{
      workflow_runs: (DispatchedRun & { id: number; status: string })[];
    }>(
      "GET",
      `${API}/actions/workflows/${LUNAMILL_WORKFLOW}/runs?event=pull_request_target&head_sha=${sha}&per_page=100`,
    );
    const found: { jobs: Job[]; status: string; conclusion: string | null }[] =
      [];
    for (const run of workflow_runs) {
      if (!run.display_title.endsWith(` at ${sha}`)) continue;
      const jobs = (await jobsOf(run.id)).filter((j) =>
        j.name.startsWith(REVIEW_JOBS),
      );
      if (jobs.length === 0) continue;
      // A job that waits on another is not listed until that one ends.
      const ended =
        jobs.every((j) => j.status === "completed") &&
        (run.status === "completed" ||
          jobs.some((j) => j.name === `${REVIEW_JOBS}Publish`));
      const bad = jobs.find(
        (j) => !["success", "skipped"].includes(j.conclusion ?? ""),
      );
      found.push({
        jobs,
        status: ended ? "completed" : "in_progress",
        conclusion: ended ? (bad?.conclusion ?? "success") : null,
      });
    }
    return found;
  };

  return {
    async startBuild(ticket, branch) {
      await t.rest(
        "POST",
        `${API}/actions/workflows/${LUNAMILL_WORKFLOW}/dispatches`,
        { fields: { ref: branch, inputs: { job: "build", ticket } } },
      );
    },
    async startSync(branch) {
      await t.rest(
        "POST",
        `${API}/actions/workflows/${LUNAMILL_WORKFLOW}/dispatches`,
        { fields: { ref: branch, inputs: { job: "board" } } },
      );
    },
    async startAnswer(pull, branch) {
      await t.rest(
        "POST",
        `${API}/actions/workflows/${LUNAMILL_WORKFLOW}/dispatches`,
        {
          fields: { ref: branch, inputs: { job: "answer", pr: String(pull) } },
        },
      );
    },
    async startOn(kind, pull, branch) {
      await t.rest(
        "POST",
        `${API}/actions/workflows/${LUNAMILL_WORKFLOW}/dispatches`,
        { fields: { ref: branch, inputs: { job: kind, pr: String(pull) } } },
      );
    },
    poster: "github-actions[bot]",
    async answersTo(pull, since) {
      const name = answerName(pull);
      const from = encodeURIComponent(`>=${since}`);
      let count = 0;
      for (let page = 1; ; page++) {
        const { workflow_runs: runs } = await t.rest<{
          workflow_runs: DispatchedRun[];
        }>(
          "GET",
          `${API}/actions/workflows/${LUNAMILL_WORKFLOW}/runs?event=workflow_dispatch&created=${from}&per_page=100&page=${page}`,
        );
        count += runs.filter((r) => r.display_title === name).length;
        if (runs.length < 100) return count;
      }
    },
    workflowsFolder: ".github/workflows",
    // GitHub answers a dispatch with no run, so the run is found by the
    // name the workflow gives a build. GitHub's times are whole seconds, so
    // `since` is rounded down to one.
    async findBuild(runName, since) {
      const from = Math.floor(since / 1000) * 1000;
      const answer = await t.rest<{ workflow_runs: DispatchedRun[] }>(
        "GET",
        `${API}/actions/workflows/${LUNAMILL_WORKFLOW}/runs?event=workflow_dispatch&per_page=30`,
      );
      const found = answer.workflow_runs.find(
        (r) => r.display_title === runName && Date.parse(r.created_at) >= from,
      );
      return found?.html_url ?? null;
    },
    buildsPage: () =>
      `${SITE}/${o.repository}/actions/workflows/${LUNAMILL_WORKFLOW}`,
    runPage: (id) => `${SITE}/${o.repository}/actions/runs/${id}`,
    thisRun(env) {
      if (env.GITHUB_ACTIONS !== "true") return null;
      const id = env.GITHUB_RUN_ID || "unknown";
      const server = env.GITHUB_SERVER_URL || SITE;
      const page =
        id !== "unknown" && env.GITHUB_REPOSITORY
          ? `${server}/${env.GITHUB_REPOSITORY}/actions/runs/${id}`
          : undefined;
      return {
        id,
        ...(page ? { page } : {}),
        ...(env.GITHUB_ACTOR ? { startedBy: env.GITHUB_ACTOR } : {}),
      };
    },
    async runs(sha): Promise<Run[]> {
      const answer = await t.rest<{ workflow_runs: RestRun[] }>(
        "GET",
        `${API}/actions/runs?head_sha=${sha}&per_page=100`,
      );
      return answer.workflow_runs.map((r) => ({
        id: r.id,
        jobs: r.workflow_id,
        event: r.event,
        status: r.status,
        conclusion: r.conclusion,
        checksId: r.check_suite_id,
      }));
    },
    async reviewRuns(sha) {
      return (await reviewsOf(sha)).map(({ status, conclusion }) => ({
        status,
        conclusion,
      }));
    },
    async reviewAgain(sha) {
      const [newest] = await reviewsOf(sha);
      if (!newest) return false;
      // Its first job, which the others follow.
      const first = newest.jobs.find((j) => j.name === `${REVIEW_JOBS}Prepare`);
      if (!first) return false;
      await t.rest("POST", `${API}/actions/jobs/${first.id}/rerun`);
      return true;
    },
    async failedJobs(run) {
      const { jobs } = await t.rest<{
        jobs: { id: number; name: string; conclusion: string | null }[];
      }>("GET", `${API}/actions/runs/${run}/jobs?per_page=100`);
      const failed: FailedJob[] = [];
      for (const job of jobs) {
        if (!FAILED.includes(job.conclusion ?? "")) continue;
        failed.push({
          name: job.name,
          log: (await t.text(`${API}/actions/jobs/${job.id}/logs`)).replace(
            ESCAPES,
            "",
          ),
        });
      }
      return failed;
    },
    async keptBy(name, file) {
      const listed = await t.rest<{
        artifacts: { expired: boolean; workflow_run?: { id: number } }[];
      }>(
        "GET",
        `${API}/actions/artifacts?name=${encodeURIComponent(name)}&per_page=100`,
      );
      const kept = listed.artifacts.find((a) => !a.expired && a.workflow_run);
      if (!kept) return null;
      const run = await t.rest<{ path?: string; event: string }>(
        "GET",
        `${API}/actions/runs/${kept.workflow_run!.id}`,
      );
      // A run's path can carry the ref after an @.
      const path = (run.path ?? "").replace(/@.*$/, "");
      return path === `.github/workflows/${file}` &&
        run.event === "pull_request_target"
        ? kept.workflow_run!.id
        : null;
    },
    async workflowState(file) {
      try {
        const workflow = await t.rest<{ state: string }>(
          "GET",
          `${API}/actions/workflows/${file}`,
        );
        return workflow.state === "active" ? "active" : "disabled";
      } catch (error) {
        if (statusOf(error) === 404) return "missing";
        throw error;
      }
    },
    secretNames: async () =>
      (await secretsAt(`${API}/actions/secrets`)).map((x) => x.name),
    secrets: async () => stored(await secretsAt(`${API}/actions/secrets`)),
    async setSecret(name, value) {
      if (!o.cli) throw new Error("Storing a secret needs the GitHub CLI.");
      await o.cli(["secret", "set", name, "--repo", o.repository], value);
    },
    dependabotSecretNames: async () =>
      (await secretsAt(`${API}/dependabot/secrets`)).map((x) => x.name),
    async setDependabotSecret(name, value) {
      if (!o.cli) throw new Error("Storing a secret needs the GitHub CLI.");
      await o.cli(
        ["secret", "set", name, "--app", "dependabot", "--repo", o.repository],
        value,
      );
    },
    organizationSecretNames: async () =>
      (await secretsAt(`${API}/actions/organization-secrets`)).map(
        (x) => x.name,
      ),
    organizationSecrets: async () =>
      stored(await secretsAt(`${API}/actions/organization-secrets`)),
    async organizationVariableNames() {
      // GitHub gives at most 30 variables a page, whatever it is asked for.
      const most = 30;
      const names: string[] = [];
      for (let page = 1; ; page++) {
        const listed = await t.rest<{ variables: { name: string }[] }>(
          "GET",
          `${API}/actions/organization-variables?per_page=${most}&page=${page}`,
        );
        names.push(...listed.variables.map((x) => x.name));
        if (listed.variables.length < most) return names;
      }
    },
    async organizationDependabotSecretNames(isPrivate) {
      const org = `orgs/${o.repository.split("/")[0]}/dependabot/secrets`;
      try {
        const names: string[] = [];
        for (const s of await secretsAt(org)) {
          if (
            s.visibility === "all" ||
            (s.visibility === "private" && isPrivate)
          )
            names.push(s.name);
          else if (s.visibility === "selected") {
            for (let page = 1; ; page++) {
              const shared = await t.rest<{
                repositories: { full_name: string }[];
              }>(
                "GET",
                `${org}/${s.name}/repositories?per_page=100&page=${page}`,
              );
              if (
                shared.repositories.some((r) => r.full_name === o.repository)
              ) {
                names.push(s.name);
                break;
              }
              if (shared.repositories.length < 100) break;
            }
          }
        }
        return names;
      } catch (error) {
        if (statusOf(error) !== null) return null;
        throw error;
      }
    },
  };
}
