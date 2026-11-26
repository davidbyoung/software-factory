## ADDED Requirements

### Requirement: Explain writes items

The factory SHALL behave as this line says: When a command setting has items, `factory config explain` writes each as the item it is, with `in` and `files`, and writes `commands.ignore`, a list of sites, and a preset's `in`, as a valid settings file.

#### Scenario: Explain writes items

- **WHEN** When a command setting has items
- **THEN** `factory config explain` writes each as the item it is, with `in` and `files`, and writes `commands.ignore`, a list of sites, and a preset's `in`, as a valid settings file.
