## ADDED Requirements

### Requirement: The access token's days on the machine

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The access token's days on the machine

- **WHEN** `factory init` writes a GitHub access token it was given by a paste to the credentials file
- **THEN** it writes `pasted: DAY`, today, and `expires: DAY`, the day in the `github-authentication-token-expiration` header of GitHub's answer to the call that checks the token, or `expires: never` when that answer has no such header.

### Requirement: The access token's expiry from a store

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The access token's expiry from a store

- **WHEN** `factory init` stores the file's GitHub access token in a repository and the file has no `expires` for it
- **THEN** it writes the `expires` the call that checks the token gives, as it reads it on a paste, and no `pasted`.

### Requirement: Init makes a new access token

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Init makes a new access token

- **WHEN** in a repository a person owns, NAMES or OLDER is not empty and the machine's token's DAY is 30 days or fewer away, or past
- **THEN** `factory init` prints `The GitHub access token expires on DAY, WHEN.`, or after DAY `The GitHub access token expired on DAY.`, then asks `Make a new one now? Press Enter for yes:`, before `N secrets these parts read are already set. Replace them?`. Yes runs today's step for the token (the page, the paste, and the check), stores it under each name in NAMES and OLDER, and in the file with line 11's days, prints today's `It belongs to ACCOUNT. Stored for REPOSITORY, and on this machine for your next repository.`, then `Each of your other repositories keeps the old token until you run factory init there. It stores this one from your machine.`

### Requirement: Init stores the machine's newer access token

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Init stores the machine's newer access token

- **WHEN** in a repository a person owns, OLDER is not empty and the file's token is more than 30 days from its DAY or has `expires: never`
- **THEN** `factory init` prints `OLDER here was stored on STORED, before the GitHub access token on this machine, pasted on PASTED.` (`were stored` for more than one, with STORED the earliest), then asks `Store the one on this machine in its place? Press Enter for yes:`, before `Replace them?`. Yes stores the file's token under each name in OLDER and NAMES, and counts them in `✓ Stored N secrets for REPOSITORY from this machine.`

### Requirement: Declining the access token's question

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Declining the access token's question

- **WHEN** the person answers no to the question about the GitHub access token, or yes to `Replace them?` after it
- **THEN** nothing is replaced by the no, and `init` goes on. When either question was asked, `Replace them?` no longer counts the token's secrets, and a yes to it does not ask for the token again.

### Requirement: Init does not copy a near access token

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Init does not copy a near access token

- **WHEN** `factory init` would store the file's GitHub access token in a repository and its `expires` day is 30 days or fewer away, by the file or, when the file has none, by the day the call that checks it gives
- **THEN** it does not store it. It prints `The GitHub access token on this machine expires on DAY, WHEN, so it is not stored here.` and asks for the token as it does when the file holds none. A token past its day is refused by GitHub's check, as today.

### Requirement: The access token step suggests an expiry

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The access token step suggests an expiry

- **WHEN** `factory init` asks for a GitHub access token
- **THEN** the step's line `Check that SCOPES are ticked, choose an expiry, and generate it.` ends with ` 90 days is a good balance: the factory warns you 30 days before it.`

## MODIFIED Requirements

### Requirement: Only init reads the machine's tokens

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Only init reads the machine's tokens

- **WHEN** a command other than `factory init` runs
- **THEN** No other command reads a token from either entry, and an environment variable does not stand in for one. `factory doctor` and `factory status` read only the `pasted` and `expires` days of both tokens. `factory remove` lists them among what is left by hand.
