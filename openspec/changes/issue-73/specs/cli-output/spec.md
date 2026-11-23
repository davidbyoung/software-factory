## MODIFIED Requirements

### Requirement: Fixes name factory commands

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Fixes name factory commands

- **WHEN** `doctor`, `init`, `sync --check`, `config check`, or a preset command prints a message that names a factory command
- **THEN** it names it `factory X`, not `npx --no-install factory X`: `doctor`'s and `init`'s fixes (`Run factory sync`, `Run factory init`), `init`'s `run factory init again` messages, `config check`'s design-skill warning, `sync --check`'s last line, and the preset commands' `Run: factory init`. The stale-lock messages and `.npmrc`'s sync errors name it `factory sync` too.
