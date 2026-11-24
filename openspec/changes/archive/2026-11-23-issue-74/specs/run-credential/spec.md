## Purpose

The credential a run in GitHub Actions works with: the App's key both workflow files pass, the token a job makes from it, what keeps the workflow's own token, how a session's commits are named under the App, and `factory enroll`, which has "Review verdict" required once a repository's setup merges.

## ADDED Requirements

### Requirement: Each workflow file passes the App's key

The factory SHALL behave as this line says: When `factory sync` writes the two workflow files, each passes `app-key`, as "What `factory init --org` creates" shows, whatever the settings.

#### Scenario: Each workflow file passes the App's key

- **WHEN** `factory sync` writes the two workflow files
- **THEN** each passes `app-key`, as "What `factory init --org` creates" shows, whatever the settings.

### Requirement: A token of the App's for the run

The factory SHALL behave as this line says: When a job needs more than the workflow's own token and both `FACTORY_APP_CLIENT_ID` and the App's key reach the run, it checks out with the workflow's own token, installs the factory, then makes a token of the App's for the repository and for each preset's repository of the same owner that the lock names. It uses that token wherever it uses the build, board, or auto-merge token today, git's pushes included. With no key it uses those tokens, as today.

#### Scenario: A token of the App's for the run

- **WHEN** a job needs more than the workflow's own token and both `FACTORY_APP_CLIENT_ID` and the App's key reach the run
- **THEN** it checks out with the workflow's own token, installs the factory, then makes a token of the App's for the repository and for each preset's repository of the same owner that the lock names. It uses that token wherever it uses the build, board, or auto-merge token today, git's pushes included. With no key it uses those tokens, as today.

### Requirement: The review keeps the workflow's own token

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The review keeps the workflow's own token

- **WHEN** the automated review runs, or the "Review verdict" status is posted
- **THEN** The automated review and the "Review verdict" status keep the workflow's own token.

### Requirement: A session's commits under the App

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A session's commits under the App

- **WHEN** a session commits in a run under the App
- **THEN** Under the App, a session's commits have Claude as author and `SLUG[bot]` as committer, with the bot's no-reply address, and are not signed, whatever `FACTORY_SIGNING_KEY` holds.

### Requirement: The App's key counts as the build token

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The App's key counts as the build token

- **WHEN** `factory session ready` runs
- **THEN** `factory session ready` counts the App's key as the build token.

### Requirement: The App is not installed on the repository

The factory SHALL behave as this line says: When the App is not installed on the repository, the job fails with the line "A run in an organization" shows.

#### Scenario: The App is not installed on the repository

- **WHEN** the App is not installed on the repository
- **THEN** the job fails with the line "A run in an organization" shows.

### Requirement: factory enroll on a push to the default branch

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: factory enroll on a push to the default branch

- **WHEN** the default branch is pushed to
- **THEN** On a push to the default branch, a job runs `factory enroll`. With `pr-review` set: under the App it sets `software-factory` to `on` for the repository when it is not; with a person's build token it makes the rule `factory init` makes today when the repository has none. It prints the matching ✓ line "the rest" shows, and nothing when there was nothing to do. Under the App, where ORG has no such property, and with no token of either kind, it prints the first `?` line; when GitHub refuses the value, the second. It passes either way.

### Requirement: A session's token is renewed

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A session's token is renewed

- **WHEN** a job runs a session under the App
- **THEN** In the job that runs a session, under the App, `factory session token` signs the GitHub CLI and git in with a token of the App's, made for the repositories line 21 names, and leaves a process running that makes a new one every 45 minutes until the job ends, trying again each minute after a failure. The App's key reaches that one step, and no later step of the job is given a token made once.

### Requirement: The branch's user under the App

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The branch's user under the App

- **WHEN** a build under the App names its branch from a pattern with `{user}`
- **THEN** Under the App, `{user}` in `code-host.branch-name` is the App's name as GitHub writes it in an address, such as `software-factory-for-acme`, since an App's token may not ask who is signed in.

### Requirement: A token's permissions

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A token's permissions

- **WHEN** a job makes a token of the App's
- **THEN** Each token a job makes carries only the permissions that job uses. Only the job that runs `factory enroll` may set a repository's properties, and a session's token never can.
