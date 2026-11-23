# machine-install Specification

## Purpose

The one install of the factory on a machine: how the `factory` command runs the version each repository names, downloading it once, and how the factory's hooks, skills, rules, and messages name the command.

## Requirements

### Requirement: The version a repository names

The factory SHALL behave as this line says: When `factory` runs in a repository whose `.claude/factory.lock` names a version, it runs that version: its own code when that is the one installed on the machine, and otherwise a copy under `~/.cache/software-factory/`.

#### Scenario: The version a repository names

- **WHEN** `factory` runs in a repository whose `.claude/factory.lock` names a version
- **THEN** it runs that version: its own code when that is the one installed on the machine, and otherwise a copy under `~/.cache/software-factory/`.

### Requirement: Downloading a version

The factory SHALL behave as this line says: When that copy is not there, it prints `Downloading the factory VERSION, which this repository names. This happens once.` on stderr, downloads it with npm, and runs it.

#### Scenario: Downloading a version

- **WHEN** that copy is not there
- **THEN** it prints `Downloading the factory VERSION, which this repository names. This happens once.` on stderr, downloads it with npm, and runs it.

### Requirement: A version that cannot be downloaded

The factory SHALL behave as this line says: When the download fails, it prints `✗ This repository names the factory VERSION, and it could not be downloaded: ` and the last line of npm's that starts `npm error` and names no log file, and exits 1. A lock that names neither the installed version nor a release written `N.N.N` gets `✗ .claude/factory.lock names the factory VERSION, which is not a release. Run: factory update`.

#### Scenario: A version that cannot be downloaded

- **WHEN** the download fails
- **THEN** it prints `✗ This repository names the factory VERSION, and it could not be downloaded: ` and the last line of npm's that starts `npm error` and names no log file, and exits 1. A lock that names neither the installed version nor a release written `N.N.N` gets `✗ .claude/factory.lock names the factory VERSION, which is not a release. Run: factory update`.

### Requirement: No lock, or no repository

The factory SHALL behave as this line says: When the repository has no lock, or there is no repository, it runs the installed version; in the factory's own repository, the source, as today. `factory update` starts in the installed version everywhere else.

#### Scenario: No lock, or no repository

- **WHEN** the repository has no lock, or there is no repository
- **THEN** it runs the installed version; in the factory's own repository, the source, as today. `factory update` starts in the installed version everywhere else.

### Requirement: The hooks run the machine's factory

The factory SHALL behave as this line says: When `factory sync` writes `.claude/settings.json` outside the factory's own repository, each hook runs `factory` from the machine's `PATH`. Where it is not there, the hook before a command and the hook before a file read block the call, and they and the session-start hook print `The factory is not installed on this machine. Install it once: npm install -g @davidbyoung/software-factory`. The other hooks do nothing there.

#### Scenario: The hooks run the machine's factory

- **WHEN** `factory sync` writes `.claude/settings.json` outside the factory's own repository
- **THEN** each hook runs `factory` from the machine's `PATH`. Where it is not there, the hook before a command and the hook before a file read block the call, and they and the session-start hook print `The factory is not installed on this machine. Install it once: npm install -g @davidbyoung/software-factory`. The other hooks do nothing there.

### Requirement: The command's name

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The command's name

- **WHEN** a skill, an agent, a rule, a workflow, or a message of the factory's names the command
- **THEN** Every skill, agent, rule, workflow, and message of the factory's names the command as `factory`, never `npx --no-install factory`.
