## MODIFIED Requirements

### Requirement: Default label names

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Default label names

- **WHEN** `.claude/factory.yaml` has no `tickets.labels` and no `code-host.labels`
- **THEN** the factory uses the names `spec`, `factory`, `merge-automatic`, `merge-manual`, `verdict-override`, and `policy-override`, and `factory config explain` shows each under `tickets.labels` or `code-host.labels` marked `# default`, such as `factory: factory  # default`.

## ADDED Requirements

### Requirement: The policy override's name in the workflow

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The policy override's name in the workflow

- **WHEN** `code-host.labels` names `policy-override`
- **THEN** `factory sync` writes that name into `.github/workflows/factory.yml`, where the approval policies job starts on it being added, and `factory sync --check` fails while the file names another.

### Requirement: The policy override is never added by an agent

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The policy override is never added by an agent

- **WHEN** `factory pr label N --add` or `factory ticket label N --add` is given `policy-override`, by key or by its configured name
- **THEN** it refuses, as it refuses `verdict-override`, and the guard hook refuses a `gh` command that adds the configured name.
