import { describe, expect, it } from "vitest";
import { githubActionsRunner } from "../src/runner/github-actions.mts";
import { HttpError, ghTransport } from "../src/tickets/transport.mts";
import { fakeGh } from "./fake-gh";

const REPO = "acme/widgets";
const SITE = "https://github.com/acme/widgets";

function runner(routes: Parameters<typeof fakeGh>[0] = []) {
  const gh = fakeGh(routes);
  return {
    r: githubActionsRunner({
      transport: ghTransport(gh.run),
      repository: REPO,
    }),
    calls: gh.calls,
  };
}

const DISPATCH =
  /-X POST repos\/acme\/widgets\/actions\/workflows\/factory\.yml\/dispatches/;
const BUILDS =
  /actions\/workflows\/factory\.yml\/runs\?event=workflow_dispatch/;
const build = (id: number, title: string, created: string) => ({
  id,
  display_title: title,
  event: "workflow_dispatch",
  created_at: created,
  html_url: `${SITE}/actions/runs/${id}`,
});

const REVIEWS = /actions\/workflows\/factory-review\.yml\/runs\?head_sha=h/;
const job = (id: number, name: string, conclusion: string | null) => ({
  id,
  name,
  status: conclusion === null ? "in_progress" : "completed",
  conclusion,
});

describe("starting a build", () => {
  it("dispatches the build workflow on the branch with the ticket's number", async () => {
    const { r, calls } = runner([[DISPATCH, ""]]);

    await r.startBuild("12", "main");

    expect(calls).toEqual([
      "api -X POST repos/acme/widgets/actions/workflows/factory.yml/dispatches -f ref=main -f inputs[job]=build -f inputs[ticket]=12",
    ]);
  });

  it("starts the board sync on the branch", async () => {
    const { r, calls } = runner([[/factory\.yml\/dispatches/, {}]]);

    await r.startSync("main");

    expect(calls).toEqual([
      "api -X POST repos/acme/widgets/actions/workflows/factory.yml/dispatches -f ref=main -f inputs[job]=board",
    ]);
  });

  it("fails with GitHub's own error when the dispatch is refused", async () => {
    const refused = new HttpError(403, "x", "Resource not accessible");
    const { r } = runner([[DISPATCH, refused]]);

    await expect(r.startBuild("12", "main")).rejects.toBe(refused);
  });
});

describe("finding the run a start made", () => {
  const SINCE = Date.parse("2026-11-14T22:00:00.400Z");

  it("takes the ticket's run created in or after the second the start was sent", async () => {
    const { r } = runner([
      [
        BUILDS,
        {
          workflow_runs: [
            build(3, "Build #13", "2026-11-14T22:00:01Z"),
            build(2, "Build #12", "2026-11-14T22:00:00Z"),
            build(1, "Build #12", "2026-11-14T21:59:59Z"),
          ],
        },
      ],
    ]);

    expect(await r.findBuild("Build #12", SINCE)).toBe(
      `${SITE}/actions/runs/2`,
    );
  });

  it("is null while only an older run of the ticket and a run of another show", async () => {
    const { r } = runner([
      [
        BUILDS,
        {
          workflow_runs: [
            build(3, "Build #13", "2026-11-14T22:00:01Z"),
            build(1, "Build #12", "2026-11-14T21:59:59Z"),
          ],
        },
      ],
    ]);

    expect(await r.findBuild("Build #12", SINCE)).toBeNull();
  });
});

describe("pages", () => {
  it("gives the page that lists builds, and a run's page from its ID", () => {
    const { r, calls } = runner();

    expect(r.buildsPage()).toBe(`${SITE}/actions/workflows/factory.yml`);
    expect(r.runPage("123456789")).toBe(`${SITE}/actions/runs/123456789`);
    expect(calls).toEqual([]);
  });
});

