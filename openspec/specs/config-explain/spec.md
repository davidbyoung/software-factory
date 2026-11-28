# config-explain Specification

## Purpose

What `lunamill config explain` prints: the settings as the file would read with every default written out, each default marked.

## Requirements

### Requirement: Explain prints the settings filled in

lunamill SHALL behave as this line says: When `lunamill config explain` runs, it prints the settings as YAML, in `.claude/lunamill.yaml`'s key order, with every default filled in, and exits 0.

#### Scenario: Explain prints the settings filled in

- **WHEN** `lunamill config explain` runs
- **THEN** it prints the settings as YAML, in `.claude/lunamill.yaml`'s key order, with every default filled in, and exits 0.

### Requirement: Defaults are marked

lunamill SHALL behave as this line says: A line whose value the settings do not set ends with `# default`; a line they set has no comment.

#### Scenario: Defaults are marked

- **WHEN** explain prints a line
- **THEN** a line whose value the settings do not set ends with `# default`; a line they set has no comment.

### Requirement: Parts that are off and empty defaults print as comments

lunamill SHALL behave as this line says: When an optional part is off, or a setting's default is no value, it prints a comment line in its place, such as `# pr-review: off` or `# board: none (default)`. The scenario lists each one.

#### Scenario: Parts that are off and empty defaults print as comments

- **WHEN** an optional part is off (`pr-review` or `site`), or a setting's default is no value (`tickets.board`, `site.pages`, `site.design-guide`, `commands.test-one`, `commands.end-to-end`, `commands.coverage`, or a mockups plugin where there is none)
- **THEN** it prints a comment line in its place: `# pr-review: off`, `# board: none (default)`, `# pages: found by lunamill (default)`, `# design-guide: none (default)`, `# test-one: none (default)`, `# end-to-end: none (default)`, `# coverage: none (default)`, or `# mockups: none (default)`.

### Requirement: The output is a valid settings file

lunamill SHALL behave as this line says: When `lunamill config explain` prints plain text and every comment is taken out, the output passes `lunamill config check` and reads as the same settings.

#### Scenario: The output is a valid settings file

- **WHEN** `lunamill config explain` prints plain text and every comment is taken out
- **THEN** the output passes `lunamill config check` and reads as the same settings.

### Requirement: Unreadable settings fail as config check does

lunamill SHALL behave as this line says: When the settings cannot be read, or lunamill's dependencies are not installed, it prints what `lunamill config check` prints, and exits 1.

#### Scenario: Unreadable settings fail as config check does

- **WHEN** the settings cannot be read, or lunamill's dependencies are not installed
- **THEN** it prints what `lunamill config check` prints, and exits 1.

### Requirement: Explain prints commands

lunamill SHALL behave as this line says: When `lunamill config explain` runs, it prints a `commands` block holding `build-setup`, `before-commit`, `gate`, and `relock`, and a comment line in place of each of `test-one`, `end-to-end`, and `coverage` that is not set: `# test-one: none (default)`, `# end-to-end: none (default)`, `# coverage: none (default)`.

#### Scenario: Explain prints commands

- **WHEN** `lunamill config explain` runs
- **THEN** it prints a `commands` block holding `build-setup`, `before-commit`, `gate`, and `relock`, and a comment line in place of each of `test-one`, `end-to-end`, and `coverage` that is not set: `# test-one: none (default)`, `# end-to-end: none (default)`, `# coverage: none (default)`.

### Requirement: Explain prints specs

lunamill SHALL behave as this line says: When `specs.type` is `openspec`, `lunamill config explain` prints `specs` as a block with `type` and `check`; otherwise it prints `specs: none`.

#### Scenario: Explain prints specs

- **WHEN** `specs.type` is `openspec`
- **THEN** `lunamill config explain` prints `specs` as a block with `type` and `check`; otherwise it prints `specs: none`.

### Requirement: Explain prints plugins by phase

lunamill SHALL behave as this line says: When `lunamill config explain` runs, it prints `plugins` grouped by phase, with `refiner`, `prover`, `mockups`, and `test.reviewers` filled in with what `lunamill plugins` prints for the role and marked `# default` when the settings do not set them, an empty list for `builders`, `build.reviewers`, and `resolvers` that are not set, and the comment `# mockups: none (default)` where there is no mockups plugin.

#### Scenario: Explain prints plugins by phase

