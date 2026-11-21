## MODIFIED Requirements

### Requirement: The gate passes

The factory SHALL behave as this line says: When `factory gate` runs and `commands.gate` is set, it runs each command in order from the repository's root, prints `$ COMMAND` before each, passes its output through, and when every command exits 0, prints line 29's line and exits 0.

#### Scenario: The gate passes

- **WHEN** `factory gate` runs and `commands.gate` is set
- **THEN** it runs each command in order from the repository's root, prints `$ COMMAND` before each, passes its output through, and when every command exits 0, prints line 29's line and exits 0.

### Requirement: The gate fails

The factory SHALL behave as this line says: When a command of the gate fails, `factory gate` runs none after it, prints `✗ The gate failed on: COMMAND` on standard error, and exits 1.

#### Scenario: The gate fails

- **WHEN** a command of the gate fails
- **THEN** `factory gate` runs none after it, prints `✗ The gate failed on: COMMAND` on standard error, and exits 1.

## ADDED Requirements

### Requirement: Commands end with a line of their own

The factory SHALL behave as this line says: `test-one`, `end-to-end`, and `specs check` pass their command's output through, then print line 30's or 31's line, and exit with its status.

#### Scenario: Commands end with a line of their own

- **WHEN** `test-one`, `end-to-end`, or `specs check` runs its command
- **THEN** `test-one`, `end-to-end`, and `specs check` pass their command's output through, then print line 30's or 31's line, and exit with its status.
