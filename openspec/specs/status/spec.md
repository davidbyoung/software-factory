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
