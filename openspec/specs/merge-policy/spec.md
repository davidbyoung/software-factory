# merge-policy Specification

## Purpose

Which label the merge policy puts on a pull request, by the name the settings give it.

## Requirements

### Requirement: Merge labels by their configured names

The factory SHALL behave as this line says: When the merge policy labels a pull request, it adds the name `code-host.labels.merge-automatic` gives, or `code-host.labels.merge-manual`, and removes the other.

#### Scenario: Merge labels by their configured names

- **WHEN** the merge policy labels a pull request
- **THEN** it adds the name `code-host.labels.merge-automatic` gives, or `code-host.labels.merge-manual`, and removes the other.

### Requirement: A pull request across repositories

The factory SHALL behave as this line says: When a pull request links a ticket that names other repositories, or another repository's ticket, it is `merge-manual`, with the reason `part of acme/api#12, which spans repositories`.

#### Scenario: A pull request across repositories

- **WHEN** a pull request links a ticket that names other repositories, or another repository's ticket
- **THEN** it is `merge-manual`, with the reason `part of acme/api#12, which spans repositories`.
