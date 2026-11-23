# factory-label Specification

## Purpose

The factory label, which marks the tickets the factory works on: the sync, `factory status`, and the pollers act on no other, and how a ticket comes to carry it.

## Requirements

### Requirement: The sync acts only on labeled tickets

The factory SHALL behave as this line says: When the sync runs, it reads, writes, comments on, and adds to the board only tickets that carry the factory label. A card on the board whose ticket lacks the label keeps its column and its Session, Runs in, and Cost.

#### Scenario: The sync acts only on labeled tickets

- **WHEN** the sync runs
- **THEN** it reads, writes, comments on, and adds to the board only tickets that carry the factory label. A card on the board whose ticket lacks the label keeps its column and its Session, Runs in, and Cost.

### Requirement: Status lists only labeled tickets

The factory SHALL behave as this line says: When `factory status` runs, it lists only tickets that carry the factory label, with no line about others.

#### Scenario: Status lists only labeled tickets

- **WHEN** `factory status` runs
- **THEN** it lists only tickets that carry the factory label, with no line about others.

### Requirement: The poller builds only labeled tickets

The factory SHALL behave as this line says: When either poller finds a ticket in the ready column without the factory label, it starts no build of it and logs nothing for it.

#### Scenario: The poller builds only labeled tickets

- **WHEN** either poller finds a ticket in the ready column without the factory label
- **THEN** it starts no build of it and logs nothing for it.

### Requirement: Tickets the factory opens carry the label

The factory SHALL behave as this line says: When `factory ticket open`, `factory follow-up`, the conflict sweep, or `factory-deps` opens a ticket, the ticket carries the factory label.

#### Scenario: Tickets the factory opens carry the label

- **WHEN** `factory ticket open`, `factory follow-up`, the conflict sweep, or `factory-deps` opens a ticket
- **THEN** the ticket carries the factory label.

### Requirement: Naming a ticket adopts it

The factory SHALL behave as this line says: When `factory ticket refining N`, `factory ticket claim N`, or `factory ticket ready N` runs on a ticket without the label, it adds the label and prints `REF had no factory label: added it, so the factory now tracks REF` before its own output, REF being the ticket's written form. Every other command writes to an unlabeled ticket as today.

#### Scenario: Naming a ticket adopts it

- **WHEN** `factory ticket refining N`, `factory ticket claim N`, or `factory ticket ready N` runs on a ticket without the label
- **THEN** it adds the label and prints `REF had no factory label: added it, so the factory now tracks REF` before its own output, REF being the ticket's written form. Every other command writes to an unlabeled ticket as today.

### Requirement: The label is created before use

The factory SHALL behave as this line says: When the factory adds the label to a ticket and the ticket system lacks the label, it creates it first.

#### Scenario: The label is created before use

- **WHEN** the factory adds the label to a ticket and the ticket system lacks the label
- **THEN** it creates it first.