describe("the run this session is in", () => {
  const RUN = {
    GITHUB_ACTIONS: "true",
    GITHUB_RUN_ID: "123456789",
    GITHUB_SERVER_URL: "https://github.example",
    GITHUB_REPOSITORY: "o/r",
    GITHUB_ACTOR: "alice",
  };

  it("reads the run's ID, its page on the run's own server, and who started it", () => {
    expect(runner().r.thisRun(RUN)).toEqual({
      id: "123456789",
      page: "https://github.example/o/r/actions/runs/123456789",
      startedBy: "alice",
    });
  });

  it("puts the page on github.com when the run names no server", () => {
    expect(
      runner().r.thisRun({ ...RUN, GITHUB_SERVER_URL: undefined }),
    ).toMatchObject({ page: "https://github.com/o/r/actions/runs/123456789" });
  });

  it("gives no page when the run names no repository", () => {
    expect(
      runner().r.thisRun({ ...RUN, GITHUB_REPOSITORY: undefined }),
    ).toEqual({ id: "123456789", startedBy: "alice" });
  });

  it("is null when GITHUB_ACTIONS is not true", () => {
    expect(
      runner().r.thisRun({ ...RUN, GITHUB_ACTIONS: undefined }),
    ).toBeNull();
  });

  it("is unknown, with no page, when the run does not give its ID", () => {
    expect(runner().r.thisRun({ GITHUB_ACTIONS: "true" })).toEqual({
      id: "unknown",
    });
  });
});

describe("the runs for a commit", () => {
  it("returns every run in the factory's words", async () => {
    const { r, calls } = runner([
      [
        /actions\/runs\?head_sha=h/,
        {
          workflow_runs: [
            {
              id: 3,
              workflow_id: 100,
              event: "pull_request",
              status: "completed",
              conclusion: "failure",
              check_suite_id: 30,
            },
          ],
        },
      ],
    ]);

    expect(await r.runs("h")).toEqual([
      {
        id: 3,
        jobs: 100,
        event: "pull_request",
        status: "completed",
        conclusion: "failure",
        checksId: 30,
      },
    ]);
    expect(calls).toEqual([
      "api repos/acme/widgets/actions/runs?head_sha=h&per_page=100",
    ]);
  });

  it("returns the review job of each run of the review's workflow for the commit", async () => {
    const { r, calls } = runner([
      [REVIEWS, { workflow_runs: [{ id: 9, status: "completed" }] }],
      [
        /actions\/runs\/9\/jobs/,
        {
          jobs: [
            job(1, "review / Factory files in step", "failure"),
            job(2, "review / Claude review", "success"),
          ],
        },
      ],
    ]);

    expect(await r.reviewRuns("h")).toEqual([
      { status: "completed", conclusion: "success" },
    ]);
    expect(calls).toHaveLength(2);
  });

  it("leaves out a run whose review job was skipped, as for a draft", async () => {
    const { r } = runner([
      [REVIEWS, { workflow_runs: [{ id: 9, status: "completed" }] }],
      [
        /actions\/runs\/9\/jobs/,
        {
          jobs: [
            job(1, "review / Factory files in step", "success"),
            job(2, "review / Claude review", "skipped"),
          ],
        },
      ],
    ]);

    expect(await r.reviewRuns("h")).toEqual([]);
  });

  it("gives the review job's conclusion in one run, whatever its other jobs did", async () => {
    const { r } = runner([
      [
        /actions\/runs\/9\/jobs/,
        {
          jobs: [
            job(1, "review / Factory files in step", "failure"),
            job(2, "review / Claude review", "success"),
          ],
        },
      ],
      [/actions\/runs\/8\/jobs/, { jobs: [] }],
    ]);

    expect(await r.reviewConclusion(9)).toBe("success");
    expect(await r.reviewConclusion(8)).toBe("skipped");
  });
});

