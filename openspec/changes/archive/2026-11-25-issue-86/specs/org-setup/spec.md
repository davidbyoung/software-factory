## ADDED Requirements

### Requirement: An organization's preset that is not valid

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An organization's preset that is not valid

- **WHEN** `factory init --org` finds a `factory-preset.yaml` in the organization's `factory-config` with a fault "Preset check refuses a value that is not valid", "A preset in the older version", or "A preset's file that is not YAML" describes, or one only a preset has
- **THEN** it prints `factory-preset.yaml: ` and the same words, then `Fix it, then run init again.`, asks nothing, changes nothing, and exits 1.
