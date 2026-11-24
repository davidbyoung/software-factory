## Purpose

A person's GitHub token and coding agent's credential kept on their machine, in the credentials file: when `factory init` writes them, when it stores them for the next repository without asking, and what else reads them.

## ADDED Requirements

### Requirement: The tokens are kept on the machine

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The tokens are kept on the machine

- **WHEN** `factory init` stores a GitHub token or a coding agent's credential as secrets in a repository a person owns
- **THEN** In a repository a person owns, `factory init` also writes a GitHub token and a coding agent's credential it stores as secrets to the credentials file, filed as "Sam's tokens on the machine" shows, with the plan's `store` row and `It belongs to ACCOUNT. Stored for REPOSITORY, and on this machine for your next repository.`

### Requirement: Tokens stored from the machine

The factory SHALL behave as this line says: When the file holds a token for the repository's owner that GitHub accepts with every scope the parts need, and the agent's credential, it asks for neither, stores them, and prints `✓ Stored N secrets for REPOSITORY from this machine.`

#### Scenario: Tokens stored from the machine

- **WHEN** the file holds a token for the repository's owner that GitHub accepts with every scope the parts need, and the agent's credential
- **THEN** it asks for neither, stores them, and prints `✓ Stored N secrets for REPOSITORY from this machine.`

### Requirement: A token on the machine that no longer serves

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A token on the machine that no longer serves

- **WHEN** GitHub refuses the token on the machine, or it lacks a scope
- **THEN** A token GitHub refuses, or one that lacks a scope, gets the line "Sam's tokens on the machine" shows, then today's question, and the pasted one replaces it in the file.

### Requirement: Only init reads the machine's tokens

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Only init reads the machine's tokens

- **WHEN** a command other than `factory init` runs
- **THEN** No other command reads either entry, and an environment variable does not stand in for one. `factory remove` lists them among what is left by hand.
