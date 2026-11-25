# refined-check Specification

## Purpose

What makes a refined ticket one a build can read, and how `factory ticket refined` checks it before it posts the marker.

## Requirements

### Requirement: A sound ticket

The factory SHALL behave as this line says: When `factory ticket refined N --check` runs on a ticket whose body is sound, it prints `sound`, posts nothing, and exits 0.

#### Scenario: A sound ticket

- **WHEN** `factory ticket refined N --check` runs on a ticket whose body is sound
- **THEN** it prints `sound`, posts nothing, and exits 0.

### Requirement: Sound without the spec label

The factory SHALL behave as this line says: A ticket without the `spec` label is sound when its body has a `## Decisions` heading and a `## Acceptance criteria` heading with at least one list item under it.

#### Scenario: Sound without the spec label

- **WHEN** the refined check reads a ticket without the `spec` label
- **THEN** A ticket without the `spec` label is sound when its body has a `## Decisions` heading and a `## Acceptance criteria` heading with at least one list item under it.

### Requirement: Sound with the spec label

The factory SHALL behave as this line says: A ticket with the `spec` label is sound when its body has a `## Decisions` heading; a `## Spec` heading with at least one `### NAME (new)` or `### NAME (modified)` heading and at least one numbered line under it; and a `## For the builder` heading with `### Design` and `### Tasks` under it.

#### Scenario: Sound with the spec label

- **WHEN** the refined check reads a ticket with the `spec` label
- **THEN** A ticket with the `spec` label is sound when its body has a `## Decisions` heading; a `## Spec` heading with at least one `### NAME (new)` or `### NAME (modified)` heading and at least one numbered line under it; and a `## For the builder` heading with `### Design` and `### Tasks` under it.

### Requirement: A ticket that is not sound

The factory SHALL behave as this line says: When `factory ticket refined N --check` runs on a ticket that is not sound, it prints one line on standard error for each part that is missing, such as `missing: ### Tasks under ## For the builder`, posts nothing, and exits 1.

#### Scenario: A ticket that is not sound

- **WHEN** `factory ticket refined N --check` runs on a ticket that is not sound
- **THEN** it prints one line on standard error for each part that is missing, such as `missing: ### Tasks under ## For the builder`, posts nothing, and exits 1.

### Requirement: The marker is refused

The factory SHALL behave as this line says: When `factory ticket refined N` runs without `--check` on a ticket that is not sound, it posts no marker, prints the same lines, and exits 1.

#### Scenario: The marker is refused

- **WHEN** `factory ticket refined N` runs without `--check` on a ticket that is not sound
- **THEN** it posts no marker, prints the same lines, and exits 1.

### Requirement: The marker is posted

The factory SHALL behave as this line says: When `factory ticket refined N` runs on a sound ticket, it posts the `refined` marker as today, with `--before-file`'s text before it when given.

#### Scenario: The marker is posted

- **WHEN** `factory ticket refined N` runs on a sound ticket
- **THEN** it posts the `refined` marker as today, with `--before-file`'s text before it when given.
