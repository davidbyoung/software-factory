# Proposal

From [davidbyoung/software-factory#122](https://github.com/davidbyoung/software-factory/issues/122). The checks lists and docs the owner approved are in the ticket's "Proposed docs".

### The problem

A pull request's checks list has grown long enough to be hard to read. On #121's newest commit it showed 55 rows, and 41 of them were skipped. Each review round adds about 23 more, nearly all skipped, so answering feedback nearly doubles the list.

### Why it happens

All 23 jobs the factory runs from the default branch are in one file, `.github/workflows/run.yml`. Each job decides with its own `if:` whether it runs. GitHub lists a row for every job in a run, skipped or not, and every pull request event starts a new run of the whole file on the same commit: a push, a review being submitted, ready for review, a label, or an edit. On #121:

| Run                                                 | Rows   | Jobs that did anything                                              |
| --------------------------------------------------- | ------ | ------------------------------------------------------------------- |
| Push (`pull_request_target`)                        | 25     | the verdict, the four approval policy jobs, and Review's three jobs |
| Review submitted (`pull_request_review`)            | 23     | Answer / Prepare                                                    |
| CI, Factory review, and the three required statuses | 6 to 7 | all of them                                                         |

#120's newest commit had three push-event runs, each with a full set of rows.

When GitHub skips a job that calls another workflow file, it lists one row for it, not one per job inside: `factory / Build` already shows once although it holds Prepare, Session, and Publish.

### The change

Group the jobs `run.yml` holds so a group with nothing to do on an event shows as one skipped row. `run.yml` keeps Review, Answer, and Approve what an approval policy found as jobs of its own, so their rows keep today's names, and calls three groups, each a workflow file of its own: **Pull request** (the verdict, the approval policies, Classify risk, and Enable auto-merge), **Tickets** (Tell the other repositories, Sync the board, and Open the ticked tickets), and **Default branch** (everything that runs on a push to the default branch, a schedule, or by hand). "Proposed docs" below shows each group, the rows a pull request lists before and after, and the docs that change.

What the checks list would show, estimated from #121:

| Event on a pull request                     | Rows today | Rows after |
| ------------------------------------------- | ---------- | ---------- |
| A push                                      | 25         | 14         |
| A review submitted                          | 23         | 8          |
| Ready for review                            | 25         | 16         |
| A label or an edit that no job uses         | 23         | 6          |
| Closed                                      | 23         | 8          |
| #121 as it stands, with CI and the statuses | 55         | about 28   |

### What must not change

- Every job runs on the same events, under the same conditions, as today, and still checks out the default branch, never the pull request. The three jobs of `session.yml` stay as they are.
- No job gets more permission than it has now. A called workflow cannot exceed its caller's permissions, so each group's call grants the union of what its jobs need, and each job keeps declaring its own.
- Each group is passed only the secrets its jobs use, where today every job in `run.yml` could reference every secret.
- A repository's own `factory.yml` and `factory-review.yml` stay as `factory sync` writes them now. The change reaches a repository through a release and `factory update`.
- The rulesets require the `Review verdict` and `Approval policies` commit statuses, not job names, so they are unaffected.
- Run times: skipped jobs start no machine and take 0 seconds on #121's runs, and a job that calls a workflow gets no machine of its own, so no run should get slower.

### What the build has to handle

- Jobs that start on events of more than one group's: Sync the board runs on pull request events and at 07:00, so the Tickets group is called on both; Record the verdict also runs by hand as `order`, so the Pull request group is called for that too. Approve what an approval policy found stays a job of `run.yml`, since it runs on a label and on an approving review.
- Each group is passed the inputs its jobs read, such as `parts` and the labels' names, and only the secrets its jobs use.
- Review and Answer keep their rows' names, so `REVIEW_CHECKS` in `src/pr-watch.mts` and `REVIEW_JOBS` in `src/runner/github-actions.mts` are unchanged. Anything else that names a job's row changes with it, such as the tests that quote `factory / Record the verdict` or `factory / Sync the board`, and the docs "Proposed docs" lists.
- The nesting is at most four levels (`factory.yml`, `run.yml`, Default branch, and `session.yml` for Build, Conflict, and Dependency), within GitHub's limit for workflows calling workflows.

### Considered and not chosen

- **One `factory.yml` per event.** It would drop even the skipped group rows, but it changes the two files every repository installs, and the docs and specs that describe them, to save about two rows a run.
- **Fewer trigger types.** GitHub cannot limit a label trigger to certain label names, and the override labels need it, so the label and edit runs can only shrink, not go away.
- **Review and Answer in groups.** It saves about one row a run, but renames the rows that `factory pr watch` and the poller find the review by, and that `docs/updating.md` quotes.

### Decisions

- Which jobs stay `run.yml`'s own: Review, Answer, and Approve what an approval policy found. Review's and Answer's rows keep today's names, which `factory pr watch` and the poller find the review by and `docs/updating.md` quotes, and Approve starts on a label and on an approving review, events of two groups.
- The groups and their names: **Pull request**, **Tickets**, and **Default branch**, named for what their jobs do. The owner chose Default branch for the third.
- `docs/updating.md` gets a "Grouped checks" section, for a rule of a reader's own that requires a job by its row's name.
- `factory.yml` and `factory-review.yml` are unchanged: the change reaches a repository with a release, through `factory update`.
- Track: `spec`. The names a factory user reads in a pull request's checks change, and two lines of `workflow-files` that name `run.yml`'s jobs no longer hold as written.
- No trace with `factory-trace`: no job starts on a different event, schedule, or condition, which the unchanged "which job an event starts" table in `tests/workflows.test.ts` proves. The pull request says so.
- Built on a person's machine: it adds and changes files under `.github/workflows/`, which a cloud build's commit may not.
- The builder's run by hand of the branch's workflow (task 3.2) syncs the board and posts the pull request's two statuses for real. Each does only what the same job does on its own schedule or on a push, so it needs no scratch repository.
- No blocker either way. #77 changes steps inside `session.yml`'s Publish job, which this moves nothing in, and no other open ticket touches these workflows.
