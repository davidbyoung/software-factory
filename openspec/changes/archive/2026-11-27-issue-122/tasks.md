# Tasks

## 1. The groups

- [x] 1.1 In `tests/workflows.test.ts`, read the three group files beside `run.yml`, and make `started` return a job inside a group only when both the group's call `if` and the job's own `if` hold, keeping the job's id. Leave every expectation of "which job an event starts" and its run-by-hand table as it is. Verify: the table fails while the group files do not exist yet, then passes once 1.3 and 1.4 are done.
- [x] 1.2 In the same file, add a test that, for every event and run by hand in those tables, a group's call `if` holds whenever a job inside would start with its own `if` alone (Spec 2). Verify: red when `converted_to_draft` is taken out of the Tickets call's `if`.
- [x] 1.3 Create `run-pull-request.yml`, `run-tickets.yml`, and `run-default-branch.yml` with the jobs as Design says, moved unchanged, each with its `workflow_call` inputs and secrets. Verify: for each moved job, its YAML parsed from the new file equals its YAML parsed from `run.yml` before the move.
- [x] 1.4 Replace the moved jobs in `run.yml` with the three calls, their `name`, `if`, `permissions`, `with`, and `secrets` as Design says. Verify: 1.1 and 1.2 pass.
- [x] 1.5 Test that `run.yml`'s jobs are exactly `review`, `answer`, `approval-label`, `pull-request`, `tickets`, and `default-branch`, with the calls named "Pull request", "Tickets", and "Default branch", and that every job in a group has the name it had (Spec 1, 4). Verify: red when a call is named otherwise.
- [x] 1.6 Test that on a push to a pull request the Tickets and Default branch calls are skipped, and on a review submitted all three are (Spec 3). Verify: red with the Default branch call's `if` set to `true`.
- [x] 1.7 Test that each call passes exactly the secrets its group's jobs read, and grants exactly the union of their permissions (Spec 5). Verify: red with one extra secret passed to Tickets, and red with `automerge-token` taken from Pull request.
- [x] 1.8 Test that the copies of each anchor written out in more than one file are equal, read as YAML: the install steps, the repositories, the extra secrets' steps, and the session's permissions and secrets in `run.yml` and `run-default-branch.yml`. Verify: red when one copy of the session's secrets loses one.
- [x] 1.9 Make every other test that reads `run.yml`'s jobs, such as in `tests/workflows.test.ts`, `tests/fork-safety.test.ts`, and `tests/boundary.test.ts`, read the groups' jobs through one helper, so each keeps checking the job it checked, and add the three files to every list of workflow files a test checks, such as `WORKFLOWS` and `instructionFiles` in `tests/boundary.test.ts`, and the `run.yml`, `session.yml`, and `poller.yml` lists and `FILES` in `tests/workflows.test.ts`, so the checks that guard `run.yml`, such as that every job checks out the default branch, guard them too. Verify: `grep -rn 'run.yml' tests` shows each list with the three files, `grep -n 'run.jobs' tests` finds each reader through the helper, and the suite passes.

## 2. The docs and the spec

- [x] 2.1 Write `docs/github/reference.md` and `docs/updating.md` as Proposed docs shows them. Verify: `npm run format` leaves them as written, and the docs tests pass.
- [x] 2.2 Add a docs test that the reference page's "Group" table names exactly each group's jobs, by their `name`, and that the jobs it lists as in no group are `run.yml`'s own. Verify: red when a job's `name` in a group file changes.
- [x] 2.3 List the three files in `CLAUDE.md` and `docs/developing.md` where `run.yml` is listed as source. Verify: `grep -n 'session.yml' CLAUDE.md docs/developing.md` shows each list with them.
- [x] 2.4 `factory specs new 122`, write Spec 1 to 7 and the "No longer" changes into the change, and `factory specs finish 122`. Verify: `factory specs check` passes.

## 3. Verify

- [x] 3.1 Map each Spec line to its test: 1 to 1.5, 2 to 1.1 and 1.2, 3 to 1.6 and 3.2, 4 to 1.5 and 3.2, 5 to 1.7, 6 to the existing follow-ups rows of "which job an event starts" read through 1.1, and 7 to its push row. Name any line without one and write it.
- [x] 3.2 After `factory pr open --draft`, push the branch and run its own workflows by hand, which runs its `run.yml` and the groups it calls: `gh workflow run factory.yml --ref BRANCH -f job=board`, and `gh workflow run factory.yml --ref BRANCH -f job=order -f pr=N` with this pull request's number. Each run must pass, and its jobs must read as Spec 3 and 4 say: `factory / Tickets / Sync the board` and `factory / Pull request / Record the verdict` among the run's jobs, and each other call one skipped row. Put both runs' job lists in the pull request. Verify: `gh run view RUN --json jobs --jq '.jobs[].name'` for each.

## 4. The gate

- [x] 4.1 `npm run format`, then `factory gate`, then `npm run pack-check`. No end-to-end spec is added.
