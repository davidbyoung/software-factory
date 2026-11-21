## ADDED Requirements

### Requirement: Init asks for the branch name

The factory SHALL behave as this line says: When `factory init` runs and the settings in effect have no `code-host.branch-name`, it asks `How should a build name its branch? Use {ticket}, and {user} for the GitHub account:` with `{ticket}` filled in, right after the ticket system and the runner are chosen.

#### Scenario: Init asks for the branch name

- **WHEN** `factory init` runs and the settings in effect have no `code-host.branch-name`
- **THEN** it asks `How should a build name its branch? Use {ticket}, and {user} for the GitHub account:` with `{ticket}` filled in, right after the ticket system and the runner are chosen.

### Requirement: Init writes the branch name

The factory SHALL behave as this line says: When the person answers, `factory init` writes a `code-host` block to `.claude/factory.yaml` holding `type: github` and `branch-name:` with the answer in double quotes.

#### Scenario: Init writes the branch name

- **WHEN** the person answers
- **THEN** `factory init` writes a `code-host` block to `.claude/factory.yaml` holding `type: github` and `branch-name:` with the answer in double quotes.

### Requirement: Init refuses a faulty pattern

The factory SHALL behave as this line says: When the answer breaks any of lines 4 to 8, `factory init` prints that line's reason, the text after `code-host.branch-name: `, and asks again.

#### Scenario: Init refuses a faulty pattern

- **WHEN** the answer breaks any of lines 4 to 8
- **THEN** `factory init` prints that line's reason, the text after `code-host.branch-name: `, and asks again.

### Requirement: Init keeps a branch name already set

The factory SHALL behave as this line says: When a re-run finds `code-host.branch-name` in the settings in effect, from the file or a preset, `factory init` does not ask for it and leaves it as it is.

#### Scenario: Init keeps a branch name already set

- **WHEN** a re-run finds `code-host.branch-name` in the settings in effect, from the file or a preset
- **THEN** `factory init` does not ask for it and leaves it as it is.

### Requirement: Init fills in a missing branch name

The factory SHALL behave as this line says: When a re-run finds settings whose only faults are a missing `code-host.branch-name` and any states #53 lets init fill in, `factory init` does not stop with "Fix it, then run init again.", keeps every other value, and asks line 18's question.

#### Scenario: Init fills in a missing branch name

- **WHEN** a re-run finds settings whose only faults are a missing `code-host.branch-name` and any states #53 lets init fill in
- **THEN** `factory init` does not stop with "Fix it, then run init again.", keeps every other value, and asks line 18's question.

## MODIFIED Requirements

### Requirement: Init is unchanged with today's tools

The factory SHALL behave as this line says: `factory init` prints the same lines and asks the same questions as before this change with today's tools, except its closing checks, as line 26 says, its fixes, as line 25 says, and the question that asks for `code-host.branch-name` when the settings in effect have none.

#### Scenario: Init is unchanged with today's tools

- **WHEN** `factory init` runs with GitHub, GitHub Issues, GitHub Actions, and Claude Code
- **THEN** `factory init` prints the same lines and asks the same questions as before this change with today's tools, except its closing checks, as line 26 says, its fixes, as line 25 says, and the question that asks for `code-host.branch-name` when the settings in effect have none.
