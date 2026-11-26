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

const REVIEWS =
  /actions\/workflows\/factory\.yml\/runs\?event=pull_request_target/;
/** A run of a pull request's event, named as factory.yml names it. */
const pullRun = (id: number, sha: string, status = "completed") => ({
  id,
  status,
  display_title: `#31 at ${sha}`,
});
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

describe("starting a session on a pull request", () => {
  it("dispatches an answer on the branch, for the pull request", async () => {
    const { r, calls } = runner([[DISPATCH, ""]]);

    await r.startAnswer(31, "trunk");

    expect(calls).toEqual([
      "api -X POST repos/acme/widgets/actions/workflows/factory.yml/dispatches -f ref=trunk -f inputs[job]=answer -f inputs[pr]=31",
    ]);
  });

  it.each(["conflict", "dependency"] as const)(
    "dispatches a %s session on the branch, for the pull request",
    async (kind) => {
      const { r, calls } = runner([[DISPATCH, ""]]);

      await r.startOn(kind, 31, "trunk");

      expect(calls).toEqual([
        `api -X POST repos/acme/widgets/actions/workflows/factory.yml/dispatches -f ref=trunk -f inputs[job]=${kind} -f inputs[pr]=31`,
      ]);
    },
  );

  it("fails with GitHub's own error when the dispatch is refused", async () => {
    const refused = new HttpError(403, "x", "Resource not accessible");
    const { r } = runner([[DISPATCH, refused]]);

    await expect(r.startAnswer(31, "main")).rejects.toBe(refused);
    await expect(r.startOn("conflict", 31, "main")).rejects.toBe(refused);
  });
});

