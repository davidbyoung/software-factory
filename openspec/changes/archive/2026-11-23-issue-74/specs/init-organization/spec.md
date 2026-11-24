## Purpose

What `factory init` prints and asks in a repository an organization owns, by whether the organization is set up and its secrets reach the repository, and the rows it prints in a repository a person owns.

## ADDED Requirements

### Requirement: An organization that is set up

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An organization that is set up

- **WHEN** `factory init` runs in a repository an organization owns
- **THEN** In a repository an organization owns, `factory init` prints the `Organization` row. It is `set up` when `FACTORY_APP_CLIENT_ID`, `FACTORY_APP_PRIVATE_KEY`, and a credential of the coding agent's reach the repository, and it then prints the `Stored for ORG, so not asked` block and asks for no token.

### Requirement: An organization that is not set up here

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An organization that is not set up here

- **WHEN** the `Organization` row is not `set up`
- **THEN** Otherwise the row is one of the two "the rest" shows, by whether `ORG/factory-config` exists, with the two lines after it. It asks for no GitHub token, and each part that reads one is left off.

### Requirement: The parts left to turn on

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The parts left to turn on

- **WHEN** `factory init` comes to the parts
- **THEN** It asks `Also turn on here?` only for the parts neither a preset, the settings, nor a stored secret decide. Pull requests that merge themselves is always among them, and signed commits never is under the App. When it cannot allow auto-merge on the repository, "Left to do" gains `An admin of REPOSITORY allows auto-merge: Settings, General, "Allow auto-merge"`.

### Requirement: The rows in a person's repository

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The rows in a person's repository

- **WHEN** `factory init` runs in a repository a person owns
- **THEN** In a repository a person owns it prints the `Account` and `This machine` rows the draft shows.
