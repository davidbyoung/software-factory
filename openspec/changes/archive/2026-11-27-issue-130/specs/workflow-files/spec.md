## ADDED Requirements

### Requirement: The workflow files

kodor SHALL behave as this line says: When `kodor sync` writes the workflow files, they are `.github/workflows/kodor.yml`, titled `kodor` with the job id `kodor`, and `.github/workflows/kodor-review.yml`, titled `kodor review`. Each calls `kodor-ai/kodor/.github/workflows/FILE@vVERSION` and passes the secrets and variables whose names start `KODOR_` in place of `FACTORY_`. `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_API_KEY` keep their names.

#### Scenario: The workflow files

- **WHEN** `kodor sync` writes the workflow files
- **THEN** they are `.github/workflows/kodor.yml`, titled `kodor` with the job id `kodor`, and `.github/workflows/kodor-review.yml`, titled `kodor review`. Each calls `kodor-ai/kodor/.github/workflows/FILE@vVERSION` and passes the secrets and variables whose names start `KODOR_` in place of `FACTORY_`. `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_API_KEY` keep their names.

### Requirement: The checks' names

kodor SHALL behave as this line says: When a pull request's checks run, the job "Factory files in step" is named "kodor files in step", so its check reads `review / kodor files in step`, and each check of a group starts `kodor /`, as in `kodor / Pull request / Record the verdict`.

#### Scenario: The checks' names

- **WHEN** a pull request's checks run
- **THEN** the job "Factory files in step" is named "kodor files in step", so its check reads `review / kodor files in step`, and each check of a group starts `kodor /`, as in `kodor / Pull request / Record the verdict`.

### Requirement: The workflows' own variables

kodor SHALL behave as this line says: When a workflow sets an environment variable for kodor itself, its name starts `KODOR_`.

#### Scenario: The workflows' own variables

- **WHEN** a workflow sets an environment variable for kodor itself
- **THEN** its name starts `KODOR_`.

### Requirement: The organization's poller file

kodor SHALL behave as this line says: When `kodor init --org` writes an organization's poller, its file is `.github/workflows/kodor-poller.yml`.

#### Scenario: The organization's poller file

- **WHEN** `kodor init --org` writes an organization's poller
- **THEN** its file is `.github/workflows/kodor-poller.yml`.