describe("counting the answers to a pull request", () => {
  const SINCE = "2026-11-20T10:00:00Z";
  const page = (n: number) => new RegExp(`per_page=100&page=${n}$`);
  const runs = (...titles: string[]) => ({
    workflow_runs: titles.map((title, i) => build(i, title, SINCE)),
  });

  it("counts the runs named for it alone, not another pull request's or a build's", async () => {
    const { r } = runner([
      [
        page(1),
        runs(
          "Answer #3",
          "Answer #31",
          "Answer #310",
          "Build #31",
          "Answer #31",
          "re Answer #31",
        ),
      ],
    ]);

    expect(await r.answersTo(31, SINCE)).toBe(2);
  });

  it("asks only for the runs started by hand or by a run since the pull request was opened", async () => {
    const { r, calls } = runner([[page(1), runs()]]);

    expect(await r.answersTo(31, SINCE)).toBe(0);
    expect(calls).toEqual([
      "api repos/acme/widgets/actions/workflows/factory.yml/runs?event=workflow_dispatch&created=%3E%3D2026-11-20T10%3A00%3A00Z&per_page=100&page=1",
    ]);
  });

  it("reads page after page while each is full, and stops at one that is not", async () => {
    const full = (title: string) => runs(...Array<string>(100).fill(title));
    const { r, calls } = runner([
      [page(1), full("Build #12")],
      [page(2), full("Answer #31")],
      [page(3), runs("Answer #31")],
    ]);

    expect(await r.answersTo(31, SINCE)).toBe(101);
    expect(calls).toHaveLength(3);
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

  /** The review runs the runner finds for the commit `h`, of these runs
   * and their jobs. */
  const reviews = (
    runs: ReturnType<typeof pullRun>[],
    jobs: ReturnType<typeof job>[],
  ) =>
    runner([
      [REVIEWS, { workflow_runs: runs }],
      [/actions\/runs\/\d+\/jobs/, { jobs }],
    ]).r.reviewRuns("h");
  it("asks for the commit's own runs, not the newest 50 of every pull request's", async () => {
    const { r, calls } = runner([[REVIEWS, { workflow_runs: [] }]]);
    await r.reviewRuns("h");
    expect(calls[0]).toContain("head_sha=h");
    expect(calls[0]).not.toContain("per_page=50");
  });

  const ran = (
    prepare: string | null,
    session: string | null,
    publish: string | null,
  ) => [
    job(1, "factory / Record the verdict", "failure"),
    job(2, "factory / Review / Prepare", prepare),
    job(3, "factory / Review / Session", session),
    job(4, "factory / Review / Publish", publish),
  ];

  it("gives a review that ended, by its own jobs alone", async () => {
    expect(
      await reviews([pullRun(9, "h")], ran("success", "success", "success")),
    ).toEqual([{ status: "completed", conclusion: "success" }]);
  });

  it.each<[string, ReturnType<typeof ran>]>([
    ["its session", ran("success", "failure", "success")],
    ["its publishing", ran("success", "success", "failure")],
  ])("gives a review that failed in %s", async (_, jobs) => {
    expect(await reviews([pullRun(9, "h")], jobs)).toEqual([
      { status: "completed", conclusion: "failure" },
    ]);
  });

  it("gives a review that was canceled as canceled", async () => {
    expect(
      await reviews([pullRun(9, "h")], ran("success", "cancelled", "success")),
    ).toEqual([{ status: "completed", conclusion: "cancelled" }]);
  });

  it("gives a review whose session is running as in progress", async () => {
    expect(
      await reviews(
        [pullRun(9, "h", "in_progress")],
        ran("success", null, null).slice(0, 3),
      ),
    ).toEqual([{ status: "in_progress", conclusion: null }]);
  });

  it("gives a review between two jobs, the next of which is not listed yet, as in progress", async () => {
    expect(
      await reviews(
        [pullRun(9, "h", "in_progress")],
        ran("success", null, null).slice(0, 2),
      ),
    ).toEqual([{ status: "in_progress", conclusion: null }]);
  });

  it("gives a review as ended while another job of its run still runs", async () => {
    expect(
      await reviews(
        [pullRun(9, "h", "in_progress")],
        [
          ...ran("success", "success", "success"),
          job(5, "factory / Sync the board", null),
        ],
      ),
    ).toEqual([{ status: "completed", conclusion: "success" }]);
  });

  it("leaves out a run whose review was skipped, as for a draft", async () => {
    expect(
      await reviews(
        [pullRun(9, "h")],
        [
          job(1, "factory / Record the verdict", "success"),
          job(2, "factory / Review", "skipped"),
        ],
      ),
    ).toEqual([]);
  });

  it("reads no job of a run for another commit, though its name ends as this one's does", async () => {
    const { r, calls } = runner([
      [REVIEWS, { workflow_runs: [pullRun(9, "other"), pullRun(8, "oh")] }],
    ]);

    expect(await r.reviewRuns("h")).toEqual([]);
    expect(calls).toHaveLength(1);
  });
});

describe("asking for the review again", () => {
  const RERUN = /-X POST repos\/acme\/widgets\/actions\/jobs\/\d+\/rerun/;

  it("has the first job of the commit's newest review run again, and so the jobs that follow it", async () => {
    const { r, calls } = runner([
      [REVIEWS, { workflow_runs: [pullRun(77, "h"), pullRun(70, "h")] }],
      [
        /actions\/runs\/77\/jobs/,
        {
          jobs: [
            job(6, "factory / Review / Session", "success"),
            job(5, "factory / Review / Prepare", "success"),
          ],
        },
      ],
      [
        /actions\/runs\/70\/jobs/,
        { jobs: [job(4, "factory / Review / Prepare", "failure")] },
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

describe("the run that kept an artifact", () => {
  const LIST =
    /^api repos\/acme\/widgets\/actions\/artifacts\?name=approval-policies-7-abc/;
  const RUN = /^api repos\/acme\/widgets\/actions\/runs\/91$/;
  const kept = { artifacts: [{ expired: false, workflow_run: { id: 91 } }] };

  it("is the factory's own run, started by a pull request's event", async () => {
    const { r } = runner([
      [LIST, kept],
      [
        RUN,
        { path: ".github/workflows/factory.yml", event: "pull_request_target" },
      ],
    ]);
    expect(await r.keptBy("approval-policies-7-abc", "factory.yml")).toBe(91);
  });

  it.each([
    [
      "another workflow",
      { path: ".github/workflows/mine.yml", event: "pull_request_target" },
    ],
    [
      "the pull request's own copy",
      { path: ".github/workflows/factory.yml", event: "pull_request" },
    ],
  ])("is none when the run is %s", async (_, run) => {
    const { r } = runner([
      [LIST, kept],
      [RUN, run],
    ]);
    expect(await r.keptBy("approval-policies-7-abc", "factory.yml")).toBeNull();
  });

  it.each([
    [
      "has expired",
      { artifacts: [{ expired: true, workflow_run: { id: 91 } }] },
    ],
    ["is not there", { artifacts: [] }],
  ])("is none when the artifact %s", async (_, listed) => {
    const { r } = runner([[LIST, listed]]);
    expect(await r.keptBy("approval-policies-7-abc", "factory.yml")).toBeNull();
  });
});
