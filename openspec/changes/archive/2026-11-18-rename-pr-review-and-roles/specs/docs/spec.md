## ADDED Requirements

### Requirement: The plugins page

The factory SHALL behave as this line says: `docs/plugins.md` has one table for each role giving when it is called, what it is handed, what it returns, and what happens next. It lists what a `refiner` must deliver, what a `prover` must report, that `test.reviewers` is the whole list, that a resolver is read from the default branch's copy, that reviewers still run after a builder, and that extra refinement questions go in a "Refining: this repository" section of `CLAUDE.md`.

#### Scenario: The plugins page

- **WHEN** a reader opens the docs
- **THEN** `docs/plugins.md` has one table for each role giving when it is called, what it is handed, what it returns, and what happens next. It lists what a `refiner` must deliver, what a `prover` must report, that `test.reviewers` is the whole list, that a resolver is read from the default branch's copy, that reviewers still run after a builder, and that extra refinement questions go in a "Refining: this repository" section of `CLAUDE.md`.

### Requirement: What a plugin can replace

The factory SHALL behave as this line says: "The order of the workflow is fixed" in `docs/design.md`, and the line of the same name in `docs/limitations.md`, say which steps a plugin can replace and that the states and their order still cannot change. `docs/limitations.md` no longer says a build assumes `main`, if it does anywhere.

#### Scenario: What a plugin can replace

- **WHEN** a reader opens the docs
- **THEN** "The order of the workflow is fixed" in `docs/design.md`, and the line of the same name in `docs/limitations.md`, say which steps a plugin can replace and that the states and their order still cannot change. `docs/limitations.md` no longer says a build assumes `main`, if it does anywhere.

## MODIFIED Requirements

### Requirement: The configuration page for version 2

The factory SHALL behave as this line says: `docs/configuration.md` documents `commands` and each key under it, `specs.check` with its default, and `plugins` by phase, saying for each role whether it takes a skill or an agent, one or a list, `files` or `labels`, and what is used when it is left out. Its example settings files are version 2.

#### Scenario: The configuration page for version 2

- **WHEN** a reader opens the docs
- **THEN** `docs/configuration.md` documents `commands` and each key under it, `specs.check` with its default, and `plugins` by phase, saying for each role whether it takes a skill or an agent, one or a list, `files` or `labels`, and what is used when it is left out. Its example settings files are version 2.

## REMOVED Requirements

### Requirement: The plug-ins page

**Reason**: Renamed to "The plugins page", for the plugin and role wording.

**Migration**: None; the behavior is unchanged.

### Requirement: What a plug-in can replace

**Reason**: Renamed to "What a plugin can replace", for the plugin and role wording.

**Migration**: None; the behavior is unchanged.
