## ADDED Requirements

### Requirement: The repository in a run

The factory SHALL behave as this line says: When a command that reads the settings runs in a cloud run, it takes the repository from the `repository` line. A step that reads no settings takes it from the run, as today.

#### Scenario: The repository in a run

- **WHEN** a command that reads the settings runs in a cloud run
- **THEN** it takes the repository from the `repository` line. A step that reads no settings takes it from the run, as today.

### Requirement: A stale repository line

The factory SHALL behave as this line says: When `factory sync --check` runs on a pull request and the line names another repository than the one it is in, it prints `✗ repository: .claude/factory.yaml says acme/web, and this pull request is in acme/website. Change the line and run factory sync.` and exits 1.

#### Scenario: A stale repository line

- **WHEN** `factory sync --check` runs on a pull request and the line names another repository than the one it is in
- **THEN** it prints `✗ repository: .claude/factory.yaml says acme/web, and this pull request is in acme/website. Change the line and run factory sync.` and exits 1.
