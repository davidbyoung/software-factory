## MODIFIED Requirements

### Requirement: A recording command starts the sync

The factory SHALL behave as this line says: When `factory ticket claim`, `refining`, `waiting`, `refined`, `stop`, `end`, `ready`, `cost`, or `adopt`, or `factory ticket open` records something on a ticket, and the settings call for the sync workflow, it starts it through the code host before it exits, and prints nothing more. Otherwise it starts nothing and prints nothing. `factory follow-up` and `factory pr follow-ups` start none.

#### Scenario: A recording command starts the sync

- **WHEN** `factory ticket claim`, `refining`, `waiting`, `refined`, `stop`, `end`, `ready`, `cost`, or `adopt`, or `factory ticket open` records something on a ticket
- **THEN** and the settings call for the sync workflow, it starts it through the code host before it exits, and prints nothing more. Otherwise it starts nothing and prints nothing. `factory follow-up` and `factory pr follow-ups` start none.
