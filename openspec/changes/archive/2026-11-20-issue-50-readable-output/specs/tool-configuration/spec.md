## MODIFIED Requirements

### Requirement: Claude Code's configuration lines

The factory SHALL behave as this line says: `factory doctor` prints one line for each piece of Claude Code's configuration under the `Claude Code` heading: `CLAUDE.md imports the factory's rules`, `.claude/settings.json has the factory's hooks`, and `The claude command is installed`.

#### Scenario: Claude Code's configuration lines

- **WHEN** `factory doctor` runs with Claude Code
- **THEN** `factory doctor` prints one line for each piece of Claude Code's configuration under the `Claude Code` heading: `CLAUDE.md imports the factory's rules`, `.claude/settings.json has the factory's hooks`, and `The claude command is installed`.

### Requirement: Claude Code's files are missing

The factory SHALL behave as this line says: When Claude Code's files lack the import or a hook, that line fails with the fix `Run factory sync`.

#### Scenario: Claude Code's files are missing

- **WHEN** Claude Code's files lack the import or a hook
- **THEN** that line fails with the fix `Run factory sync`.

### Requirement: Another tool's configuration

The factory SHALL behave as this line says: When a tool's declared configuration is missing, `doctor` fails a line under that tool's name with the tool's own fix; with the fake coding agent, under `Fake Agent`.

#### Scenario: Another tool's configuration

- **WHEN** a tool's declared configuration is missing
- **THEN** `doctor` fails a line under that tool's name with the tool's own fix; with the fake coding agent, under `Fake Agent`.
