## MODIFIED Requirements

### Requirement: The specs check says how it went

The factory SHALL behave as this line says: When `factory specs check` runs the check, it prints `✓ The specs check passed.` last, on standard output, when the check exits 0, and `✗ The specs check failed.` on standard error otherwise. With `specs.type: none` it prints only line 25's line.

#### Scenario: The specs check says how it went

- **WHEN** `factory specs check` runs the check
- **THEN** It prints `✓ The specs check passed.` last, on standard output, when the check exits 0, and `✗ The specs check failed.` on standard error otherwise. With `specs.type: none` it prints only line 25's line.
