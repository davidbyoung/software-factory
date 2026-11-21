## ADDED Requirements

### Requirement: Explain prints the branch name

The factory SHALL behave as this line says: When `factory config explain` runs, it prints `code-host` as a block with `type` and `branch-name`, never on one line, with `branch-name` in double quotes, unmarked when the file sets it and marked with the preset's name when a preset does.

#### Scenario: Explain prints the branch name

- **WHEN** `factory config explain` runs
- **THEN** it prints `code-host` as a block with `type` and `branch-name`, never on one line, with `branch-name` in double quotes, unmarked when the file sets it and marked with the preset's name when a preset does.
