## ADDED Requirements

### Requirement: Changed names stop a command

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Changed names stop a command

- **WHEN** the names `.npmrc` takes differ from the lock's `npmrc-variables`
- **THEN** every command that reads the settings prints `.npmrc changed since the last sync. Run: npx --no-install factory sync` on standard error and exits 1, and so does `factory sync --check`. It is checked after the `settings-hash`. A lock without the key reads as `[]`. When `.npmrc` reads a name lines 6 or 7 refuse, the message is that line's instead, so the developer is not sent to a sync that refuses.

### Requirement: Other edits to .npmrc

The factory SHALL behave as this line says: When `.npmrc` changes and the names it takes do not, nothing stops.

#### Scenario: Other edits to .npmrc

- **WHEN** `.npmrc` changes and the names it takes do not
- **THEN** nothing stops.

## MODIFIED Requirements

### Requirement: The lock's keys

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The lock's keys

- **WHEN** `factory sync` runs
- **THEN** `.claude/factory.lock` holds, in this order: `version`, the factory's version; `presets`, a list with each preset's `name` and installed `version`, empty when there are none; `settings-hash`, `sha256:` and the hex SHA-256 of `.claude/factory.yaml` and `.claude/factory.choices.yaml`; `npmrc-variables`, the names the `.npmrc` at the repository's root reads in its sign-in lines, in order, or `[]` when there are none; `settings`, a block; `overridden`, for each setting, list item, and file whose value in effect replaced another layer's, each other layer's name and value; and `files`.
