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

The factory SHALL behave as this line says: `factory board check` prints a list state's row as its names joined by `, `, such as `review     Code review, QA`. It reports each listed name the board lacks, as it reports a single name today.

#### Scenario: Board check prints a list

- **WHEN** `factory board check` runs with a state given a list
- **THEN** it prints the state's row as its names joined by `, `, such as `review     Code review, QA`. It reports each listed name the board lacks, as it reports a single name today.

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
