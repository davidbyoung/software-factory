## ADDED Requirements

### Requirement: No approvers setting in the docs

The factory SHALL behave as this line says: When a reader opens `docs/configuration.md`, it has no `approvers` section, and "What is built" in `docs/developing.md` has no row for it.

#### Scenario: No approvers setting in the docs

- **WHEN** a reader opens `docs/configuration.md`
- **THEN** it has no `approvers` section, and "What is built" in `docs/developing.md` has no row for it.

### Requirement: The glossary's approver

The factory SHALL behave as this line says: When a reader opens `docs/glossary.md`, it defines an approver as a person whose account can write to the repository, and says the board's access decides who can approve a ticket for building.

#### Scenario: The glossary's approver

- **WHEN** a reader opens `docs/glossary.md`
- **THEN** it defines an approver as a person whose account can write to the repository, and says the board's access decides who can approve a ticket for building.

### Requirement: The limitations page's approvers

The factory SHALL behave as this line says: When a reader opens `docs/limitations.md`, it no longer says the factory is written for one approver or that trust "rests on one account's login". It says who is an approver, and that review by teams, required reviewers for a folder, and a number of approvals are the code host's to enforce.

#### Scenario: The limitations page's approvers

- **WHEN** a reader opens `docs/limitations.md`
- **THEN** it no longer says the factory is written for one approver or that trust "rests on one account's login". It says who is an approver, and that review by teams, required reviewers for a folder, and a number of approvals are the code host's to enforce.

### Requirement: The existing-repo page's team

The factory SHALL behave as this line says: When a reader opens `docs/existing-repo.md`, it no longer says only the repository's owner is obeyed, and "A team" says anyone who can write to the repository is, with nothing to list.

#### Scenario: The existing-repo page's team

- **WHEN** a reader opens `docs/existing-repo.md`
- **THEN** it no longer says only the repository's owner is obeyed, and "A team" says anyone who can write to the repository is, with nothing to list.

### Requirement: The CLI page's approver commands

The factory SHALL behave as this line says: When a reader opens `docs/cli.md`, it has a row for `factory ticket answers N`, names `--from-approvers` in the `factory pr comments N` row, and says "an approver's review" in the `factory pr review-pending` row.

#### Scenario: The CLI page's approver commands

- **WHEN** a reader opens `docs/cli.md`
- **THEN** it has a row for `factory ticket answers N`, names `--from-approvers` in the `factory pr comments N` row, and says "an approver's review" in the `factory pr review-pending` row.

### Requirement: The builds page's agent account

The factory SHALL behave as this line says: When a reader opens `docs/builds.md`, under "Who it acts as" it says an agent account counts as an approver and that a session never takes a comment carrying the factory's mark as an instruction.

#### Scenario: The builds page's agent account

- **WHEN** a reader opens `docs/builds.md`
- **THEN** under "Who it acts as" it says an agent account counts as an approver and that a session never takes a comment carrying the factory's mark as an instruction.
