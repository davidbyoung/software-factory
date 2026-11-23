# board-poller Specification

## Purpose

How the poller starts builds from the board: one pass for a scheduled run, the schedule `factory sync` writes for it into `.github/workflows/factory.yml`, and the hourly cap on builds that the poller you host and the scheduled one both keep.

## Requirements

### Requirement: One pass of the poller

The factory SHALL behave as this line says: When `factory poller --once` runs, it reads the board once, starts a build for each Ready ticket as the hosted poller does, and exits 0.

#### Scenario: One pass of the poller

- **WHEN** `factory poller --once` runs
- **THEN** it reads the board once, starts a build for each Ready ticket as the hosted poller does, and exits 0.

### Requirement: A pass that cannot read

The factory SHALL behave as this line says: When `factory poller --once` cannot read the board or the tickets, it prints why and exits 1, so the scheduled run shows as failed.

#### Scenario: A pass that cannot read

- **WHEN** `factory poller --once` cannot read the board or the tickets
- **THEN** it prints why and exits 1, so the scheduled run shows as failed.

### Requirement: Nothing to poll

The factory SHALL behave as this line says: When the settings have no `tickets.board`, or the Ready column is `none`, `factory poller --once` prints which, and exits 1 without reading anything.

#### Scenario: Nothing to poll

- **WHEN** the settings have no `tickets.board`, or the Ready column is `none`
- **THEN** `factory poller --once` prints which, and exits 1 without reading anything.

### Requirement: What a pass reads

The factory SHALL behave as this line says: When `factory poller --once` runs, it reads the repository, `tickets.board`, and the Ready column from `.claude/factory.yaml`, and the token from `FACTORY_BOARD_TOKEN`.

#### Scenario: What a pass reads

- **WHEN** `factory poller --once` runs
- **THEN** it reads the repository, `tickets.board`, and the Ready column from `.claude/factory.yaml`, and the token from `FACTORY_BOARD_TOKEN`.

### Requirement: The scheduled workflow is written

The factory SHALL behave as this line says: When `factory sync` runs with `builds.trigger: github-action`, it writes the poller's `cron` line into `.github/workflows/factory.yml`, whose poller job runs `factory poller --once` every `builds.poll-minutes` minutes and can be run by hand.

#### Scenario: The scheduled workflow is written

- **WHEN** `factory sync` runs with `builds.trigger: github-action`
- **THEN** it writes the poller's `cron` line into `.github/workflows/factory.yml`, whose poller job runs `factory poller --once` every `builds.poll-minutes` minutes and can be run by hand.

### Requirement: The scheduled workflow is deleted

The factory SHALL behave as this line says: When `factory sync` runs with any other trigger, it writes no `cron` line for the poller into `.github/workflows/factory.yml`, and the poller's job is off.

#### Scenario: The scheduled workflow is deleted

- **WHEN** `factory sync` runs with any other trigger
- **THEN** it writes no `cron` line for the poller into `.github/workflows/factory.yml`, and the poller's job is off.

### Requirement: Poller runs do not overlap

The factory SHALL behave as this line says: When a poller run starts while the previous poller run is still running, it waits for that one to finish. Each build it starts is a separate run of `factory.yml`, so builds run in parallel.

#### Scenario: Poller runs do not overlap

- **WHEN** a poller run starts while the previous poller run is still running
- **THEN** it waits for that one to finish. Each build it starts is a separate run of `factory.yml`, so builds run in parallel.

### Requirement: The hourly cap

The factory SHALL behave as this line says: When `builds.max-per-hour` is set, or left at its default of 20, neither poller starts a build while that many have started in the past hour, counted from the start events on the repository's labeled tickets, and its log reads `REF waits: MAX builds started in the last hour (builds.max-per-hour)`.

#### Scenario: The hourly cap

- **WHEN** `builds.max-per-hour` is set, or left at its default of 20
- **THEN** neither poller starts a build while that many have started in the past hour, counted from the start events on the repository's labeled tickets, and its log reads `REF waits: MAX builds started in the last hour (builds.max-per-hour)`.

### Requirement: The cap across a restart

The factory SHALL behave as this line says: When the hosted poller restarts, builds it started in the past hour still count toward the cap.

#### Scenario: The cap across a restart

- **WHEN** the hosted poller restarts
- **THEN** builds it started in the past hour still count toward the cap.

### Requirement: The hosted poller needs its ready column

The factory SHALL behave as this line says: When the hosted poller (`factory poller`, without `--once`) starts without `FACTORY_READY_COLUMN`, it logs `not polling: NAMES not set`, NAMES listing every missing variable in the order `FACTORY_BOARD_OWNER`, `FACTORY_BOARD_NUMBER`, `FACTORY_BOARD_TOKEN`, `FACTORY_READY_COLUMN`, joined by `, `, and polls nothing. A value of only spaces counts as missing.

