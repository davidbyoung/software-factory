# ticket-credentials Specification

## Purpose

Where a ticket system that is not GitHub keeps its credential, in the repository's secrets for the workflows and in a file only its owner can read for the sessions on a machine, and how every command reads it, words its failures, and keeps a session from reading it.

## Requirements

### Requirement: The environment's credential first

The factory SHALL behave as this line says: When a ticket system declares a credential kept on the machine and every one of its names is set in the environment and not empty, each factory command that reads tickets uses the environment's values, whatever the file holds.

#### Scenario: The environment's credential first

- **WHEN** a ticket system declares a credential kept on the machine and every one of its names is set in the environment and not empty
- **THEN** each factory command that reads tickets uses the environment's values, whatever the file holds.

### Requirement: The credential from the file

The factory SHALL behave as this line says: When any of those names is unset or empty, the command reads the credential from `software-factory/credentials.yaml` under `$XDG_CONFIG_HOME` when that is set and under `~/.config` otherwise, filed under the tool's name, then the value of the setting the tool names (Fake Tickets and Jira: `tickets.site`), then each secret's name, as Proposed docs section 2 shows.

#### Scenario: The credential from the file

- **WHEN** any of those names is unset or empty
- **THEN** the command reads the credential from `software-factory/credentials.yaml` under `$XDG_CONFIG_HOME` when that is set and under `~/.config` otherwise, filed under the tool's name, then the value of the setting the tool names (Fake Tickets and Jira: `tickets.site`), then each secret's name, as Proposed docs section 2 shows.

### Requirement: No credential

The factory SHALL behave as this line says: When neither has the credential, the command prints `No LABEL credential for SITE. Set NAMES, or run: factory init` on standard error, NAMES being every one of the credential's names as "A and B" or "A, B, and C", reads no ticket, and exits 1.

#### Scenario: No credential

- **WHEN** neither has the credential
- **THEN** the command prints `No LABEL credential for SITE. Set NAMES, or run: factory init` on standard error, NAMES being every one of the credential's names as "A and B" or "A, B, and C", reads no ticket, and exits 1.

### Requirement: A file others can read

The factory SHALL behave as this line says: When the file can be read or written by anyone but its owner, the command does not read it, prints `PATH can be read by others, so it was not read. Run: chmod 600 PATH` on standard error, with PATH written from `~` when it is under the home folder, and exits 1.

#### Scenario: A file others can read

- **WHEN** the file can be read or written by anyone but its owner
- **THEN** the command does not read it, prints `PATH can be read by others, so it was not read. Run: chmod 600 PATH` on standard error, with PATH written from `~` when it is under the home folder, and exits 1.

### Requirement: A refused credential from the file

The factory SHALL behave as this line says: When the ticket system answers `401` to a call made with a credential read from the file, the command prints `LABEL refused the credential on this machine for SITE (REASON). It may have expired. Run: factory init` on standard error and exits 1, REASON being the status and its text, such as `401 Unauthorized`. No command checks the credential before its first call.

#### Scenario: A refused credential from the file

- **WHEN** the ticket system answers `401` to a call made with a credential read from the file
- **THEN** the command prints `LABEL refused the credential on this machine for SITE (REASON). It may have expired. Run: factory init` on standard error and exits 1, REASON being the status and its text, such as `401 Unauthorized`. No command checks the credential before its first call.

### Requirement: A refused credential from the environment

The factory SHALL behave as this line says: When it answers `401` to a call made with a credential read from the environment, the command prints `LABEL refused NAMES for SITE (REASON). They may have expired. Run factory init, and replace them.` on standard error, prefixed `::error::` when `GITHUB_ACTIONS` is `true`, and exits 1.

#### Scenario: A refused credential from the environment

- **WHEN** it answers `401` to a call made with a credential read from the environment
- **THEN** the command prints `LABEL refused NAMES for SITE (REASON). They may have expired. Run factory init, and replace them.` on standard error, prefixed `::error::` when `GITHUB_ACTIONS` is `true`, and exits 1.

