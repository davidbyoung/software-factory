## ADDED Requirements

### Requirement: The stop where the secrets do not reach

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The stop where the secrets do not reach

- **WHEN** the `Organization` row reads `ORG, set up, but its secrets do not reach this repository: GitHub Free shares them only with public repositories, or an owner narrowed them`, and a preset turns on a board, the review, or builds that start from the board that is not met
- **THEN** `factory init` prints, after a blank line, `✗ The presets turn on PARTS. They need ORG's secrets, and those do not reach ORG/REPO.`, `An owner of ORG gives ORG/REPO access to each of these, under "Repository access". Then run factory init again.`, the lines "What the stop lists" says, `If one is not listed there, the owner runs this first:`, `factory init --org ADDRESS` on a line of its own indented five spaces, `The steps in full:`, the address of "When the organization's secrets do not reach you" in `docs/github/setup.md` at the installed release, indented the same, and `Nothing changed.`, and exits 1. The secrets that reach the repository are its own, and those its organization shares with it unless the plan withholds them. A `FACTORY_APP_PRIVATE_KEY` the organization shares counts only where the organization's variable `FACTORY_APP_CLIENT_ID` is shared with the repository too. A part is met when every secret it reads reaches the repository: for builds that start from the board, those of the board and of builds in the cloud too.

### Requirement: What the stop lists

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What the stop lists

- **WHEN** `factory init` stops as "The stop where the secrets do not reach" says
- **THEN** It prints `  Secrets: NAMES` and the address of the organization's secrets page, indented five spaces, when a secret the unmet parts read does not reach, and `  Variable: FACTORY_APP_CLIENT_ID` and the address of its variables page when the App's key could meet an unmet part and the variable is not shared with the repository. NAMES holds only what does not reach and an unmet part reads, joined by `, and `: `FACTORY_APP_PRIVATE_KEY`, for a part the App's key meets, and `CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY`, for a part a credential of the coding agent's meets.

### Requirement: The stop in an organization that is not set up

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The stop in an organization that is not set up

- **WHEN** the `Organization` row reads `not set up` and a preset turns on a board, the review, or builds that start from the board that is not met
- **THEN** `factory init` prints, after a blank line, `✗ The presets turn on PARTS. They need ORG's secrets, and ORG is not set up.`, `An owner of ORG runs this once, from any folder. Then run factory init again.`, `factory init --org ADDRESS` indented five spaces, `If ORG is set up already, its secrets are not shared with ORG/REPO. How an owner shares them:`, the address "The stop where the secrets do not reach" names, indented the same, and `Nothing changed.`, and exits 1.

### Requirement: An organization that is not set up, on a plan that keeps its secrets back

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An organization that is not set up, on a plan that keeps its secrets back

- **WHEN** `factory init` stops as "The stop in an organization that is not set up" says and the plan is also known to share no secrets with a private repository
- **THEN** It prints `PLAN shares those secrets only with public repositories, so also make ORG/REPO public, or move ORG to a paid plan.` after the command.

### Requirement: An organization whose secrets cannot be listed

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An organization whose secrets cannot be listed

- **WHEN** the organization's secrets or its variables for the repository cannot be listed, it is not set up as far as `factory init` can see, and the plan is not known to withhold the secrets of an organization that is set up
- **THEN** The `Organization` row reads `ORG: its secrets could not be listed (REASON)`, where REASON is the failure's own message, that of the secrets when both fail, and neither "The stop where the secrets do not reach" nor "The stop in an organization that is not set up" stops it.

### Requirement: Nothing said to stay off where the secrets cannot be listed

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Nothing said to stay off where the secrets cannot be listed

- **WHEN** the `Organization` row is the one "An organization whose secrets cannot be listed" says
- **THEN** `factory init` prints no line on what stays off.

### Requirement: The line on what stays off where the secrets do not reach

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The line on what stays off where the secrets do not reach

