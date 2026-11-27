## ADDED Requirements

### Requirement: The organization's steps in full

The factory SHALL behave as this line says: When `factory init --org` ends, the line after `The steps in full:` is the address of "What each developer does next" in `docs/setup/organization.md` at the installed release.

#### Scenario: The organization's steps in full

- **WHEN** `factory init --org` ends
- **THEN** The line after `The steps in full:` is the address of "What each developer does next" in `docs/setup/organization.md` at the installed release.
