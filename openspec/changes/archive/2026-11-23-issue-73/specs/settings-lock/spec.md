## ADDED Requirements

### Requirement: The lock's presets and version

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The lock's presets and version

- **WHEN** `factory sync` writes `.claude/factory.lock`
- **THEN** The lock's `presets` holds, for each: `name`, `commit` in full, `settings` as its file had them, and `files`, each path with `sha256:` and its hash. `version` is the version every command there runs.

### Requirement: FACTORY_SETTINGS with presets

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: FACTORY_SETTINGS with presets

- **WHEN** `FACTORY_SETTINGS` names a file that lists presets
- **THEN** With `FACTORY_SETTINGS`, a file that lists presets stops the command: `FACTORY_SETTINGS: presets are read through the lock. Use FACTORY_LOCK`.

## MODIFIED Requirements

### Requirement: A changed settings file stops a command

The factory SHALL behave as this line says: When `.claude/factory.yaml` has changed since the lock's `settings-hash` was written, every command that reads the settings prints `.claude/factory.yaml changed since the last sync. Run: factory sync` on standard error and exits 1. A change to `.claude/factory.choices.yaml` names that file instead. The permission and ticket-text hooks read no settings, so a stale lock never stops them.

#### Scenario: A changed settings file stops a command

- **WHEN** `.claude/factory.yaml` has changed since the lock's `settings-hash` was written
- **THEN** every command that reads the settings prints `.claude/factory.yaml changed since the last sync. Run: factory sync` on standard error and exits 1. A change to `.claude/factory.choices.yaml` names that file instead. The permission and ticket-text hooks read no settings, so a stale lock never stops them.

### Requirement: An unreadable lock

The factory SHALL behave as this line says: When `.claude/factory.lock` can't be read as YAML, as a merge conflict leaves it, those commands print `.claude/factory.lock can't be read. Run: factory sync` and exit 1, and `factory sync` reads the files each side lists.

#### Scenario: An unreadable lock

- **WHEN** `.claude/factory.lock` can't be read as YAML, as a merge conflict leaves it
- **THEN** those commands print `.claude/factory.lock can't be read. Run: factory sync` and exit 1, and `factory sync` reads the files each side lists.

### Requirement: A lock from an earlier release

The factory SHALL behave as this line says: When `.claude/factory.lock` has no `settings`, as a lock from an earlier release has none, those commands print `.claude/factory.lock is from an earlier version of the factory. Run: factory sync` and exit 1.

#### Scenario: A lock from an earlier release

- **WHEN** `.claude/factory.lock` has no `settings`
- **THEN** as a lock from an earlier release has none, those commands print `.claude/factory.lock is from an earlier version of the factory. Run: factory sync` and exit 1.

### Requirement: A missing lock

The factory SHALL behave as this line says: When `.claude/factory.lock` doesn't exist, the commands of line 4 print `.claude/factory.lock is missing. Run: factory sync` and exit 1.

#### Scenario: A missing lock

- **WHEN** `.claude/factory.lock` doesn't exist
- **THEN** the commands of line 4 print `.claude/factory.lock is missing. Run: factory sync` and exit 1.

### Requirement: Changed names stop a command

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Changed names stop a command

- **WHEN** the names `.npmrc` takes differ from the lock's `npmrc-variables`
- **THEN** every command that reads the settings prints `.npmrc changed since the last sync. Run: factory sync` on standard error and exits 1, and so does `factory sync --check`. It is checked after the `settings-hash`. A lock without the key reads as `[]`. When `.npmrc` reads a name lines 6 or 7 refuse, the message is that line's instead, so the developer is not sent to a sync that refuses.

## REMOVED Requirements

### Requirement: The lock's keys

**Reason**: The lock's `presets` holds each preset's commit, settings, and file hashes where it held an installed version, and `version` is the version every command in the repository runs.

**Migration**: See "The lock's presets and version". The lock keeps `settings-hash`, `npmrc-variables`, `settings`, `overridden`, and `files`.

### Requirement: A preset at another version

**Reason**: A preset is pinned to a commit in the lock and nothing of it is in `node_modules`, so there is no installed version to differ from the lock's.

**Migration**: A pin changed by hand is caught on the pull request: see `presets`, "The check reads a preset whose commit changed".

### Requirement: A preset not installed

**Reason**: A preset is not installed: every command reads its settings from the lock and its files from the committed copies.

**Migration**: See `presets`, "Sync reads no preset's repository".

### Requirement: FACTORY_SETTINGS

**Reason**: Presets are read through the lock, so a settings file `FACTORY_SETTINGS` names cannot resolve them from `node_modules`.

**Migration**: Use `FACTORY_LOCK` for settings that list presets: see "FACTORY_SETTINGS with presets".

### Requirement: Preset updates never merge themselves

**Reason**: A preset is not an npm package, so `factory sync` holds no preset package back in Dependabot's auto-merge. That job still holds back a pull request of Dependabot's that names `davidbyoung/software-factory`, as one that raises a workflow file's version would.

**Migration**: A preset's update is a pull request the factory opens, which a person merges: see `updates`, "One pull request for each update".

### Requirement: A listed preset not installed at sync

**Reason**: `factory sync` reads no preset's package: it combines the settings each preset has in the lock.

**Migration**: See `presets`, "A preset not pinned yet", for a name in `presets` with no entry in the lock.
