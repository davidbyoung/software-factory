## ADDED Requirements

### Requirement: A preset's approval policies are copied

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset's approval policies are copied

- **WHEN** a preset has `approval-policies/NAME/` beside `factory-preset.yaml`
- **THEN** `factory sync` copies it to `.claude/approval-policies/NAME/`, as it copies `agents/`.

### Requirement: A preset's policies under --in

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset's policies under --in

- **WHEN** a preset is added with `--in`
- **THEN** its policies apply only within those folders, and their `files` start at each.

### Requirement: A policy of the same name

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A policy of the same name

- **WHEN** a later preset or the repository's own `factory.yaml` has a policy of the same name
- **THEN** it replaces the earlier one, and `off: true` turns it off.
