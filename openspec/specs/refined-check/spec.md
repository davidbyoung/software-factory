# refined-check Specification

## Purpose

What makes a refined ticket one a build can read, and how `lunamill ticket refined` checks it before it posts the marker.

## Requirements

### Requirement: A sound ticket

Lunamill SHALL behave as this line says: When `lunamill ticket refined N --check` runs on a ticket whose body is sound, it prints `sound`, posts nothing, and exits 0.

#### Scenario: A sound ticket

- **WHEN** `lunamill ticket refined N --check` runs on a ticket whose body is sound
- **THEN** it prints `sound`, posts nothing, and exits 0.

### Requirement: Sound without the spec label

Lunamill SHALL behave as this line says: A ticket without the `spec` label is sound when its body has a `## Decisions` heading and a `## Acceptance criteria` heading with at least one list item under it.

#### Scenario: Sound without the spec label

- **WHEN** the refined check reads a ticket without the `spec` label
- **THEN** A ticket without the `spec` label is sound when its body has a `## Decisions` heading and a `## Acceptance criteria` heading with at least one list item under it.

### Requirement: Sound with the spec label

Lunamill SHALL behave as this line says: A ticket with the `spec` label is sound when its body has a `## Decisions` heading; a `## Spec` heading with at least one `### NAME (new)` or `### NAME (modified)` heading and at least one numbered line under it; and a `## For the builder` heading with `### Design` and `### Tasks` under it.

#### Scenario: Sound with the spec label

- **WHEN** the refined check reads a ticket with the `spec` label
- **THEN** A ticket with the `spec` label is sound when its body has a `## Decisions` heading; a `## Spec` heading with at least one `### NAME (new)` or `### NAME (modified)` heading and at least one numbered line under it; and a `## For the builder` heading with `### Design` and `### Tasks` under it.

### Requirement: A ticket that is not sound

Lunamill SHALL behave as this line says: When `lunamill ticket refined N --check` runs on a ticket that is not sound, it prints one line on standard error for each part that is missing, such as `missing: ### Tasks under ## For the builder`, posts nothing, and exits 1.

#### Scenario: A ticket that is not sound

- **WHEN** `lunamill ticket refined N --check` runs on a ticket that is not sound
- **THEN** it prints one line on standard error for each part that is missing, such as `missing: ### Tasks under ## For the builder`, posts nothing, and exits 1.

### Requirement: The marker is refused

Lunamill SHALL behave as this line says: When `lunamill ticket refined N` runs without `--check` on a ticket that is not sound, it posts no marker, prints the same lines, and exits 1.

#### Scenario: The marker is refused

- **WHEN** `lunamill ticket refined N` runs without `--check` on a ticket that is not sound
- **THEN** it posts no marker, prints the same lines, and exits 1.

### Requirement: The marker is posted

Lunamill SHALL behave as this line says: When `lunamill ticket refined N` runs on a sound ticket, it posts the `refined` marker as today, with `--before-file`'s text before it when given.

#### Scenario: The marker is posted

- **WHEN** `lunamill ticket refined N` runs on a sound ticket
- **THEN** it posts the `refined` marker as today, with `--before-file`'s text before it when given.

### Requirement: A ticket that names a new credential needs Threats

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A ticket that names a new credential needs Threats

- **WHEN** the owner's text of a ticket, its lines before the first `## ` heading outside code fences, names a credential as line 6 does that the default branch doesn't have outside docs and tests, or write access as `NAME: write`, and the body has no `## Threats` heading
- **THEN** `lunamill ticket refined` prints one line, `missing: ## Threats, since the ticket names a credential this repository does not have: NAME, NAME`, or `missing: ## Threats, since the ticket gives a workflow write access: NAME: write`, and exits 1, for a ticket with or without `spec`.
