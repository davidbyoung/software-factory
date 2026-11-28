# column-suggestion Specification

## Purpose

`lunamill init`'s column step: the coding agent suggests which of an existing board's columns shows each state, and you accept, change, or refuse the suggestion before anything changes. Also the ready column init asks for when builds from the board turn on without one.

## Requirements

### Requirement: Init names the board's columns

Lunamill SHALL behave as this line says: When `lunamill init` will use an existing board that lacks a column for one of the six states, and neither the settings nor a preset has `tickets.columns`, init names the board's columns in board order and suggests a column for each state, after the poller question and before the plan.

#### Scenario: Init names the board's columns

- **WHEN** `lunamill init` will use a board that already exists, the board has at least one column, its Status field lacks a column for at least one of the six states, matched by Lunamill's own names ignoring capitals, and neither `.claude/lunamill.yaml` nor a preset the repository follows has `tickets.columns`
- **THEN** init prints `Board N has the columns A, B, C, and D.`, with the names in board order. Then it suggests a column for each state. This comes after the question of where the poller runs and before the plan.

### Requirement: No column question otherwise

Lunamill SHALL behave as this line says: When the settings have every state under `tickets.columns`, or when init creates the board, init asks nothing about columns.

#### Scenario: No column question otherwise

- **WHEN** the settings have every state under `tickets.columns`, or init creates the board
- **THEN** init asks nothing about columns.

### Requirement: Init asks the agent once

Lunamill SHALL behave as this line says: When the coding agent's command is installed, init prints `Asking <label> which of them shows each of Lunamill's six states...` and asks the agent once. It sends only the board's column names, each state's key and meaning, and whether builds start from the board.

#### Scenario: Init asks the agent once

- **WHEN** the coding agent's command is installed
- **THEN** init prints `Asking <label> which of them shows each of Lunamill's six states...` and asks the agent once. It sends only the board's column names, each state's key and meaning, and whether builds start from the board.

### Requirement: The suggestion's table

Lunamill SHALL behave as this line says: When the agent's answer is usable, init prints a table headed `State      Column`, with one row per state in the order backlog, refining, ready, building, review, done. Each row shows the board's column, as the board spells it; `<Lunamill name>, which init adds`; or, for no column, what `lunamill board check` prints: `none, shows in <column>`, or for ready, `none`.

#### Scenario: The suggestion's table

- **WHEN** the agent's answer is usable
- **THEN** init prints a table headed `State      Column`, with one row per state in the order backlog, refining, ready, building, review, done. Each row shows one of these:
  - the board's column, as the board spells it;
  - `<Lunamill name>, which init adds`;
  - for no column, what `lunamill board check` prints: `none, shows in <column>`, or for ready, `none`.

### Requirement: An answer that can't be used

Lunamill SHALL behave as this line says: When the answer can't be used, init does not stop: it prints `<label>'s answer could not be used: <reason>.` and `Choose the column for each state yourself.`, asks which column shows each of the six states in turn, and shows the table to accept or change. Nothing is written, and the board is unchanged, until the plan is approved.

#### Scenario: An answer that can't be used

- **WHEN** the answer can't be used
- **THEN** init prints two lines, and then asks one question for each state, from backlog to done, `Which column shows <state>?`, with the choices the "Change some" answer offers for that state. It then prints the table and asks `Use these columns?`, with `Yes` and `Change some`, and carries on to the plan:
  - `<label>'s answer could not be used: <reason>.`
  - `Choose the column for each state yourself.`

### Requirement: Each reason has its own wording

Lunamill SHALL behave as this line says: Each reason an answer can't be used has its own wording, and when several apply, the first in the scenario's list is printed. A command that exits non-zero gives what its answer says went wrong, and its error output only when the answer says nothing.

#### Scenario: Each reason has its own wording

