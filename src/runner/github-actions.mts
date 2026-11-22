// GitHub Actions as the runner: a build is a run of the build workflow,
// started by a dispatch, and the review is a run of the review workflow.
// With `src/tickets/` and `src/code-host/`, this is the only code that
// calls GitHub.
import type { GhIn } from "../lib/gh.mts";
import { statusOf, type Transport } from "../tickets/transport.mts";
import type { FailedJob, Run, Runner } from "./types.mts";

/** The workflow a build is a run of. */
export const BUILD_WORKFLOW = "factory-build.yml";
const REVIEW_WORKFLOW = "factory-claude-review.yml";
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
    const all: { name: string; visibility?: string }[] = [];
    for (let page = 1; ; page++) {
      const listed = await t.rest<{
        secrets: { name: string; visibility?: string }[];
      }>("GET", `${path}?per_page=100&page=${page}`);
      all.push(...listed.secrets);
      if (listed.secrets.length < 100) return all;
    }
  };
  const reviewsOf = async (sha: string) =>
    (
      await t.rest<{
        workflow_runs: {
          id: number;
          status: string;
          conclusion: string | null;
        }[];
      }>(
        "GET",
        `${API}/actions/workflows/${REVIEW_WORKFLOW}/runs?head_sha=${sha}&per_page=5`,
      )
    ).workflow_runs;

  return {
    async startBuild(ticket, branch) {
      await t.rest(
        "POST",
        `${API}/actions/workflows/${BUILD_WORKFLOW}/dispatches`,
        { fields: { ref: branch, inputs: { ticket } } },
      );
    },
    async startSync(branch) {
      await t.rest(
        "POST",
        `${API}/actions/workflows/factory-board-sync.yml/dispatches`,
        { fields: { ref: branch } },
      );
    },
    // GitHub answers a dispatch with no run, so the run is found by the
    // name the build workflow gives it. GitHub's times are whole seconds, so
    // `since` is rounded down to one.
    async findBuild(runName, since) {
      const from = Math.floor(since / 1000) * 1000;
      const answer = await t.rest<{ workflow_runs: DispatchedRun[] }>(
        "GET",
        `${API}/actions/workflows/${BUILD_WORKFLOW}/runs?event=workflow_dispatch&per_page=30`,
      );
      const found = answer.workflow_runs.find(
        (r) => r.display_title === runName && Date.parse(r.created_at) >= from,
      );
      return found?.html_url ?? null;
    },
    buildsPage: () =>
      `${SITE}/${o.repository}/actions/workflows/${BUILD_WORKFLOW}`,
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
      await t.rest("POST", `${API}/actions/runs/${newest.id}/rerun`);
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
