## ADDED Requirements

### Requirement: Preset check refuses a value that is not valid

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Preset check refuses a value that is not valid

- **WHEN** a preset's file has a value `factory config check` would refuse in `.claude/factory.yaml`
- **THEN** `factory preset check` prints it in the same words after the preset's file, as `FILE: KEY: MESSAGE`, and exits 1. A message with no `KEY: `, such as `builds.poll-minutes needs builds.trigger: github-action`, follows `FILE: ` as it is.

### Requirement: Every problem only a preset has, then the first fault

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Every problem only a preset has, then the first fault

- **WHEN** a preset's file has several problems
- **THEN** `factory preset check` prints each problem that only a preset has (a setting a preset can't set, `presets`, and `off`), then the first fault the shared rules find. No fault is printed twice.

### Requirement: A preset that leaves out the board

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset that leaves out the board

- **WHEN** a preset leaves out `tickets.board` and writes `tickets.columns`, or a board's field under `tickets.fields`
- **THEN** `factory preset check` passes.

### Requirement: A preset that holds part of the columns, or no branch name

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset that holds part of the columns, or no branch name

- **WHEN** a preset leaves out some or all of `tickets.columns` beside `tickets.board`, or `code-host.branch-name`
- **THEN** `factory preset check` passes.

### Requirement: An interval with no trigger

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An interval with no trigger

- **WHEN** a preset writes `builds.poll-minutes` and leaves out `builds.trigger`
- **THEN** `factory preset check` passes.

### Requirement: A spec check with no spec tool

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A spec check with no spec tool

- **WHEN** a preset writes `specs.check` and leaves out `specs.type`
- **THEN** `factory preset check` passes.

### Requirement: A reviewer whose setting another layer supplies

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A reviewer whose setting another layer supplies

- **WHEN** a preset lists `factory-ui-reviewer` and leaves out `site`, or lists `factory-e2e-reviewer` and leaves out `commands.end-to-end`
- **THEN** `factory preset check` passes.

### Requirement: Part of site, or of coverage

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Part of site, or of coverage

- **WHEN** a preset writes part of `site` and leaves out `site.start` or `site.url`, or writes one of `commands.coverage.run` and `commands.coverage.report`
- **THEN** `factory preset check` passes.

### Requirement: A value that is not valid beside a setting left out

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A value that is not valid beside a setting left out

- **WHEN** a value "A preset that leaves out the board" to "Part of site, or of coverage" let stand without its other half is itself not valid, such as `tickets.columns.ready: []` with no board, or `poll-minutes: 7` with no trigger
- **THEN** `factory preset check` fails as "Preset check refuses a value that is not valid" says.

### Requirement: Two settings of one preset that contradict

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Two settings of one preset that contradict

- **WHEN** a preset writes both halves and they contradict, such as `trigger: manual` with `poll-minutes`, or `board: none` with `tickets.columns`
- **THEN** `factory preset check` fails as "Preset check refuses a value that is not valid" says.

### Requirement: A preset in the older version

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset in the older version

- **WHEN** a preset's `version` is 1
- **THEN** `factory preset check`, `factory preset add`, and the poller print the words `factory config check` prints for version 1.

### Requirement: A preset's file that is not YAML

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset's file that is not YAML

- **WHEN** a preset's file is not YAML
- **THEN** `factory preset check` and the poller print `FILE: ` and the words `factory sync` prints for `.claude/factory.yaml`, its hint to quote a value included, and `factory preset add` prints them after `NAME: `. Each exits 1.

### Requirement: Preset add refuses a value that is not valid

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Preset add refuses a value that is not valid

- **WHEN** a preset has a fault "Preset check refuses a value that is not valid" describes
- **THEN** `factory preset add NAME` prints `NAME: ` and the same words, exits 1, and changes nothing, whether or not the repository's own file replaces the value.

### Requirement: A pinned preset's value in effect

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A pinned preset's value in effect

- **WHEN** a pinned preset's value is in effect and not valid
- **THEN** `factory sync` and `factory config check` print `NAME: ` and the same words, and exit 1, for every message, one with no `KEY: ` and one about an item of a list included.

### Requirement: A pinned preset's value that is replaced

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A pinned preset's value that is replaced

- **WHEN** a pinned preset's value is not valid and the repository's own file or a later preset replaces it
- **THEN** `factory sync` and `factory config check` pass.

### Requirement: A preset and a repository valid alone and not together

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset and a repository valid alone and not together

- **WHEN** `.claude/factory.yaml` and a preset are each valid alone and not together, such as a preset that lists `factory-ui-reviewer` in a repository with no `site`
- **THEN** `factory config check` fails as today.
