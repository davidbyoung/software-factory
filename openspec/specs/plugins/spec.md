# plugins Specification

## Purpose

The `plugins` block of the settings, grouped by phase: what each role accepts, what is used when a role is left out, and what `kodor plugins` prints.

## Requirements

### Requirement: The roles that take one skill

kodor SHALL behave as this line says: When `plugins.refine.refiner`, `plugins.refine.mockups`, or `plugins.test.prover` is one block naming a `skill`, `kodor config check` accepts it.

#### Scenario: The roles that take one skill

- **WHEN** `plugins.refine.refiner`, `plugins.refine.mockups`, or `plugins.test.prover` is one block naming a `skill`
- **THEN** `kodor config check` accepts it.

### Requirement: Builders

kodor SHALL behave as this line says: When `plugins.build.builders` is a list of blocks, each naming a `skill` and at least one of `labels`, `kodor config check` accepts it.

#### Scenario: Builders

- **WHEN** `plugins.build.builders` is a list of blocks, each naming a `skill` and at least one of `labels`
- **THEN** `kodor config check` accepts it.

### Requirement: Build reviewers

kodor SHALL behave as this line says: When `plugins.build.reviewers` is a list of blocks, each naming an `agent` and at least one of `files`, `kodor config check` accepts it.

#### Scenario: Build reviewers

- **WHEN** `plugins.build.reviewers` is a list of blocks, each naming an `agent` and at least one of `files`
- **THEN** `kodor config check` accepts it.

### Requirement: Test reviewers

kodor SHALL behave as this line says: When `plugins.test.reviewers` is a list of blocks, each naming an `agent`, with or without `files`, `kodor config check` accepts it.

#### Scenario: Test reviewers

- **WHEN** `plugins.test.reviewers` is a list of blocks, each naming an `agent`, with or without `files`
- **THEN** `kodor config check` accepts it.

### Requirement: Resolvers

kodor SHALL behave as this line says: When `plugins.conflicts.resolvers` is a list of blocks, each naming a `skill` and at least one of `files`, `kodor config check` accepts it.

#### Scenario: Resolvers

- **WHEN** `plugins.conflicts.resolvers` is a list of blocks, each naming a `skill` and at least one of `files`
- **THEN** `kodor config check` accepts it.

### Requirement: The wrong kind in a role

kodor SHALL behave as this line says: When a role that takes a skill names an `agent`, or one that takes an agent names a `skill`, `kodor config check` fails with `.claude/kodor.yaml: KEY: names a skill` or `KEY: names an agent`, KEY being the role's path, such as `plugins.build.reviewers[0]`.

#### Scenario: The wrong kind in a role

- **WHEN** a role that takes a skill names an `agent`, or one that takes an agent names a `skill`
- **THEN** `kodor config check` fails with `.claude/kodor.yaml: KEY: names a skill` or `KEY: names an agent`, KEY being the role's path, such as `plugins.build.reviewers[0]`.

### Requirement: Missing labels or files

kodor SHALL behave as this line says: When a builder has no `labels`, or a build reviewer or a resolver has no `files`, `kodor config check` fails with `.claude/kodor.yaml: KEY.labels: is required` or `KEY.files: is required`.

#### Scenario: Missing labels or files

- **WHEN** a builder has no `labels`, or a build reviewer or a resolver has no `files`
- **THEN** `kodor config check` fails with `.claude/kodor.yaml: KEY.labels: is required` or `KEY.files: is required`.

### Requirement: Labels or files a role does not take

kodor SHALL behave as this line says: When a plugin has `labels` or `files` where its role does not take it (either one on `refiner`, `mockups`, or `prover`; `files` on a builder; `labels` on a reviewer or a resolver), `kodor config check` fails, naming that key.

#### Scenario: Labels or files a role does not take

- **WHEN** a plugin has `labels` or `files` where its role does not take it (either one on `refiner`, `mockups`, or `prover`; `files` on a builder; `labels` on a reviewer or a resolver)
- **THEN** `kodor config check` fails, naming that key.

### Requirement: A plugin whose file is missing

kodor SHALL behave as this line says: When a plugin names a skill or an agent whose file does not exist, `kodor config check` fails, naming the role's path and the missing file.

#### Scenario: A plugin whose file is missing

- **WHEN** a plugin names a skill or an agent whose file does not exist
- **THEN** `kodor config check` fails, naming the role's path and the missing file.

### Requirement: The plugins list

kodor SHALL behave as this line says: When `kodor plugins` runs, it prints one line for each plugin kodor will use, the defaults of lines 40 to 42 and 44 included: its kind, its name, its role, then its files or labels. The role is one of `refiner`, `mockups`, `builder`, `reviewer`, `prover`, `test-reviewer`, or `resolver`.

#### Scenario: The plugins list

- **WHEN** `kodor plugins` runs
- **THEN** it prints one line for each plugin kodor will use, the defaults of lines 40 to 42 and 44 included: its kind, its name, its role, then its files or labels. The role is one of `refiner`, `mockups`, `builder`, `reviewer`, `prover`, `test-reviewer`, or `resolver`.

