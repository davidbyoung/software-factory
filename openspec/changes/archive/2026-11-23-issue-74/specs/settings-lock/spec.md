## ADDED Requirements

### Requirement: The lock records a preset's poller

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The lock records a preset's poller

- **WHEN** `factory sync` writes `.claude/factory.lock`
- **THEN** The lock records, for each preset, whether its repository holds `.github/workflows/factory-poller.yml` at the pinned commit.

## MODIFIED Requirements

### Requirement: The lock's presets and version

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The lock's presets and version

- **WHEN** `factory sync` writes `.claude/factory.lock`
- **THEN** The lock's `presets` holds, for each: `name`, `commit` in full, `poller`, which is `true` when its repository holds `.github/workflows/factory-poller.yml` at that commit and `false` otherwise, `settings` as its file had them, and `files`, each path with `sha256:` and its hash. `version` is the version every command there runs.

### Requirement: Commands read the lock

The factory SHALL behave as this line says: When any command reads the settings, it reads the lock's `settings`, never `.claude/factory.yaml` or a preset's file. `factory init`, `sync`, `config check`, `remove`, `doctor`, and the `preset` commands are the exceptions: they read the files the lock is made from. Two more read one file each: a command that looks up the default branch reads the `repository` line from `.claude/factory.yaml`, and `factory poller --once --preset FILE` reads FILE.

#### Scenario: Commands read the lock

- **WHEN** any command reads the settings
- **THEN** it reads the lock's `settings`, never `.claude/factory.yaml` or a preset's file. `factory init`, `sync`, `config check`, `remove`, `doctor`, and the `preset` commands are the exceptions: they read the files the lock is made from. Two more read one file each: a command that looks up the default branch reads the `repository` line from `.claude/factory.yaml`, and `factory poller --once --preset FILE` reads FILE.
