# rules-setting Specification

## Purpose

The two numbers the process rules use, as settings, and how `kodor sync` writes them into the copies of the rules and skills that state them.

## Requirements

### Requirement: Valid rules values are accepted

kodor SHALL behave as this line says: When `.claude/kodor.yaml` sets `rules.small-change-lines` or `rules.review-rounds` to a whole number above zero, `kodor config check` accepts it.

#### Scenario: Valid rules values are accepted

- **WHEN** `.claude/kodor.yaml` sets `rules.small-change-lines` or `rules.review-rounds` to a whole number above zero
- **THEN** `kodor config check` accepts it.

### Requirement: Invalid rules values are refused

kodor SHALL behave as this line says: When either is set to anything else, `kodor config check` fails with `.claude/kodor.yaml: rules.KEY: must be a whole number above zero`.

#### Scenario: Invalid rules values are refused

- **WHEN** either is set to anything else
- **THEN** `kodor config check` fails with `.claude/kodor.yaml: rules.KEY: must be a whole number above zero`.

### Requirement: The small-change number reaches the rules

kodor SHALL behave as this line says: When `rules.small-change-lines` is set, `kodor sync` writes `.claude/kodor/rules.md` with that number in place of 30 in "under about 30 lines".

#### Scenario: The small-change number reaches the rules

- **WHEN** `rules.small-change-lines` is set
- **THEN** `kodor sync` writes `.claude/kodor/rules.md` with that number in place of 30 in "under about 30 lines".

### Requirement: The review-rounds number reaches the rules and the review skill

kodor SHALL behave as this line says: When `rules.review-rounds` is set, `kodor sync` writes that number of rounds into `rules.md`'s review rule ("After two rounds") and into `kodor-address-review`'s "Two rounds, then escalate" section ("at most two rounds", "the third review"), with the review after the last round numbered to match.

#### Scenario: The review-rounds number reaches the rules and the review skill

- **WHEN** `rules.review-rounds` is set
- **THEN** `kodor sync` writes that number of rounds into `rules.md`'s review rule ("After two rounds") and into `kodor-address-review`'s "Two rounds, then escalate" section ("at most two rounds", "the third review"), with the review after the last round numbered to match.

### Requirement: The defaults leave the copies unchanged

kodor SHALL behave as this line says: When neither key is set, the copies `kodor sync` writes are word for word the package's.

#### Scenario: The defaults leave the copies unchanged

- **WHEN** neither key is set
- **THEN** the copies `kodor sync` writes are word for word the package's.

### Requirement: A changed number leaves the copies out of step

kodor SHALL behave as this line says: When a number in the settings changes and the copies were not synced since, `kodor sync --check` fails, naming the copies that differ.

#### Scenario: A changed number leaves the copies out of step

- **WHEN** a number in the settings changes and the copies were not synced since
- **THEN** `kodor sync --check` fails, naming the copies that differ.

### Requirement: The files sync writes

kodor SHALL behave as this line says: When `kodor sync` writes a repository's files, it writes the rules to `.claude/kodor/rules.md`, adds the line `@.claude/kodor/rules.md` to `CLAUDE.md` when it is missing, writes each skill to `.claude/skills/kodor-NAME/SKILL.md` and each agent to `.claude/agents/kodor-NAME.md`, and the review instructions to `.github/kodor-review.md`.

#### Scenario: The files sync writes

- **WHEN** `kodor sync` writes a repository's files
- **THEN** it writes the rules to `.claude/kodor/rules.md`, adds the line `@.claude/kodor/rules.md` to `CLAUDE.md` when it is missing, writes each skill to `.claude/skills/kodor-NAME/SKILL.md` and each agent to `.claude/agents/kodor-NAME.md`, and the review instructions to `.github/kodor-review.md`.

### Requirement: The hooks and the work folder

kodor SHALL behave as this line says: When `kodor sync` writes `.claude/settings.json`, each hook runs `kodor`, and the folder it adds for a session is `~/.local/share/kodor/work`.

#### Scenario: The hooks and the work folder

- **WHEN** `kodor sync` writes `.claude/settings.json`
- **THEN** each hook runs `kodor`, and the folder it adds for a session is `~/.local/share/kodor/work`.