### Requirement: One role's plugins

kodor SHALL behave as this line says: When `kodor plugins ROLE` runs, it prints only that role's lines.

#### Scenario: One role's plugins

- **WHEN** `kodor plugins ROLE` runs
- **THEN** it prints only that role's lines.

### Requirement: A word that is no role

kodor SHALL behave as this line says: When `kodor plugins ROLE` runs with a word that is no role, it prints `ROLE: must be one of refiner, mockups, builder, reviewer, prover, test-reviewer, resolver` on standard error and exits 1.

#### Scenario: A word that is no role

- **WHEN** `kodor plugins ROLE` runs with a word that is no role
- **THEN** it prints `ROLE: must be one of refiner, mockups, builder, reviewer, prover, test-reviewer, resolver` on standard error and exits 1.

### Requirement: The default refiner

kodor SHALL behave as this line says: When `plugins.refine.refiner` is not set, `kodor plugins refiner` prints `skill kodor-refine refiner`.

#### Scenario: The default refiner

- **WHEN** `plugins.refine.refiner` is not set
- **THEN** `kodor plugins refiner` prints `skill kodor-refine refiner`.

### Requirement: The default prover

kodor SHALL behave as this line says: When `plugins.test.prover` is not set, `kodor plugins prover` prints `skill kodor-mutate prover`.

#### Scenario: The default prover

- **WHEN** `plugins.test.prover` is not set
- **THEN** `kodor plugins prover` prints `skill kodor-mutate prover`.

### Requirement: The default test reviewer

kodor SHALL behave as this line says: When `plugins.test.reviewers` is not written, `kodor plugins test-reviewer` prints `agent kodor-test-reviewer test-reviewer`.

#### Scenario: The default test reviewer

- **WHEN** `plugins.test.reviewers` is not written
- **THEN** `kodor plugins test-reviewer` prints `agent kodor-test-reviewer test-reviewer`.

### Requirement: Test reviewers as written

kodor SHALL behave as this line says: When `plugins.test.reviewers` is written, `kodor plugins test-reviewer` prints exactly the agents it lists, so `kodor-test-reviewer` is printed only when listed.

#### Scenario: Test reviewers as written

- **WHEN** `plugins.test.reviewers` is written
- **THEN** `kodor plugins test-reviewer` prints exactly the agents it lists, so `kodor-test-reviewer` is printed only when listed.

### Requirement: The default mockups

kodor SHALL behave as this line says: When `plugins.refine.mockups` is not set, `site` is set, and the design skill is synced, `kodor plugins mockups` prints `skill kodor-design mockups`; with no `site` it prints nothing.

#### Scenario: The default mockups

- **WHEN** `plugins.refine.mockups` is not set, `site` is set, and the design skill is synced
- **THEN** `kodor plugins mockups` prints `skill kodor-design mockups`; with no `site` it prints nothing.

### Requirement: A pattern that matches nothing

kodor SHALL behave as this line says: When a `files` pattern of any role matches no file in the repository, `kodor config check` prints `? .claude/kodor.yaml:` with the role's path and the pattern, as its other warnings read, and still exits 0.

#### Scenario: A pattern that matches nothing

- **WHEN** a `files` pattern of any role matches no file in the repository
- **THEN** `kodor config check` prints `? .claude/kodor.yaml:` with the role's path and the pattern, as its other warnings read, and still exits 0.

### Requirement: The end-to-end reviewer is written

kodor SHALL behave as this line says: When `commands.end-to-end` is set, `kodor sync` writes `.claude/agents/kodor-e2e-reviewer.md`; when it is not set, a sync does not write it and removes one an earlier sync wrote.

#### Scenario: The end-to-end reviewer is written

- **WHEN** `commands.end-to-end` is set
- **THEN** `kodor sync` writes `.claude/agents/kodor-e2e-reviewer.md`; when it is not set, a sync does not write it and removes one an earlier sync wrote.

### Requirement: The end-to-end reviewer needs the command

kodor SHALL behave as this line says: When `plugins.test.reviewers` lists `kodor-e2e-reviewer` and `commands.end-to-end` is not set, `kodor config check` fails with `.claude/kodor.yaml: commands.end-to-end: is required to list kodor-e2e-reviewer`.

#### Scenario: The end-to-end reviewer needs the command

- **WHEN** `plugins.test.reviewers` lists `kodor-e2e-reviewer` and `commands.end-to-end` is not set
- **THEN** `kodor config check` fails with `.claude/kodor.yaml: commands.end-to-end: is required to list kodor-e2e-reviewer`.

### Requirement: A plugin a preset ships is present

kodor SHALL behave as this line says: When a plugin's agent or skill is one a preset ships, the plugin's file counts as present, and `kodor config check` doesn't report it missing.

#### Scenario: A plugin a preset ships is present

- **WHEN** a plugin's agent or skill is one a preset ships
- **THEN** the plugin's file counts as present, and `kodor config check` doesn't report it missing.
