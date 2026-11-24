## MODIFIED Requirements

### Requirement: BASE defaults to the default branch

The factory SHALL behave as this line says: When `BASE` is not given, it is the name of the remote whose address is the `repository` line's, then `/`, then the code host's default branch, and `origin/` followed by that branch in a checkout with no `.claude/factory.yaml`. With no such remote it prints the line `init-repository` gives for that and exits 1.

#### Scenario: BASE defaults to the default branch

- **WHEN** `BASE` is not given
- **THEN** it is the name of the remote whose address is the `repository` line's, then `/`, then the code host's default branch, and `origin/` followed by that branch in a checkout with no `.claude/factory.yaml`. With no such remote it prints the line `init-repository` gives for that and exits 1.
