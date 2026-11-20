## ADDED Requirements

### Requirement: Remove deletes what presets shipped

The factory SHALL behave as this line says: When `factory remove` goes ahead, it also deletes `.claude/factory.choices.yaml` and every agent and skill a preset shipped, as the lock lists them, and its list of what is left by hand adds `npm uninstall PACKAGE` for each preset's package.

#### Scenario: Remove deletes what presets shipped

- **WHEN** `factory remove` goes ahead
- **THEN** it also deletes `.claude/factory.choices.yaml` and every agent and skill a preset shipped, as the lock lists them, and its list of what is left by hand adds `npm uninstall PACKAGE` for each preset's package.
