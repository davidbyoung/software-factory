# machine-tokens Specification

## Purpose

A person's GitHub token and coding agent's credential kept on their machine, in the credentials file: when `lunamill init` writes them, when it stores them for the next repository without asking, and what else reads them.

## Requirements

### Requirement: The tokens are kept on the machine

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The tokens are kept on the machine

- **WHEN** `lunamill init` stores a GitHub token or a coding agent's credential as secrets in a repository a person owns
- **THEN** In a repository a person owns, `lunamill init` also writes a GitHub token and a coding agent's credential it stores as secrets to the credentials file, filed as "Sam's tokens on the machine" shows, with the plan's `store` row and `It belongs to ACCOUNT. Stored for REPOSITORY, and on this machine for your next repository.`

### Requirement: Tokens stored from the machine

Lunamill SHALL behave as this line says: When the file holds a token for the repository's owner that GitHub accepts with every scope the parts need, and the agent's credential, it asks for neither, stores them, and prints `✓ Stored N secrets for REPOSITORY from this machine.`

#### Scenario: Tokens stored from the machine

- **WHEN** the file holds a token for the repository's owner that GitHub accepts with every scope the parts need, and the agent's credential
- **THEN** it asks for neither, stores them, and prints `✓ Stored N secrets for REPOSITORY from this machine.`

### Requirement: A token on the machine that no longer serves

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A token on the machine that no longer serves

- **WHEN** GitHub refuses the token on the machine, or it lacks a scope
- **THEN** A token GitHub refuses, or one that lacks a scope, gets the line "Sam's tokens on the machine" shows, then today's question, and the pasted one replaces it in the file.

### Requirement: Only init reads the machine's tokens

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Only init reads the machine's tokens

- **WHEN** a command other than `lunamill init` runs
- **THEN** No other command reads a token from either entry, and an environment variable does not stand in for one. `lunamill doctor` and `lunamill status` read only the `pasted` and `expires` days of both tokens. `lunamill remove` lists them among what is left by hand.

### Requirement: The day a token was pasted

Lunamill SHALL behave as this line says: When `lunamill init` writes a `CLAUDE_CODE_OAUTH_TOKEN` it was given by a paste to the credentials file, it writes `pasted: DAY` in the same entry, with today's day.

#### Scenario: The day a token was pasted

- **WHEN** `lunamill init` writes a `CLAUDE_CODE_OAUTH_TOKEN` it was given by a paste to the credentials file
- **THEN** it writes `pasted: DAY` in the same entry, with today's day.

### Requirement: Init says the token's day is near

Lunamill SHALL behave as this line says: In a repository a person owns, when `CLAUDE_CODE_OAUTH_TOKEN` is set on the repository and its DAY is 30 days or fewer away, or past, `lunamill init` prints `CLAUDE_CODE_OAUTH_TOKEN stops working by DAY, WHEN: a Claude token lasts a year.`, or after DAY `CLAUDE_CODE_OAUTH_TOKEN stopped working by DAY: a Claude token lasts a year.`, before it asks `N secrets these parts read are already set. Replace them?`.

#### Scenario: Init says the token's day is near

- **WHEN** in a repository a person owns, `CLAUDE_CODE_OAUTH_TOKEN` is set on the repository and its DAY is 30 days or fewer away, or past
- **THEN** `lunamill init` prints `CLAUDE_CODE_OAUTH_TOKEN stops working by DAY, WHEN: a Claude token lasts a year.`, or after DAY `CLAUDE_CODE_OAUTH_TOKEN stopped working by DAY: a Claude token lasts a year.`, before it asks `N secrets these parts read are already set. Replace them?`.

### Requirement: Init offers the machine's newer token

Lunamill SHALL behave as this line says: Then, when the file holds a token for the owner whose `pasted` day is later than the secret's `updated_at` and more than 30 days from its own year, it asks `Store the one on this machine, pasted on STORED, in its place? Press Enter for yes:`. Yes stores that token as the secret, and counts it in `✓ Stored N secrets for REPOSITORY from this machine.`

#### Scenario: Init offers the machine's newer token

- **WHEN** the token's day is near and the file holds a token for the owner whose `pasted` day is later than the secret's `updated_at` and more than 30 days from its own year
- **THEN** it asks `Store the one on this machine, pasted on STORED, in its place? Press Enter for yes:`. Yes stores that token as the secret, and counts it in `✓ Stored N secrets for REPOSITORY from this machine.`

### Requirement: Init makes a new token

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Init makes a new token

