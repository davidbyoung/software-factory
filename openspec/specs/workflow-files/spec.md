# workflow-files Specification

## Purpose

The two workflow files `factory sync` writes into a repository, `.github/workflows/factory.yml` and `.github/workflows/factory-review.yml`: what they hold, the version of the factory's own workflows they call, and when each job runs.

## Requirements

### Requirement: The two workflow files

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The two workflow files

- **WHEN** `factory sync` runs
- **THEN** it writes `.github/workflows/factory.yml` and `.github/workflows/factory-review.yml`, whatever the settings, as "What the pull request holds" shows them, with the line `run-credential` adds under each file's `secrets`: `app-key: ${{ secrets.FACTORY_APP_PRIVATE_KEY }}`. It writes no other workflow and nothing under `.github/actions/`. It overwrites today's `factory-review.yml`, and deletes the ten other `factory-*.yml` files and `.github/actions/factory-agent/` that the lock lists.

### Requirement: The version each file calls

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The version each file calls

- **WHEN** `factory sync` writes the two workflow files
- **THEN** Each file's one job calls `davidbyoung/software-factory/.github/workflows/run.yml` or `review.yml` at `@v` and the version the lock names, and `factory sync --check` fails when either names another.

### Requirement: The factory's own repository

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The factory's own repository

- **WHEN** `factory sync` writes the two workflow files in the factory's own repository
- **THEN** In the factory's own repository the two call `./.github/workflows/run.yml` and `./.github/workflows/review.yml`, and each job installs the factory from the checkout.

### Requirement: What the files hold from the settings

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What the files hold from the settings

- **WHEN** `factory sync` fills in the two workflow files from the settings
- **THEN** The files hold, from the settings: the default branch in the push trigger; the poller's `cron` line, written as today's, only when `builds.trigger` is `github-action` and the lock records no preset whose repository runs the poller; which of `review`, `board`, `auto-merge`, `poller`, and `dependabot` are on, by the settings "The jobs" names for each, `poller` being off with such a preset; each session's minutes; the `verdict-override` label's name; and the names of the secrets `.npmrc` and the ticket system read.

### Requirement: Each job's events and condition

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Each job's events and condition

- **WHEN** an event, a schedule, or a run by hand starts a job in "The jobs"
- **THEN** Each job in "The jobs" runs on the events, schedule, and condition its row gives, except that a job that starts a session is the three jobs `cloud-run` says, and that the review is a job of `run.yml` on `pull_request_target`. A job with no session uses a token of the App's in place of the build, board, or auto-merge token where the App's key and `FACTORY_APP_CLIENT_ID` reach the run. `run.yml` has one more job, "Require the verdict", which runs `factory enroll` on a push to the default branch while `review` is on.

### Requirement: A job whose part is off

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A job whose part is off

- **WHEN** a job's row names one of those five, and that part is off
- **THEN** A job whose row names one of those five is skipped, and starts no runner, when it is off. Every other condition in that column is checked by the job itself.

### Requirement: Starting a job through factory.yml

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Starting a job through factory.yml

- **WHEN** `factory build N`, the poller, or a command that starts the board sync starts its job
- **THEN** `factory build N`, the poller, and the commands that start the board sync start their job through `factory.yml`. `factory build N` prints its run's link as today.

### Requirement: Installing the repository's own dependencies

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Installing the repository's own dependencies

- **WHEN** a job that runs a session starts
- **THEN** A job that runs a session, the review's among them, runs `npm ci` in its copy of the default branch only when that copy's root has a `package-lock.json`, and takes Node's version from its `package.json` when that sets `engines.node`, and 22 otherwise. `commands.build-setup` runs after, as today.

### Requirement: The check on every pull request

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The check on every pull request

- **WHEN** a pull request is opened or pushed to, or the default branch is pushed to
- **THEN** `factory sync --check` and `factory config check` run on every pull request under `pull_request`, and on a push to the default branch. On a pull request the first is `factory sync --check --against BASE`, the base commit, whose lock line 40 compares with. "Factory files in step" holds no key. The pin of a private preset is checked by the review's Prepare, which refuses a pull request whose lock does not match its preset.

### Requirement: A preset whose repository runs the poller

The factory SHALL behave as this line says: When `builds.trigger` is `github-action` and a preset the repository follows is recorded so, `factory sync` writes no poller schedule and leaves `poller` out of `parts`, `factory doctor` prints the `factory-poller.yml is enabled in` line for that repository in place of its own workflow's, and the flag on a ticket that has not started reads `not started, is the poller in OWNER/NAME running?`

#### Scenario: A preset whose repository runs the poller

- **WHEN** `builds.trigger` is `github-action` and a preset the repository follows is recorded so
- **THEN** `factory sync` writes no poller schedule and leaves `poller` out of `parts`, `factory doctor` prints the `factory-poller.yml is enabled in` line for that repository in place of its own workflow's, and the flag on a ticket that has not started reads `not started, is the poller in OWNER/NAME running?`

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
