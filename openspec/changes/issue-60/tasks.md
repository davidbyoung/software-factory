# Tasks

## 1. The strict memory adapter

- [ ] 1.1 `tests/memory-tickets.ts` takes `{ strict: true }`: keys `PROJ-12`, written as is, comment IDs and authors opaque text, `key`, `ref`, `linkText`, and `linksIn` by the contracts above. Without it, keys are numbers as text, written `#12`. Verify: a test in `tests/ticket.test.ts` that `factory ticket view PROJ-12 --field ref` prints `PROJ-12` fails before 2.1 and passes after.

## 2. The interface and the GitHub adapter

- [ ] 2.1 `src/tickets/types.mts` as in Where it goes, and every caller made to compile. Verify: `npm run check`'s types.
- [ ] 2.2 GitHub `key`, `ref`, `linkText`, `linksIn`, and `refOf`, in `tests/tickets-github.test.ts` against recorded responses: Spec lines 2, 3, 12, 13. Red first.
- [ ] 2.3 GitHub `blockers.list` returns `owner/repo#4` for another repository's blocker, from a recorded response with one: Spec line 19. Red first.
- [ ] 2.4 GitHub writes refuse a pull request's number with `NotFoundError`, a recorded response where the number is a pull request: Spec line 4, for `comment`, `label`, and `cost`, with `view` unchanged. Red first.

## 3. Commands

- [ ] 3.1 `src/ticket.mts`: `keyed()`, `--field ref`, `link --part`, `blockers`, claim's refusal, list order, `--json`. Tests in `tests/ticket.test.ts` against the strict adapter: Spec lines 1, 6, 7, 8, 10, 12, 13, 20. Red first.
- [ ] 3.2 Comment ordering by time with the adapter's order on ties, in `tests/status-lib.test.ts`: two claims with the same time and IDs whose numeric order is the reverse of the adapter's. Line 11. Red first.
- [ ] 3.3 `src/lib/pull-tickets.mts` and its callers, in `tests/status-lib.test.ts` and `tests/board.test.ts` with the strict adapter and `tests/memory-code-host.ts` as not own: Spec lines 14, 15, 16, and with GitHub-shaped tickets as own, line 17. Red first.
- [ ] 3.4 `factory pr closes` output, in `tests/pr.test.ts`: Spec line 18.
- [ ] 3.5 `factory pr cost N`, in `tests/pr.test.ts`: Spec line 21, both outcomes, and that `factory ticket cost` on a ticket is unchanged.
- [ ] 3.6 `factory review tickets N`, in a new `tests/review-tickets.test.ts`: Spec lines 22, 23, 24, with a body that builds part of one ticket before closing another for line 22's order.
- [ ] 3.7 The poller's start order, in `tests/poller.test.ts`: Spec line 9, with `PROJ-9` and `PROJ-12` Ready.
- [ ] 3.8 `factory build` with the strict adapter and `tests/memory-runner.ts`: Spec line 27; `tests/runner-github-actions.test.ts` matches `Build #12` by the run name passed in.
- [ ] 3.9 `factory ticket branch PROJ-12` prints `PROJ-12` with `branch-name: "{ticket}"`: Spec line 31; and `factory specs new PROJ-12` with the strict adapter names `openspec/changes/issue-proj-12/`: Spec line 32.
- [ ] 3.10 Clock and reviewer state: a clock file holding `"issue": 12` is read as `"12"`, in `tests/usage.test.ts` or `tests/reviewers.test.ts`.

## 4. Workflows, guides, and the boundary

- [ ] 4.1 `workflows/factory-build.yml` and `src/sync.mts`: `tests/build-workflow.test.ts` reads the YAML for the text input and its description (Spec line 28); `tests/sync.test.ts` that a GitHub sync writes `Build #${{ inputs.ticket }}` and a strict-key `tickets.type` would write `Build ${{ inputs.ticket }}`, through `refOf`.
- [ ] 4.2 `workflows/factory-claude-review.yml`: `tests/claude-review-workflow.test.ts` reads the YAML for the base install, `review tools` and `review tickets` run in it, `TICKETS` in the prompt (Spec line 25), and the step's fallback note (Spec line 26).
- [ ] 4.3 `review.md` reads `TICKETS`; the boundary test's exemption for its ticket calls goes, and the test passes.
- [ ] 4.4 `tests/boundary.test.ts`: another ticket system's host (Spec line 29) and `Closes #`, `Part of #`, "GitHub issue" in a guide (Spec line 30), each seen failing on a planted line first.
- [ ] 4.5 The guides' wording, as in Where it goes, then `node bin/factory.js sync`. Verify: 4.4 passes, and `Factory files in step`.
- [ ] 4.6 `.claude/skills/ticket-order/order.mts` and `tests/ticket-order.test.ts`: an outside blocker `octo/web#4 open` is "outside", not a parse error. Red first.

## 5. Docs and spec

- [ ] 5.1 `docs/cli.md`, `docs/configuration.md`, `docs/developing.md` from "Proposed docs", section 7. Verify: the docs tests in the gate.
- [ ] 5.2 `factory specs new 60`, write the change from this Spec, `factory specs check`, and `factory specs finish 60` before the pull request is marked ready.

## 6. Verify

- [ ] 6.1 Map every Spec line, 1 to 32, to the test that exercises it in the pull request body; line 5 is covered by lines 6, 19, 20, and 27's tests together with the unchanged GitHub output tests. Name any line without a test, and write it.
- [ ] 6.2 The side-by-side comparison of each transcript under "Proposed docs" with the command's output, in the pull request body.
- [ ] 6.3 `npx --no-install factory gate` and `npm run pack-check`.
- [ ] 6.4 `/factory-trace` before marking the pull request ready, and fix what holds up.
