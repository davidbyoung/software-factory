# Act only on tickets with the factory label, and track their state through the adapter

From [#61](https://github.com/davidbyoung/software-factory/issues/61).

## Why

#### What and why

The factory treats every ticket and every card in a repository as its own. That holds for one person working alone. On a board a team shares, it overrides people's work, and a Jira board is always shared.

- **It puts every open ticket on the board.** The sync adds a card for any ticket that lacks one (`apply` in `src/board.mts`).
- **It moves people's cards back.** A ticket's column is worked out only from the factory's own comments (`derive` in `src/lib/work-status.mts`). A card someone drags to the building column, to work the ticket by hand, is moved back to the backlog on the next sync.
- **Anyone's move to Ready starts a build,** of any ticket.

Three more things above the adapter are GitHub's model, and Jira and Linear do not share them.

- **Open and closed.** `Ticket.state` is `open` or `closed`, a closed ticket is Done, and GitHub closes it when a pull request with `Closes #N` merges. Jira and Linear have only statuses, and nothing closes a ticket there on a merge. For many teams merged is not done either: UAT and Released come after.
- **State kept in comments.** Claims, state changes, and costs are hidden HTML comments in ticket comments. Jira shows them as text. A refine and a build post three to seven comments on a ticket, and in Jira each one emails the ticket's watchers.
- **A sync started by GitHub's events,** for a ticket opened or closed and a comment posted, which Jira and Linear cannot send to GitHub.

**Decided by the owner on 2026-11-22:**

- A factory label always marks which tickets are the factory's, on GitHub too. A labeled ticket moved to Ready is still built.
- Done is a column. The factory's work ends at the merged pull request: it moves the ticket to the first column `tickets.columns.done` lists, and what comes after is the team's.
- The factory closes a ticket itself. It never depends on a ticket system's own integration with the code host, since `factory init` must be the only setup step.
- Session, Runs in, and Cost keep following `tickets.fields`, on every ticket system.
- A comment is for a person to read. Bookkeeping goes where a ticket system can hide it.

This is the second of three groundwork tickets before Jira (#63), after #60.

#### Done when

**What is the factory's**

- The factory acts only on tickets that carry the factory label: the sync, `factory status`, the poller, and a claim. It adds the label to every ticket it opens. A ticket without the label is never moved, added to the board, commented on, or built by the sync, `factory status`, or the poller. Naming one in a session, by `/factory-refine N` or `/factory-build N`, adds the label first and says so.
- A labeled ticket moved to Ready is built, and one moved to the backlog is sent back, as today.
- A repository that already uses the factory has its open tickets labeled once when it updates, so no ticket drops out of the factory's view: `factory-deps` labels them on the update whose old `.claude/factory.lock` has no `tickets.labels.factory`, and `factory ticket adopt --all-open` does it by hand.
- The label's name is a setting, where #59 puts label names, and `factory` unless the repository says otherwise.

**Columns**

- The adapter moves a ticket to a column. Nothing above it writes a Status option or names a field "Status".
- When the pull request that closes a ticket merges, the factory moves the ticket to the first column `tickets.columns.done` lists. A ticket in any column listed there is done, and the factory leaves it alone. Where there is no board, as on GitHub without a Project, a closed ticket is done. On GitHub a user sees only what "What a GitHub user notices" in Proposed docs lists.
- The interface has no open or closed. Every adapter returns the tickets finished lately, so Done is written for each: today's default `readAll` returns only open tickets.
- `tickets.columns` is required whenever the ticket system has statuses, not only when `tickets.board` is set, which is #53's wording.
- Builds start in the board's own order, not lowest number first, and the cap of 20 starts an hour (`FIRE_LIMIT` in `src/poller.mts`) is a setting, `builds.max-per-hour`. The hosted poller reads it and the label's name from `FACTORY_MAX_PER_HOUR` and `FACTORY_LABEL`, both optional.

**The record of what happened**

- A claim, a state change, and a cost reach the ticket through the adapter, as an event added to the ticket's record, and are read back from it. No code above the adapter reads a hidden HTML comment out of a ticket comment's body.
- GitHub's adapter keeps today's comments, so nothing changes there. The in-memory adapter keeps the record apart from the comments, which proves the seam.
- Each session's cost is its own entry, holding that session's running total, and a ticket's Cost is the sum. Two sessions cannot lose each other's number, and a retry writes the same number again.
- The adapter decides what of an event shows as a comment. One with somewhere hidden to keep the record comments only when a person needs to read it: refinement's questions, a stop that waits on someone, and the closing note.
- The sync runs because the factory asked: a command that records an event starts it, and a schedule catches the rest. It does not depend on a ticket system sending an event: the sync workflow loses its ticket and comment triggers, on GitHub too, and keeps its pull request triggers and the nightly run.

**Proof**

- The strict in-memory adapter from #60 also has statuses that change only along allowed moves, no open or closed, no hidden text in a comment, and labels that must exist before use. Each change above starts from a test that fails against it.

#### Where

- `src/lib/work-status.mts`, `src/board.mts`, `src/poller.mts`, `src/ticket.mts`, `src/status.mts`, `src/reviewers.mts`, `src/lib/usage.mts`
- `src/tickets/types.mts` (`BoardOps`, `Ticket.state`, `readAll`), `src/tickets/github.mts`, `tests/memory-tickets.ts`
- `src/config.mts` and `settings.schema.json` (the label, the columns rule, the cap), `src/init.mts`
- `workflows/factory-board-sync.yml`, `workflows/factory-poller.yml`, `workflows/factory-deps.yml`, `workflows/factory-build.yml`, `workflows/factory-review.yml`, `workflows/factory-conflicts.yml`, `src/sync.mts`
- `docs/workflow.md`, `docs/configuration.md`, `docs/existing-repo.md`, `docs/updating.md`, `docs/builds.md`, `docs/cli.md`
- `openspec/specs/board-columns/`, `openspec/specs/board-poller/`

#### Open questions for refinement

Each was settled by the owner on 2026-11-22, in the draft under Proposed docs:

- **The sync's triggers:** one path. GitHub loses its ticket and comment triggers too (Q8).
- **The board's order:** top of the ready column down, as the board shows it with no sort. The build first checks a real GitHub Project's API keeps that order; if it doesn't, GitHub keeps lowest number first and the docs say so (Q7).
- **GitHub's cost comments:** they change to a session's running total on the ticket, and a ticket's Cost is each session's newest total, added up. Old comments keep counting as they are (Q9).
- **What an adapter's board group must offer:** reading the board, adding a ticket, moving it to a column, and writing the factory's fields. Creating a board, adding columns, and adding fields are optional, and init says what to do by hand where one is missing (Q10).
- **#57:** waits on #61, recorded as a blocker.
- **How many hidden entries a Jira ticket can hold** stays with #63's test against a real site.

#### Build order

- #61 waits on #60: the record of events, the columns, and the label are written against ticket keys and the strict test adapter #60 builds, so built first they would be written with numbers and redone.
- #61 waits on #59: #59 decides where label names live in the settings, and the factory label adds one key there.
- #57 waits on #61: with Done a column, #57's closing of a parent is a move this ticket builds.

## What Changes

- **Draft first.** The owner approved the `dx-first` draft under Proposed docs on 2026-11-22, with every recommendation, Q1 to Q10, as written. Each Spec line below comes from it.
- **Naming a ticket adopts it (Q1).** `factory ticket refining`, `claim`, and `ready` add the label to a ticket without it, and say so. The sync, `factory status`, and the poller never add it.
- **No count of tickets left out (Q2).** `factory status` lists labeled tickets only, with no line about the rest.
- **A labeled card dragged by hand still moves back (Q3),** except to Ready and back to Backlog, as today. Removing the label is how to work a ticket by hand.
- **A new command, `factory ticket adopt` (Q4),** for labeling many at once.
- **No closing note on GitHub (Q5).** GitHub's merge already shows the link. The sync records a `merged` event, with the pull request's number and link, before it moves and finishes the ticket; GitHub's adapter posts nothing for it, and an adapter whose system shows nothing of the merge comments `Merged in pull request #123: LINK`.
- **`builds.max-per-hour` with any trigger (Q6),** default 20.
- **Board order (Q7):** top of the ready column first. The build checks first that a GitHub Project's API returns items in the board's unsorted order; if it does not, GitHub keeps key order and the docs say so.
- **One sync path (Q8):** the board-sync workflow loses its `issues` and `issue_comment` triggers on every ticket system, and keeps `pull_request_target`, the nightly schedule, and `workflow_dispatch`, which the factory's commands start.
- **Cost as a running total (Q9).** A ticket note's total is that session's newest total already recorded on the ticket plus what it spent since its clock started; the clock restarts only once the note is posted. So a failed post retried writes the same number, refining then building in one session keeps the refining spend, and two sessions never touch each other's entry. A ticket's Cost is each session's newest total, added up, plus every `cost:` marker as today. `factory pr cost` is unchanged: it posts a since-last-note `cost:` marker on the pull request and restarts the clock, so its spend is not counted twice.
- **The board group (Q10):** `read`, `add`, `move`, and `set` are required; `create`, `addColumns`, and `addFields` are optional, and init says what to add by hand where one is missing.
- **When `factory-deps` labels.** On the update whose old `.claude/factory.lock` has no `tickets.labels.factory` line, which every earlier version lacks, so it happens once. A version number would not do: the package's version is set only at release.
- **The hosted poller's variables.** `FACTORY_LABEL` and `FACTORY_MAX_PER_HOUR`, both optional, since the hosted poller has no settings file.
- **Other commands on an unlabeled ticket** (`waiting`, `refined`, `stop`, `end`, `cost`, `comment`, `label`, `edit`, `factory pr cost`, and the reviewer-runs hook) write as today: a session reaches them only after naming the ticket, and the Done-when's "never commented on" is about the sync, `factory status`, and the poller.
- **Which tickets the commands list.** `listOpen` stays on the interface, renamed `listUnfinished`, for every ticket not finished whatever its labels: `adopt --all-open`, `factory ticket list`, and the follow-ups lookup use it. `readAll` takes the label and returns labeled tickets only, the 30 finished most recently included.
- **The board's order on the interface.** `BoardItem.rank`, a number, lower first, which each adapter fills: a Project's item position on GitHub, rank on Jira.
- **When a ticket became done,** for `factory status`: the factory's own move to done, from the record; else the card's `updatedAt` in a done column; else `finishedAt`.
- **When the sync exists.** `factory sync` writes the sync workflow when `tickets.board` is set or the ticket system has statuses of its own, and the commands start it only when it is written. GitHub without a Project has neither, so there the merge's own close finishes the ticket, as today, and nothing is started.
- **Starting the sync from the cloud.** The workflows whose sessions record on tickets (`factory-build.yml`, `factory-review.yml`, `factory-conflicts.yml`, and `factory-deps.yml`) gain `actions: write`, so `GITHUB_TOKEN` can start the sync; line 25's line is for a real failure, not the usual case.
- **Reviewer runs are events too,** so `factory status` reads them through the adapter. GitHub's adapter keeps today's one comment per session, edited in place.
- **`factory-deps`'s once is a tested flag,** `adopt --since-lock FILE`, since skill text has no test. The skill passes the base branch's lock.
- **Build order.** #59 and #60, which this waited on, are merged. #57 waits on #61, already recorded on #57: its closing of a parent is a move to a done column, which this builds.
