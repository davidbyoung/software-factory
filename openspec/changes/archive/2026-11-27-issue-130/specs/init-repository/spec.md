## ADDED Requirements

### Requirement: Init's pull request

lunamill SHALL behave as this line says: When `lunamill init` sets a repository up, its first line is `Setting up lunamill for OWNER/NAME`, its pull request comes from the branch `set-up-lunamill` and is titled "Set up lunamill", the ruleset it makes is named "lunamill", and the signing key it makes is titled "lunamill builds".

#### Scenario: Init's pull request

- **WHEN** `lunamill init` sets a repository up
- **THEN** its first line is `Setting up lunamill for OWNER/NAME`, its pull request comes from the branch `set-up-lunamill` and is titled "Set up lunamill", the ruleset it makes is named "lunamill", and the signing key it makes is titled "lunamill builds".

### Requirement: A settings change's pull request

lunamill SHALL behave as this line says: When `lunamill init` changes a repository's settings, its pull request is titled "Change lunamill's settings".

#### Scenario: A settings change's pull request

- **WHEN** `lunamill init` changes a repository's settings
- **THEN** its pull request is titled "Change lunamill's settings".