- **WHEN** the token's day is near and the file holds no newer token that serves
- **THEN** it asks `Make a new one now? Press Enter for yes:`. Yes runs today's step for the coding agent's token (`claude setup-token`, the paste, and the try), stores it on the repository and in the file with line 12's `pasted`, prints today's `Stored for REPOSITORY, and on this machine for your next repository.`, then `Each of your other repositories keeps the old token until you run lunamill init there. It stores this one from your machine.`

### Requirement: Declining the new token

Lunamill SHALL behave as this line says: No, to line 14's or line 15's question, replaces nothing, and `init` goes on. Either way, `Replace them?` no longer counts the coding agent's credential, and a yes to it does not ask for it again.

#### Scenario: Declining the new token

- **WHEN** the person answers no to the question about the near token, or yes to `Replace them?` after it
- **THEN** nothing is replaced by the no, and `init` goes on. Either way, `Replace them?` no longer counts the coding agent's credential, and a yes to it does not ask for it again.

### Requirement: Init does not copy an old token

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Init does not copy an old token

- **WHEN** `lunamill init` would store `CLAUDE_CODE_OAUTH_TOKEN` from the file into a repository and the file's `pasted` day is 30 days or fewer from its year, or past it
- **THEN** it does not store it. It prints `The Claude token on this machine stops working by DAY, WHEN, so it is not stored here.`, or `stopped working by DAY` after it, and asks for the token as it does when the file holds none. A file entry with no `pasted` is stored as today.

### Requirement: The access token's days on the machine

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The access token's days on the machine

- **WHEN** `lunamill init` writes a GitHub access token it was given by a paste to the credentials file
- **THEN** it writes `pasted: DAY`, today, and `expires: DAY`, the day in the `github-authentication-token-expiration` header of GitHub's answer to the call that checks the token, or `expires: never` when that answer has no such header.

### Requirement: The access token's expiry from a store

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The access token's expiry from a store

- **WHEN** `lunamill init` stores the file's GitHub access token in a repository and the file has no `expires` for it
- **THEN** it writes the `expires` the call that checks the token gives, as it reads it on a paste, and no `pasted`.

### Requirement: Init makes a new access token

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Init makes a new access token

- **WHEN** in a repository a person owns, NAMES or OLDER is not empty and the machine's token's DAY is 30 days or fewer away, or past
- **THEN** `lunamill init` prints `The GitHub access token expires on DAY, WHEN.`, or after DAY `The GitHub access token expired on DAY.`, then asks `Make a new one now? Press Enter for yes:`, before `N secrets these parts read are already set. Replace them?`. Yes runs today's step for the token (the page, the paste, and the check), stores it under each name in NAMES and OLDER, and in the file with line 11's days, prints today's `It belongs to ACCOUNT. Stored for REPOSITORY, and on this machine for your next repository.`, then `Each of your other repositories keeps the old token until you run lunamill init there. It stores this one from your machine.`

### Requirement: Init stores the machine's newer access token

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Init stores the machine's newer access token

- **WHEN** in a repository a person owns, OLDER is not empty and the file's token is more than 30 days from its DAY or has `expires: never`
- **THEN** `lunamill init` prints `OLDER here was stored on STORED, before the GitHub access token on this machine, pasted on PASTED.` (`were stored` for more than one, with STORED the earliest), then asks `Store the one on this machine in its place? Press Enter for yes:`, before `Replace them?`. Yes stores the file's token under each name in OLDER and NAMES, and counts them in `✓ Stored N secrets for REPOSITORY from this machine.`

### Requirement: Declining the access token's question

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Declining the access token's question

- **WHEN** the person answers no to the question about the GitHub access token, or yes to `Replace them?` after it
- **THEN** nothing is replaced by the no, and `init` goes on. When either question was asked, `Replace them?` no longer counts the token's secrets, and a yes to it does not ask for the token again.

### Requirement: Init does not copy a near access token

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Init does not copy a near access token

- **WHEN** `lunamill init` would store the file's GitHub access token in a repository and its `expires` day is 30 days or fewer away, by the file or, when the file has none, by the day the call that checks it gives
- **THEN** it does not store it. It prints `The GitHub access token on this machine expires on DAY, WHEN, so it is not stored here.` and asks for the token as it does when the file holds none. A token past its day is refused by GitHub's check, as today.

### Requirement: The access token step suggests an expiry

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The access token step suggests an expiry

- **WHEN** `lunamill init` asks for a GitHub access token
- **THEN** the step's line `Check that SCOPES are ticked, choose an expiry, and generate it.` ends with ` 90 days is a good balance: lunamill warns you 30 days before it.`
