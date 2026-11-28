# board-columns Specification

## Purpose

What `tickets.columns` means: which of a board's columns shows each of the six states, a state with a list of columns, and how the sync, `lunamill status`, `lunamill board check`, `lunamill doctor`, and `lunamill config check` read it.

## Requirements

### Requirement: A ticket in any listed column is in that state

lunamill SHALL behave as this line says: When a state under `tickets.columns` is a list of names, a ticket in any of them is in that state, for the board sync, `lunamill status`, and `lunamill board check`.

#### Scenario: A ticket in any listed column is in that state

- **WHEN** a state under `tickets.columns` is a list of names
- **THEN** a ticket in any of them is in that state, for the board sync, `lunamill status`, and `lunamill board check`.

### Requirement: The sync moves a ticket to the first name

lunamill SHALL behave as this line says: When the board sync puts a ticket in a state, it finds the column list that shows that state: the state's own list, or the earlier state's that it falls back to. If the ticket is already in any name of that list, the sync writes nothing. Otherwise it writes the first name. With `backlog: Todo` and `refining: none`, a ticket being refined that sits in Todo is not written.

#### Scenario: The sync moves a ticket to the first name

- **WHEN** the board sync puts a ticket in a state
- **THEN** it finds the column list that shows that state: the state's own list, or the earlier state's that it falls back to, as `columnFor` does today. If the ticket is already in any name of that list, the sync writes nothing. Otherwise it writes the first name. On the Proposed docs board, with `backlog: Todo` and `refining: none`, a ticket being refined that sits in Todo is not written.

### Requirement: Ready takes one column

lunamill SHALL behave as this line says: When `ready` is a list, `lunamill config check` fails with `.claude/lunamill.yaml: tickets.columns.ready: must be one column, or none: only a ticket you approved goes there`.

#### Scenario: Ready takes one column

- **WHEN** `ready` is a list
- **THEN** `lunamill config check` fails with `.claude/lunamill.yaml: tickets.columns.ready: must be one column, or none: only a ticket you approved goes there`.

### Requirement: A list names at least one column

lunamill SHALL behave as this line says: When a state's list is empty, `lunamill config check` fails with `.claude/lunamill.yaml: tickets.columns.<key>: must name at least one column`.

#### Scenario: A list names at least one column

- **WHEN** a state's list is empty
- **THEN** `lunamill config check` fails with `.claude/lunamill.yaml: tickets.columns.<key>: must name at least one column`.

### Requirement: A column is named once

lunamill SHALL behave as this line says: When a name appears in two states, `lunamill config check` fails with `.claude/lunamill.yaml: tickets.columns.<key>: names the same column as <other key>`, as it does for single names today. When a name appears twice in one list, the message is `names <name> twice`.

#### Scenario: A column is named once

- **WHEN** a name appears in two states, or twice in one list
- **THEN** `lunamill config check` fails with `.claude/lunamill.yaml: tickets.columns.<key>: names the same column as <other key>`, as it does for single names today. When a name appears twice in one list, the message is `names <name> twice`.

### Requirement: Board check prints a list

lunamill SHALL behave as this line says: `lunamill board check` prints a list state's row as its names joined by `, `, such as `✓ review     Code review, QA`, and a row whose names the board lacks as line 11 says.

#### Scenario: Board check prints a list

- **WHEN** `lunamill board check` runs with a state given a list
- **THEN** `lunamill board check` prints a list state's row as its names joined by `, `, such as `✓ review     Code review, QA`, and a row whose names the board lacks as line 11 says.

### Requirement: The board check needs every listed name

lunamill SHALL behave as this line says: `lunamill doctor`'s and init's `Board N has every column the settings name` passes only when the board has every listed name.

#### Scenario: The board check needs every listed name

- **WHEN** `lunamill doctor` or init checks the board with a state given a list
- **THEN** `Board N has every column the settings name` passes only when the board has every listed name.

### Requirement: A state's one column is the first name

lunamill SHALL behave as this line says: Where lunamill names a state's one column, it uses the first name in a list: in a sentence such as "The card stays In progress", and in a group heading of `lunamill status`.

#### Scenario: A state's one column is the first name

- **WHEN** lunamill names a state's one column, and the state has a list
- **THEN** it uses the first name in the list: in a sentence such as "The card stays In progress", and in a group heading of `lunamill status`.

### Requirement: A board needs tickets.columns

lunamill SHALL behave as this line says: When `tickets.board` is set and the settings in effect have no `tickets.columns`, or an empty or null one, every command that reads the settings, `lunamill config check` included, exits 1 with `.claude/lunamill.yaml: tickets.columns: is required with tickets.board: run lunamill init to choose which of board N's columns shows each state`.

#### Scenario: A board needs tickets.columns

- **WHEN** `tickets.board` is set and the settings in effect have no `tickets.columns`, or an empty or null one
- **THEN** every command that reads the settings, `lunamill config check` included, exits 1 with `.claude/lunamill.yaml: tickets.columns: is required with tickets.board: run lunamill init to choose which of board N's columns shows each state`.

### Requirement: Every state left out is named

lunamill SHALL behave as this line says: When `tickets.board` is set and `tickets.columns` leaves out two or more of the six states, every command that reads the settings exits 1 with one message naming each state left out, worded as the scenario gives it.

