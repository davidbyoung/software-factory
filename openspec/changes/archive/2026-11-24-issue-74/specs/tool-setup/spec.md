## ADDED Requirements

### Requirement: Signed commits on the factory's updates

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Signed commits on the factory's updates

- **WHEN** `factory init` offers signed commits
- **THEN** `factory init` offers signed commits as "Signed commits on the factory's updates", and `FACTORY_SIGNING_KEY` is read only by the updates' job.

### Requirement: What CI's own token may do

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What CI's own token may do

- **WHEN** `factory doctor` or `factory init` runs with `pr-review` set
- **THEN** With `pr-review` set, `factory doctor` prints `✓ CI's own token can only read, unless a workflow says more`, or `✗ CI's own token can write, so code in a pull request could pass "Review verdict": set it to read, in your repository's Settings, Actions, General, Workflow permissions`, or `? Could not tell what CI's own token may do: ` and the reason, and "Left to do" in `factory init` says the same where it can write.
