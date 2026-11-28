# plugins Specification

## Purpose

The `plugins` block of the settings, grouped by phase: what each role accepts, what is used when a role is left out, and what `lunamill plugins` prints.

## Requirements

### Requirement: The roles that take one skill

lunamill SHALL behave as this line says: When `plugins.refine.refiner`, `plugins.refine.mockups`, or `plugins.test.prover` is one block naming a `skill`, `lunamill config check` accepts it.

#### Scenario: The roles that take one skill

- **WHEN** `plugins.refine.refiner`, `plugins.refine.mockups`, or `plugins.test.prover` is one block naming a `skill`
- **THEN** `lunamill config check` accepts it.

### Requirement: Builders

lunamill SHALL behave as this line says: When `plugins.build.builders` is a list of blocks, each naming a `skill` and at least one of `labels`, `lunamill config check` accepts it.

#### Scenario: Builders

- **WHEN** `plugins.build.builders` is a list of blocks, each naming a `skill` and at least one of `labels`
- **THEN** `lunamill config check` accepts it.

### Requirement: Build reviewers

lunamill SHALL behave as this line says: When `plugins.build.reviewers` is a list of blocks, each naming an `agent` and at least one of `files`, `lunamill config check` accepts it.

#### Scenario: Build reviewers

- **WHEN** `plugins.build.reviewers` is a list of blocks, each naming an `agent` and at least one of `files`
- **THEN** `lunamill config check` accepts it.

### Requirement: Test reviewers

lunamill SHALL behave as this line says: When `plugins.test.reviewers` is a list of blocks, each naming an `agent`, with or without `files`, `lunamill config check` accepts it.

#### Scenario: Test reviewers

- **WHEN** `plugins.test.reviewers` is a list of blocks, each naming an `agent`, with or without `files`
- **THEN** `lunamill config check` accepts it.

### Requirement: Resolvers

lunamill SHALL behave as this line says: When `plugins.conflicts.resolvers` is a list of blocks, each naming a `skill` and at least one of `files`, `lunamill config check` accepts it.

#### Scenario: Resolvers

- **WHEN** `plugins.conflicts.resolvers` is a list of blocks, each naming a `skill` and at least one of `files`
- **THEN** `lunamill config check` accepts it.

### Requirement: The wrong kind in a role

lunamill SHALL behave as this line says: When a role that takes a skill names an `agent`, or one that takes an agent names a `skill`, `lunamill config check` fails with `.claude/lunamill.yaml: KEY: names a skill` or `KEY: names an agent`, KEY being the role's path, such as `plugins.build.reviewers[0]`.

#### Scenario: The wrong kind in a role

- **WHEN** a role that takes a skill names an `agent`, or one that takes an agent names a `skill`
- **THEN** `lunamill config check` fails with `.claude/lunamill.yaml: KEY: names a skill` or `KEY: names an agent`, KEY being the role's path, such as `plugins.build.reviewers[0]`.

### Requirement: Missing labels or files

lunamill SHALL behave as this line says: When a builder has no `labels`, or a build reviewer or a resolver has no `files`, `lunamill config check` fails with `.claude/lunamill.yaml: KEY.labels: is required` or `KEY.files: is required`.

#### Scenario: Missing labels or files

- **WHEN** a builder has no `labels`, or a build reviewer or a resolver has no `files`
- **THEN** `lunamill config check` fails with `.claude/lunamill.yaml: KEY.labels: is required` or `KEY.files: is required`.

### Requirement: Labels or files a role does not take

lunamill SHALL behave as this line says: When a plugin has `labels` or `files` where its role does not take it (either one on `refiner`, `mockups`, or `prover`; `files` on a builder; `labels` on a reviewer or a resolver), `lunamill config check` fails, naming that key.

#### Scenario: Labels or files a role does not take

- **WHEN** a plugin has `labels` or `files` where its role does not take it (either one on `refiner`, `mockups`, or `prover`; `files` on a builder; `labels` on a reviewer or a resolver)
- **THEN** `lunamill config check` fails, naming that key.

### Requirement: A plugin whose file is missing

lunamill SHALL behave as this line says: When a plugin names a skill or an agent whose file does not exist, `lunamill config check` fails, naming the role's path and the missing file.

#### Scenario: A plugin whose file is missing

- **WHEN** a plugin names a skill or an agent whose file does not exist
- **THEN** `lunamill config check` fails, naming the role's path and the missing file.

### Requirement: The plugins list

lunamill SHALL behave as this line says: When `lunamill plugins` runs, it prints one line for each plugin lunamill will use, the defaults of lines 40 to 42 and 44 included: its kind, its name, its role, then its files or labels. The role is one of `refiner`, `mockups`, `builder`, `reviewer`, `prover`, `test-reviewer`, or `resolver`.

#### Scenario: The plugins list

- **WHEN** `lunamill plugins` runs
- **THEN** it prints one line for each plugin lunamill will use, the defaults of lines 40 to 42 and 44 included: its kind, its name, its role, then its files or labels. The role is one of `refiner`, `mockups`, `builder`, `reviewer`, `prover`, `test-reviewer`, or `resolver`.

