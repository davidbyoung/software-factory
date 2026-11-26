## ADDED Requirements

### Requirement: The factory's own credentials policy

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The factory's own credentials policy

- **WHEN** the settings have no policy named `credentials`
- **THEN** the factory's own layer, before any preset, gives one: `run: node .claude/approval-policies/credentials/find.mts`, `agent: factory-credentials-reader`, and `files: ["**"]`, which `factory config explain` marks `# default`.

### Requirement: Turning the credentials policy off

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Turning the credentials policy off

- **WHEN** `.claude/factory.yaml` lists `{ name: credentials, off: true }`
- **THEN** the repository has no `credentials` policy, and `factory config check` passes; a preset's or the repository's own policy named `credentials` replaces the factory's.

### Requirement: Writing the policy's files

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Writing the policy's files

- **WHEN** the `credentials` policy is on
- **THEN** `factory sync` writes `.claude/approval-policies/credentials/find.mts` and `.claude/agents/factory-credentials-reader.md` from the package, and when it is off, writes neither.

### Requirement: The factory's agent before its first sync

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The factory's agent before its first sync

- **WHEN** `factory config check` reads settings whose agent is the factory's own and its file isn't written yet, as on the first sync after an update
- **THEN** it passes, as it does for a preset's files.

### Requirement: What find.mts leaves out

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What find.mts leaves out

- **WHEN** `find.mts` reads a change
- **THEN** it leaves out files under a folder named `test`, `tests`, `spec`, `specs`, or `docs` at any depth, and `*.test.*` and `*.spec.*` files.

### Requirement: A new credential

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A new credential

- **WHEN** an added line names a credential, an uppercase whole word matching `[A-Z][A-Z0-9_]*_(TOKEN|SECRET|PASSWORD|KEY|PAT|AUTH|CREDENTIALS?)` other than `GITHUB_TOKEN`, that the default branch's files outside docs and tests don't have as a whole word
- **THEN** it is a finding titled `A new credential: NAME`.

### Requirement: A secret passed to a workflow

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A secret passed to a workflow

- **WHEN** an added line in a file under `.github/workflows/` passes a secret, as `secrets.NAME` other than `GITHUB_TOKEN`, `secrets['NAME']`, `toJSON(secrets)`, or `secrets: inherit`
- **THEN** it is a finding titled `Passes a secret: NAME`, or `Passes every secret` for the last two.

### Requirement: Write access for a workflow

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Write access for a workflow

- **WHEN** an added line in a file under `.github/workflows/` gives write access, as `NAME: write` quoted or not, in an inline map, or `write-all`
- **THEN** it is a finding titled `Write access: TEXT`.

### Requirement: A workflow new to the repository

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A workflow new to the repository

- **WHEN** the change adds a file under `.github/workflows/`, or renames one into it
- **THEN** it is a finding titled `A workflow new to the repository`, on its first line.

### Requirement: A pull_request_target trigger

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A pull_request_target trigger

- **WHEN** an added line in a file under `.github/workflows/` adds a `pull_request_target` trigger
- **THEN** it is a finding titled `A pull_request_target trigger`.

### Requirement: Nothing found

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Nothing found

- **WHEN** `find.mts` finds none of these
- **THEN** it answers `{ "findings": [] }`, and the status reads `Nothing to approve`.

### Requirement: The credentials reader

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The credentials reader

- **WHEN** `factory-credentials-reader` reads what `find.mts` found
- **THEN** its instructions are round 3's tested wording, told that it has the default branch's code and the change's diff and to report only a High, and it runs with Opus.

### Requirement: A small change takes no new step

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A small change takes no new step

- **WHEN** a pull request changes one sentence of a docs page
- **THEN** the `credentials` policy runs no agent, and a session building it takes no step it didn't take before.
