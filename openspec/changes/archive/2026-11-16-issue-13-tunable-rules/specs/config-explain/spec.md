## ADDED Requirements

### Requirement: Explain prints the settings filled in

The factory SHALL behave as this line says: When `factory config explain` runs, it prints the settings as YAML, in `.claude/factory.yaml`'s key order, with every default filled in, and exits 0.

#### Scenario: Explain prints the settings filled in

- **WHEN** `factory config explain` runs
- **THEN** it prints the settings as YAML, in `.claude/factory.yaml`'s key order, with every default filled in, and exits 0.

### Requirement: Defaults are marked

The factory SHALL behave as this line says: A line whose value the settings do not set ends with `# default`; a line they set has no comment.

#### Scenario: Defaults are marked

- **WHEN** explain prints a line
- **THEN** a line whose value the settings do not set ends with `# default`; a line they set has no comment.

### Requirement: Parts that are off and empty defaults print as comments

The factory SHALL behave as this line says: When an optional part is off (`ci-review` or `site`), or a setting's default is no value (`tickets.board`, `site.pages`, `site.design-guide`), it prints a comment line in its place: `# ci-review: off`, `# board: none (default)`, `# pages: found by the factory (default)`, or `# design-guide: none (default)`.

#### Scenario: Parts that are off and empty defaults print as comments

- **WHEN** an optional part is off (`ci-review` or `site`), or a setting's default is no value (`tickets.board`, `site.pages`, `site.design-guide`)
- **THEN** it prints a comment line in its place: `# ci-review: off`, `# board: none (default)`, `# pages: found by the factory (default)`, or `# design-guide: none (default)`.

### Requirement: Columns and fields print only with a board

The factory SHALL behave as this line says: `tickets.columns` and `tickets.fields` print only when `tickets.board` is set, since `config check` refuses them without a board.

#### Scenario: Columns and fields print only with a board

- **WHEN** `tickets.board` is or is not set
- **THEN** `tickets.columns` and `tickets.fields` print only when `tickets.board` is set, since `config check` refuses them without a board.

### Requirement: The output is a valid settings file

The factory SHALL behave as this line says: When every `# default` comment is taken out, the output passes `factory config check` and reads as the same settings.

#### Scenario: The output is a valid settings file

- **WHEN** every `# default` comment is taken out
- **THEN** the output passes `factory config check` and reads as the same settings.

### Requirement: Unreadable settings fail as config check does

The factory SHALL behave as this line says: When the settings cannot be read, or the factory's dependencies are not installed, it prints what `factory config check` prints, and exits 1.

#### Scenario: Unreadable settings fail as config check does

- **WHEN** the settings cannot be read, or the factory's dependencies are not installed
- **THEN** it prints what `factory config check` prints, and exits 1.
