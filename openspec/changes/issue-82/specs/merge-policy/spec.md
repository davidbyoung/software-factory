## ADDED Requirements

### Requirement: A policy with a command and an agent holds only on a finding

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A policy with a command and an agent holds only on a finding

- **WHEN** a policy with both `run` and `agent` applies to a pull request's files
- **THEN** the merge policy runs its command once for each folder, from the default branch's checkout with no credential, and holds the pull request for a person when the command found something or failed; a policy with `agent` alone holds by its files, as before.
