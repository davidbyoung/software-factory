## ADDED Requirements

### Requirement: Adopting named tickets

The factory SHALL behave as this line says: When `factory ticket adopt N...` runs, it adds the factory label to each ticket named that lacks it, prints `labeled REF, REF, ...` for those it added it to, then `✓ COUNT tickets carry NAME`, and exits 0.

#### Scenario: Adopting named tickets

- **WHEN** `factory ticket adopt N...` runs
- **THEN** it adds the factory label to each ticket named that lacks it, prints `labeled REF, REF, ...` for those it added it to, then `✓ COUNT tickets carry NAME`, and exits 0.

### Requirement: Adopting every open ticket

The factory SHALL behave as this line says: When `factory ticket adopt --all-open` runs, it does the same for every ticket that is not finished, whatever its labels; with none lacking the label, it prints `✓ COUNT open tickets carry NAME; none needed it`.

#### Scenario: Adopting every open ticket

- **WHEN** `factory ticket adopt --all-open` runs
- **THEN** it does the same for every ticket that is not finished, whatever its labels; with none lacking the label, it prints `✓ COUNT open tickets carry NAME; none needed it`.

### Requirement: Adopt without tickets

The factory SHALL behave as this line says: When `factory ticket adopt` is given neither a key nor `--all-open`, it prints its usage and exits 2.

#### Scenario: Adopt without tickets

- **WHEN** `factory ticket adopt` is given neither a key nor `--all-open`
- **THEN** it prints its usage and exits 2.

### Requirement: Adopting once per lock

The factory SHALL behave as this line says: When `factory ticket adopt --all-open --since-lock FILE` runs, when FILE, read as YAML, has `settings.tickets.labels.factory`, it labels nothing, prints `✓ nothing to label: FILE already has tickets.labels.factory`, and exits 0; when FILE lacks it, or does not exist, it runs as "Adopting every open ticket" says.

#### Scenario: Adopting once per lock

- **WHEN** `factory ticket adopt --all-open --since-lock FILE` runs
- **THEN** when FILE, read as YAML, has `settings.tickets.labels.factory`, it labels nothing, prints `✓ nothing to label: FILE already has tickets.labels.factory`, and exits 0; when FILE lacks it, or does not exist, it runs as "Adopting every open ticket" says.

### Requirement: The update labels open tickets once

The factory SHALL behave as this line says: When `factory-deps` finishes an update pull request, it runs `factory ticket adopt --all-open --since-lock` with the base branch's `.claude/factory.lock`, and when that labels tickets, puts in its comment, in the same comment as the files the sync changed, `Labeled COUNT open tickets NAME.`, the sentence Proposed docs shows, and the tickets it labeled. On any other update it labels nothing.

#### Scenario: The update labels open tickets once

- **WHEN** `factory-deps` finishes an update pull request
- **THEN** it runs `factory ticket adopt --all-open --since-lock` with the base branch's `.claude/factory.lock`, and when that labels tickets, puts in its comment, in the same comment as the files the sync changed, `Labeled COUNT open tickets NAME.`, the sentence Proposed docs shows, and the tickets it labeled. On any other update it labels nothing.
