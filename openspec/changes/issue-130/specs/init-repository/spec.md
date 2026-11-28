## ADDED Requirements

### Requirement: Init's pull request

kodor SHALL behave as this line says: When `kodor init` sets a repository up, its first line is `Setting up kodor for OWNER/NAME`, its pull request comes from the branch `set-up-kodor` and is titled "Set up kodor", the ruleset it makes is named "kodor", and the signing key it makes is titled "kodor builds".

#### Scenario: Init's pull request

- **WHEN** `kodor init` sets a repository up
- **THEN** its first line is `Setting up kodor for OWNER/NAME`, its pull request comes from the branch `set-up-kodor` and is titled "Set up kodor", the ruleset it makes is named "kodor", and the signing key it makes is titled "kodor builds".

### Requirement: A settings change's pull request

kodor SHALL behave as this line says: When `kodor init` changes a repository's settings, its pull request is titled "Change kodor's settings".

#### Scenario: A settings change's pull request

- **WHEN** `kodor init` changes a repository's settings
- **THEN** its pull request is titled "Change kodor's settings".
