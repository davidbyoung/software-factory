# board-sync-trigger Specification

## Purpose

What starts the board sync: Lunamill's own commands after each thing they record, pull request events, and the nightly run, never a ticket system's own events, which only GitHub can send.

## Requirements

### Requirement: A recording command starts the sync

Lunamill SHALL behave as this line says: When `lunamill ticket claim`, `refining`, `waiting`, `refined`, `stop`, `end`, `ready`, `cost`, or `adopt`, or `lunamill ticket open` records something on a ticket, and the settings call for the sync workflow, it starts it through the code host before it exits, and prints nothing more. Otherwise it starts nothing and prints nothing. `lunamill follow-up` and `lunamill pr follow-ups` start none.

#### Scenario: A recording command starts the sync

- **WHEN** `lunamill ticket claim`, `refining`, `waiting`, `refined`, `stop`, `end`, `ready`, `cost`, or `adopt`, or `lunamill ticket open` records something on a ticket
- **THEN** and the settings call for the sync workflow, it starts it through the code host before it exits, and prints nothing more. Otherwise it starts nothing and prints nothing. `lunamill follow-up` and `lunamill pr follow-ups` start none.

### Requirement: A sync that cannot start

Lunamill SHALL behave as this line says: When a recording command cannot start the sync workflow, it prints `? the board updates at the nightly sync: couldn't start the board sync (REASON)` after its own output and keeps its exit code.

#### Scenario: A sync that cannot start

- **WHEN** a recording command cannot start the sync workflow
- **THEN** it prints `? the board updates at the nightly sync: couldn't start the board sync (REASON)` after its own output and keeps its exit code.

### Requirement: The sync's triggers

Lunamill SHALL behave as this line says: When `lunamill sync` writes `.github/workflows/lunamill.yml`, the workflow has no `issues` or `issue_comment` trigger, and keeps `pull_request_target`, the nightly `schedule`, and `workflow_dispatch`.

#### Scenario: The sync's triggers

- **WHEN** `lunamill sync` writes `.github/workflows/lunamill.yml`
- **THEN** the workflow has no `issues` or `issue_comment` trigger, and keeps `pull_request_target`, the nightly `schedule`, and `workflow_dispatch`.
