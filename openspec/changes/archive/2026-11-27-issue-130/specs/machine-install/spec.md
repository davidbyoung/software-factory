## ADDED Requirements

### Requirement: A version is downloaded once

lunamill SHALL behave as this line says: When a repository's `.claude/lunamill.lock` names a version not downloaded yet, `lunamill` downloads `@lunamill-ai/lunamill` at that version into `$XDG_CACHE_HOME/lunamill/`, or `~/.cache/lunamill/` when it is not set, and prints `Downloading lunamill VERSION, which this repository names. This happens once.`

#### Scenario: A version is downloaded once

- **WHEN** a repository's `.claude/lunamill.lock` names a version not downloaded yet
- **THEN** `lunamill` downloads `@lunamill-ai/lunamill` at that version into `$XDG_CACHE_HOME/lunamill/`, or `~/.cache/lunamill/` when it is not set, and prints `Downloading lunamill VERSION, which this repository names. This happens once.`

### Requirement: LUNAMILL_VERSION runs a release

lunamill SHALL behave as this line says: When `LUNAMILL_VERSION` is set to a release, that release runs for the one command, whatever the lock names.

#### Scenario: LUNAMILL_VERSION runs a release

- **WHEN** `LUNAMILL_VERSION` is set to a release
- **THEN** that release runs for the one command, whatever the lock names.

### Requirement: A hook on a machine without lunamill

lunamill SHALL behave as this line says: When a session's hook runs on a machine without `lunamill`, it prints `lunamill is not installed on this machine. Install it once: npm install -g @lunamill-ai/lunamill`.

#### Scenario: A hook on a machine without lunamill

- **WHEN** a session's hook runs on a machine without `lunamill`
- **THEN** it prints `lunamill is not installed on this machine. Install it once: npm install -g @lunamill-ai/lunamill`.

## MODIFIED Requirements

### Requirement: A version that cannot be downloaded

lunamill SHALL behave as this line says: When a version cannot be downloaded, `lunamill` exits 1 and prints `✗ This repository names lunamill VERSION, and it could not be downloaded: ` and npm's reason.

#### Scenario: A version that cannot be downloaded

- **WHEN** a version cannot be downloaded
- **THEN** `lunamill` exits 1 and prints `✗ This repository names lunamill VERSION, and it could not be downloaded: ` and npm's reason.
