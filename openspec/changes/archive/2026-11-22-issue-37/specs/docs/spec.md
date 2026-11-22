## ADDED Requirements

### Requirement: The configuration page's specs sections

The factory SHALL behave as this line says: When a reader opens `docs/configuration.md`, its `specs` and `specs.check` sections read as "The sections that change" under Proposed docs shows.

#### Scenario: The configuration page's specs sections

- **WHEN** a reader opens `docs/configuration.md`
- **THEN** Its `specs` and `specs.check` sections read as "The sections that change" under Proposed docs shows.

### Requirement: The workflow page's spec section

The factory SHALL behave as this line says: When a reader opens `docs/workflow.md`, its "A change your users will see" section reads as "The sections that change" under Proposed docs shows.

#### Scenario: The workflow page's spec section

- **WHEN** a reader opens `docs/workflow.md`
- **THEN** Its "A change your users will see" section reads as "The sections that change" under Proposed docs shows.

### Requirement: The setup page's spec tool question

The factory SHALL behave as this line says: When a reader opens `docs/github/setup.md`, "Run `factory init`" shows the spec tool question and says init skips either question the settings or a preset answer, as "The sections that change" under Proposed docs shows.

#### Scenario: The setup page's spec tool question

- **WHEN** a reader opens `docs/github/setup.md`
- **THEN** "Run `factory init`" shows the spec tool question and says init skips either question the settings or a preset answer, as "The sections that change" under Proposed docs shows.

### Requirement: The limitations page's spec tools

The factory SHALL behave as this line says: When a reader opens `docs/limitations.md`, its table of what is built has the row "Another spec tool, such as Spec Kit", "Not planned. An adapter under `src/specs/` adds one".

#### Scenario: The limitations page's spec tools

- **WHEN** a reader opens `docs/limitations.md`
- **THEN** Its table of what is built has the row "Another spec tool, such as Spec Kit", "Not planned. An adapter under `src/specs/` adds one".

### Requirement: The glossary's Spec entry

The factory SHALL behave as this line says: When a reader opens `docs/glossary.md`, its Spec entry reads as Proposed docs §6 shows.

#### Scenario: The glossary's Spec entry

- **WHEN** a reader opens `docs/glossary.md`
- **THEN** Its Spec entry reads as Proposed docs §6 shows.

### Requirement: Adding a spec tool

The factory SHALL behave as this line says: When a reader opens `docs/developing.md`, it has a section "Adding a spec tool", beside "Adding a ticket system", with the table of what an adapter gives from Proposed docs §5.

#### Scenario: Adding a spec tool

- **WHEN** a reader opens `docs/developing.md`
- **THEN** It has a section "Adding a spec tool", beside "Adding a ticket system", with the table of what an adapter gives from Proposed docs §5.

## MODIFIED Requirements

### Requirement: The CLI page's branch commands

The factory SHALL behave as this line says: When a reader opens `docs/cli.md`, it lists `factory ticket branch N` under Tickets and `factory pr for-branch BRANCH` under Pull requests, and its "Your repository's commands" has rows for `factory specs list`, `factory specs new N`, `factory specs check`, and `factory specs finish N`, the note after the table, and no row for `factory specs change-name N`, worded as "The sections that change" under Proposed docs shows.

#### Scenario: The CLI page's branch commands

- **WHEN** a reader opens `docs/cli.md`
- **THEN** It lists `factory ticket branch N` under Tickets and `factory pr for-branch BRANCH` under Pull requests, and its "Your repository's commands" has rows for `factory specs list`, `factory specs new N`, `factory specs check`, and `factory specs finish N`, the note after the table, and no row for `factory specs change-name N`, worded as "The sections that change" under Proposed docs shows.
