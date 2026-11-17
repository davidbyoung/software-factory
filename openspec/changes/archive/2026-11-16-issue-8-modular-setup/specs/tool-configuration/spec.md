## ADDED Requirements

### Requirement: Claude Code's configuration lines

`factory doctor` SHALL print one line for each piece of Claude Code's
configuration.

#### Scenario: Claude Code's configuration lines

- **WHEN** `factory doctor` runs with Claude Code
- **THEN** it prints one line for each piece of Claude Code's configuration, passing when it is there: "Claude Code: `CLAUDE.md` imports the factory's rules", "Claude Code: `.claude/settings.json` has the factory's hooks", and "Claude Code: the `claude` command is installed".

### Requirement: Claude Code's files are missing

`doctor` SHALL fail when Claude Code's files lack the factory's import or
hooks.

#### Scenario: Claude Code's files are missing

- **WHEN** `CLAUDE.md` lacks the import, or `.claude/settings.json` lacks any of the factory's hooks
- **THEN** that line fails with the fix `Run npx --no-install factory sync`, and `doctor` exits non-zero.

### Requirement: Claude Code is not installed

`doctor` SHALL fail when the `claude` command is not installed.

#### Scenario: Claude Code is not installed

- **WHEN** the `claude` command is not installed
- **THEN** that line fails with the fix "Install Claude Code, then sign in", and `doctor` exits non-zero.

### Requirement: Another tool's configuration

`doctor` SHALL fail on any tool's missing configuration, in that tool's
words, with no change to `doctor` for a new tool.

#### Scenario: Another tool's configuration

- **WHEN** a tool's declared configuration is missing
- **THEN** `doctor` fails with a line that starts with the tool's name and gives the tool's own fix. With the test-only fake coding agent, "Fake Agent" (whose configuration is a `FAKEAGENT.md` file), deleting that file fails `doctor` with "Fake Agent: …", with no edit to `doctor`.
