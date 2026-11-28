# merge-order Specification

## Purpose

The status that says which of a ticket's other repositories a pull request waits for.

## Requirements

### Requirement: The Merge order status

Lunamill SHALL behave as this line says: When a pull request with a link to a ticket across repositories is opened, reopened, pushed to, or marked ready, its newest commit gets the status "Merge order": pending, `Waits for acme/api#88 to merge`, or `Waits for acme/api, which has no pull request yet`, with the first it waits for, or success, `Nothing to wait for`.

#### Scenario: The Merge order status

- **WHEN** a pull request with a link to a ticket across repositories is opened, reopened, pushed to, or marked ready
- **THEN** its newest commit gets the status "Merge order": pending, `Waits for acme/api#88 to merge`, or `Waits for acme/api, which has no pull request yet`, with the first it waits for, or success, `Nothing to wait for`.

### Requirement: Posting again

Lunamill SHALL behave as this line says: When a pull request merges, or its ticket's list changes by the command, every open pull request of that ticket gets its "Merge order" and "Review verdict" again, by a run in its own repository with that run's own token.

#### Scenario: Posting again

- **WHEN** a pull request merges, or its ticket's list changes by the command
- **THEN** every open pull request of that ticket gets its "Merge order" and "Review verdict" again, by a run in its own repository with that run's own token.

### Requirement: No token to read with

Lunamill SHALL behave as this line says: When the run has neither the App's key nor a build token, "Merge order" is success, `Can't read acme/api#12: no token here reaches it`, and "Review verdict" does not wait.

#### Scenario: No token to read with

- **WHEN** the run has neither the App's key nor a build token
- **THEN** "Merge order" is success, `Can't read acme/api#12: no token here reaches it`, and "Review verdict" does not wait.

### Requirement: A read that fails

Lunamill SHALL behave as this line says: When a token is there and the read fails, "Merge order" is pending, `Could not read acme/api#12`.

#### Scenario: A read that fails

- **WHEN** a token is there and the read fails
- **THEN** "Merge order" is pending, `Could not read acme/api#12`.

### Requirement: Any other pull request

Lunamill SHALL behave as this line says: When a pull request has no link to a ticket across repositories, it gets no such status.

#### Scenario: Any other pull request

- **WHEN** a pull request has no link to a ticket across repositories
- **THEN** it gets no such status.
