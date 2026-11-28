# settings Specification

## Purpose

What `lunamill config check` accepts for `builds.trigger` and `builds.poll-minutes`, the settings that decide how builds start from the board.

## Requirements

### Requirement: The github-action trigger is accepted

lunamill SHALL behave as this line says: When `lunamill config check` reads `builds.trigger: github-action`, it accepts it.

#### Scenario: The github-action trigger is accepted

- **WHEN** `lunamill config check` reads `builds.trigger: github-action`
- **THEN** it accepts it.

### Requirement: The interval's default

lunamill SHALL behave as this line says: When `builds.poll-minutes` is not set, it is 5.

#### Scenario: The interval's default

- **WHEN** `builds.poll-minutes` is not set
- **THEN** it is 5.

### Requirement: An interval not allowed

lunamill SHALL behave as this line says: When `builds.poll-minutes` is anything but 5, 10, 15, 30, or 60, `lunamill config check` fails, naming the key and the values allowed.

#### Scenario: An interval not allowed

- **WHEN** `builds.poll-minutes` is anything but 5, 10, 15, 30, or 60
- **THEN** `lunamill config check` fails, naming the key and the values allowed.

### Requirement: An interval without the schedule

lunamill SHALL behave as this line says: When `builds.poll-minutes` is set and `builds.trigger` is not `github-action`, `lunamill config check` fails with `builds.poll-minutes needs builds.trigger: github-action`.

#### Scenario: An interval without the schedule

- **WHEN** `builds.poll-minutes` is set and `builds.trigger` is not `github-action`
- **THEN** `lunamill config check` fails with `builds.poll-minutes needs builds.trigger: github-action`.

### Requirement: A moved key at the top level

lunamill SHALL behave as this line says: When the settings have `before-commit` or `build-setup` at the top level, `lunamill config check` fails with `.claude/lunamill.yaml: KEY: moved to commands.KEY`.

#### Scenario: A moved key at the top level

- **WHEN** the settings have `before-commit` or `build-setup` at the top level
- **THEN** `lunamill config check` fails with `.claude/lunamill.yaml: KEY: moved to commands.KEY`.

### Requirement: Plugins written as a list

lunamill SHALL behave as this line says: When `plugins` is written as a list, `lunamill config check` fails with `.claude/lunamill.yaml: plugins: must be grouped by phase: refine, build, test, conflicts`.

#### Scenario: Plugins written as a list

- **WHEN** `plugins` is written as a list
- **THEN** `lunamill config check` fails with `.claude/lunamill.yaml: plugins: must be grouped by phase: refine, build, test, conflicts`.

### Requirement: Specs written as a block

lunamill SHALL behave as this line says: When `specs` is written as a block, `lunamill config check` accepts the keys `type`, one of `openspec` or `none`, and `check`, and still accepts `specs` written as one word.

#### Scenario: Specs written as a block

- **WHEN** `specs` is written as a block
- **THEN** `lunamill config check` accepts the keys `type`, one of `openspec` or `none`, and `check`, and still accepts `specs` written as one word.

### Requirement: The spec check's default

lunamill SHALL behave as this line says: When `specs.type` is `openspec` and `specs.check` is not set, `specs.check` is `npx --no-install openspec validate --all --strict --no-interactive`.

#### Scenario: The spec check's default

- **WHEN** `specs.type` is `openspec` and `specs.check` is not set
- **THEN** `specs.check` is `npx --no-install openspec validate --all --strict --no-interactive`.

### Requirement: A spec check without specs

lunamill SHALL behave as this line says: When `specs.check` is set and `specs.type` is not `openspec`, `lunamill config check` fails with `.claude/lunamill.yaml: specs.check needs specs.type: openspec`.

#### Scenario: A spec check without specs

- **WHEN** `specs.check` is set and `specs.type` is not `openspec`
- **THEN** `lunamill config check` fails with `.claude/lunamill.yaml: specs.check needs specs.type: openspec`.

### Requirement: Config get specs

lunamill SHALL behave as this line says: When `lunamill config get specs` runs, it prints `openspec` or `none`, whether `specs` is one word or a block.

