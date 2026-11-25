# status Specification

## Purpose

When `factory status` flags a ticket left in Ready as not started, by what starts builds from the board.

## Requirements

### Requirement: Not started, with the schedule

The factory SHALL behave as this line says: When `builds.trigger` is `github-action`, `factory status` flags a Ready ticket "not started, is the poller's job in factory.yml running?" only once it has been Ready for `builds.poll-minutes` plus 15 minutes. Where a preset's repository, OWNER/NAME, runs the poller, the flag reads "not started, is the poller in OWNER/NAME running?".

#### Scenario: Not started, with the schedule

- **WHEN** `builds.trigger` is `github-action`
- **THEN** `factory status` flags a Ready ticket "not started, is the poller's job in factory.yml running?" only once it has been Ready for `builds.poll-minutes` plus 15 minutes. Where a preset's repository, OWNER/NAME, runs the poller, the flag reads "not started, is the poller in OWNER/NAME running?".

### Requirement: Not started, with a hosted poller

The factory SHALL behave as this line says: When `builds.trigger` is `own-server`, `factory status` flags it "not started, is the poller running?" after 5 minutes, as today.

#### Scenario: Not started, with a hosted poller

- **WHEN** `builds.trigger` is `own-server`
- **THEN** `factory status` flags it "not started, is the poller running?" after 5 minutes, as today.

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
