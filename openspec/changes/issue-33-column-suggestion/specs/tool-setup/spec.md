## MODIFIED Requirements

### Requirement: Init is unchanged with today's tools

`factory init` SHALL print the same lines and ask the same questions, in
the same order, as before this change when it runs with GitHub, GitHub
Issues, GitHub Actions, and Claude Code, except for the part "Builds that start when you move a card to Ready", whose questions and steps the requirements below describe, for the `version` it writes into a new settings file, which is 2, for the "Left to do" line it adds when `commands.gate` is empty, and for the column step it runs when the existing board it uses lacks one of the factory's columns and the settings have no `tickets.columns`, as the column-suggestion requirements describe.

#### Scenario: Init is unchanged with today's tools

- **WHEN** `factory init` runs with GitHub, GitHub Issues, GitHub Actions, and Claude Code
- **THEN** it prints the same lines and asks the same questions, in the same order, as before this change. This holds for a first run with every part chosen, a re-run with every part on and every secret set, and each case the existing tests in `tests/init.test.ts` cover, except the one edge under Decisions. An existing test of the old behavior there takes 1.3's expectation. The `Checks` that `init` ends with also show line 25's configuration lines. The part "Builds that start when you move a card to Ready" is the exception: its question, its interval, its description, and its step in "Left to do" are as the requirements added with issue 12 say. A new settings file gets `version: 2`, and "Left to do" gains the gate's line when `commands.gate` is empty, as the requirements added with issue 24 say. The column step is the exception the column-suggestion requirements describe; with a board that has the factory's six columns, init asks nothing more.