- **WHEN** the `Organization` row is the one "The stop where the secrets do not reach" names and `factory init` goes on
- **THEN** It prints `Builds on your machine work now. The review and builds in the cloud stay off until ORG's secrets reach ORG/REPO.`, after the question about presets when there is one.

### Requirement: The line on what stays off in an organization that is not set up

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The line on what stays off in an organization that is not set up

- **WHEN** the `Organization` row reads `not set up` and `factory init` goes on
- **THEN** It prints `Builds on your machine work now. The review and builds in the cloud stay off until ORG is set up.`, or, where the plan is known to share no secrets with a private repository, the same line ending `until ORG is set up, and ORG/REPO is public or ORG is on a paid plan.`, after the question about presets when there is one.

### Requirement: Builds in the cloud under a preset's builds from the board

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Builds in the cloud under a preset's builds from the board

- **WHEN** a preset turns on builds that start from the board in an organization's repository
- **THEN** `factory init` does not offer "Builds in the cloud" under `Also turn on here?`.

### Requirement: Every variable the organization shares

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Every variable the organization shares

- **WHEN** the organization shares more than 30 variables with the repository
- **THEN** `FACTORY_APP_CLIENT_ID` counts wherever among them it is listed.

## MODIFIED Requirements

### Requirement: An organization that is not set up here

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An organization that is not set up here

- **WHEN** the `Organization` row is not `set up`
- **THEN** Otherwise the row is one of the two "the rest" shows, by whether `ORG/factory-config` exists, except that when the plan withholds the secrets, the `Organization` row reads `ORG, set up, but its secrets do not reach this repository: PLAN shares them only with public repositories`, in place of the row that names GitHub Free or an owner who narrowed them, which shows where the plan is not known to withhold them, and that it is the row "An organization whose secrets cannot be listed" says where that holds. It asks for no GitHub token, and each part that reads one is left off, or, where a preset turns it on, `factory init` stops, as the requirements on a preset's part say.

### Requirement: The parts the stop names

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The parts the stop names

- **WHEN** `factory init` stops for a preset's part, as "The stop where the secrets do not reach", "The stop in an organization that is not set up", or "A preset's part the plan keeps from working" says
- **THEN** PARTS names only the parts that are not met, in the words and order of the `Parts` row: `a board`, `the review`, and `builds that start from the board`.

### Requirement: What the stop leaves undone

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What the stop leaves undone

- **WHEN** `factory init` stops for a preset's part
- **THEN** It has asked nothing after the question about presets, prints no `From the presets, so not asked` block and no line on what stays off, writes no file, makes no commit, and stores nothing.

### Requirement: The repository's own secrets meet the parts

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The repository's own secrets meet the parts

- **WHEN** each part a preset turns on is met
- **THEN** `factory init` does not stop for it.

### Requirement: However the presets are named

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: However the presets are named

- **WHEN** the presets come from the repository's own settings or from `--preset`
- **THEN** Each stop for a preset's part holds as it does for presets checked in the list.

### Requirement: A part the repository's own settings turn on

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A part the repository's own settings turn on

- **WHEN** a part is turned on by the repository's own settings, and not by a preset
- **THEN** No stop for a preset's part counts it.

### Requirement: The repository's secrets that cannot be listed

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The repository's secrets that cannot be listed

- **WHEN** the repository's own secrets cannot be listed
- **THEN** No stop for a preset's part is made.

### Requirement: The line on what stays off under the plan

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The line on what stays off under the plan

- **WHEN** the plan withholds the secrets and `factory init` goes on
- **THEN** It prints `Builds on your machine work now. The review and builds in the cloud stay off until ORG/REPO is public or ORG is on a paid plan.`, after the question about presets when there is one.

### Requirement: No line on what stays off with a credential stored

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: No line on what stays off with a credential stored

- **WHEN** the settings in effect turn on the review or builds that start from the board, or a credential of the coding agent's reaches the repository, or the repository's own secrets cannot be listed
- **THEN** `factory init` prints no line on what stays off, whichever requirement would print it.
