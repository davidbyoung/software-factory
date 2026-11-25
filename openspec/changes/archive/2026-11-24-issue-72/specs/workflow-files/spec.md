## ADDED Requirements

### Requirement: The job that tells the others

The factory SHALL behave as this line says: When `run.yml` runs on `pull_request_target` opened, reopened, or closed for a pull request from this repository whose body holds `Part of `, the job "Tell the other repositories" runs. No session and no pull request's code is in it.

#### Scenario: The job that tells the others

- **WHEN** `run.yml` runs on `pull_request_target` opened, reopened, or closed for a pull request from this repository whose body holds `Part of `
- **THEN** the job "Tell the other repositories" runs. No session and no pull request's code is in it.

### Requirement: The order job

The factory SHALL behave as this line says: When `factory.yml` is run by hand with the job `order` and a pull request's number as `pr`, the job "Record the verdict" posts both statuses for it.

#### Scenario: The order job

- **WHEN** `factory.yml` is run by hand with the job `order` and a pull request's number as `pr`
- **THEN** the job "Record the verdict" posts both statuses for it.
