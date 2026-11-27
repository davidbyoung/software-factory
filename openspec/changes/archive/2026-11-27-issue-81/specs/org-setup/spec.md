## ADDED Requirements

### Requirement: The Claude token's day when run again

The factory SHALL behave as this line says: When `factory init --org` finds `CLAUDE_CODE_OAUTH_TOKEN` stored for the organization and its DAY, a year after its `updated_at` in the organization's own list of secrets, is more than 30 days away, the question reads `CLAUDE_CODE_OAUTH_TOKEN is already stored for ORG, and works until DAY. Replace it? Only if it has been revoked. Press Enter for no:`, with no as its default.

#### Scenario: The Claude token's day when run again

- **WHEN** `factory init --org` finds `CLAUDE_CODE_OAUTH_TOKEN` stored for the organization and its DAY is more than 30 days away
- **THEN** the question reads `CLAUDE_CODE_OAUTH_TOKEN is already stored for ORG, and works until DAY. Replace it? Only if it has been revoked. Press Enter for no:`, with no as its default.

### Requirement: Replacing a near Claude token

The factory SHALL behave as this line says: When DAY is 30 days or fewer away, or past, it prints `CLAUDE_CODE_OAUTH_TOKEN, stored for ORG on STORED, stops working by DAY, WHEN.`, or `stopped working by DAY.` after it, then asks `Replace it now? Press Enter for yes:`, with yes as its default.

#### Scenario: Replacing a near Claude token

- **WHEN** `factory init --org` finds `CLAUDE_CODE_OAUTH_TOKEN` stored for the organization and its DAY is 30 days or fewer away, or past
- **THEN** it prints `CLAUDE_CODE_OAUTH_TOKEN, stored for ORG on STORED, stops working by DAY, WHEN.`, or `stopped working by DAY.` after it, then asks `Replace it now? Press Enter for yes:`, with yes as its default.

### Requirement: An API key in place of the token

The factory SHALL behave as this line says: With `ANTHROPIC_API_KEY` stored in its place, the question is today's.

#### Scenario: An API key in place of the token

- **WHEN** `factory init --org` finds `ANTHROPIC_API_KEY` stored in place of `CLAUDE_CODE_OAUTH_TOKEN`
- **THEN** the question is today's.
