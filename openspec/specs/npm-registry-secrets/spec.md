# npm-registry-secrets Specification

## Purpose

The tokens a repository's `.npmrc` reads to sign in to a private npm registry: how `factory sync` passes them, by name, through the repository's two workflow files to the factory's jobs, and how `factory init` stores and `factory doctor` checks them, for GitHub Actions and for Dependabot.

## Requirements

### Requirement: Sync takes the names in sign-in lines

The factory SHALL behave as this line says: When a line of the `.npmrc` at the repository's root has a key ending in `:_authToken`, `:_auth`, `:_password`, or `:username`, and its value holds `${NAME}` or `${NAME?}`, `factory sync` takes `NAME`. A `${...}` in any other line, or written `\${...}`, is not taken. Each name is taken once, in the order the file first names it.

#### Scenario: Sync takes the names in sign-in lines

- **WHEN** a line of the `.npmrc` at the repository's root has a key ending in `:_authToken`, `:_auth`, `:_password`, or `:username`, and its value holds `${NAME}` or `${NAME?}`
- **THEN** `factory sync` takes `NAME`. A `${...}` in any other line, or written `\${...}`, is not taken. Each name is taken once, in the order the file first names it.

### Requirement: The installing jobs get the variable

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The installing jobs get the variable

- **WHEN** sync takes a name
- **THEN** `factory.yml` passes it by name in one more line under `secrets`, and each job of it that installs has `NAME` in its environment. `factory-review.yml` passes none.

### Requirement: The agent's jobs get the variable

The factory SHALL behave as this line says: When sync takes a name, each job that runs a session has `NAME` in its environment, passed by the same line under `secrets`.

#### Scenario: The agent's jobs get the variable

- **WHEN** sync takes a name
- **THEN** each job that runs a session has `NAME` in its environment, passed by the same line under `secrets`.

### Requirement: Sync adds only lines

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Sync adds only lines

- **WHEN** sync takes one or more names
- **THEN** With names, `factory.yml` is what sync writes without names with only the one line under `secrets` added, and `factory-review.yml` is the same: removing the line gives back, byte for byte, what sync writes without names.

### Requirement: No names, no change

The factory SHALL behave as this line says: When there is no `.npmrc`, or sync takes no name, every file sync writes is the same, byte for byte, as before this change.

#### Scenario: No names, no change

- **WHEN** there is no `.npmrc`, or sync takes no name
- **THEN** every file sync writes is the same, byte for byte, as before this change.

### Requirement: GITHUB_TOKEN is the workflow's own

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: GITHUB_TOKEN is the workflow's own

- **WHEN** the name taken is `GITHUB_TOKEN`
- **THEN** sync passes no secret for it: the jobs that install read packages with their own token, which `factory.yml` gives `packages: read`.

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

### Requirement: Init asks for a token

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Init asks for a token

- **WHEN** a name other than `GITHUB_TOKEN` is set neither as an Actions secret nor as a Dependabot secret
- **THEN** `init`'s plan has a `secrets` row of its own for each such name, after the tools' row and any `store` row, reading `NAME for Actions and for Dependabot`; for a name that needs one copy, `NAME for Actions` or `NAME for Dependabot`, a Dependabot copy it cannot see (line 12) counting as needed. After "Go ahead?" it prints `.npmrc reads NAME for ADDRESS.` and `The factory's workflows install with it. Use a token that can only read.`, reads the value in a masked prompt `Paste it (leave empty to do this later):`, stores it as both, and prints `Stored NAME for Actions and for Dependabot.`

### Requirement: The address init names

The factory SHALL behave as this line says: `ADDRESS` in line 9 is the `registry=` or `@scope:registry=` URL in `.npmrc` whose host and path the sign-in line's key starts with, the longest when several do, or, with none, the key's own `//host/path/`.

#### Scenario: The address init names

- **WHEN** `init` names the registry a sign-in line is for
- **THEN** `ADDRESS` in line 9 is the `registry=` or `@scope:registry=` URL in `.npmrc` whose host and path the sign-in line's key starts with, the longest when several do, or, with none, the key's own `//host/path/`.

### Requirement: One copy set

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: One copy set

- **WHEN** the Actions secret is set and the Dependabot one is not
- **THEN** `init` prints `NAME is set for Actions but not for Dependabot, and GitHub never shows a secret's value.`, asks `Paste the same token again (leave empty to do this later):`, stores it for Dependabot only, and prints `Stored NAME for Dependabot.` The other way round, it says `NAME is set for Dependabot but not for Actions, ...` and stores it for Actions only.

### Requirement: A Dependabot copy init can't see

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A Dependabot copy init can't see

- **WHEN** the Dependabot secret is not set on a repository an organization owns, and the organization's Dependabot secrets cannot be listed
- **THEN** `init` asks for it all the same. With the Actions secret also needed, it prints line 9's lines and then `NAME isn't set for Dependabot on this repository, and only an organization admin can see whether your organization sets it. If it does, leave this empty.` before line 9's prompt. With the Actions secret set, that sentence takes the place of line 11's first, before line 11's prompt. An Actions secret the organization shares counts as set for line 11, whose wording stays.

### Requirement: A token left for later

The factory SHALL behave as this line says: When nothing is pasted for a name, `init` stores nothing for it and prints `No NAME stored. The factory's workflows fail at npm ci until it is. Run factory init again to add it.`

#### Scenario: A token left for later

