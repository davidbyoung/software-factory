## ADDED Requirements

### Requirement: The label's key

lunamill SHALL behave as this line says: When the settings name the label of the tickets lunamill works on, its key is `lunamill` under `tickets.labels`, and its default value is `lunamill`. A key `factory` there is an unknown key.

#### Scenario: The label's key

- **WHEN** the settings name the label of the tickets lunamill works on
- **THEN** its key is `lunamill` under `tickets.labels`, and its default value is `lunamill`. A key `factory` there is an unknown key.
