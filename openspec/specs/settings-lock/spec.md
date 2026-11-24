# settings-lock Specification

## Purpose

The settings in effect, which `factory sync` resolves into `.claude/factory.lock` and every other command reads, and how a stale lock is caught.

## Requirements

### Requirement: The lock's settings block

The factory SHALL behave as this line says: When `factory sync` runs, the lock's `settings` block holds every setting in effect, defaults included, as the lines `factory config explain` prints, each indented two spaces under `settings:`.

#### Scenario: The lock's settings block

- **WHEN** `factory sync` runs
- **THEN** the lock's `settings` block holds every setting in effect, defaults included, as the lines `factory config explain` prints, each indented two spaces under `settings:`.

### Requirement: Commands read the lock

The factory SHALL behave as this line says: When any command reads the settings, it reads the lock's `settings`, never `.claude/factory.yaml` or a preset's file. `factory init`, `sync`, `config check`, `remove`, `doctor`, and the `preset` commands are the exceptions: they read the files the lock is made from. Two more read one file each: a command that looks up the default branch reads the `repository` line from `.claude/factory.yaml`, and `factory poller --once --preset FILE` reads FILE.

#### Scenario: Commands read the lock

- **WHEN** any command reads the settings
- **THEN** it reads the lock's `settings`, never `.claude/factory.yaml` or a preset's file. `factory init`, `sync`, `config check`, `remove`, `doctor`, and the `preset` commands are the exceptions: they read the files the lock is made from. Two more read one file each: a command that looks up the default branch reads the `repository` line from `.claude/factory.yaml`, and `factory poller --once --preset FILE` reads FILE.

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

### Requirement: The commit hook on a stale lock

The factory SHALL behave as this line says: When the lock is stale by lines 4 to 7, the commit hook blocks `git commit` with the same message.

#### Scenario: The commit hook on a stale lock

- **WHEN** the lock is stale by lines 4 to 7
- **THEN** the commit hook blocks `git commit` with the same message.

### Requirement: The session-start hook on a stale lock

The factory SHALL behave as this line says: When the lock is stale by lines 4 to 7, the session-start hook prints the same message and the session starts.

#### Scenario: The session-start hook on a stale lock

- **WHEN** the lock is stale by lines 4 to 7
- **THEN** the session-start hook prints the same message and the session starts.

### Requirement: Sync check on a stale lock

The factory SHALL behave as this line says: When the lock is stale by lines 4 to 7, `factory sync --check` exits 1 and prints the same message.

#### Scenario: Sync check on a stale lock

- **WHEN** the lock is stale by lines 4 to 7
- **THEN** `factory sync --check` exits 1 and prints the same message.

### Requirement: FACTORY_LOCK

The factory SHALL behave as this line says: When `FACTORY_LOCK` names a file, commands read their settings from that lock and make no stale check.

#### Scenario: FACTORY_LOCK

- **WHEN** `FACTORY_LOCK` names a file
- **THEN** commands read their settings from that lock and make no stale check.

### Requirement: The review reads the base commit's lock

The factory SHALL behave as this line says: When the automated review lists the tools its review may use, it reads `pr-review.commands` from the base commit's `.claude/factory.lock`, or from the base commit's `.claude/factory.yaml` when that lock has no `settings`.

#### Scenario: The review reads the base commit's lock

- **WHEN** the automated review lists the tools its review may use
- **THEN** it reads `pr-review.commands` from the base commit's `.claude/factory.lock`, or from the base commit's `.claude/factory.yaml` when that lock has no `settings`.

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

### Requirement: Other edits to .npmrc

The factory SHALL behave as this line says: When `.npmrc` changes and the names it takes do not, nothing stops.

#### Scenario: Other edits to .npmrc

- **WHEN** `.npmrc` changes and the names it takes do not
- **THEN** nothing stops.

### Requirement: The lock's presets and version

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The lock's presets and version

- **WHEN** `factory sync` writes `.claude/factory.lock`
- **THEN** The lock's `presets` holds, for each: `name`, `commit` in full, `poller`, which is `true` when its repository holds `.github/workflows/factory-poller.yml` at that commit and `false` otherwise, `settings` as its file had them, and `files`, each path with `sha256:` and its hash. `version` is the version every command there runs.

### Requirement: FACTORY_SETTINGS with presets

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: FACTORY_SETTINGS with presets

- **WHEN** `FACTORY_SETTINGS` names a file that lists presets
- **THEN** With `FACTORY_SETTINGS`, a file that lists presets stops the command: `FACTORY_SETTINGS: presets are read through the lock. Use FACTORY_LOCK`.

### Requirement: The lock records a preset's poller

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The lock records a preset's poller

- **WHEN** `factory sync` writes `.claude/factory.lock`
- **THEN** The lock records, for each preset, whether its repository holds `.github/workflows/factory-poller.yml` at the pinned commit.
