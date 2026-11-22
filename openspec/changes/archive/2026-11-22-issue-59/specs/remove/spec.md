## MODIFIED Requirements

### Requirement: What is left by hand

The factory SHALL behave as this line says: When `factory remove` prints what is left to remove by hand, it lists the labels by their configured names, by default `merge-automatic`, `merge-manual`, `verdict-override`, `follow-up`, and `spec`.

#### Scenario: What is left by hand

- **WHEN** `factory remove` prints what is left to remove by hand
- **THEN** it lists the labels by their configured names, by default `merge-automatic`, `merge-manual`, `verdict-override`, `follow-up`, and `spec`.
