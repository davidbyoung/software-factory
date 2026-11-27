## ADDED Requirements

### Requirement: The day a token was pasted

The factory SHALL behave as this line says: When `factory init` writes a `CLAUDE_CODE_OAUTH_TOKEN` it was given by a paste to the credentials file, it writes `pasted: DAY` in the same entry, with today's day.

#### Scenario: The day a token was pasted

- **WHEN** `factory init` writes a `CLAUDE_CODE_OAUTH_TOKEN` it was given by a paste to the credentials file
- **THEN** it writes `pasted: DAY` in the same entry, with today's day.

### Requirement: Init says the token's day is near

The factory SHALL behave as this line says: In a repository a person owns, when `CLAUDE_CODE_OAUTH_TOKEN` is set on the repository and its DAY is 30 days or fewer away, or past, `factory init` prints `CLAUDE_CODE_OAUTH_TOKEN stops working by DAY, WHEN: a Claude token lasts a year.`, or after DAY `CLAUDE_CODE_OAUTH_TOKEN stopped working by DAY: a Claude token lasts a year.`, before it asks `N secrets these parts read are already set. Replace them?`.

#### Scenario: Init says the token's day is near

- **WHEN** in a repository a person owns, `CLAUDE_CODE_OAUTH_TOKEN` is set on the repository and its DAY is 30 days or fewer away, or past
- **THEN** `factory init` prints `CLAUDE_CODE_OAUTH_TOKEN stops working by DAY, WHEN: a Claude token lasts a year.`, or after DAY `CLAUDE_CODE_OAUTH_TOKEN stopped working by DAY: a Claude token lasts a year.`, before it asks `N secrets these parts read are already set. Replace them?`.

### Requirement: Init offers the machine's newer token

The factory SHALL behave as this line says: Then, when the file holds a token for the owner whose `pasted` day is later than the secret's `updated_at` and more than 30 days from its own year, it asks `Store the one on this machine, pasted on STORED, in its place? Press Enter for yes:`. Yes stores that token as the secret, and counts it in `✓ Stored N secrets for REPOSITORY from this machine.`

#### Scenario: Init offers the machine's newer token

- **WHEN** the token's day is near and the file holds a token for the owner whose `pasted` day is later than the secret's `updated_at` and more than 30 days from its own year
- **THEN** it asks `Store the one on this machine, pasted on STORED, in its place? Press Enter for yes:`. Yes stores that token as the secret, and counts it in `✓ Stored N secrets for REPOSITORY from this machine.`

### Requirement: Init makes a new token

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Init makes a new token

- **WHEN** the token's day is near and the file holds no newer token that serves
- **THEN** it asks `Make a new one now? Press Enter for yes:`. Yes runs today's step for the coding agent's token (`claude setup-token`, the paste, and the try), stores it on the repository and in the file with line 12's `pasted`, prints today's `Stored for REPOSITORY, and on this machine for your next repository.`, then `Each of your other repositories keeps the old token until you run factory init there. It stores this one from your machine.`

### Requirement: Declining the new token

The factory SHALL behave as this line says: No, to line 14's or line 15's question, replaces nothing, and `init` goes on. Either way, `Replace them?` no longer counts the coding agent's credential, and a yes to it does not ask for it again.

#### Scenario: Declining the new token

- **WHEN** the person answers no to the question about the near token, or yes to `Replace them?` after it
- **THEN** nothing is replaced by the no, and `init` goes on. Either way, `Replace them?` no longer counts the coding agent's credential, and a yes to it does not ask for it again.

### Requirement: Init does not copy an old token

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Init does not copy an old token

- **WHEN** `factory init` would store `CLAUDE_CODE_OAUTH_TOKEN` from the file into a repository and the file's `pasted` day is 30 days or fewer from its year, or past it
- **THEN** it does not store it. It prints `The Claude token on this machine stops working by DAY, WHEN, so it is not stored here.`, or `stopped working by DAY` after it, and asks for the token as it does when the file holds none. A file entry with no `pasted` is stored as today.

## MODIFIED Requirements

### Requirement: Only init reads the machine's tokens

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Only init reads the machine's tokens

- **WHEN** a command other than `factory init` runs
- **THEN** No other command reads a token from either entry, and an environment variable does not stand in for one. `factory doctor` and `factory status` read only the `pasted` day under `claude-code`. `factory remove` lists them among what is left by hand.
