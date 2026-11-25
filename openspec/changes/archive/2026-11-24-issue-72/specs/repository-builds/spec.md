## ADDED Requirements

### Requirement: The next to build

The factory SHALL behave as this line says: When a build's Prepare runs for a ticket that names other repositories, the next to build is the first in merge order, the listed order where none merges after another, with no open pull request for the ticket and none merged that counts (line 52).

#### Scenario: The next to build

- **WHEN** a build's Prepare runs for a ticket that names other repositories
- **THEN** the next to build is the first in merge order, the listed order where none merges after another, with no open pull request for the ticket and none merged that counts (line 52).

### Requirement: Building the next

The factory SHALL behave as this line says: When that is this repository, the build goes on as any build's.

#### Scenario: Building the next

- **WHEN** that is this repository
- **THEN** the build goes on as any build's.

### Requirement: Starting another repository's build

The factory SHALL behave as this line says: When it is another, Prepare makes the checks of lines 18, 42, 47, and 75 as it would here, then claims and records nothing, starts that repository's build, prints `Started the build in acme/web.`, and hands nothing over.

#### Scenario: Starting another repository's build

- **WHEN** it is another
- **THEN** Prepare makes the checks of lines 18, 42, 47, and 75 as it would here, then claims and records nothing, starts that repository's build, prints `Started the build in acme/web.`, and hands nothing over.

### Requirement: Nothing left to build

The factory SHALL behave as this line says: When every repository has a pull request, it prints `Every repository of #12 has a pull request.` and hands nothing over.

#### Scenario: Nothing left to build

- **WHEN** every repository has a pull request
- **THEN** it prints `Every repository of #12 has a pull request.` and hands nothing over.

### Requirement: Private and public repositories

The factory SHALL behave as this line says: When some of the ticket's repositories, its own included, are private and others public, it stops the ticket with `acme/web is public and acme/api is private, so no build in the cloud reads both: build it on your computer`, naming the first of each.

#### Scenario: Private and public repositories

- **WHEN** some of the ticket's repositories, its own included, are private and others public
- **THEN** it stops the ticket with `acme/web is public and acme/api is private, so no build in the cloud reads both: build it on your computer`, naming the first of each.

### Requirement: What a build is handed

The factory SHALL behave as this line says: When a build or an answer of such a ticket is prepared, each other repository is handed over as it is on its pull request's branch, or on its default branch with none, without its history, and the session can read it and not write it.

#### Scenario: What a build is handed

- **WHEN** a build or an answer of such a ticket is prepared
- **THEN** each other repository is handed over as it is on its pull request's branch, or on its default branch with none, without its history, and the session can read it and not write it.

### Requirement: What a review is handed

The factory SHALL behave as this line says: When a review of a pull request that is part of a ticket across repositories is prepared, the same is handed over. In a run of a public repository nothing of a private one is, its ticket included.

#### Scenario: What a review is handed

- **WHEN** a review of a pull request that is part of a ticket across repositories is prepared
- **THEN** the same is handed over. In a run of a public repository nothing of a private one is, its ticket included.

### Requirement: Starting the next build

The factory SHALL behave as this line says: When Publish opens a pull request and another repository is next, it records on the ticket `Built in acme/api: acme/api#88. Starting the build in acme/web.`, which ends this run's claim and starts the next's, then starts that build. A start that is refused is recorded as the poller records one.

#### Scenario: Starting the next build

- **WHEN** Publish opens a pull request and another repository is next
- **THEN** it records on the ticket `Built in acme/api: acme/api#88. Starting the build in acme/web.`, which ends this run's claim and starts the next's, then starts that build. A start that is refused is recorded as the poller records one.

### Requirement: The pull request's link

The factory SHALL behave as this line says: When Publish opens a pull request for such a ticket, its body has the link line of line 20 whether or not the session wrote it, and a body or a commit that says it closes the ticket is refused as one that closes another ticket is.

#### Scenario: The pull request's link

- **WHEN** Publish opens a pull request for such a ticket
- **THEN** its body has the link line of line 20 whether or not the session wrote it, and a body or a commit that says it closes the ticket is refused as one that closes another ticket is.

### Requirement: A repository the run cannot reach

The factory SHALL behave as this line says: When the App is not installed on one of the repositories, or a token cannot see one, the build stops the ticket with `The software factory's app for acme is not installed on acme/web`, or `The build token can't see acme/web`.

#### Scenario: A repository the run cannot reach

- **WHEN** the App is not installed on one of the repositories, or a token cannot see one
- **THEN** the build stops the ticket with `The software factory's app for acme is not installed on acme/web`, or `The build token can't see acme/web`.
