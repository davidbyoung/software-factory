## MODIFIED Requirements

### Requirement: The workflows read the ticket system's secrets

The factory SHALL write, when the ticket system in use declares secrets for the workflows, each one's name into the one more line under `secrets` of both workflow files, which passes them to the jobs that run a factory command or a session, writing a name the `.npmrc` also reads once.

#### Scenario: The workflows read the ticket system's secrets

- **WHEN** the ticket system in use declares secrets for the workflows
- **THEN** `factory sync` writes each name into the one more line under `secrets` of `.github/workflows/factory.yml` and `.github/workflows/factory-review.yml`, as it writes an `.npmrc` token's, adding only that line and writing a name the `.npmrc` also reads once.
