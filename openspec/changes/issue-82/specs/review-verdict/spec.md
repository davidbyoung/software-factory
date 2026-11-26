## ADDED Requirements

### Requirement: Finding a commit's review runs

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Finding a commit's review runs

- **WHEN** the factory reads a commit's review runs
- **THEN** it asks for the runs of `factory.yml` started by `pull_request_target` with that `head_sha`, not the newest 50, and keeps today's filter on each run's title.
