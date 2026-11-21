## MODIFIED Requirements

### Requirement: The output is a valid settings file

The factory SHALL behave as this line says: When `factory config explain` prints plain text and every `# default` comment is taken out, the output passes `factory config check` and reads as the same settings.

#### Scenario: The output is a valid settings file

- **WHEN** `factory config explain` prints plain text and every `# default` comment is taken out
- **THEN** the output passes `factory config check` and reads as the same settings.

### Requirement: Explain prints the lock's settings

The factory SHALL behave as this line says: When `factory config explain` runs, it reads the lock's `settings` and prints them, so its plain text and the lock's `settings` are the same lines.

#### Scenario: Explain prints the lock's settings

- **WHEN** `factory config explain` runs
- **THEN** it reads the lock's `settings` and prints them, so its plain text and the lock's `settings` are the same lines.
