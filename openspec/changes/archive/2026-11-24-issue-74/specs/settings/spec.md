## ADDED Requirements

### Requirement: The hosts a session may reach

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The hosts a session may reach

- **WHEN** `.claude/factory.yaml` sets `builds.hosts`
- **THEN** `builds.hosts` is a list of host names, empty by default, and `github.com` or a host under it is refused: `builds.hosts can't name GitHub: a build has no GitHub access`. A host is a name with a dot in it.
