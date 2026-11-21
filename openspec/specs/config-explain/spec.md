# config-explain Specification

## Purpose

What `factory config explain` prints: the settings as the file would read with every default written out, each default marked.

## Requirements

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

The factory SHALL behave as this line says: When an optional part is off, or a setting's default is no value, it prints a comment line in its place, such as `# pr-review: off` or `# board: none (default)`. The scenario lists each one.

#### Scenario: Parts that are off and empty defaults print as comments

- **WHEN** an optional part is off (`pr-review` or `site`), or a setting's default is no value (`tickets.board`, `site.pages`, `site.design-guide`, `commands.test-one`, `commands.end-to-end`, `commands.coverage`, or a mockups plugin where there is none)
- **THEN** it prints a comment line in its place: `# pr-review: off`, `# board: none (default)`, `# pages: found by the factory (default)`, `# design-guide: none (default)`, `# test-one: none (default)`, `# end-to-end: none (default)`, `# coverage: none (default)`, or `# mockups: none (default)`.

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

### Requirement: Explain prints commands

The factory SHALL behave as this line says: When `factory config explain` runs, it prints a `commands` block holding `build-setup`, `before-commit`, `gate`, and `relock`, and a comment line in place of each of `test-one`, `end-to-end`, and `coverage` that is not set: `# test-one: none (default)`, `# end-to-end: none (default)`, `# coverage: none (default)`.

#### Scenario: Explain prints commands

- **WHEN** `factory config explain` runs
- **THEN** it prints a `commands` block holding `build-setup`, `before-commit`, `gate`, and `relock`, and a comment line in place of each of `test-one`, `end-to-end`, and `coverage` that is not set: `# test-one: none (default)`, `# end-to-end: none (default)`, `# coverage: none (default)`.

### Requirement: Explain prints specs

The factory SHALL behave as this line says: When `specs.type` is `openspec`, `factory config explain` prints `specs` as a block with `type` and `check`; otherwise it prints `specs: none`.

#### Scenario: Explain prints specs

- **WHEN** `specs.type` is `openspec`
- **THEN** `factory config explain` prints `specs` as a block with `type` and `check`; otherwise it prints `specs: none`.

### Requirement: Explain prints plugins by phase

The factory SHALL behave as this line says: When `factory config explain` runs, it prints `plugins` grouped by phase, with `refiner`, `prover`, `mockups`, and `test.reviewers` filled in with what `factory plugins` prints for the role and marked `# default` when the settings do not set them, an empty list for `builders`, `build.reviewers`, and `resolvers` that are not set, and the comment `# mockups: none (default)` where there is no mockups plugin.

#### Scenario: Explain prints plugins by phase

- **WHEN** `factory config explain` runs
- **THEN** it prints `plugins` grouped by phase, with `refiner`, `prover`, `mockups`, and `test.reviewers` filled in with what `factory plugins` prints for the role and marked `# default` when the settings do not set them, an empty list for `builders`, `build.reviewers`, and `resolvers` that are not set, and the comment `# mockups: none (default)` where there is no mockups plugin.

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

### Requirement: Explain prints a list of columns as a list

The factory SHALL behave as this line says: When a state under `tickets.columns` is a list, `factory config explain` prints it as a YAML list. A single name prints as a string, as today.

#### Scenario: Explain prints a list of columns as a list

- **WHEN** a state under `tickets.columns` is a list
- **THEN** `factory config explain` prints it as a YAML list. A single name prints as a string, as today.

### Requirement: Ticket-side fields print without a board

The factory SHALL behave as this line says: `factory config explain` prints the four ticket-side keys under `tickets.fields`, each as its ticket field or `none`, and any key of the repository's own heading as written, whether or not `tickets.board` is set. `tickets.columns`, and `tickets.fields`' `session`, `runs-in`, and `cost`, print only when `tickets.board` is set, as today.

#### Scenario: Ticket-side fields print without a board

- **WHEN** `factory config explain` runs, with or without `tickets.board`
- **THEN** `factory config explain` prints the four ticket-side keys under `tickets.fields`, each as its ticket field or `none`, and any key of the repository's own heading as written, whether or not `tickets.board` is set. `tickets.columns`, and `tickets.fields`' `session`, `runs-in`, and `cost`, print only when `tickets.board` is set, as today.
