## ADDED Requirements

### Requirement: A session that ends in an error

The factory SHALL behave as this line says: When Claude Code ends a cloud session with a result marked as an error and its result has text, the session's job prints, once the session has ended and the runner reads its commands again, `::error::Claude Code: WORDS`, where WORDS is the first line of that result, so it shows as an error on the run. With no text in the result, it prints only today's `Finished (...)` line.

#### Scenario: A session that ends in an error

- **WHEN** Claude Code ends a cloud session with a result marked as an error
- **THEN** when its result has text, the session's job prints, once the session has ended and the runner reads its commands again, `::error::Claude Code: WORDS`, where WORDS is the first line of that result. With no text in the result, it prints only today's `Finished (...)` line.

### Requirement: A refused Claude token

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A refused Claude token

- **WHEN** WORDS reads as a refusal of the credential, by the pattern `factory init` uses to try a pasted one, and the session read `CLAUDE_CODE_OAUTH_TOKEN`
- **THEN** the line is instead `::error::Claude Code refused CLAUDE_CODE_OAUTH_TOKEN: WORDS. A Claude token lasts a year: run factory init to store a new one.` in a repository a person owns, and `... A Claude token lasts a year: an owner of ORG runs factory init --org to store a new one.` in one an organization owns, told from the run's event, with ORG the repository's owner.

### Requirement: A refused API key

The factory SHALL behave as this line says: When WORDS reads as a refusal and the session read `ANTHROPIC_API_KEY`, the line is `::error::Claude Code refused ANTHROPIC_API_KEY: WORDS.`

#### Scenario: A refused API key

- **WHEN** WORDS reads as a refusal and the session read `ANTHROPIC_API_KEY`
- **THEN** the line is `::error::Claude Code refused ANTHROPIC_API_KEY: WORDS.`
