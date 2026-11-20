# plugins Specification

## Purpose

The `plugins` block of the settings, grouped by phase: what each role accepts, what is used when a role is left out, and what `factory plugins` prints.

## Requirements

### Requirement: The roles that take one skill

The factory SHALL behave as this line says: When `plugins.refine.refiner`, `plugins.refine.mockups`, or `plugins.test.prover` is one block naming a `skill`, `factory config check` accepts it.

#### Scenario: The roles that take one skill

- **WHEN** `plugins.refine.refiner`, `plugins.refine.mockups`, or `plugins.test.prover` is one block naming a `skill`
- **THEN** `factory config check` accepts it.

### Requirement: Builders

The factory SHALL behave as this line says: When `plugins.build.builders` is a list of blocks, each naming a `skill` and at least one of `labels`, `factory config check` accepts it.

#### Scenario: Builders

- **WHEN** `plugins.build.builders` is a list of blocks, each naming a `skill` and at least one of `labels`
- **THEN** `factory config check` accepts it.

### Requirement: Build reviewers

The factory SHALL behave as this line says: When `plugins.build.reviewers` is a list of blocks, each naming an `agent` and at least one of `files`, `factory config check` accepts it.

#### Scenario: Build reviewers

- **WHEN** `plugins.build.reviewers` is a list of blocks, each naming an `agent` and at least one of `files`
- **THEN** `factory config check` accepts it.

### Requirement: Test reviewers

The factory SHALL behave as this line says: When `plugins.test.reviewers` is a list of blocks, each naming an `agent`, with or without `files`, `factory config check` accepts it.

#### Scenario: Test reviewers

- **WHEN** `plugins.test.reviewers` is a list of blocks, each naming an `agent`, with or without `files`
- **THEN** `factory config check` accepts it.

### Requirement: Resolvers

The factory SHALL behave as this line says: When `plugins.conflicts.resolvers` is a list of blocks, each naming a `skill` and at least one of `files`, `factory config check` accepts it.

#### Scenario: Resolvers

- **WHEN** `plugins.conflicts.resolvers` is a list of blocks, each naming a `skill` and at least one of `files`
- **THEN** `factory config check` accepts it.

### Requirement: The wrong kind in a role

The factory SHALL behave as this line says: When a role that takes a skill names an `agent`, or one that takes an agent names a `skill`, `factory config check` fails with `.claude/factory.yaml: KEY: names a skill` or `KEY: names an agent`, KEY being the role's path, such as `plugins.build.reviewers[0]`.

#### Scenario: The wrong kind in a role

- **WHEN** a role that takes a skill names an `agent`, or one that takes an agent names a `skill`
- **THEN** `factory config check` fails with `.claude/factory.yaml: KEY: names a skill` or `KEY: names an agent`, KEY being the role's path, such as `plugins.build.reviewers[0]`.

### Requirement: Missing labels or files

The factory SHALL behave as this line says: When a builder has no `labels`, or a build reviewer or a resolver has no `files`, `factory config check` fails with `.claude/factory.yaml: KEY.labels: is required` or `KEY.files: is required`.

#### Scenario: Missing labels or files

- **WHEN** a builder has no `labels`, or a build reviewer or a resolver has no `files`
- **THEN** `factory config check` fails with `.claude/factory.yaml: KEY.labels: is required` or `KEY.files: is required`.

### Requirement: Labels or files a role does not take

The factory SHALL behave as this line says: When a plugin has `labels` or `files` where its role does not take it (either one on `refiner`, `mockups`, or `prover`; `files` on a builder; `labels` on a reviewer or a resolver), `factory config check` fails, naming that key.

#### Scenario: Labels or files a role does not take

- **WHEN** a plugin has `labels` or `files` where its role does not take it (either one on `refiner`, `mockups`, or `prover`; `files` on a builder; `labels` on a reviewer or a resolver)
- **THEN** `factory config check` fails, naming that key.

### Requirement: A plugin whose file is missing

The factory SHALL behave as this line says: When a plugin names a skill or an agent whose file does not exist, `factory config check` fails, naming the role's path and the missing file.

#### Scenario: A plugin whose file is missing

- **WHEN** a plugin names a skill or an agent whose file does not exist
- **THEN** `factory config check` fails, naming the role's path and the missing file.

### Requirement: The plugins list

The factory SHALL behave as this line says: When `factory plugins` runs, it prints one line for each plugin the factory will use, the defaults of lines 40 to 42 and 44 included: its kind, its name, its role, then its files or labels. The role is one of `refiner`, `mockups`, `builder`, `reviewer`, `prover`, `test-reviewer`, or `resolver`.

#### Scenario: The plugins list

- **WHEN** `factory plugins` runs
- **THEN** it prints one line for each plugin the factory will use, the defaults of lines 40 to 42 and 44 included: its kind, its name, its role, then its files or labels. The role is one of `refiner`, `mockups`, `builder`, `reviewer`, `prover`, `test-reviewer`, or `resolver`.

