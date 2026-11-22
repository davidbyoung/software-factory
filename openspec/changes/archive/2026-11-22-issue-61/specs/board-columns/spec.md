## ADDED Requirements

### Requirement: A merge moves the ticket to done

The factory SHALL behave as this line says: When the pull request that closes a labeled ticket merges, the sync records a `merged` event, moves the ticket to the first column `tickets.columns.done` lists, then has the adapter finish it: on GitHub, close it if it is open, posting nothing.

#### Scenario: A merge moves the ticket to done

- **WHEN** the pull request that closes a labeled ticket merges
- **THEN** the sync records a `merged` event, moves the ticket to the first column `tickets.columns.done` lists, then has the adapter finish it: on GitHub, close it if it is open, posting nothing.

### Requirement: A done ticket is left alone

The factory SHALL behave as this line says: When a labeled ticket is in any column `tickets.columns.done` lists, the sync writes no column for it.

#### Scenario: A done ticket is left alone

- **WHEN** a labeled ticket is in any column `tickets.columns.done` lists
- **THEN** the sync writes no column for it.

### Requirement: Finished is done without a board

The factory SHALL behave as this line says: When there is no board, a ticket the ticket system reports as finished (on GitHub, closed) is done.

#### Scenario: Finished is done without a board

- **WHEN** there is no board
- **THEN** a ticket the ticket system reports as finished (on GitHub, closed) is done.

### Requirement: When the sync workflow is written

The factory SHALL behave as this line says: When `factory sync` runs with `tickets.board` set, or with a ticket system that has statuses of its own, it writes `.github/workflows/factory-board-sync.yml`; otherwise it writes none, as today without a board.

#### Scenario: When the sync workflow is written

- **WHEN** `factory sync` runs with `tickets.board` set, or with a ticket system that has statuses of its own
- **THEN** it writes `.github/workflows/factory-board-sync.yml`; otherwise it writes none, as today without a board.

### Requirement: Statuses need tickets.columns

The factory SHALL behave as this line says: When the ticket system's adapter has statuses of its own and the settings in effect have no `tickets.columns`, every command that reads the settings exits 1 with `.claude/factory.yaml: tickets.columns: is required with tickets.type: TYPE: run factory init to choose which status shows each state`. GitHub Issues has none, so on GitHub "A board needs tickets.columns" stays as it is.

#### Scenario: Statuses need tickets.columns

- **WHEN** the ticket system's adapter has statuses of its own and the settings in effect have no `tickets.columns`
- **THEN** every command that reads the settings exits 1 with `.claude/factory.yaml: tickets.columns: is required with tickets.type: TYPE: run factory init to choose which status shows each state`. GitHub Issues has none, so on GitHub "A board needs tickets.columns" stays as it is.

### Requirement: Done in the last 24 hours

The factory SHALL behave as this line says: When `factory status` lists the tickets done in the last 24 hours, its line reads `Done in the last 24 hours:` in place of `Closed in the last 24 hours:`. A ticket's time there is the factory's move to done, else its card's last change while in a done column, else when the ticket system finished it.

#### Scenario: Done in the last 24 hours

- **WHEN** `factory status` lists the tickets done in the last 24 hours
- **THEN** its line reads `Done in the last 24 hours:` in place of `Closed in the last 24 hours:`. A ticket's time there is the factory's move to done, else its card's last change while in a done column, else when the ticket system finished it.
