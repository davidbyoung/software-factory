## MODIFIED Requirements

### Requirement: Init asks for a token

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Init asks for a token

- **WHEN** a name other than `GITHUB_TOKEN` is set neither as an Actions secret nor as a Dependabot secret
- **THEN** `init`'s plan has a `secrets` row of its own for each such name, after the tools' row and any `store` row, reading `NAME for Actions and for Dependabot`; for a name that needs one copy, `NAME for Actions` or `NAME for Dependabot`, a Dependabot copy it cannot see (line 12) counting as needed. After "Go ahead?" it prints `.npmrc reads NAME for ADDRESS.` and `The factory's workflows install with it. Use a token that can only read.`, reads the value in a masked prompt `Paste it (leave empty to do this later):`, stores it as both, and prints `Stored NAME for Actions and for Dependabot.`

### Requirement: Init on a refused name

The factory SHALL behave as this line says: When `.npmrc` reads a name lines 6 or 7 refuse, `factory init` prints that line's message after the "Found" block and any line under it about the organization, before any question but which repository, changes nothing else, and exits 1.

#### Scenario: Init on a refused name

- **WHEN** `.npmrc` reads a name lines 6 or 7 refuse
- **THEN** `factory init` prints that line's message after the "Found" block and any line under it about the organization, before any question but which repository, changes nothing else, and exits 1.
