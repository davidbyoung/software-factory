## ADDED Requirements

### Requirement: The label sought

lunamill SHALL behave as this line says: When the sync, `lunamill status`, or a poller looks for the tickets lunamill works on, it looks for the label `tickets.labels.lunamill` names.

#### Scenario: The label sought

- **WHEN** the sync, `lunamill status`, or a poller looks for the tickets lunamill works on
- **THEN** it looks for the label `tickets.labels.lunamill` names.
