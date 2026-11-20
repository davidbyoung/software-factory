## ADDED Requirements

### Requirement: Explain prints a list of columns as a list

The factory SHALL behave as this line says: When a state under `tickets.columns` is a list, `factory config explain` prints it as a YAML list. A single name prints as a string, as today.

#### Scenario: Explain prints a list of columns as a list

- **WHEN** a state under `tickets.columns` is a list
- **THEN** `factory config explain` prints it as a YAML list. A single name prints as a string, as today.
