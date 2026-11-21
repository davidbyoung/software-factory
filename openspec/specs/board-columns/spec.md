# board-columns Specification

## Purpose

What `tickets.columns` means: which of a board's columns shows each of the six states, a state with a list of columns, and how the sync, `factory status`, `factory board check`, `factory doctor`, and `factory config check` read it.

## Requirements

### Requirement: A ticket in any listed column is in that state

The factory SHALL behave as this line says: When a state under `tickets.columns` is a list of names, a ticket in any of them is in that state, for the board sync, `factory status`, and `factory board check`.

#### Scenario: A ticket in any listed column is in that state

- **WHEN** a state under `tickets.columns` is a list of names
- **THEN** a ticket in any of them is in that state, for the board sync, `factory status`, and `factory board check`.

### Requirement: The sync moves a ticket to the first name

The factory SHALL behave as this line says: When the board sync puts a ticket in a state, it finds the column list that shows that state: the state's own list, or the earlier state's that it falls back to. If the ticket is already in any name of that list, the sync writes nothing. Otherwise it writes the first name. With `backlog: Todo` and `refining: none`, a ticket being refined that sits in Todo is not written.

#### Scenario: The sync moves a ticket to the first name

- **WHEN** the board sync puts a ticket in a state
- **THEN** it finds the column list that shows that state: the state's own list, or the earlier state's that it falls back to, as `columnFor` does today. If the ticket is already in any name of that list, the sync writes nothing. Otherwise it writes the first name. On the Proposed docs board, with `backlog: Todo` and `refining: none`, a ticket being refined that sits in Todo is not written.

### Requirement: Ready takes one column

The factory SHALL behave as this line says: When `ready` is a list, `factory config check` fails with `.claude/factory.yaml: tickets.columns.ready: must be one column, or none: only a ticket you approved goes there`.

#### Scenario: Ready takes one column

- **WHEN** `ready` is a list
- **THEN** `factory config check` fails with `.claude/factory.yaml: tickets.columns.ready: must be one column, or none: only a ticket you approved goes there`.

### Requirement: A list names at least one column

The factory SHALL behave as this line says: When a state's list is empty, `factory config check` fails with `.claude/factory.yaml: tickets.columns.<key>: must name at least one column`.

#### Scenario: A list names at least one column

- **WHEN** a state's list is empty
- **THEN** `factory config check` fails with `.claude/factory.yaml: tickets.columns.<key>: must name at least one column`.

### Requirement: A column is named once

The factory SHALL behave as this line says: When a name appears in two states, `factory config check` fails with `.claude/factory.yaml: tickets.columns.<key>: names the same column as <other key>`, as it does for single names today. When a name appears twice in one list, the message is `names <name> twice`.

#### Scenario: A column is named once

- **WHEN** a name appears in two states, or twice in one list
- **THEN** `factory config check` fails with `.claude/factory.yaml: tickets.columns.<key>: names the same column as <other key>`, as it does for single names today. When a name appears twice in one list, the message is `names <name> twice`.

### Requirement: Board check prints a list

The factory SHALL behave as this line says: `factory board check` prints a list state's row as its names joined by `, `, such as `✓ review     Code review, QA`, and a row whose names the board lacks as line 11 says.

#### Scenario: Board check prints a list

- **WHEN** `factory board check` runs with a state given a list
- **THEN** `factory board check` prints a list state's row as its names joined by `, `, such as `✓ review     Code review, QA`, and a row whose names the board lacks as line 11 says.

### Requirement: The board check needs every listed name

The factory SHALL behave as this line says: `factory doctor`'s and init's `Board N has every column the settings name` passes only when the board has every listed name.

#### Scenario: The board check needs every listed name

- **WHEN** `factory doctor` or init checks the board with a state given a list
- **THEN** `Board N has every column the settings name` passes only when the board has every listed name.

### Requirement: A state's one column is the first name

The factory SHALL behave as this line says: Where the factory names a state's one column, it uses the first name in a list: in a sentence such as "The card stays In progress", and in a group heading of `factory status`.

#### Scenario: A state's one column is the first name

- **WHEN** the factory names a state's one column, and the state has a list
- **THEN** it uses the first name in the list: in a sentence such as "The card stays In progress", and in a group heading of `factory status`.

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
