## MODIFIED Requirements

### Requirement: The workflows read the ticket system's secrets

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The workflows read the ticket system's secrets

- **WHEN** the ticket system in use declares secrets for the workflows
- **THEN** `factory sync` writes each name into the one more line under `secrets` of `.github/workflows/factory.yml`, as it writes an `.npmrc` token's, adding only that line and writing a name the `.npmrc` also reads once. `.github/workflows/factory-review.yml` passes none.
