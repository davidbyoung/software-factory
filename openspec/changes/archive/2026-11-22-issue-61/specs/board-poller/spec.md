## MODIFIED Requirements

### Requirement: The hourly cap

The factory SHALL behave as this line says: When `builds.max-per-hour` is set, or left at its default of 20, neither poller starts a build while that many have started in the past hour, counted from the start events on the repository's labeled tickets, and its log reads `REF waits: MAX builds started in the last hour (builds.max-per-hour)`.

#### Scenario: The hourly cap

- **WHEN** `builds.max-per-hour` is set, or left at its default of 20
- **THEN** neither poller starts a build while that many have started in the past hour, counted from the start events on the repository's labeled tickets, and its log reads `REF waits: MAX builds started in the last hour (builds.max-per-hour)`.

### Requirement: The cap across a restart

The factory SHALL behave as this line says: When the hosted poller restarts, builds it started in the past hour still count toward the cap.

#### Scenario: The cap across a restart

- **WHEN** the hosted poller restarts
- **THEN** builds it started in the past hour still count toward the cap.

## ADDED Requirements

### Requirement: The cap's setting is checked

The factory SHALL behave as this line says: When `builds.max-per-hour` is not a whole number of 1 or more, `factory config check` fails with `.claude/factory.yaml: builds.max-per-hour: must be a whole number, 1 or more`. It is accepted with any trigger.

#### Scenario: The cap's setting is checked

- **WHEN** `builds.max-per-hour` is not a whole number of 1 or more
- **THEN** `factory config check` fails with `.claude/factory.yaml: builds.max-per-hour: must be a whole number, 1 or more`. It is accepted with any trigger.

### Requirement: The hosted poller's label and cap

The factory SHALL behave as this line says: When the hosted poller has `FACTORY_LABEL` or `FACTORY_MAX_PER_HOUR` set, it uses that label name or cap; without them, `factory` and 20. A `FACTORY_MAX_PER_HOUR` that is not a whole number of 1 or more logs `not polling: FACTORY_MAX_PER_HOUR must be a whole number, 1 or more` and starts nothing.

#### Scenario: The hosted poller's label and cap

- **WHEN** the hosted poller has `FACTORY_LABEL` or `FACTORY_MAX_PER_HOUR` set
- **THEN** it uses that label name or cap; without them, `factory` and 20. A `FACTORY_MAX_PER_HOUR` that is not a whole number of 1 or more logs `not polling: FACTORY_MAX_PER_HOUR must be a whole number, 1 or more` and starts nothing.

### Requirement: The poller starts in the board's order

The factory SHALL behave as this line says: When several labeled tickets are in the ready column, the poller starts them by their cards' rank, the order the board shows them unsorted, top first, and by key where two ranks are equal. If a GitHub Project's API does not keep that order, GitHub's adapter gives every card the same rank, so on GitHub the poller starts them by key.

#### Scenario: The poller starts in the board's order

- **WHEN** several labeled tickets are in the ready column
- **THEN** the poller starts them by their cards' rank, the order the board shows them unsorted, top first, and by key where two ranks are equal. If a GitHub Project's API does not keep that order, GitHub's adapter gives every card the same rank, so on GitHub the poller starts them by key.

### Requirement: Board check names the poller's variables

The factory SHALL behave as this line says: When `factory board check` runs and the label's name is not `factory`, or `builds.max-per-hour` is not 20, it prints `? label      NAME: the poller needs FACTORY_LABEL set to "NAME"` and `? builds     MAX an hour: the poller needs FACTORY_MAX_PER_HOUR set to MAX`, each only when it differs.

#### Scenario: Board check names the poller's variables

- **WHEN** `factory board check` runs and the label's name is not `factory`, or `builds.max-per-hour` is not 20
- **THEN** it prints `? label      NAME: the poller needs FACTORY_LABEL set to "NAME"` and `? builds     MAX an hour: the poller needs FACTORY_MAX_PER_HOUR set to MAX`, each only when it differs.
