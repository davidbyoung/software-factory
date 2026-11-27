## ADDED Requirements

### Requirement: The docs on the poller reading the settings

The factory SHALL behave as this line says: `docs/builds.md`, from "The poller" to "No trigger", and the section "The poller reads your settings" in `docs/updating.md`, read as "The pages as they would read" under Proposed docs shows them; `docs/configuration.md` and the rest of `docs/updating.md` change as "The docs that change" says.

#### Scenario: The docs on the poller reading the settings

- **WHEN** this ships
- **THEN** `docs/builds.md`, from "The poller" to "No trigger", and the section "The poller reads your settings" in `docs/updating.md`, read as "The pages as they would read" under Proposed docs shows them; `docs/configuration.md` and the rest of `docs/updating.md` change as "The docs that change" says.

## MODIFIED Requirements

### Requirement: The docs require every column

The factory SHALL behave as this line says: `docs/configuration.md`, `docs/existing-repo.md`, `docs/updating.md`, and `docs/builds.md` read as "The docs pages" under Proposed docs shows them, and `docs/workflow.md`, `docs/github/by-hand.md`, and `docs/presets.md` change as "The docs that change" says.

#### Scenario: The docs require every column

- **WHEN** the docs describe `tickets.columns`, the poller's variables, and updating
- **THEN** `docs/configuration.md`, `docs/existing-repo.md`, `docs/updating.md`, and `docs/builds.md` read as "The docs pages" under Proposed docs shows them, and `docs/workflow.md`, `docs/github/by-hand.md`, and `docs/presets.md` change as "The docs that change" says.