- **WHEN** `lunamill config explain` runs
- **THEN** it prints `plugins` grouped by phase, with `refiner`, `prover`, `mockups`, and `test.reviewers` filled in with what `lunamill plugins` prints for the role and marked `# default` when the settings do not set them, an empty list for `builders`, `build.reviewers`, and `resolvers` that are not set, and the comment `# mockups: none (default)` where there is no mockups plugin.

### Requirement: A value from a preset is marked

lunamill SHALL behave as this line says: When a value comes from a preset, its line ends with `# NAME`. When a choice picked it over another preset's, `# NAME, chosen over OTHER`. When two presets disagree and nothing is chosen, `# NAME, not chosen yet`.

#### Scenario: A value from a preset is marked

- **WHEN** a value comes from a preset
- **THEN** its line ends with `# NAME`. When a choice picked it over another preset's, `# NAME, chosen over OTHER`. When two presets disagree and nothing is chosen, `# NAME, not chosen yet`.

### Requirement: A value that replaces a preset's is marked

lunamill SHALL behave as this line says: When a value in `.claude/lunamill.yaml` replaces a preset's, its line ends with `# over NAME`. A value only `.claude/lunamill.yaml` sets has no comment, as today.

#### Scenario: A value that replaces a preset's is marked

- **WHEN** a value in `.claude/lunamill.yaml` replaces a preset's
- **THEN** its line ends with `# over NAME`. A value only `.claude/lunamill.yaml` sets has no comment, as today.

### Requirement: Each list item is marked

lunamill SHALL behave as this line says: When a list adds up across layers, each item's line carries the mark of the layer it came from, by lines 62 and 63.

#### Scenario: Each list item is marked

- **WHEN** a list adds up across layers
- **THEN** each item's line carries the mark of the layer it came from, by lines 62 and 63.

### Requirement: Explain prints the lock's settings

lunamill SHALL behave as this line says: When `lunamill config explain` prints plain text, every line after its first two is a line of the lock's `settings`, in order.

#### Scenario: Explain prints the lock's settings

- **WHEN** `lunamill config explain` prints plain text
- **THEN** every line after its first two is a line of the lock's `settings`, in order.

### Requirement: Explain prints a list of columns as a list

lunamill SHALL behave as this line says: When a state under `tickets.columns` is a list, `lunamill config explain` prints it as a YAML list. A single name prints as a string, as today.

#### Scenario: Explain prints a list of columns as a list

- **WHEN** a state under `tickets.columns` is a list
- **THEN** `lunamill config explain` prints it as a YAML list. A single name prints as a string, as today.

### Requirement: Ticket-side fields print without a board

lunamill SHALL behave as this line says: `lunamill config explain` prints the four ticket-side keys under `tickets.fields`, each as its ticket field or `none`, and any key of the repository's own heading as written, whether or not `tickets.board` is set. `tickets.columns`, and `tickets.fields`' `session`, `runs-in`, and `cost`, print only when `tickets.board` is set, as today.

#### Scenario: Ticket-side fields print without a board

- **WHEN** `lunamill config explain` runs, with or without `tickets.board`
- **THEN** `lunamill config explain` prints the four ticket-side keys under `tickets.fields`, each as its ticket field or `none`, and any key of the repository's own heading as written, whether or not `tickets.board` is set. `tickets.columns`, and `tickets.fields`' `session`, `runs-in`, and `cost`, print only when `tickets.board` is set, as today.

### Requirement: Explain prints the branch name

lunamill SHALL behave as this line says: When `lunamill config explain` runs, it prints `code-host` as a block with `type` and `branch-name`, never on one line, with `branch-name` in double quotes, unmarked when the file sets it and marked with the preset's name when a preset does.

#### Scenario: Explain prints the branch name

- **WHEN** `lunamill config explain` runs
- **THEN** it prints `code-host` as a block with `type` and `branch-name`, never on one line, with `branch-name` in double quotes, unmarked when the file sets it and marked with the preset's name when a preset does.

### Requirement: Explain writes items

lunamill SHALL behave as this line says: When a command setting has items, `lunamill config explain` writes each as the item it is, with `in` and `files`, and writes `commands.ignore`, a list of sites, and a preset's `in`, as a valid settings file.

#### Scenario: Explain writes items

- **WHEN** When a command setting has items
- **THEN** `lunamill config explain` writes each as the item it is, with `in` and `files`, and writes `commands.ignore`, a list of sites, and a preset's `in`, as a valid settings file.

### Requirement: Explain prints approval policies

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Explain prints approval policies

- **WHEN** the settings have `approval-policies`
- **THEN** `lunamill config explain` prints each policy, with each item's line marked with the layer it came from.
