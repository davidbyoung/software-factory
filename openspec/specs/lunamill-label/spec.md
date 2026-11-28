# lunamill-label Specification

## Purpose

The lunamill label, which marks the tickets Lunamill works on: the sync, `lunamill status`, and the pollers act on no other, and how a ticket comes to carry it.

## Requirements

### Requirement: The sync acts only on labeled tickets

Lunamill SHALL behave as this line says: When the sync runs, it reads, writes, comments on, and adds to the board only tickets that carry the lunamill label. A card on the board whose ticket lacks the label keeps its column and its Session, Runs in, and Cost.

#### Scenario: The sync acts only on labeled tickets

- **WHEN** the sync runs
- **THEN** it reads, writes, comments on, and adds to the board only tickets that carry the lunamill label. A card on the board whose ticket lacks the label keeps its column and its Session, Runs in, and Cost.

### Requirement: Status lists only labeled tickets

Lunamill SHALL behave as this line says: When `lunamill status` runs, it lists only tickets that carry the lunamill label, with no line about others.

#### Scenario: Status lists only labeled tickets

- **WHEN** `lunamill status` runs
- **THEN** it lists only tickets that carry the lunamill label, with no line about others.

### Requirement: The poller builds only labeled tickets

Lunamill SHALL behave as this line says: When either poller finds a ticket in the ready column without the lunamill label, it starts no build of it and logs nothing for it.

#### Scenario: The poller builds only labeled tickets

- **WHEN** either poller finds a ticket in the ready column without the lunamill label
- **THEN** it starts no build of it and logs nothing for it.

### Requirement: Tickets Lunamill opens carry the label

Lunamill SHALL behave as this line says: When `lunamill ticket open`, `lunamill pr follow-ups`, the conflict sweep, or `lunamill-deps` opens a ticket, the ticket carries the lunamill label.

#### Scenario: Tickets Lunamill opens carry the label

- **WHEN** `lunamill ticket open`, `lunamill pr follow-ups`, the conflict sweep, or `lunamill-deps` opens a ticket
- **THEN** the ticket carries the lunamill label.

### Requirement: Naming a ticket adopts it

Lunamill SHALL behave as this line says: When `lunamill ticket refining N`, `lunamill ticket claim N`, or `lunamill ticket ready N` runs on a ticket without the label, it adds the label and prints `REF had no lunamill label: added it, so lunamill now tracks REF` before its own output, REF being the ticket's written form. Every other command writes to an unlabeled ticket as today.

#### Scenario: Naming a ticket adopts it

- **WHEN** `lunamill ticket refining N`, `lunamill ticket claim N`, or `lunamill ticket ready N` runs on a ticket without the label
- **THEN** it adds the label and prints `REF had no lunamill label: added it, so lunamill now tracks REF` before its own output, REF being the ticket's written form. Every other command writes to an unlabeled ticket as today.

### Requirement: The label is created before use

Lunamill SHALL behave as this line says: When Lunamill adds the label to a ticket and the ticket system lacks the label, it creates it first.

#### Scenario: The label is created before use

- **WHEN** Lunamill adds the label to a ticket and the ticket system lacks the label
- **THEN** it creates it first.

### Requirement: The label sought

Lunamill SHALL behave as this line says: When the sync, `lunamill status`, or a poller looks for the tickets Lunamill works on, it looks for the label `tickets.labels.lunamill` names.

#### Scenario: The label sought

- **WHEN** the sync, `lunamill status`, or a poller looks for the tickets Lunamill works on
- **THEN** it looks for the label `tickets.labels.lunamill` names.
