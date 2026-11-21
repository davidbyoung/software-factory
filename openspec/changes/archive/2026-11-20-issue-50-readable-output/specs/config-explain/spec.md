## MODIFIED Requirements

### Requirement: Explain prints the lock's settings

The factory SHALL behave as this line says: When `factory config explain` prints plain text, every line after its first two is a line of the lock's `settings`, in order.

#### Scenario: Explain prints the lock's settings

- **WHEN** `factory config explain` prints plain text
- **THEN** every line after its first two is a line of the lock's `settings`, in order.

### Requirement: The output is a valid settings file

The factory SHALL behave as this line says: When `factory config explain` prints plain text and every comment is taken out, the output passes `factory config check` and reads as the same settings.

#### Scenario: The output is a valid settings file

- **WHEN** `factory config explain` prints plain text and every comment is taken out
- **THEN** the output passes `factory config check` and reads as the same settings.
