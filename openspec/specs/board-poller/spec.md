# board-poller Specification

## Purpose

How the poller starts builds from the board: one pass for a scheduled run, the workflow `factory sync` writes for it, and the hourly cap on builds that the poller you host and the scheduled one both keep.

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

The factory SHALL behave as this line says: When `factory sync` runs with `builds.trigger: github-action`, it writes `.github/workflows/factory-poller.yml`, which runs `factory poller --once` every `builds.poll-minutes` minutes and can be run by hand.

#### Scenario: The scheduled workflow is written

- **WHEN** `factory sync` runs with `builds.trigger: github-action`
- **THEN** it writes `.github/workflows/factory-poller.yml`, which runs `factory poller --once` every `builds.poll-minutes` minutes and can be run by hand.

### Requirement: The scheduled workflow is deleted

The factory SHALL behave as this line says: When `factory sync` runs with any other trigger, it deletes `.github/workflows/factory-poller.yml`.

#### Scenario: The scheduled workflow is deleted

- **WHEN** `factory sync` runs with any other trigger
- **THEN** it deletes `.github/workflows/factory-poller.yml`.

### Requirement: Poller runs do not overlap

The factory SHALL behave as this line says: When a poller run starts while the previous poller run is still running, it waits for that one to finish. Each build it starts is a separate run of the build workflow, so builds run in parallel.

#### Scenario: Poller runs do not overlap

- **WHEN** a poller run starts while the previous poller run is still running
- **THEN** it waits for that one to finish. Each build it starts is a separate run of the build workflow, so builds run in parallel.

### Requirement: The hourly cap

The factory SHALL behave as this line says: When 20 builds have started in the past hour, counted from the start comments on the repository's tickets, neither poller starts another until one of those is over an hour old.

#### Scenario: The hourly cap

- **WHEN** 20 builds have started in the past hour, counted from the start comments on the repository's tickets
- **THEN** neither poller starts another until one of those is over an hour old.

### Requirement: The cap across a restart

The factory SHALL behave as this line says: When the hosted poller restarts, builds it started in the past hour still count toward the 20.

#### Scenario: The cap across a restart

- **WHEN** the hosted poller restarts
- **THEN** builds it started in the past hour still count toward the 20.
