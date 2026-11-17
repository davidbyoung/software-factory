## ADDED Requirements

### Requirement: Valid rules values are accepted

The factory SHALL behave as this line says: When `.claude/factory.yaml` sets `rules.small-change-lines` or `rules.review-rounds` to a whole number above zero, `factory config check` accepts it.

#### Scenario: Valid rules values are accepted

- **WHEN** `.claude/factory.yaml` sets `rules.small-change-lines` or `rules.review-rounds` to a whole number above zero
- **THEN** `factory config check` accepts it.

### Requirement: Invalid rules values are refused

The factory SHALL behave as this line says: When either is set to anything else, `factory config check` fails with `.claude/factory.yaml: rules.KEY: must be a whole number above zero`.

#### Scenario: Invalid rules values are refused

- **WHEN** either is set to anything else
- **THEN** `factory config check` fails with `.claude/factory.yaml: rules.KEY: must be a whole number above zero`.

### Requirement: The small-change number reaches the rules

The factory SHALL behave as this line says: When `rules.small-change-lines` is set, `factory sync` writes `.claude/factory/rules.md` with that number in place of 30 in "under about 30 lines".

#### Scenario: The small-change number reaches the rules

- **WHEN** `rules.small-change-lines` is set
- **THEN** `factory sync` writes `.claude/factory/rules.md` with that number in place of 30 in "under about 30 lines".

### Requirement: The review-rounds number reaches the rules and the review skill

The factory SHALL behave as this line says: When `rules.review-rounds` is set, `factory sync` writes that number of rounds into `rules.md`'s review rule ("After two rounds") and into `factory-address-review`'s "Two rounds, then escalate" section ("at most two rounds", "the third review"), with the review after the last round numbered to match.

#### Scenario: The review-rounds number reaches the rules and the review skill

- **WHEN** `rules.review-rounds` is set
- **THEN** `factory sync` writes that number of rounds into `rules.md`'s review rule ("After two rounds") and into `factory-address-review`'s "Two rounds, then escalate" section ("at most two rounds", "the third review"), with the review after the last round numbered to match.

### Requirement: The defaults leave the copies unchanged

The factory SHALL behave as this line says: When neither key is set, the copies `factory sync` writes are word for word the package's.

#### Scenario: The defaults leave the copies unchanged

- **WHEN** neither key is set
- **THEN** the copies `factory sync` writes are word for word the package's.

### Requirement: A changed number leaves the copies out of step

The factory SHALL behave as this line says: When a number in the settings changes and the copies were not synced since, `factory sync --check` fails, naming the copies that differ.

#### Scenario: A changed number leaves the copies out of step

- **WHEN** a number in the settings changes and the copies were not synced since
- **THEN** `factory sync --check` fails, naming the copies that differ.
