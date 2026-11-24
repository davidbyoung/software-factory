## MODIFIED Requirements

### Requirement: Init names the board's columns

The factory SHALL behave as this line says: When `factory init` will use an existing board that lacks a column for one of the six states, and neither the settings nor a preset has `tickets.columns`, init names the board's columns in board order and suggests a column for each state, after the poller question and before the plan.

#### Scenario: Init names the board's columns

- **WHEN** `factory init` will use a board that already exists, the board has at least one column, its Status field lacks a column for at least one of the six states, matched by the factory's own names ignoring capitals, and neither `.claude/factory.yaml` nor a preset the repository follows has `tickets.columns`
- **THEN** init prints `Board N has the columns A, B, C, and D.`, with the names in board order. Then it suggests a column for each state. This comes after the question of where the poller runs and before the plan.
