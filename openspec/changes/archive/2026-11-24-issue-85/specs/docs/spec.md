## ADDED Requirements

### Requirement: The docs on an organization's branch names

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The docs on an organization's branch names

- **WHEN** this ships
- **THEN** `docs/github/setup.md` says that `factory init --org` asks how a build names its branch and that the preset holds the answer, the `branch-name` entry in `docs/configuration.md` says the same beside `factory init`, and "Naming build branches" in `docs/updating.md` says how an organization set up earlier adds the lines to its preset. The rest of `code-host` in `docs/configuration.md` reads as before.

## MODIFIED Requirements

### Requirement: The configuration page's code-host

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The configuration page's code-host

- **WHEN** a reader opens `docs/configuration.md`
- **THEN** its `code-host` section reads as "The docs page" under Proposed docs shows it, with its `branch-name` entry also saying what "The docs on an organization's branch names" says; "How the file works" names `version`, `repository`, and `code-host.branch-name` as required and `commands.gate` before any build; and "The shortest file" and the three complete files each hold the `code-host` block with `branch-name: "{ticket}"`.
