## ADDED Requirements

### Requirement: What update reads and opens

Lunamill SHALL behave as this line says: When `lunamill update` looks for a newer release, it reads the newest release of `lunamill-ai/lunamill`, prints `Lunamill OLD → NEW`, and a pull request it opens comes from the branch `lunamill-update/lunamill-NEW` and is titled "Update Lunamill to NEW".

#### Scenario: What update reads and opens

- **WHEN** `lunamill update` looks for a newer release
- **THEN** it reads the newest release of `lunamill-ai/lunamill`, prints `Lunamill OLD → NEW`, and a pull request it opens comes from the branch `lunamill-update/lunamill-NEW` and is titled "Update Lunamill to NEW".
