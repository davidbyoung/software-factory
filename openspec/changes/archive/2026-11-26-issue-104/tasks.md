## 1. Settings and presets

- [x] 1.1 Parse and validate `approval-policies` (line 1), with a test for each refusal in `tests/config.test.ts`.
- [x] 1.2 Layer policies by name with `off: true`, and copy a preset's `approval-policies/NAME/` with `--in` scoping (lines 36 to 38), tested beside the existing preset tests.
- [x] 1.3 `factory config explain` prints policies with their marks (line 35), tested in its existing file.

## 2. Selecting and running checks

- [x] 2.1 Which policies apply to changed files, renames and new folders included (lines 2, 21), as pure functions with tests.
- [x] 2.2 Build the input from git against the merge base, and fail closed when git can't (lines 4 to 6), tested against a temporary repository.
- [x] 2.3 Run a `run` check with no token in its environment and a 30-minute limit, and read its answer (lines 6 to 8), tested with stub scripts, including one that prints the token's variable to prove it is absent.
- [x] 2.4 Run `run` then `agent`, the agent only on findings (lines 9, 10), with the agent stubbed.

## 3. The status and the label

- [x] 3.0 Upload each run's answers as `approval-policies-PR-HEAD`, find it by name on a labeled event and trust it only from a `pull_request_target` run of `factory.yml`, and keep an approval as `approval-policies-approved-PR-HEAD` (lines 14 to 16, 18), with the code host stubbed; confirm on a scratch repository that `head_sha` is the base's under `pull_request_target`.

- [x] 3.1 Decide the status from the checks' answers (lines 11 to 13), each text tested, the 140-character fallback included.
- [x] 3.2 Approve from the labeled event's actor and head commit, take the label off on a push or base change, and refuse a non-writer's or a stale head's label (lines 15 to 17), tested with the code host stubbed.
- [x] 3.3 The approving-review comment and creating the label (lines 19, 20).
- [x] 3.4 Neither override passes the other's status; Dependabot and `pr-review` off are checked (line 22).
- [x] 3.5 The run summary lists each finding (line 14).

## 4. Workflows, merge policy, and setup

- [x] 4.1 The jobs, permissions, triggers, and concurrency in `run.yml`, and the part, label name, and `edited` in `src/workflow-files.mts` (lines 18, 33, 34), with a test that reads the YAML, as `tests/release-workflow.test.ts` does, for each job's permissions, `persist-credentials: false`, and the concurrency group.
- [x] 4.2 A policy with `agent` makes a pull request `merge-manual` (line 29), tested in the merge policy's tests.
- [x] 4.3 `policy-override` refused by both label commands and the guard hook, and written into `factory.yml` (lines 30 to 32), tested beside `verdict-override`'s tests.
- [x] 4.4 `factory doctor`, `factory init`, and enroll require and report the status, adding it to an existing ruleset (lines 27, 28).

## 5. The command

- [x] 5.0 Build the local input from the working folder, untracked files included, and `--pull N`'s from `refs/pull/N/head` (lines 23, 24), tested against a temporary repository.

- [x] 5.1 `factory approval-policies check`, with `--pull`, each output and exit code (lines 23 to 26), printed through `into` in `tests/printed.ts`.

## 6. Docs and verify

- [x] 6.1 The docs page and the other pages' changes (line 39), and the docs tests in the gate.
- [x] 6.2 Map every Spec line to the test that exercises it, and write any that has none.
- [x] 6.3 Compare each transcript and status text under "Proposed docs" with the real output, in the pull request's "Mockup and result".
- [x] 6.4 Run `factory-trace`, then `factory gate`, `npm run pack-check`, and `factory specs check`.
