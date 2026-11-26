## ADDED Requirements

### Requirement: A ticket that names a new credential needs Threats

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A ticket that names a new credential needs Threats

- **WHEN** the owner's text of a ticket, its lines before the first `## ` heading outside code fences, names a credential as line 6 does that the default branch doesn't have outside docs and tests, or write access as `NAME: write`, and the body has no `## Threats` heading
- **THEN** `factory ticket refined` prints one line, `missing: ## Threats, since the ticket names a credential this repository does not have: NAME, NAME`, or `missing: ## Threats, since the ticket gives a workflow write access: NAME: write`, and exits 1, for a ticket with or without `spec`.
