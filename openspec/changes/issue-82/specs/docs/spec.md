## ADDED Requirements

### Requirement: The credentials policy docs

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The credentials policy docs

- **WHEN** the docs are read
- **THEN** `docs/approval-policies.md` is the page under "Proposed docs", `docs/skills.md` changes as it shows, `docs/configuration.md`'s `approval-policies` entry says "The factory adds one policy of its own, `credentials` ([The factory's own policy](approval-policies.md#the-factorys-own-policy)), which `off: true` turns off.", and the page gives the widened rule's measured counts.