- **WHEN** an answer can't be used for one or more of these reasons
- **THEN** each has its own wording, and when several apply, the first in this list is printed:
  - the command exits non-zero: `it failed: <first line of what its answer says went wrong>`, or of its error output when the answer says nothing, or `it failed with exit code <N>` when it printed neither;
  - no answer within 60 seconds: `it took longer than 60 seconds`;
  - a column the board lacks: `it named <column>, which board N doesn't have`. An answer to add a column the board already has, ignoring capitals, is read as that column, not as a reason;
  - one column for two states: `it put <column> in both <state> and <state>`;
  - a state missing: `it left out <state>`;
  - output with no answer in the form asked for, such as stdout that isn't JSON, or a value that isn't a string: `it did not answer in the form asked for`;
  - backlog with no column: `it gave backlog no column, and every ticket starts there`;
  - ready with no column while `builds.trigger` isn't `manual`: `it gave ready no column, and builds start from the board`.

#### Scenario: The command's answer says what went wrong

- **WHEN** the coding agent's command exits non-zero, prints a warning on its error output, and gives `Failed to authenticate` as its answer's result
- **THEN** the reason is `it failed: Failed to authenticate`, not the warning. The command is started with its standard input closed, so it waits for no input and prints no warning that none came.

### Requirement: Use these columns

Lunamill SHALL behave as this line says: After the table, init asks `Use these columns?` with `Yes`, `Change some`, and `No: add Lunamill's columns instead`. `Yes` is selected first.

#### Scenario: Use these columns

- **WHEN** init has printed the table
- **THEN** it asks `Use these columns?` with `Yes`, `Change some`, and `No: add Lunamill's columns instead`. `Yes` is selected first.

### Requirement: Change some

Lunamill SHALL behave as this line says: When you choose `Change some`, init asks `Which states do you want to change?`, listing each state as `<key>: <its column, as the table shows it>`. Then, for each state picked, in table order, it asks `Which column shows <key>?`, with the current choice selected, offering the board's columns, a "No column" choice, and an "Add a column" choice, as the scenario lists. Then it shows the table and asks `Use these columns?` again.

#### Scenario: Change some

- **WHEN** you choose `Change some`
- **THEN** init asks `Which states do you want to change?`, listing each state as `<key>: <its column, as the table shows it>`. Then, for each state picked, in table order, it asks `Which column shows <key>?`, with the current choice selected, offering:
  - the board's columns, in board order;
  - `No column: <where a ticket goes>`. This is `a ticket being refined shows in <column>` for refining, `builds start only when you ask` for ready, `a ticket being built shows in <column>` for building, `a ticket in review shows in <column>` for review, and `a ticket that is done shows in <column>` for done. It is not offered for backlog, nor for ready when `builds.trigger` isn't `manual`;
  - `Add a column called "<Lunamill name>"`, offered only when the board has no column of that name, ignoring capitals. When it has one, that column is in the list above. Each state can add only its own Lunamill name, so two states can't add the same column.

  Then it shows the table and asks `Use these columns?` again.

### Requirement: One column for two states

Lunamill SHALL behave as this line says: When a column picked for a state already shows another state in the table as it stands, init prints `<column> already shows <other>. Pick another column for <key>.`. It keeps that state's earlier column and the columns picked for the states before it in the same pass. Then it asks `Which states do you want to change?` again, with every state still picked, so you can move the other state first.

#### Scenario: One column for two states

- **WHEN** a column picked for a state already shows another state in the table as it stands
- **THEN** init prints `<column> already shows <other>. Pick another column for <key>.`. It keeps that state's earlier column and the columns picked for the states before it in the same pass. Then it asks `Which states do you want to change?` again, with every state still picked, so you can move the other state first.

### Requirement: No adds Lunamill's columns

Lunamill SHALL behave as this line says: When you choose `No: add Lunamill's columns instead`, init writes all six states with Lunamill's names, and the board gains each of those columns it lacks.

#### Scenario: No adds Lunamill's columns

- **WHEN** you choose `No: add Lunamill's columns instead`
- **THEN** init writes all six states with Lunamill's names, and the board gains each of those columns it lacks.

### Requirement: Only the columns the mapping needs are added

