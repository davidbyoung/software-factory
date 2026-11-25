## ADDED Requirements

### Requirement: The repositories field

The factory SHALL behave as this line says: When `tickets.fields.repositories` names a ticket field, the section's text is kept there, as for `decisions`. Its default is `none`, the lock holds the key, and it is the eighth key the factory knows, so no longer a heading of the repository's own.

#### Scenario: The repositories field

- **WHEN** `tickets.fields.repositories` names a ticket field
- **THEN** the section's text is kept there, as for `decisions`. Its default is `none`, the lock holds the key, and it is the eighth key the factory knows, so no longer a heading of the repository's own.

## MODIFIED Requirements

### Requirement: A key of the repository's own heading

The factory SHALL behave as this line says: A key under `tickets.fields` other than the eight the factory knows is the repository's own heading. When it isn't lowercase words joined by hyphens, `factory config check` fails with `.claude/factory.yaml: tickets.fields.<key>: must be a heading in lowercase, with hyphens for spaces`.

#### Scenario: A key of the repository's own heading

- **WHEN** `tickets.fields` has a key other than the eight the factory knows
- **THEN** A key under `tickets.fields` other than the eight the factory knows is the repository's own heading. When it isn't lowercase words joined by hyphens, `factory config check` fails with `.claude/factory.yaml: tickets.fields.<key>: must be a heading in lowercase, with hyphens for spaces`.
