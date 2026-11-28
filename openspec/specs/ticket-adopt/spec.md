# ticket-adopt Specification

## Purpose

`kodor ticket adopt`, which gives the kodor label to the tickets named or to every open one, and labels the open tickets once on the update that brings the label.

## Requirements

### Requirement: Adopting named tickets

kodor SHALL behave as this line says: When `kodor ticket adopt N...` runs, it adds the kodor label to each ticket named that lacks it, prints `labeled REF, REF, ...` for those it added it to, then `✓ COUNT tickets carry NAME`, and exits 0.

#### Scenario: Adopting named tickets

- **WHEN** `kodor ticket adopt N...` runs
- **THEN** it adds the kodor label to each ticket named that lacks it, prints `labeled REF, REF, ...` for those it added it to, then `✓ COUNT tickets carry NAME`, and exits 0.

### Requirement: Adopting every open ticket

kodor SHALL behave as this line says: When `kodor ticket adopt --all-open` runs, it does the same for every ticket that is not finished, whatever its labels; with none lacking the label, it prints `✓ COUNT open tickets carry NAME; none needed it`.

#### Scenario: Adopting every open ticket

- **WHEN** `kodor ticket adopt --all-open` runs
- **THEN** it does the same for every ticket that is not finished, whatever its labels; with none lacking the label, it prints `✓ COUNT open tickets carry NAME; none needed it`.

### Requirement: Adopt without tickets

kodor SHALL behave as this line says: When `kodor ticket adopt` is given neither a key nor `--all-open`, it prints its usage and exits 2.

#### Scenario: Adopt without tickets

- **WHEN** `kodor ticket adopt` is given neither a key nor `--all-open`
- **THEN** it prints its usage and exits 2.

### Requirement: Adopting once per lock

kodor SHALL behave as this line says: When `kodor ticket adopt --all-open --since-lock FILE` runs, when FILE, read as YAML, has `settings.tickets.labels.kodor`, it labels nothing, prints `✓ nothing to label: FILE already has tickets.labels.kodor`, and exits 0; when FILE lacks it, or does not exist, it runs as "Adopting every open ticket" says.

#### Scenario: Adopting once per lock

- **WHEN** `kodor ticket adopt --all-open --since-lock FILE` runs
- **THEN** when FILE, read as YAML, has `settings.tickets.labels.kodor`, it labels nothing, prints `✓ nothing to label: FILE already has tickets.labels.kodor`, and exits 0; when FILE lacks it, or does not exist, it runs as "Adopting every open ticket" says.

### Requirement: The update labels open tickets once

kodor SHALL behave as this line says: When `kodor-deps` finishes an update pull request, it runs `kodor ticket adopt --all-open --since-lock` with the base branch's `.claude/kodor.lock`, and when that labels tickets, puts in its comment, in the same comment as the files the sync changed, `Labeled COUNT open tickets NAME.`, the sentence Proposed docs shows, and the tickets it labeled. On any other update it labels nothing.

#### Scenario: The update labels open tickets once

- **WHEN** `kodor-deps` finishes an update pull request
- **THEN** it runs `kodor ticket adopt --all-open --since-lock` with the base branch's `.claude/kodor.lock`, and when that labels tickets, puts in its comment, in the same comment as the files the sync changed, `Labeled COUNT open tickets NAME.`, the sentence Proposed docs shows, and the tickets it labeled. On any other update it labels nothing.
