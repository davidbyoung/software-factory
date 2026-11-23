# Tasks

## 1. Test first

- [ ] 1.1 Run the four checks above and the draft's two in a private scratch repository made with `gh repo create` and deleted after, calling `run.yml` at the branch's SHA. Record each result in the pull request, and take the fallback where one fails. A session that cannot make one stops and reports.

## 2. One install

- [ ] 2.1 The launcher and the cache, lines 1 to 4. Tests in `tests/launch.test.ts`, with `exists`, `readName`, and a stubbed download.
- [ ] 2.2 Hooks, line 5, in `factoryHooks`. Tests in `tests/sync.test.ts`, and `tests/pack-check.mts` runs with no `package.json`.
- [ ] 2.3 `init`, `remove`, and `doctor`, lines 30, 46, and 47, in their own test files.
- [ ] 2.4 The text, line 6: one test that no file under `skills/`, `agents/`, `rules.md`, `workflows/`, or `src/` holds `npx --no-install factory`.

## 3. Presets from a repository

- [ ] 3.1 The adapter's fetch, against a local bare repository in `tests/preset-fixture.ts`, which replaces the fake `node_modules`.
- [ ] 3.2 The lock, sync, and `--check`, lines 37, 38, 40, 44, and 45, in `tests/preset-sync.test.ts`.
- [ ] 3.3 `add`, `remove`, `check`, `changes`, and doctor, lines 31 to 36, 39, and 41 to 43, in `tests/preset-commands.test.ts`.

## 4. The workflows

- [ ] 4.1 `run.yml`, `review.yml`, and the two templates, lines 7 to 15. Tests read the YAML, as `tests/release-workflow.test.ts` does, in one new file that replaces `actions-workflows`, `build-workflow`, `claude-review-workflow`, `poller-workflow`, and `deps-auto-merge-workflow`, and takes the workflow assertions of `merge-policy`, `board`, `boundary`, `npm-sync`, and `fork-safety`.
- [ ] 4.2 Parts off and the review's identity, lines 16 to 19, in `tests/pr.test.ts`, `tests/pr-watch.test.ts`, `tests/review-verdict.test.ts`, and `tests/runner-github-actions.test.ts`.
- [ ] 4.3 The policy, lines 20 to 22, in `tests/init.test.ts` and `tests/doctor.test.ts`, with the API stubbed.

## 5. Updates

- [ ] 5.1 `factory update` and `--pull-requests`, lines 23 to 29, in a new `tests/update.test.ts`, with the code host and git stubbed.

## 6. Docs, specs, and the process

- [ ] 6.1 The docs, lines 49 and 50, read by `docs-reader`. "What is built" in `docs/developing.md` gains this ticket's parts.
- [ ] 6.2 `factory specs new 73`, each capability's lines, and `factory specs finish 73`.
- [ ] 6.3 `factory-trace` before the pull request is marked ready, and `CLAUDE.md` and `.claude/change-types.md` where they name a workflow file.

## 7. Verify

- [ ] 7.1 Map each Spec line to its test, and write any that is missing. Lines 11 and 12 are checked by reading the YAML, and 13 in the runner's tests.
- [ ] 7.2 `factory gate` and `npm run pack-check`.