- **WHEN** nothing is pasted for a name
- **THEN** `init` stores nothing for it and prints `No NAME stored. The factory's workflows fail at npm ci until it is. Run factory init again to add it.`

### Requirement: Both copies set

The factory SHALL behave as this line says: When both copies are set, `init` counts the name in "N secrets these parts read are already set. Replace them?" and asks for it only on yes, then storing both on the repository, even where the organization set one: a repository's secret wins over the organization's of the same name.

#### Scenario: Both copies set

- **WHEN** both copies are set
- **THEN** `init` counts the name in "N secrets these parts read are already set. Replace them?" and asks for it only on yes, then storing both on the repository, even where the organization set one: a repository's secret wins over the organization's of the same name.

### Requirement: No secret for GITHUB_TOKEN

The factory SHALL behave as this line says: `init` asks nothing and stores nothing for `GITHUB_TOKEN`.

#### Scenario: No secret for GITHUB_TOKEN

- **WHEN** `.npmrc` takes `GITHUB_TOKEN`
- **THEN** `init` asks nothing and stores nothing for `GITHUB_TOKEN`.

### Requirement: Init on a refused name

The factory SHALL behave as this line says: When `.npmrc` reads a name lines 6 or 7 refuse, `factory init` prints that line's message after the "Found" block and any line under it about the organization, before any question but which repository, changes nothing else, and exits 1.

#### Scenario: Init on a refused name

- **WHEN** `.npmrc` reads a name lines 6 or 7 refuse
- **THEN** `factory init` prints that line's message after the "Found" block and any line under it about the organization, before any question but which repository, changes nothing else, and exits 1.

### Requirement: Doctor's Actions line

The factory SHALL behave as this line says: When `.npmrc` takes a name other than `GITHUB_TOKEN`, `factory doctor` passes `NAME is set, for installing what .npmrc names` when the Actions secret is set, and otherwise fails `NAME is not set, for installing what .npmrc names` with the fix `Run factory init`.

#### Scenario: Doctor's Actions line

- **WHEN** `.npmrc` takes a name other than `GITHUB_TOKEN`
- **THEN** `factory doctor` passes `NAME is set, for installing what .npmrc names` when the Actions secret is set, and otherwise fails `NAME is not set, for installing what .npmrc names` with the fix `Run factory init`.

### Requirement: Doctor's Dependabot line

The factory SHALL behave as this line says: For the Dependabot copy, `doctor` passes `NAME is set for Dependabot, for installing on Dependabot's pull requests`, or fails `NAME is not set for Dependabot, for installing on Dependabot's pull requests` with the same fix.

#### Scenario: Doctor's Dependabot line

- **WHEN** `.npmrc` takes a name other than `GITHUB_TOKEN`
- **THEN** For the Dependabot copy, `doctor` passes `NAME is set for Dependabot, for installing on Dependabot's pull requests`, or fails `NAME is not set for Dependabot, for installing on Dependabot's pull requests` with the same fix.

### Requirement: Doctor on GITHUB_TOKEN

The factory SHALL behave as this line says: When `.npmrc` takes `GITHUB_TOKEN`, `doctor` prints, shown as off, `GITHUB_TOKEN is the workflow's own token: it installs only the packages that give this repository access`.

#### Scenario: Doctor on GITHUB_TOKEN

- **WHEN** `.npmrc` takes `GITHUB_TOKEN`
- **THEN** `doctor` prints, shown as off, `GITHUB_TOKEN is the workflow's own token: it installs only the packages that give this repository access`.

### Requirement: Doctor's registry line

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Doctor's registry line

- **WHEN** `.github/dependabot.yml` exists
- **THEN** `doctor` checks each registry URL `.npmrc` names on a `registry=` or `@scope:registry=` line, other than `https://registry.npmjs.org/`. It passes `.github/dependabot.yml uses ADDRESS for its npm updates` when a top-level `registries` entry has that `url`, trailing slashes aside, and each `package-ecosystem: npm` update lists that entry's name under its `registries` or has `registries: "*"`.

### Requirement: A registry Dependabot doesn't use

The factory SHALL behave as this line says: Otherwise it prints `? .github/dependabot.yml doesn't use ADDRESS for its npm updates: unless your organization sets that registry for Dependabot, it never sees a new version of a package from there. Add it under registries, and name it in the npm entry's registries`, which fails nothing. Without `.github/dependabot.yml`, there is no registry line.

#### Scenario: A registry Dependabot doesn't use

- **WHEN** `.github/dependabot.yml` exists and does not use a registry `.npmrc` names, as line 19 defines
- **THEN** Otherwise it prints `? .github/dependabot.yml doesn't use ADDRESS for its npm updates: unless your organization sets that registry for Dependabot, it never sees a new version of a package from there. Add it under registries, and name it in the npm entry's registries`, which fails nothing. Without `.github/dependabot.yml`, there is no registry line.

### Requirement: Where doctor's npm lines go

The factory SHALL behave as this line says: `doctor` prints the lines of 16 to 20 after its last secret line today, the secrets a tool always needs (after the `commands.gate` line when that shows), and before the tools' own checks: for each name its Actions line then its Dependabot line, then the registry lines.

#### Scenario: Where doctor's npm lines go

- **WHEN** `doctor` prints the lines of 16 to 20
- **THEN** `doctor` prints the lines of 16 to 20 after its last secret line today, the secrets a tool always needs (after the `commands.gate` line when that shows), and before the tools' own checks: for each name its Actions line then its Dependabot line, then the registry lines.
