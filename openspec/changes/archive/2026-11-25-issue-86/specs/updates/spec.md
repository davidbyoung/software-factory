## ADDED Requirements

### Requirement: Update refuses a commit whose preset is not valid

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Update refuses a commit whose preset is not valid

- **WHEN** the commit `factory update` would move a preset to has a fault "Preset check refuses a value that is not valid", "A preset in the older version", or "A preset's file that is not YAML" describes, or one only a preset has
- **THEN** it prints `NAME: ` and the same words after its `NAME OLD → NEW` lines and exits 1 with no stack trace, and the lock is as it was, for every preset it would have moved.

### Requirement: An update refused under pull requests

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An update refused under pull requests

- **WHEN** that happens under `--pull-requests`
- **THEN** it opens no pull request for that update and exits 1. Those it opened before it stay.
