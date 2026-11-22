## 1. Check the board's order

- [ ] 1.1 In a local session with `gh` holding the project scope, on this repository's board 1, read the Project's items through the API, as `src/tickets/github.mts` reads them, with two Ready cards reordered by hand; record in the pull request whether the order follows the board. If it does not, drop line 22 to key order on GitHub and write the docs that way.

## 2. The strict adapter

- [ ] 2.1 Extend `tests/memory-tickets.ts` per line 32: statuses with allowed moves, no open or closed, `<!--` refused, labels created before use. Each later group's tests run against it and fail before their change.

## 3. The interface

- [ ] 3.1 `finishedAt`, required `readAll({ label, board })`, `ensureLabel`, `finish`, `BoardOps.move`, optional `create`/`addColumns`/`addFields`, `record`, and the statuses flag, in `src/tickets/types.mts` and `index.mts`; GitHub's adapter implements them; tests in `tests/tickets-github.test.ts` and the memory adapter's.
- [ ] 3.2 Move marker parsing into GitHub's adapter; `work-status.mts` reads events (line 27, 28). A test reads today's comments, old `cloud` markers included, through GitHub's adapter and gets the same derived states as before.
- [ ] 3.3 The memory adapter keeps events apart and comments only for `tellsPerson` (line 29).

## 4. The label

- [ ] 4.1 Setting, explain, and check (lines 1, 2, 8), in the labels-setting tests.
- [ ] 4.2 Sync, status, and both pollers act only on labeled tickets (lines 3, 4, 5).
- [ ] 4.3 Tickets the factory opens carry it, and the label is created first (lines 6, 9).
- [ ] 4.4 Adoption by `refining`, `claim`, and `ready` (line 7).
- [ ] 4.5 `factory ticket adopt`, `listUnfinished`, and `--since-lock` (lines 10, 11, 12, 12a); `factory ticket list` and the follow-ups lookup still see unlabeled tickets.
- [ ] 4.6 `factory-deps` labels on the first update with the label (line 13): the skill's source, then `node bin/factory.js sync`.

## 5. Done as a column

- [ ] 5.1 The merge moves to the first done column and finishes (line 14); a card in any done column is left alone (line 15); no board reads finished as done (line 16).
- [ ] 5.2 Columns required with statuses (line 17), with a test adapter descriptor that has statuses.
- [ ] 5.3 `factory status`'s done line (line 18).

## 6. The poller

- [ ] 6.1 `builds.max-per-hour` in config, schema, and both pollers, with its messages (lines 19, 20, 21).
- [ ] 6.2 Board order (line 22), as task 1.1 found.
- [ ] 6.3 `factory board check`'s two lines (line 23).

## 7. The sync's trigger

- [ ] 7.1 Each recording command starts the sync; a failed start prints line 25's line and keeps the exit code (lines 24, 25).
- [ ] 7.0 The sync workflow's condition (line 16a), and `actions: write` on the four workflows, each read from its YAML in a test.
- [ ] 7.2 The workflow's triggers (line 26), read from its YAML in the test, as `tests/release-workflow.test.ts` reads its workflow.

## 8. Cost

- [ ] 8.1 The running total, its sentence and marker, and a clock restarted only after the post (line 30), with tests that a failed post retried writes the same total, and that refining then claiming one ticket keeps the refining spend.
- [ ] 8.2 Cost from the newest total per session plus legacy markers (line 31), with a test that a retry's equal total changes nothing and two sessions' totals both count.

## 9. Docs and specs

- [ ] 9.1 Write the pages as Proposed docs gives them; `docs/developing.md`'s adapter section.
- [ ] 9.2 `npx --no-install factory specs new 61`, fold the lines in, `npx --no-install factory specs finish 61`.
- [ ] 9.3 Verify: map every Spec line to its test in the pull request body; write a test for any line without one.

## 10. The gate

- [ ] 10.1 `npm run format`, then `npx --no-install factory gate`, and `npm run pack-check`. No end-to-end suite here.
- [ ] 10.2 This changes the code that decides what runs (`board.mts`, `poller.mts`, `lib/work-status.mts`, a workflow): run the `factory-trace` skill before marking the pull request ready.
