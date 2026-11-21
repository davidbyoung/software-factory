## ADDED Requirements

### Requirement: A board needs tickets.columns

The factory SHALL behave as this line says: When `tickets.board` is set and the settings in effect have no `tickets.columns`, or an empty or null one, every command that reads the settings, `factory config check` included, exits 1 with `.claude/factory.yaml: tickets.columns: is required with tickets.board: run factory init to choose which of board N's columns shows each state`.

#### Scenario: A board needs tickets.columns

- **WHEN** `tickets.board` is set and the settings in effect have no `tickets.columns`, or an empty or null one
- **THEN** every command that reads the settings, `factory config check` included, exits 1 with `.claude/factory.yaml: tickets.columns: is required with tickets.board: run factory init to choose which of board N's columns shows each state`.

### Requirement: Every state left out is named

The factory SHALL behave as this line says: When `tickets.board` is set and `tickets.columns` leaves out two or more of the six states, every command that reads the settings exits 1 with one message naming each state left out, worded as the scenario gives it.

#### Scenario: Every state left out is named

- **WHEN** `tickets.board` is set and `tickets.columns` leaves out two or more of the six states
- **THEN** every command that reads the settings exits 1 with `.claude/factory.yaml: tickets.columns: STATES have no column: give each a column, a list of columns, or none, or run factory init to choose them`. STATES names each state left out in the order backlog, refining, ready, building, review, done, joined with the Oxford comma: `building and done`, `refining, building, and done`.

### Requirement: One state left out

The factory SHALL behave as this line says: When `tickets.columns` leaves out exactly one state, the message is `.claude/factory.yaml: tickets.columns: STATE has no column: give it a column, a list of columns, or none, or run factory init to choose it`.

#### Scenario: One state left out

- **WHEN** `tickets.columns` leaves out exactly one state
- **THEN** the message is `.claude/factory.yaml: tickets.columns: STATE has no column: give it a column, a list of columns, or none, or run factory init to choose it`.

### Requirement: None and lists count as named

The factory SHALL behave as this line says: When a state's value is `none`, or a list, it counts as named for lines 2 and 3.

#### Scenario: None and lists count as named

- **WHEN** a state's value is `none`, or a list
- **THEN** it counts as named for lines 2 and 3.

### Requirement: A preset's states count as named

The factory SHALL behave as this line says: When a preset in effect supplies `tickets.columns`, or some of its states, those states count as named for lines 1 to 3.

#### Scenario: A preset's states count as named

- **WHEN** a preset in effect supplies `tickets.columns`, or some of its states
- **THEN** those states count as named for lines 1 to 3.

### Requirement: No board needs no columns

The factory SHALL behave as this line says: When `tickets.board` is not set, nothing about `tickets.columns` is required, and `tickets.columns` without it still fails with `needs tickets.board`, as today.

#### Scenario: No board needs no columns

- **WHEN** `tickets.board` is not set
- **THEN** nothing about `tickets.columns` is required, and `tickets.columns` without it still fails with `needs tickets.board`, as today.
