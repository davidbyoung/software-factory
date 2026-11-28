## ADDED Requirements

### Requirement: What update reads and opens

lunamill SHALL behave as this line says: When `lunamill update` looks for a newer release, it reads the newest release of `lunamill-ai/lunamill`, prints `lunamill OLD → NEW`, and a pull request it opens comes from the branch `lunamill-update/lunamill-NEW` and is titled "Update lunamill to NEW".

#### Scenario: What update reads and opens

- **WHEN** `lunamill update` looks for a newer release
- **THEN** it reads the newest release of `lunamill-ai/lunamill`, prints `lunamill OLD → NEW`, and a pull request it opens comes from the branch `lunamill-update/lunamill-NEW` and is titled "Update lunamill to NEW".
