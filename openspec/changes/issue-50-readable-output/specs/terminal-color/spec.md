## ADDED Requirements

### Requirement: Board check's marks are colored

The factory SHALL behave as this line says: When `factory board check` prints in color, each row's mark is colored as `doctor`'s are, `✓` green, `✗` red, `?` yellow, and `-` dim, and the text after it, the headings, and the first line are not colored.

#### Scenario: Board check's marks are colored

- **WHEN** `factory board check` prints in color
- **THEN** each row's mark is colored as `doctor`'s are, `✓` green, `✗` red, `?` yellow, and `-` dim, and the text after it, the headings, and the first line are not colored.

## MODIFIED Requirements

### Requirement: Output that is not a terminal stays plain

The factory SHALL behave as this line says: When the commands `terminal-color`'s Purpose lists print to something that is not a terminal and `FORCE_COLOR` is not set, they print no color codes.

#### Scenario: Output that is not a terminal stays plain

- **WHEN** the commands `terminal-color`'s Purpose lists print to something that is not a terminal and `FORCE_COLOR` is not set
- **THEN** they print no color codes.

## REMOVED Requirements

### Requirement: Board check's words are colored

**Reason**: `factory board check` no longer prints `written`, `skipped:`, `Note:`, or `Problem:`; its rows carry `doctor`'s marks, colored by "Board check's marks are colored".

**Migration**: None.
