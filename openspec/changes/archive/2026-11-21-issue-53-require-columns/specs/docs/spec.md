## ADDED Requirements

### Requirement: The docs require every column

The factory SHALL behave as this line says: `docs/configuration.md`, `docs/existing-repo.md`, `docs/updating.md`, and `docs/builds.md` read as "The docs pages" under Proposed docs shows them, and `docs/workflow.md`, `docs/github/by-hand.md`, and `docs/presets.md` change as "The docs that change" says. The `docker run` example in `docs/builds.md`, under the poller image, gains `-e FACTORY_READY_COLUMN=Ready \` after `-e FACTORY_BOARD_TOKEN \`.

#### Scenario: The docs require every column

- **WHEN** the docs describe `tickets.columns`, the poller's variables, and updating
- **THEN** `docs/configuration.md`, `docs/existing-repo.md`, `docs/updating.md`, and `docs/builds.md` read as "The docs pages" under Proposed docs shows them, and `docs/workflow.md`, `docs/github/by-hand.md`, and `docs/presets.md` change as "The docs that change" says. The `docker run` example in `docs/builds.md`, under the poller image, gains `-e FACTORY_READY_COLUMN=Ready \` after `-e FACTORY_BOARD_TOKEN \`.
