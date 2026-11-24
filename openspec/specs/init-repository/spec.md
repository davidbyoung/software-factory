# init-repository Specification

## Purpose

Which repository `factory init` sets up: the `repository` line when the settings have one, and otherwise what it proposes from the checkout's remotes, and the remote the default branch is read from afterwards.

## Requirements

### Requirement: The repository line is used

The factory SHALL behave as this line says: When `.claude/factory.yaml` has a `repository` line, `factory init` uses it and reads no remote.

#### Scenario: The repository line is used

- **WHEN** `.claude/factory.yaml` has a `repository` line
- **THEN** `factory init` uses it and reads no remote.

### Requirement: The remotes are a proposal

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The remotes are a proposal

- **WHEN** `.claude/factory.yaml` has no `repository` line
- **THEN** Otherwise it reads every remote, counts two addresses of one repository as one, and asks the code host whether each is a fork. One repository that is not a fork is used. A fork, several repositories, or a code host that cannot say gets the question the draft shows, with a repository that is not a fork first, and a fork's parent offered whether or not it is a remote.

### Requirement: A repository that is no remote

The factory SHALL behave as this line says: When the repository chosen is no remote, it adds it as the remote `upstream`, or `upstream-2` when that name is taken, and prints `Added the remote upstream, REPOSITORY.`

#### Scenario: A repository that is no remote

- **WHEN** the repository chosen is no remote
- **THEN** it adds it as the remote `upstream`, or `upstream-2` when that name is taken, and prints `Added the remote upstream, REPOSITORY.`

### Requirement: No remote on a supported code host

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: No remote on a supported code host

- **WHEN** no remote is on a code host the factory supports
- **THEN** No remote on a supported code host stops it, as today.

### Requirement: The remote the default branch is read from

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The remote the default branch is read from

- **WHEN** `factory default-branch`, or a command that reads `origin/HEAD` today, runs
- **THEN** `factory default-branch`, and each command that reads `origin/HEAD` today, reads the remote whose address is the `repository` line's. With no such remote it prints the line the draft shows, naming `origin`'s repository when there is an `origin`, and exits 1.
