## ADDED Requirements

### Requirement: A recording command starts the sync

The factory SHALL behave as this line says: When `factory ticket claim`, `refining`, `waiting`, `refined`, `stop`, `end`, `ready`, `cost`, or `adopt`, `factory ticket open`, or `factory follow-up` records something on a ticket, and the settings call for the sync workflow, it starts it through the code host before it exits, and prints nothing more. Otherwise it starts nothing and prints nothing.

#### Scenario: A recording command starts the sync

- **WHEN** `factory ticket claim`, `refining`, `waiting`, `refined`, `stop`, `end`, `ready`, `cost`, or `adopt`, `factory ticket open`, or `factory follow-up` records something on a ticket
- **THEN** and the settings call for the sync workflow, it starts it through the code host before it exits, and prints nothing more. Otherwise it starts nothing and prints nothing.

### Requirement: A sync that cannot start

The factory SHALL behave as this line says: When a recording command cannot start the sync workflow, it prints `? the board updates at the nightly sync: couldn't start factory-board-sync (REASON)` after its own output and keeps its exit code.

#### Scenario: A sync that cannot start

- **WHEN** a recording command cannot start the sync workflow
- **THEN** it prints `? the board updates at the nightly sync: couldn't start factory-board-sync (REASON)` after its own output and keeps its exit code.

### Requirement: The sync's triggers

The factory SHALL behave as this line says: When `factory sync` writes `.github/workflows/factory-board-sync.yml`, the workflow has no `issues` or `issue_comment` trigger, and keeps `pull_request_target`, the nightly `schedule`, and `workflow_dispatch`.

#### Scenario: The sync's triggers

- **WHEN** `factory sync` writes `.github/workflows/factory-board-sync.yml`
- **THEN** the workflow has no `issues` or `issue_comment` trigger, and keeps `pull_request_target`, the nightly `schedule`, and `workflow_dispatch`.
