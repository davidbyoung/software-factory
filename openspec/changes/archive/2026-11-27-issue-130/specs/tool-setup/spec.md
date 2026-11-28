## ADDED Requirements

### Requirement: Init writes version 1

Lunamill SHALL behave as this line says: When `lunamill init` or `lunamill init --org` writes a settings file that has no `version`, it writes `version: 1`, and the lock it writes records `version: 1`.

#### Scenario: Init writes version 1

- **WHEN** `lunamill init` or `lunamill init --org` writes a settings file that has no `version`
- **THEN** it writes `version: 1`, and the lock it writes records `version: 1`.

## REMOVED Requirements

### Requirement: Init writes version 2

**Reason**: Init writes version 1.

**Migration**: None.
