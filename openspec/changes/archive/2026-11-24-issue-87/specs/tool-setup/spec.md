## ADDED Requirements

### Requirement: A secret the plan withholds

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A secret the plan withholds

- **WHEN** `factory doctor` finds a secret stored for the organization that the plan withholds
- **THEN** The line reads `✗ NAME is stored for ORG, and PLAN does not share it with a private repository: make the repository public, or move ORG to a paid plan`.
