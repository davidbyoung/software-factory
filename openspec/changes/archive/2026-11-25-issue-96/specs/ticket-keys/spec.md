## MODIFIED Requirements

### Requirement: A body that builds part of a ticket the code host does not hold

The factory SHALL behave as this line says: When the tickets are not the code host's own and a pull request's body has `Part of PROJ-4`, its cost markers count toward PROJ-4's Cost.

#### Scenario: A body that builds part of a ticket the code host does not hold

- **WHEN** the tickets are not the code host's own and a pull request's body has `Part of PROJ-4`
- **THEN** its cost markers count toward PROJ-4's Cost.
