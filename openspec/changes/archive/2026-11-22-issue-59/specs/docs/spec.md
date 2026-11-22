## ADDED Requirements

### Requirement: Label settings and the shortest file in the docs

The factory SHALL behave as this line says: `docs/configuration.md` documents `tickets.labels` and `code-host.labels` as `## Proposed docs` above shows them, and its "The shortest file" section shows `version`, `repository`, `code-host.branch-name`, and `commands.gate`, and, with a board, `tickets.board` and all six `tickets.columns`.

#### Scenario: Label settings and the shortest file in the docs

- **WHEN** the docs are read
- **THEN** `docs/configuration.md` documents `tickets.labels` and `code-host.labels` as `## Proposed docs` above shows them, and its "The shortest file" section shows `version`, `repository`, `code-host.branch-name`, and `commands.gate`, and, with a board, `tickets.board` and all six `tickets.columns`.

### Requirement: No docs page names the old pull request labels

The factory SHALL behave as this line says: No page under `docs/` or `README.md` names `merge: automatic`, `merge: manual`, or `verdict: override`; each names `merge-automatic`, `merge-manual`, or `verdict-override`.

#### Scenario: No docs page names the old pull request labels

- **WHEN** the docs are read
- **THEN** No page under `docs/` or `README.md` names `merge: automatic`, `merge: manual`, or `verdict: override`; each names `merge-automatic`, `merge-manual`, or `verdict-override`.
