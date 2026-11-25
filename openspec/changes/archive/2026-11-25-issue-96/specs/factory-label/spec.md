## MODIFIED Requirements

### Requirement: Tickets the factory opens carry the label

The factory SHALL behave as this line says: When `factory ticket open`, `factory pr follow-ups`, the conflict sweep, or `factory-deps` opens a ticket, the ticket carries the factory label.

#### Scenario: Tickets the factory opens carry the label

- **WHEN** `factory ticket open`, `factory pr follow-ups`, the conflict sweep, or `factory-deps` opens a ticket
- **THEN** the ticket carries the factory label.
