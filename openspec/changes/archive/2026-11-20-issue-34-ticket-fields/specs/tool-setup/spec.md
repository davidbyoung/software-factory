## ADDED Requirements

### Requirement: Init requires the coding agent

The factory SHALL behave as this line says: When `factory init` runs and the coding agent's command isn't installed, init prints `Setting up the software factory for <repository>`, a blank line, then `The factory runs in a coding agent, and <label> is not installed.`, `Install it and run factory init again.`, and `Nothing changed.`, and exits 1. It asks nothing, writes nothing, and changes no board and no secret.

#### Scenario: Init requires the coding agent

- **WHEN** `factory init` runs and the coding agent's command isn't installed
- **THEN** Init prints `Setting up the software factory for <repository>`, a blank line, then `The factory runs in a coding agent, and <label> is not installed.`, `Install it and run factory init again.`, and `Nothing changed.`, and exits 1. It asks nothing, writes nothing, and changes no board and no secret.

## MODIFIED Requirements

### Requirement: Init is unchanged with today's tools

`factory init` SHALL print the same lines and ask the same questions, in
the same order, as before this change when it runs with GitHub, GitHub
Issues, GitHub Actions, and Claude Code, except where the requirements for
builds from the board, the settings' `version`, the gate's "Left to do"
line, the column-suggestion step, the field-suggestion step, and the
npm-registry-secrets requirements say otherwise.

#### Scenario: Init is unchanged with today's tools

- **WHEN** `factory init` runs with GitHub, GitHub Issues, GitHub Actions, and Claude Code
- **THEN** it prints the same lines and asks the same questions, in the same order, as before this change. This holds for a first run with every part chosen, a re-run with every part on and every secret set, and each case the existing tests in `tests/init.test.ts` cover, except the one edge under Decisions. An existing test of the old behavior there takes 1.3's expectation. The `Checks` that `init` ends with also show line 25's configuration lines. The part "Builds that start when you move a card to Ready" is the exception: its question, its interval, its description, and its step in "Left to do" are as the requirements added with issue 12 say. A new settings file gets `version: 2`, and "Left to do" gains the gate's line when `commands.gate` is empty, as the requirements added with issue 24 say. The column step is the exception the column-suggestion requirements describe; with a board that has the factory's six columns, init asks nothing more. Where `.npmrc` takes a name, or the organization shares a secret the factory reads, init's lines are as the npm-registry-secrets requirements and the organization-secret requirements added with issue 31 say. The field-suggestion step is the exception the field-suggestion requirements describe; with tickets that have no text field, init asks nothing more. With Claude Code not installed, init stops as the requirement "Init requires the coding agent" says, so the `Coding agent` row under `Found` always shows its label, never "which is not installed: sessions and its token need it", and the agent's secret is always got by running its command, never asked for as `ANTHROPIC_API_KEY` alone.
