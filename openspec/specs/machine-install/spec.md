# machine-install Specification

## Purpose

The one install of lunamill on a machine: how the `lunamill` command runs the version each repository names, downloading it once, and how lunamill's hooks, skills, rules, and messages name the command.

## Requirements

### Requirement: The version a repository names

lunamill SHALL behave as this line says: When `lunamill` runs in a repository whose `.claude/lunamill.lock` names a version, it runs that version: its own code when that is the one installed on the machine, and otherwise a copy under `~/.cache/lunamill/`.

#### Scenario: The version a repository names

- **WHEN** `lunamill` runs in a repository whose `.claude/lunamill.lock` names a version
- **THEN** it runs that version: its own code when that is the one installed on the machine, and otherwise a copy under `~/.cache/lunamill/`.

### Requirement: Downloading a version

lunamill SHALL behave as this line says: When that copy is not there, it prints `Downloading the lunamill VERSION, which this repository names. This happens once.` on stderr, downloads it with npm, and runs it.

#### Scenario: Downloading a version

- **WHEN** that copy is not there
- **THEN** it prints `Downloading the lunamill VERSION, which this repository names. This happens once.` on stderr, downloads it with npm, and runs it.

### Requirement: A version that cannot be downloaded

lunamill SHALL behave as this line says: When a version cannot be downloaded, `lunamill` exits 1 and prints `✗ This repository names lunamill VERSION, and it could not be downloaded: ` and npm's reason.

#### Scenario: A version that cannot be downloaded

- **WHEN** a version cannot be downloaded
- **THEN** `lunamill` exits 1 and prints `✗ This repository names lunamill VERSION, and it could not be downloaded: ` and npm's reason.

### Requirement: No lock, or no repository

lunamill SHALL behave as this line says: When the repository has no lock, or there is no repository, it runs the installed version; in lunamill's own repository, the source, as today. `lunamill update` starts in the installed version everywhere else.

#### Scenario: No lock, or no repository

- **WHEN** the repository has no lock, or there is no repository
- **THEN** it runs the installed version; in lunamill's own repository, the source, as today. `lunamill update` starts in the installed version everywhere else.

### Requirement: The hooks run the machine's factory

lunamill SHALL behave as this line says: When `lunamill sync` writes `.claude/settings.json` outside lunamill's own repository, each hook runs `lunamill` from the machine's `PATH`. Where it is not there, the hook before a command and the hook before a file read block the call, and they and the session-start hook print `lunamill is not installed on this machine. Install it once: npm install -g @lunamill-ai/lunamill`. The other hooks do nothing there.

#### Scenario: The hooks run the machine's factory

- **WHEN** `lunamill sync` writes `.claude/settings.json` outside lunamill's own repository
- **THEN** each hook runs `lunamill` from the machine's `PATH`. Where it is not there, the hook before a command and the hook before a file read block the call, and they and the session-start hook print `lunamill is not installed on this machine. Install it once: npm install -g @lunamill-ai/lunamill`. The other hooks do nothing there.

### Requirement: The command's name

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The command's name

- **WHEN** a skill, an agent, a rule, a workflow, or a message of lunamill's names the command
- **THEN** Every skill, agent, rule, workflow, and message of lunamill's names the command as `lunamill`, never `npx --no-install lunamill`.

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
