## MODIFIED Requirements

### Requirement: The override's name in the verdict workflow

The factory SHALL behave as this line says: When `code-host.labels.verdict-override` is set, `factory sync` writes that name into `.github/workflows/factory.yml`, where the verdict's job starts on the label being added, and `factory sync --check` fails while the file names another.

#### Scenario: The override's name in the verdict workflow

- **WHEN** `code-host.labels.verdict-override` is set
- **THEN** `factory sync` writes that name into `.github/workflows/factory.yml`, where the verdict's job starts on the label being added, and `factory sync --check` fails while the file names another.
