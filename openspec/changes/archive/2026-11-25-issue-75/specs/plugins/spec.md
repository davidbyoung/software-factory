## MODIFIED Requirements

### Requirement: A pattern that matches nothing

The factory SHALL behave as this line says: When a `files` pattern of any role matches no file in the repository, `factory config check` prints `? .claude/factory.yaml:` with the role's path and the pattern, as its other warnings read, and still exits 0.

#### Scenario: A pattern that matches nothing

- **WHEN** a `files` pattern of any role matches no file in the repository
- **THEN** `factory config check` prints `? .claude/factory.yaml:` with the role's path and the pattern, as its other warnings read, and still exits 0.
