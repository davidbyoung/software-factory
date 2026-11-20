## ADDED Requirements

### Requirement: An organization's Actions secret counts

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An organization's Actions secret counts

- **WHEN** a repository an organization owns has a secret the factory reads that is not set on the repository, but the organization shares an Actions secret of that name with it
- **THEN** `init` and `doctor` count it as set, for every secret the factory reads. `doctor`'s line then reads `NAME is set by the organization, for ...`. Where the organization's Dependabot secrets can be listed and one of that name is shared with the repository, `init` counts the Dependabot copy as set too, and asks nothing for it. Which secrets `init` offers to delete when a part is turned off, and what `factory remove` reads, stay the repository's own.

### Requirement: An organization's Dependabot secret

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An organization's Dependabot secret

- **WHEN** a Dependabot secret is not set on a repository an organization owns
- **THEN** `doctor` reads the organization's Dependabot secrets. When one of that name is shared with the repository, it passes `NAME is set by the organization for Dependabot, for installing on Dependabot's pull requests`. When they cannot be listed, it prints `? NAME is not set for Dependabot on the repository, and only an organization admin can see whether the organization sets it`, which fails nothing.

### Requirement: A person's repository

The factory SHALL behave as this line says: On a repository a person owns, a secret not set on the repository is not set: no `?` line.

#### Scenario: A person's repository

- **WHEN** a secret is not set on a repository a person owns
- **THEN** On a repository a person owns, a secret not set on the repository is not set: no `?` line.

### Requirement: Secrets that can't be listed

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Secrets that can't be listed

- **WHEN** the repository's Actions secrets cannot be listed
- **THEN** `doctor` fails `The secrets can be listed` as today, prints no line of 16, and still prints 17 to 20. When the repository's own Dependabot secrets cannot be listed, `doctor` fails `The Dependabot secrets can be listed` with the error, as it does today for the Actions secrets, and prints no Dependabot line of 17 or 23; `init` prints `Could not reach the code host: ` and the error, and exits 1, as it does today for the Actions secrets.

### Requirement: An unknown check

The factory SHALL behave as this line says: When a check's state is unknown, `doctor` prints it with a leading `? `, and it does not make `doctor` exit 1.

#### Scenario: An unknown check

- **WHEN** a check's state is unknown
- **THEN** `doctor` prints it with a leading `? `, and it does not make `doctor` exit 1.

## MODIFIED Requirements

### Requirement: Init is unchanged with today's tools

`factory init` SHALL print the same lines and ask the same questions, in
the same order, as before this change when it runs with GitHub, GitHub
Issues, GitHub Actions, and Claude Code, except where the requirements for
builds from the board, the settings' `version`, the gate's "Left to do"
line, the column-suggestion step, and the npm-registry-secrets
requirements say otherwise.

#### Scenario: Init is unchanged with today's tools

- **WHEN** `factory init` runs with GitHub, GitHub Issues, GitHub Actions, and Claude Code
- **THEN** it prints the same lines and asks the same questions, in the same order, as before this change. This holds for a first run with every part chosen, a re-run with every part on and every secret set, and each case the existing tests in `tests/init.test.ts` cover, except the one edge under Decisions. An existing test of the old behavior there takes 1.3's expectation. The `Checks` that `init` ends with also show line 25's configuration lines. The part "Builds that start when you move a card to Ready" is the exception: its question, its interval, its description, and its step in "Left to do" are as the requirements added with issue 12 say. A new settings file gets `version: 2`, and "Left to do" gains the gate's line when `commands.gate` is empty, as the requirements added with issue 24 say. The column step is the exception the column-suggestion requirements describe; with a board that has the factory's six columns, init asks nothing more. Where `.npmrc` takes a name, or the organization shares a secret the factory reads, init's lines are as the npm-registry-secrets requirements and the organization-secret requirements added with issue 31 say.

### Requirement: Doctor is unchanged with today's tools

`factory doctor` SHALL print the same lines as before this change with
today's tools, plus the configuration lines, plus the gate's line when `commands.gate` is empty, and plus the npm lines when `.npmrc` takes a name.

#### Scenario: Doctor is unchanged with today's tools

- **WHEN** `factory doctor` runs with today's tools
- **THEN** its lines are the same as before this change, plus line 25's configuration lines, and one more line shown as off when `commands.gate` is empty, as the requirement added with issue 24 says. Where `.npmrc` takes a name, the lines of the npm-registry-secrets requirements 16 to 21 added with issue 31 are added, and a secret the organization shares reads as the organization-secret requirements say.
