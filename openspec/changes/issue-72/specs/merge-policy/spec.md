## ADDED Requirements

### Requirement: A pull request across repositories

The factory SHALL behave as this line says: When a pull request links a ticket that names other repositories, or another repository's ticket, it is `merge-manual`, with the reason `part of acme/api#12, which spans repositories`.

#### Scenario: A pull request across repositories

- **WHEN** a pull request links a ticket that names other repositories, or another repository's ticket
- **THEN** it is `merge-manual`, with the reason `part of acme/api#12, which spans repositories`.
