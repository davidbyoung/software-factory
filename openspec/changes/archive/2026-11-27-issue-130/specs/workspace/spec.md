## ADDED Requirements

### Requirement: Where other repositories are cloned

Lunamill SHALL behave as this line says: When a session clones another repository to read, it clones it under `~/.local/share/lunamill/work/OWNER/NAME-NUMBER/REPOSITORY`.

#### Scenario: Where other repositories are cloned

- **WHEN** a session clones another repository to read
- **THEN** it clones it under `~/.local/share/lunamill/work/OWNER/NAME-NUMBER/REPOSITORY`.
