# Design

## Where it goes

- **The interface, `src/tickets/types.mts`.** `export type Key = string`. Every ticket ID becomes a `Key`: `Ticket.key`, `TicketSummary.key`, `BoardItem.key`, `Board.items: Map<Key, BoardItem>`, `Blocker.key`, and each operation's `ticket` and `by` argument. `open` returns a `Key`. `TicketComment.id`, the ID `comment` and `attachments.comment` return, and `editComment`'s and `deleteComment`'s argument are `string`. Comments come back oldest first, which the type's comment says, since line 11 relies on it. New on `Tickets`:
  - `key(typed: string): Key`, which throws `KeyError` with Spec line 2's or 3's message.
  - `ref(key: Key): string`, the written form, for this repository's tickets and for a key `blockers.list` returned. `key` checks only what a person typed: `blockers.list`, `ref`, and `compareKeys` take any key the adapter returned, `octo/web#4` included, without calling it. `ticket blockers` prints in the adapter's order, unsorted, as today.
  - `linkText(key, kind: "closes" | "part")`, replacing today's one-argument `linkText`.
  - `linksIn(body): { closes: Key[]; partOf: Key[] }`, in the body's order, without duplicates.
  - `compareKeys(a, b)` beside `readAll`, as `a.localeCompare(b, "en", { numeric: true })`, used by `ticket list`, the poller's start order, and the follow-ups ticket's pick of the oldest (`src/ticket.mts` around line 307).
- **The pure per-type form, `src/tickets/index.mts`.** `refOf(type)` returns the written form function for a `tickets.type` without opening an adapter, so `factory sync` can write the build workflow's run name. The GitHub adapter's `ref` is the same function.
- **The GitHub adapter, `src/tickets/github.mts`.** `key` accepts `^[1-9]\d*$`, and gives Spec line 3's message for `^[\w.-]+/[\w.-]+#\d+$` and Spec line 2's otherwise. `ref` is `#12`, or the key as is when it already holds `/`. `linksIn` matches `closes #N` and `part of #N`, case-insensitive, as `buildsIssue` and `buildsPartOf` do today. `blockers.list` reads each blocker's repository from the response (`repository_url` or `html_url`) and returns `owner/repo#4` when it is not this repository. `read` already throws `NotFoundError` for a pull request's number (around line 459), which covers `view`, `answers`, and every command that reads first. Before any write by ticket number, the adapter confirms the number is an issue, not a pull request, and throws `NotFoundError` otherwise (Spec line 4); it may remember the answer for the rest of the run. `readAll` already tells pull requests apart.
- **Links above the adapter, `src/lib/pull-tickets.mts` (new).** `ownLinks(settings)`: true when `tickets.type` and `code-host.type` are both `github`. `ticketsOf(pull, tickets, own)`: `{ closes, partOf }`, where `closes` is `pull.closes` (the code host's list) when `own`, and `linksIn(body).closes` otherwise, and `partOf` is always `linksIn(body).partOf`. `buildsIssue` and `buildsPartOf` in `src/lib/work-status.mts` go; `issueCost`, `reviewingPulls`, `src/status.mts` (around line 168), and `src/board.mts` (`closedPullComments` around line 518, and the event's `closes` around line 651) call `ticketsOf`. The sync's In review for Spec line 14 comes through `reviewingPulls`.
- **The code host, `src/code-host/types.mts` and `github.mts`.** `closes(pull)` and `PullRequest.closes` hold `Key[]`, the code host's own links. `linking(skip)` is called only when `ownLinks`; otherwise the sync's `read` passes no closed pull requests.
- **The runner, `src/runner/`.** `startBuild(key, branch)`; `findBuild(runName, since)`, matching `display_title === runName`. `src/build.mts` passes `Build ${ref}` and prints line 27.
- **Commands.** `src/ticket.mts`: `numbered()` becomes `keyed()`, calling `t.key`; `--field ref`; `link --part`; `blockers` prints `ref` and state; claim's `blocked by:` and `follow-up`'s `added to #4` (around line 311) use `ref`; `cost` posts on a ticket only, and the comment at `label` about GitHub labeling a pull request goes, while `refuseOverride` stays. `src/pr.mts`: `pr cost N` (Spec line 21), sharing the clock and `costNote` with `ticket cost`; `pr closes`, near line 493, calls `ticketsOf` (Spec lines 17 and 18). `pr cost N` on a number that is not a pull request fails at the code host's `get` (Spec line 21). `src/review-tickets.mts` (new) for `factory review tickets N`, beside `review tools` and `review cost` in `src/cli.mts`.
- **The clock and reviewer state, `src/lib/clock.mts`, `src/reviewers.mts`, `src/lib/usage.mts`.** `Clock.issue: string | null`; `readClock`'s check (`Number.isInteger(clock.issue)`, line 33) accepts a string, and a clock file written before this change holds a number, read as its string. `costNote` takes the written form. Reviewer state paths use the key.
- **The sync, `src/sync.mts`.** It has no run-name handling yet: add one replace beside the cron and list replaces, on the build workflow's `run-name:` line, writing `Build ${refOf(tickets.type)("${{ inputs.ticket }}")}`. The source keeps `Build #${{ inputs.ticket }}`, which is what a GitHub sync writes, so this repository's copy does not change.
- **Workflows.** `workflows/factory-build.yml`: `ticket` input `type: string`, `description: The ticket's key, such as 12`; the prompt says "Build ticket ${{ inputs.ticket }}" and passes the key to `factory-build`, which reads the written form with `--field ref`. `workflows/factory-claude-review.yml`: after checkout, `git worktree add "$RUNNER_TEMP/base" "$BASE"` and `npm ci` there; "List the tools" runs `npx --no-install factory review tools` in that folder; a new step runs `npx --no-install factory review tickets "$PR" > "$RUNNER_TEMP/tickets.md"` there with `GH_TOKEN`; the prompt adds `TICKETS: ${{ runner.temp }}/tickets.md`. The base install and both commands run with `set +e` around them, so a failure writes line 26's note, or for `review tools` falls back to the head's install, and never fails the job. The base install needs no registry setup the head's `npm ci` lacks today.
- **The guides.** `review.md` step 4 reads the file `TICKETS` names, in place of `gh pr view ... closingIssuesReferences` and the GraphQL issue read; the boundary test's `review.md` exemption for ticket calls goes. In `skills/`, `agents/`, and `rules.md`: `Closes #N` and `Part of #N` become "the line `factory ticket link N` prints" and "the line `factory ticket link N --part` prints"; `#N` for a ticket becomes its written form from `--field ref`, or the key where a command takes it; "GitHub issue" becomes "ticket"; `factory ticket cost PR` becomes `factory pr cost PR` (`factory-build` and `factory-address-review`); the "read the issue it closes" steps in `factory-resolve-conflicts` and `factory-address-review` name `factory pr closes` and `factory ticket view`. `grep -n "#N\|#M\|Closes #\|Part of #\|GitHub issue" skills agents rules.md review.md workflows` finds them. Run `node bin/factory.js sync` and commit the copies.
- **This repository's `ticket-order` skill, `.claude/skills/ticket-order/order.mts`.** Reads `key` and `ref` from `ticket list --json`, and parses each `blockers` line as `REF STATE`, matching it to an open ticket by `ref`, with `unblocks`, `waitsOn`, and the cycle and outside findings holding keys; a blocker in another repository is "outside", as one not open here is today.
- **Docs.** `docs/cli.md`, `docs/configuration.md`, and `docs/developing.md` take the lines under "Proposed docs", section 7. `openspec/specs/branch-name/` takes lines 31 and 32 through `factory specs finish`.

