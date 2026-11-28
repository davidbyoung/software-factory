# init-presets Specification

## Purpose

How `lunamill init` learns a repository's presets before it asks anything, from `--preset`, a `lunamill-config` repository, or what the machine last used, and what it then does not ask.

## Requirements

### Requirement: The presets --preset names

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The presets --preset names

- **WHEN** `lunamill init --preset NAME` runs
- **THEN** `lunamill init --preset NAME`, once for each, follows those presets and looks for no other.

### Requirement: Looking for the presets

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Looking for the presets

- **WHEN** `lunamill init` runs with no `--preset` and no `presets` in the settings
- **THEN** With no `--preset` and no `presets` in the settings, it looks for `OWNER/lunamill-config`, and when there is none, for what `~/.config/lunamill/presets.yaml` records for the owner, which it offers with the question the draft shows.

### Requirement: Choosing among lunamill-config's presets

lunamill SHALL behave as this line says: When it found `lunamill-config`, it prints `Presets          OWNER/lunamill-config holds N` and asks which the repository follows, listing each `lunamill-preset.yaml` there by its preset's name and the first comment line of its file. The one at the root starts checked.

#### Scenario: Choosing among lunamill-config's presets

- **WHEN** it found `lunamill-config`
- **THEN** it prints `Presets          OWNER/lunamill-config holds N` and asks which the repository follows, listing each `lunamill-preset.yaml` there by its preset's name and the first comment line of its file. The one at the root starts checked.

### Requirement: The presets chosen are pinned

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The presets chosen are pinned

- **WHEN** `lunamill init` follows the presets chosen
- **THEN** It pins each preset chosen as `lunamill preset add` does, with that command's summary and refusals, and records the choice for the owner in `presets.yaml`.

### Requirement: Nothing the presets answer is asked

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Nothing the presets answer is asked

- **WHEN** the presets or the settings answer a question of `lunamill init`'s
- **THEN** It asks nothing the presets or the settings answer: the ticket system, the board and its columns, the branch name, the spec tool, where the poller runs, the interval, and the gate. It prints them under `From the presets, so not asked`, as the draft shows, with a `Parts` row naming each part the presets turn on.

### Requirement: The gate's question

lunamill SHALL behave as this line says: When nothing sets `commands.gate`, it asks the question "the rest" shows, and writes the answer as the one gate command. Left empty, "Left to do" keeps today's line.

#### Scenario: The gate's question

- **WHEN** nothing sets `commands.gate`
- **THEN** it asks the question "the rest" shows, and writes the answer as the one gate command. Left empty, "Left to do" keeps today's line.
