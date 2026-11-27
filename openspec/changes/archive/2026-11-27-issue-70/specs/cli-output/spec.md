## ADDED Requirements

### Requirement: Board check with a poller you host

The factory SHALL behave as this line says: When `factory board check` runs with `builds.trigger: own-server`, its `ready` row is `✓` and the column's name, as with any other trigger, and it prints no `tickets.labels` or `builds` block naming a poller's variable.

#### Scenario: Board check with a poller you host

- **WHEN** `factory board check` runs with `builds.trigger: own-server`
- **THEN** its `ready` row is `✓` and the column's name, as with any other trigger, and it prints no `tickets.labels` or `builds` block naming a poller's variable.

## REMOVED Requirements

### Requirement: The poller's ready column

**Reason**: The poller you host reads the ready column from the settings, so the `ready` row no longer asks for `FACTORY_READY_COLUMN`.

**Migration**: None: "Board check with a poller you host" says what the row prints.
