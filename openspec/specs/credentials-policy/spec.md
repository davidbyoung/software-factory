# credentials-policy Specification

## Purpose

The approval policy every repository has unless it turns it off: a script that finds the lines of a change that touch a credential or widen what a workflow may do, and an agent that reads only those lines and reports a High for a person to approve.

## Requirements

### Requirement: kodor's own credentials policy

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: kodor's own credentials policy

- **WHEN** the settings have no policy named `credentials`
- **THEN** kodor's own layer, before any preset, gives one: `run: node .claude/approval-policies/credentials/find.mts`, `agent: kodor-credentials-reader`, and `files: ["**"]`, which `kodor config explain` marks `# default`.

### Requirement: Turning the credentials policy off

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Turning the credentials policy off

- **WHEN** `.claude/kodor.yaml` lists `{ name: credentials, off: true }`
- **THEN** the repository has no `credentials` policy, and `kodor config check` passes; a preset's or the repository's own policy named `credentials` replaces kodor's.

### Requirement: Writing the policy's files

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Writing the policy's files

- **WHEN** the `credentials` policy is on
- **THEN** `kodor sync` writes `.claude/approval-policies/credentials/find.mts` and `.claude/agents/kodor-credentials-reader.md` from the package, and when it is off, writes neither.

### Requirement: kodor's agent before its first sync

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: kodor's agent before its first sync

- **WHEN** `kodor config check` reads settings whose agent is kodor's own and its file isn't written yet, as on the first sync after an update
- **THEN** it passes, as it does for a preset's files.

### Requirement: What find.mts leaves out

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What find.mts leaves out

- **WHEN** `find.mts` reads a change
- **THEN** it leaves out files under a folder named `test`, `tests`, `spec`, `specs`, or `docs` at any depth, and `*.test.*` and `*.spec.*` files.

### Requirement: A new credential

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A new credential

- **WHEN** an added line names a credential, an uppercase whole word matching `[A-Z][A-Z0-9_]*_(TOKEN|SECRET|PASSWORD|KEY|PAT|AUTH|CREDENTIALS?)` other than `GITHUB_TOKEN`, that the default branch's files outside docs and tests don't have as a whole word
- **THEN** it is a finding titled `A new credential: NAME`.

### Requirement: A secret passed to a workflow

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A secret passed to a workflow

- **WHEN** an added line in a file under `.github/workflows/` passes a secret, as `secrets.NAME` other than `GITHUB_TOKEN`, `secrets['NAME']`, `toJSON(secrets)`, or `secrets: inherit`
- **THEN** it is a finding titled `Passes a secret: NAME`, or `Passes every secret` for the last two.

### Requirement: Write access for a workflow

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Write access for a workflow

- **WHEN** an added line in a file under `.github/workflows/` gives write access, as `NAME: write` quoted or not, in an inline map, or `write-all`
- **THEN** it is a finding titled `Write access: TEXT`.

### Requirement: A workflow new to the repository

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A workflow new to the repository

- **WHEN** the change adds a file under `.github/workflows/`, or renames one into it
- **THEN** it is a finding titled `A workflow new to the repository`, on its first line.

### Requirement: A pull_request_target trigger

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A pull_request_target trigger

- **WHEN** an added line in a file under `.github/workflows/` adds a `pull_request_target` trigger
- **THEN** it is a finding titled `A pull_request_target trigger`.

### Requirement: Nothing found

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Nothing found

- **WHEN** `find.mts` finds none of these
- **THEN** it answers `{ "findings": [] }`, and the status reads `Nothing to approve`.

### Requirement: The credentials reader

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The credentials reader

- **WHEN** `kodor-credentials-reader` reads what `find.mts` found
- **THEN** its instructions are round 3's tested wording, told that it has the default branch's code and the change's diff and to report only a High, and it runs with Opus.

### Requirement: A small change takes no new step

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A small change takes no new step

- **WHEN** a pull request changes one sentence of a docs page
- **THEN** the `credentials` policy runs no agent, and a session building it takes no step it didn't take before.
