# Tasks

## 1. Cloud runs

- [x] 1.1 `src/handoff/`, lines 72 to 76, in `tests/handoff.test.ts`: every method a skill reaches, one test that an unrecorded read exits 1, and one that each write is a request.
- [x] 1.2 Prepare, lines 77 to 79, in `tests/session-prepare.test.ts`.
- [x] 1.3 Publish, lines 80 to 88, in `tests/session-publish.test.ts`, with real bundles made by git in a temporary folder, one for each refusal, each with a control that passes.
- [x] 1.4 The sandbox and `builds.hosts`, lines 66 to 68, 96, and 97, in `tests/session-run.test.ts` and `tests/config.test.ts`.
- [x] 1.5 The workflows, lines 20 to 25, 65, 69 to 71, and 89 to 91, read as YAML in `tests/workflows.test.ts`.
- [x] 1.6 The review and the verdict, lines 92 to 95, in `tests/review-verdict.test.ts` and `tests/review-record.test.ts`.
- [x] 1.7 The skills and the rules where they push, pull, wait, or name a number GitHub has not given, and `factory-trace`.
- [x] 1.8 Live, in scratch repositories: each kind of run with a real session, and the bad builds and the hostile pull request of the research.
