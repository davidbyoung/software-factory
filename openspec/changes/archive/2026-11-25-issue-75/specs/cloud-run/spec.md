## MODIFIED Requirements

### Requirement: Setup before the session

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Setup before the session

- **WHEN** When the session's job prepares the repository
- **THEN** `commands.build-setup` is the default branch's, and `factory build-setup` runs it in its copy before any step holds a credential. The work copy's own dependencies are installed by the session, in the sandbox.
