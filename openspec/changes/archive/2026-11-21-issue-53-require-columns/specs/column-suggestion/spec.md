## ADDED Requirements

### Requirement: Init writes a created board's columns

The factory SHALL behave as this line says: When `factory init` creates the board, it writes all six states under `tickets.columns`, each with the factory's name: `backlog: Backlog`, `refining: In refinement`, `ready: Ready`, `building: In progress`, `review: In review`, `done: Done`.

#### Scenario: Init writes a created board's columns

- **WHEN** `factory init` creates the board
- **THEN** it writes all six states under `tickets.columns`, each with the factory's name: `backlog: Backlog`, `refining: In refinement`, `ready: Ready`, `building: In progress`, `review: In review`, `done: Done`.

### Requirement: Init saves a board that has every column

The factory SHALL behave as this line says: When init will use an existing board whose Status field has a column of each of the factory's six names, ignoring capitals, and the settings have no `tickets.columns`, init asks nothing about columns. It prints `Board N has a column for each of the factory's six states:`, a blank line, and the `State      Column` table with a row per state, in the board's spelling, and writes all six states under `tickets.columns` in the board's spelling.

#### Scenario: Init saves a board that has every column

- **WHEN** init will use an existing board whose Status field has a column of each of the factory's six names, ignoring capitals, and the settings have no `tickets.columns`
- **THEN** init asks nothing about columns. It prints `Board N has a column for each of the factory's six states:`, a blank line, and the `State      Column` table with a row per state, in the board's spelling, and writes all six states under `tickets.columns` in the board's spelling.

### Requirement: Yes writes all six states

The factory SHALL behave as this line says: When you choose `Yes`, init writes all six states under `tickets.columns`: the board's column as the board spells it, `none`, or for a column init adds, the factory's name.

#### Scenario: Yes writes all six states

- **WHEN** you choose `Yes`
- **THEN** init writes all six states under `tickets.columns`: the board's column as the board spells it, `none`, or for a column init adds, the factory's name.

### Requirement: Change some writes all six states

The factory SHALL behave as this line says: When you choose `Change some` and then `Yes`, init writes all six states the same way.

#### Scenario: Change some writes all six states

- **WHEN** you choose `Change some` and then `Yes`
- **THEN** init writes all six states the same way.

### Requirement: Init reads a file missing only states

The factory SHALL behave as this line says: When `.claude/factory.yaml` fails only by lines 1 to 3, `factory init` reads it rather than stopping with `Fix it, then run init again.`. A file with any other fault still stops it so.

#### Scenario: Init reads a file missing only states

- **WHEN** `.claude/factory.yaml` fails only by lines 1 to 3
- **THEN** `factory init` reads it rather than stopping with `Fix it, then run init again.`. A file with any other fault still stops it so.

### Requirement: A re-run keeps written states and fills the rest

The factory SHALL behave as this line says: When a re-run finds `tickets.columns` written but leaving out states, init keeps each state written as it is, and fills in each missing state whose column of the factory's name the board has, ignoring capitals, without asking, unless a written state already names that column: such a state is asked for, as line 16 says. This comes after the question of where the poller runs and before the plan, where the column step is today.

#### Scenario: A re-run keeps written states and fills the rest

- **WHEN** a re-run finds `tickets.columns` written but leaving out states
- **THEN** init keeps each state written as it is, and fills in each missing state whose column of the factory's name the board has, ignoring capitals, without asking, unless a written state already names that column: such a state is asked for, as line 16 says. This comes after the question of where the poller runs and before the plan, where the column step is today.

### Requirement: A re-run that asks nothing

The factory SHALL behave as this line says: When line 14 fills in every missing state, init asks nothing. It prints `Your settings give no column to STATES.`, STATES joined as in line 2 but with `or` (`building or done`), then `Board N has a column of the factory's name for each:`, a blank line, and the `State      Column` table of all six states as they will be written, and writes them.

#### Scenario: A re-run that asks nothing

