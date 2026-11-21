## ADDED Requirements

### Requirement: The configuration page's code-host

The factory SHALL behave as this line says: When a reader opens `docs/configuration.md`, its `code-host` section reads as "The docs page" under Proposed docs shows it; "How the file works" names `version`, `repository`, and `code-host.branch-name` as required and `commands.gate` before any build; and "The shortest file" and the three complete files each hold the `code-host` block with `branch-name: "{ticket}"`.

#### Scenario: The configuration page's code-host

- **WHEN** a reader opens `docs/configuration.md`
- **THEN** its `code-host` section reads as "The docs page" under Proposed docs shows it; "How the file works" names `version`, `repository`, and `code-host.branch-name` as required and `commands.gate` before any build; and "The shortest file" and the three complete files each hold the `code-host` block with `branch-name: "{ticket}"`.

### Requirement: The CLI page's branch commands

The factory SHALL behave as this line says: When a reader opens `docs/cli.md`, it lists `factory ticket branch N` under Tickets, `factory pr for-branch BRANCH` under Pull requests, and `factory specs change-name N` under Your repository's commands, worded as "The docs that change" under Proposed docs shows.

#### Scenario: The CLI page's branch commands

- **WHEN** a reader opens `docs/cli.md`
- **THEN** it lists `factory ticket branch N` under Tickets, `factory pr for-branch BRANCH` under Pull requests, and `factory specs change-name N` under Your repository's commands, worded as "The docs that change" under Proposed docs shows.

### Requirement: The updating and presets pages

The factory SHALL behave as this line says: When a reader opens `docs/updating.md`, it says the update that brings this in stops until `factory init` adds `branch-name`, beside #53's columns, and `docs/presets.md` names `code-host.branch-name` as a setting a preset can share.

#### Scenario: The updating and presets pages

- **WHEN** a reader opens `docs/updating.md`
- **THEN** it says the update that brings this in stops until `factory init` adds `branch-name`, beside #53's columns, and `docs/presets.md` names `code-host.branch-name` as a setting a preset can share.
