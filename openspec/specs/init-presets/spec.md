# init-presets Specification

## Purpose

How `factory init` learns a repository's presets before it asks anything, from `--preset`, a `factory-config` repository, or what the machine last used, and what it then does not ask.

## Requirements

### Requirement: The presets --preset names

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The presets --preset names

- **WHEN** `factory init --preset NAME` runs
- **THEN** `factory init --preset NAME`, once for each, follows those presets and looks for no other.

### Requirement: Looking for the presets

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Looking for the presets

- **WHEN** `factory init` runs with no `--preset` and no `presets` in the settings
- **THEN** With no `--preset` and no `presets` in the settings, it looks for `OWNER/factory-config`, and when there is none, for what `~/.config/software-factory/presets.yaml` records for the owner, which it offers with the question the draft shows.

### Requirement: Choosing among factory-config's presets

The factory SHALL behave as this line says: When it found `factory-config`, it prints `Presets          OWNER/factory-config holds N` and asks which the repository follows, listing each `factory-preset.yaml` there by its preset's name and the first comment line of its file. The one at the root starts checked.

#### Scenario: Choosing among factory-config's presets

- **WHEN** it found `factory-config`
- **THEN** it prints `Presets          OWNER/factory-config holds N` and asks which the repository follows, listing each `factory-preset.yaml` there by its preset's name and the first comment line of its file. The one at the root starts checked.

### Requirement: The presets chosen are pinned

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The presets chosen are pinned

- **WHEN** `factory init` follows the presets chosen
- **THEN** It pins each preset chosen as `factory preset add` does, with that command's summary and refusals, and records the choice for the owner in `presets.yaml`.

### Requirement: Nothing the presets answer is asked

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Nothing the presets answer is asked

- **WHEN** the presets or the settings answer a question of `factory init`'s
- **THEN** It asks nothing the presets or the settings answer: the ticket system, the board and its columns, the branch name, the spec tool, where the poller runs, the interval, and the gate. It prints them under `From the presets, so not asked`, as the draft shows, with a `Parts` row naming each part the presets turn on.

### Requirement: The gate's question

The factory SHALL behave as this line says: When nothing sets `commands.gate`, it asks the question "the rest" shows, and writes the answer as the one gate command. Left empty, "Left to do" keeps today's line.

#### Scenario: The gate's question

- **WHEN** nothing sets `commands.gate`
- **THEN** it asks the question "the rest" shows, and writes the answer as the one gate command. Left empty, "Left to do" keeps today's line.