### Requirement: One role's plugins

The factory SHALL behave as this line says: When `factory plugins ROLE` runs, it prints only that role's lines.

#### Scenario: One role's plugins

- **WHEN** `factory plugins ROLE` runs
- **THEN** it prints only that role's lines.

### Requirement: A word that is no role

The factory SHALL behave as this line says: When `factory plugins ROLE` runs with a word that is no role, it prints `ROLE: must be one of refiner, mockups, builder, reviewer, prover, test-reviewer, resolver` on standard error and exits 1.

#### Scenario: A word that is no role

- **WHEN** `factory plugins ROLE` runs with a word that is no role
- **THEN** it prints `ROLE: must be one of refiner, mockups, builder, reviewer, prover, test-reviewer, resolver` on standard error and exits 1.

### Requirement: The default refiner

The factory SHALL behave as this line says: When `plugins.refine.refiner` is not set, `factory plugins refiner` prints `skill factory-refine refiner`.

#### Scenario: The default refiner

- **WHEN** `plugins.refine.refiner` is not set
- **THEN** `factory plugins refiner` prints `skill factory-refine refiner`.

### Requirement: The default prover

The factory SHALL behave as this line says: When `plugins.test.prover` is not set, `factory plugins prover` prints `skill factory-mutate prover`.

#### Scenario: The default prover

- **WHEN** `plugins.test.prover` is not set
- **THEN** `factory plugins prover` prints `skill factory-mutate prover`.

### Requirement: The default test reviewer

The factory SHALL behave as this line says: When `plugins.test.reviewers` is not written, `factory plugins test-reviewer` prints `agent factory-test-reviewer test-reviewer`.

#### Scenario: The default test reviewer

- **WHEN** `plugins.test.reviewers` is not written
- **THEN** `factory plugins test-reviewer` prints `agent factory-test-reviewer test-reviewer`.

### Requirement: Test reviewers as written

The factory SHALL behave as this line says: When `plugins.test.reviewers` is written, `factory plugins test-reviewer` prints exactly the agents it lists, so `factory-test-reviewer` is printed only when listed.

#### Scenario: Test reviewers as written

- **WHEN** `plugins.test.reviewers` is written
- **THEN** `factory plugins test-reviewer` prints exactly the agents it lists, so `factory-test-reviewer` is printed only when listed.

### Requirement: The default mockups

The factory SHALL behave as this line says: When `plugins.refine.mockups` is not set, `site` is set, and the design skill is synced, `factory plugins mockups` prints `skill factory-design mockups`; with no `site` it prints nothing.

#### Scenario: The default mockups

- **WHEN** `plugins.refine.mockups` is not set, `site` is set, and the design skill is synced
- **THEN** `factory plugins mockups` prints `skill factory-design mockups`; with no `site` it prints nothing.

### Requirement: A pattern that matches nothing

The factory SHALL behave as this line says: When a `files` pattern of any role matches no file in the repository, `factory config check` prints `warning:` with the role's path and the pattern, and still exits 0.

#### Scenario: A pattern that matches nothing

- **WHEN** a `files` pattern of any role matches no file in the repository
- **THEN** `factory config check` prints `warning:` with the role's path and the pattern, and still exits 0.

### Requirement: The end-to-end reviewer is written

The factory SHALL behave as this line says: When `commands.end-to-end` is set, `factory sync` writes `.claude/agents/factory-e2e-reviewer.md`; when it is not set, a sync does not write it and removes one an earlier sync wrote.

#### Scenario: The end-to-end reviewer is written

- **WHEN** `commands.end-to-end` is set
- **THEN** `factory sync` writes `.claude/agents/factory-e2e-reviewer.md`; when it is not set, a sync does not write it and removes one an earlier sync wrote.

### Requirement: The end-to-end reviewer needs the command

The factory SHALL behave as this line says: When `plugins.test.reviewers` lists `factory-e2e-reviewer` and `commands.end-to-end` is not set, `factory config check` fails with `.claude/factory.yaml: commands.end-to-end: is required to list factory-e2e-reviewer`.

#### Scenario: The end-to-end reviewer needs the command

- **WHEN** `plugins.test.reviewers` lists `factory-e2e-reviewer` and `commands.end-to-end` is not set
- **THEN** `factory config check` fails with `.claude/factory.yaml: commands.end-to-end: is required to list factory-e2e-reviewer`.

### Requirement: A plugin a preset ships is present

The factory SHALL behave as this line says: When a plugin's agent or skill is one a preset ships, the plugin's file counts as present, and `factory config check` doesn't report it missing.

#### Scenario: A plugin a preset ships is present

- **WHEN** a plugin's agent or skill is one a preset ships
- **THEN** the plugin's file counts as present, and `factory config check` doesn't report it missing.
