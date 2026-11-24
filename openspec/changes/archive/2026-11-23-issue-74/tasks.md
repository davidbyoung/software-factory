# Tasks

## 1. Test first

- [ ] 1.1 Say in the session what will be created under `aphiria`, then run the seven checks in public scratch repositories on a `trunk` branch. The draft's third cannot run there. Checks 1 and 4 of "To test first" above use a repository's own rule, which GitHub Free allows in a public repository. Record each result in the pull request, and take the fallback where one fails.

## 2. The organization

- [ ] 2.1 The code host's organization members, lines 1 to 3, with the API stubbed, in `tests/code-host-github.test.ts`.
- [ ] 2.2 The manifest flow, lines 8 to 10, in a new `tests/github-app.test.ts`, with the listener, `fetch`, and the clock stubbed.
- [ ] 2.3 `factory init --org`, lines 4 to 7 and 11 to 15, in `tests/init-org.test.ts`, one test for each transcript.

## 3. The run's token

- [ ] 3.1 The three workflows and the two files' new line, lines 20 to 25, read as YAML in `tests/workflows.test.ts`, and `factory session repositories` in `tests/session.test.ts`.
- [ ] 3.2 `factory enroll`, line 26, in a new `tests/enroll.test.ts`.

## 4. The poller

- [ ] 4.1 `--preset` and the pass for each repository, line 16, in `tests/poller.test.ts`.
- [ ] 4.2 `poller.yml`, the update of `factory-poller.yml`, and `preset check`, lines 17 to 19.
- [ ] 4.3 The lock and the sync, lines 55 and 56, in `tests/sync.test.ts` and `tests/doctor.test.ts`.

## 5. A repository

- [ ] 5.1 Which repository, lines 27 to 31, in `tests/init.test.ts` and `tests/default-branch.test.ts`.
- [ ] 5.2 Presets first, lines 32 to 37.
- [ ] 5.3 The organization's rows and the parts, lines 38 to 41.
- [ ] 5.4 The gate and the pull request, lines 42 to 50, with git, the gate, and the code host stubbed.
- [ ] 5.5 The tokens on the machine, lines 51 to 54, in `tests/init.test.ts` and `tests/credentials.test.ts`.

## 6. Docs, specs, and the process

- [ ] 6.1 The docs, lines 59 and 60, read by `docs-reader`. "What is built" in `docs/developing.md` gains this ticket's parts.
- [ ] 6.2 `factory specs new 74`, each capability's lines, and `factory specs finish 74`.
- [ ] 6.3 `factory-trace` before the pull request is marked ready, and `CLAUDE.md` and `.claude/change-types.md` where they name how a repository is set up.

## 7. Verify

- [ ] 7.1 Map each Spec line to its test, and write any that is missing. Lines 17, 20 to 22, and 25 are checked by reading the YAML.
- [ ] 7.2 `factory gate` and `npm run pack-check`.
