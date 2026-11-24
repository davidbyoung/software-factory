## ADDED Requirements

### Requirement: Signed commits on the factory's updates

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Signed commits on the factory's updates

- **WHEN** `factory init` offers signed commits
- **THEN** `factory init` offers signed commits as "Signed commits on the factory's updates", and `FACTORY_SIGNING_KEY` is read only by the updates' job.
