## ADDED Requirements

### Requirement: A policy with an agent waits for a person

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A policy with an agent waits for a person

- **WHEN** a policy with `agent` applies to a pull request's changed files
- **THEN** the pull request is `merge-manual`, with the reason `NAME is checked by an agent, so a person merges it`, decided before any check runs.
