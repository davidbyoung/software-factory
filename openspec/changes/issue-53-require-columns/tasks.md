# Tasks

## 1. Settings

- [ ] 1.1 `src/config.mts`: required block and states (lines 1 to 6), with tests in `tests/config.test.ts` for each message, an empty and a null block, the one-state wording, `none` and lists, a preset supplying states, and no board. Update the fixtures that set a board without a block.
- [ ] 1.2 `settings.schema.json` (line 24), checked by `tests/settings-schema.test.ts`.

## 2. Init

- [ ] 2.1 `src/columns-suggest.mts`: Yes, Change some, and No write all six (lines 9 to 11), in `tests/columns-suggest.test.ts`.
- [ ] 2.2 `src/init.mts`: a created board and a board with every column write all six (lines 7 and 8), `Add a column called "Ready"` writes `ready: Ready` (line 12), and the poller lines end with `FACTORY_READY_COLUMN` (line 21), in `tests/init.test.ts`.
- [ ] 2.3 `src/init.mts`: the re-run on a file missing states (lines 13 to 18), in `tests/init.test.ts`, with the fake board: every missing state on the board, one missing state off the board, one on and one off, one whose column a written state already names, a missing `ready` with builds from the board turned on, no block on a board with every column, a board with no columns, and a file with another fault still stopping.

## 3. Poller and board check

- [ ] 3.1 `src/poller.mts`: `FACTORY_READY_COLUMN` required (lines 19 to 22), in `tests/poller.test.ts`, updating the `readConfig` and `not polling` tests.
- [ ] 3.2 `src/board.mts`: the ready row for Ready, and `ready: none` unchanged (line 23), in `tests/board.test.ts`.

## 4. Docs, skill, and this repository

- [ ] 4.1 The docs pages as Proposed docs shows them (line 25); `tests/docs.test.ts` passes.
- [ ] 4.2 `skills/factory-deps/SKILL.md`, then `node bin/factory.js sync`; `factory sync --check` passes.
- [ ] 4.3 `.claude/factory.yaml` names all six states for board 1; `npx --no-install factory config check` and `factory board check` pass.

## 5. Verify

- [ ] 5.1 Map every Spec line to the test that exercises it, and write a test for any without one. Line 25 is checked by the docs tests and the review.
- [ ] 5.2 Run each Proposed docs transcript against the built command and put the side-by-side comparison in the pull request.
- [ ] 5.3 `npm run format`, then `npx --no-install factory gate`, and `npm run pack-check`.
- [ ] 5.4 Run `factory-trace` before marking the pull request ready.
