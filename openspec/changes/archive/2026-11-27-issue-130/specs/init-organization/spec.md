## ADDED Requirements

### Requirement: The organization's setup

kodor SHALL behave as this line says: When `kodor init --org ORG` runs, it creates the repository `ORG/kodor-config`, described as "kodor's settings for every ORG repository", the board "kodor", and the custom property `kodor`, and registers the GitHub App `kodor-ORG`, lowercase, whose install address is `https://github.com/apps/kodor-ORG/installations/new`.

#### Scenario: The organization's setup

- **WHEN** `kodor init --org ORG` runs
- **THEN** it creates the repository `ORG/kodor-config`, described as "kodor's settings for every ORG repository", the board "kodor", and the custom property `kodor`, and registers the GitHub App `kodor-ORG`, lowercase, whose install address is `https://github.com/apps/kodor-ORG/installations/new`.

### Requirement: An organization's preset

kodor SHALL behave as this line says: When a repository names an organization's preset, it names it `ORG/kodor-config//NAME`, and the preset's file is `kodor-preset.yaml`.

#### Scenario: An organization's preset

- **WHEN** a repository names an organization's preset
- **THEN** it names it `ORG/kodor-config//NAME`, and the preset's file is `kodor-preset.yaml`.
