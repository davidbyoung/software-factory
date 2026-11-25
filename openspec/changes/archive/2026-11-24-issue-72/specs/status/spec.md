## ADDED Requirements

### Requirement: A ticket's pull requests in status

The factory SHALL behave as this line says: When `factory status` lists a ticket that names other repositories, each of its pull requests is a line as today, with the repository in its name and, for one that waits, `waits for acme/api#88` last.

#### Scenario: A ticket's pull requests in status

- **WHEN** `factory status` lists a ticket that names other repositories
- **THEN** each of its pull requests is a line as today, with the repository in its name and, for one that waits, `waits for acme/api#88` last.

### Requirement: Another repository's ticket in status

The factory SHALL behave as this line says: When it lists a pull request that is part of another repository's ticket, its title is `part of acme/api#12`, followed by the ticket's title when it can be read.

#### Scenario: Another repository's ticket in status

- **WHEN** it lists a pull request that is part of another repository's ticket
- **THEN** its title is `part of acme/api#12`, followed by the ticket's title when it can be read.
