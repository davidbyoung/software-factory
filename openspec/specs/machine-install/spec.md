# machine-install Specification

## Purpose

The one install of kodor on a machine: how the `kodor` command runs the version each repository names, downloading it once, and how kodor's hooks, skills, rules, and messages name the command.

## Requirements

### Requirement: The version a repository names

kodor SHALL behave as this line says: When `kodor` runs in a repository whose `.claude/kodor.lock` names a version, it runs that version: its own code when that is the one installed on the machine, and otherwise a copy under `~/.cache/kodor/`.

#### Scenario: The version a repository names

- **WHEN** `kodor` runs in a repository whose `.claude/kodor.lock` names a version
- **THEN** it runs that version: its own code when that is the one installed on the machine, and otherwise a copy under `~/.cache/kodor/`.

### Requirement: Downloading a version

kodor SHALL behave as this line says: When that copy is not there, it prints `Downloading the kodor VERSION, which this repository names. This happens once.` on stderr, downloads it with npm, and runs it.

#### Scenario: Downloading a version

- **WHEN** that copy is not there
- **THEN** it prints `Downloading the kodor VERSION, which this repository names. This happens once.` on stderr, downloads it with npm, and runs it.

### Requirement: A version that cannot be downloaded

kodor SHALL behave as this line says: When a version cannot be downloaded, `kodor` exits 1 and prints `✗ This repository names kodor VERSION, and it could not be downloaded: ` and npm's reason.

#### Scenario: A version that cannot be downloaded

- **WHEN** a version cannot be downloaded
- **THEN** `kodor` exits 1 and prints `✗ This repository names kodor VERSION, and it could not be downloaded: ` and npm's reason.

### Requirement: No lock, or no repository

kodor SHALL behave as this line says: When the repository has no lock, or there is no repository, it runs the installed version; in kodor's own repository, the source, as today. `kodor update` starts in the installed version everywhere else.

#### Scenario: No lock, or no repository

- **WHEN** the repository has no lock, or there is no repository
- **THEN** it runs the installed version; in kodor's own repository, the source, as today. `kodor update` starts in the installed version everywhere else.

### Requirement: The hooks run the machine's factory

kodor SHALL behave as this line says: When `kodor sync` writes `.claude/settings.json` outside kodor's own repository, each hook runs `kodor` from the machine's `PATH`. Where it is not there, the hook before a command and the hook before a file read block the call, and they and the session-start hook print `kodor is not installed on this machine. Install it once: npm install -g @kodor-ai/kodor`. The other hooks do nothing there.

#### Scenario: The hooks run the machine's factory

- **WHEN** `kodor sync` writes `.claude/settings.json` outside kodor's own repository
- **THEN** each hook runs `kodor` from the machine's `PATH`. Where it is not there, the hook before a command and the hook before a file read block the call, and they and the session-start hook print `kodor is not installed on this machine. Install it once: npm install -g @kodor-ai/kodor`. The other hooks do nothing there.

### Requirement: The command's name

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The command's name

- **WHEN** a skill, an agent, a rule, a workflow, or a message of kodor's names the command
- **THEN** Every skill, agent, rule, workflow, and message of kodor's names the command as `kodor`, never `npx --no-install kodor`.

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
