# Tasks

## 1. The lookup

- [x] 1.1 `writeAccess` in `src/tickets/github-access.mts`. Tests in `tests/github-access.test.ts`, stubbing the transport: `admin` and `write` are true; `read` and `none` are false; a 404 with a readable repository is false; a 404 with an unreadable repository rejects; a 500 rejects; a login with brackets is URL-encoded in the path.
- [x] 1.2 `CodeHost.canWrite` and `Tickets.mayDecide`, each calling it, with `writers` in `tests/memory-code-host.ts` and `deciders` in `tests/memory-tickets.ts`. Verify: `npx tsc --noEmit` passes, the existing tests pass with no fixture changed, and `tests/boundary.test.ts` passes.

## 2. Pull requests

- [x] 2.1 `Report.approvers`, `approverReviewsToWork`, and `formatReport`. In `tests/pr.test.ts`, first add a fixture for an organization's repository (`repository: "acme/x"`, reviewer `alice` in `writers`, `acme` writing nothing) and watch Spec 5 and 6 fail on today's code; then change the code. Add an outsider's review and a bot's review for Spec 7, and a thread one approver opened that another replied on last for Spec 6. Update the expectation at about line 534 to `approver's turn`.
- [x] 2.2 `reviewPending`. In `tests/pr.test.ts`: Spec 1 with the organization fixture, red first; Spec 2 (update the expectation at about line 765); Spec 3; Spec 4 with `fail: { canWrite }`.
- [x] 2.3 `--from-approvers`. In `tests/pr.test.ts`: Spec 8, alone, with `--contains`, and with a comment carrying the agent mark kept.
- [x] 2.4 A failed lookup. In `tests/pr.test.ts`, with `fail: { canWrite }`: `state` and `comments --from-approvers` each print nothing on standard output and exit 1 (Spec 9).

## 3. Answers on a ticket

- [x] 3.1 The `answers` case and its entries in `src/cli.mts`. In `tests/ticket.test.ts`, with `deciders: ["alice"]` and a ticket holding the factory's round (agent mark, by `alice`), `alice`'s reply, and a stranger's comment: only the reply prints, in `view`'s form (Spec 10), red first by running it before the case exists. A ticket with no reply prints the one line (Spec 11). `fail: { mayDecide }` prints nothing on standard output and exits 1 (Spec 12). A ticket that does not exist fails as `view` does (Spec 13). `tests/cli.test.ts` gets the command where it lists them.
- [x] 3.2 The split this ticket exists for: with `deciders: ["pm"]` on the tickets and `writers: ["dev"]` on the code host, `pm`'s comment is an answer and `dev`'s is not (Spec 10), and `pm` adding the override is refused (Spec 16). Verify each fails when the ticket command asks the code host instead.

## 4. The override

- [x] 4.1 `senderIsApprover` and `explainRemoval` in `decide`, and the description. In `tests/review-verdict.test.ts`: update lines 87 to 111, and Spec 14 and 16.
- [x] 4.2 The lookup and the comments in `main`. Pull the part that turns an event into `decide`'s input into a function a test can call with the in-memory code host, then test: an organization's repository with a writer as sender, red first (Spec 14); a second writer adding the label after a `synchronize` removed the first's (Spec 15); a triage account as sender gets the label removed and the Spec 16 comment; `fail: { canWrite }` removes the label, posts the Spec 17 comment, and throws.

## 5. Cost

- [x] 5.1 `parseCosts`, `issueCost`, and `planSync`, with the test callers under "Where it goes". In `tests/status-lib.test.ts`: a cost comment with the agent mark from an account that is not the repository's owner counts, red first (Spec 18); one without the mark from any account but the CI bot does not, and the CI bot's still counts (Spec 19). In `tests/board.test.ts`: a ticket in `acme/x` whose cost comment an agent account posted shows its Cost.

## 6. Skills, the agents, and docs

- [x] 6.1 The five prose changes under "Where it goes", then `node bin/factory.js sync`. Verify: `npm run check` passes its files-in-step check, no `OWNER_LOGIN` is left under `skills/`, `agents/`, or `.claude/skills/dx-first/` (`grep -rn OWNER_LOGIN skills agents .claude/skills/dx-first` prints nothing), and no renamed output string is left in the source or the skills (`grep -rn -e "owner review bodies" -e "owner's turn" -e "someone else's" -e "of the owner's in it" src skills agents` prints nothing).
- [x] 6.2 The docs, Spec 20 to 25, and the `mayDecide` row in `docs/developing.md`. Verify: no `approvers` setting, section, or link is left (`grep -rn -E '`approvers`|#approvers|^approvers:' docs README.md` prints nothing), and `tests/docs.test.ts` passes.
- [x] 6.3 The fresh-agent trace over the branch with `.claude/change-types.md`, since the skills' triggers changed. Fix what holds up.

## 7. Verify

- [x] 7.1 Map every Spec line to its test: 1 to 9 `tests/pr.test.ts`; 10 to 13 `tests/ticket.test.ts`; 14 to 17 `tests/review-verdict.test.ts`; 18 and 19 `tests/status-lib.test.ts` and `tests/board.test.ts`; 20 to 25 by `grep` and `tests/docs.test.ts`. Name any line without one and write it.
- [x] 7.2 Run `factory pr state`, `factory pr comments --from-approvers`, and `factory ticket answers` against a real pull request and ticket in this repository, and put each output beside its transcript from "Proposed docs" in the pull request.
- [x] 7.3 `npm run format`, then `npm run check`.