- **WHEN** line 14 fills in every missing state
- **THEN** init asks nothing. It prints `Your settings give no column to STATES.`, STATES joined as in line 2 but with `or` (`building or done`), then `Board N has a column of the factory's name for each:`, a blank line, and the `State      Column` table of all six states as they will be written, and writes them.

### Requirement: A re-run asks for a state it cannot fill

The factory SHALL behave as this line says: When a missing state has no column of the factory's name on the board, or one a written state already names, init says why and asks which column shows it, as `Change some` does, then confirms the table, as the scenario gives it.

#### Scenario: A re-run asks for a state it cannot fill

- **WHEN** a missing state has no column of the factory's name on the board
- **THEN** init prints `Your settings give no column to STATE, and board N has no NAME column.`; when the board has it but a written state names it, `Your settings give no column to STATE, and NAME already shows OTHER.`. Either way it asks `Which column shows STATE?`, offering what `Change some` offers for that state, with the same rule for one column for two states. It does so once for each such state, in table order, and prints no line for the missing states line 14 filled in. Then it shows the table of all six states and asks `Use these columns?`, as after `Change some`.

### Requirement: A re-run with no block suggests

The factory SHALL behave as this line says: When a re-run finds no `tickets.columns` and the board has some columns but lacks one of the factory's names, init runs the suggestion as on a first setup.

#### Scenario: A re-run with no block suggests

- **WHEN** a re-run finds no `tickets.columns` and the board has some columns but lacks one of the factory's names
- **THEN** init runs the suggestion as on a first setup.

### Requirement: A board with no columns gets the factory's

The factory SHALL behave as this line says: When init will use an existing board with no columns at all and the settings have no `tickets.columns`, init asks nothing about columns, as today, writes all six states with the factory's names, and the board gains those columns.

#### Scenario: A board with no columns gets the factory's

- **WHEN** init will use an existing board with no columns at all and the settings have no `tickets.columns`
- **THEN** init asks nothing about columns, as today, writes all six states with the factory's names, and the board gains those columns.

## MODIFIED Requirements

### Requirement: No column question otherwise

The factory SHALL behave as this line says: When the settings have every state under `tickets.columns`, or when init creates the board, init asks nothing about columns.

#### Scenario: No column question otherwise

- **WHEN** the settings have every state under `tickets.columns`, or init creates the board
- **THEN** init asks nothing about columns.

### Requirement: No adds the factory's columns

The factory SHALL behave as this line says: When you choose `No: add the factory's columns instead`, init writes all six states with the factory's names, and the board gains each of those columns it lacks.

#### Scenario: No adds the factory's columns

- **WHEN** you choose `No: add the factory's columns instead`
- **THEN** init writes all six states with the factory's names, and the board gains each of those columns it lacks.

### Requirement: A ready column when builds from the board turn on

The factory SHALL behave as this line says: When a re-run of `factory init` turns on builds from the board, and the settings have `tickets.columns.ready: none`, init says so and asks which column shows ready, without asking the agent and without offering "No column". When a re-run that turns on builds from the board answers `Which column shows ready?` with `Add a column called "Ready"`, init writes `ready: Ready`, and adds the column.

#### Scenario: A ready column when builds from the board turn on

- **WHEN** a re-run of `factory init` turns on "Builds that start when you move a card to Ready", and the settings have `tickets.columns.ready: none`
- **THEN** init prints `Builds from the board start when a ticket moves to the ready column,` and `and your settings give ready no column.`, after the question of where the poller runs. Then it asks `Which column shows ready?`, without asking the agent. It offers the board's columns in board order and, when the board has no Ready column, `Add a column called "Ready"`, but no "No column". A column that already shows another state gets line 11's message, and the question is asked again. Add writes `ready: Ready`, and init adds the column. A board column writes `ready: <its name>`.

## REMOVED Requirements

### Requirement: Yes writes only what differs

**Reason**: `Yes` now writes all six states, since a state left out no longer falls back to the factory's name.

**Migration**: A repository whose block has only the states that differ adds the rest by running `factory init` again, or by hand, as "Naming every column" in `docs/updating.md` says.
