## ADDED Requirements

### Requirement: What update reads and opens

kodor SHALL behave as this line says: When `kodor update` looks for a newer release, it reads the newest release of `kodor-ai/kodor`, prints `kodor OLD → NEW`, and a pull request it opens comes from the branch `kodor-update/kodor-NEW` and is titled "Update kodor to NEW".

#### Scenario: What update reads and opens

- **WHEN** `kodor update` looks for a newer release
- **THEN** it reads the newest release of `kodor-ai/kodor`, prints `kodor OLD → NEW`, and a pull request it opens comes from the branch `kodor-update/kodor-NEW` and is titled "Update kodor to NEW".
