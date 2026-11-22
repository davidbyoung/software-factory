# Design

## Where it goes

- **The label.** `src/labels.mts` gains the `factory` key in `TICKET_LABELS`; `src/config.mts` and `settings.schema.json` take `tickets.labels.factory` and `builds.max-per-hour`, following `poll-minutes` for the schema and its message. `factory board collect` and `factory status` pass the label name to `readAll`, so an adapter that can filter on it, as Jira's will, asks only for its own; GitHub's adapter filters what it reads.
- **Adoption.** A helper in `src/ticket.mts`, `adopt(key, d)`, used by `refining`, `claim`, `ready`, and `adopt`; it calls the adapter's `ensureLabel` then `addLabel`. `open` and `followUp` pass the label in `NewTicket.labels`.
- **The interface** (`src/tickets/types.mts`):
  - `Ticket.state` and `closedAt` give way to `finishedAt: string | null`: when the ticket system marked the ticket finished (GitHub: closed). Done, above the adapter, is `finishedAt !== null` or the card in a done column.
  - `listOpen` is renamed `listUnfinished`, unchanged otherwise, for `adopt --all-open`, `factory ticket list`, and the follow-ups lookup. `readAll({ label, board })` becomes required: every ticket with the label not finished, and the 30 with it finished most recently. The default built from `listOpen` goes.
  - `BoardItem.rank: number`, lower first, filled from the Project's item order on GitHub.
  - `ensureLabel(name)`, idempotent.
  - `finish(ticket)`: GitHub closes an open issue and posts nothing.
  - `BoardOps.move(itemId, column)`; `Write` no longer names Status, and `fields.status` leaves `board.mts`, so nothing above the adapter names a field "Status". `create`, `addColumns`, and `addFields` become optional.
  - A `merged` event kind, with the pull request's number and link, for line 14 and Q5.
  - `record: { add(ticket, event): Promise<string>; read(ticket): Promise<Event[]>; remove(id): Promise<void> }`, required. A `reviewer-run` event joins the kinds; GitHub's adapter writes it into the session's one reviewer-runs comment, edited in place, as `src/reviewers.mts` does today. `Event` holds the kind and data the `Marker` union holds today, plus `at`, `id`, and the visible text; `tellsPerson` says whether a person must read it.
  - Statuses: an adapter descriptor in `src/tickets/index.mts` says whether the system has statuses of its own, for line 17.
- **The record above the adapter.** `src/lib/work-status.mts` reads `Event[]` instead of parsing comments: `parseMarkers`, `parseCosts`, `markedComments`, and `workState` take events. Marker parsing moves into `src/tickets/github.mts`, which builds events from comments, keeping the fenced-code and agent-mark rules. `commentBody` keeps writing the text; GitHub's `record.add` posts text plus marker, as today.
- **Cost.** For a ticket note, `takeCost` reads the session's newest `cost` event on the ticket, adds what it spent since the clock's `start`, and restarts the clock only after `record.add` succeeds. `costNote` writes the running-total sentence and the `cost-total` marker. `factory pr cost` keeps today's `cost:` note and clock restart. `issueCost` adds each session's newest total on the ticket to every `cost:` marker on the ticket and its pull requests.
- **Unlabeled cards.** `planSync` already plans only the tickets the snapshot holds, so a card whose ticket was not read gets no write; a test locks that in.
- **Done.** `closedPullComments` gets a merged branch: for each labeled ticket the pull request closes, a `move` to the first done column, then `finish`. `derive` returns Done for a card in any done column or a finished ticket.
- **The sync workflow's condition.** `src/sync.mts:84` writes it with `tickets.board` or an adapter with statuses (line 16a).
- **The sync trigger.** `src/runner/github-actions.mts` gains a dispatch of `factory-board-sync.yml`, beside the build's; a `startSync(d)` in `src/ticket.mts` calls it after each recording command when `tickets.board` is set, catching any error into line 25. `workflows/factory-board-sync.yml` drops `issues`, `issue_comment`, and the `if:` that filtered comments.
- **The poller.** `src/poller.mts`: `FIRE_LIMIT` becomes the setting, or `FACTORY_MAX_PER_HOUR`; `selectToStart` filters by label and sorts by `card.rank`, then `compareKeys`; `FACTORY_LABEL` and `FACTORY_MAX_PER_HOUR` are read as `FACTORY_FOLLOW_UP_LABEL` is today. `workflows/factory-poller.yml` needs nothing new: the scheduled pass reads the settings.
- **factory-deps.** `skills/factory-deps/SKILL.md` gains the step for line 13: write the base branch's `.claude/factory.lock` to a file (`git show origin/BASE:.claude/factory.lock`) and run `factory ticket adopt --all-open --since-lock FILE`, quoting its labeled line in the comment. Change the source, run `node bin/factory.js sync`, and commit both.
- **Docs.** The pages exactly as Proposed docs gives them; `docs/developing.md` "Adding a ticket system" describes `record`, `finish`, `move`, `ensureLabel`, and the optional board operations.

## Contracts

- Settings: `tickets.labels.factory` (string, default `factory`); `builds.max-per-hour` (integer ≥ 1, default 20).
- Environment: `FACTORY_LABEL`, `FACTORY_MAX_PER_HOUR` on the hosted poller, both optional.
- GitHub marker: `<!-- cost-total: AMOUNT session=ID -->` in a comment with the agent mark; the review's `<!-- cost: AMOUNT -->` unchanged.
- Workflow dispatch: `factory-board-sync.yml` on the default branch, no inputs.

## States

A ticket is labeled or not; labeled, it is in one of the six states as today, with done reached by a merge's move, a ticket finished in the ticket system, or a card in any done column. Removing the label freezes its card as it stands.

## Edge cases

- A ticket labeled after it was on the board: the next sync takes it over, writing its column from its record.
- A merged pull request that closes an unlabeled ticket: nothing is moved or commented; GitHub still closes it.
- A done column that is also where the card already sits: no write.
- A session whose clock has no start, such as a review session: its total is from its transcript's start.
- Two sessions writing totals at once: each has its own entry, so neither loses the other's.
- The dispatch from a run in GitHub Actions uses `GITHUB_TOKEN` with `actions: write`, added to the four workflows named in Decisions; a local session uses `gh` as the person.
- The strict adapter's `<!--` rule: GitHub's record lives in comments, so it applies to the strict adapter only.

## Risks and rollback

- **A board that empties.** A repository updated without `factory-deps`, never running `adopt`, sees `factory status` empty and nothing built. The updating page and the "When something goes wrong" row are the guard; the fix is `factory ticket adopt --all-open`.
- **A slower board on GitHub** for a ticket closed by hand, until the nightly run. Rollback: add `issues: [closed]` back to the workflow.
- **Cost totals counted twice** if a legacy `cost:` and a `cost-total` from one session overlap: they cannot, since one session writes only one kind after the update.

## Dependencies

- Waits on nothing open: #59 and #60 are merged.
- #57 waits on this one, recorded on #57.
- One step needs the owner's access: task 1.1 reads board 1 with `gh` holding the `project` scope. Builds here start from a session the owner steers, so the build runs it there; if `gh` lacks the scope, the owner runs `gh auth refresh -s project`.
