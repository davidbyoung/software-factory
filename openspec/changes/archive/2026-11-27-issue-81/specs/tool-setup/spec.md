## ADDED Requirements

### Requirement: Doctor gives the Claude token's day

The factory SHALL behave as this line says: When `factory doctor` prints `CLAUDE_CODE_OAUTH_TOKEN is set` or `CLAUDE_CODE_OAUTH_TOKEN is set by the organization`, for a part or for the approval policies' agents, it prints one more line under the runner's heading, right after that one, saying the day it stops working.

#### Scenario: Doctor gives the Claude token's day

- **WHEN** `factory doctor` prints `CLAUDE_CODE_OAUTH_TOKEN is set` or `CLAUDE_CODE_OAUTH_TOKEN is set by the organization`
- **THEN** it prints one more line under the runner's heading, right after that one, saying the day it stops working. DAY and STORED are `YYYY-MM-DD`, ORG the repository's or organization's owner, and WHEN the whole days from today to DAY, printed `in 1 day`, `in N days`, or `today` for 0. The Claude token's day is a year after the date line 2 names.

### Requirement: The date the token's day counts from

The factory SHALL behave as this line says: The date it counts from is the secret's `updated_at` in the repository's list, or, for a secret only the organization sets, in the organization's list of secrets shared with the repository. In a repository a person owns, when the credentials file holds a `pasted` day under `claude-code` for the repository's owner and it is earlier, that day counts instead.

#### Scenario: The date the token's day counts from

- **WHEN** `factory doctor` works out the Claude token's day
- **THEN** the date it counts from is the secret's `updated_at` in the repository's list, or, for a secret only the organization sets, in the organization's list of secrets shared with the repository. In a repository a person owns, when the credentials file holds a `pasted` day under `claude-code` for the repository's owner and it is earlier, that day counts instead.

### Requirement: The token's day more than 30 days off

The factory SHALL behave as this line says: More than 30 days before DAY, the line is `✓ CLAUDE_CODE_OAUTH_TOKEN stops working by DAY, a year after it was stored`, ending `a year after you pasted it` when the file's day counted, or `a year after ORG stored it` for the organization's.

#### Scenario: The token's day more than 30 days off

- **WHEN** the Claude token's day is more than 30 days away
- **THEN** the line is `✓ CLAUDE_CODE_OAUTH_TOKEN stops working by DAY, a year after it was stored`, ending `a year after you pasted it` when the file's day counted, or `a year after ORG stored it` for the organization's.

### Requirement: The token's day within 30 days

The factory SHALL behave as this line says: From 30 days before DAY through DAY, the line is `? CLAUDE_CODE_OAUTH_TOKEN stops working by DAY, WHEN, a year after it was stored. Run factory init to replace it`, with line 3's other two endings, and for the organization's ending `a year after ORG stored it. An owner of ORG runs factory init --org to replace it`. It does not change `doctor`'s exit status.

#### Scenario: The token's day within 30 days

- **WHEN** the Claude token's day is 30 days or fewer away, or today
- **THEN** the line is `? CLAUDE_CODE_OAUTH_TOKEN stops working by DAY, WHEN, a year after it was stored. Run factory init to replace it`, with line 3's other two endings, and for the organization's ending `a year after ORG stored it. An owner of ORG runs factory init --org to replace it`. It does not change `doctor`'s exit status.

### Requirement: The token's day passed

The factory SHALL behave as this line says: After DAY, the line is `✗ CLAUDE_CODE_OAUTH_TOKEN stopped working by DAY, a year after it was stored. Run factory init`, with line 3's other endings, and for the organization's `✗ CLAUDE_CODE_OAUTH_TOKEN stopped working by DAY, a year after ORG stored it: an owner of ORG runs factory init --org`. `doctor` exits 1.

#### Scenario: The token's day passed

- **WHEN** the Claude token's day has passed
- **THEN** the line is `✗ CLAUDE_CODE_OAUTH_TOKEN stopped working by DAY, a year after it was stored. Run factory init`, with line 3's other endings, and for the organization's `✗ CLAUDE_CODE_OAUTH_TOKEN stopped working by DAY, a year after ORG stored it: an owner of ORG runs factory init --org`. `doctor` exits 1.

### Requirement: No day line without the token's set line

The factory SHALL behave as this line says: When `doctor` prints no such `is set` line, as when `ANTHROPIC_API_KEY` is the name set, the secrets cannot be listed, nothing reads the credential, or the organization's copy does not reach a private repository, it prints no line about the token's day.

#### Scenario: No day line without the token's set line

- **WHEN** `doctor` prints no `CLAUDE_CODE_OAUTH_TOKEN is set` line
- **THEN** it prints no line about the token's day, as when `ANTHROPIC_API_KEY` is the name set, the secrets cannot be listed, nothing reads the credential, or the organization's copy does not reach a private repository.

## MODIFIED Requirements

### Requirement: Doctor is unchanged with today's tools

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Doctor is unchanged with today's tools

- **WHEN** `factory doctor` runs with today's tools
- **THEN** `factory doctor` prints the same checks as before this change with today's tools, sorted and worded as lines 20 to 25 and 33 say, three lines #74 adds, and the line about the Claude token's day that #81 adds. With `pr-review` set, it says whether "Review verdict" is required, and what CI's own token may do, under the code host's name, as their own requirements word them. Where a preset's repository runs the poller, `factory doctor` prints that repository's `factory-poller.yml` line under the runner's name, after the line for `factory.yml`.

### Requirement: Init is unchanged with today's tools

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Init is unchanged with today's tools

- **WHEN** `factory init` runs with GitHub, GitHub Issues, GitHub Actions, and Claude Code
- **THEN** `factory init` prints the same lines and asks the same questions as before this change with today's tools, except its closing checks, as line 26 says, its fixes, as line 25 says, the question that asks for `code-host.branch-name` when the settings in effect have none, the spec tool's question and install that #37's lines 17 to 24 add, what #73's lines 20 and 46 add and take away, what #74's lines 27 to 54 add and take away, and what #81's lines 13 to 17 add.
