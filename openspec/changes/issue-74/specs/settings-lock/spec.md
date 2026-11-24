## ADDED Requirements

### Requirement: The lock records a preset's poller

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The lock records a preset's poller

- **WHEN** `factory sync` writes `.claude/factory.lock`
- **THEN** The lock records, for each preset, whether its repository holds `.github/workflows/factory-poller.yml` at the pinned commit.
