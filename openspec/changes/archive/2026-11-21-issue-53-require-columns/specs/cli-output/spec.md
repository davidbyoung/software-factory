## MODIFIED Requirements

### Requirement: The poller's ready column

The factory SHALL behave as this line says: When `builds.trigger` is `own-server` and `ready` names a column, Ready included, `factory board check`'s `ready` row is `?` and `COLUMN: the poller needs FACTORY_READY_COLUMN set to "COLUMN"`. With `ready: none`, the row is as today.

#### Scenario: The poller's ready column

- **WHEN** `builds.trigger` is `own-server` and `ready` names a column, Ready included
- **THEN** `factory board check`'s `ready` row is `?` and `COLUMN: the poller needs FACTORY_READY_COLUMN set to "COLUMN"`. With `ready: none`, the row is as today.
