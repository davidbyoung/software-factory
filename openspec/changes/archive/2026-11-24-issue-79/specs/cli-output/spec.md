## ADDED Requirements

### Requirement: Marks on this capability's lines

The factory SHALL behave as this line says: When a line of this capability starts with `✓` or `✗`, or is a heading, it is colored as `terminal-color` says.

#### Scenario: Marks on this capability's lines

- **WHEN** a line of this capability starts with `✓` or `✗`, or is a heading
- **THEN** it is colored as `terminal-color` says.

## REMOVED Requirements

### Requirement: Marks on the new lines are colored

**Reason**: "Marks on this capability's lines" replaces it: the text after a mark and the headings are no longer plain throughout.

**Migration**: None.
