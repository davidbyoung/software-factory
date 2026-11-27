# Proposal

From [davidbyoung/software-factory#70](https://github.com/davidbyoung/software-factory/issues/70). The transcripts and docs the owner approved are in the ticket's "Proposed docs".

### What and why

A poller you host (`builds.trigger: own-server`) runs with no checkout, so it takes what it needs from environment variables that repeat the settings: `FACTORY_BOARD_OWNER`, `FACTORY_BOARD_NUMBER`, `FACTORY_READY_COLUMN`, `FACTORY_LABEL`, and `FACTORY_MAX_PER_HOUR`. Each one is a place for the poller and `.claude/factory.yaml` to disagree: rename the ready column or the label and forget the server, and builds stop starting; raise `builds.max-per-hour`, and the server keeps the old cap. (This paragraph first named `FACTORY_FOLLOW_UP_LABEL` too, which #96 removed with the follow-ups label.)

Decided by the owner on 2026-11-22: the hosted poller reads the repository's settings instead of a variable per setting. Moved here from the follow-ups ticket #4, where the line was found by the factory-trace agent while building #59.

### Done when

- A poller you host reads the board, the ready column, the factory label, and the hourly cap from the repository's own settings, so a change to `.claude/factory.yaml` reaches it without touching its environment.
- Its environment needs only what the settings cannot give it: the repository and a token.
- A poller set up with today's variables keeps working, or says plainly what to change.

### Open questions for refinement

Settled by the draft under Proposed docs, and recorded under Decisions:

- How it reads the settings with no checkout: `.claude/factory.lock` from the default branch through GitHub, at each pass (Decisions 1 and 2).
- What it does when the settings can't be read or are invalid: polls nothing and logs why, once and whenever the reason changes (Decisions 5 and 9).
- Whether the variables stay as overrides, or are refused: neither; they are ignored, and named once in the log (Decision 3).

### Where

- `src/poller.mts` (`readConfig`, `columnsFrom`, `tick`), `src/config.mts`
- `src/board.mts` (`factory board check`'s poller lines), `src/init.mts` ("Left to do")
- `docs/builds.md` ("What it reads from its environment"), `docs/configuration.md`
- `openspec/specs/board-poller/`

### Decisions

1. **Where it reads the settings:** `.claude/factory.lock` on the default branch, through GitHub with `FACTORY_BOARD_TOKEN`, whose `repo` scope already reads it. Not `.claude/factory.yaml`, which misses a value a preset sets. CI's "Factory files in step" (`factory sync --check`) fails a pull request whose lock differs from its settings, so the lock on the default branch matches the file. (Q1 of the draft.)
2. **When:** at every pass, once a minute: 60 requests an hour of the token's 5,000, nothing to restart, and no cache. (Q2.)
3. **Today's variables:** ignored, and the ones still set are named once in the log, so a poller set up with them keeps working and says what to change. Not refused, which would stop builds on the day the image updates; not overrides, which would keep the disagreement this ticket removes. (Q3.)
4. **Adds a Decision: a trigger other than `own-server`.** The hosted poller starts nothing unless the settings say `builds.trigger: own-server`, as the organization's poller already leaves a repository whose trigger is another. A poller left running after a move to `github-action` would otherwise start tickets beside the schedule, and after a move to `manual`, builds nobody asked for. (Q4.)
5. **Settings it can't read:** it polls nothing and says why, and never falls back to settings it read before. (Q5.)
6. **A lock from another release:** it reads only the settings it uses and leaves any other key or value alone, so updating the factory before the image never stops it. When a setting it uses can't be read and the lock's `version:` differs from the poller's, the line names both and the image to run. (Q6.)
7. **`FACTORY_BOARD_OWNER` goes too.** The board's owner is the repository's owner everywhere else in the factory, and `docs/builds.md` already says a board owned by another account is not supported.
8. **The same settings as the scheduled pass.** The hosted poller reads what `factory poller --once` reads from a checkout, the ticket system included, so the two can't differ. Only GitHub is a ticket system today. #63 (Jira) says a poller you host is not offered with Jira at first, because of today's variables; that line stands as a non-goal here, and neither ticket has to be built before the other: building either first breaks nothing in the other, and the shared file is a merge conflict, not a blocker.
9. **Logging.** A `not polling:` reason is logged when it starts and when it changes, and the hourly heartbeat repeats it, rather than a line every minute. Those passes don't count toward the slower retry, so a fix that merges is picked up within a minute; a read that fails does count, as a failed board read does today.
10. **`FACTORY_FOLLOW_UP_LABEL`** was removed by #96, with the follow-ups label. The owner's first paragraph and the first "Done when" bullet named it; both are corrected above, and nothing here touches it.
11. **No migration code.** A poller set up before this release is moved by the steps in `docs/updating.md`, "The poller reads your settings", as the owner prefers while two repositories use the factory.
12. **`docs-reader`'s three findings in text this ticket doesn't touch** are left: the organization's poller rules sit before the hosting steps in `docs/builds.md`, a bare `factory poller` block says nothing of when to type it, and the DigitalOcean example shows no app spec.
13. **Build order:** no blocker in either direction among the open tickets.
