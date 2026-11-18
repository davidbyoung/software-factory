## ADDED Requirements

### Requirement: The commands' defaults

The factory SHALL behave as this line says: When `commands` is not written, `commands.build-setup`, `commands.before-commit`, and `commands.gate` are empty lists, `commands.test-one`, `commands.end-to-end`, and `commands.coverage` are not set, and `commands.relock` is `npm install`.

#### Scenario: The commands' defaults

- **WHEN** `commands` is not written
- **THEN** `commands.build-setup`, `commands.before-commit`, and `commands.gate` are empty lists, `commands.test-one`, `commands.end-to-end`, and `commands.coverage` are not set, and `commands.relock` is `npm install`.

### Requirement: A command list that is not a list

The factory SHALL behave as this line says: When `commands.build-setup`, `commands.before-commit`, or `commands.gate` is anything but a list of text, `factory config check` fails, naming the key.

#### Scenario: A command list that is not a list

- **WHEN** `commands.build-setup`, `commands.before-commit`, or `commands.gate` is anything but a list of text
- **THEN** `factory config check` fails, naming the key.

### Requirement: A command that is not text

The factory SHALL behave as this line says: When `commands.test-one`, `commands.end-to-end`, or `commands.relock` is anything but text that is not empty, `factory config check` fails with `.claude/factory.yaml: commands.KEY: must be text`.

#### Scenario: A command that is not text

- **WHEN** `commands.test-one`, `commands.end-to-end`, or `commands.relock` is anything but text that is not empty
- **THEN** `factory config check` fails with `.claude/factory.yaml: commands.KEY: must be text`.

### Requirement: Coverage needs both keys

The factory SHALL behave as this line says: When `commands.coverage` is written without `run` or without `report`, `factory config check` fails with `.claude/factory.yaml: commands.coverage.KEY: is required when commands.coverage is written`.

#### Scenario: Coverage needs both keys

- **WHEN** `commands.coverage` is written without `run` or without `report`
- **THEN** `factory config check` fails with `.claude/factory.yaml: commands.coverage.KEY: is required when commands.coverage is written`.

### Requirement: Config get a command

The factory SHALL behave as this line says: When `factory config get commands.KEY` runs for `build-setup`, `before-commit`, `gate`, `test-one`, `end-to-end`, `relock`, `coverage.run`, or `coverage.report`, it prints the value, one item per line for a list, nothing for an empty list, and `none` for a key that is not set.

#### Scenario: Config get a command

- **WHEN** `factory config get commands.KEY` runs for `build-setup`, `before-commit`, `gate`, `test-one`, `end-to-end`, `relock`, `coverage.run`, or `coverage.report`
- **THEN** it prints the value, one item per line for a list, nothing for an empty list, and `none` for a key that is not set.

### Requirement: The commit guard runs before-commit

The factory SHALL behave as this line says: When a session runs `git commit`, the commit guard runs each `commands.before-commit` command in order from the repository's root, and blocks the commit at the first that fails with `the gate failed on: COMMAND. Fix the errors above, then commit.`

#### Scenario: The commit guard runs before-commit

- **WHEN** a session runs `git commit`
- **THEN** the commit guard runs each `commands.before-commit` command in order from the repository's root, and blocks the commit at the first that fails with `the gate failed on: COMMAND. Fix the errors above, then commit.`

### Requirement: The build action runs build-setup

The factory SHALL behave as this line says: When an unattended build starts, the `factory-agent` action runs each `commands.build-setup` command in order before the session, and the run stops at the first that fails.

#### Scenario: The build action runs build-setup

- **WHEN** an unattended build starts
- **THEN** the `factory-agent` action runs each `commands.build-setup` command in order before the session, and the run stops at the first that fails.

### Requirement: The gate passes

The factory SHALL behave as this line says: When `factory gate` runs and `commands.gate` is set, it runs each command in order from the repository's root, prints `$ COMMAND` before each, passes its output through, and exits 0 when every command exits 0.

#### Scenario: The gate passes

- **WHEN** `factory gate` runs and `commands.gate` is set
- **THEN** it runs each command in order from the repository's root, prints `$ COMMAND` before each, passes its output through, and exits 0 when every command exits 0.

### Requirement: The gate fails

