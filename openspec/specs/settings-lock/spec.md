# settings-lock Specification

## Purpose

The settings in effect, which `factory sync` resolves into `.claude/factory.lock` and every other command reads, and how a stale lock is caught.

## Requirements

### Requirement: The lock's keys

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The lock's keys

- **WHEN** `factory sync` runs
- **THEN** `.claude/factory.lock` holds, in this order: `version`, the factory's version; `presets`, a list with each preset's `name` and installed `version`, empty when there are none; `settings-hash`, `sha256:` and the hex SHA-256 of `.claude/factory.yaml` and `.claude/factory.choices.yaml`; `settings`, a block; `overridden`, for each setting, list item, and file whose value in effect replaced another layer's, each other layer's name and value; and `files`.

### Requirement: The lock's settings block

The factory SHALL behave as this line says: When `factory sync` runs, the lock's `settings` block holds every setting in effect, defaults included, as the lines `factory config explain` prints, each indented two spaces under `settings:`.

#### Scenario: The lock's settings block

- **WHEN** `factory sync` runs
- **THEN** the lock's `settings` block holds every setting in effect, defaults included, as the lines `factory config explain` prints, each indented two spaces under `settings:`.

### Requirement: Commands read the lock

The factory SHALL behave as this line says: When any command reads the settings, it reads the lock's `settings`, never `.claude/factory.yaml` or a preset's file. `factory init`, `sync`, `config check`, `remove`, `doctor`, and the `preset` commands are the exceptions: they read the files the lock is made from.

#### Scenario: Commands read the lock

- **WHEN** any command reads the settings
- **THEN** it reads the lock's `settings`, never `.claude/factory.yaml` or a preset's file. `factory init`, `sync`, `config check`, `remove`, `doctor`, and the `preset` commands are the exceptions: they read the files the lock is made from.

### Requirement: A changed settings file stops a command

The factory SHALL behave as this line says: When `.claude/factory.yaml` has changed since the lock's `settings-hash` was written, every command that reads the settings prints `.claude/factory.yaml changed since the last sync. Run: npx --no-install factory sync` on standard error and exits 1. A change to `.claude/factory.choices.yaml` names that file instead. The permission and ticket-text hooks read no settings, so a stale lock never stops them.

#### Scenario: A changed settings file stops a command

- **WHEN** `.claude/factory.yaml` has changed since the lock's `settings-hash` was written
- **THEN** every command that reads the settings prints `.claude/factory.yaml changed since the last sync. Run: npx --no-install factory sync` on standard error and exits 1. A change to `.claude/factory.choices.yaml` names that file instead. The permission and ticket-text hooks read no settings, so a stale lock never stops them.

### Requirement: A preset at another version

The factory SHALL behave as this line says: When a preset's installed version differs from the lock's, those commands print `NAME is V1 in node_modules but V2 in .claude/factory.lock. Run: npx --no-install factory sync` and exit 1, or end it `Run: npm ci` when V1 is the older.

#### Scenario: A preset at another version

- **WHEN** a preset's installed version differs from the lock's
- **THEN** those commands print `NAME is V1 in node_modules but V2 in .claude/factory.lock. Run: npx --no-install factory sync` and exit 1, or end it `Run: npm ci` when V1 is the older.

### Requirement: An unreadable lock

The factory SHALL behave as this line says: When `.claude/factory.lock` can't be read as YAML, as a merge conflict leaves it, those commands print `.claude/factory.lock can't be read. Run: npx --no-install factory sync` and exit 1, and `factory sync` reads the files each side lists.

#### Scenario: An unreadable lock

- **WHEN** `.claude/factory.lock` can't be read as YAML, as a merge conflict leaves it
- **THEN** those commands print `.claude/factory.lock can't be read. Run: npx --no-install factory sync` and exit 1, and `factory sync` reads the files each side lists.

### Requirement: A preset not installed

The factory SHALL behave as this line says: When a preset the lock lists is not installed, those commands print `NAME is in .claude/factory.lock but not installed. Run: npm ci` and exit 1.

#### Scenario: A preset not installed

- **WHEN** a preset the lock lists is not installed
- **THEN** those commands print `NAME is in .claude/factory.lock but not installed. Run: npm ci` and exit 1.

### Requirement: A lock from an earlier release

The factory SHALL behave as this line says: When `.claude/factory.lock` has no `settings`, as a lock from an earlier release has none, those commands print `.claude/factory.lock is from an earlier version of the factory. Run: npx --no-install factory sync` and exit 1.

#### Scenario: A lock from an earlier release

- **WHEN** `.claude/factory.lock` has no `settings`
- **THEN** as a lock from an earlier release has none, those commands print `.claude/factory.lock is from an earlier version of the factory. Run: npx --no-install factory sync` and exit 1.

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

### Requirement: FACTORY_SETTINGS

The factory SHALL behave as this line says: When `FACTORY_SETTINGS` names a file, commands read that settings file and resolve its presets from `node_modules`, with no lock and no stale check, as they read that file alone today.

#### Scenario: FACTORY_SETTINGS

- **WHEN** `FACTORY_SETTINGS` names a file
- **THEN** commands read that settings file and resolve its presets from `node_modules`, with no lock and no stale check, as they read that file alone today.

### Requirement: The review reads the base commit's lock

The factory SHALL behave as this line says: When the automated review lists the tools its review may use, it reads `pr-review.commands` from the base commit's `.claude/factory.lock`, or from the base commit's `.claude/factory.yaml` when that lock has no `settings`.

#### Scenario: The review reads the base commit's lock

- **WHEN** the automated review lists the tools its review may use
- **THEN** it reads `pr-review.commands` from the base commit's `.claude/factory.lock`, or from the base commit's `.claude/factory.yaml` when that lock has no `settings`.

### Requirement: Preset updates never merge themselves

The factory SHALL behave as this line says: When `factory sync` runs with presets, the dependency auto-merge workflow it writes leaves auto-merge off for a Dependabot pull request that updates any of their packages, as it does for the factory's own.

#### Scenario: Preset updates never merge themselves

- **WHEN** `factory sync` runs with presets
- **THEN** the dependency auto-merge workflow it writes leaves auto-merge off for a Dependabot pull request that updates any of their packages, as it does for the factory's own.

### Requirement: A missing lock

The factory SHALL behave as this line says: When `.claude/factory.lock` doesn't exist, the commands of line 4 print `.claude/factory.lock is missing. Run: npx --no-install factory sync` and exit 1.

#### Scenario: A missing lock

- **WHEN** `.claude/factory.lock` doesn't exist
- **THEN** the commands of line 4 print `.claude/factory.lock is missing. Run: npx --no-install factory sync` and exit 1.

### Requirement: A listed preset not installed at sync

The factory SHALL behave as this line says: When `factory sync` or `factory config check` finds a listed preset's package not installed, it prints `NAME: not installed. Run: npm ci` and exits 1. Line 29 is for a package that is installed.

#### Scenario: A listed preset not installed at sync

- **WHEN** `factory sync` or `factory config check` finds a listed preset's package not installed
- **THEN** it prints `NAME: not installed. Run: npm ci` and exits 1. Line 29 is for a package that is installed.
