## ADDED Requirements

### Requirement: Doctor gives the GitHub access token's day

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Doctor gives the GitHub access token's day

- **WHEN** in a repository a person owns, the credentials file holds the GitHub access token for the repository's owner with an `expires` day, and NAMES is not empty
- **THEN** `factory doctor` prints one more line under the runner's heading, after the last `is set` line of the token's secrets. DAY, STORED, and PASTED are `YYYY-MM-DD` in UTC. WHEN is the whole days from today to DAY, printed `in 1 day`, `in N days`, or `today` for 0, as #81 prints it. The token's secrets are the names `factory init`'s step for the token stores it under for the parts on, of `FACTORY_BOARD_TOKEN`, `FACTORY_BUILD_TOKEN`, and `FACTORY_AUTOMERGE_TOKEN`; one set but read by no part, such as `FACTORY_BUILD_TOKEN` beside a board, is not one. NAMES are the token's secrets that are set on the repository and hold the machine's token, joined as `A`, `A and B`, or `A, B, and C`. OLDER are those set on the repository that do not, joined the same way, with `is` for one and `are` for more. A secret holds the machine's token when its `updated_at` day is on or after the file's `pasted` day for the token, or when the file has no `pasted` day for it.

### Requirement: The access token's day more than 30 days off

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The access token's day more than 30 days off

- **WHEN** the GitHub access token's day is more than 30 days away, or it has `expires: never`
- **THEN** the line is `✓ The GitHub access token in NAMES expires on DAY`, and with `expires: never` it is `✓ The GitHub access token in NAMES has no expiry date`.

### Requirement: The access token's day within 30 days

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The access token's day within 30 days

- **WHEN** the GitHub access token's day is 30 days or fewer away, or today
- **THEN** the line is `? The GitHub access token in NAMES expires on DAY, WHEN. Run factory init to replace it`, and it does not change `doctor`'s exit status.

### Requirement: The access token's day passed

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The access token's day passed

- **WHEN** the GitHub access token's day has passed
- **THEN** the line is `✗ The GitHub access token in NAMES expired on DAY. Run factory init`, and `doctor` exits 1.

### Requirement: Secrets older than the access token on the machine

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Secrets older than the access token on the machine

- **WHEN** the file holds the GitHub access token for the owner and OLDER is not empty
- **THEN** `doctor` prints, after the same `is set` lines and line 1's line, `? OLDER here is older than the GitHub access token on this machine. Run factory init to store that one in its place` (`are older` for more than one), which does not change its exit status. When the machine's token is itself 30 days or fewer from its DAY, or past it, the line ends `Run factory init to replace it` instead, since `factory init` then makes a new one (lines 13 and 16).

### Requirement: No access token line

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: No access token line

- **WHEN** the repository is an organization's, the file holds no GitHub access token for the owner, the secrets cannot be listed, or the file holds no `expires` day for the token
- **THEN** `doctor` prints neither line in the first three cases, and with no `expires` day it prints the older secrets' line and not the day's.

## MODIFIED Requirements

### Requirement: Doctor is unchanged with today's tools

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Doctor is unchanged with today's tools

- **WHEN** `factory doctor` runs with today's tools
- **THEN** `factory doctor` prints the same checks as before this change with today's tools, sorted and worded as lines 20 to 25 and 33 say, three lines #74 adds, the line about the Claude token's day that #81 adds, and the lines about the GitHub access token that #114 adds. With `pr-review` set, it says whether "Review verdict" is required, and what CI's own token may do, under the code host's name, as their own requirements word them. Where a preset's repository runs the poller, `factory doctor` prints that repository's `factory-poller.yml` line under the runner's name, after the line for `factory.yml`.

### Requirement: Init is unchanged with today's tools

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Init is unchanged with today's tools

- **WHEN** `factory init` runs with GitHub, GitHub Issues, GitHub Actions, and Claude Code
- **THEN** `factory init` prints the same lines and asks the same questions as before this change with today's tools, except its closing checks, as line 26 says, its fixes, as line 25 says, the question that asks for `code-host.branch-name` when the settings in effect have none, the spec tool's question and install that #37's lines 17 to 24 add, what #73's lines 20 and 46 add and take away, what #74's lines 27 to 54 add and take away, what #81's lines 13 to 17 add, and what #114's lines 13, 14, 16, and 17 add.
