# board-poller Specification

## Purpose

How the poller starts builds from the board: one pass for a scheduled run, the schedule `kodor sync` writes for it into `.github/workflows/kodor.yml`, and the hourly cap on builds that the poller you host and the scheduled one both keep.

## Requirements

### Requirement: One pass of the poller

kodor SHALL behave as this line says: When `kodor poller --once` runs, it reads the board once, starts a build for each Ready ticket as the hosted poller does, and exits 0.

#### Scenario: One pass of the poller

- **WHEN** `kodor poller --once` runs
- **THEN** it reads the board once, starts a build for each Ready ticket as the hosted poller does, and exits 0.

### Requirement: A pass that cannot read

kodor SHALL behave as this line says: When `kodor poller --once` cannot read the board or the tickets, it prints why and exits 1, so the scheduled run shows as failed. With `--preset FILE`, only a board it cannot read does so: a repository whose tickets it cannot read is logged under the repository's name, as a warning in a workflow's run, and fails nothing.

#### Scenario: A pass that cannot read

- **WHEN** `kodor poller --once` cannot read the board or the tickets
- **THEN** it prints why and exits 1, so the scheduled run shows as failed. With `--preset FILE`, only a board it cannot read does so: a repository whose tickets it cannot read is logged under the repository's name, as a warning in a workflow's run, and fails nothing.

### Requirement: Nothing to poll

kodor SHALL behave as this line says: When the settings have no `tickets.board`, or the Ready column is `none`, `kodor poller --once` prints which, and exits 1 without reading anything.

#### Scenario: Nothing to poll

- **WHEN** the settings have no `tickets.board`, or the Ready column is `none`
- **THEN** `kodor poller --once` prints which, and exits 1 without reading anything.

### Requirement: What a pass reads

kodor SHALL behave as this line says: When `kodor poller --once` runs without `--preset`, it reads the repository, `tickets.board`, and the Ready column from `.claude/kodor.yaml`, and the token from `KODOR_BOARD_TOKEN`. With `--preset FILE` it reads the board and the Ready column from FILE and the board's owner from `GITHUB_REPOSITORY`, as `org-poller` says, and the token the same way.

#### Scenario: What a pass reads

- **WHEN** `kodor poller --once` runs without `--preset`
- **THEN** it reads the repository, `tickets.board`, and the Ready column from `.claude/kodor.yaml`, and the token from `KODOR_BOARD_TOKEN`. With `--preset FILE` it reads the board and the Ready column from FILE and the board's owner from `GITHUB_REPOSITORY`, as `org-poller` says, and the token the same way.

### Requirement: The scheduled workflow is written

kodor SHALL behave as this line says: When `kodor sync` runs with `builds.trigger: github-action`, and the lock records no preset whose repository runs the poller, it writes the poller's `cron` line into `.github/workflows/kodor.yml`, whose poller job runs `kodor poller --once` every `builds.poll-minutes` minutes and can be run by hand. With such a preset it writes no `cron` line for the poller, and the poller's job is off.

#### Scenario: The scheduled workflow is written

- **WHEN** `kodor sync` runs with `builds.trigger: github-action`, and the lock records no preset whose repository runs the poller
- **THEN** it writes the poller's `cron` line into `.github/workflows/kodor.yml`, whose poller job runs `kodor poller --once` every `builds.poll-minutes` minutes and can be run by hand. With such a preset it writes no `cron` line for the poller, and the poller's job is off.

### Requirement: The scheduled workflow is deleted

kodor SHALL behave as this line says: When `kodor sync` runs with any other trigger, it writes no `cron` line for the poller into `.github/workflows/kodor.yml`, and the poller's job is off.

#### Scenario: The scheduled workflow is deleted

- **WHEN** `kodor sync` runs with any other trigger
- **THEN** it writes no `cron` line for the poller into `.github/workflows/kodor.yml`, and the poller's job is off.

### Requirement: Poller runs do not overlap

kodor SHALL behave as this line says: When a poller run starts while the previous poller run is still running, it waits for that one to finish. Each build it starts is a separate run of `kodor.yml`, so builds run in parallel.

#### Scenario: Poller runs do not overlap

- **WHEN** a poller run starts while the previous poller run is still running
- **THEN** it waits for that one to finish. Each build it starts is a separate run of `kodor.yml`, so builds run in parallel.

### Requirement: The hourly cap

kodor SHALL behave as this line says: When `builds.max-per-hour` is set, or left at its default of 20, neither poller starts a build while that many have started in the past hour, counted from the start events on the repository's labeled tickets, and its log reads `REF waits: MAX builds started in the last hour (builds.max-per-hour)`.

