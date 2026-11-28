# repositories-done Specification

## Purpose

When a ticket that names several repositories is in review, in progress, and finished, and what a pull request of one tells the others.

## Requirements

### Requirement: In review across repositories

Lunamill SHALL behave as this line says: When a ticket names other repositories, its state is In review while every one has a pull request for it that counts, open or merged, and one is open.

#### Scenario: In review across repositories

- **WHEN** a ticket names other repositories
- **THEN** its state is In review while every one has a pull request for it that counts, open or merged, and one is open.

### Requirement: In progress across repositories

Lunamill SHALL behave as this line says: When a repository has none, another has one, and no claim or start is live, the ticket is Ready when its card was moved there since, as today, and otherwise In progress, "Waiting on you". A claim or start over 24 hours old is cleared, as today, while a repository has none.

#### Scenario: In progress across repositories

- **WHEN** a repository has none, another has one, and no claim or start is live
- **THEN** the ticket is Ready when its card was moved there since, as today, and otherwise In progress, "Waiting on you". A claim or start over 24 hours old is cleared, as today, while a repository has none.

### Requirement: A pull request closed without merging

Lunamill SHALL behave as this line says: When a pull request of such a ticket is closed without merging, the ticket gets the note `acme/web#41 was closed without merging.`, worded after that as today's note is, and its claim ends.

#### Scenario: A pull request closed without merging

- **WHEN** a pull request of such a ticket is closed without merging
- **THEN** the ticket gets the note `acme/web#41 was closed without merging.`, worded after that as today's note is, and its claim ends.

### Requirement: The last merge

Lunamill SHALL behave as this line says: When the last one merges, the ticket gets the note `Every repository merged: acme/api#88, acme/web#41.` and is finished in its ticket system.

#### Scenario: The last merge

- **WHEN** the last one merges
- **THEN** the ticket gets the note `Every repository merged: acme/api#88, acme/web#41.` and is finished in its ticket system.

### Requirement: A reopened ticket

Lunamill SHALL behave as this line says: When a ticket is reopened after that note, a pull request that merged before the note does not count. One reopened with no such note counts only those merged since its newest claim.

#### Scenario: A reopened ticket

- **WHEN** a ticket is reopened after that note
- **THEN** a pull request that merged before the note does not count. One reopened with no such note counts only those merged since its newest claim.

### Requirement: Telling the ticket's repository

Lunamill SHALL behave as this line says: When a pull request with a link to such a ticket is opened, reopened, or closed, the board sync of the ticket's own repository is started, where it has a board.

#### Scenario: Telling the ticket's repository

- **WHEN** a pull request with a link to such a ticket is opened, reopened, or closed
- **THEN** the board sync of the ticket's own repository is started, where it has a board.

### Requirement: The nightly catch-up

Lunamill SHALL behave as this line says: When the nightly board sync runs, each open ticket of the repository that names others is finished if every one has merged.

#### Scenario: The nightly catch-up

- **WHEN** the nightly board sync runs
- **THEN** each open ticket of the repository that names others is finished if every one has merged.

### Requirement: Cost across repositories

Lunamill SHALL behave as this line says: When Cost is worked out for such a ticket, the cost notes on its pull requests in every repository count.

#### Scenario: Cost across repositories

- **WHEN** Cost is worked out for such a ticket
- **THEN** the cost notes on its pull requests in every repository count.
