# Tasks

## 1. The cap from start comments

- [ ] 1.1 A pure function counting start comments in the past hour from the snapshot, used by `capAllows` with the tick's own starts; tests in `tests/poller.test.ts` for 19 and 20 starts, one over an hour old, a restart with an empty state, and 25 Ready tickets in one tick with none started before, of which 20 start (lines 8 and 9)

## 2. `factory poller --once`

- [ ] 2.1 `--once` in `src/poller.mts` and its route in `src/cli.mts`; tests with the fetch stubbed for a start, a failed read exiting 1, and the settings read (lines 1 to 4)

## 3. The settings

- [ ] 3.1 `builds.poll-minutes` in `src/config.mts` and `settings.schema.json`, and the `github-action` refusal removed; tests in `tests/config.test.ts` (lines 10 to 13), and `tests/settings-schema.test.ts` still matching

## 4. The workflow

- [ ] 4.1 `workflows/factory-poller.yml`, its `NEEDS` entry and cron rewrite in `src/sync.mts`; tests in `tests/sync.test.ts` that it is written for `github-action` with each interval's cron, deleted otherwise, and has the concurrency group (lines 5 to 7), reading the YAML as `tests/release-workflow.test.ts` does

## 5. `init`, `doctor`, `remove`, and `status`

- [ ] 5.1 `isPrivate` on the code host and `workflowState` on the runner, with their recorded-response tests
- [ ] 5.2 `init`'s two questions, its "Left to do" step, and the part's text; tests in `tests/init.test.ts` for a public and a private repository and a re-run (lines 14 to 21)
- [ ] 5.3 `doctor`'s workflow check (lines 22 and 23) and `remove`'s leftover (line 24)
- [ ] 5.4 `status`'s wait and flag text by trigger, in `tests/status-lib.test.ts` (lines 25 and 26)

## 6. The image

- [ ] 6.1 `poller.Dockerfile` installing the version from a build argument, with its label; a test reading it for the install, the label, and the command
- [ ] 6.2 The release job; a test in `tests/release-workflow.test.ts` that it needs `publish`, has `packages: write`, and pushes both tags (line 27)
- [ ] 6.3 Build the image locally from the latest published version and run it with a stubbed board unreachable, showing it starts the poller (line 28); put the output in the pull request

## 7. Docs

- [ ] 7.1 Lines 31 to 33. `tests/docs.test.ts:255` expects `factory poller --once` among `docs/cli.md`'s planned commands, and once it is Built none is left. That test reads a sample `cli.md` text with one Planned row instead, as the unit tests at lines 143 to 155 do, and "mark every use of a planned command" stays as it is

## 8. Verify

- [ ] 8.1 Map every Spec line to its test, and name any line checked only in the pull request (lines 27 to 30 partly, and `init`'s look)
- [ ] 8.2 The side-by-side comparison of `init`'s output for each choice, in the pull request
- [ ] 8.3 The gate (`npm run check`), and `npm run pack-check`
