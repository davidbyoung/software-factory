# column-suggestion Specification

## Purpose

`factory init`'s column step: the coding agent suggests which of an existing board's columns shows each state, and you accept, change, or refuse the suggestion before anything changes. Also the ready column init asks for when builds from the board turn on without one.

## Requirements

### Requirement: Init names the board's columns

The factory SHALL behave as this line says: When `factory init` will use an existing board that lacks a column for one of the six states, and the settings have no `tickets.columns`, init names the board's columns in board order and suggests a column for each state, after the poller question and before the plan.

#### Scenario: Init names the board's columns

- **WHEN** `factory init` will use a board that already exists, the board has at least one column, its Status field lacks a column for at least one of the six states, matched by the factory's own names ignoring capitals, and `.claude/factory.yaml` has no `tickets.columns`
- **THEN** init prints `Board N has the columns A, B, C, and D.`, with the names in board order. Then it suggests a column for each state. This comes after the question of where the poller runs and before the plan.

### Requirement: No column question otherwise

The factory SHALL behave as this line says: When the board has a column for every state, when the settings have `tickets.columns`, when init creates the board, or when the board has no columns, init asks nothing about columns and behaves as it does today.

#### Scenario: No column question otherwise

- **WHEN** the board has a column for every state, when the settings have `tickets.columns`, when init creates the board, or when the board has no columns
- **THEN** init asks nothing about columns and behaves as it does today.

### Requirement: Init asks the agent once

The factory SHALL behave as this line says: When the coding agent's command is installed, init prints `Asking <label> which of them shows each of the factory's six states...` and asks the agent once. It sends only the board's column names, each state's key and meaning, and whether builds start from the board.

#### Scenario: Init asks the agent once

- **WHEN** the coding agent's command is installed
- **THEN** init prints `Asking <label> which of them shows each of the factory's six states...` and asks the agent once. It sends only the board's column names, each state's key and meaning, and whether builds start from the board.

### Requirement: The suggestion's table

The factory SHALL behave as this line says: When the agent's answer is usable, init prints a table headed `State      Column`, with one row per state in the order backlog, refining, ready, building, review, done. Each row shows the board's column, as the board spells it; `<factory name>, which init adds`; or, for no column, what `factory board check` prints: `no column, shows in <column>`, or for ready, `no column: builds start only when you ask`.

#### Scenario: The suggestion's table

- **WHEN** the agent's answer is usable
- **THEN** init prints a table headed `State      Column`, with one row per state in the order backlog, refining, ready, building, review, done. Each row shows one of these:
  - the board's column, as the board spells it;
  - `<factory name>, which init adds`;
  - for no column, what `factory board check` prints: `no column, shows in <column>`, or for ready, `no column: builds start only when you ask`.

### Requirement: An answer that can't be used

The factory SHALL behave as this line says: When the answer can't be used, init prints three lines and exits 1, having written nothing and left the board unchanged: `<label>'s answer could not be used: <reason>.`, `Run factory init again, or write tickets.columns in .claude/factory.yaml yourself.`, and `Nothing changed.`

#### Scenario: An answer that can't be used

- **WHEN** the answer can't be used
- **THEN** init prints three lines and exits 1, having written nothing and left the board unchanged:
  - `<label>'s answer could not be used: <reason>.`
  - `Run factory init again, or write tickets.columns in .claude/factory.yaml yourself.`
  - `Nothing changed.`

### Requirement: Each reason has its own wording

The factory SHALL behave as this line says: Each reason an answer can't be used has its own wording, and when several apply, the first in the scenario's list is printed.

#### Scenario: Each reason has its own wording

- **WHEN** an answer can't be used for one or more of these reasons
- **THEN** each has its own wording, and when several apply, the first in this list is printed:
  - the command exits non-zero: `it failed: <first line of its error output>`, or `it failed with exit code <N>` when it printed no error;
  - no answer within 60 seconds: `it took longer than 60 seconds`;
  - a column the board lacks: `it named <column>, which board N doesn't have`. An answer to add a column the board already has, ignoring capitals, is read as that column, not as a reason;
  - one column for two states: `it put <column> in both <state> and <state>`;
  - a state missing: `it left out <state>`;
  - output with no answer in the form asked for, such as stdout that isn't JSON, or a value that isn't a string: `it did not answer in the form asked for`;
  - backlog with no column: `it gave backlog no column, and every ticket starts there`;
  - ready with no column while `builds.trigger` isn't `manual`: `it gave ready no column, and builds start from the board`.

### Requirement: Use these columns

The factory SHALL behave as this line says: After the table, init asks `Use these columns?` with `Yes`, `Change some`, and `No: add the factory's columns instead`. `Yes` is selected first.

#### Scenario: Use these columns

- **WHEN** init has printed the table
- **THEN** it asks `Use these columns?` with `Yes`, `Change some`, and `No: add the factory's columns instead`. `Yes` is selected first.

