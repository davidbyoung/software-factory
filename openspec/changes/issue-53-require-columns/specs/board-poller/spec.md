## ADDED Requirements

### Requirement: The hosted poller needs its ready column

The factory SHALL behave as this line says: When the hosted poller (`factory poller`, without `--once`) starts without `FACTORY_READY_COLUMN`, it logs `not polling: NAMES not set`, NAMES listing every missing variable in the order `FACTORY_BOARD_OWNER`, `FACTORY_BOARD_NUMBER`, `FACTORY_BOARD_TOKEN`, `FACTORY_READY_COLUMN`, joined by `, `, and polls nothing. A value of only spaces counts as missing.

#### Scenario: The hosted poller needs its ready column

- **WHEN** the hosted poller (`factory poller`, without `--once`) starts without `FACTORY_READY_COLUMN`
- **THEN** it logs `not polling: NAMES not set`, NAMES listing every missing variable in the order `FACTORY_BOARD_OWNER`, `FACTORY_BOARD_NUMBER`, `FACTORY_BOARD_TOKEN`, `FACTORY_READY_COLUMN`, joined by `, `, and polls nothing. A value of only spaces counts as missing.

### Requirement: The hosted poller reads its ready column

The factory SHALL behave as this line says: When `FACTORY_READY_COLUMN` is set, the hosted poller starts a build only for a card in the column it names, as today.

#### Scenario: The hosted poller reads its ready column

- **WHEN** `FACTORY_READY_COLUMN` is set
- **THEN** the hosted poller starts a build only for a card in the column it names, as today.

### Requirement: Init prints the poller's ready column

The factory SHALL behave as this line says: When `factory init` ends a run with builds from the board on and `builds.trigger: own-server`, the poller lines under "Left to do" end with `       FACTORY_READY_COLUMN=COLUMN`, after `FACTORY_BOARD_TOKEN`, COLUMN being the ready column init saves.

#### Scenario: Init prints the poller's ready column

- **WHEN** `factory init` ends a run with builds from the board on and `builds.trigger: own-server`
- **THEN** the poller lines under "Left to do" end with `       FACTORY_READY_COLUMN=COLUMN`, after `FACTORY_BOARD_TOKEN`, COLUMN being the ready column init saves.
