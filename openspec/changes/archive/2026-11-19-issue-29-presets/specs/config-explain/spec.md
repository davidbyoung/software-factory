## ADDED Requirements

### Requirement: A value from a preset is marked

The factory SHALL behave as this line says: When a value comes from a preset, its line ends with `# NAME`. When a choice picked it over another preset's, `# NAME, chosen over OTHER`. When two presets disagree and nothing is chosen, `# NAME, not chosen yet`.

#### Scenario: A value from a preset is marked

- **WHEN** a value comes from a preset
- **THEN** its line ends with `# NAME`. When a choice picked it over another preset's, `# NAME, chosen over OTHER`. When two presets disagree and nothing is chosen, `# NAME, not chosen yet`.

### Requirement: A value that replaces a preset's is marked

The factory SHALL behave as this line says: When a value in `.claude/factory.yaml` replaces a preset's, its line ends with `# over NAME`. A value only `.claude/factory.yaml` sets has no comment, as today.

#### Scenario: A value that replaces a preset's is marked

- **WHEN** a value in `.claude/factory.yaml` replaces a preset's
- **THEN** its line ends with `# over NAME`. A value only `.claude/factory.yaml` sets has no comment, as today.

### Requirement: Each list item is marked

The factory SHALL behave as this line says: When a list adds up across layers, each item's line carries the mark of the layer it came from, by lines 62 and 63.

#### Scenario: Each list item is marked

- **WHEN** a list adds up across layers
- **THEN** each item's line carries the mark of the layer it came from, by lines 62 and 63.

### Requirement: Explain prints the lock's settings

The factory SHALL behave as this line says: When `factory config explain` runs, it reads the lock's `settings` and prints them, so its output and the lock's `settings` are the same lines.

#### Scenario: Explain prints the lock's settings

- **WHEN** `factory config explain` runs
- **THEN** it reads the lock's `settings` and prints them, so its output and the lock's `settings` are the same lines.