#### Scenario: The hourly cap

- **WHEN** `builds.max-per-hour` is set, or left at its default of 20
- **THEN** neither poller starts a build while that many have started in the past hour, counted from the start events on the repository's labeled tickets, and its log reads `REF waits: MAX builds started in the last hour (builds.max-per-hour)`.

### Requirement: The cap across a restart

kodor SHALL behave as this line says: When the hosted poller restarts, builds it started in the past hour still count toward the cap.

#### Scenario: The cap across a restart

- **WHEN** the hosted poller restarts
- **THEN** builds it started in the past hour still count toward the cap.

### Requirement: The cap's setting is checked

kodor SHALL behave as this line says: When `builds.max-per-hour` is not a whole number of 1 or more, `kodor config check` fails with `.claude/kodor.yaml: builds.max-per-hour: must be a whole number, 1 or more`. It is accepted with any trigger.

#### Scenario: The cap's setting is checked

- **WHEN** `builds.max-per-hour` is not a whole number of 1 or more
- **THEN** `kodor config check` fails with `.claude/kodor.yaml: builds.max-per-hour: must be a whole number, 1 or more`. It is accepted with any trigger.

### Requirement: The poller starts in the board's order

kodor SHALL behave as this line says: When several labeled tickets are in the ready column, the poller starts them by their cards' rank, the order the board shows them unsorted, top first, and by key where two ranks are equal. If a GitHub Project's API does not keep that order, GitHub's adapter gives every card the same rank, so on GitHub the poller starts them by key.

#### Scenario: The poller starts in the board's order

- **WHEN** several labeled tickets are in the ready column
- **THEN** the poller starts them by their cards' rank, the order the board shows them unsorted, top first, and by key where two ranks are equal. If a GitHub Project's API does not keep that order, GitHub's adapter gives every card the same rank, so on GitHub the poller starts them by key.

### Requirement: The hosted poller reads the settings

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The hosted poller reads the settings

- **WHEN** the hosted poller (`kodor poller`, without `--once`) makes a pass
- **THEN** it reads `.claude/kodor.lock` from the repository's default branch through GitHub, with `KODOR_BOARD_TOKEN`, and takes the board, the ready column, the kodor label, `builds.max-per-hour`, `builds.trigger`, and the ticket system from the settings recorded there, as `kodor poller --once` takes them from a checkout; every other column keeps its default, as with `--once`. It reads the file again at every pass, and the board's owner is the repository's owner.

### Requirement: The hosted poller names its repository

kodor SHALL behave as this line says: When the hosted poller starts, it logs `ready-poller started for OWNER/NAME`.

#### Scenario: The hosted poller names its repository

- **WHEN** the hosted poller starts
- **THEN** it logs `ready-poller started for OWNER/NAME`.

### Requirement: The hosted poller logs the settings it read

kodor SHALL behave as this line says: When the hosted poller first reads the settings, and at each pass where the board, the ready column, the label, or the cap differ from the last it logged, it logs `settings from .claude/kodor.lock on BRANCH: board N, ready column "COLUMN", label "LABEL", MAX builds an hour`, BRANCH being the default branch.

#### Scenario: The hosted poller logs the settings it read

- **WHEN** the hosted poller first reads the settings, and at each pass where the board, the ready column, the label, or the cap differ from the last it logged
- **THEN** it logs `settings from .claude/kodor.lock on BRANCH: board N, ready column "COLUMN", label "LABEL", MAX builds an hour`, BRANCH being the default branch.

### Requirement: The hosted poller names variables it no longer reads

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The hosted poller names variables it no longer reads

- **WHEN** the hosted poller starts with any of `KODOR_BOARD_OWNER`, `KODOR_BOARD_NUMBER`, `KODOR_READY_COLUMN`, `KODOR_LABEL`, and `KODOR_MAX_PER_HOUR` set to more than spaces
- **THEN** it reads none of them, and logs once, before its first `settings from` line, `NAMES are no longer read: the settings on BRANCH are. Take them out of the poller's environment.`, NAMES being those set, in that order, joined by `, `, and `is` in place of `are` and `it` in place of `them` for one.

### Requirement: No lock on the default branch

kodor SHALL behave as this line says: When the default branch has no `.claude/kodor.lock`, the hosted poller starts nothing and its reason is `no .claude/kodor.lock on BRANCH yet. Merge the pull request that sets kodor up.`

#### Scenario: No lock on the default branch

- **WHEN** the default branch has no `.claude/kodor.lock`
- **THEN** the hosted poller starts nothing and its reason is `no .claude/kodor.lock on BRANCH yet. Merge the pull request that sets kodor up.`

### Requirement: A trigger other than own-server

