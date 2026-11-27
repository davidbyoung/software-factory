# Design

## Where it goes

- `.github/workflows/run.yml`: keeps `review`, `answer`, and `approval-label` as they are, and replaces every other job with three calling jobs, `pull-request` (name "Pull request"), `tickets` ("Tickets"), and `default-branch` ("Default branch"), each `uses: ./.github/workflows/FILE` as `build` already calls `session.yml`.
- Three new files beside it, each `on: workflow_call`: `run-pull-request.yml` (`verdict`, `approval-prepare`, `approval-commands`, `approval-agent`, `approval-status`, `merge-policy`, `dependabot`), `run-tickets.yml` (`across`, `follow-ups`, `board`), and `run-default-branch.yml` (`check`, `enroll`, `build`, `conflicts`, `conflict`, `dependencies`, `dependency`, `updates`, `poller`, `unknown`). Each job moves with its id, `name`, `if`, `needs`, `steps`, `permissions`, `concurrency`, `strategy`, and timeouts unchanged. YAML anchors cannot reach another file, so an anchor whose aliases land in more than one file, such as `&install`, `&repositories`, `&uninstalled`, `&extra`, `&session-permissions`, and `&session-secrets`, is written out in each file that uses it, as an anchor of its own there; one used inside a single file, such as `&approval-group`, moves with its jobs. Each file's top-level `permissions` is `contents: read`, as `run.yml`'s is. Every job's `needs` stays inside its group: the approval chain in Pull request, and `board` on `follow-ups` in Tickets.
- `CLAUDE.md`, "Changing the process: this repository", and `docs/developing.md` lines 139, 239 to 247, and 552, list the three files with `run.yml`, `review.yml`, `session.yml`, and `poller.yml` as source edited where it is.
- `docs/github/reference.md` and `docs/updating.md`: as "The pages as they would read" shows them.

## Contracts

- **Each group's inputs:** the ones of `run.yml`'s inputs its jobs read, declared with the same type and default and passed through as `${{ inputs.NAME }}`: `parts`, `job`, `ticket`, `pr`, `review`, `override-label`, and `policy-label` as each group uses them, and to Default branch the build, conflicts, and dependencies minutes and limits.
- **Each group's secrets:** declared `required: false`, as `run.yml`'s are, and passed by name from `run.yml`, exactly those its jobs read today: Pull request `app-key`, `build-token`, `automerge-token`, `claude-token`, and `claude-api-key`; Tickets `app-key`, `build-token`, `board-token`, and `extra`; Default branch the rest its jobs and their `session.yml` calls read, `signing-key` and `extra` included. Read each list from the jobs as they stand when building, not from this note.
- **Each calling job's `permissions`:** the union, per scope, of its group's jobs' `permissions`, taking `write` where any job has it.
- **Each calling job's `if`:** true on every event on which a job inside could start, and on as few others as that allows:
  - Pull request: `pull_request_target` with `opened`, `reopened`, `synchronize`, `ready_for_review`, or `converted_to_draft`; `edited` with a change of base; `labeled` or `unlabeled` with the label named by `inputs.override-label`; and `workflow_dispatch` with the job `order`.
  - Tickets: `pull_request_target` with `opened`, `reopened`, `closed`, `ready_for_review`, or `converted_to_draft`; the 07:00 schedule; and `workflow_dispatch` with the job `board`.
  - Default branch: `push`; every schedule but 07:00; and `workflow_dispatch` with any job but `order`, `board`, `answer`, and `review`, an empty job included, since a ticket alone starts a build.
- A called workflow sees the caller's `github` context, so every job's own `if` reads `github.event` as it does today. Only `inputs` and `secrets` come through the call.

## States

n/a: no state is added. A job is started or skipped as today; a group's call adds one more place a job can be skipped, by the call's `if`.

## Edge cases

- A group's call that holds while none of its jobs would start, such as Tickets for a fork's pull request opened, lists each job of the group as skipped rather than one row. It costs rows, never a job, so it is allowed; a call that is false while a job inside would start is the defect the tests catch.
- `approval-agent`'s matrix row keeps its `(0)`, as in `factory / Pull request / Run an approval policy's agent (0)`.
- A run by hand with neither a job nor a ticket starts no job today; the Default branch call holds for it and lists its jobs skipped.

## Risks and rollback

- **A call's `if` that misses an event** stops a job without a sound, such as the board sync on a pull request made a draft. The unchanged table of "which job an event starts", read through the calls, and the test that a call holds wherever a job inside would start, guard it.
- **A secret or permission left off a call** fails that job when it runs. The tests that compare each call's secrets and permissions with its jobs' catch it before a release.
- **Nesting:** at most four levels (`factory.yml`, `run.yml`, Default branch, and `session.yml`), within GitHub's limit, and `./` in a called file names its own repository at its own commit, as `run.yml`'s call of `session.yml` already relies on in every repository that uses the factory.
- **Rollback:** move the jobs back into `run.yml` and release; nothing in a repository changes either way.

## Dependencies

None. No owner-only step, and no open ticket waits on this one or blocks it.
