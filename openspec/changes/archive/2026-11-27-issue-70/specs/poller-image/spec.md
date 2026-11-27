## MODIFIED Requirements

### Requirement: The image runs the poller

The factory SHALL behave as this line says: When the image runs with `FACTORY_REPOSITORY` and `FACTORY_BOARD_TOKEN`, it runs that version's hosted poller.

#### Scenario: The image runs the poller

- **WHEN** the image runs with `FACTORY_REPOSITORY` and `FACTORY_BOARD_TOKEN`
- **THEN** it runs that version's hosted poller.
