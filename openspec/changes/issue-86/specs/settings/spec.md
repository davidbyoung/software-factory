## ADDED Requirements

### Requirement: GitHub as a host is named with its file

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: GitHub as a host is named with its file

- **WHEN** `builds.hosts` names GitHub in `.claude/factory.yaml`
- **THEN** `factory sync`, `factory config check`, and `factory init` print `.claude/factory.yaml: builds.hosts can't name GitHub: a build has no GitHub access`.

### Requirement: One set of words for every reader

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: One set of words for every reader

- **WHEN** one bad value is read by `factory sync`, `factory config check`, `factory init`, `factory preset check`, `factory preset add`, `factory update`, `factory init --org`, and the poller
- **THEN** each prints the same words.

## MODIFIED Requirements

### Requirement: The hosts a session may reach

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The hosts a session may reach

- **WHEN** `.claude/factory.yaml` sets `builds.hosts`
- **THEN** `builds.hosts` is a list of host names, empty by default, and `github.com` or a host under it is refused: `.claude/factory.yaml: builds.hosts can't name GitHub: a build has no GitHub access`. A host is a name with a dot in it.