Lunamill SHALL behave as this line says: After `Go ahead?`, the board gains only the columns the chosen mapping needs and lacks, and no others. With `backlog: Todo`, no Backlog column is added. `Added to board N:` lists them with the fields added.

#### Scenario: Only the columns the mapping needs are added

- **WHEN** you answer `Go ahead?`
- **THEN** the board gains only the columns the chosen mapping needs and lacks, and no others. With `backlog: Todo`, no Backlog column is added. `Added to board N:` lists them with the fields added.

### Requirement: Lines name the agent by its label

Lunamill SHALL behave as this line says: Every line of the column step names the agent by its registered label. With the test registry's Fake Agent, no line contains "Claude Code".

#### Scenario: Lines name the agent by its label

- **WHEN** the column step runs with the test registry's Fake Agent
- **THEN** every line of the column step names the agent by its registered label, and no line contains "Claude Code".

### Requirement: A ready column when builds from the board turn on

Lunamill SHALL behave as this line says: When a re-run of `lunamill init` turns on builds from the board, and the settings have `tickets.columns.ready: none`, init says so and asks which column shows ready, without asking the agent and without offering "No column". When a re-run that turns on builds from the board answers `Which column shows ready?` with `Add a column called "Ready"`, init writes `ready: Ready`, and adds the column.

#### Scenario: A ready column when builds from the board turn on

- **WHEN** a re-run of `lunamill init` turns on "Builds that start when you move a card to Ready", and the settings have `tickets.columns.ready: none`
- **THEN** init prints `Builds from the board start when a ticket moves to the ready column,` and `and your settings give ready no column.`, after the question of where the poller runs. Then it asks `Which column shows ready?`, without asking the agent. It offers the board's columns in board order and, when the board has no Ready column, `Add a column called "Ready"`, but no "No column". A column that already shows another state gets line 11's message, and the question is asked again. Add writes `ready: Ready`, and init adds the column. A board column writes `ready: <its name>`.

### Requirement: Init writes a created board's columns

Lunamill SHALL behave as this line says: When `lunamill init` creates the board, it writes all six states under `tickets.columns`, each with Lunamill's name: `backlog: Backlog`, `refining: In refinement`, `ready: Ready`, `building: In progress`, `review: In review`, `done: Done`.

#### Scenario: Init writes a created board's columns

- **WHEN** `lunamill init` creates the board
- **THEN** it writes all six states under `tickets.columns`, each with Lunamill's name: `backlog: Backlog`, `refining: In refinement`, `ready: Ready`, `building: In progress`, `review: In review`, `done: Done`.

### Requirement: Init saves a board that has every column

Lunamill SHALL behave as this line says: When init will use an existing board whose Status field has a column of each of Lunamill's six names, ignoring capitals, and the settings have no `tickets.columns`, init asks nothing about columns. It prints `Board N has a column for each of Lunamill's six states:`, a blank line, and the `State      Column` table with a row per state, in the board's spelling, and writes all six states under `tickets.columns` in the board's spelling.

#### Scenario: Init saves a board that has every column

- **WHEN** init will use an existing board whose Status field has a column of each of Lunamill's six names, ignoring capitals, and the settings have no `tickets.columns`
- **THEN** init asks nothing about columns. It prints `Board N has a column for each of Lunamill's six states:`, a blank line, and the `State      Column` table with a row per state, in the board's spelling, and writes all six states under `tickets.columns` in the board's spelling.

### Requirement: Yes writes all six states

Lunamill SHALL behave as this line says: When you choose `Yes`, init writes all six states under `tickets.columns`: the board's column as the board spells it, `none`, or for a column init adds, Lunamill's name.

#### Scenario: Yes writes all six states

- **WHEN** you choose `Yes`
- **THEN** init writes all six states under `tickets.columns`: the board's column as the board spells it, `none`, or for a column init adds, Lunamill's name.

### Requirement: Change some writes all six states

Lunamill SHALL behave as this line says: When you choose `Change some` and then `Yes`, init writes all six states the same way.