The factory SHALL behave as this line says: When a command of the gate fails, `factory gate` runs none after it, prints `gate failed on: COMMAND` on standard error, and exits 1.

#### Scenario: The gate fails

- **WHEN** a command of the gate fails
- **THEN** `factory gate` runs none after it, prints `gate failed on: COMMAND` on standard error, and exits 1.

### Requirement: No gate is set

The factory SHALL behave as this line says: When `factory gate` runs and `commands.gate` is empty, it prints `commands.gate is not set: add the commands that check a change to .claude/factory.yaml` on standard error and exits 1.

#### Scenario: No gate is set

- **WHEN** `factory gate` runs and `commands.gate` is empty
- **THEN** it prints `commands.gate is not set: add the commands that check a change to .claude/factory.yaml` on standard error and exits 1.

### Requirement: One test alone

The factory SHALL behave as this line says: When `factory test-one FILE` or `factory test-one FILE NAME` runs and `commands.test-one` is set, it runs that command from the repository's root with `FILE` and `NAME` in its environment, `NAME` empty when none is given, passes its output through, and exits with its status.

#### Scenario: One test alone

- **WHEN** `factory test-one FILE` or `factory test-one FILE NAME` runs and `commands.test-one` is set
- **THEN** it runs that command from the repository's root with `FILE` and `NAME` in its environment, `NAME` empty when none is given, passes its output through, and exits with its status.

### Requirement: No test-one command

The factory SHALL behave as this line says: When `factory test-one FILE` runs and `commands.test-one` is not set, it prints `commands.test-one is not set` on standard error and exits 1.

#### Scenario: No test-one command

- **WHEN** `factory test-one FILE` runs and `commands.test-one` is not set
- **THEN** it prints `commands.test-one is not set` on standard error and exits 1.

### Requirement: Test-one without a file

The factory SHALL behave as this line says: When `factory test-one` runs with no FILE, it prints its usage on standard error and exits 2.

#### Scenario: Test-one without a file

- **WHEN** `factory test-one` runs with no FILE
- **THEN** it prints its usage on standard error and exits 2.

### Requirement: One end-to-end spec

The factory SHALL behave as this line says: When `factory end-to-end FILE` runs and `commands.end-to-end` is set, it runs that command once from the repository's root with `FILE` in its environment, passes its output through, and exits with its status.

#### Scenario: One end-to-end spec

- **WHEN** `factory end-to-end FILE` runs and `commands.end-to-end` is set
- **THEN** it runs that command once from the repository's root with `FILE` in its environment, passes its output through, and exits with its status.

### Requirement: An end-to-end spec repeated

The factory SHALL behave as this line says: When `factory end-to-end FILE --times K` runs, it runs the command K times in a row, stops at the first run that fails, prints `failed on run J of K` on standard error, and exits 1; when every run passes it exits 0.

#### Scenario: An end-to-end spec repeated

- **WHEN** `factory end-to-end FILE --times K` runs
- **THEN** it runs the command K times in a row, stops at the first run that fails, prints `failed on run J of K` on standard error, and exits 1; when every run passes it exits 0.

### Requirement: No end-to-end command

The factory SHALL behave as this line says: When `factory end-to-end FILE` runs and `commands.end-to-end` is not set, it prints `commands.end-to-end is not set` on standard error and exits 1.

#### Scenario: No end-to-end command

- **WHEN** `factory end-to-end FILE` runs and `commands.end-to-end` is not set
- **THEN** it prints `commands.end-to-end is not set` on standard error and exits 1.

### Requirement: The spec check runs

The factory SHALL behave as this line says: When `factory specs check` runs and `specs.type` is `openspec`, it runs `specs.check` from the repository's root with `DO_NOT_TRACK=1` in its environment, passes its output through, and exits with its status.

#### Scenario: The spec check runs

- **WHEN** `factory specs check` runs and `specs.type` is `openspec`
- **THEN** it runs `specs.check` from the repository's root with `DO_NOT_TRACK=1` in its environment, passes its output through, and exits with its status.

### Requirement: The spec check with specs off

The factory SHALL behave as this line says: When `factory specs check` runs and `specs.type` is `none`, it prints `specs are off` and exits 0.

#### Scenario: The spec check with specs off

- **WHEN** `factory specs check` runs and `specs.type` is `none`
- **THEN** it prints `specs are off` and exits 0.
