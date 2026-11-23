## MODIFIED Requirements

### Requirement: The review when tickets cannot be read

The factory SHALL behave as this line says: When the review's step cannot read the tickets, as when the base commit's factory predates `factory review tickets` or its install fails, the file holds `The tickets could not be read: ` and the last line of the error, the step passes, and the review goes on from the pull request's body.

#### Scenario: The review when tickets cannot be read

- **WHEN** the review's step cannot read the tickets
- **THEN** as when the base commit's factory predates `factory review tickets` or its install fails, the file holds `The tickets could not be read: ` and the last line of the error, the step passes, and the review goes on from the pull request's body.

### Requirement: The build workflow's ticket field

The factory SHALL behave as this line says: When a person opens `factory.yml`'s "Run workflow" form, its `ticket` field takes text and is described "The ticket's key, such as 12, for a build".

#### Scenario: The build workflow's ticket field

- **WHEN** a person opens `factory.yml`'s "Run workflow" form
- **THEN** its `ticket` field takes text and is described "The ticket's key, such as 12, for a build".
