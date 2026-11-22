# ticket-record Specification

## Purpose

What the factory records on a ticket, such as claims, starts, and costs, kept and read back through the ticket adapter, and how a ticket's Cost adds up from it.

## Requirements

### Requirement: Events go through the adapter

The factory SHALL behave as this line says: When the factory records a claim, a refinement start, a wait, a refined mark, a build start, a release, a clear, a partial build, a cost, or a reviewer run on a ticket, it does so through the adapter as an event, and reads every such event back through the adapter. No code outside `src/tickets/` parses a `work-status`, `cost`, or `reviewer-run` marker out of a ticket comment's body; pull request comments, which are the code host's, are read as today.

#### Scenario: Events go through the adapter

- **WHEN** the factory records a claim, a refinement start, a wait, a refined mark, a build start, a release, a clear, a partial build, a cost, or a reviewer run on a ticket
- **THEN** it does so through the adapter as an event, and reads every such event back through the adapter. No code outside `src/tickets/` parses a `work-status`, `cost`, or `reviewer-run` marker out of a ticket comment's body; pull request comments, which are the code host's, are read as today.

### Requirement: GitHub keeps today's comments

The factory SHALL behave as this line says: When GitHub's adapter records an event, it posts the comment the factory posts today for it, and reads back today's comments, old ones included, as events.

#### Scenario: GitHub keeps today's comments

- **WHEN** GitHub's adapter records an event
- **THEN** it posts the comment the factory posts today for it, and reads back today's comments, old ones included, as events.

### Requirement: The record apart from comments

The factory SHALL behave as this line says: When the in-memory adapter records an event, it keeps it apart from the comments, and comments only for an event a person must read: refinement's questions, a stop that waits on someone, and the closing note.

#### Scenario: The record apart from comments

- **WHEN** the in-memory adapter records an event
- **THEN** it keeps it apart from the comments, and comments only for an event a person must read: refinement's questions, a stop that waits on someone, and the closing note.

### Requirement: A cost note is a running total

The factory SHALL behave as this line says: When a session records a cost on a ticket, the note's total is the session's newest total already recorded on that ticket plus what it spent since its clock started, the clock restarts only after the note is posted, and the note reads `This session has used DOLLARS on REF so far.`, DOLLARS as the note writes it today; on GitHub its marker is `<!-- cost-total: AMOUNT session=ID -->`. A second note with the same total changes no Cost.

#### Scenario: A cost note is a running total

- **WHEN** a session records a cost on a ticket
- **THEN** the note's total is the session's newest total already recorded on that ticket plus what it spent since its clock started, the clock restarts only after the note is posted, and the note reads `This session has used DOLLARS on REF so far.`, DOLLARS as the note writes it today; on GitHub its marker is `<!-- cost-total: AMOUNT session=ID -->`. A second note with the same total changes no Cost.

### Requirement: A ticket's Cost from the totals

The factory SHALL behave as this line says: When the sync works out a ticket's Cost, it takes, for each session, its newest total on the ticket, adds them, and adds every `cost:` marker on the ticket and the pull requests that build it, as today.

#### Scenario: A ticket's Cost from the totals

- **WHEN** the sync works out a ticket's Cost
- **THEN** it takes, for each session, its newest total on the ticket, adds them, and adds every `cost:` marker on the ticket and the pull requests that build it, as today.
