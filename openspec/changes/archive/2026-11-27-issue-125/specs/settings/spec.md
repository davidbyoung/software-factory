## MODIFIED Requirements

### Requirement: Version 1 is refused

The factory SHALL behave as this line says: When `factory config check` reads `version: 1`, it fails with `.claude/factory.yaml: version: must be 2: this file is version 1, see ADDRESS`, where ADDRESS is the address of "Moving to settings version 2" in `docs/maintain/upgrade-notes.md` at the installed release.

#### Scenario: Version 1 is refused

- **WHEN** `factory config check` reads `version: 1`
- **THEN** it fails with `.claude/factory.yaml: version: must be 2: this file is version 1, see ADDRESS`, where ADDRESS is the address of "Moving to settings version 2" in `docs/maintain/upgrade-notes.md` at the installed release.
