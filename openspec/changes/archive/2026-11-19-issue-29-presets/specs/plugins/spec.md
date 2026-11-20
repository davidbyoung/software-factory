## ADDED Requirements

### Requirement: A plugin a preset ships is present

The factory SHALL behave as this line says: When a plugin's agent or skill is one a preset ships, the plugin's file counts as present, and `factory config check` doesn't report it missing.

#### Scenario: A plugin a preset ships is present

- **WHEN** a plugin's agent or skill is one a preset ships
- **THEN** the plugin's file counts as present, and `factory config check` doesn't report it missing.
