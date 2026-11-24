## MODIFIED Requirements

### Requirement: Init names the board's columns

The factory SHALL behave as this line says: When `factory init` will use an existing board that lacks a column for one of the six states, and neither the settings nor a preset has `tickets.columns`, init names the board's columns in board order and suggests a column for each state, after the poller question and before the plan.

#### Scenario: Init names the board's columns

- **WHEN** `factory init` will use a board that already exists, the board has at least one column, its Status field lacks a column for at least one of the six states, matched by the factory's own names ignoring capitals, and neither `.claude/factory.yaml` nor a preset the repository follows has `tickets.columns`
- **THEN** init prints `Board N has the columns A, B, C, and D.`, with the names in board order. Then it suggests a column for each state. This comes after the question of where the poller runs and before the plan.

### Requirement: An answer that can't be used

The factory SHALL behave as this line says: When the answer can't be used, init does not stop: it prints `<label>'s answer could not be used: <reason>.` and `Choose the column for each state yourself.`, asks which column shows each of the six states in turn, and shows the table to accept or change. Nothing is written, and the board is unchanged, until the plan is approved.

#### Scenario: An answer that can't be used

- **WHEN** the answer can't be used
- **THEN** init prints two lines, and then asks one question for each state, from backlog to done, `Which column shows <state>?`, with the choices the "Change some" answer offers for that state. It then prints the table and asks `Use these columns?`, with `Yes` and `Change some`, and carries on to the plan:
  - `<label>'s answer could not be used: <reason>.`
  - `Choose the column for each state yourself.`

### Requirement: Each reason has its own wording

The factory SHALL behave as this line says: Each reason an answer can't be used has its own wording, and when several apply, the first in the scenario's list is printed. A command that exits non-zero gives what its answer says went wrong, and its error output only when the answer says nothing.

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
