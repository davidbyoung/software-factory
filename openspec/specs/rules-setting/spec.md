# rules-setting Specification

## Purpose

The two numbers the process rules use, as settings, and how `lunamill sync` writes them into the copies of the rules and skills that state them.

## Requirements

### Requirement: Valid rules values are accepted

lunamill SHALL behave as this line says: When `.claude/lunamill.yaml` sets `rules.small-change-lines` or `rules.review-rounds` to a whole number above zero, `lunamill config check` accepts it.

#### Scenario: Valid rules values are accepted

- **WHEN** `.claude/lunamill.yaml` sets `rules.small-change-lines` or `rules.review-rounds` to a whole number above zero
- **THEN** `lunamill config check` accepts it.

### Requirement: Invalid rules values are refused

lunamill SHALL behave as this line says: When either is set to anything else, `lunamill config check` fails with `.claude/lunamill.yaml: rules.KEY: must be a whole number above zero`.

#### Scenario: Invalid rules values are refused

- **WHEN** either is set to anything else
- **THEN** `lunamill config check` fails with `.claude/lunamill.yaml: rules.KEY: must be a whole number above zero`.

### Requirement: The small-change number reaches the rules

lunamill SHALL behave as this line says: When `rules.small-change-lines` is set, `lunamill sync` writes `.claude/lunamill/rules.md` with that number in place of 30 in "under about 30 lines".

#### Scenario: The small-change number reaches the rules

- **WHEN** `rules.small-change-lines` is set
- **THEN** `lunamill sync` writes `.claude/lunamill/rules.md` with that number in place of 30 in "under about 30 lines".

### Requirement: The review-rounds number reaches the rules and the review skill

lunamill SHALL behave as this line says: When `rules.review-rounds` is set, `lunamill sync` writes that number of rounds into `rules.md`'s review rule ("After two rounds") and into `lunamill-address-review`'s "Two rounds, then escalate" section ("at most two rounds", "the third review"), with the review after the last round numbered to match.

#### Scenario: The review-rounds number reaches the rules and the review skill

- **WHEN** `rules.review-rounds` is set
- **THEN** `lunamill sync` writes that number of rounds into `rules.md`'s review rule ("After two rounds") and into `lunamill-address-review`'s "Two rounds, then escalate" section ("at most two rounds", "the third review"), with the review after the last round numbered to match.

### Requirement: The defaults leave the copies unchanged

lunamill SHALL behave as this line says: When neither key is set, the copies `lunamill sync` writes are word for word the package's.

#### Scenario: The defaults leave the copies unchanged

- **WHEN** neither key is set
- **THEN** the copies `lunamill sync` writes are word for word the package's.

### Requirement: A changed number leaves the copies out of step

lunamill SHALL behave as this line says: When a number in the settings changes and the copies were not synced since, `lunamill sync --check` fails, naming the copies that differ.

#### Scenario: A changed number leaves the copies out of step

- **WHEN** a number in the settings changes and the copies were not synced since
- **THEN** `lunamill sync --check` fails, naming the copies that differ.

### Requirement: The files sync writes

lunamill SHALL behave as this line says: When `lunamill sync` writes a repository's files, it writes the rules to `.claude/lunamill/rules.md`, adds the line `@.claude/lunamill/rules.md` to `CLAUDE.md` when it is missing, writes each skill to `.claude/skills/lunamill-NAME/SKILL.md` and each agent to `.claude/agents/lunamill-NAME.md`, and the review instructions to `.github/lunamill-review.md`.

#### Scenario: The files sync writes

- **WHEN** `lunamill sync` writes a repository's files
- **THEN** it writes the rules to `.claude/lunamill/rules.md`, adds the line `@.claude/lunamill/rules.md` to `CLAUDE.md` when it is missing, writes each skill to `.claude/skills/lunamill-NAME/SKILL.md` and each agent to `.claude/agents/lunamill-NAME.md`, and the review instructions to `.github/lunamill-review.md`.

### Requirement: The hooks and the work folder

lunamill SHALL behave as this line says: When `lunamill sync` writes `.claude/settings.json`, each hook runs `lunamill`, and the folder it adds for a session is `~/.local/share/lunamill/work`.

#### Scenario: The hooks and the work folder

- **WHEN** `lunamill sync` writes `.claude/settings.json`
- **THEN** each hook runs `lunamill`, and the folder it adds for a session is `~/.local/share/lunamill/work`.
