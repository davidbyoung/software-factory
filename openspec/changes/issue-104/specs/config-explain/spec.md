## ADDED Requirements

### Requirement: Explain prints approval policies

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Explain prints approval policies

- **WHEN** the settings have `approval-policies`
- **THEN** `factory config explain` prints each policy, with each item's line marked with the layer it came from.
