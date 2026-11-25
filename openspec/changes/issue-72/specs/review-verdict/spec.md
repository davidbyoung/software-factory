## ADDED Requirements

### Requirement: Waiting on merge order

The factory SHALL behave as this line says: When "Review verdict" would be a success, with an override or with the review off too, and "Merge order" is pending, it is pending with "Merge order"'s words.

#### Scenario: Waiting on merge order

- **WHEN** "Review verdict" would be a success, with an override or with the review off too, and "Merge order" is pending
- **THEN** it is pending with "Merge order"'s words.