### Requirement: One role's plugins

lunamill SHALL behave as this line says: When `lunamill plugins ROLE` runs, it prints only that role's lines.

#### Scenario: One role's plugins

- **WHEN** `lunamill plugins ROLE` runs
- **THEN** it prints only that role's lines.

### Requirement: A word that is no role

lunamill SHALL behave as this line says: When `lunamill plugins ROLE` runs with a word that is no role, it prints `ROLE: must be one of refiner, mockups, builder, reviewer, prover, test-reviewer, resolver` on standard error and exits 1.

#### Scenario: A word that is no role

- **WHEN** `lunamill plugins ROLE` runs with a word that is no role
- **THEN** it prints `ROLE: must be one of refiner, mockups, builder, reviewer, prover, test-reviewer, resolver` on standard error and exits 1.

### Requirement: The default refiner

lunamill SHALL behave as this line says: When `plugins.refine.refiner` is not set, `lunamill plugins refiner` prints `skill lunamill-refine refiner`.

#### Scenario: The default refiner

- **WHEN** `plugins.refine.refiner` is not set
- **THEN** `lunamill plugins refiner` prints `skill lunamill-refine refiner`.

### Requirement: The default prover

lunamill SHALL behave as this line says: When `plugins.test.prover` is not set, `lunamill plugins prover` prints `skill lunamill-mutate prover`.

#### Scenario: The default prover

- **WHEN** `plugins.test.prover` is not set
- **THEN** `lunamill plugins prover` prints `skill lunamill-mutate prover`.

### Requirement: The default test reviewer

lunamill SHALL behave as this line says: When `plugins.test.reviewers` is not written, `lunamill plugins test-reviewer` prints `agent lunamill-test-reviewer test-reviewer`.

#### Scenario: The default test reviewer

- **WHEN** `plugins.test.reviewers` is not written
- **THEN** `lunamill plugins test-reviewer` prints `agent lunamill-test-reviewer test-reviewer`.

### Requirement: Test reviewers as written

lunamill SHALL behave as this line says: When `plugins.test.reviewers` is written, `lunamill plugins test-reviewer` prints exactly the agents it lists, so `lunamill-test-reviewer` is printed only when listed.

#### Scenario: Test reviewers as written

- **WHEN** `plugins.test.reviewers` is written
- **THEN** `lunamill plugins test-reviewer` prints exactly the agents it lists, so `lunamill-test-reviewer` is printed only when listed.

### Requirement: The default mockups

lunamill SHALL behave as this line says: When `plugins.refine.mockups` is not set, `site` is set, and the design skill is synced, `lunamill plugins mockups` prints `skill lunamill-design mockups`; with no `site` it prints nothing.

#### Scenario: The default mockups

- **WHEN** `plugins.refine.mockups` is not set, `site` is set, and the design skill is synced
- **THEN** `lunamill plugins mockups` prints `skill lunamill-design mockups`; with no `site` it prints nothing.

### Requirement: A pattern that matches nothing

lunamill SHALL behave as this line says: When a `files` pattern of any role matches no file in the repository, `lunamill config check` prints `? .claude/lunamill.yaml:` with the role's path and the pattern, as its other warnings read, and still exits 0.

#### Scenario: A pattern that matches nothing

- **WHEN** a `files` pattern of any role matches no file in the repository
- **THEN** `lunamill config check` prints `? .claude/lunamill.yaml:` with the role's path and the pattern, as its other warnings read, and still exits 0.

### Requirement: The end-to-end reviewer is written

lunamill SHALL behave as this line says: When `commands.end-to-end` is set, `lunamill sync` writes `.claude/agents/lunamill-e2e-reviewer.md`; when it is not set, a sync does not write it and removes one an earlier sync wrote.

#### Scenario: The end-to-end reviewer is written

- **WHEN** `commands.end-to-end` is set
- **THEN** `lunamill sync` writes `.claude/agents/lunamill-e2e-reviewer.md`; when it is not set, a sync does not write it and removes one an earlier sync wrote.

### Requirement: The end-to-end reviewer needs the command

lunamill SHALL behave as this line says: When `plugins.test.reviewers` lists `lunamill-e2e-reviewer` and `commands.end-to-end` is not set, `lunamill config check` fails with `.claude/lunamill.yaml: commands.end-to-end: is required to list lunamill-e2e-reviewer`.

#### Scenario: The end-to-end reviewer needs the command

- **WHEN** `plugins.test.reviewers` lists `lunamill-e2e-reviewer` and `commands.end-to-end` is not set
- **THEN** `lunamill config check` fails with `.claude/lunamill.yaml: commands.end-to-end: is required to list lunamill-e2e-reviewer`.

### Requirement: A plugin a preset ships is present

lunamill SHALL behave as this line says: When a plugin's agent or skill is one a preset ships, the plugin's file counts as present, and `lunamill config check` doesn't report it missing.

#### Scenario: A plugin a preset ships is present

- **WHEN** a plugin's agent or skill is one a preset ships
- **THEN** the plugin's file counts as present, and `lunamill config check` doesn't report it missing.
