# settings Specification

## Purpose

What `factory config check` accepts for `builds.trigger` and `builds.poll-minutes`, the settings that decide how builds start from the board.

## Requirements

### Requirement: The github-action trigger is accepted

The factory SHALL behave as this line says: When `factory config check` reads `builds.trigger: github-action`, it accepts it.

#### Scenario: The github-action trigger is accepted

- **WHEN** `factory config check` reads `builds.trigger: github-action`
- **THEN** it accepts it.

### Requirement: The interval's default

The factory SHALL behave as this line says: When `builds.poll-minutes` is not set, it is 5.

#### Scenario: The interval's default

- **WHEN** `builds.poll-minutes` is not set
- **THEN** it is 5.

### Requirement: An interval not allowed

The factory SHALL behave as this line says: When `builds.poll-minutes` is anything but 5, 10, 15, 30, or 60, `factory config check` fails, naming the key and the values allowed.

#### Scenario: An interval not allowed

- **WHEN** `builds.poll-minutes` is anything but 5, 10, 15, 30, or 60
- **THEN** `factory config check` fails, naming the key and the values allowed.

### Requirement: An interval without the schedule

The factory SHALL behave as this line says: When `builds.poll-minutes` is set and `builds.trigger` is not `github-action`, `factory config check` fails with `builds.poll-minutes needs builds.trigger: github-action`.

#### Scenario: An interval without the schedule

- **WHEN** `builds.poll-minutes` is set and `builds.trigger` is not `github-action`
- **THEN** `factory config check` fails with `builds.poll-minutes needs builds.trigger: github-action`.

### Requirement: Version 2 is accepted

The factory SHALL behave as this line says: When `factory config check` reads `version: 2`, it accepts it.

#### Scenario: Version 2 is accepted

- **WHEN** `factory config check` reads `version: 2`
- **THEN** it accepts it.

### Requirement: Version 1 is refused

The factory SHALL behave as this line says: When `factory config check` reads `version: 1`, it fails with `.claude/factory.yaml: version: must be 2: this file is version 1, see ADDRESS`, where ADDRESS is the address of "Moving to settings version 2" in `docs/maintain/upgrade-notes.md` at the installed release.

#### Scenario: Version 1 is refused

- **WHEN** `factory config check` reads `version: 1`
- **THEN** it fails with `.claude/factory.yaml: version: must be 2: this file is version 1, see ADDRESS`, where ADDRESS is the address of "Moving to settings version 2" in `docs/maintain/upgrade-notes.md` at the installed release.

### Requirement: A moved key at the top level

The factory SHALL behave as this line says: When the settings have `before-commit` or `build-setup` at the top level, `factory config check` fails with `.claude/factory.yaml: KEY: moved to commands.KEY`.

#### Scenario: A moved key at the top level

- **WHEN** the settings have `before-commit` or `build-setup` at the top level
- **THEN** `factory config check` fails with `.claude/factory.yaml: KEY: moved to commands.KEY`.

### Requirement: Plugins written as a list

The factory SHALL behave as this line says: When `plugins` is written as a list, `factory config check` fails with `.claude/factory.yaml: plugins: must be grouped by phase: refine, build, test, conflicts`.

#### Scenario: Plugins written as a list

- **WHEN** `plugins` is written as a list
- **THEN** `factory config check` fails with `.claude/factory.yaml: plugins: must be grouped by phase: refine, build, test, conflicts`.

### Requirement: Specs written as a block

The factory SHALL behave as this line says: When `specs` is written as a block, `factory config check` accepts the keys `type`, one of `openspec` or `none`, and `check`, and still accepts `specs` written as one word.

#### Scenario: Specs written as a block

- **WHEN** `specs` is written as a block
- **THEN** `factory config check` accepts the keys `type`, one of `openspec` or `none`, and `check`, and still accepts `specs` written as one word.

### Requirement: The spec check's default

The factory SHALL behave as this line says: When `specs.type` is `openspec` and `specs.check` is not set, `specs.check` is `npx --no-install openspec validate --all --strict --no-interactive`.

#### Scenario: The spec check's default

- **WHEN** `specs.type` is `openspec` and `specs.check` is not set
- **THEN** `specs.check` is `npx --no-install openspec validate --all --strict --no-interactive`.

### Requirement: A spec check without specs

The factory SHALL behave as this line says: When `specs.check` is set and `specs.type` is not `openspec`, `factory config check` fails with `.claude/factory.yaml: specs.check needs specs.type: openspec`.

#### Scenario: A spec check without specs

- **WHEN** `specs.check` is set and `specs.type` is not `openspec`
- **THEN** `factory config check` fails with `.claude/factory.yaml: specs.check needs specs.type: openspec`.

### Requirement: Config get specs

The factory SHALL behave as this line says: When `factory config get specs` runs, it prints `openspec` or `none`, whether `specs` is one word or a block.

#### Scenario: Config get specs

- **WHEN** `factory config get specs` runs
- **THEN** it prints `openspec` or `none`, whether `specs` is one word or a block.

### Requirement: Config get the spec check

The factory SHALL behave as this line says: When `factory config get specs.check` runs, it prints the check command, or `none` when `specs.type` is `none`.

#### Scenario: Config get the spec check

- **WHEN** `factory config get specs.check` runs
- **THEN** it prints the check command, or `none` when `specs.type` is `none`.

### Requirement: The schema describes required columns

The factory SHALL behave as this line says: In `settings.schema.json`, no state under `tickets.columns` says `Default:`, and the block's description says that with a board all six states are required, from this file or a preset. The schema doesn't require them, since it reads one file and a preset can supply the block (line 5); the settings check does.

#### Scenario: The schema describes required columns

- **WHEN** `settings.schema.json` describes `tickets.columns`
- **THEN** no state under `tickets.columns` says `Default:`, and the block's description says that with a board all six states are required, from this file or a preset. The schema doesn't require them, since it reads one file and a preset can supply the block (line 5); the settings check does.

### Requirement: The hosts a session may reach

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The hosts a session may reach

- **WHEN** `.claude/factory.yaml` sets `builds.hosts`
- **THEN** `builds.hosts` is a list of host names, empty by default, and `github.com` or a host under it is refused: `.claude/factory.yaml: builds.hosts can't name GitHub: a build has no GitHub access`. A host is a name with a dot in it.

### Requirement: GitHub as a host is named with its file

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: GitHub as a host is named with its file

- **WHEN** `builds.hosts` names GitHub in `.claude/factory.yaml`
- **THEN** `factory sync`, `factory config check`, and `factory init` print `.claude/factory.yaml: builds.hosts can't name GitHub: a build has no GitHub access`.

### Requirement: One set of words for every reader

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: One set of words for every reader

- **WHEN** one bad value is read by `factory sync`, `factory config check`, `factory init`, `factory preset check`, `factory preset add`, `factory update`, `factory init --org`, and the poller
- **THEN** each prints the same words.
