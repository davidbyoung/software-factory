## MODIFIED Requirements

### Requirement: The image runs the poller

The factory SHALL behave as this line says: When the image runs with `FACTORY_REPOSITORY`, `FACTORY_BOARD_OWNER`, `FACTORY_BOARD_NUMBER`, `FACTORY_BOARD_TOKEN`, and `FACTORY_READY_COLUMN`, it runs that version's hosted poller.

#### Scenario: The image runs the poller

- **WHEN** the image runs with `FACTORY_REPOSITORY`, `FACTORY_BOARD_OWNER`, `FACTORY_BOARD_NUMBER`, `FACTORY_BOARD_TOKEN`, and `FACTORY_READY_COLUMN`
- **THEN** it runs that version's hosted poller.
