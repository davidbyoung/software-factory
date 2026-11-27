## 1. The hosted poller reads the settings

- [x] 1.1 In `tests/poller.test.ts`, a hosted pass whose `fetch` serves a lock (board 1, ready "Approved", label "built-by-factory", cap 5, `own-server`) starts a ticket in "Approved" with that label and not one in "Ready", and the cap of 5 holds; red before the change. Covers Spec 1.
- [x] 1.2 Split `sources` so the lock is read before the board; `tick` takes resolved values; `once` and `onceEach` pass them, and their existing tests stay green unchanged.
- [x] 1.3 Logs: tests for Spec 2, 3 (logged at the first pass, not at a second with the same lock, again when the ready column changes), and 4 (one name with `is`, three with `are`, in order, and none when all are blank).
- [x] 1.4 Not polling: one test each for Spec 5, 6 (`manual` and `github-action`), 7, and 8 (a refused `builds.max-per-hour`, with and without a version difference), each asserting no start comment and no dispatch.
- [x] 1.5 Spec 9: a lock with an unknown top-level key, an unknown key under `tickets`, a refused value under `commands`, and a refused `builds.poll-minutes` still polls.
- [x] 1.6 Spec 10 and 11: two passes with the same reason log it once; the heartbeat after an hour carries it; a count of 3 from failed reads goes to 0 at a pass that reads a lock saying `manual`; a lock with `ready: none` and `own-server` gives Spec 8's line; a pass after a good read and then a bad one starts nothing.
- [x] 1.7 Spec 12 and 13: a 500 on the lock logs `read failed (1 in a row): ...` and increments the count; no token logs `not polling: FACTORY_BOARD_TOKEN not set`.
- [x] 1.8 Rewrite the comments named under "Where it goes"; delete what nothing reads.

## 2. Init and board check

- [x] 2.1 In the init test that covers own-server's "Left to do" (`tests/init.test.ts` or `tests/init-pull.test.ts`, wherever `FACTORY_READY_COLUMN=` is asserted today), assert the two variables and Spec 14's line, for an opened pull request and for one that failed; red before.
- [x] 2.2 In `tests/board.test.ts`, own-server's ready row is `✓ ready      Ready`, and a renamed label and a cap of 40 print no poller block; update the tests that asserted today's lines.
- [x] 2.3 Change `src/init.mts` and `src/board.mts` to pass them.

## 3. Docs and specs

- [x] 3.1 Write the three pages as Proposed docs shows them; `npm run format`; the docs tests pass, including the links to `builds.md#what-it-reads`, `#when-the-poller-and-the-factory-differ`, and `updating.md#the-poller-reads-your-settings`.
- [x] 3.2 `factory specs new 70`, write the requirements for Spec 1 to 17 and the "No longer" lines, `factory specs finish 70`, and `factory specs check` passes.
- [x] 3.3 Verify: map each Spec line to its test (1.1 to 1.7, 2.1, 2.2, the docs tests for 17, and the side-by-side comparison for the wording); write a test for any line without one. Spec 16 is checked by the image's own run in the release, and by `main` needing no other variable (1.7).

## 4. Gate

- [x] 4.1 `npm run format`, then `factory gate`, and `npm run pack-check`. There are no end-to-end specs here.
