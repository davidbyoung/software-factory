# run-credential Specification

## Purpose

The credential a run in GitHub Actions works with: the App's key `factory.yml` passes, the token a job with no session makes from it, who posts "Review verdict", how a session's commits are named under the App, and `factory enroll`, which has "Review verdict" required once a repository's setup merges.

## Requirements

### Requirement: What each workflow file passes

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What each workflow file passes

- **WHEN** `factory sync` writes the two workflow files
- **THEN** When `factory sync` writes the two workflow files, `factory.yml` passes `app-key` and the other secrets to `run.yml`, and `factory-review.yml` passes none and has only `contents: read`.

### Requirement: A token of the App's for the run

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A token of the App's for the run

- **WHEN** a job with no session needs more than the workflow's own token
- **THEN** When a job with no session needs more than the workflow's own token and both `FACTORY_APP_CLIENT_ID` and the App's key reach the run, it makes a token of the App's for the repository and for each preset's repository of the same owner that the lock names, with only the permissions that job uses. With no key it uses the build, board, or auto-merge token, as today.

### Requirement: Who posts the verdict

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Who posts the verdict

- **WHEN** the "Review verdict" status is posted
- **THEN** The "Review verdict" status is posted with the workflow's own token, by the review run's Publish, and by the verdict's job for an event that starts no review.

### Requirement: A session's commits under the App

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A session's commits under the App

- **WHEN** a session commits in the cloud
- **THEN** A session's commits have Claude as author and, as today, the App's bot as committer, or the account of the person's token, whose name and address Prepare hands over. They are not signed.

### Requirement: The App's key counts as the build token

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The App's key counts as the build token

- **WHEN** `factory session ready` runs
- **THEN** `factory session ready` counts the App's key as the build token.

### Requirement: The App is not installed on the repository

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The App is not installed on the repository

- **WHEN** the App is not installed on the repository
- **THEN** When the App is not installed on the repository, Prepare fails with the line "A run in the cloud" shows.

### Requirement: factory enroll on a push to the default branch

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: factory enroll on a push to the default branch

- **WHEN** the default branch is pushed to
- **THEN** On a push to the default branch, a job runs `factory enroll`. With `pr-review` set: under the App it sets `software-factory` to `on` for the repository when it is not; with a person's build token it makes the rule `factory init` makes today when the repository has none. It prints the matching ✓ line "the rest" shows, and nothing when there was nothing to do. Under the App, where ORG has no such property, and with no token of either kind, it prints the first `?` line; when GitHub refuses the value, the second. It passes either way.

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

### Requirement: The second token

The factory SHALL behave as this line says: When a job reads or writes another of a ticket's repositories under the App, it makes a second token for those repositories alone, which may read contents and pull requests, write issues, and start runs, and nothing else. A pull request's verdict job's may only read.

#### Scenario: The second token

- **WHEN** a job reads or writes another of a ticket's repositories under the App
- **THEN** it makes a second token for those repositories alone, which may read contents and pull requests, write issues, and start runs, and nothing else. A pull request's verdict job's may only read.

### Requirement: The second token with no App

The factory SHALL behave as this line says: When no App's key reaches the run, the build token is used, and otherwise the board token.

#### Scenario: The second token with no App

- **WHEN** no App's key reaches the run
- **THEN** the build token is used, and otherwise the board token.