#### Scenario: The hosted poller needs its ready column

- **WHEN** the hosted poller (`factory poller`, without `--once`) starts without `FACTORY_READY_COLUMN`
- **THEN** it logs `not polling: NAMES not set`, NAMES listing every missing variable in the order `FACTORY_BOARD_OWNER`, `FACTORY_BOARD_NUMBER`, `FACTORY_BOARD_TOKEN`, `FACTORY_READY_COLUMN`, joined by `, `, and polls nothing. A value of only spaces counts as missing.

### Requirement: The hosted poller reads its ready column

The factory SHALL behave as this line says: When `FACTORY_READY_COLUMN` is set, the hosted poller starts a build only for a card in the column it names, as today.

#### Scenario: The hosted poller reads its ready column

- **WHEN** `FACTORY_READY_COLUMN` is set
- **THEN** the hosted poller starts a build only for a card in the column it names, as today.

### Requirement: Init prints the poller's ready column

The factory SHALL behave as this line says: When `factory init` ends a run with builds from the board on and `builds.trigger: own-server`, the poller lines under "Left to do" end with `       FACTORY_READY_COLUMN=COLUMN`, after `FACTORY_BOARD_TOKEN`, COLUMN being the ready column init saves.

#### Scenario: Init prints the poller's ready column

- **WHEN** `factory init` ends a run with builds from the board on and `builds.trigger: own-server`
- **THEN** the poller lines under "Left to do" end with `       FACTORY_READY_COLUMN=COLUMN`, after `FACTORY_BOARD_TOKEN`, COLUMN being the ready column init saves.

### Requirement: The cap's setting is checked

The factory SHALL behave as this line says: When `builds.max-per-hour` is not a whole number of 1 or more, `factory config check` fails with `.claude/factory.yaml: builds.max-per-hour: must be a whole number, 1 or more`. It is accepted with any trigger.

#### Scenario: The cap's setting is checked

- **WHEN** `builds.max-per-hour` is not a whole number of 1 or more
- **THEN** `factory config check` fails with `.claude/factory.yaml: builds.max-per-hour: must be a whole number, 1 or more`. It is accepted with any trigger.

### Requirement: The hosted poller's label and cap

The factory SHALL behave as this line says: When the hosted poller has `FACTORY_LABEL` or `FACTORY_MAX_PER_HOUR` set, it uses that label name or cap; without them, `factory` and 20. A `FACTORY_MAX_PER_HOUR` that is not a whole number of 1 or more logs `not polling: FACTORY_MAX_PER_HOUR must be a whole number, 1 or more` and starts nothing.

#### Scenario: The hosted poller's label and cap

- **WHEN** the hosted poller has `FACTORY_LABEL` or `FACTORY_MAX_PER_HOUR` set
- **THEN** it uses that label name or cap; without them, `factory` and 20. A `FACTORY_MAX_PER_HOUR` that is not a whole number of 1 or more logs `not polling: FACTORY_MAX_PER_HOUR must be a whole number, 1 or more` and starts nothing.

### Requirement: The poller starts in the board's order

The factory SHALL behave as this line says: When several labeled tickets are in the ready column, the poller starts them by their cards' rank, the order the board shows them unsorted, top first, and by key where two ranks are equal. If a GitHub Project's API does not keep that order, GitHub's adapter gives every card the same rank, so on GitHub the poller starts them by key.

#### Scenario: The poller starts in the board's order

- **WHEN** several labeled tickets are in the ready column
- **THEN** the poller starts them by their cards' rank, the order the board shows them unsorted, top first, and by key where two ranks are equal. If a GitHub Project's API does not keep that order, GitHub's adapter gives every card the same rank, so on GitHub the poller starts them by key.

### Requirement: Board check names the poller's variables

The factory SHALL behave as this line says: When `factory board check` runs and the label's name is not `factory`, or `builds.max-per-hour` is not 20, it prints `? label      NAME: the poller needs FACTORY_LABEL set to "NAME"` and `? builds     MAX an hour: the poller needs FACTORY_MAX_PER_HOUR set to MAX`, each only when it differs.

#### Scenario: Board check names the poller's variables

- **WHEN** `factory board check` runs and the label's name is not `factory`, or `builds.max-per-hour` is not 20
- **THEN** it prints `? label      NAME: the poller needs FACTORY_LABEL set to "NAME"` and `? builds     MAX an hour: the poller needs FACTORY_MAX_PER_HOUR set to MAX`, each only when it differs.
