## ADDED Requirements

### Requirement: The strict adapter

The factory SHALL behave as this line says: When a test uses the strict in-memory adapter, a ticket has a status in place of open or closed, a move goes only along the adapter's allowed moves and a move with no path throws, a comment body holding `<!--` throws, and adding a label the adapter has not created throws.

#### Scenario: The strict adapter

- **WHEN** a test uses the strict in-memory adapter
- **THEN** a ticket has a status in place of open or closed, a move goes only along the adapter's allowed moves and a move with no path throws, a comment body holding `<!--` throws, and adding a label the adapter has not created throws.
