## MODIFIED Requirements

### Requirement: When the sync workflow is written

The factory SHALL behave as this line says: When `factory sync` runs with `tickets.board` set, or with a ticket system that has statuses of its own, the board sync's job in `.github/workflows/factory.yml` is on; otherwise it is off, as today without a board.

#### Scenario: When the sync workflow is written

- **WHEN** `factory sync` runs with `tickets.board` set, or with a ticket system that has statuses of its own
- **THEN** the board sync's job in `.github/workflows/factory.yml` is on; otherwise it is off, as today without a board.