### Requirement: The session-start hook's credential line

The factory SHALL behave as this line says: When the session-start hook would print the tickets' state and line 3, 4, 5, or 6 applies, or the file is not valid YAML, it prints that line after `## Work in progress`, prefixed `✗ `, in place of the state, and the session starts.

#### Scenario: The session-start hook's credential line

- **WHEN** the session-start hook would print the tickets' state and line 3, 4, 5, or 6 applies, or the file is not valid YAML
- **THEN** it prints that line after `## Work in progress`, prefixed `✗ `, in place of the state, and the session starts.

### Requirement: A credential is never passed on or printed

The factory SHALL behave as this line says: No factory command puts a credential's value in the environment of a process it starts, or prints it. In GitHub Actions the job's `env` holds it, as it holds `GH_TOKEN` (Decisions).

#### Scenario: A credential is never passed on or printed

- **WHEN** a factory command starts a process or prints output
- **THEN** No factory command puts a credential's value in the environment of a process it starts, or prints it. In GitHub Actions the job's `env` holds it, as it holds `GH_TOKEN` (Decisions).

### Requirement: The guard refuses the credentials file

The factory SHALL refuse a session's call that reads the credentials file, with the reason `The factory's credentials file is not for sessions to read. Its commands read it themselves: run the factory command you need, such as factory ticket view.`, and let through one that only mentions it. It SHALL do so in every repository `factory sync` writes its hooks into, whatever the ticket system, since the file also holds a person's GitHub token and coding agent's credential.

#### Scenario: The guard refuses the credentials file

- **WHEN** a session's `Bash` command has the file's path as an argument, written after a folder (`~/.config/software-factory/credentials...`, `$XDG_CONFIG_HOME/software-factory/credentials...`, or a full path) or as `software-factory/credentials.yaml`, outside a heredoc body and outside a quoted string with a space in it; or a `Read` or `Grep` call's `file_path` or `path`, or a `Glob` call's `pattern` or `path`, names it the same way
- **THEN** the guard hook refuses it with that reason; a commit message, a comment body, a heredoc, a search for the words, or Grep's pattern that only mentions the path goes through. `factory sync` writes the hook for `Read`, `Grep`, and `Glob` into `.claude/settings.json` with every ticket system, once, in place of one an earlier release wrote. Its command starts the factory only when the call's input holds `software-factory/credentials`, and lets any other call through from the shell; on a machine with no `factory` on its `PATH` it stops the call with the line that says how to install it, as the hook for `Bash` does.

### Requirement: The workflows read the ticket system's secrets

The factory SHALL write, when the ticket system in use declares secrets for the workflows, each one's name into the one more line under `secrets` of both workflow files, which passes them to the jobs that run a factory command or a session, writing a name the `.npmrc` also reads once.

#### Scenario: The workflows read the ticket system's secrets

- **WHEN** the ticket system in use declares secrets for the workflows
- **THEN** `factory sync` writes each name into the one more line under `secrets` of `.github/workflows/factory.yml` and `.github/workflows/factory-review.yml`, as it writes an `.npmrc` token's, adding only that line and writing a name the `.npmrc` also reads once.

### Requirement: The workflows unchanged with GitHub's tickets

The factory SHALL behave as this line says: With GitHub's tickets, the ticket system adds no line to either workflow file `factory sync` writes, `.github/workflows/factory.yml` and `.github/workflows/factory-review.yml`. `.claude/settings.json` is not held to this: it gains the hook on the credentials file with every ticket system.

#### Scenario: The workflows unchanged with GitHub's tickets

- **WHEN** the ticket system is GitHub's
- **THEN** With GitHub's tickets, the ticket system adds no line to either workflow file `factory sync` writes, `.github/workflows/factory.yml` and `.github/workflows/factory-review.yml`. `.claude/settings.json` is not held to this: it gains the hook on the credentials file with every ticket system.
