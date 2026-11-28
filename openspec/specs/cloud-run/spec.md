# cloud-run Specification

## Purpose

How a run that uses AI is split into three jobs, so the AI and a sign-in to the code host are never in the same one, and how its session is confined.

## Requirements

### Requirement: Three jobs

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Three jobs

- **WHEN** a run starts a session
- **THEN** Each run that starts a session has three jobs, `prepare`, `session`, and `publish`, in that order. `session` has `packages: read` alone, for the one step that installs the default branch's dependencies, and `cache-mode: none`, and no secret but the coding agent's credential and the repository's own `secrets`. `publish` runs when `session` failed too.

### Requirement: The sandbox

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The sandbox

- **WHEN** the session's job starts the agent
- **THEN** `session` runs the agent only in its sandbox: required, with no way for a command to leave it, the credential's variable withheld from commands, hooks off, `/proc` and `/sys` unreadable to the file tools, only the hosts `builds.hosts` and the npm registry, and writes only to the work copy, the folder to hand over, and the package cache. When the sandbox cannot start, the job fails and no session runs. Docker is stopped before it starts, and a file Git LFS holds stays its pointer.

### Requirement: Where the session starts

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Where the session starts

- **WHEN** the session's job lays out its folders
- **THEN** The session starts in a copy of the default branch, from which its `CLAUDE.md`, skills, agents, and settings are read, with the work copy beside it. That copy, kodor's install, and what was handed over are read-only to it.

### Requirement: Setup before the session

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Setup before the session

- **WHEN** When the session's job prepares the repository
- **THEN** `commands.build-setup` is the default branch's, and `kodor build-setup` runs it in its copy before any step holds a credential. The work copy's own dependencies are installed by the session, in the sandbox.

### Requirement: After the session

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: After the session

- **WHEN** the session has ended
- **THEN** After the session, no step of its job runs anything from the work copy. The job hands over `build.bundle`, `request.json`, and what it left behind and why alone, each an ordinary file of at most 20 MB, and a review hands over the agent's structured answer, which no command of the session can write.

### Requirement: What a run keeps

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What a run keeps

- **WHEN** a job hands something on
- **THEN** The artifact Prepare hands over is kept one day, and what a session left seven.

### Requirement: A session that ends in an error

kodor SHALL behave as this line says: When Claude Code ends a cloud session with a result marked as an error and its result has text, the session's job prints, once the session has ended and the runner reads its commands again, `::error::Claude Code: WORDS`, where WORDS is the first line of that result, so it shows as an error on the run. With no text in the result, it prints only today's `Finished (...)` line.

#### Scenario: A session that ends in an error

- **WHEN** Claude Code ends a cloud session with a result marked as an error
- **THEN** when its result has text, the session's job prints, once the session has ended and the runner reads its commands again, `::error::Claude Code: WORDS`, where WORDS is the first line of that result. With no text in the result, it prints only today's `Finished (...)` line.

### Requirement: A refused Claude token

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A refused Claude token

- **WHEN** WORDS reads as a refusal of the credential, by the pattern `kodor init` uses to try a pasted one, and the session read `CLAUDE_CODE_OAUTH_TOKEN`
- **THEN** the line is instead `::error::Claude Code refused CLAUDE_CODE_OAUTH_TOKEN: WORDS. A Claude token lasts a year: run kodor init to store a new one.` in a repository a person owns, and `... A Claude token lasts a year: an owner of ORG runs kodor init --org to store a new one.` in one an organization owns, told from the run's event, with ORG the repository's owner.

### Requirement: A refused API key

kodor SHALL behave as this line says: When WORDS reads as a refusal and the session read `ANTHROPIC_API_KEY`, the line is `::error::Claude Code refused ANTHROPIC_API_KEY: WORDS.`

#### Scenario: A refused API key

- **WHEN** WORDS reads as a refusal and the session read `ANTHROPIC_API_KEY`
- **THEN** the line is `::error::Claude Code refused ANTHROPIC_API_KEY: WORDS.`
