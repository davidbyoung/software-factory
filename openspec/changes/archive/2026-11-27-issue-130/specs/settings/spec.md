## ADDED Requirements

### Requirement: The settings files

lunamill SHALL behave as this line says: When lunamill reads or writes a repository's settings, they are `.claude/lunamill.yaml`, `.claude/lunamill.lock`, and `.claude/lunamill.choices.yaml`.

#### Scenario: The settings files

- **WHEN** lunamill reads or writes a repository's settings
- **THEN** they are `.claude/lunamill.yaml`, `.claude/lunamill.lock`, and `.claude/lunamill.choices.yaml`.

### Requirement: Version 1 is accepted

lunamill SHALL behave as this line says: When `lunamill config check` reads `version: 1` in `.claude/lunamill.yaml`, it accepts it.

#### Scenario: Version 1 is accepted

- **WHEN** `lunamill config check` reads `version: 1` in `.claude/lunamill.yaml`
- **THEN** it accepts it.

### Requirement: Version 2 is told to move

lunamill SHALL behave as this line says: When it reads `version: 2`, it fails with `.claude/lunamill.yaml: version: must be 1: this file is version 2, see ADDRESS`, where ADDRESS is the address of "Moving to lunamill" in `docs/maintain/upgrade-notes.md` at the installed release.

#### Scenario: Version 2 is told to move

- **WHEN** `lunamill config check` reads `version: 2`
- **THEN** it fails with `.claude/lunamill.yaml: version: must be 1: this file is version 2, see ADDRESS`, where ADDRESS is the address of "Moving to lunamill" in `docs/maintain/upgrade-notes.md` at the installed release.

### Requirement: Any other version is refused

lunamill SHALL behave as this line says: When it reads any other version, it fails with `.claude/lunamill.yaml: version: must be 1`.

#### Scenario: Any other version is refused

- **WHEN** `lunamill config check` reads any other version
- **THEN** it fails with `.claude/lunamill.yaml: version: must be 1`.

## REMOVED Requirements

### Requirement: Version 2 is accepted

**Reason**: Version 1 is the settings version again, as `.claude/lunamill.yaml`.

**Migration**: A file that says `version: 2` changes the line to `version: 1`, as "Moving to lunamill" says.

### Requirement: Version 1 is refused

**Reason**: Version 1 is accepted again; "Version 2 is told to move" points a version 2 file at "Moving to lunamill".

**Migration**: None.
