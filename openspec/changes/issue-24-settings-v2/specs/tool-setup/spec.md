## ADDED Requirements

### Requirement: Init writes version 2

The factory SHALL behave as this line says: When `factory init` writes a settings file that has no `version`, it writes `version: 2`.

#### Scenario: Init writes version 2

- **WHEN** `factory init` writes a settings file that has no `version`
- **THEN** it writes `version: 2`.

### Requirement: Left to do names the gate

The factory SHALL behave as this line says: When `commands.gate` is empty, `init`'s "Left to do" includes `Add the commands that check a change, under commands.gate in .claude/factory.yaml`.

#### Scenario: Left to do names the gate

- **WHEN** `commands.gate` is empty
- **THEN** `init`'s "Left to do" includes `Add the commands that check a change, under commands.gate in .claude/factory.yaml`.

### Requirement: Doctor shows a missing gate

The factory SHALL behave as this line says: When `commands.gate` is empty, `factory doctor` prints one more line, shown as off, reading `commands.gate is not set: a build cannot finish until it is`, and its exit status is what it would be without that line.

#### Scenario: Doctor shows a missing gate

- **WHEN** `commands.gate` is empty
- **THEN** `factory doctor` prints one more line, shown as off, reading `commands.gate is not set: a build cannot finish until it is`, and its exit status is what it would be without that line.

## MODIFIED Requirements

### Requirement: Init is unchanged with today's tools

`factory init` SHALL print the same lines and ask the same questions, in
the same order, as before this change when it runs with GitHub, GitHub
Issues, GitHub Actions, and Claude Code, except for the part "Builds that start when you move a card to Ready", whose questions and steps the requirements below describe, for the `version` it writes into a new settings file, which is 2, and for the "Left to do" line it adds when `commands.gate` is empty.

#### Scenario: Init is unchanged with today's tools

- **WHEN** `factory init` runs with GitHub, GitHub Issues, GitHub Actions, and Claude Code
- **THEN** it prints the same lines and asks the same questions, in the same order, as before this change. This holds for a first run with every part chosen, a re-run with every part on and every secret set, and each case the existing tests in `tests/init.test.ts` cover, except the one edge under Decisions. An existing test of the old behavior there takes 1.3's expectation. The `Checks` that `init` ends with also show line 25's configuration lines. The part "Builds that start when you move a card to Ready" is the exception: its question, its interval, its description, and its step in "Left to do" are as the requirements added with issue 12 say. A new settings file gets `version: 2`, and "Left to do" gains the gate's line when `commands.gate` is empty, as the requirements added with issue 24 say.

### Requirement: Doctor is unchanged with today's tools

`factory doctor` SHALL print the same lines as before this change with
today's tools, plus the configuration lines, and plus the gate's line when `commands.gate` is empty.

#### Scenario: Doctor is unchanged with today's tools

- **WHEN** `factory doctor` runs with today's tools
- **THEN** its lines are the same as before this change, plus line 25's configuration lines, and one more line shown as off when `commands.gate` is empty, as the requirement added with issue 24 says.
