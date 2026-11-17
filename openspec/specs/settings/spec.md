# settings Specification

## Purpose

What `factory config check` accepts for `builds.trigger` and `builds.poll-minutes`, the settings that decide how builds start from the board.

## Requirements

### Requirement: The github-action trigger is accepted

The factory SHALL behave as this line says: When `factory config check` reads `builds.trigger: github-action`, it accepts it.

#### Scenario: The github-action trigger is accepted

- **WHEN** `factory config check` reads `builds.trigger: github-action`
- **THEN** it accepts it.

### Requirement: The interval's default

The factory SHALL behave as this line says: When `builds.poll-minutes` is not set, it is 5.

#### Scenario: The interval's default

- **WHEN** `builds.poll-minutes` is not set
- **THEN** it is 5.

### Requirement: An interval not allowed

The factory SHALL behave as this line says: When `builds.poll-minutes` is anything but 5, 10, 15, 30, or 60, `factory config check` fails, naming the key and the values allowed.

#### Scenario: An interval not allowed

- **WHEN** `builds.poll-minutes` is anything but 5, 10, 15, 30, or 60
- **THEN** `factory config check` fails, naming the key and the values allowed.

### Requirement: An interval without the schedule

The factory SHALL behave as this line says: When `builds.poll-minutes` is set and `builds.trigger` is not `github-action`, `factory config check` fails with `builds.poll-minutes needs builds.trigger: github-action`.

#### Scenario: An interval without the schedule

- **WHEN** `builds.poll-minutes` is set and `builds.trigger` is not `github-action`
- **THEN** `factory config check` fails with `builds.poll-minutes needs builds.trigger: github-action`.