#### Scenario: Change some writes all six states

- **WHEN** you choose `Change some` and then `Yes`
- **THEN** init writes all six states the same way.

### Requirement: Init reads a file missing only states

Lunamill SHALL behave as this line says: When `.claude/lunamill.yaml` fails only by lines 1 to 3, `lunamill init` reads it rather than stopping with `Fix it, then run init again.`. A file with any other fault still stops it so.

#### Scenario: Init reads a file missing only states

- **WHEN** `.claude/lunamill.yaml` fails only by lines 1 to 3
- **THEN** `lunamill init` reads it rather than stopping with `Fix it, then run init again.`. A file with any other fault still stops it so.

### Requirement: A re-run keeps written states and fills the rest

Lunamill SHALL behave as this line says: When a re-run finds `tickets.columns` written but leaving out states, init keeps each state written as it is, and fills in each missing state whose column of Lunamill's name the board has, ignoring capitals, without asking, unless a written state already names that column: such a state is asked for, as line 16 says. This comes after the question of where the poller runs and before the plan, where the column step is today.

#### Scenario: A re-run keeps written states and fills the rest

- **WHEN** a re-run finds `tickets.columns` written but leaving out states
- **THEN** init keeps each state written as it is, and fills in each missing state whose column of Lunamill's name the board has, ignoring capitals, without asking, unless a written state already names that column: such a state is asked for, as line 16 says. This comes after the question of where the poller runs and before the plan, where the column step is today.

### Requirement: A re-run that asks nothing

Lunamill SHALL behave as this line says: When line 14 fills in every missing state, init asks nothing. It prints `Your settings give no column to STATES.`, STATES joined as in line 2 but with `or` (`building or done`), then `Board N has a column of Lunamill's name for each:`, a blank line, and the `State      Column` table of all six states as they will be written, and writes them.

#### Scenario: A re-run that asks nothing

- **WHEN** line 14 fills in every missing state
- **THEN** init asks nothing. It prints `Your settings give no column to STATES.`, STATES joined as in line 2 but with `or` (`building or done`), then `Board N has a column of Lunamill's name for each:`, a blank line, and the `State      Column` table of all six states as they will be written, and writes them.

### Requirement: A re-run asks for a state it cannot fill

Lunamill SHALL behave as this line says: When a missing state has no column of Lunamill's name on the board, or one a written state already names, init says why and asks which column shows it, as `Change some` does, then confirms the table, as the scenario gives it.

#### Scenario: A re-run asks for a state it cannot fill

- **WHEN** a missing state has no column of Lunamill's name on the board
- **THEN** init prints `Your settings give no column to STATE, and board N has no NAME column.`; when the board has it but a written state names it, `Your settings give no column to STATE, and NAME already shows OTHER.`. Either way it asks `Which column shows STATE?`, offering what `Change some` offers for that state, with the same rule for one column for two states. It does so once for each such state, in table order, and prints no line for the missing states line 14 filled in. Then it shows the table of all six states and asks `Use these columns?`, as after `Change some`.

### Requirement: A re-run with no block suggests

Lunamill SHALL behave as this line says: When a re-run finds no `tickets.columns` and the board has some columns but lacks one of Lunamill's names, init runs the suggestion as on a first setup.

#### Scenario: A re-run with no block suggests

- **WHEN** a re-run finds no `tickets.columns` and the board has some columns but lacks one of Lunamill's names
- **THEN** init runs the suggestion as on a first setup.

### Requirement: A board with no columns gets Lunamill's

Lunamill SHALL behave as this line says: When init will use an existing board with no columns at all and the settings have no `tickets.columns`, init asks nothing about columns, as today, writes all six states with Lunamill's names, and the board gains those columns.

#### Scenario: A board with no columns gets Lunamill's

- **WHEN** init will use an existing board with no columns at all and the settings have no `tickets.columns`
- **THEN** init asks nothing about columns, as today, writes all six states with Lunamill's names, and the board gains those columns.