#### Scenario: Every state left out is named

- **WHEN** `tickets.board` is set and `tickets.columns` leaves out two or more of the six states
- **THEN** every command that reads the settings exits 1 with `.claude/lunamill.yaml: tickets.columns: STATES have no column: give each a column, a list of columns, or none, or run lunamill init to choose them`. STATES names each state left out in the order backlog, refining, ready, building, review, done, joined with the Oxford comma: `building and done`, `refining, building, and done`.

### Requirement: One state left out

lunamill SHALL behave as this line says: When `tickets.columns` leaves out exactly one state, the message is `.claude/lunamill.yaml: tickets.columns: STATE has no column: give it a column, a list of columns, or none, or run lunamill init to choose it`.

#### Scenario: One state left out

- **WHEN** `tickets.columns` leaves out exactly one state
- **THEN** the message is `.claude/lunamill.yaml: tickets.columns: STATE has no column: give it a column, a list of columns, or none, or run lunamill init to choose it`.

### Requirement: None and lists count as named

lunamill SHALL behave as this line says: When a state's value is `none`, or a list, it counts as named for lines 2 and 3.

#### Scenario: None and lists count as named

- **WHEN** a state's value is `none`, or a list
- **THEN** it counts as named for lines 2 and 3.

### Requirement: A preset's states count as named

lunamill SHALL behave as this line says: When a preset in effect supplies `tickets.columns`, or some of its states, those states count as named for lines 1 to 3.

#### Scenario: A preset's states count as named

- **WHEN** a preset in effect supplies `tickets.columns`, or some of its states
- **THEN** those states count as named for lines 1 to 3.

### Requirement: No board needs no columns

lunamill SHALL behave as this line says: When `tickets.board` is not set, nothing about `tickets.columns` is required, and `tickets.columns` without it still fails with `needs tickets.board`, as today.

#### Scenario: No board needs no columns

- **WHEN** `tickets.board` is not set
- **THEN** nothing about `tickets.columns` is required, and `tickets.columns` without it still fails with `needs tickets.board`, as today.

### Requirement: A merge moves the ticket to done

lunamill SHALL behave as this line says: When the pull request that closes a labeled ticket merges, the sync records a `merged` event, moves the ticket to the first column `tickets.columns.done` lists, then has the adapter finish it: on GitHub, close it if it is open, posting nothing.

#### Scenario: A merge moves the ticket to done

- **WHEN** the pull request that closes a labeled ticket merges
- **THEN** the sync records a `merged` event, moves the ticket to the first column `tickets.columns.done` lists, then has the adapter finish it: on GitHub, close it if it is open, posting nothing.

### Requirement: A done ticket is left alone

lunamill SHALL behave as this line says: When a labeled ticket is in any column `tickets.columns.done` lists, the sync writes no column for it.

#### Scenario: A done ticket is left alone

- **WHEN** a labeled ticket is in any column `tickets.columns.done` lists
- **THEN** the sync writes no column for it.

### Requirement: Finished is done without a board

lunamill SHALL behave as this line says: When there is no board, a ticket the ticket system reports as finished (on GitHub, closed) is done.

#### Scenario: Finished is done without a board

- **WHEN** there is no board
- **THEN** a ticket the ticket system reports as finished (on GitHub, closed) is done.

### Requirement: When the sync workflow is written

lunamill SHALL behave as this line says: When `lunamill sync` runs with `tickets.board` set, or with a ticket system that has statuses of its own, the board sync's job in `.github/workflows/lunamill.yml` is on; otherwise it is off, as today without a board.

#### Scenario: When the sync workflow is written

- **WHEN** `lunamill sync` runs with `tickets.board` set, or with a ticket system that has statuses of its own
- **THEN** the board sync's job in `.github/workflows/lunamill.yml` is on; otherwise it is off, as today without a board.

### Requirement: Statuses need tickets.columns

lunamill SHALL behave as this line says: When the ticket system's adapter has statuses of its own and the settings in effect have no `tickets.columns`, every command that reads the settings exits 1 with `.claude/lunamill.yaml: tickets.columns: is required with tickets.type: TYPE: run lunamill init to choose which status shows each state`. GitHub Issues has none, so on GitHub "A board needs tickets.columns" stays as it is.

#### Scenario: Statuses need tickets.columns

- **WHEN** the ticket system's adapter has statuses of its own and the settings in effect have no `tickets.columns`
- **THEN** every command that reads the settings exits 1 with `.claude/lunamill.yaml: tickets.columns: is required with tickets.type: TYPE: run lunamill init to choose which status shows each state`. GitHub Issues has none, so on GitHub "A board needs tickets.columns" stays as it is.

### Requirement: Done in the last 24 hours

lunamill SHALL behave as this line says: When `lunamill status` lists the tickets done in the last 24 hours, its line reads `Done in the last 24 hours:` in place of `Closed in the last 24 hours:`. A ticket's time there is lunamill's move to done, else its card's last change while in a done column, else when the ticket system finished it.

#### Scenario: Done in the last 24 hours

- **WHEN** `lunamill status` lists the tickets done in the last 24 hours
- **THEN** its line reads `Done in the last 24 hours:` in place of `Closed in the last 24 hours:`. A ticket's time there is lunamill's move to done, else its card's last change while in a done column, else when the ticket system finished it.
