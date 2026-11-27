## MODIFIED Requirements

### Requirement: Usage with no command

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Usage with no command

- **WHEN** `factory` runs with no command
- **THEN** it prints, on standard error, `Usage: factory COMMAND`, then the groups `Setting up`, `Every day`, `Now and then`, `Presets`, and `Your repository's commands`, each command indented two spaces and padded to 21 characters before its one-line description, or alone on its line with the description on the next, indented 23 spaces, when the command is longer than 20 characters, as Proposed docs shows, then `The commands skills, hooks, and workflows run:` and, on a line of its own indented five spaces, the address of `docs/reference/cli-internal.md` at the installed release, and exits 2.

### Requirement: Usage lists a person's commands

The factory SHALL behave as this line says: The usage lists exactly the commands `docs/reference/cli.md` lists under "Setting up", "Every day", "Now and then", "Presets", and "Your repository's commands", matched by the command's words: `status --watch`'s row is `status [--watch]`'s, and options appear as Proposed docs shows them.

#### Scenario: Usage lists a person's commands

- **WHEN** `factory` prints its usage
- **THEN** the usage lists exactly the commands `docs/reference/cli.md` lists under "Setting up", "Every day", "Now and then", "Presets", and "Your repository's commands", matched by the command's words: `status --watch`'s row is `status [--watch]`'s, and options appear as Proposed docs shows them.
