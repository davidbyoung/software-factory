# kodor-label Specification

## Purpose

The kodor label, which marks the tickets kodor works on: the sync, `kodor status`, and the pollers act on no other, and how a ticket comes to carry it.

## Requirements

### Requirement: The sync acts only on labeled tickets

kodor SHALL behave as this line says: When the sync runs, it reads, writes, comments on, and adds to the board only tickets that carry the kodor label. A card on the board whose ticket lacks the label keeps its column and its Session, Runs in, and Cost.

#### Scenario: The sync acts only on labeled tickets

- **WHEN** the sync runs
- **THEN** it reads, writes, comments on, and adds to the board only tickets that carry the kodor label. A card on the board whose ticket lacks the label keeps its column and its Session, Runs in, and Cost.

### Requirement: Status lists only labeled tickets

kodor SHALL behave as this line says: When `kodor status` runs, it lists only tickets that carry the kodor label, with no line about others.

#### Scenario: Status lists only labeled tickets

- **WHEN** `kodor status` runs
- **THEN** it lists only tickets that carry the kodor label, with no line about others.

### Requirement: The poller builds only labeled tickets

kodor SHALL behave as this line says: When either poller finds a ticket in the ready column without the kodor label, it starts no build of it and logs nothing for it.

#### Scenario: The poller builds only labeled tickets

- **WHEN** either poller finds a ticket in the ready column without the kodor label
- **THEN** it starts no build of it and logs nothing for it.

### Requirement: Tickets kodor opens carry the label

kodor SHALL behave as this line says: When `kodor ticket open`, `kodor pr follow-ups`, the conflict sweep, or `kodor-deps` opens a ticket, the ticket carries the kodor label.

#### Scenario: Tickets kodor opens carry the label

- **WHEN** `kodor ticket open`, `kodor pr follow-ups`, the conflict sweep, or `kodor-deps` opens a ticket
- **THEN** the ticket carries the kodor label.

### Requirement: Naming a ticket adopts it

kodor SHALL behave as this line says: When `kodor ticket refining N`, `kodor ticket claim N`, or `kodor ticket ready N` runs on a ticket without the label, it adds the label and prints `REF had no kodor label: added it, so kodor now tracks REF` before its own output, REF being the ticket's written form. Every other command writes to an unlabeled ticket as today.

#### Scenario: Naming a ticket adopts it

- **WHEN** `kodor ticket refining N`, `kodor ticket claim N`, or `kodor ticket ready N` runs on a ticket without the label
- **THEN** it adds the label and prints `REF had no kodor label: added it, so kodor now tracks REF` before its own output, REF being the ticket's written form. Every other command writes to an unlabeled ticket as today.

### Requirement: The label is created before use

kodor SHALL behave as this line says: When kodor adds the label to a ticket and the ticket system lacks the label, it creates it first.

#### Scenario: The label is created before use

- **WHEN** kodor adds the label to a ticket and the ticket system lacks the label
- **THEN** it creates it first.

### Requirement: The label sought

kodor SHALL behave as this line says: When the sync, `kodor status`, or a poller looks for the tickets kodor works on, it looks for the label `tickets.labels.kodor` names.

#### Scenario: The label sought

- **WHEN** the sync, `kodor status`, or a poller looks for the tickets kodor works on
- **THEN** it looks for the label `tickets.labels.kodor` names.
