## ADDED Requirements

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
