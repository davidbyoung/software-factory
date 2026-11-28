## ADDED Requirements

### Requirement: A printed docs address

kodor SHALL behave as this line says: When a command prints the address of a docs page, it is `https://github.com/kodor-ai/kodor/blob/vVERSION/docs/PAGE`, or `/blob/main/` for a version that is not a release.

#### Scenario: A printed docs address

- **WHEN** a command prints the address of a docs page
- **THEN** it is `https://github.com/kodor-ai/kodor/blob/vVERSION/docs/PAGE`, or `/blob/main/` for a version that is not a release.

### Requirement: The README and Moving to kodor

kodor SHALL behave as this line says: When the docs are read, `README.md` and the section "Moving to kodor" at the top of `docs/maintain/upgrade-notes.md` read as "The pages" under Proposed docs shows them.

#### Scenario: The README and Moving to kodor

- **WHEN** the docs are read
- **THEN** `README.md` and the section "Moving to kodor" at the top of `docs/maintain/upgrade-notes.md` read as "The pages" under Proposed docs shows them.

### Requirement: The example settings files

kodor SHALL behave as this line says: When the docs are read, every example settings file under `docs/` says `version: 1`, except in the upgrade notes below "Moving to kodor".

#### Scenario: The example settings files

- **WHEN** the docs are read
- **THEN** every example settings file under `docs/` says `version: 1`, except in the upgrade notes below "Moving to kodor".

## MODIFIED Requirements

### Requirement: The configuration page for version 2

kodor SHALL behave as this line says: the pages under `docs/reference/settings/` documents `commands` and each key under it, `specs.check` with its default, and `plugins` by phase, saying for each role whether it takes a skill or an agent, one or a list, `files` or `labels`, and what is used when it is left out. Its example settings files are version 1.

#### Scenario: The configuration page for version 2

- **WHEN** the docs are read
- **THEN** the pages under `docs/reference/settings/` documents `commands` and each key under it, `specs.check` with its default, and `plugins` by phase, saying for each role whether it takes a skill or an agent, one or a list, `files` or `labels`, and what is used when it is left out. Its example settings files are version 1.
