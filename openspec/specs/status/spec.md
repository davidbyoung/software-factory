# status Specification

## Purpose

When `factory status` flags a ticket left in Ready as not started, by what starts builds from the board.

## Requirements

### Requirement: Not started, with the schedule

The factory SHALL behave as this line says: When `builds.trigger` is `github-action`, `factory status` flags a Ready ticket "not started, is the factory-poller workflow running?" only once it has been Ready for `builds.poll-minutes` plus 15 minutes.

#### Scenario: Not started, with the schedule

- **WHEN** `builds.trigger` is `github-action`
- **THEN** `factory status` flags a Ready ticket "not started, is the factory-poller workflow running?" only once it has been Ready for `builds.poll-minutes` plus 15 minutes.

### Requirement: Not started, with a hosted poller

The factory SHALL behave as this line says: When `builds.trigger` is `own-server`, `factory status` flags it "not started, is the poller running?" after 5 minutes, as today.

#### Scenario: Not started, with a hosted poller

- **WHEN** `builds.trigger` is `own-server`
- **THEN** `factory status` flags it "not started, is the poller running?" after 5 minutes, as today.
