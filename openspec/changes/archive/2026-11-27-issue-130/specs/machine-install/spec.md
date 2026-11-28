## ADDED Requirements

### Requirement: A version is downloaded once

kodor SHALL behave as this line says: When a repository's `.claude/kodor.lock` names a version not downloaded yet, `kodor` downloads `@kodor-ai/kodor` at that version into `$XDG_CACHE_HOME/kodor/`, or `~/.cache/kodor/` when it is not set, and prints `Downloading kodor VERSION, which this repository names. This happens once.`

#### Scenario: A version is downloaded once

- **WHEN** a repository's `.claude/kodor.lock` names a version not downloaded yet
- **THEN** `kodor` downloads `@kodor-ai/kodor` at that version into `$XDG_CACHE_HOME/kodor/`, or `~/.cache/kodor/` when it is not set, and prints `Downloading kodor VERSION, which this repository names. This happens once.`

### Requirement: KODOR_VERSION runs a release

kodor SHALL behave as this line says: When `KODOR_VERSION` is set to a release, that release runs for the one command, whatever the lock names.

#### Scenario: KODOR_VERSION runs a release

- **WHEN** `KODOR_VERSION` is set to a release
- **THEN** that release runs for the one command, whatever the lock names.

### Requirement: A hook on a machine without kodor

kodor SHALL behave as this line says: When a session's hook runs on a machine without `kodor`, it prints `kodor is not installed on this machine. Install it once: npm install -g @kodor-ai/kodor`.

#### Scenario: A hook on a machine without kodor

- **WHEN** a session's hook runs on a machine without `kodor`
- **THEN** it prints `kodor is not installed on this machine. Install it once: npm install -g @kodor-ai/kodor`.

## MODIFIED Requirements

### Requirement: A version that cannot be downloaded

kodor SHALL behave as this line says: When a version cannot be downloaded, `kodor` exits 1 and prints `✗ This repository names kodor VERSION, and it could not be downloaded: ` and npm's reason.

#### Scenario: A version that cannot be downloaded

- **WHEN** a version cannot be downloaded
- **THEN** `kodor` exits 1 and prints `✗ This repository names kodor VERSION, and it could not be downloaded: ` and npm's reason.
