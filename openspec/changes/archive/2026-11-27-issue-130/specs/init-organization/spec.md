## ADDED Requirements

### Requirement: The organization's setup

Lunamill SHALL behave as this line says: When `lunamill init --org ORG` runs, it creates the repository `ORG/lunamill-config`, described as "Lunamill's settings for every ORG repository", the board "Lunamill", and the custom property `lunamill`, and registers the GitHub App `lunamill-ORG`, lowercase, whose install address is `https://github.com/apps/lunamill-ORG/installations/new`.

#### Scenario: The organization's setup

- **WHEN** `lunamill init --org ORG` runs
- **THEN** it creates the repository `ORG/lunamill-config`, described as "Lunamill's settings for every ORG repository", the board "Lunamill", and the custom property `lunamill`, and registers the GitHub App `lunamill-ORG`, lowercase, whose install address is `https://github.com/apps/lunamill-ORG/installations/new`.

### Requirement: An organization's preset

Lunamill SHALL behave as this line says: When a repository names an organization's preset, it names it `ORG/lunamill-config//NAME`, and the preset's file is `lunamill-preset.yaml`.

#### Scenario: An organization's preset

- **WHEN** a repository names an organization's preset
- **THEN** it names it `ORG/lunamill-config//NAME`, and the preset's file is `lunamill-preset.yaml`.
