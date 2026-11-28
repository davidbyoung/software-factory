# tool-configuration Specification

## Purpose

Each tool's own configuration in the repository, and how `lunamill doctor` checks it, so a missing configuration is flagged under the tool's name.

## Requirements

### Requirement: Claude Code's configuration lines

lunamill SHALL behave as this line says: `lunamill doctor` prints one line for each piece of Claude Code's configuration under the `Claude Code` heading: `CLAUDE.md imports lunamill's rules`, `.claude/settings.json has lunamill's hooks`, and `The claude command is installed`.

#### Scenario: Claude Code's configuration lines

- **WHEN** `lunamill doctor` runs with Claude Code
- **THEN** `lunamill doctor` prints one line for each piece of Claude Code's configuration under the `Claude Code` heading: `CLAUDE.md imports lunamill's rules`, `.claude/settings.json has lunamill's hooks`, and `The claude command is installed`.

### Requirement: Claude Code's files are missing

lunamill SHALL behave as this line says: When Claude Code's files lack the import or a hook, that line fails with the fix `Run lunamill sync`.

#### Scenario: Claude Code's files are missing

- **WHEN** Claude Code's files lack the import or a hook
- **THEN** that line fails with the fix `Run lunamill sync`.

### Requirement: Claude Code is not installed

`doctor` SHALL fail when the `claude` command is not installed.

#### Scenario: Claude Code is not installed

- **WHEN** the `claude` command is not installed
- **THEN** that line fails with the fix "Install Claude Code, then sign in", and `doctor` exits non-zero.

### Requirement: Another tool's configuration

lunamill SHALL behave as this line says: When a tool's declared configuration is missing, `doctor` fails a line under that tool's name with the tool's own fix; with the fake coding agent, under `Fake Agent`.

#### Scenario: Another tool's configuration

- **WHEN** a tool's declared configuration is missing
- **THEN** `doctor` fails a line under that tool's name with the tool's own fix; with the fake coding agent, under `Fake Agent`.