describe("asking for the review again", () => {
  const RERUN = /-X POST repos\/acme\/widgets\/actions\/jobs\/\d+\/rerun/;

  it("has the review job of the commit's newest run run again", async () => {
    const { r, calls } = runner([
      [
        REVIEWS,
        {
          workflow_runs: [
            { id: 77, status: "completed" },
            { id: 70, status: "completed" },
          ],
        },
      ],
      [
        /actions\/runs\/77\/jobs/,
        { jobs: [job(5, "review / Claude review", "success")] },
      ],
      [
        /actions\/runs\/70\/jobs/,
        { jobs: [job(4, "review / Claude review", "failure")] },
      ],
      [RERUN, ""],
    ]);

    expect(await r.reviewAgain("h")).toBe(true);
    expect(calls.at(-1)).toBe(
      "api -X POST repos/acme/widgets/actions/jobs/5/rerun",
    );
  });

  it("answers false, and asks for nothing, when no review has run on the commit", async () => {
    const { r, calls } = runner([[REVIEWS, { workflow_runs: [] }]]);

    expect(await r.reviewAgain("h")).toBe(false);
    expect(calls).toHaveLength(1);
  });
});

describe("the jobs that failed in a run", () => {
  it("gives each failed job with its log, and reads no log of a job that passed", async () => {
    const { r, calls } = runner([
      [
        /actions\/runs\/5\/jobs/,
        {
          jobs: [
            { id: 51, name: "Tests", conclusion: "failure" },
            { id: 52, name: "Lint", conclusion: "success" },
          ],
        },
      ],
      [/actions\/jobs\/51\/logs/, "first line\nError: it broke\n"],
    ]);

    expect(await r.failedJobs(5)).toEqual([
      { name: "Tests", log: "first line\nError: it broke\n" },
    ]);
    expect(calls).toHaveLength(2);
  });

  it("gives a log without the color codes a terminal would read", async () => {
    const { r } = runner([
      [
        /actions\/runs\/5\/jobs/,
        { jobs: [{ id: 51, name: "Tests", conclusion: "failure" }] },
      ],
      [
        /actions\/jobs\/51\/logs/,
        "\u001b[36;1mnpm test\u001b[0m\n\u001b[31mError: it broke\u001b[0m\n",
      ],
    ]);

    expect((await r.failedJobs(5))[0].log).toBe("npm test\nError: it broke\n");
  });

  it.each(["timed_out", "startup_failure"])(
    "counts a job that ended %s as failed",
    async (ended) => {
      const { r } = runner([
        [
          /actions\/runs\/5\/jobs/,
          { jobs: [{ id: 51, name: "Build", conclusion: ended }] },
        ],
        [/actions\/jobs\/51\/logs/, "the log"],
      ]);

      expect(await r.failedJobs(5)).toEqual([
        { name: "Build", log: "the log" },
      ]);
    },
  );
});

describe("a workflow's state", () => {
  const WORKFLOW =
    /^api repos\/acme\/widgets\/actions\/workflows\/factory-poller\.yml$/;

  it.each([
    ["active", "active"],
    ["disabled_inactivity", "disabled"],
    ["disabled_manually", "disabled"],
  ])("reads %s as %s", async (state, said) => {
    const { r, calls } = runner([[WORKFLOW, { state }]]);

    expect(await r.workflowState("factory-poller.yml")).toBe(said);
    expect(calls).toEqual([
      "api repos/acme/widgets/actions/workflows/factory-poller.yml",
    ]);
  });

  it("is missing when the default branch has no such workflow", async () => {
    const { r } = runner([[WORKFLOW, new HttpError(404, "x", "Not Found")]]);

    expect(await r.workflowState("factory-poller.yml")).toBe("missing");
  });

  it("fails with GitHub's own error for anything else", async () => {
    const refused = new HttpError(403, "x", "Resource not accessible");
    const { r } = runner([[WORKFLOW, refused]]);

    await expect(r.workflowState("factory-poller.yml")).rejects.toBe(refused);
  });
});
