## ADDED Requirements

### Requirement: Init writes no package.json

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Init writes no package.json

- **WHEN** `factory init` runs
- **THEN** `factory init` writes no `package.json` and no `.gitignore` line, has no `package.json` row under "Found", and still writes a `package.json` before a spec tool's `npm install`.

### Requirement: The specs that name a workflow file

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The specs that name a workflow file

- **WHEN** a line of a spec this requirement lists names an old workflow file, `npm ci` for the factory, or `npx --no-install factory`
- **THEN** Each line of `board-poller`, `board-columns`, `board-sync-trigger`, `default-branch`, `labels-setting`, `npm-registry-secrets`, `ticket-keys`, `tool-setup`, and `cli-output` that names an old workflow file, `npm ci` for the factory, or `npx --no-install factory` names `factory.yml` or `factory-review.yml`, its job, or `factory`. A secret `.npmrc` names still reaches each job that installs or runs a session, and doctor's poller lines name `factory.yml`.

## MODIFIED Requirements

### Requirement: Init is unchanged with today's tools

The factory SHALL behave as this line says: `factory init` prints the same lines and asks the same questions as before this change with today's tools, except its closing checks, as line 26 says, its fixes, as line 25 says, the question that asks for `code-host.branch-name` when the settings in effect have none, the spec tool's question and install that #37's lines 17 to 24 add, and what #73's lines 20 and 46 add and take away.

#### Scenario: Init is unchanged with today's tools

- **WHEN** `factory init` runs with GitHub, GitHub Issues, GitHub Actions, and Claude Code
- **THEN** `factory init` prints the same lines and asks the same questions as before this change with today's tools, except its closing checks, as line 26 says, its fixes, as line 25 says, the question that asks for `code-host.branch-name` when the settings in effect have none, the spec tool's question and install that #37's lines 17 to 24 add, and what #73's lines 20 and 46 add and take away.

### Requirement: A disabled poller workflow

The factory SHALL behave as this line says: When `builds.trigger` is `github-action` and the poller's workflow is disabled on GitHub Actions, `factory doctor` fails with `factory.yml is disabled` and the fix `Enable it on the Actions tab, or run: gh workflow enable factory.yml`.

#### Scenario: A disabled poller workflow

- **WHEN** `builds.trigger` is `github-action` and the poller's workflow is disabled on GitHub Actions
- **THEN** `factory doctor` fails with `factory.yml is disabled` and the fix `Enable it on the Actions tab, or run: gh workflow enable factory.yml`.

### Requirement: A poller workflow not yet pushed

The factory SHALL behave as this line says: When `builds.trigger` is `github-action` and the workflow is not yet on the default branch, `doctor` shows that check as off, reading `factory.yml is not on the default branch yet`, so `init`'s own checks pass before the commit.

#### Scenario: A poller workflow not yet pushed

- **WHEN** `builds.trigger` is `github-action` and the workflow is not yet on the default branch
- **THEN** `doctor` shows that check as off, reading `factory.yml is not on the default branch yet`, so `init`'s own checks pass before the commit.
