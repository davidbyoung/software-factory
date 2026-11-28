## ADDED Requirements

### Requirement: The workflow files

lunamill SHALL behave as this line says: When `lunamill sync` writes the workflow files, they are `.github/workflows/lunamill.yml`, titled `lunamill` with the job id `lunamill`, and `.github/workflows/lunamill-review.yml`, titled `lunamill review`. Each calls `lunamill-ai/lunamill/.github/workflows/FILE@vVERSION` and passes the secrets and variables whose names start `LUNAMILL_` in place of `FACTORY_`. `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_API_KEY` keep their names.

#### Scenario: The workflow files

- **WHEN** `lunamill sync` writes the workflow files
- **THEN** they are `.github/workflows/lunamill.yml`, titled `lunamill` with the job id `lunamill`, and `.github/workflows/lunamill-review.yml`, titled `lunamill review`. Each calls `lunamill-ai/lunamill/.github/workflows/FILE@vVERSION` and passes the secrets and variables whose names start `LUNAMILL_` in place of `FACTORY_`. `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_API_KEY` keep their names.

### Requirement: The checks' names

lunamill SHALL behave as this line says: When a pull request's checks run, the job "Factory files in step" is named "lunamill files in step", so its check reads `review / lunamill files in step`, and each check of a group starts `lunamill /`, as in `lunamill / Pull request / Record the verdict`.

#### Scenario: The checks' names

- **WHEN** a pull request's checks run
- **THEN** the job "Factory files in step" is named "lunamill files in step", so its check reads `review / lunamill files in step`, and each check of a group starts `lunamill /`, as in `lunamill / Pull request / Record the verdict`.

### Requirement: The workflows' own variables

lunamill SHALL behave as this line says: When a workflow sets an environment variable for lunamill itself, its name starts `LUNAMILL_`.

#### Scenario: The workflows' own variables

- **WHEN** a workflow sets an environment variable for lunamill itself
- **THEN** its name starts `LUNAMILL_`.

### Requirement: The organization's poller file

lunamill SHALL behave as this line says: When `lunamill init --org` writes an organization's poller, its file is `.github/workflows/lunamill-poller.yml`.

#### Scenario: The organization's poller file

- **WHEN** `lunamill init --org` writes an organization's poller
- **THEN** its file is `.github/workflows/lunamill-poller.yml`.
