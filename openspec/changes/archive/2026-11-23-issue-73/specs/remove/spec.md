## ADDED Requirements

### Requirement: No npm uninstall line

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: No npm uninstall line

- **WHEN** `factory remove` lists what is left by hand
- **THEN** `factory remove` lists no `npm uninstall` line.

## MODIFIED Requirements

### Requirement: Remove deletes what presets shipped

The factory SHALL behave as this line says: When `factory remove` goes ahead, it also deletes `.claude/factory.choices.yaml` and every agent and skill a preset shipped, as the lock lists them.

#### Scenario: Remove deletes what presets shipped

- **WHEN** `factory remove` goes ahead
- **THEN** it also deletes `.claude/factory.choices.yaml` and every agent and skill a preset shipped, as the lock lists them.

### Requirement: What is left by hand, by tool

The factory SHALL behave as this line says: When `factory remove` lists what is left by hand, it prints each tool's lines under the tool's label, indented two spaces, in the order code host, ticket system, runner, and coding agent, then `Then`, holding the line to commit; a tool with no lines has no heading, and the steps are numbered straight through the groups.

#### Scenario: What is left by hand, by tool

- **WHEN** `factory remove` lists what is left by hand
- **THEN** it prints each tool's lines under the tool's label, indented two spaces, in the order code host, ticket system, runner, and coding agent, then `Then`, holding the line to commit; a tool with no lines has no heading, and the steps are numbered straight through the groups.

### Requirement: The factory's files are deleted

`factory remove` SHALL delete the factory's files when told to go ahead.

#### Scenario: The factory's files are deleted

- **WHEN** going ahead
- **THEN** it deletes `.claude/factory.yaml`, `.claude/factory.lock`, `.claude/factory/`, every `.claude/skills/factory-*/` and `.claude/agents/factory-*.md`, `.github/workflows/factory.yml` and every `.github/workflows/factory-*.yml`, and `.github/factory-review.md`.
