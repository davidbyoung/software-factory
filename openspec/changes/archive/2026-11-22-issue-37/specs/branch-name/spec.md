## ADDED Requirements

### Requirement: The spec change's folder

The factory SHALL behave as this line says: When `specs` is `openspec`, the change `factory specs new N` creates is `openspec/changes/issue-N/`, with N as the ticket system writes it, in lowercase, whatever `code-host.branch-name` says.

#### Scenario: The spec change's folder

- **WHEN** `specs` is `openspec`
- **THEN** The change `factory specs new N` creates is `openspec/changes/issue-N/`, with N as the ticket system writes it, in lowercase, whatever `code-host.branch-name` says.

## REMOVED Requirements

### Requirement: The spec change's name

**Reason**: `factory specs change-name N` is removed: `factory specs new N` and `factory specs finish N` take the ticket's number, so the change's name is the spec tool adapter's business.

**Migration**: Run `factory specs new N` and `factory specs finish N` in place of naming the change.

### Requirement: The spec change's name with specs off

**Reason**: `factory specs change-name N` is removed, as above.

**Migration**: None.
