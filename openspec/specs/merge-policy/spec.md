# merge-policy Specification

## Purpose

Which label the merge policy puts on a pull request, by the name the settings give it.

## Requirements

### Requirement: Merge labels by their configured names

kodor SHALL behave as this line says: When the merge policy labels a pull request, it adds the name `code-host.labels.merge-automatic` gives, or `code-host.labels.merge-manual`, and removes the other.

#### Scenario: Merge labels by their configured names

- **WHEN** the merge policy labels a pull request
- **THEN** it adds the name `code-host.labels.merge-automatic` gives, or `code-host.labels.merge-manual`, and removes the other.

### Requirement: A pull request across repositories

kodor SHALL behave as this line says: When a pull request links a ticket that names other repositories, or another repository's ticket, it is `merge-manual`, with the reason `part of acme/api#12, which spans repositories`.

#### Scenario: A pull request across repositories

- **WHEN** a pull request links a ticket that names other repositories, or another repository's ticket
- **THEN** it is `merge-manual`, with the reason `part of acme/api#12, which spans repositories`.

### Requirement: A policy with an agent waits for a person

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A policy with an agent waits for a person

- **WHEN** a policy with `agent` applies to a pull request's changed files
- **THEN** the pull request is `merge-manual`, with the reason `NAME is checked by an agent, so a person merges it`, decided before any check runs.

### Requirement: A policy with a command and an agent holds only on a finding

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A policy with a command and an agent holds only on a finding

- **WHEN** a policy with both `run` and `agent` applies to a pull request's files
- **THEN** the merge policy runs its command once for each folder, from the default branch's checkout with no credential, and holds the pull request for a person when the command found something or failed; a policy with `agent` alone holds by its files, as before.
