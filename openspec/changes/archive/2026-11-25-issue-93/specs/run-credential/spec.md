## MODIFIED Requirements

### Requirement: What each workflow file passes

The factory SHALL behave as this line says: When `factory sync` writes the two workflow files, `factory.yml` passes `app-key` and the other secrets to `run.yml`, and `factory-review.yml` passes none and has only `actions: read` and `contents: read`.

#### Scenario: What each workflow file passes

- **WHEN** `factory sync` writes the two workflow files
- **THEN** `factory.yml` passes `app-key` and the other secrets to `run.yml`, and `factory-review.yml` passes none and has only `actions: read` and `contents: read`.
