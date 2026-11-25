# Design

## Where it goes

- **`src/follow-ups.mts` (new):** the list as text, with no I/O: `parse(body)`, `add(body, title, text)`, and `opened(body, n, ref)`. Then the two commands, with their dependencies passed in as `across-run.mts` does. `src/commands-list.mts` names both: `follow-up` (reads: machine) and `pr follow-ups`.
- **What it reads and writes a description with:** `CodeHost.get` and `setBody`. The pull request of a branch is `forBranch`. Each write reads the description again first, so a person's tick a moment ago is kept.
- **Removed:** `followUp`, `lastOpened`, and `followUpStore` in `src/ticket.mts`; the `follow-up` key in `src/labels.mts` and all that reads it: `config.mts`, `board.mts` (`closedPullComments`' follow-ups part), `status.mts`, `lib/work-status.mts` (`reviewingPulls`, `derive`, `toClear`, and the `follow-ups-merged` entry, whose stored comments stay readable as plain comments), `poller.mts` (`FACTORY_FOLLOW_UP_LABEL`), `lib/refined-check.mts`, `tickets/index.mts` (`whole`), `ticket-repositories.mts`, `session-prepare.mts`, and `tickets/github-setup.mts`.
- **The cloud:** `src/handoff/requests.mts` (`follow-up` is refused for a review and with no pull request, and its words go through `oneLine`), and `src/session-publish.mts`, which runs it for `pull` rather than for a branch. `isWrite` still names it. In `session-prepare.mts`, `readsOf` gains `pr view N --field body`.
- **`run.yml`:** the job `follow-ups`, after `board`, whose steps define the `&extra` it uses, with `contents: read`, `issues: write`, and `pull-requests: write`, `github.token`, and the steps `across` has. A repository whose tickets are not GitHub's needs the ticket secrets, so it takes them with `*extra`. Its condition is the action `closed`, `merged`, a head in this repository, and `<!-- factory: follow-ups -->` in the event's body. `board` gains `needs: [follow-ups]` and runs when that job was skipped or failed, so its `if` starts with `!cancelled() &&`.
- **The process text:** `rules.md` ("Follow-ups", "Small changes", and "Branching, pushing, and review"), `skills/factory-build`, `factory-refine`, and `factory-address-review`, `agents/factory-test-reviewer`, `factory-e2e-reviewer`, `factory-ui-reviewer`, and `factory-ticket-readiness`, `review.md`, and this repository's own `CLAUDE.md`, `.claude/change-types.md` (the "A follow-ups build" row goes), and `.claude/skills/dx-first`. Then `node bin/factory.js sync`. "Follow-ups" in `rules.md` says what is fixed here, what is listed, and what is not mentioned, as the docs section's table does, with the command, and that a session never ticks a box. A reviewer's finding outside the change is given to the author as a title and a text, which the author may list.

## Contracts

- The list sits between two lines, `<!-- factory: follow-ups -->` and `<!-- /factory: follow-ups -->`, at the end of the description. Nothing outside them is read. An item is `N. [ ] **TITLE** TEXT`, or `[x]`, on one line, with ` Opened REF.` at its end once it is opened, REF being how the ticket system writes the ticket.
- In the cloud, text a session hands over loses every hidden marker (`withoutMarkers`), so only the commands write the two lines.
- The event's file is `$GITHUB_EVENT_PATH`: `pull_request.merged`, `.body`, `.number`, and `.head.repo.full_name`.
- The ticket a pull request is for: `recordedTicket`, then what `ticketsOf` says it closes, then builds part of, as `session-prepare.mts` picks it.

- The words that link a ticket are those `closesIn` and `linksIn` find, as `handoff/links.mts` reads them, with no ticket of the run's own let through.

## States

An item is listed, ticked by a person, or opened. The command moves it from ticked to opened, and nothing moves it back.

## Edge cases

- A ticket is opened and the description can't be written: the run fails, and the rerun finds the open ticket by its title and the pull request it names (line 10).
- A description with no list when a second session adds one, and one whose last line has no line break.
- An item's title with a `**` a person added: the line can't be read (line 12).
- Two items opened in one run: the description is read and written once for each.

## Risks and rollback

A run could open tickets nobody wants: the first thing to change is the job's `if`, since nothing else opens one. A tick lost to a write at the same moment is the risk the re-read narrows.

## Dependencies

None. No open ticket waits on this one, and this one waits on none.
