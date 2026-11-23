## MODIFIED Requirements

### Requirement: A sync that cannot start

The factory SHALL behave as this line says: When a recording command cannot start the sync workflow, it prints `? the board updates at the nightly sync: couldn't start the board sync (REASON)` after its own output and keeps its exit code.

#### Scenario: A sync that cannot start

- **WHEN** a recording command cannot start the sync workflow
- **THEN** it prints `? the board updates at the nightly sync: couldn't start the board sync (REASON)` after its own output and keeps its exit code.

### Requirement: The sync's triggers

The factory SHALL behave as this line says: When `factory sync` writes `.github/workflows/factory.yml`, the workflow has no `issues` or `issue_comment` trigger, and keeps `pull_request_target`, the nightly `schedule`, and `workflow_dispatch`.

#### Scenario: The sync's triggers

- **WHEN** `factory sync` writes `.github/workflows/factory.yml`
- **THEN** the workflow has no `issues` or `issue_comment` trigger, and keeps `pull_request_target`, the nightly `schedule`, and `workflow_dispatch`.
