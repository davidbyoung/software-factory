# Tasks

## 1. The list

- [ ] 1.1 `parse`, `add`, and `opened` in `src/follow-ups.mts`. Test first in `tests/follow-ups.test.ts`: lines 1, 3, 4, 6, 8, and 12, with a description that has text after and before the list.
- [ ] 1.2 `factory follow-up`, with the code host stubbed by `tests/memory-code-host.ts`, printing through `into`: lines 1 to 6.
- [ ] 1.3 `factory pr follow-ups --event`, with `tests/memory-tickets.ts`: lines 7 to 13 and 23. Verify a rerun after a failed write opens nothing twice.

## 2. What goes away

- [ ] 2.1 Remove the `follow-up` label key and each reader. Update `tests/config.test.ts`, `board.test.ts`, `status.test.ts`, `status-lib.test.ts`, `poller.test.ts`, `ticket.test.ts`, `tickets-github.test.ts`, `columns.test.ts`, `merge-order.test.ts`, `merge-policy.test.ts`, `guard-ticket-text.test.ts`, `ticket-repositories.test.ts`, `remove.test.ts`, and `pull-tickets.test.ts`: lines 19 to 22, 24 to 26, and each "No longer". Verify `grep -rn "followUp\|FOLLOW_UP" src` finds nothing of the label.

## 3. The cloud

- [ ] 3.1 `handoff/requests.mts` and `session-publish.mts`, in `tests/handoff-requests.test.ts` and `tests/session-publish.test.ts`: lines 15 and 16, with a build that opened a pull request, one that opened none, an answer, a review, and a refusal.
- [ ] 3.2 `session-prepare.mts`, in `tests/session-prepare.test.ts`: lines 17 and 18.
- [ ] 3.3 The job in `run.yml`, read as YAML in `tests/workflows.test.ts`: line 14, its permissions, and that `board` still runs when it is skipped or fails.

## 4. The text

- [ ] 4.1 The docs, as "Proposed docs" has them, with `docs-reader` on the rewritten section and the docs tests green.
- [ ] 4.2 The rules, skills, agents, and review instructions, then `node bin/factory.js sync`. Verify `grep -rin "follow-ups ticket\|follow-ups issue"` finds only `docs/updating.md`, `openspec/changes/archive`, and tests of what is gone.
- [ ] 4.3 The fresh-agent trace ("Changing the process").

## 5. Verify

- [ ] 5.1 Map each Spec line to the test that exercises it, and write any that is missing.
- [ ] 5.2 Run it once for real, in a scratch repository on GitHub that is a copy of the branch, as the pull request for #73 did: tick one box of two, merge, and see one ticket opened, the description linked, and a rerun that opens nothing. First see that the `closed` event's body holds a tick made just before the merge, since line 9 rests on it: if it does not, stop and say so.
- [ ] 5.3 `factory gate`.
