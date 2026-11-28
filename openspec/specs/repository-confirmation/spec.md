# repository-confirmation Specification

## Purpose

Whose list of a ticket's repositories counts: the note that records who made it, and what a claim, a cloud run, and a status do without one.

## Requirements

### Requirement: The confirming note

lunamill SHALL behave as this line says: When `--set` or `--add` records a list, a note on the ticket, posted as the person signed in, says `Repositories: acme/api, acme/web (after acme/api).`, several after it joined by commas.

#### Scenario: The confirming note

- **WHEN** `--set` or `--add` records a list
- **THEN** a note on the ticket, posted as the person signed in, says `Repositories: acme/api, acme/web (after acme/api).`, several after it joined by commas.

### Requirement: A list that counts

lunamill SHALL behave as this line says: When a list is read by a claim, a cloud run, or a status, it counts only when the newest such note by an account that can write to every repository it names is the same list as the section's, in the same order with the same pairs. A change to the section by hand, or a note by anyone else, does not count.

#### Scenario: A list that counts

- **WHEN** a list is read by a claim, a cloud run, or a status
- **THEN** it counts only when the newest such note by an account that can write to every repository it names is the same list as the section's, in the same order with the same pairs. A change to the section by hand, or a note by anyone else, does not count.

### Requirement: A list that does not count

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A list that does not count

- **WHEN** it does not count
- **THEN** `lunamill ticket claim` posts nothing, prints `✗ #12's repositories were not confirmed by someone who can write to acme/web: run lunamill ticket repositories 12 --set acme/api acme/web --after acme/web=acme/api`, and exits 1, and a cloud run stops the ticket with the same words. The repository named is the first on the list the newest note's account can't write to, or the first with no note. "Merge order" is then pending, `#12's repositories are not confirmed`, and `lunamill ticket repositories 12` prints the `✗` line last.

### Requirement: A check that cannot be made

lunamill SHALL behave as this line says: When whether an account can write cannot be read, the list does not count, with `could not check who confirmed #12's repositories` as the reason.

#### Scenario: A check that cannot be made

- **WHEN** whether an account can write cannot be read
- **THEN** the list does not count, with `could not check who confirmed #12's repositories` as the reason.

### Requirement: Someone who cannot write to one

lunamill SHALL behave as this line says: When `--set` or `--add` is run by an account that cannot write to one of the repositories, the repository's line is `✗ acme/web   you can't write to it, so you can't put it on the list`, nothing is recorded, and it exits 1.

#### Scenario: Someone who cannot write to one

- **WHEN** `--set` or `--add` is run by an account that cannot write to one of the repositories
- **THEN** the repository's line is `✗ acme/web   you can't write to it, so you can't put it on the list`, nothing is recorded, and it exits 1.

### Requirement: The list from a cloud session

lunamill SHALL behave as this line says: When a cloud session asks for `lunamill ticket repositories` with `--set` or `--add`, it is refused as any write it may not make. The plain read answers as any read does.

#### Scenario: The list from a cloud session

- **WHEN** a cloud session asks for `lunamill ticket repositories` with `--set` or `--add`
- **THEN** it is refused as any write it may not make. The plain read answers as any read does.
