## MODIFIED Requirements

### Requirement: The check on every pull request

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The check on every pull request

- **WHEN** a pull request is opened or pushed to, or the default branch is pushed to
- **THEN** `factory sync --check` and `factory config check` run on every pull request under `pull_request`, and on a push to the default branch. On a pull request the first is `factory sync --check --against BASE`, the base commit, whose lock line 40 compares with. "Factory files in step" holds no key. The pin of a private preset is checked by the review's Prepare, which refuses a pull request whose lock does not match its preset.

### Requirement: Each job's events and condition

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Each job's events and condition

- **WHEN** an event, a schedule, or a run by hand starts a job in "The jobs"
- **THEN** Each job in "The jobs" runs on the events, schedule, and condition its row gives, except that a job that starts a session is the three jobs `cloud-run` says, and that the review is a job of `run.yml` on `pull_request_target`. A job with no session uses a token of the App's in place of the build, board, or auto-merge token where the App's key and `FACTORY_APP_CLIENT_ID` reach the run. `run.yml` has one more job, "Require the verdict", which runs `factory enroll` on a push to the default branch while `review` is on.

### Requirement: Installing the repository's own dependencies

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Installing the repository's own dependencies

- **WHEN** a job that runs a session starts
- **THEN** A job that runs a session, the review's among them, runs `npm ci` in its copy of the default branch only when that copy's root has a `package-lock.json`, and takes Node's version from its `package.json` when that sets `engines.node`, and 22 otherwise. `commands.build-setup` runs after, as today.
