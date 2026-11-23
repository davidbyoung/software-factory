## MODIFIED Requirements

### Requirement: The installing jobs get the variable

The factory SHALL behave as this line says: When sync takes a name, `factory.yml` and `factory-review.yml` pass it by name in one more line under `secrets`, and each job that installs has `NAME` in its environment.

#### Scenario: The installing jobs get the variable

- **WHEN** sync takes a name
- **THEN** `factory.yml` and `factory-review.yml` pass it by name in one more line under `secrets`, and each job that installs has `NAME` in its environment.

### Requirement: The agent's jobs get the variable

The factory SHALL behave as this line says: When sync takes a name, each job that runs a session has `NAME` in its environment, passed by the same line under `secrets`.

#### Scenario: The agent's jobs get the variable

- **WHEN** sync takes a name
- **THEN** each job that runs a session has `NAME` in its environment, passed by the same line under `secrets`.

### Requirement: A GITHUB_ name is refused

The factory SHALL behave as this line says: When a sign-in line reads a name starting with `GITHUB_` other than `GITHUB_TOKEN`, `factory sync` writes nothing, prints `.npmrc reads ${NAME} to sign in, and GitHub refuses a secret whose name starts with GITHUB_. Rename it in .npmrc, then run: factory sync` on standard error, and exits 1.

#### Scenario: A GITHUB_ name is refused

- **WHEN** a sign-in line reads a name starting with `GITHUB_` other than `GITHUB_TOKEN`
- **THEN** `factory sync` writes nothing, prints `.npmrc reads ${NAME} to sign in, and GitHub refuses a secret whose name starts with GITHUB_. Rename it in .npmrc, then run: factory sync` on standard error, and exits 1.

### Requirement: A name the runner sets is refused

The factory SHALL behave as this line says: When a sign-in line reads `HOME`, `PATH`, `CI`, or a name starting with `RUNNER_` or `ACTIONS_`, `factory sync` writes nothing, prints `.npmrc reads ${NAME} to sign in, and the runner sets NAME for itself. Rename it in .npmrc, then run: factory sync` on standard error, and exits 1.

#### Scenario: A name the runner sets is refused

- **WHEN** a sign-in line reads `HOME`, `PATH`, `CI`, or a name starting with `RUNNER_` or `ACTIONS_`
- **THEN** `factory sync` writes nothing, prints `.npmrc reads ${NAME} to sign in, and the runner sets NAME for itself. Rename it in .npmrc, then run: factory sync` on standard error, and exits 1.

### Requirement: Init's Found row

The factory SHALL behave as this line says: When `.npmrc` takes a name, `factory init` prints a `.npmrc` row under "Found", after `Cloud builds`, reading `reads ` and the names joined by `, `. With none, there is no row.

#### Scenario: Init's Found row

- **WHEN** `.npmrc` takes a name
- **THEN** `factory init` prints a `.npmrc` row under "Found", after `Cloud builds`, reading `reads ` and the names joined by `, `. With none, there is no row.
