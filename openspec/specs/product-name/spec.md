# product-name Specification

## Purpose

The product's name, kodor, wherever a reader meets it, and the package and command that carry it.

## Requirements

### Requirement: The product is named kodor

kodor SHALL behave as this line says: When `README.md`, a page under `docs/`, a skill, an agent, the rules, the review instructions, or a line a command prints names the product, it says "kodor", lowercase, also at the start of a sentence and in a title. "The factory", "software factory", and "Software Factory" appear only in "a software factory" describing kodor and in the upgrade notes, which name the old package and the releases before kodor.

#### Scenario: The product is named kodor

- **WHEN** `README.md`, a page under `docs/`, a skill, an agent, the rules, the review instructions, or a line a command prints names the product
- **THEN** it says "kodor", lowercase, also at the start of a sentence and in a title. "The factory", "software factory", and "Software Factory" appear only in "a software factory" describing kodor and in the upgrade notes, which name the old package and the releases before kodor. A unit test reads `README.md`, every page under `docs/` but `docs/maintain/upgrade-notes.md`, `skills/`, `agents/`, `rules.md`, `review.md`, `approval-policies/`, `settings.schema.json`, `.claude-plugin/plugin.json`, and the string and template literals under `src/` and `bin/`, not their comments or identifiers, and fails on "the factory", "software factory", or "Software Factory", in any case, other than in "a software factory".

### Requirement: The package and its command

kodor SHALL behave as this line says: When the package is installed, it is `@kodor-ai/kodor`, its one command is `kodor`, and it has no `factory` command. `package.json`'s `repository.url` is `git+https://github.com/kodor-ai/kodor.git`.

#### Scenario: The package and its command

- **WHEN** the package is installed
- **THEN** it is `@kodor-ai/kodor`, its one command is `kodor`, and it has no `factory` command. `package.json`'s `repository.url` is `git+https://github.com/kodor-ai/kodor.git`.

### Requirement: Old settings are not read

kodor SHALL behave as this line says: When `kodor` runs in a repository that has `.claude/factory.yaml` and no `.claude/kodor.yaml`, it treats the repository as not set up, as it treats any repository without `.claude/kodor.yaml`.

#### Scenario: Old settings are not read

- **WHEN** `kodor` runs in a repository that has `.claude/factory.yaml` and no `.claude/kodor.yaml`
- **THEN** it treats the repository as not set up, as it treats any repository without `.claude/kodor.yaml`.
