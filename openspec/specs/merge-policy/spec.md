# merge-policy Specification

## Purpose

Which label the merge policy puts on a pull request, by the name the settings give it.

## Requirements

### Requirement: Merge labels by their configured names

The factory SHALL behave as this line says: When the merge policy labels a pull request, it adds the name `code-host.labels.merge-automatic` gives, or `code-host.labels.merge-manual`, and removes the other.

#### Scenario: Merge labels by their configured names

- **WHEN** the merge policy labels a pull request
- **THEN** it adds the name `code-host.labels.merge-automatic` gives, or `code-host.labels.merge-manual`, and removes the other.
