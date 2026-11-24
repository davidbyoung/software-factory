# cloud-run Specification

## Purpose

How a run that uses AI is split into three jobs, so the AI and a sign-in to the code host are never in the same one, and how its session is confined.

## Requirements

### Requirement: Three jobs

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Three jobs

- **WHEN** a run starts a session
- **THEN** Each run that starts a session has three jobs, `prepare`, `session`, and `publish`, in that order. `session` has `packages: read` alone, for the one step that installs the default branch's dependencies, and `cache-mode: none`, and no secret but the coding agent's credential and the repository's own `secrets`. `publish` runs when `session` failed too.

### Requirement: The sandbox

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The sandbox

- **WHEN** the session's job starts the agent
- **THEN** `session` runs the agent only in its sandbox: required, with no way for a command to leave it, the credential's variable withheld from commands, hooks off, `/proc` and `/sys` unreadable to the file tools, only the hosts `builds.hosts` and the npm registry, and writes only to the work copy, the folder to hand over, and the package cache. When the sandbox cannot start, the job fails and no session runs. Docker is stopped before it starts, and a file Git LFS holds stays its pointer.

### Requirement: Where the session starts

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Where the session starts

- **WHEN** the session's job lays out its folders
- **THEN** The session starts in a copy of the default branch, from which its `CLAUDE.md`, skills, agents, and settings are read, with the work copy beside it. That copy, the factory's install, and what was handed over are read-only to it.

### Requirement: Setup before the session

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Setup before the session

- **WHEN** the session's job prepares the repository
- **THEN** `commands.build-setup` is the default branch's, and runs in its copy before any step holds a credential. The work copy's own dependencies are installed by the session, in the sandbox.

### Requirement: After the session

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: After the session

- **WHEN** the session has ended
- **THEN** After the session, no step of its job runs anything from the work copy. The job hands over `build.bundle`, `request.json`, and what it left behind and why alone, each an ordinary file of at most 20 MB, and a review hands over the agent's structured answer, which no command of the session can write.

### Requirement: What a run keeps

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What a run keeps

- **WHEN** a job hands something on
- **THEN** The artifact Prepare hands over is kept one day, and what a session left seven.
