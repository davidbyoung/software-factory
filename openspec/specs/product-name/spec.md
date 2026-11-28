# product-name Specification

## Purpose

The product's name, Lunamill, wherever a reader meets it, and the package and command that carry it.

## Requirements

### Requirement: The product is named Lunamill

Lunamill SHALL behave as this line says: When `README.md`, a page under `docs/`, a skill, an agent, the rules, the review instructions, or a line a command prints names the product, it says "Lunamill", with a capital L, also at the start of a sentence and in a title. "The factory", "software factory", and "Software Factory" appear only in "a software factory" describing Lunamill and in the upgrade notes, which name the old package and the releases before Lunamill.

#### Scenario: The product is named Lunamill

- **WHEN** `README.md`, a page under `docs/`, a skill, an agent, the rules, the review instructions, or a line a command prints names the product
- **THEN** it says "Lunamill", with a capital L, also at the start of a sentence and in a title, and `lunamill`, lowercase, where it is the command, the package, a file or folder, a skill, an agent, a label, a property, or another name a person types. "The factory", "software factory", and "Software Factory" appear only in "a software factory" describing Lunamill and in the upgrade notes, which name the old package and the releases before Lunamill. A unit test reads `README.md`, every page under `docs/` but `docs/maintain/upgrade-notes.md`, `skills/`, `agents/`, `rules.md`, `review.md`, `approval-policies/`, `settings.schema.json`, `.claude-plugin/plugin.json`, and the string and template literals under `src/` and `bin/`, not their comments or identifiers, and fails on "the factory", "software factory", or "Software Factory", in any case, other than in "a software factory", and fails on "lunamill" written lowercase in the prose of `README.md`, a page under `docs/`, a skill, an agent, the rules, or the review instructions, outside code and before anything but a command.

### Requirement: The package and its command

Lunamill SHALL behave as this line says: When the package is installed, it is `@lunamill-ai/lunamill`, its one command is `lunamill`, and it has no `factory` command. `package.json`'s `repository.url` is `git+https://github.com/lunamill-ai/lunamill.git`.

#### Scenario: The package and its command

- **WHEN** the package is installed
- **THEN** it is `@lunamill-ai/lunamill`, its one command is `lunamill`, and it has no `factory` command. `package.json`'s `repository.url` is `git+https://github.com/lunamill-ai/lunamill.git`.

### Requirement: Old settings are not read

Lunamill SHALL behave as this line says: When `lunamill` runs in a repository that has `.claude/factory.yaml` and no `.claude/lunamill.yaml`, it treats the repository as not set up, as it treats any repository without `.claude/lunamill.yaml`.

#### Scenario: Old settings are not read

- **WHEN** `lunamill` runs in a repository that has `.claude/factory.yaml` and no `.claude/lunamill.yaml`
- **THEN** it treats the repository as not set up, as it treats any repository without `.claude/lunamill.yaml`.
