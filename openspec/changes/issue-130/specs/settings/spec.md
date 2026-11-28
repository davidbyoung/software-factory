## ADDED Requirements

### Requirement: The settings files

kodor SHALL behave as this line says: When kodor reads or writes a repository's settings, they are `.claude/kodor.yaml`, `.claude/kodor.lock`, and `.claude/kodor.choices.yaml`.

#### Scenario: The settings files

- **WHEN** kodor reads or writes a repository's settings
- **THEN** they are `.claude/kodor.yaml`, `.claude/kodor.lock`, and `.claude/kodor.choices.yaml`.

### Requirement: Version 1 is accepted

kodor SHALL behave as this line says: When `kodor config check` reads `version: 1` in `.claude/kodor.yaml`, it accepts it.

#### Scenario: Version 1 is accepted

- **WHEN** `kodor config check` reads `version: 1` in `.claude/kodor.yaml`
- **THEN** it accepts it.

### Requirement: Version 2 is told to move

kodor SHALL behave as this line says: When it reads `version: 2`, it fails with `.claude/kodor.yaml: version: must be 1: this file is version 2, see ADDRESS`, where ADDRESS is the address of "Moving to kodor" in `docs/maintain/upgrade-notes.md` at the installed release.

#### Scenario: Version 2 is told to move

- **WHEN** `kodor config check` reads `version: 2`
- **THEN** it fails with `.claude/kodor.yaml: version: must be 1: this file is version 2, see ADDRESS`, where ADDRESS is the address of "Moving to kodor" in `docs/maintain/upgrade-notes.md` at the installed release.

### Requirement: Any other version is refused

kodor SHALL behave as this line says: When it reads any other version, it fails with `.claude/kodor.yaml: version: must be 1`.

#### Scenario: Any other version is refused

- **WHEN** `kodor config check` reads any other version
- **THEN** it fails with `.claude/kodor.yaml: version: must be 1`.

## REMOVED Requirements

### Requirement: Version 2 is accepted

**Reason**: Version 1 is the settings version again, as `.claude/kodor.yaml`.

**Migration**: A file that says `version: 2` changes the line to `version: 1`, as "Moving to kodor" says.

### Requirement: Version 1 is refused

**Reason**: Version 1 is accepted again; "Version 2 is told to move" points a version 2 file at "Moving to kodor".

**Migration**: None.
