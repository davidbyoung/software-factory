# init-presets Specification

## Purpose

How `kodor init` learns a repository's presets before it asks anything, from `--preset`, a `kodor-config` repository, or what the machine last used, and what it then does not ask.

## Requirements

### Requirement: The presets --preset names

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The presets --preset names

- **WHEN** `kodor init --preset NAME` runs
- **THEN** `kodor init --preset NAME`, once for each, follows those presets and looks for no other.

### Requirement: Looking for the presets

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Looking for the presets

- **WHEN** `kodor init` runs with no `--preset` and no `presets` in the settings
- **THEN** With no `--preset` and no `presets` in the settings, it looks for `OWNER/kodor-config`, and when there is none, for what `~/.config/kodor/presets.yaml` records for the owner, which it offers with the question the draft shows.

### Requirement: Choosing among kodor-config's presets

kodor SHALL behave as this line says: When it found `kodor-config`, it prints `Presets          OWNER/kodor-config holds N` and asks which the repository follows, listing each `kodor-preset.yaml` there by its preset's name and the first comment line of its file. The one at the root starts checked.

#### Scenario: Choosing among kodor-config's presets

- **WHEN** it found `kodor-config`
- **THEN** it prints `Presets          OWNER/kodor-config holds N` and asks which the repository follows, listing each `kodor-preset.yaml` there by its preset's name and the first comment line of its file. The one at the root starts checked.

### Requirement: The presets chosen are pinned

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The presets chosen are pinned

- **WHEN** `kodor init` follows the presets chosen
- **THEN** It pins each preset chosen as `kodor preset add` does, with that command's summary and refusals, and records the choice for the owner in `presets.yaml`.

### Requirement: Nothing the presets answer is asked

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Nothing the presets answer is asked

- **WHEN** the presets or the settings answer a question of `kodor init`'s
- **THEN** It asks nothing the presets or the settings answer: the ticket system, the board and its columns, the branch name, the spec tool, where the poller runs, the interval, and the gate. It prints them under `From the presets, so not asked`, as the draft shows, with a `Parts` row naming each part the presets turn on.

### Requirement: The gate's question

kodor SHALL behave as this line says: When nothing sets `commands.gate`, it asks the question "the rest" shows, and writes the answer as the one gate command. Left empty, "Left to do" keeps today's line.

#### Scenario: The gate's question

- **WHEN** nothing sets `commands.gate`
- **THEN** it asks the question "the rest" shows, and writes the answer as the one gate command. Left empty, "Left to do" keeps today's line.
