## ADDED Requirements

### Requirement: The poller reads a preset that leaves settings out

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The poller reads a preset that leaves settings out

- **WHEN** `factory poller --once --preset FILE` reads a preset "A preset that leaves out the board" to "Part of site, or of coverage" describe
- **THEN** it does not refuse it for what is left out.

### Requirement: The poller words a fault as the check does

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The poller words a fault as the check does

- **WHEN** FILE has any other fault "Preset check refuses a value that is not valid", "A preset in the older version", or "A preset's file that is not YAML" describes, or one only a preset has
- **THEN** a pass prints after the time the first line `factory preset check` prints for it, without that line's advice after a fault only a preset has, and exits 1.

### Requirement: An interval the poller cannot run on

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An interval the poller cannot run on

- **WHEN** the preset's `builds.poll-minutes` is not one of the values allowed
- **THEN** `factory preset check` prints the message "Preset check refuses a value that is not valid" gives for it and no line about `.github/workflows/factory-poller.yml`.
