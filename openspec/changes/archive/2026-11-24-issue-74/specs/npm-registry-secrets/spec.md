## MODIFIED Requirements

### Requirement: The installing jobs get the variable

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The installing jobs get the variable

- **WHEN** sync takes a name
- **THEN** `factory.yml` passes it by name in one more line under `secrets`, and each job of it that installs has `NAME` in its environment. `factory-review.yml` passes none.

### Requirement: Sync adds only lines

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Sync adds only lines

- **WHEN** sync takes one or more names
- **THEN** With names, `factory.yml` is what sync writes without names with only the one line under `secrets` added, and `factory-review.yml` is the same: removing the line gives back, byte for byte, what sync writes without names.

### Requirement: GITHUB_TOKEN is the workflow's own

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: GITHUB_TOKEN is the workflow's own

- **WHEN** the name taken is `GITHUB_TOKEN`
- **THEN** sync passes no secret for it: the jobs that install read packages with their own token, which `factory.yml` gives `packages: read`.
