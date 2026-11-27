# status Specification

## Purpose

When `factory status` flags a ticket left in Ready as not started, by what starts builds from the board.

## Requirements

### Requirement: Not started, with the schedule

The factory SHALL behave as this line says: When `builds.trigger` is `github-action`, `factory status` flags a Ready ticket "not started, is the poller's job in factory.yml running?" only once it has been Ready for `builds.poll-minutes` plus 15 minutes. Where a preset's repository, OWNER/NAME, runs the poller, the flag reads "not started, is the poller in OWNER/NAME running?".

#### Scenario: Not started, with the schedule

- **WHEN** `builds.trigger` is `github-action`
- **THEN** `factory status` flags a Ready ticket "not started, is the poller's job in factory.yml running?" only once it has been Ready for `builds.poll-minutes` plus 15 minutes. Where a preset's repository, OWNER/NAME, runs the poller, the flag reads "not started, is the poller in OWNER/NAME running?".

### Requirement: Not started, with a hosted poller

The factory SHALL behave as this line says: When `builds.trigger` is `own-server`, `factory status` flags it "not started, is the poller running?" after 5 minutes, as today.

#### Scenario: Not started, with a hosted poller

- **WHEN** `builds.trigger` is `own-server`
- **THEN** `factory status` flags it "not started, is the poller running?" after 5 minutes, as today.

### Requirement: A ticket's pull requests in status

The factory SHALL behave as this line says: When `factory status` lists a ticket that names other repositories, each of its pull requests is a line as today, with the repository in its name and, for one that waits, `waits for acme/api#88` last.

#### Scenario: A ticket's pull requests in status

- **WHEN** `factory status` lists a ticket that names other repositories
- **THEN** each of its pull requests is a line as today, with the repository in its name and, for one that waits, `waits for acme/api#88` last.

### Requirement: Another repository's ticket in status

The factory SHALL behave as this line says: When it lists a pull request that is part of another repository's ticket, its title is `part of acme/api#12`, followed by the ticket's title when it can be read.

#### Scenario: Another repository's ticket in status

- **WHEN** it lists a pull request that is part of another repository's ticket
- **THEN** its title is `part of acme/api#12`, followed by the ticket's title when it can be read.

### Requirement: Status warns of the Claude token's day

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Status warns of the Claude token's day

- **WHEN** the Claude token's day is 30 days or fewer away, or past, and `factory doctor` would print its day line
- **THEN** `factory status`, and `factory status --hook`, which a session's start prints, end with one line, after the table and, in the hook's form, after its closing fence: `? CLAUDE_CODE_OAUTH_TOKEN stops working by DAY, WHEN. Run factory init to replace it`, or after DAY `✗ CLAUDE_CODE_OAUTH_TOKEN stopped working by DAY. Run factory init`. For the organization's, each ends `An owner of ORG runs factory init --org to replace it` in place of its `Run factory init` part.

### Requirement: Status says nothing of the token otherwise

The factory SHALL behave as this line says: More than 30 days before DAY, whenever `doctor` would print no line 1 line (line 6), when the secrets or the owner cannot be read, or when `status` itself fails, `status` prints no line about the token. Its output is otherwise what it is today, and its exit status is today's whatever the line says.

#### Scenario: Status says nothing of the token otherwise

- **WHEN** the Claude token's day is more than 30 days away, `doctor` would print no day line, the secrets or the owner cannot be read, or `status` itself fails
- **THEN** `status` prints no line about the token. Its output is otherwise what it is today, and its exit status is today's whatever the line says.

### Requirement: Status reads the dates once under watch

The factory SHALL behave as this line says: `factory status --watch` reads the dates once, when it starts.

#### Scenario: Status reads the dates once under watch

- **WHEN** `factory status --watch` runs
- **THEN** it reads the dates once, when it starts.

### Requirement: Status warns of the GitHub access token's day

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Status warns of the GitHub access token's day

- **WHEN** the GitHub access token's day is 30 days or fewer away, or past, and `factory doctor` would print its day line, whether or not anything reads the Claude token
- **THEN** `factory status`, and its hook's form, end with `? The GitHub access token expires on DAY, WHEN. Run factory init to replace it`, or after DAY `✗ The GitHub access token expired on DAY. Run factory init`.

### Requirement: Status names secrets older than the access token

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Status names secrets older than the access token

- **WHEN** `factory doctor` would print its line about secrets older than the machine's GitHub access token
- **THEN** `factory status`, and its hook's form, end with that same line, in the same wording.

### Requirement: The order of the token lines in status

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The order of the token lines in status

- **WHEN** `factory status` prints a token line
- **THEN** each GitHub access token line comes after #81's line on the Claude token when both print, the day's line before the older secrets' line, and they are read once, with #81's, so a failed read prints none of them and changes nothing else `status` prints or its exit status.
