## MODIFIED Requirements

### Requirement: Each workflow file passes the App's key

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Each workflow file passes the App's key

- **WHEN** `factory sync` writes the two workflow files
- **THEN** When `factory sync` writes the two workflow files, `factory.yml` passes `app-key` and the other secrets to `run.yml`, and `factory-review.yml` passes none and has only `contents: read`.

### Requirement: A token of the App's for the run

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A token of the App's for the run

- **WHEN** a job with no session needs more than the workflow's own token
- **THEN** When a job with no session needs more than the workflow's own token and both `FACTORY_APP_CLIENT_ID` and the App's key reach the run, it makes a token of the App's for the repository and for each preset's repository of the same owner that the lock names, with only the permissions that job uses. With no key it uses the build, board, or auto-merge token, as today.

### Requirement: The review keeps the workflow's own token

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The review keeps the workflow's own token

- **WHEN** the "Review verdict" status is posted
- **THEN** The "Review verdict" status is posted with the workflow's own token, by the review run's Publish, and by the verdict's job for an event that starts no review.

### Requirement: A session's commits under the App

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A session's commits under the App

- **WHEN** a session commits in the cloud
- **THEN** A session's commits have Claude as author and, as today, the App's bot as committer, or the account of the person's token, whose name and address Prepare hands over. They are not signed.

### Requirement: The App is not installed on the repository

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The App is not installed on the repository

- **WHEN** the App is not installed on the repository
- **THEN** When the App is not installed on the repository, Prepare fails with the line "A run in the cloud" shows.

### Requirement: The branch's user under the App

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The branch's user under the App

- **WHEN** a build under the App names its branch from a pattern with `{user}`
- **THEN** `{user}` in `code-host.branch-name` is the App's name as GitHub writes it in an address, such as `software-factory-for-acme`, read in Prepare.

### Requirement: A token's permissions

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A token's permissions

- **WHEN** a job makes a token of the App's
- **THEN** Each token a job makes carries only the permissions that job uses. Only the job that runs `factory enroll` may set a repository's properties, and only the updates' may change a workflow file.

## REMOVED Requirements

### Requirement: A session's token is renewed

**Reason**: No session holds a token: each is in a job with no sign-in.

**Migration**: None. Publish signs in again after waiting for CI.
