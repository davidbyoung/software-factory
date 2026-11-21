## MODIFIED Requirements

### Requirement: Doctor's Actions line

The factory SHALL behave as this line says: When `.npmrc` takes a name other than `GITHUB_TOKEN`, `factory doctor` passes `NAME is set, for installing what .npmrc names` when the Actions secret is set, and otherwise fails `NAME is not set, for installing what .npmrc names` with the fix `Run factory init`.

#### Scenario: Doctor's Actions line

- **WHEN** `.npmrc` takes a name other than `GITHUB_TOKEN`
- **THEN** `factory doctor` passes `NAME is set, for installing what .npmrc names` when the Actions secret is set, and otherwise fails `NAME is not set, for installing what .npmrc names` with the fix `Run factory init`.

### Requirement: A token left for later

The factory SHALL behave as this line says: When nothing is pasted for a name, `init` stores nothing for it and prints `No NAME stored. The factory's workflows fail at npm ci until it is. Run factory init again to add it.`

#### Scenario: A token left for later

- **WHEN** nothing is pasted for a name
- **THEN** `init` stores nothing for it and prints `No NAME stored. The factory's workflows fail at npm ci until it is. Run factory init again to add it.`
