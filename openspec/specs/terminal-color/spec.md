# terminal-color Specification

## Purpose

When the commands a person reads print in color, and what each colors. The commands this capability covers are `factory doctor`, `init`'s closing checks, `factory board check`, `factory preset add`, `factory preset remove`, `factory config explain`, and `factory status`.

## Requirements

### Requirement: FORCE_COLOR turns color on

The factory SHALL behave as this line says: When `FORCE_COLOR` is the empty string, `1`, `2`, `3`, or `true`, they print in color, whether or not their output goes to a terminal.

#### Scenario: FORCE_COLOR turns color on

- **WHEN** `FORCE_COLOR` is the empty string, `1`, `2`, `3`, or `true`
- **THEN** they print in color, whether or not their output goes to a terminal.

### Requirement: FORCE_COLOR's other values turn color off

The factory SHALL behave as this line says: When `FORCE_COLOR` is set to any other value, such as `0`, `false`, or `yes`, they print plain text, in a terminal or not.

#### Scenario: FORCE_COLOR's other values turn color off

- **WHEN** `FORCE_COLOR` is set to any other value, such as `0`, `false`, or `yes`
- **THEN** they print plain text, in a terminal or not.

### Requirement: A terminal gets color

The factory SHALL behave as this line says: When `FORCE_COLOR` is not set and their output goes to a terminal, they print in color, unless `NO_COLOR` or `NODE_DISABLE_COLORS` is set to any value, the empty string included, or `TERM` is `dumb`, when they print plain text.

#### Scenario: A terminal gets color

- **WHEN** `FORCE_COLOR` is not set and their output goes to a terminal
- **THEN** they print in color, unless `NO_COLOR` or `NODE_DISABLE_COLORS` is set to any value, the empty string included, or `TERM` is `dumb`, when they print plain text.

### Requirement: Output that is not a terminal stays plain

The factory SHALL behave as this line says: When the commands `terminal-color`'s Purpose lists print to something that is not a terminal and `FORCE_COLOR` is not set, they print no color codes.

#### Scenario: Output that is not a terminal stays plain

- **WHEN** the commands `terminal-color`'s Purpose lists print to something that is not a terminal and `FORCE_COLOR` is not set
- **THEN** they print no color codes.

### Requirement: Color adds only codes

The factory SHALL behave as this line says: When they print in color, their text with the color codes taken out is exactly the plain text.

#### Scenario: Color adds only codes

- **WHEN** they print in color
- **THEN** their text with the color codes taken out is exactly the plain text.

### Requirement: Doctor's marks are colored

The factory SHALL behave as this line says: When `factory doctor` prints in color, a `✓` is green, a `✗` red, a `-` dim, and a `?` yellow, and the text after the mark, a fix included, is not colored.

#### Scenario: Doctor's marks are colored

- **WHEN** `factory doctor` prints in color
- **THEN** a `✓` is green, a `✗` red, a `-` dim, and a `?` yellow, and the text after the mark, a fix included, is not colored.

### Requirement: Init's checks are colored

The factory SHALL behave as this line says: When `init` prints its closing checks in color, each check line is colored as line 6 says, and the lines before `Checks` are not colored.

#### Scenario: Init's checks are colored

- **WHEN** `init` prints its closing checks in color
- **THEN** each check line is colored as line 6 says, and the lines before `Checks` are not colored.

### Requirement: The preset summary's changes are colored

The factory SHALL behave as this line says: When `factory preset add` or `factory preset remove` prints its summary in color, each group's heading is bold, an `+ ITEM` is green and a `− ITEM` red, sign included, and in an `OLD → NEW` row, in any group, the old value is dim and the new one bold, with the arrow and any `, from PRESET` after it not colored.

#### Scenario: The preset summary's changes are colored

- **WHEN** `factory preset add` or `factory preset remove` prints its summary in color
- **THEN** each group's heading is bold, an `+ ITEM` is green and a `− ITEM` red, sign included, and in an `OLD → NEW` row, in any group, the old value is dim and the new one bold, with the arrow and any `, from PRESET` after it not colored.

### Requirement: The preset summary's choices stay plain

The factory SHALL behave as this line says: When the summary prints in color, the rows under `disagrees with PRESET` and `replaced by your .claude/factory.yaml`, the first line, the `writes` and `deletes` lines, the `Choose:` questions, and `Apply? [y/N]` are not colored.

#### Scenario: The preset summary's choices stay plain

- **WHEN** the summary prints in color
- **THEN** the rows under `disagrees with PRESET` and `replaced by your .claude/factory.yaml`, the first line, the `writes` and `deletes` lines, the `Choose:` questions, and `Apply? [y/N]` are not colored.

### Requirement: Config explain dims its defaults

The factory SHALL behave as this line says: When `factory config explain` prints in color, a line whose mark is `# default` is dim from its first character to its last, a line that is only a comment, such as `# board: none (default)` or `# pr-review: off`, is dim, a line whose mark names a preset has only its mark dim, and a line with no mark is not colored, even when its value is quoted text containing ` #`.

#### Scenario: Config explain dims its defaults

- **WHEN** `factory config explain` prints in color
- **THEN** a line whose mark is `# default` is dim from its first character to its last, a line that is only a comment, such as `# board: none (default)` or `# pr-review: off`, is dim, a line whose mark names a preset has only its mark dim, and a line with no mark is not colored, even when its value is quoted text containing ` #`.

### Requirement: Config explain colors the lock's settings

The factory SHALL behave as this line says: When `factory config explain` prints the settings the lock records, it colors them as line 11 says, as it does when it resolves them.

#### Scenario: Config explain colors the lock's settings

- **WHEN** `factory config explain` prints the settings the lock records
- **THEN** it colors them as line 11 says, as it does when it resolves them.

### Requirement: Status colors and links follow the rule

The factory SHALL behave as this line says: When `factory status` prints in color, its ticket and pull request numbers are links and its groups, marks, and counts take the colors they take today, and when it prints plain text, they are neither links nor colored.

#### Scenario: Status colors and links follow the rule

- **WHEN** `factory status` prints in color
- **THEN** its ticket and pull request numbers are links and its groups, marks, and counts take the colors they take today, and when it prints plain text, they are neither links nor colored.

### Requirement: Board check's marks are colored

The factory SHALL behave as this line says: When `factory board check` prints in color, each row's mark is colored as `doctor`'s are, `✓` green, `✗` red, `?` yellow, and `-` dim, and the text after it, the headings, and the first line are not colored.

#### Scenario: Board check's marks are colored

- **WHEN** `factory board check` prints in color
- **THEN** each row's mark is colored as `doctor`'s are, `✓` green, `✗` red, `?` yellow, and `-` dim, and the text after it, the headings, and the first line are not colored.
