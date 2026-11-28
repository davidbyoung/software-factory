# repository-line Specification

## Purpose

Which repository a command acts on in a cloud run, and the check on a pull request of the line that says so.

## Requirements

### Requirement: The repository in a run

kodor SHALL behave as this line says: When a command that reads the settings runs in a cloud run, it takes the repository from the `repository` line. A step that reads no settings takes it from the run, as today.

#### Scenario: The repository in a run

- **WHEN** a command that reads the settings runs in a cloud run
- **THEN** it takes the repository from the `repository` line. A step that reads no settings takes it from the run, as today.

### Requirement: A stale repository line

kodor SHALL behave as this line says: When `kodor sync --check` runs on a pull request and the line names another repository than the one it is in, it prints `✗ repository: .claude/kodor.yaml says acme/web, and this pull request is in acme/website. Change the line and run kodor sync.` and exits 1.

#### Scenario: A stale repository line

- **WHEN** `kodor sync --check` runs on a pull request and the line names another repository than the one it is in
- **THEN** it prints `✗ repository: .claude/kodor.yaml says acme/web, and this pull request is in acme/website. Change the line and run kodor sync.` and exits 1.
