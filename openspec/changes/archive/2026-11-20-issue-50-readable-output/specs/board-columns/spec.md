## MODIFIED Requirements

### Requirement: Board check prints a list

The factory SHALL behave as this line says: `factory board check` prints a list state's row as its names joined by `, `, such as `✓ review     Code review, QA`, and a row whose names the board lacks as line 11 says.

#### Scenario: Board check prints a list

- **WHEN** `factory board check` runs with a state given a list
- **THEN** `factory board check` prints a list state's row as its names joined by `, `, such as `✓ review     Code review, QA`, and a row whose names the board lacks as line 11 says.
