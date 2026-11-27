## ADDED Requirements

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
