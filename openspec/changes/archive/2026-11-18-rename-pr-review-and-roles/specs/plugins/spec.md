## ADDED Requirements

### Requirement: The roles that take one skill

The factory SHALL behave as this line says: When `plugins.refine.refiner`, `plugins.refine.mockups`, or `plugins.test.prover` is one block naming a `skill`, `factory config check` accepts it.

#### Scenario: The roles that take one skill

- **WHEN** `plugins.refine.refiner`, `plugins.refine.mockups`, or `plugins.test.prover` is one block naming a `skill`
- **THEN** `factory config check` accepts it.

### Requirement: The wrong kind in a role

The factory SHALL behave as this line says: When a role that takes a skill names an `agent`, or one that takes an agent names a `skill`, `factory config check` fails with `.claude/factory.yaml: KEY: names a skill` or `KEY: names an agent`, KEY being the role's path, such as `plugins.build.reviewers[0]`.

#### Scenario: The wrong kind in a role

- **WHEN** a role that takes a skill names an `agent`, or one that takes an agent names a `skill`
- **THEN** `factory config check` fails with `.claude/factory.yaml: KEY: names a skill` or `KEY: names an agent`, KEY being the role's path, such as `plugins.build.reviewers[0]`.

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

## MODIFIED Requirements

### Requirement: A pattern that matches nothing

The factory SHALL behave as this line says: When a `files` pattern of any role matches no file in the repository, `factory config check` prints `warning:` with the role's path and the pattern, and still exits 0.

#### Scenario: A pattern that matches nothing

- **WHEN** a `files` pattern of any role matches no file in the repository
- **THEN** `factory config check` prints `warning:` with the role's path and the pattern, and still exits 0.

## REMOVED Requirements

### Requirement: The slots that take one skill

**Reason**: Renamed to "The roles that take one skill", for the plugin and role wording.

**Migration**: None; the behavior is unchanged.

### Requirement: The wrong kind in a slot

**Reason**: Renamed to "The wrong kind in a role", for the plugin and role wording.

**Migration**: None; the behavior is unchanged.

### Requirement: Labels or files a slot does not take

**Reason**: Renamed to "Labels or files a role does not take", for the plugin and role wording.

**Migration**: None; the behavior is unchanged.

### Requirement: A plug-in whose file is missing

**Reason**: Renamed to "A plugin whose file is missing", for the plugin and role wording.

**Migration**: None; the behavior is unchanged.

### Requirement: The plug-ins list

**Reason**: Renamed to "The plugins list", for the plugin and role wording.

**Migration**: None; the behavior is unchanged.

### Requirement: One slot's plug-ins

**Reason**: Renamed to "One role's plugins", for the plugin and role wording.

**Migration**: None; the behavior is unchanged.

### Requirement: A word that is no slot

**Reason**: Renamed to "A word that is no role", for the plugin and role wording.

**Migration**: None; the behavior is unchanged.
