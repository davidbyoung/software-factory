## ADDED Requirements

### Requirement: A preset whose repository runs the poller

The factory SHALL behave as this line says: When `builds.trigger` is `github-action` and a preset the repository follows is recorded so, `factory sync` writes no poller schedule and leaves `poller` out of `parts`, `factory doctor` prints the `factory-poller.yml is enabled in` line for that repository in place of its own workflow's, and the flag on a ticket that has not started reads `not started, is the poller in OWNER/NAME running?`

#### Scenario: A preset whose repository runs the poller

- **WHEN** `builds.trigger` is `github-action` and a preset the repository follows is recorded so
- **THEN** `factory sync` writes no poller schedule and leaves `poller` out of `parts`, `factory doctor` prints the `factory-poller.yml is enabled in` line for that repository in place of its own workflow's, and the flag on a ticket that has not started reads `not started, is the poller in OWNER/NAME running?`