#### Scenario: Config get specs

- **WHEN** `lunamill config get specs` runs
- **THEN** it prints `openspec` or `none`, whether `specs` is one word or a block.

### Requirement: Config get the spec check

lunamill SHALL behave as this line says: When `lunamill config get specs.check` runs, it prints the check command, or `none` when `specs.type` is `none`.

#### Scenario: Config get the spec check

- **WHEN** `lunamill config get specs.check` runs
- **THEN** it prints the check command, or `none` when `specs.type` is `none`.

### Requirement: The schema describes required columns

lunamill SHALL behave as this line says: In `settings.schema.json`, no state under `tickets.columns` says `Default:`, and the block's description says that with a board all six states are required, from this file or a preset. The schema doesn't require them, since it reads one file and a preset can supply the block (line 5); the settings check does.

#### Scenario: The schema describes required columns

- **WHEN** `settings.schema.json` describes `tickets.columns`
- **THEN** no state under `tickets.columns` says `Default:`, and the block's description says that with a board all six states are required, from this file or a preset. The schema doesn't require them, since it reads one file and a preset can supply the block (line 5); the settings check does.

### Requirement: The hosts a session may reach

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The hosts a session may reach

- **WHEN** `.claude/lunamill.yaml` sets `builds.hosts`
- **THEN** `builds.hosts` is a list of host names, empty by default, and `github.com` or a host under it is refused: `.claude/lunamill.yaml: builds.hosts can't name GitHub: a build has no GitHub access`. A host is a name with a dot in it.

### Requirement: GitHub as a host is named with its file

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: GitHub as a host is named with its file

- **WHEN** `builds.hosts` names GitHub in `.claude/lunamill.yaml`
- **THEN** `lunamill sync`, `lunamill config check`, and `lunamill init` print `.claude/lunamill.yaml: builds.hosts can't name GitHub: a build has no GitHub access`.

### Requirement: One set of words for every reader

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: One set of words for every reader

- **WHEN** one bad value is read by `lunamill sync`, `lunamill config check`, `lunamill init`, `lunamill preset check`, `lunamill preset add`, `lunamill update`, `lunamill init --org`, and the poller
- **THEN** each prints the same words.

### Requirement: The settings files

lunamill SHALL behave as this line says: When lunamill reads or writes a repository's settings, they are `.claude/lunamill.yaml`, `.claude/lunamill.lock`, and `.claude/lunamill.choices.yaml`.

#### Scenario: The settings files

- **WHEN** lunamill reads or writes a repository's settings
- **THEN** they are `.claude/lunamill.yaml`, `.claude/lunamill.lock`, and `.claude/lunamill.choices.yaml`.

### Requirement: Version 1 is accepted

lunamill SHALL behave as this line says: When `lunamill config check` reads `version: 1` in `.claude/lunamill.yaml`, it accepts it.

#### Scenario: Version 1 is accepted

- **WHEN** `lunamill config check` reads `version: 1` in `.claude/lunamill.yaml`
- **THEN** it accepts it.

### Requirement: Version 2 is told to move

lunamill SHALL behave as this line says: When it reads `version: 2`, it fails with `.claude/lunamill.yaml: version: must be 1: this file is version 2, see ADDRESS`, where ADDRESS is the address of "Moving to lunamill" in `docs/maintain/upgrade-notes.md` at the installed release.

#### Scenario: Version 2 is told to move

- **WHEN** `lunamill config check` reads `version: 2`
- **THEN** it fails with `.claude/lunamill.yaml: version: must be 1: this file is version 2, see ADDRESS`, where ADDRESS is the address of "Moving to lunamill" in `docs/maintain/upgrade-notes.md` at the installed release.

### Requirement: Any other version is refused

lunamill SHALL behave as this line says: When it reads any other version, it fails with `.claude/lunamill.yaml: version: must be 1`.

#### Scenario: Any other version is refused

- **WHEN** `lunamill config check` reads any other version
- **THEN** it fails with `.claude/lunamill.yaml: version: must be 1`.
