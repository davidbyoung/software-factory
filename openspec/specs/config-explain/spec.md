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
