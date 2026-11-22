## MODIFIED Requirements

### Requirement: The branch for a ticket

The factory SHALL behave as this line says: When `factory ticket branch N` runs for a ticket that exists, it prints one line, the pattern with each `{ticket}` replaced by the ticket's key, such as `12` or `PROJ-12`, and each `{user}` by the account the code host's CLI is signed in as, and exits 0.

#### Scenario: The branch for a ticket

- **WHEN** `factory ticket branch N` runs for a ticket that exists
- **THEN** it prints one line, the pattern with each `{ticket}` replaced by the ticket's key, such as `12` or `PROJ-12`, and each `{user}` by the account the code host's CLI is signed in as, and exits 0.

### Requirement: The spec change's folder

The factory SHALL behave as this line says: When `specs` is `openspec`, the change `factory specs new N` creates is `openspec/changes/issue-N/`, with N's key in lowercase, such as `issue-12` or `issue-proj-12`, whatever `code-host.branch-name` says.

#### Scenario: The spec change's folder

- **WHEN** `specs` is `openspec`
- **THEN** the change `factory specs new N` creates is `openspec/changes/issue-N/`, with N's key in lowercase, such as `issue-12` or `issue-proj-12`, whatever `code-host.branch-name` says.
