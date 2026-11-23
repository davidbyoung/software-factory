## MODIFIED Requirements

### Requirement: Sync writes the push triggers

The factory SHALL behave as this line says: When `factory sync` runs, the `branches:` list of the push trigger in `.github/workflows/factory.yml` holds the default branch's name and nothing else.

#### Scenario: Sync writes the push triggers

- **WHEN** `factory sync` runs
- **THEN** the `branches:` list of the push trigger in `.github/workflows/factory.yml` holds the default branch's name and nothing else.

### Requirement: Triggers out of step

The factory SHALL behave as this line says: When the default branch's name differs from what that file holds, `factory sync --check` fails, naming the file.

#### Scenario: Triggers out of step

- **WHEN** the default branch's name differs from what that file holds
- **THEN** `factory sync --check` fails, naming the file.
