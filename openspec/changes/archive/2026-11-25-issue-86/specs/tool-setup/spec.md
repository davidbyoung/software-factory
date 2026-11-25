## ADDED Requirements

### Requirement: A re-run names the settings file once

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A re-run names the settings file once

- **WHEN** `factory init` runs where `.claude/factory.yaml` has a value that is not valid
- **THEN** it prints the line `factory config check` prints, with the file named once, then `Fix it, then run init again.`, and exits 1. What lets init fill in a missing branch name or columns is unchanged.

### Requirement: A re-run on a file that is not YAML

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A re-run on a file that is not YAML

- **WHEN** `.claude/factory.yaml` is not YAML
- **THEN** `factory init` prints what `factory sync` prints for it, then `Fix it, then run init again.`, exits 1, and looks at nothing else first.

### Requirement: A re-run where a pinned preset is not valid

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A re-run where a pinned preset is not valid

- **WHEN** a preset that `.claude/factory.yaml` lists is pinned, and the preset or the settings combined with it are not valid
- **THEN** `factory init` prints the line `factory config check` prints, then `Fix it, then run init again.`, and exits 1. A preset that is listed and not pinned is handled as today.