### Requirement: Yes writes only what differs

The factory SHALL behave as this line says: When you choose `Yes`, init writes under `tickets.columns` only the states whose column differs from the factory's name, ignoring capitals: the board's name, or `none` for no column. A state whose column is the factory's name, whether the board has it or init adds it, is not written. When no state differs, no `columns` block is written.

#### Scenario: Yes writes only what differs

- **WHEN** you choose `Yes`
- **THEN** init writes under `tickets.columns` only the states whose column differs from the factory's name, ignoring capitals: the board's name, or `none` for no column. A state whose column is the factory's name, whether the board has it or init adds it, is not written. When no state differs, no `columns` block is written.

### Requirement: Change some

The factory SHALL behave as this line says: When you choose `Change some`, init asks `Which states do you want to change?`, listing each state as `<key>: <its column, as the table shows it>`. Then, for each state picked, in table order, it asks `Which column shows <key>?`, with the current choice selected, offering the board's columns, a "No column" choice, and an "Add a column" choice, as the scenario lists. Then it shows the table and asks `Use these columns?` again.

#### Scenario: Change some

- **WHEN** you choose `Change some`
- **THEN** init asks `Which states do you want to change?`, listing each state as `<key>: <its column, as the table shows it>`. Then, for each state picked, in table order, it asks `Which column shows <key>?`, with the current choice selected, offering:
  - the board's columns, in board order;
  - `No column: <where a ticket goes>`. This is `a ticket being refined shows in <column>` for refining, `builds start only when you ask` for ready, `a ticket being built shows in <column>` for building, `a ticket in review shows in <column>` for review, and `a ticket that is done shows in <column>` for done. It is not offered for backlog, nor for ready when `builds.trigger` isn't `manual`;
  - `Add a column called "<factory name>"`, offered only when the board has no column of that name, ignoring capitals. When it has one, that column is in the list above. Each state can add only its own factory name, so two states can't add the same column.

  Then it shows the table and asks `Use these columns?` again.

### Requirement: One column for two states

The factory SHALL behave as this line says: When a column picked for a state already shows another state in the table as it stands, init prints `<column> already shows <other>. Pick another column for <key>.`. It keeps that state's earlier column and the columns picked for the states before it in the same pass. Then it asks `Which states do you want to change?` again, with every state still picked, so you can move the other state first.

#### Scenario: One column for two states

- **WHEN** a column picked for a state already shows another state in the table as it stands
- **THEN** init prints `<column> already shows <other>. Pick another column for <key>.`. It keeps that state's earlier column and the columns picked for the states before it in the same pass. Then it asks `Which states do you want to change?` again, with every state still picked, so you can move the other state first.

### Requirement: No adds the factory's columns

The factory SHALL behave as this line says: When you choose `No`, init writes no `tickets.columns`, and the board gains each of the factory's six columns it lacks, as today.

#### Scenario: No adds the factory's columns

- **WHEN** you choose `No`
- **THEN** init writes no `tickets.columns`, and the board gains each of the factory's six columns it lacks, as today.

### Requirement: Only the columns the mapping needs are added

The factory SHALL behave as this line says: After `Go ahead?`, the board gains only the columns the chosen mapping needs and lacks, and no others. With `backlog: Todo`, no Backlog column is added. `Added to board N:` lists them with the fields added.

#### Scenario: Only the columns the mapping needs are added

- **WHEN** you answer `Go ahead?`
- **THEN** the board gains only the columns the chosen mapping needs and lacks, and no others. With `backlog: Todo`, no Backlog column is added. `Added to board N:` lists them with the fields added.

### Requirement: Lines name the agent by its label

The factory SHALL behave as this line says: Every line of the column step names the agent by its registered label. With the test registry's Fake Agent, no line contains "Claude Code".

#### Scenario: Lines name the agent by its label

- **WHEN** the column step runs with the test registry's Fake Agent
- **THEN** every line of the column step names the agent by its registered label, and no line contains "Claude Code".

### Requirement: A ready column when builds from the board turn on

The factory SHALL behave as this line says: When a re-run of `factory init` turns on builds from the board, and the settings have `tickets.columns.ready: none`, init says so and asks which column shows ready, without asking the agent and without offering "No column".

#### Scenario: A ready column when builds from the board turn on

- **WHEN** a re-run of `factory init` turns on "Builds that start when you move a card to Ready", and the settings have `tickets.columns.ready: none`
- **THEN** init prints `Builds from the board start when a ticket moves to the ready column,` and `and your settings give ready no column.`, after the question of where the poller runs. Then it asks `Which column shows ready?`, without asking the agent. It offers the board's columns in board order and, when the board has no Ready column, `Add a column called "Ready"`, but no "No column". A column that already shows another state gets line 11's message, and the question is asked again. Add takes `ready` out of `tickets.columns`, and init adds the column. A board column writes `ready: <its name>`.
