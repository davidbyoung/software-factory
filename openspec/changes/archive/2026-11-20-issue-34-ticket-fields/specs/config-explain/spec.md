## ADDED Requirements

### Requirement: Ticket-side fields print without a board

The factory SHALL behave as this line says: `factory config explain` prints the four ticket-side keys under `tickets.fields`, each as its ticket field or `none`, and any key of the repository's own heading as written, whether or not `tickets.board` is set. `tickets.columns`, and `tickets.fields`' `session`, `runs-in`, and `cost`, print only when `tickets.board` is set, as today.

#### Scenario: Ticket-side fields print without a board

- **WHEN** `factory config explain` runs, with or without `tickets.board`
- **THEN** `factory config explain` prints the four ticket-side keys under `tickets.fields`, each as its ticket field or `none`, and any key of the repository's own heading as written, whether or not `tickets.board` is set. `tickets.columns`, and `tickets.fields`' `session`, `runs-in`, and `cost`, print only when `tickets.board` is set, as today.

## REMOVED Requirements

### Requirement: Columns and fields print only with a board

**Reason**: `tickets.fields`' ticket-side keys are valid without a board, so they print without one; the requirement "Ticket-side fields print without a board" replaces this one.

**Migration**: None; output with a board is unchanged.