## Contracts

- Key grammar: GitHub `^[1-9]\d*$`; another GitHub repository `owner/repo#N`, accepted only from `blockers.list`; strict memory keys `^[A-Z][A-Z0-9]*-[1-9]\d*$`.
- Written form: GitHub `#N` or `owner/repo#N`; strict memory the key as is.
- Link lines: `Closes <ref>` and `Part of <ref>`, matched case-insensitively at a word boundary and not followed by a digit, as today.
- The build workflow input `ticket`, text; its run name `Build <ref>`.
- `factory review tickets` output: `## <ref> <title>`, blank line, body; tickets separated by one blank line.
- `--json`: `key` (text) and `ref` replace `number`; comment `id` is text.

## States

No new state. A claim, a refinement marker, and a cost marker carry the same text as today; only the ID that identifies the ticket they sit on changes type.

## Edge cases

- A clock or reviewer state file written before this change, with a number: read as its string, so a session that spans the upgrade keeps its clock.
- Two marker comments with the same time: stable sort by time over the adapter's order (Spec line 11). `src/lib/work-status.mts` line 275's tiebreak by ID goes.
- A pull request's body links the same ticket twice, or both closes and builds part of it: `linksIn` returns each key once per list, and `review tickets` prints it once.
- A body's `Closes #12` that GitHub did not register: with own links it does not count as closing, as GitHub will not close it; `factory-build`'s check that `pr closes` prints the ticket still catches it.
- `octo/web#4` passed to `block --by`: Spec line 3, until #57.
- The memory adapter in strict mode gives comment IDs and authors as opaque text, such as `c-7f3a` and `557058:9a1b`, so nothing can parse them as numbers.

## Risks and rollback

- This pull request's own Claude review runs on a base that predates `factory review tickets`, so Spec line 26's fallback fires there; the first review that reads tickets this way is the first after the merge. Say so in the pull request body.
- A GitHub output line changes by accident. The existing tests pin today's output; run them unchanged against the GitHub-shaped memory adapter. Rollback is the revert.
- The base commit's install fails, or predates `factory review tickets`, as every pull request opened before this merges does until it is brought up to date: line 26 keeps the review running from the body. For `factory review tools` in the same case, the step falls back to the head's install, as it runs today, and says so in its log.

## Dependencies

- None to start. #57, #61, and #63 wait on this ticket, recorded as blocked-by links.

## Where the build departed

- The review workflow runs the factory from the base install with a step's `working-directory`, not `cd`: the boundary test refuses a factory command after a `cd`. When the base cannot install, both steps run in the head's checkout, `review tools` as it does today and `review tickets` not at all, leaving Spec line 26's note.
- The reviewer reads the tickets file with the Read tool, which needs the runner's temporary folder named with `--add-dir`.
- The GitHub adapter remembers each number its reads returned as an issue, so the sync and the poller, which read every ticket first, make no extra request before a write.
- `factory specs new` and `finish` take a key, refusing one the ticket system does not use with Spec line 2's message, where they took only a whole number.
