## ADDED Requirements

### Requirement: The configuration page for version 2

The factory SHALL behave as this line says: `docs/configuration.md` documents `commands` and each key under it, `specs.check` with its default, and `plugins` by phase, saying for each slot whether it takes a skill or an agent, one or a list, `files` or `labels`, and what is used when it is left out. Its example settings files are version 2.

#### Scenario: The configuration page for version 2

- **WHEN** a reader opens the docs
- **THEN** `docs/configuration.md` documents `commands` and each key under it, `specs.check` with its default, and `plugins` by phase, saying for each slot whether it takes a skill or an agent, one or a list, `files` or `labels`, and what is used when it is left out. Its example settings files are version 2.

### Requirement: The plug-ins page

The factory SHALL behave as this line says: `docs/plugins.md` has one table for each slot giving when it is called, what it is handed, what it returns, and what happens next. It lists what a `refiner` must deliver, what a `prover` must report, that `test.reviewers` is the whole list, that a resolver is read from the default branch's copy, that reviewers still run after a builder, and that extra refinement questions go in a "Refining: this repository" section of `CLAUDE.md`.

#### Scenario: The plug-ins page

- **WHEN** a reader opens the docs
- **THEN** `docs/plugins.md` has one table for each slot giving when it is called, what it is handed, what it returns, and what happens next. It lists what a `refiner` must deliver, what a `prover` must report, that `test.reviewers` is the whole list, that a resolver is read from the default branch's copy, that reviewers still run after a builder, and that extra refinement questions go in a "Refining: this repository" section of `CLAUDE.md`.

### Requirement: The updating page

The factory SHALL behave as this line says: `docs/updating.md` has a section "Moving to settings version 2" that shows each key that moved or changed shape, before and after.

#### Scenario: The updating page

- **WHEN** a reader opens the docs
- **THEN** `docs/updating.md` has a section "Moving to settings version 2" that shows each key that moved or changed shape, before and after.

### Requirement: The CLI page's new commands

The factory SHALL behave as this line says: `docs/cli.md` has rows for `factory gate`, `factory test-one`, `factory end-to-end`, `factory specs check`, and `factory default-branch`, and names `--check` in the `factory ticket refined` row.

#### Scenario: The CLI page's new commands

- **WHEN** a reader opens the docs
- **THEN** `docs/cli.md` has rows for `factory gate`, `factory test-one`, `factory end-to-end`, `factory specs check`, and `factory default-branch`, and names `--check` in the `factory ticket refined` row.

### Requirement: No migrate row

The factory SHALL behave as this line says: "What is built" in `docs/developing.md` has no `factory migrate` row.

#### Scenario: No migrate row

- **WHEN** a reader opens the docs
- **THEN** "What is built" in `docs/developing.md` has no `factory migrate` row.

### Requirement: What a plug-in can replace

The factory SHALL behave as this line says: "The order of the workflow is fixed" in `docs/design.md`, and the line of the same name in `docs/limitations.md`, say which steps a plug-in can replace and that the states and their order still cannot change. `docs/limitations.md` no longer says a build assumes `main`, if it does anywhere.

#### Scenario: What a plug-in can replace

- **WHEN** a reader opens the docs
- **THEN** "The order of the workflow is fixed" in `docs/design.md`, and the line of the same name in `docs/limitations.md`, say which steps a plug-in can replace and that the states and their order still cannot change. `docs/limitations.md` no longer says a build assumes `main`, if it does anywhere.

### Requirement: The quick start names the gate

The factory SHALL behave as this line says: `docs/quick-start.md` tells a new user to set `commands.gate` before the first build.

#### Scenario: The quick start names the gate

- **WHEN** a reader opens the docs
- **THEN** `docs/quick-start.md` tells a new user to set `commands.gate` before the first build.
