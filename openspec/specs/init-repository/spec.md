# init-repository Specification

## Purpose

Which repository `lunamill init` sets up: the `repository` line when the settings have one, and otherwise what it proposes from the checkout's remotes, and the remote the default branch is read from afterwards.

## Requirements

### Requirement: The repository line is used

Lunamill SHALL behave as this line says: When `.claude/lunamill.yaml` has a `repository` line, `lunamill init` uses it and reads no remote.

#### Scenario: The repository line is used

- **WHEN** `.claude/lunamill.yaml` has a `repository` line
- **THEN** `lunamill init` uses it and reads no remote.

### Requirement: The remotes are a proposal

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The remotes are a proposal

- **WHEN** `.claude/lunamill.yaml` has no `repository` line
- **THEN** Otherwise it reads every remote, counts two addresses of one repository as one, and asks the code host whether each is a fork. One repository that is not a fork is used. A fork, several repositories, or a code host that cannot say gets the question the draft shows, with a repository that is not a fork first, and a fork's parent offered whether or not it is a remote.

### Requirement: A repository that is no remote

Lunamill SHALL behave as this line says: When the repository chosen is no remote, it adds it as the remote `upstream`, or `upstream-2` when that name is taken, and prints `Added the remote upstream, REPOSITORY.`

#### Scenario: A repository that is no remote

- **WHEN** the repository chosen is no remote
- **THEN** it adds it as the remote `upstream`, or `upstream-2` when that name is taken, and prints `Added the remote upstream, REPOSITORY.`

### Requirement: No remote on a supported code host

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: No remote on a supported code host

- **WHEN** no remote is on a code host Lunamill supports
- **THEN** No remote on a supported code host stops it, as today.

### Requirement: The remote the default branch is read from

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The remote the default branch is read from

- **WHEN** `lunamill default-branch`, or a command that reads `origin/HEAD` today, runs
- **THEN** `lunamill default-branch`, and each command that reads `origin/HEAD` today, reads the remote whose address is the `repository` line's. With no such remote it prints the line the draft shows, naming `origin`'s repository when there is an `origin`, and exits 1.

### Requirement: The setup's steps in full

Lunamill SHALL behave as this line says: When `lunamill init` has opened the setup's pull request, the line after `The steps in full:` is the address of "4. Open a ticket" in `docs/get-started/quick-start.md` at the installed release.

#### Scenario: The setup's steps in full

- **WHEN** `lunamill init` has opened the setup's pull request
- **THEN** The line after `The steps in full:` is the address of "4. Open a ticket" in `docs/get-started/quick-start.md` at the installed release.

### Requirement: Init's pull request

Lunamill SHALL behave as this line says: When `lunamill init` sets a repository up, its first line is `Setting up lunamill for OWNER/NAME`, its pull request comes from the branch `set-up-lunamill` and is titled "Set up Lunamill", the ruleset it makes is named "lunamill", and the signing key it makes is titled "Lunamill builds".

#### Scenario: Init's pull request

- **WHEN** `lunamill init` sets a repository up
- **THEN** its first line is `Setting up lunamill for OWNER/NAME`, its pull request comes from the branch `set-up-lunamill` and is titled "Set up Lunamill", the ruleset it makes is named "lunamill", and the signing key it makes is titled "Lunamill builds".

### Requirement: A settings change's pull request

Lunamill SHALL behave as this line says: When `lunamill init` changes a repository's settings, its pull request is titled "Change Lunamill's settings".

#### Scenario: A settings change's pull request

- **WHEN** `lunamill init` changes a repository's settings
- **THEN** its pull request is titled "Change Lunamill's settings".