kodor SHALL behave as this line says: When the settings' `builds.trigger` is not `own-server`, the hosted poller starts nothing and its reason is `builds.trigger is VALUE on BRANCH, not own-server`.

#### Scenario: A trigger other than own-server

- **WHEN** the settings' `builds.trigger` is not `own-server`
- **THEN** the hosted poller starts nothing and its reason is `builds.trigger is VALUE on BRANCH, not own-server`.

### Requirement: No board in the settings

kodor SHALL behave as this line says: When the settings have no `tickets.board`, the hosted poller starts nothing and its reason is `tickets.board is not set on BRANCH`.

#### Scenario: No board in the settings

- **WHEN** the settings have no `tickets.board`
- **THEN** the hosted poller starts nothing and its reason is `tickets.board is not set on BRANCH`.

### Requirement: A setting the hosted poller cannot read

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A setting the hosted poller cannot read

- **WHEN** a setting the hosted poller uses can't be read, a ready column of `none` included
- **THEN** it starts nothing and its reason is `.claude/kodor.lock on BRANCH: ` and the fault as `kodor config check` words it after the file's name, such as `builds.max-per-hour: must be a whole number, 1 or more`. When the lock's `version:` differs from the poller's own version, the reason ends ` (written by kodor LOCK, and this poller is OWN: run ghcr.io/kodor-ai/kodor-poller:LOCK)`.

### Requirement: Settings the hosted poller does not use

kodor SHALL behave as this line says: When the lock holds a key the poller's version does not know, or any value, even one it would refuse, in a setting other than those "The hosted poller reads the settings" names, the hosted poller reads the settings that requirement names and polls as usual.

#### Scenario: Settings the hosted poller does not use

- **WHEN** the lock holds a key the poller's version does not know, or any value, even one it would refuse, in a setting other than those "The hosted poller reads the settings" names
- **THEN** the hosted poller reads the settings that requirement names and polls as usual.

### Requirement: How the hosted poller logs a reason not to poll

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: How the hosted poller logs a reason not to poll

- **WHEN** one of "No lock on the default branch", "A trigger other than own-server", "No board in the settings", and "A setting the hosted poller cannot read" holds
- **THEN** the hosted poller logs `not polling: REASON` at the first pass where it holds and at each pass where the reason changes, not at every pass, and while it holds the hourly heartbeat reads `heartbeat: not polling: REASON`. A pass that read the lock and polls nothing resets the count toward the slower retry to 0, so it reads again a minute later and starts at the first pass after the reason clears. A pass that goes on to poll leaves the count to the read of the board, as before.

### Requirement: No settings from an earlier pass

kodor SHALL behave as this line says: When the hosted poller can't read the settings, it never uses settings it read at an earlier pass.

#### Scenario: No settings from an earlier pass

- **WHEN** the hosted poller can't read the settings
- **THEN** it never uses settings it read at an earlier pass.

### Requirement: A failed read of the lock

kodor SHALL behave as this line says: When reading `.claude/kodor.lock` fails, other than the file not being there, the hosted poller logs `read failed (N in a row): ERROR`, starts nothing, and counts it toward the slower retry, as a failed read of the board does.

#### Scenario: A failed read of the lock

- **WHEN** reading `.claude/kodor.lock` fails, other than the file not being there
- **THEN** the hosted poller logs `read failed (N in a row): ERROR`, starts nothing, and counts it toward the slower retry, as a failed read of the board does.

### Requirement: The hosted poller needs its token

kodor SHALL behave as this line says: When the hosted poller starts without `KODOR_BOARD_TOKEN`, or with only spaces in it, it logs `ready-poller started for OWNER/NAME`, then `not polling: KODOR_BOARD_TOKEN not set` at each pass, which counts toward the slower retry as it does today, and polls nothing.

#### Scenario: The hosted poller needs its token

- **WHEN** the hosted poller starts without `KODOR_BOARD_TOKEN`, or with only spaces in it
- **THEN** it logs `ready-poller started for OWNER/NAME`, then `not polling: KODOR_BOARD_TOKEN not set` at each pass, which counts toward the slower retry as it does today, and polls nothing.

### Requirement: Init prints the poller's two variables

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Init prints the poller's two variables

- **WHEN** `kodor init` ends a run with builds from the board on and `builds.trigger: own-server`
- **THEN** the poller's step under "Left to do" lists `KODOR_REPOSITORY=OWNER/NAME` and `KODOR_BOARD_TOKEN=the access token you just made`, and no other variable, then the line `It reads the rest from your settings once this pull request merges.` when init opened its pull request, and `It reads the rest from your settings once they are on BRANCH.` when it did not.
